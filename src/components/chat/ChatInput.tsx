import React, { useState, useRef, useEffect, useCallback } from 'react';
import { MsgType, type RoomMember } from 'matrix-js-sdk';
import { useMatrixClient } from '../../hooks/useMatrixClient';
import { useAppStore } from '../../store/useAppStore';
import { useRoomMembers } from '../../hooks/useRoomMembers';
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
  
  // Mention state
  const { members } = useRoomMembers(roomId);
  const [mentionFilter, setMentionFilter] = useState<string | null>(null);
  const [mentionIndex, setMentionIndex] = useState(0);
  
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

  const filteredMembers = mentionFilter !== null 
    ? members.filter(m => 
        m.name.toLowerCase().includes(mentionFilter.toLowerCase()) || 
        m.userId.toLowerCase().includes(mentionFilter.toLowerCase())
      ).slice(0, 8)
    : [];

  const insertMention = useCallback((member: RoomMember) => {
    if (mentionFilter === null) return;
    
    const parts = message.split('@');
    parts.pop(); // Remove the partial filter term
    const start = parts.join('@');
    
    const newMessage = `${start}@${member.name} `;
    setMessage(newMessage);
    setMentionFilter(null);
    inputRef.current?.focus();
  }, [message, mentionFilter]);

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (mentionFilter !== null && filteredMembers.length > 0) {
      if (e.key === 'ArrowDown') {
        e.preventDefault();
        setMentionIndex(i => (i + 1) % filteredMembers.length);
      } else if (e.key === 'ArrowUp') {
        e.preventDefault();
        setMentionIndex(i => (i - 1 + filteredMembers.length) % filteredMembers.length);
      } else if (e.key === 'Enter' || e.key === 'Tab') {
        e.preventDefault();
        insertMention(filteredMembers[mentionIndex]);
      } else if (e.key === 'Escape') {
        setMentionFilter(null);
      }
    }
  };

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const val = e.target.value;
    setMessage(val);
    if (error) setError(null);

    const cursorPosition = e.target.selectionStart || 0;
    const textBeforeCursor = val.substring(0, cursorPosition);
    const lastAtSymbol = textBeforeCursor.lastIndexOf('@');

    if (lastAtSymbol !== -1 && (lastAtSymbol === 0 || textBeforeCursor[lastAtSymbol - 1] === ' ')) {
      const filter = textBeforeCursor.substring(lastAtSymbol + 1);
      if (!filter.includes(' ')) {
        setMentionFilter(filter);
        setMentionIndex(0);
        return;
      }
    }
    setMentionFilter(null);
  };

  const handleSend = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!message.trim() || !client) return;

    const contentText = message.trim();
    setMessage('');
    setError(null);
    setShowEmojiPicker(false);
    setShowStickerPicker(false);
    setMentionFilter(null);

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
        // @ts-expect-error: SDK type mismatch
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
        // @ts-expect-error: SDK type mismatch
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
      // @ts-expect-error: custom type
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
      // @ts-expect-error: SDK type mismatch
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

      {/* Mention Picker */}
      {mentionFilter !== null && filteredMembers.length > 0 && (
        <div className="absolute bottom-full left-4 mb-2 w-64 rounded-lg bg-discord-sidebar shadow-xl border border-discord-hover overflow-hidden z-50">
          <div className="p-2 border-b border-discord-border bg-discord-dark">
            <span className="text-[10px] font-bold uppercase text-discord-text-muted">Members matching "{mentionFilter}"</span>
          </div>
          <div className="max-h-60 overflow-y-auto no-scrollbar py-1">
            {filteredMembers.map((member, i) => (
              <button
                key={member.userId}
                onClick={() => insertMention(member)}
                onMouseEnter={() => setMentionIndex(i)}
                className={`flex w-full items-center px-3 py-2 text-sm transition ${i === mentionIndex ? 'bg-discord-hover text-white' : 'text-discord-text-muted hover:text-discord-text'}`}
              >
                <div className="mr-3 h-6 w-6 shrink-0 rounded-full bg-discord-accent flex items-center justify-center text-[10px] text-white font-bold overflow-hidden">
                  {member.getAvatarUrl(client!.getHomeserverUrl(), 24, 24, 'crop', undefined, true) ? (
                    <img src={member.getAvatarUrl(client!.getHomeserverUrl(), 24, 24, 'crop', undefined, true)!} alt="" className="h-full w-full object-cover" />
                  ) : (
                    member.name.charAt(0).toUpperCase()
                  )}
                </div>
                <span className="truncate font-medium">{member.name}</span>
                <span className="ml-2 truncate text-[10px] opacity-50">{member.userId}</span>
              </button>
            ))}
          </div>
        </div>
      )}

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
          onKeyDown={handleKeyDown}
          onChange={handleInputChange}
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
