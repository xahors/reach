import React, { useEffect, useRef, useState, useMemo, useCallback } from 'react';
import { MatrixEvent, MatrixEventEvent, EventType, RoomEvent, RelationType, ThreadEvent } from 'matrix-js-sdk';
import { 
  Smile, Reply, Trash2, Edit2, Pin, MessageSquare, 
  ChevronRight, CheckCircle2, Loader2, Info, UserPlus, UserMinus, ShieldOff, Camera, ShieldAlert
} from 'lucide-react';
import { useMatrixClient } from '../../hooks/useMatrixClient';
import { useAppStore } from '../../store/useAppStore';
import { cn } from '../../utils/cn';
import EmojiPicker, { Theme, type EmojiClickData } from 'emoji-picker-react';
import { usePinnedEvents } from '../../hooks/usePinnedEvents';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import rehypeRaw from 'rehype-raw';
import { getRoleColor } from '../../utils/roleColors';

interface MessageItemProps {
  event: MatrixEvent;
  isContinuation?: boolean;
  onJumpToEvent?: (id: string) => void;
  isThreadRoot?: boolean;
  isThread?: boolean;
}

interface IMatrixRoom {
  relations: {
    getChildEventsForEvent(id: string, type: RelationType, eventType: EventType): {
      getRelations(): MatrixEvent[];
    };
  };
}

