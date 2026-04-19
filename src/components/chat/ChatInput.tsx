import React, { useState, useRef, useEffect, useCallback } from 'react';
import { MsgType, RelationType, type IEventRelation } from 'matrix-js-sdk';
import { useMatrixClient } from '../../hooks/useMatrixClient';
import { useAppStore } from '../../store/useAppStore';
import { 
  PlusCircle, StickyNote, Smile, ShieldAlert, X, Reply, Pencil, Loader2, 
  Bold, Italic, Code, Link as LinkIcon, List, ListOrdered, Quote, Type, 
  ChevronDown, ChevronUp 
} from 'lucide-react';
import EmojiPicker, { Theme, type EmojiClickData } from 'emoji-picker-react';
import StickerPicker from './StickerPicker';
import type { Sticker } from '../../hooks/useStickerPacks';
import { useFileUpload } from '../../hooks/useFileUpload';
import { markdownToHtml } from '../../utils/markdown';

interface ChatInputProps {
  roomId: string;
  roomName: string;
  threadId?: string | null;
}

// Custom interface for message content to satisfy SDK and linter
interface IMessageContent {
  msgtype: string;
  body: string;
  format?: string;
  formatted_body?: string;
  url?: string;
  info?: Record<string, unknown>;
  "m.new_content"?: {
    msgtype: string;
    body: string;
    format?: string;
    formatted_body?: string;
  };
  "m.relates_to"?: IEventRelation & {
    is_falling_back?: boolean;
  };
}

