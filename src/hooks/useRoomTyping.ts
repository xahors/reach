import { useState, useEffect, useCallback } from 'react';
import { RoomMember, RoomEvent, ClientEvent } from 'matrix-js-sdk';
import { useMatrixClient } from './useMatrixClient';

export const useRoomTyping = (roomId: string | null) => {
  const client = useMatrixClient();
  const [typingUsers, setTypingUsers] = useState<string[]>([]);

  const updateTyping = useCallback(() => {
    if (!client || !roomId) {
      setTypingUsers([]);
      return;
    }

    const room = client.getRoom(roomId);
    if (!room) return;

    const myUserId = client.getUserId();
    const members = room.getMembers();
    
    const otherTypingUsers = members
      .filter((member: RoomMember) => member.userId !== myUserId && member.typing)
      .map((member: RoomMember) => member.name || member.userId);

    setTypingUsers(otherTypingUsers);
  }, [client, roomId]);

  useEffect(() => {
    if (!client || !roomId) return;

    const room = client.getRoom(roomId);
    if (!room) return;

    // Use a small timeout to avoid setState during effect body
    const timeout = setTimeout(() => updateTyping(), 0);

    const onTyping = () => updateTyping();

    // Listen for typing events in this room
    room.on(RoomEvent.MyMembership, onTyping); 
    
    // Typing events are emitted on the client in the current SDK version
    // @ts-expect-error: RoomMemberTyping is the correct event but types might vary
    client.on(ClientEvent.RoomMemberTyping, (event: unknown, member: RoomMember) => {
      if (member.roomId === roomId) {
        onTyping();
      }
    });

    return () => {
      clearTimeout(timeout);
      // @ts-expect-error: RoomMemberTyping is the correct event but types might vary
      client.removeListener(ClientEvent.RoomMemberTyping, onTyping);
      room.removeListener(RoomEvent.MyMembership, onTyping);
    };
  }, [client, roomId, updateTyping]);

  return typingUsers;
};
