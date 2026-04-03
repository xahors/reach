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
}

const MessageList: React.FC<MessageListProps> = ({ 
  messages, 
  loading, 
  onPaginate, 
  canPaginate 
}) => {
  const { messageLoadPolicy } = useAppStore();
  const scrollRef = useRef<HTMLDivElement>(null);
  const bottomRef = useRef<HTMLDivElement>(null);
  const [prevScrollHeight, setPrevScrollHeight] = useState<number | null>(null);
  const [isReady, setIsReady] = useState(false);

  // 1. Initial positioning and scroll restoration
  useEffect(() => {
    if (messages.length === 0) return;

    if (!isReady) {
      // First time messages are loaded for this channel
      if (messageLoadPolicy === 'latest') {
        bottomRef.current?.scrollIntoView();
      } else {
        // For 'last_read', we might want to center or stay at top depending on load point
        // but for now let's just mark ready.
      }
      
      // Delay setting ready to prevent immediate pagination triggers
      const timer = setTimeout(() => setIsReady(true), 500);
      return () => clearTimeout(timer);
    } else if (scrollRef.current && prevScrollHeight !== null) {
      // Restore scroll position after a pagination load
      const currentHeight = scrollRef.current.scrollHeight;
      scrollRef.current.scrollTop = currentHeight - prevScrollHeight;
      setTimeout(() => setPrevScrollHeight(null), 0);
    }
  }, [messages, isReady, prevScrollHeight, messageLoadPolicy]);

  // 2. Auto-scroll to bottom on NEW messages (only if already near bottom)
  useEffect(() => {
    if (!isReady || !scrollRef.current) return;
    
    const { scrollTop, scrollHeight, clientHeight } = scrollRef.current;
    const isNearBottom = scrollHeight - scrollTop - clientHeight < 200;
    
    if (isNearBottom) {
      bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
    }
  }, [messages, isReady]);

  const handleScroll = useCallback(async () => {
    // Don't paginate until initial positioning is done
    if (!scrollRef.current || !isReady || loading || !canPaginate || !onPaginate) return;

    const { scrollTop, scrollHeight } = scrollRef.current;
    
    // Trigger pagination when scrolled near the top
    if (scrollTop < 100) {
      setPrevScrollHeight(scrollHeight);
      await onPaginate();
    }
  }, [loading, canPaginate, onPaginate, isReady]);

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
      className="flex-1 overflow-y-auto no-scrollbar scroll-smooth"
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
        <div ref={bottomRef} />
      </div>
    </div>
  );
};

export default MessageList;
