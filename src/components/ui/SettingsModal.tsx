import React, { useState } from 'react';
import { useAppStore } from '../../store/useAppStore';
import { useMatrixClient } from '../../hooks/useMatrixClient';
import { matrixService } from '../../core/matrix';
import { X, Shield, Lock, LogOut, MessageSquare } from 'lucide-react';

const SettingsModal: React.FC = () => {
  const { 
    isSettingsOpen, 
    setSettingsOpen, 
    setLoggedIn, 
    messageLoadPolicy, 
    setMessageLoadPolicy 
  } = useAppStore();
  const client = useMatrixClient();
  const [recoveryKey, setRecoveryKey] = useState('');
  const [status, setStatus] = useState('');
  const [loading, setLoading] = useState(false);
  const [activeTab, setActiveTab] = useState<'security' | 'channels'>('security');

  if (!isSettingsOpen) return null;

  const handleRecover = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!client || !recoveryKey.trim()) return;

    setLoading(true);
    setStatus('Attempting to recover keys...');

    try {
      await matrixService.withRecoveryKey(recoveryKey, async () => {
        const crypto = matrixService.getCrypto();
        const bootstrap = crypto?.bootstrapCrossSigning?.bind(crypto);

        if (typeof bootstrap !== 'function') {
          throw new Error("Cross-signing bootstrap not supported or crypto not initialized.");
        }

        await bootstrap({
          setupNewCrossSigning: false,
        });

        const getKeyBackupInfo = crypto?.getKeyBackupInfo?.bind(crypto);
        
        const backupInfo = getKeyBackupInfo ? await getKeyBackupInfo() : null;
        
        if (backupInfo) {
          setStatus('Restoring message backup...');
          const restore = crypto?.restoreKeyBackup?.bind(crypto);
          
          if (restore) {
             if (crypto?.loadSessionBackupPrivateKeyFromSecretStorage) {
                 await crypto.loadSessionBackupPrivateKeyFromSecretStorage();
             }
             await restore();
             
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
          }
        }
      });

      setStatus('Recovery successful!');
      setRecoveryKey('');
    } catch (error) {
      console.error('Recovery failed:', error);
      const message = error instanceof Error ? error.message : 'Invalid key';
      setStatus(`Failed: ${message}`);
    } finally {
      setLoading(false);
    }
  };

  const handleLogout = () => {
    matrixService.logout();
    setLoggedIn(false, null);
    setSettingsOpen(false);
  };

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/50 backdrop-blur-sm">
      <div className="flex h-[80vh] w-full max-w-4xl overflow-hidden rounded-lg bg-discord-dark shadow-2xl">
        {/* Sidebar */}
        <div className="w-60 bg-discord-nav p-6 pt-12 flex flex-col h-full border-r border-discord-hover">
          <h2 className="mb-4 text-[10px] font-bold uppercase text-discord-text-muted px-3 tracking-wider">User Settings</h2>
          <nav className="space-y-1 flex-1">
            <button 
              onClick={() => setActiveTab('security')}
              className={`flex w-full items-center rounded px-3 py-2 transition-all ${activeTab === 'security' ? 'bg-discord-hover text-white shadow-sm' : 'text-discord-text-muted hover:bg-discord-hover/30 hover:text-discord-text'}`}
            >
              <Shield className={`mr-2 h-4 w-4 ${activeTab === 'security' ? 'text-discord-accent' : ''}`} /> 
              <span className="text-sm font-medium">Security & Privacy</span>
            </button>
            <button 
              onClick={() => setActiveTab('channels')}
              className={`flex w-full items-center rounded px-3 py-2 transition-all ${activeTab === 'channels' ? 'bg-discord-hover text-white shadow-sm' : 'text-discord-text-muted hover:bg-discord-hover/30 hover:text-discord-text'}`}
            >
              <MessageSquare className={`mr-2 h-4 w-4 ${activeTab === 'channels' ? 'text-discord-accent' : ''}`} /> 
              <span className="text-sm font-medium">Channel Settings</span>
            </button>
            <div className="my-4 border-t border-discord-hover mx-3 opacity-50" />
            <button 
              onClick={handleLogout}
              className="flex w-full items-center rounded px-3 py-2 text-red-400 transition hover:bg-red-500/10"
            >
              <LogOut className="mr-2 h-4 w-4" /> 
              <span className="text-sm font-medium">Log Out</span>
            </button>
          </nav>
        </div>

        {/* Content */}
        <div className="relative flex-1 bg-discord-dark p-10 overflow-y-auto">
          <button 
            onClick={() => setSettingsOpen(false)}
            className="absolute right-6 top-6 rounded-full border-2 border-discord-text-muted p-1 text-discord-text-muted hover:border-white hover:text-white transition"
          >
            <X className="h-5 w-5" />
          </button>

          {activeTab === 'security' ? (
            <div className="animate-in fade-in slide-in-from-bottom-2 duration-300">
              <h1 className="mb-8 text-xl font-bold text-white uppercase tracking-tight">Security & Privacy</h1>

              <section className="mb-10">
                <div className="mb-4 flex items-center">
                  <Lock className="mr-2 h-5 w-5 text-discord-accent" />
                  <h2 className="text-base font-bold text-white">Encryption Recovery</h2>
                </div>
                <p className="mb-6 text-sm text-discord-text-muted leading-relaxed">
                  If you can't read past messages, enter your Security Phrase or Recovery Key to restore encryption keys for this session.
                </p>

                <form onSubmit={handleRecover} className="max-w-md space-y-4">
                  <div className="rounded-lg bg-discord-nav p-4 border border-discord-hover shadow-inner">
                    <label className="mb-2 block text-[10px] font-bold uppercase text-discord-text-muted tracking-wider">
                      Security Phrase / Recovery Key
                    </label>
                    <div className="flex space-x-2">
                      <input
                        type="password"
                        value={recoveryKey}
                        onChange={(e) => setRecoveryKey(e.target.value)}
                        placeholder="Enter key..."
                        className="flex-1 rounded bg-discord-dark p-2.5 text-sm text-discord-text outline-none border border-discord-hover focus:border-discord-accent transition"
                      />
                      <button
                        type="submit"
                        disabled={loading || !recoveryKey}
                        className="rounded bg-discord-accent px-5 py-2 text-sm font-bold text-white transition hover:bg-opacity-90 disabled:opacity-50 active:scale-95 shadow-lg shadow-discord-accent/20"
                      >
                        {loading ? 'Processing...' : 'Recover'}
                      </button>
                    </div>
                    {status && (
                      <div className="mt-3 p-2 rounded bg-discord-dark/50 border border-discord-hover">
                        <p className="text-xs text-discord-accent font-medium">{status}</p>
                      </div>
                    )}
                  </div>
                </form>
              </section>

              <section className="rounded-lg border border-discord-hover p-6 bg-discord-nav/30">
                <h2 className="mb-2 text-base font-bold text-white leading-tight">Encryption Status</h2>
                <div className="flex items-center space-x-2 mb-2">
                   <div className={`h-2 w-2 rounded-full ${matrixService.isCryptoEnabled() ? 'bg-green-500 animate-pulse' : 'bg-red-500'}`} />
                   <span className="text-sm text-discord-text font-medium">
                     {matrixService.isCryptoEnabled() ? 'Encryption Engine Active' : 'Encryption Engine Disabled'}
                   </span>
                </div>
                <p className="text-xs text-discord-text-muted">
                  Device ID: <code className="bg-discord-dark px-1 rounded text-discord-text">{client?.getDeviceId() || 'Unknown'}</code>
                </p>
              </section>
            </div>
          ) : (
            <div className="animate-in fade-in slide-in-from-bottom-2 duration-300">
              <h1 className="mb-8 text-xl font-bold text-white uppercase tracking-tight">Channel Settings</h1>
              
              <section className="mb-10">
                <div className="mb-4 flex items-center">
                  <MessageSquare className="mr-2 h-5 w-5 text-discord-accent" />
                  <h2 className="text-base font-bold text-white">Message Loading</h2>
                </div>
                <p className="mb-6 text-sm text-discord-text-muted leading-relaxed">
                  Choose how messages should be loaded when you enter a channel.
                </p>

                <div className="max-w-md space-y-3 rounded-lg bg-discord-nav p-6 border border-discord-hover shadow-inner">
                  <label className="flex items-center space-x-4 cursor-pointer group p-3 rounded hover:bg-discord-hover/20 transition">
                    <input 
                      type="radio" 
                      name="loadPolicy"
                      checked={messageLoadPolicy === 'latest'}
                      onChange={() => setMessageLoadPolicy('latest')}
                      className="h-5 w-5 border-discord-hover bg-discord-dark text-discord-accent focus:ring-discord-accent accent-discord-accent cursor-pointer"
                    />
                    <div className="flex flex-col">
                      <span className={`text-sm font-bold transition ${messageLoadPolicy === 'latest' ? 'text-discord-accent' : 'text-white'}`}>Jump to latest message</span>
                      <span className="text-xs text-discord-text-muted">Always show the most recent activity first.</span>
                    </div>
                  </label>

                  <div className="h-px bg-discord-hover mx-2 opacity-50" />

                  <label className="flex items-center space-x-4 cursor-pointer group p-3 rounded hover:bg-discord-hover/20 transition">
                    <input 
                      type="radio" 
                      name="loadPolicy"
                      checked={messageLoadPolicy === 'last_read'}
                      onChange={() => setMessageLoadPolicy('last_read')}
                      className="h-5 w-5 border-discord-hover bg-discord-dark text-discord-accent focus:ring-discord-accent accent-discord-accent cursor-pointer"
                    />
                    <div className="flex flex-col">
                      <span className={`text-sm font-bold transition ${messageLoadPolicy === 'last_read' ? 'text-discord-accent' : 'text-white'}`}>Load to last read message</span>
                      <span className="text-xs text-discord-text-muted">Pick up exactly where you left off.</span>
                    </div>
                  </label>
                </div>
              </section>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default SettingsModal;
