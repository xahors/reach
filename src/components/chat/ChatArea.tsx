import React from 'react';
import { useAppStore } from '../../store/useAppStore';
import { useRoomMessages } from '../../hooks/useRoomMessages';
import { useMatrixClient } from '../../hooks/useMatrixClient';
import MessageList from './MessageList';
import ChatInput from './ChatInput';
import ChannelDetails from './ChannelDetails';
import { Hash, Bell, Pin, Users, Search, Inbox, HelpCircle, Phone, Video } from 'lucide-react';
import { callManager } from '../../core/callManager';

const ChatArea: React.FC = () => {
  const { activeRoomId, isChannelDetailsOpen, setChannelDetailsOpen } = useAppStore();
  const client = useMatrixClient();
  const { messages } = useRoomMessages(activeRoomId);

  const activeRoom = activeRoomId ? client?.getRoom(activeRoomId) : null;

  const handleCall = (type: 'voice' | 'video') => {
    if (activeRoomId) {
      callManager.placeCall(activeRoomId, type);
    }
  };

  if (!activeRoomId || !activeRoom) {
    return (
      <div className="flex flex-1 items-center justify-center bg-discord-dark">
        <div className="text-center">
          <div className="mb-4 flex justify-center">
             <div className="h-16 w-16 rounded-full bg-discord-sidebar flex items-center justify-center">
               <Hash className="h-10 w-10 text-discord-text-muted" />
             </div>
          </div>
          <h2 className="text-2xl font-bold text-white">Welcome to Reach</h2>
          <p className="mt-2 text-discord-text-muted">Select a channel to start chatting!</p>
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-1 flex-col bg-discord-dark overflow-hidden">
      {/* Room Header */}
      <div className="flex h-12 items-center justify-between px-4 shadow-sm">
        <div 
          className="flex items-center overflow-hidden cursor-pointer hover:bg-discord-hover/50 px-2 py-1 rounded transition"
          onClick={() => setChannelDetailsOpen(!isChannelDetailsOpen)}
        >
          <Hash className="mr-2 h-6 w-6 text-discord-text-muted" />
          <span className="truncate text-base font-bold text-white">{activeRoom.name}</span>
        </div>
        
        <div className="flex items-center space-x-4 text-discord-text-muted">
          <button onClick={() => handleCall('voice')} className="hover:text-discord-text transition" title="Start Voice Call"><Phone className="h-5 w-5" /></button>
          <button onClick={() => handleCall('video')} className="hover:text-discord-text transition" title="Start Video Call"><Video className="h-5 w-5" /></button>
          <div className="w-px h-6 bg-discord-hover mx-2" />
          <button className="hover:text-discord-text transition"><Bell className="h-6 w-6" /></button>
          <button className="hover:text-discord-text transition"><Pin className="h-6 w-6" /></button>
          <button className="hover:text-discord-text transition"><Users className="h-6 w-6" /></button>
          
          <div className="relative">
            <input
              type="text"
              placeholder="Search"
              className="h-6 w-36 rounded bg-discord-nav px-2 py-1 text-xs outline-none placeholder:text-discord-text-muted"
            />
            <Search className="absolute right-1.5 top-1 h-4 w-4" />
          </div>
          
          <button className="hover:text-discord-text transition"><Inbox className="h-6 w-6" /></button>
          <button className="hover:text-discord-text transition"><HelpCircle className="h-6 w-6" /></button>
        </div>
      </div>

      {/* Message Area & Details Sidebar */}
      <div className="flex flex-1 overflow-hidden">
        <div className="flex flex-1 flex-col overflow-hidden">
          {/* Message List */}
          <MessageList messages={messages} />

          {/* Chat Input */}
          <ChatInput roomId={activeRoomId} roomName={activeRoom.name} />
        </div>

        {isChannelDetailsOpen && <ChannelDetails />}
      </div>
    </div>
  );
};

export default ChatArea;
