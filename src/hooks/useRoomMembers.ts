import { useEffect, useState, useCallback } from 'react';
import { RoomMember, RoomEvent, ClientEvent } from 'matrix-js-sdk';
import { useMatrixClient } from './useMatrixClient';

export const useRoomMembers = (roomId: string | null) => {
  const client = useMatrixClient();
  const [members, setMembers] = useState<RoomMember[]>([]);
  const [loading, setLoading] = useState(false);

  const updateMembers = useCallback(() => {
    if (!client || !roomId) {
      Promise.resolve().then(() => {
        setMembers([]);
        setLoading(false);
      });
      return;
    }

    const room = client.getRoom(roomId);
    if (!room) {
      Promise.resolve().then(() => setLoading(false));
      return;
    }

    const joinedMembers = room.getJoinedMembers();
    if (!Array.isArray(joinedMembers)) {
      Promise.resolve().then(() => {
        setMembers([]);
        setLoading(false);
      });
      return;
    }


    // Sort members by power level and then name
    joinedMembers.sort((a, b) => {
      const powerA = a.powerLevel;
      const powerB = b.powerLevel;
      if (powerA !== powerB) return powerB - powerA;
      return a.name.localeCompare(b.name);
    });

    Promise.resolve().then(() => {
      setMembers(joinedMembers);
      setLoading(false);
    });
  }, [client, roomId]);

  useEffect(() => {
    if (!client || !roomId) {
      Promise.resolve().then(() => {
        setMembers([]);
        setLoading(false);
      });
      return;
    }

    Promise.resolve().then(() => setLoading(true));
    const timeout = setTimeout(() => updateMembers(), 0);

    const onRoomMember = () => updateMembers();
    const onPresence = () => updateMembers();

    client.on(RoomEvent.MyMembership, onRoomMember);
    client.on(ClientEvent.Event, onPresence); // For presence updates

    return () => {
      clearTimeout(timeout);
      client.removeListener(RoomEvent.MyMembership, onRoomMember);
      client.removeListener(ClientEvent.Event, onPresence);
    };
  }, [client, roomId, updateMembers]);

  return { members, loading };
};
