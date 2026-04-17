import React, { useState, useEffect, useRef, useCallback } from 'react';
import { createPortal } from 'react-dom';
import { MatrixEvent, EventStatus, RelationType, RoomEvent, EventType, ThreadEvent, MatrixEventEvent } from 'matrix-js-sdk';
import { useMatrixClient } from '../../hooks/useMatrixClient';
import { matrixService } from '../../core/matrix';
import { useAppStore } from '../../store/useAppStore';
import { PhoneOff, Phone, Video, Pin, Trash2, Pencil, Reply, UserPlus, UserMinus, Settings, Smile, MessageSquare, Lock, AlertCircle, Loader2 } from 'lucide-react';
import { cn } from '../../utils/cn';
import { UrlPreview } from './UrlPreview';
import { DecryptedMedia } from './DecryptedMedia';
import EmojiPicker, { Theme, type EmojiClickData } from 'emoji-picker-react';
import { usePinnedEvents } from '../../hooks/usePinnedEvents';

interface MessageItemProps {
  event: MatrixEvent;
  isContinuation?: boolean;
  onJumpToEvent?: (id: string) => void;
  isThreadRoot?: boolean;
  isThread?: boolean;
}

/**
 * Partial interface for the Matrix Room object focusing on relations.
 */
interface IMatrixRoom {
  relations: {
    getChildEventsForEvent(
      eventId: string, 
      relationType: RelationType | string, 
      eventType: EventType | string
    ): {
      getRelations(): MatrixEvent[];
    } | undefined;
  };
}

