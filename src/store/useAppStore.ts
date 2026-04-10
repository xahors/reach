import { create } from 'zustand';
import { type MatrixCall, type MatrixEvent } from 'matrix-js-sdk';
import { type GroupCall } from 'matrix-js-sdk/lib/webrtc/groupCall';
import { type CallFeed } from 'matrix-js-sdk/lib/webrtc/callFeed';

interface AppState {
  isLoggedIn: boolean;
  isSynced: boolean;
  userId: string | null;
  activeSpaceId: string | null;
  activeRoomId: string | null;
  activeCall: MatrixCall | null;
  activeGroupCall: GroupCall | null;
  callFeeds: CallFeed[];
  incomingCall: MatrixCall | null;
  isSettingsOpen: boolean;
  isChannelDetailsOpen: boolean;
  isCallMinimized: boolean;
  isMuted: boolean;
  isCameraOff: boolean;
  isScreensharing: boolean;
  callLayout: 'integrated' | 'floating' | 'minimized';
  messageLoadPolicy: 'latest' | 'last_read';
  editingEvent: MatrixEvent | null;
  replyingToEvent: MatrixEvent | null;
  setLoggedIn: (isLoggedIn: boolean, userId: string | null) => void;
  setSynced: (isSynced: boolean) => void;
  setActiveSpaceId: (id: string | null) => void;
  setActiveRoomId: (id: string | null) => void;
  setActiveCall: (call: MatrixCall | null) => void;
  setActiveGroupCall: (call: GroupCall | null) => void;
  setCallFeeds: (feeds: CallFeed[]) => void;
  setIncomingCall: (call: MatrixCall | null) => void;
  setSettingsOpen: (isOpen: boolean) => void;
  setChannelDetailsOpen: (isOpen: boolean) => void;
  setCallMinimized: (isMinimized: boolean) => void;
  setMuted: (isMuted: boolean) => void;
  setCameraOff: (isCameraOff: boolean) => void;
  setScreensharing: (isScreensharing: boolean) => void;
  setCallLayout: (layout: 'integrated' | 'floating' | 'minimized') => void;
  setMessageLoadPolicy: (policy: 'latest' | 'last_read') => void;
  setEditingEvent: (event: MatrixEvent | null) => void;
  setReplyingToEvent: (event: MatrixEvent | null) => void;
}

export const useAppStore = create<AppState>((set) => ({
  isLoggedIn: false,
  isSynced: false,
  userId: null,
  activeSpaceId: null,
  activeRoomId: null,
  activeCall: null,
  activeGroupCall: null,
  callFeeds: [],
  incomingCall: null,
  isSettingsOpen: false,
  isChannelDetailsOpen: false,
  isCallMinimized: false,
  isMuted: false,
  isCameraOff: true,
  isScreensharing: false,
  callLayout: 'integrated',
  messageLoadPolicy: (localStorage.getItem('reach_message_load_policy') as 'latest' | 'last_read') || 'last_read',
  editingEvent: null,
  replyingToEvent: null,
  setLoggedIn: (isLoggedIn, userId) => set({ isLoggedIn, userId }),
  setSynced: (isSynced) => set({ isSynced }),
  setActiveSpaceId: (id) => set({ activeSpaceId: id }),
  setActiveRoomId: (id) => set({ activeRoomId: id }),
  setActiveCall: (call) => set((state) => ({ 
    activeCall: call, 
    isCallMinimized: false, 
    isMuted: false, 
    isCameraOff: state.isCameraOff, 
    isScreensharing: false,
    callLayout: state.isCameraOff ? 'minimized' : 'integrated'
  })),
  setActiveGroupCall: (call) => set((state) => ({ 
    activeGroupCall: call, 
    isCallMinimized: false, 
    isMuted: false, 
    isCameraOff: state.isCameraOff, 
    isScreensharing: false,
    callLayout: state.isCameraOff ? 'minimized' : 'integrated'
  })),
  setCallFeeds: (feeds) => set({ callFeeds: feeds }),
  setIncomingCall: (call) => set({ incomingCall: call }),
  setSettingsOpen: (isOpen) => set({ isSettingsOpen: isOpen }),
  setChannelDetailsOpen: (isOpen) => set({ isChannelDetailsOpen: isOpen }),
  setCallMinimized: (isMinimized) => set({ isCallMinimized: isMinimized }),
  setMuted: (isMuted) => set({ isMuted }),
  setCameraOff: (isCameraOff) => set({ isCameraOff }),
  setScreensharing: (isScreensharing) => set({ isScreensharing }),
  setCallLayout: (layout) => set({ callLayout: layout }),
  setMessageLoadPolicy: (policy) => {
    localStorage.setItem('reach_message_load_policy', policy);
    set({ messageLoadPolicy: policy });
  },
  setEditingEvent: (event) => set({ editingEvent: event, replyingToEvent: null }),
  setReplyingToEvent: (event) => set({ replyingToEvent: event, editingEvent: null }),
}));
