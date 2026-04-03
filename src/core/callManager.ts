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
      if (state === 'connected') {
        this.playFeedbackSound('connect');
      }
    });
  }

  private getAudioContext(): AudioContext | null {
    if (!this.audioContext) {
      try {
        const AudioContextClass = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
        this.audioContext = new AudioContextClass();
      } catch (e) {
        console.warn('Failed to create AudioContext', e);
      }
    }
    
    if (this.audioContext?.state === 'suspended') {
      this.audioContext.resume().catch(console.warn);
    }
    
    return this.audioContext;
  }

  private playFeedbackSound(type: 'mute' | 'unmute' | 'connect') {
    const context = this.getAudioContext();
    if (!context) return;

    try {
      const oscillator = context.createOscillator();
      const gain = context.createGain();

      oscillator.type = 'sine';
      
      let startFreq = 400;
      let endFreq = 600;
      let duration = 0.1;

      if (type === 'mute') {
        startFreq = 600;
        endFreq = 400;
      } else if (type === 'connect') {
        startFreq = 500;
        endFreq = 800;
        duration = 0.2;
      }

      oscillator.frequency.setValueAtTime(startFreq, context.currentTime);
      oscillator.frequency.exponentialRampToValueAtTime(endFreq, context.currentTime + duration);

      gain.gain.setValueAtTime(0.1, context.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.01, context.currentTime + duration);

      oscillator.connect(gain);
      gain.connect(context.destination);

      oscillator.start();
      oscillator.stop(context.currentTime + duration);
    } catch (e) {
      console.warn('Audio play failed', e);
    }
  }

  async placeCall(roomId: string, type: 'voice' | 'video') {
    const client = matrixService.getClient();
    if (!client) return;

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
      
      // Request permissions immediately for the chosen type
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

  setMuted(muted: boolean) {
    if (this.currentCall) {
      this.currentCall.setMicrophoneMuted(muted);
      this.playFeedbackSound(muted ? 'mute' : 'unmute');
    }
  }

  setVideoMuted(muted: boolean) {
    if (this.currentCall) {
      // In JS SDK, unmuting video when no track exists should trigger negotiation
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
