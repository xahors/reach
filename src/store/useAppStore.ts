import { create } from 'zustand';
import { type MatrixCall, type MatrixEvent } from 'matrix-js-sdk';

interface AppState {
  isLoggedIn: boolean;
  isSynced: boolean;
  userId: string | null;
  activeSpaceId: string | null;
  activeRoomId: string | null;
  activeCall: MatrixCall | null;
  incomingCall: MatrixCall | null;
  isSettingsOpen: boolean;
  isChannelDetailsOpen: boolean;
  isCallMinimized: boolean;
  messageLoadPolicy: 'latest' | 'last_read';
  editingEvent: MatrixEvent | null;
  replyingToEvent: MatrixEvent | null;
  setLoggedIn: (isLoggedIn: boolean, userId: string | null) => void;
  setSynced: (isSynced: boolean) => void;
  setActiveSpaceId: (id: string | null) => void;
  setActiveRoomId: (id: string | null) => void;
  setActiveCall: (call: MatrixCall | null) => void;
  setIncomingCall: (call: MatrixCall | null) => void;
  setSettingsOpen: (isOpen: boolean) => void;
  setChannelDetailsOpen: (isOpen: boolean) => void;
  setCallMinimized: (isMinimized: boolean) => void;
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
  incomingCall: null,
  isSettingsOpen: false,
  isChannelDetailsOpen: false,
  isCallMinimized: false,
  messageLoadPolicy: (localStorage.getItem('reach_message_load_policy') as 'latest' | 'last_read') || 'last_read',
  editingEvent: null,
  replyingToEvent: null,
  setLoggedIn: (isLoggedIn, userId) => set({ isLoggedIn, userId }),
  setSynced: (isSynced) => set({ isSynced }),
  setActiveSpaceId: (id) => set({ activeSpaceId: id }),
  setActiveRoomId: (id) => set({ activeRoomId: id }),
  setActiveCall: (call) => set({ activeCall: call, isCallMinimized: false }),
  setIncomingCall: (call) => set({ incomingCall: call }),
  setSettingsOpen: (isOpen) => set({ isSettingsOpen: isOpen }),
  setChannelDetailsOpen: (isOpen) => set({ isChannelDetailsOpen: isOpen }),
  setCallMinimized: (isMinimized) => set({ isCallMinimized: isMinimized }),
  setMessageLoadPolicy: (policy) => {
    localStorage.setItem('reach_message_load_policy', policy);
    set({ messageLoadPolicy: policy });
  },
  setEditingEvent: (event) => set({ editingEvent: event, replyingToEvent: null }),
  setReplyingToEvent: (event) => set({ replyingToEvent: event, editingEvent: null }),
}));
