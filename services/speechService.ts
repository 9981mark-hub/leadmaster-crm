// ============================================
// Web Speech API & Edge Neural Voice 음성 서비스 (2026-11-09)
// Microsoft Edge Neural Voice (고음질 사람 음성) + Web Speech API (Fallback)
// ============================================

export interface SpeechVoiceOptions {
  pitch?: number; // Web Speech용 (0.9 ~ 1.1)
  rate?: number;  // Web Speech용 (1.0 ~ 1.5)
  gender?: 'male' | 'female';
  neuralVoice?: string; // Edge Neural Voice ID (예: ko-KR-InJoonNeural, ko-KR-SunHiNeural, ko-KR-HyunsuMultilingualNeural)
  neuralRate?: string;  // Edge Neural 속도 (예: +0%, +15%, -10%)
  neuralPitch?: string; // Edge Neural 피치 (예: +0Hz, +2Hz, -5Hz)
}

const EDGE_TTS_ENDPOINT = 'https://cenksfblktflfurxjmtv.supabase.co/functions/v1/edge-tts';

class SpeechService {
  private synth: SpeechSynthesis | null = null;
  private recognition: any = null;
  private isListening = false;
  private currentAudio: HTMLAudioElement | null = null;
  private useNeuralVoice = true; // 기본적으로 고음질 Neural Voice 사용
  public lastEngineUsed: 'neural' | 'browser' = 'neural';

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

  // Microsoft Edge Neural Voice 재생 (실제 사람 통화 음질)
  public async speakNeural(text: string, options: SpeechVoiceOptions = {}): Promise<boolean> {
    const cleanText = text
      .replace(/[\(\[\{][^\)\]\}]*[\)\]\}]/g, '')
      .replace(/[\.\.\.~"']/g, ' ')
      .replace(/^(네|아|예|저|음|여보세요),/g, '$1')
      .replace(/,\s*,/g, ',')
      .replace(/\s+/g, ' ')
      .trim();

    if (!cleanText) return true;

    // 보이스 기본값: 성별 기반 또는 인준(남성) 기본
    let voice = options.neuralVoice;
    if (!voice) {
      voice = options.gender === 'female' ? 'ko-KR-SunHiNeural' : 'ko-KR-InJoonNeural';
    }

    try {
      const response = await fetch(EDGE_TTS_ENDPOINT, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          text: cleanText,
          voice,
          rate: options.neuralRate || '+10%',
          pitch: options.neuralPitch || 'default',
        }),
      });

      if (!response.ok) {
        console.warn('Edge TTS endpoint returned status:', response.status);
        return false;
      }

      const blob = await response.blob();
      const audioUrl = URL.createObjectURL(blob);

      return new Promise<boolean>((resolve) => {
        const audio = new Audio(audioUrl);
        this.currentAudio = audio;

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
      console.warn('Failed to fetch Edge TTS audio:', err);
      return false;
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
        const naturalVoice = koVoices.find(v => 
          v.name.includes('Natural') || v.name.includes('Online') || v.name.includes('Google')
        );
        
        if (options.gender === 'male') {
          const maleVoice = koVoices.find(v => v.name.toLowerCase().includes('male') || v.name.includes('남성'));
          utterance.voice = maleVoice || naturalVoice || koVoices[0];
        } else {
          utterance.voice = naturalVoice || koVoices[0];
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
