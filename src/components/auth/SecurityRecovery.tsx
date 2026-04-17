import React, { useState, useEffect, useCallback, useRef } from 'react';
import { useMatrixClient } from '../../hooks/useMatrixClient';
import { matrixService } from '../../core/matrix';
import { ClientEvent } from 'matrix-js-sdk';
import { ShieldAlert, Key, X, Loader2 } from 'lucide-react';
import { cn } from '../../utils/cn';

const SecurityRecovery: React.FC = () => {
  const client = useMatrixClient();
  const [needsRecovery, setNeedsRecovery] = useState(false);
  const [recoveryKey, setRecoveryKey] = useState('');
  const [status, setStatus] = useState('');
  const [loading, setLoading] = useState(false);
  const [isHidden, setIsHidden] = useState(false);
  const isCheckingRef = useRef(false);

  const checkRecovery = useCallback(async () => {
    if (!client || isCheckingRef.current) return;
    
    // We can check local cache status immediately, but server status needs a client
    isCheckingRef.current = true;

    try {
      const crypto = matrixService.getCrypto();
      if (!crypto) return;

      const userId = client.getUserId();
      const deviceId = client.getDeviceId();
      if (!userId || !deviceId) return;

      // 1. Check if this device is verified
      const verificationStatus = await crypto.getDeviceVerificationStatus(userId, deviceId);
      const isVerified = !!verificationStatus?.isVerified();

      // 2. Check cross-signing status (checks if private keys are in local IndexedDB)
      const crossSigningStatus = await crypto.getCrossSigningStatus?.();
      const hasMasterKey = !!crossSigningStatus?.privateKeysCachedLocally?.masterKey;
      
      // 3. Check key backup trust
      const backupInfo = await crypto.getKeyBackupInfo();
      let isBackupTrusted = false;
      if (backupInfo) {
        const trust = await crypto.isKeyBackupTrusted(backupInfo);
        isBackupTrusted = !!trust.trusted;
      }

      // We need recovery if:
      // - Device is not verified
      // - OR we don't have our master key (can't verify others or decrypt history)
      // - OR we have a backup but don't trust it yet
      const needs = !isVerified || !hasMasterKey || (!!backupInfo && !isBackupTrusted);
      
      console.log('Security check:', { isVerified, hasMasterKey, isBackupTrusted, needs });
      setNeedsRecovery(needs);
    } catch (e) {
      console.error('Error checking recovery status:', e);
    } finally {
      isCheckingRef.current = false;
    }
  }, [client]);

  useEffect(() => {
    if (!client) return;

    const onSync = (state: string) => {
      if (state === 'PREPARED' || state === 'SYNCING') {
        checkRecovery();
      }
    };

    client.on(ClientEvent.Sync, onSync);
    checkRecovery();

    return () => {
      client.removeListener(ClientEvent.Sync, onSync);
    };
  }, [client, checkRecovery]);

  const handleRecover = async (e: React.FormEvent) => {
    e.preventDefault();
    const cleanKey = recoveryKey.trim().replace(/\s/g, '');
    if (!cleanKey) return;

    setLoading(true);
    setStatus('Verifying key...');
    
    try {
      await matrixService.withRecoveryKey(cleanKey, async () => {
        const crypto = matrixService.getCrypto();
        if (!crypto) throw new Error('Crypto not initialized');

        setStatus('Restoring cross-signing...');
        await crypto.bootstrapCrossSigning({ setupNewCrossSigning: false });

        // NEW: Explicitly verify this device now that we have cross-signing keys
        const userId = client?.getUserId();
        const deviceId = client?.getDeviceId();
        if (userId && deviceId) {
          setStatus('Verifying this session...');
          await crypto.setDeviceVerified(userId, deviceId, true);
          
          // Ensure the SDK updates its internal trust state
          // @ts-expect-error - Newer SDK feature
          if (typeof crypto.checkOwnCrossSigningTrust === 'function') {
            // @ts-expect-error - Newer SDK feature
            await crypto.checkOwnCrossSigningTrust();
          }
        }

        setStatus('Restoring message backup...');
        if (crypto.loadSessionBackupPrivateKeyFromSecretStorage) {
            await crypto.loadSessionBackupPrivateKeyFromSecretStorage();
        }
        await crypto.restoreKeyBackup();
        
        // CRITICAL: Retry decryption for the current session's timeline
        if (client) {
          setStatus('Success! Retrying decryption...');
          // @ts-expect-error - Newer SDK feature
          if (typeof client.retryDecryption === 'function') {
            // @ts-expect-error - Newer SDK feature
            client.retryDecryption();
          }
        }

        setStatus('Success! Messages will decrypt shortly.');
        setNeedsRecovery(false);
      });
    } catch (err) {
      console.error(err);
      setStatus('Failed: ' + (err instanceof Error ? err.message : 'Bad key'));
    } finally {
      setLoading(false);
    }
  };

  if (!needsRecovery || isHidden) return null;

  return (
    <div className="fixed bottom-4 right-4 z-50 w-80 animate-in slide-in-from-right-4 duration-500 font-mono">
      <div className="overflow-hidden rounded-2xl border border-accent-primary/30 bg-bg-sidebar shadow-2xl shadow-black/50">
        <div className="bg-accent-primary/10 p-4 border-b border-accent-primary/20 flex items-center justify-between">
          <div className="flex items-center space-x-2">
            <ShieldAlert className="h-5 w-5 text-accent-primary" />
            <h3 className="text-xs font-black uppercase tracking-widest text-white italic">Verify Session</h3>
          </div>
          <button onClick={() => setIsHidden(true)} className="text-text-muted hover:text-white transition">
            <X className="h-4 w-4" />
          </button>
        </div>
        
        <div className="p-5">
          <p className="mb-4 text-[11px] font-medium leading-relaxed text-text-muted uppercase tracking-tighter">
            Access your encrypted messages by entering your Security Key.
          </p>

          <form onSubmit={handleRecover} className="space-y-3">
            <div className="relative">
              <Key className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-text-muted opacity-50" />
              <input 
                type="password"
                value={recoveryKey}
                onChange={(e) => setRecoveryKey(e.target.value)}
                placeholder="Recovery Key..."
                className="w-full rounded-xl bg-bg-nav py-2.5 pl-10 pr-4 text-xs text-white outline-none border border-border-main focus:border-accent-primary transition-all"
              />
            </div>
            
            <button 
              disabled={loading || !recoveryKey.trim()}
              className="flex w-full items-center justify-center rounded-xl bg-accent-primary py-2.5 text-xs font-black uppercase tracking-widest text-bg-main transition hover:opacity-90 disabled:opacity-50"
            >
              {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : 'Confirm Identity'}
            </button>

            {status && (
              <div className={cn(
                "rounded-lg p-2 text-center text-[10px] font-bold uppercase tracking-tighter animate-in fade-in duration-300",
                status.includes('Success') ? "bg-green-500/10 text-green-400" : "bg-red-500/10 text-red-400"
              )}>
                {status}
              </div>
            )}
          </form>
          
          <button 
            onClick={() => setIsHidden(true)}
            className="mt-4 w-full text-center text-[9px] font-bold uppercase tracking-widest text-text-muted hover:text-white transition"
          >
            I'll do this later
          </button>
        </div>
      </div>
    </div>
  );
};

export default SecurityRecovery;
