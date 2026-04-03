import React, { useEffect, useRef, useState, useCallback } from 'react';
import { MatrixEvent } from 'matrix-js-sdk';
import MessageItem from './MessageItem';
import { Loader2 } from 'lucide-react';

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

  const scrollToBottom = useCallback(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, []);

  // 1. Initial positioning and scroll restoration
  useEffect(() => {
    if (messages.length === 0) return;

    if (!isReady) {
      // First time messages are loaded for this channel
      if (messageLoadPolicy === 'latest') {
        requestAnimationFrame(() => {
          scrollToBottom();
          setTimeout(() => {
            scrollToBottom();
            onScrollBottom?.(); // Mark as read when jumping to latest
          }, 50);
        });
      }
      
      const timer = setTimeout(() => setIsReady(true), 500);
      return () => clearTimeout(timer);
    } else if (scrollRef.current && prevScrollHeight !== null) {
      const currentHeight = scrollRef.current.scrollHeight;
      scrollRef.current.scrollTop = currentHeight - prevScrollHeight;
      setTimeout(() => setPrevScrollHeight(null), 0);
    }
  }, [messages, isReady, prevScrollHeight, messageLoadPolicy, scrollToBottom, onScrollBottom]);

  // 2. Auto-scroll to bottom on NEW messages
  useEffect(() => {
    if (!isReady || !scrollRef.current || loading) return;
    
    const { scrollTop, scrollHeight, clientHeight } = scrollRef.current;
    const isNearBottom = scrollHeight - scrollTop - clientHeight < 250;
    
    if (isNearBottom) {
      bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
      onScrollBottom?.();
    }
  }, [messages, isReady, loading, onScrollBottom]);

  const handleScroll = useCallback(async () => {
    if (!scrollRef.current || !isReady || loading) return;

    const { scrollTop, scrollHeight, clientHeight } = scrollRef.current;
    
    // Pagination trigger
    if (scrollTop < 150 && canPaginate && onPaginate) {
      setPrevScrollHeight(scrollHeight);
      await onPaginate();
    }

    // Read receipt trigger
    const isAtBottom = scrollHeight - scrollTop - clientHeight < 50;
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
    <div 
      ref={scrollRef}
      onScroll={handleScroll}
      className={`flex-1 overflow-y-auto no-scrollbar transition-opacity duration-300 ${isReady ? 'opacity-100' : 'opacity-0'}`}
    >
      <div className="flex min-h-full flex-col pb-4">
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
        <div ref={bottomRef} className="h-px" />
      </div>
    </div>
  );
};

export default MessageList;
