import * as sdk from 'matrix-js-sdk';
import Olm from '@matrix-org/olm';
import * as RustSdkCryptoJs from '@matrix-org/matrix-sdk-crypto-wasm';

// Ensure Olm and Rust crypto options are set
// @ts-expect-error: necessary to bypass SDK type mismatch
window.OLM_OPTIONS = {
  locateFile: () => '/olm.wasm'
};
window.Olm = Olm;

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
          
          console.log(`SDK requested secret key for ID: ${keyId}`, keyInfo);

          if (keyInfo.passphrase) {
            console.log("Providing Security Phrase bytes to SDK.");
            return [keyId, new TextEncoder().encode(rawInput)];
          }

          if (rawInput.startsWith('E')) {
            try {
              const { decodeRecoveryKey } = await import("matrix-js-sdk/lib/crypto-api/recovery-key.js");
              const decoded = decodeRecoveryKey(rawInput);
              console.log("Providing decoded Recovery Key bytes to SDK.");
              return [keyId, decoded];
            } catch (e) {
              console.warn("Decoding recovery key failed:", e);
            }
          }

          return [keyId, new TextEncoder().encode(rawInput)];
        }
      }
    });

    try {
      await store.startup();
    } catch (e) {
      console.error("Failed to start Matrix store:", e);
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

    this.client = await this.createClientInstance(homeserver, result.access_token, result.user_id, result.device_id);

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
      this.client = await this.createClientInstance(homeserver, accessToken, userId, deviceId || undefined);
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
          const crypto = this.getCrypto();
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

  getCrypto(): any {
    if (!this.client) return null;
    // In SDK v41, getCrypto() returns this.cryptoBackend
    return this.client.getCrypto() || (this.client as any).cryptoBackend;
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
