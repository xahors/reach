import { useEffect, useState, useCallback } from 'react';
import { useMatrixClient } from './useMatrixClient';
import { useAppStore } from '../store/useAppStore';

export type PresenceState = 'online' | 'offline' | 'unavailable' | 'unknown';

export const useUserPresence = (userId: string | null) => {
  const client = useMatrixClient();
  const globalPresence = useAppStore(state => userId ? (state.userPresenceRecord as Record<string, string>)[userId] : 'offline');
  const [lastActiveAgo, setLastActiveAgo] = useState<number | null>(null);
  const [avatarUrl, setAvatarUrl] = useState<string | null>(null);
  const [displayName, setDisplayName] = useState<string | null>(null);

  const updateProfile = useCallback(() => {
    if (!client || !userId) return;

    const user = client.getUser(userId);
    if (user) {
      setLastActiveAgo(user.lastActiveAgo);
      setAvatarUrl(user.avatarUrl || null);
      setDisplayName(user.displayName || null);
    }
  }, [client, userId]);

  useEffect(() => {
    if (!client || !userId) return;
    // Use a microtask to avoid cascading renders while staying fast
    Promise.resolve().then(() => updateProfile());
  }, [client, userId, updateProfile]);

  return { presence: globalPresence, lastActiveAgo, avatarUrl, displayName };
};
