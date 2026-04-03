import React from 'react';
import { useAppStore } from '../../store/useAppStore';
import { useSpaceRooms } from '../../hooks/useSpaceRooms';
import { useDirectMessages } from '../../hooks/useDirectMessages';
import { useMatrixClient } from '../../hooks/useMatrixClient';
import { cn } from '../../utils/cn';
import { Hash, ChevronDown, Plus, Settings } from 'lucide-react';

const ChannelList: React.FC = () => {
  const { activeSpaceId, activeRoomId, setActiveRoomId, setSettingsOpen } = useAppStore();
  const { rooms, loading: spaceLoading } = useSpaceRooms(activeSpaceId);
  const { dms, loading: dmsLoading } = useDirectMessages();
  const client = useMatrixClient();

  const activeSpace = activeSpaceId ? client?.getRoom(activeSpaceId) : null;

  const renderUserFooter = () => (
    <div className="flex h-14 items-center bg-[#232428] px-2 py-2 mt-auto">
      <div className="flex flex-1 items-center rounded px-1 transition hover:bg-discord-hover">
        <div className="relative h-8 w-8 rounded-full bg-discord-accent flex items-center justify-center text-white font-bold text-sm">
           {client?.getUserId()?.charAt(1).toUpperCase()}
           <div className="absolute bottom-0 right-0 h-3 w-3 rounded-full border-2 border-[#232428] bg-green-500" />
        </div>
        <div className="ml-2 flex flex-col overflow-hidden">
          <span className="truncate text-sm font-bold text-white leading-tight">
            {client?.getUserId()?.split(':')[0].substring(1)}
          </span>
          <span className="truncate text-xs text-discord-text-muted leading-tight">
            Online
          </span>
        </div>
      </div>
      <div className="flex items-center space-x-1">
        <button 
          onClick={() => setSettingsOpen(true)}
          className="rounded p-1 text-discord-text hover:bg-discord-hover hover:text-white transition"
          title="User Settings"
        >
           <Settings className="h-5 w-5" />
        </button>
      </div>
    </div>
  );

  if (!activeSpaceId) {
    return (
      <div className="flex h-full w-60 flex-col bg-discord-sidebar">
        <div className="flex h-12 items-center px-4 shadow-sm">
          <h1 className="text-base font-bold text-white">Direct Messages</h1>
        </div>
        <div className="flex-1 overflow-y-auto pt-4 no-scrollbar">
          <div className="mb-2 px-2">
            <div className="mt-1 space-y-[2px]">
              {dmsLoading ? (
                <div className="mx-2 h-10 animate-pulse rounded bg-discord-hover" />
              ) : dms.length === 0 ? (
                <p className="px-2 text-xs text-discord-text-muted italic">No direct messages found.</p>
              ) : (
                dms.map(({ room, otherUserId }) => {
                  const otherMember = room.getMember(otherUserId);
                  const name = otherMember?.name || otherUserId.split(':')[0].substring(1);
                  let avatarUrl = null;
                  try {
                    avatarUrl = otherMember?.getAvatarUrl(client!.getHomeserverUrl(), 32, 32, 'crop', undefined, true);
                  } catch (e) {}

                  return (
                    <button
                      key={room.roomId}
                      onClick={() => setActiveRoomId(room.roomId)}
                      className={cn(
                        "group flex w-full items-center rounded px-2 py-1.5 transition",
                        activeRoomId === room.roomId
                          ? "bg-discord-hover text-white"
                          : "text-discord-text-muted hover:bg-discord-hover hover:text-discord-text"
                      )}
                    >
                      <div className="mr-3 h-8 w-8 shrink-0 rounded-full bg-discord-accent flex items-center justify-center text-white font-bold text-xs overflow-hidden">
                        {avatarUrl ? (
                          <img src={avatarUrl} alt="" className="h-full w-full object-cover" />
                        ) : (
                          name.charAt(0).toUpperCase()
                        )}
                      </div>
                      <span className="truncate text-base font-medium">{name}</span>
                    </button>
                  );
                })
              )}
            </div>
          </div>
        </div>
        {renderUserFooter()}
      </div>
    );
  }

  return (
    <div className="flex h-full w-60 flex-col bg-discord-sidebar">
      <button className="flex h-12 items-center justify-between px-4 transition hover:bg-discord-hover shadow-sm">
        <span className="truncate text-base font-bold text-white">
          {activeSpace?.name || 'Loading Space...'}
        </span>
        <ChevronDown className="h-4 w-4 text-discord-text" />
      </button>

      <div className="flex-1 overflow-y-auto pt-4 no-scrollbar">
        <div className="mb-2 px-2">
          <div className="flex items-center justify-between px-2 text-xs font-bold uppercase text-discord-text-muted hover:text-discord-text">
            <div className="flex items-center">
              <ChevronDown className="mr-0.5 h-3 w-3" />
              <span>Text Channels</span>
            </div>
            <Plus className="h-4 w-4 cursor-pointer" />
          </div>

          <div className="mt-1 space-y-[2px]">
            {spaceLoading ? (
              <div className="mx-2 h-8 animate-pulse rounded bg-discord-hover" />
            ) : (
              rooms.map((room) => (
                <button
                  key={room.roomId}
                  onClick={() => setActiveRoomId(room.roomId)}
                  className={cn(
                    "group flex w-full items-center rounded px-2 py-1.5 transition",
                    activeRoomId === room.roomId
                      ? "bg-discord-hover text-white"
                      : "text-discord-text-muted hover:bg-discord-hover hover:text-discord-text"
                  )}
                >
                  <Hash className="mr-1.5 h-5 w-5 text-discord-text-muted" />
                  <span className="truncate text-base font-medium">{room.name}</span>
                </button>
              ))
            )}
          </div>
        </div>
      </div>

      {renderUserFooter()}
    </div>
  );
};

export default ChannelList;
