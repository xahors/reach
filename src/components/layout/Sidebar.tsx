import React, { useState, useEffect, useCallback } from 'react';
import { Room, ClientEvent, RoomEvent } from 'matrix-js-sdk';
import { useAppStore } from '../../store/useAppStore';
import { useSpaces } from '../../hooks/useSpaces';
import { useMatrixClient } from '../../hooks/useMatrixClient';
import { cn } from '../../utils/cn';
import { MessageSquare, Plus } from 'lucide-react';

const Sidebar: React.FC = () => {
  const { activeSpaceId, setActiveSpaceId, setCreateModalOpen } = useAppStore();
  const { spaces, loading } = useSpaces();
  const client = useMatrixClient();

  const [dmUnreads, setDmUnreads] = useState(0);
  const [dmMentions, setDmMentions] = useState(0);

  const updateDmCounts = useCallback(() => {
    if (!client) return;
    try {
      const rooms = client.getRooms();
      let unreads = 0;
      let mentions = 0;
      
      rooms.forEach(room => {
        try {
          const isSpace = typeof room.isSpaceRoom === 'function' ? room.isSpaceRoom() : false;
          if (!isSpace) {
            // @ts-expect-error: Matrix SDK type mismatch for notification count type
            const u = room.getUnreadNotificationCount('total');
            // @ts-expect-error: Matrix SDK type mismatch for notification count type
            const m = room.getUnreadNotificationCount('highlight');
            if (u > 0) unreads += u;
            if (m > 0) mentions += m;
          }
        } catch {
          // Ignore individual room errors
        }
      });
      
      setDmUnreads(unreads);
      setDmMentions(mentions);
    } catch (err) {
      console.warn("Failed to update DM counts:", err);
    }
  }, [client]);

  useEffect(() => {
    if (!client) return;
    const timeout = setTimeout(() => updateDmCounts(), 0);
    
    // Targeted listeners are safer than full sync
    client.on(ClientEvent.Sync, updateDmCounts);
    client.on(RoomEvent.Receipt, updateDmCounts);
    client.on(RoomEvent.Timeline, updateDmCounts);

    return () => {
      clearTimeout(timeout);
      client.removeListener(ClientEvent.Sync, updateDmCounts);
      client.removeListener(RoomEvent.Receipt, updateDmCounts);
      client.removeListener(RoomEvent.Timeline, updateDmCounts);
    };
  }, [client, updateDmCounts]);

  const getAvatar = (room: Room) => {
    try {
      return room.getAvatarUrl(client?.getHomeserverUrl() || '', 48, 48, 'crop');
    } catch {
      return null;
    }
  };

  const renderActiveBorder = () => (
    <div className="absolute inset-[-6px] pointer-events-none z-10">
      <svg width="100%" height="100%" viewBox="0 0 60 60" fill="none" xmlns="http://www.w3.org/2000/svg">
        {/* Top Left */}
        <path d="M12 2H6C3.79086 2 2 3.79086 2 6V12" stroke="var(--accent-primary)" strokeWidth="3" strokeLinecap="round"/>
        {/* Top Right */}
        <path d="M48 2H54C56.2091 2 58 3.79086 58 6V12" stroke="var(--accent-primary)" strokeWidth="3" strokeLinecap="round"/>
        {/* Bottom Left */}
        <path d="M2 48V54C2 56.2091 3.79086 58 6 58H12" stroke="var(--accent-primary)" strokeWidth="3" strokeLinecap="round"/>
        {/* Bottom Right */}
        <path d="M58 48V54C58 56.2091 56.2091 58 54 58H48" stroke="var(--accent-primary)" strokeWidth="3" strokeLinecap="round"/>
      </svg>
    </div>
  );

  return (
    <div className="flex w-[72px] flex-col items-center bg-bg-nav py-3 border-r border-border-main">
      {/* Home / DMs */}
      <div className="relative mb-2">
        <button
          onClick={() => setActiveSpaceId(null)}
          className={cn(
            "group relative flex h-12 w-12 items-center justify-center rounded-[24px] transition-all duration-200 hover:rounded-[16px]",
            activeSpaceId === null 
              ? "bg-accent-primary text-bg-main" 
              : "bg-bg-hover text-text-muted hover:bg-accent-primary hover:text-bg-main"
          )}
        >
          {activeSpaceId === null && renderActiveBorder()}
          <MessageSquare className="h-7 w-7" />
        </button>
        
        {dmMentions > 0 ? (
          <div className="absolute -top-1 -right-1 flex h-5 min-w-5 items-center justify-center rounded-full bg-red-500 px-1.5 text-[10px] font-black text-white border-2 border-bg-nav shadow-lg animate-in zoom-in duration-300">
            {dmMentions > 99 ? '99+' : dmMentions}
          </div>
        ) : dmUnreads > 0 && activeSpaceId !== null ? (
          <div className="absolute top-0 -right-1 h-3 w-3 rounded-full bg-white border-2 border-bg-nav shadow-sm animate-in zoom-in duration-300" />
        ) : null}
      </div>

      <div className="h-[2px] w-8 rounded-full bg-border-main mx-auto opacity-50 shrink-0 mb-2" />

      {/* Spaces */}
      <div className="flex flex-col items-center space-y-2 overflow-y-auto no-scrollbar flex-1 w-full py-2">
        {loading ? (
          <div className="h-12 w-12 animate-pulse rounded-full bg-bg-hover" />
        ) : (
          spaces.map((space) => {
            const avatarUrl = getAvatar(space);
            const isActive = activeSpaceId === space.roomId;
            
            return (
              <SpaceIcon 
                key={space.roomId}
                space={space}
                isActive={isActive}
                avatarUrl={avatarUrl}
                onClick={() => setActiveSpaceId(space.roomId)}
                renderActiveBorder={renderActiveBorder}
              />
            );
          })
        )}
      </div>

      {/* Add Space */}
      <button 
        onClick={() => setCreateModalOpen(true, 'space')}
        className="group relative flex h-12 w-12 mt-2 items-center justify-center rounded-[24px] bg-bg-hover text-green-500 transition-all duration-200 hover:rounded-[16px] hover:bg-green-500 hover:text-white"
      >
        <Plus className="h-7 w-7" />
      </button>
    </div>
  );
};

