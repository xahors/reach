import { useEffect, useState, useCallback } from 'react';
import { Room, ClientEvent, RoomEvent, RoomStateEvent } from 'matrix-js-sdk';
import { useMatrixClient } from './useMatrixClient';

export const useSpaceRooms = (spaceId: string | null) => {
  const client = useMatrixClient();
  const [rooms, setRooms] = useState<Room[]>([]);
  const [loading, setLoading] = useState(false);

  const updateRooms = useCallback(() => {
    if (!client || !spaceId) {
      Promise.resolve().then(() => setRooms([]));
      return;
    }

    const space = client.getRoom(spaceId);
    if (!space) return;

    // Get children of the space
    const childrenEvents = space.currentState.getStateEvents('m.space.child');
    if (!Array.isArray(childrenEvents)) {
      Promise.resolve().then(() => setRooms([]));
      setLoading(false);
      return;
    }

    const childRoomIds = childrenEvents
      .filter((event) => event.getContent().via)
      .map((event) => event.getStateKey());

    const spaceRooms = childRoomIds
      .map((id) => client.getRoom(id))
      .filter((room): room is Room => room !== null);

    setRooms(spaceRooms);
    setLoading(false);
  }, [client, spaceId]);

  useEffect(() => {
    if (!client || !spaceId) {
      setRooms([]);
      return;
    }

    setLoading(true);
    updateRooms();

    const onSync = (state: string) => {
      if (state === 'PREPARED' || state === 'SYNCING') {
        updateRooms();
      }
    };

    client.on(ClientEvent.Sync, onSync);
    client.on(RoomStateEvent.Events, updateRooms);
    client.on(RoomEvent.MyMembership, updateRooms);

    return () => {
      client.removeListener(ClientEvent.Sync, onSync);
      client.removeListener(RoomStateEvent.Events, updateRooms);
      client.removeListener(RoomEvent.MyMembership, updateRooms);
    };
  }, [client, spaceId, updateRooms]);

  return { rooms, loading };
};
