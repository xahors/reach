import { useEffect, useState, Component, type ReactNode } from 'react';
import { matrixService } from './core/matrix';
import { useAppStore } from './store/useAppStore';
import Login from './components/auth/Login';
import { useMatrixSync } from './hooks/useMatrixSync';
import { callManager } from './core/callManager';

import Sidebar from './components/layout/Sidebar';
import ChannelList from './components/layout/ChannelList';
import ChatArea from './components/chat/ChatArea';
import SecurityRecovery from './components/auth/SecurityRecovery';
import ActiveCall from './components/calls/ActiveCall';
import SettingsModal from './components/ui/SettingsModal';
import ThemeManager from './components/ui/ThemeManager';

class ErrorBoundary extends Component<{ children: ReactNode }, { hasError: boolean }> {
  constructor(props: { children: ReactNode }) {
    super(props);
    this.state = { hasError: false };
  }

  static getDerivedStateFromError() {
    return { hasError: true };
  }

  render() {
    if (this.state.hasError) {
      return (
        <div className="flex h-screen flex-col items-center justify-center bg-discord-nav text-white p-4 text-center">
          <h1 className="text-2xl font-bold mb-4">Something went wrong.</h1>
          <p className="text-discord-text-muted mb-6">Reach encountered an unexpected error. Try refreshing the page.</p>
          <button
            onClick={() => window.location.reload()}
            className="rounded bg-discord-accent px-6 py-2 font-bold hover:bg-opacity-90"
          >
            Refresh Reach
          </button>
        </div>
      );
    }
    return this.props.children;
  }
}

function MainApp() {
  const { isSynced, syncState } = useMatrixSync();
  const { activeRoomId, setChannelDetailsOpen, callWindowingMode } = useAppStore();
  const [showRetry, setShowRetry] = useState(false);

  useEffect(() => {
    const timer = setTimeout(() => setShowRetry(true), 10000);
    return () => clearTimeout(timer);
  }, [isSynced]);

  // Close channel details when switching rooms
  useEffect(() => {
    setChannelDetailsOpen(false);
  }, [activeRoomId, setChannelDetailsOpen]);

  if (!isSynced) {
    return (
      <div className="flex h-screen items-center justify-center bg-discord-nav text-white">
        <div className="text-center">
          <div className="mb-4 h-12 w-12 animate-spin rounded-full border-4 border-discord-accent border-t-transparent mx-auto"></div>
          <p className="text-discord-text-muted font-medium">Synchronizing with Matrix...</p>
          <p className="text-xs text-discord-text-muted/60 mt-2 font-mono uppercase tracking-widest">{syncState || 'INITIALIZING'}</p>
          
          {showRetry && (
            <div className="mt-8 animate-in fade-in slide-in-from-bottom-4 duration-1000">
              <p className="text-xs text-discord-text-muted mb-4 max-w-xs mx-auto">Taking longer than usual? Your network might be slow, or the session needs a restart.</p>
              <button 
                onClick={() => window.location.reload()}
                className="rounded bg-discord-hover px-4 py-2 text-xs font-bold text-white transition hover:bg-discord-accent"
              >
                RELOAD APPLICATION
              </button>
            </div>
          )}
        </div>
      </div>
    );
  }

  return (
    <div className="flex h-screen overflow-hidden bg-bg-main relative">
      <ThemeManager />
      <Sidebar />
      <ChannelList />
      <ChatArea />
      <SecurityRecovery />
      {callWindowingMode !== 'integrated' && <ActiveCall />}
      <SettingsModal />
    </div>
  );
}

function App() {
  const { isLoggedIn, setLoggedIn } = useAppStore();
  const [initializing, setInitializing] = useState(true);

  useEffect(() => {
    const initMatrix = async () => {
      // Safety timeout to not hang forever if sync is slow
      const timeout = setTimeout(() => {
        setInitializing(false);
      }, 8000);

      try {
        const existingClient = matrixService.getClient();
        if (existingClient) {
          console.log('Client already exists, reconnecting...');
          await matrixService.reconnect();
          setLoggedIn(true, existingClient.getUserId());
          callManager.init();
        } else {
          const client = await matrixService.loginWithStoredToken();
          if (client) {
            setLoggedIn(true, client.getUserId());
            callManager.init();
          }
        }
      } catch (error) {
        console.error('Failed to initialize Matrix client:', error);
      } finally {
        clearTimeout(timeout);
        setInitializing(false);
      }
    };

    initMatrix();

    return () => {
      // In development HMR or when unmounting, stop the old client sync loop
      // but keep the client instance alive for the next mount
      matrixService.stop(false);
    };
  }, [setLoggedIn]);

  if (initializing) {
    return (
      <div className="flex h-screen items-center justify-center bg-discord-nav text-white">
        <div className="text-center">
          <div className="mb-4 h-12 w-12 animate-spin rounded-full border-4 border-discord-accent border-t-transparent mx-auto"></div>
          <p className="text-discord-text-muted">Starting Reach...</p>
        </div>
      </div>
    );
  }

  if (!isLoggedIn) {
    return <Login />;
  }

  return (
    <ErrorBoundary>
      <MainApp />
    </ErrorBoundary>
  );
}

export default App;
