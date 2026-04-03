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
      console.log(`Call state changed: ${state}`);
      if (state === 'connected') {
        this.playFeedbackSound('connect');
      }
    });
  }

  private getAudioContext(): AudioContext | null {
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
      console.warn('Failed to get AudioContext', e);
      return null;
    }
  }

  private playFeedbackSound(type: 'mute' | 'unmute' | 'connect' | 'place') {
    const context = this.getAudioContext();
    if (!context) return;

    try {
      const oscillator = context.createOscillator();
      const gain = context.createGain();

      oscillator.type = 'sine';
      
      let startFreq = 440;
      let endFreq = 880;
      let duration = 0.1;

      if (type === 'mute') {
        startFreq = 600;
        endFreq = 400;
      } else if (type === 'unmute') {
        startFreq = 400;
        endFreq = 600;
      } else if (type === 'connect') {
        startFreq = 500;
        endFreq = 900;
        duration = 0.2;
      } else if (type === 'place') {
        startFreq = 400;
        endFreq = 500;
        duration = 0.15;
      }

      const now = context.currentTime;
      oscillator.frequency.setValueAtTime(startFreq, now);
      oscillator.frequency.exponentialRampToValueAtTime(endFreq, now + duration);

      gain.gain.setValueAtTime(0.1, now);
      gain.gain.exponentialRampToValueAtTime(0.01, now + duration);

      oscillator.connect(gain);
      gain.connect(context.destination);

      oscillator.start(now);
      oscillator.stop(now + duration);
    } catch (e) {
      console.warn('Audio play failed', e);
    }
  }

  async placeCall(roomId: string, type: 'voice' | 'video') {
    const client = matrixService.getClient();
    if (!client) return;

    // Trigger sound on user gesture
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
      
      // Request initial permissions
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
      // If we are enabling video, but the call doesn't have a video track yet,
      // calling setLocalVideoMuted(false) should trigger the browser prompt.
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
