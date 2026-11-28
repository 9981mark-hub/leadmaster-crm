// ==============================================================================
// services/faqService.ts
// 직급별 FAQ 조회 및 최고 서비스 관리자(isPlatformAdmin) 전용 등록·수정·삭제
// ==============================================================================
import { supabase } from './supabase';
import { FAQ_ITEMS, FaqItem } from '../data/faqData';
import { StandardRoleKey } from './org';
import { InquiryCategory } from './supportInquiryService';

const BUILTIN_IDS = new Set(FAQ_ITEMS.map(item => item.id));
const LOCAL_OVERRIDES_KEY = 'lm_faq_overrides_v1';

const mapRow = (row: any): FaqItem => ({
  id: row.id,
  roles: (Array.isArray(row.roles) && row.roles.length > 0
    ? row.roles
    : ['agent']) as StandardRoleKey[],
  category: row.category || '공통 안내',
  question: row.question || '',
  summary: row.summary || '',
  steps: Array.isArray(row.steps) ? row.steps.map(String) : [],
  tip: row.tip || undefined,
  warning: row.warning || undefined,
  relatedRoute:
    row.related_route_label && row.related_route_to
      ? { label: row.related_route_label, to: row.related_route_to }
      : undefined,
  inquiryCategory: (row.inquiry_category || 'account_auth') as InquiryCategory,
  tags: Array.isArray(row.tags) ? row.tags.map(String) : [],
  sortOrder: typeof row.sort_order === 'number' ? row.sort_order : 100,
  isActive: row.is_active !== false,
});

const readLocalOverrides = (): Record<string, FaqItem> => {
  try {
    const raw = localStorage.getItem(LOCAL_OVERRIDES_KEY);
    return raw ? JSON.parse(raw) : {};
  } catch {
    return {};
  }
};

const writeLocalOverrides = (map: Record<string, FaqItem>) => {
  try {
    localStorage.setItem(LOCAL_OVERRIDES_KEY, JSON.stringify(map));
  } catch { /* ignore */ }
};

/** 기본 내장 FAQ와 DB 커스텀/수정/삭제 내역을 병합해 최종 노출 목록을 반환 */
export const mergeFaqItems = (dbRows: FaqItem[]): FaqItem[] => {
  const dbMap = new Map<string, FaqItem>();
  dbRows.forEach(r => dbMap.set(r.id, r));

  const merged: FaqItem[] = [];

  // 1. 기본 내장 FAQ (DB에 수정본/비활성본이 있으면 우선 적용)
  FAQ_ITEMS.forEach((base, idx) => {
    const override = dbMap.get(base.id);
    if (override) {
      if (override.isActive !== false) {
        merged.push(override);
      }
      dbMap.delete(base.id);
    } else {
      merged.push({ ...base, sortOrder: base.sortOrder ?? (idx + 1) * 10, isActive: true });
    }
  });

  // 2. 최고 관리자가 새로 등록한 커스텀 FAQ
  dbMap.forEach(custom => {
    if (custom.isActive !== false) {
      merged.push(custom);
    }
  });

  return merged.sort((a, b) => (a.sortOrder ?? 100) - (b.sortOrder ?? 100));
};

export const fetchFaqItems = async (): Promise<FaqItem[]> => {
  if (supabase) {
    try {
      const { data, error } = await supabase
        .from('faq_items')
        .select('*')
        .order('sort_order', { ascending: true })
        .order('created_at', { ascending: true });

      if (!error && data) {
        return mergeFaqItems(data.map(mapRow));
      }
    } catch { /* fallback */ }
  }

  const localMap = readLocalOverrides();
  return mergeFaqItems(Object.values(localMap));
};

export interface SaveFaqInput {
  id?: string;
  roles: StandardRoleKey[];
  category: string;
  question: string;
  summary: string;
  steps: string[];
  tip?: string;
  warning?: string;
  relatedRoute?: { label: string; to: string };
  inquiryCategory: InquiryCategory;
  tags: string[];
  sortOrder?: number;
}

