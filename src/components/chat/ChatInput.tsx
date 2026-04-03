import React, { useState, useRef, useEffect } from 'react';
import { MsgType } from 'matrix-js-sdk';
import { useMatrixClient } from '../../hooks/useMatrixClient';
import { useAppStore } from '../../store/useAppStore';
import { matrixService } from '../../core/matrix';
import { PlusCircle, Gift, StickyNote, Smile, ShieldAlert, X, Reply, Pencil } from 'lucide-react';
import EmojiPicker, { Theme, type EmojiClickData } from 'emoji-picker-react';
import StickerPicker from './StickerPicker';
import type { Sticker } from '../../hooks/useStickerPacks';

interface ChatInputProps {
  roomId: string;
  roomName: string;
}

const ChatInput: React.FC<ChatInputProps> = ({ roomId, roomName }) => {
  const [message, setMessage] = useState('');
  const [showEmojiPicker, setShowEmojiPicker] = useState(false);
  const [showStickerPicker, setShowStickerPicker] = useState(false);
  const [isUploading, setIsUploading] = useState(false);
  const client = useMatrixClient();
  const { 
    setSettingsOpen, 
    editingEvent, 
    setEditingEvent, 
    replyingToEvent, 
    setReplyingToEvent 
  } = useAppStore();
  const [error, setError] = useState<string | null>(null);
  const emojiPickerRef = useRef<HTMLDivElement>(null);
  const stickerPickerRef = useRef<HTMLDivElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (editingEvent) {
      const body = editingEvent.getClearContent()?.body || editingEvent.getContent().body;
      setMessage(body);
      inputRef.current?.focus();
    } else {
      setMessage('');
    }
  }, [editingEvent]);

  useEffect(() => {
    if (replyingToEvent) {
      inputRef.current?.focus();
    }
  }, [replyingToEvent]);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      const target = event.target as Node;
      if (emojiPickerRef.current && !emojiPickerRef.current.contains(target)) {
        setShowEmojiPicker(false);
      }
      if (stickerPickerRef.current && !stickerPickerRef.current.contains(target)) {
        setShowStickerPicker(false);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, []);

  const handleSend = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!message.trim() || !client) return;

    const contentText = message.trim();
    setMessage('');
    setError(null);
    setShowEmojiPicker(false);
    setShowStickerPicker(false);

    try {
      if (editingEvent) {
        const originalEventId = editingEvent.getId();
        const editContent = {
          msgtype: MsgType.Text,
          body: ` * ${contentText}`,
          "m.new_content": {
            msgtype: MsgType.Text,
            body: contentText,
          },
          "m.relates_to": {
            rel_type: "m.replace",
            event_id: originalEventId,
          },
        };
        // @ts-expect-error: raw object might not match deep SDK type
        await client.sendMessage(roomId, editContent);
        setEditingEvent(null);
      } else if (replyingToEvent) {
        const replyContent = {
          msgtype: MsgType.Text,
          body: contentText,
          "m.relates_to": {
            "m.in_reply_to": {
              event_id: replyingToEvent.getId(),
            },
          },
        };
        // @ts-expect-error: raw object might not match deep SDK type
        await client.sendMessage(roomId, replyContent);
        setReplyingToEvent(null);
      } else {
        await client.sendMessage(roomId, {
          msgtype: MsgType.Text,
          body: contentText,
        });
      }
    } catch (err) {
      console.error('Failed to send message:', err);
      setMessage(contentText);
      
      const messageStr = err instanceof Error ? err.message : '';
      if (messageStr.includes('encryption') || !matrixService.isCryptoEnabled()) {
        setError('Encryption required. Please verify your session.');
      } else {
        setError(`Failed to send: ${messageStr || 'Unknown error'}`);
      }
    }
  };

  const handleSendSticker = async (sticker: Sticker) => {
    if (!client || !roomId) return;
    setShowStickerPicker(false);
    
    try {
      // @ts-expect-error: m.sticker is a custom type
      await client.sendEvent(roomId, 'm.sticker', {
        body: sticker.body,
        url: sticker.url,
        info: sticker.info
      });
    } catch (err) {
      console.error('Failed to send sticker:', err);
      setError('Failed to send sticker.');
    }
  };

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !client) return;

    setIsUploading(true);
    setError(null);

    try {
      const result = await client.uploadContent(file, {
        name: file.name,
        type: file.type,
      });

      const mxcUrl = result.content_uri;
      const isImage = file.type.startsWith('image/');
      const isVideo = file.type.startsWith('video/');

      const mediaContent = {
        msgtype: isImage ? MsgType.Image : isVideo ? MsgType.Video : MsgType.File,
        body: file.name,
        url: mxcUrl,
        info: {
          mimetype: file.type,
          size: file.size,
        }
      };
      // @ts-expect-error: raw object might not match deep SDK type
      await client.sendMessage(roomId, mediaContent);
    } catch (err) {
      console.error('File upload failed:', err);
      setError('Failed to upload file. Please try again.');
    } finally {
      setIsUploading(false);
      if (fileInputRef.current) fileInputRef.current.value = '';
    }
  };

  const onEmojiClick = (emojiData: EmojiClickData) => {
    setMessage((prev) => prev + emojiData.emoji);
  };

  return (
    <div className="px-4 pb-6 relative flex flex-col">
      <input 
        type="file" 
        ref={fileInputRef}
        onChange={handleFileUpload}
        className="hidden"
        accept="image/*,video/*"
      />

      {/* Reply/Edit Context Bar */}
      {(editingEvent || replyingToEvent) && (
        <div className="mb-0 flex items-center justify-between rounded-t-lg bg-[#2b2d31] px-4 py-2 text-xs border-b border-discord-hover">
          <div className="flex items-center text-discord-text-muted truncate">
            {editingEvent ? (
              <>
                <Pencil className="mr-2 h-3 w-3" />
                <span className="mr-1">Editing message</span>
              </>
            ) : (
              <>
                <Reply className="mr-2 h-3 w-3" />
                <span className="mr-1">Replying to</span>
                <span className="font-bold text-white truncate">{replyingToEvent?.sender?.name || replyingToEvent?.getSender()}</span>
              </>
            )}
          </div>
          <button 
            onClick={() => {
              setEditingEvent(null);
              setReplyingToEvent(null);
            }}
            className="rounded-full bg-discord-nav p-0.5 hover:bg-discord-hover transition"
          >
            <X className="h-3 w-3 text-discord-text" />
          </button>
        </div>
      )}

      {showEmojiPicker && (
        <div 
          ref={emojiPickerRef}
          className="absolute bottom-20 right-4 z-50"
        >
          <EmojiPicker 
            theme={Theme.DARK}
            onEmojiClick={onEmojiClick}
            autoFocusSearch={false}
          />
        </div>
      )}

      {showStickerPicker && (
        <div 
          ref={stickerPickerRef}
          className="absolute bottom-20 right-4 z-50"
        >
          <StickerPicker onSelect={handleSendSticker} />
        </div>
      )}
      
      {error && (
        <div className="mb-2 flex items-center justify-between rounded bg-red-500/10 p-2 text-xs text-red-400">
          <div className="flex items-center">
            <ShieldAlert className="mr-2 h-4 w-4" />
            <span>{error}</span>
          </div>
          <button 
            onClick={() => setSettingsOpen(true)}
            className="font-bold underline hover:text-red-300"
          >
            Verify Now
          </button>
        </div>
      )}
      <form
        onSubmit={handleSend}
        className={`flex items-center bg-[#383a40] px-4 py-2.5 shadow-sm ${editingEvent || replyingToEvent ? 'rounded-b-lg' : 'rounded-lg'}`}
      >
        <button 
          type="button" 
          disabled={isUploading}
          onClick={() => fileInputRef.current?.click()}
          className={`mr-4 transition ${isUploading ? 'animate-pulse text-discord-accent' : 'text-discord-text-muted hover:text-discord-text'}`}
        >
          <PlusCircle className="h-6 w-6" />
        </button>

        <input
          type="text"
          ref={inputRef}
          value={message}
          onChange={(e) => {
            setMessage(e.target.value);
            if (error) setError(null);
          }}
          placeholder={`Message #${roomName}`}
          className="flex-1 bg-transparent text-base text-discord-text outline-none placeholder:text-discord-text-muted"
        />

        <div className="ml-4 flex items-center space-x-3 text-discord-text-muted">
           <button type="button" className="hover:text-discord-text transition">
             <Gift className="h-6 w-6" />
           </button>
           <button 
             type="button" 
             onClick={() => {
               setShowStickerPicker(!showStickerPicker);
               setShowEmojiPicker(false);
             }}
             className={`transition ${showStickerPicker ? 'text-discord-accent' : 'hover:text-discord-text'}`}
           >
             <StickyNote className="h-6 w-6" />
           </button>
           <button 
             type="button" 
             onClick={() => {
               setShowEmojiPicker(!showEmojiPicker);
               setShowStickerPicker(false);
             }}
             className={`transition ${showEmojiPicker ? 'text-discord-accent' : 'hover:text-discord-text'}`}
           >
             <Smile className="h-6 w-6" />
           </button>
        </div>
      </form>
    </div>
  );
};

export default ChatInput;
