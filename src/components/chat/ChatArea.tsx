import React, { useState } from 'react';
import { useAppStore } from '../../store/useAppStore';
import { useRoomMessages } from '../../hooks/useRoomMessages';
import { useMatrixClient } from '../../hooks/useMatrixClient';
import { usePinnedEvents } from '../../hooks/usePinnedEvents';
import { useGroupCall } from '../../hooks/useGroupCall';
import ChatInput from './ChatInput';
import MessageList from './MessageList';
import ChannelDetails from './ChannelDetails';
import ActiveCall from '../calls/ActiveCall';
import { EventType } from 'matrix-js-sdk';
import { Hash, Phone, Video, VideoOff, Bell, Pin, Users, Search, HelpCircle, Mic, MicOff, PhoneOff, X } from 'lucide-react';
import { callManager } from '../../core/callManager';

const PinnedMessages: React.FC<{ roomId: string, onJumpToEvent: (id: string) => void }> = ({ roomId, onJumpToEvent }) => {
  const { pinnedEventIds } = usePinnedEvents(roomId);
  const [isOpen, setIsOpen] = useState(true);
  const client = useMatrixClient();
  const room = client?.getRoom(roomId);
  
  if (!room || pinnedEventIds.length === 0 || !isOpen) return null;

  const pinnedEvents = pinnedEventIds.map(id => room.findEventById(id)).filter(Boolean);

  return (
    <div className="flex items-center justify-between p-2 border-b border-discord-border bg-discord-dark/50 animate-in fade-in slide-in-from-top-1 duration-300">
      <div className="flex items-center space-x-2 text-discord-text-muted overflow-hidden">
        <Pin className="h-4 w-4 shrink-0" />
        <span className="font-semibold text-xs uppercase tracking-wider shrink-0">Pinned</span>
        
        {pinnedEvents[0] && (
          <div 
            onClick={() => onJumpToEvent(pinnedEvents[0]!.getId()!)}
            className="flex items-center space-x-2 truncate cursor-pointer hover:bg-white/5 p-1 rounded"
          >
            <span className="text-xs font-bold text-white truncate">{pinnedEvents[0].sender?.name}:</span>
            <span className="text-xs truncate italic">{pinnedEvents[0].getContent().body}</span>
          </div>
        )}
      </div>
      
      <div className="flex items-center space-x-2">
        {pinnedEventIds.length > 1 && (
          <button className="text-xs font-bold text-discord-accent hover:underline">
            View All ({pinnedEventIds.length})
          </button>
        )}
        <button onClick={() => setIsOpen(false)} className="p-1 rounded-full hover:bg-white/10 text-discord-text-muted hover:text-white">
          <X className="h-4 w-4" />
        </button>
      </div>
    </div>
  );
};


