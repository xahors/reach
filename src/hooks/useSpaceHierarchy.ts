import { useState, useEffect, useCallback } from 'react';
import { useMatrixClient } from './useMatrixClient';

export interface HierarchyRoom {
  room_id: string;
  name?: string;
  topic?: string;
  avatar_url?: string;
  num_joined_members: number;
  canonical_alias?: string;
  join_rule?: string;
  world_readable: boolean;
  guest_can_join: boolean;
  room_type?: string;
}

export const useSpaceHierarchy = (spaceId: string | null) => {
  const client = useMatrixClient();
  const [rooms, setRooms] = useState<HierarchyRoom[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fetchHierarchy = useCallback(async () => {
    if (!client || !spaceId) {
      setRooms([]);
      return;
    }

    setLoading(true);
    setError(null);
    try {
      const response = await (client as any).getRoomHierarchy(spaceId, 50);
      setRooms(response.rooms || []);
    } catch (err: any) {
      console.error("Failed to fetch space hierarchy:", err);
      setError(err.message || "Failed to load rooms");
    } finally {
      setLoading(false);
    }
  }, [client, spaceId]);

  useEffect(() => {
    fetchHierarchy();
  }, [fetchHierarchy]);

  return { rooms, loading, error, refresh: fetchHierarchy };
};
