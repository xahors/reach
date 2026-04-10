import React, { useEffect, useRef, useState } from 'react';
import { useAppStore } from '../../store/useAppStore';
import { callManager } from '../../core/callManager';
import { Phone, PhoneOff, Mic, MicOff, Video, VideoOff, GripHorizontal, Minus, Monitor, MonitorOff, Maximize2, Minimize2, Settings, ExternalLink, Square } from 'lucide-react';
import Draggable from 'react-draggable';
import ParticipantTile from './ParticipantTile';

interface DeviceList {
  audioIn: MediaDeviceInfo[];
  videoIn: MediaDeviceInfo[];
  audioOut: MediaDeviceInfo[];
}

const ActiveCall: React.FC = () => {
  const { 
    activeCall, 
    activeGroupCall,
    callFeeds,
    incomingCall, 
    isCallMinimized, 
    setCallMinimized, 
    isMuted, 
    setMuted, 
    isCameraOff, 
    setCameraOff,
    isScreensharing,
    setScreensharing,
    callLayout,
    setCallLayout
  } = useAppStore();
  
  const [isMaximized, setIsMaximized] = useState(false);
  const [showSettings, setShowSettings] = useState(false);
  const [devices, setDevices] = useState<DeviceList>({ audioIn: [], videoIn: [], audioOut: [] });
  const incomingNodeRef = useRef<HTMLDivElement>(null);
  const activeNodeRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (activeCall) {
      setMuted(activeCall.isMicrophoneMuted());
      setCameraOff(activeCall.isLocalVideoMuted());
      setScreensharing(activeCall.isScreensharing());
    } else if (activeGroupCall) {
      setMuted(activeGroupCall.isMicrophoneMuted());
      setCameraOff(activeGroupCall.isLocalVideoMuted());
      setScreensharing(activeGroupCall.isScreensharing());
    }
  }, [activeCall, activeGroupCall, setMuted, setCameraOff, setScreensharing]);

  useEffect(() => {
    if (showSettings) {
      callManager.getDevices().then(setDevices);
    }
  }, [showSettings]);

  const toggleMute = () => {
    callManager.warmupAudioContext();
    const newMuted = !isMuted;
    callManager.setMuted(newMuted);
    setMuted(newMuted);
  };

  const toggleCamera = async () => {
    callManager.warmupAudioContext();
    const newCameraOff = !isCameraOff;
    await callManager.setVideoMuted(newCameraOff);
    setCameraOff(newCameraOff);
  };

  const toggleScreensharing = async () => {
    callManager.warmupAudioContext();
    const newScreensharing = !isScreensharing;
    await callManager.setScreensharingEnabled(newScreensharing);
    setScreensharing(newScreensharing);
  };

  if (!activeCall && !activeGroupCall && !incomingCall) return null;
  if ((activeCall || activeGroupCall) && isCallMinimized) return null;

  if (incomingCall) {
    // ... (incoming call UI remains the same)
    return (
      <div className="absolute top-4 right-4 z-50">
        <Draggable nodeRef={incomingNodeRef} bounds="parent">
          <div ref={incomingNodeRef} className="w-72 cursor-move rounded-lg bg-discord-sidebar p-4 shadow-xl border border-discord-hover">
            <div className="flex items-center justify-between mb-2">
              <h3 className="text-white font-bold">Incoming Call</h3>
              <GripHorizontal className="h-4 w-4 text-discord-text-muted" />
            </div>
            <p className="text-discord-text-muted text-sm mb-4">From: {incomingCall.roomId}</p>
            <div className="flex space-x-2">
              <button 
                onClick={(e) => { e.stopPropagation(); callManager.warmupAudioContext(); callManager.acceptCall(); }}
                className="flex-1 flex items-center justify-center bg-green-500 hover:bg-green-600 text-white py-2 rounded font-bold transition"
              >
                <Phone className="h-4 w-4 mr-2" /> Answer
              </button>
              <button 
                onClick={(e) => { e.stopPropagation(); callManager.rejectCall(); }}
                className="flex-1 flex items-center justify-center bg-red-500 hover:bg-red-600 text-white py-2 rounded font-bold transition"
              >
                <PhoneOff className="h-4 w-4 mr-2" /> Decline
              </button>
            </div>
          </div>
        </Draggable>
      </div>
    );
  }

  const feedsCount = callFeeds.length;
  const gridCols = feedsCount <= 1 ? 'grid-cols-1' : feedsCount <= 4 ? 'grid-cols-2' : 'grid-cols-3';

  const containerClasses = callLayout === 'integrated' 
    ? "relative w-full h-full flex flex-col bg-discord-dark overflow-hidden"
    : `fixed z-50 flex flex-col bg-discord-dark shadow-2xl transition-all duration-300 ${
        isMaximized ? 'inset-4 rounded-xl' : 'bottom-4 right-4 w-[480px] h-[360px] rounded-lg border border-white/10'
      }`;

  const content = (
    <div 
      ref={callLayout !== 'integrated' ? activeNodeRef : null}
      className={containerClasses}
    >
      {/* Header */}
      <div className={`flex h-10 items-center justify-between px-4 bg-discord-nav/50 backdrop-blur-md shrink-0 ${callLayout !== 'integrated' ? 'drag-handle cursor-move' : ''}`}>
        <div className="flex items-center space-x-2">
          <div className="h-2 w-2 animate-pulse rounded-full bg-red-500" />
          <span className="text-xs font-bold text-white uppercase tracking-widest">
            {activeGroupCall ? 'Group Call' : 'Private Call'}
          </span>
        </div>
        <div className="flex items-center space-x-2">
          <button 
            onClick={() => setShowSettings(!showSettings)}
            className={`p-1 rounded transition ${showSettings ? 'bg-discord-accent text-white' : 'text-discord-text-muted hover:bg-white/10 hover:text-white'}`}
            title="Settings"
          >
            <Settings className="h-4 w-4" />
          </button>

          {/* Layout Toggles */}
          {callLayout === 'integrated' ? (
            <button 
              onClick={() => setCallLayout('floating')}
              className="p-1 hover:bg-white/10 rounded text-discord-text-muted hover:text-white transition"
              title="Pop out"
            >
              <ExternalLink className="h-4 w-4" />
            </button>
          ) : (
            <button 
              onClick={() => setCallLayout('integrated')}
              className="p-1 hover:bg-white/10 rounded text-discord-text-muted hover:text-white transition"
              title="Integrate into chat"
            >
              <Square className="h-4 w-4" />
            </button>
          )}

          {callLayout !== 'integrated' && (
            <button 
              onClick={() => setIsMaximized(!isMaximized)}
              className="p-1 hover:bg-white/10 rounded text-discord-text-muted hover:text-white transition"
            >
              {isMaximized ? <Minimize2 className="h-4 w-4" /> : <Maximize2 className="h-4 w-4" />}
            </button>
          )}
          
          <button 
            onClick={() => {
              setCallLayout('minimized');
              setCallMinimized(true);
            }}
            className="p-1 hover:bg-white/10 rounded text-discord-text-muted hover:text-white transition"
            title="Minimize"
          >
            <Minus className="h-4 w-4" />
          </button>
        </div>
      </div>

      {/* Settings Overlay */}
      {showSettings && (
        <div className="absolute top-10 right-2 left-2 z-10 bg-discord-sidebar/95 backdrop-blur-xl p-4 rounded-lg border border-discord-hover shadow-2xl animate-in fade-in slide-in-from-top-2 duration-200">
          <h3 className="text-white font-bold mb-4 flex items-center">
            <Settings className="h-4 w-4 mr-2" /> Call Settings
          </h3>
          
          <div className="space-y-4">
            <div>
              <label className="text-xs font-bold text-discord-text-muted uppercase mb-1 block">Microphone</label>
              <select 
                className="w-full bg-discord-black text-white text-sm rounded px-2 py-1 outline-none border border-transparent focus:border-discord-accent transition"
                onChange={(e) => callManager.setAudioInputDevice(e.target.value)}
              >
                {devices.audioIn.map(d => <option key={d.deviceId} value={d.deviceId}>{d.label || 'Default Microphone'}</option>)}
              </select>
            </div>
            <div>
              <label className="text-xs font-bold text-discord-text-muted uppercase mb-1 block">Camera</label>
              <select 
                className="w-full bg-discord-black text-white text-sm rounded px-2 py-1 outline-none border border-transparent focus:border-discord-accent transition"
                onChange={(e) => callManager.setVideoInputDevice(e.target.value)}
              >
                {devices.videoIn.map(d => <option key={d.deviceId} value={d.deviceId}>{d.label || 'Default Camera'}</option>)}
              </select>
            </div>
          </div>
          
          <button 
            onClick={() => setShowSettings(false)}
            className="mt-6 w-full bg-discord-accent hover:bg-discord-accent/80 text-white py-2 rounded text-sm font-bold transition"
          >
            Close Settings
          </button>
        </div>
      )}

      {/* Grid Area */}
      <div className={`flex-1 overflow-y-auto p-4 grid gap-4 no-scrollbar ${gridCols}`}>
        {callFeeds.map((feed) => (
          <ParticipantTile 
            // @ts-expect-error - internal SDK property
            key={feed.feedId} 
            feed={feed} 
            isLocal={feed.isLocal()} 
          />
        ))}
        {feedsCount === 0 && (
          <div className="col-span-full flex items-center justify-center text-discord-text-muted animate-pulse">
            Connecting...
          </div>
        )}
      </div>

      {/* Controls */}
      <div className="flex h-20 items-center justify-center space-x-4 bg-discord-nav/30 backdrop-blur-md shrink-0">
        <button 
          onClick={toggleMute}
          className={`h-12 w-12 rounded-full flex items-center justify-center text-white shadow-lg transition-all duration-200 ${isMuted ? 'bg-red-500 hover:bg-red-600' : 'bg-discord-hover hover:bg-[#4E5058]'}`}
          title={isMuted ? "Unmute" : "Mute"}
        >
          {isMuted ? <MicOff className="h-6 w-6" /> : <Mic className="h-6 w-6" />}
        </button>
        
        <button 
          onClick={toggleCamera}
          className={`h-12 w-12 rounded-full flex items-center justify-center text-white shadow-lg transition-all duration-200 ${!isCameraOff ? 'bg-discord-accent hover:bg-opacity-90' : 'bg-discord-hover hover:bg-[#4E5058]'}`}
          title={!isCameraOff ? "Turn Camera Off" : "Turn Camera On"}
        >
          {!isCameraOff ? <Video className="h-6 w-6" /> : <VideoOff className="h-6 w-6" />}
        </button>

        <button 
          onClick={toggleScreensharing}
          className={`h-12 w-12 rounded-full flex items-center justify-center text-white shadow-lg transition-all duration-200 ${isScreensharing ? 'bg-green-500 hover:bg-green-600' : 'bg-discord-hover hover:bg-[#4E5058]'}`}
          title={isScreensharing ? "Stop Screensharing" : "Start Screensharing"}
        >
          {isScreensharing ? <MonitorOff className="h-6 w-6" /> : <Monitor className="h-6 w-6" />}
        </button>

        <button 
          onClick={() => callManager.hangupCall()}
          className="h-12 w-12 rounded-full bg-red-500 hover:bg-red-600 shadow-lg flex items-center justify-center text-white transition-all duration-200 hover:rotate-12"
          title="End Call"
        >
          <PhoneOff className="h-6 w-6" />
        </button>
      </div>
    </div>
  );

  if (callLayout === 'integrated') {
    return content;
  }

  if (isCallMinimized) return null;

  return (
    <Draggable nodeRef={activeNodeRef} bounds="parent" disabled={isMaximized} handle=".drag-handle">
      {content}
    </Draggable>
  );
};

export default ActiveCall;
