import React from 'react';
import { useAppStore } from '../../store/useAppStore';
import { useRoomMessages } from '../../hooks/useRoomMessages';
import { useMatrixClient } from '../../hooks/useMatrixClient';
import ChatInput from './ChatInput';
import MessageList from './MessageList';
import ChannelDetails from './ChannelDetails';
import { Hash, Phone, Video, Bell, Pin, Users, Search, HelpCircle } from 'lucide-react';

import { callManager } from '../../core/callManager';

const ChatArea: React.FC = () => {
  const { activeRoomId, isChannelDetailsOpen, setChannelDetailsOpen } = useAppStore();
  const client = useMatrixClient();
  const roomId = activeRoomId;
  const { messages, loading, paginate, canPaginate, markAsRead, readMarkerId } = useRoomMessages(roomId);

  const activeRoom = activeRoomId ? client?.getRoom(activeRoomId) : null;

  const handleCall = (type: 'voice' | 'video') => {
    if (activeRoomId) {
      callManager.placeCall(activeRoomId, type);
    }
  };

  if (!activeRoom) {
    return (
      <div className="flex flex-1 items-center justify-center bg-discord-chat-bg text-discord-muted">
        Select a channel to start chatting
      </div>
    );
  }

  return (
    <div className="flex flex-1 flex-col overflow-hidden bg-discord-chat-bg">
      {/* Room Header */}
      <header className="flex h-12 items-center justify-between border-b border-discord-border px-4 shadow-sm">
        <div className="flex items-center space-x-2">
          <Hash className="h-6 w-6 text-discord-muted" />
          <h1 className="font-bold text-white">{activeRoom.name}</h1>
        </div>

        <div className="flex items-center space-x-4 text-discord-muted">
          <Phone 
            className="h-6 w-6 cursor-pointer hover:text-discord-text" 
            onClick={() => handleCall('voice')}
          />

          <Video 
            className="h-6 w-6 cursor-pointer hover:text-discord-text" 
            onClick={() => handleCall('video')}
          />
          <Bell className="h-6 w-6 cursor-pointer hover:text-discord-text" />
          <Pin className="h-6 w-6 cursor-pointer hover:text-discord-text" />
          <Users 
            className={`h-6 w-6 cursor-pointer transition-colors ${isChannelDetailsOpen ? 'text-white' : 'hover:text-discord-text'}`}
            onClick={() => setChannelDetailsOpen(!isChannelDetailsOpen)}
          />
          <div className="relative flex items-center">
            <input 
              type="text" 
              placeholder="Search" 
              className="h-6 w-36 rounded bg-discord-black px-2 py-1 text-xs text-discord-text outline-none focus:w-60 transition-all duration-300"
            />
            <Search className="absolute right-1 h-4 w-4" />
          </div>
          <HelpCircle className="h-6 w-6 cursor-pointer hover:text-discord-text" />
        </div>
      </header>

      <div className="flex flex-1 overflow-hidden">
        <div className="flex flex-1 flex-col overflow-hidden">
          {/* Message List */}
          <MessageList 
            key={activeRoomId}
            messages={messages} 
            loading={loading} 
            onPaginate={paginate}
            canPaginate={canPaginate}
            onScrollBottom={markAsRead}
            readMarkerId={readMarkerId || undefined}
          />

          {/* Chat Input */}
          <ChatInput roomId={activeRoomId as string} roomName={activeRoom.name} />
        </div>

        {/* Member List / Channel Details Sidebar */}
        {isChannelDetailsOpen && (
          <div className="w-60 animate-in slide-in-from-right duration-300">
            <ChannelDetails />
          </div>
        )}
      </div>
    </div>
  );
};

export default ChatArea;
