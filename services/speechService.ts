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
  emotion?: 'angry' | 'annoyed' | 'anxious' | 'calm';
}

class SpeechService {
  private googleApiKey = 'AIzaSyDScHNsOhn_TqnZfcxoCt7uC-KtbAHVPNI';
  private synth: SpeechSynthesis | null = null;
  private recognition: any = null;
  private isListening = false;
  private shouldBeListening = false;
  private restartTimeout: any = null;
  private onResultCb: ((transcript: string, isFinal: boolean) => void) | null = null;
  private onErrorCb: ((error: any) => void) | null = null;
  private onEndCb: (() => void) | null = null;
  private currentAudio: HTMLAudioElement | null = null;
  private unlockedAudio: HTMLAudioElement | null = null;
  private audioCtx: AudioContext | null = null;
  private mediaSourceNode: MediaElementAudioSourceNode | null = null;
  private usePhoneFilter = true; // 실제 전화 통화 수화기 음질 필터 (300Hz ~ 3400Hz Bandpass)
  public lastEngineUsed: 'neural' | 'browser' = 'browser';
  public lastVoiceName = '';
  private cachedVoices: SpeechSynthesisVoice[] = [];
  private ringOscillators: { osc1: OscillatorNode; osc2: OscillatorNode; gain: GainNode; ctx: AudioContext } | null = null;
  private ringTimeoutId: any = null;

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

  // 현재 TTS 발화 중인지 확인
  public isSpeaking(): boolean {
    return !!(this.currentAudio && !this.currentAudio.paused) || !!(this.synth && this.synth.speaking);
  }

  // 모바일 브라우저/웹뷰 Autoplay 제한 해제 (사용자 최초 제스처 시 호출)
  public unlockAudio(): void {
    if (typeof window === 'undefined') return;
    try {
      if (!this.unlockedAudio) {
        this.unlockedAudio = new Audio();
      }
      // 0.01초 무음 MP3 버퍼 재생을 통해 브라우저 오디오 정책상 '사용자 상호작용 승인(User-Activated)' 상태로 영구 전환
      this.unlockedAudio.src = 'data:audio/mp3;base64,//uQxAAAAAAAAAAAAAAAAAAAAAAAWGluZwAAAA8AAAACAAACcQCAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICA///////AAAA8EwAAMEAAAABAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA';
      const playPromise = this.unlockedAudio.play();
      if (playPromise !== undefined) {
        playPromise.then(() => {
          if (this.unlockedAudio && this.unlockedAudio.src.startsWith('data:audio/mp3;base64,//uQx')) {
            this.unlockedAudio.pause();
            this.unlockedAudio.currentTime = 0;
          }
        }).catch(() => {});
      }
    } catch (_) {}
  }

  // 통합 발화 메서드 (항상 가장 고품질의 자연스러운 음성을 최우선 선택)
  public async speak(text: string, options: SpeechVoiceOptions = {}): Promise<{ engine: 'neural' | 'browser'; voiceName: string }> {
    this.stopSpeaking();
    // 모바일 오디오 덕킹(볼륨 꺼짐) 방지를 위해 발화 중에는 마이크 수신 정지
    this.stopListening();

    // 1순위: Google Cloud Text-to-Speech 공식 Neural2/WaveNet 성우 엔진
    if (this.googleApiKey) {
      try {
        const voiceName = await this.speakGoogleCloud(text, options);
        this.lastEngineUsed = 'neural';
        this.lastVoiceName = voiceName;
        return { engine: 'neural', voiceName };
      } catch (err) {
        console.warn('Google Cloud TTS failed, falling back to browser:', err);
      }
    }

    // 2순위: 브라우저 로컬 Web Speech 엔진 폴백
    this.lastEngineUsed = 'browser';
    const voiceName = await this.speakBrowser(text, options);
    this.lastVoiceName = voiceName;
    return { engine: 'browser', voiceName };
  }

  // 문장 감정 분석 (화남/분노/짜증/의심/불안/차분)
  public detectEmotion(text: string): 'angry' | 'annoyed' | 'anxious' | 'calm' {
    // 1. 극대노 / 분노 / 고소 / 신고 (느낌표 2개 이상이거나 격한 표현)
    if (/[!?]{2,}|(사기|경찰|신고|고소|소송|장난|당장|끊어|쳐넣|닥쳐|닥치|집어치|가만 안|똑바로 말)/.test(text)) {
      return 'angry';
    }
    // 2. 기분 나쁨 / 짜증 / 경계 / 의심 (의심 및 쌀쌀맞은 어조)
    if (/[!?]|(어디|당신|바빠|바쁘|참나|아니|무슨|대체|누구|왜|됐|필요없|싫|귀찮|뭔|웃기|헛소리|협박|개인정보|불법|따지|따져|스팸|보이스피싱|번호 어떻게)/.test(text)) {
      return 'annoyed';
    }
    // 3. 불안 / 초조 / 절박
    if (/(압류|독촉|신용불량|어떡해|어떻게|정말|진짜|살려|힘들|파산|빚|이자|도와)/.test(text)) {
      return 'anxious';
    }
    return 'calm';
  }

