import { useEffect, useState, useCallback } from 'react';
import { Room, ClientEvent, EventType } from 'matrix-js-sdk';
import { useMatrixClient } from './useMatrixClient';

export interface DirectMessage {
  room: Room;
  otherUserId: string;
}

export const useDirectMessages = () => {
  const client = useMatrixClient();
  const [dms, setDms] = useState<DirectMessage[]>([]);
  const [loading, setLoading] = useState(true);

  const updateDMs = useCallback(() => {
    if (!client) return;

    const mDirectEvent = client.getAccountData(EventType.Direct);
    const directRoomMap = mDirectEvent ? mDirectEvent.getContent() : {};

    const dmList: DirectMessage[] = [];

    // The m.direct event maps user IDs to arrays of room IDs
    for (const [userId, roomIds] of Object.entries(directRoomMap)) {
      if (Array.isArray(roomIds)) {
        for (const roomId of roomIds) {
          const room = client.getRoom(roomId);
          // Only include if the room exists and we are joined or invited
          if (room && (room.getMyMembership() === 'join' || room.getMyMembership() === 'invite')) {
            dmList.push({ room, otherUserId: userId });
          }
        }
      }
    }

    // Sort by recent activity
    dmList.sort((a, b) => {
       const aTimeline = a.room.getLiveTimeline().getEvents();
       const bTimeline = b.room.getLiveTimeline().getEvents();
       const aLast = aTimeline.length > 0 ? aTimeline[aTimeline.length - 1].getTs() : 0;
       const bLast = bTimeline.length > 0 ? bTimeline[bTimeline.length - 1].getTs() : 0;
       return bLast - aLast;
    });

    setDms(dmList);
    setLoading(false);
  }, [client]);

  useEffect(() => {
    if (!client) return;

    updateDMs();

    const onAccountData = (event: any) => {
      if (event.getType() === EventType.Direct) {
        Promise.resolve().then(() => updateDMs());
      }
    };

    const onSync = (state: string) => {
      if (state === 'PREPARED' || state === 'SYNCING') {
        Promise.resolve().then(() => updateDMs());
      }
    };

    client.on(ClientEvent.AccountData, onAccountData);
    client.on(ClientEvent.Sync, onSync);

    return () => {
      client.removeListener(ClientEvent.AccountData, onAccountData);
      client.removeListener(ClientEvent.Sync, onSync);
    };
  }, [client, updateDMs]);

  return { dms, loading };
};
