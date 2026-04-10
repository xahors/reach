import React, { useState, useEffect } from 'react';
import { useAppStore } from '../../store/useAppStore';
import { useMatrixClient } from '../../hooks/useMatrixClient';
import { matrixService } from '../../core/matrix';
import { X, Shield, Lock, LogOut, MessageSquare, Bell, Monitor, Trash2, Clock, CheckCircle2, AlertTriangle } from 'lucide-react';
import type { IMyDevice } from 'matrix-js-sdk';

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
  const [activeTab, setActiveTab] = useState<'security' | 'channels' | 'notifications' | 'sessions'>('security');
  
  // Sessions state
  const [devices, setDevices] = useState<IMyDevice[]>([]);
  const [sessionsLoading, setSessionsLoading] = useState(false);
  const [sessionDuration, setSessionDuration] = useState('30d');

  // Notifications state (local mock for now as Matrix push rules are complex)
  const [notifSettings, setNotifSettings] = useState({
    global: true,
    mentions: true,
    dms: true,
    sounds: true
  });

  const fetchDevices = React.useCallback(async () => {
    if (!client) return;
    setSessionsLoading(true);
    try {
      const resp = await client.getDevices();
      setDevices(resp.devices || []);
    } catch (err) {
      console.error('Failed to fetch devices:', err);
    } finally {
      setSessionsLoading(false);
    }
  }, [client]);

  useEffect(() => {
    if (isSettingsOpen && activeTab === 'sessions') {
      fetchDevices();
    }
  }, [isSettingsOpen, activeTab, fetchDevices]);

  const handleRevokeSession = async (deviceId: string) => {
    if (!client) return;
    if (deviceId === client.getDeviceId()) {
      if (window.confirm('This is your current session. Revoking it will log you out. Continue?')) {
        handleLogout();
      }
      return;
    }

    if (!window.confirm('Are you sure you want to end this session?')) return;

    try {
      await client.deleteDevice(deviceId);
      setDevices(prev => prev.filter(d => d.device_id !== deviceId));
    } catch (err) {
      console.error('Failed to delete device:', err);
      alert('Failed to end session. Some servers require re-authentication for this action.');
    }
  };

  if (!isSettingsOpen) return null;

  const handleRecover = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!client || !recoveryKey.trim()) return;

    setLoading(true);
    setStatus('Attempting to recover keys...');

    try {
      await matrixService.withRecoveryKey(recoveryKey, async () => {
        const crypto = matrixService.getCrypto();
        
        if (!crypto) {
          throw new Error("Encryption is not initialized. Please refresh and try again.");
        }

        // In SDK v41+, bootstrap methods are on the crypto object
        if (typeof crypto.bootstrapCrossSigning !== 'function') {
          throw new Error("Cross-signing bootstrap not supported by this encryption backend.");
        }

        setStatus('Bootstrapping cross-signing...');
        await crypto.bootstrapCrossSigning({ setupNewCrossSigning: false });

        if (crypto.getKeyBackupInfo) {
          const backupInfo = await crypto.getKeyBackupInfo();
          
          if (backupInfo) {
            setStatus('Restoring message backup...');
            
            if (crypto.loadSessionBackupPrivateKeyFromSecretStorage) {
                await crypto.loadSessionBackupPrivateKeyFromSecretStorage();
            }

            if (crypto.restoreKeyBackup) {
               await crypto.restoreKeyBackup();
               
               setStatus('Decrypting history...');
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
    <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/50 backdrop-blur-sm p-4">
      <div className="flex h-[85vh] w-full max-w-5xl overflow-hidden rounded-xl bg-discord-dark shadow-2xl border border-white/5">
        {/* Sidebar */}
        <div className="w-64 bg-discord-nav p-6 pt-12 flex flex-col h-full border-r border-discord-hover">
          <h2 className="mb-4 text-[10px] font-bold uppercase text-discord-text-muted px-3 tracking-widest">User Settings</h2>
          <nav className="space-y-1 flex-1">
            <button 
              onClick={() => setActiveTab('security')}
              className={`flex w-full items-center rounded-md px-3 py-2 transition-all ${activeTab === 'security' ? 'bg-discord-hover text-white' : 'text-discord-text-muted hover:bg-discord-hover/30 hover:text-discord-text'}`}
            >
              <Shield className={`mr-2 h-4 w-4 ${activeTab === 'security' ? 'text-discord-accent' : ''}`} /> 
              <span className="text-sm font-medium">Security & Privacy</span>
            </button>
            <button 
              onClick={() => setActiveTab('channels')}
              className={`flex w-full items-center rounded-md px-3 py-2 transition-all ${activeTab === 'channels' ? 'bg-discord-hover text-white' : 'text-discord-text-muted hover:bg-discord-hover/30 hover:text-discord-text'}`}
            >
              <MessageSquare className={`mr-2 h-4 w-4 ${activeTab === 'channels' ? 'text-discord-accent' : ''}`} /> 
              <span className="text-sm font-medium">Channel Settings</span>
            </button>
            <button 
              onClick={() => setActiveTab('notifications')}
              className={`flex w-full items-center rounded-md px-3 py-2 transition-all ${activeTab === 'notifications' ? 'bg-discord-hover text-white' : 'text-discord-text-muted hover:bg-discord-hover/30 hover:text-discord-text'}`}
            >
              <Bell className={`mr-2 h-4 w-4 ${activeTab === 'notifications' ? 'text-discord-accent' : ''}`} /> 
              <span className="text-sm font-medium">Notifications</span>
            </button>
            <button 
              onClick={() => setActiveTab('sessions')}
              className={`flex w-full items-center rounded-md px-3 py-2 transition-all ${activeTab === 'sessions' ? 'bg-discord-hover text-white' : 'text-discord-text-muted hover:bg-discord-hover/30 hover:text-discord-text'}`}
            >
              <Monitor className={`mr-2 h-4 w-4 ${activeTab === 'sessions' ? 'text-discord-accent' : ''}`} /> 
              <span className="text-sm font-medium">Active Sessions</span>
            </button>
            
            <div className="my-4 border-t border-discord-hover mx-3 opacity-50" />
            <button 
              onClick={handleLogout}
              className="flex w-full items-center rounded-md px-3 py-2 text-red-400 transition hover:bg-red-500/10"
            >
              <LogOut className="mr-2 h-4 w-4" /> 
              <span className="text-sm font-medium">Log Out</span>
            </button>
          </nav>
        </div>

        {/* Content */}
        <div className="relative flex-1 bg-discord-dark p-10 overflow-y-auto no-scrollbar">
          <button 
            onClick={() => setSettingsOpen(false)}
            className="absolute right-8 top-8 rounded-full bg-discord-nav p-2 text-discord-text-muted hover:text-white transition shadow-lg"
          >
            <X className="h-5 w-5" />
          </button>

          {activeTab === 'security' && (
            <div className="animate-in fade-in slide-in-from-bottom-2 duration-300">
              <h1 className="mb-8 text-2xl font-bold text-white tracking-tight">Security & Privacy</h1>

              <section className="mb-10">
                <div className="mb-4 flex items-center">
                  <Lock className="mr-2 h-5 w-5 text-discord-accent" />
                  <h2 className="text-lg font-bold text-white">Encryption Recovery</h2>
                </div>
                <p className="mb-6 text-sm text-discord-text-muted max-w-2xl leading-relaxed">
                  Lost access to your messages? Enter your Security Phrase or Recovery Key to restore encryption keys for this session.
                </p>

                <form onSubmit={handleRecover} className="max-w-md space-y-4">
                  <div className="rounded-lg bg-discord-nav p-5 border border-discord-hover shadow-inner">
                    <label className="mb-2 block text-[10px] font-bold uppercase text-discord-text-muted tracking-widest">
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
                        className="rounded bg-discord-accent px-6 py-2 text-sm font-bold text-white transition hover:bg-opacity-90 disabled:opacity-50 active:scale-95 shadow-lg shadow-discord-accent/20"
                      >
                        {loading ? 'Processing...' : 'Recover'}
                      </button>
                    </div>
                    {status && (
                      <div className="mt-4 p-3 rounded bg-discord-dark/50 border border-discord-hover flex items-center space-x-2">
                        <div className="h-1.5 w-1.5 rounded-full bg-discord-accent animate-pulse" />
                        <p className="text-xs text-discord-accent font-medium">{status}</p>
                      </div>
                    )}
                  </div>
                </form>
              </section>

              <section className="rounded-xl border border-discord-hover p-6 bg-discord-nav/20 max-w-2xl">
                <h2 className="mb-4 text-base font-bold text-white leading-tight">Encryption Status</h2>
                <div className="flex items-center justify-between mb-4">
                   <div className="flex items-center space-x-3">
                      <div className={`h-3 w-3 rounded-full ${matrixService.isCryptoEnabled() ? 'bg-green-500 shadow-[0_0_8px_rgba(34,197,94,0.5)]' : 'bg-red-500'}`} />
                      <span className="text-sm text-discord-text font-medium">
                        {matrixService.isCryptoEnabled() ? 'End-to-End Encryption Active' : 'Encryption Disabled'}
                      </span>
                   </div>
                   {matrixService.isCryptoEnabled() && <CheckCircle2 className="h-5 w-5 text-green-500" />}
                </div>
                <div className="p-3 rounded bg-discord-dark border border-discord-hover">
                  <p className="text-[10px] text-discord-text-muted font-bold uppercase mb-1">Session Device ID</p>
                  <code className="text-xs text-discord-accent">{client?.getDeviceId() || 'Unknown'}</code>
                </div>
              </section>
            </div>
          )}

          {activeTab === 'channels' && (
            <div className="animate-in fade-in slide-in-from-bottom-2 duration-300">
              <h1 className="mb-8 text-2xl font-bold text-white tracking-tight">Channel Settings</h1>
              
              <section className="mb-10">
                <div className="mb-4 flex items-center">
                  <MessageSquare className="mr-2 h-5 w-5 text-discord-accent" />
                  <h2 className="text-lg font-bold text-white">Message Loading</h2>
                </div>
                <p className="mb-6 text-sm text-discord-text-muted leading-relaxed max-w-2xl">
                  Choose how Reach behaves when you switch channels.
                </p>

                <div className="max-w-md space-y-2 rounded-xl bg-discord-nav p-4 border border-discord-hover">
                  <button 
                    onClick={() => setMessageLoadPolicy('latest')}
                    className={`flex w-full items-center justify-between p-4 rounded-lg transition ${messageLoadPolicy === 'latest' ? 'bg-discord-accent/10 border border-discord-accent/30' : 'hover:bg-white/5 border border-transparent'}`}
                  >
                    <div className="flex flex-col items-start">
                      <span className={`text-sm font-bold ${messageLoadPolicy === 'latest' ? 'text-discord-accent' : 'text-white'}`}>Jump to latest</span>
                      <span className="text-xs text-discord-text-muted">Always show the most recent messages.</span>
                    </div>
                    {messageLoadPolicy === 'latest' && <CheckCircle2 className="h-5 w-5 text-discord-accent" />}
                  </button>

                  <button 
                    onClick={() => setMessageLoadPolicy('last_read')}
                    className={`flex w-full items-center justify-between p-4 rounded-lg transition ${messageLoadPolicy === 'last_read' ? 'bg-discord-accent/10 border border-discord-accent/30' : 'hover:bg-white/5 border border-transparent'}`}
                  >
                    <div className="flex flex-col items-start">
                      <span className={`text-sm font-bold ${messageLoadPolicy === 'last_read' ? 'text-discord-accent' : 'text-white'}`}>Load to last read</span>
                      <span className="text-xs text-discord-text-muted">Return exactly where you left off.</span>
                    </div>
                    {messageLoadPolicy === 'last_read' && <CheckCircle2 className="h-5 w-5 text-discord-accent" />}
                  </button>
                </div>
              </section>
            </div>
          )}

          {activeTab === 'notifications' && (
            <div className="animate-in fade-in slide-in-from-bottom-2 duration-300">
              <h1 className="mb-8 text-2xl font-bold text-white tracking-tight">Notifications</h1>
              
              <div className="max-w-2xl space-y-6">
                <div className="rounded-xl bg-discord-nav p-6 border border-discord-hover">
                  <h2 className="text-sm font-bold text-white mb-4 uppercase tracking-widest text-[10px]">Global Settings</h2>
                  
                  <div className="space-y-4">
                    {[
                      { id: 'global', label: 'Enable Notifications', desc: 'Allow Reach to send desktop notifications.' },
                      { id: 'mentions', label: 'Mentions Only', desc: 'Only notify me when I am explicitly tagged.' },
                      { id: 'dms', label: 'Direct Messages', desc: 'Always notify for private messages.' },
                      { id: 'sounds', label: 'Notification Sounds', desc: 'Play a sound for new messages.' }
                    ].map((item) => (
                      <div key={item.id} className="flex items-center justify-between p-3 rounded-lg hover:bg-white/5 transition">
                        <div className="flex flex-col">
                          <span className="text-sm font-medium text-white">{item.label}</span>
                          <span className="text-xs text-discord-text-muted">{item.desc}</span>
                        </div>
                        <div 
                          onClick={() => setNotifSettings(prev => ({ ...prev, [item.id]: !prev[item.id as keyof typeof prev] }))}
                          className={`relative h-6 w-11 cursor-pointer rounded-full transition-colors duration-200 ${notifSettings[item.id as keyof typeof notifSettings] ? 'bg-discord-accent' : 'bg-discord-black'}`}
                        >
                          <div className={`absolute top-1 h-4 w-4 rounded-full bg-white transition-transform duration-200 ${notifSettings[item.id as keyof typeof notifSettings] ? 'translate-x-6' : 'translate-x-1'}`} />
                        </div>
                      </div>
                    ))}
                  </div>
                </div>

                <div className="rounded-xl bg-discord-dark p-6 border border-discord-accent/20 flex items-start space-x-4">
                  <AlertTriangle className="h-6 w-6 text-discord-accent shrink-0" />
                  <div>
                    <h3 className="text-sm font-bold text-white mb-1">Browser Permissions</h3>
                    <p className="text-xs text-discord-text-muted">Ensure your browser allows notifications for this site to receive alerts when Reach is in the background.</p>
                  </div>
                </div>
              </div>
            </div>
          )}

          {activeTab === 'sessions' && (
            <div className="animate-in fade-in slide-in-from-bottom-2 duration-300">
              <div className="mb-8 flex items-center justify-between">
                <h1 className="text-2xl font-bold text-white tracking-tight">Active Sessions</h1>
                <button 
                  onClick={fetchDevices}
                  className="text-xs font-bold text-discord-accent hover:underline"
                >
                  Refresh List
                </button>
              </div>

              <section className="mb-10">
                <div className="mb-4 flex items-center">
                  <Clock className="mr-2 h-5 w-5 text-discord-accent" />
                  <h2 className="text-lg font-bold text-white">Session Expiry</h2>
                </div>
                <p className="mb-6 text-sm text-discord-text-muted max-w-2xl">
                  Configure how long your login session remains valid on this device.
                </p>
                <div className="flex flex-wrap gap-3 max-w-md">
                  {['24h', '7d', '30d', '90d', 'forever'].map(dur => (
                    <button
                      key={dur}
                      onClick={() => setSessionDuration(dur)}
                      className={`px-4 py-2 rounded-md text-xs font-bold transition ${sessionDuration === dur ? 'bg-discord-accent text-white shadow-lg' : 'bg-discord-nav text-discord-text-muted hover:bg-discord-hover'}`}
                    >
                      {dur === 'forever' ? 'Never Expire' : dur}
                    </button>
                  ))}
                </div>
              </section>

              <section className="space-y-4">
                <div className="mb-4 flex items-center">
                  <Monitor className="mr-2 h-5 w-5 text-discord-accent" />
                  <h2 className="text-lg font-bold text-white">Logged-in Devices</h2>
                </div>
                
                {sessionsLoading ? (
                  <div className="flex justify-center py-10">
                    <Loader2 className="h-8 w-8 animate-spin text-discord-accent" />
                  </div>
                ) : (
                  <div className="grid gap-4">
                    {devices.map((device) => {
                      const isCurrent = device.device_id === client?.getDeviceId();
                      return (
                        <div key={device.device_id} className={`flex items-center justify-between rounded-xl bg-discord-nav p-5 border transition ${isCurrent ? 'border-discord-accent/40 bg-discord-accent/5' : 'border-discord-hover hover:border-white/10'}`}>
                          <div className="flex items-center space-x-4">
                            <div className={`rounded-full p-3 ${isCurrent ? 'bg-discord-accent text-white' : 'bg-discord-dark text-discord-text-muted'}`}>
                              <Monitor className="h-6 w-6" />
                            </div>
                            <div className="flex flex-col">
                              <div className="flex items-center space-x-2">
                                <span className="font-bold text-white">{device.display_name || 'Unnamed Device'}</span>
                                {isCurrent && <span className="rounded bg-discord-accent px-1.5 py-0.5 text-[9px] font-bold text-white uppercase tracking-tighter">Current Session</span>}
                              </div>
                              <span className="text-[10px] font-mono text-discord-text-muted uppercase tracking-tight">{device.device_id}</span>
                              <span className="mt-1 text-xs text-discord-text-muted">Last active: {device.last_seen_ts ? new Date(device.last_seen_ts).toLocaleString() : 'Recently'}</span>
                            </div>
                          </div>
                          <button 
                            onClick={() => handleRevokeSession(device.device_id)}
                            className={`rounded-full p-2 transition ${isCurrent ? 'text-red-400 hover:bg-red-500/20' : 'text-discord-text-muted hover:bg-red-500/20 hover:text-red-400'}`}
                            title="End Session"
                          >
                            <Trash2 className="h-5 w-5" />
                          </button>
                        </div>
                      );
                    })}
                  </div>
                )}
              </section>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

const Loader2: React.FC<{ className?: string }> = ({ className }) => (
  <svg 
    className={className} 
    xmlns="http://www.w3.org/2000/svg" 
    width="24" 
    height="24" 
    viewBox="0 0 24 24" 
    fill="none" 
    stroke="currentColor" 
    strokeWidth="2" 
    strokeLinecap="round" 
    strokeLinejoin="round"
  >
    <path d="M21 12a9 9 0 1 1-6.219-8.56" />
  </svg>
);

export default SettingsModal;
