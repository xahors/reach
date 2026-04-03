import React from 'react';
import { MatrixEvent, EventStatus } from 'matrix-js-sdk';
import { useMatrixClient } from '../../hooks/useMatrixClient';

interface MessageItemProps {
  event: MatrixEvent;
  isGrouped?: boolean;
}

const MessageItem: React.FC<MessageItemProps> = ({ event, isGrouped }) => {
  const client = useMatrixClient();
  const sender = event.sender;
  const timestamp = new Date(event.getTs()).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  const status = event.status;
  const isSending = status === EventStatus.SENDING || status === EventStatus.QUEUED;
  const isFailed = status === EventStatus.NOT_SENT;

  const getAvatar = () => {
    if (!client || !sender || typeof sender.getAvatarUrl !== 'function') return null;
    try {
      return sender.getAvatarUrl(client.getHomeserverUrl(), 40, 40, 'crop', undefined, true);
    } catch {
      return null;
    }
  };

  let content = event.getContent().body;
  
  if (event.isEncrypted()) {
    const clear = event.getClearContent();
    if (clear && clear.body) {
      content = clear.body;
    } else if (event.isDecryptionFailure()) {
      content = (
        <span className="flex items-center">
          <span className="mr-2">🔐 Unable to decrypt message (waiting for keys)</span>
          <button 
            onClick={() => {
              client?.decryptEventIfNeeded(event).catch(() => {});
            }}
            className="text-xs font-bold text-discord-accent hover:underline"
          >
            Retry
          </button>
        </span>
      );
    } else if (!content) {
      content = '🔐 *** Encrypted Message ***';
    }
  }

  if (isGrouped) {
    return (
      <div className={`group relative -mt-0.5 flex items-center px-4 py-0.5 hover:bg-[#2e3035] ${isSending ? 'opacity-50' : ''} ${isFailed ? 'text-red-500' : ''}`}>
        <div className="absolute left-0 top-0 flex h-full w-14 items-center justify-center opacity-0 group-hover:opacity-100">
           <span className="text-[10px] text-discord-text-muted">{timestamp}</span>
        </div>
        <div className="ml-10 text-base text-discord-text">
          {content}
          {isFailed && <span className="ml-2 text-[10px] font-bold uppercase">Sending Failed</span>}
        </div>
      </div>
    );
  }

  const avatarUrl = getAvatar();

  return (
    <div className={`group mt-4 flex px-4 py-1 hover:bg-[#2e3035] ${isSending ? 'opacity-50' : ''}`}>
      <div className="mr-4 mt-0.5 h-10 w-10 shrink-0 rounded-full bg-discord-accent flex items-center justify-center text-white font-bold overflow-hidden">
        {avatarUrl ? (
          <img src={avatarUrl || ''} alt="" className="h-full w-full object-cover" />
        ) : (
          sender?.name?.charAt(0).toUpperCase() || '?'
        )}
      </div>
      <div className="flex flex-col overflow-hidden">
        <div className="flex items-baseline space-x-2">
          <span className="cursor-pointer text-base font-medium text-white hover:underline">
            {sender?.name || sender?.userId}
          </span>
          <span className="text-xs text-discord-text-muted">{timestamp}</span>
          {isFailed && <span className="text-[10px] font-bold uppercase text-red-500">Sending Failed</span>}
        </div>
        <div className={`text-base text-discord-text ${isFailed ? 'text-red-400' : ''}`}>
          {content}
        </div>
      </div>
    </div>
  );
};

export default MessageItem;
