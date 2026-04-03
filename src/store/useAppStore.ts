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
  editingEvent: null,
  replyingToEvent: null,
  setLoggedIn: (isLoggedIn, userId) => set({ isLoggedIn, userId }),
  setSynced: (isSynced) => set({ isSynced }),
  setActiveSpaceId: (id) => set({ activeSpaceId: id }),
  setActiveRoomId: (id) => set({ activeRoomId: id }),
  setActiveCall: (call) => set({ activeCall: call }),
  setIncomingCall: (call) => set({ incomingCall: call }),
  setSettingsOpen: (isOpen) => set({ isSettingsOpen: isOpen }),
  setChannelDetailsOpen: (isOpen) => set({ isChannelDetailsOpen: isOpen }),
  setEditingEvent: (event) => set({ editingEvent: event, replyingToEvent: null }),
  setReplyingToEvent: (event) => set({ replyingToEvent: event, editingEvent: null }),
}));