interface SpaceIconProps {
  space: Room;
  isActive: boolean;
  avatarUrl: string | null;
  onClick: () => void;
  renderActiveBorder: () => React.ReactNode;
}

const SpaceIcon: React.FC<SpaceIconProps> = ({ space, isActive, avatarUrl, onClick, renderActiveBorder }) => {
  const client = useMatrixClient();
  const [unreads, setUnreads] = useState(0);
  const [mentions, setMentions] = useState(0);

  const updateCounts = useCallback(() => {
    if (!space) return;
    try {
      // @ts-expect-error: Matrix SDK type mismatch for notification count type
      setUnreads(space.getUnreadNotificationCount('total'));
      // @ts-expect-error: Matrix SDK type mismatch for notification count type
      setMentions(space.getUnreadNotificationCount('highlight'));
    } catch {
      // Ignore errors for individual spaces
    }
  }, [space]);

  useEffect(() => {
    if (!client || !space) return;
    const timeout = setTimeout(() => updateCounts(), 0);
    const onUpdate = () => updateCounts();
    
    // Listen for events specific to this space room
    space.on(RoomEvent.Timeline, onUpdate);
    space.on(RoomEvent.Receipt, onUpdate);

    return () => {
      clearTimeout(timeout);
      space.removeListener(RoomEvent.Timeline, onUpdate);
      space.removeListener(RoomEvent.Receipt, onUpdate);
    };
  }, [client, space, updateCounts]);

  return (
    <div className="relative">
      <button
        onClick={onClick}
        className="group relative flex h-12 w-12 items-center justify-center"
      >
        {isActive && renderActiveBorder()}

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

      {mentions > 0 ? (
        <div className="absolute -top-1 -right-1 flex h-5 min-w-5 items-center justify-center rounded-full bg-red-500 px-1.5 text-[10px] font-black text-white border-2 border-bg-nav shadow-lg animate-in zoom-in duration-300">
          {mentions > 99 ? '99+' : mentions}
        </div>
      ) : unreads > 0 && !isActive ? (
        <div className="absolute top-0 -right-1 h-3 w-3 rounded-full bg-white border-2 border-bg-nav shadow-sm animate-in zoom-in duration-300" />
      ) : null}
    </div>
  );
};

export default Sidebar;
