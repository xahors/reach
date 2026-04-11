import React from 'react';
import { MatrixEvent, EventStatus } from 'matrix-js-sdk';
import { useMatrixClient } from '../../hooks/useMatrixClient';
import { useAppStore } from '../../store/useAppStore';
import { PhoneOff, Phone, Video, Pin, Trash2, Pencil, Reply, UserPlus, UserMinus, Settings } from 'lucide-react';
import { cn } from '../../utils/cn';
import { UrlPreview } from './UrlPreview';

interface MessageItemProps {
  event: MatrixEvent;
  isContinuation?: boolean;
  onJumpToEvent?: (id: string) => void;
}

const MessageItem: React.FC<MessageItemProps> = ({ event, isContinuation = false, onJumpToEvent }) => {
  const client = useMatrixClient();
  const { userId, setEditingEvent, setReplyingToEvent } = useAppStore();
  const sender = event.sender;
  const isRedacted = event.isRedacted();
  const status = event.status;
  const isMe = event.getSender() === userId;
  const isEdited = !!event.replacingEventId();

  const timestamp = new Date(event.getTs()).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  const fullDate = new Date(event.getTs()).toLocaleString();

  const type = event.getType();
  const content = event.getContent();

  const isStateEvent = type === 'm.room.member' || 
                       type === 'm.room.name' || 
                       type === 'm.room.topic' || 
                       type === 'm.room.avatar' ||
                       type === 'm.room.power_levels' ||
                       type === 'm.room.canonical_alias';

  const isCallEvent = type === 'm.call.invite' || 
                      type === 'm.call.hangup' || 
                      type === 'm.call.reject' || 
                      type === 'm.call.answer';

  if (isStateEvent && !isRedacted) {
    let icon = <Settings className="h-3 w-3 text-text-muted" />;
    let text = '';
    const prevContent = event.getPrevContent();
    const senderName = sender?.name || event.getSender() || 'Someone';

    if (type === 'm.room.member') {
      const membership = content.membership;
      const prevMembership = prevContent?.membership;
      const targetName = content.displayname || event.getStateKey() || 'Someone';

      if (membership === 'join') {
        if (prevMembership === 'invite') {
          text = `${targetName} accepted an invite`;
        } else {
          text = `${targetName} joined the room`;
        }
        icon = <UserPlus className="h-3 w-3 text-green-500" />;
      } else if (membership === 'leave') {
        if (prevMembership === 'invite') {
          text = `${senderName} rescinded the invite for ${targetName}`;
        } else if (event.getSender() !== event.getStateKey()) {
          text = `${senderName} kicked ${targetName}`;
        } else {
          text = `${targetName} left the room`;
        }
        icon = <UserMinus className="h-3 w-3 text-red-400" />;
      } else if (membership === 'invite') {
        text = `${senderName} invited ${targetName} to the room`;
        icon = <UserPlus className="h-3 w-3 text-accent-primary" />;
      } else if (membership === 'ban') {
        text = `${senderName} banned ${targetName}`;
        icon = <UserMinus className="h-3 w-3 text-red-600" />;
      }
    } else if (type === 'm.room.name') {
      text = `${senderName} changed the room name to "${content.name}"`;
    } else if (type === 'm.room.topic') {
      text = `${senderName} changed the room topic`;
    } else if (type === 'm.room.avatar') {
      text = `${senderName} changed the room avatar`;
    } else if (type === 'm.room.power_levels') {
      text = `${senderName} changed the permissions for this room`;
    }

    if (text) {
      return (
        <div className="group relative flex items-center px-4 py-0.5 hover:bg-bg-hover/30 transition-colors border-l-2 border-transparent hover:border-border-main">
          <div className="mr-4 flex h-8 w-8 shrink-0 items-center justify-center">
            {icon}
          </div>
          <div className="flex flex-1 items-baseline space-x-2 min-w-0">
            <span className="text-text-muted text-[11px] font-medium truncate italic">{text}</span>
            <span className="text-[9px] text-text-muted shrink-0 opacity-0 group-hover:opacity-100 transition-opacity font-mono">
              {timestamp}
            </span>
          </div>
        </div>
      );
    }
  }

  if (isCallEvent && !isRedacted) {
    let callIcon = <Video className="h-5 w-5 text-green-500" />;
    let callText = 'Started a video call';

    if (type === 'm.call.invite') {
       callText = 'Started a private call';
       callIcon = <Phone className="h-5 w-5 text-green-500" />;
    } else if (type === 'm.call.hangup' || type === 'm.call.reject') {
       callIcon = <PhoneOff className="h-5 w-5 text-red-500" />;
       callText = type === 'm.call.reject' ? 'Declined the call' : 'Ended the call';
    } else if (type === 'm.call.answer') {
       callText = 'Answered the call';
    }

    return (
      <div className="group relative mt-2 flex px-4 py-3 hover:bg-bg-hover transition items-center border border-border-main/50 rounded-xl mx-4 bg-bg-nav/20">
        <div className="mr-4 flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-bg-nav border border-border-main">
          {callIcon}
        </div>
        <div className="flex flex-1 flex-col overflow-hidden">
          <div className="flex items-center space-x-2">
            <span className="text-sm font-bold text-white uppercase tracking-tighter">{callText}</span>
            <span className="text-[10px] text-text-muted font-mono">{timestamp}</span>
          </div>
          <div className="text-xs text-text-muted truncate">
            {sender?.name || event.getSender()}
          </div>
        </div>
      </div>
    );
  }

  const body = isRedacted ? 'This message was deleted.' : content.body;
  
  let media = null;
  if (!isRedacted && content.msgtype === 'm.image' && content.url) {
    const mxcUrl = content.url;
    const httpUrl = client?.mxcUrlToHttp(mxcUrl, 400, 400, 'scale', true);
    if (httpUrl) {
      media = (
        <div className="mt-2 overflow-hidden rounded-lg border border-border-main max-w-sm bg-bg-nav">
          <img src={httpUrl} alt={body} className="max-h-80 w-auto object-contain transition-transform hover:scale-[1.02] cursor-zoom-in" />
        </div>
      );
    }
  } else if (!isRedacted && content.msgtype === 'm.sticker' && content.url) {
    const mxcUrl = content.url;
    const httpUrl = client?.mxcUrlToHttp(mxcUrl, 160, 160, 'scale', true);
    if (httpUrl) {
      media = (
        <div className="mt-1 max-w-[160px]">
          <img src={httpUrl} alt={body} className="h-auto w-full object-contain" />
        </div>
      );
    }
  }

  const isReply = !!content['m.relates_to']?.['m.in_reply_to'];
  const replyEventId = content['m.relates_to']?.['m.in_reply_to']?.event_id;
  const room = client?.getRoom(event.getRoomId());
  const replyEvent = replyEventId ? room?.findEventById(replyEventId) : null;

  const getAvatar = () => {
    try {
      return sender?.getAvatarUrl(client?.getHomeserverUrl() || '', 40, 40, 'crop', undefined, true);
    } catch {
      return null;
    }
  };

  const avatarUrl = getAvatar();

  const renderBodyWithLinks = (text: string) => {
    if (!text) return null;
    
    // Split by https:// links. Matches https:// followed by non-whitespace, 
    // excluding trailing punctuation like periods or commas.
    const parts = text.split(/(https:\/\/\S+?(?=[.,;:!?'"()[\]{}]*(?:\s|$)))/g);
    
    return parts.map((part, i) => {
      if (part.startsWith('https://')) {
        return (
          <UrlPreview key={i} url={part}>
            <a 
              href={part} 
              target="_blank" 
              rel="noopener noreferrer"
              className="text-accent-primary hover:underline break-all"
            >
              {part}
            </a>
          </UrlPreview>
        );
      }
      return part;
    });
  };

  return (
    <div className={cn(
      "group relative flex px-4 transition-colors hover:bg-bg-hover/20 border-l-2 border-transparent hover:border-accent-primary/20",
      isContinuation ? "py-0.5" : "mt-4 py-1",
      isEdited && "bg-accent-primary/5 border-l-accent-primary/30"
    )}>
      {/* Context Actions */}
      <div className="absolute -top-4 right-4 z-10 flex items-center space-x-0.5 rounded-lg bg-bg-sidebar border border-border-main p-0.5 opacity-0 shadow-xl group-hover:opacity-100 transition-all duration-100">
        <button 
          onClick={() => setReplyingToEvent(event)}
          className="p-1.5 text-text-muted hover:bg-bg-hover hover:text-white rounded transition" 
          title="Reply"
        >
          <Reply className="h-4 w-4" />
        </button>
        {isMe && (
          <button 
            onClick={() => setEditingEvent(event)}
            className="p-1.5 text-text-muted hover:bg-bg-hover hover:text-white rounded transition" 
            title="Edit"
          >
            <Pencil className="h-4 w-4" />
          </button>
        )}
        <button className="p-1.5 text-text-muted hover:bg-bg-hover hover:text-white rounded transition" title="Pin">
          <Pin className="h-4 w-4" />
        </button>
        <button className="p-1.5 text-red-400 hover:bg-red-500/20 rounded transition" title="Delete">
          <Trash2 className="h-4 w-4" />
        </button>
      </div>

      {!isContinuation ? (
        <div className="mr-4 flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-bg-nav overflow-hidden border border-border-main shadow-sm">
          {avatarUrl ? (
            <img src={avatarUrl} alt="" className="h-full w-full object-cover" />
          ) : (
            <span className="text-sm font-black uppercase text-text-muted">
              {(sender?.name || event.getSender() || '?').charAt(0)}
            </span>
          )}
        </div>
      ) : (
        <div className="mr-4 flex w-10 shrink-0 justify-center">
          <span className="opacity-0 group-hover:opacity-100 text-[9px] text-text-muted font-mono mt-1 transition-opacity">
            {timestamp}
          </span>
        </div>
      )}

      <div className="flex flex-1 flex-col overflow-hidden">
        {!isContinuation && (
          <div className="flex items-baseline space-x-2">
            <span className={cn(
              "cursor-pointer text-sm font-black tracking-tight hover:underline",
              isMe ? "text-accent-primary" : "text-text-main"
            )}>
              {sender?.name || event.getSender()}
            </span>
            <span className="text-[10px] font-mono text-text-muted uppercase tracking-tighter" title={fullDate}>
              {timestamp}
            </span>
          </div>
        )}

        {isReply && replyEvent && (
          <div 
            onClick={() => onJumpToEvent?.(replyEventId!)}
            className="mb-1 flex items-center space-x-2 rounded bg-bg-nav/40 p-1.5 border-l-2 border-accent-primary/30 cursor-pointer hover:bg-bg-nav transition"
          >
            <div className="h-4 w-4 shrink-0 rounded-full bg-bg-hover overflow-hidden">
               {client && replyEvent.sender?.getAvatarUrl(client.getHomeserverUrl(), 16, 16, 'crop', undefined, true) ? (
                 <img src={replyEvent.sender.getAvatarUrl(client.getHomeserverUrl(), 16, 16, 'crop', undefined, true)!} alt="" className="h-full w-full object-cover" />
               ) : (
                 <div className="flex h-full w-full items-center justify-center text-[8px] bg-bg-nav text-text-muted">?</div>
               )}
            </div>
            <span className="text-[10px] font-bold text-text-muted whitespace-nowrap">{replyEvent.sender?.name || 'Someone'}:</span>
            <span className="truncate text-[10px] text-text-muted italic">{replyEvent.getContent().body}</span>
          </div>
        )}

        <div className="flex flex-col">
          <div className={cn(
            "text-sm leading-relaxed tracking-tight",
            isRedacted ? "text-text-muted italic opacity-50" : "text-text-main",
            status === EventStatus.SENDING ? "opacity-50" : ""
          )}>
            {isRedacted ? body : renderBodyWithLinks(body || '')}
            {isEdited && (
              <span className="ml-1 text-[9px] text-text-muted select-none uppercase tracking-tighter font-bold opacity-60">(edited)</span>
            )}
          </div>
          {media}
        </div>
      </div>
    </div>
  );
};

export default MessageItem;
