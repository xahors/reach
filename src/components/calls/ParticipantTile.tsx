import React, { useEffect, useRef } from 'react';
import { CallFeed, CallFeedEvent } from 'matrix-js-sdk/lib/webrtc/callFeed';
import { MicOff, User } from 'lucide-react';
import { cn } from '../../utils/cn';

interface ParticipantTileProps {
  feed: CallFeed;
  isLocal?: boolean;
  className?: string;
  onActivity?: (level: number) => void;
  showDetails?: boolean;
}

const ParticipantTile: React.FC<ParticipantTileProps> = ({ feed, isLocal = false, className, onActivity }) => {
  const videoRef = useRef<HTMLVideoElement>(null);
  const audioRef = useRef<HTMLAudioElement>(null);
  const [isAudioMuted, setIsAudioMuted] = React.useState(feed.isAudioMuted());
  const [isVideoMuted, setIsVideoMuted] = React.useState(feed.isVideoMuted());
  const [isSpeaking, setIsSpeaking] = React.useState(false);

  useEffect(() => {
    const onMuteStateChanged = () => {
      setIsAudioMuted(feed.isAudioMuted());
      setIsVideoMuted(feed.isVideoMuted());
    };

    const onSpeaking = (speaking: boolean) => {
      setIsSpeaking(speaking);
      if (onActivity) onActivity(speaking ? 1.0 : 0);
    };

    feed.on(CallFeedEvent.MuteStateChanged, onMuteStateChanged);
    feed.on(CallFeedEvent.Speaking, onSpeaking);

    // Attach stream to video/audio elements
    if (videoRef.current && feed.stream) {
      videoRef.current.srcObject = feed.stream;
    }
    if (audioRef.current && feed.stream && !isLocal) {
      audioRef.current.srcObject = feed.stream;
    }

    return () => {
      feed.removeListener(CallFeedEvent.MuteStateChanged, onMuteStateChanged);
      feed.removeListener(CallFeedEvent.Speaking, onSpeaking);
    };
  }, [feed, isLocal, onActivity]);

  return (
    <div className={cn(
      "relative aspect-video overflow-hidden rounded-xl bg-bg-nav border border-border-main transition-all duration-300",
      isSpeaking ? "ring-2 ring-accent-primary ring-offset-2 ring-offset-bg-main" : "",
      className
    )}>
      {/* Video Element */}
      {!isVideoMuted ? (
        <video
          ref={videoRef}
          autoPlay
          playsInline
          muted={isLocal}
          className="h-full w-full object-cover mirror-local"
          style={{ transform: isLocal ? 'scaleX(-1)' : 'none' }}
        />
      ) : (
        <div className="flex h-full w-full flex-col items-center justify-center bg-bg-nav">
          <div className="flex h-20 w-20 items-center justify-center rounded-full bg-bg-hover border border-border-main shadow-2xl">
            <User className="h-10 w-10 text-text-muted" />
          </div>
          <span className="mt-4 text-xs font-black uppercase tracking-widest text-text-muted">
            {feed.userId.split(':')[0].substring(1)} {isLocal ? '(You)' : ''}
          </span>
        </div>
      )}

      {/* Audio element for remote participants */}
      {!isLocal && <audio ref={audioRef} autoPlay />}

      {/* Overlay info */}
      <div className="absolute bottom-2 left-2 flex items-center space-x-2 rounded-lg bg-black/40 px-2 py-1 backdrop-blur-md border border-white/5">
        <span className="text-[10px] font-bold text-white tracking-tighter uppercase">
          {feed.userId.split(':')[0].substring(1)}
        </span>
        {isAudioMuted && <MicOff className="h-3 w-3 text-red-500" />}
      </div>
    </div>
  );
};

export default ParticipantTile;