const MessageItem: React.FC<MessageItemProps> = React.memo(({ 
  event, 
  isContinuation = false, 
  isThread = false
}) => {
  const client = useMatrixClient();
  const { userId, setEditingEvent, setReplyingToEvent, setThreadOpen, themeConfig, highlightedEventId, setUserContextMenu } = useAppStore();
  const { pinEvent, unpinEvent, isEventPinned, loading: pinLoading } = usePinnedEvents(event.getRoomId() || null);
  
  const [tick, setTick] = useState(0);
  const forceUpdate = useCallback(() => setTick(t => t + 1), []);
  const [reactions, setReactions] = useState<Record<string, { count: number, me: boolean, eventIds: string[] }>>({});
  const [threadReplyCount, setThreadReplyCount] = useState(0);
  const [latestReply, setLatestReply] = useState<MatrixEvent | null>(null);
  const [readReceipts, setReadReceipts] = useState<{ userId: string, avatarUrl: string | null, name: string }[]>([]);
  const [isVerified, setIsVerified] = useState(false);
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

  const eventData = useMemo(() => {
    void tick;
    try {
      return {
        sender: event.sender,
        isRedacted: event.isRedacted(),
        isMe: event.getSender() === userId,
        isEdited: !!event.replacingEventId(),
        timestamp: new Date(event.getTs()).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
        fullDate: new Date(event.getTs()).toLocaleString(),
        type: event.getType(),
        content: event.getContent() || {},
        id: event.getId(),
        roomId: event.getRoomId(),
        isState: event.isState()
      };
    } catch (err) {
      console.error("Failed to parse event data:", err);
      return null;
    }
  }, [event, userId, tick]);

  const updateReactions = useCallback(() => {
    if (!client || !eventData?.id || !eventData?.roomId) return;
    const room = client.getRoom(eventData.roomId) as unknown as IMatrixRoom | null;
    if (!room || !room.relations) return;

    const relations = room.relations.getChildEventsForEvent(eventData.id!, RelationType.Annotation, EventType.Reaction);
    if (!relations) {
      setReactions({});
      return;
    }

    const grouped: Record<string, { count: number, me: boolean, eventIds: string[] }> = {};
    relations.getRelations().forEach((rel: MatrixEvent) => {
      if (rel.isRedacted()) return;
      const key = rel.getRelation()?.key;
      if (key) {
        if (!grouped[key]) grouped[key] = { count: 0, me: false, eventIds: [] };
        grouped[key].count++;
        grouped[key].eventIds.push(rel.getId()!);
        if (rel.getSender() === userId) grouped[key].me = true;
      }
    });
    setReactions(grouped);
  }, [client, eventData, userId]);

  const updateThreadInfo = useCallback(() => {
    if (!client || !eventData?.id || !eventData?.roomId) return;
    const room = client.getRoom(eventData.roomId);
    const eventId = eventData.id;
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const thread = (room as any)?.getThread(eventId);
    if (thread) {
      setThreadReplyCount(thread.length);
      setLatestReply(thread.replyToEvent);
    } else {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const rels = (room as any)?.relations?.getChildEventsForEvent(eventId, RelationType.Thread, EventType.RoomMessage)?.getRelations() || [];
      if (rels.length > 0) {
        setThreadReplyCount(rels.length);
        setLatestReply(rels[rels.length - 1]);
      }
    }
  }, [client, eventData]);

  const updateReadReceipts = useCallback(() => {
    const rId = event.getRoomId();
    if (!client || !rId) return;
    const room = client.getRoom(rId);
    if (!room) return;

    const receipts = room.getReceiptsForEvent(event);
    if (!receipts || receipts.length === 0) {
      setReadReceipts([]);
      return;
    }

    const formatted = receipts.map(r => {
      const member = room.getMember(r.userId);
      return {
        userId: r.userId,
        avatarUrl: member?.getAvatarUrl(client.getHomeserverUrl(), 24, 24, 'crop', undefined, true) || null,
        name: member?.name || r.userId
      };
    });

    setReadReceipts(formatted);
  }, [client, event]);

  useEffect(() => {
    if (!client || !eventData || eventData.isRedacted) return;
    const room = client.getRoom(eventData.roomId || '');
    const eventId = eventData.id || '';

    Promise.resolve().then(() => {
      updateReactions();
      updateThreadInfo();
      updateReadReceipts();
    });

    const checkVerification = async () => { setIsVerified(false); };
    checkVerification();

    const onTimeline = (rel: MatrixEvent) => {
      const relation = rel.getRelation();
      if (relation && relation.event_id === eventId) {
        if (relation.rel_type === RelationType.Annotation) updateReactions();
        else if (relation.rel_type === RelationType.Thread) updateThreadInfo();
        else if (relation.rel_type === RelationType.Replace) forceUpdate();
      }
    };

    const onReplaced = () => forceUpdate();
    const onReceipt = () => updateReadReceipts();
    const onRedaction = (redactedEvent: MatrixEvent) => {
        const redactedId = redactedEvent.getAssociatedId() || redactedEvent.getContent().redacts;
        if (redactedId === eventId) {
            updateReactions();
            updateThreadInfo();
            forceUpdate();
        }
    };
    const onThreadUpdate = (thread: unknown) => {
      if ((thread as { id: string }).id === eventId) updateThreadInfo();
    };
    const onDecrypted = (decryptedEvent: MatrixEvent) => {
      if (decryptedEvent.getId() === eventId) forceUpdate();
    };

    if (room) {
      room.on(RoomEvent.Timeline, onTimeline);
      room.on(RoomEvent.Receipt, onReceipt);
      room.on(RoomEvent.Redaction, onRedaction);
      room.on(ThreadEvent.Update, onThreadUpdate);
      room.on(ThreadEvent.NewReply, onThreadUpdate);
    }
    event.on(MatrixEventEvent.Decrypted, onDecrypted);
    event.on(MatrixEventEvent.Replaced, onReplaced);

    return () => {
      if (room) {
        room.removeListener(RoomEvent.Timeline, onTimeline);
        room.removeListener(RoomEvent.Redaction, onRedaction);
        room.removeListener(RoomEvent.Receipt, onReceipt);
        room.removeListener(ThreadEvent.Update, onThreadUpdate);
        room.removeListener(ThreadEvent.NewReply, onThreadUpdate);
      }
      event.removeListener(MatrixEventEvent.Decrypted, onDecrypted);
      event.removeListener(MatrixEventEvent.Replaced, onReplaced);
    };
  }, [client, event, eventData, updateReactions, updateThreadInfo, updateReadReceipts, forceUpdate, userId]);

  React.useLayoutEffect(() => {
    if (!showEmojiPicker || !actionButtonRef.current) return;
    const rect = actionButtonRef.current.getBoundingClientRect();
    const pickerHeight = 450;
    const pickerWidth = 350;
    let top = rect.top - pickerHeight - 10;
    let left = rect.right - pickerWidth;
    if (top < 10) top = rect.bottom + 10;
    if (left < 10) left = 10;
    setPickerPosition({ top, left });
  }, [showEmojiPicker]);

  const onEmojiClick = (emojiData: EmojiClickData) => {
    if (!client || !eventData?.roomId || !eventData?.id) return;
    client.sendEvent(eventData.roomId, EventType.Reaction, {
      "m.relates_to": { rel_type: RelationType.Annotation, event_id: eventData.id, key: emojiData.emoji }
    });
    setShowEmojiPicker(false);
  };

  const handleToggleReaction = (key: string, eventIds: string[]) => {
    if (!client || !eventData?.roomId || !eventData?.id) return;
    const myReaction = reactions[key]?.me;
    if (myReaction) {
      const myEvent = eventIds.find(id => client.getRoom(eventData.roomId!)?.findEventById(id)?.getSender() === userId);
      if (myEvent) client.redactEvent(eventData.roomId, myEvent);
    } else {
      client.sendEvent(eventData.roomId, EventType.Reaction, {
        "m.relates_to": { rel_type: RelationType.Annotation, event_id: eventData.id, key }
      });
    }
  };

  const handleUserClick = (e: React.MouseEvent) => {
    e.preventDefault();
    const rId = event.getRoomId();
    if (!rId) return;
    setUserContextMenu({ userId: event.getSender() || '', roomId: rId, x: e.clientX, y: e.clientY });
  };

  const renderSystemEvent = () => {
    const type = event.getType();
    const senderName = eventData?.sender?.name || event.getSender();
    let text = '';
    let icon = <Info className="h-3 w-3 text-text-muted" />;

    if (type === 'm.room.member') {
      const content = event.getContent();
      const prevContent = event.getPrevContent();
      const membership = content.membership;
      const targetName = content.displayname || event.getStateKey() || 'Unknown User';
      if (membership === 'join') {
        text = prevContent?.membership === 'join' ? `${targetName} changed their display name` : `${targetName} joined the room`;
        icon = <UserPlus className="h-3 w-3 text-green-400" />;
      } else if (membership === 'leave') {
        text = event.getSender() !== event.getStateKey() ? `${senderName} kicked ${targetName}` : `${targetName} left the room`;
        icon = <UserMinus className="h-3 w-3 text-red-400" />;
      } else if (membership === 'invite') {
        text = `${senderName} invited ${targetName}`;
        icon = <UserPlus className="h-3 w-3 text-accent-primary" />;
      } else if (membership === 'ban') {
        text = `${senderName} banned ${targetName}`;
        icon = <ShieldOff className="h-3 w-3 text-red-600" />;
      }
    } else if (type === 'm.room.name') {
      text = `${senderName} changed the room name to "${event.getContent().name}"`;
      icon = <Edit2 className="h-3 w-3 text-accent-primary" />;
    } else if (type === 'm.room.topic') {
      text = `${senderName} changed the room topic`;
      icon = <Info className="h-3 w-3 text-accent-primary" />;
    } else if (type === 'm.room.avatar') {
      text = `${senderName} changed the room avatar`;
      icon = <Camera className="h-3 w-3 text-accent-primary" />;
    } else if (type === 'm.room.power_levels') {
      text = `${senderName} updated the permissions`;
      icon = <ShieldAlert className="h-3 w-3 text-accent-primary" />;
    } else if (type === 'm.room.canonical_alias') {
      text = `${senderName} set the room address`;
    } else if (type === 'm.call.invite') {
      text = `${senderName} started a call`;
      icon = <Info className="h-3 w-3 text-green-400" />;
    } else if (type === 'm.call.answer') {
      text = `${senderName} joined the call`;
      icon = <Info className="h-3 w-3 text-green-400" />;
    } else if (type === 'm.call.hangup' || type === 'm.call.reject') {
      text = `${senderName} left the call`;
      icon = <Info className="h-3 w-3 text-red-400" />;
    }

    if (!text) return null;

    return (
      <div className="flex items-center space-x-3 py-1 px-16 opacity-70 hover:opacity-100 transition-opacity min-h-[32px]">
        <div className="flex h-6 w-10 shrink-0 items-center justify-center">{icon}</div>
        <span className="text-[11px] font-bold text-text-muted tracking-tight leading-relaxed italic">{text}</span>
      </div>
    );
  };

  const renderMessageBody = () => {
    const body = eventData?.content.body || '';
    if (eventData?.content.msgtype === 'm.image' || eventData?.content.msgtype === 'm.file' || eventData?.content.msgtype === 'm.video') return null;
    const markdownComponents = {
      a: ({ ...props }: React.AnchorHTMLAttributes<HTMLAnchorElement>) => <a {...props} target="_blank" rel="noopener noreferrer" className="text-accent-primary hover:underline" />,
      code: ({ inline, ...props }: { inline?: boolean } & React.HTMLAttributes<HTMLElement>) => 
        inline ? <code className="bg-bg-sidebar px-1 rounded text-accent-primary" {...props} />
               : <code className="block bg-bg-sidebar p-2 rounded-lg border border-border-main my-2 overflow-x-auto" {...props} />
    };
    if (eventData?.content.format === 'org.matrix.custom.html' && eventData?.content.formatted_body) {
      return (
        <div className="markdown-content text-sm leading-relaxed text-text-main break-words">
          <ReactMarkdown 
            remarkPlugins={[remarkGfm]} 
            rehypePlugins={[rehypeRaw]} 
            components={markdownComponents}
          >
            {eventData.content.formatted_body}
          </ReactMarkdown>
        </div>
      );
    }
    return (
      <div className="markdown-content text-sm leading-relaxed text-text-main break-words whitespace-pre-wrap">
        <ReactMarkdown 
          remarkPlugins={[remarkGfm]} 
          components={markdownComponents}
        >
          {body}
        </ReactMarkdown>
      </div>
    );
  };

  if (!eventData) return null;

  if (eventData.isRedacted) {
    return <div className="px-16 py-1 opacity-40"><span className="text-xs italic text-text-muted">Message deleted</span></div>;
  }

  const isSystemEvent = eventData.isState || 
    eventData.type === 'm.call.invite' || 
    eventData.type === 'm.call.answer' || 
    eventData.type === 'm.call.hangup' || 
    eventData.type === 'm.call.reject';

  const roleColor = eventData.roomId ? getRoleColor(client?.getRoom(eventData.roomId)?.getMember(event.getSender() || '')?.powerLevel || 0) : undefined;
  const avatarUrl = eventData.sender?.getAvatarUrl(client?.getHomeserverUrl() || '', 40, 40, 'crop', undefined, true);
  const isHighlightedLocal = highlightedEventId === eventData.id;

  const renderReceipts = () => {
    if (readReceipts.length === 0) return null;
    return (
      <div className={cn(
        "absolute right-2 z-20 transition-all duration-300",
        isContinuation ? "top-1" : "bottom-1 h-5"
      )}>
        <div className="flex -space-x-1.5 items-center">
            {readReceipts.slice(0, isContinuation ? 3 : 6).map(r => (
              <div key={r.userId} className={cn(
                "rounded-full border border-white/40 bg-accent-primary flex items-center justify-center overflow-hidden shadow-lg hover:z-30 transition-transform hover:scale-110",
                isContinuation ? "h-3 w-3" : "h-4.5 w-4.5"
              )} title={`Read by ${r.name}`}>
                {r.avatarUrl ? (
                  <img src={r.avatarUrl} alt="" className="h-full w-full object-cover" />
                ) : (
                  <span className={cn(
                    "font-black text-bg-main leading-none",
                    isContinuation ? "text-[5px]" : "text-[7px]"
                  )}>
                    {r.name.charAt(0).toUpperCase()}
                  </span>
                )}
              </div>
            ))}
            {!isContinuation && readReceipts.length > 6 && (
              <div className="flex h-4.5 w-4.5 items-center justify-center rounded-full border border-white/40 bg-bg-nav text-[7px] font-black text-accent-primary shadow-lg" title={`${readReceipts.length - 6} more`}>
                +{readReceipts.length - 6}
              </div>
            )}
        </div>
      </div>
    );
  };

  if (isSystemEvent) {
    return (
      <div id={"message-" + eventData.id} onContextMenu={handleUserClick} className="group relative">
        {renderSystemEvent()}
        {renderReceipts()}
      </div>
    );
  }

  const media = (eventData.content.msgtype === 'm.image' || eventData.content.msgtype === 'm.video' || eventData.content.msgtype === 'm.file' || eventData.type === 'm.sticker') && (
    <div className="mt-2 max-w-sm overflow-hidden rounded-lg border border-border-main/50 bg-bg-sidebar/50 p-1 group/media">
      <div onClick={() => useAppStore.getState().setMediaPreview({ url: eventData.content.url || eventData.content.file?.url || '', type: eventData.content.msgtype === 'm.video' ? 'video' : 'image', alt: typeof eventData.content.body === 'string' ? eventData.content.body : '', file: eventData.content.file })} className="cursor-pointer">
        <div className="bg-bg-nav rounded aspect-video flex items-center justify-center text-text-muted text-xs"><span className="bg-black/50 px-2 py-1 rounded">View {eventData.content.msgtype === 'm.image' ? 'Image' : eventData.content.msgtype === 'm.video' ? 'Video' : 'Media'}</span></div>
      </div>
    </div>
  );

  return (
    <div
      id={"message-" + eventData.id}
      onMouseLeave={() => setShowEmojiPicker(false)}
      onContextMenu={handleUserClick}
      className={cn(
        "group relative flex px-4 transition-all border-l-2 border-transparent",
        isContinuation ? "py-0.5" : "mt-4 py-1",
        isEventPinned(eventData.id || '') && "bg-accent-primary/10 border-l-accent-primary",
        !isEventPinned(eventData.id || '') && eventData.isEdited && "bg-accent-primary/5 border-l-accent-primary/30",
        isHighlightedLocal ? "bg-accent-primary/20 border-l-accent-primary animate-pulse duration-1000" : "hover:bg-bg-hover/20"
      )}
    >
      {!isContinuation ? (
        <div onClick={handleUserClick} className="mr-4 h-10 w-10 shrink-0 cursor-pointer overflow-hidden rounded-full bg-accent-primary flex items-center justify-center text-bg-main font-black shadow-md transition active:scale-95 border border-border-main/50">
          {avatarUrl ? <img src={avatarUrl} alt="" className="h-full w-full object-cover" /> : <span>{eventData.sender?.name?.charAt(0).toUpperCase() || event.getSender()?.charAt(1).toUpperCase()}</span>}
        </div>
      ) : (
        <div className="mr-4 flex w-10 shrink-0 flex-col items-center">
          <span className="opacity-0 group-hover:opacity-100 text-[9px] text-text-muted font-mono mt-1 transition-opacity">{eventData.timestamp}</span>
          {isEventPinned(eventData.id || '') && <Pin className="h-2.5 w-2.5 text-accent-primary fill-current mt-0.5" />}
        </div>
      )}

      <div className="flex flex-1 flex-col overflow-hidden">
        {!isContinuation && (
          <div className="mb-0.5 flex items-baseline space-x-2">
            <span onClick={handleUserClick} className={cn("cursor-pointer text-sm font-black tracking-tight hover:underline", eventData.isMe ? "text-accent-primary" : "text-text-main")} style={roleColor ? { color: roleColor } : undefined}>
              {eventData.sender?.name || event.getSender()}
            </span>
            <span className="text-[10px] font-mono text-text-muted uppercase tracking-tighter" title={eventData.fullDate}>{eventData.timestamp}</span>
            {isEventPinned(eventData.id || '') && <Pin className="h-2.5 w-2.5 text-accent-primary fill-current shrink-0" />}
            {isVerified && <span title="Verified with E2EE"><CheckCircle2 className="h-3 w-3 text-green-400/70" /></span>}
          </div>
        )}

        <div className="relative">
          {eventData.isEdited ? <div className="flex flex-wrap items-baseline gap-x-1">{renderMessageBody()}<span className="text-[10px] text-text-muted opacity-50 select-none">(edited)</span></div> : renderMessageBody()}
          {media}
          {Object.keys(reactions).length > 0 && (
            <div className="mt-1.5 flex flex-wrap gap-1">
              {Object.entries(reactions).map(([key, data]) => (
                <button key={key} onClick={() => handleToggleReaction(key, data.eventIds)} className={cn("flex items-center space-x-1.5 rounded-lg px-2 py-0.5 text-xs font-bold transition-all border", data.me ? "bg-accent-primary/20 border-accent-primary/50 text-accent-primary" : "bg-bg-sidebar border-border-main/50 text-text-muted hover:border-accent-primary/30")}>
                  <span>{key}</span>
                  <span className={cn("text-[10px]", data.me ? "text-accent-primary" : "text-text-muted")}>{data.count}</span>
                </button>
              ))}
            </div>
          )}
          {threadReplyCount > 0 && !isThread && (
            <button onClick={() => setThreadOpen(true, eventData.id!)} className="mt-2 group/thread flex items-center space-x-3 rounded-xl bg-bg-sidebar/30 p-2 hover:bg-bg-sidebar transition-colors border border-border-main/30 w-fit">
              <div className="flex -space-x-1.5 overflow-hidden">
                {latestReply && (
                  <div className="h-6 w-6 rounded-full border-2 border-white/20 bg-bg-sidebar overflow-hidden">
                    {latestReply.sender?.getAvatarUrl(client?.getHomeserverUrl() || '', 16, 16, 'crop', undefined, true) ? <img src={latestReply.sender.getAvatarUrl(client?.getHomeserverUrl() || '', 16, 16, 'crop', undefined, true)!} alt="" className="h-full w-full object-cover" /> : <div className="flex h-full w-full items-center justify-center text-[8px] font-bold text-text-muted">{latestReply.sender?.name?.charAt(0) || '?'}</div>}
                  </div>
                )}
              </div>
              <div className="flex items-center space-x-2">
                <span className="text-xs font-black text-accent-primary uppercase tracking-tighter">{threadReplyCount} {threadReplyCount === 1 ? 'Reply' : 'Replies'}</span>
                <div className="h-1 w-1 rounded-full bg-text-muted opacity-30" />
                <span className="text-[10px] text-text-muted font-bold group-hover/thread:text-text-main transition-colors">Last reply {latestReply ? new Date(latestReply.getTs()).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : ''}</span>
                <ChevronRight className="h-3 w-3 text-text-muted group-hover/thread:translate-x-0.5 transition-transform" />
              </div>
            </button>
          )}
        </div>
      </div>

      <div className="absolute -top-4 right-4 z-10 flex items-center space-x-0.5 rounded-lg bg-bg-sidebar border border-border-main p-0.5 opacity-0 shadow-xl group-hover:opacity-100 transition-all duration-100">
        <div className="relative">
          <button ref={actionButtonRef} onClick={() => setShowEmojiPicker(!showEmojiPicker)} className={cn("p-1.5 rounded transition", showEmojiPicker ? "bg-accent-primary text-bg-main" : "text-text-muted hover:bg-bg-hover hover:text-white")} title="Add Reaction"><Smile className="h-4 w-4" /></button>
          {showEmojiPicker && (
            <div ref={emojiPickerRef} className="fixed z-[100] shadow-2xl" style={{ top: pickerPosition.top, left: pickerPosition.left }}>
              <EmojiPicker theme={emojiTheme} onEmojiClick={onEmojiClick} autoFocusSearch={false} />
            </div>
          )}
        </div>
        <button onClick={() => setReplyingToEvent(event)} className="p-1.5 text-text-muted hover:bg-bg-hover hover:text-white rounded transition" title="Reply"><Reply className="h-4 w-4" /></button>
        <button onClick={() => setThreadOpen(true, eventData.id!)} className="p-1.5 text-text-muted hover:bg-bg-hover hover:text-white rounded transition" title="Reply in Thread"><MessageSquare className="h-4 w-4" /></button>
        {eventData.isMe && <button onClick={() => setEditingEvent(event)} className="p-1.5 text-text-muted hover:bg-bg-hover hover:text-white rounded transition" title="Edit"><Edit2 className="h-4 w-4" /></button>}
        <button onClick={() => isEventPinned(eventData.id || '') ? unpinEvent(eventData.id || '') : pinEvent(eventData.id || '')} disabled={pinLoading} className={cn("p-1.5 rounded transition", isEventPinned(eventData.id || '') ? "text-accent-primary bg-accent-primary/10" : "text-text-muted hover:bg-bg-hover hover:text-white")} title={isEventPinned(eventData.id || '') ? "Unpin" : "Pin"}>{pinLoading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Pin className={cn("h-4 w-4", isEventPinned(eventData.id || '') && "fill-current")} />}</button>
        <button className="p-1.5 text-red-400 hover:bg-red-500/20 rounded transition" title="Delete"><Trash2 className="h-4 w-4" /></button>
      </div>
      
      {renderReceipts()}
    </div>
  );
}, (prevProps, nextProps) => {
  return (
    prevProps.event.getId() === nextProps.event.getId() &&
    prevProps.isContinuation === nextProps.isContinuation &&
    prevProps.isThread === nextProps.isThread &&
    prevProps.event.getContent().body === nextProps.event.getContent().body &&
    prevProps.event.isRedacted() === nextProps.event.isRedacted()
  );
});

export default MessageItem;
