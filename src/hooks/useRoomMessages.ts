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
  
  // Track last sent receipt to avoid infinite loops/spam
  const lastSentReceiptIdRef = useRef<string | null>(null);
  const lastReceiptTimeRef = useRef<number>(0);
  
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

    const onTimelineEvent = (_event: MatrixEvent, evRoom: Room | undefined) => {
      if (evRoom?.roomId === roomId) {
        // Only paginate forward if we are already at the end of the window
        // to avoid jumping or unnecessary network requests
        if (timelineWindow.current && !timelineWindow.current.canPaginate(Direction.Forward)) {
          timelineWindow.current.paginate(Direction.Forward, 10).catch(() => {});
        }
        
        // Use a small timeout to ensure SDK has finished processing
        setTimeout(() => refreshMessages(), 50);
      }
    };

    const onEventDecrypted = (event: MatrixEvent) => {
      if (event.getRoomId() === roomId) {
        refreshMessages();
      }
    };

    const onSync = (state: string) => {
      // Only trigger initial load if room wasn't available before
      if (state === 'PREPARED' || state === 'SYNCING') {
         const r = client.getRoom(roomId);
         if (r && !currentRoomRef.current) {
           currentRoomRef.current = r;
           r.on(RoomEvent.Timeline, onTimelineEvent);
           r.on(RoomEvent.LocalEchoUpdated, refreshMessages);
           initTimeline(r);
         }
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
      
      lastSentReceiptIdRef.current = null;
      lastReceiptTimeRef.current = 0;

      timelineWindow.current = new TimelineWindow(client, targetRoom.getUnfilteredTimelineSet(), {
        windowLimit: 1000
      });

      try {
        if (messageLoadPolicy === 'latest') {
          const liveEvents = targetRoom.getLiveTimeline().getEvents();
          const lastEventId = liveEvents.length > 0 ? liveEvents[liveEvents.length - 1].getId() : undefined;
          
          await timelineWindow.current.load(lastEventId, 50);
          
          // Limit pagination attempts to prevent spam
          let forwardAttempts = 0;
          while (timelineWindow.current.canPaginate(Direction.Forward) && forwardAttempts < 3) {
            await timelineWindow.current.paginate(Direction.Forward, 50);
            forwardAttempts++;
          }
        } else {
          const myUserId = client.getUserId();
          const readReceipt = myUserId ? targetRoom.getEventReadUpTo(myUserId) : null;
          
          if (readReceipt) {
            await timelineWindow.current.load(readReceipt, 50);
            if (timelineWindow.current.canPaginate(Direction.Forward)) {
              await timelineWindow.current.paginate(Direction.Forward, 25);
            }
          } else {
            const liveEvents = targetRoom.getLiveTimeline().getEvents();
            const lastEventId = liveEvents.length > 0 ? liveEvents[liveEvents.length - 1].getId() : undefined;
            await timelineWindow.current.load(lastEventId, 50);
            
            let forwardAttempts = 0;
            while (timelineWindow.current.canPaginate(Direction.Forward) && forwardAttempts < 3) {
              await timelineWindow.current.paginate(Direction.Forward, 50);
              forwardAttempts++;
            }
          }
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
    client.on(ClientEvent.Sync, onSync);
    client.on(ClientEvent.Room, onRoom);

    // Room specific listeners
    if (room) {
      room.on(RoomEvent.Timeline, onTimelineEvent);
      room.on(RoomEvent.LocalEchoUpdated, refreshMessages);
      initTimeline(room);
    }

    return () => {
      client.removeListener(RoomEvent.Timeline, onTimelineEvent);
      client.removeListener(MatrixEventEvent.Decrypted, onEventDecrypted);
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
        await new Promise(resolve => setTimeout(resolve, 100));
      }
      refreshMessages();
    } catch (error) {
      console.error('Failed to redact messages:', error);
    } finally {
      setLoading(false);
    }
  }, [client, roomId, refreshMessages]);

  const markAsRead = useCallback(async () => {
    if (!client || !roomId || messages.length === 0 || loading) return;
    
    const lastMessage = messages[messages.length - 1];
    const eventId = lastMessage.getId();
    
    if (!eventId || lastMessage.isSending() || lastMessage.status === 'not_sent') return;
    
    // Only send if it's a new event ID AND we haven't sent one in the last 2 seconds
    const now = Date.now();
    if (eventId === lastSentReceiptIdRef.current || (now - lastReceiptTimeRef.current < 2000)) return;

    try {
      lastSentReceiptIdRef.current = eventId;
      lastReceiptTimeRef.current = now;
      await client.sendReadReceipt(lastMessage);
    } catch (error) {
      console.error('Failed to send read receipt:', error);
      lastSentReceiptIdRef.current = null;
    }
  }, [client, roomId, messages, loading]);

  return { messages, loading, paginate, canPaginate, redactAllMyMessages, markAsRead };
};