const ChatInput: React.FC<ChatInputProps> = ({ roomId, roomName, threadId = null }) => {
  const [message, setMessage] = useState('');
  const [showEmojiPicker, setShowEmojiPicker] = useState(false);
  const [showStickerPicker, setShowStickerPicker] = useState(false);
  const [showFormatting, setShowFormatting] = useState(false);
  const client = useMatrixClient();
  const inputRef = useRef<HTMLTextAreaElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const lastTypingEventTime = useRef<number>(0);
  const { editingEvent, setEditingEvent, replyingToEvent, setReplyingToEvent, themeConfig } = useAppStore();
  
  const { uploadFile, isUploading, uploadProgress } = useFileUpload(client, roomId);

  const sendTypingStatus = useCallback((isTyping: boolean) => {
    if (!client || !roomId) return;

    const now = Date.now();
    // Throttle: only send true if 4s passed since last event, or if we're stopping
    if (isTyping && now - lastTypingEventTime.current < 4000) return;

    client.sendTyping(roomId, isTyping, 30000).catch(() => {
      // Ignore errors
    });

    if (isTyping) lastTypingEventTime.current = now;
  }, [client, roomId]);

  const emojiTheme = (
    themeConfig.activePreset === 'icebox' || 
    themeConfig.activePreset === 'protanopia-light' || 
    themeConfig.activePreset === 'deuteranopia-light' || 
    themeConfig.activePreset === 'tritanopia-light' || 
    themeConfig.activePreset === 'high-contrast-light'
  ) ? Theme.LIGHT : Theme.DARK;

  useEffect(() => {
    if (editingEvent) {
      const timer = setTimeout(() => {
        setMessage(editingEvent.getContent().body || '');
        inputRef.current?.focus();
      }, 0);
      return () => clearTimeout(timer);
    } else if (replyingToEvent) {
      inputRef.current?.focus();
    }
  }, [editingEvent, replyingToEvent]);

  // Auto-resize textarea
  useEffect(() => {
    if (inputRef.current) {
      inputRef.current.style.height = 'auto';
      // Calculate max height for ~6 lines (approx 20px per line + padding)
      const maxHeight = 144; // 24px * 6
      const scrollHeight = inputRef.current.scrollHeight;
      inputRef.current.style.height = `${Math.min(scrollHeight, maxHeight)}px`;
      inputRef.current.style.overflowY = scrollHeight > maxHeight ? 'auto' : 'hidden';
    }
  }, [message]);

  const insertFormatting = (prefix: string, suffix: string = prefix) => {
    if (!inputRef.current) return;
    
    const start = inputRef.current.selectionStart || 0;
    const end = inputRef.current.selectionEnd || 0;
    const selectedText = message.substring(start, end);
    const before = message.substring(0, start);
    const after = message.substring(end);
    
    const newText = `${before}${prefix}${selectedText}${suffix}${after}`;
    setMessage(newText);
    
    // Set focus back and adjust selection
    setTimeout(() => {
      if (inputRef.current) {
        inputRef.current.focus();
        const newCursorPos = start + prefix.length + selectedText.length + suffix.length;
        inputRef.current.setSelectionRange(newCursorPos, newCursorPos);
      }
    }, 0);
  };

  const handleSubmit = (e?: React.FormEvent) => {
    e?.preventDefault();
    if (!message.trim() || !client) return;

    // Stop typing indicator immediately
    sendTypingStatus(false);

    const formattedBody = markdownToHtml(message);
    const hasFormatting = formattedBody !== message;

    if (editingEvent) {
      const originalBody = editingEvent.getContent().body;
      if (message.trim() !== originalBody) {
        const content: IMessageContent = {
          "m.new_content": {
            "msgtype": MsgType.Text,
            "body": message
          },
          "m.relates_to": {
            "rel_type": RelationType.Replace,
            "event_id": editingEvent.getId()!
          },
          "msgtype": MsgType.Text,
          "body": ` * ${message}`
        };

        if (hasFormatting) {
          content["m.new_content"]!.format = "org.matrix.custom.html";
          content["m.new_content"]!.formatted_body = formattedBody;
          content.format = "org.matrix.custom.html";
          content.formatted_body = ` * ${formattedBody}`;
        }

        // Use unknown to any cast only where strictly necessary for SDK interaction
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        client.sendMessage(roomId, threadId, content as any);
      }
      setEditingEvent(null);
    } else {
      const content: IMessageContent = {
        msgtype: MsgType.Text,
        body: message,
      };

      if (hasFormatting) {
        content.format = "org.matrix.custom.html";
        content.formatted_body = formattedBody;
      }

      if (threadId) {
        content['m.relates_to'] = {
          rel_type: RelationType.Thread,
          event_id: threadId,
          'm.in_reply_to': {
            event_id: replyingToEvent ? replyingToEvent.getId()! : threadId,
          },
          is_falling_back: !replyingToEvent
        };
      } else if (replyingToEvent) {
        content['m.relates_to'] = {
          'm.in_reply_to': {
            event_id: replyingToEvent.getId()!,
          },
        };
      }

      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      client.sendMessage(roomId, threadId, content as any);
      setReplyingToEvent(null);
    }
    
    setMessage('');
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSubmit();
    } else {
      // Any other key means we are typing
      sendTypingStatus(true);
    }
  };

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    try {
      await uploadFile(file);
    } catch {
      alert("Failed to upload file");
    } finally {
      if (fileInputRef.current) fileInputRef.current.value = '';
    }
  };

  const onEmojiClick = (emojiData: EmojiClickData) => {
    setMessage((prev) => prev + emojiData.emoji);
    setShowEmojiPicker(false);
    inputRef.current?.focus();
  };

  const handleStickerClick = useCallback((sticker: Sticker) => {
    if (!client) return;
    
    const content: IMessageContent = {
      msgtype: 'm.sticker',
      body: sticker.body,
      url: sticker.url,
      info: {
        w: sticker.info?.w,
        h: sticker.info?.h,
        mimetype: sticker.info?.mimetype,
        size: sticker.info?.size,
      }
    };

    if (threadId) {
      content['m.relates_to'] = {
        rel_type: RelationType.Thread,
        event_id: threadId,
        'm.in_reply_to': {
          event_id: threadId
        }
      };
    }

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    client.sendMessage(roomId, threadId, content as any);
    setShowStickerPicker(false);
  }, [client, roomId, threadId]);

  const isEncrypted = client?.isRoomEncrypted(roomId);

  return (
    <div className={`px-4 pb-6 ${threadId ? 'bg-bg-sidebar' : 'bg-bg-main'}`}>
      <input 
        type="file" 
        ref={fileInputRef} 
        className="hidden" 
        onChange={handleFileUpload}
      />
      
      {replyingToEvent && (
        <div className="flex items-center justify-between bg-bg-nav px-4 py-2 rounded-t-lg border-x border-t border-border-main animate-in slide-in-from-bottom-2 duration-200">
          <div className="flex items-center space-x-2 overflow-hidden">
            <Reply className="h-3 w-3 text-text-muted shrink-0" />
            <span className="text-xs text-text-muted shrink-0">Replying to</span>
            <span className="text-xs font-bold text-white truncate">
              {replyingToEvent.sender?.name || replyingToEvent.getSender()}
            </span>
          </div>
          <button onClick={() => setReplyingToEvent(null)} className="text-text-muted hover:text-white">
            <X className="h-4 w-4" />
          </button>
        </div>
      )}

      {editingEvent && (
        <div className="flex items-center justify-between bg-accent-primary/5 px-4 py-2 rounded-t-lg border-x border-t border-accent-primary/30 animate-in slide-in-from-bottom-2 duration-200">
          <div className="flex items-center space-x-2 overflow-hidden">
            <Pencil className="h-3 w-3 text-accent-primary shrink-0" />
            <span className="text-xs text-accent-primary font-bold uppercase tracking-widest shrink-0">Editing Message</span>
          </div>
          <button onClick={() => setEditingEvent(null)} className="text-text-muted hover:text-white">
            <X className="h-4 w-4" />
          </button>
        </div>
      )}

      <div className={`flex flex-col rounded-lg bg-bg-nav border border-border-main transition-all ${editingEvent ? 'rounded-t-none border-accent-primary/30 shadow-[0_0_15px_rgba(255,255,255,0.05)]' : replyingToEvent ? 'rounded-t-none' : 'focus-within:border-accent-primary/50 shadow-sm'}`}>
        {/* Formatting Ribbon */}
        {showFormatting && (
          <div className="flex items-center space-x-1 border-b border-border-main/30 px-2 py-1.5 animate-in slide-in-from-top-2 duration-200 overflow-x-auto no-scrollbar">
            <button type="button" onClick={() => insertFormatting('**')} className="p-1.5 text-text-muted hover:bg-bg-hover hover:text-accent-primary rounded transition" title="Bold"><Bold className="h-3.5 w-3.5" /></button>
            <button type="button" onClick={() => insertFormatting('*')} className="p-1.5 text-text-muted hover:bg-bg-hover hover:text-accent-primary rounded transition" title="Italic"><Italic className="h-3.5 w-3.5" /></button>
            <button type="button" onClick={() => insertFormatting('`')} className="p-1.5 text-text-muted hover:bg-bg-hover hover:text-accent-primary rounded transition" title="Code"><Code className="h-3.5 w-3.5" /></button>
            <button type="button" onClick={() => insertFormatting('[text](url)')} className="p-1.5 text-text-muted hover:bg-bg-hover hover:text-accent-primary rounded transition" title="Link"><LinkIcon className="h-3.5 w-3.5" /></button>
            <div className="w-px h-4 bg-border-main mx-1" />
            <button type="button" onClick={() => insertFormatting('- ')} className="p-1.5 text-text-muted hover:bg-bg-hover hover:text-accent-primary rounded transition" title="List"><List className="h-3.5 w-3.5" /></button>
            <button type="button" onClick={() => insertFormatting('1. ')} className="p-1.5 text-text-muted hover:bg-bg-hover hover:text-accent-primary rounded transition" title="Ordered List"><ListOrdered className="h-3.5 w-3.5" /></button>
            <button type="button" onClick={() => insertFormatting('> ')} className="p-1.5 text-text-muted hover:bg-bg-hover hover:text-accent-primary rounded transition" title="Quote"><Quote className="h-3.5 w-3.5" /></button>
            <button type="button" onClick={() => insertFormatting('### ')} className="p-1.5 text-text-muted hover:bg-bg-hover hover:text-accent-primary rounded transition" title="Heading"><Type className="h-3.5 w-3.5" /></button>
          </div>
        )}

        <form onSubmit={handleSubmit} className="flex items-center px-4 py-2">
          {!threadId && (
            <button 
              type="button" 
              onClick={() => fileInputRef.current?.click()}
              disabled={isUploading}
              className="mr-4 text-text-muted hover:text-accent-primary transition disabled:opacity-50 relative"
              title="Share a file"
            >
              {isUploading ? (
                <div className="relative flex items-center justify-center">
                  <Loader2 className="h-6 w-6 animate-spin" />
                  <span className="absolute text-[8px] font-bold">{uploadProgress}%</span>
                </div>
              ) : <PlusCircle className="h-6 w-6" />}
            </button>
          )}
          
          <div className="flex flex-1 flex-col py-1">
            <textarea
              ref={inputRef}
              rows={1}
              value={message}
              onChange={(e) => setMessage(e.target.value)}
              onKeyDown={handleKeyDown}
              placeholder={editingEvent ? "Save changes..." : threadId ? "Reply to thread..." : `Message #${roomName}`}
              className="bg-transparent text-sm text-text-main outline-none placeholder:text-text-muted/50 font-medium resize-none max-h-36 overflow-y-auto no-scrollbar"
            />
            {isEncrypted && (
              <div className="flex items-center space-x-1 mt-0.5 opacity-40">
                <ShieldAlert className="h-2.5 w-2.5 text-accent-primary" />
                <span className="text-[8px] font-black uppercase tracking-tighter text-accent-primary">E2EE Active</span>
              </div>
            )}
          </div>

          <div className="ml-4 flex items-center space-x-3 text-text-muted">
            <button 
               type="button" 
               onClick={() => setShowFormatting(!showFormatting)}
               className={`transition ${showFormatting ? 'text-accent-primary' : 'hover:text-text-main'}`}
               title="Text Formatting"
             >
               {showFormatting ? <ChevronDown className="h-5 w-5" /> : <ChevronUp className="h-5 w-5" />}
             </button>

             <button 
               type="button" 
               onClick={() => {
                 setShowStickerPicker(!showStickerPicker);
                 setShowEmojiPicker(false);
               }}
               className={`transition ${showStickerPicker ? 'text-accent-primary' : 'hover:text-text-main'}`}
             >
               <StickyNote className="h-6 w-6" />
             </button>
             
             <div className="relative">
               {showStickerPicker && (
                 <div className="absolute bottom-full right-0 mb-4 z-50">
                   <StickerPicker onSelect={handleStickerClick} />
                 </div>
               )}
               {showEmojiPicker && (
                 <div className="absolute bottom-full right-0 mb-4 z-50">
                   <EmojiPicker 
                     onEmojiClick={onEmojiClick} 
                     theme={emojiTheme}
                     autoFocusSearch={false}
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
                 </div>
               )}
             </div>

             <button 
               type="button" 
               onClick={() => {
                 setShowEmojiPicker(!showEmojiPicker);
                 setShowStickerPicker(false);
               }}
               className={`transition ${showEmojiPicker ? 'text-accent-primary' : 'hover:text-text-main'}`}
             >
               <Smile className="h-6 w-6" />
             </button>
          </div>
        </form>
      </div>
    </div>
  );
};

export default ChatInput;
