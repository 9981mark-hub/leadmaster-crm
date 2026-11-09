// ============================================
// Web Speech API & Google Cloud Neural2 Voice 음성 서비스 (2026-11-09)
// Google Cloud Text-to-Speech (Neural2 고음질) + 전화 수화기 필터 (Phone EQ) + Web Speech API (Fallback)
// ============================================

export interface SpeechVoiceOptions {
  pitch?: number; // Web Speech용 (0.9 ~ 1.1)
  rate?: number;  // Web Speech용 (1.0 ~ 1.5)
  gender?: 'male' | 'female';
  neuralVoice?: string; // Google Neural2/Wavenet Voice ID (예: ko-KR-Neural2-C, ko-KR-Neural2-A, ko-KR-Wavenet-C)
  neuralRate?: string;  // 속도 (예: +0%, +10%, +15%)
  neuralPitch?: string; // 피치 (예: +0Hz, -3Hz)
}

const VERCEL_TTS_ENDPOINT = 'https://leadmastercrm.vercel.app/api/tts';
const SUPABASE_TTS_ENDPOINT = 'https://cenksfblktflfurxjmtv.supabase.co/functions/v1/edge-tts';

class SpeechService {
  private synth: SpeechSynthesis | null = null;
  private recognition: any = null;
  private isListening = false;
  private currentAudio: HTMLAudioElement | null = null;
  private audioCtx: AudioContext | null = null;
  private mediaSourceNode: MediaElementAudioSourceNode | null = null;
  private useNeuralVoice = true; // 기본적으로 고음질 Neural Voice 사용
  private usePhoneFilter = true; // 실제 전화 통화 수화기 음질 필터 (300Hz ~ 3400Hz Bandpass)
  public lastEngineUsed: 'neural' | 'browser' = 'neural';
  public lastActivationUrl: string | null = null;

  constructor() {
    if (typeof window !== 'undefined' && 'speechSynthesis' in window) {
      this.synth = window.speechSynthesis;
    }
  }

  // Neural Voice 활성화 여부 설정/조회
  public setUseNeuralVoice(enable: boolean): void {
    this.useNeuralVoice = enable;
  }

  public getUseNeuralVoice(): boolean {
    return this.useNeuralVoice;
  }

  // 전화 수화기 필터 활성화 여부 설정/조회
  public setUsePhoneFilter(enable: boolean): void {
    this.usePhoneFilter = enable;
  }

  public getUsePhoneFilter(): boolean {
    return this.usePhoneFilter;
  }

  // 사용 가능한 한국어 브라우저 음성 목록
  public getKoreanVoices(): SpeechSynthesisVoice[] {
    if (!this.synth) return [];
    const voices = this.synth.getVoices();
    return voices.filter(v => v.lang.startsWith('ko') || v.lang === 'ko_KR');
  }

  // 통합 발화 메서드 (Neural Voice 우선 시도 -> 실패 시 브라우저 Web Speech로 자동 Fallback)
  public async speak(text: string, options: SpeechVoiceOptions = {}): Promise<'neural' | 'browser'> {
    this.stopSpeaking();

    if (this.useNeuralVoice) {
      try {
        const success = await this.speakNeural(text, options);
        if (success) {
          this.lastEngineUsed = 'neural';
          return 'neural';
        }
      } catch (e) {
        console.warn('Neural voice playback failed, falling back to Web Speech API:', e);
      }
    }

    this.lastEngineUsed = 'browser';
    await this.speakBrowser(text, options);
    return 'browser';
  }

