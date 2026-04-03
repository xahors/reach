import React from 'react';
import { useAppStore } from '../../store/useAppStore';
import { useRoomMembers } from '../../hooks/useRoomMembers';
import { useMatrixClient } from '../../hooks/useMatrixClient';
import { cn } from '../../utils/cn';
import { type RoomMember } from 'matrix-js-sdk';

const MemberList: React.FC = () => {
  const { activeRoomId } = useAppStore();
  const { members, loading } = useRoomMembers(activeRoomId);
  const client = useMatrixClient();

  if (!activeRoomId) return null;

  const admins = members.filter(m => m.powerLevel >= 100);
  const moderators = members.filter(m => m.powerLevel >= 50 && m.powerLevel < 100);
  const everyone = members.filter(m => m.powerLevel < 50);

  const getAvatar = (member: RoomMember) => {
    if (!client || typeof member.getAvatarUrl !== 'function') return null;
    try {
      return member.getAvatarUrl(client.getHomeserverUrl(), 32, 32, 'crop', undefined, true);
    } catch {
      return null;
    }
  };

  const renderMemberGroup = (title: string, groupMembers: typeof members) => {
    if (groupMembers.length === 0) return null;

    return (
      <div className="mt-6 first:mt-2">
        <h3 className="mb-2 px-2 text-xs font-bold uppercase text-discord-text-muted">
          {title} — {groupMembers.length}
        </h3>
        <div className="space-y-1">
          {groupMembers.map((member) => {
            const avatarUrl = getAvatar(member);
            return (
              <div
                key={member.userId}
                className="group flex items-center rounded px-2 py-1.5 transition hover:bg-discord-hover cursor-pointer"
              >
                <div className="relative">
                  <div className="h-8 w-8 rounded-full bg-discord-accent flex items-center justify-center text-white font-bold text-sm overflow-hidden shrink-0">
                    {avatarUrl ? (
                      <img src={avatarUrl || ''} alt="" className="h-full w-full object-cover" />
                    ) : (
                      member.name.charAt(0).toUpperCase()
                    )}
                  </div>
                  {/* Presence indicator - very basic since presence can be flaky on some homeservers */}
                  <div 
                    className={cn(
                      "absolute bottom-0 right-0 h-3 w-3 rounded-full border-2 border-discord-sidebar",
                      member.user?.presence === 'online' ? "bg-green-500" : "bg-discord-text-muted"
                    )} 
                  />
                </div>
                <div className="ml-3 overflow-hidden">
                  <div className={cn(
                    "truncate text-sm font-medium",
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
    <div className="flex h-full w-60 flex-col bg-discord-sidebar p-2 overflow-y-auto no-scrollbar">
      {loading ? (
        <div className="space-y-4 pt-4">
           {[1, 2, 3].map(i => <div key={i} className="h-8 animate-pulse rounded bg-discord-hover mx-2" />)}
        </div>
      ) : (
        <>
          {renderMemberGroup('Admins', admins)}
          {renderMemberGroup('Moderators', moderators)}
          {renderMemberGroup('Members', everyone)}
        </>
      )}
    </div>
  );
};

export default MemberList;
