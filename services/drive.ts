// ============================================
// 회사 구글 드라이브 연결 (녹음 장기 보관, 2026-11-01)
// 기획: docs/기획서_통화녹음_구글드라이브_장기보관_v1.md
// 서버 함수 drive-connect가 구글 토큰을 보관한다. 브라우저는 상태만 본다.
// ============================================
import { supabase } from './supabase';

export interface DriveTestStep { step: string; ok: boolean; detail?: string }
export interface DriveStatus {
  connected: boolean;
  status: 'connected' | 'revoked' | 'error' | null;
  googleEmail: string | null;
  rootFolderId: string | null;
  rootFolderName: string | null;
  folderMode: 'created' | 'picked' | null;
  lastError: string | null;
  lastOkAt: string | null;
  connectedAt: string | null;
  lastTest: { at: string; ok: boolean; steps: DriveTestStep[] } | null;
}

/** 017 적용 전이면 null */
export const fetchDriveStatus = async (): Promise<DriveStatus | null> => {
  if (!supabase) return null;
  const { data, error } = await supabase.rpc('get_drive_status');
  if (error) {
    if (/get_drive_status|does not exist|PGRST202/i.test(error.message || '') || error.code === 'PGRST202') return null;
    throw error;
  }
  const d: any = data || {};
  return {
    connected: !!d.connected,
    status: d.status ?? null,
    googleEmail: d.google_email ?? null,
    rootFolderId: d.root_folder_id ?? null,
    rootFolderName: d.root_folder_name ?? null,
    folderMode: d.folder_mode ?? null,
    lastError: d.last_error ?? null,
    lastOkAt: d.last_ok_at ?? null,
    connectedAt: d.connected_at ?? null,
    lastTest: d.last_test ?? null,
  };
};

const call = async <T = any>(body: Record<string, unknown>): Promise<T> => {
  if (!supabase) throw new Error('서버 연결이 없습니다');
  const { data, error } = await supabase.functions.invoke('drive-connect', { body });
  if (error) {
    // 함수가 보낸 오류 문구 꺼내기
    let msg = error.message;
    try { const j = await (error as any).context?.json?.(); if (j?.error) msg = j.error; } catch { /* ignore */ }
    throw new Error(msg);
  }
  if (!data?.ok) throw new Error(data?.error || '요청 실패');
  return data as T;
};

/** 구글 허락 화면으로 이동 (끝나면 지금 화면으로 돌아옴: #/team?drive=connected) */
export const startDriveConnect = async () => {
  const back = `${window.location.origin}/team`;
  const { url } = await call<{ url: string }>({ action: 'start', return_to: back });
  window.location.assign(url);
};

export const createDriveFolder = (name?: string) => call<{ folder: { id: string; name: string } }>({ action: 'create_folder', name });
export const setDriveFolder = (folderId: string) => call<{ folder: { id: string; name: string } }>({ action: 'set_folder', folder_id: folderId });
export const testDrive = () => call<{ test: { at: string; ok: boolean; steps: DriveTestStep[] } }>({ action: 'test' });
export const disconnectDrive = () => call({ action: 'disconnect' });

export interface LegacyImportStats { cases: number; items: number; imported: number; already: number; need_allow: number; trashed: number; not_drive: number; errors: number; more: boolean }
/** 리드 상세의 예전 드라이브 녹음 링크를 녹음 기록(드라이브 보관)으로 등록. 허용된 파일만 */
export const importLegacyRecordings = (dryRun = false) => call<{ stats: LegacyImportStats }>({ action: 'import_legacy', dry_run: dryRun });

// --------------------------------------------
// 구글 파일 선택 창 (Google Picker): 기존 폴더 고르기 · 기존 파일 허용
// 브라우저 API 키(VITE_GOOGLE_PICKER_API_KEY, Picker API만 허용·웹사이트 제한)가 있어야 동작
// --------------------------------------------
export const PICKER_API_KEY: string = (import.meta as any).env?.VITE_GOOGLE_PICKER_API_KEY || '';

