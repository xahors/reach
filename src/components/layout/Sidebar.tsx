import React from 'react';
import { Room } from 'matrix-js-sdk';
import { useAppStore } from '../../store/useAppStore';
import { useSpaces } from '../../hooks/useSpaces';
import { useMatrixClient } from '../../hooks/useMatrixClient';
import { cn } from '../../utils/cn';
import { MessageSquare, Plus } from 'lucide-react';

const Sidebar: React.FC = () => {
  const { activeSpaceId, setActiveSpaceId } = useAppStore();
  const { spaces, loading } = useSpaces();
  const client = useMatrixClient();

  const getAvatar = (room: Room) => {
    try {
      return room.getAvatarUrl(client?.getHomeserverUrl() || '', 48, 48, 'crop');
    } catch {
      return null;
    }
  };

  return (
    <div className="flex w-[72px] flex-col items-center bg-bg-nav py-3 space-y-2 border-r border-border-main">
      {/* Home / DMs */}
      <button
        onClick={() => setActiveSpaceId(null)}
        className={cn(
          "group relative flex h-12 w-12 items-center justify-center rounded-[24px] transition-all duration-200 hover:rounded-[16px]",
          activeSpaceId === null 
            ? "bg-accent-primary text-bg-main" 
            : "bg-bg-hover text-text-muted hover:bg-accent-primary hover:text-bg-main"
        )}
      >
        <div className={cn(
          "absolute -left-1 w-1 rounded-r-full bg-white transition-all duration-200",
          activeSpaceId === null ? "h-10" : "h-5 opacity-0 group-hover:opacity-100"
        )} />
        <MessageSquare className="h-7 w-7" />
      </button>

      <div className="h-[2px] w-8 rounded-full bg-border-main mx-auto opacity-50" />

      {/* Spaces */}
      <div className="flex flex-col items-center space-y-2 overflow-y-auto no-scrollbar">
        {loading ? (
          <div className="h-12 w-12 animate-pulse rounded-full bg-bg-hover" />
        ) : (
          spaces.map((space) => {
            const avatarUrl = getAvatar(space);
            const isActive = activeSpaceId === space.roomId;

            return (
              <button
                key={space.roomId}
                onClick={() => setActiveSpaceId(space.roomId)}
                className="group relative flex h-12 w-12 items-center justify-center"
              >
                <div className={cn(
                  "absolute -left-1 w-1 rounded-r-full bg-white transition-all duration-200",
                  isActive ? "h-10" : "h-5 opacity-0 group-hover:opacity-100"
                )} />
                <div className={cn(
                  "flex h-12 w-12 items-center justify-center overflow-hidden transition-all duration-200 hover:rounded-[16px]",
                  isActive ? "rounded-[16px] bg-accent-primary" : "rounded-[24px] bg-bg-hover"
                )}>
                  {avatarUrl ? (
                    <img src={avatarUrl} alt={space.name} className="h-full w-full object-cover" />
                  ) : (
                    <span className={cn(
                      "text-lg font-bold uppercase",
                      isActive ? "text-bg-main" : "text-white"
                    )}>
                      {space.name.charAt(0)}
                    </span>
                  )}
                </div>
              </button>
            );
          })
        )}
      </div>

      {/* Add Space */}
      <button className="group relative flex h-12 w-12 items-center justify-center rounded-[24px] bg-bg-hover text-green-500 transition-all duration-200 hover:rounded-[16px] hover:bg-green-500 hover:text-white">
        <Plus className="h-7 w-7" />
      </button>
    </div>
  );
};

export default Sidebar;
