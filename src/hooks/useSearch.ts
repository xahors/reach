import { useState, useCallback } from 'react';
import { useMatrixClient } from './useMatrixClient';
import { useAppStore } from '../store/useAppStore';
import { MatrixEvent, SearchOrderBy, EventType, Direction } from 'matrix-js-sdk';

export interface SearchResult {
  event: MatrixEvent;
  roomName: string;
  context?: string;
}

export interface SearchFilters {
  user?: string;
  room?: string;
  date?: Date;
  text?: string;
}

export const useSearch = () => {
  const client = useMatrixClient();
  const { activeRoomId } = useAppStore();
  const [results, setResults] = useState<SearchResult[]>([]);
  const [isSearching, setIsSearching] = useState(false);

  const parseQuery = (query: string): SearchFilters => {
    const filters: SearchFilters = {};
    const textWords: string[] = [];
    const regex = /(\w+):\s*("[^"]+"|[^\s]+)/g;
    let match;
    let lastIndex = 0;

    while ((match = regex.exec(query)) !== null) {
      const key = match[1].toLowerCase();
      const value = match[2].replace(/"/g, '');
      const beforeMatch = query.substring(lastIndex, match.index).trim();
      if (beforeMatch) textWords.push(...beforeMatch.split(/\s+/));

      if (key === 'user') filters.user = value.toLowerCase();
      else if (key === 'room') filters.room = value.toLowerCase();
      else if (key === 'date') {
        const date = new Date(value);
        if (!isNaN(date.getTime())) filters.date = date;
        else textWords.push(match[0]);
      } else textWords.push(match[0]);
      
      lastIndex = regex.lastIndex;
    }

    const remaining = query.substring(lastIndex).trim();
    if (remaining) textWords.push(...remaining.split(/\s+/));
    if (textWords.length > 0) filters.text = textWords.join(' ');
    return filters;
  };

  const performSearch = useCallback(async (query: string) => {
    if (!client || !query.trim()) {
      setResults([]);
      return;
    }

    setIsSearching(true);
    const filters = parseQuery(query);
    const matchesMap = new Map<string, SearchResult>();

    try {
      // 1. GLOBAL SERVER SEARCH (via /search endpoint)
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const filterObj: any = {};
      if (filters.room) {
        const targetRoom = client.getRooms().find(r => 
          r.name.toLowerCase().includes(filters.room!) || 
          r.roomId.toLowerCase().includes(filters.room!)
        );
        if (targetRoom) filterObj.rooms = [targetRoom.roomId];
      }

      if (filters.user) {
        if (filters.user.startsWith('@')) {
           filterObj.senders = [filters.user];
        } else {
           const user = client.getUsers().find(u => u.displayName?.toLowerCase().includes(filters.user!));
           if (user) filterObj.senders = [user.userId];
           else filterObj.senders = [filters.user.startsWith('@') ? filters.user : `@${filters.user}:${client.getDomain()}`];
        }
      }

      const searchParams = {
        body: {
          search_categories: {
            room_events: {
              search_term: filters.text || '',
              order_by: SearchOrderBy.Recent,
              event_context: { before_limit: 1, after_limit: 1, include_profile: true },
              filter: filterObj
            }
          }
        }
      };

      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const response = await client.search(searchParams as any);
      const searchResults = response.search_categories.room_events.results || [];

      for (const res of searchResults) {
        const rawEvent = res.result;
        if (!rawEvent) continue;
        const event = client.getEventMapper()(rawEvent);
        const roomId = event.getRoomId();
        if (!roomId) continue;
        const room = client.getRoom(roomId);
        if (!room) continue;

        if (event.isEncrypted() && !event.getContent().body) {
          await client.decryptEventIfNeeded(event).catch(() => {});
        }

        const type = event.getType();
        if (type !== EventType.RoomMessage && type !== EventType.Sticker) continue;

        const content = event.getContent();
        if (filters.text && !content.body?.toLowerCase().includes(filters.text.toLowerCase())) continue;

        matchesMap.set(event.getId()!, {
          event,
          roomName: room.name,
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          context: (res.context?.events_before?.[0] as any)?.content?.body
        });
      }

      // 2. DEEP E2EE HISTORY FETCH (via /messages endpoint)
      // If we are in a room, or if a room was filtered, pull historical messages to search locally
      const targetRoomIds = filters.room ? [filterObj.rooms?.[0]] : [activeRoomId];
      
      for (const rid of targetRoomIds) {
        if (!rid) continue;
        const room = client.getRoom(rid);
        if (!room) continue;

        // Fetch up to 200 historical messages from the server
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const history: any = await client.createMessagesRequest(rid, room.getLiveTimeline().getPaginationToken(Direction.Backward), 200, Direction.Backward);
        
        for (const rawEvent of history.chunk) {
          const event = client.getEventMapper()(rawEvent);
          if (event.getType() !== EventType.RoomMessage && !event.isEncrypted()) continue;
          if (matchesMap.has(event.getId()!)) continue;

          if (event.isEncrypted()) {
            await client.decryptEventIfNeeded(event).catch(() => {});
          }

          const content = event.getClearContent() || event.getContent();
          const body = content?.body || '';
          
          let isMatch = true;
          if (filters.text && !body.toLowerCase().includes(filters.text.toLowerCase())) isMatch = false;
          if (isMatch && filters.user) {
            const sender = event.getSender();
            const senderName = event.sender?.name?.toLowerCase();
            if (!sender?.toLowerCase().includes(filters.user) && !senderName?.includes(filters.user)) isMatch = false;
          }

          if (isMatch) {
            matchesMap.set(event.getId()!, {
              event,
              roomName: room.name
            });
          }
        }
      }

    } catch (e) {
      console.error("Historical server search failed:", e);
    }

    const finalResults = Array.from(matchesMap.values())
      .sort((a, b) => b.event.getTs() - a.event.getTs());

    setResults(finalResults);
    setIsSearching(false);
  }, [client, activeRoomId]);

  return { results, isSearching, performSearch };
};
