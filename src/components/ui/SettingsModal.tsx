import React, { useState, useEffect, useRef } from 'react';
import { useAppStore, THEME_PRESETS } from '../../store/useAppStore';
import { useMatrixClient } from '../../hooks/useMatrixClient';
import { matrixService } from '../../core/matrix';
import { notificationService } from '../../core/notifications';
import { 
  X, Shield, Lock, LogOut, Bell, Monitor, 
  CheckCircle2, Gamepad2, Edit2, Palette, Code,
  Volume2, AtSign, LifeBuoy, FileText, GitBranch, AlertCircle,
  User, Camera, Loader2, Key, Download, Upload
} from 'lucide-react';
import type { IMyDevice } from 'matrix-js-sdk';
import { useGamePresence } from '../../hooks/useGamePresence';
import { reachLogger } from '../../utils/logger';
import { cn } from '../../utils/cn';

const SettingsModal: React.FC = () => {
  const { 
    isSettingsOpen, 
    setSettingsOpen, 
    activeSettingsTab,
    setLoggedIn, 
    customGameNames,
    setCustomGameNames,
    detectedGame,
    themeConfig,
    setThemeConfig,
    showUrlPreviews,
    setShowUrlPreviews,
    sendReadReceipts,
    setSendReadReceipts,
    userPresence,
    setUserPresence,
    globalNotificationSettings,
    setGlobalNotificationSettings,
    roomSections,
    roomSectionOrder
  } = useAppStore();
  
  const client = useMatrixClient();
  const { runningProcesses } = useGamePresence();
  const [recoveryKey, setRecoveryKey] = useState('');
  const [status, setStatus] = useState('');
  const [loading, setLoading] = useState(false);
  const [editingGame, setEditingGame] = useState<string | null>(null);
  const [editName, setEditName] = useState('');
  const [importStatus, setImportStatus] = useState<{ message: string; isError: boolean } | null>(null);
  
  // Account state
  const [newDisplayName, setNewDisplayName] = useState('');
  const [email, setEmail] = useState('');
  const [newEmail, setNewEmail] = useState('');
  const [isEmailChangeable, setIsEmailChangeable] = useState(false);
  const [isPasswordRecoverable, setIsPasswordRecoverable] = useState(false);
  const [emailStatus, setEmailStatus] = useState<{ message: string; isError: boolean } | null>(null);
  const [avatarUrl, setAvatarUrl] = useState<string | null>(null);
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [accountLoading, setAccountLoading] = useState(false);
  const [profileStatus, setProfileStatus] = useState<{ message: string; isError: boolean } | null>(null);
  const [passwordStatus, setPasswordStatus] = useState<{ message: string; isError: boolean } | null>(null);
  const [passwordErrors, setPasswordErrors] = useState<{
    current?: string;
    new?: string;
    confirm?: string;
  }>({});
  const [e2eeStatus, setE2eeStatus] = useState<{
    isVerified: boolean;
    hasMasterKey: boolean;
    isBackupTrusted: boolean;
  } | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const activeTab = activeSettingsTab as string;
  const setActiveTab = (tab: 'account' | 'security' | 'channels' | 'notifications' | 'sessions' | 'activity' | 'appearance' | 'support' | 'data') => setSettingsOpen(true, tab);

  useEffect(() => {
    if (isSettingsOpen && activeTab === 'account' && client) {
      const userId = client.getUserId();
      const deviceId = client.getDeviceId();
      if (userId && deviceId) {
        // Fetch Profile Info
        client.getProfileInfo(userId).then(info => {
          if (info) {
            setNewDisplayName(info.displayname || '');
            setAvatarUrl(info.avatar_url || null);
          }
        }).catch(err => {
          reachLogger.error("Failed to fetch profile info:", err);
        });

        // Fetch E2EE Status
        const crypto = matrixService.getCrypto();
        if (crypto) {
          Promise.all([
            crypto.getDeviceVerificationStatus(userId, deviceId),
            crypto.getCrossSigningStatus?.(),
            crypto.getKeyBackupInfo(),
          ]).then(async ([verification, crossSigning, backupInfo]) => {
            let backupTrusted = false;
            if (backupInfo) {
              const trust = await crypto.isKeyBackupTrusted(backupInfo);
              backupTrusted = !!trust.trusted;
            }

            setE2eeStatus({
              isVerified: !!verification?.isVerified(),
              hasMasterKey: !!crossSigning?.privateKeysCachedLocally?.masterKey,
              isBackupTrusted: backupTrusted
            });
          }).catch(err => {
             reachLogger.error("Failed to fetch E2EE status:", err);
          });
        }

        // Fetch Email Info
        client.getThreePids().then(pids => {
          const emailPid = pids.threepids.find(p => p.medium === 'email');
          if (emailPid) {
            setEmail(emailPid.address);
            setNewEmail(emailPid.address);
          }
        }).catch(err => {
          reachLogger.error("Failed to fetch 3PIDs:", err);
        });

        // Check Server Capabilities
        client.getCapabilities().then(caps => {
          // Check if 3PIDs can be changed
          const canChange3pid = !!caps?.['m.3pid_changes']?.enabled;
          setIsEmailChangeable(canChange3pid);

          // Check if password can be reset via email
          // This is a bit heuristic as there isn't a direct "email_recovery" cap in all versions,
          // but m.3pid_changes being enabled usually implies identity server or local 3pid support.
          setIsPasswordRecoverable(canChange3pid);
        }).catch(err => {
          reachLogger.warn("Failed to fetch server capabilities:", err);
        });
      }
    }
  }, [isSettingsOpen, activeTab, client]);

  // Clear errors when inputs change
  useEffect(() => {
    setPasswordErrors({});
    setPasswordStatus(null);
  }, [currentPassword, newPassword, confirmPassword]);

  const handleUpdateProfile = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!client) return;

    setAccountLoading(true);
    setProfileStatus({ message: 'Updating profile...', isError: false });
    try {
      if (newDisplayName) {
        await client.setDisplayName(newDisplayName);
      }
      setProfileStatus({ message: 'Profile updated successfully!', isError: false });
      setTimeout(() => setProfileStatus(null), 3000);
    } catch (err: unknown) {
      const error = err as Error;
      setProfileStatus({ message: `Error: ${error.message}`, isError: true });
    } finally {
      setAccountLoading(false);
    }
  };

  const handleUpdateEmail = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!client || !newEmail || newEmail === email) return;

    setAccountLoading(true);
    setEmailStatus({ message: 'Sending verification email...', isError: false });
    try {
      // In a real implementation, this would require a session and possibly a password.
      // Matrix email addition is complex (requestToken -> click link -> addThreePid).
      // For now we'll initiate the request.
      await client.requestEmailToken(newEmail, "client_secret_here", 1, "/");
      setEmailStatus({ message: 'Verification email sent! Please check your inbox.', isError: false });
    } catch (err: unknown) {
      const error = err as Error;
      setEmailStatus({ message: `Error: ${error.message}`, isError: true });
    } finally {
      setAccountLoading(false);
    }
  };

  const handleAvatarChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !client) return;

    setAccountLoading(true);
    setProfileStatus({ message: 'Uploading avatar...', isError: false });
    try {
      const uploadResult = await client.uploadContent(file);
      const mxcUrl = typeof uploadResult === 'string' ? uploadResult : (uploadResult as { content_uri: string }).content_uri;
      if (mxcUrl) {
        await client.setAvatarUrl(mxcUrl);
        setAvatarUrl(mxcUrl);
        setProfileStatus({ message: 'Avatar updated successfully!', isError: false });
      }
      setTimeout(() => setProfileStatus(null), 3000);
    } catch (err: unknown) {
      const error = err as Error;
      setProfileStatus({ message: `Error: ${error.message}`, isError: true });
    } finally {
      setAccountLoading(false);
    }
  };

  const validatePasswords = () => {
    const errors: typeof passwordErrors = {};
    if (!currentPassword) errors.current = 'Current password is required';
    if (newPassword.length < 8) errors.new = 'Password must be at least 8 characters';
    if (newPassword !== confirmPassword) errors.confirm = 'Passwords do not match';
    
    setPasswordErrors(errors);
    return Object.keys(errors).length === 0;
  };

  const handleChangePassword = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!client) return;

    if (!validatePasswords()) return;

    setAccountLoading(true);
    setPasswordStatus({ message: 'Requesting password change...', isError: false });
    reachLogger.info("Attempting to change password...");

    try {
      const userId = client.getUserId();
      if (!userId) throw new Error('Not logged in');

      // Standard UIA compliance: First try without auth, catch 401, then send auth with session
      try {
        await client.setPassword({}, newPassword, false);
      } catch (err: unknown) {
        const error = err as { httpStatus?: number; status?: number; data?: { session?: string }; message?: string };
        const httpStatus = error.httpStatus || error.status;

        if (httpStatus === 401 && error.data && error.data.session) {
          const authDict = {
            type: 'm.login.password',
            identifier: {
              type: 'm.id.user',
              user: userId
            },
            password: currentPassword,
            session: error.data.session
          };
          await client.setPassword(authDict, newPassword, false);
        } else {
          throw err;
        }
      }      
      reachLogger.info("Password changed successfully");
      setPasswordStatus({ message: 'Password changed successfully! You may need to log in again on other devices.', isError: false });
      setCurrentPassword('');
      setNewPassword('');
      setConfirmPassword('');
      setPasswordErrors({});
      setTimeout(() => setPasswordStatus(null), 7000);
    } catch (err: unknown) {
      reachLogger.error("Failed to change password:", err);
      
      const error = err as { message?: string; httpStatus?: number; status?: number };
      const errorMessage = String(error?.message || 'Failed to change password');
      const httpStatus = error?.httpStatus || error?.status;
      const isAuthError = httpStatus === 401 || httpStatus === 403 || 
                         errorMessage.toLowerCase().includes('invalid password') || 
                         errorMessage.toLowerCase().includes('forbidden');

      if (isAuthError) {
        setPasswordErrors({ current: 'Incorrect current password' });
        setPasswordStatus({ message: 'Error: The current password you entered is incorrect.', isError: true });
      } else {
        setPasswordStatus({ message: `Error: ${errorMessage}`, isError: true });
      }
    } finally {
      setAccountLoading(false);
    }
  };

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

  // Notifications state
  const [notifSettings, setNotifSettings] = useState(globalNotificationSettings);

  useEffect(() => {
    setGlobalNotificationSettings(notifSettings);
  }, [notifSettings, setGlobalNotificationSettings]);

  const handleRequestPermission = async () => {
    const granted = await notificationService.requestPermission();
    if (granted) {
      alert("Notification permission granted!");
    } else {
      alert("Notification permission denied or not supported.");
    }
  };

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
        if (typeof crypto.loadSessionBackupPrivateKeyFromSecretStorage === 'function') {
            await crypto.loadSessionBackupPrivateKeyFromSecretStorage();
        }
        
        try {
          await crypto.restoreKeyBackup();
        } catch (err: unknown) {
          const backupErr = err as { httpStatus?: number; data?: { errcode?: string } };
          if (backupErr.httpStatus === 404 || backupErr.data?.errcode === 'M_NOT_FOUND') {
            console.info("No keys found in current backup version.");
          } else {
            console.warn("Failed to restore key backup:", backupErr);
          }
        }

        // CRITICAL: Retry decryption for the current session's timeline
        if (client) {
          setStatus('Success! Retrying decryption...');
          
          // Give Rust SDK a moment to process the restored keys
          await new Promise(resolve => setTimeout(resolve, 1000));
          
          await matrixService.retryDecryption();
        }
      });
      setStatus('Successfully restored E2EE keys. Messages will decrypt shortly.');
      setRecoveryKey('');
      setTimeout(() => setStatus(''), 5000);
    } catch (err: unknown) {
      const error = err as Error;
      setStatus(`Error: ${error.message}`);
    } finally {
      setLoading(false);
    }
  };

  const handleExportSections = () => {
    const data = {
      version: 1,
      timestamp: Date.now(),
      roomSections,
      roomSectionOrder
    };
    
    const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `reach-sections-${new Date().toISOString().split('T')[0]}.json`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
    reachLogger.info("Exported room sections configuration");
  };

  const handleImportSections = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (event) => {
      try {
        const content = event.target?.result as string;
        const data = JSON.parse(content);
        
        if (!data.roomSections || !data.roomSectionOrder) {
          throw new Error('Invalid configuration file: Missing required fields.');
        }

        // Apply to store
        useAppStore.setState({
          roomSections: data.roomSections,
          roomSectionOrder: data.roomSectionOrder
        });

        setImportStatus({ message: 'Configuration imported successfully! Your sidebar has been updated.', isError: false });
        reachLogger.info("Imported room sections configuration");
        
        // Reset file input
        e.target.value = '';
        
        setTimeout(() => setImportStatus(null), 5000);
      } catch (err: unknown) {
        const error = err as Error;
        setImportStatus({ message: `Import failed: ${error.message}`, isError: true });
        reachLogger.error("Failed to import sections:", err);
      }
    };
    reader.readAsText(file);
  };

  return (
    <div id="settings-modal-overlay" className="fixed inset-0 z-[100] flex items-center justify-center bg-black/80 backdrop-blur-sm animate-in fade-in duration-300">
      <div data-protected="true" className="flex h-[80vh] w-full max-w-5xl overflow-hidden rounded-2xl border border-border-main bg-bg-main shadow-2xl animate-in zoom-in-95 duration-300">
        {/* Sidebar */}
        <div className="w-60 shrink-0 border-r border-border-main bg-bg-sidebar p-6 overflow-y-auto no-scrollbar">
          <div className="mb-8">
            <h2 className="mb-4 text-[10px] font-black uppercase tracking-widest text-text-muted">User Settings</h2>
            <nav className="space-y-1">
              {[
                { id: 'account', label: 'Account', icon: User },
                { id: 'security', label: 'Security & Privacy', icon: Shield },
                { id: 'activity', label: 'Activity', icon: Gamepad2 },
                { id: 'notifications', label: 'Notifications', icon: Bell },
                { id: 'sessions', label: 'Active Sessions', icon: Monitor },
              ].map(item => (
                <button
                  key={item.id}
                  onClick={() => setActiveTab(item.id as 'account' | 'security' | 'activity' | 'notifications' | 'sessions')}
                  className={`flex w-full items-center rounded-md px-3 py-2 transition-all ${activeTab === item.id ? 'bg-bg-hover text-text-main ring-1 ring-white/10' : 'text-text-muted hover:bg-bg-hover/30 hover:text-text-main'}`}
                >
                  <item.icon className={`mr-2 h-4 w-4 shrink-0 ${activeTab === item.id ? 'text-accent-primary' : ''}`} />
                  <span className="text-sm font-medium whitespace-nowrap">{item.label}</span>
                </button>
              ))}
            </nav>
          </div>

          <div className="mb-8">
            <h2 className="mb-4 text-[10px] font-black uppercase tracking-widest text-text-muted">App Settings</h2>
            <nav className="space-y-1">
              {[
                { id: 'appearance', label: 'Appearance', icon: Palette },
                { id: 'data', label: 'Data Portability', icon: Download },
                { id: 'support', label: 'Support & Logs', icon: LifeBuoy },
              ].map(item => (
                <button
                  key={item.id}
                  data-protected={item.id === 'appearance' ? 'true' : undefined}
                  onClick={() => setActiveTab(item.id as 'appearance' | 'support' | 'data')}
                  className={`flex w-full items-center rounded-md px-3 py-2 transition-all ${activeTab === item.id ? 'bg-bg-hover text-text-main ring-1 ring-white/10' : 'text-text-muted hover:bg-bg-hover/30 hover:text-text-main'}`}
                >
                  <item.icon className={`mr-2 h-4 w-4 shrink-0 ${activeTab === item.id ? 'text-accent-primary' : ''}`} />
                  <span className="text-sm font-medium whitespace-nowrap">{item.label}</span>
                </button>
              ))}
            </nav>
          </div>

          <div className="pt-4 border-t border-border-main/50">
            <button
              onClick={handleLogout}
              className="flex w-full items-center rounded-md px-3 py-2 text-red-400 transition-all hover:bg-red-500/10"
            >
              <LogOut className="mr-2 h-4 w-4" />
              <span className="text-sm font-medium">Log Out</span>
            </button>
          </div>
        </div>

        {/* Content */}
        <div className="relative flex-1 overflow-y-auto p-10 bg-bg-main no-scrollbar">
          <button
            onClick={() => setSettingsOpen(false)}
            data-protected="true"
            className="absolute right-8 top-8 rounded-full border border-border-main p-2 text-text-muted transition hover:bg-bg-hover hover:text-white"
          >
            <X className="h-5 w-5" />
          </button>

          {activeTab === 'account' && (
            <div className="animate-in fade-in slide-in-from-bottom-2 duration-300">
              <h1 className="mb-8 text-2xl font-bold text-text-main tracking-tight underline decoration-accent-primary decoration-4 underline-offset-8">Account</h1>
              
              <div className="space-y-8">
                <section>
                  <h2 className="mb-4 text-xs font-black uppercase text-text-muted tracking-widest">Profile</h2>
                  <div className="rounded-xl bg-bg-nav p-6 border border-border-main/50 space-y-6">
                    <div className="flex items-center space-x-6">
                      <div className="relative group">
                        <div className="h-24 w-24 rounded-full bg-accent-primary/10 flex items-center justify-center overflow-hidden border-2 border-border-main group-hover:border-accent-primary transition-all shadow-xl">
                          {avatarUrl ? (
                            <img 
                              src={client?.mxcUrlToHttp(avatarUrl, 96, 96, 'crop') || ''} 
                              alt="Avatar" 
                              className="h-full w-full object-cover" 
                            />
                          ) : (
                            <User className="h-10 w-10 text-accent-primary opacity-50" />
                          )}
                        </div>
                        <button 
                          onClick={() => fileInputRef.current?.click()}
                          className="absolute inset-0 flex items-center justify-center bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity rounded-full"
                        >
                          <Camera className="h-6 w-6 text-white" />
                        </button>
                        <input 
                          type="file" 
                          ref={fileInputRef} 
                          className="hidden" 
                          accept="image/*" 
                          onChange={handleAvatarChange}
                        />
                      </div>
                      <div className="flex-1 space-y-4">
                        <div>
                          <label className="text-[10px] font-black uppercase text-text-muted tracking-widest block mb-1">User ID</label>
                          <p className="text-sm font-mono text-text-main bg-bg-sidebar px-3 py-2 rounded-lg border border-border-main">{client?.getUserId()}</p>
                        </div>
                        <form onSubmit={handleUpdateProfile}>
                          <label className="text-[10px] font-black uppercase text-text-muted tracking-widest block mb-1">Display Name</label>
                          <div className="flex space-x-2">
                            <input
                              type="text"
                              value={newDisplayName}
                              onChange={(e) => setNewDisplayName(e.target.value)}
                              placeholder="Set a display name"
                              className="flex-1 rounded-lg bg-bg-sidebar px-4 py-2 text-sm text-text-main outline-none focus:ring-2 focus:ring-accent-primary/50 border border-border-main transition-all"
                            />
                            <button
                              type="submit"
                              disabled={accountLoading}
                              className="rounded-lg bg-accent-primary px-4 py-2 text-xs font-black text-bg-main hover:opacity-90 disabled:opacity-50 uppercase tracking-widest transition-all min-w-[80px]"
                            >
                              {accountLoading && profileStatus?.message?.includes('profile') ? <Loader2 className="h-4 w-4 animate-spin mx-auto text-bg-main" /> : 'Update'}
                            </button>
                          </div>
                        </form>
                        
                        <div className="pt-4 border-t border-border-main/20">
                          <form onSubmit={handleUpdateEmail}>
                            <div className="flex items-center justify-between mb-1">
                              <label className="text-[10px] font-black uppercase text-text-muted tracking-widest block">Email Address</label>
                              {!isEmailChangeable && (
                                <span className="text-[9px] text-accent-primary/60 font-bold uppercase tracking-tighter">Read-only on this server</span>
                              )}
                            </div>
                            <div className="flex space-x-2">
                              <input
                                type="email"
                                value={newEmail}
                                onChange={(e) => setNewEmail(e.target.value)}
                                disabled={!isEmailChangeable || accountLoading}
                                placeholder={isEmailChangeable ? "Enter your email address" : "Email not configured"}
                                className={cn(
                                  "flex-1 rounded-lg bg-bg-sidebar px-4 py-2 text-sm text-text-main outline-none focus:ring-2 focus:ring-accent-primary/50 border transition-all",
                                  !isEmailChangeable ? "border-transparent opacity-60 cursor-not-allowed" : "border-border-main"
                                )}
                              />
                              {isEmailChangeable && (
                                <button
                                  type="submit"
                                  disabled={accountLoading || !newEmail || newEmail === email}
                                  className="rounded-lg bg-accent-primary px-4 py-2 text-xs font-black text-bg-main hover:opacity-90 disabled:opacity-50 uppercase tracking-widest transition-all min-w-[80px]"
                                >
                                  {accountLoading && emailStatus?.message?.includes('verification') ? <Loader2 className="h-4 w-4 animate-spin mx-auto text-bg-main" /> : 'Save'}
                                </button>
                              )}
                            </div>
                            {isPasswordRecoverable && (
                              <p className="mt-2 text-[9px] text-text-muted italic">
                                * Your email address is used for password recovery and account security notifications.
                              </p>
                            )}
                          </form>
                          {emailStatus && (
                            <div className={cn(
                              "mt-3 rounded-lg p-3 text-xs font-medium border animate-in fade-in duration-300",
                              emailStatus.isError ? "bg-red-500/10 text-red-400 border-red-500/20" : 
                              emailStatus.message?.includes('...') ? "bg-bg-sidebar text-text-muted border-border-main" :
                              "bg-green-500/10 text-green-400 border-green-500/20"
                            )}>
                              <div className="flex items-center space-x-2">
                                {emailStatus.isError ? <AlertCircle className="h-4 w-4" /> : 
                                 emailStatus.message?.includes('...') ? <Loader2 className="h-3 w-3 animate-spin" /> :
                                 <CheckCircle2 className="h-4 w-4" />}
                                <span>{emailStatus.message}</span>
                              </div>
                            </div>
                          )}
                        </div>
                      </div>
                    </div>
                    {profileStatus && (
                      <div className={cn(
                        "rounded-lg p-3 text-xs font-medium border animate-in fade-in duration-300",
                        profileStatus.isError ? "bg-red-500/10 text-red-400 border-red-500/20" : 
                        profileStatus.message?.includes('...') ? "bg-bg-sidebar text-text-muted border-border-main" :
                        "bg-green-500/10 text-green-400 border-green-500/20"
                      )}>
                        <div className="flex items-center space-x-2">
                          {profileStatus.isError ? <AlertCircle className="h-4 w-4" /> : 
                           profileStatus.message?.includes('...') ? <Loader2 className="h-3 w-3 animate-spin" /> :
                           <CheckCircle2 className="h-4 w-4" />}
                          <span>{profileStatus.message}</span>
                        </div>
                      </div>
                    )}
                  </div>
                </section>

                <section>
                  <h2 className="mb-4 text-xs font-black uppercase text-text-muted tracking-widest">Encryption & Security</h2>
                  <div className="rounded-xl bg-bg-nav p-6 border border-border-main/50 space-y-4">
                    <div className="flex items-center justify-between py-2 border-b border-border-main/30">
                      <div className="flex items-center space-x-3">
                        <Shield className={cn("h-4 w-4", e2eeStatus?.isVerified ? "text-green-500" : "text-red-400")} />
                        <div>
                          <p className="text-xs font-bold text-white uppercase tracking-tight">Session Verification</p>
                          <p className="text-[10px] text-text-muted">Current device trust status</p>
                        </div>
                      </div>
                      <span className={cn("px-2 py-0.5 rounded text-[9px] font-black uppercase", e2eeStatus?.isVerified ? "bg-green-500/10 text-green-400" : "bg-red-500/10 text-red-400")}>
                        {e2eeStatus?.isVerified ? 'Verified' : 'Unverified'}
                      </span>
                    </div>

                    <div className="flex items-center justify-between py-2 border-b border-border-main/30">
                      <div className="flex items-center space-x-3">
                        <Key className={cn("h-4 w-4", e2eeStatus?.hasMasterKey ? "text-green-500" : "text-yellow-500")} />
                        <div>
                          <p className="text-xs font-bold text-white uppercase tracking-tight">Cross-Signing Keys</p>
                          <p className="text-[10px] text-text-muted">Master key local availability</p>
                        </div>
                      </div>
                      <span className={cn("px-2 py-0.5 rounded text-[9px] font-black uppercase", e2eeStatus?.hasMasterKey ? "bg-green-500/10 text-green-400" : "bg-yellow-500/10 text-yellow-500")}>
                        {e2eeStatus?.hasMasterKey ? 'Restored' : 'Not Loaded'}
                      </span>
                    </div>

                    <div className="flex items-center justify-between py-2">
                      <div className="flex items-center space-x-3">
                        <Lock className={cn("h-4 w-4", e2eeStatus?.isBackupTrusted ? "text-green-500" : "text-red-400")} />
                        <div>
                          <p className="text-xs font-bold text-white uppercase tracking-tight">Message Backup</p>
                          <p className="text-[10px] text-text-muted">Remote key storage trust</p>
                        </div>
                      </div>
                      <span className={cn("px-2 py-0.5 rounded text-[9px] font-black uppercase", e2eeStatus?.isBackupTrusted ? "bg-green-500/10 text-green-400" : "bg-red-500/10 text-red-400")}>
                        {e2eeStatus?.isBackupTrusted ? 'Trusted' : 'Untrusted'}
                      </span>
                    </div>
                  </div>
                </section>

                <section>
                  <h2 className="mb-4 text-xs font-black uppercase text-text-muted tracking-widest">Security</h2>
                  <div className="rounded-xl bg-bg-nav p-6 border border-border-main/50">
                    <div className="flex items-center space-x-2 mb-6">
                      <Key className="h-4 w-4 text-accent-primary" />
                      <h3 className="text-sm font-bold text-white uppercase tracking-tighter">Change Password</h3>
                    </div>
                    <form onSubmit={handleChangePassword} className="space-y-4">
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <div className="md:col-span-2">
                          <label className="text-[10px] font-black uppercase text-text-muted tracking-widest block mb-1">Current Password</label>
                          <input
                            type="password"
                            value={currentPassword}
                            onChange={(e) => setCurrentPassword(e.target.value)}
                            className={cn(
                              "w-full rounded-lg bg-bg-sidebar px-4 py-2 text-sm text-text-main outline-none focus:ring-2 focus:ring-accent-primary/50 border transition-all",
                              passwordErrors.current ? "border-red-500/50" : "border-border-main"
                            )}
                          />
                          {passwordErrors.current && <p className="mt-1 text-[10px] text-red-400 font-bold tracking-tight">{passwordErrors.current}</p>}
                        </div>
                        <div>
                          <label className="text-[10px] font-black uppercase text-text-muted tracking-widest block mb-1">New Password</label>
                          <input
                            type="password"
                            value={newPassword}
                            onChange={(e) => setNewPassword(e.target.value)}
                            className={cn(
                              "w-full rounded-lg bg-bg-sidebar px-4 py-2 text-sm text-text-main outline-none focus:ring-2 focus:ring-accent-primary/50 border transition-all",
                              passwordErrors.new ? "border-red-500/50" : "border-border-main"
                            )}
                          />
                          {passwordErrors.new && <p className="mt-1 text-[10px] text-red-400 font-bold tracking-tight">{passwordErrors.new}</p>}
                        </div>
                        <div>
                          <label className="text-[10px] font-black uppercase text-text-muted tracking-widest block mb-1">Confirm New Password</label>
                          <input
                            type="password"
                            value={confirmPassword}
                            onChange={(e) => setConfirmPassword(e.target.value)}
                            className={cn(
                              "w-full rounded-lg bg-bg-sidebar px-4 py-2 text-sm text-text-main outline-none focus:ring-2 focus:ring-accent-primary/50 border transition-all",
                              passwordErrors.confirm ? "border-red-500/50" : "border-border-main"
                            )}
                          />
                          {passwordErrors.confirm && <p className="mt-1 text-[10px] text-red-400 font-bold tracking-tight">{passwordErrors.confirm}</p>}
                        </div>
                      </div>
                      <button
                        type="submit"
                        disabled={accountLoading || !currentPassword || !newPassword || !confirmPassword}
                        className="flex w-full items-center justify-center rounded-lg bg-accent-primary py-2.5 text-xs font-black text-bg-main transition hover:opacity-90 disabled:opacity-50 uppercase tracking-widest shadow-lg shadow-accent-primary/10"
                      >
                        {accountLoading && passwordStatus?.message?.includes('password') ? <Loader2 className="h-4 w-4 animate-spin text-bg-main" /> : 'Update Password'}
                      </button>
                    </form>
                    {passwordStatus && (
                      <div className={cn(
                        "mt-6 rounded-lg p-3 text-xs font-medium border animate-in fade-in duration-300",
                        passwordStatus.isError ? "bg-red-500/10 text-red-400 border-red-500/20" : 
                        passwordStatus.message?.includes('...') ? "bg-bg-sidebar text-text-muted border-border-main" :
                        "bg-green-500/10 text-green-400 border-green-500/20"
                      )}>
                        <div className="flex items-center space-x-2">
                          {passwordStatus.isError ? <AlertCircle className="h-4 w-4" /> : 
                           passwordStatus.message?.includes('...') ? <Loader2 className="h-3 w-3 animate-spin" /> :
                           <CheckCircle2 className="h-4 w-4" />}
                          <span>{passwordStatus.message}</span>
                        </div>
                      </div>
                    )}
                  </div>
                </section>
              </div>
            </div>
          )}

          {activeTab === 'security' && (
            <div className="animate-in fade-in slide-in-from-bottom-2 duration-300">
              <h1 className="mb-8 text-2xl font-bold text-text-main tracking-tight underline decoration-accent-primary decoration-4 underline-offset-8">Security & Privacy</h1>
              
              <div className="space-y-8">
                <section>
                  <h2 className="mb-4 text-xs font-black uppercase text-text-muted tracking-widest">E2EE Recovery</h2>
                  <div className="rounded-xl bg-bg-nav p-6 border border-border-main/50">
                    <p className="mb-4 text-sm text-text-muted">Enter your Security Key to restore your encrypted message history on this device.</p>
                    <form onSubmit={handleRecover} className="space-y-4">
                      <div className="relative">
                        <Lock className="absolute left-3 top-3 h-4 w-4 text-text-muted" />
                        <input
                          type="password"
                          value={recoveryKey}
                          onChange={(e) => setRecoveryKey(e.target.value)}
                          placeholder="Security Key (e.g. EsT2...)"
                          className="w-full rounded-lg bg-bg-sidebar py-2.5 pl-10 pr-4 text-sm text-text-main outline-none focus:ring-2 focus:ring-accent-primary/50 transition-all border border-border-main"
                        />
                      </div>
                      <button
                        type="submit"
                        disabled={loading || !recoveryKey.trim()}
                        className="flex w-full items-center justify-center rounded-lg bg-accent-primary py-2.5 text-sm font-black text-white transition hover:opacity-90 disabled:opacity-50 uppercase tracking-widest"
                      >
                        {loading ? 'Verifying...' : 'Restore History'}
                      </button>
                    </form>
                    {status && (
                      <div className={`mt-4 rounded-lg p-3 text-xs font-medium border ${status.startsWith('Error') ? 'bg-red-500/10 text-red-400 border-red-500/20' : 'bg-green-500/10 text-green-400 border-green-500/20'}`}>
                        {status}
                      </div>
                    )}
                  </div>
                </section>

                <section>
                  <h2 className="mb-4 text-xs font-black uppercase text-text-muted tracking-widest">Privacy Settings</h2>
                  <div className="space-y-3">
                    <div className="flex items-center justify-between rounded-xl bg-bg-nav p-4 border border-transparent hover:border-border-main transition">
                      <div>
                        <p className="text-sm font-bold text-text-main">URL Previews</p>
                        <p className="text-xs text-text-muted">Allow Reach to fetch metadata for links you send or receive</p>
                      </div>
                      <div 
                        onClick={() => setShowUrlPreviews(!showUrlPreviews)}
                        className={`h-5 w-10 rounded-full p-1 cursor-pointer transition-colors ${showUrlPreviews ? 'bg-accent-primary' : 'bg-bg-hover'}`}
                      >
                        <div className={`h-3 w-3 rounded-full bg-white transition-transform ${showUrlPreviews ? 'translate-x-5' : 'translate-x-0'}`} />
                      </div>
                    </div>

                    <div className="flex items-center justify-between rounded-xl bg-bg-nav p-4 border border-transparent hover:border-border-main transition">
                      <div>
                        <p className="text-sm font-bold text-text-main">Read Receipts</p>
                        <p className="text-xs text-text-muted">Let others know when you have read their messages</p>
                      </div>
                      <div 
                        onClick={() => setSendReadReceipts(!sendReadReceipts)}
                        className={`h-5 w-10 rounded-full p-1 cursor-pointer transition-colors ${sendReadReceipts ? 'bg-accent-primary' : 'bg-bg-hover'}`}
                      >
                        <div className={`h-3 w-3 rounded-full bg-white transition-transform ${sendReadReceipts ? 'translate-x-5' : 'translate-x-0'}`} />
                      </div>
                    </div>
                  </div>
                </section>
              </div>
            </div>
          )}

          {activeTab === 'notifications' && (
            <div className="animate-in fade-in slide-in-from-bottom-2 duration-300">
              <h1 className="mb-8 text-2xl font-bold text-text-main tracking-tight underline decoration-accent-primary decoration-4 underline-offset-8">Notifications</h1>
              
              <div className="space-y-8">
                <section>
                  <div className="flex items-center justify-between mb-4">
                    <h2 className="text-xs font-black uppercase text-text-muted tracking-widest">Global Settings</h2>
                    <button 
                      onClick={handleRequestPermission}
                      className="text-[10px] font-black uppercase text-accent-primary hover:underline"
                    >
                      Enable Desktop Notifications
                    </button>
                  </div>
                  <div className="space-y-3">
                    {[
                      { key: 'enabled', label: 'All Notifications', desc: 'Master switch for all notifications', icon: Bell },
                      { key: 'desktopEnabled', label: 'Desktop Notifications', desc: 'Show browser desktop alerts', icon: Monitor },
                      { key: 'soundEnabled', label: 'Sound', desc: 'Play a sound for new messages', icon: Volume2 },
                      { key: 'mentionsOnly', label: 'Mentions Only', desc: 'Only notify when you are mentioned', icon: AtSign }
                    ].map(item => (
                      <div key={item.key} className="flex items-center justify-between rounded-xl bg-bg-nav p-4 border border-transparent hover:border-border-main transition">
                        <div className="flex items-center space-x-4">
                          <div className="p-2 bg-bg-sidebar rounded-lg">
                            <item.icon className="h-4 w-4 text-accent-primary" />
                          </div>
                          <div>
                            <p className="text-sm font-bold text-text-main">{item.label}</p>
                            <p className="text-xs text-text-muted">{item.desc}</p>
                          </div>
                        </div>
                        <div 
                          onClick={() => setNotifSettings(s => ({ ...s, [item.key]: !s[item.key as keyof typeof s] }))}
                          className={`h-5 w-10 rounded-full p-1 cursor-pointer transition-colors ${notifSettings[item.key as keyof typeof notifSettings] ? 'bg-accent-primary' : 'bg-bg-hover'}`}
                        >
                          <div className={`h-3 w-3 rounded-full bg-white transition-transform ${notifSettings[item.key as keyof typeof notifSettings] ? 'translate-x-5' : 'translate-x-0'}`} />
                        </div>
                      </div>
                    ))}
                  </div>
                </section>

                <section>
                  <h2 className="mb-4 text-xs font-black uppercase text-text-muted tracking-widest">Status & DND</h2>
                  <div className="grid grid-cols-2 gap-3">
                    {[
                      { id: 'online', label: 'Online', color: 'bg-green-500' },
                      { id: 'idle', label: 'Idle', color: 'bg-yellow-500' },
                      { id: 'dnd', label: 'Do Not Disturb', color: 'bg-red-500', desc: 'Mutes all notifications' },
                      { id: 'invisible', label: 'Invisible', color: 'bg-gray-500' }
                    ].map(status => (
                      <button
                        key={status.id}
                        onClick={() => setUserPresence(status.id as 'online' | 'idle' | 'dnd' | 'invisible')}
                        className={`flex flex-col items-start p-3 rounded-xl border transition-all ${userPresence === status.id ? 'bg-accent-primary/10 border-accent-primary' : 'bg-bg-nav border-transparent hover:border-border-main'}`}
                      >
                        <div className="flex items-center space-x-2 mb-1">
                          <div className={`h-2.5 w-2.5 rounded-full ${status.color}`} />
                          <span className="text-xs font-bold text-white">{status.label}</span>
                        </div>
                        {status.desc && <p className="text-[10px] text-text-muted text-left">{status.desc}</p>}
                      </button>
                    ))}
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
              
              <div className="space-y-4">
                {sessionsLoading ? (
                  <div className="flex justify-center p-12">
                    <div className="h-8 w-8 animate-spin rounded-full border-2 border-accent-primary border-t-transparent" />
                  </div>
                ) : (
                  devices.map(device => (
                    <div key={device.device_id} className="flex items-center justify-between rounded-xl bg-bg-nav p-4 border border-border-main/30 group hover:border-border-main transition-colors shadow-sm">
                      <div className="flex items-center space-x-4">
                        <div className="p-2 bg-bg-sidebar rounded-lg">
                          <Monitor className="h-5 w-5 text-accent-primary" />
                        </div>
                        <div>
                          <p className="text-sm font-bold text-text-main">{device.display_name || 'Unknown Device'}</p>
                          <div className="flex items-center space-x-2">
                            <p className="text-[10px] font-mono text-text-muted">{device.device_id}</p>
                            {device.device_id === client?.getDeviceId() && (
                              <span className="rounded bg-accent-primary/10 px-1.5 py-0.5 text-[8px] font-black uppercase text-accent-primary">Current Session</span>
                            )}
                          </div>
                        </div>
                      </div>
                      <div className="text-right">
                        <p className="text-[10px] text-text-muted">Last seen: {device.last_seen_ts ? new Date(device.last_seen_ts).toLocaleDateString() : 'Never'}</p>
                        <p className="text-[10px] text-text-muted">{device.last_seen_ip || 'Hidden IP'}</p>
                      </div>
                    </div>
                  ))
                )}
              </div>
            </div>
          )}

          {activeTab === 'activity' && (
            <div className="animate-in fade-in slide-in-from-bottom-2 duration-300">
              <h1 className="mb-8 text-2xl font-bold text-text-main tracking-tight underline decoration-accent-primary decoration-4 underline-offset-8">Game Activity</h1>
              
              <div className="space-y-8">
                <section>
                  <h2 className="mb-4 text-xs font-black uppercase text-text-muted tracking-widest">Currently Detected</h2>
                  {detectedGame ? (
                    <div className="rounded-xl bg-accent-primary/5 p-6 border border-accent-primary/30">
                      <div className="flex items-center justify-between">
                        <div className="flex items-center space-x-4">
                          <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-accent-primary/10 text-accent-primary">
                            <Gamepad2 className="h-6 w-6" />
                          </div>
                          <div>
                            <h3 className="text-lg font-bold text-white uppercase tracking-tighter">
                              {customGameNames[detectedGame] || detectedGame}
                            </h3>
                            <p className="text-xs text-text-muted font-medium">Reach is currently displaying this as your status</p>
                          </div>
                        </div>
                        <div className="flex items-center space-x-2">
                          <button 
                            onClick={() => {
                              setEditingGame(detectedGame);
                              setEditName(customGameNames[detectedGame] || detectedGame);
                            }}
                            className="p-2 text-text-muted hover:text-white hover:bg-white/10 rounded-lg transition"
                          >
                            <Edit2 className="h-4 w-4" />
                          </button>
                        </div>
                      </div>
                    </div>
                  ) : (
                    <div className="rounded-xl bg-bg-nav p-8 border border-dashed border-border-main text-center">
                      <p className="text-sm text-text-muted font-medium italic">No active games detected from your system</p>
                    </div>
                  )}
                </section>

                <section>
                  <h2 className="mb-4 text-xs font-black uppercase text-text-muted tracking-widest">Running Processes</h2>
                  <div className="space-y-2">
                    {runningProcesses.slice(0, 10).map(proc => (
                      <div key={proc} className="flex items-center justify-between rounded-lg bg-bg-nav px-4 py-2 border border-transparent hover:border-border-main transition group">
                        <div className="flex items-center space-x-3">
                          <div className="h-1.5 w-1.5 rounded-full bg-text-muted group-hover:bg-accent-primary transition-colors" />
                          <span className="text-xs font-medium text-text-muted group-hover:text-text-main transition-colors">{proc}</span>
                        </div>
                        <button 
                          onClick={() => {
                            setEditingGame(proc);
                            setEditName(customGameNames[proc] || proc);
                          }}
                          className="opacity-0 group-hover:opacity-100 p-1 text-text-muted hover:text-white transition"
                        >
                          <Edit2 className="h-3.5 w-3.5" />
                        </button>
                      </div>
                    ))}
                  </div>
                </section>
              </div>

              {editingGame && (
                <div className="fixed inset-0 z-[110] flex items-center justify-center bg-black/60 backdrop-blur-md animate-in fade-in duration-200">
                  <div className="w-full max-w-sm rounded-2xl bg-bg-sidebar border border-border-main p-6 shadow-2xl animate-in zoom-in-95 duration-200">
                    <h2 className="mb-4 text-lg font-bold text-white uppercase tracking-tighter">Rename Game</h2>
                    <p className="mb-4 text-xs text-text-muted font-medium">How should <span className="text-accent-primary">{editingGame}</span> appear to others?</p>
                    <input
                      autoFocus
                      type="text"
                      value={editName}
                      onChange={(e) => setEditName(e.target.value)}
                      className="mb-6 w-full rounded-lg bg-bg-main px-4 py-2 text-sm text-white outline-none ring-1 ring-border-main focus:ring-accent-primary transition-all"
                    />
                    <div className="flex space-x-3">
                      <button 
                        onClick={() => setEditingGame(null)}
                        className="flex-1 rounded-lg px-4 py-2 text-xs font-bold text-text-muted hover:bg-white/5 transition uppercase tracking-widest"
                      >
                        Cancel
                      </button>
                      <button 
                        onClick={() => handleRenameGame(editingGame)}
                        className="flex-1 rounded-lg bg-accent-primary px-4 py-2 text-xs font-black text-white transition hover:opacity-90 uppercase tracking-widest shadow-lg shadow-accent-primary/20"
                      >
                        Save
                      </button>
                    </div>
                  </div>
                </div>
              )}
            </div>
          )}

          {activeTab === 'appearance' && (
            <div className="animate-in fade-in slide-in-from-bottom-2 duration-300">
              <h1 className="mb-8 text-2xl font-bold text-text-main tracking-tight underline decoration-accent-primary decoration-4 underline-offset-8">Appearance</h1>
              
              <div className="space-y-8">
                <section>
                  <h2 className="mb-4 text-xs font-black uppercase text-text-muted tracking-widest">Dark Presets</h2>
                  <div className="grid grid-cols-3 gap-3">
                    {(['oled', 'classic', 'slate'] as const).map((preset) => (
                      <button
                        key={preset}
                        onClick={() => setThemeConfig({ activePreset: preset, colors: THEME_PRESETS[preset] })}
                        className={`group relative overflow-hidden rounded-xl border p-4 text-left transition-all ${themeConfig.activePreset === preset ? 'border-accent-primary ring-1 ring-accent-primary shadow-lg shadow-accent-primary/10' : 'border-border-main hover:border-text-muted hover:bg-white/5'}`}
                      >
                        <div className="flex items-center justify-between">
                          <span className={`text-[10px] font-black uppercase tracking-tighter ${themeConfig.activePreset === preset ? 'text-accent-primary' : 'text-text-main'}`}>
                            {preset}
                          </span>
                          {themeConfig.activePreset === preset && <CheckCircle2 className="h-3 w-3 text-accent-primary" />}
                        </div>
                        <div className="mt-2 flex space-x-1">
                          <div className="h-2.5 w-2.5 rounded-full border border-white/10" style={{ backgroundColor: THEME_PRESETS[preset]['bg-main'] }} />
                          <div className="h-2.5 w-2.5 rounded-full border border-white/10" style={{ backgroundColor: THEME_PRESETS[preset]['accent-primary'] }} />
                        </div>
                      </button>
                    ))}
                  </div>
                </section>

                <section>
                  <h2 className="mb-4 text-xs font-black uppercase text-text-muted tracking-widest">Light Presets</h2>
                  <div className="grid grid-cols-3 gap-3">
                    {(['icebox'] as const).map((preset) => (
                      <button
                        key={preset}
                        onClick={() => setThemeConfig({ activePreset: preset, colors: THEME_PRESETS[preset] })}
                        className={`group relative overflow-hidden rounded-xl border p-4 text-left transition-all ${themeConfig.activePreset === preset ? 'border-accent-primary ring-1 ring-accent-primary shadow-lg shadow-accent-primary/10' : 'border-border-main hover:border-text-muted hover:bg-white/5'}`}
                      >
                        <div className="flex items-center justify-between">
                          <span className={`text-[10px] font-black uppercase tracking-tighter ${themeConfig.activePreset === preset ? 'text-accent-primary' : 'text-text-main'}`}>
                            {preset}
                          </span>
                          {themeConfig.activePreset === preset && <CheckCircle2 className="h-3 w-3 text-accent-primary" />}
                        </div>
                        <div className="mt-2 flex space-x-1">
                          <div className="h-2.5 w-2.5 rounded-full border border-black/10" style={{ backgroundColor: THEME_PRESETS[preset]['bg-main'] }} />
                          <div className="h-2.5 w-2.5 rounded-full border border-black/10" style={{ backgroundColor: THEME_PRESETS[preset]['accent-primary'] }} />
                        </div>
                      </button>
                    ))}
                  </div>
                </section>

                <section>
                  <h2 className="mb-4 text-xs font-black uppercase text-text-muted tracking-widest">Accessibility Presets</h2>
                  <div className="grid grid-cols-2 gap-3">
                    {(['protanopia', 'deuteranopia', 'tritanopia', 'protanopia-light', 'deuteranopia-light', 'tritanopia-light', 'high-contrast-light'] as const).map((preset) => (
                      <button
                        key={preset}
                        onClick={() => setThemeConfig({ activePreset: preset, colors: THEME_PRESETS[preset] })}
                        className={`group relative overflow-hidden rounded-xl border p-3 text-left transition-all ${themeConfig.activePreset === preset ? 'border-accent-primary ring-1 ring-accent-primary shadow-lg shadow-accent-primary/10' : 'border-border-main hover:border-text-muted hover:bg-white/5'}`}
                      >
                        <div className="flex items-center justify-between">
                          <span className={`text-[9px] font-black uppercase tracking-tighter ${themeConfig.activePreset === preset ? 'text-accent-primary' : 'text-text-main'}`}>
                            {preset.replace('-', ' ')}
                          </span>
                          {themeConfig.activePreset === preset && <CheckCircle2 className="h-3 w-3 text-accent-primary" />}
                        </div>
                        <div className="mt-2 flex space-x-1">
                          <div className="h-2.5 w-2.5 rounded-full border border-black/10" style={{ backgroundColor: THEME_PRESETS[preset]['bg-main'] }} />
                          <div className="h-2.5 w-2.5 rounded-full border border-black/10" style={{ backgroundColor: THEME_PRESETS[preset]['accent-primary'] }} />
                        </div>
                      </button>
                    ))}
                  </div>
                </section>

                <section>
                  <h2 className="mb-4 text-xs font-black uppercase text-text-muted tracking-widest">Advanced Styling</h2>
                  <div className="rounded-xl bg-bg-nav p-6 border border-border-main/50">
                    <div className="flex items-center space-x-2 mb-4">
                      <Code className="h-4 w-4 text-accent-primary" />
                      <h3 className="text-sm font-bold text-white uppercase tracking-tighter">Custom CSS</h3>
                    </div>
                    <textarea
                      value={themeConfig.customCSS}
                      onChange={(e) => setThemeConfig({ customCSS: e.target.value })}
                      placeholder="/* Add your custom CSS here... */"
                      className="h-32 w-full rounded-lg bg-bg-sidebar p-4 font-mono text-xs text-text-main outline-none ring-1 ring-border-main focus:ring-accent-primary transition-all"
                    />
                    <p className="mt-2 text-[10px] text-text-muted italic">Warning: Custom CSS can break the application layout. Use with caution.</p>
                  </div>
                </section>
              </div>
            </div>
          )}

          {activeTab === 'data' && (
            <div className="animate-in fade-in slide-in-from-bottom-2 duration-300">
              <h1 className="mb-8 text-2xl font-bold text-text-main tracking-tight underline decoration-accent-primary decoration-4 underline-offset-8">Data Portability</h1>
              
              <div className="space-y-8">
                <section>
                  <h2 className="mb-4 text-xs font-black uppercase text-text-muted tracking-widest">Room Configuration Backup</h2>
                  <div className="rounded-xl bg-bg-nav p-6 border border-border-main/50">
                    <p className="mb-6 text-sm text-text-muted">Back up or restore your custom room categories and sidebar organization. This data is local to your browser and not stored on the Matrix homeserver.</p>
                    
                    <div className="grid grid-cols-2 gap-4">
                      <button
                        onClick={handleExportSections}
                        className="flex items-center justify-center rounded-lg bg-bg-sidebar border border-border-main py-4 text-xs font-black text-white transition hover:bg-bg-hover uppercase tracking-widest"
                      >
                        <Download className="mr-2 h-5 w-5 text-accent-primary" />
                        Export Sections (.json)
                      </button>
                      
                      <div className="relative">
                        <button
                          onClick={() => document.getElementById('import-sections-input')?.click()}
                          className="w-full flex items-center justify-center rounded-lg bg-bg-sidebar border border-border-main py-4 text-xs font-black text-white transition hover:bg-bg-hover uppercase tracking-widest"
                        >
                          <Upload className="mr-2 h-5 w-5 text-accent-primary" />
                          Import Sections (.json)
                        </button>
                        <input 
                          id="import-sections-input"
                          type="file" 
                          accept=".json"
                          className="hidden" 
                          onChange={handleImportSections}
                        />
                      </div>
                    </div>

                    {importStatus && (
                      <div className={cn(
                        "mt-6 rounded-xl p-4 text-xs font-medium border animate-in fade-in duration-300 shadow-lg",
                        importStatus.isError ? "bg-red-500/10 text-red-400 border-red-500/20" : "bg-green-500/10 text-green-400 border-green-500/20"
                      )}>
                        <div className="flex items-center space-x-3">
                          {importStatus.isError ? <AlertCircle className="h-5 w-5" /> : <CheckCircle2 className="h-5 w-5" />}
                          <span className="text-sm font-bold">{importStatus.message}</span>
                        </div>
                      </div>
                    )}
                  </div>
                </section>
                
                <section>
                  <h2 className="mb-4 text-xs font-black uppercase text-text-muted tracking-widest">Usage Information</h2>
                  <div className="rounded-xl bg-accent-primary/5 p-6 border border-accent-primary/20">
                    <ul className="list-disc list-inside space-y-2 text-xs text-text-muted leading-relaxed">
                      <li>Exporting creates a JSON file containing all your room assignments and category names.</li>
                      <li>Importing will <span className="text-accent-primary font-bold">overwrite</span> your current sidebar organization.</li>
                      <li>This backup does <span className="text-white font-bold">not</span> include your message history or encryption keys. Use the "Security" tab for E2EE backups.</li>
                    </ul>
                  </div>
                </section>
              </div>
            </div>
          )}

          {activeTab === 'support' && (
            <div className="animate-in fade-in slide-in-from-bottom-2 duration-300">
              <h1 className="mb-8 text-2xl font-bold text-text-main tracking-tight underline decoration-accent-primary decoration-4 underline-offset-8">Support & Logs</h1>
              
              <div className="space-y-8">
                <section>
                  <h2 className="mb-4 text-xs font-black uppercase text-text-muted tracking-widest">Debug Logging</h2>
                  <div className="rounded-xl bg-bg-nav p-6 border border-border-main/50">
                    <div className="flex items-center space-x-4 mb-6">
                      <div className="p-3 bg-accent-primary/10 rounded-xl">
                        <FileText className="h-6 w-6 text-accent-primary" />
                      </div>
                      <div>
                        <h3 className="text-sm font-bold text-white uppercase tracking-tighter">Client Logs</h3>
                        <p className="text-xs text-text-muted">Download your recent application logs to help diagnose issues. Sensitive data is automatically redacted.</p>
                      </div>
                    </div>
                    <button
                      onClick={() => reachLogger.downloadLogs()}
                      className="flex w-full items-center justify-center rounded-lg bg-bg-sidebar border border-border-main py-2.5 text-xs font-black text-white transition hover:bg-bg-hover uppercase tracking-widest"
                    >
                      <FileText className="mr-2 h-4 w-4" />
                      Download Logs (.txt)
                    </button>
                  </div>
                </section>

                <section>
                  <h2 className="mb-4 text-xs font-black uppercase text-text-muted tracking-widest">Reporting Issues</h2>
                  <div className="grid grid-cols-1 gap-4">
                    <a 
                      href="https://github.com/xahors/reach/issues/new?template=bug_report.md" 
                      target="_blank" 
                      rel="noopener noreferrer"
                      className="flex items-center justify-between rounded-xl bg-bg-nav p-6 border border-border-main/30 group hover:border-accent-primary transition-all shadow-sm"
                    >
                      <div className="flex items-center space-x-4">
                        <div className="p-3 bg-bg-sidebar rounded-xl group-hover:bg-accent-primary/10 transition-colors">
                          <GitBranch className="h-6 w-6 text-white group-hover:text-accent-primary" />
                        </div>
                        <div>
                          <p className="text-sm font-bold text-text-main uppercase tracking-tighter">Open GitHub Issue</p>
                          <p className="text-xs text-text-muted">Submit a bug report or feature request directly to our repository.</p>
                        </div>
                      </div>
                      <AlertCircle className="h-5 w-5 text-text-muted group-hover:text-accent-primary transition-colors" />
                    </a>
                  </div>
                </section>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default SettingsModal;
