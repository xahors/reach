import React, { useState, useEffect, useCallback, useRef } from 'react';
import { useMatrixClient } from '../../hooks/useMatrixClient';
import { matrixService } from '../../core/matrix';
import { ClientEvent } from 'matrix-js-sdk';
import { ShieldAlert, Key as KeyIcon, X, Loader2 } from 'lucide-react';
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
    
    isCheckingRef.current = true;

    try {
      const crypto = matrixService.getCrypto();
      if (!crypto) return;

      const userId = client.getUserId();
      const deviceId = client.getDeviceId();
      if (!userId || !deviceId) return;

      const verificationStatus = await crypto.getDeviceVerificationStatus(userId, deviceId);
      const isVerified = !!verificationStatus?.isVerified();

      const crossSigningStatus = await crypto.getCrossSigningStatus?.();
      const hasMasterKey = !!crossSigningStatus?.privateKeysCachedLocally?.masterKey;
      
      const backupInfo = await crypto.getKeyBackupInfo();
      let isBackupTrusted = false;
      if (backupInfo) {
        const trust = await crypto.isKeyBackupTrusted(backupInfo);
        isBackupTrusted = !!trust.trusted;
      }

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
        // First, ensure we've cleared any old, invalid trust state
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const anyCrypto = crypto as any;

        await crypto.bootstrapCrossSigning({ setupNewCrossSigning: false });
        console.log("Cross-signing bootstrapped.");

        // CRITICAL: Explicitly load cross-signing keys from secret storage
        // This is what actually brings the Master Key into the local cache (hasMasterKey: true)
        const cryptoWithLoad = crypto as { loadCrossSigningKeysFromSecretStorage?: () => Promise<void> };
        if (typeof cryptoWithLoad.loadCrossSigningKeysFromSecretStorage === 'function') {
          await cryptoWithLoad.loadCrossSigningKeysFromSecretStorage();
          console.log("Cross-signing keys loaded from secret storage.");
        }

        const userId = client?.getUserId();
        const deviceId = client?.getDeviceId();
        
        if (userId && deviceId) {
          setStatus('Verifying this session...');
          // Force mark the current device as verified once the keys are restored
          await crypto.setDeviceVerified(userId, deviceId, true);
          
          // Ensure we trust other devices signed by our restored master key
          crypto.setTrustCrossSignedDevices(true);
          
          if (typeof anyCrypto.checkOwnCrossSigningTrust === 'function') {
            await anyCrypto.checkOwnCrossSigningTrust();
            console.log("Cross-signing trust checked.");
          }
        }

        setStatus('Restoring message backup...');
        // This is CRITICAL for decryption to work
        if (typeof crypto.loadSessionBackupPrivateKeyFromSecretStorage === 'function') {
            await crypto.loadSessionBackupPrivateKeyFromSecretStorage();
            console.log("Backup private key loaded from secret storage.");
        }
        
        if (typeof anyCrypto.checkKeyBackupAndEnable === 'function') {
          await anyCrypto.checkKeyBackupAndEnable();
          console.log("Key backup enabled.");
        }

        const backupInfo = await crypto.getKeyBackupInfo();
        if (backupInfo) {
          console.log(`Restoring backup version: ${backupInfo.version}`);
          try {
            // In modern SDK, no-args restoreKeyBackup uses the loaded private key
            const restoreResult = await crypto.restoreKeyBackup();
            console.log(`Restored ${restoreResult.imported} keys from backup.`);
          } catch (err: unknown) {
            const backupErr = err as { httpStatus?: number; data?: { errcode?: string } };
            if (backupErr.httpStatus === 404 || backupErr.data?.errcode === 'M_NOT_FOUND') {
              console.info("No keys found in current backup version.");
            } else {
              console.warn("Failed to restore key backup:", backupErr);
            }
          }
        }
        
        if (client) {
          setStatus('Success! Retrying decryption...');
          
          // CRITICAL: Delay slightly to let Rust SDK settle before retrying decryption
          await new Promise(resolve => setTimeout(resolve, 1000));
          
          // Use our improved service method
          await matrixService.retryDecryption();
        }

        setStatus('Success! Messages will decrypt shortly.');
        setTimeout(() => setNeedsRecovery(false), 2000);
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
              <KeyIcon className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-text-muted opacity-50" />
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
