import React, { useEffect, useRef, useState } from 'react';
import { type CallFeed } from 'matrix-js-sdk/lib/webrtc/callFeed';
import { MicOff } from 'lucide-react';
import { callManager } from '../../core/callManager';

interface ParticipantTileProps {
  feed: CallFeed;
  isLocal?: boolean;
}

const ParticipantTile: React.FC<ParticipantTileProps> = ({ feed, isLocal }) => {
  const videoRef = useRef<HTMLVideoElement>(null);
  const audioRef = useRef<HTMLAudioElement>(null);
  const [level, setLevel] = useState(0);
  const [isAudioMuted, setIsAudioMuted] = useState(feed.isAudioMuted());
  const [isVideoMuted, setIsVideoMuted] = useState(feed.isVideoMuted());
  const requestRef = useRef<number>(0);

  useEffect(() => {
    const stream = feed.stream;
    if (videoRef.current && stream) {
      videoRef.current.srcObject = stream;
    }
    if (audioRef.current && stream && !isLocal) {
      audioRef.current.srcObject = stream;
    }

    const onMuteChange = () => {
      setIsAudioMuted(feed.isAudioMuted());
      setIsVideoMuted(feed.isVideoMuted());
    };

    // @ts-expect-error - internal SDK event name
    feed.on('mute_state_changed', onMuteChange);
    return () => {
      // @ts-expect-error - internal SDK event name
      feed.removeListener('mute_state_changed', onMuteChange);
    };
  }, [feed, isLocal]);

  // Audio Activity Indicator
  useEffect(() => {
    if (isAudioMuted) {
      Promise.resolve().then(() => setLevel(0));
      return;
    }

    const stream = feed.stream;
    if (!stream || stream.getAudioTracks().length === 0) return;

    let audioCtx: AudioContext | null = null;
    let source: MediaStreamAudioSourceNode | null = null;
    let analyser: AnalyserNode | null = null;

    try {
      audioCtx = callManager.getContext();
      if (!audioCtx) return;

      source = audioCtx.createMediaStreamSource(stream);
      analyser = audioCtx.createAnalyser();
      analyser.fftSize = 256;
      source.connect(analyser);

      const dataArray = new Uint8Array(analyser.frequencyBinCount);
      const update = () => {
        if (!analyser) return;
        analyser.getByteFrequencyData(dataArray);
        let sum = 0;
        for (let i = 0; i < dataArray.length; i++) sum += dataArray[i];
        const avg = sum / dataArray.length;
        setLevel(Math.min(avg / 128, 1));
        requestRef.current = requestAnimationFrame(update);
      };
      update();
    } catch (e) {
      console.warn('Audio activity failed', e);
    }

    return () => {
      cancelAnimationFrame(requestRef.current);
      source?.disconnect();
      analyser?.disconnect();
    };
  }, [feed.stream, isAudioMuted]);

  return (
    <div className={`relative flex flex-col items-center justify-center bg-discord-black rounded-lg overflow-hidden border-2 transition-all duration-300 ${level > 0.05 ? 'border-green-500 shadow-[0_0_15px_rgba(34,197,94,0.4)]' : 'border-transparent'}`}>
      {/* Video Element */}
      {!isVideoMuted ? (
        <video
          ref={videoRef}
          autoPlay
          playsInline
          muted={isLocal}
          className="w-full h-full object-cover"
        />
      ) : (
        <div className="flex flex-col items-center space-y-4">
          <div className="h-20 w-20 rounded-full bg-discord-accent flex items-center justify-center text-white text-3xl font-bold shadow-xl">
            {feed.userId.charAt(1).toUpperCase()}
          </div>
          <span className="text-discord-text-muted font-bold text-sm uppercase tracking-widest">{feed.userId}</span>
        </div>
      )}

      {/* Audio element for remote feeds */}
      {!isLocal && <audio ref={audioRef} autoPlay />}

      {/* Overlays */}
      <div className="absolute bottom-2 left-2 flex items-center space-x-2 rounded-md bg-black/40 backdrop-blur-sm px-2 py-1 text-xs text-white">
        <span className="font-bold truncate max-w-[100px]">{isLocal ? 'You' : feed.userId.split(':')[0].substring(1)}</span>
        {isAudioMuted && <MicOff className="h-3 w-3 text-red-500" />}
      </div>

      {level > 0.05 && (
        <div className="absolute top-2 right-2 h-2 w-2 rounded-full bg-green-500 animate-pulse shadow-[0_0_8px_rgba(34,197,94,1)]" />
      )}
    </div>
  );
};

export default ParticipantTile;
