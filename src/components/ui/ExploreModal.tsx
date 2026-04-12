import React, { useState, useEffect } from 'react';
import { Search, X, Loader2, Users, Hash, Globe } from 'lucide-react';
import { useAppStore } from '../../store/useAppStore';
import { useMatrixClient } from '../../hooks/useMatrixClient';
import { cn } from '../../utils/cn';

interface PublicRoom {
  room_id: string;
  name?: string;
  topic?: string;
  avatar_url?: string;
  num_joined_members: number;
  canonical_alias?: string;
  join_rule?: string;
}

export const ExploreModal: React.FC = () => {
  const { isExploreOpen, setExploreOpen, setActiveRoomId } = useAppStore();
  const client = useMatrixClient();
  const [searchTerm, setSearchTerm] = useState('');
  const [rooms, setRooms] = useState<PublicRoom[]>([]);
  const [loading, setLoading] = useState(false);
  const [joining, setJoining] = useState<string | null>(null);

  const fetchPublicRooms = React.useCallback(async () => {
    if (!client) return;
    
    setLoading(true);
    try {
      let serverToSearch: string | undefined = undefined;
      const term = searchTerm.trim();
      
      // If the search term looks like a Matrix alias or ID (#name:domain.com), extract the server
      const exactMatch = term.match(/^[#!][^:]+:([^:]+)$/);
      if (exactMatch && exactMatch[1]) {
        serverToSearch = exactMatch[1];
      }

      // Fetch public rooms from the homeserver (or the specified federated server)
      const response = await client.publicRooms({
        server: serverToSearch,
        limit: 50,
        filter: {
          generic_search_term: searchTerm
        }
      });
      
      let fetchedRooms: PublicRoom[] = response.chunk || [];
      
      // If the user typed an exact address, prepend a 'Direct Join' card so they can join it
      // even if the server hides it from their public directory
      if (exactMatch) {
        const alreadyExists = fetchedRooms.some(r => r.canonical_alias === term || r.room_id === term);
        if (!alreadyExists) {
          fetchedRooms = [
            {
              room_id: term, // Using the alias/id as the ID for the join function
              name: `Join ${term}`,
              topic: `Directly connect to this specific address.`,
              num_joined_members: 0,
              canonical_alias: term.startsWith('#') ? term : undefined,
            },
            ...fetchedRooms
          ];
        }
      }
      
      setRooms(fetchedRooms);
    } catch (err) {
      console.error("Failed to fetch public rooms", err);
      // Fallback: If public directory fetch fails but they typed an exact address, still show the direct join card
      const term = searchTerm.trim();
      if (term.match(/^[#!][^:]+:([^:]+)$/)) {
        setRooms([{
          room_id: term,
          name: `Join ${term}`,
          topic: `Directly connect to this specific address.`,
          num_joined_members: 0,
          canonical_alias: term.startsWith('#') ? term : undefined,
        }]);
      } else {
        setRooms([]);
      }
    } finally {
      setLoading(false);
    }
  }, [client, searchTerm]);

  useEffect(() => {
    if (!isExploreOpen || !client) return;

    const delayDebounceFn = setTimeout(() => {
      fetchPublicRooms();
    }, 500);

    return () => clearTimeout(delayDebounceFn);
  }, [searchTerm, isExploreOpen, client, fetchPublicRooms]);

  const handleJoin = async (room: PublicRoom) => {
    if (!client) return;
    
    setJoining(room.room_id);
    try {
      const aliasOrId = room.canonical_alias || room.room_id;
      await client.joinRoom(aliasOrId);
      setExploreOpen(false);
      setActiveRoomId(room.room_id);
    } catch (err) {
      console.error("Failed to join room", err);
      // Depending on homeserver, might need to show an error message
    } finally {
      setJoining(null);
    }
  };

  const getAvatarUrl = (mxcUrl?: string) => {
    if (!mxcUrl || !client) return null;
    return client.mxcUrlToHttp(mxcUrl, 64, 64, 'crop');
  };

  if (!isExploreOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4 animate-in fade-in duration-200">
      <div className="flex h-[80vh] w-full max-w-3xl flex-col overflow-hidden rounded-2xl border border-border-main bg-bg-nav shadow-2xl animate-in zoom-in-95 duration-200">
        
        {/* Header */}
        <div className="flex items-center justify-between border-b border-border-main px-6 py-4 bg-bg-nav/50">
          <div className="flex items-center space-x-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-full bg-accent-primary/20">
              <Globe className="h-5 w-5 text-accent-primary" />
            </div>
            <div>
              <h2 className="text-xl font-black uppercase tracking-tighter text-white">Explore Public Servers</h2>
              <p className="text-xs text-text-muted font-medium">Discover and join communities on your Matrix homeserver</p>
            </div>
          </div>
          <button 
            onClick={() => setExploreOpen(false)}
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
              placeholder="Search for a community or topic..."
              className="w-full rounded-xl border border-border-main bg-bg-main py-4 pl-12 pr-4 text-sm font-medium text-white placeholder-text-muted transition focus:border-accent-primary focus:outline-none focus:ring-1 focus:ring-accent-primary"
            />
          </div>
        </div>

        {/* Results List */}
        <div className="flex-1 overflow-y-auto p-6 pt-4 no-scrollbar">
          {loading ? (
            <div className="flex h-full flex-col items-center justify-center space-y-4 text-text-muted">
              <Loader2 className="h-8 w-8 animate-spin text-accent-primary" />
              <span className="text-sm font-bold uppercase tracking-widest">Searching...</span>
            </div>
          ) : rooms.length === 0 ? (
            <div className="flex h-full flex-col items-center justify-center space-y-4 text-text-muted">
              <Globe className="h-12 w-12 opacity-20" />
              <span className="text-sm font-bold uppercase tracking-widest">No communities found</span>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {rooms.map((room) => {
                const avatar = getAvatarUrl(room.avatar_url);
                return (
                  <div 
                    key={room.room_id}
                    className="group relative flex flex-col justify-between overflow-hidden rounded-xl border border-border-main bg-bg-main p-4 transition-all hover:border-accent-primary/50 hover:shadow-lg hover:shadow-accent-primary/5"
                  >
                    <div className="flex items-start space-x-4">
                      <div className="flex h-14 w-14 shrink-0 items-center justify-center rounded-[14px] bg-bg-hover overflow-hidden border border-border-main">
                        {avatar ? (
                          <img src={avatar} alt="" className="h-full w-full object-cover" />
                        ) : (
                          <Hash className="h-6 w-6 text-text-muted" />
                        )}
                      </div>
                      <div className="flex-1 min-w-0">
                        <h3 className="truncate text-base font-bold text-white tracking-tight">
                          {room.name || room.canonical_alias || 'Unnamed Community'}
                        </h3>
                        <div className="mt-1 flex items-center space-x-1 text-xs font-medium text-text-muted">
                          <Users className="h-3 w-3" />
                          <span>{room.num_joined_members.toLocaleString()} members</span>
                        </div>
                      </div>
                    </div>
                    
                    {room.topic && (
                      <p className="mt-4 line-clamp-2 text-xs leading-relaxed text-text-muted">
                        {room.topic}
                      </p>
                    )}

                    <div className="mt-6 flex items-center justify-between">
                      <span className="truncate text-[10px] font-mono text-text-muted/50">
                        {room.canonical_alias || room.room_id}
                      </span>
                      <button
                        onClick={() => handleJoin(room)}
                        disabled={joining === room.room_id}
                        className={cn(
                          "ml-4 flex min-w-[80px] shrink-0 items-center justify-center rounded bg-accent-primary px-4 py-2 text-xs font-black uppercase tracking-widest text-bg-main transition-all hover:bg-white disabled:opacity-50",
                          joining === room.room_id && "animate-pulse"
                        )}
                      >
                        {joining === room.room_id ? 'Joining' : 'Join'}
                      </button>
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