const MessageItem: React.FC<MessageItemProps> = ({ 
  event, 
  isContinuation = false, 
  onJumpToEvent, 
  isThreadRoot = false,
  isThread = false
}) => {
  const client = useMatrixClient();
  const { userId, setEditingEvent, setReplyingToEvent, setThreadOpen, themeConfig, highlightedEventId } = useAppStore();
  const { pinEvent, unpinEvent, isEventPinned, loading: pinLoading } = usePinnedEvents(event.getRoomId() || null);
  const sender = event.sender;
  const isRedacted = event.isRedacted();
  const status = event.status;
  const isMe = event.getSender() === userId;
  const isEdited = !!event.replacingEventId();
  const [showEmojiPicker, setShowEmojiPicker] = useState(false);
  const [pickerPosition, setPickerPosition] = useState({ top: 0, left: 0 });
  const emojiPickerRef = useRef<HTMLDivElement>(null);
  const actionButtonRef = useRef<HTMLButtonElement>(null);

  const emojiTheme = (
    themeConfig.activePreset === 'icebox' || 
    themeConfig.activePreset === 'protanopia-light' || 
    themeConfig.activePreset === 'deuteranopia-light' || 
    themeConfig.activePreset === 'tritanopia-light' || 
    themeConfig.activePreset === 'high-contrast-light'
  ) ? Theme.LIGHT : Theme.DARK;
  
  // Decryption state tracking
  const [, setTick] = useState(0);
  const forceUpdate = useCallback(() => setTick(t => t + 1), []);

  // Group reactions: Map of emoji key -> metadata
  const [reactions, setReactions] = useState<Record<string, { count: number, me: boolean, eventIds: string[] }>>({});
  
  // Thread info
  const [threadReplyCount, setThreadReplyCount] = useState(0);
  const [latestReply, setLatestReply] = useState<MatrixEvent | null>(null);

  // Read Receipts: List of user avatars/names
  const [readReceipts, setReadReceipts] = useState<{ userId: string, avatarUrl: string | null, name: string }[]>([]);
  const [isVerified, setIsVerified] = useState(false);

  const timestamp = new Date(event.getTs()).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  const fullDate = new Date(event.getTs()).toLocaleString();

  const type = event.getType();
  const content = event.getContent();

  const updateReactions = useCallback(() => {
    if (!client) return;
    const room = client.getRoom(event.getRoomId()) as unknown as IMatrixRoom | null;
    if (!room || !room.relations) return;

    const eventId = event.getId();
    if (!eventId) return;

    const relations = room.relations.getChildEventsForEvent(
      eventId, 
      RelationType.Annotation, 
      EventType.Reaction
    );

    if (!relations) {
      setReactions({});
      return;
    }

    const grouped: Record<string, { count: number, me: boolean, eventIds: string[] }> = {};
    relations.getRelations().forEach((rel: MatrixEvent) => {
      if (rel.isRedacted()) return;
      
      const relData = rel.getRelation();
      const key = relData?.key;
      
      if (key) {
        if (!grouped[key]) {
          grouped[key] = { count: 0, me: false, eventIds: [] };
        }
        grouped[key].count++;
        grouped[key].eventIds.push(rel.getId()!);
        if (rel.getSender() === userId) {
          grouped[key].me = true;
        }
      }
    });
    
    setReactions(grouped);
  }, [client, event, userId]);

  const updateReadReceipts = useCallback(() => {
    if (!client) return;
    const room = client.getRoom(event.getRoomId());
    if (!room) return;

    const receipts = room.getReceiptsForEvent(event);
    if (!receipts || receipts.length === 0) {
      setReadReceipts([]);
      return;
    }

    const members = receipts
      .filter(r => r.type === 'm.read' && r.userId !== userId)
      .map(r => {
        const member = room.getMember(r.userId);
        return {
          userId: r.userId,
          name: member?.name || r.userId,
          avatarUrl: member?.getAvatarUrl(client.getHomeserverUrl(), 16, 16, 'crop', undefined, true) || null
        };
      });

    setReadReceipts(members);
  }, [client, event, userId]);

  const updateThreadInfo = useCallback(() => {
    if (!client) return;
    const room = client.getRoom(event.getRoomId());
    if (!room) return;

    const eventId = event.getId();
    if (!eventId) return;

    // 1. Try to get from SDK Thread object
    const thread = room.getThread(eventId);
    if (thread) {
      setThreadReplyCount(thread.length);
      // @ts-expect-error - internal thread property access
      setLatestReply(thread.replyEvent || thread.events[thread.events.length - 1] || null);
      return;
    }

    // 2. Fallback: Check relations manually if thread object isn't aggregated yet
    const threadRelations = (room as unknown as IMatrixRoom).relations?.getChildEventsForEvent(
      eventId,
      RelationType.Thread,
      EventType.RoomMessage
    );

    if (threadRelations) {
      const rels = threadRelations.getRelations();
      if (rels.length > 0) {
        setThreadReplyCount(rels.length);
        setLatestReply(rels[rels.length - 1]);
      }
    }
  }, [client, event]);

  useEffect(() => {
    if (!client || isRedacted) return;
    
    // Defer initial data fetching to avoid synchronous setState in render
    const timer = setTimeout(() => {
      updateReactions();
      updateReadReceipts();
      if (!isThreadRoot && !isThread) updateThreadInfo();
      
      const crypto = matrixService.getCrypto();
      const deviceId = client.getDeviceId();
      if (crypto && userId && deviceId) {
        Promise.all([
          crypto.getDeviceVerificationStatus(userId, deviceId),
          crypto.getCrossSigningStatus()
        ]).then(([status, crossSigning]) => {
          const verified = !!status?.isVerified();
          const hasMasterKey = !!crossSigning?.privateKeysCachedLocally?.masterKey;
          // If we aren't verified OR we don't have our own keys, we're in a "waiting" state
          setIsVerified(verified && hasMasterKey);
        });
      }
    }, 0);

    const room = client.getRoom(event.getRoomId());
    const eventId = event.getId();
    
    const onTimeline = (rel: MatrixEvent) => {
      const relation = rel.getRelation();
      if (relation && relation.event_id === eventId) {
        if (relation.rel_type === RelationType.Annotation) {
          updateReactions();
        } else if (relation.rel_type === RelationType.Thread) {
          updateThreadInfo();
        }
      }
    };

    const onReceipt = () => {
      // Any receipt in the room might affect this message's visibility in others' read lists
      updateReadReceipts();
    };

    const onRedaction = (redactedEvent: MatrixEvent) => {
        const redactedId = redactedEvent.getAssociatedId() || redactedEvent.getContent().redacts;
        if (redactedId === eventId) {
            updateReactions();
            updateThreadInfo();
        }
    };

    const onThreadUpdate = (thread: unknown) => {
      const t = thread as { id: string };
      if (t.id === eventId) {
        updateThreadInfo();
      }
    };

    const onDecrypted = () => {
      forceUpdate();
    };

    room?.on(RoomEvent.Timeline, onTimeline);
    room?.on(RoomEvent.Redaction, onRedaction);
    room?.on(RoomEvent.Receipt, onReceipt);
    room?.on(ThreadEvent.Update, onThreadUpdate);
    room?.on(ThreadEvent.NewReply, onThreadUpdate);
    event.on(MatrixEventEvent.Decrypted, onDecrypted);

    return () => {
      clearTimeout(timer);
      room?.removeListener(RoomEvent.Timeline, onTimeline);
      room?.removeListener(RoomEvent.Redaction, onRedaction);
      room?.removeListener(RoomEvent.Receipt, onReceipt);
      room?.removeListener(ThreadEvent.Update, onThreadUpdate);
      room?.removeListener(ThreadEvent.NewReply, onThreadUpdate);
      event.removeListener(MatrixEventEvent.Decrypted, onDecrypted);
    };
  }, [client, event, isRedacted, updateReactions, updateThreadInfo, updateReadReceipts, isThreadRoot, isThread, forceUpdate, userId]);

  React.useLayoutEffect(() => {
    if (showEmojiPicker && actionButtonRef.current) {
      const rect = actionButtonRef.current.getBoundingClientRect();
      const pickerHeight = 400;
      const pickerWidth = isThread ? 280 : 350;
      const margin = 8;
      
      let top = rect.top - pickerHeight - margin;
      let direction: 'up' | 'down' = 'up';

      // Use a consistent window height or just current viewport
      const windowHeight = window.innerHeight;

      if (rect.top < pickerHeight + margin + 50) { // Not enough space above
        top = rect.bottom + margin;
        direction = 'down';
      }
      
      // Ensure bottom of picker doesn't go off screen when pointing down
      if (direction === 'down' && top + pickerHeight > windowHeight - margin) {
        top = windowHeight - pickerHeight - margin;
      }
      
      // Align right edges of picker and button
      let left = rect.right - pickerWidth;
      
      // Ensure it doesn't go off-screen to the left
      if (left < margin) {
        left = margin;
      }
      
      // Ensure it doesn't go off-screen to the right
      if (left + pickerWidth > window.innerWidth - margin) {
        left = window.innerWidth - pickerWidth - margin;
      }

      setPickerPosition({ top, left });
    }
  }, [showEmojiPicker, isThread]);

  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (emojiPickerRef.current && !emojiPickerRef.current.contains(e.target as Node) && 
          actionButtonRef.current && !actionButtonRef.current.contains(e.target as Node)) {
        setShowEmojiPicker(false);
      }
    };
    if (showEmojiPicker) {
      document.addEventListener('mousedown', handleClickOutside);
    }
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [showEmojiPicker]);

  const toggleReaction = async (key: string) => {
    if (!client || isRedacted) return;
    const roomId = event.getRoomId();
    const eventId = event.getId();
    if (!roomId || !eventId) return;

    const reaction = reactions[key];
    if (reaction?.me) {
      // Find my reaction event and redact it to "remove" the reaction
      const room = client.getRoom(roomId) as unknown as IMatrixRoom | null;
      if (!room || !room.relations) return;

      const relations = room.relations.getChildEventsForEvent(
        eventId, 
        RelationType.Annotation, 
        EventType.Reaction
      );

      const myReactionEvent = relations?.getRelations().find((rel: MatrixEvent) => 
        rel.getSender() === userId && 
        rel.getRelation()?.key === key && 
        !rel.isRedacted()
      );
      
      if (myReactionEvent) {
        await client.redactEvent(roomId, myReactionEvent.getId()!);
      }
    } else {
      // Send a new reaction event
      const reactionContent = {
        'm.relates_to': {
          rel_type: RelationType.Annotation,
          event_id: eventId,
          key: key,
        },
      };
      
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      await client.sendEvent(roomId, EventType.Reaction, reactionContent as any);
    }
  };

  const onEmojiClick = (emojiData: EmojiClickData) => {
    toggleReaction(emojiData.emoji);
    setShowEmojiPicker(false);
  };

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

    const isHighlighted = highlightedEventId === event.getId();

    if (text) {
      return (
        <div 
          id={"message-" + event.getId()}
          className={cn(
            "group relative flex items-center px-4 py-0.5 transition-all border-l-2 border-transparent hover:border-border-main",
            isHighlighted ? "bg-accent-primary/20 border-l-accent-primary animate-pulse duration-1000" : "hover:bg-bg-hover/30"
          )}
        >
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

    const isHighlighted = highlightedEventId === event.getId();

    return (
      <div 
        id={"message-" + event.getId()}
        className={cn(
          "group relative mt-2 flex px-4 py-3 transition-all border border-border-main/50 rounded-xl mx-4",
          isHighlighted ? "bg-accent-primary/20 border-accent-primary animate-pulse duration-1000" : "bg-bg-nav/20 hover:bg-bg-hover"
        )}
      >
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

  const isDecryptionFailure = event.isDecryptionFailure();
  // @ts-expect-error - internal property access check for undecrypted events
  const isUndecrypted = event.isEncrypted() && !event.clearEvent;
  
  let body: React.ReactNode = isRedacted ? 'This message was deleted.' : content.body;
  
  if (isDecryptionFailure || isUndecrypted) {
    const showWaiting = isUndecrypted || !isVerified;
    body = (
      <div className={cn(
        "flex items-center space-x-2 px-2 py-1 rounded border w-fit",
        showWaiting 
          ? "text-text-muted bg-bg-nav border-border-main animate-pulse" 
          : "text-red-400 bg-red-500/10 border-red-500/20"
      )}>
        {showWaiting ? <Lock className="h-3 w-3" /> : <AlertCircle className="h-3 w-3" />}
        <span className="text-xs font-medium italic">
          {showWaiting ? "Waiting for security key..." : "Decryption error"}
        </span>
      </div>
    );
  }
  
  let media = null;
  const isImage = !isRedacted && !isUndecrypted && (content.msgtype === 'm.image' || content.msgtype === 'm.sticker');
  const isVideo = !isRedacted && !isUndecrypted && content.msgtype === 'm.video';
  const isFile = !isRedacted && !isUndecrypted && content.msgtype === 'm.file';

  if ((isImage || isVideo || isFile) && (content.url || content.file)) {
    media = (
      <DecryptedMedia
        file={content.file}
        mxcUrl={content.url}
        type={content.msgtype === 'm.video' ? 'video' : content.msgtype === 'm.sticker' ? 'sticker' : content.msgtype === 'm.file' ? 'file' : 'image'}
        alt={typeof body === 'string' ? body : ''}
        thumbnailUrl={content.info?.thumbnail_url || content.info?.thumbnail_file?.url}
        filename={content.info?.filename || (typeof body === 'string' ? body : '') || (content.file && content.file.name)}
        filesize={content.info?.size || (content.file && content.file.size)}
      />
    );
  }
  // If we have media and the body is just the filename, we can skip rendering the body text
  const shouldShowBody = !isRedacted && (!media || (body && typeof body === 'string' && body !== content.info?.filename && body !== content.file?.name) || isUndecrypted || isDecryptionFailure);

  const relatesTo = (content['m.relates_to'] || {}) as unknown as Record<string, unknown>;
  const isReply = !!relatesTo['m.in_reply_to'] && !relatesTo['m.thread'];
  const replyEventId = (relatesTo['m.in_reply_to'] as Record<string, string>)?.event_id;
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

  const renderBodyWithLinks = (text: React.ReactNode) => {
    if (!text || typeof text !== 'string') return text;
    
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
const isHighlighted = highlightedEventId === event.getId();

  return (
    <div
      id={"message-" + event.getId()}
      onMouseLeave={() => setShowEmojiPicker(false)}
      className={cn(
        "group relative flex px-4 transition-all border-l-2 border-transparent",
        isContinuation ? "py-0.5" : "mt-4 py-1",
        isEdited && "bg-accent-primary/5 border-l-accent-primary/30",
        isHighlighted ? "bg-accent-primary/20 border-l-accent-primary animate-pulse duration-1000" : "hover:bg-bg-hover/20 hover:border-accent-primary/20"
      )}
    >
      {/* Context Actions */}
      <div className="absolute -top-4 right-4 z-10 flex items-center space-x-0.5 rounded-lg bg-bg-sidebar border border-border-main p-0.5 opacity-0 shadow-xl group-hover:opacity-100 transition-all duration-100">
        <div className="relative">
          <button 
            ref={actionButtonRef}
            onClick={() => setShowEmojiPicker(!showEmojiPicker)}
            className={cn(
              "p-1.5 rounded transition",
              showEmojiPicker ? "bg-accent-primary text-bg-main" : "text-text-muted hover:bg-bg-hover hover:text-white"
            )} 
            title="Add Reaction"
          >
            <Smile className="h-4 w-4" />
          </button>
          {showEmojiPicker && createPortal(
            <div 
              ref={emojiPickerRef} 
              className={cn(
                "fixed z-[9999] animate-in fade-in zoom-in-95 duration-100 shadow-2xl",
              )}
              style={{
                top: pickerPosition.top,
                left: pickerPosition.left,
                width: isThread ? 280 : 350
              }}
            >
              <EmojiPicker 
                onEmojiClick={onEmojiClick} 
                theme={emojiTheme}
                autoFocusSearch={false}
                lazyLoadEmojis={true}
                width="100%"
                height={400}
                style={{
                  '--epr-bg-color': themeConfig.colors['bg-nav'],
                  '--epr-category-label-bg-color': themeConfig.colors['bg-nav'],
                  '--epr-text-color': themeConfig.colors['text-main'],
                  '--epr-search-input-bg-color': themeConfig.colors['bg-main'],
                  '--epr-search-input-text-color': themeConfig.colors['text-main'],
                  '--epr-search-input-placeholder-color': themeConfig.colors['text-muted'],
                  '--epr-highlight-color': themeConfig.colors['accent-primary'],
                  '--epr-border-color': themeConfig.colors['border-main'],
                  '--epr-picker-border-radius': '8px',
                  '--epr-category-icon-active-color': themeConfig.colors['accent-primary'],
                } as React.CSSProperties}
              />
            </div>,
            document.body
          )}
        </div>
        {!isThreadRoot && !isThread && (
          <button 
            onClick={() => setThreadOpen(true, event.getId())}
            className="p-1.5 text-text-muted hover:bg-bg-hover hover:text-white rounded transition" 
            title="Reply in Thread"
          >
            <MessageSquare className="h-4 w-4" />
          </button>
        )}
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
        <button 
          disabled={pinLoading}
          onClick={() => isEventPinned(event.getId() || '') ? unpinEvent(event.getId()!) : pinEvent(event.getId()!)}
          className={cn(
            "p-1.5 rounded transition",
            isEventPinned(event.getId() || '') ? "text-accent-primary bg-accent-primary/10 shadow-sm" : "text-text-muted hover:bg-bg-hover hover:text-white",
            pinLoading && "opacity-50 cursor-not-allowed"
          )} 
          title={isEventPinned(event.getId() || '') ? "Unpin" : "Pin"}
        >
          {pinLoading ? (
            <Loader2 className="h-4 w-4 animate-spin" />
          ) : (
            <Pin className={cn("h-4 w-4", isEventPinned(event.getId() || '') && "fill-current")} />
          )}
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
        <div className="mr-4 flex w-10 shrink-0 flex-col items-center">
          <span className="opacity-0 group-hover:opacity-100 text-[9px] text-text-muted font-mono mt-1 transition-opacity">
            {timestamp}
          </span>
          {readReceipts.length > 0 && (
            <div className="flex -space-x-1 mt-1 opacity-40 group-hover:opacity-100 transition-opacity">
               {readReceipts.slice(0, 3).map(receipt => (
                  <div key={receipt.userId} className="h-3.5 w-3.5 rounded-full border border-bg-main bg-bg-nav overflow-hidden" title={`Read by ${receipt.name}`}>
                    {receipt.avatarUrl ? (
                      <img src={receipt.avatarUrl} alt="" className="h-full w-full object-cover" />
                    ) : (
                      <div className="flex h-full w-full items-center justify-center text-[5px] bg-bg-nav text-text-muted">{receipt.name.charAt(0)}</div>
                    )}
                  </div>
                ))}
            </div>
          )}
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
            {/* Read Receipts */}
            {readReceipts.length > 0 && (
              <div className="flex -space-x-1 overflow-hidden opacity-40 hover:opacity-100 transition-opacity">
                {readReceipts.slice(0, 5).map(receipt => (
                  <div key={receipt.userId} className="h-4 w-4 rounded-full border border-bg-main bg-bg-nav overflow-hidden" title={`Read by ${receipt.name}`}>
                    {receipt.avatarUrl ? (
                      <img src={receipt.avatarUrl} alt="" className="h-full w-full object-cover" />
                    ) : (
                      <div className="flex h-full w-full items-center justify-center text-[6px] bg-bg-nav text-text-muted">{receipt.name.charAt(0)}</div>
                    )}
                  </div>
                ))}
                {readReceipts.length > 5 && (
                  <div className="flex h-4 w-4 items-center justify-center rounded-full border border-bg-main bg-bg-nav text-[6px] text-text-muted font-bold" title={`${readReceipts.length - 5} more`}>
                    +{readReceipts.length - 5}
                  </div>
                )}
              </div>
            )}
          </div>
        )}

        {isReply && replyEvent && !isThread && (
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
          {shouldShowBody && (
            <div className={cn(
              "text-sm leading-relaxed tracking-tight",
              isRedacted ? "text-text-muted italic opacity-50" : "text-text-main",
              status === EventStatus.SENDING ? "opacity-50" : ""
            )}>
              {isRedacted ? body : renderBodyWithLinks(body)}
              {isEdited && (
                <span className="ml-1 text-[9px] text-text-muted select-none uppercase tracking-tighter font-bold opacity-60">(edited)</span>
              )}
            </div>
          )}
          {media}

          {/* Reactions */}
          {Object.keys(reactions).length > 0 && (
            <div className="mt-1.5 flex flex-wrap gap-1">
              {Object.entries(reactions).map(([key, data]) => (
                <button
                  key={key}
                  onClick={() => toggleReaction(key)}
                  className={cn(
                    "flex items-center space-x-1.5 rounded-md px-1.5 py-0.5 text-xs transition-all border",
                    data.me 
                      ? "bg-accent-primary/10 border-accent-primary text-accent-primary shadow-sm" 
                      : "bg-bg-nav border-border-main text-text-muted hover:border-text-muted"
                  )}
                  title={`${data.count} reaction${data.count > 1 ? 's' : ''}`}
                >
                  <span className="text-[13px]">{key}</span>
                  <span className={cn("text-[10px] font-black", data.me ? "text-accent-primary" : "text-text-muted")}>
                    {data.count}
                  </span>
                </button>
              ))}
            </div>
          )}

          {/* Thread Summary */}
          {!isThreadRoot && !isThread && threadReplyCount > 0 && (
            <button 
              onClick={() => setThreadOpen(true, event.getId())}
              className="mt-2 flex items-center space-x-2 group/thread w-full max-w-sm rounded-lg border border-border-main bg-bg-nav/30 p-2 transition hover:bg-bg-nav/50 hover:border-accent-primary/30"
            >
              <div className="flex -space-x-2 overflow-hidden shrink-0">
                {latestReply && (
                  <div className="h-6 w-6 rounded-full border-2 border-bg-main bg-bg-sidebar overflow-hidden">
                    {client && latestReply.sender?.getAvatarUrl(client.getHomeserverUrl(), 24, 24, 'crop', undefined, true) ? (
                      <img src={latestReply.sender.getAvatarUrl(client.getHomeserverUrl(), 24, 24, 'crop', undefined, true)!} alt="" className="h-full w-full object-cover" />
                    ) : (
                      <div className="flex h-full w-full items-center justify-center text-[8px] font-bold text-text-muted">
                        {latestReply.sender?.name?.charAt(0) || '?'}
                      </div>
                    )}
                  </div>
                )}
              </div>
              <span className="text-xs font-bold text-accent-primary group-hover/thread:underline">
                {threadReplyCount} {threadReplyCount === 1 ? 'reply' : 'replies'}
              </span>
              <span className="text-[10px] text-text-muted truncate">
                Last reply {latestReply ? new Date(latestReply.getTs()).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : ''}
              </span>
            </button>
          )}
        </div>
      </div>
    </div>
  );
};

export default MessageItem;
