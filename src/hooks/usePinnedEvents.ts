import { useState, useEffect, useCallback } from 'react';
import { useMatrixClient } from './useMatrixClient';
import { EventType, MatrixEvent, RoomStateEvent } from 'matrix-js-sdk';

export const usePinnedEvents = (roomId: string | null) => {
  const client = useMatrixClient();
  const [pinnedEventIds, setPinnedEventIds] = useState<string[]>([]);
  const [loading, setLoading] = useState(false);

  const room = client?.getRoom(roomId || '');

  const fetchPinnedEvents = useCallback(() => {
    if (!room) {
      setPinnedEventIds([]);
      return;
    }
    const pinnedEvent = room.currentState.getStateEvents(EventType.RoomPinnedEvents, '');
    const content = pinnedEvent?.getContent();
    setPinnedEventIds(content?.pinned || []);
  }, [room]);

  useEffect(() => {
    fetchPinnedEvents();
    
    const onStateEvent = (event: MatrixEvent) => {
      if (event.getType() === EventType.RoomPinnedEvents && event.getStateKey() === '') {
        fetchPinnedEvents();
      }
    };
    
    room?.on(RoomStateEvent.Events, onStateEvent);

    return () => {
      room?.removeListener(RoomStateEvent.Events, onStateEvent);
    };
  }, [roomId, room, fetchPinnedEvents]);

  const updatePinnedEvents = async (newEventIds: string[]) => {
    if (!client || !roomId) return;
    setLoading(true);
    try {
      await client.sendStateEvent(roomId, EventType.RoomPinnedEvents, { pinned: newEventIds }, '');
      setPinnedEventIds(newEventIds);
    } catch (e) {
      console.error("Failed to update pinned events", e);
    } finally {
      setLoading(false);
    }
  };

  const pinEvent = async (eventId: string) => {
    const newPinned = Array.from(new Set([...pinnedEventIds, eventId]));
    await updatePinnedEvents(newPinned);
  };

  const unpinEvent = async (eventId: string) => {
    const newPinned = pinnedEventIds.filter(id => id !== eventId);
    await updatePinnedEvents(newPinned);
  };

  const isEventPinned = (eventId: string): boolean => {
    return pinnedEventIds.includes(eventId);
  };

  return { pinnedEventIds, pinEvent, unpinEvent, isEventPinned, loading };
};
