import React, { useEffect, useRef, useState, useMemo, useCallback } from 'react';
import { MatrixEvent } from 'matrix-js-sdk';
import MessageItem from './MessageItem';
import { useMatrixClient } from '../../hooks/useMatrixClient';
import { useAppStore } from '../../store/useAppStore';
import { Hash, ChevronUp, ChevronDown, Loader2 } from 'lucide-react';
import { useRoomTyping } from '../../hooks/useRoomTyping';

interface MessageListProps {
  roomId: string;
  messages: MatrixEvent[];
  loading?: boolean;
  onPaginate?: () => void;
  canPaginate?: boolean;
  canPaginateForward?: boolean;
  onScrollBottom?: (eventId?: string) => void;
  onJumpToEvent?: (id: string) => void;
  onJumpToLive?: () => void;
  readMarkerId?: string;
}

const MessageList: React.FC<MessageListProps> = ({ 
  roomId, 
  messages, 
  loading, 
  onPaginate, 
  canPaginate, 
  canPaginateForward,
  onScrollBottom,
  onJumpToEvent,
  onJumpToLive,
  readMarkerId
}) => {
  const scrollRef = useRef<HTMLDivElement>(null);
  const observerRef = useRef<IntersectionObserver | null>(null);
  const visibleEventsRef = useRef<Set<string>>(new Set());
  
  const { highlightedEventId, setHighlightedEventId } = useAppStore();
  const [shouldScrollToBottom, setShouldScrollToBottom] = useState(!canPaginateForward);
  const prevMessagesLength = useRef(messages.length);
  const prevRoomId = useRef(roomId);
  const client = useMatrixClient();
  const room = client?.getRoom(roomId);
  const typingUsers = useRoomTyping(roomId);

  // Setup Intersection Observer
  useEffect(() => {
    if (!messages.length || !onScrollBottom) return;

    // Use a debounced update for read markers to prevent loop spam
    let timeoutId: number | null = null;
    
    const updateReadMarker = () => {
      if (visibleEventsRef.current.size === 0) return;
      
      let latestId = '';

      // Optimization: search backwards from end of messages for visible IDs
      for (let i = messages.length - 1; i >= 0; i--) {
        const id = messages[i].getId();
        if (id && visibleEventsRef.current.has(id)) {
          latestId = id;
          break;
        }
      }

      if (latestId) {
        onScrollBottom(latestId);
      }
    };

    observerRef.current = new IntersectionObserver(
      (entries) => {
        let changed = false;
        entries.forEach((entry) => {
          const eventId = entry.target.getAttribute('data-event-id');
          if (!eventId) return;

          if (entry.isIntersecting) {
            if (!visibleEventsRef.current.has(eventId)) {
              visibleEventsRef.current.add(eventId);
              changed = true;
            }
          } else {
            if (visibleEventsRef.current.has(eventId)) {
              visibleEventsRef.current.delete(eventId);
              changed = true;
            }
          }
        });

        if (changed) {
          if (timeoutId) window.clearTimeout(timeoutId);
          timeoutId = window.setTimeout(updateReadMarker, 500);
        }
      },
      { threshold: 0.1 }
    );

    return () => {
      if (timeoutId) window.clearTimeout(timeoutId);
      observerRef.current?.disconnect();
    };
  }, [messages, onScrollBottom]);

  // Ref function to attach observer to each message container
  const messageRef = useCallback((node: HTMLDivElement | null) => {
    if (node) {
      observerRef.current?.observe(node);
    }
  }, []);

  useEffect(() => {
    if (highlightedEventId) {
      const element = document.getElementById(`message-${highlightedEventId}`);
      if (element) {
        element.scrollIntoView({ behavior: 'smooth', block: 'center' });
        // Clear highlight after a few seconds
        const timer = setTimeout(() => {
          setHighlightedEventId(null);
        }, 3000);
        return () => clearTimeout(timer);
      }
    }
  }, [highlightedEventId, messages, setHighlightedEventId]);

  const scrollToBottom = () => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  };

  // Group messages by sender and time
  const groupedMessages = useMemo(() => {
    const groups: {
      id: string;
      events: MatrixEvent[];
      showDetails: boolean;
    }[] = [];

    messages.forEach((event, index) => {
      const prevEvent = index > 0 ? messages[index - 1] : null;
      
      const isStateEvent = event.isState();
      const isCallEvent = event.getType().startsWith('m.call') || event.getType().startsWith('org.matrix.msc3401.call');
      
      // Don't group state events or call events
      let isContinuation = false;
      if (prevEvent && !isStateEvent && !isCallEvent) {
        const timeDiff = event.getTs() - prevEvent.getTs();
        const sameSender = event.getSender() === prevEvent.getSender();
        const prevWasNormal = !prevEvent.isState() && 
                             !prevEvent.getType().startsWith('m.call') && 
                             !prevEvent.getType().startsWith('org.matrix.msc3401.call');
        
        // Group if same sender within 5 minutes
        isContinuation = sameSender && prevWasNormal && timeDiff < 5 * 60 * 1000;
      }

      groups.push({
        id: event.getId() || `local-${index}`,
        events: [event],
        showDetails: !isContinuation
      });
    });

    return groups;
  }, [messages]);

  // Force scroll to bottom when room changes and we're at the live end
  useEffect(() => {
    if (prevRoomId.current !== roomId) {
      prevRoomId.current = roomId;
      if (!canPaginateForward) {
        // Small delay to ensure content is rendered and avoid cascading renders
        setTimeout(() => {
          setShouldScrollToBottom(true);
          scrollToBottom();
        }, 50);
      }
    }
  }, [roomId, canPaginateForward]);

  useEffect(() => {
    // If new messages arrive and we were already at the bottom, stay at the bottom
    if (messages.length > prevMessagesLength.current && shouldScrollToBottom) {
      scrollToBottom();
    }
    
    // Auto-fill: if we don't have enough messages to fill the screen, load more
    if (!loading && canPaginate && onPaginate && scrollRef.current) {
      const { scrollHeight, clientHeight } = scrollRef.current;
      // If content is shorter than the container, load more
      if (scrollHeight <= clientHeight && messages.length > 0) {
        onPaginate();
      }
    }

    prevMessagesLength.current = messages.length;
  }, [messages, shouldScrollToBottom, loading, canPaginate, onPaginate]);

  const handleScroll = () => {
    if (!scrollRef.current) return;
    const { scrollTop, scrollHeight, clientHeight } = scrollRef.current;
    
    // Check if near bottom
    const isAtBottom = scrollHeight - scrollTop - clientHeight < 100;
    setShouldScrollToBottom(isAtBottom);

    if (isAtBottom && onScrollBottom) {
      onScrollBottom();
    }

    // Check if near top for pagination
    if (scrollTop < 100 && canPaginate && !loading && onPaginate) {
      onPaginate();
    }
  };

  return (
    <div 
      ref={scrollRef}
      onScroll={handleScroll}
      className="flex-1 overflow-y-auto bg-bg-main no-scrollbar selection:bg-accent-primary/30"
    >
      <div className="flex min-h-full flex-col justify-end py-4">
        {/* Room Welcome Header */}
        {!canPaginate && !loading && (
          <div className="mb-8 px-4 animate-in fade-in slide-in-from-bottom-4 duration-700">
            <div className="mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-bg-nav border border-border-main shadow-lg">
              <Hash className="h-10 w-10 text-text-muted" />
            </div>
            <h2 className="mb-2 text-3xl font-black text-white tracking-tighter uppercase">Welcome to #{room?.name || 'this channel'}</h2>
            <p className="text-sm text-text-muted max-w-lg leading-relaxed font-medium">
              This is the beginning of the <span className="text-white font-bold">#{room?.name}</span> channel. 
              History starts here. All messages are end-to-end encrypted.
            </p>
            <div className="mt-6 h-px w-full bg-border-main/30" />
          </div>
        )}

        {loading && (
          <div className="flex items-center justify-center py-4 space-x-2">
            <Loader2 className="h-4 w-4 animate-spin text-accent-primary" />
            <span className="text-[10px] font-bold text-text-muted uppercase tracking-widest">Loading history...</span>
          </div>
        )}

        {canPaginate && !loading && (
          <div className="flex justify-center py-4">
            <button 
              onClick={onPaginate}
              className="flex items-center space-x-2 rounded-full border border-border-main bg-bg-nav px-4 py-1.5 text-[10px] font-black text-text-muted transition hover:bg-bg-hover hover:text-white uppercase tracking-tighter"
            >
              <ChevronUp className="h-3 w-3" />
              <span>Load older messages</span>
            </button>
          </div>
        )}

        {groupedMessages.map((group, index) => {
          const isLastRead = readMarkerId === group.id;
          
          // Only show banner if there are actual new messages after this one from OTHER users
          let showBanner = false;
          if (isLastRead && index < groupedMessages.length - 1) {
            // Check if any subsequent message is from someone else
            const hasOtherMessages = groupedMessages.slice(index + 1).some(g => 
              g.events.some(e => e.getSender() !== client?.getUserId())
            );
            showBanner = hasOtherMessages;
          }

          return (
            <React.Fragment key={group.id}>
              <div 
                ref={messageRef} 
                data-event-id={group.id}
                className="w-full"
              >
                <MessageItem 
                  event={group.events[0]} 
                  isContinuation={!group.showDetails}
                  onJumpToEvent={onJumpToEvent}
                />
              </div>
              {showBanner && (
                <div className="relative my-4 flex items-center px-4 animate-in fade-in duration-500">
                  <div className="h-px flex-1 bg-red-500/50" />
                  <span className="mx-4 text-[9px] font-black text-red-500 uppercase tracking-widest bg-bg-main px-2">New Messages</span>
                  <div className="h-px flex-1 bg-red-500/50" />
                </div>
              )}
            </React.Fragment>
          );
        })}

        {(!shouldScrollToBottom || canPaginateForward) && !loading && (
          <div className="sticky bottom-4 flex justify-center py-4 z-10 pointer-events-none">
            <button 
              onClick={canPaginateForward ? onJumpToLive : scrollToBottom}
              className="flex items-center space-x-2 rounded-full border border-border-main bg-bg-nav px-4 py-1.5 text-[10px] font-black text-accent-primary transition hover:bg-bg-hover hover:text-white uppercase tracking-tighter pointer-events-auto shadow-xl shadow-black/50 animate-in slide-in-from-bottom-2 duration-300"
            >
              <div className="h-1.5 w-1.5 rounded-full bg-accent-primary animate-pulse" />
              <span>{canPaginateForward ? 'New Messages Below' : 'Jump to Present'}</span>
              <ChevronDown className="h-3 w-3" />
            </button>
          </div>
        )}

        {/* Typing Indicator */}
        {typingUsers.length > 0 && (
          <div className="flex items-center space-x-2 px-4 py-2 text-[10px] text-text-muted animate-in slide-in-from-bottom-1 duration-200">
            <div className="flex space-x-0.5 shrink-0">
              <div className="h-1 w-1 rounded-full bg-text-muted animate-bounce" style={{ animationDelay: '0ms' }} />
              <div className="h-1 w-1 rounded-full bg-text-muted animate-bounce" style={{ animationDelay: '150ms' }} />
              <div className="h-1 w-1 rounded-full bg-text-muted animate-bounce" style={{ animationDelay: '300ms' }} />
            </div>
            <span className="font-medium italic truncate">
              {typingUsers.length === 1 ? (
                <span className="font-bold">{typingUsers[0]}</span>
              ) : typingUsers.length === 2 ? (
                <span><span className="font-bold">{typingUsers[0]}</span> and <span className="font-bold">{typingUsers[1]}</span></span>
              ) : (
                <span><span className="font-bold">{typingUsers[0]}</span> and {typingUsers.length - 1} others</span>
              )}
              {typingUsers.length === 1 ? ' is typing...' : ' are typing...'}
            </span>
          </div>
        )}
      </div>
    </div>
  );
};

export default MessageList;
