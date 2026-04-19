import { useEffect, useState, useCallback, useRef } from 'react';
import { Room, MatrixEvent, RoomEvent, TimelineWindow, MatrixEventEvent, Direction, ClientEvent, EventTimelineSet, RelationType } from 'matrix-js-sdk';
import { useMatrixClient } from './useMatrixClient';

import { useAppStore } from '../store/useAppStore';
import { timelineManager } from '../core/timelineManager';

export const useRoomMessages = (roomId: string | null) => {
  const client = useMatrixClient();
  const { messageLoadPolicy, sendReadReceipts, setThreadOpen, setHighlightedEventId } = useAppStore();
  const [readMarkerId, setReadMarkerId] = useState<string | null>(null);
  const [messages, setMessages] = useState<MatrixEvent[]>([]);
  const [loading, setLoading] = useState(false);
  const [canPaginate, setCanPaginate] = useState(true);
  const [canPaginateForward, setCanPaginateForward] = useState(false);
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
    
    // Get base events from window or live timeline
    let baseEvents: MatrixEvent[] = [];
    if (timelineWindow.current) {
      baseEvents = [...timelineWindow.current.getEvents()];
    } else {
      baseEvents = [...room.getLiveTimeline().getEvents()];
    }

    // Only include pending events manually if ordering is 'detached'.
    // If it's 'chronological', the SDK handles this automatically in the timeline.
    // @ts-expect-error: internal property access
    if (room.opts?.pendingEventOrdering === 'detached') {
      const pendingEvents = room.getPendingEvents();
      if (pendingEvents && pendingEvents.length > 0) {
        const eventIds = new Set(baseEvents.map(e => e.getId()).filter(Boolean));
        const txnIds = new Set(baseEvents.map(e => e.getTxnId()).filter(Boolean));

        pendingEvents.forEach(pe => {
          // Only add if not already in baseEvents (by ID or Transaction ID)
          if (!eventIds.has(pe.getId()) && !txnIds.has(pe.getTxnId())) {
            baseEvents.push(pe);
          }
        });
      }
    }

    return baseEvents;
  }, [client, roomId]);

  const jumpToEvent = useCallback(async (eventId: string) => {
    if (!client || !roomId) return;
    const room = client.getRoom(roomId);
    if (!room) return;

    // Check if this event is part of a thread
    const event = room.findEventById(eventId) || client.getEventMapper()({ event_id: eventId });
    const threadRootId = event?.isRelation(RelationType.Thread) ? event.threadRootId : null;

    if (threadRootId) {
      // It's a thread message - open thread view instead of main timeline
      setThreadOpen(true, threadRootId);
      setHighlightedEventId(eventId);
      return;
    }

    if (!timelineWindow.current) return;

    setLoading(true);
    try {
      await timelineWindow.current.load(eventId, 50);
      refreshMessages();
    } catch (err) {
      console.error(`Failed to jump to event ${eventId}`, err);
    } finally {
      setLoading(false);
    }
  }, [client, roomId, refreshMessages, setThreadOpen, setHighlightedEventId]);

  // Effect to manage read markers
  useEffect(() => {
    if (!client || !roomId) {
      setReadMarkerId(null);
      return;
    }

    const room = client.getRoom(roomId);
    if (!room) return;

    const updateReadMarker = () => {
      // If we already have a marker for this room session, don't move it
      if (readMarkerId) return;

      const myUserId = client.getUserId();
      const mReadMarker = room.getAccountData('m.fully_read')?.getContent()?.event_id;
      const mReadReceipt = myUserId ? room.getEventReadUpTo(myUserId) : null;
      
      const targetId = mReadMarker || mReadReceipt || null;
      if (targetId) {
        setReadMarkerId(targetId);
      }
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
  }, [client, roomId, readMarkerId]);

  useEffect(() => {
    const allEvents = getEvents();
    const filtered = allEvents.filter((event) => {
      const type = event.getType();
      const isDisplayable = (
        type === 'm.room.message' ||
        type === 'm.room.encrypted' ||
        type === 'm.call.invite' ||
        type === 'm.call.answer' ||
        type === 'm.call.hangup' ||
        type === 'm.call.reject' ||
        type === 'm.room.member' ||
        type === 'm.room.name' ||
        type === 'm.room.topic' ||
        type === 'm.room.avatar' ||
        type === 'm.room.power_levels' ||
        type === 'm.room.canonical_alias' ||
        type === 'm.sticker'
      );      
      const isReplacement = event.isRelation('m.replace');
      const isThreadReply = event.isRelation('m.thread');
      
      return isDisplayable && !isReplacement && !isThreadReply;
    });
    
    // Sort by origin server timestamp, fall back to a high number for local echoes
    filtered.sort((a, b) => {
      const aTs = a.getTs() || Number.MAX_SAFE_INTEGER;
      const bTs = b.getTs() || Number.MAX_SAFE_INTEGER;
      return aTs - bTs;
    });
    setMessages(filtered);
    
    if (timelineWindow.current) {
      setCanPaginate(timelineWindow.current.canPaginate(Direction.Backward));
      setCanPaginateForward(timelineWindow.current.canPaginate(Direction.Forward));
    }
  }, [getEvents, refreshTrigger]);

  const jumpToLive = useCallback(async () => {
    if (!timelineWindow.current || !client || !roomId) return;

    setLoading(true);
    try {
      const room = client.getRoom(roomId);
      if (room) {
        timelineManager.clearCache(roomId);
        const newWindow = timelineManager.getOrCreateWindow(client, room);
        timelineWindow.current = newWindow;
        await newWindow.load(undefined, 100);
        timelineManager.markLoaded(roomId);
      }
    } catch (err) {
      console.error('Failed to jump to live:', err);
    } finally {
      refreshMessages();
      setLoading(false);
    }
  }, [client, roomId, refreshMessages]);

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
      targetRoom.on(RoomEvent.TimelineReset, onTimelineReset);
    };

    const detachListeners = (targetRoom: Room) => {
      targetRoom.removeListener(RoomEvent.Timeline, onTimelineEvent);
      targetRoom.removeListener(RoomEvent.LocalEchoUpdated, refreshMessages);
      targetRoom.removeListener(RoomEvent.TimelineReset, onTimelineReset);
    };

    // Fired when the server returns timeline.limited=true (sync gap).
    // The live timeline is reset to a new chunk — the existing TimelineWindow
    // points at a dead old chunk and must be re-initialized.
    const onTimelineReset = (_room: Room | undefined, _timelineSet: EventTimelineSet, toStartOfTimeline: boolean) => {
      if (toStartOfTimeline) return; // only care about resets at the live end
      if (!timelineWindow.current || !currentRoomRef.current) return;
      
      const r = currentRoomRef.current;
      // Clear cache for this room as the timeline is dead
      timelineManager.clearCache(r.roomId);
      
      const newWindow = timelineManager.getOrCreateWindow(client, r);
      timelineWindow.current = newWindow;
      
      newWindow.load(undefined, 100)
        .then(() => {
          timelineManager.markLoaded(r.roomId);
          refreshMessages();
        })
        .catch(console.error);
    };

    const initTimeline = async (targetRoom: Room) => {
      // If we already have a loaded window for this room, just use it
      if (timelineManager.isLoaded(targetRoom.roomId)) {
        timelineWindow.current = timelineManager.getOrCreateWindow(client, targetRoom);
        refreshMessages();
        return;
      }

      Promise.resolve().then(() => setLoading(true));

      lastSentReceiptIdRef.current = null;
      lastReceiptTimeRef.current = 0;

      const window = timelineManager.getOrCreateWindow(client, targetRoom);
      timelineWindow.current = window;

      try {
        if (messageLoadPolicy === 'latest') {
          // Load from the live end (no event ID = "latest").
          await window.load(undefined, 100);
        } else {
          const myUserId = client.getUserId();
          const readMarkerIdFromRoom = targetRoom.getAccountData('m.fully_read')?.getContent()?.event_id;
          const readReceiptIdFromRoom = myUserId ? targetRoom.getEventReadUpTo(myUserId) : null;

          const targetEventId = readMarkerIdFromRoom || readReceiptIdFromRoom;

          // If target is the very last displayable event in the live timeline, just load live
          const liveEvents = targetRoom.getLiveTimeline().getEvents().filter(event => {
            const type = event.getType();
            return (
              type === 'm.room.message' ||
              type === 'm.room.encrypted' ||
              type === 'm.sticker' ||
              type === 'm.call.invite'
            ) && !event.isRelation('m.replace') && !event.isRelation('m.thread');
          });
          const lastLiveEventId = liveEvents[liveEvents.length - 1]?.getId();
          const isAtLiveEnd = targetEventId === lastLiveEventId;

          if (targetEventId && !isAtLiveEnd) {
            await window.load(targetEventId, 100);
            
            // Catch up to the live end if it's within a reasonable distance (a few pagination chunks)
            // This ensures that if the user has read everything, they land at the bottom,
            // but if there are truly a lot of unread messages, they start at the marker.
            let loops = 0;
            while (window.canPaginate(Direction.Forward) && loops < 10) {
              const success = await window.paginate(Direction.Forward, 50);
              if (!success) break;
              loops++;
            }
          } else {
            // No read marker or already at end — fall back to the live end
            await window.load(undefined, 100);
          }
        }
        timelineManager.markLoaded(targetRoom.roomId);
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
      // Do NOT set timelineWindow.current to null here, 
      // it stays in the timelineManager cache for the session.
    };
  }, [client, roomId, refreshMessages, messageLoadPolicy]);

  const paginate = useCallback(async () => {
    if (!timelineWindow.current || !canPaginate || loading) return;
    
    setLoading(true);
    try {
      await timelineWindow.current.paginate(Direction.Backward, 20);
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

  const markAsRead = useCallback(async (explicitEventId?: string) => {
    if (!client || !roomId || messages.length === 0 || loading || !sendReadReceipts) return;
    
    let targetMessage: MatrixEvent | undefined;
    if (explicitEventId) {
      targetMessage = messages.find(m => m.getId() === explicitEventId);
    } else {
      targetMessage = messages[messages.length - 1];
    }

    if (!targetMessage) return;
    const eventId = targetMessage.getId();
    
    if (!eventId || targetMessage.isSending() || targetMessage.status === 'not_sent') return;
    
    // Only move read marker forward
    const room = client.getRoom(roomId);
    const myUserId = client.getUserId();
    if (room && myUserId) {
      const currentReadEventId = room.getEventReadUpTo(myUserId);
      if (currentReadEventId) {
        const currentReadEvent = room.findEventById(currentReadEventId);
        if (currentReadEvent && currentReadEvent.getTs() >= targetMessage.getTs()) {
          // Already read past this point
          return;
        }
      }
    }

    const now = Date.now();
    if (eventId === lastSentReceiptIdRef.current || (now - lastReceiptTimeRef.current < 2000)) return;

    try {
      lastSentReceiptIdRef.current = eventId;
      lastReceiptTimeRef.current = now;
      await client.setRoomReadMarkers(roomId, eventId, targetMessage);
      // Move read marker locally so the UI updates immediately
      setReadMarkerId(eventId);
    } catch (error) {
      console.error('Failed to update read markers:', error);
      lastSentReceiptIdRef.current = null;
    }
  }, [client, roomId, messages, loading, sendReadReceipts]);

  const room = roomId ? client?.getRoom(roomId) : null;
  // @ts-expect-error: Matrix SDK type mismatch for notification count type
  const unreadCount = room?.getUnreadNotificationCount('total') || 0;
  // @ts-expect-error: Matrix SDK type mismatch for notification count type
  const highlightCount = room?.getUnreadNotificationCount('highlight') || 0;

  return { messages, loading, paginate, canPaginate, canPaginateForward, redactAllMyMessages, markAsRead, readMarkerId, jumpToEvent, jumpToLive, unreadCount, highlightCount };
};
