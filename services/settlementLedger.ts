// ============================================
// 정산: 거래처에서 받은 돈 기록 (settings key 'partnerCollections', 회사별 RLS)
// 저장 전에 서버 최신 값을 다시 읽어 합친다 (다른 기기에서 넣은 기록을 덮어쓰지 않게)
// ============================================
import { supabase, saveSettingToSupabase } from './supabase';
import { Collection } from '../utils/settlement';

export type { Collection };

const KEY = 'partnerCollections';
const LOCAL = 'lm_partner_collections';

const readLocal = (): Collection[] => {
  try { const v = JSON.parse(localStorage.getItem(LOCAL) || '[]'); return Array.isArray(v) ? v : []; } catch { return []; }
};
const writeLocal = (list: Collection[]) => { try { localStorage.setItem(LOCAL, JSON.stringify(list)); } catch { /* 용량 */ } };

export const fetchCollections = async (): Promise<Collection[]> => {
  if (!supabase) return readLocal();
  const { data, error } = await supabase.from('settings').select('value').eq('key', KEY).maybeSingle();
  if (error) { console.warn('[정산] 받은 돈 기록을 불러오지 못해 이 기기 사본을 씁니다', error.message); return readLocal(); }
  const list: Collection[] = Array.isArray(data?.value) ? data!.value : [];
  writeLocal(list);
  return list;
};

const persist = async (list: Collection[]) => {
  writeLocal(list);
  if (supabase) {
    const ok = await saveSettingToSupabase(KEY, list);
    if (!ok) throw new Error('서버에 저장하지 못했습니다. 인터넷 연결을 확인하고 다시 시도하세요.');
  }
};

export const addCollection = async (c: Omit<Collection, 'id' | 'createdAt'>): Promise<Collection[]> => {
  const latest = await fetchCollections();
  if (c.bankTxId && latest.some(x => x.bankTxId === c.bankTxId)) throw new Error('이 통장 입금은 이미 기록했습니다.');
  const row: Collection = { ...c, id: `col_${Date.now().toString(36)}${Math.random().toString(36).slice(2, 6)}`, createdAt: new Date().toISOString() };
  const next = [row, ...latest];
  await persist(next);
  return next;
};

export const deleteCollection = async (id: string): Promise<Collection[]> => {
  const latest = await fetchCollections();
  const next = latest.filter(x => x.id !== id);
  await persist(next);
  return next;
};