const ChatArea: React.FC = () => {
  const { 
    activeRoomId, 
    isChannelDetailsOpen, 
    setChannelDetailsOpen, 
    isCallMinimized, 
    setCallMinimized, 
    activeCall,
    activeGroupCall,
    isMuted,
    setMuted,
    isCameraOff,
    setCameraOff,
    callWindowingMode
  } = useAppStore();
  const client = useMatrixClient();
  const roomId = activeRoomId;
  const { messages, loading, paginate, canPaginate, markAsRead, readMarkerId, jumpToEvent } = useRoomMessages(roomId);
  const { hasGroupCall, participantCount, isCallActive } = useGroupCall(roomId);

  const activeRoom = activeRoomId ? client?.getRoom(activeRoomId) : null;

  const handleCall = (type: 'voice' | 'video') => {
    if (activeRoomId) {
      const mDirect = client?.getAccountData(EventType.Direct);
      const directContent = mDirect?.getContent() || {};
      const isDM = Object.values(directContent).some((roomIds: unknown) => 
        Array.isArray(roomIds) && roomIds.includes(activeRoomId)
      );

      if (!isDM) {
        callManager.enterGroupCall(activeRoomId, type);
      } else {
        callManager.placeCall(activeRoomId, type);
      }
    }
  };

  const handleJoinCall = () => {
    if (activeRoomId) {
      callManager.enterGroupCall(activeRoomId, 'video');
    }
  };

  const toggleMute = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (activeCall) {
      const newMuted = !isMuted;
      callManager.setMuted(newMuted);
      setMuted(newMuted);
    }
  };

  const toggleCamera = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (activeCall) {
      const newCameraOff = !isCameraOff;
      callManager.setVideoMuted(newCameraOff);
      setCameraOff(newCameraOff);
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
        <div className="flex items-center space-x-2 flex-1 min-w-0">
          <Hash className="h-6 w-6 text-discord-muted flex-shrink-0" />
          <h1 className="font-bold text-white truncate">{activeRoom.name}</h1>
          
          {/* Active Call Join Button */}
          {isCallActive && !activeCall && !activeGroupCall && (
            <button 
              onClick={handleJoinCall}
              className="ml-4 flex items-center space-x-2 rounded-md bg-green-600 px-3 py-1 text-xs font-bold text-white transition hover:bg-green-700 animate-in fade-in zoom-in duration-300 shadow-lg shadow-green-500/20"
            >
              <Video className="h-3 w-3" />
              <span>JOIN CALL</span>
              {participantCount > 0 && (
                <span className="ml-1 rounded bg-black/20 px-1.5 py-0.5 text-[10px] font-black">
                  {participantCount}
                </span>
              )}
            </button>
          )}

          {/* Minimized Call Info */}
          {(activeCall || activeGroupCall) && isCallMinimized && (
            <div 
              onClick={() => setCallMinimized(false)}
              className="ml-4 flex cursor-pointer items-center space-x-3 rounded-md bg-discord-accent/20 px-3 py-1 text-xs transition hover:bg-discord-accent/30 animate-in fade-in zoom-in duration-300"
            >
              <div className="flex items-center space-x-2 text-discord-accent">
                <div className="h-2 w-2 animate-pulse rounded-full bg-discord-accent" />
                <span className="font-bold uppercase tracking-wider hidden sm:inline">Call Active</span>
              </div>
              
              <div className="flex items-center space-x-2 border-l border-discord-accent/30 pl-3">
                <button 
                  onClick={toggleMute}
                  className={`rounded p-1 transition ${isMuted ? 'text-red-500 hover:bg-red-500/20' : 'text-white hover:bg-discord-accent/40'}`}
                  title={isMuted ? "Unmute" : "Mute"}
                >
                  {isMuted ? <MicOff className="h-3 w-3" /> : <Mic className="h-3 w-3" />}
                </button>
                
                <button 
                  onClick={toggleCamera}
                  className={`rounded p-1 transition ${!isCameraOff ? 'text-discord-accent hover:bg-discord-accent/20' : 'text-white hover:bg-discord-accent/40'}`}
                  title={!isCameraOff ? "Turn Camera Off" : "Turn Camera On"}
                >
                  {!isCameraOff ? <Video className="h-3 w-3" /> : <VideoOff className="h-3 w-3" />}
                </button>

                <button 
                  onClick={(e) => { e.stopPropagation(); callManager.hangupCall(); }}
                  className="rounded p-1 hover:bg-red-500 text-white transition"
                  title="End Call"
                >
                  <PhoneOff className="h-3 w-3" />
                </button>
              </div>
            </div>
          )}
        </div>

        <div className="flex items-center space-x-4 text-discord-muted flex-shrink-0">
          <button 
            onClick={() => handleCall('voice')}
            title="Start Voice Call"
            className="hover:text-discord-text transition-colors"
          >
            <Phone className="h-6 w-6 cursor-pointer" />
          </button>

          <button 
            onClick={() => handleCall('video')}
            title={hasGroupCall ? "Join Group Call" : "Start Video Call"}
            className={`transition-colors ${hasGroupCall ? 'text-discord-accent' : 'hover:text-discord-text'}`}
          >
            <Video className="h-6 w-6 cursor-pointer" />
          </button>
          <Bell className="h-6 w-6 cursor-pointer hover:text-discord-text" />
          <Pin className="h-6 w-6 cursor-pointer hover:text-discord-text" />
          <Users 
            className={`h-6 w-6 cursor-pointer transition-colors ${isChannelDetailsOpen ? 'text-white' : 'hover:text-discord-text'}`}
            onClick={() => setChannelDetailsOpen(!isChannelDetailsOpen)}
          />
          <div className="relative hidden md:flex items-center">
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

      {activeRoomId && <PinnedMessages roomId={activeRoomId} onJumpToEvent={jumpToEvent} />}

      <div className="flex flex-1 overflow-hidden">
        <div className="flex flex-1 flex-col overflow-hidden relative">
          {(activeCall || activeGroupCall) && callWindowingMode === 'integrated' ? (
            <div className="flex-1 bg-black animate-in fade-in zoom-in duration-300 relative overflow-hidden">
               <ActiveCall />
            </div>
          ) : (
            <>
              {/* Message List */}
              <MessageList 
                key={activeRoomId}
                roomId={activeRoomId as string}
                messages={messages} 
                loading={loading} 
                onPaginate={paginate}
                canPaginate={canPaginate}
                onScrollBottom={markAsRead}
                onJumpToEvent={jumpToEvent}
                readMarkerId={readMarkerId || undefined}
              />

              {/* Chat Input */}
              <ChatInput roomId={activeRoomId as string} roomName={activeRoom.name} />
            </>
          )}
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
