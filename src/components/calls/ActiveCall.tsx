import React, { useEffect, useRef, useState } from 'react';
import { useAppStore } from '../../store/useAppStore';
import { callManager } from '../../core/callManager';
import { Phone, PhoneOff, Mic, MicOff, Video, VideoOff, GripHorizontal, Minus } from 'lucide-react';
import { CallEvent, type MatrixCall } from 'matrix-js-sdk';
import Draggable from 'react-draggable';

const MicActivityIndicator: React.FC<{ call: MatrixCall | null, isLocal?: boolean }> = ({ call, isLocal }) => {
  const [level, setLevel] = useState(0);
  const requestRef = useRef<number>(0);
  const analyserRef = useRef<AnalyserNode | null>(null);

  useEffect(() => {
    if (!call) return;

    const stream = isLocal ? call.localUsermediaStream : call.remoteUsermediaStream;
    if (!stream || stream.getAudioTracks().length === 0) {
      Promise.resolve().then(() => setLevel(0));
      return;
    }

    try {
      const AudioContextClass = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
      const audioCtx = new AudioContextClass();
      const source = audioCtx.createMediaStreamSource(stream);
      const analyser = audioCtx.createAnalyser();
      analyser.fftSize = 256;
      source.connect(analyser);
      analyserRef.current = analyser;

      const bufferLength = analyser.frequencyBinCount;
      const dataArray = new Uint8Array(bufferLength);

      const update = () => {
        analyser.getByteFrequencyData(dataArray);
        let sum = 0;
        for (let i = 0; i < bufferLength; i++) {
          sum += dataArray[i];
        }
        const average = sum / bufferLength;
        setLevel(Math.min(average / 128, 1));
        requestRef.current = requestAnimationFrame(update);
      };

      update();

      return () => {
        cancelAnimationFrame(requestRef.current);
        audioCtx.close().catch(() => {});
      };
    } catch (e) {
      console.warn('Mic indicator failed', e);
    }
  }, [call, isLocal]);

  return (
    <div className="h-1 w-full bg-discord-black rounded-full overflow-hidden mt-1">
      <div 
        className="h-full bg-green-500 transition-all duration-75" 
        style={{ width: `${level * 100}%`, opacity: level > 0.1 ? 1 : 0.3 }}
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
  
  // nodeRefs for react-draggable to avoid findDOMNode (React 19 compatibility)
  const incomingNodeRef = useRef<HTMLDivElement>(null);
  const activeNodeRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!activeCall) {
      if (callState !== '') {
        Promise.resolve().then(() => setCallState(''));
      }
      return;
    }

    if (callState !== activeCall.state) {
      Promise.resolve().then(() => setCallState(activeCall.state));
    }
    
    setMuted(activeCall.isMicrophoneMuted());
    setCameraOff(activeCall.isLocalVideoMuted());

    const onState = (state: string) => {
       setCallState(state);
    };

    const updateStreams = () => {
       if (activeCall.localUsermediaStream && localVideoRef.current) {
          localVideoRef.current.srcObject = activeCall.localUsermediaStream;
       }
       if (activeCall.remoteUsermediaStream) {
          if (remoteVideoRef.current) {
             remoteVideoRef.current.srcObject = activeCall.remoteUsermediaStream;
          }
          if (audioRef.current) {
             audioRef.current.srcObject = activeCall.remoteUsermediaStream;
          }
       }
    };

    const onMute = () => {
      setMuted(activeCall.isMicrophoneMuted());
      setCameraOff(activeCall.isLocalVideoMuted());
    };

    updateStreams();

    activeCall.on(CallEvent.State, onState);
    activeCall.on(CallEvent.FeedsChanged, updateStreams);
    activeCall.on(CallEvent.LocalHoldUnhold, updateStreams);
    activeCall.on(CallEvent.RemoteHoldUnhold, updateStreams);
    // @ts-expect-error: internal events
    activeCall.on('local_video_muted', onMute);
    // @ts-expect-error: internal events
    activeCall.on('microphone_muted', onMute);

    return () => {
      activeCall.removeListener(CallEvent.State, onState);
      activeCall.removeListener(CallEvent.FeedsChanged, updateStreams);
      activeCall.removeListener(CallEvent.LocalHoldUnhold, updateStreams);
      activeCall.removeListener(CallEvent.RemoteHoldUnhold, updateStreams);
    };
  }, [activeCall, callState, setMuted, setCameraOff]);

  const toggleMute = () => {
    if (activeCall) {
      callManager.warmupAudioContext();
      const newMuted = !isMuted;
      callManager.setMuted(newMuted);
      setMuted(newMuted);
    }
  };

  const toggleCamera = () => {
    if (activeCall) {
      callManager.warmupAudioContext();
      const newCameraOff = !isCameraOff;
      callManager.setVideoMuted(newCameraOff);
      setCameraOff(newCameraOff);
    }
  };

  if (!activeCall && !incomingCall) return null;
  
  // Hide the floating modal if minimized
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
            
            <div className="mb-4">
              <div className="text-[10px] text-discord-text-muted mb-1 font-bold uppercase">Local Mic Activity</div>
              <MicActivityIndicator call={activeCall} isLocal={true} />
            </div>

            {/* Video Area */}
            <div className={`relative mb-4 bg-black rounded overflow-hidden transition-all duration-300 ${!isCameraOff ? 'h-48' : 'h-0 opacity-0 mb-0'}`}>
              <video ref={remoteVideoRef} autoPlay playsInline className="w-full h-full object-cover" />
              <video ref={localVideoRef} autoPlay playsInline muted className="absolute bottom-2 right-2 w-24 h-16 object-cover bg-gray-800 rounded border border-gray-600" />
            </div>

            {/* Audio element for voice calls */}
            <audio ref={audioRef} autoPlay />

            <div className="flex justify-center space-x-4">
              <button 
                onClick={toggleMute}
                className={`h-10 w-10 rounded-full flex items-center justify-center text-white transition ${isMuted ? 'bg-red-500 hover:bg-red-600' : 'bg-discord-hover hover:bg-[#4E5058]'}`}
                title={isMuted ? "Unmute" : "Mute"}
              >
                {isMuted ? <MicOff className="h-5 w-5" /> : <Mic className="h-5 w-5" />}
              </button>
              
              <button 
                onClick={toggleCamera}
                className={`h-10 w-10 rounded-full flex items-center justify-center text-white transition ${!isCameraOff ? 'bg-discord-accent hover:bg-opacity-90' : 'bg-discord-hover hover:bg-[#4E5058]'}`}
                title={!isCameraOff ? "Turn Camera Off" : "Turn Camera On"}
              >
                {!isCameraOff ? <Video className="h-5 w-5" /> : <VideoOff className="h-5 w-5" />}
              </button>

              <button 
                onClick={() => callManager.hangupCall()}
                className="h-10 w-10 rounded-full bg-red-500 hover:bg-red-600 flex items-center justify-center text-white transition"
                title="End Call"
              >
                <PhoneOff className="h-5 w-5" />
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
