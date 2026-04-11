import React, { useState } from 'react';
import { useAppStore } from '../../store/useAppStore';
import { useRoomMessages } from '../../hooks/useRoomMessages';
import { useRoomMembers } from '../../hooks/useRoomMembers';
import { useMatrixClient } from '../../hooks/useMatrixClient';
import { Users, Settings, Gamepad2, X, Trash2, Info } from 'lucide-react';
import { cn } from '../../utils/cn';
import { type RoomMember } from 'matrix-js-sdk';

const ChannelDetails: React.FC = () => {
  const { activeRoomId, setChannelDetailsOpen } = useAppStore();
  const { members, loading } = useRoomMembers(activeRoomId);
  const { redactAllMyMessages } = useRoomMessages(activeRoomId);
  const client = useMatrixClient();
  const [activeTab, setActiveTab] = useState<'members' | 'settings'>('members');

  const room = activeRoomId ? client?.getRoom(activeRoomId) : null;

  if (!room) return null;

  const onlineMembers = members.filter(m => m.user?.presence === 'online');
  const offlineMembers = members.filter(m => m.user?.presence !== 'online');

  const getAvatar = (member: RoomMember) => {
    try {
      return member.getAvatarUrl(client?.getHomeserverUrl() || '', 32, 32, 'crop', undefined, true);
    } catch {
      return null;
    }
  };

  const getStatusColor = (presence?: string) => {
    switch (presence) {
      case 'online': return 'bg-green-500';
      case 'unavailable': return 'bg-yellow-500';
      case 'offline': return 'bg-gray-500';
      default: return 'bg-gray-500';
    }
  };

  const renderMemberGroup = (title: string, groupMembers: typeof members) => {
    if (groupMembers.length === 0) return null;

    return (
      <div className="mt-4 first:mt-0">
        <h5 className="mb-1 text-[10px] font-black uppercase text-text-muted px-2 tracking-widest">
          {title} — {groupMembers.length}
        </h5>
        <div className="space-y-0.5">
          {groupMembers.map((member) => {
            const avatarUrl = getAvatar(member);
            const statusMsg = member.user?.presenceStatusMsg;
            const isPlaying = statusMsg?.startsWith('Playing ');
            
            return (
              <div
                key={member.userId}
                className="group flex items-center rounded px-2 py-1 transition hover:bg-bg-hover cursor-pointer"
              >
                <div className="relative">
                  <div className="h-8 w-8 rounded-full bg-bg-nav flex items-center justify-center text-text-muted font-black text-[10px] overflow-hidden shrink-0 border border-border-main">
                    {avatarUrl ? (
                      <img src={avatarUrl || ''} alt="" className="h-full w-full object-cover" />
                    ) : (
                      member.name.charAt(0).toUpperCase()
                    )}
                  </div>
                  <div 
                    className={cn(
                      "absolute -bottom-0.5 -right-0.5 h-3 w-3 rounded-full border-2 border-bg-sidebar",
                      getStatusColor(member.user?.presence)
                    )} 
                  />
                </div>
                <div className="ml-2 overflow-hidden flex flex-col">
                  <div className={cn(
                    "truncate text-xs font-bold leading-tight tracking-tight",
                    member.powerLevel >= 50 ? "text-accent-primary" : "text-text-main group-hover:text-white"
                  )}>
                    {member.name}
                  </div>
                  {statusMsg && (
                    <div className={cn(
                      "truncate text-[9px] leading-tight flex items-center mt-0.5 uppercase tracking-tighter",
                      isPlaying ? "text-accent-primary font-black" : "text-text-muted"
                    )}>
                      {isPlaying && <Gamepad2 className="mr-1 h-2 w-2" />}
                      {statusMsg}
                    </div>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      </div>
    );
  };

  return (
    <div className="flex h-full flex-col bg-bg-sidebar">
      {/* Header */}
      <div className="flex h-12 items-center justify-between px-4 border-b border-border-main shadow-sm bg-bg-sidebar">
        <div className="flex items-center space-x-2">
          <Users className="h-4 w-4 text-text-muted" />
          <span className="text-sm font-black uppercase tracking-tighter text-text-main">Details</span>
        </div>
        <button 
          onClick={() => setChannelDetailsOpen(false)}
          className="rounded p-1 text-text-muted hover:bg-bg-hover hover:text-white transition"
        >
          <X className="h-5 w-5" />
        </button>
      </div>

      {/* Tabs */}
      <div className="flex border-b border-border-main bg-bg-nav/30">
        <button 
          onClick={() => setActiveTab('members')}
          className={cn(
            "flex-1 py-3 text-[10px] font-black uppercase tracking-widest transition-colors",
            activeTab === 'members' ? "text-accent-primary border-b-2 border-accent-primary" : "text-text-muted hover:text-text-main"
          )}
        >
          Members
        </button>
        <button 
          onClick={() => setActiveTab('settings')}
          className={cn(
            "flex-1 py-3 text-[10px] font-black uppercase tracking-widest transition-colors",
            activeTab === 'settings' ? "text-accent-primary border-b-2 border-accent-primary" : "text-text-muted hover:text-text-main"
          )}
        >
          Settings
        </button>
      </div>

      {/* Content */}
      <div className="flex-1 overflow-y-auto p-3 no-scrollbar">
        {activeTab === 'members' ? (
          loading ? (
            <div className="space-y-4 p-2">
              {[1, 2, 3, 4, 5].map(i => (
                <div key={i} className="flex items-center space-x-3 animate-pulse">
                  <div className="h-8 w-8 rounded-full bg-bg-hover" />
                  <div className="h-3 w-24 rounded bg-bg-hover" />
                </div>
              ))}
            </div>
          ) : (
            <>
              {renderMemberGroup('Online', onlineMembers)}
              {renderMemberGroup('Offline', offlineMembers)}
            </>
          )
        ) : (
          <div className="space-y-6 animate-in fade-in slide-in-from-right-2 duration-300">
            <section>
              <h4 className="mb-3 text-[10px] font-black uppercase text-text-muted tracking-widest px-1">Room Info</h4>
              <div className="rounded-xl border border-border-main bg-bg-nav/50 p-4 space-y-3">
                <div>
                  <label className="text-[9px] font-bold text-text-muted uppercase mb-1 block tracking-tighter">Room ID</label>
                  <code className="text-[10px] text-accent-primary bg-bg-main p-1 rounded break-all block font-mono border border-border-main">
                    {room.roomId}
                  </code>
                </div>
                <div>
                  <label className="text-[9px] font-bold text-text-muted uppercase mb-1 block tracking-tighter">Creator</label>
                  <p className="text-xs text-text-main font-medium">{room.getMember(room.getCreator() || '')?.name || room.getCreator()}</p>
                </div>
              </div>
            </section>

            <section>
              <h4 className="mb-3 text-[10px] font-black uppercase text-text-muted tracking-widest px-1">Actions</h4>
              <div className="space-y-2">
                <button 
                  onClick={() => redactAllMyMessages()}
                  className="flex w-full items-center space-x-3 rounded-xl border border-transparent bg-red-500/10 p-3 text-red-400 transition hover:bg-red-500/20"
                >
                  <Trash2 className="h-4 w-4" />
                  <span className="text-xs font-black uppercase tracking-tighter">Redact My Messages</span>
                </button>
                <button className="flex w-full items-center space-x-3 rounded-xl border border-transparent bg-bg-nav/50 p-3 text-text-muted transition hover:bg-bg-hover hover:text-text-main">
                  <Info className="h-4 w-4" />
                  <span className="text-xs font-black uppercase tracking-tighter">View Source</span>
                </button>
              </div>
            </section>
          </div>
        )}
      </div>

      {/* Footer */}
      <div className="border-t border-border-main p-4 bg-bg-sidebar">
        <button className="flex w-full items-center justify-center space-x-2 rounded-lg bg-bg-hover border border-border-main px-4 py-2 text-text-muted hover:text-white transition group">
          <Settings className="h-4 w-4 transition-transform group-hover:rotate-90" />
          <span className="text-xs font-black uppercase tracking-widest">Channel Settings</span>
        </button>
      </div>
    </div>
  );
};

export default ChannelDetails;
