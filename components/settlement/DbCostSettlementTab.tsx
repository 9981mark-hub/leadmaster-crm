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
  batchQualityList,
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

  // 1. 공급사(Vendor) 고유 목록
  const vendors = useMemo(() => {
    const set = new Set<string>();
    batchQualityList.forEach(b => {
      if (b.vendorName) set.add(b.vendorName);
    });
    return Array.from(set);
  }, [batchQualityList]);

  // 2. 검색 및 필터링
  const filteredBatches = useMemo(() => {
    return batchQualityList.filter(b => {
      const matchSearch =
        b.batchName.toLowerCase().includes(searchTerm.toLowerCase()) ||
        b.vendorName.toLowerCase().includes(searchTerm.toLowerCase());
      const matchVendor = selectedVendor === 'all' || b.vendorName === selectedVendor;
      return matchSearch && matchVendor;
    });
  }, [batchQualityList, searchTerm, selectedVendor]);

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
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        {/* 총 DB 구매 비용 */}
        <div className="bg-slate-900/80 border border-slate-800 rounded-xl p-5 shadow-lg relative overflow-hidden">
          <div className="flex items-center justify-between mb-2">
            <span className="text-xs font-semibold text-slate-400 flex items-center gap-1.5">
              <Database className="w-4 h-4 text-rose-400" />
              총 DB 매입 원가
            </span>
            <span className="text-xs bg-rose-500/10 text-rose-400 px-2 py-0.5 rounded-full font-medium">
              변동 원가 (COGS)
            </span>
          </div>
          <div className="text-2xl font-black text-rose-400 tracking-tight">
            ₩{stats.totalCost.toLocaleString()}
          </div>
          <div className="mt-2 text-xs text-slate-400">
            총 {filteredBatches.length}개 배치 회차 매입분
          </div>
        </div>

        {/* 총 유입 리드 건수 */}
        <div className="bg-slate-900/80 border border-slate-800 rounded-xl p-5 shadow-lg">
          <div className="flex items-center justify-between mb-2">
            <span className="text-xs font-semibold text-slate-400 flex items-center gap-1.5">
              <Layers className="w-4 h-4 text-sky-400" />
              정상 유입 리드 총량
            </span>
            <span className="text-xs bg-sky-500/10 text-sky-400 px-2 py-0.5 rounded-full font-medium">
              유효 DB
            </span>
          </div>
          <div className="text-2xl font-black text-white tracking-tight">
            {stats.totalLeads.toLocaleString()} <span className="text-sm font-normal text-slate-400">건</span>
          </div>
          <div className="mt-2 text-xs text-slate-400">
            수임 성공: <strong className="text-indigo-400">{stats.totalContracts}건</strong>
          </div>
        </div>

        {/* 평균 리드 단가 (CPL) */}
        <div className="bg-slate-900/80 border border-slate-800 rounded-xl p-5 shadow-lg">
          <div className="flex items-center justify-between mb-2">
            <span className="text-xs font-semibold text-slate-400 flex items-center gap-1.5">
              <DollarSign className="w-4 h-4 text-amber-400" />
              평균 리드 단가 (CPL)
            </span>
            <span className="text-xs bg-amber-500/10 text-amber-300 px-2 py-0.5 rounded-full font-medium">
              건당 매입가
            </span>
          </div>
          <div className="text-2xl font-black text-amber-400 tracking-tight">
            ₩{stats.avgCpl.toLocaleString()}
          </div>
          <div className="mt-2 text-xs text-slate-400">
            전체 유입 리드 가중 평균
          </div>
        </div>

        {/* 매출 대비 DB 원가율 */}
        <div className="bg-slate-900/80 border border-slate-800 rounded-xl p-5 shadow-lg">
          <div className="flex items-center justify-between mb-2">
            <span className="text-xs font-semibold text-slate-400 flex items-center gap-1.5">
              <TrendingDown className="w-4 h-4 text-purple-400" />
              매출 대비 DB 원가율
            </span>
            <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${
              stats.costRatio > 40 ? 'bg-rose-500/10 text-rose-400' : 'bg-emerald-500/10 text-emerald-400'
            }`}>
              {stats.costRatio <= 30 ? '우수 (≤30%)' : '원가 주의'}
            </span>
          </div>
          <div className="text-2xl font-black text-purple-400 tracking-tight">
            {stats.costRatio}%
          </div>
          <div className="mt-2 text-xs text-slate-400">
            팀 관리 패널과 100% 실시간 연동
          </div>
        </div>
      </div>

      {/* 안내 알림 배너 */}
      <div className="bg-slate-900/50 border border-indigo-900/40 rounded-xl p-4 flex items-center justify-between text-xs text-indigo-300">
        <div className="flex items-center gap-2">
          <AlertCircle className="w-4 h-4 text-indigo-400 shrink-0" />
          <span>
            <strong>팀 관리 연동 안내:</strong> 본 대장의 DB 매입비용 및 단가는 <strong>[팀 관리 - 품질/회차 관리]</strong> 및 <strong>[DB 공급사(Vendor)]</strong> 테이블과 100% 직통 동기화되어 별도의 중복 입력이 불필요합니다.
          </span>
        </div>
        {onRefresh && (
          <button
            onClick={onRefresh}
            className="flex items-center gap-1 px-2.5 py-1 bg-indigo-950/80 hover:bg-indigo-900 border border-indigo-800 text-indigo-200 rounded text-xs transition-colors shrink-0"
          >
            <RefreshCw className="w-3 h-3" />
            새로고침
          </button>
        )}
      </div>

      {/* 2. 검색 및 컨트롤 바 */}
      <div className="flex flex-col sm:flex-row items-center justify-between gap-4 bg-slate-900/60 p-4 rounded-xl border border-slate-800">
        <div className="flex items-center gap-2.5 w-full sm:w-auto">
          <div className="relative w-full sm:w-64">
            <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
            <input
              type="text"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              placeholder="회차명 또는 공급사 검색..."
              className="w-full pl-9 pr-4 py-2 bg-slate-950 border border-slate-800 rounded-lg text-sm text-slate-200 placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-indigo-500"
            />
          </div>

          <select
            value={selectedVendor}
            onChange={(e) => setSelectedVendor(e.target.value)}
            className="bg-slate-950 border border-slate-800 text-slate-200 text-xs rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-indigo-500"
          >
            <option value="all">전체 공급사(Vendor)</option>
            {vendors.map(v => (
              <option key={v} value={v}>{v}</option>
            ))}
          </select>
        </div>

        <button
          onClick={handleExportExcel}
          className="flex items-center gap-1.5 px-3.5 py-2 bg-emerald-600/90 hover:bg-emerald-500 text-white text-xs font-semibold rounded-lg transition-all shadow-sm"
        >
          <Download className="w-3.5 h-3.5" />
          엑셀 다운로드
        </button>
      </div>

      {/* 3. 회차별 DB 매입 대장 테이블 */}
      <div className="bg-slate-900/80 border border-slate-800 rounded-xl overflow-hidden shadow-xl">
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse text-sm">
            <thead>
              <tr className="bg-slate-950/70 border-b border-slate-800 text-xs font-semibold text-slate-400">
                <th className="py-3.5 px-4">회차명 / 등록일시</th>
                <th className="py-3.5 px-4">공급사 (Vendor)</th>
                <th className="py-3.5 px-4 text-center">유입 리드수</th>
                <th className="py-3.5 px-4 text-right">매입 단가 (CPL)</th>
                <th className="py-3.5 px-4 text-right text-rose-400 font-bold">총 매입비용</th>
                <th className="py-3.5 px-4 text-center">수임 전환율</th>
                <th className="py-3.5 px-4 text-right">수임당 획득원가(CAC)</th>
                <th className="py-3.5 px-4 text-center">관리</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800/60 text-slate-200">
              {filteredBatches.length === 0 ? (
                <tr>
                  <td colSpan={8} className="py-12 text-center text-slate-500">
                    등록된 DB 배치 회차가 없거나 검색 조건과 일치하지 않습니다.
                  </td>
                </tr>
              ) : (
                filteredBatches.map((b) => (
                  <tr key={b.batchId} className="hover:bg-slate-800/40 transition-colors">
                    <td className="py-3.5 px-4">
                      <div className="font-semibold text-white">{b.batchName}</div>
                      <div className="text-xs text-slate-500">{b.createdAt?.slice(0, 10) || '-'}</div>
                    </td>
                    <td className="py-3.5 px-4">
                      <span className="px-2 py-0.5 bg-slate-800 text-slate-300 rounded text-xs border border-slate-700">
                        {b.vendorName || '미지정'}
                      </span>
                    </td>
                    <td className="py-3.5 px-4 text-center font-bold text-sky-400">
                      {b.inserted.toLocaleString()}건
                    </td>
                    <td className="py-3.5 px-4 text-right text-slate-300">
                      ₩{b.unitCost.toLocaleString()}
                    </td>
                    <td className="py-3.5 px-4 text-right font-extrabold text-rose-400">
                      ₩{b.totalCost.toLocaleString()}
                    </td>
                    <td className="py-3.5 px-4 text-center text-xs">
                      <span className="font-semibold text-emerald-400">{b.contractRate}%</span>
                      <span className="text-slate-500 ml-1">({b.contractedCount}건)</span>
                    </td>
                    <td className="py-3.5 px-4 text-right text-xs text-slate-300">
                      ₩{b.cac.toLocaleString()}
                    </td>
                    <td className="py-3.5 px-4 text-center">
                      <button
                        onClick={() => handleOpenEdit(b)}
                        className="px-2.5 py-1 bg-slate-800 hover:bg-slate-700 text-slate-200 rounded text-xs font-medium border border-slate-700 transition-colors inline-flex items-center gap-1"
                        title="단가 및 총비용 수정"
                      >
                        <Edit3 className="w-3 h-3 text-indigo-400" />
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
        <div className="fixed inset-0 z-50 bg-black/70 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-slate-900 border border-slate-800 rounded-2xl w-full max-w-md overflow-hidden shadow-2xl animate-in fade-in zoom-in-95 duration-200">
            <div className="flex items-center justify-between p-4 border-b border-slate-800 bg-slate-950">
              <h3 className="text-base font-bold text-white flex items-center gap-2">
                <Database className="w-4 h-4 text-indigo-400" />
                DB 매입비용 및 단가 수정
              </h3>
              <button
                onClick={() => setEditingBatch(null)}
                className="text-slate-400 hover:text-white"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="p-5 space-y-4 text-sm">
              <div>
                <label className="block text-xs font-semibold text-slate-400 mb-1">회차명</label>
                <div className="text-white font-medium bg-slate-950 px-3 py-2 rounded-lg border border-slate-800">
                  {editingBatch.batchName} ({editingBatch.inserted}건 유입)
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-400 mb-1">공급사 (Vendor)</label>
                <input
                  type="text"
                  value={editVendorName}
                  onChange={(e) => setEditVendorName(e.target.value)}
                  className="w-full px-3 py-2 bg-slate-950 border border-slate-800 rounded-lg text-white text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
                  placeholder="예: 페이스북 리드, 제휴사A"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-400 mb-1">리드 1건당 매입 단가 (원)</label>
                <input
                  type="number"
                  value={editUnitCost}
                  onChange={(e) => handleUnitCostChange(Number(e.target.value))}
                  className="w-full px-3 py-2 bg-slate-950 border border-slate-800 rounded-lg text-white text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
                  placeholder="0"
                />
                <p className="text-[11px] text-slate-500 mt-1">단가 입력 시 총 매입비용이 자동 환산됩니다.</p>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-400 mb-1">총 매입 비용 (원)</label>
                <input
                  type="number"
                  value={editTotalCost}
                  onChange={(e) => setEditTotalCost(Number(e.target.value))}
                  className="w-full px-3 py-2 bg-slate-950 border border-slate-800 rounded-lg text-rose-400 font-bold text-sm focus:outline-none focus:ring-2 focus:ring-rose-500"
                  placeholder="0"
                />
              </div>
            </div>

            <div className="p-4 border-t border-slate-800 bg-slate-950 flex items-center justify-end gap-2">
              <button
                onClick={() => setEditingBatch(null)}
                className="px-4 py-2 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-lg text-xs font-semibold transition-colors"
                disabled={isSaving}
              >
                취소
              </button>
              <button
                onClick={handleSaveCost}
                className="px-4 py-2 bg-indigo-600 hover:bg-indigo-500 text-white rounded-lg text-xs font-semibold transition-colors flex items-center gap-1.5 shadow-sm"
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
