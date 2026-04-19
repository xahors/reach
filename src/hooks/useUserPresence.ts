import { useEffect, useState, useCallback } from 'react';
import { User, MatrixEvent } from 'matrix-js-sdk';
import { useMatrixClient } from './useMatrixClient';

export type PresenceState = 'online' | 'offline' | 'unavailable' | 'unknown';

export const useUserPresence = (userId: string | null) => {
  const client = useMatrixClient();
  const [presence, setPresence] = useState<PresenceState>('unknown');
  const [lastActiveAgo, setLastActiveAgo] = useState<number | null>(null);
  const [avatarUrl, setAvatarUrl] = useState<string | null>(null);
  const [displayName, setDisplayName] = useState<string | null>(null);

  const updatePresence = useCallback(() => {
    if (!client || !userId) return;

    const user = client.getUser(userId);
    if (user) {
      setPresence(user.presence as PresenceState || 'unknown');
      setLastActiveAgo(user.lastActiveAgo);
      setAvatarUrl(user.avatarUrl || null);
      setDisplayName(user.displayName || null);
    }
  }, [client, userId]);

  useEffect(() => {
    if (!client || !userId) return;

    // Use a small timeout to avoid setState during effect body
    const timeout = setTimeout(() => updatePresence(), 0);

    const onPresence = (_event: MatrixEvent, user: User) => {
      if (user.userId === userId) {
        setPresence(user.presence as PresenceState || 'unknown');
        setLastActiveAgo(user.lastActiveAgo);
        setAvatarUrl(user.avatarUrl || null);
        setDisplayName(user.displayName || null);
      }
    };

    // Presence events are emitted on the client
    // @ts-expect-error: presence is a valid event but might not be in all d.ts
    client.on('presence', onPresence);

    return () => {
      clearTimeout(timeout);
      // @ts-expect-error: presence is a valid event but might not be in all d.ts
      client.removeListener('presence', onPresence);
    };
  }, [client, userId, updatePresence]);

  return { presence, lastActiveAgo, avatarUrl, displayName };
};
