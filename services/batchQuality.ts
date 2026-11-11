import { supabase } from './supabase';

export interface BatchQualityMetric {
  batchId: string;
  batchName: string;
  source: string;
  vendorName: string;
  fileName: string;
  createdAt: string;
  totalRows: number;
  inserted: number;
  duplicates: number;
  invalid: number;
  dncFiltered: number;
  unitCost: number;       // 리드 1건당 매입 단가 (원)
  totalCost: number;      // 총 매입 비용 (원)
  asClaimedCount: number; // A/S 청구 건수
  asRefundAmount: number; // A/S 환불 금액
  openCount: number;
  contactCount: number;
  contactRate: number;    // 연결률 (%)
  transferredCount: number;
  transferRate: number;   // 전달률 (%)
  contractedCount: number;
  contractRate: number;   // 계약 전환율 (%)
  totalRevenue: number;   // 총 수임료 매출 (원)
  revenuePerLead: number; // 리드당 유효 단가 (원)
  // 계산된 재무 지표
  grossProfit: number;    // 순이익 = totalRevenue - totalCost
  roas: number;           // 회수율 = (totalRevenue / totalCost) * 100
  roi: number;            // 투자수익률 = (grossProfit / totalCost) * 100
  cac: number;            // 계약 1건당 획득비용 = totalCost / contractedCount
}

export interface VendorSummaryStat {
  vendorName: string;
  batchCount: number;
  totalRows: number;
  totalInserted: number;
  totalCost: number;
  avgUnitCost: number;
  totalContacted: number;
  contactRate: number;
  totalTransferred: number;
  transferRate: number;
  totalContracted: number;
  contractRate: number;
  totalRevenue: number;
  grossProfit: number;
  roas: number;
  cac: number;
  badLeadsCount: number;
  badLeadsRate: number;
  grade: 'best' | 'good' | 'fair' | 'danger';
}

const need = () => {
  if (!supabase) throw new Error('Supabase가 설정되지 않았습니다');
  return supabase;
};

export const fetchBatchQualityStats = async (limit = 100): Promise<BatchQualityMetric[]> => {
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
      const unitCost = Number(r.unit_cost || 0);
      const totalCost = Number(r.total_cost || (unitCost > 0 ? inserted * unitCost : 0));
      const asClaimedCount = Number(r.as_claimed_count || 0);
      const asRefundAmount = Number(r.as_refund_amount || 0);

      const grossProfit = totalRevenue - totalCost;
      const roas = totalCost > 0 ? Number(((totalRevenue / totalCost) * 100).toFixed(1)) : (totalRevenue > 0 ? 999 : 0);
      const roi = totalCost > 0 ? Number(((grossProfit / totalCost) * 100).toFixed(1)) : 0;
      const cac = contractedCount > 0 ? Math.round(totalCost / contractedCount) : (totalCost > 0 ? totalCost : 0);

      return {
        batchId: r.batch_id,
        batchName: r.batch_name || '이름 없음',
        source: r.source || '직접 등록/미지정',
        vendorName: r.vendor_name || r.source || '직접 등록/미지정',
        fileName: r.file_name || '-',
        createdAt: r.created_at,
        totalRows: Number(r.total_rows || 0),
        inserted,
        duplicates: Number(r.duplicates || 0),
        invalid: Number(r.invalid || 0),
        dncFiltered: Number(r.dnc_filtered || 0),
        unitCost,
        totalCost,
        asClaimedCount,
        asRefundAmount,
        openCount: Number(r.open_count || 0),
        contactCount,
        contactRate: inserted > 0 ? Number(((contactCount / inserted) * 100).toFixed(1)) : 0,
        transferredCount,
        transferRate: inserted > 0 ? Number(((transferredCount / inserted) * 100).toFixed(1)) : 0,
        contractedCount,
        contractRate: inserted > 0 ? Number(((contractedCount / inserted) * 100).toFixed(2)) : 0,
        totalRevenue,
        revenuePerLead: inserted > 0 ? Math.round(totalRevenue / inserted) : 0,
        grossProfit,
        roas,
        roi,
        cac,
      };
    });
  } catch (e: any) {
    console.error('[BatchQuality] fetchBatchQualityStats error:', e);
    return [];
  }
};

