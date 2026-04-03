import { useEffect, useState, useCallback, useRef } from 'react';
import { Room, MatrixEvent, RoomEvent, TimelineWindow, MatrixEventEvent, Direction, PendingEventOrdering, ClientEvent } from 'matrix-js-sdk';
import { useMatrixClient } from './useMatrixClient';

import { useAppStore } from '../store/useAppStore';

export const useRoomMessages = (roomId: string | null) => {
  const client = useMatrixClient();
  const { messageLoadPolicy } = useAppStore();
  const [messages, setMessages] = useState<MatrixEvent[]>([]);
  const [loading, setLoading] = useState(false);
  const [canPaginate, setCanPaginate] = useState(true);
  const [refreshTrigger, setRefreshTrigger] = useState(0);
  const timelineWindow = useRef<TimelineWindow | null>(null);
  
  // Keep track of current room to manage listeners
  const currentRoomRef = useRef<Room | null>(null);

  const refreshMessages = useCallback(() => {
    setRefreshTrigger(prev => prev + 1);
  }, []);

  const getEvents = useCallback(() => {
    if (!client || !roomId) return [];
    const room = client.getRoom(roomId);
    if (!room) return [];
    
    let events: MatrixEvent[] = [];
    
    const windowEvents = timelineWindow.current?.getEvents() || [];
    
    // Use the window events if the window has been initialized
    if (timelineWindow.current) {
      events = [...windowEvents];
    } else {
      events = [...room.getLiveTimeline().getEvents()];
    }

    // Include local echoes if detached
    // @ts-expect-error: internal property access
    if (room.opts?.pendingEventOrdering === PendingEventOrdering.Detached) {
      const pending = room.getPendingEvents();
      const eventIds = new Set(events.map(e => e.getId()).filter(Boolean));
      const txnIds = new Set(events.map(e => e.getTxnId()).filter(Boolean));

      pending.forEach(pe => {
        if (!eventIds.has(pe.getId()) && !txnIds.has(pe.getTxnId())) {
          events.push(pe);
        }
      });
    }

    return events;
  }, [client, roomId]);

  useEffect(() => {
    const allEvents = getEvents();
    const filtered = allEvents.filter((event) => {
      const type = event.getType();
      const isDisplayable = (
        type === 'm.room.message' || 
        type === 'm.room.encrypted' ||
        type === 'm.call.invite' ||
        type === 'm.room.member'
      );
      
      // Filter out the replacement events themselves (they aggregate onto the original)
      const isReplacement = event.isRelation('m.replace');
      
      return isDisplayable && !isReplacement;
    });
    
    filtered.sort((a, b) => a.getTs() - b.getTs());
    setMessages(filtered);
    
    if (timelineWindow.current) {
      setCanPaginate(timelineWindow.current.canPaginate(Direction.Backward));
    }
  }, [getEvents, refreshTrigger]);

  useEffect(() => {
    if (!client || !roomId) {
      Promise.resolve().then(() => setMessages([]));
      currentRoomRef.current = null;
      return;
    }

    const room = client.getRoom(roomId);
    currentRoomRef.current = room;

    // Use a small timeout to avoid setState during effect body
    const initialLoadTimeout = setTimeout(() => refreshMessages(), 0);

    const onTimelineEvent = (_event: MatrixEvent, evRoom: Room | undefined) => {
      if (evRoom?.roomId === roomId) {
        // We still try to advance the window in the background to keep it updated
        if (timelineWindow.current) {
          timelineWindow.current.paginate(Direction.Forward, 10).catch(() => {});
        }
        
        // Use a small timeout to ensure SDK has finished processing and live timeline is updated
        setTimeout(() => refreshMessages(), 0);
      }
    };

    const onEventDecrypted = (event: MatrixEvent) => {
      if (event.getRoomId() === roomId) {
        refreshMessages();
      }
    };

    const onEventStatus = (event: MatrixEvent) => {
      if (event.getRoomId() === roomId) {
        refreshMessages();
      }
    };

    const onSync = (state: string) => {
      if (state === 'PREPARED' || state === 'SYNCING') {
         if (!currentRoomRef.current) {
           const r = client.getRoom(roomId);
           if (r) {
             currentRoomRef.current = r;
             r.on(RoomEvent.Timeline, onTimelineEvent);
             r.on(RoomEvent.LocalEchoUpdated, refreshMessages);
             initTimeline(r);
           }
         }
         refreshMessages();
      }
    };

    const onRoom = (r: Room) => {
      if (r.roomId === roomId && !currentRoomRef.current) {
        currentRoomRef.current = r;
        r.on(RoomEvent.Timeline, onTimelineEvent);
        r.on(RoomEvent.LocalEchoUpdated, refreshMessages);
        initTimeline(r);
      }
    };

    const initTimeline = async (targetRoom: Room) => {
      Promise.resolve().then(() => setLoading(true));
      timelineWindow.current = new TimelineWindow(client, targetRoom.getUnfilteredTimelineSet(), {
        windowLimit: 1000
      });
      try {
        if (messageLoadPolicy === 'latest') {
          // Load from the very end of the live timeline
          // Passing undefined often starts at the beginning of the timeline set.
          // To get the latest, we should target the last known event.
          const liveEvents = targetRoom.getLiveTimeline().getEvents();
          const lastEventId = liveEvents.length > 0 ? liveEvents[liveEvents.length - 1].getId() : undefined;
          await timelineWindow.current.load(lastEventId, 50);
        } else {
          // Load around the last read receipt
          const readReceipt = targetRoom.getEventReadUpTo(client.getUserId()!);
          await timelineWindow.current.load(readReceipt || undefined, 50);
        }
      } catch (error) {
        console.error('Failed to load timeline:', error);
      } finally {
        refreshMessages();
        Promise.resolve().then(() => setLoading(false));
      }
    };

    // Global client listeners
    client.on(RoomEvent.Timeline, onTimelineEvent);
    client.on(MatrixEventEvent.Decrypted, onEventDecrypted);
    // @ts-expect-error: internal event
    client.on('Event.status', onEventStatus);
    client.on(ClientEvent.Sync, onSync);
    client.on(ClientEvent.Room, onRoom); // Retry room lookup when new rooms arrive

    // Room specific listeners
    if (room) {
      room.on(RoomEvent.Timeline, onTimelineEvent);
      room.on(RoomEvent.LocalEchoUpdated, refreshMessages);
      initTimeline(room);
    } else {
      refreshMessages();
    }

    return () => {
      clearTimeout(initialLoadTimeout);
      client.removeListener(RoomEvent.Timeline, onTimelineEvent);
      client.removeListener(MatrixEventEvent.Decrypted, onEventDecrypted);
      // @ts-expect-error: internal event
      client.removeListener('Event.status', onEventStatus);
      client.removeListener(ClientEvent.Sync, onSync);
      client.removeListener(ClientEvent.Room, onRoom);
      
      if (currentRoomRef.current) {
        currentRoomRef.current.removeListener(RoomEvent.Timeline, onTimelineEvent);
        currentRoomRef.current.removeListener(RoomEvent.LocalEchoUpdated, refreshMessages);
      }
      timelineWindow.current = null;
    };
  }, [client, roomId, refreshMessages, messageLoadPolicy]);

  const paginate = useCallback(async () => {
    if (!timelineWindow.current || !canPaginate || loading) return;
    
    setLoading(true);
    try {
      await timelineWindow.current.paginate(Direction.Backward, 30);
      refreshMessages();
    } catch (error) {
      console.error('Pagination failed:', error);
    } finally {
      setLoading(false);
    }
  }, [canPaginate, loading, refreshMessages]);

  const redactAllMyMessages = useCallback(async () => {
    if (!client || !roomId) return;
    const room = client.getRoom(roomId);
    if (!room) return;

    const myUserId = client.getUserId();
    if (!myUserId) return;

    const eventsToRedact = room.getLiveTimeline().getEvents().filter(event => 
      event.getSender() === myUserId && 
      !event.isRedacted() && 
      (event.getType() === 'm.room.message' || event.getType() === 'm.room.encrypted')
    );

    if (eventsToRedact.length === 0) return;

    if (!window.confirm(`Are you sure you want to delete ${eventsToRedact.length} of your messages in this channel?`)) {
      return;
    }

    setLoading(true);
    try {
      for (const event of eventsToRedact) {
        await client.redactEvent(roomId, event.getId()!);
        // Small delay to avoid hitting rate limits too hard
        await new Promise(resolve => setTimeout(resolve, 100));
      }
      refreshMessages();
    } catch (error) {
      console.error('Failed to redact messages:', error);
    } finally {
      setLoading(false);
    }
  }, [client, roomId, refreshMessages]);

  return { messages, loading, paginate, canPaginate, redactAllMyMessages };
};
