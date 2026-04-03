import React from 'react';
import { useSpaces } from '../../hooks/useSpaces';
import { useAppStore } from '../../store/useAppStore';
import { useMatrixClient } from '../../hooks/useMatrixClient';
import { cn } from '../../utils/cn';

const Sidebar: React.FC = () => {
  const { spaces, loading } = useSpaces();
  const { activeSpaceId, setActiveSpaceId } = useAppStore();
  const client = useMatrixClient();

  const getAvatar = (space: any) => {
    if (!client || typeof space.getAvatarUrl !== 'function') return null;
    try {
      // In matrix-js-sdk v41+, baseUrl must be a valid URL string, null can throw
      return space.getAvatarUrl(client.getHomeserverUrl(), 48, 48, 'crop');
    } catch (e) {
      return null;
    }
  };

  return (
    <div className="flex h-full w-[72px] flex-col items-center bg-discord-nav py-3 space-y-2 overflow-y-auto no-scrollbar">
      {/* Home Button (DMs) */}
      <button
        onClick={() => setActiveSpaceId(null)}
        className={cn(
          "group relative flex h-12 w-12 items-center justify-center rounded-[24px] bg-discord-sidebar transition-all duration-200 hover:rounded-[16px] hover:bg-discord-accent",
          !activeSpaceId && "rounded-[16px] bg-discord-accent"
        )}
      >
        <div
          className={cn(
            "absolute left-[-4px] h-2 w-2 rounded-r bg-white transition-all duration-200",
            !activeSpaceId ? "h-10 opacity-100" : "opacity-0 group-hover:h-5 group-hover:opacity-100"
          )}
        />
        <svg viewBox="0 0 24 24" className="h-7 w-7 fill-white">
          <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm-1 14.5v-9l6 4.5-6 4.5z" />
        </svg>
      </button>

      <div className="h-[2px] w-8 rounded-full bg-discord-sidebar" />

      {/* Spaces List */}
      {loading ? (
        <div className="h-12 w-12 animate-pulse rounded-full bg-discord-sidebar" />
      ) : (
        spaces.map((space) => {
          const avatarUrl = getAvatar(space);
          return (
            <button
              key={space.roomId}
              onClick={() => setActiveSpaceId(space.roomId)}
              className="group relative flex h-12 w-12 items-center justify-center transition-all duration-200"
              title={space.name}
            >
              <div
                className={cn(
                  "absolute left-[-4px] h-2 w-2 rounded-r bg-white transition-all duration-200",
                  activeSpaceId === space.roomId ? "h-10 opacity-100" : "opacity-0 group-hover:h-5 group-hover:opacity-100"
                )}
              />
              {avatarUrl ? (
                <img
                  src={avatarUrl || ''}
                  alt={space.name}
                  className={cn(
                    "h-12 w-12 rounded-[24px] bg-discord-sidebar object-cover transition-all duration-200 group-hover:rounded-[16px]",
                    activeSpaceId === space.roomId && "rounded-[16px]"
                  )}
                />
              ) : (
                <div
                  className={cn(
                    "flex h-12 w-12 items-center justify-center rounded-[24px] bg-discord-sidebar text-lg font-medium transition-all duration-200 group-hover:rounded-[16px] group-hover:bg-discord-accent group-hover:text-white",
                    activeSpaceId === space.roomId && "rounded-[16px] bg-discord-accent text-white"
                  )}
                >
                  {space.name.charAt(0).toUpperCase()}
                </div>
              )}
            </button>
          );
        })
      )}
    </div>
  );
};

export default Sidebar;
