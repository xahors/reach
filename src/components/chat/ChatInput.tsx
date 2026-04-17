import React, { useState, useRef, useEffect, useCallback } from 'react';
import { MsgType, RelationType, type IEventRelation } from 'matrix-js-sdk';
import { useMatrixClient } from '../../hooks/useMatrixClient';
import { useAppStore } from '../../store/useAppStore';
import { PlusCircle, StickyNote, Smile, ShieldAlert, X, Reply, Pencil, Loader2 } from 'lucide-react';
import EmojiPicker, { Theme, type EmojiClickData } from 'emoji-picker-react';
import StickerPicker from './StickerPicker';
import type { Sticker } from '../../hooks/useStickerPacks';
import { useFileUpload } from '../../hooks/useFileUpload';

interface ChatInputProps {
  roomId: string;
  roomName: string;
  threadId?: string | null;
}

// Custom interface for message content to satisfy SDK and linter
interface IMessageContent {
  msgtype: string;
  body: string;
  url?: string;
  info?: Record<string, unknown>;
  "m.new_content"?: {
    msgtype: string;
    body: string;
  };
  "m.relates_to"?: IEventRelation & {
    is_falling_back?: boolean;
  };
}

const ChatInput: React.FC<ChatInputProps> = ({ roomId, roomName, threadId = null }) => {
  const [message, setMessage] = useState('');
  const [showEmojiPicker, setShowEmojiPicker] = useState(false);
  const [showStickerPicker, setShowStickerPicker] = useState(false);
  const client = useMatrixClient();
  const inputRef = useRef<HTMLInputElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const { editingEvent, setEditingEvent, replyingToEvent, setReplyingToEvent, themeConfig } = useAppStore();
  
  const { uploadFile, isUploading, uploadProgress } = useFileUpload(client, roomId);

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

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!message.trim() || !client) return;

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

      <form 
        onSubmit={handleSubmit}
        className={`flex items-center rounded-lg bg-bg-nav px-4 py-2 border border-border-main transition-all ${editingEvent ? 'rounded-t-none border-accent-primary/30 shadow-[0_0_15px_rgba(255,255,255,0.05)]' : replyingToEvent ? 'rounded-t-none' : 'focus-within:border-accent-primary/50 shadow-sm'}`}
      >
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
        
        <div className="flex flex-1 flex-col">
          <input
            ref={inputRef}
            type="text"
            value={message}
            onChange={(e) => setMessage(e.target.value)}
            placeholder={editingEvent ? "Save changes..." : threadId ? "Reply to thread..." : `Message #${roomName}`}
            className="bg-transparent py-1 text-sm text-text-main outline-none placeholder:text-text-muted/50 font-medium"
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
  );
};

export default ChatInput;
