import React, { useEffect, useRef, useState } from 'react';
import { useAppStore } from '../../store/useAppStore';
import { callManager } from '../../core/callManager';
import { Phone, PhoneOff, Mic, GripHorizontal } from 'lucide-react';
import { CallEvent } from 'matrix-js-sdk';
import Draggable from 'react-draggable';

const ActiveCall: React.FC = () => {
  const { activeCall, incomingCall } = useAppStore();
  const localVideoRef = useRef<HTMLVideoElement>(null);
  const remoteVideoRef = useRef<HTMLVideoElement>(null);
  const audioRef = useRef<HTMLAudioElement>(null);
  const [callState, setCallState] = useState<string>('');

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

    const onState = (state: string) => {
       setCallState(state);
    };

    const updateStreams = () => {
       if (activeCall.localUsermediaStream && localVideoRef.current) {
          localVideoRef.current.srcObject = activeCall.localUsermediaStream;
       }
       if (activeCall.remoteUsermediaStream) {
          if (activeCall.type === 'video' && remoteVideoRef.current) {
             remoteVideoRef.current.srcObject = activeCall.remoteUsermediaStream;
          } else if (audioRef.current) {
             audioRef.current.srcObject = activeCall.remoteUsermediaStream;
          }
       }
    };

    updateStreams();

    activeCall.on(CallEvent.State, onState);
    activeCall.on(CallEvent.FeedsChanged, updateStreams);
    activeCall.on(CallEvent.LocalHoldUnhold, updateStreams);
    activeCall.on(CallEvent.RemoteHoldUnhold, updateStreams);

    return () => {
      activeCall.removeListener(CallEvent.State, onState);
      activeCall.removeListener(CallEvent.FeedsChanged, updateStreams);
      activeCall.removeListener(CallEvent.LocalHoldUnhold, updateStreams);
      activeCall.removeListener(CallEvent.RemoteHoldUnhold, updateStreams);
    };
  }, [activeCall, callState]);

  if (!activeCall && !incomingCall) return null;

  if (incomingCall) {
    return (
      <div className="absolute top-4 right-4 z-50">
        <Draggable bounds="parent">
          <div className="w-72 cursor-move rounded-lg bg-discord-sidebar p-4 shadow-xl border border-discord-hover">
            <div className="flex items-center justify-between mb-2">
              <h3 className="text-white font-bold">Incoming Call</h3>
              <GripHorizontal className="h-4 w-4 text-discord-text-muted" />
            </div>
            <p className="text-discord-text-muted text-sm mb-4">From: {incomingCall.roomId}</p>
            <div className="flex space-x-2">
              <button 
                onClick={(e) => { e.stopPropagation(); callManager.acceptCall(); }}
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
        <Draggable handle=".drag-handle" bounds="parent">
          <div className="absolute bottom-4 left-1/2 -translate-x-1/2 pointer-events-auto rounded-lg bg-discord-sidebar p-4 shadow-xl border border-discord-hover w-[400px]">
            <div className="drag-handle flex cursor-grab active:cursor-grabbing items-center justify-center mb-2 -mt-2 opacity-50 hover:opacity-100 transition">
              <GripHorizontal className="h-5 w-5 text-discord-text-muted" />
            </div>
            
            <div className="flex justify-between items-center mb-4">
               <h3 className="text-white font-bold text-sm">Active Call: {callState}</h3>
               <span className="text-xs text-discord-text-muted animate-pulse">{activeCall.type === 'video' ? 'Video' : 'Voice'}</span>
            </div>
            
            {activeCall.type === 'video' && (
              <div className="relative mb-4 bg-black rounded overflow-hidden h-48">
                <video ref={remoteVideoRef} autoPlay playsInline className="w-full h-full object-cover" />
                <video ref={localVideoRef} autoPlay playsInline muted className="absolute bottom-2 right-2 w-24 h-16 object-cover bg-gray-800 rounded border border-gray-600" />
              </div>
            )}

            {/* Audio element for voice calls */}
            <audio ref={audioRef} autoPlay />

            <div className="flex justify-center space-x-4">
              <button className="h-10 w-10 rounded-full bg-discord-hover hover:bg-[#4E5058] flex items-center justify-center text-white transition">
                <Mic className="h-5 w-5" />
              </button>
              <button 
                onClick={() => callManager.hangupCall()}
                className="h-10 w-10 rounded-full bg-red-500 hover:bg-red-600 flex items-center justify-center text-white transition"
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
