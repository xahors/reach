import React from 'react';
import { Room } from 'matrix-js-sdk';
import { useAppStore } from '../../store/useAppStore';
import { useSpaceRooms } from '../../hooks/useSpaceRooms';
import { useDirectMessages } from '../../hooks/useDirectMessages';
import { useMatrixClient } from '../../hooks/useMatrixClient';
import { cn } from '../../utils/cn';
import { 
  ChevronDown, Settings, Gamepad2, 
  MoreVertical, FolderPlus, Trash2, Check, X, Plus, Hash 
} from 'lucide-react';
import { callManager } from '../../core/callManager';
import { useGamePresence } from '../../hooks/useGamePresence';
import { useUserPresence } from '../../hooks/useUserPresence';
import RoomItem from './RoomItem';

const ChannelList: React.FC = () => {
  const { 
    activeSpaceId, 
    activeRoomId, 
    setActiveRoomId,
    setSettingsOpen, 
    setCreateModalOpen,
    setChannelExplorerOpen,
    detectedGame,
    customGameNames,
    userPresence,
    setUserPresence,
    customStatus,
    setCustomStatus,
    roomSections,
    roomSectionOrder,
    lastRoomPerSpace,
    setRoomSection,
    addSection,
    removeSection,
    roomNotificationSettings,
    setRoomNotificationSetting
  } = useAppStore();
  const { rooms, loading: spaceRoomsLoading } = useSpaceRooms(activeSpaceId);
  const { dms, loading: dmsLoading } = useDirectMessages();
  const client = useMatrixClient();
  
  const [showStatusPicker, setShowStatusPicker] = React.useState(false);
  const [statusInput, setStatusInput] = React.useState(customStatus || '');
  const statusPickerRef = React.useRef<HTMLDivElement>(null);
  
  const [showNewSectionInput, setShowNewSectionPicker] = React.useState(false);
  const [newSectionName, setNewSectionName] = React.useState('');
  const [contextMenuRoom, setContextMenuRoom] = React.useState<string | null>(null);
  const contextMenuRef = React.useRef<HTMLDivElement>(null);
  
  // Drag and Drop state
  const [draggedRoomId, setDraggedRoomId] = React.useState<string | null>(null);
  const [dragOverSection, setDragOverSection] = React.useState<string | null>(null);
  
  useGamePresence();
  const { avatarUrl: userAvatarUrl, displayName: userDisplayName } = useUserPresence(client?.getUserId() || null);

  const activeSpace = activeSpaceId ? client?.getRoom(activeSpaceId) : null;
  const currentSpaceSections = (activeSpaceId && roomSectionOrder[activeSpaceId]) || ['Channels'];
  const lastSelectedSpace = React.useRef<string | null>(activeSpaceId);
  const isMounted = React.useRef(true);

  React.useEffect(() => {
    isMounted.current = true;
    return () => { isMounted.current = false; };
  }, []);

  // Effect to handle space switching and initial room selection
  React.useEffect(() => {
    if (!isMounted.current || spaceRoomsLoading || dmsLoading) return;

    const spaceId = activeSpaceId || 'home';
    const lastRoomId = lastRoomPerSpace[spaceId];
    const spaceChanged = lastSelectedSpace.current !== activeSpaceId;

    if (activeSpaceId) {
      // SPACE MODE
      const currentRoomInSpace = rooms.some(r => r.roomId === activeRoomId);

      if (spaceChanged || !activeRoomId || !currentRoomInSpace) {
        if (rooms.length > 0) {
          // If we changed spaces, or have no room, or current room isn't in this space
          let targetRoomId = lastRoomId;

          // Verify lastRoomId actually belongs to this space
          if (!targetRoomId || !rooms.some(r => r.roomId === targetRoomId)) {
            targetRoomId = rooms[0].roomId;
          }

          if (targetRoomId !== activeRoomId) {
            const timer = setTimeout(() => {
              if (isMounted.current) setActiveRoomId?.(targetRoomId);
            }, 0);
            return () => clearTimeout(timer);
          }
        } else if (activeRoomId) {
          // Space is empty, clear active room
          const timer = setTimeout(() => {
            if (isMounted.current) setActiveRoomId?.(null);
          }, 0);
          return () => clearTimeout(timer);
        }
      }
    } else {
      // HOME / DM MODE
      const currentRoomInDms = dms.some(d => d.room.roomId === activeRoomId);

      if (spaceChanged || !activeRoomId || !currentRoomInDms) {
        if (dms.length > 0) {
          let targetRoomId = lastRoomId;

          if (!targetRoomId || !dms.some(d => d.room.roomId === targetRoomId)) {
            targetRoomId = dms[0].room.roomId;
          }

          if (targetRoomId !== activeRoomId) {
            const timer = setTimeout(() => {
              if (isMounted.current) setActiveRoomId?.(targetRoomId);
            }, 0);
            return () => clearTimeout(timer);
          }
        } else if (activeRoomId) {
          // DMs are empty, clear active room
          const timer = setTimeout(() => {
            if (isMounted.current) setActiveRoomId?.(null);
          }, 0);
          return () => clearTimeout(timer);
        }
      }
    }
    
    lastSelectedSpace.current = activeSpaceId;
  }, [activeSpaceId, rooms, dms, activeRoomId, setActiveRoomId, lastRoomPerSpace, spaceRoomsLoading]);

  const handleRoomClick = (roomId: string) => {
    callManager.warmupAudioContext();
    setActiveRoomId?.(roomId);
    
    // Auto-join persistent voice channels if a call is already active
    // Run this in the background to avoid blocking the UI thread
    const room = client?.getRoom(roomId);
    if (room) {
      const roomType = room.currentState.getStateEvents('m.room.create', '')?.getContent()?.type;
      const isVoiceRoom = roomType === 'org.matrix.msc3401.room.voice';
      
      if (isVoiceRoom) {
        callManager.enterGroupCall(roomId, 'voice').catch(err => {
          console.error("Failed to enter voice channel:", err);
        });
      } else {
        const groupCall = client?.getGroupCallForRoom(roomId);
        if (groupCall) {
          callManager.joinVoiceChannel(roomId).catch(err => {
             console.error("Failed to auto-join voice channel:", err);
          });
        }
      }
    }
  };

  const handleAddSection = (e: React.FormEvent) => {
    e.preventDefault();
    if (newSectionName.trim() && activeSpaceId) {
      addSection(activeSpaceId, newSectionName.trim());
      setNewSectionName('');
      setShowNewSectionPicker(false);
    }
  };

  React.useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (statusPickerRef.current && !statusPickerRef.current.contains(event.target as Node)) {
        setShowStatusPicker(false);
      }
      if (contextMenuRef.current && !contextMenuRef.current.contains(event.target as Node)) {
        setContextMenuRoom(null);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const handleStatusSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setCustomStatus(statusInput || null);
    setShowStatusPicker(false);
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'online': return 'bg-green-500';
      case 'idle': return 'bg-yellow-500';
      case 'dnd': return 'bg-red-500';
      case 'invisible': return 'bg-gray-500';
      default: return 'bg-green-500';
    }
  };

  // Drag and Drop Handlers
  const onDragStart = (e: React.DragEvent, roomId: string) => {
    setDraggedRoomId(roomId);
    e.dataTransfer.setData('roomId', roomId);
    e.dataTransfer.effectAllowed = 'move';
    
    // Add a ghost image or styling
    const target = e.currentTarget as HTMLElement;
    target.style.opacity = '0.4';
  };

  const onDragEnd = (e: React.DragEvent) => {
    setDraggedRoomId(null);
    setDragOverSection(null);
    const target = e.currentTarget as HTMLElement;
    target.style.opacity = '1';
  };

  const onDragOver = (e: React.DragEvent, sectionName: string) => {
    e.preventDefault();
    setDragOverSection(sectionName);
  };

  const onDrop = (e: React.DragEvent, sectionName: string) => {
    e.preventDefault();
    const roomId = e.dataTransfer.getData('roomId');
    if (roomId) {
      setRoomSection(roomId, sectionName);
    }
    setDragOverSection(null);
    setDraggedRoomId(null);
  };

  const renderRoom = (room: Room, isDM = false, otherUserId?: string) => {
    const isActive = activeRoomId === room.roomId;
    const isDragged = draggedRoomId === room.roomId;
    
    return (
      <div 
        key={room.roomId} 
        draggable={!isDM}
        onDragStart={(e) => onDragStart(e, room.roomId)}
        onDragEnd={onDragEnd}
        className={cn(
          "relative group/room cursor-grab active:cursor-grabbing",
          isDragged && "opacity-40"
        )}
      >
        <RoomItem
          room={room}
          isActive={isActive}
          onClick={handleRoomClick}
          isDM={isDM}
          otherUserId={otherUserId}
        />
        {!isDM && (
          <button 
            onClick={(e) => { 
              e.stopPropagation(); 
              setContextMenuRoom(contextMenuRoom === room.roomId ? null : room.roomId); 
            }}
            className="absolute right-2 top-1/2 -translate-y-1/2 p-1 rounded hover:bg-white/10 opacity-0 group-hover/room:opacity-100 transition text-text-muted hover:text-white"
          >
            <MoreVertical className="h-3.5 w-3.5" />
          </button>
        )}

        {contextMenuRoom === room.roomId && (
          <div 
            ref={contextMenuRef}
            className="absolute right-8 top-0 w-48 rounded-md bg-bg-sidebar shadow-2xl border border-border-main p-1 z-[100] animate-in fade-in zoom-in duration-150"
          >
            <div className="px-2 py-1.5 text-[10px] font-bold uppercase text-text-muted border-b border-border-main mb-1 tracking-wider">Notifications</div>
            {[
              { id: 'all', label: 'All Messages' },
              { id: 'mentions', label: 'Mentions Only' },
              { id: 'mute', label: 'Mute' },
            ].map(option => (
              <button
                key={option.id}
                onClick={() => {
                  setRoomNotificationSetting(room.roomId, option.id as 'all' | 'mentions' | 'mute');
                  setContextMenuRoom(null);
                }}
                className="flex w-full items-center px-2 py-1.5 rounded text-sm text-text-main hover:bg-bg-hover transition font-bold"
              >
                {option.label}
                {(roomNotificationSettings[room.roomId] || 'all') === option.id && <Check className="ml-auto h-3.5 w-3.5 text-accent-primary" />}
              </button>
            ))}

            {!isDM && (
              <>
                <div className="px-2 py-1.5 text-[10px] font-bold uppercase text-text-muted border-b border-t border-border-main my-1 tracking-wider">Move to Section</div>
                {currentSpaceSections.map(section => (
                  <button
                    key={section}
                    onClick={() => {
                      setRoomSection(room.roomId, section);
                      setContextMenuRoom(null);
                    }}
                    className="flex w-full items-center px-2 py-1.5 rounded text-sm text-text-main hover:bg-bg-hover transition font-bold"
                  >
                    {section}
                    {roomSections[room.roomId] === section && <Check className="ml-auto h-3.5 w-3.5 text-accent-primary" />}
                  </button>
                ))}
              </>
            )}
          </div>
        )}
      </div>
    );
  };

  const renderSections = () => {
    const grouped: Record<string, Room[]> = {};
    currentSpaceSections.forEach(s => grouped[s] = []);
    
    rooms.forEach(room => {
      const section = roomSections[room.roomId] || 'Channels';
      if (grouped[section]) {
        grouped[section].push(room);
      } else {
        if (!grouped['Channels']) grouped['Channels'] = [];
        grouped['Channels'].push(room);
      }
    });

    return (
      <div className="flex-1 overflow-y-auto pt-2 no-scrollbar">
        {/* Browse Channels Button */}
        <div className="px-2 mb-4">
          <button
            onClick={() => setChannelExplorerOpen(true)}
            className="flex w-full items-center space-x-2 px-2 py-1.5 rounded text-sm font-bold text-text-muted hover:bg-bg-hover hover:text-white transition"
          >
            <Hash className="h-4 w-4" />
            <span>Browse Channels</span>
          </button>
        </div>

        {currentSpaceSections.map(section => {
          const isOver = dragOverSection === section;
          return (
            <div 
              key={section} 
              className={cn(
                "mb-4 px-2 transition-all duration-200 rounded-lg mx-1",
                isOver ? "bg-accent-primary/10 py-2 border border-accent-primary/30" : "border border-transparent"
              )}
              onDragOver={(e) => onDragOver(e, section)}
              onDrop={(e) => onDrop(e, section)}
            >
              <div className="flex items-center justify-between px-2 mb-1 group/header">
                <div className="flex items-center text-[10px] font-bold uppercase text-text-muted hover:text-text-main transition cursor-pointer tracking-wider">
                  <ChevronDown className="h-3 w-3 mr-0.5" />
                  <span>{section}</span>
                </div>
                <div className="flex items-center space-x-1 opacity-0 group-hover/header:opacity-100 transition">
                  <button 
                    onClick={(e) => {
                      e.stopPropagation();
                      setCreateModalOpen(true, 'room');
                    }}
                    className="p-0.5 hover:text-text-main transition"
                  >
                    <Plus className="h-3 w-3" />
                  </button>
                  {section !== 'Channels' && activeSpaceId && (
                    <button onClick={() => removeSection(activeSpaceId, section)} className="p-0.5 hover:text-red-400 transition">
                      <Trash2 className="h-3 w-3" />
                    </button>
                  )}
                </div>
              </div>
              <div className="space-y-[2px]">
                {grouped[section].length === 0 ? (
                  <div className="px-2 py-2 text-[10px] text-text-muted italic opacity-50 border border-dashed border-border-main rounded">
                    Drop channels here
                  </div>
                ) : (
                  grouped[section].map(room => renderRoom(room))
                )}
              </div>
            </div>
          );
        })}

        {showNewSectionInput ? (
          <form onSubmit={handleAddSection} className="px-4 mb-4">
            <div className="flex items-center space-x-1">
              <input 
                autoFocus
                type="text"
                value={newSectionName}
                onChange={(e) => setNewSectionName(e.target.value)}
                placeholder="New section..."
                className="flex-1 rounded bg-bg-main p-1.5 text-xs text-text-main outline-none border border-border-main focus:border-accent-primary transition"
              />
              <button type="submit" className="p-1.5 rounded bg-accent-primary text-bg-main hover:bg-opacity-90 transition"><Check className="h-3 w-3" /></button>
              <button type="button" onClick={() => setShowNewSectionPicker(false)} className="p-1.5 rounded bg-bg-hover text-text-muted hover:text-white transition"><X className="h-3 w-3" /></button>
            </div>
          </form>
        ) : (
          <button 
            onClick={() => setShowNewSectionPicker(true)}
            className="mx-4 mb-10 flex items-center text-[10px] font-bold uppercase text-text-muted hover:text-text-main transition tracking-wider"
          >
            <FolderPlus className="h-3 w-3 mr-1.5" />
            <span>Add Section</span>
          </button>
        )}
      </div>
    );
  };

  const renderUserFooter = () => (
    <div className="flex h-14 items-center bg-bg-sidebar px-2 py-2 mt-auto relative border-t border-border-main">
      {showStatusPicker && (
        <div 
          ref={statusPickerRef}
          className="absolute bottom-full left-2 mb-2 w-64 rounded-lg bg-bg-sidebar shadow-2xl border border-border-main p-2 z-50 animate-in slide-in-from-bottom-2 duration-200"
        >
          <div className="p-2">
            <form onSubmit={handleStatusSubmit} className="mb-4">
              <label className="text-[10px] font-bold text-text-muted uppercase mb-1 block tracking-wider">Custom Status</label>
              <input 
                type="text"
                value={statusInput}
                onChange={(e) => setStatusInput(e.target.value)}
                placeholder="What's on your mind?"
                className="w-full rounded bg-bg-main p-2 text-xs text-text-main outline-none border border-border-main focus:border-accent-primary transition"
              />
            </form>

            <div className="space-y-1">
              {[
                { id: 'online', label: 'Online', desc: 'You are available', color: 'bg-green-500' },
                { id: 'idle', label: 'Idle', desc: 'You are away from keys', color: 'bg-yellow-500' },
                { id: 'dnd', label: 'Do Not Disturb', desc: 'You will not receive notifications', color: 'bg-red-500' },
                { id: 'invisible', label: 'Invisible', desc: 'Appear offline to everyone', color: 'bg-gray-500' },
              ].map((status) => (
                <button
                  key={status.id}
                  onClick={() => {
                    setUserPresence(status.id as 'online' | 'idle' | 'dnd' | 'invisible');
                    setShowStatusPicker(false);
                  }}
                  className="flex w-full items-center p-2 rounded hover:bg-bg-hover transition text-left"
                >
                  <div className={`h-3 w-3 rounded-full mr-3 ${status.color}`} />
                  <div className="flex flex-col">
                    <span className="text-xs font-bold text-white">{status.label}</span>
                    <span className="text-[10px] text-text-muted">{status.desc}</span>
                  </div>
                  {userPresence === status.id && <div className="ml-auto h-1.5 w-1.5 rounded-full bg-accent-primary" />}
                </button>
              ))}
            </div>
          </div>
        </div>
      )}

      <div 
        onClick={() => setShowStatusPicker(!showStatusPicker)}
        className="flex flex-1 items-center rounded px-1 transition hover:bg-bg-hover cursor-pointer group"
      >
        <div className="relative h-8 w-8 rounded-full bg-accent-primary flex items-center justify-center text-bg-main font-bold text-sm overflow-hidden">
           {userAvatarUrl ? (
             <img 
               src={client?.mxcUrlToHttp(userAvatarUrl, 32, 32, 'crop') || ''} 
               alt="" 
               className="h-full w-full object-cover" 
             />
           ) : (
             <span>{userDisplayName?.charAt(0).toUpperCase() || client?.getUserId()?.charAt(1).toUpperCase()}</span>
           )}
           <div className={`absolute bottom-0 right-0 h-3 w-3 rounded-full border-2 border-bg-sidebar ${getStatusColor(userPresence)}`} />
        </div>
        <div className="ml-2 flex flex-col overflow-hidden">
          <span className="text-sm font-bold text-text-main leading-tight truncate">
            {userDisplayName || client?.getUserId()?.split(':')[0].substring(1)}
          </span>
          <span className={cn(
            "truncate text-[10px] leading-tight flex items-center",
            detectedGame ? "text-accent-primary font-bold" : "text-text-muted"
          )}>
            {detectedGame && userPresence !== 'invisible' ? (
              <>
                <Gamepad2 className="mr-1 h-2.5 w-2.5" />
                Playing {customGameNames[detectedGame] || detectedGame}
              </>
            ) : (customStatus || (userPresence.charAt(0).toUpperCase() + userPresence.slice(1)))}
          </span>
        </div>
      </div>

      <div className="flex items-center space-x-1">
        <button 
          onClick={() => setSettingsOpen(true)}
          className="p-1.5 rounded-md text-text-muted hover:bg-bg-hover hover:text-text-main transition"
        >
          <Settings className="h-4 w-4" />
        </button>
      </div>
    </div>
  );

  return (
    <div className="flex h-full w-60 flex-col bg-bg-sidebar">
      <button className="flex h-12 items-center justify-between px-4 transition hover:bg-bg-hover shadow-sm border-b border-border-main">
        <span className="truncate text-base font-bold text-white tracking-tight uppercase">
          {activeSpace?.name || (activeSpaceId ? 'Loading Space...' : 'Direct Messages')}
        </span>
        <ChevronDown className="h-4 w-4 text-text-muted" />
      </button>

      {activeSpaceId ? renderSections() : (
        <div className="flex-1 overflow-y-auto pt-4 no-scrollbar px-2">
          <div className="flex items-center justify-between px-2 mb-2 group/header">
            <span className="text-[10px] font-bold uppercase text-text-muted tracking-wider">Direct Messages</span>
            <button 
              onClick={() => setCreateModalOpen(true, 'room')}
              className="p-0.5 text-text-muted opacity-0 group-hover/header:opacity-100 hover:text-text-main transition"
            >
              <Plus className="h-3 w-3" />
            </button>
          </div>
          <div className="space-y-[2px]">
            {dmsLoading ? (
              <div className="mx-2 h-10 animate-pulse rounded bg-bg-nav" />
            ) : dms.map(({ room, otherUserId }) => renderRoom(room, true, otherUserId))}
          </div>
        </div>
      )}

      {renderUserFooter()}
    </div>
  );
};

export default ChannelList;
