import { CallEvent, type MatrixCall } from 'matrix-js-sdk';
import { CallErrorCode } from 'matrix-js-sdk/lib/webrtc/call';
import { CallEventHandlerEvent } from 'matrix-js-sdk/lib/webrtc/callEventHandler';
import { matrixService } from './matrix';
import { useAppStore } from '../store/useAppStore';

class CallManager {
  private currentCall: MatrixCall | null = null;
  private audioContext: AudioContext | null = null;

  init() {
    const client = matrixService.getClient();
    if (!client) return;

    client.on(CallEventHandlerEvent.Incoming, (call: MatrixCall) => {
      console.log('Incoming call...', call);
      if (this.currentCall) {
        call.reject();
        return;
      }

      this.currentCall = call;
      useAppStore.getState().setIncomingCall(call);
      this.setupCallListeners(call);
    });
  }

  // Call this on ANY user interaction to unblock audio beeps
  warmupAudioContext() {
    try {
      if (!this.audioContext) {
        const AudioContextClass = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
        this.audioContext = new AudioContextClass();
      }
      if (this.audioContext.state === 'suspended') {
        this.audioContext.resume();
      }
    } catch (e) {
      console.warn('Audio warmup failed', e);
    }
  }

  private setupCallListeners(call: MatrixCall) {
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
  }

  private playFeedbackSound(type: 'mute' | 'unmute' | 'connect' | 'place') {
    this.warmupAudioContext();
    if (!this.audioContext) return;

    try {
      const oscillator = this.audioContext.createOscillator();
      const gain = this.audioContext.createGain();

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
        startFreq = 523.25; // C5
        endFreq = 783.99; // G5
        duration = 0.2;
      } else if (type === 'place') {
        startFreq = 392.00; // G4
        endFreq = 523.25; // C5
        duration = 0.15;
      }

      const now = this.audioContext.currentTime;
      oscillator.frequency.setValueAtTime(startFreq, now);
      oscillator.frequency.exponentialRampToValueAtTime(endFreq, now + duration);

      gain.gain.setValueAtTime(0.15, now);
      gain.gain.exponentialRampToValueAtTime(0.001, now + duration);

      oscillator.connect(gain);
      gain.connect(this.audioContext.destination);

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
      
      if (type === 'voice') {
        useAppStore.getState().setCameraOff(true);
      } else {
        useAppStore.getState().setCameraOff(false);
      }

      this.setupCallListeners(call);
      
      // Request audio immediately. If video, also request video.
      await call.placeCall(true, type === 'video');
    } catch (err) {
      console.error('Error placing call:', err);
      this.clearCall();
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
      // In JS SDK, unmuting video when no track exists might not trigger permission.
      // Explicitly check and use setLocalVideoMuted.
      this.currentCall.setLocalVideoMuted(muted);
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
