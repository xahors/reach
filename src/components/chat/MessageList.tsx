import React, { useEffect, useRef, useState, useMemo } from 'react';
import { MatrixEvent } from 'matrix-js-sdk';
import MessageItem from './MessageItem';
import { useMatrixClient } from '../../hooks/useMatrixClient';
import { Hash, ChevronUp, ChevronDown, Loader2 } from 'lucide-react';

interface MessageListProps {
  roomId: string;
  messages: MatrixEvent[];
  loading?: boolean;
  onPaginate?: () => void;
  canPaginate?: boolean;
  canPaginateForward?: boolean;
  onScrollBottom?: () => void;
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
  const [shouldScrollToBottom, setShouldScrollToBottom] = useState(true);
  const prevMessagesLength = useRef(messages.length);
  const client = useMatrixClient();
  const room = client?.getRoom(roomId);

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

  const scrollToBottom = () => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  };

  useEffect(() => {
    if (shouldScrollToBottom) {
      scrollToBottom();
    }
    prevMessagesLength.current = messages.length;
  }, [messages, shouldScrollToBottom]);

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

        {groupedMessages.map((group) => (
          <React.Fragment key={group.id}>
            <MessageItem 
              event={group.events[0]} 
              isContinuation={!group.showDetails}
              onJumpToEvent={onJumpToEvent}
            />
            {readMarkerId === group.id && (
              <div className="relative my-4 flex items-center px-4">
                <div className="h-px flex-1 bg-red-500/50" />
                <span className="mx-4 text-[9px] font-black text-red-500 uppercase tracking-widest bg-bg-main px-2">New Messages</span>
                <div className="h-px flex-1 bg-red-500/50" />
              </div>
            )}
          </React.Fragment>
        ))}

        {(!shouldScrollToBottom || canPaginateForward) && !loading && (
          <div className="sticky bottom-4 flex justify-center py-4 z-10 pointer-events-none">
            <button 
              onClick={canPaginateForward ? onJumpToLive : scrollToBottom}
              className="flex items-center space-x-2 rounded-full border border-border-main bg-bg-nav px-4 py-1.5 text-[10px] font-black text-text-muted transition hover:bg-bg-hover hover:text-white uppercase tracking-tighter pointer-events-auto shadow-lg shadow-black/50"
            >
              <span>Jump to Present</span>
              <ChevronDown className="h-3 w-3" />
            </button>
          </div>
        )}
      </div>
    </div>
  );
};

export default MessageList;
