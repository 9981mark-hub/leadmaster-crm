/**
 * services/userPrefs.ts
 * 마이페이지 사용자 개인 업무 환경 설정 및 사운드/CTI 관리 모듈
 */

export type CallMethodType = 'android_bridge' | 'webrtc' | 'click_dial';
export type SoundType = 'dingdong' | 'bell' | 'marimba' | 'chime';
export type TableDensityType = 'normal' | 'compact';

export interface UserPreferences {
  // 통화 및 발신 환경
  callMethod: CallMethodType;

  // 알림 및 사운드
  soundEnabled: boolean;
  soundType: SoundType;
  soundVolume: number; // 0 ~ 100
  desktopNotification: boolean;
  notifyUnanswered: boolean; // 팀원 미응답(10분+) 알림 수신 (팀장/실장용)
  notifyAbsenceLimit: boolean; // 부재콜 3회 누적 알림

  // 화면 및 편의
  tableDensity: TableDensityType;

  // 대표(Owner) 전용 공식 직인 및 서명
  officialSealUrl?: string;
  officialTitle?: string;
}

const PREFS_STORAGE_KEY = 'lm_user_preferences_v2';

export const DEFAULT_USER_PREFS: UserPreferences = {
  callMethod: 'android_bridge',
  soundEnabled: true,
  soundType: 'dingdong',
  soundVolume: 80,
  desktopNotification: false,
  notifyUnanswered: true,
  notifyAbsenceLimit: true,
  tableDensity: 'normal',
  officialSealUrl: '',
  officialTitle: '대표'
};

export function loadUserPreferences(): UserPreferences {
  try {
    const raw = localStorage.getItem(PREFS_STORAGE_KEY);
    if (!raw) return { ...DEFAULT_USER_PREFS };
    const parsed = JSON.parse(raw);
    return { ...DEFAULT_USER_PREFS, ...parsed };
  } catch (err) {
    console.warn('[UserPrefs] 로드 실패, 기본값 사용:', err);
    return { ...DEFAULT_USER_PREFS };
  }
}

export function saveUserPreferences(updates: Partial<UserPreferences>): UserPreferences {
  const current = loadUserPreferences();
  const merged: UserPreferences = { ...current, ...updates };
  try {
    localStorage.setItem(PREFS_STORAGE_KEY, JSON.stringify(merged));
  } catch (err) {
    console.error('[UserPrefs] 저장 실패:', err);
  }
  return merged;
}

/**
 * Web Audio API를 활용한 실시간 알림음 오실레이터 재생기
 * 외부 오디오 파일 다운로드 실패 없이 브라우저 내장 합성기로 즉각 재생
 */
export function playNotificationSound(type: SoundType = 'dingdong', volumePercent: number = 80) {
  try {
    const AudioContextClass = window.AudioContext || (window as any).webkitAudioContext;
    if (!AudioContextClass) return;
    const ctx = new AudioContextClass();
    const gainNode = ctx.createGain();
    const volume = Math.max(0, Math.min(1, volumePercent / 100));
    gainNode.gain.setValueAtTime(volume * 0.4, ctx.currentTime);
    gainNode.connect(ctx.destination);

    if (type === 'dingdong') {
      // 딩동: 587Hz -> 440Hz 2단 화음
      const osc1 = ctx.createOscillator();
      osc1.type = 'sine';
      osc1.frequency.setValueAtTime(587.33, ctx.currentTime); // D5
      osc1.connect(gainNode);
      osc1.start(ctx.currentTime);
      osc1.stop(ctx.currentTime + 0.3);

      const osc2 = ctx.createOscillator();
      osc2.type = 'sine';
      osc2.frequency.setValueAtTime(440, ctx.currentTime + 0.25); // A4
      osc2.connect(gainNode);
      osc2.start(ctx.currentTime + 0.25);
      osc2.stop(ctx.currentTime + 0.7);
    } else if (type === 'bell') {
      // 종소리: 880Hz + 여운
      const osc = ctx.createOscillator();
      osc.type = 'triangle';
      osc.frequency.setValueAtTime(880, ctx.currentTime);
      gainNode.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 1.0);
      osc.connect(gainNode);
      osc.start(ctx.currentTime);
      osc.stop(ctx.currentTime + 1.0);
    } else if (type === 'marimba') {
      // 마림바: 통통 튀는 목관음 (523Hz -> 659Hz -> 783Hz)
      const notes = [523.25, 659.25, 783.99];
      notes.forEach((freq, idx) => {
        const osc = ctx.createOscillator();
        osc.type = 'sine';
        osc.frequency.setValueAtTime(freq, ctx.currentTime + idx * 0.08);
        const noteGain = ctx.createGain();
        noteGain.gain.setValueAtTime(volume * 0.5, ctx.currentTime + idx * 0.08);
        noteGain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + idx * 0.08 + 0.2);
        osc.connect(noteGain);
        noteGain.connect(ctx.destination);
        osc.start(ctx.currentTime + idx * 0.08);
        osc.stop(ctx.currentTime + idx * 0.08 + 0.25);
      });
    } else if (type === 'chime') {
      // 차임: 화사한 상승 화음
      const notes = [440, 554.37, 659.25, 880];
      notes.forEach((freq, idx) => {
        const osc = ctx.createOscillator();
        osc.type = 'sine';
        osc.frequency.setValueAtTime(freq, ctx.currentTime + idx * 0.06);
        const noteGain = ctx.createGain();
        noteGain.gain.setValueAtTime(volume * 0.35, ctx.currentTime + idx * 0.06);
        noteGain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + idx * 0.06 + 0.4);
        osc.connect(noteGain);
        noteGain.connect(ctx.destination);
        osc.start(ctx.currentTime + idx * 0.06);
        osc.stop(ctx.currentTime + idx * 0.06 + 0.45);
      });
    }
  } catch (err) {
    console.warn('[UserPrefs] 사운드 재생 불가:', err);
  }
}
