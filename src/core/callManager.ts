import { CallEvent, type MatrixCall } from 'matrix-js-sdk';
import { GroupCallEvent, GroupCallType, GroupCallIntent, GroupCallState, type GroupCall } from 'matrix-js-sdk/lib/webrtc/groupCall';
import { CallErrorCode } from 'matrix-js-sdk/lib/webrtc/call';
import { CallEventHandlerEvent } from 'matrix-js-sdk/lib/webrtc/callEventHandler';
import { matrixService } from './matrix';
import { useAppStore } from '../store/useAppStore';

interface LegacyCallDevice {
  device_id: string;
}

interface LegacyCallEntry {
  'm.call_id': string;
  'm.devices': LegacyCallDevice[];
}

class CallManager {
  private currentCall: MatrixCall | null = null;
  private currentGroupCall: GroupCall | null = null;
  private audioContext: AudioContext | null = null;

  async init() {
    const client = matrixService.getClient();
    if (!client) return;

    client.on(CallEventHandlerEvent.Incoming, (call: MatrixCall) => {
      console.log('Incoming private call...', call);
      if (this.currentCall || this.currentGroupCall) {
        call.reject();
        return;
      }

      this.currentCall = call;
      useAppStore.getState().setIncomingCall(call);
      this.setupCallListeners(call);
    });
  }

  warmupAudioContext() {
    this.warmupAndGetContext();
  }

  private warmupAndGetContext(): AudioContext | null {
    try {
      if (!this.audioContext) {
        const AudioContextClass = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
        this.audioContext = new AudioContextClass();
      }
      if (this.audioContext.state === 'suspended') {
        this.audioContext.resume().catch(console.warn);
      }
      return this.audioContext;
    } catch (e) {
      console.warn('Audio Context error', e);
      return null;
    }
  }

  private setupCallListeners(call: MatrixCall) {
    const updateFeeds = () => {
      useAppStore.getState().setCallFeeds([...call.getFeeds()]);
    };

    call.on(CallEvent.Hangup, () => {
      this.clearCall();
    });
    call.on(CallEvent.Error, (err) => {
      console.error('Call error', err);
      this.clearCall();
    });
    call.on(CallEvent.Replaced, (newCall: MatrixCall) => {
      this.currentCall = newCall;
      useAppStore.getState().setActiveCall(newCall);
      this.setupCallListeners(newCall);
    });
    call.on(CallEvent.State, (state) => {
      console.log(`Call state: ${state}`);
      if (state === 'connected') {
        this.playFeedbackSound('connect');
      }
    });
    call.on(CallEvent.FeedsChanged, updateFeeds);
    // @ts-expect-error - internal event
    call.on('local_screenshare_state_changed', updateFeeds);
    updateFeeds();
  }

  private setupGroupCallListeners(groupCall: GroupCall) {
    const updateFeeds = () => {
      const allFeeds = [...groupCall.userMediaFeeds, ...groupCall.screenshareFeeds];
      useAppStore.getState().setCallFeeds(allFeeds);
    };

    groupCall.on(GroupCallEvent.UserMediaFeedsChanged, updateFeeds);
    groupCall.on(GroupCallEvent.ScreenshareFeedsChanged, updateFeeds);
    groupCall.on(GroupCallEvent.ParticipantsChanged, updateFeeds);
    groupCall.on(GroupCallEvent.GroupCallStateChanged, (state) => {
       console.log(`Group call state: ${state}`);
       if (state === GroupCallState.Entered) {
          this.playFeedbackSound('connect');
       } else if (state === GroupCallState.Ended) {
          this.clearGroupCall();
       }
    });

    // @ts-expect-error - internal event
    groupCall.on('local_screenshare_state_changed', updateFeeds);
    groupCall.on(GroupCallEvent.LocalMuteStateChanged, () => {
       useAppStore.getState().setMuted(groupCall.isMicrophoneMuted());
       useAppStore.getState().setCameraOff(groupCall.isLocalVideoMuted());
    });

    updateFeeds();
  }

