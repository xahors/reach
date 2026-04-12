import { MatrixEvent } from 'matrix-js-sdk';
import { useAppStore } from '../store/useAppStore';

class NotificationService {
  private hasPermission: boolean = false;

  constructor() {
    if (typeof window !== 'undefined' && 'Notification' in window) {
      this.hasPermission = Notification.permission === 'granted';
    }
  }

  async requestPermission(): Promise<boolean> {
    if (typeof window === 'undefined' || !('Notification' in window)) return false;
    
    const permission = await Notification.requestPermission();
    this.hasPermission = permission === 'granted';
    return this.hasPermission;
  }

  showNotification(title: string, options?: NotificationOptions) {
    const { globalNotificationSettings, userPresence } = useAppStore.getState();
    
    // Check global toggle
    if (!globalNotificationSettings.enabled || !globalNotificationSettings.desktopEnabled) return;
    
    // Check DND
    if (userPresence === 'dnd') return;

    if (this.hasPermission) {
      const notification = new Notification(title, {
        icon: '/favicon.svg', // Fallback icon
        ...options
      });

      notification.onclick = () => {
        window.focus();
        notification.close();
      };
    }
  }

  async notifyEvent(event: MatrixEvent, roomName: string) {
    const { userId, globalNotificationSettings, roomNotificationSettings } = useAppStore.getState();
    
    // Don't notify for our own events
    if (event.getSender() === userId) return;

    const roomId = event.getRoomId();
    if (!roomId) return;

    const roomSetting = roomNotificationSettings[roomId] || 'all';
    
    if (roomSetting === 'mute') return;

    const content = event.getContent();
    const body = content.body || 'New message';
    const senderName = event.sender?.name || event.getSender() || 'Someone';

    const isMention = body.includes(userId || ''); // Very basic mention check
    
    if (roomSetting === 'mentions' && !isMention) return;
    if (globalNotificationSettings.mentionsOnly && !isMention) return;

    this.showNotification(`${senderName} in #${roomName}`, {
      body: body,
      tag: roomId, // Overwrite notifications from same room
    });

    if (globalNotificationSettings.soundEnabled) {
      this.playSound();
    }
  }

  private playSound() {
    // Basic notification sound
    const audio = new Audio('https://assets.mixkit.co/active_storage/sfx/2358/2358-preview.mp3');
    audio.play().catch(e => console.warn("Failed to play notification sound:", e));
  }
}

export const notificationService = new NotificationService();
