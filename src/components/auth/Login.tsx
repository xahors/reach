import React, { useState } from 'react';
import { matrixService } from '../../core/matrix';
import { useAppStore } from '../../store/useAppStore';
import { callManager } from '../../core/callManager';
import { LogIn, Loader2, Globe, User, Lock, MessageSquare } from 'lucide-react';

const Login: React.FC = () => {
  const [homeserver, setHomeserver] = useState('https://matrix.org');
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const setLoggedIn = useAppStore((state) => state.setLoggedIn);

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setLoading(true);

    try {
      const client = await matrixService.login(homeserver, username, password);
      if (client) {
        setLoggedIn(true, client.getUserId());
        callManager.init();
      }
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Login failed. Please check your credentials.';
      setError(message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="flex min-h-screen items-center justify-center bg-bg-main p-4 font-mono">
      <div className="w-full max-w-md animate-in fade-in zoom-in duration-500">
        <div className="mb-10 text-center">
          <div className="mb-4 inline-flex h-20 w-20 items-center justify-center rounded-full bg-accent-primary/10 border border-accent-primary/20 shadow-[0_0_30px_rgba(255,255,255,0.05)]">
            <MessageSquare className="h-10 w-10 text-accent-primary" />
          </div>
          <h1 className="text-4xl font-black tracking-tighter text-white uppercase italic">Reach</h1>
          <p className="mt-2 text-xs font-bold uppercase tracking-widest text-text-muted opacity-60">High-Performance Matrix Client</p>
        </div>

        <div className="rounded-2xl border border-border-main bg-bg-nav/30 p-8 shadow-2xl backdrop-blur-sm">
          <form onSubmit={handleLogin} className="space-y-6">
            <div className="space-y-2">
              <label className="flex items-center text-[10px] font-black uppercase tracking-widest text-text-muted">
                <Globe className="mr-2 h-3 w-3" />
                Homeserver
              </label>
              <input
                type="text"
                value={homeserver}
                onChange={(e) => setHomeserver(e.target.value)}
                className="w-full rounded-xl bg-bg-main px-4 py-3 text-sm text-white outline-none border border-border-main focus:border-accent-primary transition-all duration-200"
                placeholder="https://matrix.org"
                required
              />
            </div>

            <div className="space-y-2">
              <label className="flex items-center text-[10px] font-black uppercase tracking-widest text-text-muted">
                <User className="mr-2 h-3 w-3" />
                Username
              </label>
              <input
                type="text"
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                className="w-full rounded-xl bg-bg-main px-4 py-3 text-sm text-white outline-none border border-border-main focus:border-accent-primary transition-all duration-200"
                placeholder="user"
                required
              />
            </div>

            <div className="space-y-2">
              <label className="flex items-center text-[10px] font-black uppercase tracking-widest text-text-muted">
                <Lock className="mr-2 h-3 w-3" />
                Password
              </label>
              <input
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="w-full rounded-xl bg-bg-main px-4 py-3 text-sm text-white outline-none border border-border-main focus:border-accent-primary transition-all duration-200"
                placeholder="••••••••"
                required
              />
            </div>

            {error && (
              <div className="rounded-lg bg-red-500/10 border border-red-500/20 p-3 text-center text-xs font-bold text-red-400 animate-in shake duration-300">
                {error}
              </div>
            )}

            <button
              type="submit"
              disabled={loading}
              className="flex w-full items-center justify-center rounded-xl bg-accent-primary py-4 text-sm font-black uppercase tracking-widest text-bg-main transition-all hover:opacity-90 active:scale-[0.98] disabled:opacity-50"
            >
              {loading ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Authenticating...
                </>
              ) : (
                <>
                  <LogIn className="mr-2 h-4 w-4" />
                  Sign In
                </>
              )}
            </button>
          </form>
        </div>
        
        <p className="mt-8 text-center text-[10px] text-text-muted font-bold uppercase tracking-tighter opacity-40">
          Reach uses End-to-End Encryption by default.
        </p>
      </div>
    </div>
  );
};

export default Login;
