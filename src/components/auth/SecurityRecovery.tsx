import React, { useState, useEffect } from 'react';
import { useMatrixClient } from '../../hooks/useMatrixClient';
import { matrixService } from '../../core/matrix';
import { Key } from 'lucide-react';

const SecurityRecovery: React.FC = () => {
  const client = useMatrixClient();
  const [needsRecovery, setNeedsRecovery] = useState(false);
  const [recoveryKey, setRecoveryKey] = useState('');
  const [status, setStatus] = useState('');
  const [loading, setLoading] = useState(false);
  const [isHidden, setIsHidden] = useState(false);

  useEffect(() => {
    const checkRecovery = async () => {
      if (!client) return;
      
      const syncState = client.getSyncState();
      if (syncState !== 'PREPARED' && syncState !== 'SYNCING') return;

      try {
        const isCryptoEnabled = matrixService.isCryptoEnabled();
        if (!isCryptoEnabled) return;

        const crypto = matrixService.getCrypto();
        const getCrossSigningStatus = crypto?.getCrossSigningStatus?.bind(crypto);
        
        const status = getCrossSigningStatus ? await getCrossSigningStatus() : null;
        const needsBoot = !status?.publicKeysOnDevice || !status?.privateKeysCachedLocally?.masterKey;

        if (needsBoot) setNeedsRecovery(true);
        else setNeedsRecovery(false);
      } catch (e) {
        console.error("Error checking recovery status:", e);
      }
    };

    const interval = setInterval(checkRecovery, 10000);
    checkRecovery();
    return () => clearInterval(interval);
  }, [client]);

  const handleRecover = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!client || !recoveryKey.trim()) return;

    setLoading(true);
    setStatus('Attempting recovery...');

    try {
      await matrixService.withRecoveryKey(recoveryKey, async () => {
        // High-level method to handle everything: secrets + key backup
        setStatus('Restoring secrets and backup...');
        const crypto = matrixService.getCrypto();
        if (crypto?.loadSessionBackupPrivateKeyFromSecretStorage) {
            await crypto.loadSessionBackupPrivateKeyFromSecretStorage();
            await crypto.restoreKeyBackup();
        }
        
        // Explicitly trigger a room decryption retry
        const rooms = client.getRooms();
        for (const room of rooms) {
          const events = room.getLiveTimeline().getEvents();
          for (const event of events) {
            if (event.isEncrypted() && event.isDecryptionFailure()) {
               await client.decryptEventIfNeeded(event);
            }
          }
        }
      });

      setStatus('Recovery successful!');
      setTimeout(() => {
        setIsHidden(true);
        setNeedsRecovery(false);
      }, 2000);
    } catch (error) {
      console.error('Recovery failed:', error);
      const message = error instanceof Error ? error.message : 'Invalid key';
      setStatus(`Failed: ${message}`);
    } finally {
      setLoading(false);
    }
  };

  if (!needsRecovery || isHidden) return null;

  return (
    <div className="absolute bottom-4 right-4 w-80 rounded-lg bg-discord-sidebar p-4 shadow-lg border border-discord-hover z-50">
      <div className="flex items-center mb-3">
        <Key className="h-5 w-5 text-discord-accent mr-2" />
        <h3 className="font-bold text-white">Verify Session</h3>
      </div>
      <p className="text-xs text-discord-text-muted mb-4">
        Enter your Security Phrase or Recovery Key to decrypt past messages.
      </p>
      <form onSubmit={handleRecover} className="space-y-3">
        <input
          type="password"
          value={recoveryKey}
          onChange={(e) => setRecoveryKey(e.target.value)}
          placeholder="Security Phrase or Key"
          className="w-full rounded bg-discord-nav p-2 text-sm text-discord-text outline-none focus:ring-1 focus:ring-discord-accent"
        />
        {status && <p className="text-xs text-discord-accent">{status}</p>}
        <div className="flex space-x-2">
          <button
            type="submit"
            disabled={loading || !recoveryKey}
            className="flex-1 rounded bg-discord-accent py-1.5 text-sm font-bold text-white transition hover:bg-opacity-90 disabled:opacity-50"
          >
            {loading ? 'Decrypting...' : 'Decrypt'}
          </button>
          <button
            type="button"
            onClick={() => setIsHidden(true)}
            className="rounded bg-discord-hover px-3 py-1.5 text-sm font-bold text-white transition hover:bg-[#4E5058]"
          >
            Skip
          </button>
        </div>
      </form>
    </div>
  );
};

export default SecurityRecovery;