  private playFeedbackSound(type: 'mute' | 'unmute' | 'connect' | 'place') {
    const context = this.warmupAndGetContext();
    if (!context) return;

    try {
      const oscillator = context.createOscillator();
      const gain = context.createGain();
      oscillator.type = 'sine';
      
      let startFreq = 440;
      let endFreq = 880;
      let duration = 0.12;

      if (type === 'mute') {
        startFreq = 660;
        endFreq = 440;
      } else if (type === 'unmute') {
        startFreq = 440;
        endFreq = 660;
      } else if (type === 'connect') {
        startFreq = 523.25;
        endFreq = 783.99;
        duration = 0.2;
      } else if (type === 'place') {
        startFreq = 392.00;
        endFreq = 523.25;
        duration = 0.15;
      }

      const now = context.currentTime;
      oscillator.frequency.setValueAtTime(startFreq, now);
      oscillator.frequency.exponentialRampToValueAtTime(endFreq, now + duration);
      gain.gain.setValueAtTime(0.15, now);
      gain.gain.exponentialRampToValueAtTime(0.001, now + duration);
      oscillator.connect(gain);
      gain.connect(context.destination);
      oscillator.start(now);
      oscillator.stop(now + duration);
    } catch (e) {
      console.warn('Feedback sound failed', e);
    }
  }

  async placeCall(roomId: string, type: 'voice' | 'video') {
    const client = matrixService.getClient();
    if (!client) return;
    this.playFeedbackSound('place');
    try {
      const call = client.createCall(roomId);
      if (!call) throw new Error("Failed to create call");
      this.currentCall = call;
      useAppStore.getState().setActiveCall(call);
      useAppStore.getState().setCameraOff(type === 'voice');
      this.setupCallListeners(call);
      await call.placeCall(true, type === 'video');
    } catch (err) {
      console.error('Error placing call:', err);
      this.clearCall();
    }
  }

  async enterGroupCall(roomId: string, type: 'voice' | 'video') {
    const client = matrixService.getClient();
    if (!client) return;
    this.playFeedbackSound('place');
    try {
      let groupCall = client.getGroupCallForRoom(roomId);
      
      const room = client.getRoom(roomId);
      let isCallEmpty = true;
      if (groupCall && room) {
        const memberEvents = [
          ...room.currentState.getStateEvents('m.call.member'),
          ...room.currentState.getStateEvents('org.matrix.msc3401.call.member'),
        ];
        
        isCallEmpty = !memberEvents.some(ev => {
          const content = ev.getContent();
          if (Array.isArray(content?.members)) {
            return content.members.some((m: { membership?: string }) => m.membership !== 'leave');
          }
          if (Array.isArray(content?.memberships)) {
            return content.memberships.some((m: { membership?: string }) => m.membership === 'join');
          }
          if (Array.isArray(content?.['m.calls'])) {
            return (content['m.calls'] as LegacyCallEntry[]).some(
              call => Array.isArray(call['m.devices']) && call['m.devices'].length > 0
            );
          }
          return false;
        });
      }

      if (!groupCall) {
        // Create a new group call — type Voice vs Video affects SFU/media negotiation
        const callType = type === 'video' ? GroupCallType.Video : GroupCallType.Voice;
        // Use Ring intent to ensure other clients are notified
        groupCall = await client.createGroupCall(roomId, callType, false, GroupCallIntent.Ring);
        // Sends the m.call state event, notifying other clients a call has started.
        await groupCall.create();
      } else if (isCallEmpty) {
        // If the call exists but is empty, ensure it's "created" (i.e. state event is active)
        // This helps if the call was stale or only existed locally.
        await groupCall.create();
      }

      // Only setup listeners and enter if this is a new call object or we aren't already tracking it
      if (this.currentGroupCall !== groupCall) {
        this.currentGroupCall = groupCall;
        useAppStore.getState().setActiveGroupCall(groupCall);
        useAppStore.getState().setCameraOff(type === 'voice');
        this.setupGroupCallListeners(groupCall);
      }
      
      // Only enter if we aren't already in the call
      if (groupCall.state !== GroupCallState.Entered) {
        await groupCall.enter();
      }
      
      if (type === 'voice') {
        await groupCall.setLocalVideoMuted(true);
      }
    } catch (err) {
      console.error('Error entering group call:', err);
      this.clearGroupCall();
    }
  }

