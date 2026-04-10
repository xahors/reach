import * as sdk from 'matrix-js-sdk';
import Olm from '@matrix-org/olm';
import * as RustSdkCryptoJs from '@matrix-org/matrix-sdk-crypto-wasm';
import { type CryptoApi } from 'matrix-js-sdk/lib/crypto-api';

declare global {
  interface Window {
    OLM_OPTIONS?: {
      locateFile?: (path: string) => string;
    };
    Olm?: typeof Olm;
  }
}

// Ensure Olm and Rust crypto options are set
window.OLM_OPTIONS = {
  locateFile: () => '/olm.wasm'
};
window.Olm = Olm;

interface InternalCrypto extends CryptoApi {
  checkKeyBackup?: () => Promise<void>;
}

class MatrixService {
  private client: sdk.MatrixClient | null = null;
  private tempRecoveryKey: string | null = null;
  private wasmInitialized = false;

  private async initWasm() {
    if (this.wasmInitialized) return;
    try {
      console.log("Initializing Rust crypto WASM...");
      await RustSdkCryptoJs.initAsync('/matrix_sdk_crypto_wasm_bg.wasm');
      this.wasmInitialized = true;
      console.log("Rust crypto WASM initialized.");
    } catch (e) {
      console.error("Failed to initialize Rust crypto WASM:", e);
    }
  }

  private async createClientInstance(homeserver: string, accessToken?: string, userId?: string, deviceId?: string) {
    const store = new sdk.IndexedDBStore({
      indexedDB: window.indexedDB,
      dbName: 'reach-matrix-store',
      localStorage: window.localStorage,
    });

    const client = sdk.createClient({
      baseUrl: homeserver,
      accessToken,
      userId,
      deviceId,
      store,
      useAuthorizationHeader: true,
      timelineSupport: true,
      cryptoCallbacks: {
        getSecretStorageKey: async ({ keys }) => {
          if (!this.tempRecoveryKey) return null;
          const rawInput = this.tempRecoveryKey.trim();
          const keyId = Object.keys(keys)[0];
          const keyInfo = keys[keyId];
          
          console.log(`SDK requested secret key for ID: ${keyId}`);

          // 1. Check if it's a recovery key (Base58 starting with 'E')
          if (rawInput.startsWith('E') && rawInput.length > 40) {
            try {
              const { decodeRecoveryKey } = await import("matrix-js-sdk/lib/crypto-api/recovery-key.js");
              const decoded = decodeRecoveryKey(rawInput);
              console.log("Providing decoded Recovery Key bytes to SDK.");
              return [keyId, decoded];
            } catch (e) {
              console.warn("Decoding recovery key failed, falling back to treating as passphrase:", e);
            }
          }

          // 2. If keyInfo has passphrase data, derive the key using the SDK helper
          if (keyInfo.passphrase) {
            try {
              const { deriveRecoveryKeyFromPassphrase } = await import("matrix-js-sdk/lib/crypto-api/index.js");
              console.log("Deriving key from Security Phrase...");
              const derivedKey = await deriveRecoveryKeyFromPassphrase(
                rawInput,
                keyInfo.passphrase.salt,
                keyInfo.passphrase.iterations
              );
              console.log("Providing derived passphrase key to SDK.");
              return [keyId, derivedKey];
            } catch (e) {
              console.error("Failed to derive key from passphrase:", e);
            }
          }

          // 3. Fallback: Treat as raw bytes (usually fails for passphrase-based keys but good for manual keys)
          console.log("Providing raw bytes to SDK (fallback).");
          return [keyId, new TextEncoder().encode(rawInput)];
        }
      }
    });

    try {
      await store.startup();
    } catch (e) {
      console.error("Failed to start Matrix store:", e);
    }

    // Fetch TURN servers if possible
    try {
      const turnServers = await client.getTurnServers();
      if (turnServers && turnServers.length > 0) {
        console.log("Fetched TURN servers:", turnServers.length);
        client.setForceTURN(false); // Let it decide
      }
    } catch (e) {
      console.warn("Failed to fetch TURN servers:", e);
    }

    return client;
  }

