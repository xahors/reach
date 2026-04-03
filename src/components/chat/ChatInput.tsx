import React, { useState, useRef, useEffect } from 'react';
import { MsgType } from 'matrix-js-sdk';
import { useMatrixClient } from '../../hooks/useMatrixClient';
import { useAppStore } from '../../store/useAppStore';
import { matrixService } from '../../core/matrix';
import { PlusCircle, Gift, StickyNote, Smile, ShieldAlert } from 'lucide-react';
import EmojiPicker, { Theme, type EmojiClickData } from 'emoji-picker-react';

interface ChatInputProps {
  roomId: string;
  roomName: string;
}

const ChatInput: React.FC<ChatInputProps> = ({ roomId, roomName }) => {
  const [message, setMessage] = useState('');
  const [showEmojiPicker, setShowEmojiPicker] = useState(false);
  const client = useMatrixClient();
  const { setSettingsOpen } = useAppStore();
  const [error, setError] = useState<string | null>(null);
  const emojiPickerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (emojiPickerRef.current && !emojiPickerRef.current.contains(event.target as Node)) {
        setShowEmojiPicker(false);
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

    setError(null);
    setShowEmojiPicker(false);
    try {
      await client.sendMessage(roomId, {
        msgtype: MsgType.Text,
        body: message.trim(),
      });
      setMessage('');
    } catch (err) {
      console.error('Failed to send message:', err);
      
      const messageStr = err instanceof Error ? err.message : '';
      // Check if it's an encryption error
      if (messageStr.includes('encryption') || !matrixService.isCryptoEnabled()) {
        setError('Encryption required. Please verify your session.');
      } else {
        setError(`Failed to send: ${messageStr || 'Unknown error'}`);
      }
    }
  };

  const onEmojiClick = (emojiData: EmojiClickData) => {
    setMessage((prev) => prev + emojiData.emoji);
  };

  return (
    <div className="px-4 pb-6 relative">
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
        className="flex items-center rounded-lg bg-[#383a40] px-4 py-2.5 shadow-sm"
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
           <button type="button" className="hover:text-discord-text transition">
             <StickyNote className="h-6 w-6" />
           </button>
           <button 
             type="button" 
             onClick={() => setShowEmojiPicker(!showEmojiPicker)}
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
arget.value);
            if (error) setError(null);
          }}
          placeholder={`Message #${roomName}`}
          className="flex-1 bg-transparent text-base text-discord-text outline-none placeholder:text-discord-text-muted"
        />

        <div className="ml-4 flex items-center space-x-3 text-discord-text-muted">
           <button type="button" className="hover:text-discord-text transition">
             <Gift className="h-6 w-6" />
           </button>
           <button type="button" className="hover:text-discord-text transition">
             <StickyNote className="h-6 w-6" />
           </button>
           <button 
             type="button" 
             onClick={() => setShowEmojiPicker(!showEmojiPicker)}
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
