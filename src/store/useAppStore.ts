import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';
import { type MatrixCall, type MatrixEvent } from 'matrix-js-sdk';
import { type GroupCall } from 'matrix-js-sdk/lib/webrtc/groupCall';
import { type CallFeed } from 'matrix-js-sdk/lib/webrtc/callFeed';
import { matrixService } from '../core/matrix';

export type ThemeColors = {
  'bg-main': string;
  'bg-sidebar': string;
  'bg-nav': string;
  'bg-hover': string;
  'text-main': string;
  'text-muted': string;
  'border-main': string;
  'accent-primary': string;
};

export type ThemeConfig = {
  activePreset: 'oled' | 'classic' | 'slate' | 'icebox' | 'protanopia' | 'deuteranopia' | 'tritanopia' | 'custom';
  colors: ThemeColors;
  customCSS: string;
};

export const THEME_PRESETS: Record<Exclude<ThemeConfig['activePreset'], 'custom'>, ThemeColors> = {
  oled: {
    'bg-main': '#000000',
    'bg-sidebar': '#000000',
    'bg-nav': '#000000',
    'bg-hover': '#1a1a1a',
    'text-main': '#e0e0e0',
    'text-muted': '#808080',
    'border-main': '#262626',
    'accent-primary': '#ffffff',
  },
  classic: {
    'bg-main': '#313338',
    'bg-sidebar': '#2b2d31',
    'bg-nav': '#1e1f22',
    'bg-hover': '#3f4147',
    'text-main': '#dbdee1',
    'text-muted': '#949ba4',
    'border-main': '#1e1f22',
    'accent-primary': '#5865f2',
  },
  slate: {
    'bg-main': '#0f172a',
    'bg-sidebar': '#1e293b',
    'bg-nav': '#020617',
    'bg-hover': '#334155',
    'text-main': '#f1f5f9',
    'text-muted': '#94a3b8',
    'border-main': '#1e293b',
    'accent-primary': '#38bdf8',
  },
  icebox: {
    'bg-main': '#ffffff',
    'bg-sidebar': '#f8fafc',
    'bg-nav': '#f1f5f9',
    'bg-hover': '#e2e8f0',
    'text-main': '#0f172a',
    'text-muted': '#64748b',
    'border-main': '#cbd5e1',
    'accent-primary': '#2563eb',
  },
  protanopia: {
    'bg-main': '#000000',
    'bg-sidebar': '#000000',
    'bg-nav': '#000000',
    'bg-hover': '#1a1a1a',
    'text-main': '#ffffff',
    'text-muted': '#a0a0a0',
    'border-main': '#333333',
    'accent-primary': '#0072B2',
  },
  deuteranopia: {
    'bg-main': '#000000',
    'bg-sidebar': '#000000',
    'bg-nav': '#000000',
    'bg-hover': '#1a1a1a',
    'text-main': '#ffffff',
    'text-muted': '#a0a0a0',
    'border-main': '#333333',
    'accent-primary': '#E69F00',
  },
  tritanopia: {
    'bg-main': '#000000',
    'bg-sidebar': '#000000',
    'bg-nav': '#000000',
    'bg-hover': '#1a1a1a',
    'text-main': '#ffffff',
    'text-muted': '#a0a0a0',
    'border-main': '#333333',
    'accent-primary': '#CC79A7',
  }
};

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
  isExploreOpen: boolean;
  activeSettingsTab: 'security' | 'channels' | 'notifications' | 'sessions' | 'activity' | 'appearance';
  isChannelDetailsOpen: boolean;
  channelDetailsTab: 'members' | 'settings';
  isCallMinimized: boolean;
  isMuted: boolean;
  isCameraOff: boolean;
  isScreensharing: boolean;
  callWindowingMode: 'integrated' | 'minimized' | 'pip';
  callContentLayout: 'grid' | 'speaker' | 'presenter';
  prioritizedFeedId: string | null;
  messageLoadPolicy: 'latest' | 'last_read';
  editingEvent: MatrixEvent | null;
  replyingToEvent: MatrixEvent | null;
  trackedGames: string[];
  customGameNames: Record<string, string>;
  detectedGame: string | null;
  userPresence: 'online' | 'idle' | 'dnd' | 'invisible';
  customStatus: string | null;
  roomSections: Record<string, string>; // roomId -> sectionName
  roomSectionOrder: Record<string, string[]>; // spaceId -> list of section names
  themeConfig: ThemeConfig;
  showUrlPreviews: boolean;
  mediaPreview: {
    url: string;
    type: 'image' | 'video';
    alt?: string;
    file?: unknown;
  } | null;
  globalNotificationSettings: {
    enabled: boolean;
    soundEnabled: boolean;
    desktopEnabled: boolean;
    mentionsOnly: boolean;
  };
  roomNotificationSettings: Record<string, 'all' | 'mentions' | 'mute'>;
  setLoggedIn: (isLoggedIn: boolean, userId: string | null) => void;
  setSynced: (isSynced: boolean) => void;
  setActiveSpaceId: (id: string | null) => void;
  setActiveRoomId: (id: string | null) => void;
  setActiveCall: (call: MatrixCall | null) => void;
  setActiveGroupCall: (call: GroupCall | null) => void;
  setCallFeeds: (feeds: CallFeed[]) => void;
  setIncomingCall: (call: MatrixCall | null) => void;
  setSettingsOpen: (isOpen: boolean, tab?: AppState['activeSettingsTab']) => void;
  setExploreOpen: (isOpen: boolean) => void;
  setChannelDetailsOpen: (isOpen: boolean, tab?: AppState['channelDetailsTab']) => void;
  setChannelDetailsTab: (tab: AppState['channelDetailsTab']) => void;
  setCallMinimized: (isMinimized: boolean) => void;
  setMuted: (isMuted: boolean) => void;
  setCameraOff: (isCameraOff: boolean) => void;
  setScreensharing: (isScreensharing: boolean) => void;
  setCallWindowingMode: (mode: 'integrated' | 'minimized' | 'pip') => void;
  setCallContentLayout: (layout: 'grid' | 'speaker' | 'presenter') => void;
  setPrioritizedFeedId: (id: string | null) => void;
  setMessageLoadPolicy: (policy: 'latest' | 'last_read') => void;
  setEditingEvent: (event: MatrixEvent | null) => void;
  setReplyingToEvent: (event: MatrixEvent | null) => void;
  setTrackedGames: (games: string[]) => void;
  setCustomGameNames: (names: Record<string, string>) => void;
  setDetectedGame: (game: string | null) => void;
  setUserPresence: (presence: 'online' | 'idle' | 'dnd' | 'invisible') => void;
  setCustomStatus: (status: string | null) => void;
  setRoomSection: (roomId: string, sectionName: string) => void;
  addSection: (spaceId: string, sectionName: string) => void;
  removeSection: (spaceId: string, sectionName: string) => void;
  setThemeConfig: (config: Partial<ThemeConfig>) => void;
  setShowUrlPreviews: (show: boolean) => void;
  setMediaPreview: (preview: AppState['mediaPreview']) => void;
  setGlobalNotificationSettings: (settings: Partial<AppState['globalNotificationSettings']>) => void;
  setRoomNotificationSetting: (roomId: string, setting: AppState['roomNotificationSettings'][string]) => void;
}

