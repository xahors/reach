import { useEffect, useState, useCallback, useRef } from 'react';
import { Room, MatrixEvent, RoomEvent, TimelineWindow, MatrixEventEvent, Direction, ClientEvent, PendingEventOrdering } from 'matrix-js-sdk';
import { useMatrixClient } from './useMatrixClient';

import { useAppStore } from '../store/useAppStore';

export const useRoomMessages = (roomId: string | null) => {
  const client = useMatrixClient();
  const { messageLoadPolicy } = useAppStore();
  const [readMarkerId, setReadMarkerId] = useState<string | null>(null);
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

    // Always check for local echoes if they aren't in the window yet
    // BUT only if the room supports Detached pending event ordering, otherwise it throws
    // @ts-expect-error: internal property access
    if (room.opts?.pendingEventOrdering === PendingEventOrdering.Detached) {
      const pending = room.getPendingEvents();
      if (pending && pending.length > 0) {
        const eventIds = new Set(events.map(e => e.getId()).filter(Boolean));
        const txnIds = new Set(events.map(e => e.getTxnId()).filter(Boolean));

        pending.forEach(pe => {
          if (!eventIds.has(pe.getId()) && !txnIds.has(pe.getTxnId())) {
            events.push(pe);
          }
        });
      }
    }

    return events;
  }, [client, roomId]);

  // Effect to manage read markers
  useEffect(() => {
    if (!client || !roomId) {
      setReadMarkerId(null);
      return;
    }

    const room = client.getRoom(roomId);
    if (!room) return;

    const updateReadMarker = () => {
      const myUserId = client.getUserId();
      const mReadMarker = room.getAccountData('m.fully_read')?.getContent()?.event_id;
      const mReadReceipt = myUserId ? room.getEventReadUpTo(myUserId) : null;
      setReadMarkerId(mReadMarker || mReadReceipt || null);
    };

    updateReadMarker();
    
    const onAccountData = (event: MatrixEvent) => {
      if (event.getType() === 'm.fully_read') {
        updateReadMarker();
      }
    };

    room.on(RoomEvent.AccountData, onAccountData);
    client.on(ClientEvent.Sync, updateReadMarker);

    return () => {
      room.removeListener(RoomEvent.AccountData, onAccountData);
      client.removeListener(ClientEvent.Sync, updateReadMarker);
    };
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
        if (timelineWindow.current && timelineWindow.current.canPaginate(Direction.Forward)) {
          timelineWindow.current.paginate(Direction.Forward, 10).finally(() => {
            refreshMessages();
          });
        } else {
          refreshMessages();
        }
      }
    };

    const onEventDecrypted = (event: MatrixEvent) => {
      if (event.getRoomId() === roomId) {
        refreshMessages();
      }
    };

    const onSync = (state: string) => {
      if (state === 'PREPARED' || state === 'SYNCING') {
         const r = client.getRoom(roomId);
         if (r && !currentRoomRef.current) {
           currentRoomRef.current = r;
           attachListeners(r);
           initTimeline(r);
         }
      }
    };

    const onRoom = (r: Room) => {
      if (r.roomId === roomId && !currentRoomRef.current) {
        currentRoomRef.current = r;
        attachListeners(r);
        initTimeline(r);
      }
    };

    const attachListeners = (targetRoom: Room) => {
      targetRoom.on(RoomEvent.Timeline, onTimelineEvent);
      targetRoom.on(RoomEvent.LocalEchoUpdated, refreshMessages);
    };

    const detachListeners = (targetRoom: Room) => {
      targetRoom.removeListener(RoomEvent.Timeline, onTimelineEvent);
      targetRoom.removeListener(RoomEvent.LocalEchoUpdated, refreshMessages);
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
          
          let forwardAttempts = 0;
          while (timelineWindow.current.canPaginate(Direction.Forward) && forwardAttempts < 3) {
            await timelineWindow.current.paginate(Direction.Forward, 50);
            forwardAttempts++;
          }
        } else {
          const myUserId = client.getUserId();
          const readMarkerIdFromRoom = targetRoom.getAccountData('m.fully_read')?.getContent()?.event_id;
          const readReceiptIdFromRoom = myUserId ? targetRoom.getEventReadUpTo(myUserId) : null;
          
          const targetEventId = readMarkerIdFromRoom || readReceiptIdFromRoom;
          
          if (targetEventId) {
            await timelineWindow.current.load(targetEventId, 50);
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

    client.on(MatrixEventEvent.Decrypted, onEventDecrypted);
    client.on(ClientEvent.Sync, onSync);
    client.on(ClientEvent.Room, onRoom);

    if (room) {
      attachListeners(room);
      initTimeline(room);
    }

    return () => {
      client.removeListener(MatrixEventEvent.Decrypted, onEventDecrypted);
      client.removeListener(ClientEvent.Sync, onSync);
      client.removeListener(ClientEvent.Room, onRoom);
      
      if (currentRoomRef.current) {
        detachListeners(currentRoomRef.current);
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
    
    const now = Date.now();
    if (eventId === lastSentReceiptIdRef.current || (now - lastReceiptTimeRef.current < 3000)) return;

    try {
      lastSentReceiptIdRef.current = eventId;
      lastReceiptTimeRef.current = now;
      await client.setRoomReadMarkers(roomId, eventId, lastMessage);
    } catch (error) {
      console.error('Failed to update read markers:', error);
      lastSentReceiptIdRef.current = null;
    }
  }, [client, roomId, messages, loading]);

  return { messages, loading, paginate, canPaginate, redactAllMyMessages, markAsRead, readMarkerId };
};