  // Google Cloud Neural2 Voice 재생 (고음질 사람 통화 음질)
  public async speakNeural(text: string, options: SpeechVoiceOptions = {}): Promise<boolean> {
    const cleanText = text
      .replace(/[\(\[\{][^\)\]\}]*[\)\]\}]/g, '')
      .replace(/[\.\.\.~"']/g, ' ')
      .replace(/^(네|아|예|저|음|여보세요),/g, '$1')
      .replace(/,\s*,/g, ',')
      .replace(/\s+/g, ' ')
      .trim();

    if (!cleanText) return true;

    // 보이스 기본값: 성별 기반 또는 남성(Neural2-C) 기본
    let voice = options.neuralVoice;
    if (!voice) {
      voice = options.gender === 'female' ? 'ko-KR-Neural2-A' : 'ko-KR-Neural2-C';
    }

    const payload = JSON.stringify({
      text: cleanText,
      voice,
      rate: options.neuralRate || '+10%',
      pitch: options.neuralPitch || 'default',
    });

    try {
      // 1순위: Vercel Node.js 서버리스 (신용카드 불필요, 100% 완전 무료 고음질 사람 음성)
      let response = await fetch(VERCEL_TTS_ENDPOINT, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: payload,
      }).catch(() => null);

      // 2순위: Supabase Edge Function fallback
      if (!response || !response.ok) {
        response = await fetch(SUPABASE_TTS_ENDPOINT, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: payload,
        }).catch(() => null);
      }

      if (!response || !response.ok) {
        const errJson = response ? await response.json().catch(() => ({})) : {};
        if (errJson?.activationUrl) {
          this.lastActivationUrl = errJson.activationUrl;
        }
        console.warn('TTS endpoints returned non-ok response');
        return false;
      }

      this.lastActivationUrl = null;
      const blob = await response.blob();
      const audioUrl = URL.createObjectURL(blob);

      return new Promise<boolean>((resolve) => {
        const audio = new Audio(audioUrl);
        this.currentAudio = audio;

        // 전화 수화기 통화 질감 필터 적용 (Web Audio API)
        if (this.usePhoneFilter) {
          this.applyPhoneAudioPipeline(audio);
        }

        audio.onended = () => {
          URL.revokeObjectURL(audioUrl);
          if (this.currentAudio === audio) {
            this.currentAudio = null;
          }
          resolve(true);
        };

        audio.onerror = (err) => {
          console.warn('Audio playback error:', err);
          URL.revokeObjectURL(audioUrl);
          if (this.currentAudio === audio) {
            this.currentAudio = null;
          }
          resolve(false);
        };

        audio.play().catch((playErr) => {
          console.warn('Audio play() failed:', playErr);
          URL.revokeObjectURL(audioUrl);
          if (this.currentAudio === audio) {
            this.currentAudio = null;
          }
          resolve(false);
        });
      });
    } catch (err) {
      console.warn('Failed to fetch TTS audio:', err);
      return false;
    }
  }

  // Web Audio API를 활용한 실제 전화 수화기 통화 필터 (Telephone Bandpass EQ)
  private applyPhoneAudioPipeline(audio: HTMLAudioElement): void {
    try {
      const AudioCtxClass = window.AudioContext || (window as any).webkitAudioContext;
      if (!AudioCtxClass) return;

      if (!this.audioCtx) {
        this.audioCtx = new AudioCtxClass();
      }

      if (this.audioCtx.state === 'suspended') {
        this.audioCtx.resume();
      }

      // 이전 연결 해제
      if (this.mediaSourceNode) {
        try { this.mediaSourceNode.disconnect(); } catch (_) {}
      }

      const source = this.audioCtx.createMediaElementSource(audio);
      this.mediaSourceNode = source;

      // 1. 전화 통화 저주파 컷 (Highpass 300Hz)
      const highpass = this.audioCtx.createBiquadFilter();
      highpass.type = 'highpass';
      highpass.frequency.value = 320;
      highpass.Q.value = 0.8;

      // 2. 전화 통화 고주파 컷 (Lowpass 3400Hz - PSTN/VoLTE 대역 규격)
      const lowpass = this.audioCtx.createBiquadFilter();
      lowpass.type = 'lowpass';
      lowpass.frequency.value = 3400;
      lowpass.Q.value = 0.8;

      // 3. 수화기 특유의 중역대 미세 부스트 (Peaking 1400Hz)
      const midBoost = this.audioCtx.createBiquadFilter();
      midBoost.type = 'peaking';
      midBoost.frequency.value = 1400;
      midBoost.Q.value = 1.2;
      midBoost.gain.value = 2.5;

      // 4. 출력 게인 조정 (볼륨 밸런스)
      const gainNode = this.audioCtx.createGain();
      gainNode.gain.value = 1.25;

      // 체인 연결: Source -> Highpass -> Lowpass -> MidBoost -> Gain -> Destination
      source.connect(highpass);
      highpass.connect(lowpass);
      lowpass.connect(midBoost);
      midBoost.connect(gainNode);
      gainNode.connect(this.audioCtx.destination);
    } catch (e) {
      console.warn('Could not apply phone audio filter, playing original audio:', e);
    }
  }

  // 브라우저 내장 Web Speech API 발화 (Fallback)
  public speakBrowser(text: string, options: SpeechVoiceOptions = {}): Promise<void> {
    return new Promise((resolve) => {
      if (!this.synth) {
        console.warn('SpeechSynthesis is not supported in this browser.');
        resolve();
        return;
      }

      const cleanText = text
        .replace(/[\(\[\{][^\)\]\}]*[\)\]\}]/g, '')
        .replace(/[\.\.\.~"']/g, ' ')
        .replace(/^(네|아|예|저|음|여보세요),/g, '$1')
        .replace(/,\s*,/g, ',')
        .replace(/\s+/g, ' ')
        .trim();

      if (!cleanText) {
        resolve();
        return;
      }

      const utterance = new SpeechSynthesisUtterance(cleanText);
      utterance.lang = 'ko-KR';
      
      const rawPitch = options.pitch ?? 1.0;
      utterance.pitch = Math.max(0.9, Math.min(1.1, rawPitch));
      
      const rawRate = options.rate ?? 1.25;
      utterance.rate = Math.max(1.0, Math.min(1.6, rawRate));

      const koVoices = this.getKoreanVoices();
      if (koVoices.length > 0) {
        // 가장 자연스러운 음성(Natural, Google 등)을 1순위로 탐색
        const naturalVoice = koVoices.find(v => 
          v.name.includes('Natural') || v.name.includes('Online') || v.name.includes('Google')
        );
        
        if (options.gender === 'male') {
          const maleVoice = koVoices.find(v => v.name.toLowerCase().includes('male') || v.name.includes('남성') || v.name.includes('InJoon'));
          utterance.voice = maleVoice || naturalVoice || koVoices[0];
        } else {
          const femaleVoice = koVoices.find(v => v.name.toLowerCase().includes('female') || v.name.includes('여성') || v.name.includes('SunHi'));
          utterance.voice = femaleVoice || naturalVoice || koVoices[0];
        }
      }

      utterance.onend = () => resolve();
      utterance.onerror = (e) => {
        console.warn('SpeechSynthesis error:', e);
        resolve();
      };

      this.synth.speak(utterance);
    });
  }

  // 발화 즉시 중단 (신경망 오디오 및 브라우저 TTS 모두 정지)
  public stopSpeaking(): void {
    if (this.currentAudio) {
      try {
        this.currentAudio.pause();
        this.currentAudio.currentTime = 0;
      } catch (e) {
        // 무시
      }
      this.currentAudio = null;
    }

    if (this.synth) {
      try {
        this.synth.cancel();
      } catch (e) {
        // 무시
      }
    }
  }

  // 음성 인식 시작 (STT)
  public startListening(
    onResult: (transcript: string, isFinal: boolean) => void,
    onError?: (error: any) => void,
    onEnd?: () => void
  ): boolean {
    if (typeof window === 'undefined') return false;

    const SpeechRecognition = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
    if (!SpeechRecognition) {
      console.warn('SpeechRecognition is not supported in this browser.');
      return false;
    }

    try {
      if (this.recognition) {
        this.recognition.abort();
      }

      const reco = new SpeechRecognition();
      reco.lang = 'ko-KR';
      reco.continuous = true;
      reco.interimResults = true;
      reco.maxAlternatives = 1;

      reco.onresult = (event: any) => {
        let interimTranscript = '';
        let finalTranscript = '';

        for (let i = event.resultIndex; i < event.results.length; ++i) {
          if (event.results[i].isFinal) {
            finalTranscript += event.results[i][0].transcript;
          } else {
            interimTranscript += event.results[i][0].transcript;
          }
        }

        if (finalTranscript) {
          onResult(finalTranscript.trim(), true);
        } else if (interimTranscript) {
          onResult(interimTranscript.trim(), false);
        }
      };

      reco.onerror = (event: any) => {
        console.warn('SpeechRecognition error:', event.error);
        if (onError) onError(event.error);
      };

      reco.onend = () => {
        this.isListening = false;
        if (onEnd) onEnd();
      };

      reco.start();
      this.isListening = true;
      this.recognition = reco;
      return true;
    } catch (err) {
      console.error('Failed to start SpeechRecognition:', err);
      if (onError) onError(err);
      return false;
    }
  }

  // 음성 인식 종료
  public stopListening(): void {
    if (this.recognition && this.isListening) {
      try {
        this.recognition.stop();
      } catch (e) {
        // 무시
      }
      this.isListening = false;
    }
  }

  public getListeningStatus(): boolean {
    return this.isListening;
  }
}

export const speechService = new SpeechService();
