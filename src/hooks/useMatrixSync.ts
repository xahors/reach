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
    if (!isLoggedIn || !client) {
      if (isSynced) Promise.resolve().then(() => setSynced(false));
      if (syncState !== null) Promise.resolve().then(() => setSyncState(null));
      return;
    }

    const onSync = (state: string) => {
      setSyncState(state);
      if (state === 'PREPARED' || state === 'SYNCING') {
        setSynced(true);
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
  }, [client, isLoggedIn, setSynced, syncState]);

  return { isSynced, syncState };
};
