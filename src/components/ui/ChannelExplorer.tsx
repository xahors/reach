import React, { useState, useMemo } from 'react';
import { Search, X, Loader2, Users, Hash, Globe, Lock, Check } from 'lucide-react';
import { useAppStore } from '../../store/useAppStore';
import { useMatrixClient } from '../../hooks/useMatrixClient';
import { useSpaceHierarchy, type HierarchyRoom } from '../../hooks/useSpaceHierarchy';
import { cn } from '../../utils/cn';

export const ChannelExplorer: React.FC = () => {
  const { isChannelExplorerOpen, setChannelExplorerOpen, activeSpaceId, setActiveRoomId } = useAppStore();
  const client = useMatrixClient();
  const { rooms, loading, error } = useSpaceHierarchy(activeSpaceId);
  
  const [searchTerm, setSearchTerm] = useState('');
  const [joining, setJoining] = useState<string | null>(null);

  const filteredRooms = useMemo(() => {
    if (!searchTerm.trim()) return rooms;
    const term = searchTerm.toLowerCase();
    return rooms.filter(room => 
      room.name?.toLowerCase().includes(term) || 
      room.canonical_alias?.toLowerCase().includes(term) ||
      room.topic?.toLowerCase().includes(term)
    );
  }, [rooms, searchTerm]);

  const handleJoin = async (room: HierarchyRoom) => {
    if (!client) return;
    
    setJoining(room.room_id);
    try {
      const aliasOrId = room.canonical_alias || room.room_id;
      await client.joinRoom(aliasOrId);
      setChannelExplorerOpen(false);
      setActiveRoomId(room.room_id);
    } catch (err) {
      console.error("Failed to join room", err);
    } finally {
      setJoining(null);
    }
  };

  const getAvatarUrl = (mxcUrl?: string) => {
    if (!mxcUrl || !client) return null;
    return client.mxcUrlToHttp(mxcUrl, 64, 64, 'crop');
  };

  if (!isChannelExplorerOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4 animate-in fade-in duration-200">
      <div className="flex h-[80vh] w-full max-w-2xl flex-col overflow-hidden rounded-2xl border border-border-main bg-bg-nav shadow-2xl animate-in zoom-in-95 duration-200">
        
        {/* Header */}
        <div className="flex items-center justify-between border-b border-border-main px-6 py-4 bg-bg-nav/50">
          <div className="flex items-center space-x-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-full bg-accent-primary/20">
              <Hash className="h-5 w-5 text-accent-primary" />
            </div>
            <div>
              <h2 className="text-xl font-black uppercase tracking-tighter text-white">Browse Channels</h2>
              <p className="text-xs text-text-muted font-medium">Discover channels in this space</p>
            </div>
          </div>
          <button 
            onClick={() => setChannelExplorerOpen(false)}
            className="rounded-full p-2 text-text-muted transition hover:bg-bg-hover hover:text-white"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        {/* Search Bar */}
        <div className="p-6 pb-2">
          <div className="relative">
            <Search className="absolute left-4 top-1/2 h-5 w-5 -translate-y-1/2 text-text-muted" />
            <input
              type="text"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              placeholder="Search for a channel..."
              className="w-full rounded-xl border border-border-main bg-bg-main py-4 pl-12 pr-4 text-sm font-medium text-white placeholder-text-muted transition focus:border-accent-primary focus:outline-none focus:ring-1 focus:ring-accent-primary"
            />
          </div>
        </div>

        {/* Results List */}
        <div className="flex-1 overflow-y-auto p-6 pt-4 no-scrollbar">
          {loading ? (
            <div className="flex h-full flex-col items-center justify-center space-y-4 text-text-muted">
              <Loader2 className="h-8 w-8 animate-spin text-accent-primary" />
              <span className="text-sm font-bold uppercase tracking-widest">Loading channels...</span>
            </div>
          ) : error ? (
            <div className="flex h-full flex-col items-center justify-center space-y-4 text-red-400 text-center">
              <p className="font-bold">Failed to load channels</p>
              <p className="text-xs opacity-70">{error}</p>
            </div>
          ) : filteredRooms.length === 0 ? (
            <div className="flex h-full flex-col items-center justify-center space-y-4 text-text-muted">
              <Hash className="h-12 w-12 opacity-20" />
              <span className="text-sm font-bold uppercase tracking-widest">No channels found</span>
            </div>
          ) : (
            <div className="space-y-2">
              {filteredRooms.map((room) => {
                const avatar = getAvatarUrl(room.avatar_url);
                const isJoined = !!client?.getRoom(room.room_id) && client.getRoom(room.room_id)?.getMyMembership() === 'join';
                
                return (
                  <div 
                    key={room.room_id}
                    className="group relative flex items-center justify-between overflow-hidden rounded-xl border border-border-main bg-bg-main p-4 transition-all hover:border-accent-primary/50"
                  >
                    <div className="flex items-center space-x-4 min-w-0">
                      <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-bg-hover overflow-hidden border border-border-main text-text-muted">
                        {avatar ? (
                          <img src={avatar} alt="" className="h-full w-full object-cover" />
                        ) : (
                          <Hash className="h-5 w-5" />
                        )}
                      </div>
                      <div className="min-w-0">
                        <div className="flex items-center space-x-2">
                          <h3 className="truncate text-sm font-bold text-white tracking-tight">
                            {room.name || room.canonical_alias || 'Unnamed Channel'}
                          </h3>
                          {room.join_rule === 'public' ? (
                             <span title="Public"><Globe className="h-3 w-3 text-text-muted" /></span>
                          ) : (
                             <span title="Private/Restricted"><Lock className="h-3 w-3 text-text-muted" /></span>
                          )}
                        </div>
                        {room.topic && (
                          <p className="truncate text-[10px] text-text-muted leading-relaxed mt-0.5">
                            {room.topic}
                          </p>
                        )}
                        <div className="mt-1 flex items-center space-x-1 text-[9px] font-bold uppercase tracking-wider text-text-muted/60">
                          <Users className="h-2.5 w-2.5" />
                          <span>{room.num_joined_members.toLocaleString()}</span>
                        </div>
                      </div>
                    </div>
                    
                    <div className="flex items-center space-x-3 shrink-0 ml-4">
                      {isJoined ? (
                        <div className="flex items-center space-x-1 text-green-500 text-[10px] font-black uppercase tracking-widest bg-green-500/10 px-3 py-1.5 rounded-lg border border-green-500/20">
                          <Check className="h-3 w-3" />
                          <span>Joined</span>
                        </div>
                      ) : (
                        <button
                          onClick={() => handleJoin(room)}
                          disabled={joining === room.room_id}
                          className={cn(
                            "flex min-w-[80px] items-center justify-center rounded-lg bg-accent-primary px-4 py-2 text-[10px] font-black uppercase tracking-widest text-bg-main transition-all hover:scale-105 active:scale-95 disabled:opacity-50",
                            joining === room.room_id && "animate-pulse"
                          )}
                        >
                          {joining === room.room_id ? 'Joining' : 'Join'}
                        </button>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>

      </div>
    </div>
  );
};
