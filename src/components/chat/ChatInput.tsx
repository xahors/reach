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
import { cn } from '../../utils/cn';
import { COMMON_EMOJIS, type EmojiEntry } from '../../utils/emojis';

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
  
  // Autocomplete state
  const [emojiSuggestions, setEmojiSuggestions] = useState<EmojiEntry[]>([]);
  const [selectedSuggestionIndex, setSelectedSuggestionIndex] = useState(0);
  const [suggestionRange, setSuggestionRange] = useState<{ start: number, end: number } | null>(null);

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

  // Emoji autocomplete logic
  useEffect(() => {
    if (!inputRef.current || document.activeElement !== inputRef.current) {
      setEmojiSuggestions([]);
      return;
    }

    const cursorPos = inputRef.current.selectionStart;
    const textBeforeCursor = message.substring(0, cursorPos);
    const words = textBeforeCursor.split(/\s/);
    const lastWord = words[words.length - 1];

    // Auto-replace :emoji: if it matches exactly
    if (lastWord.startsWith(':') && lastWord.endsWith(':') && lastWord.length >= 3) {
      const emojiName = lastWord.substring(1, lastWord.length - 1).toLowerCase();
      const match = COMMON_EMOJIS.find(e => e.name.toLowerCase() === emojiName);
      if (match) {
        const before = textBeforeCursor.substring(0, textBeforeCursor.length - lastWord.length);
        const after = message.substring(cursorPos);
        setMessage(before + match.emoji + after);
        
        const newPos = before.length + match.emoji.length;
        setTimeout(() => {
          if (inputRef.current) {
            inputRef.current.setSelectionRange(newPos, newPos);
          }
        }, 0);
        return;
      }
    }

    if (lastWord.startsWith(':') && lastWord.length >= 2) {
      const query = lastWord.substring(1).toLowerCase();
      const filtered = COMMON_EMOJIS.filter(e => e.name.toLowerCase().startsWith(query)).slice(0, 10);
      
      if (filtered.length > 0) {
        setEmojiSuggestions(filtered);
        setSelectedSuggestionIndex(0);
        setSuggestionRange({
          start: cursorPos - lastWord.length,
          end: cursorPos
        });
        return;
      }
    }

    setEmojiSuggestions([]);
    setSuggestionRange(null);
  }, [message]);

  const insertFormatting = (prefix: string, suffix: string | null = null) => {
    if (!inputRef.current) return;
    
    const actualSuffix = suffix === null ? prefix : suffix;
    const start = inputRef.current.selectionStart || 0;
    const end = inputRef.current.selectionEnd || 0;
    const selectedText = message.substring(start, end);
    const before = message.substring(0, start);
    const after = message.substring(end);
    
    const newText = `${before}${prefix}${selectedText}${actualSuffix}${after}`;
    setMessage(newText);
    
    // Set focus back and adjust selection
    setTimeout(() => {
      if (inputRef.current) {
        inputRef.current.focus();
        // If text was selected, put cursor after the suffix.
        // If no text was selected, put cursor BETWEEN prefix and suffix (e.g. inside the backticks)
        const newCursorPos = selectedText.length > 0 
          ? start + prefix.length + selectedText.length + actualSuffix.length
          : start + prefix.length;
          
        inputRef.current.setSelectionRange(newCursorPos, newCursorPos);
      }
    }, 0);
  };

  const insertEmojiSuggestion = (suggestion: EmojiEntry) => {
    if (!suggestionRange) return;
    
    const before = message.substring(0, suggestionRange.start);
    const after = message.substring(suggestionRange.end);
    const newText = `${before}${suggestion.emoji} ${after}`;
    
    setMessage(newText);
    setEmojiSuggestions([]);
    
    setTimeout(() => {
      if (inputRef.current) {
        inputRef.current.focus();
        const newCursorPos = suggestionRange.start + suggestion.emoji.length + 1;
        inputRef.current.setSelectionRange(newCursorPos, newCursorPos);
      }
    }, 0);
  };

  const handleSubmit = (e?: React.FormEvent) => {
    e?.preventDefault();
    if (!message.trim() || !client) return;

    // Stop typing indicator immediately
    sendTypingStatus(false);

    // Handle Slash Commands
    if (message.startsWith('/') && !editingEvent) {
      const parts = message.split(' ');
      const command = parts[0].toLowerCase();
      const args = parts.slice(1).join(' ');

      switch (command) {
        case '/me':
          if (args) {
            client.sendMessage(roomId, threadId, {
              msgtype: MsgType.Emote,
              body: args
            });
            setMessage('');
            return;
          }
          break;
        case '/nick':
          if (args) {
            client.setDisplayName(args).catch(e => console.error("Failed to set nick:", e));
            setMessage('');
            return;
          }
          break;
        case '/shrug': {
          const text = args ? args + ' ' : '';
          // To get ¯\_(ツ)_/¯ in Reach's ReactMarkdown, we need ¯\\\_(ツ)\_/¯
          // In JS string that is 6 backslashes for the first arm.
          const reachShrug = '¯\\\\\\_(ツ)\\_/¯';
          const fullMessage = text + reachShrug;
          client.sendMessage(roomId, threadId, {
            msgtype: MsgType.Text,
            body: fullMessage,
            format: "org.matrix.custom.html",
            formatted_body: fullMessage
          });
          setMessage('');
          return;
        }
        case '/tableflip': {
          const body = (args ? args + ' ' : '') + '(╯°□°）╯︵ ┻━┻';
          client.sendMessage(roomId, threadId, {
            msgtype: MsgType.Text,
            body: body,
            format: "org.matrix.custom.html",
            formatted_body: body
          });
          setMessage('');
          return;
        }
        case '/unflip': {
          const body = (args ? args + ' ' : '') + '┬─┬ノ( º _ ºノ)';
          client.sendMessage(roomId, threadId, {
            msgtype: MsgType.Text,
            body: body,
            format: "org.matrix.custom.html",
            formatted_body: body
          });
          setMessage('');
          return;
        }
        case '/clear':
          // Local clear (placeholder for actual functionality if needed)
          setMessage('');
          return;
      }
    }

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
    if (emojiSuggestions.length > 0) {
      if (e.key === 'ArrowDown') {
        e.preventDefault();
        setSelectedSuggestionIndex(prev => (prev + 1) % emojiSuggestions.length);
        return;
      }
      if (e.key === 'ArrowUp') {
        e.preventDefault();
        setSelectedSuggestionIndex(prev => (prev - 1 + emojiSuggestions.length) % emojiSuggestions.length);
        return;
      }
      if (e.key === 'Enter' || e.key === 'Tab') {
        e.preventDefault();
        const selected = emojiSuggestions[selectedSuggestionIndex];
        insertEmojiSuggestion(selected);
        return;
      }
      if (e.key === 'Escape') {
        e.preventDefault();
        setEmojiSuggestions([]);
        return;
      }
    }

    if (e.key === 'Enter' && e.shiftKey) {
      if (!inputRef.current) return;
      const start = inputRef.current.selectionStart;
      const textBefore = message.substring(0, start);
      const lines = textBefore.split('\n');
      const currentLine = lines[lines.length - 1];

      // Match unordered list (- or *) or ordered list (1.)
      const unorderedMatch = currentLine.match(/^(\s*[-*]\s+)/);
      const orderedMatch = currentLine.match(/^(\s*)(\d+)\.\s+/);

      if (unorderedMatch || orderedMatch) {
        e.preventDefault();
        let prefix = '';
        if (unorderedMatch) {
          prefix = unorderedMatch[1];
        } else if (orderedMatch) {
          const indentation = orderedMatch[1];
          const currentNumber = parseInt(orderedMatch[2], 10);
          prefix = `${indentation}${currentNumber + 1}. `;
        }

        const before = message.substring(0, start);
        const after = message.substring(start);
        setMessage(before + '\n' + prefix + after);
        
        const newPos = start + 1 + prefix.length;
        setTimeout(() => {
          if (inputRef.current) {
            inputRef.current.focus();
            inputRef.current.setSelectionRange(newPos, newPos);
          }
        }, 0);
        return;
      }
    }

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

      <div className={`flex flex-col rounded-lg bg-bg-nav border border-border-main transition-all relative ${editingEvent ? 'rounded-t-none border-accent-primary/30 shadow-[0_0_15px_rgba(255,255,255,0.05)]' : replyingToEvent ? 'rounded-t-none' : 'focus-within:border-accent-primary/50 shadow-sm'}`}>
        {/* Emoji Autocomplete Suggestions */}
        {emojiSuggestions.length > 0 && (
          <div className="absolute bottom-full left-0 mb-2 w-64 rounded-xl bg-bg-sidebar border border-border-main shadow-2xl overflow-hidden z-[100] animate-in slide-in-from-bottom-2 duration-200">
            <div className="px-3 py-2 border-b border-border-main bg-bg-nav/50">
              <span className="text-[10px] font-black uppercase tracking-widest text-text-muted italic">Emoji Matching ":{message.substring(suggestionRange?.start || 0, suggestionRange?.end || 0).substring(1)}"</span>
            </div>
            <div className="max-h-64 overflow-y-auto no-scrollbar">
              {emojiSuggestions.map((suggestion, index) => (
                <div 
                  key={suggestion.name}
                  onClick={() => insertEmojiSuggestion(suggestion)}
                  onMouseEnter={() => setSelectedSuggestionIndex(index)}
                  className={cn(
                    "flex items-center space-x-3 px-3 py-2 cursor-pointer transition-colors",
                    index === selectedSuggestionIndex ? "bg-accent-primary text-bg-main" : "hover:bg-bg-hover text-text-main"
                  )}
                >
                  <span className="text-xl">{suggestion.emoji}</span>
                  <span className={cn(
                    "text-xs font-bold",
                    index === selectedSuggestionIndex ? "text-bg-main" : "text-text-muted"
                  )}>:{suggestion.name}:</span>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Formatting Ribbon */}
        {showFormatting && (
          <div className="flex items-center space-x-1 border-b border-border-main/30 px-2 py-1.5 animate-in slide-in-from-top-2 duration-200 overflow-x-auto no-scrollbar">
            <button type="button" onClick={() => insertFormatting('**')} className="p-1.5 text-text-muted hover:bg-bg-hover hover:text-accent-primary rounded transition" title="Bold"><Bold className="h-3.5 w-3.5" /></button>
            <button type="button" onClick={() => insertFormatting('*')} className="p-1.5 text-text-muted hover:bg-bg-hover hover:text-accent-primary rounded transition" title="Italic"><Italic className="h-3.5 w-3.5" /></button>
            <button type="button" onClick={() => insertFormatting('`')} className="p-1.5 text-text-muted hover:bg-bg-hover hover:text-accent-primary rounded transition" title="Code"><Code className="h-3.5 w-3.5" /></button>
            <button type="button" onClick={() => insertFormatting('[', '](url)')} className="p-1.5 text-text-muted hover:bg-bg-hover hover:text-accent-primary rounded transition" title="Link"><LinkIcon className="h-3.5 w-3.5" /></button>
            <div className="w-px h-4 bg-border-main mx-1" />
            <button type="button" onClick={() => insertFormatting('- ', '')} className="p-1.5 text-text-muted hover:bg-bg-hover hover:text-accent-primary rounded transition" title="List"><List className="h-3.5 w-3.5" /></button>
            <button type="button" onClick={() => insertFormatting('1. ', '')} className="p-1.5 text-text-muted hover:bg-bg-hover hover:text-accent-primary rounded transition" title="Ordered List"><ListOrdered className="h-3.5 w-3.5" /></button>
            <button type="button" onClick={() => insertFormatting('> ', '')} className="p-1.5 text-text-muted hover:bg-bg-hover hover:text-accent-primary rounded transition" title="Quote"><Quote className="h-3.5 w-3.5" /></button>
            <button type="button" onClick={() => insertFormatting('### ', '')} className="p-1.5 text-text-muted hover:bg-bg-hover hover:text-accent-primary rounded transition" title="Heading"><Type className="h-3.5 w-3.5" /></button>
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
