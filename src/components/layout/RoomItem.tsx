import React from 'react';
import { Room } from 'matrix-js-sdk';
import { cn } from '../../utils/cn';
import { Hash, Video, Volume2 } from 'lucide-react';
import { useGroupCall } from '../../hooks/useGroupCall';

interface RoomItemProps {
  room: Room;
  isActive: boolean;
  onClick: (roomId: string) => void;
}

const RoomItem: React.FC<RoomItemProps> = ({ room, isActive, onClick }) => {
  const { isCallActive } = useGroupCall(room.roomId);

  const Icon = isCallActive ? Volume2 : Hash;

  return (
    <button
      onClick={() => onClick(room.roomId)}
      className={cn(
        "group flex w-full items-center justify-between rounded px-2 py-1.5 transition",
        isActive
          ? "bg-bg-hover text-white ring-1 ring-white/10 shadow-lg shadow-black/20"
          : "text-text-muted hover:bg-bg-hover hover:text-text-main"
      )}
    >
      <div className="flex items-center overflow-hidden">
        <Icon className={cn(
          "mr-1.5 h-4 w-4 shrink-0 transition-colors",
          isActive || isCallActive ? "text-accent-primary" : "text-text-muted group-hover:text-text-main"
        )} />
        <span className={cn(
          "truncate text-sm font-medium tracking-tight",
          isActive ? "font-bold" : ""
        )}>{room.name}</span>
      </div>
      {isCallActive && (
        <div className="flex h-4 w-4 items-center justify-center rounded-full bg-accent-primary/20 text-accent-primary animate-pulse">
          <Video className="h-3 w-3" />
        </div>
      )}
    </button>
  );
};

export default RoomItem;
