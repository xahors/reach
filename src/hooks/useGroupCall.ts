import { useEffect, useState, useCallback } from 'react';
import { RoomStateEvent } from 'matrix-js-sdk';
import { GroupCallEvent, GroupCallState, type GroupCall } from 'matrix-js-sdk/lib/webrtc/groupCall';
import { useMatrixClient } from './useMatrixClient';

interface LegacyCallDevice {
  device_id: string;
}

interface LegacyCallEntry {
  'm.call_id': string;
  'm.devices': LegacyCallDevice[];
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

    const sdkGroupCall = client.getGroupCallForRoom(roomId);
    
    // If the SDK group call object is in ENDED state, it shouldn't be considered active
    if (sdkGroupCall && sdkGroupCall.state === GroupCallState.Ended) {
      setHasGroupCall(false);
      setParticipantCount(0);
      setGroupCall(null);
      return;
    }

    // Count active participants from m.call.member state events
    const memberEvents = [
      ...room.currentState.getStateEvents('m.call.member'),
      ...room.currentState.getStateEvents('org.matrix.msc3401.call.member'),
    ];

    const myUserId = client.getUserId();
    const activeParticipants = memberEvents.filter(ev => {
      const content = ev.getContent();
      const userId = ev.getStateKey();
      
      // If the only participant is ME and I'm not in the call, ignore it.
      // This prevents ghost sessions from keeping the JOIN button active.
      const isLocallyJoined = !!sdkGroupCall && (
        sdkGroupCall.state === GroupCallState.Entered ||
        sdkGroupCall.state === GroupCallState.InitializingLocalCallFeed
      );
      if (userId === myUserId && !isLocallyJoined) return false;

      // If there's an associated m.call event, ensure it exists and isn't ended/deleted
      if (content?.call_id) {
         const callEvent = room.currentState.getStateEvents('m.call', content.call_id) || 
                          room.currentState.getStateEvents('org.matrix.msc3401.call', content.call_id);
         if (!callEvent || callEvent.isRedacted()) return false;
      }

      // Zombie Filter: if a participant has been "active" alone for more than 10 mins 
      // without a sync update, they are likely a ghost.
      const eventAge = Date.now() - ev.getTs();
      if (eventAge > 10 * 60 * 1000) return false;

      // MSC3401 style: members array with membership field
      if (Array.isArray(content?.members)) {
        return content.members.some((m: { membership?: string }) => m.membership !== 'leave');
      }
      // MSC3401 alternate: memberships array
      if (Array.isArray(content?.memberships)) {
        return content.memberships.some((m: { membership?: string }) => m.membership === 'join');
      }
      // Legacy m.call.member: non-empty m.devices array means the user has active sessions
      if (Array.isArray(content?.['m.calls'])) {
        return (content['m.calls'] as LegacyCallEntry[]).some(
          call => Array.isArray(call['m.devices']) && call['m.devices'].length > 0
        );
      }
      return false;
    });

    const uniqueUserIds = new Set(activeParticipants.map(ev => ev.getStateKey()));
    let count = uniqueUserIds.size;

    // SDK participant tracking is authoritative when available
    if (sdkGroupCall?.participants) {
      count = Math.max(count, sdkGroupCall.participants.size);
    }

    // The local user's in-call state (initializing or fully entered) also counts
    // as active — this ensures the call UI stays visible before feeds start
    const isLocallyJoined = !!sdkGroupCall && (
      sdkGroupCall.state === GroupCallState.Entered ||
      sdkGroupCall.state === GroupCallState.InitializingLocalCallFeed
    );

    setHasGroupCall(count > 0 || isLocallyJoined);
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

    // Re-check whenever any room state event arrives (m.call, m.call.member, etc.)
    const onStateEvent = () => checkGroupCall();
    client.on(RoomStateEvent.Events, onStateEvent);

    return () => {
      client.removeListener(RoomStateEvent.Events, onStateEvent);
    };
  }, [client, roomId, checkGroupCall]);

  // Separate effect for SDK-level call state listeners to prevent leaks during re-renders
  useEffect(() => {
    if (!client || !roomId) return;
    
    const sdkGroupCall = client.getGroupCallForRoom(roomId);
    if (!sdkGroupCall) return;

    sdkGroupCall.on(GroupCallEvent.GroupCallStateChanged, checkGroupCall);
    sdkGroupCall.on(GroupCallEvent.ParticipantsChanged, checkGroupCall);

    return () => {
      sdkGroupCall.removeListener(GroupCallEvent.GroupCallStateChanged, checkGroupCall);
      sdkGroupCall.removeListener(GroupCallEvent.ParticipantsChanged, checkGroupCall);
    };
  }, [client, roomId, checkGroupCall, groupCall]); // depends on groupCall instance

  return { hasGroupCall, participantCount, isCallActive: hasGroupCall, groupCall };
};