  acceptCall() {
    if (this.currentCall) {
      this.playFeedbackSound('connect');
      this.currentCall.answer();
      useAppStore.getState().setActiveCall(this.currentCall);
      useAppStore.getState().setIncomingCall(null);
    }
  }

  rejectCall() {
    if (this.currentCall) {
      this.currentCall.reject();
      this.clearCall();
    }
  }

  hangupCall() {
    if (this.currentCall) {
      this.currentCall.hangup(CallErrorCode.UserHangup, false);
      this.clearCall();
    } else if (this.currentGroupCall) {
      this.currentGroupCall.leave();
      this.clearGroupCall();
    }
  }

  getContext(): AudioContext | null {
    return this.warmupAndGetContext();
  }

  setMuted(muted: boolean) {
    if (this.currentCall) {
      this.currentCall.setMicrophoneMuted(muted);
    } else if (this.currentGroupCall) {
      this.currentGroupCall.setMicrophoneMuted(muted);
    }
    this.playFeedbackSound(muted ? 'mute' : 'unmute');
  }

  async setVideoMuted(muted: boolean) {
    if (this.currentCall) {
      await this.currentCall.setLocalVideoMuted(muted);
    } else if (this.currentGroupCall) {
      await this.currentGroupCall.setLocalVideoMuted(muted);
    }
    this.playFeedbackSound(muted ? 'mute' : 'unmute');
  }

  async setScreensharingEnabled(enabled: boolean) {
    if (this.currentCall) {
      await this.currentCall.setScreensharingEnabled(enabled);
    } else if (this.currentGroupCall) {
      await this.currentGroupCall.setScreensharingEnabled(enabled);
    }
    this.playFeedbackSound(enabled ? 'unmute' : 'mute');
  }

  async getDevices() {
    try {
      const devices = await navigator.mediaDevices.enumerateDevices();
      return {
        audioIn: devices.filter(d => d.kind === 'audioinput'),
        videoIn: devices.filter(d => d.kind === 'videoinput'),
        audioOut: devices.filter(d => d.kind === 'audiooutput'),
      };
    } catch (e) {
      console.warn('Failed to enumerate devices', e);
      return { audioIn: [], videoIn: [], audioOut: [] };
    }
  }

  async setAudioInputDevice(deviceId: string) {
    if (this.currentCall) {
       // @ts-expect-error - internal SDK method
       await this.currentCall.setAudioInputDevice(deviceId);
    } else if (this.currentGroupCall) {
       // @ts-expect-error - internal SDK method
       await this.currentGroupCall.setAudioInputDevice(deviceId);
    }
  }

  async setVideoInputDevice(deviceId: string) {
    if (this.currentCall) {
       // @ts-expect-error - internal SDK method
       await this.currentCall.setVideoInputDevice(deviceId);
    } else if (this.currentGroupCall) {
       // @ts-expect-error - internal SDK method
       await this.currentGroupCall.setVideoInputDevice(deviceId);
    }
  }

  private clearCall() {
    this.currentCall = null;
    useAppStore.getState().setActiveCall(null);
    useAppStore.getState().setIncomingCall(null);
    useAppStore.getState().setCallFeeds([]);
  }

  private clearGroupCall() {
    this.currentGroupCall = null;
    useAppStore.getState().setActiveGroupCall(null);
    useAppStore.getState().setCallFeeds([]);
  }
}

export const callManager = new CallManager();
