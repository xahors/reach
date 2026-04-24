import React from 'react';
import { useAppStore } from '../../store/useAppStore';
import { useMatrixClient } from '../../hooks/useMatrixClient';
import { useUserPresence } from '../../hooks/useUserPresence';
import { 
  X, Hash, Calendar, ShieldAlert, 
  ShieldCheck, Info 
} from 'lucide-react';
import { cn } from '../../utils/cn';

const UserProfileModal: React.FC = () => {
  const { userProfileId, setUserProfileId, activeRoomId } = useAppStore();
  const client = useMatrixClient();
  const { presence, avatarUrl, displayName } = useUserPresence(userProfileId);
  
  if (!userProfileId) return null;

  const room = activeRoomId ? client?.getRoom(activeRoomId) : null;
  const member = room?.getMember(userProfileId);
  const powerLevel = member?.powerLevel || 0;

  // Attempt to get join date from membership event
  const memberEvent = room?.currentState.getStateEvents('m.room.member', userProfileId);
  const joinDate = memberEvent ? new Date(memberEvent.getTs()).toLocaleDateString([], { 
    year: 'numeric', 
    month: 'long', 
    day: 'numeric' 
  }) : 'Unknown';

  const getStatusColor = (p: string) => {
    switch (p) {
      case 'online': return 'bg-green-500';
      case 'unavailable': return 'bg-yellow-500';
      case 'offline': return 'bg-gray-500';
      default: return 'bg-gray-500';
    }
  };

  const fullAvatarUrl = avatarUrl ? client?.mxcUrlToHttp(avatarUrl, 128, 128, 'crop') : null;

  return (
    <div className="fixed inset-0 z-[210] flex items-center justify-center bg-black/80 backdrop-blur-sm animate-in fade-in duration-300">
      <div className="relative w-full max-w-md overflow-hidden rounded-2xl border border-border-main bg-bg-main shadow-2xl animate-in zoom-in-95 duration-300">
        {/* Banner Area */}
        <div className="h-24 bg-accent-primary/20 w-full" />
        
        {/* Close Button */}
        <button 
          onClick={() => setUserProfileId(null)}
          className="absolute top-4 right-4 rounded-full bg-black/20 p-1.5 text-white hover:bg-black/40 transition"
        >
          <X className="h-5 w-5" />
        </button>

        <div className="px-6 pb-8">
          {/* Avatar Area */}
          <div className="relative -mt-12 mb-4 flex items-end justify-between">
            <div className="relative h-24 w-24 rounded-full border-4 border-bg-main bg-bg-sidebar overflow-hidden shadow-xl">
              {fullAvatarUrl ? (
                <img src={fullAvatarUrl} alt="" className="h-full w-full object-cover" />
              ) : (
                <div className="flex h-full w-full items-center justify-center text-3xl font-black text-text-muted bg-bg-nav">
                  {displayName?.charAt(0).toUpperCase() || userProfileId.charAt(1).toUpperCase()}
                </div>
              )}
              <div className={cn(
                "absolute bottom-1 right-1 h-5 w-5 rounded-full border-4 border-bg-main",
                getStatusColor(presence)
              )} />
            </div>
            
            <div className="flex space-x-2 pb-2">
              {powerLevel >= 100 && (
                <div className="flex items-center space-x-1 px-3 py-1 rounded-full bg-red-500/10 text-red-400 border border-red-500/20 shadow-sm">
                  <ShieldAlert className="h-3.5 w-3.5" />
                  <span className="text-[10px] font-black uppercase tracking-widest">Admin</span>
                </div>
              )}
              {powerLevel >= 50 && powerLevel < 100 && (
                <div className="flex items-center space-x-1 px-3 py-1 rounded-full bg-accent-primary/10 text-accent-primary border border-accent-primary/20 shadow-sm">
                  <ShieldCheck className="h-3.5 w-3.5" />
                  <span className="text-[10px] font-black uppercase tracking-widest">Moderator</span>
                </div>
              )}
            </div>
          </div>

          {/* User Info */}
          <div className="mb-6 rounded-xl bg-bg-sidebar p-4 border border-border-main/50">
            <h2 className="text-xl font-black text-text-main tracking-tight leading-tight mb-0.5">{displayName || userProfileId}</h2>
            <p className="text-xs font-mono text-text-muted mb-4 opacity-70">{userProfileId}</p>
            
            {member?.user?.presenceStatusMsg && (
              <div className="flex items-center space-x-2 text-sm text-text-main bg-bg-nav/50 p-2.5 rounded-lg border border-border-main/30 italic italic">
                <Info className="h-4 w-4 text-accent-primary shrink-0" />
                <span>{member.user.presenceStatusMsg}</span>
              </div>
            )}
          </div>

          <div className="space-y-4">
            <section>
              <h3 className="mb-2 text-[10px] font-black uppercase text-text-muted tracking-widest px-1">About Me</h3>
              <div className="rounded-xl bg-bg-nav/30 p-4 border border-border-main/30 space-y-3">
                <div className="flex items-center text-xs text-text-main">
                  <Calendar className="mr-3 h-4 w-4 text-text-muted" />
                  <span className="text-text-muted mr-2">Member Since:</span>
                  <span className="font-bold">{joinDate}</span>
                </div>
                <div className="flex items-center text-xs text-text-main">
                  <Hash className="mr-3 h-4 w-4 text-text-muted" />
                  <span className="text-text-muted mr-2">Power Level:</span>
                  <span className="font-bold text-accent-primary">{powerLevel}</span>
                </div>
              </div>
            </section>
          </div>
        </div>
      </div>
    </div>
  );
};

export default UserProfileModal;
