import { useEffect, useState } from 'react';
import { ClientEvent, type MatrixEvent, type User } from 'matrix-js-sdk';
import { useMatrixClient } from './useMatrixClient';
import { useAppStore, type PresenceState } from '../store/useAppStore';
import { matrixService } from '../core/matrix';

export const useMatrixSync = () => {
  const client = useMatrixClient();
  const { isLoggedIn, isSynced, setSynced, setGlobalUserPresence } = useAppStore();
  const [syncState, setSyncState] = useState<string | null>(() => {
    return (isLoggedIn && client) ? client.getSyncState() : null;
  });

  useEffect(() => {
    if (!client || !isLoggedIn) {
      if (isSynced) {
        Promise.resolve().then(() => setSynced(false));
      }
      return;
    }

    const onSync = (state: string) => {
      // Only update if state actually changed to avoid cycles
      setSyncState((prev) => {
        if (prev === state) return prev;
        return state;
      });
      
      // PREPARED means IndexedDB is loaded
      // SYNCING means HTTP sync is active
      // RECONNECTING means network hiccup but we have data
      if (state === 'PREPARED' || state === 'SYNCING' || state === 'RECONNECTING') {
        if (!isSynced) {
          // Use a small timeout to avoid setState during sync event emit
          setTimeout(() => setSynced(true), 0);
        }

        if (state === 'SYNCING') {
          // Proactively try to decrypt old messages
          matrixService.retryDecryption();
        }
      } else if (state === 'ERROR' || state === 'STOPPED') {
        // Don't immediately unsync on error, only if it persists
      }
    };

    const onPresence = (_event: MatrixEvent, user: User) => {
      setGlobalUserPresence(user.userId, (user.presence || 'offline') as PresenceState);
    };

    client.on(ClientEvent.Sync, onSync);
    // @ts-expect-error - Newer SDK feature
    client.on('presence', onPresence);
    
    // Check initial state - but only if it changed since component render
    const currentState = client.getSyncState();
    if (currentState && currentState !== syncState) {
        onSync(currentState);
    }

    return () => {
      client.removeListener(ClientEvent.Sync, onSync);
      // @ts-expect-error - Newer SDK feature
      client.removeListener('presence', onPresence);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [client, isLoggedIn, setSynced, setGlobalUserPresence]);

  return { isSynced, syncState };
};
