import * as sdk from 'matrix-js-sdk';
import Olm from '@matrix-org/olm';
import * as RustSdkCryptoJs from '@matrix-org/matrix-sdk-crypto-wasm';
import { type CryptoApi } from 'matrix-js-sdk/lib/crypto-api';
import { decodeRecoveryKey } from 'matrix-js-sdk/lib/crypto-api/recovery-key';
import { deriveRecoveryKeyFromPassphrase } from 'matrix-js-sdk/lib/crypto-api/key-passphrase';
import { useAppStore } from '../store/useAppStore';
import { notificationService } from './notifications';

declare global {
  interface Window {
    OLM_OPTIONS?: {
      locateFile?: (path: string) => string;
    };
  }
}

class MatrixService {
  private client: sdk.MatrixClient | null = null;
  private tempRecoveryKey: string | null = null;
  private wasmInitialized = false;
  private isInitializing = false;
  private isStarting = false;
  private initPromise: Promise<sdk.MatrixClient | null> | null = null;

  private async initWasm() {
    if (this.wasmInitialized) return;
    try {
      console.log("Initializing Rust crypto WASM...");
      await RustSdkCryptoJs.initAsync();
      
      console.log("Initializing Olm...");
      window.OLM_OPTIONS = {
        locateFile: () => '/olm.wasm',
      };
      await Olm.init();
      
      this.wasmInitialized = true;
      console.log("WASM components initialized.");
    } catch (e) {
      console.error("Failed to initialize WASM components:", e);
      throw e;
    }
  }

