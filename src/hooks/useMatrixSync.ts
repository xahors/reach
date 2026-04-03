import { useEffect, useState } from 'react';
import { ClientEvent } from 'matrix-js-sdk';
import { useMatrixClient } from './useMatrixClient';
import { useAppStore } from '../store/useAppStore';

export const useMatrixSync = () => {
  const client = useMatrixClient();
  const { isLoggedIn, isSynced, setSynced } = useAppStore();
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
      
      if (state === 'PREPARED' || state === 'SYNCING') {
        if (!isSynced) {
          Promise.resolve().then(() => setSynced(true));
        }
      }
    };

    client.on(ClientEvent.Sync, onSync);
    
    // Check initial state - but only if it changed since component render
    const currentState = client.getSyncState();
    if (currentState && currentState !== syncState) {
        onSync(currentState);
    }

    return () => {
      client.removeListener(ClientEvent.Sync, onSync);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [client, isLoggedIn, setSynced]);

  return { isSynced, syncState };
};
