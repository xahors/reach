import React from 'react';
import { useAppStore } from '../../store/useAppStore';
import { useRoomMessages } from '../../hooks/useRoomMessages';
import { useMatrixClient } from '../../hooks/useMatrixClient';
import { X, Hash, Trash2, Info, Users, Shield, Settings } from 'lucide-react';

const ChannelDetails: React.FC = () => {
  const { activeRoomId, setChannelDetailsOpen } = useAppStore();
  const client = useMatrixClient();
  const { redactAllMyMessages, loading } = useRoomMessages(activeRoomId);

  const room = activeRoomId ? client?.getRoom(activeRoomId) : null;

  if (!room) return null;

  const topic = room.getLiveTimeline().getState(Direction.Forward)?.getStateEvents('m.room.topic', '')?.getContent().topic;

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

        {/* Stats */}
        <section className="grid grid-cols-2 gap-2">
          <div className="bg-discord-dark/30 p-3 rounded border border-discord-hover flex flex-col items-center">
            <Users className="h-5 w-5 text-discord-accent mb-1" />
            <span className="text-white font-bold">{room.getJoinedMemberCount()}</span>
            <span className="text-[10px] text-discord-text-muted uppercase font-bold">Members</span>
          </div>
          <div className="bg-discord-dark/30 p-3 rounded border border-discord-hover flex flex-col items-center">
            <Shield className="h-5 w-5 text-green-500 mb-1" />
            <span className="text-white font-bold">{room.getJoinRule() === 'public' ? 'Public' : 'Private'}</span>
            <span className="text-[10px] text-discord-text-muted uppercase font-bold">Visibility</span>
          </div>
        </section>

        {/* Danger Zone */}
        <section className="pt-4 border-t border-discord-hover">
          <h4 className="text-[10px] font-bold uppercase text-red-400 mb-2 px-1">Danger Zone</h4>
          <button 
            onClick={redactAllMyMessages}
            disabled={loading}
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

// Placeholder for Direction enum if not imported correctly from SDK in this specific file context
// but it should be available via imports if we add it. 
// Actually, let's fix the Direction import.
import { Direction } from 'matrix-js-sdk';

export default ChannelDetails;
