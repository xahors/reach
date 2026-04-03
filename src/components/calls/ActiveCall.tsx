import React, { useEffect, useRef, useState } from 'react';
import { useAppStore } from '../../store/useAppStore';
import { callManager } from '../../core/callManager';
import { Phone, PhoneOff, Mic, MicOff, Video, VideoOff, GripHorizontal, Minus } from 'lucide-react';
import { CallEvent } from 'matrix-js-sdk';
import Draggable from 'react-draggable';

const MicActivityIndicator: React.FC<{ stream: MediaStream | null }> = ({ stream }) => {
  const [level, setLevel] = useState(0);
  const requestRef = useRef<number>(0);
  const analyserRef = useRef<AnalyserNode | null>(null);
  const sourceRef = useRef<MediaStreamAudioSourceNode | null>(null);

  useEffect(() => {
    if (!stream || stream.getAudioTracks().length === 0) {
      Promise.resolve().then(() => setLevel(0));
      return;
    }

    let audioCtx: AudioContext | null = null;

    try {
      audioCtx = callManager.getContext();
      if (!audioCtx) return;

      // Clean up previous source if any
      if (sourceRef.current) sourceRef.current.disconnect();
      if (analyserRef.current) analyserRef.current.disconnect();

      const source = audioCtx.createMediaStreamSource(stream);
      const analyser = audioCtx.createAnalyser();
      analyser.fftSize = 512;
      analyser.smoothingTimeConstant = 0.4;
      source.connect(analyser);
      
      sourceRef.current = source;
      analyserRef.current = analyser;

      const bufferLength = analyser.frequencyBinCount;
      const dataArray = new Uint8Array(bufferLength);

      const update = () => {
        if (!analyserRef.current) return;
        
        analyserRef.current.getByteFrequencyData(dataArray);
        let sum = 0;
        for (let i = 0; i < bufferLength; i++) {
          sum += dataArray[i];
        }
        const average = sum / bufferLength;
        // High sensitivity for visualization: boost the signal
        const normalized = Math.min((average * 2.5) / 128, 1);
        setLevel(normalized);
        requestRef.current = requestAnimationFrame(update);
      };

      update();

      return () => {
        cancelAnimationFrame(requestRef.current);
        if (sourceRef.current) sourceRef.current.disconnect();
        if (analyserRef.current) analyserRef.current.disconnect();
      };
    } catch (e) {
      console.warn('Mic indicator failed', e);
    }
  }, [stream]);

  return (
    <div className="h-2 w-full bg-discord-black rounded-full overflow-hidden mt-1 flex border border-white/5">
      <div 
        className="h-full bg-green-500 transition-all duration-75 ease-out shadow-[0_0_8px_rgba(34,197,94,0.6)]" 
        style={{ width: `${level * 100}%`, opacity: level > 0.02 ? 1 : 0.2 }}
      />
    </div>
  );
};

