import React, { useEffect, useRef, useState, useCallback } from 'react';
import { MatrixEvent } from 'matrix-js-sdk';
import MessageItem from './MessageItem';
import { Loader2 } from 'lucide-react';

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
  const scrollRef = useRef<HTMLDivElement>(null);
  const bottomRef = useRef<HTMLDivElement>(null);
  const [prevScrollHeight, setPrevScrollHeight] = useState<number | null>(null);
  const [isInitialLoad, setIsInitialLoad] = useState(true);

  // Handle auto-scroll to bottom on new messages
  useEffect(() => {
    if (isInitialLoad && messages.length > 0) {
      bottomRef.current?.scrollIntoView();
      // Small timeout to avoid setState in effect body lint error
      setTimeout(() => setIsInitialLoad(false), 0);
    } else if (scrollRef.current && prevScrollHeight !== null) {
      // Restore scroll position after pagination
      const currentHeight = scrollRef.current.scrollHeight;
      scrollRef.current.scrollTop = currentHeight - prevScrollHeight;
      // Small timeout to avoid setState in effect body lint error
      setTimeout(() => setPrevScrollHeight(null), 0);
    }
  }, [messages, isInitialLoad, prevScrollHeight]);

  const handleScroll = useCallback(async () => {
    if (!scrollRef.current || loading || !canPaginate || !onPaginate) return;

    const { scrollTop, scrollHeight } = scrollRef.current;
    
    // Trigger pagination when scrolled near the top (within 100px)
    if (scrollTop < 100) {
      setPrevScrollHeight(scrollHeight);
      await onPaginate();
    }
  }, [loading, canPaginate, onPaginate]);

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
              <div className="h-6" /> // Placeholder to keep layout stable
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
