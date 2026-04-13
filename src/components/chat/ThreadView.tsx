import React, { useEffect, useRef, useState, useCallback } from 'react';
import { useAppStore } from '../../store/useAppStore';
import { useMatrixClient } from '../../hooks/useMatrixClient';
import { X, MessageSquare, Loader2 } from 'lucide-react';
import MessageItem from './MessageItem';
import ChatInput from './ChatInput';
import { ThreadEvent, type MatrixEvent, type Thread, RoomEvent, MatrixEventEvent } from 'matrix-js-sdk';

const ThreadView: React.FC = () => {
  const { activeThreadId, activeRoomId, setThreadOpen } = useAppStore();
  const client = useMatrixClient();
  const [rootEvent, setRootEvent] = useState<MatrixEvent | null>(null);
  const [messages, setMessages] = useState<MatrixEvent[]>([]);
  const [loading, setLoading] = useState(true);
  const scrollRef = useRef<HTMLDivElement>(null);

  const updateMessages = useCallback((t: Thread) => {
    // thread.events returns messages from oldest to newest
    const evs = t.events;
    console.log(`Syncing thread ${t.id}, count: ${evs.length}`);
    setMessages([...evs]);
  }, []);

  useEffect(() => {
    if (!client || !activeRoomId || !activeThreadId) return;

    const room = client.getRoom(activeRoomId);
    if (!room) return;

    let active = true;
    const trackedEvents = new Set<string>();

    const initThread = async () => {
      setLoading(true);
      
      try {
        // 1. Find or fetch root event
        let root = room.findEventById(activeThreadId);
        if (!root) {
           try {
             const rawEvent = await client.fetchRoomEvent(activeRoomId, activeThreadId);
             root = client.getEventMapper()(rawEvent);
           } catch (e) {
             console.warn("Failed to fetch root event:", e);
           }
        }
        if (active) setRootEvent(root || null);

        // 2. Get/Nudge thread object
        let thread = room.getThread(activeThreadId);
        
        // 3. Fetch history
        const threadInternals = thread as unknown as { initialEventsFetched?: boolean };
        
        if (!thread || !threadInternals.initialEventsFetched) {
          console.log(`Fetching thread history for ${activeThreadId}...`);
          const result = await client.relations(activeRoomId, activeThreadId, 'm.thread', undefined, { limit: 50 });
          
          // CRITICAL: Feed events to room to trigger SDK internal aggregation
          room.processThreadedEvents(result.events, true);
          
          thread = room.getThread(activeThreadId);
          
          // If SDK still hasn't created a thread object, use relations directly
          if (active && (!thread || thread.events.length === 0)) {
            // Ensure chronological order (relations are often newest first)
            const sorted = [...result.events].sort((a, b) => a.getTs() - b.getTs());
            setMessages(sorted);
          }
        }

        if (thread && active) {
          updateMessages(thread);
        }
      } catch (err) {
        console.error("Error initializing thread:", err);
      } finally {
        if (active) setLoading(false);
      }
    };

    const onThreadUpdate = (t: Thread) => {
      if (t.id === activeThreadId && active) {
        updateMessages(t);
      }
    };

    const onRoomTimeline = (ev: MatrixEvent) => {
      const relation = ev.getRelation();
      if (relation?.rel_type === 'm.thread' && relation?.event_id === activeThreadId && active) {
        console.log("New thread reply detected in room timeline.");
        const t = room.getThread(activeThreadId);
        if (t) {
          updateMessages(t);
        } else {
          // If no thread object yet, add to local state manually
          setMessages(prev => {
            if (prev.some(m => m.getId() === ev.getId())) return prev;
            return [...prev, ev].sort((a, b) => a.getTs() - b.getTs());
          });
        }

        // Handle decryption if needed
        if (ev.isEncrypted() && !trackedEvents.has(ev.getId()!)) {
          const onDecrypted = () => {
            const updatedThread = room.getThread(activeThreadId);
            if (updatedThread) updateMessages(updatedThread);
          };
          ev.once(MatrixEventEvent.Decrypted, onDecrypted);
          trackedEvents.add(ev.getId()!);
        }
      }
    };

    room.on(ThreadEvent.Update, onThreadUpdate);
    room.on(ThreadEvent.NewReply, onThreadUpdate);
    room.on(RoomEvent.Timeline, onRoomTimeline);

    initThread();

    return () => {
      active = false;
      room.removeListener(ThreadEvent.Update, onThreadUpdate);
      room.removeListener(ThreadEvent.NewReply, onThreadUpdate);
      room.removeListener(RoomEvent.Timeline, onRoomTimeline);
    };
  }, [client, activeRoomId, activeThreadId, updateMessages]);

  // Scroll to bottom on new messages
  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [messages, loading]);

  if (!activeThreadId) return null;

  const room = activeRoomId ? client?.getRoom(activeRoomId) : null;

  return (
    <div className="flex h-full w-80 flex-col border-l border-border-main bg-bg-sidebar animate-in slide-in-from-right duration-300 shadow-2xl">
      {/* Header */}
      <div className="flex h-12 items-center justify-between px-4 border-b border-border-main shadow-sm">
        <div className="flex items-center space-x-2">
          <MessageSquare className="h-4 w-4 text-text-muted" />
          <span className="text-sm font-black uppercase tracking-tighter text-text-main">Thread</span>
        </div>
        <button 
          onClick={() => setThreadOpen(false)}
          className="rounded p-1 text-text-muted hover:bg-bg-hover hover:text-white transition"
        >
          <X className="h-5 w-5" />
        </button>
      </div>

      {/* Thread Content - Oldest at top, Newest at bottom */}
      <div ref={scrollRef} className="flex-1 overflow-y-auto no-scrollbar scroll-smooth">
        <div className="flex flex-col min-h-full">
          {/* Root Message */}
          {rootEvent && (
            <div className="border-b border-border-main/50 pb-4 mb-4">
              <div className="px-4 mb-2 text-[10px] font-black uppercase text-text-muted tracking-widest">Thread Start</div>
              <MessageItem event={rootEvent} isThreadRoot={true} isThread={true} />
            </div>
          )}

          {/* Replies */}
          <div className="space-y-1 pb-4 flex-1">
            {messages.map((msg, idx) => (
              <MessageItem 
                key={msg.getId() || msg.getTxnId() || idx} 
                event={msg} 
                isContinuation={idx > 0 && messages[idx-1].getSender() === msg.getSender()}
                isThread={true}
              />
            ))}
            
            {loading && messages.length === 0 && (
              <div className="flex h-20 items-center justify-center">
                <Loader2 className="h-5 w-5 animate-spin text-accent-primary" />
              </div>
            )}
            
            {!loading && messages.length === 0 && (
              <div className="px-4 py-8 text-center text-xs text-text-muted italic">
                No replies yet
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Thread Input */}
      <div className="p-2 border-t border-border-main bg-bg-sidebar">
        <ChatInput 
          roomId={activeRoomId!} 
          roomName={room?.name || 'thread'} 
          threadId={activeThreadId}
        />
      </div>
    </div>
  );
};

export default ThreadView;
