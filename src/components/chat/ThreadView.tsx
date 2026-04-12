import React, { useEffect, useRef, useState, useCallback } from 'react';
import { useAppStore } from '../../store/useAppStore';
import { useMatrixClient } from '../../hooks/useMatrixClient';
import { X, MessageSquare, Loader2 } from 'lucide-react';
import MessageItem from './MessageItem';
import ChatInput from './ChatInput';
import { ThreadEvent, type MatrixEvent, type Thread, RoomEvent } from 'matrix-js-sdk';

const ThreadView: React.FC = () => {
  const { activeThreadId, activeRoomId, setThreadOpen } = useAppStore();
  const client = useMatrixClient();
  const [rootEvent, setRootEvent] = useState<MatrixEvent | null>(null);
  const [messages, setMessages] = useState<MatrixEvent[]>([]);
  const [loading, setLoading] = useState(true);
  const scrollRef = useRef<HTMLDivElement>(null);

  const updateMessages = useCallback((t: Thread) => {
    console.log(`Updating messages for thread ${t.id}, count: ${t.events.length}`);
    setMessages([...t.events]);
  }, []);

  useEffect(() => {
    if (!client || !activeRoomId || !activeThreadId) return;

    const room = client.getRoom(activeRoomId);
    if (!room) return;

    let active = true;

    const initThread = async () => {
      setLoading(true);
      
      try {
        // 1. Find root event
        const root = room.findEventById(activeThreadId) || room.getThread(activeThreadId)?.rootEvent;
        if (active) setRootEvent(root || null);

        if (!root) {
           console.warn(`Root event ${activeThreadId} not found in room memory.`);
        }

        // 2. Get or create thread object
        let thread = room.getThread(activeThreadId);
        
        // If SDK hasn't created a thread object, we might need to nudge it
        if (!thread && root) {
           console.log(`Creating thread object for ${activeThreadId}...`);
           thread = room.createThread(activeThreadId, root, [], true);
        }

        if (!thread) {
          console.warn(`Thread object could not be initialized for ${activeThreadId}`);
          if (active) {
            setMessages([]);
            setLoading(false);
          }
          return;
        }

        if (active) updateMessages(thread);

        // 3. Fetch initial events if needed
        const threadInternals = thread as unknown as { initialEventsFetched?: boolean; fetchNextBatch?: () => Promise<void> };
        
        if (!threadInternals.initialEventsFetched) {
          console.log(`Fetching initial events for thread ${activeThreadId}...`);
          if (typeof threadInternals.fetchNextBatch === 'function') {
            await threadInternals.fetchNextBatch();
          } else {
            // Fallback: manually fetch relations if SDK thread object is empty
            const result = await client.relations(activeRoomId, activeThreadId, 'm.thread', undefined, { limit: 50 });
            console.log(`Manually fetched ${result.events.length} thread relations`);
            
            // If the thread object didn't pick them up, update local state
            if (active && thread.events.length === 0) {
              setMessages(result.events);
            }
          }
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

    const onTimeline = (ev: MatrixEvent) => {
      const relation = ev.getRelation();
      if (relation?.rel_type === 'm.thread' && relation?.event_id === activeThreadId && active) {
        const t = room.getThread(activeThreadId);
        if (t) updateMessages(t);
      }
    };

    room.on(ThreadEvent.Update, onThreadUpdate);
    room.on(ThreadEvent.NewReply, onThreadUpdate);
    room.on(RoomEvent.Timeline, onTimeline);

    initThread();

    return () => {
      active = false;
      room.removeListener(ThreadEvent.Update, onThreadUpdate);
      room.removeListener(ThreadEvent.NewReply, onThreadUpdate);
      room.removeListener(RoomEvent.Timeline, onTimeline);
    };
  }, [client, activeRoomId, activeThreadId, updateMessages]);

  // Scroll to bottom on new messages
  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [messages]);

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

      {/* Thread Content */}
      <div ref={scrollRef} className="flex-1 overflow-y-auto no-scrollbar">
        {loading ? (
          <div className="flex h-20 items-center justify-center">
            <Loader2 className="h-5 w-5 animate-spin text-accent-primary" />
          </div>
        ) : (
          <div className="py-4">
            {/* Root Message */}
            {rootEvent && (
              <div className="border-b border-border-main/50 pb-4 mb-4">
                <div className="px-4 mb-2 text-[10px] font-black uppercase text-text-muted tracking-widest">Thread Start</div>
                <MessageItem event={rootEvent} isThreadRoot={true} />
              </div>
            )}

            {/* Replies */}
            <div className="space-y-1">
              {messages.length === 0 ? (
                <div className="px-4 py-8 text-center text-xs text-text-muted italic">
                  No replies yet
                </div>
              ) : (
                messages.map((msg, idx) => (
                  <MessageItem 
                    key={msg.getId() || msg.getTxnId() || idx} 
                    event={msg} 
                    isContinuation={idx > 0 && messages[idx-1].getSender() === msg.getSender()}
                    isThreadRoot={true}
                  />
                ))
              )}
            </div>
          </div>
        )}
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
