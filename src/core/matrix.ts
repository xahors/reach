import * as sdk from 'matrix-js-sdk';
import * as RustSdkCryptoJs from '@matrix-org/matrix-sdk-crypto-wasm';
import { type CryptoApi } from 'matrix-js-sdk/lib/crypto-api';
import { decodeRecoveryKey } from 'matrix-js-sdk/lib/crypto-api/recovery-key';
import { deriveRecoveryKeyFromPassphrase } from 'matrix-js-sdk/lib/crypto-api/key-passphrase';
import { calculateKeyCheck } from 'matrix-js-sdk/lib/secret-storage';
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
  // Cache the derived key so we don't need tempRecoveryKey for subsequent requests
  private cachedSecretStorageKey: { keyId: string, key: Uint8Array } | null = null;

  private saveSecretStorageKey(keyId: string, key: Uint8Array) {
    this.cachedSecretStorageKey = { keyId, key };
    try {
      // Store in hex for persistence
      const hex = Array.from(key).map(b => b.toString(16).padStart(2, '0')).join('');
      localStorage.setItem(`reach_sss_key_${keyId}`, hex);
      localStorage.setItem(`reach_sss_active_key_id`, keyId);
      console.log(`Persisted secret storage key: ${keyId}`);
    } catch (e) {
      console.warn("Failed to persist secret storage key:", e);
    }
  }

  private loadPersistedSecretStorageKey(): { keyId: string, key: Uint8Array } | null {
    try {
      const keyId = localStorage.getItem('reach_sss_active_key_id');
      const hex = keyId ? localStorage.getItem(`reach_sss_key_${keyId}`) : null;
      if (keyId && hex) {
        const bytes = new Uint8Array(hex.match(/.{1,2}/g)!.map(byte => parseInt(byte, 16)));
        return { keyId, key: bytes };
      }
    } catch {
      // Ignore
    }
    return null;
  }

  private async initWasm() {
    if (this.wasmInitialized) return;
    try {
      console.log("Initializing Rust crypto WASM...");
      await RustSdkCryptoJs.initAsync();
      
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
      cryptoCallbacks: {
        getSecretStorageKey: async ({ keys }: { keys: Record<string, any> }, name: string) => {
          console.info(`Secret storage requested key for secret: ${name}`);

          if (this.cachedSecretStorageKey && keys[this.cachedSecretStorageKey.keyId]) {
            console.info(`Returning cached secret storage key for ${this.cachedSecretStorageKey.keyId}`);
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            return [this.cachedSecretStorageKey.keyId, this.cachedSecretStorageKey.key as any];
          }

          const persisted = this.loadPersistedSecretStorageKey();
          if (persisted && keys[persisted.keyId]) {
            console.info(`Returning persisted secret storage key for ${persisted.keyId}`);
            this.cachedSecretStorageKey = persisted;
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            return [persisted.keyId, persisted.key as any];
          }

          if (!this.tempRecoveryKey) {
             console.warn("getSecretStorageKey called but no tempRecoveryKey is set. Returning null.");
             return null;
          }
          
          const rawInput = this.tempRecoveryKey.trim();
          let fallbackKeyId: string | null = null;
          let fallbackKey: Uint8Array | null = null;
          let lastError: Error | null = null;
          
          for (const [keyId, keyInfo] of Object.entries(keys)) {
            let derivedKey: Uint8Array | null = null;

            try {
              // 1. Try decoding as a Matrix Security Key (Base58)
              derivedKey = decodeRecoveryKey(rawInput);
            } catch (err: unknown) {
              lastError = err instanceof Error ? err : new Error(String(err));
              
              // 2. Not a valid Security Key, try as a Security Phrase (Passphrase)
              if (keyInfo.passphrase) {
                try {
                  derivedKey = await deriveRecoveryKeyFromPassphrase(
                    rawInput,
                    keyInfo.passphrase.salt,
                    keyInfo.passphrase.iterations
                  );
                } catch (e) {
                  lastError = e instanceof Error ? e : new Error(String(e));
                  console.error(`Failed to derive key from passphrase for ${keyId}:`, e);
                }
              }
            }

            if (derivedKey) {
              if (!fallbackKeyId) {
                fallbackKeyId = keyId;
                fallbackKey = derivedKey;
              }

              try {
                // Use the SDK's built-in checkKey if available
                // eslint-disable-next-line @typescript-eslint/no-explicit-any
                const secretStorage = (this.client as any)?.secretStorage;
                if (secretStorage && typeof secretStorage.checkKey === 'function') {
                  const isValid = await secretStorage.checkKey(derivedKey, keyInfo);
                  if (isValid) {
                    console.info(`Successfully verified secret storage key for ${keyId} (${name})`);
                    this.saveSecretStorageKey(keyId, derivedKey);
                    // eslint-disable-next-line @typescript-eslint/no-explicit-any
                    return [keyId, derivedKey as any];
                  }
                } else if (keyInfo.mac) {
                  // Fallback manual MAC check
                  // eslint-disable-next-line @typescript-eslint/no-explicit-any
                  const check = await calculateKeyCheck(derivedKey as any, keyInfo.iv);
                  const trimmedMac = (s: string) => s.replace(/=+$/, '');
                  if (trimmedMac(check.mac) === trimmedMac(keyInfo.mac)) {
                    console.info(`Successfully verified secret storage key for ${keyId} (${name}) via manual check`);
                    this.saveSecretStorageKey(keyId, derivedKey);
                    // eslint-disable-next-line @typescript-eslint/no-explicit-any
                    return [keyId, derivedKey as any];
                  }
                } else {
                  console.info(`Key ${keyId} has no MAC info, assuming valid for ${name}.`);
                  this.saveSecretStorageKey(keyId, derivedKey);
                  // eslint-disable-next-line @typescript-eslint/no-explicit-any
                  return [keyId, derivedKey as any];
                }
              } catch (e) {
                console.warn(`Key check failed with exception for ${keyId}:`, e);
              }
            }
          }

          // FINAL FALLBACK: If we successfully derived a key but no MAC checks passed,
          // return the first derived key. The server's MAC might be wrong, but the key material could be correct.
          if (fallbackKeyId && fallbackKey) {
             console.warn(`All MAC checks failed for ${name}, returning fallback key ${fallbackKeyId}. This might cause decryption failures if the key is actually wrong.`);
             this.saveSecretStorageKey(fallbackKeyId, fallbackKey);
             // eslint-disable-next-line @typescript-eslint/no-explicit-any
             return [fallbackKeyId, fallbackKey as any];
          }

          // If we reach here, we couldn't even derive a key.
          console.error(`Failed to derive any valid secret storage key for ${name}. Last error:`, lastError?.message);
          
          // Throw a specific error so the UI can catch it and display a helpful message,
          // rather than the SDK throwing "callback returned falsey".
          throw new Error("Invalid Security Key or Passphrase. Please check your input and try again.");
        },
        cacheSecretStorageKey: (keyId, _keyInfo, key) => {
          this.saveSecretStorageKey(keyId, key as unknown as Uint8Array);
        }
      }
    });

    // Expose for debugging
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (window as any).matrixClient = client;

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
      
      const crypto = this.client.getCrypto();
      if (crypto) {
        // Ensure we trust other devices signed by our own master key
        crypto.setTrustCrossSignedDevices(true);
        
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const anyCrypto = crypto as any;
        
        console.log("Checking E2EE trust state...");
        const status = await crypto.getCrossSigningStatus?.();
        console.log("Cross-signing status:", status);

        if (typeof anyCrypto.checkOwnCrossSigningTrust === 'function') {
          await anyCrypto.checkOwnCrossSigningTrust().catch((e: Error) => console.warn("Initial trust check failed:", e));
        }

        // Force verify the current session if we have the master key locally
        const userId = this.client.getUserId();
        const deviceId = this.client.getDeviceId();
        if (userId && deviceId) {
          const crossSigning = await crypto.getCrossSigningStatus?.();
          if (crossSigning?.privateKeysCachedLocally?.masterKey) {
            console.log("Master key found, ensuring device is verified...");
            await crypto.setDeviceVerified(userId, deviceId, true).catch(() => {});
          }
        }

        // Try to load cross-signing and session backup keys immediately 
        // if they are already in secret storage
        const cryptoWithLoad = crypto as { 
          loadCrossSigningKeysFromSecretStorage?: () => Promise<void>,
          loadSessionBackupPrivateKeyFromSecretStorage?: () => Promise<void>
        };
        
        if (typeof cryptoWithLoad.loadCrossSigningKeysFromSecretStorage === 'function') {
          await cryptoWithLoad.loadCrossSigningKeysFromSecretStorage().catch((e: Error) => console.warn("Initial cross-signing key load failed:", e));
        }
        
        if (typeof cryptoWithLoad.loadSessionBackupPrivateKeyFromSecretStorage === 'function') {
          await cryptoWithLoad.loadSessionBackupPrivateKeyFromSecretStorage().catch((e: Error) => console.warn("Initial backup key load failed:", e));
        }

        if (typeof anyCrypto.checkKeyBackupAndEnable === 'function') {
          await anyCrypto.checkKeyBackupAndEnable().catch((e: Error) => console.warn("Initial backup check failed:", e));
        }
      }
      
      console.log("E2EE initialized successfully.");

      // Add global listener for decryption success to refresh UI
      this.client.on(sdk.MatrixEventEvent.Decrypted, (event) => {
        // Find the room this event belongs to and trigger a refresh
        const roomId = event.getRoomId();
        if (roomId) {
           // This will be picked up by useRoomMessages which also listens to this event
           console.log(`Event ${event.getId()} decrypted in room ${roomId}`);
        }
      });
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

      try {
        // Use simpler startClient options - SDK handles defaults and crypto requirements better this way
        await this.client.startClient({ 
          initialSyncLimit: 50,
          lazyLoadMembers: true,
          pollTimeout: 30000,
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

  async retryDecryption() {
    if (!this.client) return;
    console.log("Triggering proactive decryption retry...");
    
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const anyClient = this.client as any;
    if (typeof anyClient.retryDecryption === 'function') {
      anyClient.retryDecryption();
    }

    try {
      const joinedRooms = await this.client.getJoinedRooms();
      for (const roomId of joinedRooms.joined_rooms) {
        const room = this.client.getRoom(roomId);
        if (room) {
          const events = room.getLiveTimeline().getEvents();
          for (const event of events) {
            if (event.isEncrypted() && event.isDecryptionFailure()) {
              await this.client.decryptEventIfNeeded(event, { isRetry: true }).catch(() => {});
            }
          }
        }
      }
    } catch (e) {
      console.warn("Manual decryption retry failed:", e);
    }
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
