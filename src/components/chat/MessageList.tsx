import React, { useEffect, useRef } from 'react';
import { MatrixEvent } from 'matrix-js-sdk';
import MessageItem from './MessageItem';

interface MessageListProps {
  messages: MatrixEvent[];
}

const MessageList: React.FC<MessageListProps> = ({ messages }) => {
  const bottomRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

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
    <div className="flex-1 overflow-y-auto no-scrollbar">
      <div className="flex min-h-full flex-col justify-end pb-4">
        {renderMessages()}
        <div ref={bottomRef} />
      </div>
    </div>
  );
};

export default MessageList;