const ActiveCall: React.FC = () => {
  const { 
    activeCall, 
    incomingCall, 
    isCallMinimized, 
    setCallMinimized, 
    isMuted, 
    setMuted, 
    isCameraOff, 
    setCameraOff 
  } = useAppStore();
  
  const localVideoRef = useRef<HTMLVideoElement>(null);
  const remoteVideoRef = useRef<HTMLVideoElement>(null);
  const audioRef = useRef<HTMLAudioElement>(null);
  
  const [callState, setCallState] = useState<string>('');
  const [localStream, setLocalStream] = useState<MediaStream | null>(null);
  const [remoteStream, setRemoteStream] = useState<MediaStream | null>(null);
  
  // nodeRefs for react-draggable
  const incomingNodeRef = useRef<HTMLDivElement>(null);
  const activeNodeRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!activeCall) {
      if (callState !== '') {
        Promise.resolve().then(() => {
          setCallState('');
          setLocalStream(null);
          setRemoteStream(null);
        });
      }
      return;
    }

    const updateState = () => {
      setCallState(activeCall.state);
      setMuted(activeCall.isMicrophoneMuted());
      setCameraOff(activeCall.isLocalVideoMuted());
      setLocalStream(activeCall.localUsermediaStream || null);
      setRemoteStream(activeCall.remoteUsermediaStream || null);
    };

    updateState();
    
    // Poll for stream updates since they don't always fire events immediately
    const interval = setInterval(updateState, 1000);

    activeCall.on(CallEvent.State, updateState);
    activeCall.on(CallEvent.FeedsChanged, updateState);
    activeCall.on(CallEvent.LocalHoldUnhold, updateState);
    activeCall.on(CallEvent.RemoteHoldUnhold, updateState);

    return () => {
      clearInterval(interval);
      activeCall.removeListener(CallEvent.State, updateState);
      activeCall.removeListener(CallEvent.FeedsChanged, updateState);
      activeCall.removeListener(CallEvent.LocalHoldUnhold, updateState);
      activeCall.removeListener(CallEvent.RemoteHoldUnhold, updateState);
    };
  }, [activeCall, callState, setMuted, setCameraOff]);

  // Ensure video elements stay in sync with streams
  useEffect(() => {
    if (localVideoRef.current && localStream) {
      if (localVideoRef.current.srcObject !== localStream) {
        localVideoRef.current.srcObject = localStream;
      }
    }
  }, [localStream]);

  useEffect(() => {
    if (remoteVideoRef.current && remoteStream) {
      if (remoteVideoRef.current.srcObject !== remoteStream) {
        remoteVideoRef.current.srcObject = remoteStream;
      }
    }
    if (audioRef.current && remoteStream) {
      if (audioRef.current.srcObject !== remoteStream) {
        audioRef.current.srcObject = remoteStream;
      }
    }
  }, [remoteStream]);

  const toggleMute = () => {
    if (activeCall) {
      callManager.warmupAudioContext();
      const newMuted = !isMuted;
      callManager.setMuted(newMuted);
      setMuted(newMuted);
    }
  };

  const toggleCamera = async () => {
    if (activeCall) {
      callManager.warmupAudioContext();
      const newCameraOff = !isCameraOff;
      await callManager.setVideoMuted(newCameraOff);
      setCameraOff(newCameraOff);
    }
  };

  if (!activeCall && !incomingCall) return null;
  if (activeCall && isCallMinimized) return null;

  if (incomingCall) {
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

  if (activeCall) {
    return (
      <div className="fixed inset-0 pointer-events-none z-50">
        <Draggable nodeRef={activeNodeRef} handle=".drag-handle" bounds="parent">
          <div ref={activeNodeRef} className="absolute bottom-4 left-1/2 -translate-x-1/2 pointer-events-auto rounded-lg bg-discord-sidebar p-4 shadow-xl border border-discord-hover w-[400px]">
            <div className="drag-handle flex cursor-grab active:cursor-grabbing items-center justify-center mb-2 -mt-2 opacity-50 hover:opacity-100 transition">
              <GripHorizontal className="h-5 w-5 text-discord-text-muted" />
            </div>
            
            <div className="flex justify-between items-center mb-4">
               <div className="flex items-center space-x-2">
                 <h3 className="text-white font-bold text-sm uppercase">Active Call: {callState}</h3>
                 <button 
                   onClick={() => setCallMinimized(true)}
                   className="rounded p-1 hover:bg-discord-hover text-discord-text-muted hover:text-white transition"
                   title="Minimize"
                 >
                   <Minus className="h-4 w-4" />
                 </button>
               </div>
               <span className="text-xs text-discord-text-muted animate-pulse">{!isCameraOff ? 'Video' : 'Voice'}</span>
            </div>
            
            <div className="mb-4 rounded-md bg-discord-black/60 p-3 border border-white/5">
              <div className="flex justify-between items-center mb-1">
                <div className="text-[10px] text-discord-text-muted font-bold uppercase tracking-widest">Microphone Activity</div>
                {isMuted && <span className="text-[9px] bg-red-500/20 text-red-500 px-1 rounded">MUTED</span>}
              </div>
              <MicActivityIndicator stream={localStream} />
            </div>

            {/* Video Area */}
            <div className={`relative mb-4 bg-black rounded-lg overflow-hidden transition-all duration-500 shadow-inner ${!isCameraOff ? 'h-56' : 'h-0 opacity-0 mb-0'}`}>
              <video ref={remoteVideoRef} autoPlay playsInline className="w-full h-full object-cover" />
              <div className="absolute bottom-2 right-2 w-32 h-24 overflow-hidden rounded-md border-2 border-discord-border shadow-lg bg-discord-dark">
                <video ref={localVideoRef} autoPlay playsInline muted className="absolute bottom-2 right-2 w-full h-full object-cover" />
                {isCameraOff && <div className="flex h-full items-center justify-center text-discord-text-muted bg-discord-dark"><VideoOff className="h-6 w-6" /></div>}
              </div>
            </div>

            {/* Audio element for voice calls */}
            <audio ref={audioRef} autoPlay />

            <div className="flex justify-center space-x-4">
              <button 
                onClick={toggleMute}
                className={`h-12 w-12 rounded-full flex items-center justify-center text-white shadow-lg transition-all duration-200 ${isMuted ? 'bg-red-500 hover:bg-red-600 animate-pulse' : 'bg-discord-hover hover:bg-[#4E5058]'}`}
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
                onClick={() => callManager.hangupCall()}
                className="h-12 w-12 rounded-full bg-red-500 hover:bg-red-600 shadow-lg flex items-center justify-center text-white transition-all duration-200 hover:rotate-12"
                title="End Call"
              >
                <PhoneOff className="h-6 w-6" />
              </button>
            </div>
          </div>
        </Draggable>
      </div>
    );
  }

  return null;
};

export default ActiveCall;
