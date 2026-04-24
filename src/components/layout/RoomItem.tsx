import React from 'react';
import { Room, RoomEvent, ClientEvent } from 'matrix-js-sdk';
import { cn } from '../../utils/cn';
import { Hash, Video, Volume2, BellOff, AtSign } from 'lucide-react';
import { useGroupCall } from '../../hooks/useGroupCall';
import { useAppStore } from '../../store/useAppStore';
import { useUserPresence } from '../../hooks/useUserPresence';
import { useMatrixClient } from '../../hooks/useMatrixClient';

interface RoomItemProps {
  room: Room;
  isActive: boolean;
  onClick: (roomId: string) => void;
  isDM?: boolean;
  otherUserId?: string;
}

const RoomItem: React.FC<RoomItemProps> = ({ room, isActive, onClick, isDM, otherUserId }) => {
  const client = useMatrixClient();
  const { isCallActive, participantCount } = useGroupCall(room.roomId);
  const roomNotificationSettings = useAppStore(state => state.roomNotificationSettings);
  const { presence, avatarUrl } = useUserPresence(isDM ? otherUserId || null : null);
  
  const [unreadCount, setUnreadCount] = React.useState(0);
  const [highlightCount, setHighlightCount] = React.useState(0);
  
  const roomSetting = roomNotificationSettings[room.roomId] || 'all';

  const updateCounts = React.useCallback(() => {
    if (!room) return;
    try {
      // @ts-expect-error: Matrix SDK type mismatch for notification count type
      setUnreadCount(room.getUnreadNotificationCount('total'));
      // @ts-expect-error: Matrix SDK type mismatch for notification count type
      setHighlightCount(room.getUnreadNotificationCount('highlight'));
    } catch (err) {
      console.warn("Failed to get notification counts for room:", room.roomId, err);
    }
  }, [room]);

  React.useEffect(() => {
    if (!client) return;
    
    // Initial load
    const timeout = setTimeout(() => updateCounts(), 0);

    const onSync = () => updateCounts();
    const onReceipt = () => updateCounts();

    client.on(ClientEvent.Sync, onSync);
    room.on(RoomEvent.Receipt, onReceipt);
    room.on(RoomEvent.Timeline, onSync);

    return () => {
      clearTimeout(timeout);
      client.removeListener(ClientEvent.Sync, onSync);
      room.removeListener(RoomEvent.Receipt, onReceipt);
      room.removeListener(RoomEvent.Timeline, onSync);
    };
  }, [client, room, updateCounts]);

  const getStatusColor = (p: string) => {
    switch (p) {
      case 'online': return 'bg-green-500';
      case 'unavailable': return 'bg-yellow-500';
      case 'offline': return 'bg-gray-500';
      default: return 'bg-gray-500/50';
    }
  };

  const Icon = isCallActive ? Volume2 : Hash;

  const mxcToUrl = (mxc: string | null) => {
    if (!mxc || !client) return null;
    return client.mxcUrlToHttp(mxc, 40, 40, 'crop');
  };

  return (
    <button
      onClick={() => onClick(room.roomId)}
      className={cn(
        "group flex w-full items-center justify-between rounded px-2 py-1.5 transition relative",
        isActive
          ? "bg-bg-hover text-white ring-1 ring-white/10 shadow-lg shadow-black/20"
          : (unreadCount > 0 ? "text-text-main font-bold" : "text-text-muted hover:bg-bg-hover hover:text-text-main"),
        isCallActive && !isActive && "text-accent-primary"
      )}
    >
      <div className="flex items-center overflow-hidden flex-1">
        {isDM && otherUserId ? (
          <div className="relative mr-2 h-5 w-5 shrink-0">
            <div className={cn(
              "h-full w-full rounded-full flex items-center justify-center text-[10px] font-bold overflow-hidden",
              isActive ? "bg-accent-primary text-bg-main" : "bg-bg-nav text-text-muted group-hover:bg-accent-primary/20 group-hover:text-accent-primary transition-colors"
            )}>
              {avatarUrl ? (
                <img src={mxcToUrl(avatarUrl)!} alt="" className="h-full w-full object-cover" />
              ) : (
                room.name.charAt(0).toUpperCase()
              )}
            </div>
            <div className={cn(
              "absolute -bottom-0.5 -right-0.5 h-2 w-2 rounded-full border border-bg-sidebar shadow-sm",
              getStatusColor(presence)
            )} />
          </div>
        ) : (
          <Icon className={cn(
            "mr-1.5 h-4 w-4 shrink-0 transition-colors",
            isActive || isCallActive ? "text-accent-primary" : (unreadCount > 0 ? "text-text-main" : "text-text-muted group-hover:text-text-main")
          )} />
        )}
        <span className={cn(
          "truncate text-sm tracking-tight mr-1",
          isActive || unreadCount > 0 || isCallActive ? "font-bold" : "font-medium"
        )}>{room.name}</span>
        {roomSetting === 'mute' && <BellOff className="h-2.5 w-2.5 text-text-muted/50 shrink-0" />}
        {roomSetting === 'mentions' && <AtSign className="h-2.5 w-2.5 text-accent-primary/50 shrink-0" />}
      </div>
      
      <div className="flex items-center space-x-1.5 ml-2">
        {isCallActive && (
          <div className="flex items-center space-x-1 px-1.5 py-0.5 rounded-full bg-accent-primary/10 text-accent-primary animate-in fade-in zoom-in duration-300">
            <Video className="h-3 w-3 animate-pulse" />
            {participantCount > 0 && (
              <span className="text-[10px] font-black">{participantCount}</span>
            )}
          </div>
        )}

        {highlightCount > 0 ? (
          <div className="flex h-4 min-w-4 items-center justify-center rounded-full bg-red-500 px-1 text-[9px] font-black text-white shadow-lg shadow-red-500/20 animate-in zoom-in duration-300">
            {highlightCount > 99 ? '99+' : highlightCount}
          </div>
        ) : unreadCount > 0 && !isActive ? (
          <div className="h-2 w-2 rounded-full bg-white shadow-[0_0_8px_rgba(255,255,255,0.5)] animate-in zoom-in duration-300" />
        ) : null}
      </div>
    </button>
  );
};

export default RoomItem;
