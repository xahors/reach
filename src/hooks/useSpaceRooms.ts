import { useEffect, useState, useCallback } from 'react';
import { Room, ClientEvent, RoomEvent, RoomStateEvent } from 'matrix-js-sdk';
import { useMatrixClient } from './useMatrixClient';

export const useSpaceRooms = (spaceId: string | null) => {
  const client = useMatrixClient();
  const [rooms, setRooms] = useState<Room[]>([]);
  const [loading, setLoading] = useState(false);

  const updateRooms = useCallback(() => {
    if (!client || !spaceId) {
      setTimeout(() => {
        setRooms([]);
        setLoading(false);
      }, 0);
      return;
    }

    try {
      const space = client.getRoom(spaceId);
      if (!space) {
        setTimeout(() => setLoading(false), 0);
        return;
      }

      // Get children of the space
      const childrenEvents = space.currentState.getStateEvents('m.space.child');
      if (!childrenEvents) {
        setTimeout(() => {
          setRooms([]);
          setLoading(false);
        }, 0);
        return;
      }

      const childRoomIds = childrenEvents
        .filter((event) => event.getContent()?.via)
        .map((event) => event.getStateKey())
        .filter(Boolean);

      const spaceRooms = childRoomIds
        .map((id) => id ? client.getRoom(id!) : null)
        .filter((room): room is Room => room !== null);

      setTimeout(() => {
        setRooms(spaceRooms);
        setLoading(false);
      }, 0);
    } catch (err) {
      console.error("Error updating space rooms:", err);
      setTimeout(() => setLoading(false), 0);
    }
  }, [client, spaceId]);

  useEffect(() => {
    if (!client || !spaceId) {
      Promise.resolve().then(() => {
        setRooms([]);
        setLoading(false);
      });
      return;
    }

    // Use a small timeout to avoid setState during effect body
    const initialLoadTimeout = setTimeout(() => {
      setLoading(true);
      updateRooms();
    }, 0);

    const onSync = (state: string) => {
      if (state === 'PREPARED' || state === 'SYNCING') {
        updateRooms();
      }
    };

    client.on(ClientEvent.Sync, onSync);
    client.on(RoomStateEvent.Events, updateRooms);
    client.on(RoomEvent.MyMembership, updateRooms);

    return () => {
      clearTimeout(initialLoadTimeout);
      client.removeListener(ClientEvent.Sync, onSync);
      client.removeListener(RoomStateEvent.Events, updateRooms);
      client.removeListener(RoomEvent.MyMembership, updateRooms);
    };
  }, [client, spaceId, updateRooms]);

  return { rooms, loading };
};
