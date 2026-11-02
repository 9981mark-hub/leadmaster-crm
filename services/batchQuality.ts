import { supabase } from './supabase';

export interface BatchQualityMetric {
  batchId: string;
  batchName: string;
  source: string;
  fileName: string;
  createdAt: string;
  totalRows: number;
  inserted: number;
  duplicates: number;
  invalid: number;
  dncFiltered: number;
  openCount: number;
  contactCount: number;
  contactRate: number;      // 연결률 (%)
  transferredCount: number;
  transferRate: number;     // 전달률 (%)
  contractedCount: number;
  contractRate: number;     // 계약 전환율 (%)
  totalRevenue: number;     // 총 수임료 매출
  revenuePerLead: number;   // 리드당 유효 단가
}

const need = () => {
  if (!supabase) throw new Error('Supabase가 설정되지 않았습니다');
  return supabase;
};

export const fetchBatchQualityStats = async (limit = 30): Promise<BatchQualityMetric[]> => {
  try {
    const { data, error } = await need().rpc('get_batch_quality_stats', { p_limit: limit });
    if (error) {
      console.warn('[BatchQuality] RPC failed, falling back to basic batches:', error.message);
      return [];
    }
    return (data || []).map((r: any) => {
      const inserted = Number(r.inserted || 0);
      const contactCount = Number(r.contact_count || 0);
      const transferredCount = Number(r.transferred_count || 0);
      const contractedCount = Number(r.contracted_count || 0);
      const totalRevenue = Number(r.total_revenue || 0);

      return {
        batchId: r.batch_id,
        batchName: r.batch_name || '이름 없음',
        source: r.source || '직접 업로드',
        fileName: r.file_name || '-',
        createdAt: r.created_at,
        totalRows: Number(r.total_rows || 0),
        inserted,
        duplicates: Number(r.duplicates || 0),
        invalid: Number(r.invalid || 0),
        dncFiltered: Number(r.dnc_filtered || 0),
        openCount: Number(r.open_count || 0),
        contactCount,
        contactRate: inserted > 0 ? Number(((contactCount / inserted) * 100).toFixed(1)) : 0,
        transferredCount,
        transferRate: inserted > 0 ? Number(((transferredCount / inserted) * 100).toFixed(1)) : 0,
        contractedCount,
        contractRate: inserted > 0 ? Number(((contractedCount / inserted) * 100).toFixed(2)) : 0,
        totalRevenue,
        revenuePerLead: inserted > 0 ? Math.round(totalRevenue / inserted) : 0,
      };
    });
  } catch (e: any) {
    console.error('[BatchQuality] fetchBatchQualityStats error:', e);
    return [];
  }
};