// 회차별 매입 단가 / 총액 / 거래처명 수정 저장
export const updateBatchCost = async (
  batchId: string,
  unitCost: number,
  totalCost: number,
  vendorName?: string
): Promise<void> => {
  const sb = need();
  // 1. RPC 호출 시도
  const { error } = await sb.rpc('update_batch_cost', {
    p_batch_id: batchId,
    p_unit_cost: unitCost,
    p_total_cost: totalCost,
    p_vendor_name: vendorName || null
  });

  if (error) {
    // 2. RPC 없을 시 직접 UPDATE 폴백
    console.warn('[BatchQuality] update_batch_cost RPC fallback to direct update:', error.message);
    const updates: any = {
      unit_cost: unitCost,
      total_cost: totalCost > 0 ? totalCost : (unitCost > 0 ? unitCost : 0),
    };
    if (vendorName) {
      updates.vendor_name = vendorName;
      updates.source = vendorName;
    }
    const { error: directErr } = await sb
      .from('lead_import_batches')
      .update(updates)
      .eq('id', batchId);
    if (directErr) throw directErr;
  }
};

// 거래처(공급사) 단위 종합 집계 계산
export const computeVendorStats = (batches: BatchQualityMetric[]): VendorSummaryStat[] => {
  const map = new Map<string, BatchQualityMetric[]>();

  batches.forEach(b => {
    const key = (b.vendorName || b.source || '직접 등록/미지정').trim();
    if (!map.has(key)) map.set(key, []);
    map.get(key)!.push(b);
  });

  const list: VendorSummaryStat[] = [];

  map.forEach((bList, vName) => {
    const batchCount = bList.length;
    const totalRows = bList.reduce((s, b) => s + b.totalRows, 0);
    const totalInserted = bList.reduce((s, b) => s + b.inserted, 0);
    const totalCost = bList.reduce((s, b) => s + b.totalCost, 0);
    const totalContacted = bList.reduce((s, b) => s + b.contactCount, 0);
    const totalTransferred = bList.reduce((s, b) => s + b.transferredCount, 0);
    const totalContracted = bList.reduce((s, b) => s + b.contractedCount, 0);
    const totalRevenue = bList.reduce((s, b) => s + b.totalRevenue, 0);
    const badLeadsCount = bList.reduce((s, b) => s + b.duplicates + b.invalid + b.dncFiltered, 0);

    const contactRate = totalInserted > 0 ? Number(((totalContacted / totalInserted) * 100).toFixed(1)) : 0;
    const transferRate = totalInserted > 0 ? Number(((totalTransferred / totalInserted) * 100).toFixed(1)) : 0;
    const contractRate = totalInserted > 0 ? Number(((totalContracted / totalInserted) * 100).toFixed(2)) : 0;
    const badLeadsRate = totalRows > 0 ? Number(((badLeadsCount / totalRows) * 100).toFixed(1)) : 0;
    const avgUnitCost = totalInserted > 0 ? Math.round(totalCost / totalInserted) : 0;

    const grossProfit = totalRevenue - totalCost;
    const roas = totalCost > 0 ? Number(((totalRevenue / totalCost) * 100).toFixed(1)) : (totalRevenue > 0 ? 999 : 0);
    const cac = totalContracted > 0 ? Math.round(totalCost / totalContracted) : totalCost;

    // 등급 판정:
    // best: ROAS 250% 이상 & 연결률 45% 이상
    // good: ROAS 150% 이상 or 계약전환율 2% 이상
    // danger: totalCost > 0 이고 ROAS < 90% 이거나 불량률 25% 초과
    let grade: 'best' | 'good' | 'fair' | 'danger' = 'fair';
    if (roas >= 250 && contactRate >= 45) {
      grade = 'best';
    } else if (roas >= 150 || contractRate >= 2.0) {
      grade = 'good';
    } else if (totalCost > 0 && (roas < 90 || badLeadsRate >= 25)) {
      grade = 'danger';
    }

    list.push({
      vendorName: vName,
      batchCount,
      totalRows,
      totalInserted,
      totalCost,
      avgUnitCost,
      totalContacted,
      contactRate,
      totalTransferred,
      transferRate,
      totalContracted,
      contractRate,
      totalRevenue,
      grossProfit,
      roas,
      cac,
      badLeadsCount,
      badLeadsRate,
      grade,
    });
  });

  // 순익 높은 순 정렬
  return list.sort((a, b) => b.grossProfit - a.grossProfit);
};
