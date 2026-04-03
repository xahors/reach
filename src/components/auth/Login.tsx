import React, { useState } from 'react';
import { matrixService } from '../../core/matrix';
import { useAppStore } from '../../store/useAppStore';
import { callManager } from '../../core/callManager';

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
      setLoggedIn(true, client.getUserId());
      callManager.init();
    } catch (err: any) {
      setError(err.message || 'Login failed. Please check your credentials.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="flex min-h-screen items-center justify-center bg-discord-nav p-4">
      <div className="w-full max-w-[480px] rounded-lg bg-discord-sidebar p-8 shadow-lg">
        <h1 className="mb-2 text-center text-2xl font-bold text-white">Welcome back!</h1>
        <p className="mb-6 text-center text-discord-text-muted">We're so excited to see you again!</p>

        <form onSubmit={handleLogin} className="space-y-4">
          <div>
            <label className="mb-2 block text-xs font-bold uppercase text-discord-text-muted">
              Homeserver
            </label>
            <input
              type="text"
              value={homeserver}
              onChange={(e) => setHomeserver(e.target.value)}
              className="w-full rounded bg-discord-nav p-2.5 text-discord-text outline-none focus:ring-1 focus:ring-discord-accent"
              required
            />
          </div>

          <div>
            <label className="mb-2 block text-xs font-bold uppercase text-discord-text-muted">
              Username
            </label>
            <input
              type="text"
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              className="w-full rounded bg-discord-nav p-2.5 text-discord-text outline-none focus:ring-1 focus:ring-discord-accent"
              required
            />
          </div>

          <div>
            <label className="mb-2 block text-xs font-bold uppercase text-discord-text-muted">
              Password
            </label>
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="w-full rounded bg-discord-nav p-2.5 text-discord-text outline-none focus:ring-1 focus:ring-discord-accent"
              required
            />
          </div>

          {error && <p className="text-sm text-red-500">{error}</p>}

          <button
            type="submit"
            disabled={loading}
            className="w-full rounded bg-discord-accent p-2.5 font-bold text-white transition hover:bg-opacity-90 disabled:cursor-not-allowed disabled:bg-opacity-50"
          >
            {loading ? 'Logging in...' : 'Log In'}
          </button>
        </form>
      </div>
    </div>
  );
};

export default Login;