  private async createClientInstance(homeserver: string, accessToken: string, userId: string, deviceId: string): Promise<sdk.MatrixClient> {
    const store = new sdk.IndexedDBStore({
      indexedDB: window.indexedDB,
      dbName: `reach-sync-v1-${deviceId}`,
      localStorage: window.localStorage,
    });

    const client = sdk.createClient({
      baseUrl: homeserver.replace(/\/+$/, ''), 
      accessToken,
      userId,
      deviceId,
      store,
      useAuthorizationHeader: true,
      timelineSupport: true,
      // @ts-expect-error - Property name varies across SDK versions
      threadSupport: true,
      cryptoCallbacks: {
        getSecretStorageKey: async ({ keys }) => {
          if (!this.tempRecoveryKey) return null;
          const rawInput = this.tempRecoveryKey.trim();
          
          for (const [keyId, keyInfo] of Object.entries(keys)) {
            try {
              const decoded = decodeRecoveryKey(rawInput);
              return [keyId, decoded];
            } catch {
              // Not a valid Security Key
            }

            if (keyInfo.passphrase) {
              try {
                const derivedKey = await deriveRecoveryKeyFromPassphrase(
                  rawInput,
                  keyInfo.passphrase.salt,
                  keyInfo.passphrase.iterations
                );
                return [keyId, derivedKey];
              } catch (e) {
                console.error(`Failed to derive key from passphrase:`, e);
              }
            }
          }
          return [Object.keys(keys)[0], new TextEncoder().encode(rawInput)];
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

  async login(homeserver: string, username: string, password: string): Promise<sdk.MatrixClient | null> {
    if (this.isInitializing) {
      console.warn("Matrix login already in progress...");
      return null;
    }
    
    this.isInitializing = true;
    
    try {
      await this.initWasm();
      
      const tempClient = sdk.createClient({ 
        baseUrl: homeserver.replace(/\/+$/, ''),
        // @ts-expect-error - Runtime feature support
        threadSupport: true 
      });
      const result = await tempClient.login('m.login.password', {
        user: username,
        password: password,
      });

      localStorage.setItem('matrix_access_token', result.access_token);
      localStorage.setItem('matrix_user_id', result.user_id);
      localStorage.setItem('matrix_device_id', result.device_id);
      localStorage.setItem('matrix_homeserver', homeserver);

      if (this.client) {
        this.client.stopClient();
        this.client.removeAllListeners();
      }

      this.client = await this.createClientInstance(homeserver, result.access_token, result.user_id, result.device_id);
      await this.initEncryption();
      
      await this.start();
      return this.client;
    } catch (e) {
      console.error("Login failed:", e);
      throw e;
    } finally {
      this.isInitializing = false;
    }
  }

  async loginWithStoredToken(): Promise<sdk.MatrixClient | null> {
    if (this.initPromise) return this.initPromise;
    if (this.client?.clientRunning) return this.client;

    this.initPromise = (async () => {
      this.isInitializing = true;

      try {
        const accessToken = localStorage.getItem('matrix_access_token');
        const userId = localStorage.getItem('matrix_user_id');
        const deviceId = localStorage.getItem('matrix_device_id');
        const homeserver = localStorage.getItem('matrix_homeserver');

        if (!accessToken || !userId || !deviceId || !homeserver) {
          return null;
        }

        await this.initWasm();
        
        if (!this.client) {
          this.client = await this.createClientInstance(homeserver, accessToken, userId, deviceId);
        }
        
        try {
          await this.initEncryption();
        } catch (err) {
          console.error("Encryption initialization failed.");
          throw err;
        }

        await this.start();
        return this.client;
      } catch (e) {
        console.error("Token login failed:", e);
        // Clear client on hard failure so we can retry from clean state
        this.client = null;
        return null;
      } finally {
        this.isInitializing = false;
        this.initPromise = null;
      }
    })();

    return this.initPromise;
  }

  private async initEncryption() {
    if (!this.client) return;
    
    if (this.client.getCrypto()) {
      return;
    }

    const deviceId = this.client.getDeviceId() || 'default';
    
    try {
      console.log(`Initializing Rust encryption for device ${deviceId}...`);
      await this.client.initRustCrypto({
        useIndexedDB: true,
        cryptoDatabasePrefix: `reach-v1-${deviceId}`
      });
      console.log("Rust crypto initialized successfully.");
    } catch (err: unknown) {
      const e = err as Error;
      console.error("Failed to initialize encryption:", e);
      throw e;
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
    
    if (this.client.clientRunning || this.isStarting) {
      return;
    }

    this.isStarting = true;
    
    try {
      this.client.removeAllListeners(sdk.ClientEvent.Sync);
      this.client.removeAllListeners(sdk.RoomEvent.Timeline);

      this.client.on(sdk.ClientEvent.Sync, (state, prevState, data) => {
        console.log(`Sync state: ${prevState} -> ${state}`, data?.error ? `Error: ${data.error}` : "");
      });

      const syncFilter = new sdk.Filter(this.client.getUserId()!);
      syncFilter.setDefinition({
        room: {
          timeline: { limit: 50 },
          state: { lazy_load_members: true }
        }
      });

      try {
        await this.client.startClient({ 
          initialSyncLimit: 50,
          lazyLoadMembers: true,
          pollTimeout: 20000,
          filter: syncFilter,
        });
      } catch (err) {
        console.error("SDK failed to start client sync loop:", err);
      }
      
      console.log("Matrix client started.");
      await this.syncPresenceWithStore();

      this.client.on(sdk.RoomEvent.Timeline, (event, room, toStartOfTimeline) => {
        if (toStartOfTimeline) return;
        const type = event.getType();
        if (type !== sdk.EventType.RoomMessage && type !== 'm.room.encrypted') return;
        if (this.client?.getSyncState() !== sdk.SyncState.Syncing) return;

        notificationService.notifyEvent(event, room?.name || 'Unknown Room');
      });

      notificationService.requestPermission();
    } finally {
      this.isStarting = false;
    }
  }

  async setPresence(presence: "online" | "offline" | "unavailable", statusMsg?: string) {
    if (!this.client) return;
    try {
      await this.client.setPresence({
        presence,
        status_msg: statusMsg
      });
    } catch (e) {
      console.warn("Failed to set presence:", e);
    }
  }

  async syncPresenceWithStore() {
    if (!this.client) return;
    const { userPresence, customStatus, detectedGame, customGameNames } = useAppStore.getState();
    
    let matrixPresence: "online" | "unavailable" | "offline" = "online";
    if (userPresence === 'idle') matrixPresence = "unavailable";
    if (userPresence === 'dnd') matrixPresence = "unavailable";
    if (userPresence === 'invisible') matrixPresence = "offline";

    let statusMsg = customStatus || "";
    if (detectedGame) {
      const gameName = customGameNames[detectedGame] || detectedGame;
      statusMsg = `Playing ${gameName}${statusMsg ? ` | ${statusMsg}` : ""}`;
    }

    await this.setPresence(matrixPresence, statusMsg);
  }

  stop(isPermanent = false) {
    this.isInitializing = false;
    
    if (this.client) {
      this.client.stopClient();
      
      if (isPermanent) {
        this.client.removeAllListeners();
        this.client = null;
      }
    }
  }

  async reconnect() {
    if (this.client && !this.client.clientRunning) {
      await this.start();
    }
  }

  logout() {
    this.stop(true);
    localStorage.removeItem('matrix_access_token');
    localStorage.removeItem('matrix_user_id');
    localStorage.removeItem('matrix_device_id');
    localStorage.removeItem('matrix_homeserver');
    localStorage.removeItem('reach-app-storage');
    window.location.reload();
  }

  getClient(): sdk.MatrixClient | null {
    return this.client;
  }

  async withRecoveryKey<T>(key: string, fn: () => Promise<T>): Promise<T> {
    this.tempRecoveryKey = key;
    try {
      return await fn();
    } finally {
      this.tempRecoveryKey = null;
    }
  }
}

export const matrixService = new MatrixService();
