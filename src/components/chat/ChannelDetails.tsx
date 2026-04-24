import React from 'react';
import { useAppStore } from '../../store/useAppStore';
import { useRoomMessages } from '../../hooks/useRoomMessages';
import { useRoomMembers } from '../../hooks/useRoomMembers';
import { useMatrixClient } from '../../hooks/useMatrixClient';
import { 
  Users, Gamepad2, X, Trash2, Info, Bell, BellOff, 
  AtSign, Check, ShieldAlert, ShieldCheck, 
  UserCog, Save, Loader2 
} from 'lucide-react';
import { cn } from '../../utils/cn';
import { type RoomMember } from 'matrix-js-sdk';
import { getRoleColor } from '../../utils/roleColors';

const ChannelDetails: React.FC = () => {
  const { 
    activeRoomId, 
    setChannelDetailsOpen, 
    channelDetailsTab, 
    setChannelDetailsTab,
    roomNotificationSettings,
    setRoomNotificationSetting,
    setUserContextMenu
  } = useAppStore();
  const { members, loading } = useRoomMembers(activeRoomId);
  const { redactAllMyMessages } = useRoomMessages(activeRoomId);
  const client = useMatrixClient();
  
  // Room editing state
  const [roomName, setRoomName] = React.useState('');
  const [roomTopic, setRoomTopic] = React.useState('');
  const [isSavingRoom, setIsSavingRoom] = React.useState(false);
  const [roomSaveStatus, setRoomSaveStatus] = React.useState<{ message: string; isError: boolean } | null>(null);

  const activeTab = channelDetailsTab;
  const setActiveTab = setChannelDetailsTab;

  const room = activeRoomId ? client?.getRoom(activeRoomId) : null;
  const myUserId = client?.getUserId();

  // Initialize room info on tab switch
  React.useEffect(() => {
    if (activeTab === 'settings' && room) {
      setRoomName(room.name || '');
      setRoomTopic(room.currentState.getStateEvents('m.room.topic', '')?.getContent()?.topic || '');
    }
  }, [activeTab, room]);

  if (!room) return null;

  const onlineMembers = members.filter(m => m.user?.presence === 'online');
  const offlineMembers = members.filter(m => m.user?.presence !== 'online');
  const myPowerLevel = room.getMember(myUserId || '')?.powerLevel || 0;

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

  const currentNotifSetting = roomNotificationSettings[room.roomId] || 'all';

  const handleUpdateRoomDetails = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!client || !activeRoomId) return;

    setIsSavingRoom(true);
    setRoomSaveStatus(null);
    try {
      if (roomName !== room?.name) {
        await client.setRoomName(activeRoomId, roomName);
      }
      const currentTopic = room?.currentState.getStateEvents('m.room.topic', '')?.getContent()?.topic;
      if (roomTopic !== currentTopic) {
        await client.setRoomTopic(activeRoomId, roomTopic);
      }
      setRoomSaveStatus({ message: 'Room details updated successfully!', isError: false });
      setTimeout(() => setRoomSaveStatus(null), 3000);
    } catch (err: unknown) {
      const error = err as Error;
      setRoomSaveStatus({ message: `Error: ${error.message || 'Failed to update'}`, isError: true });
    } finally {
      setIsSavingRoom(false);
    }
  };

  const handleMemberClick = (e: React.MouseEvent, member: RoomMember) => {
    if (!activeRoomId) return;
    setUserContextMenu({
      userId: member.userId,
      roomId: activeRoomId,
      x: e.clientX,
      y: e.clientY
    });
  };

  const renderMemberGroup = (title: string, groupMembers: typeof members) => {
    if (groupMembers.length === 0) return null;

    return (
      <div className="mt-4 first:mt-0 relative">
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
                onClick={(e) => handleMemberClick(e, member)}
                className={cn(
                  "group flex items-center rounded px-2 py-1 transition hover:bg-bg-hover cursor-pointer"
                )}
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
                <div className="ml-2 overflow-hidden flex flex-1 flex-col">
                  <div className="flex items-center space-x-1">
                    <div 
                      className={cn(
                        "truncate text-xs font-bold leading-tight tracking-tight",
                        !getRoleColor(member.powerLevel) && (member.powerLevel >= 100 ? "text-red-400" : member.powerLevel >= 50 ? "text-accent-primary" : "text-text-main group-hover:text-white")
                      )}
                      style={getRoleColor(member.powerLevel) ? { color: getRoleColor(member.powerLevel) } : undefined}
                    >
                      {member.name}
                    </div>
                    {member.powerLevel >= 100 ? (
                      <span title="Admin"><ShieldAlert className="h-2.5 w-2.5 text-red-400 shrink-0" /></span>
                    ) : member.powerLevel >= 50 ? (
                      <span title="Moderator"><ShieldCheck className="h-2.5 w-2.5 text-accent-primary shrink-0" /></span>
                    ) : null}
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
                <UserCog className="h-3.5 w-3.5 text-text-muted opacity-0 group-hover:opacity-100 transition-opacity ml-2" />
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
              <h4 className="mb-3 text-[10px] font-black uppercase text-text-muted tracking-widest px-1">Notifications</h4>
              <div className="space-y-1 rounded-xl border border-border-main bg-bg-nav/50 p-1">
                {[
                  { id: 'all', label: 'All Messages', icon: Bell },
                  { id: 'mentions', label: 'Mentions Only', icon: AtSign },
                  { id: 'mute', label: 'Muted', icon: BellOff },
                ].map(option => (
                  <button
                    key={option.id}
                    onClick={() => setRoomNotificationSetting(room.roomId, option.id as 'all' | 'mentions' | 'mute')}
                    className={cn(
                      "flex w-full items-center justify-between px-3 py-2 rounded-lg text-xs transition-all font-bold uppercase tracking-tighter",
                      currentNotifSetting === option.id 
                        ? "bg-accent-primary text-bg-main shadow-lg shadow-accent-primary/20" 
                        : "text-text-muted hover:bg-bg-hover hover:text-text-main"
                    )}
                  >
                    <div className="flex items-center space-x-3">
                      <option.icon className="h-3.5 w-3.5" />
                      <span>{option.label}</span>
                    </div>
                    {currentNotifSetting === option.id && <Check className="h-3.5 w-3.5" />}
                  </button>
                ))}
              </div>
            </section>

            <section>
              <h4 className="mb-3 text-[10px] font-black uppercase text-text-muted tracking-widest px-1">Room Info</h4>
              <div className="rounded-xl border border-border-main bg-bg-nav/50 p-4 space-y-4 shadow-sm">
                <form onSubmit={handleUpdateRoomDetails} className="space-y-4">
                  <div>
                    <label className="text-[9px] font-bold text-text-muted uppercase mb-1 block tracking-tighter">Room Name</label>
                    <input 
                      type="text"
                      value={roomName}
                      onChange={(e) => setRoomName(e.target.value)}
                      disabled={myPowerLevel < 50}
                      className={cn(
                        "w-full rounded bg-bg-main p-2 text-xs text-text-main outline-none border transition-all",
                        myPowerLevel >= 50 ? "border-border-main focus:border-accent-primary" : "border-transparent cursor-not-allowed opacity-80"
                      )}
                    />
                  </div>
                  <div>
                    <label className="text-[9px] font-bold text-text-muted uppercase mb-1 block tracking-tighter">Room Topic</label>
                    <textarea 
                      value={roomTopic}
                      onChange={(e) => setRoomTopic(e.target.value)}
                      disabled={myPowerLevel < 50}
                      rows={3}
                      className={cn(
                        "w-full rounded bg-bg-main p-2 text-xs text-text-main outline-none border transition-all resize-none",
                        myPowerLevel >= 50 ? "border-border-main focus:border-accent-primary" : "border-transparent cursor-not-allowed opacity-80"
                      )}
                    />
                  </div>
                  
                  {myPowerLevel >= 50 && (
                    <button
                      type="submit"
                      disabled={isSavingRoom || (roomName === room?.name && roomTopic === (room?.currentState.getStateEvents('m.room.topic', '')?.getContent()?.topic || ''))}
                      className="flex w-full items-center justify-center space-x-2 rounded-lg bg-accent-primary p-2.5 text-[10px] font-black uppercase tracking-widest text-bg-main transition hover:opacity-90 disabled:opacity-50 shadow-lg shadow-accent-primary/20"
                    >
                      {isSavingRoom ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Save className="h-3.5 w-3.5" />}
                      <span>Save Changes</span>
                    </button>
                  )}
                </form>

                {roomSaveStatus && (
                  <div className={cn(
                    "rounded-lg p-2 text-[10px] font-bold border animate-in fade-in duration-300",
                    roomSaveStatus.isError ? "bg-red-500/10 text-red-400 border-red-500/20" : "bg-green-500/10 text-green-400 border-green-500/20"
                  )}>
                    {roomSaveStatus.message}
                  </div>
                )}

                <div className="pt-2 border-t border-border-main/30 space-y-2">
                  <div>
                    <label className="text-[9px] font-bold text-text-muted uppercase mb-1 block tracking-tighter">Room ID</label>
                    <code className="text-[10px] text-accent-primary bg-bg-main p-1.5 rounded break-all block font-mono border border-border-main leading-relaxed">
                      {room.roomId}
                    </code>
                  </div>
                  <div>
                    <label className="text-[9px] font-bold text-text-muted uppercase mb-1 block tracking-tighter">Creator</label>
                    <p className="text-xs text-text-main font-medium">{room.getMember(room.getCreator() || '')?.name || room.getCreator()}</p>
                  </div>
                </div>
              </div>
            </section>

            <section>
              <h4 className="mb-3 text-[10px] font-black uppercase text-text-muted tracking-widest px-1">Actions</h4>
              <div className="space-y-2">
                <button 
                  onClick={() => redactAllMyMessages()}
                  className="flex w-full items-center space-x-3 rounded-xl border border-transparent bg-red-500/10 p-3 text-red-400 transition hover:bg-red-500/20 shadow-sm"
                >
                  <Trash2 className="h-4 w-4" />
                  <span className="text-xs font-black uppercase tracking-tighter">Redact My Messages</span>
                </button>
                <button className="flex w-full items-center space-x-3 rounded-xl border border-transparent bg-bg-nav/50 p-3 text-text-muted transition hover:bg-bg-hover hover:text-text-main shadow-sm">
                  <Info className="h-4 w-4" />
                  <span className="text-xs font-black uppercase tracking-tighter">View Source</span>
                </button>
              </div>
            </section>
          </div>
        )}
      </div>
    </div>
  );
};

export default ChannelDetails;
