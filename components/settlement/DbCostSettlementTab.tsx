import React, { useState, useMemo } from 'react';
import { BatchQualityMetric, updateBatchCost } from '../../services/batchQuality';
import { Database, DollarSign, TrendingDown, Layers, Search, Download, Edit3, X, Check, RefreshCw, AlertCircle } from 'lucide-react';
import { useToast } from '../../contexts/ToastContext';
import * as XLSX from 'xlsx';

interface DbCostSettlementTabProps {
  batchQualityList: BatchQualityMetric[];
  onRefresh?: () => void;
  totalRevenueWon?: number;
}

export default function DbCostSettlementTab({
  batchQualityList = [],
  onRefresh,
  totalRevenueWon = 0,
}: DbCostSettlementTabProps) {
  const { showToast } = useToast();
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedVendor, setSelectedVendor] = useState<string>('all');
  const [editingBatch, setEditingBatch] = useState<BatchQualityMetric | null>(null);
  const [editUnitCost, setEditUnitCost] = useState<number>(0);
  const [editTotalCost, setEditTotalCost] = useState<number>(0);
  const [editVendorName, setEditVendorName] = useState<string>('');
  const [isSaving, setIsSaving] = useState(false);

  const safeBatches = useMemo(() => Array.isArray(batchQualityList) ? batchQualityList : [], [batchQualityList]);

  // 1. 공급사(Vendor) 고유 목록
  const vendors = useMemo(() => {
    const set = new Set<string>();
    safeBatches.forEach(b => {
      if (b.vendorName) set.add(b.vendorName);
    });
    return Array.from(set);
  }, [safeBatches]);

  // 2. 검색 및 필터링
  const filteredBatches = useMemo(() => {
    return safeBatches.filter(b => {
      const matchSearch =
        (b.batchName || '').toLowerCase().includes(searchTerm.toLowerCase()) ||
        (b.vendorName || '').toLowerCase().includes(searchTerm.toLowerCase());
      const matchVendor = selectedVendor === 'all' || b.vendorName === selectedVendor;
      return matchSearch && matchVendor;
    });
  }, [safeBatches, searchTerm, selectedVendor]);

  // 3. 상단 핵심 KPI 집계
  const stats = useMemo(() => {
    const totalCost = filteredBatches.reduce((sum, b) => sum + (b.totalCost || 0), 0);
    const totalLeads = filteredBatches.reduce((sum, b) => sum + (b.inserted || 0), 0);
    const avgCpl = totalLeads > 0 ? Math.round(totalCost / totalLeads) : 0;
    const totalContracts = filteredBatches.reduce((sum, b) => sum + (b.contractedCount || 0), 0);
    const totalBatchRevenue = filteredBatches.reduce((sum, b) => sum + (b.totalRevenue || 0), 0);
    const costRatio = totalRevenueWon > 0
      ? Number(((totalCost / totalRevenueWon) * 100).toFixed(1))
      : (totalBatchRevenue > 0 ? Number(((totalCost / totalBatchRevenue) * 100).toFixed(1)) : 0);

    return {
      totalCost,
      totalLeads,
      avgCpl,
      totalContracts,
      costRatio,
    };
  }, [filteredBatches, totalRevenueWon]);

  // 수정 모달 열기
  const handleOpenEdit = (batch: BatchQualityMetric) => {
    setEditingBatch(batch);
    setEditUnitCost(batch.unitCost || 0);
    setEditTotalCost(batch.totalCost || 0);
    setEditVendorName(batch.vendorName || '');
  };

  // 단가 변경 시 총액 자동 계산
  const handleUnitCostChange = (val: number) => {
    setEditUnitCost(val);
    if (editingBatch && editingBatch.inserted > 0) {
      setEditTotalCost(val * editingBatch.inserted);
    }
  };

  // 저장 처리 (팀 관리 import_batches와 100% 동일 테이블 갱신)
  const handleSaveCost = async () => {
    if (!editingBatch) return;
    setIsSaving(true);
    try {
      await updateBatchCost(
        editingBatch.batchId,
        editUnitCost,
        editTotalCost,
        editVendorName
      );
      showToast('DB 매입 비용 정보가 성공적으로 반영되었습니다. (팀 관리 자동 동기화)', 'success');
      setEditingBatch(null);
      if (onRefresh) onRefresh();
    } catch (err: any) {
      showToast('저장 중 오류가 발생했습니다: ' + (err.message || '알 수 없는 오류'), 'error');
    } finally {
      setIsSaving(false);
    }
  };

  // 엑셀 다운로드
  const handleExportExcel = () => {
    const exportData = filteredBatches.map(b => ({
      '회차명': b.batchName,
      '공급사(Vendor)': b.vendorName,
      '등록일시': b.createdAt?.slice(0, 10),
      '유입 리드수': b.inserted,
      '리드 단가(원)': b.unitCost,
      '총 매입비용(원)': b.totalCost,
      '수임 건수': b.contractedCount,
      '전환율(%)': b.contractRate,
      '수임당 획득원가(CAC)': b.cac,
    }));

    const ws = XLSX.utils.json_to_sheet(exportData);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'DB구매원가정산');
    XLSX.writeFile(wb, `DB_구매비용_원가대장_${new Date().toISOString().slice(0, 10)}.xlsx`);
  };

  return (
    <div className="space-y-6">
      {/* 1. 상단 KPI 전광판 */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {/* 총 DB 구매 비용 */}
        <div className="bg-card text-card-foreground p-5 rounded-xl border border-border shadow-2xs flex flex-col justify-between hover:border-primary/40 transition-all card-interactive">
          <div>
            <div className="flex items-center justify-between text-xs text-muted-foreground font-medium mb-1.5">
              <span className="flex items-center gap-1.5">
                <Database className="w-3.5 h-3.5 text-primary" strokeWidth={1.75} />
                총 DB 매입 원가
              </span>
              <span className="text-[11px] px-2 py-0.5 rounded-full font-semibold bg-muted text-muted-foreground border border-border">
                변동 원가 (COGS)
              </span>
            </div>
            <div className="flex items-baseline gap-1.5">
              <span className="text-2xl font-bold text-foreground font-mono tabular-nums tracking-tight">
                ₩ {stats.totalCost.toLocaleString()}
              </span>
              <span className="text-xs font-semibold text-muted-foreground">원</span>
            </div>
          </div>
          <div className="mt-2.5 text-xs text-muted-foreground font-normal">
            총 {filteredBatches.length}개 배치 회차 매입분
          </div>
        </div>

        {/* 총 유입 리드 건수 */}
        <div className="bg-card text-card-foreground p-5 rounded-xl border border-border shadow-2xs flex flex-col justify-between hover:border-primary/40 transition-all card-interactive">
          <div>
            <div className="flex items-center justify-between text-xs text-muted-foreground font-medium mb-1.5">
              <span className="flex items-center gap-1.5">
                <Layers className="w-3.5 h-3.5 text-primary" strokeWidth={1.75} />
                정상 유입 리드 총량
              </span>
              <span className="text-[11px] px-2 py-0.5 rounded-full font-semibold bg-muted text-muted-foreground border border-border">
                유효 DB
              </span>
            </div>
            <div className="text-2xl font-bold text-foreground font-mono tabular-nums tracking-tight">
              {stats.totalLeads.toLocaleString()} <span className="text-xs font-normal text-muted-foreground">건</span>
            </div>
          </div>
          <div className="mt-2.5 text-xs text-muted-foreground font-normal">
            수임 성공: <strong className="text-foreground font-mono font-semibold">{stats.totalContracts}건</strong>
          </div>
        </div>

        {/* 평균 리드 단가 (CPL) */}
        <div className="bg-card text-card-foreground p-5 rounded-xl border border-border shadow-2xs flex flex-col justify-between hover:border-primary/40 transition-all card-interactive">
          <div>
            <div className="flex items-center justify-between text-xs text-muted-foreground font-medium mb-1.5">
              <span className="flex items-center gap-1.5">
                <DollarSign className="w-3.5 h-3.5 text-primary" strokeWidth={1.75} />
                평균 리드 단가 (CPL)
              </span>
              <span className="text-[11px] px-2 py-0.5 rounded-full font-semibold bg-muted text-muted-foreground border border-border">
                건당 매입가
              </span>
            </div>
            <div className="flex items-baseline gap-1.5">
              <span className="text-2xl font-bold text-foreground font-mono tabular-nums tracking-tight">
                ₩ {stats.avgCpl.toLocaleString()}
              </span>
              <span className="text-xs font-semibold text-muted-foreground">원</span>
            </div>
          </div>
          <div className="mt-2.5 text-xs text-muted-foreground font-normal">
            전체 유입 리드 가중 평균
          </div>
        </div>

        {/* 매출 대비 DB 원가율 */}
        <div className="bg-card text-card-foreground p-5 rounded-xl border border-border shadow-2xs flex flex-col justify-between hover:border-primary/40 transition-all card-interactive">
          <div>
            <div className="flex items-center justify-between text-xs text-muted-foreground font-medium mb-1.5">
              <span className="flex items-center gap-1.5">
                <TrendingDown className="w-3.5 h-3.5 text-primary" strokeWidth={1.75} />
                매출 대비 DB 원가율
              </span>
              <span className={`text-[11px] px-2 py-0.5 rounded-full font-semibold ${
                stats.costRatio > 40
                  ? 'bg-destructive/10 text-destructive border border-destructive/20'
                  : 'bg-primary/10 text-primary border border-primary/20'
              }`}>
                {stats.costRatio <= 30 ? '우수 (≤30%)' : '원가 주의'}
              </span>
            </div>
            <div className={`text-2xl font-bold font-mono tabular-nums tracking-tight ${
              stats.costRatio > 40 ? 'text-destructive' : 'text-primary'
            }`}>
              {stats.costRatio}%
            </div>
          </div>
          <div className="mt-2.5 text-xs text-muted-foreground font-normal">
            팀 관리 패널과 100% 실시간 연동
          </div>
        </div>
      </div>

      {/* 안내 알림 배너 */}
      <div className="bg-card border border-border rounded-xl p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-xs text-muted-foreground shadow-2xs">
        <div className="flex items-center gap-2">
          <AlertCircle className="w-4 h-4 text-primary shrink-0" strokeWidth={1.75} />
          <span>
            <strong className="text-foreground">팀 관리 연동 안내:</strong> 본 대장의 DB 매입비용 및 단가는 <strong className="text-foreground">[팀 관리 - 품질/회차 관리]</strong> 및 <strong className="text-foreground">[DB 공급사(Vendor)]</strong> 테이블과 100% 직통 동기화되어 별도의 중복 입력이 불필요합니다.
          </span>
        </div>
        {onRefresh && (
          <button
            onClick={onRefresh}
            className="flex items-center gap-1.5 px-3 py-1.5 bg-muted/60 hover:bg-muted text-foreground border border-border rounded-lg text-xs font-semibold transition-colors shrink-0 cursor-pointer shadow-2xs"
          >
            <RefreshCw className="w-3 h-3" />
            새로고침
          </button>
        )}
      </div>

      {/* 2. 검색 및 컨트롤 바 */}
      <div className="flex flex-col sm:flex-row items-center justify-between gap-3 bg-card p-4 rounded-xl border border-border shadow-2xs">
        <div className="flex items-center gap-2.5 w-full sm:w-auto">
          <div className="relative w-full sm:w-64">
            <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" strokeWidth={1.75} />
            <input
              type="text"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              placeholder="회차명 또는 공급사 검색..."
              className="w-full pl-9 pr-4 py-2 bg-muted/40 border border-border rounded-lg text-xs font-mono text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-primary"
            />
          </div>

          <select
            value={selectedVendor}
            onChange={(e) => setSelectedVendor(e.target.value)}
            className="bg-muted/40 border border-border text-foreground text-xs rounded-lg px-3 py-2 focus:outline-none focus:ring-1 focus:ring-primary font-mono cursor-pointer"
          >
            <option value="all">전체 공급사(Vendor)</option>
            {vendors.map(v => (
              <option key={v} value={v}>{v}</option>
            ))}
          </select>
        </div>

        <button
          onClick={handleExportExcel}
          className="flex items-center gap-1.5 px-3.5 py-2 bg-primary hover:bg-primary/90 text-primary-foreground text-xs font-semibold rounded-lg transition-all shadow-2xs cursor-pointer"
        >
          <Download className="w-3.5 h-3.5" strokeWidth={1.75} />
          엑셀 다운로드
        </button>
      </div>

      {/* 3. 회차별 DB 매입 대장 테이블 */}
      <div className="bg-card border border-border rounded-xl overflow-hidden shadow-2xs">
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse text-xs">
            <thead>
              <tr className="bg-muted/40 border-b border-border text-muted-foreground font-mono font-medium">
                <th className="py-3 px-4">회차명 / 등록일시</th>
                <th className="py-3 px-4">공급사 (Vendor)</th>
                <th className="py-3 px-4 text-center">유입 리드수</th>
                <th className="py-3 px-4 text-right">매입 단가 (CPL)</th>
                <th className="py-3 px-4 text-right text-foreground font-semibold">총 매입비용</th>
                <th className="py-3 px-4 text-center">수임 전환율</th>
                <th className="py-3 px-4 text-right">수임당 획득원가(CAC)</th>
                <th className="py-3 px-4 text-center">관리</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border/60 text-foreground">
              {filteredBatches.length === 0 ? (
                <tr>
                  <td colSpan={8} className="py-12 text-center text-muted-foreground font-mono text-xs">
                    등록된 DB 배치 회차가 없거나 검색 조건과 일치하지 않습니다.
                  </td>
                </tr>
              ) : (
                filteredBatches.map((b) => (
                  <tr key={b.batchId} className="hover:bg-muted/40 transition-colors">
                    <td className="py-3 px-4">
                      <div className="font-semibold text-foreground">{b.batchName}</div>
                      <div className="text-2xs text-muted-foreground font-mono">{b.createdAt?.slice(0, 10) || '-'}</div>
                    </td>
                    <td className="py-3 px-4">
                      <span className="px-2 py-0.5 bg-muted/60 text-muted-foreground rounded text-2xs font-mono border border-border">
                        {b.vendorName || '미지정'}
                      </span>
                    </td>
                    <td className="py-3 px-4 text-center font-mono font-medium text-foreground">
                      {b.inserted.toLocaleString()}건
                    </td>
                    <td className="py-3 px-4 text-right text-muted-foreground font-mono">
                      ₩ {b.unitCost.toLocaleString()}
                    </td>
                    <td className="py-3 px-4 text-right font-bold text-foreground font-mono tabular-nums">
                      ₩ {b.totalCost.toLocaleString()}
                    </td>
                    <td className="py-3 px-4 text-center text-xs">
                      <span className="font-semibold text-primary font-mono">{b.contractRate}%</span>
                      <span className="text-muted-foreground ml-1 font-mono">({b.contractedCount}건)</span>
                    </td>
                    <td className="py-3 px-4 text-right text-xs text-muted-foreground font-mono">
                      ₩ {b.cac.toLocaleString()}
                    </td>
                    <td className="py-3 px-4 text-center">
                      <button
                        onClick={() => handleOpenEdit(b)}
                        className="px-2.5 py-1 bg-muted/60 hover:bg-muted text-foreground rounded text-2xs font-mono font-medium border border-border transition-colors inline-flex items-center gap-1 cursor-pointer"
                        title="단가 및 총비용 수정"
                      >
                        <Edit3 className="w-3 h-3 text-primary" strokeWidth={1.75} />
                        수정
                      </button>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* 4. 단가/비용 수정 모달 */}
      {editingBatch && (
        <div className="fixed inset-0 z-50 bg-black/70 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-card border border-border rounded-2xl w-full max-w-md overflow-hidden shadow-2xl animate-in fade-in zoom-in-95 duration-150 text-foreground">
            <div className="flex items-center justify-between p-4 border-b border-border bg-muted/30">
              <h3 className="text-sm font-bold text-foreground flex items-center gap-2">
                <Database className="w-4 h-4 text-primary" strokeWidth={1.75} />
                DB 매입비용 및 단가 수정
              </h3>
              <button
                onClick={() => setEditingBatch(null)}
                className="text-muted-foreground hover:text-foreground cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="p-5 space-y-4 text-xs">
              <div>
                <label className="block text-2xs font-mono text-muted-foreground mb-1">회차명</label>
                <div className="text-foreground font-medium bg-muted/40 px-3 py-2 rounded-lg border border-border font-mono">
                  {editingBatch.batchName} ({editingBatch.inserted}건 유입)
                </div>
              </div>

              <div>
                <label className="block text-2xs font-mono text-muted-foreground mb-1">공급사 (Vendor)</label>
                <input
                  type="text"
                  value={editVendorName}
                  onChange={(e) => setEditVendorName(e.target.value)}
                  className="w-full px-3 py-2 bg-muted/40 border border-border rounded-lg text-foreground font-mono text-xs focus:outline-none focus:ring-1 focus:ring-primary"
                  placeholder="예: 페이스북 리드, 제휴사A"
                />
              </div>

              <div>
                <label className="block text-2xs font-mono text-muted-foreground mb-1">리드 1건당 매입 단가 (원)</label>
                <input
                  type="number"
                  value={editUnitCost}
                  onChange={(e) => handleUnitCostChange(Number(e.target.value))}
                  className="w-full px-3 py-2 bg-muted/40 border border-border rounded-lg text-foreground font-mono text-xs focus:outline-none focus:ring-1 focus:ring-primary"
                  placeholder="0"
                />
                <p className="text-2xs text-muted-foreground mt-1 font-mono">단가 입력 시 총 매입비용이 자동 환산됩니다.</p>
              </div>

              <div>
                <label className="block text-2xs font-mono text-muted-foreground mb-1">총 매입 비용 (원)</label>
                <input
                  type="number"
                  value={editTotalCost}
                  onChange={(e) => setEditTotalCost(Number(e.target.value))}
                  className="w-full px-3 py-2 bg-muted/40 border border-border rounded-lg text-primary font-bold font-mono text-xs focus:outline-none focus:ring-1 focus:ring-primary"
                  placeholder="0"
                />
              </div>
            </div>

            <div className="p-4 border-t border-border bg-muted/30 flex items-center justify-end gap-2">
              <button
                onClick={() => setEditingBatch(null)}
                className="px-4 py-2 bg-muted/60 hover:bg-muted text-muted-foreground hover:text-foreground rounded-lg text-xs font-semibold transition-colors cursor-pointer"
                disabled={isSaving}
              >
                취소
              </button>
              <button
                onClick={handleSaveCost}
                className="px-4 py-2 bg-primary hover:bg-primary/90 text-primary-foreground rounded-lg text-xs font-semibold transition-colors flex items-center gap-1.5 shadow-2xs cursor-pointer"
                disabled={isSaving}
              >
                {isSaving ? (
                  <>
                    <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                    저장 중...
                  </>
                ) : (
                  <>
                    <Check className="w-3.5 h-3.5" />
                    저장 (팀 관리 동기화)
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