export const useAppStore = create<AppState>()(
  persist(
    (set) => ({
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
      isExploreOpen: false,
      activeSettingsTab: 'security',
      isChannelDetailsOpen: false,
      channelDetailsTab: 'members',
      isCallMinimized: false,
      isMuted: false,
      isCameraOff: true,
      isScreensharing: false,
      callWindowingMode: 'integrated',
      callContentLayout: 'grid',
      prioritizedFeedId: null,
      messageLoadPolicy: (localStorage.getItem('reach_message_load_policy') as 'latest' | 'last_read') || 'last_read',
      editingEvent: null,
      replyingToEvent: null,
      trackedGames: [],
      customGameNames: {},
      detectedGame: null,
      userPresence: 'online',
      customStatus: null,
      roomSections: {},
      roomSectionOrder: {},
      themeConfig: {
        activePreset: 'oled',
        colors: THEME_PRESETS.oled,
        customCSS: '',
      },
      showUrlPreviews: true,
      mediaPreview: null,
      globalNotificationSettings: {
        enabled: true,
        soundEnabled: true,
        desktopEnabled: true,
        mentionsOnly: false,
      },
      roomNotificationSettings: {},
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
        callWindowingMode: state.isCameraOff ? 'minimized' : 'integrated',
        prioritizedFeedId: null
      })),
      setActiveGroupCall: (call) => set((state) => ({ 
        activeGroupCall: call, 
        isCallMinimized: false, 
        isMuted: false, 
        isCameraOff: state.isCameraOff, 
        isScreensharing: false,
        callWindowingMode: state.isCameraOff ? 'minimized' : 'integrated',
        prioritizedFeedId: null
      })),
      setCallFeeds: (feeds) => set({ callFeeds: feeds }),
      setIncomingCall: (call) => set({ incomingCall: call }),
      setSettingsOpen: (isOpen, tab) => set((state) => ({ 
        isSettingsOpen: isOpen,
        activeSettingsTab: tab || state.activeSettingsTab
      })),
      setExploreOpen: (isOpen) => set({ isExploreOpen: isOpen }),
      setChannelDetailsOpen: (isOpen, tab) => set((state) => ({ 
        isChannelDetailsOpen: isOpen,
        channelDetailsTab: tab || state.channelDetailsTab
      })),
      setChannelDetailsTab: (tab) => set({ channelDetailsTab: tab }),
      setCallMinimized: (isMinimized) => set({ isCallMinimized: isMinimized }),
      setMuted: (isMuted) => set({ isMuted }),
      setCameraOff: (isCameraOff) => set({ isCameraOff }),
      setScreensharing: (isScreensharing) => set({ isScreensharing }),
      setCallWindowingMode: (mode) => set({ callWindowingMode: mode }),
      setCallContentLayout: (layout) => set({ callContentLayout: layout }),
      setPrioritizedFeedId: (id) => set({ prioritizedFeedId: id }),
      setMessageLoadPolicy: (policy) => {
        localStorage.setItem('reach_message_load_policy', policy);
        set({ messageLoadPolicy: policy });
      },
      setEditingEvent: (event) => set({ editingEvent: event, replyingToEvent: null }),
      setReplyingToEvent: (event) => set({ replyingToEvent: event, editingEvent: null }),
      setTrackedGames: (games) => set({ trackedGames: games }),
      setCustomGameNames: (names) => set({ customGameNames: names }),
      setDetectedGame: (game) => set({ detectedGame: game }),
      setUserPresence: (presence) => {
        set({ userPresence: presence });
        matrixService.syncPresenceWithStore();
      },
      setCustomStatus: (status) => {
        set({ customStatus: status });
        matrixService.syncPresenceWithStore();
      },
      setRoomSection: (roomId, sectionName) => set((state) => ({
        roomSections: { ...state.roomSections, [roomId]: sectionName }
      })),
      addSection: (spaceId, sectionName) => set((state) => {
        const currentSections = state.roomSectionOrder[spaceId] || ['Channels'];
        if (currentSections.includes(sectionName)) return state;
        return {
          roomSectionOrder: {
            ...state.roomSectionOrder,
            [spaceId]: [...currentSections, sectionName]
          }
        };
      }),
      removeSection: (spaceId, sectionName) => set((state) => {
        const currentSections = state.roomSectionOrder[spaceId] || ['Channels'];
        return {
          roomSectionOrder: {
            ...state.roomSectionOrder,
            [spaceId]: currentSections.filter(s => s !== sectionName)
          },
        };
      }),
      setThemeConfig: (config) => set((state) => ({
        themeConfig: { ...state.themeConfig, ...config }
      })),
      setShowUrlPreviews: (show) => set({ showUrlPreviews: show }),
      setMediaPreview: (preview) => set({ mediaPreview: preview }),
      setGlobalNotificationSettings: (settings) => set((state) => ({
        globalNotificationSettings: { ...state.globalNotificationSettings, ...settings }
      })),
      setRoomNotificationSetting: (roomId, setting) => set((state) => ({
        roomNotificationSettings: { ...state.roomNotificationSettings, [roomId]: setting }
      })),
    }),
    {
      name: 'reach-app-storage',
      storage: createJSONStorage(() => localStorage),
      partialize: (state) => ({ 
        isLoggedIn: state.isLoggedIn, 
        userId: state.userId,
        messageLoadPolicy: state.messageLoadPolicy,
        trackedGames: state.trackedGames,
        customGameNames: state.customGameNames,
        userPresence: state.userPresence,
        customStatus: state.customStatus,
        roomSections: state.roomSections,
        roomSectionOrder: state.roomSectionOrder,
        themeConfig: state.themeConfig,
        showUrlPreviews: state.showUrlPreviews,
        activeSpaceId: state.activeSpaceId,
        activeRoomId: state.activeRoomId,
        globalNotificationSettings: state.globalNotificationSettings,
        roomNotificationSettings: state.roomNotificationSettings,
      }),
    }
  )
);
