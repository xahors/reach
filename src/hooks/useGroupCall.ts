import { useEffect, useState, useCallback } from 'react';
import { RoomStateEvent } from 'matrix-js-sdk';
import { GroupCallEvent, GroupCallState, type GroupCall } from 'matrix-js-sdk/lib/webrtc/groupCall';
import { useMatrixClient } from './useMatrixClient';

interface CallMemberSession {
  membership: string;
}

export const useGroupCall = (roomId: string | null) => {
  const client = useMatrixClient();
  const [hasGroupCall, setHasGroupCall] = useState(false);
  const [participantCount, setParticipantCount] = useState(0);
  const [groupCall, setGroupCall] = useState<GroupCall | null>(null);

  const checkGroupCall = useCallback(() => {
    if (!client || !roomId) return;
    const room = client.getRoom(roomId);
    if (!room) return;

    // Look for m.call.member events to count active participants
    const memberEvents = room.currentState.getStateEvents('m.call.member');
    const activeParticipants = memberEvents.filter(ev => {
      const content = ev.getContent();
      return content && content.members && Array.isArray(content.members) && 
             content.members.some((m: CallMemberSession) => m.membership !== 'leave');
    });

    const sdkGroupCall = client.getGroupCallForRoom(roomId);
    
    // A call is "active" if there are participants OR we are currently in it
    const isJoined = sdkGroupCall && (
      sdkGroupCall.state === GroupCallState.Entered || 
      sdkGroupCall.state === GroupCallState.InitializingLocalCallFeed
    );
    
    const count = activeParticipants.length;
    const active = count > 0 || isJoined;

    setHasGroupCall(!!active);
    setParticipantCount(count);
    setGroupCall(sdkGroupCall || null);
  }, [client, roomId]);

  useEffect(() => {
    if (!client || !roomId) {
      Promise.resolve().then(() => {
        setHasGroupCall(false);
        setParticipantCount(0);
        setGroupCall(null);
      });
      return;
    }

    Promise.resolve().then(() => checkGroupCall());

    const onStateEvent = () => checkGroupCall();
    client.on(RoomStateEvent.Events, onStateEvent);

    // Also listen for SDK-level group call state changes
    const sdkGroupCall = client.getGroupCallForRoom(roomId);
    if (sdkGroupCall) {
      sdkGroupCall.on(GroupCallEvent.GroupCallStateChanged, checkGroupCall);
    }

    return () => {
      client.removeListener(RoomStateEvent.Events, onStateEvent);
      if (sdkGroupCall) {
        sdkGroupCall.removeListener(GroupCallEvent.GroupCallStateChanged, checkGroupCall);
      }
    };
  }, [client, roomId, checkGroupCall]);

  return { hasGroupCall, participantCount, isCallActive: hasGroupCall, groupCall };
};
