import { useEffect, useState, useCallback } from 'react';
import { Room, ClientEvent, RoomEvent } from 'matrix-js-sdk';
import { useMatrixClient } from './useMatrixClient';

export const useSpaces = () => {
  const client = useMatrixClient();
  const [spaces, setSpaces] = useState<Room[]>([]);
  const [loading, setLoading] = useState(true);

  const updateSpaces = useCallback(() => {
    if (!client) return;
    const rooms = client.getRooms();
    const spaceRooms = rooms.filter((room) => {
      try {
        const isSpace = room.isSpaceRoom();
        return isSpace && room.getMyMembership() === 'join';
      } catch {
        return false;
      }
    });
    Promise.resolve().then(() => {
      setSpaces(spaceRooms);
      setLoading(false);
    });
  }, [client]);

  useEffect(() => {
    if (!client) return;

    // Initial load
    const timeout = setTimeout(() => updateSpaces(), 0);

    // Listen for room changes
    const onSync = (state: string) => {
      if (state === 'PREPARED' || state === 'SYNCING') {
        Promise.resolve().then(() => updateSpaces());
      }
    };

    client.on(ClientEvent.Sync, onSync);
    client.on(ClientEvent.Room, updateSpaces);
    client.on(RoomEvent.MyMembership, updateSpaces);

    return () => {
      clearTimeout(timeout);
      client.removeListener(ClientEvent.Sync, onSync);
      client.removeListener(ClientEvent.Room, updateSpaces);
      client.removeListener(RoomEvent.MyMembership, updateSpaces);
    };
  }, [client, updateSpaces]);

  return { spaces, loading };
};
