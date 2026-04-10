import React from 'react';
import { Room } from 'matrix-js-sdk';
import { cn } from '../../utils/cn';
import { Hash, Video } from 'lucide-react';
import { useGroupCall } from '../../hooks/useGroupCall';

interface RoomItemProps {
  room: Room;
  isActive: boolean;
  onClick: (roomId: string) => void;
}

const RoomItem: React.FC<RoomItemProps> = ({ room, isActive, onClick }) => {
  const { isCallActive } = useGroupCall(room.roomId);

  return (
    <button
      onClick={() => onClick(room.roomId)}
      className={cn(
        "group flex w-full items-center justify-between rounded px-2 py-1.5 transition",
        isActive
          ? "bg-discord-hover text-white"
          : "text-discord-text-muted hover:bg-discord-hover hover:text-discord-text"
      )}
    >
      <div className="flex items-center overflow-hidden">
        <Hash className="mr-1.5 h-5 w-5 shrink-0 text-discord-text-muted" />
        <span className="truncate text-base font-medium">{room.name}</span>
      </div>
      {isCallActive && (
        <div className="flex h-5 w-5 items-center justify-center rounded-full bg-green-500/20 text-green-500 group-hover:bg-green-500 group-hover:text-white transition-colors animate-pulse">
          <Video className="h-3 w-3" />
        </div>
      )}
    </button>
  );
};

export default RoomItem;
