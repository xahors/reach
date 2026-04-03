import React from 'react';
import { MatrixEvent, EventStatus } from 'matrix-js-sdk';
import { useMatrixClient } from '../../hooks/useMatrixClient';
import { useAppStore } from '../../store/useAppStore';
import { Reply, Pencil, Trash2 } from 'lucide-react';

interface MessageItemProps {
  event: MatrixEvent;
  isGrouped?: boolean;
  onJumpToReply?: (replyId: string) => void;
}

const MessageItem: React.FC<MessageItemProps> = ({ event, isGrouped, onJumpToReply }) => {
  const client = useMatrixClient();
  const { setEditingEvent, setReplyingToEvent, userId } = useAppStore();
  const sender = event.sender;
  const timestamp = new Date(event.getTs()).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  const status = event.status;
  const isSending = status === EventStatus.SENDING || status === EventStatus.QUEUED;
  const isFailed = status === EventStatus.NOT_SENT;
  const isRedacted = event.isRedacted();
  const isMe = event.getSender() === userId;
  const isEdited = !!event.replacingEventId();

  const replyEventId = event.replyEventId;
  const room = client?.getRoom(event.getRoomId() || '');
  const repliedToEvent = replyEventId ? room?.findEventById(replyEventId) : null;

  const getAvatar = () => {
    if (!client || !sender || typeof sender.getAvatarUrl !== 'function') return null;
    try {
      return sender.getAvatarUrl(client.getHomeserverUrl(), 40, 40, 'crop', undefined, true);
    } catch {
      return null;
    }
  };

  const handleRedact = async () => {
    if (!client || !event.getRoomId()) return;
    if (window.confirm('Are you sure you want to delete this message?')) {
      try {
        await client.redactEvent(event.getRoomId()!, event.getId()!);
      } catch (err) {
        console.error('Failed to redact event:', err);
      }
    }
  };

  const renderMedia = () => {
    const type = event.getType();
    const content = event.getContent();
    const msgtype = content.msgtype;
    const url = content.url;
    
    if (!url || !client) return null;

    const httpUrl = client.mxcUrlToHttp(url, 400, 400, 'scale', false, true);
    if (!httpUrl) return null;

    if (type === 'm.sticker') {
      return (
        <div className="mt-2 max-w-[160px] overflow-hidden">
          <img 
            src={httpUrl} 
            alt={content.body || 'Sticker'} 
            className="h-auto w-full object-contain"
          />
        </div>
      );
    }

    if (msgtype === 'm.image') {
      return (
        <div className="mt-2 max-w-sm overflow-hidden rounded-lg border border-discord-hover bg-black/20">
          <img 
            src={httpUrl} 
            alt={event.getContent().body || 'Image'} 
            className="max-h-80 w-auto cursor-pointer object-contain"
            onClick={() => window.open(httpUrl, '_blank')}
          />
        </div>
      );
    }

    if (msgtype === 'm.video') {
      return (
        <div className="mt-2 max-w-md overflow-hidden rounded-lg border border-discord-hover bg-black">
          <video 
            src={httpUrl} 
            controls 
            className="max-h-80 w-full"
          />
        </div>
      );
    }

    return (
      <a 
        href={httpUrl} 
        target="_blank" 
        rel="noopener noreferrer"
        className="mt-2 flex items-center rounded bg-discord-sidebar p-2 text-discord-accent hover:underline w-fit"
      >
        <span className="truncate max-w-xs text-xs">📄 {event.getContent().body || 'Download File'}</span>
      </a>
    );
  };

  const renderReply = () => {
    if (!repliedToEvent || !replyEventId) return null;
    const replySender = repliedToEvent.sender;
    const replyContent = repliedToEvent.getClearContent()?.body || repliedToEvent.getContent().body;
    
    return (
      <div 
        onClick={(e) => {
          e.stopPropagation();
          onJumpToReply?.(replyEventId);
        }}
        className="mb-1 flex items-center space-x-2 opacity-60 hover:opacity-100 transition cursor-pointer overflow-hidden max-w-full group/reply"
      >
        <div className="h-4 w-4 shrink-0 rounded-full bg-discord-accent flex items-center justify-center text-[8px] text-white font-bold overflow-hidden">
          {replySender?.getAvatarUrl(client!.getHomeserverUrl(), 16, 16, 'crop', undefined, true) ? (
            <img src={replySender.getAvatarUrl(client!.getHomeserverUrl(), 16, 16, 'crop', undefined, true)!} alt="" className="h-full w-full object-cover" />
          ) : (
            replySender?.name?.charAt(0).toUpperCase() || '?'
          )}
        </div>
        <span className="text-xs font-bold text-white shrink-0 group-hover/reply:underline">@{replySender?.name || replySender?.userId}</span>
        <span className="truncate text-xs text-discord-text-muted italic">{replyContent}</span>
      </div>
    );
  };

  // 1. Resolve the latest content (handling edits and encryption)
  let clearContent = event.getClearContent() || event.getContent();
  const replacingEvent = event.replacingEvent();
  
  if (replacingEvent) {
    const editClearContent = replacingEvent.getClearContent() || replacingEvent.getContent();
    if (editClearContent?.['m.new_content']) {
      clearContent = editClearContent['m.new_content'];
    }
  }

  // 2. Set the display content
  let content: React.ReactNode = clearContent?.body;

  if (isRedacted) {
    content = <span className="italic text-discord-text-muted">This message was deleted.</span>;
  } else if (event.isEncrypted() && !event.getClearContent() && !replacingEvent?.getClearContent()) {
    if (event.isDecryptionFailure()) {
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
    } else {
      content = <span className="italic text-discord-text-muted">🔐 Encrypted message</span>;
    }
  }

  const media = isRedacted ? null : renderMedia();

  const renderActions = () => {
    if (isRedacted || isSending || isFailed) return null;
    return (
      <div className="absolute -top-4 right-4 flex items-center rounded border border-discord-hover bg-discord-sidebar shadow-lg opacity-0 group-hover:opacity-100 transition-opacity z-10 overflow-hidden">
        <button 
          onClick={() => setReplyingToEvent(event)}
          className="p-1.5 text-discord-text-muted hover:bg-discord-hover hover:text-white transition"
          title="Reply"
        >
          <Reply className="h-4 w-4" />
        </button>
        {isMe && event.getType() === 'm.room.message' && (
          <button 
            onClick={() => setEditingEvent(event)}
            className="p-1.5 text-discord-text-muted hover:bg-discord-hover hover:text-white transition"
            title="Edit"
          >
            <Pencil className="h-4 w-4" />
          </button>
        )}
        {isMe && (
          <button 
            onClick={handleRedact}
            className="p-1.5 text-red-400 hover:bg-discord-hover hover:text-red-500 transition"
            title="Delete"
          >
            <Trash2 className="h-4 w-4" />
          </button>
        )}
      </div>
    );
  };

  if (isGrouped) {
    return (
      <div className={`group relative -mt-0.5 flex items-center px-4 py-0.5 hover:bg-[#2e3035] ${isSending ? 'opacity-50' : ''} ${isFailed ? 'text-red-500' : ''}`}>
        {renderActions()}
        <div className="absolute left-0 top-0 flex h-full w-14 items-center justify-center opacity-0 group-hover:opacity-100">
           <span className="text-[10px] text-discord-text-muted">{timestamp}</span>
        </div>
        <div className="ml-10 flex flex-col text-base text-discord-text">
          {renderReply()}
          <div className="flex-1">
            {content}
            {isEdited && !isRedacted && (
              <span className="ml-1 text-[10px] text-discord-text-muted select-none">(edited)</span>
            )}
          </div>
          {media}
          {isFailed && <span className="mt-1 text-[10px] font-bold uppercase text-red-500">Sending Failed</span>}
        </div>
      </div>
    );
  }

  const avatarUrl = getAvatar();

  return (
    <div className={`group relative mt-4 flex px-4 py-1 hover:bg-[#2e3035] ${isSending ? 'opacity-50' : ''}`}>
      {renderActions()}
      <div className="mr-4 mt-0.5 h-10 w-10 shrink-0 rounded-full bg-discord-accent flex items-center justify-center text-white font-bold overflow-hidden">
        {avatarUrl ? (
          <img src={avatarUrl} alt="" className="h-full w-full object-cover" />
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
          {renderReply()}
          <div>
            {content}
            {isEdited && !isRedacted && (
              <span className="ml-1 text-[10px] text-discord-text-muted select-none">(edited)</span>
            )}
          </div>
          {media}
        </div>
      </div>
    </div>
  );
};

export default MessageItem;
