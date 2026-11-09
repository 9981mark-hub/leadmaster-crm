// ============================================
// Web Speech API STT/TTS 음성 서비스 (2026-11-09)
// 브라우저 기본 내장 음성 엔진 활용 -> 외부 유료 API 비용 0원
// ============================================

export interface SpeechVoiceOptions {
  pitch?: number; // 0.1 ~ 2.0 (기본 1.0, 50~60대는 0.75~0.85 추천)
  rate?: number;  // 0.1 ~ 10.0 (기본 1.0, 급한 성격은 1.15 추천)
  gender?: 'male' | 'female';
}

class SpeechService {
  private synth: SpeechSynthesis | null = null;
  private recognition: any = null;
  private isListening = false;

  constructor() {
    if (typeof window !== 'undefined' && 'speechSynthesis' in window) {
      this.synth = window.speechSynthesis;
    }
  }

  // 사용 가능한 한국어 음성 목록 가져오기
  public getKoreanVoices(): SpeechSynthesisVoice[] {
    if (!this.synth) return [];
    const voices = this.synth.getVoices();
    return voices.filter(v => v.lang.startsWith('ko') || v.lang === 'ko_KR');
  }

  // 텍스트를 음성으로 발화 (TTS)
  public speak(text: string, options: SpeechVoiceOptions = {}): Promise<void> {
    return new Promise((resolve) => {
      if (!this.synth) {
        console.warn('SpeechSynthesis is not supported in this browser.');
        resolve();
        return;
      }

      // 이전 발화 취소
      this.synth.cancel();

      // [자연스러운 한국어 발화 튜닝]
      // 괄호 지문 (예: (한숨), [화를 내며]), 줄임표(...), 따옴표 등 어색한 침묵을 유발하는 기호 제거
      const cleanText = text
        .replace(/[\(\[\{][^\)\]\}]*[\)\]\}]/g, '')
        .replace(/[\.\.\.~"']/g, ' ')
        .replace(/\s+/g, ' ')
        .trim();

      if (!cleanText) {
        resolve();
        return;
      }

      const utterance = new SpeechSynthesisUtterance(cleanText);
      utterance.lang = 'ko-KR';
      
      // 피치 왜곡 방지 (0.9 ~ 1.08 범위 유지하여 기계음/괴물소리 방지)
      const rawPitch = options.pitch ?? 1.0;
      utterance.pitch = Math.max(0.9, Math.min(1.1, rawPitch));
      
      // 실제 한국인 통화 템포로 기본 속도 상향 (기본 1.25배속)
      const rawRate = options.rate ?? 1.25;
      utterance.rate = Math.max(1.0, Math.min(1.6, rawRate));

      // 한국어 고음질/자연스러운 음성 우선 매칭
      const koVoices = this.getKoreanVoices();
      if (koVoices.length > 0) {
        // 1순위: Google 또는 Natural/Online 표기 음성
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
        resolve(); // 에러 발생해도 멈추지 않고 진행
      };

      this.synth.speak(utterance);
    });
  }

  // 발화 중단
  public stopSpeaking(): void {
    if (this.synth) {
      this.synth.cancel();
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
