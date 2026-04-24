import React, { useEffect, useRef } from 'react';
import { useAppStore } from '../../store/useAppStore';
import { useMatrixClient } from '../../hooks/useMatrixClient';
import { 
  User, UserMinus, ShieldOff, ShieldAlert, 
  ShieldCheck, Loader2 
} from 'lucide-react';
import { cn } from '../../utils/cn';

const UserContextMenu: React.FC = () => {
  const { userContextMenu, setUserContextMenu, setUserProfileId } = useAppStore();
  const client = useMatrixClient();
  const menuRef = useRef<HTMLDivElement>(null);
  const [isModifying, setIsModifying] = React.useState(false);
  const [status, setStatus] = React.useState<{ message: string; isError: boolean } | null>(null);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(event.target as Node)) {
        setUserContextMenu(null);
      }
    };

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        setUserContextMenu(null);
      }
    };

    if (userContextMenu) {
      document.addEventListener('mousedown', handleClickOutside);
      document.addEventListener('keydown', handleKeyDown);
    }

    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
      document.removeEventListener('keydown', handleKeyDown);
    };
  }, [userContextMenu, setUserContextMenu]);

  if (!userContextMenu) return null;

  const { userId, roomId, x, y } = userContextMenu;
  const room = client?.getRoom(roomId);
  const targetMember = room?.getMember(userId);
  const myUserId = client?.getUserId();
  const myMember = myUserId ? room?.getMember(myUserId) : null;
  const myPowerLevel = myMember?.powerLevel || 0;
  
  if (!targetMember) return null;

  const canMod = myPowerLevel >= 50 && myPowerLevel > targetMember.powerLevel && userId !== myUserId;

  const handleAction = async (action: 'kick' | 'ban' | 'promote_mod' | 'promote_admin' | 'demote') => {
    if (!client) return;
    setIsModifying(true);
    setStatus(null);
    try {
      switch (action) {
        case 'kick':
          await client.kick(roomId, userId);
          setStatus({ message: 'Kicked successfully', isError: false });
          break;
        case 'ban':
          await client.ban(roomId, userId);
          setStatus({ message: 'Banned successfully', isError: false });
          break;
        case 'promote_mod':
          await client.setPowerLevel(roomId, userId, 50);
          setStatus({ message: 'Promoted to Moderator', isError: false });
          break;
        case 'promote_admin':
          await client.setPowerLevel(roomId, userId, 100);
          setStatus({ message: 'Promoted to Admin', isError: false });
          break;
        case 'demote':
          await client.setPowerLevel(roomId, userId, 0);
          setStatus({ message: 'Demoted to User', isError: false });
          break;
      }
      setTimeout(() => setUserContextMenu(null), 1500);
    } catch (err: unknown) {
      const error = err as Error;
      setStatus({ message: `Error: ${error.message || 'Action failed'}`, isError: true });
    } finally {
      setIsModifying(false);
    }
  };

  const handleViewProfile = () => {
    setUserProfileId(userId);
    setUserContextMenu(null);
  };

  // Adjust menu position if it would go off-screen
  const menuWidth = 200;
  const menuHeight = 250;
  const finalX = Math.min(x, window.innerWidth - menuWidth - 20);
  const finalY = Math.min(y, window.innerHeight - menuHeight - 20);

  return (
    <div 
      ref={menuRef}
      style={{ left: finalX, top: finalY }}
      className="fixed z-[200] w-52 rounded-xl bg-bg-sidebar/95 backdrop-blur-xl border border-border-main shadow-2xl overflow-hidden animate-in fade-in zoom-in-95 duration-100 p-1.5"
    >
      <div className="px-3 py-2 border-b border-border-main/50 mb-1 flex items-center space-x-2">
        <div className="h-6 w-6 rounded-full bg-accent-primary/10 flex items-center justify-center text-[10px] font-black text-accent-primary shrink-0">
          {targetMember.name.charAt(0).toUpperCase()}
        </div>
        <span className="text-xs font-black uppercase text-text-main truncate">{targetMember.name}</span>
      </div>

      <div className="space-y-0.5">
        <button 
          onClick={handleViewProfile}
          className="w-full flex items-center space-x-2.5 px-2.5 py-2 rounded-lg text-[10px] font-black uppercase tracking-widest text-text-muted hover:bg-bg-hover hover:text-white transition group"
        >
          <User className="h-4 w-4 group-hover:text-accent-primary" />
          <span>View Profile</span>
        </button>

        {canMod && (
          <>
            <div className="h-px bg-border-main my-1 mx-1" />
            <div className="px-2.5 py-1 text-[8px] font-black text-text-muted uppercase tracking-tighter opacity-50">Moderation</div>
            
            <button 
              onClick={() => handleAction('kick')}
              disabled={isModifying}
              className="w-full flex items-center space-x-2.5 px-2.5 py-2 rounded-lg text-[10px] font-black uppercase tracking-widest text-text-muted hover:bg-red-500/10 hover:text-red-400 transition"
            >
              {isModifying ? <Loader2 className="h-4 w-4 animate-spin" /> : <UserMinus className="h-4 w-4" />}
              <span>Kick User</span>
            </button>
            <button 
              onClick={() => handleAction('ban')}
              disabled={isModifying}
              className="w-full flex items-center space-x-2.5 px-2.5 py-2 rounded-lg text-[10px] font-black uppercase tracking-widest text-text-muted hover:bg-red-500/20 hover:text-red-500 transition"
            >
              <ShieldOff className="h-4 w-4" />
              <span>Ban User</span>
            </button>
            
            {myPowerLevel >= 100 && targetMember.powerLevel < 100 && (
              <button 
                onClick={() => handleAction('promote_admin')}
                disabled={isModifying}
                className="w-full flex items-center space-x-2.5 px-2.5 py-2 rounded-lg text-[10px] font-black uppercase tracking-widest text-text-muted hover:bg-red-500/10 hover:text-red-400 transition"
              >
                <ShieldAlert className="h-4 w-4" />
                <span>Make Admin</span>
              </button>
            )}
            
            {targetMember.powerLevel < 50 ? (
              <button 
                onClick={() => handleAction('promote_mod')}
                disabled={isModifying}
                className="w-full flex items-center space-x-2.5 px-2.5 py-2 rounded-lg text-[10px] font-black uppercase tracking-widest text-text-muted hover:bg-accent-primary/10 hover:text-accent-primary transition"
              >
                <ShieldCheck className="h-4 w-4" />
                <span>Make Moderator</span>
              </button>
            ) : (
              <button 
                onClick={() => handleAction('demote')}
                disabled={isModifying}
                className="w-full flex items-center space-x-2.5 px-2.5 py-2 rounded-lg text-[10px] font-black uppercase tracking-widest text-text-muted hover:bg-yellow-500/10 hover:text-yellow-500 transition"
              >
                <UserMinus className="h-4 w-4" />
                <span>Demote to User</span>
              </button>
            )}
          </>
        )}
      </div>

      {status && (
        <div className={cn(
          "m-2 rounded-lg p-2 text-[9px] font-bold border animate-in fade-in",
          status.isError ? "bg-red-500/10 text-red-400 border-red-500/20" : "bg-green-500/10 text-green-400 border-green-500/20"
        )}>
          {status.message}
        </div>
      )}
    </div>
  );
};

export default UserContextMenu;
