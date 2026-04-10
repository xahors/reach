import React, { useState, useEffect, useCallback } from 'react';
import { useMatrixClient } from '../../hooks/useMatrixClient';
import { matrixService } from '../../core/matrix';
import { ClientEvent } from 'matrix-js-sdk';
import { Key, ShieldAlert } from 'lucide-react';

const SecurityRecovery: React.FC = () => {
  const client = useMatrixClient();
  const [needsRecovery, setNeedsRecovery] = useState(false);
  const [recoveryKey, setRecoveryKey] = useState('');
  const [status, setStatus] = useState('');
  const [loading, setLoading] = useState(false);
  const [isHidden, setIsHidden] = useState(false);

  const checkRecovery = useCallback(async () => {
    if (!client) return;
    const syncState = client.getSyncState();
    if (syncState !== 'PREPARED' && syncState !== 'SYNCING') return;

    try {
      const crypto = matrixService.getCrypto();
      if (!crypto) return;

      // Primary check: is there a key backup on the server that we haven't trusted?
      // This is the direct cause of "message sent before this device logged in" errors.
      const backupInfo = await crypto.getKeyBackupInfo();
      if (backupInfo) {
        const trust = await crypto.isKeyBackupTrusted(backupInfo);
        if (!trust.trusted) {
          setNeedsRecovery(true);
          return;
        }
      }

      // Secondary check: cross-signing private keys not cached locally
      const crossSigningStatus = await crypto.getCrossSigningStatus?.();
      const missingKeys = crossSigningStatus &&
        (!crossSigningStatus.publicKeysOnDevice ||
          !crossSigningStatus.privateKeysCachedLocally?.masterKey);
      setNeedsRecovery(!!missingKeys);
    } catch (e) {
      console.error('Error checking recovery status:', e);
    }
  }, [client]);

  useEffect(() => {
    if (!client) return;

    checkRecovery();

    // Re-check whenever sync state changes (e.g. after initial PREPARED)
    const onSync = () => checkRecovery();
    client.on(ClientEvent.Sync, onSync);
    return () => { client.removeListener(ClientEvent.Sync, onSync); };
  }, [client, checkRecovery]);

  const retryDecryption = async () => {
    if (!client) return;
    const rooms = client.getRooms();
    for (const room of rooms) {
      // Retry across all timeline chunks, not just the live timeline
      const timelines = room.getUnfilteredTimelineSet().getTimelines();
      for (const timeline of timelines) {
        for (const event of timeline.getEvents()) {
          if (event.isEncrypted() && event.isDecryptionFailure()) {
            try {
              await client.decryptEventIfNeeded(event);
            } catch {
              // Some keys may still be unavailable — that's fine
            }
          }
        }
      }
    }
  };

  const handleRecover = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!client || !recoveryKey.trim()) return;

    setLoading(true);
    setStatus('Connecting to key backup...');

    try {
      const crypto = matrixService.getCrypto();
      if (!crypto) throw new Error('Crypto not initialized');

      let restored = false;

      // Path 1: load backup key from secret storage using the provided recovery key
      await matrixService.withRecoveryKey(recoveryKey, async () => {
        try {
          setStatus('Loading backup key from secret storage...');
          await crypto.loadSessionBackupPrivateKeyFromSecretStorage();
          setStatus('Restoring session keys from backup...');
          const result = await crypto.restoreKeyBackup();
          console.log(`Key backup restore: imported ${(result as { imported?: number }).imported ?? '?'} keys`);
          restored = true;
        } catch (err) {
          console.warn('Secret storage path failed, trying passphrase path:', err);
        }
      });

      // Path 2: call restoreKeyBackup() directly — the Rust implementation will
      // invoke getSecretStorageKey internally if the decryption key isn't cached.
      // Our fixed getSecretStorageKey (try decodeRecoveryKey before passphrase
      // derivation, without the fragile startsWith('E') heuristic) should now
      // return the correct bytes for Security Key setups.
      if (!restored) {
        setStatus('Retrying via backup restore...');
        try {
          await matrixService.withRecoveryKey(recoveryKey, async () => {
            const result = await crypto.restoreKeyBackup();
            console.log(`Backup restore: imported ${result.imported} keys`);
          });
          restored = true;
        } catch (err) {
          console.warn('Direct backup restore failed:', err);
        }
      }

      // Path 3: passphrase-based backup (only works if the backup was set up
      // with a passphrase — will fail with "Salt and/or iterations not found"
      // for Security Key setups, which is expected and safe to ignore).
      if (!restored) {
        setStatus('Trying passphrase restore...');
        try {
          const result = await crypto.restoreKeyBackupWithPassphrase(recoveryKey.trim());
          console.log(`Passphrase restore: imported ${result.imported} keys`);
          restored = true;
        } catch (err) {
          const msg = err instanceof Error ? err.message : '';
          if (!msg.includes('Salt and/or iterations')) {
            console.warn('Passphrase restore failed:', err);
          }
        }
      }

      if (!restored) {
        throw new Error('Could not restore key backup. Check your Security Key or Phrase and try again.');
      }

      setStatus('Decrypting messages...');
      await retryDecryption();

      setStatus('Recovery successful!');
      setTimeout(() => {
        setIsHidden(true);
        setNeedsRecovery(false);
      }, 2000);
    } catch (error) {
      console.error('Recovery failed:', error);
      setStatus(`Failed: ${error instanceof Error ? error.message : 'Invalid key or phrase'}`);
    } finally {
      setLoading(false);
    }
  };

  if (!needsRecovery || isHidden) return null;

  return (
    <div className="absolute bottom-4 right-4 w-80 rounded-lg bg-discord-sidebar p-4 shadow-xl border border-yellow-500/30 z-50 animate-in slide-in-from-bottom-4 duration-300">
      <div className="flex items-center mb-3 space-x-2">
        <ShieldAlert className="h-5 w-5 text-yellow-400 shrink-0" />
        <h3 className="font-bold text-white">Verify Session</h3>
      </div>
      <p className="text-xs text-discord-text-muted mb-4 leading-relaxed">
        Past messages are encrypted and can't be read until you verify this session.
        Enter your Security Key or Phrase to restore access.
      </p>
      <form onSubmit={handleRecover} className="space-y-3">
        <input
          type="password"
          value={recoveryKey}
          onChange={(e) => setRecoveryKey(e.target.value)}
          placeholder="Security Key or Phrase"
          disabled={loading}
          className="w-full rounded bg-discord-nav p-2 text-sm text-discord-text outline-none focus:ring-1 focus:ring-discord-accent disabled:opacity-50"
        />
        {status && (
          <p className={`text-xs ${status.startsWith('Failed') ? 'text-red-400' : 'text-discord-accent'}`}>
            {status}
          </p>
        )}
        <div className="flex space-x-2">
          <button
            type="submit"
            disabled={loading || !recoveryKey.trim()}
            className="flex flex-1 items-center justify-center space-x-2 rounded bg-discord-accent py-1.5 text-sm font-bold text-white transition hover:bg-opacity-90 disabled:opacity-50"
          >
            <Key className="h-3.5 w-3.5" />
            <span>{loading ? 'Restoring...' : 'Restore'}</span>
          </button>
          <button
            type="button"
            onClick={() => setIsHidden(true)}
            disabled={loading}
            className="rounded bg-discord-hover px-3 py-1.5 text-sm font-bold text-white transition hover:bg-[#4E5058] disabled:opacity-50"
          >
            Later
          </button>
        </div>
      </form>
    </div>
  );
};

export default SecurityRecovery;
