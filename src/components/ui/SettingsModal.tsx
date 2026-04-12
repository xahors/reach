import React, { useState, useEffect } from 'react';
import { useAppStore, THEME_PRESETS, type ThemeColors } from '../../store/useAppStore';
import { useMatrixClient } from '../../hooks/useMatrixClient';
import { matrixService } from '../../core/matrix';
import { 
  X, Shield, Lock, LogOut, Bell, Monitor, Trash2, Clock, 
  CheckCircle2, Gamepad2, Check, Plus, Edit2, Palette, Code, MessageSquare
} from 'lucide-react';
import type { IMyDevice } from 'matrix-js-sdk';
import { useGamePresence } from '../../hooks/useGamePresence';

const SettingsModal: React.FC = () => {
  const { 
    isSettingsOpen, 
    setSettingsOpen, 
    activeSettingsTab,
    setLoggedIn, 
    trackedGames,
    setTrackedGames,
    customGameNames,
    setCustomGameNames,
    detectedGame,
    themeConfig,
    setThemeConfig,
    showUrlPreviews,
    setShowUrlPreviews
  } = useAppStore();
  
  const client = useMatrixClient();
  const { runningProcesses } = useGamePresence();
  const [recoveryKey, setRecoveryKey] = useState('');
  const [status, setStatus] = useState('');
  const [loading, setLoading] = useState(false);
  const [editingGame, setEditingGame] = useState<string | null>(null);
  const [editName, setEditName] = useState('');
  
  const activeTab = activeSettingsTab;
  const setActiveTab = (tab: 'security' | 'channels' | 'notifications' | 'sessions' | 'activity' | 'appearance') => setSettingsOpen(true, tab);

  const handleRenameGame = (process: string) => {
    setCustomGameNames({
      ...customGameNames,
      [process]: editName
    });
    setEditingGame(null);
    matrixService.syncPresenceWithStore();
  };
  
  // Sessions state
  const [devices, setDevices] = useState<IMyDevice[]>([]);
  const [sessionsLoading, setSessionsLoading] = useState(false);

  // Notifications state (local mock for now as Matrix push rules are complex)
  const [notifSettings, setNotifSettings] = useState({
    global: true,
    mentions: true,
    calls: true,
    dms: true,
    suppressEveryone: false,
    suppressRoles: false
  });

  useEffect(() => {
    if (activeTab === 'sessions' && client) {
      setSessionsLoading(true);
      client.getDevices().then((res) => {
        setDevices(res.devices);
        setSessionsLoading(false);
      }).catch(() => setSessionsLoading(false));
    }
  }, [activeTab, client]);

  if (!isSettingsOpen) return null;

  const handleLogout = () => {
    if (window.confirm('Are you sure you want to logout?')) {
      matrixService.logout();
      setLoggedIn(false, null);
      setSettingsOpen(false);
    }
  };

  const handleRecover = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!recoveryKey.trim()) return;

    setLoading(true);
    setStatus('Verifying key...');
    
    try {
      await matrixService.withRecoveryKey(recoveryKey.trim(), async () => {
        const crypto = matrixService.getCrypto();
        if (!crypto) throw new Error('Crypto not initialized');

        setStatus('Bootstrapping cross-signing...');
        await crypto.bootstrapCrossSigning({ setupNewCrossSigning: false });

        setStatus('Restoring message backup...');
        if (crypto.loadSessionBackupPrivateKeyFromSecretStorage) {
            await crypto.loadSessionBackupPrivateKeyFromSecretStorage();
        }
        await crypto.restoreKeyBackup();
        
        setStatus('Success! Your session is verified.');
        setRecoveryKey('');
        setTimeout(() => setStatus(''), 3000);
      });
    } catch (err) {
      console.error(err);
      setStatus('Failed: ' + (err instanceof Error ? err.message : 'Unknown error'));
    } finally {
      setLoading(false);
    }
  };

  const handleColorChange = (key: keyof ThemeColors, value: string) => {
    setThemeConfig({
      activePreset: 'custom',
      colors: {
        ...themeConfig.colors,
        [key]: value
      }
    });
  };

  return (
    <div className="fixed inset-0 z-[100] flex animate-in fade-in duration-200">
      {/* Sidebar */}
      <div className="flex w-60 flex-col bg-bg-sidebar py-12 px-2 border-r border-border-main">
        <div className="mb-8 px-4">
          <h2 className="text-xs font-black uppercase tracking-widest text-text-muted">User Settings</h2>
        </div>
        
        <nav className="flex-1 space-y-0.5">
          <button 
            onClick={() => setActiveTab('appearance')}
            className={`flex w-full items-center rounded-md px-3 py-2 transition-all ${activeTab === 'appearance' ? 'bg-bg-hover text-text-main' : 'text-text-muted hover:bg-bg-hover/30 hover:text-text-main'}`}
          >
            <Palette className={`mr-2 h-4 w-4 ${activeTab === 'appearance' ? 'text-accent-primary' : ''}`} /> 
            <span className="text-sm font-medium">Appearance</span>
          </button>

          <button 
            onClick={() => setActiveTab('security')}
            className={`flex w-full items-center rounded-md px-3 py-2 transition-all ${activeTab === 'security' ? 'bg-bg-hover text-text-main' : 'text-text-muted hover:bg-bg-hover/30 hover:text-text-main'}`}
          >
            <Shield className={`mr-2 h-4 w-4 ${activeTab === 'security' ? 'text-accent-primary' : ''}`} /> 
            <span className="text-sm font-medium">Security & Privacy</span>
          </button>

          <button 
            onClick={() => setActiveTab('notifications')}
            className={`flex w-full items-center rounded-md px-3 py-2 transition-all ${activeTab === 'notifications' ? 'bg-bg-hover text-text-main' : 'text-text-muted hover:bg-bg-hover/30 hover:text-text-main'}`}
          >
            <Bell className={`mr-2 h-4 w-4 ${activeTab === 'notifications' ? 'text-accent-primary' : ''}`} /> 
            <span className="text-sm font-medium">Notifications</span>
          </button>

          <button 
            onClick={() => setActiveTab('sessions')}
            className={`flex w-full items-center rounded-md px-3 py-2 transition-all ${activeTab === 'sessions' ? 'bg-bg-hover text-text-main' : 'text-text-muted hover:bg-bg-hover/30 hover:text-text-main'}`}
          >
            <Monitor className={`mr-2 h-4 w-4 ${activeTab === 'sessions' ? 'text-accent-primary' : ''}`} /> 
            <span className="text-sm font-medium">Active Sessions</span>
          </button>

          <button 
            onClick={() => setActiveTab('activity')}
            className={`flex w-full items-center rounded-md px-3 py-2 transition-all ${activeTab === 'activity' ? 'bg-bg-hover text-text-main' : 'text-text-muted hover:bg-bg-hover/30 hover:text-text-main'}`}
          >
            <Gamepad2 className={`mr-2 h-4 w-4 ${activeTab === 'activity' ? 'text-accent-primary' : ''}`} /> 
            <span className="text-sm font-medium">Registered Games</span>
          </button>

          <div className="my-4 border-t border-border-main mx-3 opacity-50" />
          
          <button 
            onClick={handleLogout}
            className="flex w-full items-center rounded-md px-3 py-2 text-red-400 transition hover:bg-red-500/10"
          >
            <LogOut className="mr-2 h-4 w-4" /> 
            <span className="text-sm font-medium">Logout</span>
          </button>
        </nav>
      </div>

      {/* Main Content */}
      <div className="relative flex-1 bg-bg-main">
        <div className="absolute top-12 right-12">
          <button 
            onClick={() => setSettingsOpen(false)}
            className="flex h-10 w-10 items-center justify-center rounded-full border border-border-main text-text-muted transition hover:bg-bg-hover hover:text-text-main"
          >
            <X className="h-6 w-6" />
          </button>
          <span className="mt-2 block text-center text-[10px] font-bold uppercase text-text-muted">Esc</span>
        </div>

        <div className="mx-auto max-w-3xl py-12 px-10 h-full overflow-y-auto no-scrollbar">
          
          {activeTab === 'appearance' && (
            <div className="animate-in fade-in slide-in-from-bottom-2 duration-300 pb-20">
              <h1 className="mb-8 text-2xl font-bold text-text-main tracking-tight underline decoration-accent-primary decoration-4 underline-offset-8">Appearance</h1>
              
              <section className="mb-12">
                <div className="mb-6 flex items-center">
                  <Palette className="mr-2 h-5 w-5 text-accent-primary" />
                  <h2 className="text-lg font-bold text-text-main uppercase tracking-wider">Themes</h2>
                </div>
                
                <div className="space-y-8">
                  <div>
                    <h3 className="mb-4 text-[10px] font-black uppercase text-text-muted tracking-[0.2em]">Standard</h3>
                    <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-4">
                      {['oled', 'classic', 'slate', 'icebox'].map((presetId) => {
                        const preset = presetId as keyof typeof THEME_PRESETS;
                        return (
                          <button
                            key={preset}
                            onClick={() => setThemeConfig({ activePreset: preset, colors: THEME_PRESETS[preset] })}
                            className={`relative overflow-hidden rounded-xl border-2 p-4 text-left transition-all ${
                              themeConfig.activePreset === preset 
                                ? 'border-accent-primary bg-bg-hover ring-4 ring-accent-primary/10' 
                                : 'border-border-main bg-bg-nav hover:border-text-muted hover:bg-bg-hover/50'
                            }`}
                          >
                            <div className="flex flex-col space-y-2">
                              <span className={`text-[10px] font-black uppercase tracking-tight ${themeConfig.activePreset === preset ? 'text-text-main' : 'text-text-muted'}`}>
                                {preset}
                              </span>
                              <div className="flex space-x-1">
                                <div className="h-4 w-4 rounded-full border border-white/10" style={{ backgroundColor: THEME_PRESETS[preset]['bg-main'] }} />
                                <div className="h-4 w-4 rounded-full" style={{ backgroundColor: THEME_PRESETS[preset]['accent-primary'] }} />
                                <div className="h-4 w-4 rounded-full" style={{ backgroundColor: THEME_PRESETS[preset]['text-main'] }} />
                              </div>
                            </div>
                            {themeConfig.activePreset === preset && (
                              <Check className="absolute top-2 right-2 h-3 w-3 text-accent-primary" />
                            )}
                          </button>
                        );
                      })}
                    </div>
                  </div>

                  <div>
                    <h3 className="mb-4 text-[10px] font-black uppercase text-text-muted tracking-[0.2em]">Accessibility</h3>
                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                      {['protanopia', 'deuteranopia', 'tritanopia'].map((presetId) => {
                        const preset = presetId as keyof typeof THEME_PRESETS;
                        return (
                          <button
                            key={preset}
                            onClick={() => setThemeConfig({ activePreset: preset, colors: THEME_PRESETS[preset] })}
                            className={`relative overflow-hidden rounded-xl border-2 p-4 text-left transition-all ${
                              themeConfig.activePreset === preset 
                                ? 'border-accent-primary bg-bg-hover ring-4 ring-accent-primary/10' 
                                : 'border-border-main bg-bg-nav hover:border-text-muted hover:bg-bg-hover/50'
                            }`}
                          >
                            <div className="flex flex-col space-y-2">
                              <span className={`text-[10px] font-black uppercase tracking-tight ${themeConfig.activePreset === preset ? 'text-text-main' : 'text-text-muted'}`}>
                                {preset}
                              </span>
                              <div className="flex space-x-1">
                                <div className="h-4 w-4 rounded-full border border-white/10" style={{ backgroundColor: THEME_PRESETS[preset]['bg-main'] }} />
                                <div className="h-4 w-4 rounded-full" style={{ backgroundColor: THEME_PRESETS[preset]['accent-primary'] }} />
                              </div>
                            </div>
                            {themeConfig.activePreset === preset && (
                              <Check className="absolute top-2 right-2 h-3 w-3 text-accent-primary" />
                            )}
                          </button>
                        );
                      })}
                    </div>
                  </div>
                </div>
              </section>

              <section className="mb-12">
                <div className="mb-6 flex items-center">
                  <MessageSquare className="mr-2 h-5 w-5 text-accent-primary" />
                  <h2 className="text-lg font-bold text-text-main uppercase tracking-wider">Chat Features</h2>
                </div>
                <div className="space-y-3 max-w-2xl">
                  <div className="flex items-center justify-between rounded-xl bg-bg-nav p-4 border border-transparent hover:border-border-main transition">
                    <div>
                      <p className="text-sm font-bold text-text-main uppercase tracking-tight">URL Previews</p>
                      <p className="text-[10px] text-text-muted uppercase tracking-tighter">Show secure previews when hovering over links</p>
                    </div>
                    <div 
                      onClick={() => setShowUrlPreviews(!showUrlPreviews)}
                      className={`h-5 w-10 rounded-full p-1 cursor-pointer transition-colors ${showUrlPreviews ? 'bg-accent-primary' : 'bg-bg-hover'}`}
                    >
                      <div className={`h-3 w-3 rounded-full bg-white transition-transform ${showUrlPreviews ? 'translate-x-5' : 'translate-x-0'}`} />
                    </div>
                  </div>
                </div>
              </section>

              <section className="mb-12">
                <div className="mb-6 flex items-center">
                  <Edit2 className="mr-2 h-5 w-5 text-text-muted" />
                  <h2 className="text-lg font-bold text-text-main uppercase tracking-wider">Advanced Customization</h2>
                </div>
                
                <div className="rounded-xl border border-border-main bg-bg-nav/30 p-6 space-y-6">
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
                    {(Object.keys(themeConfig.colors) as Array<keyof ThemeColors>).map((colorKey) => (
                      <div key={colorKey} className="flex flex-col space-y-2">
                        <label className="text-[10px] font-bold text-text-muted uppercase tracking-tighter">{colorKey}</label>
                        <div className="flex items-center space-x-2">
                          <div 
                            className="h-8 w-8 rounded border border-border-main shrink-0" 
                            style={{ backgroundColor: themeConfig.colors[colorKey] }} 
                          />
                          <input 
                            type="text"
                            value={themeConfig.colors[colorKey]}
                            onChange={(e) => handleColorChange(colorKey, e.target.value)}
                            className="flex-1 rounded bg-bg-main px-3 py-1.5 text-xs font-mono text-text-main outline-none border border-border-main focus:border-accent-primary transition"
                          />
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              </section>

              <section>
                <div className="mb-6 flex items-center">
                  <Code className="mr-2 h-5 w-5 text-text-muted" />
                  <h2 className="text-lg font-bold text-text-main uppercase tracking-wider">Custom CSS</h2>
                </div>
                <div className="rounded-xl border border-border-main bg-bg-nav p-4">
                  <textarea
                    value={themeConfig.customCSS}
                    onChange={(e) => setThemeConfig({ customCSS: e.target.value })}
                    placeholder="/* Add your custom styles here */\n.message-item {\n  border-left: 2px solid var(--accent-primary);\n}"
                    className="h-40 w-full resize-none bg-transparent font-mono text-xs text-text-main outline-none placeholder:text-text-muted/30"
                  />
                </div>
                <p className="mt-2 text-[10px] text-text-muted italic">Advanced: These styles are injected directly into the application head.</p>
              </section>
            </div>
          )}

          {activeTab === 'security' && (
            <div className="animate-in fade-in slide-in-from-bottom-2 duration-300">
              <h1 className="mb-8 text-2xl font-bold text-text-main tracking-tight underline decoration-accent-primary decoration-4 underline-offset-8">Security & Privacy</h1>
              
              <section className="mb-10">
                <div className="mb-4 flex items-center">
                  <Lock className="mr-2 h-5 w-5 text-accent-primary" />
                  <h2 className="text-lg font-bold text-text-main uppercase tracking-wider">Session Recovery</h2>
                </div>
                <p className="mb-6 text-sm text-text-muted leading-relaxed">
                  Enter your Security Key to verify this session and restore access to encrypted messages.
                </p>

                <form onSubmit={handleRecover} className="space-y-4 rounded-xl border border-border-main bg-bg-nav p-6">
                  <div className="space-y-2">
                    <label className="text-[10px] font-bold text-text-muted uppercase tracking-widest">Recovery Key</label>
                    <input 
                      type="password"
                      value={recoveryKey}
                      onChange={(e) => setRecoveryKey(e.target.value)}
                      placeholder="e.g. EsT2 1234 ..."
                      className="w-full rounded bg-bg-main px-4 py-3 text-sm font-mono text-text-main outline-none border border-border-main focus:border-accent-primary transition"
                    />
                  </div>
                  <button 
                    disabled={loading || !recoveryKey.trim()}
                    className="w-full rounded bg-accent-primary py-3 text-sm font-black text-bg-main transition hover:opacity-90 disabled:opacity-50"
                  >
                    {loading ? 'Processing...' : 'Verify Session'}
                  </button>
                  {status && (
                    <p className={`mt-2 text-xs font-bold ${status.includes('Success') ? 'text-green-400' : 'text-yellow-400'}`}>
                      {status}
                    </p>
                  )}
                </form>
              </section>

              <section>
                <div className="mb-4 flex items-center">
                  <Shield className="mr-2 h-5 w-5 text-text-muted" />
                  <h2 className="text-lg font-bold text-text-main uppercase tracking-wider">Privacy Settings</h2>
                </div>
                <div className="space-y-2">
                  <div className="flex items-center justify-between rounded-xl bg-bg-nav p-4 border border-transparent hover:border-border-main transition">
                    <div>
                      <p className="text-sm font-bold text-text-main">Direct Message Encryption</p>
                      <p className="text-xs text-text-muted">Always encrypt DMs with new participants</p>
                    </div>
                    <div className="h-5 w-10 rounded-full bg-accent-primary p-1 cursor-pointer">
                      <div className="h-3 w-3 rounded-full bg-bg-main ml-auto" />
                    </div>
                  </div>
                </div>
              </section>
            </div>
          )}

          {activeTab === 'notifications' && (
            <div className="animate-in fade-in slide-in-from-bottom-2 duration-300">
              <h1 className="mb-8 text-2xl font-bold text-text-main tracking-tight underline decoration-accent-primary decoration-4 underline-offset-8">Notifications</h1>
              
              <div className="space-y-8">
                <section>
                  <h2 className="mb-4 text-xs font-black uppercase text-text-muted tracking-widest">Global Settings</h2>
                  <div className="space-y-3">
                    {[
                      { key: 'global', label: 'Push Notifications', desc: 'Receive notifications on this device' },
                      { key: 'calls', label: 'Incoming Calls', desc: 'Notify when someone starts a call' },
                      { key: 'dms', label: 'Direct Messages', desc: 'Always notify for new DMs' }
                    ].map(item => (
                      <div key={item.key} className="flex items-center justify-between rounded-xl bg-bg-nav p-4 border border-transparent hover:border-border-main transition">
                        <div>
                          <p className="text-sm font-bold text-text-main">{item.label}</p>
                          <p className="text-xs text-text-muted">{item.desc}</p>
                        </div>
                        <div 
                          onClick={() => setNotifSettings(s => ({ ...s, [item.key]: !s[item.key as keyof typeof notifSettings] }))}
                          className={`h-5 w-10 rounded-full p-1 cursor-pointer transition-colors ${notifSettings[item.key as keyof typeof notifSettings] ? 'bg-accent-primary' : 'bg-bg-hover'}`}
                        >
                          <div className={`h-3 w-3 rounded-full bg-white transition-transform ${notifSettings[item.key as keyof typeof notifSettings] ? 'translate-x-5' : 'translate-x-0'}`} />
                        </div>
                      </div>
                    ))}
                  </div>
                </section>

                <section>
                  <h2 className="mb-4 text-xs font-black uppercase text-text-muted tracking-widest">Suppressions</h2>
                  <div className="space-y-3">
                    <div className="flex items-center justify-between rounded-xl bg-bg-nav p-4 border border-transparent hover:border-border-main transition">
                      <div>
                        <p className="text-sm font-bold text-text-main">Suppress @everyone</p>
                        <p className="text-xs text-text-muted">Don't notify for broad mentions</p>
                      </div>
                      <div className="h-5 w-10 rounded-full bg-bg-hover p-1 cursor-not-allowed">
                        <div className="h-3 w-3 rounded-full bg-bg-main" />
                      </div>
                    </div>
                  </div>
                </section>
              </div>
            </div>
          )}

          {activeTab === 'sessions' && (
            <div className="animate-in fade-in slide-in-from-bottom-2 duration-300">
              <div className="flex items-baseline justify-between mb-8">
                <h1 className="text-2xl font-bold text-text-main tracking-tight underline decoration-accent-primary decoration-4 underline-offset-8">Active Sessions</h1>
                <span className="text-[10px] font-mono text-text-muted bg-bg-hover px-2 py-1 rounded">DEVICE_ID: {client?.getDeviceId()}</span>
              </div>

              {sessionsLoading ? (
                <div className="space-y-4">
                  {[1, 2, 3].map(i => <div key={i} className="h-20 w-full animate-pulse rounded-xl bg-bg-nav" />)}
                </div>
              ) : (
                <div className="space-y-4">
                  <div className="rounded-xl border-2 border-accent-primary bg-accent-primary/5 p-6 mb-8">
                    <div className="flex items-center justify-between mb-2">
                      <div className="flex items-center">
                        <div className="mr-3 flex h-8 w-8 items-center justify-center rounded-full bg-accent-primary text-bg-main">
                          <CheckCircle2 className="h-5 w-5" />
                        </div>
                        <h2 className="font-black text-text-main uppercase tracking-tighter text-lg">Current Session</h2>
                      </div>
                      <span className="rounded bg-accent-primary px-2 py-0.5 text-[10px] font-black text-bg-main uppercase tracking-widest">Active Now</span>
                    </div>
                    <p className="text-xs text-text-muted font-mono mb-1">Session ID: {client?.getDeviceId()}</p>
                    <p className="text-xs text-text-muted">Last seen: Just now</p>
                  </div>

                  <h3 className="text-xs font-black uppercase text-text-muted tracking-widest px-2 mb-4">Other Devices</h3>
                  {devices.filter(d => d.device_id !== client?.getDeviceId()).map((device) => (
                    <div key={device.device_id} className="flex items-center justify-between rounded-xl bg-bg-nav p-5 border border-transparent hover:border-border-main transition group">
                      <div className="flex items-center">
                        <div className="mr-4 flex h-10 w-10 items-center justify-center rounded-lg bg-bg-hover text-text-muted group-hover:text-text-main transition">
                          <Monitor className="h-6 w-6" />
                        </div>
                        <div>
                          <p className="font-bold text-text-main">{device.display_name || 'Unnamed Device'}</p>
                          <p className="text-xs text-text-muted font-mono">{device.device_id}</p>
                          <div className="mt-1 flex items-center space-x-2">
                            <Clock className="h-3 w-3 text-text-muted" />
                            <span className="text-[10px] text-text-muted">
                              Last seen {device.last_seen_ts ? new Date(device.last_seen_ts).toLocaleDateString() : 'Unknown'}
                            </span>
                          </div>
                        </div>
                      </div>
                      <button className="rounded-lg p-2 text-text-muted hover:bg-red-500/10 hover:text-red-400 transition">
                        <Trash2 className="h-5 w-5" />
                      </button>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          {activeTab === 'activity' && (
            <div className="animate-in fade-in slide-in-from-bottom-2 duration-300 pb-20">
              <h1 className="mb-8 text-2xl font-bold text-text-main tracking-tight underline decoration-accent-primary decoration-4 underline-offset-8">Activity Settings</h1>
              
              <section className="mb-10">
                <div className="mb-4 flex items-center justify-between max-w-2xl">
                  <div className="flex items-center">
                    <Gamepad2 className="mr-2 h-5 w-5 text-accent-primary" />
                    <h2 className="text-lg font-bold text-text-main uppercase tracking-wider">Registered Games</h2>
                  </div>
                </div>
                <p className="mb-6 text-sm text-text-muted leading-relaxed max-w-2xl">
                  Reach will automatically update your status when it detects these games running on your system.
                </p>

                <div className="grid gap-3 max-w-2xl">
                  {trackedGames.length === 0 && (
                    <div className="p-8 rounded-xl border border-dashed border-border-main text-center bg-bg-nav/20">
                      <p className="text-sm text-text-muted italic">No games registered yet. Add one from the list below!</p>
                    </div>
                  )}
                  {trackedGames.map((process) => {
                    const isEditing = editingGame === process;
                    const displayName = customGameNames[process] || process;
                    
                    return (
                      <div 
                        key={process}
                        className="flex items-center justify-between p-4 rounded-xl bg-bg-nav border border-transparent hover:border-border-main transition group"
                      >
                        <div className="flex flex-1 items-center min-w-0 mr-4">
                          <div className="h-10 w-10 rounded-lg bg-bg-hover flex items-center justify-center mr-4 shrink-0">
                            <Gamepad2 className="h-5 w-5 text-accent-primary" />
                          </div>
                          <div className="flex-1 min-w-0">
                            {isEditing ? (
                              <div className="flex items-center space-x-2">
                                <input 
                                  autoFocus
                                  type="text"
                                  value={editName}
                                  onChange={(e) => setEditName(e.target.value)}
                                  onKeyDown={(e) => e.key === 'Enter' && handleRenameGame(process)}
                                  className="flex-1 rounded bg-bg-main px-2 py-1 text-sm text-text-main outline-none border border-accent-primary"
                                />
                                <button 
                                  onClick={() => handleRenameGame(process)}
                                  className="p-1 rounded bg-accent-primary text-bg-main hover:bg-opacity-90 transition"
                                >
                                  <Check className="h-4 w-4" />
                                </button>
                              </div>
                            ) : (
                              <div className="flex items-center group/name">
                                <span className="text-sm font-bold text-text-main truncate">{displayName}</span>
                                <button 
                                  onClick={() => { setEditingGame(process); setEditName(displayName); }}
                                  className="ml-2 p-1 rounded hover:bg-bg-hover opacity-0 group-hover/name:opacity-100 transition"
                                >
                                  <Edit2 className="h-3 w-3 text-text-muted" />
                                </button>
                              </div>
                            )}
                            <div className="flex items-center text-[10px] font-mono text-text-muted uppercase tracking-tight mt-0.5">
                              <span>PID: {process}</span>
                              {detectedGame === process && (
                                <span className="ml-2 px-1 rounded bg-green-500/20 text-green-400 font-bold tracking-tighter">Running</span>
                              )}
                            </div>
                          </div>
                        </div>
                        <button 
                          onClick={() => setTrackedGames(trackedGames.filter(g => g !== process))}
                          className="p-2 rounded-lg text-text-muted hover:bg-red-500/10 hover:text-red-400 transition"
                        >
                          <Trash2 className="h-4 w-4" />
                        </button>
                      </div>
                    );
                  })}
                </div>
              </section>

              <section className="mb-10">
                <div className="mb-4 flex items-center">
                  <Monitor className="mr-2 h-5 w-5 text-text-muted" />
                  <h2 className="text-lg font-bold text-text-main uppercase tracking-wider">Running Apps</h2>
                </div>
                <p className="mb-6 text-sm text-text-muted leading-relaxed max-w-2xl">
                  Detected applications currently active on your device. Add them to your registered games list to show them in your status.
                </p>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-2 max-w-3xl">
                  {runningProcesses
                    .filter(p => !trackedGames.includes(p))
                    .slice(0, 20)
                    .map((process) => (
                      <div 
                        key={process}
                        onClick={() => {
                          setTrackedGames([...trackedGames, process]);
                        }}
                        className="flex items-center justify-between p-3 rounded-lg bg-bg-nav hover:bg-bg-hover cursor-pointer transition border border-transparent hover:border-accent-primary/30 group"
                      >
                        <div className="flex flex-col min-w-0">
                          <span className="text-xs font-bold text-text-main truncate font-mono tracking-tighter">{process}</span>
                          <span className="text-[9px] text-text-muted uppercase italic">Process</span>
                        </div>
                        <Plus className="h-4 w-4 text-text-muted group-hover:text-accent-primary" />
                      </div>
                    ))}
                </div>
              </section>

              <section className="rounded-xl border border-border-main p-6 bg-bg-nav/20 max-w-2xl">
                <h2 className="mb-4 text-xs font-black uppercase text-text-muted tracking-widest">Status Preview</h2>
                {detectedGame ? (
                  <div className="flex items-center space-x-4">
                    <div className="h-3 w-3 rounded-full bg-green-500 shadow-[0_0_8px_rgba(34,197,94,0.5)] animate-pulse" />
                    <span className="text-sm text-text-main font-medium">
                      Currently Playing <span className="font-bold text-accent-primary">{customGameNames[detectedGame] || detectedGame}</span>
                    </span>
                  </div>
                ) : (
                  <div className="flex items-center space-x-4 opacity-50">
                    <div className="h-3 w-3 rounded-full bg-text-muted" />
                    <span className="text-sm text-text-main font-medium italic uppercase tracking-wider">Idle — Monitoring background tasks</span>
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

export default SettingsModal;
