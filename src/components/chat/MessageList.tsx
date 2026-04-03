import React, { useEffect, useRef, useState, useCallback } from 'react';
import { MatrixEvent } from 'matrix-js-sdk';
import MessageItem from './MessageItem';
import { Loader2, ArrowDown } from 'lucide-react';

import { useAppStore } from '../../store/useAppStore';

interface MessageListProps {
  messages: MatrixEvent[];
  loading?: boolean;
  onPaginate?: () => Promise<void>;
  canPaginate?: boolean;
  onScrollBottom?: () => void;
  readMarkerId?: string;
}

const MessageList: React.FC<MessageListProps> = ({ 
  messages, 
  loading, 
  onPaginate, 
  canPaginate,
  onScrollBottom,
  readMarkerId
}) => {
  const { messageLoadPolicy } = useAppStore();
  const scrollRef = useRef<HTMLDivElement>(null);
  const bottomRef = useRef<HTMLDivElement>(null);
  const readMarkerRef = useRef<HTMLDivElement>(null);
  const [prevScrollHeight, setPrevScrollHeight] = useState<number | null>(null);
  const [isReady, setIsReady] = useState(false);
  const [showJumpToLatest, setShowJumpToLatest] = useState(false);

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

  // 1. Safety fallback: Ensure we eventually show the UI even if messages are empty/slow
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
      // First time messages are loaded for this channel
      if (messageLoadPolicy === 'latest') {
        requestAnimationFrame(() => {
          scrollToBottom();
          setTimeout(() => {
            scrollToBottom();
            onScrollBottom?.();
          }, 50);
        });
        const timer = setTimeout(() => setIsReady(true), 300);
        return () => clearTimeout(timer);
      } else {
        // 'last_read' policy
        requestAnimationFrame(() => {
          const found = scrollToMarker();
          if (found) {
            const timer = setTimeout(() => setIsReady(true), 300);
            return () => clearTimeout(timer);
          } else {
            // If marker not in current window, maybe fallback to bottom or stay at top
            // For now, if we can't find it, we wait a bit or just show what we have
            const timer = setTimeout(() => setIsReady(true), 500);
            return () => clearTimeout(timer);
          }
        });
      }
    } else if (scrollRef.current && prevScrollHeight !== null) {
      // Restore scroll position after a pagination load
      const currentHeight = scrollRef.current.scrollHeight;
      scrollRef.current.scrollTop = currentHeight - prevScrollHeight;
      setTimeout(() => setPrevScrollHeight(null), 0);
    }
  }, [messages, isReady, prevScrollHeight, messageLoadPolicy, scrollToBottom, onScrollBottom, scrollToMarker]);

  // 3. Auto-scroll to bottom on NEW messages
  useEffect(() => {
    if (!isReady || !scrollRef.current || loading || messages.length === 0) return;
    
    const { scrollTop, scrollHeight, clientHeight } = scrollRef.current;
    const distanceToBottom = scrollHeight - scrollTop - clientHeight;
    const isNearBottom = distanceToBottom < 250;
    
    const lastMessage = messages[messages.length - 1];
    // A message is a local echo if it has a txnId but is still in sending status or hasn't got an ID yet
    const isLocalEcho = lastMessage.getTxnId() && (!lastMessage.getId() || lastMessage.isSending());

    if (isNearBottom || isLocalEcho) {
      scrollToBottom(true);
      onScrollBottom?.();
    }
  }, [messages, isReady, loading, onScrollBottom, scrollToBottom]);

  const handleScroll = useCallback(() => {
    if (!scrollRef.current || !isReady || loading) return;

    const { scrollTop, scrollHeight, clientHeight } = scrollRef.current;
    
    // Pagination trigger (scroll near top)
    if (scrollTop < 150 && canPaginate && onPaginate) {
      setPrevScrollHeight(scrollHeight);
      onPaginate().catch(console.error);
    }

    // Read receipt and Jump-to-Latest trigger
    const distanceToBottom = scrollHeight - scrollTop - clientHeight;
    const isAtBottom = distanceToBottom < 50;
    
    setShowJumpToLatest(distanceToBottom > 800);

    if (isAtBottom) {
      onScrollBottom?.();
    }
  }, [loading, canPaginate, onPaginate, isReady, onScrollBottom]);

  const renderMessages = () => {
    const groupedMessages: React.ReactNode[] = [];
    
    messages.forEach((event, index) => {
      const prevEvent = index > 0 ? messages[index - 1] : null;
      const eventId = event.getId();
      const isReadMarker = readMarkerId && eventId === readMarkerId;
      
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

      groupedMessages.push(
        <div key={eventId || event.getTxnId()} ref={isReadMarker ? readMarkerRef : null}>
          <MessageItem event={event} isGrouped={isGrouped} />
          {isReadMarker && (
            <div className="flex items-center px-4 py-2">
              <div className="h-px flex-1 bg-discord-accent opacity-50" />
              <span className="mx-2 text-[10px] font-bold uppercase text-discord-accent">New Messages</span>
              <div className="h-px flex-1 bg-discord-accent opacity-50" />
            </div>
          )}
        </div>
      );
    });

    return groupedMessages;
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
          
          {renderMessages()}
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
