import React, { useState } from 'react';
import { useAppStore } from '../../store/useAppStore';
import { useRoomMessages } from '../../hooks/useRoomMessages';
import { useRoomMembers } from '../../hooks/useRoomMembers';
import { useMatrixClient } from '../../hooks/useMatrixClient';
import { X, Hash, Trash2, Info, Users, Settings, ChevronRight, ChevronDown } from 'lucide-react';
import { cn } from '../../utils/cn';
import { Direction, type RoomMember } from 'matrix-js-sdk';

const ChannelDetails: React.FC = () => {
  const { activeRoomId, setChannelDetailsOpen } = useAppStore();
  const client = useMatrixClient();
  const { redactAllMyMessages, loading: redacting } = useRoomMessages(activeRoomId);
  const { members, loading: membersLoading } = useRoomMembers(activeRoomId);
  const [isMembersOpen, setIsMembersOpen] = useState(false);

  const room = activeRoomId ? client?.getRoom(activeRoomId) : null;

  if (!room) return null;

  const topic = room.getLiveTimeline().getState(Direction.Forward)?.getStateEvents('m.room.topic', '')?.getContent().topic;

  const admins = members.filter(m => m.powerLevel >= 100);
  const moderators = members.filter(m => m.powerLevel >= 50 && m.powerLevel < 100);
  const everyone = members.filter(m => m.powerLevel < 50);

  const getAvatar = (member: RoomMember) => {
    if (!client || typeof member.getAvatarUrl !== 'function') return null;
    try {
      return member.getAvatarUrl(client.getHomeserverUrl(), 24, 24, 'crop', undefined, true);
    } catch {
      return null;
    }
  };

  const renderMemberGroup = (title: string, groupMembers: typeof members) => {
    if (groupMembers.length === 0) return null;

    return (
      <div className="mt-4 first:mt-0">
        <h5 className="mb-1 text-[9px] font-bold uppercase text-discord-text-muted px-2">
          {title} — {groupMembers.length}
        </h5>
        <div className="space-y-0.5">
          {groupMembers.map((member) => {
            const avatarUrl = getAvatar(member);
            return (
              <div
                key={member.userId}
                className="group flex items-center rounded px-2 py-1 transition hover:bg-discord-hover cursor-pointer"
              >
                <div className="relative">
                  <div className="h-6 w-6 rounded-full bg-discord-accent flex items-center justify-center text-white font-bold text-[10px] overflow-hidden shrink-0">
                    {avatarUrl ? (
                      <img src={avatarUrl || ''} alt="" className="h-full w-full object-cover" />
                    ) : (
                      member.name.charAt(0).toUpperCase()
                    )}
                  </div>
                  <div 
                    className={cn(
                      "absolute -bottom-0.5 -right-0.5 h-2.5 w-2.5 rounded-full border border-discord-sidebar",
                      member.user?.presence === 'online' ? "bg-green-500" : "bg-discord-text-muted"
                    )} 
                  />
                </div>
                <div className="ml-2 overflow-hidden">
                  <div className={cn(
                    "truncate text-xs font-medium",
                    member.powerLevel >= 50 ? "text-discord-accent" : "text-discord-text-muted group-hover:text-discord-text"
                  )}>
                    {member.name}
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      </div>
    );
  };

  return (
    <div className="w-80 border-l border-discord-hover bg-discord-sidebar flex flex-col h-full animate-in slide-in-from-right duration-200">
      {/* Header */}
      <div className="h-12 px-4 flex items-center justify-between border-b border-discord-hover shadow-sm shrink-0">
        <div className="flex items-center text-white font-bold">
          <Info className="mr-2 h-5 w-5 text-discord-text-muted" />
          <span>Channel Details</span>
        </div>
        <button 
          onClick={() => setChannelDetailsOpen(false)}
          className="text-discord-text-muted hover:text-white transition"
        >
          <X className="h-6 w-6" />
        </button>
      </div>

      {/* Content */}
      <div className="flex-1 overflow-y-auto p-4 space-y-6">
        {/* Basic Info */}
        <section>
          <div className="flex items-center space-x-2 mb-2">
            <Hash className="h-5 w-5 text-discord-text-muted" />
            <h3 className="text-white font-bold">{room.name}</h3>
          </div>
          <p className="text-xs text-discord-text-muted break-all bg-discord-dark/50 p-2 rounded">
            ID: {room.roomId}
          </p>
        </section>

        {/* Topic */}
        <section>
          <h4 className="text-[10px] font-bold uppercase text-discord-text-muted mb-2 px-1">Topic</h4>
          <div className="text-sm text-discord-text bg-discord-dark/30 p-3 rounded border border-discord-hover">
            {topic || <span className="italic text-discord-text-muted">No topic set.</span>}
          </div>
        </section>

        {/* Members List Submenu */}
        <section className="border-t border-discord-hover pt-4">
          <button 
            onClick={() => setIsMembersOpen(!isMembersOpen)}
            className="w-full flex items-center justify-between group p-1 rounded hover:bg-discord-hover/50 transition mb-2"
          >
            <div className="flex items-center text-[10px] font-bold uppercase text-discord-text-muted group-hover:text-discord-text transition px-1">
              <Users className="h-3 w-3 mr-2" />
              <span>Members — {room.getJoinedMemberCount()}</span>
            </div>
            {isMembersOpen ? <ChevronDown className="h-4 w-4 text-discord-text-muted" /> : <ChevronRight className="h-4 w-4 text-discord-text-muted" />}
          </button>

          {isMembersOpen && (
            <div className="bg-discord-dark/20 rounded-lg p-2 border border-discord-hover animate-in fade-in zoom-in-95 duration-150">
              {membersLoading ? (
                <div className="space-y-2 p-2">
                  {[1, 2, 3].map(i => <div key={i} className="h-6 animate-pulse rounded bg-discord-hover" />)}
                </div>
              ) : (
                <>
                  {renderMemberGroup('Admins', admins)}
                  {renderMemberGroup('Moderators', moderators)}
                  {renderMemberGroup('Everyone', everyone)}
                </>
              )}
            </div>
          )}
        </section>

        {/* Danger Zone */}
        <section className="pt-4 border-t border-discord-hover">
          <h4 className="text-[10px] font-bold uppercase text-red-400 mb-2 px-1">Danger Zone</h4>
          <button 
            onClick={redactAllMyMessages}
            disabled={redacting}
            className="w-full flex items-center justify-center space-x-2 bg-red-500/10 hover:bg-red-500/20 text-red-400 p-2.5 rounded border border-red-500/30 transition disabled:opacity-50"
          >
            <Trash2 className="h-4 w-4" />
            <span className="text-sm font-bold">Delete My Messages</span>
          </button>
        </section>
      </div>

      {/* Footer */}
      <div className="p-4 bg-discord-dark/20 border-t border-discord-hover">
        <button className="w-full flex items-center justify-center space-x-2 text-discord-text-muted hover:text-white transition py-2 text-sm">
          <Settings className="h-4 w-4" />
          <span>Channel Settings</span>
        </button>
      </div>
    </div>
  );
};

export default ChannelDetails;