  // Google Cloud Text-to-Speech API 고음질 신경망 성우 발화
  public async speakGoogleCloud(text: string, options: SpeechVoiceOptions = {}): Promise<string> {
    const cleanText = text
      .replace(/[\(\[\{][^\)\]\}]*[\)\]\}]/g, '')
      .replace(/[\.\.\.~"']/g, ' ')
      .replace(/^(네|아|예|저|음|여보세요),/g, '$1')
      .replace(/,\s*,/g, ',')
      .replace(/\s+/g, ' ')
      .trim();

    if (!cleanText) return 'Empty';

    const voiceName = options.neuralVoice || (options.gender === 'female' ? 'ko-KR-Neural2-A' : 'ko-KR-Neural2-C');
    const ssmlGender = options.gender === 'female' ? 'FEMALE' : 'MALE';

    // 감정 분석 (옵션 지정 우선 + 문장 키워드/문장부호 정밀 판별)
    const emotion = options.emotion || this.detectEmotion(cleanText);

    // 속도 설정 (기본 1.20x 기준 + 감정에 따른 쏘아붙이기 가속)
    let rate = options.rate ?? 1.20;
    if (emotion === 'angry') {
      rate = Math.min(1.45, rate * 1.15); // 분노 시 15% 가속 (쏘아붙이듯 빠른 호흡)
    } else if (emotion === 'annoyed') {
      rate = Math.min(1.40, rate * 1.08); // 짜증/경계 시 8% 가속
    } else if (emotion === 'anxious') {
      rate = Math.min(1.35, rate * 1.05); // 불안/초조 시 5% 가속
    }
    const speakingRate = Math.max(0.75, Math.min(1.45, rate));

    // 피치 설정 (-12.0 ~ +10.0 semitones)
    // 기분 나쁘거나 화가 나면 성대가 긴장하여 목소리 톤이 확 올라감!
    let basePitch = options.pitch ?? 0.80;
    let pitchOffsetSemitones = 0;
    if (emotion === 'angry') {
      pitchOffsetSemitones = +5.2; // 톤이 대폭 치솟음! (+5.2 semitones의 고음 분노 톤)
    } else if (emotion === 'annoyed') {
      pitchOffsetSemitones = +3.2; // 약간 기분 나쁘고 따지는 듯한 날카로운 톤 (+3.2st)
    } else if (emotion === 'anxious') {
      pitchOffsetSemitones = +2.0; // 상기되고 초조한 톤 (+2.0st)
    }

    const calculatedSemitones = (basePitch - 1.0) * 16.0 + pitchOffsetSemitones;
    const pitchSemitones = Math.max(-12.0, Math.min(10.0, calculatedSemitones));

    const apiKey = (typeof localStorage !== 'undefined' && localStorage.getItem('lm_google_tts_key')) || this.googleApiKey;
    const url = `https://texttospeech.googleapis.com/v1/text:synthesize?key=${apiKey}`;

    const res = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        input: { text: cleanText },
        voice: {
          languageCode: 'ko-KR',
          name: voiceName,
          ssmlGender,
        },
        audioConfig: {
          audioEncoding: 'MP3',
          speakingRate,
          pitch: pitchSemitones,
        },
      }),
    });

    if (!res.ok) {
      const errText = await res.text().catch(() => '');
      throw new Error(`Google Cloud TTS API Error (${res.status}): ${errText}`);
    }

    const data = await res.json();
    if (!data.audioContent) {
      throw new Error('No audioContent returned');
    }

    const audioUrl = `data:audio/mp3;base64,${data.audioContent}`;
    // 재사용 가능한 사전 승인(unlocked) 오디오 객체 우선 사용 (Autoplay 차단 원천 해결)
    const audio = this.unlockedAudio || new Audio();
    this.unlockedAudio = audio;
    audio.src = audioUrl;
    audio.volume = 1.0;
    this.currentAudio = audio;

    return new Promise((resolve) => {
      let resolved = false;
      const finish = () => {
        if (!resolved) {
          resolved = true;
          this.currentAudio = null;
          resolve(voiceName);
        }
      };

      audio.onended = finish;
      audio.onerror = (e) => {
        console.warn('Audio playback error:', e);
        finish();
      };

      const playPromise = audio.play();
      if (playPromise !== undefined) {
        playPromise.catch((e) => {
          console.warn('Audio play failed:', e);
          finish();
        });
      }
    });
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

    // 감정 분석 (옵션 지정 우선 + 문장 키워드/문장부호 정밀 판별)
    const emotion = options.emotion || this.detectEmotion(cleanText);

    // 자연스러운 사람 발화 속도 (감정이 격앙될 때 쏘아붙이듯 약간 가속)
    let baseRate = options.rate ?? 1.20;
    if (emotion === 'angry') {
      baseRate = Math.min(1.45, baseRate * 1.15);
    } else if (emotion === 'annoyed') {
      baseRate = Math.min(1.40, baseRate * 1.08);
    } else if (emotion === 'anxious') {
      baseRate = Math.min(1.35, baseRate * 1.05);
    }
    utterance.rate = Math.max(0.95, Math.min(1.45, baseRate));

    // 피치 (0.50 ~ 1.4: 화가 나거나 의심할 때는 성대가 긴장하여 목소리 톤이 확 올라감!)
    let basePitch = options.pitch ?? 0.80;
    if (emotion === 'angry') {
      basePitch = Math.min(1.40, basePitch + 0.32); // Web Speech pitch 대폭 상승
    } else if (emotion === 'annoyed') {
      basePitch = Math.min(1.25, basePitch + 0.20); // Web Speech pitch 상승
    } else if (emotion === 'anxious') {
      basePitch = Math.min(1.15, basePitch + 0.12);
    }
    utterance.pitch = Math.max(0.50, Math.min(1.40, basePitch));

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

  // 발화 및 신호음 즉시 중단
  public stopSpeaking(): void {
    this.stopRingbackTone();

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

  // 아웃바운드 실전 전화 신호음 (한국 표준 440Hz+480Hz 통화연결음 모사)
  public playRingbackTone(rings: number = 2): Promise<void> {
    this.stopRingbackTone();
    this.stopListening();
    this.unlockAudio(); // 발신 사용자 제스처 시점에 오디오 잠금 해제 미리 수행

    return new Promise((resolve) => {
      try {
        const AudioCtxClass = window.AudioContext || (window as any).webkitAudioContext;
        if (!AudioCtxClass) {
          setTimeout(resolve, 2500);
          return;
        }

        const ctx = new AudioCtxClass();
        if (ctx.state === 'suspended') {
          ctx.resume();
        }

        const osc1 = ctx.createOscillator();
        const osc2 = ctx.createOscillator();
        const gain = ctx.createGain();

        osc1.type = 'sine';
        osc1.frequency.setValueAtTime(440, ctx.currentTime);
        osc2.type = 'sine';
        osc2.frequency.setValueAtTime(480, ctx.currentTime);

        gain.gain.setValueAtTime(0, ctx.currentTime);

        osc1.connect(gain);
        osc2.connect(gain);
        gain.connect(ctx.destination);

        let t = ctx.currentTime + 0.05;
        for (let i = 0; i < rings; i++) {
          // 1초간 뚜르르르 울림
          gain.gain.setValueAtTime(0.08, t);
          gain.gain.setValueAtTime(0.08, t + 0.95);
          gain.gain.linearRampToValueAtTime(0.001, t + 1.0);
          // 1.2초간 쉼
          t += 2.2;
        }

        osc1.start(ctx.currentTime + 0.05);
        osc2.start(ctx.currentTime + 0.05);
        osc1.stop(t);
        osc2.stop(t);

        this.ringOscillators = { osc1, osc2, gain, ctx };

        const totalMs = Math.max(1000, (t - ctx.currentTime) * 1000);
        this.ringTimeoutId = setTimeout(() => {
          this.stopRingbackTone();
          resolve();
        }, totalMs + 50);
      } catch (e) {
        console.warn('Ringback tone playback error:', e);
        setTimeout(resolve, 2500);
      }
    });
  }

  // 신호음 즉시 정지
  public stopRingbackTone(): void {
    if (this.ringTimeoutId) {
      clearTimeout(this.ringTimeoutId);
      this.ringTimeoutId = null;
    }
    if (this.ringOscillators) {
      try {
        this.ringOscillators.osc1.stop();
        this.ringOscillators.osc2.stop();
        this.ringOscillators.osc1.disconnect();
        this.ringOscillators.osc2.disconnect();
        this.ringOscillators.gain.disconnect();
        this.ringOscillators.ctx.close();
      } catch (_) {}
      this.ringOscillators = null;
    }
  }

  // 브라우저 Web Speech Recognition 지원 여부
  public isSpeechRecognitionSupported(): boolean {
    if (typeof window === 'undefined') return false;
    return !!((window as any).SpeechRecognition || (window as any).webkitSpeechRecognition);
  }

  // 마이크 권한 상태 사전 확인 (Permissions API 지원 시)
  public async checkMicrophonePermission(): Promise<'granted' | 'denied' | 'prompt' | 'unsupported'> {
    if (typeof window === 'undefined' || !navigator.permissions?.query) {
      return 'unsupported';
    }
    try {
      const status = await navigator.permissions.query({ name: 'microphone' as any });
      return status.state; // 'granted' | 'denied' | 'prompt'
    } catch (_) {
      return 'unsupported';
    }
  }

  // 마이크 권한 명시적 요청 (getUserMedia 프롬프트 트리거)
  public async requestMicrophonePermission(): Promise<{ granted: boolean; error?: string }> {
    if (typeof window === 'undefined' || !navigator.mediaDevices?.getUserMedia) {
      return { granted: false, error: 'not-supported' };
    }
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      // 권한 허용 성공 - 즉시 오디오 트랙을 정지하여 마이크 점유 해제
      stream.getTracks().forEach(track => track.stop());
      return { granted: true };
    } catch (err: any) {
      console.warn('Microphone permission request failed:', err);
      const errorName = err?.name || 'UnknownError';
      return { granted: false, error: errorName };
    }
  }

  // 음성 인식 시작 (STT) - 크롬 침묵 자동 끊김(no-speech) 극복 및 지속 수신(Auto-restart)
  public startListening(
    onResult: (transcript: string, isFinal: boolean) => void,
    onError?: (error: any) => void,
    onEnd?: () => void
  ): boolean {
    if (typeof window === 'undefined') return false;

    if (!this.isSpeechRecognitionSupported()) {
      console.warn('SpeechRecognition is not supported in this browser.');
      return false;
    }

    this.onResultCb = onResult;
    this.onErrorCb = onError || null;
    this.onEndCb = onEnd || null;
    this.shouldBeListening = true;

    if (this.restartTimeout) {
      clearTimeout(this.restartTimeout);
      this.restartTimeout = null;
    }

    return this.initAndStartRecognition();
  }

  private initAndStartRecognition(): boolean {
    const SpeechRecognition = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
    if (!SpeechRecognition) return false;

    try {
      if (this.recognition) {
        try {
          this.recognition.abort();
        } catch (_) {}
        this.recognition = null;
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

        if (this.onResultCb) {
          if (finalTranscript) {
            this.onResultCb(finalTranscript.trim(), true);
          } else if (interimTranscript) {
            this.onResultCb(interimTranscript.trim(), false);
          }
        }
      };

      reco.onerror = (event: any) => {
        const errType = event.error;
        console.warn('SpeechRecognition error:', errType);

        // 크롬은 4~5초 침묵 시 no-speech 에러를 발생시킴 -> 오류가 아니므로 무시하고 유지
        if (errType === 'no-speech' || errType === 'aborted') {
          return;
        }

        // 브라우저 마이크 권한 차단 시에만 완전 종료 및 컴포넌트 알림
        if (errType === 'not-allowed' || errType === 'service-not-allowed') {
          this.shouldBeListening = false;
          this.isListening = false;
          if (this.onErrorCb) this.onErrorCb(errType);
          return;
        }

        // 일시적인 network 또는 audio-capture glitch는 onend에서 자동 재시작되도록 마이크를 강제 종료하지 않음
      };

      reco.onend = () => {
        this.isListening = false;

        // 상담원 통화 연결 중일 때는 크롬이 끊더라도 즉시 자동 재연결(Auto-restart)
        if (this.shouldBeListening) {
          if (this.restartTimeout) clearTimeout(this.restartTimeout);
          this.restartTimeout = setTimeout(() => {
            if (this.shouldBeListening) {
              this.initAndStartRecognition();
            }
          }, 150);
        } else {
          if (this.onEndCb) this.onEndCb();
        }
      };

      reco.start();
      this.isListening = true;
      this.recognition = reco;
      return true;
    } catch (err: any) {
      console.warn('Failed to start SpeechRecognition:', err);
      // 이미 시작된 상태 에러(InvalidStateError) 대응
      if (err?.name === 'InvalidStateError') {
        this.isListening = true;
        return true;
      }
      this.isListening = false;
      if (this.onErrorCb) this.onErrorCb(err);
      return false;
    }
  }

  // 음성 인식 완전 종료
  public stopListening(): void {
    this.shouldBeListening = false;

    if (this.restartTimeout) {
      clearTimeout(this.restartTimeout);
      this.restartTimeout = null;
    }

    if (this.recognition) {
      try {
        this.recognition.abort();
      } catch (_) {}
      this.recognition = null;
    }

    this.isListening = false;
  }

  public getListeningStatus(): boolean {
    return this.isListening;
  }
}

export const speechService = new SpeechService();
