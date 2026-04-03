import { create } from 'zustand';
import { type MatrixCall } from 'matrix-js-sdk';

interface AppState {
  isLoggedIn: boolean;
  isSynced: boolean;
  userId: string | null;
  activeSpaceId: string | null;
  activeRoomId: string | null;
  activeCall: MatrixCall | null;
  incomingCall: MatrixCall | null;
  isSettingsOpen: boolean;
  setLoggedIn: (isLoggedIn: boolean, userId: string | null) => void;
  setSynced: (isSynced: boolean) => void;
  setActiveSpaceId: (id: string | null) => void;
  setActiveRoomId: (id: string | null) => void;
  setActiveCall: (call: MatrixCall | null) => void;
  setIncomingCall: (call: MatrixCall | null) => void;
  setSettingsOpen: (isOpen: boolean) => void;
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
  setLoggedIn: (isLoggedIn, userId) => set({ isLoggedIn, userId }),
  setSynced: (isSynced) => set({ isSynced }),
  setActiveSpaceId: (id) => set({ activeSpaceId: id }),
  setActiveRoomId: (id) => set({ activeRoomId: id }),
  setActiveCall: (call) => set({ activeCall: call }),
  setIncomingCall: (call) => set({ incomingCall: call }),
  setSettingsOpen: (isOpen) => set({ isSettingsOpen: isOpen }),
}));
