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

class MatrixService {
  private client: sdk.MatrixClient | null = null;
  private tempRecoveryKey: string | null = null;
  private wasmInitialized = false;
  private isInitializing = false;

  private async initWasm() {
    if (this.wasmInitialized) return;
    try {
      console.log("Initializing Rust crypto WASM...");
      await RustSdkCryptoJs.initAsync('/matrix_sdk_crypto_wasm_bg.wasm');
      this.wasmInitialized = true;
      console.log("Rust crypto WASM initialized.");
    } catch (e) {
      console.error("Failed to initialize Rust crypto WASM:", e);
      throw e;
    }
  }

  private async createClientInstance(homeserver: string, accessToken?: string, userId?: string, deviceId?: string) {
    console.log(`Creating client instance for ${homeserver}...`);
    const store = new sdk.IndexedDBStore({
      indexedDB: window.indexedDB,
      dbName: 'reach-matrix-store',
      localStorage: window.localStorage,
    });

    const client = sdk.createClient({
      baseUrl: homeserver.replace(/\/+$/, ''), // Ensure no trailing slash
      accessToken,
      userId,
      deviceId,
      store,
      cryptoStore: new sdk.IndexedDBCryptoStore(
        window.indexedDB,
        `matrix-sdk-crypto-${deviceId}`
      ),
      useAuthorizationHeader: true,
      timelineSupport: true,
      cryptoCallbacks: {
        getSecretStorageKey: async ({ keys }) => {
          if (!this.tempRecoveryKey) return null;
          const rawInput = this.tempRecoveryKey.trim();
          const keyId = Object.keys(keys)[0];
          const keyInfo = keys[keyId];
          
          console.log(`SDK requested secret key for ID: ${keyId}`);

          // 1. Always try decodeRecoveryKey first — it validates the checksum,
          //    so if it succeeds we know this is a valid Security Key regardless
          //    of what character it starts with. The old startsWith('E') heuristic
          //    was too loose and caused bad-MAC errors when a passphrase happened
          //    to start with 'E'.
          try {
            const { decodeRecoveryKey } = await import("matrix-js-sdk/lib/crypto-api/recovery-key.js");
            const decoded = decodeRecoveryKey(rawInput);
            console.log("Providing decoded Recovery Key bytes to SDK.");
            return [keyId, decoded];
          } catch {
            // Not a valid Security Key — fall through to passphrase derivation
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

          // 3. Fallback: raw bytes (rarely useful, but kept as last resort)
          console.log("Providing raw bytes to SDK (fallback).");
          return [keyId, new TextEncoder().encode(rawInput)];
        }
      }
    });

    try {
      console.log("Starting IndexedDB store...");
      await store.startup();
      console.log("IndexedDB store started successfully.");
    } catch (e) {
      console.error("Failed to start Matrix store. This may cause sync issues.", e);
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

  async login(homeserver: string, username: string, password: string): Promise<sdk.MatrixClient | null> {
    if (this.isInitializing) throw new Error("Already initializing");
    this.isInitializing = true;
    
    try {
      await this.initWasm();
      
      if (!this.isInitializing) return null;

      const tempClient = sdk.createClient({ baseUrl: homeserver.replace(/\/+$/, '') });
      const result = await tempClient.login('m.login.password', {
        user: username,
        password: password,
      });

      if (!this.isInitializing) return null;

      const client = await this.createClientInstance(homeserver, result.access_token, result.user_id, result.device_id);
      
      if (!this.isInitializing) {
         client.stopClient();
         return null;
      }

      this.client = client;

      localStorage.setItem('matrix_access_token', result.access_token);
      localStorage.setItem('matrix_user_id', result.user_id);
      localStorage.setItem('matrix_device_id', result.device_id!);
      localStorage.setItem('matrix_homeserver', homeserver);

      await this.initEncryption();
      
      if (!this.isInitializing) {
         this.stop();
         return null;
      }

      await this.start();
      return this.client;
    } finally {
      this.isInitializing = false;
    }
  }

  async loginWithStoredToken(): Promise<sdk.MatrixClient | null> {
    if (this.isInitializing) {
      console.warn("Matrix initialization already in progress, skipping...");
      return this.client;
    }
    
    const accessToken = localStorage.getItem('matrix_access_token');
    const userId = localStorage.getItem('matrix_user_id');
    const deviceId = localStorage.getItem('matrix_device_id');
    const homeserver = localStorage.getItem('matrix_homeserver');

    if (accessToken && userId && homeserver) {
      this.isInitializing = true;
      try {
        console.log("Attempting to restore session...");
        await this.initWasm();
        
        if (!this.isInitializing) {
           console.log("Initialization cancelled during WASM init.");
           return null;
        }

        const client = await this.createClientInstance(homeserver, accessToken, userId, deviceId || undefined);
        
        if (!this.isInitializing) {
           console.log("Initialization cancelled during client creation.");
           client.stopClient();
           return null;
        }

        this.client = client;
        await this.initEncryption();
        
        if (!this.isInitializing) {
           console.log("Initialization cancelled during encryption init.");
           this.stop();
           return null;
        }

        await this.start();
        return this.client;
      } catch (e) {
        console.error("Failed to restore session:", e);
        return null;
      } finally {
        this.isInitializing = false;
      }
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

      console.log("Checking client capabilities:", {
        hasInitRustCrypto: typeof this.client.initRustCrypto === 'function',
        hasGetCrypto: typeof this.client.getCrypto === 'function'
      });

      if (typeof this.client.initRustCrypto === 'function') {
        console.log("Calling client.initRustCrypto()...");
        try {
          await this.client.initRustCrypto({
            useIndexedDB: true,
            cryptoDatabasePrefix: `matrix-sdk-crypto-${this.client.getDeviceId()}`
          });
          console.log("Rust crypto initialized successfully.");
        } catch (err) {
          console.error("Rust crypto initialization failed:", err);
        }
      } else {
        console.error("CRITICAL: this.client.initRustCrypto is not a function! Encryption will not work.");
      }
      
      console.log("Encryption initialization finished.");
    } catch (e) {
      console.error('Failed to initialize crypto:', e);
    }
  }

  getCrypto(): CryptoApi | null {
    return this.client?.getCrypto() || null;
  }


  isCryptoEnabled(): boolean {
    return !!this.getCrypto();
  }

  async start() {
    if (!this.client) return;
    console.log("Starting Matrix client sync loop...");
    
    // Track sync state transitions for debugging
    this.client.on(sdk.ClientEvent.Sync, (state, prevState, data) => {
      console.log(`Sync state: ${prevState} -> ${state}`, data?.error ? `Error: ${data.error}` : "");
      
      if (state === 'ERROR') {
        console.warn("Matrix sync error. SDK will retry.");
      }
    });

    await this.client.startClient({ 
      initialSyncLimit: 50,
      lazyLoadMembers: true,
      // pollTimeout: 20000 ensures sync loop completes before most proxy timeouts (usually 30s)
      pollTimeout: 20000,
    });
    console.log("Matrix client started.");
  }

  stop(isPermanent = false) {
    if (isPermanent) {
      this.isInitializing = false;
    }
    
    if (this.client) {
      console.log(`Stopping Matrix client (permanent: ${isPermanent})...`);
      this.client.stopClient();
      
      if (isPermanent) {
        this.client.removeAllListeners();
        this.client = null;
      }
    }
  }

  async reconnect() {
    if (this.client && !this.client.clientRunning) {
      console.log("Re-starting Matrix client sync loop...");
      await this.client.startClient({ 
        initialSyncLimit: 50,
        lazyLoadMembers: true,
        pollTimeout: 20000,
      });
    }
  }

  logout() {
    this.stop(true);
    
    // Clear tokens and stored state
    localStorage.removeItem('matrix_access_token');
    localStorage.removeItem('matrix_user_id');
    localStorage.removeItem('matrix_device_id');
    localStorage.removeItem('matrix_homeserver');
    
    // Clear persisted Zustand store
    localStorage.removeItem('reach-app-storage');
    
    window.location.reload();
  }

  getClient(): sdk.MatrixClient | null {
    return this.client;
  }
}

export const matrixService = new MatrixService();
