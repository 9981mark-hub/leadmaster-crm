// ============================================
// Web Speech API & 고음질 신경망 음성 서비스 (2026-11-09)
// 크롬 Google 한국의 / 엣지 Natural 신경망 보이스 자동 우선 탑재 + 전화 수화기 통화 필터
// ============================================

export interface SpeechVoiceOptions {
  pitch?: number; // Web Speech용 (0.9 ~ 1.1)
  rate?: number;  // Web Speech용 (1.0 ~ 1.5)
  gender?: 'male' | 'female';
  neuralVoice?: string;
  neuralRate?: string;
  neuralPitch?: string;
}

class SpeechService {
  private synth: SpeechSynthesis | null = null;
  private recognition: any = null;
  private isListening = false;
  private currentAudio: HTMLAudioElement | null = null;
  private audioCtx: AudioContext | null = null;
  private mediaSourceNode: MediaElementAudioSourceNode | null = null;
  private usePhoneFilter = true; // 실제 전화 통화 수화기 음질 필터 (300Hz ~ 3400Hz Bandpass)
  public lastEngineUsed: 'neural' | 'browser' = 'browser';
  public lastVoiceName = '';
  private cachedVoices: SpeechSynthesisVoice[] = [];

  constructor() {
    if (typeof window !== 'undefined' && 'speechSynthesis' in window) {
      this.synth = window.speechSynthesis;
      // 음성 목록 사전 로드
      this.loadVoices();
      if (this.synth.onvoiceschanged !== undefined) {
        this.synth.onvoiceschanged = () => this.loadVoices();
      }
    }
  }

  private loadVoices(): void {
    if (!this.synth) return;
    const v = this.synth.getVoices();
    if (v.length > 0) {
      this.cachedVoices = v;
    }
  }

  // 사용 가능한 음성 목록 보장 (비동기 로딩 대응)
  public async ensureVoicesLoaded(): Promise<SpeechSynthesisVoice[]> {
    if (this.cachedVoices.length > 0) return this.cachedVoices;
    if (!this.synth) return [];

    let v = this.synth.getVoices();
    if (v.length > 0) {
      this.cachedVoices = v;
      return v;
    }

    return new Promise((resolve) => {
      let resolved = false;
      const done = () => {
        if (resolved) return;
        resolved = true;
        const res = this.synth?.getVoices() || [];
        if (res.length > 0) this.cachedVoices = res;
        resolve(res);
      };

      if (this.synth) {
        this.synth.onvoiceschanged = done;
      }
      setTimeout(done, 500);
    });
  }

  // 한국어 음성 필터링
  public async getKoreanVoices(): Promise<SpeechSynthesisVoice[]> {
    const all = await this.ensureVoicesLoaded();
    return all.filter(v => v.lang.startsWith('ko') || v.lang === 'ko_KR');
  }

  // 전화 수화기 필터 활성화 여부 설정/조회
  public setUsePhoneFilter(enable: boolean): void {
    this.usePhoneFilter = enable;
  }

  public getUsePhoneFilter(): boolean {
    return this.usePhoneFilter;
  }

  // 통합 발화 메서드 (항상 가장 고품질의 자연스러운 음성을 최우선 선택)
  public async speak(text: string, options: SpeechVoiceOptions = {}): Promise<{ engine: 'neural' | 'browser'; voiceName: string }> {
    this.stopSpeaking();
    this.lastEngineUsed = 'browser';
    const voiceName = await this.speakBrowser(text, options);
    this.lastVoiceName = voiceName;
    return { engine: 'browser', voiceName };
  }

  // 브라우저 내장 Web Speech API 발화 (Google 한국의 / Microsoft Natural 신경망 우선 선택)
  public async speakBrowser(text: string, options: SpeechVoiceOptions = {}): Promise<string> {
    if (!this.synth) {
      console.warn('SpeechSynthesis is not supported in this browser.');
      return 'None';
    }

    const cleanText = text
      .replace(/[\(\[\{][^\)\]\}]*[\)\]\}]/g, '')
      .replace(/[\.\.\.~"']/g, ' ')
      .replace(/^(네|아|예|저|음|여보세요),/g, '$1')
      .replace(/,\s*,/g, ',')
      .replace(/\s+/g, ' ')
      .trim();

    if (!cleanText) return 'Empty';

    const koVoices = await this.getKoreanVoices();
    const utterance = new SpeechSynthesisUtterance(cleanText);
    utterance.lang = 'ko-KR';

    // 음성 선택 전략: 구형 Heami(로봇음)를 무조건 배제하고 최신 고음질 신경망을 최우선 선택!
    // 1순위: Edge 브라우저의 InJoon / SunHi Online (Natural)
    // 2순위: Chrome 브라우저의 Google 한국의 (원격 고음질 신경망)
    // 3순위: 기타 Natural/Online 키워드 포함 음성
    // 4순위: 일반 음성 중 Heami가 아닌 음성
    let chosenVoice: SpeechSynthesisVoice | null = null;

    if (options.gender === 'female') {
      chosenVoice = koVoices.find(v => (v.name.includes('SunHi') || v.name.includes('YuJin')) && v.name.includes('Natural'))
        || koVoices.find(v => v.name.includes('Google') || v.name.includes('한국의'))
        || koVoices.find(v => v.name.toLowerCase().includes('female') || v.name.includes('여성'))
        || koVoices.find(v => v.name.includes('Natural') || v.name.includes('Online'))
        || koVoices[0] || null;
    } else {
      chosenVoice = koVoices.find(v => (v.name.includes('InJoon') || v.name.includes('BongJin')) && v.name.includes('Natural'))
        || koVoices.find(v => v.name.toLowerCase().includes('male') || v.name.includes('남성'))
        || koVoices.find(v => v.name.includes('Google') || v.name.includes('한국의'))
        || koVoices.find(v => v.name.includes('Natural') || v.name.includes('Online'))
        || koVoices[0] || null;
    }

    if (chosenVoice) {
      utterance.voice = chosenVoice;
    }

    // 자연스러운 사람 발화 속도 (너무 빠르면 기계음처럼 들리므로 1.05~1.15 최적화)
    const baseRate = options.rate ?? 1.1;
    utterance.rate = Math.max(0.95, Math.min(1.3, baseRate));

    // 피치 (0.50 ~ 1.3: 낮을수록 중후하고 나이든 어르신/중년 목소리)
    const basePitch = options.pitch ?? 0.80;
    utterance.pitch = Math.max(0.50, Math.min(1.3, basePitch));

    const playedVoiceName = chosenVoice?.name || '기본 음성';

    return new Promise((resolve) => {
      utterance.onend = () => resolve(playedVoiceName);
      utterance.onerror = (e) => {
        console.warn('SpeechSynthesis error:', e);
        resolve(playedVoiceName);
      };

      this.synth!.speak(utterance);
    });
  }

  // 발화 즉시 중단
  public stopSpeaking(): void {
    if (this.currentAudio) {
      try {
        this.currentAudio.pause();
        this.currentAudio.currentTime = 0;
      } catch (_) {}
      this.currentAudio = null;
    }

    if (this.synth) {
      try {
        this.synth.cancel();
      } catch (_) {}
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
      } catch (_) {}
      this.isListening = false;
    }
  }

  public getListeningStatus(): boolean {
    return this.isListening;
  }
}

export const speechService = new SpeechService();
