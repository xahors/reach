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

    // Count active participants from m.call.member state events
    const memberEvents = [
      ...room.currentState.getStateEvents('m.call.member'),
      ...room.currentState.getStateEvents('org.matrix.msc3401.call.member'),
    ];

    const activeParticipants = memberEvents.filter(ev => {
      const content = ev.getContent();
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

    // Also track SDK-level state changes on any existing call
    const sdkGroupCall = client.getGroupCallForRoom(roomId);
    if (sdkGroupCall) {
      sdkGroupCall.on(GroupCallEvent.GroupCallStateChanged, checkGroupCall);
      sdkGroupCall.on(GroupCallEvent.ParticipantsChanged, checkGroupCall);
    }

    return () => {
      client.removeListener(RoomStateEvent.Events, onStateEvent);
      if (sdkGroupCall) {
        sdkGroupCall.removeListener(GroupCallEvent.GroupCallStateChanged, checkGroupCall);
        sdkGroupCall.removeListener(GroupCallEvent.ParticipantsChanged, checkGroupCall);
      }
    };
  }, [client, roomId, checkGroupCall]);

  return { hasGroupCall, participantCount, isCallActive: hasGroupCall, groupCall };
};
