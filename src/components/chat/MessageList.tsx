import React, { useEffect, useRef, useState, useCallback } from 'react';
import { MatrixEvent } from 'matrix-js-sdk';
import MessageItem from './MessageItem';
import { Loader2, ArrowDown } from 'lucide-react';
import { usePinnedEvents } from '../../hooks/usePinnedEvents';
import { useAppStore } from '../../store/useAppStore';

interface MessageListProps {
  messages: MatrixEvent[];
  loading?: boolean;
  onPaginate?: () => Promise<void>;
  canPaginate?: boolean;
  onScrollBottom?: () => void;
  onJumpToEvent: (eventId: string) => void;
  readMarkerId?: string;
  roomId: string;
}

const MessageList: React.FC<MessageListProps> = ({ 
  messages, 
  loading, 
  onPaginate, 
  canPaginate,
  onScrollBottom,
  readMarkerId,
  onJumpToEvent,
  roomId
}) => {
  const { messageLoadPolicy } = useAppStore();
  const scrollRef = useRef<HTMLDivElement>(null);
  const bottomRef = useRef<HTMLDivElement>(null);
  const readMarkerRef = useRef<HTMLDivElement>(null);
  const [prevScrollHeight, setPrevScrollHeight] = useState<number | null>(null);
  const [isReady, setIsReady] = useState(false);
  const [showJumpToLatest, setShowJumpToLatest] = useState(false);
  const [highlightedEventId, setHighlightedEventId] = useState<string | null>(null);

  const scrollToBottom = useCallback((smooth = false) => {
    if (scrollRef.current) {
      if (smooth) {
        bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
      } else {
        scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
      }
    }
  }, []);

  const scrollToMarker = useCallback(() => {
    if (readMarkerRef.current) {
      readMarkerRef.current.scrollIntoView({ block: 'center' });
      return true;
    }
    return false;
  }, []);

  const internalJumpToEvent = useCallback((eventId: string) => {
    const element = document.getElementById(`message-${eventId}`);
    if (element) {
      element.scrollIntoView({ block: 'center', behavior: 'smooth' });
      setHighlightedEventId(eventId);
      setTimeout(() => setHighlightedEventId(null), 2000);
    } else {
      console.warn(`Message ${eventId} not found in DOM`);
      // Propagate up if we can't find it locally
      onJumpToEvent(eventId);
    }
  }, [onJumpToEvent]);

  // 1. Safety fallback
  useEffect(() => {
    const timer = setTimeout(() => {
      if (!isReady) setIsReady(true);
    }, 2000);
    return () => clearTimeout(timer);
  }, [isReady]);

  // 2. Initial positioning and scroll restoration
  useEffect(() => {
    if (messages.length === 0) return;

    if (!isReady) {
      if (messageLoadPolicy === 'latest') {
        requestAnimationFrame(() => {
          scrollToBottom();
          setTimeout(() => scrollToBottom(), 50);
        });
      } else {
        requestAnimationFrame(() => {
          scrollToMarker();
        });
      }
      const timer = setTimeout(() => setIsReady(true), 300);
      return () => clearTimeout(timer);
    } else if (scrollRef.current && prevScrollHeight !== null) {
      const currentHeight = scrollRef.current.scrollHeight;
      scrollRef.current.scrollTop = currentHeight - prevScrollHeight;
      setTimeout(() => setPrevScrollHeight(null), 0);
    }
  }, [messages, isReady, prevScrollHeight, messageLoadPolicy, scrollToBottom, scrollToMarker]);

  // 3. Auto-scroll on new messages
  useEffect(() => {
    if (!isReady || !scrollRef.current || loading || messages.length === 0) return;
    
    const { scrollTop, scrollHeight, clientHeight } = scrollRef.current;
    const isNearBottom = scrollHeight - scrollTop - clientHeight < 250;
    const lastMessage = messages[messages.length - 1];
    const isLocalEcho = lastMessage.getTxnId() && (!lastMessage.getId() || lastMessage.isSending());

    if (isNearBottom || isLocalEcho) {
      scrollToBottom(true);
      onScrollBottom?.();
    }
  }, [messages, isReady, loading, onScrollBottom, scrollToBottom]);

  const handleScroll = useCallback(() => {
    if (!scrollRef.current || !isReady || loading) return;
    const { scrollTop, scrollHeight, clientHeight } = scrollRef.current;
    
    if (scrollTop < 150 && canPaginate && onPaginate) {
      setPrevScrollHeight(scrollHeight);
      onPaginate().catch(console.error);
    }

    const distanceToBottom = scrollHeight - scrollTop - clientHeight;
    setShowJumpToLatest(distanceToBottom > 800);

    if (distanceToBottom < 50) {
      onScrollBottom?.();
    }
  }, [loading, canPaginate, onPaginate, isReady, onScrollBottom]);

  const RenderedMessages = () => {
    const { isEventPinned, pinEvent, unpinEvent } = usePinnedEvents(roomId);
    
    return messages.map((event, index) => {
      const prevEvent = index > 0 ? messages[index - 1] : null;
      const eventId = event.getId();
      if (!eventId) return null; // Don't render events without IDs

      const isReadMarker = readMarkerId && eventId === readMarkerId;
      const hasNewMessagesBelow = isReadMarker && index < messages.length - 1;
      const isHighlighted = eventId === highlightedEventId;
      
      let isGrouped = false;
      if (prevEvent) {
        const prevSender = prevEvent.getSender();
        const currentSender = event.getSender();
        const prevTime = prevEvent.getTs();
        const currentTime = event.getTs();
        const fiveMinutes = 5 * 60 * 1000;
        if (prevSender === currentSender && (currentTime - prevTime) < fiveMinutes) {
          isGrouped = true;
        }
      }

      return (
        <div 
          key={eventId} 
          id={`message-${eventId}`}
          ref={isReadMarker ? readMarkerRef : null}
          className={`transition-colors duration-1000 ${isHighlighted ? 'bg-discord-accent/20' : ''}`}
        >
          <MessageItem 
            event={event} 
            isGrouped={isGrouped} 
            onJumpToReply={internalJumpToEvent}
            isPinned={isEventPinned(eventId)}
            onPinToggle={(id, isCurrentlyPinned) => {
              if (isCurrentlyPinned) {
                unpinEvent(id);
              } else {
                pinEvent(id);
              }
            }}
          />
          {hasNewMessagesBelow && (
            <div className="flex items-center px-4 py-2">
              <div className="h-px flex-1 bg-discord-accent opacity-50" />
              <span className="mx-2 text-[10px] font-bold uppercase text-discord-accent">New Messages</span>
              <div className="h-px flex-1 bg-discord-accent opacity-50" />
            </div>
          )}
        </div>
      );
    });
  };

  return (
    <div className="relative flex flex-1 flex-col overflow-hidden">
      <div 
        ref={scrollRef}
        onScroll={handleScroll}
        className={`flex-1 overflow-y-auto no-scrollbar transition-opacity duration-300 ${isReady ? 'opacity-100' : 'opacity-0'}`}
      >
        <div className="flex min-h-full flex-col justify-end pb-4">
          {canPaginate && (
            <div className="flex items-center justify-center py-4">
              {loading ? (
                <Loader2 className="h-6 w-6 animate-spin text-discord-accent" />
              ) : (
                <div className="h-6" />
              )}
            </div>
          )}
          
          <RenderedMessages />
          <div ref={bottomRef} className="h-px w-full" />
        </div>
      </div>

      {showJumpToLatest && (
        <button 
          onClick={() => scrollToBottom(true)}
          className="absolute bottom-4 right-6 flex items-center space-x-2 rounded-full bg-discord-accent px-4 py-2 text-xs font-bold text-white shadow-lg transition hover:bg-opacity-90 active:scale-95 animate-in fade-in slide-in-from-bottom-2"
        >
          <ArrowDown className="h-4 w-4" />
          <span>Jump to Latest</span>
        </button>
      )}
    </div>
  );
};

export default MessageList;
