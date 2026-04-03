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
}

const MessageList: React.FC<MessageListProps> = ({ 
  messages, 
  loading, 
  onPaginate, 
  canPaginate,
  onScrollBottom
}) => {
  const { messageLoadPolicy } = useAppStore();
  const scrollRef = useRef<HTMLDivElement>(null);
  const bottomRef = useRef<HTMLDivElement>(null);
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
      }
      
      const timer = setTimeout(() => setIsReady(true), 300);
      return () => clearTimeout(timer);
    } else if (scrollRef.current && prevScrollHeight !== null) {
      // Restore scroll position after a pagination load
      const currentHeight = scrollRef.current.scrollHeight;
      scrollRef.current.scrollTop = currentHeight - prevScrollHeight;
      setTimeout(() => setPrevScrollHeight(null), 0);
    }
  }, [messages, isReady, prevScrollHeight, messageLoadPolicy, scrollToBottom, onScrollBottom]);

  // 3. Auto-scroll to bottom on NEW messages
  useEffect(() => {
    if (!isReady || !scrollRef.current || loading || messages.length === 0) return;
    
    const { scrollTop, scrollHeight, clientHeight } = scrollRef.current;
    const distanceToBottom = scrollHeight - scrollTop - clientHeight;
    const isNearBottom = distanceToBottom < 250;
    
    // Logic for auto-scrolling:
    // 1. User is already near the bottom
    // 2. The LATEST message is a "local echo" (transaction ID but no event ID) 
    //    which means the current user just sent it.
    const lastMessage = messages[messages.length - 1];
    const isLocalEcho = lastMessage.getTxnId() && !lastMessage.getId();

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
        <MessageItem key={event.getId() || event.getTxnId()} event={event} isGrouped={isGrouped} />
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
