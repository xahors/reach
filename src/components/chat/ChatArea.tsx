import React, { useState, useCallback } from 'react';
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
import { Hash, Phone, Video, VideoOff, Bell, Pin, Users, Search, HelpCircle, Mic, MicOff, PhoneOff, X, Volume2, Upload } from 'lucide-react';
import { callManager } from '../../core/callManager';
import { useFileUpload } from '../../hooks/useFileUpload';

const PinnedMessages: React.FC<{ roomId: string, onJumpToEvent: (id: string) => void }> = ({ roomId, onJumpToEvent }) => {
  const { pinnedEventIds } = usePinnedEvents(roomId);
  const [isOpen, setIsOpen] = useState(true);
  const client = useMatrixClient();
  const room = client?.getRoom(roomId);
  
  if (!room || pinnedEventIds.length === 0 || !isOpen) return null;

  const pinnedEvents = pinnedEventIds.map(id => room.findEventById(id)).filter(Boolean);

  return (
    <div className="flex items-center justify-between p-2 border-b border-border-main bg-bg-nav/50 animate-in fade-in slide-in-from-top-1 duration-300">
      <div className="flex items-center space-x-2 text-text-muted overflow-hidden">
        <Pin className="h-4 w-4 shrink-0" />
        <span className="font-bold text-[10px] uppercase tracking-wider shrink-0">Pinned</span>
        
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
          <button className="text-[10px] font-bold text-accent-primary hover:underline uppercase tracking-tighter">
            View All ({pinnedEventIds.length})
          </button>
        )}
        <button onClick={() => setIsOpen(false)} className="p-1 rounded-full hover:bg-white/10 text-text-muted hover:text-white">
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
    channelDetailsTab,
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
  const { messages, loading, paginate, canPaginate, canPaginateForward, markAsRead, readMarkerId, jumpToEvent, jumpToLive } = useRoomMessages(roomId);
  const { hasGroupCall, participantCount, isCallActive } = useGroupCall(roomId);
  const [isDragging, setIsDragging] = useState(false);
  const { uploadFile } = useFileUpload(client, activeRoomId || '');

  const handleFilesDrop = useCallback(async (files: File[]) => {
    for (const file of files) {
      try {
        await uploadFile(file);
      } catch (err) {
        console.error("Failed to upload dropped file:", err);
      }
    }
  }, [uploadFile]);

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
    if (activeCall || activeGroupCall) {
      const newMuted = !isMuted;
      callManager.setMuted(newMuted);
      setMuted(newMuted);
    }
  };

  const toggleCamera = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (activeCall || activeGroupCall) {
      const newCameraOff = !isCameraOff;
      callManager.setVideoMuted(newCameraOff);
      setCameraOff(newCameraOff);
    }
  };

  if (!activeRoom) {
    return (
      <div className="flex flex-1 items-center justify-center bg-bg-main text-text-muted font-bold uppercase tracking-widest text-xs">
        Select a channel to start chatting
      </div>
    );
  }

  return (
    <div className="flex flex-1 flex-col overflow-hidden bg-bg-main">
      {/* Room Header */}
      <header className="flex h-12 items-center justify-between border-b border-border-main px-4 shadow-sm bg-bg-main">
        <div className="flex items-center space-x-2 flex-1 min-w-0">
          {isCallActive ? (
            <Volume2 className="h-5 w-5 text-accent-primary flex-shrink-0" />
          ) : (
            <Hash className="h-5 w-5 text-text-muted flex-shrink-0" />
          )}
          <h1 className="font-bold text-text-main truncate tracking-tight">{activeRoom.name}</h1>
          
          {/* Active Call Join Button */}
          {isCallActive && !activeCall && !activeGroupCall && (
            <button 
              onClick={handleJoinCall}
              className="ml-4 flex items-center space-x-2 rounded bg-green-600 px-3 py-1 text-[10px] font-black text-white transition hover:bg-green-700 animate-in fade-in zoom-in duration-300 shadow-lg shadow-green-500/20 uppercase tracking-widest"
            >
              <Video className="h-3 w-3" />
              <span>JOIN CALL</span>
              {participantCount > 0 && (
                <span className="ml-1 rounded bg-black/20 px-1.5 py-0.5 text-[9px]">
                  {participantCount}
                </span>
              )}
            </button>
          )}

          {/* Minimized Call Info */}
          {(activeCall || activeGroupCall) && isCallMinimized && (
            <div 
              onClick={() => setCallMinimized(false)}
              className="ml-4 flex cursor-pointer items-center space-x-3 rounded-md bg-accent-primary/10 px-3 py-1 text-[10px] transition hover:bg-accent-primary/20 animate-in fade-in zoom-in duration-300 border border-accent-primary/20"
            >
              <div className="flex items-center space-x-2 text-accent-primary">
                <div className="h-1.5 w-1.5 animate-pulse rounded-full bg-accent-primary" />
                <span className="font-black uppercase tracking-widest hidden sm:inline">Active</span>
              </div>
              
              <div className="flex items-center space-x-2 border-l border-border-main pl-3">
                <button 
                  onClick={toggleMute}
                  className={`rounded p-1 transition ${isMuted ? 'text-red-500 hover:bg-red-500/20' : 'text-white hover:bg-bg-hover'}`}
                  title={isMuted ? "Unmute" : "Mute"}
                >
                  {isMuted ? <MicOff className="h-3 w-3" /> : <Mic className="h-3 w-3" />}
                </button>
                
                <button 
                  onClick={toggleCamera}
                  className={`rounded p-1 transition ${!isCameraOff ? 'text-accent-primary hover:bg-accent-primary/20' : 'text-white hover:bg-bg-hover'}`}
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

        <div className="flex items-center space-x-4 text-text-muted flex-shrink-0">
          <button 
            onClick={() => handleCall('voice')}
            title="Start Voice Call"
            className="hover:text-text-main transition-colors"
          >
            <Phone className="h-5 w-5 cursor-pointer" />
          </button>

          <button 
            onClick={() => handleCall('video')}
            title={hasGroupCall ? "Join Group Call" : "Start Video Call"}
            className={`transition-colors ${hasGroupCall ? 'text-accent-primary' : 'hover:text-text-main'}`}
          >
            <Video className="h-5 w-5 cursor-pointer" />
          </button>
          <Bell 
            className={`h-5 w-5 cursor-pointer transition-colors ${isChannelDetailsOpen && channelDetailsTab === 'settings' ? 'text-accent-primary' : 'hover:text-text-main'}`}
            onClick={() => setChannelDetailsOpen(!(isChannelDetailsOpen && channelDetailsTab === 'settings'), 'settings')}
          />
          <Pin className="h-5 w-5 cursor-pointer hover:text-text-main" />
          <Users 
            className={`h-5 w-5 cursor-pointer transition-colors ${isChannelDetailsOpen && channelDetailsTab === 'members' ? 'text-accent-primary' : 'hover:text-text-main'}`}
            onClick={() => setChannelDetailsOpen(!(isChannelDetailsOpen && channelDetailsTab === 'members'), 'members')}
          />
          <div className="relative hidden md:flex items-center">
            <input 
              type="text" 
              placeholder="Search" 
              className="h-7 w-32 rounded bg-bg-nav px-2 py-1 text-[10px] text-text-main outline-none focus:w-48 transition-all duration-300 border border-border-main focus:border-accent-primary font-mono"
            />
            <Search className="absolute right-2 h-3 w-3" />
          </div>
          <HelpCircle className="h-5 w-5 cursor-pointer hover:text-text-main" />
        </div>
      </header>

      {activeRoomId && <PinnedMessages roomId={activeRoomId} onJumpToEvent={jumpToEvent} />}

      <div className="flex flex-1 overflow-hidden relative" 
        onDragOver={(e) => {
          e.preventDefault();
          setIsDragging(true);
        }}
        onDragLeave={() => setIsDragging(false)}
        onDrop={(e) => {
          e.preventDefault();
          setIsDragging(false);
          const files = Array.from(e.dataTransfer.files);
          if (files.length > 0) {
            handleFilesDrop(files);
          }
        }}
      >
        {isDragging && (
          <div className="absolute inset-0 z-50 flex items-center justify-center bg-accent-primary/20 backdrop-blur-[2px] border-2 border-dashed border-accent-primary m-4 rounded-xl animate-in fade-in duration-200">
            <div className="flex flex-col items-center space-y-4 bg-bg-nav p-8 rounded-2xl shadow-2xl border border-border-main">
              <div className="p-4 bg-accent-primary/10 rounded-full text-accent-primary animate-bounce">
                <Upload className="h-12 w-12" />
              </div>
              <div className="text-center">
                <h3 className="text-xl font-black text-white uppercase tracking-tighter">Drop to upload</h3>
                <p className="text-sm text-text-muted font-medium">Your files will be shared securely</p>
              </div>
            </div>
          </div>
        )}

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
                canPaginateForward={canPaginateForward}
                onScrollBottom={markAsRead}
                onJumpToEvent={jumpToEvent}
                onJumpToLive={jumpToLive}
                readMarkerId={readMarkerId || undefined}
              />

              {/* Chat Input */}
              <ChatInput roomId={activeRoomId as string} roomName={activeRoom.name} />
            </>
          )}
        </div>

        {/* Member List / Channel Details Sidebar */}
        {isChannelDetailsOpen && (
          <div className="w-60 animate-in slide-in-from-right duration-300 border-l border-border-main bg-bg-sidebar">
            <ChannelDetails />
          </div>
        )}
      </div>
    </div>
  );
};

export default ChatArea;
