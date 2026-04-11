import { MatrixClient, TimelineWindow, Room } from 'matrix-js-sdk';

/**
 * Manages TimelineWindow instances for rooms to provide in-memory caching
 * of messages during a session.
 */
class TimelineManager {
  private windows = new Map<string, TimelineWindow>();
  private loadedRooms = new Set<string>();

  /**
   * Gets or creates a TimelineWindow for a specific room.
   */
  getOrCreateWindow(client: MatrixClient, room: Room): TimelineWindow {
    const roomId = room.roomId;
    if (this.windows.has(roomId)) {
      return this.windows.get(roomId)!;
    }

    const window = new TimelineWindow(client, room.getUnfilteredTimelineSet(), {
      windowLimit: 1000
    });
    this.windows.set(roomId, window);
    return window;
  }

  /**
   * Marks a room as having its timeline loaded.
   */
  markLoaded(roomId: string) {
    this.loadedRooms.add(roomId);
  }

  /**
   * Checks if a room has been loaded in this session.
   */
  isLoaded(roomId: string): boolean {
    return this.loadedRooms.has(roomId);
  }

  /**
   * Clears the cache for all rooms or a specific room.
   */
  clearCache(roomId?: string) {
    if (roomId) {
      this.windows.delete(roomId);
      this.loadedRooms.delete(roomId);
    } else {
      this.windows.clear();
      this.loadedRooms.clear();
    }
  }
}

export const timelineManager = new TimelineManager();
