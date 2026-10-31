// ============================================
// 안드로이드 앱 연동: 사용자별 앱 세션 전달 (2026-11-01)
// 앱(WebView) 안에서 로그인하면, 앱이 백그라운드(전화 요청·문자·통화기록)에서도 같은 사용자로 동작하도록
// Edge Function(app-session)으로 앱 전용 세션을 받아 AndroidBridge.setAppSession()에 넘긴다.
// ============================================
import { supabase } from './supabase';

interface AppSessionBridge {
  supportsAppSession?: () => boolean;
  getAppSessionUserId?: () => string;
  setAppSession?: (json: string) => boolean;
  clearAppSession?: () => void;
}

const getBridge = (): AppSessionBridge | null => {
  if (typeof window === 'undefined') return null;
  const b = (window as any).AndroidBridge as AppSessionBridge | undefined;
  try {
    return b?.supportsAppSession?.() ? b : null;
  } catch {
    return null;
  }
};

let inFlight: Promise<void> | null = null;

/** 앱에 저장된 세션이 지금 로그인한 사용자 것이 아니면 새로 발급해서 넘긴다 */
export const syncAppSession = (userId: string): Promise<void> => {
  const bridge = getBridge();
  if (!bridge || !supabase || !userId) return Promise.resolve();
  try {
    if (bridge.getAppSessionUserId?.() === userId) return Promise.resolve();
  } catch { /* ignore */ }
  if (inFlight) return inFlight;

  inFlight = (async () => {
    try {
      const { data, error } = await supabase!.functions.invoke('app-session', { body: {} });
      if (error || !data?.ok) {
        console.warn('[AppSession] issue failed:', error?.message || data?.error);
        return;
      }
      const ok = bridge.setAppSession?.(JSON.stringify({
        access_token: data.access_token,
        refresh_token: data.refresh_token,
        expires_at: data.expires_at,
        user_id: data.user_id,
        email: data.email,
      }));
      console.log('[AppSession] handed to app:', ok);
    } catch (e) {
      console.warn('[AppSession] error:', e);
    } finally {
      inFlight = null;
    }
  })();
  return inFlight;
};

export const clearAppSession = () => {
  try { getBridge()?.clearAppSession?.(); } catch { /* ignore */ }
};