let pickerLoaded: Promise<void> | null = null;
const loadPicker = () => {
  if (pickerLoaded) return pickerLoaded;
  pickerLoaded = new Promise<void>((resolve, reject) => {
    const done = () => (window as any).gapi.load('picker', { callback: () => resolve(), onerror: () => reject(new Error('구글 파일 선택 창을 불러오지 못했습니다')) });
    if ((window as any).gapi?.load) { done(); return; }
    const s = document.createElement('script');
    s.src = 'https://apis.google.com/js/api.js';
    s.async = true;
    s.onload = done;
    s.onerror = () => { pickerLoaded = null; reject(new Error('구글 스크립트를 불러오지 못했습니다')); };
    document.head.appendChild(s);
  });
  return pickerLoaded;
};

export interface PickedDoc { id: string; name: string; mimeType: string }

/** mode 'folder' = 폴더 1개 고르기, 'files' = parentId 폴더 안 파일 여러 개 고르기(허용) */
export const openDrivePicker = async (mode: 'folder' | 'files', parentId?: string): Promise<PickedDoc[] | null> => {
  if (!PICKER_API_KEY) throw new Error('구글 파일 선택 창용 API 키가 아직 설정되지 않았습니다');
  const [{ access_token, app_id }] = await Promise.all([call<{ access_token: string; app_id: string }>({ action: 'picker_token' }), loadPicker()]);
  const g = (window as any).google.picker;
  return new Promise((resolve) => {
    let view: any;
    if (mode === 'folder') {
      view = new g.DocsView(g.ViewId.FOLDERS).setIncludeFolders(true).setSelectFolderEnabled(true).setMimeTypes('application/vnd.google-apps.folder');
    } else {
      view = new g.DocsView(g.ViewId.DOCS).setIncludeFolders(false).setSelectFolderEnabled(false);
      if (parentId) view.setParent(parentId);
    }
    const b = new g.PickerBuilder()
      .addView(view)
      .setOAuthToken(access_token)
      .setDeveloperKey(PICKER_API_KEY)
      .setAppId(app_id)
      .setLocale('ko')
      .setTitle(mode === 'folder' ? '녹음을 보관할 폴더 고르기' : '리드마스터에서 열 기존 녹음 파일 고르기 (Ctrl+A로 전부)')
      .setCallback((d: any) => {
        if (d.action === g.Action.PICKED) resolve((d.docs || []).map((x: any) => ({ id: x.id, name: x.name, mimeType: x.mimeType })));
        else if (d.action === g.Action.CANCEL) resolve(null);
      });
    if (mode === 'files') b.enableFeature(g.Feature.MULTISELECT_ENABLED).setMaxItems(1000);
    b.build().setVisible(true);
  });
};

/** 연결 후 돌아왔을 때 주소의 drive=… 결과를 읽고 지운다 */
export const takeDriveReturnFlag = (): string | null => {
  const query = window.location.search || window.location.hash || '';
  const m = query.match(/[?&]drive=([a-z_]+)/);
  if (!m) return null;
  const clean = query.replace(/([?&])drive=[a-z_]+&?/, '$1').replace(/[?&]$/, '');
  window.history.replaceState(null, '', `${window.location.pathname}${clean}`);
  return m[1];
};

export const DRIVE_RETURN_MESSAGES: Record<string, { msg: string; type: 'success' | 'error' }> = {
  connected: { msg: '구글 드라이브를 연결했습니다. 이제 보관 폴더를 정하세요.', type: 'success' },
  cancel: { msg: '구글 드라이브 연결을 취소했습니다.', type: 'error' },
  expired: { msg: '연결 시간이 지났습니다. 다시 눌러 주세요.', type: 'error' },
  noscope: { msg: '드라이브 권한 체크를 빼고 허락하셨습니다. 다시 연결하면서 드라이브 항목을 체크하세요.', type: 'error' },
  norefresh: { msg: '구글이 장기 사용 권한을 주지 않았습니다. 구글 계정 → 보안 → 타사 앱에서 리드마스터를 삭제한 뒤 다시 연결하세요.', type: 'error' },
  forbidden: { msg: '회사 관리자만 연결할 수 있습니다.', type: 'error' },
  error: { msg: '구글 드라이브 연결에 실패했습니다. 잠시 뒤 다시 시도하세요.', type: 'error' },
};