  async withRecoveryKey<T>(key: string, fn: () => Promise<T>): Promise<T> {
    this.tempRecoveryKey = key;
    try {
      return await fn();
    } finally {
      this.tempRecoveryKey = null;
    }
  }

  async login(homeserver: string, username: string, password: string): Promise<sdk.MatrixClient> {
    await this.initWasm();
    const tempClient = sdk.createClient({ baseUrl: homeserver });
    const result = await tempClient.login('m.login.password', {
      user: username,
      password: password,
    });

    const client = await this.createClientInstance(homeserver, result.access_token, result.user_id, result.device_id);
    this.client = client;

    localStorage.setItem('matrix_access_token', result.access_token);
    localStorage.setItem('matrix_user_id', result.user_id);
    localStorage.setItem('matrix_device_id', result.device_id!);
    localStorage.setItem('matrix_homeserver', homeserver);

    await this.initEncryption();
    await this.start();
    return this.client;
  }

  async loginWithStoredToken(): Promise<sdk.MatrixClient | null> {
    const accessToken = localStorage.getItem('matrix_access_token');
    const userId = localStorage.getItem('matrix_user_id');
    const deviceId = localStorage.getItem('matrix_device_id');
    const homeserver = localStorage.getItem('matrix_homeserver');

    if (accessToken && userId && homeserver) {
      await this.initWasm();
      const client = await this.createClientInstance(homeserver, accessToken, userId, deviceId || undefined);
      this.client = client;
      await this.initEncryption();
      await this.start();
      return this.client;
    }
    return null;
  }

  private async initEncryption() {
    if (!this.client) return;
    try {
      console.log("Initializing encryption components...");
      
      await this.initWasm();

      try {
        await Olm.init();
      } catch (e) {
        console.warn("Olm legacy init failed:", e);
      }

      if (typeof this.client.initRustCrypto === 'function') {
        console.log("Calling client.initRustCrypto()...");
        try {
          // Matrix SDK v41 initRustCrypto arguments
          await this.client.initRustCrypto({
            useIndexedDB: true,
            cryptoDatabasePrefix: 'matrix-js-sdk'
          });
          console.log("Rust crypto initialized successfully.");
        } catch (err) {
          console.error("Rust crypto initialization failed:", err);
        }
        
        // After Rust crypto is initialized, we can check for backup
        try {
          const crypto = this.getCrypto() as InternalCrypto | null;
          if (crypto && typeof crypto.checkKeyBackup === 'function') {
            console.log("Checking key backup status...");
            await crypto.checkKeyBackup();
          }
        } catch (e) {
          console.warn("Key backup check failed during init:", e);
        }
      } else {
        console.warn("this.client.initRustCrypto is NOT a function! Client keys:", Object.keys(this.client));
      }
      
      console.log("Encryption initialization finished.");
    } catch (e) {
      console.error('Failed to initialize crypto:', e);
    }
  }

  getCrypto(): CryptoApi | null {
    if (!this.client) return null;
    // In SDK v41, getCrypto() returns this.cryptoBackend
    const internalClient = this.client as unknown as { cryptoBackend?: InternalCrypto };
    return (this.client.getCrypto() || internalClient.cryptoBackend) as CryptoApi | null;
  }


  isCryptoEnabled(): boolean {
    return !!this.getCrypto();
  }

  async start() {
    if (!this.client) return;
    await this.client.startClient({ 
      initialSyncLimit: 10,
      lazyLoadMembers: true,
    });
  }

  logout() {
    if (this.client) {
      this.client.stopClient();
      this.client.clearStores();
    }
    this.client = null;
    localStorage.removeItem('matrix_access_token');
    localStorage.removeItem('matrix_user_id');
    localStorage.removeItem('matrix_device_id');
    localStorage.removeItem('matrix_homeserver');
    window.location.reload();
  }

  getClient(): sdk.MatrixClient | null {
    return this.client;
  }
}

export const matrixService = new MatrixService();
