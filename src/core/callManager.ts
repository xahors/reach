import { CallEvent, type MatrixCall } from 'matrix-js-sdk';
import { CallErrorCode } from 'matrix-js-sdk/lib/webrtc/call';
import { CallEventHandlerEvent } from 'matrix-js-sdk/lib/webrtc/callEventHandler';
import { matrixService } from './matrix';
import { useAppStore } from '../store/useAppStore';

class CallManager {
  private currentCall: MatrixCall | null = null;

  init() {
    const client = matrixService.getClient();
    if (!client) return;

    // In matrix-js-sdk v41, CallEvent.Incoming was renamed/moved.
    client.on(CallEventHandlerEvent.Incoming, (call: MatrixCall) => {
      console.log('Incoming call...', call);
      // If we are already in a call, reject the new one
      if (this.currentCall) {
        call.reject();
        return;
      }

      this.currentCall = call;
      useAppStore.getState().setIncomingCall(call);

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
      });

      // Handle remote mute changes
      call.on(CallEvent.RemoteHoldUnhold, () => {
        // Just refresh UI state if needed
      });
    });
  }

  async placeCall(roomId: string, type: 'voice' | 'video') {
    const client = matrixService.getClient();
    if (!client) return;

    try {
      const call = client.createCall(roomId);
      if (!call) throw new Error("Failed to create call");

      this.currentCall = call;
      useAppStore.getState().setActiveCall(call);

      // Set initial mute states based on type
      if (type === 'voice') {
        useAppStore.getState().setCameraOff(true);
      } else {
        useAppStore.getState().setCameraOff(false);
      }

      call.on(CallEvent.Hangup, () => {
        this.clearCall();
      });
      call.on(CallEvent.Error, (err) => {
        console.error('Call error', err);
        this.clearCall();
      });

      // Second param 'video' determines if the initial getUserMedia includes video.
      // If false, camera permission is only asked later when setLocalVideoMuted(false) is called.
      await call.placeCall(true, type === 'video');
    } catch (err) {
      console.error('Error placing call:', err);
      this.clearCall();
    }
  }

  acceptCall() {
    if (this.currentCall) {
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
    }
  }

  private playFeedbackSound(type: 'mute' | 'unmute') {
    try {
      const AudioContextClass = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
      const context = new AudioContextClass();
      
      if (context.state === 'suspended') {
        context.resume();
      }

      const oscillator = context.createOscillator();
      const gain = context.createGain();

      oscillator.type = 'sine';
      // Mute: Higher to Lower, Unmute: Lower to Higher
      const startFreq = type === 'mute' ? 600 : 400;
      const endFreq = type === 'mute' ? 400 : 600;

      oscillator.frequency.setValueAtTime(startFreq, context.currentTime);
      oscillator.frequency.exponentialRampToValueAtTime(endFreq, context.currentTime + 0.1);

      gain.gain.setValueAtTime(0.1, context.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.01, context.currentTime + 0.1);

      oscillator.connect(gain);
      gain.connect(context.destination);

      oscillator.start();
      oscillator.stop(context.currentTime + 0.1);
      
      // Close context after sound finished
      setTimeout(() => context.close(), 200);
    } catch (e) {
      console.warn('Audio feedback failed', e);
    }
  }

  setMuted(muted: boolean) {
    if (this.currentCall) {
      this.currentCall.setMicrophoneMuted(muted);
      this.playFeedbackSound(muted ? 'mute' : 'unmute');
    }
  }

  setVideoMuted(muted: boolean) {
    if (this.currentCall) {
      // If we are unmuting video, ensure we have a stream with video
      if (!muted && !this.currentCall.hasLocalUserMediaVideoTrack) {
        console.log("Upgrading call to include video...");
        this.currentCall.setLocalVideoMuted(false);
      } else {
        this.currentCall.setLocalVideoMuted(muted);
      }
      this.playFeedbackSound(muted ? 'mute' : 'unmute');
    }
  }

  isMicrophoneMuted(): boolean {
    return this.currentCall?.isMicrophoneMuted() ?? false;
  }

  isLocalVideoMuted(): boolean {
    return this.currentCall?.isLocalVideoMuted() ?? false;
  }

  private clearCall() {
    this.currentCall = null;
    useAppStore.getState().setActiveCall(null);
    useAppStore.getState().setIncomingCall(null);
  }
}

export const callManager = new CallManager();