export const saveFaqItem = async (input: SaveFaqInput): Promise<FaqItem> => {
  const id =
    input.id ||
    (typeof crypto !== 'undefined' && crypto.randomUUID
      ? `faq-${crypto.randomUUID()}`
      : `faq-${Date.now()}`);
  const now = new Date().toISOString();

  const normalized: FaqItem = {
    id,
    roles: input.roles.length > 0 ? input.roles : ['agent'],
    category: input.category.trim(),
    question: input.question.trim(),
    summary: input.summary.trim(),
    steps: input.steps.map(s => s.trim()).filter(Boolean),
    tip: input.tip?.trim() || undefined,
    warning: input.warning?.trim() || undefined,
    relatedRoute:
      input.relatedRoute?.label && input.relatedRoute?.to
        ? { label: input.relatedRoute.label.trim(), to: input.relatedRoute.to.trim() }
        : undefined,
    inquiryCategory: input.inquiryCategory,
    tags: input.tags.map(t => t.trim()).filter(Boolean),
    sortOrder: typeof input.sortOrder === 'number' ? input.sortOrder : 50,
    isActive: true,
  };

  if (supabase) {
    const { data, error } = await supabase
      .from('faq_items')
      .upsert(
        {
          id: normalized.id,
          roles: normalized.roles,
          category: normalized.category,
          question: normalized.question,
          summary: normalized.summary,
          steps: normalized.steps,
          tip: normalized.tip ?? null,
          warning: normalized.warning ?? null,
          related_route_label: normalized.relatedRoute?.label ?? null,
          related_route_to: normalized.relatedRoute?.to ?? null,
          inquiry_category: normalized.inquiryCategory,
          tags: normalized.tags,
          sort_order: normalized.sortOrder ?? 50,
          is_active: true,
          updated_at: now,
        },
        { onConflict: 'id' }
      )
      .select('*')
      .single();

    if (error) {
      throw new Error(error.message);
    }
    if (data) return mapRow(data);
  }

  const localMap = readLocalOverrides();
  localMap[normalized.id] = normalized;
  writeLocalOverrides(localMap);
  return normalized;
};

export const deleteFaqItem = async (item: FaqItem): Promise<void> => {
  const now = new Date().toISOString();
  if (supabase) {
    if (BUILTIN_IDS.has(item.id)) {
      // 기본 내장 FAQ는 재노출되지 않도록 DB에 비활성(is_active=false) 마커 저장
      const { error } = await supabase.from('faq_items').upsert(
        {
          id: item.id,
          roles: item.roles,
          category: item.category,
          question: item.question,
          summary: item.summary,
          steps: item.steps,
          tip: item.tip ?? null,
          warning: item.warning ?? null,
          related_route_label: item.relatedRoute?.label ?? null,
          related_route_to: item.relatedRoute?.to ?? null,
          inquiry_category: item.inquiryCategory,
          tags: item.tags,
          sort_order: item.sortOrder ?? 100,
          is_active: false,
          updated_at: now,
        },
        { onConflict: 'id' }
      );
      if (error) throw new Error(error.message);
      return;
    }

    const { error } = await supabase.from('faq_items').delete().eq('id', item.id);
    if (error) throw new Error(error.message);
    return;
  }

  const localMap = readLocalOverrides();
  if (BUILTIN_IDS.has(item.id)) {
    localMap[item.id] = { ...item, isActive: false };
  } else {
    delete localMap[item.id];
  }
  writeLocalOverrides(localMap);
};

export const subscribeToFaqChanges = (onChange: () => void): (() => void) => {
  if (!supabase) return () => {};
  const channel = supabase
    .channel(`faq_items_realtime_${Date.now()}`)
    .on(
      'postgres_changes',
      { event: '*', schema: 'public', table: 'faq_items' },
      () => onChange()
    )
    .subscribe();

  return () => {
    supabase?.removeChannel(channel);
  };
};
