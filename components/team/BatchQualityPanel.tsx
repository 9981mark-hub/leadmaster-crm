import React, { useEffect, useState, useCallback, useMemo } from 'react';
import {
  Layers, RefreshCw, TrendingUp, PhoneCall, Send, Award, DollarSign,
  AlertTriangle, FileSpreadsheet, Building2, Crown, CheckCircle2,
  Copy, Download, Edit3, X, ArrowUpRight, ShieldAlert, BadgePercent,
  Search, Filter, ChevronRight, Sparkles, Plus
} from 'lucide-react';
import {
  fetchBatchQualityStats, updateBatchCost, computeVendorStats,
  BatchQualityMetric, VendorSummaryStat
} from '../../services/batchQuality';
import { retroactiveBatchExistingLeads } from '../../services/vendor';
import { VendorManageModal } from './VendorManageModal';
import { useToast } from '../../contexts/ToastContext';

export default function BatchQualityPanel() {
  const { showToast } = useToast();
  const [batches, setBatches] = useState<BatchQualityMetric[]>([]);
  const [loading, setLoading] = useState(true);

  // 뷰 모드: 'vendor' (거래처별 랭킹) | 'batch' (회차별 상세)
  const [activeTab, setActiveTab] = useState<'vendor' | 'batch'>('vendor');
  const [searchKeyword, setSearchKeyword] = useState('');
  const [gradeFilter, setGradeFilter] = useState<string>('all');

  // 모달 상태
  const [isVendorModalOpen, setIsVendorModalOpen] = useState(false);
  const [isRetroactiveLoading, setIsRetroactiveLoading] = useState(false);
  const [editingBatch, setEditingBatch] = useState<BatchQualityMetric | null>(null);
  const [editUnitCost, setEditUnitCost] = useState<number>(0);
  const [editTotalCost, setEditTotalCost] = useState<number>(0);
  const [editVendorName, setEditVendorName] = useState<string>('');
  const [savingCost, setSavingCost] = useState(false);

  // A/S 환불 명세서 모달
  const [asVendor, setAsVendor] = useState<VendorSummaryStat | null>(null);
  const [asBatch, setAsBatch] = useState<BatchQualityMetric | null>(null);

  const loadData = useCallback(async () => {
    setLoading(true);
    try {
      const data = await fetchBatchQualityStats(100);
      setBatches(data);
    } catch (e: any) {
      console.error(e);
      showToast('DB 품질 및 성과 데이터를 불러오지 못했습니다.', 'error');
    } finally {
      setLoading(false);
    }
  }, [showToast]);

  const handleRetroactiveBatch = async () => {
    if (!window.confirm('기존에 등록되어 있으나 회차(Batch)가 지정되지 않은 과거 고객 DB들을\n유입경로 및 등록 월별로 묶어 실시간 회차 통계로 변환할까요?')) return;
    setIsRetroactiveLoading(true);
    try {
      const res = await retroactiveBatchExistingLeads();
      if (res.casesLinked > 0) {
        showToast(`과거 데이터 ${res.casesLinked.toLocaleString()}건을 ${res.batchesCreated}개 회차로 성공적으로 묶었습니다!`, 'success');
      } else {
        showToast('소급 묶음화할 미회차 과거 데이터가 없습니다.', 'info');
      }
      await loadData();
    } catch (err: any) {
      showToast(err.message || '소급 묶음 실패', 'error');
    } finally {
      setIsRetroactiveLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, [loadData]);

  // 거래처별 집계 데이터
  const vendorStats = useMemo(() => {
    return computeVendorStats(batches);
  }, [batches]);

  // 전체 통계 집계
  const totals = useMemo(() => {
    const totalRows = batches.reduce((acc, b) => acc + b.totalRows, 0);
    const totalInserted = batches.reduce((acc, b) => acc + b.inserted, 0);
    const totalCost = batches.reduce((acc, b) => acc + b.totalCost, 0);
    const totalContacted = batches.reduce((acc, b) => acc + b.contactCount, 0);
    const totalTransferred = batches.reduce((acc, b) => acc + b.transferredCount, 0);
    const totalContracted = batches.reduce((acc, b) => acc + b.contractedCount, 0);
    const totalRevenue = batches.reduce((acc, b) => acc + b.totalRevenue, 0);
    const totalBadLeads = batches.reduce((acc, b) => acc + b.duplicates + b.invalid + b.dncFiltered, 0);

    const overallContactRate = totalInserted > 0 ? Number(((totalContacted / totalInserted) * 100).toFixed(1)) : 0;
    const overallTransferRate = totalInserted > 0 ? Number(((totalTransferred / totalInserted) * 100).toFixed(1)) : 0;
    const overallContractRate = totalInserted > 0 ? Number(((totalContracted / totalInserted) * 100).toFixed(2)) : 0;

    const grossProfit = totalRevenue - totalCost;
    const roas = totalCost > 0 ? Number(((totalRevenue / totalCost) * 100).toFixed(1)) : (totalRevenue > 0 ? 999 : 0);
    const avgCpl = totalInserted > 0 ? Math.round(totalCost / totalInserted) : 0;
    const cac = totalContracted > 0 ? Math.round(totalCost / totalContracted) : totalCost;

    return {
      totalRows,
      totalInserted,
      totalCost,
      avgCpl,
      totalContacted,
      overallContactRate,
      totalTransferred,
      overallTransferRate,
      totalContracted,
      overallContractRate,
      totalRevenue,
      grossProfit,
      roas,
      cac,
      totalBadLeads,
      overallRevenuePerLead: totalInserted > 0 ? Math.round(totalRevenue / totalInserted) : 0,
    };
  }, [batches]);

  // 단가 수정 모달 열기
  const handleOpenCostModal = (b: BatchQualityMetric) => {
    setEditingBatch(b);
    setEditUnitCost(b.unitCost);
    setEditTotalCost(b.totalCost);
    setEditVendorName(b.vendorName || b.source || '');
  };

  // 단가 저장
  const handleSaveCost = async () => {
    if (!editingBatch) return;
    setSavingCost(true);
    try {
      await updateBatchCost(editingBatch.batchId, editUnitCost, editTotalCost, editVendorName);
      showToast(`'${editingBatch.batchName}' 매입 비용 및 거래처 정보가 저장되었습니다.`, 'success');
      setEditingBatch(null);
      await loadData();
    } catch (e: any) {
      showToast(e.message || '저장 실패', 'error');
    } finally {
      setSavingCost(false);
    }
  };

  // 거래처 필터링 리스트
  const filteredVendors = useMemo(() => {
    return vendorStats.filter(v => {
      const matchSearch = !searchKeyword || v.vendorName.toLowerCase().includes(searchKeyword.toLowerCase());
      const matchGrade = gradeFilter === 'all' || v.grade === gradeFilter;
      return matchSearch && matchGrade;
    });
  }, [vendorStats, searchKeyword, gradeFilter]);

  // 회차 필터링 리스트
  const filteredBatches = useMemo(() => {
    return batches.filter(b => {
      const matchSearch = !searchKeyword ||
        b.batchName.toLowerCase().includes(searchKeyword.toLowerCase()) ||
        b.vendorName.toLowerCase().includes(searchKeyword.toLowerCase()) ||
        b.source.toLowerCase().includes(searchKeyword.toLowerCase());
      return matchSearch;
    });
  }, [batches, searchKeyword]);

  // A/S 공문 텍스트 생성
  const generateAsClaimText = (vName: string, supplied: number, badCount: number, badRate: number, cost: number) => {
    const today = new Date().toLocaleDateString('ko-KR');
    return `[불량 DB 품질검증 및 A/S 환불·대체 정산 요청서]
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
■ 수신: ${vName} 담당자님 귀하
■ 발신: LeadMaster 콜센터 운영 본부
■ 일자: ${today}

귀사에서 공급해 주신 리드(DB)에 대한 콜센터 실제 통화 검증 결과,
계약 기준에 미달하는 결격/불량 DB가 다수 확인되어 아래와 같이 정산을 요청합니다.

1. 공급 및 검증 현황
 - 총 공급 DB 건수: ${supplied.toLocaleString()}건
 - 확인된 결격/불량 건수: ${badCount.toLocaleString()}건 (불량률: ${badRate}%)
   (사유: 결번, 전원 꺼짐 장기 지속, 본인 미신청, 타인명의 도용, 미성년자 등)

2. 정산 및 보상 요청 금액
 - 공급 단가 기준 환산액: 약 ₩${cost.toLocaleString()}원 상당

3. 요청 사항 (택 1)
 [안 1] 차기 결제 대금에서 해당 불량 건수(₩${cost.toLocaleString()}원) 전액 상계(차감)
 [안 2] 차기 공급 회차에서 정상 유효 DB ${badCount.toLocaleString()}건 무상 대체 지급

본 요청서에 대한 확인 및 정산 반영 여부를 회신 부탁드립니다.
감사합니다.
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━`;
  };

  const handleCopyText = (text: string) => {
    navigator.clipboard.writeText(text);
    showToast('A/S 환불 요청서가 클립보드에 복사되었습니다! 카톡/이메일로 전달하세요.', 'success');
  };

  const handleDownloadText = (filename: string, text: string) => {
    const blob = new Blob([text], { type: 'text/plain;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${filename}_AS요청서_${new Date().toISOString().slice(0, 10)}.txt`;
    a.click();
    URL.revokeObjectURL(url);
    showToast('텍스트 파일이 다운로드되었습니다.', 'success');
  };

  return (
    <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 shadow-sm overflow-hidden space-y-0">
      {/* 1. Header */}
      <div className="p-5 border-b border-gray-100 dark:border-gray-700 flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-2.5">
          <div className="p-2.5 rounded-xl bg-gradient-to-br from-emerald-600 to-teal-700 text-white shadow-md">
            <Building2 size={22} />
          </div>
          <div>
            <h2 className="text-lg font-bold text-gray-800 dark:text-white flex items-center gap-2">
              DB 거래처별 성과 분석 & 회차 품질 관제 본부
              <span className="text-xs px-2.5 py-0.5 rounded-full bg-emerald-100 text-emerald-800 dark:bg-emerald-900/40 dark:text-emerald-300 font-bold border border-emerald-300 dark:border-emerald-700">
                ROI / ROAS 실시간 추적
              </span>
            </h2>
            <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">
              어느 DB 공급 거래처에서 얼마를 주고 구매했을 때 실제 얼마의 수임 매출과 순수익을 거두었는지 한눈에 파악하고 비교합니다.
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => setIsVendorModalOpen(true)}
            className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold rounded-lg bg-indigo-50 dark:bg-indigo-950/50 text-indigo-700 dark:text-indigo-300 border border-indigo-200 dark:border-indigo-800 hover:bg-indigo-100 dark:hover:bg-indigo-900 transition-colors shadow-2xs"
          >
            <Building2 size={14} />
            DB 거래처 관리
          </button>
          <button
            type="button"
            onClick={handleRetroactiveBatch}
            disabled={isRetroactiveLoading}
            className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold rounded-lg bg-emerald-50 dark:bg-emerald-950/50 text-emerald-700 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-800 hover:bg-emerald-100 dark:hover:bg-emerald-900 transition-colors shadow-2xs"
            title="기존에 등록된 과거 DB들을 유입경로/월별로 묶어 즉시 회차화합니다."
          >
            <Sparkles size={14} className={isRetroactiveLoading ? 'animate-spin' : ''} />
            기존 DB 자동 묶기
          </button>
          <button
            onClick={loadData}
            disabled={loading}
            className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold rounded-lg border border-gray-300 dark:border-gray-600 text-gray-700 dark:text-gray-200 hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors"
          >
            <RefreshCw size={14} className={loading ? 'animate-spin' : ''} />
            새로고침
          </button>
        </div>
      </div>

      {/* 2. 상단 4대 경영 KPI 요약 배너 */}
      <div className="p-5 bg-gradient-to-r from-gray-50 via-slate-50 to-emerald-50/40 dark:from-gray-900 dark:via-gray-800 dark:to-emerald-950/20 border-b border-gray-200 dark:border-gray-700">
        <div className="grid grid-cols-2 sm:grid-cols-2 lg:grid-cols-4 gap-3.5">
          {/* KPI 1: 총 DB 투자 비용 */}
          <div className="bg-white dark:bg-gray-800 p-4 rounded-xl border border-gray-200/80 dark:border-gray-700 shadow-xs relative overflow-hidden">
            <div className="flex items-center justify-between text-gray-500 dark:text-gray-400 text-xs">
              <span className="font-semibold">총 DB 투자 비용</span>
              <DollarSign size={16} className="text-blue-500" />
            </div>
            <div className="text-xl font-bold text-gray-900 dark:text-white mt-1 tabular-nums">
              ₩{totals.totalCost.toLocaleString()}
            </div>
            <div className="flex items-center justify-between text-[11px] text-gray-500 dark:text-gray-400 mt-1.5 pt-1.5 border-t border-gray-100 dark:border-gray-700/60">
              <span>총 {totals.totalInserted.toLocaleString()}건 매입</span>
              <span className="font-medium text-blue-600 dark:text-blue-400">평균 CPL ₩{totals.avgCpl.toLocaleString()}</span>
            </div>
          </div>

          {/* KPI 2: 총 수임료 회수 매출 */}
          <div className="bg-white dark:bg-gray-800 p-4 rounded-xl border border-gray-200/80 dark:border-gray-700 shadow-xs relative overflow-hidden">
            <div className="flex items-center justify-between text-gray-500 dark:text-gray-400 text-xs">
              <span className="font-semibold">총 수임료 회수 매출</span>
              <Award size={16} className="text-emerald-500" />
            </div>
            <div className="text-xl font-bold text-emerald-600 dark:text-emerald-400 mt-1 tabular-nums">
              ₩{totals.totalRevenue.toLocaleString()}
            </div>
            <div className="flex items-center justify-between text-[11px] text-gray-500 dark:text-gray-400 mt-1.5 pt-1.5 border-t border-gray-100 dark:border-gray-700/60">
              <span>최종 계약 {totals.totalContracted.toLocaleString()}건</span>
              <span className="font-medium text-emerald-600 dark:text-emerald-400">전환율 {totals.overallContractRate}%</span>
            </div>
          </div>

          {/* KPI 3: 순수익 (Gross Profit) */}
          <div className={`bg-white dark:bg-gray-800 p-4 rounded-xl border shadow-xs relative overflow-hidden ${
            totals.grossProfit >= 0
              ? 'border-emerald-300 dark:border-emerald-800 ring-1 ring-emerald-400/20'
              : 'border-red-300 dark:border-red-800 ring-1 ring-red-400/20'
          }`}>
            <div className="flex items-center justify-between text-xs">
              <span className="font-semibold text-gray-600 dark:text-gray-300">순수익 (매출 - 매입비)</span>
              <TrendingUp size={16} className={totals.grossProfit >= 0 ? 'text-emerald-500' : 'text-red-500'} />
            </div>
            <div className={`text-xl font-bold mt-1 tabular-nums ${
              totals.grossProfit >= 0 ? 'text-emerald-600 dark:text-emerald-400' : 'text-red-600 dark:text-red-400'
            }`}>
              {totals.grossProfit >= 0 ? '+' : ''}₩{totals.grossProfit.toLocaleString()}
            </div>
            <div className="flex items-center justify-between text-[11px] text-gray-500 dark:text-gray-400 mt-1.5 pt-1.5 border-t border-gray-100 dark:border-gray-700/60">
              <span className={`font-semibold ${totals.grossProfit >= 0 ? 'text-emerald-600' : 'text-red-600'}`}>
                {totals.grossProfit >= 0 ? '🟢 흑자 창출 중' : '🔴 적자 주의/점검'}
              </span>
              <span>1건당 가치 ₩{totals.overallRevenuePerLead.toLocaleString()}</span>
            </div>
          </div>

          {/* KPI 4: 종합 ROAS & 고객 획득 비용 (CAC) */}
          <div className="bg-white dark:bg-gray-800 p-4 rounded-xl border border-gray-200/80 dark:border-gray-700 shadow-xs relative overflow-hidden">
            <div className="flex items-center justify-between text-gray-500 dark:text-gray-400 text-xs">
              <span className="font-semibold">종합 ROAS (광고비 회수율)</span>
              <BadgePercent size={16} className="text-purple-500" />
            </div>
            <div className="text-xl font-bold text-purple-600 dark:text-purple-400 mt-1 tabular-nums">
              {totals.roas}%
            </div>
            <div className="flex items-center justify-between text-[11px] text-gray-500 dark:text-gray-400 mt-1.5 pt-1.5 border-t border-gray-100 dark:border-gray-700/60">
              <span>계약 1건 획득비용(CAC)</span>
              <span className="font-semibold text-gray-800 dark:text-gray-200">₩{totals.cac.toLocaleString()}</span>
            </div>
          </div>
        </div>
      </div>

      {/* 3. 뷰 전환 탭 & 검색 바 */}
      <div className="p-4 border-b border-gray-200 dark:border-gray-700 flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3 bg-gray-50/50 dark:bg-gray-800/50">
        <div className="flex items-center gap-1.5 bg-gray-200 dark:bg-gray-700 p-1 rounded-xl">
          <button
            onClick={() => setActiveTab('vendor')}
            className={`flex items-center gap-1.5 px-4 py-2 rounded-lg text-xs font-bold transition-all ${
              activeTab === 'vendor'
                ? 'bg-white dark:bg-gray-800 text-emerald-600 dark:text-emerald-400 shadow-xs'
                : 'text-gray-600 dark:text-gray-400 hover:text-gray-900'
            }`}
          >
            <Building2 size={15} />
            🏢 거래처(공급사)별 성과 랭킹 ({vendorStats.length}개사)
          </button>
          <button
            onClick={() => setActiveTab('batch')}
            className={`flex items-center gap-1.5 px-4 py-2 rounded-lg text-xs font-bold transition-all ${
              activeTab === 'batch'
                ? 'bg-white dark:bg-gray-800 text-indigo-600 dark:text-indigo-400 shadow-xs'
                : 'text-gray-600 dark:text-gray-400 hover:text-gray-900'
            }`}
          >
            <FileSpreadsheet size={15} />
            📑 등록 회차(Batch)별 상세 손익 ({batches.length}개 회차)
          </button>
        </div>

        <div className="flex items-center gap-2">
          {activeTab === 'vendor' && (
            <div className="flex items-center gap-1 text-xs">
              {[
                { id: 'all', label: '전체' },
                { id: 'best', label: '👑 최우수' },
                { id: 'good', label: '우수' },
                { id: 'danger', label: '🚨 손실/주의' }
              ].map(f => (
                <button
                  key={f.id}
                  onClick={() => setGradeFilter(f.id)}
                  className={`px-2.5 py-1 rounded-lg font-medium transition-all ${
                    gradeFilter === f.id
                      ? 'bg-gray-800 text-white dark:bg-gray-200 dark:text-gray-900'
                      : 'bg-white dark:bg-gray-700 text-gray-600 dark:text-gray-300 hover:bg-gray-100'
                  }`}
                >
                  {f.label}
                </button>
              ))}
            </div>
          )}

          <div className="relative">
            <Search size={14} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-gray-400" />
            <input
              type="text"
              value={searchKeyword}
              onChange={e => setSearchKeyword(e.target.value)}
              placeholder="거래처명 / 회차명 검색..."
              className="pl-8 pr-3 py-1.5 rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-xs text-gray-900 dark:text-white w-44 sm:w-56"
            />
          </div>
        </div>
      </div>

      {/* 4. 탭 A: 거래처(공급사)별 성과 랭킹 뷰 */}
      {activeTab === 'vendor' && (
        <div className="overflow-x-auto">
          {loading ? (
            <div className="text-center py-16 text-gray-400">거래처 성과 데이터를 집계하는 중...</div>
          ) : filteredVendors.length === 0 ? (
            <div className="text-center py-16 px-4">
              <div className="max-w-md mx-auto space-y-3">
                <div className="w-12 h-12 rounded-2xl bg-gray-100 dark:bg-gray-700 flex items-center justify-center mx-auto text-gray-400">
                  <Building2 size={24} />
                </div>
                <h4 className="text-sm font-bold text-gray-700 dark:text-gray-300">
                  등록된 DB 거래처 성과 데이터가 없습니다
                </h4>
                <p className="text-xs text-gray-500 dark:text-gray-400 leading-relaxed">
                  우측 상단 <strong>[신규 DB 일괄/간편 등록]</strong> 시 DB 거래처를 선택하고 매입 단가를 지정하면 실시간으로 성과가 분석됩니다.<br/>
                  이미 CRM에 등록된 과거 고객 DB가 있다면 아래 버튼으로 즉시 회차화할 수 있습니다.
                </p>
                <div className="flex items-center justify-center gap-2 pt-2">
                  <button
                    type="button"
                    onClick={handleRetroactiveBatch}
                    disabled={isRetroactiveLoading}
                    className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-semibold shadow-xs transition-colors"
                  >
                    <Sparkles size={14} className={isRetroactiveLoading ? 'animate-spin' : ''} />
                    기존 등록 DB 자동 묶기 (소급 적용)
                  </button>
                  <button
                    type="button"
                    onClick={() => setIsVendorModalOpen(true)}
                    className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-lg border border-gray-300 dark:border-gray-600 hover:bg-gray-50 dark:hover:bg-gray-700 text-gray-700 dark:text-gray-300 text-xs font-semibold transition-colors"
                  >
                    <Building2 size={14} />
                    DB 거래처 관리
                  </button>
                </div>
              </div>
            </div>
          ) : (
            <table className="w-full text-sm text-left">
              <thead className="bg-gray-50 dark:bg-gray-700/50 text-gray-500 dark:text-gray-300 text-xs uppercase tracking-wider">
                <tr>
                  <th className="px-5 py-3">순위 / 거래처(공급사)명</th>
                  <th className="px-3 py-3 text-center">추천 등급</th>
                  <th className="px-3 py-3 text-right">매입 규모 (건수/회차)</th>
                  <th className="px-3 py-3 text-right">총 매입비용 (평균단가)</th>
                  <th className="px-3 py-3 text-right">통화 연결률</th>
                  <th className="px-3 py-3 text-right">계약 건수 (전환율)</th>
                  <th className="px-3 py-3 text-right">총 수임료 매출</th>
                  <th className="px-3 py-3 text-right">순수익 (Net)</th>
                  <th className="px-3 py-3 text-right">ROAS (%)</th>
                  <th className="px-5 py-3 text-center">불량 A/S 관리</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100 dark:divide-gray-700">
                {filteredVendors.map((v, idx) => {
                  return (
                    <tr key={v.vendorName} className="hover:bg-gray-50/80 dark:hover:bg-gray-700/40 transition-colors">
                      {/* 순위 & 거래처명 */}
                      <td className="px-5 py-3.5">
                        <div className="flex items-center gap-2">
                          <span className={`w-5 h-5 rounded-full flex items-center justify-center text-[11px] font-bold ${
                            idx === 0 ? 'bg-amber-100 text-amber-800' : idx === 1 ? 'bg-slate-200 text-slate-800' : idx === 2 ? 'bg-amber-50 text-amber-700' : 'bg-gray-100 text-gray-500'
                          }`}>
                            {idx + 1}
                          </span>
                          <div>
                            <div className="font-bold text-gray-900 dark:text-white flex items-center gap-1.5">
                              {v.vendorName}
                            </div>
                            <div className="text-[11px] text-gray-400">
                              계약 1건당 획득비용(CAC): ₩{v.cac.toLocaleString()}
                            </div>
                          </div>
                        </div>
                      </td>

                      {/* 추천 등급 */}
                      <td className="px-3 py-3.5 text-center">
                        {v.grade === 'best' ? (
                          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-bold bg-emerald-100 text-emerald-800 dark:bg-emerald-950/60 dark:text-emerald-300 border border-emerald-300 dark:border-emerald-800">
                            <Crown size={12} className="text-amber-500" /> 👑 최우수 파트너
                          </span>
                        ) : v.grade === 'good' ? (
                          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-bold bg-blue-100 text-blue-800 dark:bg-blue-950/60 dark:text-blue-300 border border-blue-300 dark:border-blue-800">
                            👍 우수
                          </span>
                        ) : v.grade === 'danger' ? (
                          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-bold bg-red-100 text-red-800 dark:bg-red-950/60 dark:text-red-300 border border-red-300 dark:border-red-800 animate-pulse">
                            <ShieldAlert size={12} /> 🚨 손실/주의
                          </span>
                        ) : (
                          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-medium bg-gray-100 text-gray-700 dark:bg-gray-700 dark:text-gray-300">
                            보통
                          </span>
                        )}
                      </td>

                      {/* 매입 규모 */}
                      <td className="px-3 py-3.5 text-right tabular-nums">
                        <div className="font-bold text-gray-800 dark:text-gray-100">
                          {v.totalInserted.toLocaleString()}건
                        </div>
                        <div className="text-[11px] text-gray-400">
                          총 {v.batchCount}개 회차
                        </div>
                      </td>

                      {/* 총 매입비용 */}
                      <td className="px-3 py-3.5 text-right tabular-nums">
                        <div className="font-semibold text-gray-800 dark:text-gray-100">
                          ₩{v.totalCost.toLocaleString()}
                        </div>
                        <div className="text-[11px] text-blue-600 dark:text-blue-400">
                          평균 CPL ₩{v.avgUnitCost.toLocaleString()}
                        </div>
                      </td>

                      {/* 통화 연결률 */}
                      <td className="px-3 py-3.5 text-right tabular-nums">
                        <span className={`font-bold ${v.contactRate >= 50 ? 'text-blue-600' : v.contactRate < 30 ? 'text-red-500' : 'text-gray-700'}`}>
                          {v.contactRate}%
                        </span>
                        <div className="text-[11px] text-gray-400">{v.totalContacted.toLocaleString()}건 연결</div>
                      </td>

                      {/* 계약 건수 (전환율) */}
                      <td className="px-3 py-3.5 text-right tabular-nums">
                        <span className="font-bold text-emerald-600 dark:text-emerald-400">
                          {v.totalContracted.toLocaleString()}건
                        </span>
                        <div className="text-[11px] text-gray-400">{v.contractRate}%</div>
                      </td>

                      {/* 총 수임료 매출 */}
                      <td className="px-3 py-3.5 text-right tabular-nums font-semibold text-gray-900 dark:text-white">
                        ₩{v.totalRevenue.toLocaleString()}
                      </td>

                      {/* 순수익 */}
                      <td className="px-3 py-3.5 text-right tabular-nums">
                        <div className={`font-bold text-sm ${v.grossProfit >= 0 ? 'text-emerald-600 dark:text-emerald-400' : 'text-red-600 dark:text-red-400'}`}>
                          {v.grossProfit >= 0 ? '+' : ''}₩{v.grossProfit.toLocaleString()}
                        </div>
                      </td>

                      {/* ROAS */}
                      <td className="px-3 py-3.5 text-right tabular-nums">
                        <span className={`px-2 py-0.5 rounded text-xs font-bold ${
                          v.roas >= 250
                            ? 'bg-emerald-100 text-emerald-800 dark:bg-emerald-950/60 dark:text-emerald-300'
                            : v.roas >= 100
                            ? 'bg-blue-100 text-blue-800 dark:bg-blue-950/60 dark:text-blue-300'
                            : 'bg-red-100 text-red-800 dark:bg-red-950/60 dark:text-red-300'
                        }`}>
                          {v.roas}%
                        </span>
                      </td>

                      {/* 불량 A/S 관리 */}
                      <td className="px-5 py-3.5 text-center">
                        <button
                          type="button"
                          onClick={() => setAsVendor(v)}
                          className="inline-flex items-center gap-1 px-3 py-1.5 rounded-lg bg-indigo-50 hover:bg-indigo-100 dark:bg-indigo-950/50 dark:hover:bg-indigo-900/40 text-indigo-700 dark:text-indigo-300 text-xs font-bold border border-indigo-200 dark:border-indigo-800 transition-colors shadow-xs"
                          title="불량 DB A/S 환불·보상 요청서 공문 출력"
                        >
                          <FileSpreadsheet size={13} />
                          A/S 환불 요청서
                        </button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          )}
        </div>
      )}

      {/* 5. 탭 B: 등록 회차(Batch)별 상세 손익 뷰 */}
      {activeTab === 'batch' && (
        <div className="overflow-x-auto">
          {loading ? (
            <div className="text-center py-16 text-gray-400">회차별 손익 데이터를 불러오는 중...</div>
          ) : filteredBatches.length === 0 ? (
            <div className="text-center py-16 px-4">
              <div className="max-w-md mx-auto space-y-3">
                <div className="w-12 h-12 rounded-2xl bg-gray-100 dark:bg-gray-700 flex items-center justify-center mx-auto text-gray-400">
                  <FileSpreadsheet size={24} />
                </div>
                <h4 className="text-sm font-bold text-gray-700 dark:text-gray-300">
                  등록된 회차(Batch) 데이터가 없습니다
                </h4>
                <p className="text-xs text-gray-500 dark:text-gray-400 leading-relaxed">
                  신규 DB 등록 시 회차가 자동 생성되며, 과거 데이터가 있다면 자동 묶기로 즉시 생성할 수 있습니다.
                </p>
                <div className="flex items-center justify-center gap-2 pt-2">
                  <button
                    type="button"
                    onClick={handleRetroactiveBatch}
                    disabled={isRetroactiveLoading}
                    className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-semibold shadow-xs transition-colors"
                  >
                    <Sparkles size={14} className={isRetroactiveLoading ? 'animate-spin' : ''} />
                    기존 등록 DB 자동 묶기 (소급 적용)
                  </button>
                </div>
              </div>
            </div>
          ) : (
            <table className="w-full text-sm text-left">
              <thead className="bg-gray-50 dark:bg-gray-700/50 text-gray-500 dark:text-gray-300 text-xs uppercase tracking-wider">
                <tr>
                  <th className="px-5 py-3">회차명 / 거래처</th>
                  <th className="px-3 py-3 text-right">인입 / 유효</th>
                  <th className="px-3 py-3 text-right">매입 단가(CPL) & 총비용</th>
                  <th className="px-3 py-3 text-right">통화 연결률</th>
                  <th className="px-3 py-3 text-right">사무장 전달률</th>
                  <th className="px-3 py-3 text-right">계약 전환율</th>
                  <th className="px-3 py-3 text-right">총 수임료 매출</th>
                  <th className="px-3 py-3 text-right">순수익 (Net)</th>
                  <th className="px-3 py-3 text-right">ROAS (%)</th>
                  <th className="px-5 py-3 text-center">비용/관리</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100 dark:divide-gray-700">
                {filteredBatches.map(b => {
                  return (
                    <tr key={b.batchId} className="hover:bg-gray-50/80 dark:hover:bg-gray-700/40 transition-colors">
                      <td className="px-5 py-3.5">
                        <div className="font-semibold text-gray-800 dark:text-white flex items-center gap-1.5">
                          <FileSpreadsheet size={15} className="text-gray-400 shrink-0" />
                          <span className="truncate max-w-[200px]" title={b.batchName}>{b.batchName}</span>
                        </div>
                        <div className="text-xs text-indigo-600 dark:text-indigo-400 font-medium mt-0.5">
                          🏢 {b.vendorName || b.source} · {new Date(b.createdAt).toLocaleDateString()}
                        </div>
                      </td>

                      <td className="px-3 py-3.5 text-right tabular-nums">
                        <div className="font-bold text-gray-800 dark:text-gray-100">
                          {b.inserted.toLocaleString()}건
                        </div>
                        <div className="text-[11px] text-gray-400">
                          총 {b.totalRows.toLocaleString()}건 중
                        </div>
                      </td>

                      {/* 매입 단가 & 총비용 (클릭 시 수정) */}
                      <td className="px-3 py-3.5 text-right tabular-nums">
                        <button
                          type="button"
                          onClick={() => handleOpenCostModal(b)}
                          className="group inline-flex flex-col items-end hover:opacity-80 transition-opacity text-right"
                          title="클릭하여 매입 단가 및 총비용 수정"
                        >
                          <div className="font-semibold text-gray-800 dark:text-gray-100 flex items-center gap-1 group-hover:text-blue-600">
                            ₩{b.totalCost.toLocaleString()}
                            <Edit3 size={11} className="text-gray-400 group-hover:text-blue-500" />
                          </div>
                          <div className="text-[11px] text-blue-600 dark:text-blue-400">
                            {b.unitCost > 0 ? `CPL ₩${b.unitCost.toLocaleString()}` : '단가 미입력 (설정 클릭)'}
                          </div>
                        </button>
                      </td>

                      {/* 통화 연결률 */}
                      <td className="px-3 py-3.5 text-right tabular-nums">
                        <div className="font-bold text-blue-600 dark:text-blue-400">{b.contactRate}%</div>
                        <div className="text-[11px] text-gray-400">{b.contactCount.toLocaleString()}건 연결</div>
                      </td>

                      {/* 사무장 전달률 */}
                      <td className="px-3 py-3.5 text-right tabular-nums">
                        <div className="font-bold text-purple-600 dark:text-purple-400">{b.transferRate}%</div>
                        <div className="text-[11px] text-gray-400">{b.transferredCount.toLocaleString()}건 전달</div>
                      </td>

                      {/* 계약 전환율 */}
                      <td className="px-3 py-3.5 text-right tabular-nums">
                        <div className="font-bold text-emerald-600 dark:text-emerald-400">{b.contractRate}%</div>
                        <div className="text-[11px] text-gray-400">{b.contractedCount.toLocaleString()}건 계약</div>
                      </td>

                      {/* 총 수임료 매출 */}
                      <td className="px-3 py-3.5 text-right tabular-nums font-semibold text-gray-900 dark:text-white">
                        ₩{b.totalRevenue.toLocaleString()}
                      </td>

                      {/* 순수익 */}
                      <td className="px-3 py-3.5 text-right tabular-nums">
                        <div className={`font-bold ${b.grossProfit >= 0 ? 'text-emerald-600 dark:text-emerald-400' : 'text-red-600 dark:text-red-400'}`}>
                          {b.grossProfit >= 0 ? '+' : ''}₩{b.grossProfit.toLocaleString()}
                        </div>
                      </td>

                      {/* ROAS */}
                      <td className="px-3 py-3.5 text-right tabular-nums">
                        <span className={`px-2 py-0.5 rounded text-xs font-bold ${
                          b.roas >= 250
                            ? 'bg-emerald-100 text-emerald-800 dark:bg-emerald-950/60 dark:text-emerald-300'
                            : b.roas >= 100
                            ? 'bg-blue-100 text-blue-800 dark:bg-blue-950/60 dark:text-blue-300'
                            : 'bg-red-100 text-red-800 dark:bg-red-950/60 dark:text-red-300'
                        }`}>
                          {b.roas}%
                        </span>
                      </td>

                      {/* 관리 버튼 */}
                      <td className="px-5 py-3.5 text-center">
                        <div className="flex items-center justify-center gap-1.5">
                          <button
                            type="button"
                            onClick={() => handleOpenCostModal(b)}
                            className="px-2.5 py-1 rounded-md text-xs font-semibold bg-gray-100 hover:bg-gray-200 dark:bg-gray-700 dark:hover:bg-gray-600 text-gray-700 dark:text-gray-200 transition-colors"
                          >
                            단가 설정
                          </button>
                          <button
                            type="button"
                            onClick={() => setAsBatch(b)}
                            className="p-1 rounded-md text-gray-400 hover:text-indigo-600 dark:hover:text-indigo-400"
                            title="이 회차 불량 A/S 청구서 출력"
                          >
                            <FileSpreadsheet size={15} />
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          )}
        </div>
      )}

      {/* 6. 모달 1: 매입 단가/비용 설정 모달 (BatchCostEditModal) */}
      {editingBatch && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-in fade-in duration-150">
          <div className="bg-white dark:bg-gray-800 rounded-2xl max-w-md w-full p-6 shadow-2xl border border-gray-200 dark:border-gray-700 space-y-4">
            <div className="flex items-center justify-between border-b pb-3 border-gray-100 dark:border-gray-700">
              <h3 className="text-base font-bold text-gray-900 dark:text-white flex items-center gap-2">
                <DollarSign size={18} className="text-emerald-600" />
                회차별 DB 매입 비용 및 거래처 설정
              </h3>
              <button
                type="button"
                onClick={() => setEditingBatch(null)}
                className="text-gray-400 hover:text-gray-600"
              >
                <X size={18} />
              </button>
            </div>

            <div className="space-y-3.5 text-xs">
              <div className="p-3 rounded-lg bg-gray-50 dark:bg-gray-900/60 border border-gray-200 dark:border-gray-700 space-y-1">
                <div className="font-semibold text-gray-800 dark:text-white truncate">
                  {editingBatch.batchName}
                </div>
                <div className="text-gray-500 text-[11px]">
                  유효 인입 건수: <strong className="text-gray-900 dark:text-white">{editingBatch.inserted.toLocaleString()}건</strong> · 현재 매출: ₩{editingBatch.totalRevenue.toLocaleString()}
                </div>
              </div>

              <div>
                <label className="block font-semibold text-gray-700 dark:text-gray-300 mb-1">
                  DB 공급 거래처명 (대행사/미디어사)
                </label>
                <input
                  type="text"
                  value={editVendorName}
                  onChange={e => setEditVendorName(e.target.value)}
                  placeholder="예: A미디어, 골든마케팅, 페이스북광고"
                  className="w-full px-3 py-2 rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-white font-medium"
                />
              </div>

              {/* 3000건/50만원 패키지 간편 계산 도구 */}
              <div className="p-2.5 rounded-lg bg-indigo-50/80 dark:bg-indigo-950/40 border border-indigo-200 dark:border-indigo-800 space-y-1.5">
                <div className="flex items-center justify-between text-[11px] font-bold text-indigo-950 dark:text-indigo-200">
                  <span>📦 대량 패키지 간편 계산 (예: 3000건에 50만원)</span>
                </div>
                <div className="flex items-center gap-1.5">
                  <input
                    type="number"
                    id="quick_pkg_leads"
                    placeholder="수량 (예: 3000)"
                    defaultValue={editingBatch.inserted || 3000}
                    className="w-24 px-2 py-1 text-xs rounded border border-indigo-200 dark:border-indigo-800 bg-white dark:bg-gray-800 font-bold"
                  />
                  <span className="text-[11px] text-gray-500">건에</span>
                  <input
                    type="number"
                    id="quick_pkg_price"
                    placeholder="총액 (예: 500000)"
                    defaultValue={500000}
                    className="flex-1 px-2 py-1 text-xs rounded border border-indigo-200 dark:border-indigo-800 bg-white dark:bg-gray-800 font-bold"
                  />
                  <span className="text-[11px] text-gray-500">원</span>
                  <button
                    type="button"
                    onClick={() => {
                      const lEl = document.getElementById('quick_pkg_leads') as HTMLInputElement;
                      const pEl = document.getElementById('quick_pkg_price') as HTMLInputElement;
                      const l = Math.max(1, parseInt(lEl?.value) || 1);
                      const p = Math.max(0, parseInt(pEl?.value) || 0);
                      const u = Math.round(p / l);
                      setEditUnitCost(u);
                      setEditTotalCost(p);
                    }}
                    className="px-2.5 py-1 rounded bg-indigo-600 hover:bg-indigo-700 text-white font-bold text-[11px] shrink-0 shadow-2xs"
                  >
                    단가 환산 적용
                  </button>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block font-semibold text-gray-700 dark:text-gray-300 mb-1">
                    건당 단가 (CPL, 원)
                  </label>
                  <input
                    type="number"
                    value={editUnitCost || ''}
                    onChange={e => {
                      const val = Math.max(0, parseInt(e.target.value) || 0);
                      setEditUnitCost(val);
                      // 단가 입력 시 총비용 자동 계산 연동
                      if (editingBatch.inserted > 0) {
                        setEditTotalCost(val * editingBatch.inserted);
                      }
                    }}
                    placeholder="예: 35000"
                    className="w-full px-3 py-2 rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-white font-bold"
                  />
                </div>

                <div>
                  <label className="block font-semibold text-gray-700 dark:text-gray-300 mb-1">
                    총 매입 비용 (원)
                  </label>
                  <input
                    type="number"
                    value={editTotalCost || ''}
                    onChange={e => setEditTotalCost(Math.max(0, parseInt(e.target.value) || 0))}
                    placeholder="예: 35000000"
                    className="w-full px-3 py-2 rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-white font-bold"
                  />
                </div>
              </div>

              {/* 실시간 재무 예측 미리보기 */}
              <div className="p-3 rounded-xl bg-purple-50 dark:bg-purple-950/40 border border-purple-200 dark:border-purple-800 space-y-1.5">
                <div className="text-[11px] font-bold text-purple-900 dark:text-purple-200 flex items-center justify-between">
                  <span>📊 이 회차 예상 손익 지표</span>
                  <span className="font-mono text-purple-700 dark:text-purple-300">
                    ROAS: {editTotalCost > 0 ? Number(((editingBatch.totalRevenue / editTotalCost) * 100).toFixed(1)) : 0}%
                  </span>
                </div>
                <div className="flex items-center justify-between text-gray-600 dark:text-gray-400 text-[11px]">
                  <span>수임 매출 ₩{editingBatch.totalRevenue.toLocaleString()} - 매입비 ₩{editTotalCost.toLocaleString()}</span>
                  <span className={`font-bold ${editingBatch.totalRevenue - editTotalCost >= 0 ? 'text-emerald-600' : 'text-red-600'}`}>
                    순수익: {editingBatch.totalRevenue - editTotalCost >= 0 ? '+' : ''}₩{(editingBatch.totalRevenue - editTotalCost).toLocaleString()}
                  </span>
                </div>
              </div>
            </div>

            <div className="flex items-center justify-end gap-2 pt-2 border-t border-gray-100 dark:border-gray-700">
              <button
                type="button"
                onClick={() => setEditingBatch(null)}
                className="px-4 py-2 rounded-lg text-xs font-semibold text-gray-600 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700"
              >
                취소
              </button>
              <button
                type="button"
                onClick={handleSaveCost}
                disabled={savingCost}
                className="px-5 py-2 rounded-lg text-xs font-bold text-white bg-emerald-600 hover:bg-emerald-700 shadow-sm transition-all"
              >
                {savingCost ? '저장 중...' : '매입 비용 저장 완료'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* 7. 모달 2: 불량 DB A/S 환불·보상 요청서 공문 출력 모달 */}
      {(asVendor || asBatch) && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-in fade-in duration-150">
          <div className="bg-white dark:bg-gray-800 rounded-2xl max-w-lg w-full p-6 shadow-2xl border border-gray-200 dark:border-gray-700 space-y-4">
            <div className="flex items-center justify-between border-b pb-3 border-gray-100 dark:border-gray-700">
              <h3 className="text-base font-bold text-gray-900 dark:text-white flex items-center gap-2">
                <FileSpreadsheet size={18} className="text-indigo-600" />
                불량 DB A/S 환불 및 대체 정산 요청서
              </h3>
              <button
                type="button"
                onClick={() => { setAsVendor(null); setAsBatch(null); }}
                className="text-gray-400 hover:text-gray-600"
              >
                <X size={18} />
              </button>
            </div>

            {(() => {
              const vName = asVendor ? asVendor.vendorName : (asBatch?.vendorName || asBatch?.source || '공급처');
              const supplied = asVendor ? asVendor.totalInserted : (asBatch?.inserted || 0);
              const badCount = asVendor ? asVendor.badLeadsCount : ((asBatch?.duplicates || 0) + (asBatch?.invalid || 0) + (asBatch?.dncFiltered || 0));
              const badRate = asVendor ? asVendor.badLeadsRate : (supplied > 0 ? Number(((badCount / supplied) * 100).toFixed(1)) : 0);
              const unitCost = asVendor ? asVendor.avgUnitCost : (asBatch?.unitCost || 0);
              const claimCost = badCount * unitCost;
              const textContent = generateAsClaimText(vName, supplied, badCount, badRate, claimCost);

              return (
                <div className="space-y-3">
                  <div className="p-3 rounded-xl bg-amber-50 dark:bg-amber-950/40 border border-amber-200 dark:border-amber-800 text-xs text-amber-900 dark:text-amber-200 flex items-center justify-between">
                    <div>
                      <span className="font-bold">{vName}</span> 불량 건수: <strong>{badCount.toLocaleString()}건</strong> ({badRate}%)
                    </div>
                    <div className="font-bold text-amber-700 dark:text-amber-300">
                      환불 청구액: ₩{claimCost.toLocaleString()}
                    </div>
                  </div>

                  <div>
                    <label className="block text-xs font-semibold text-gray-600 dark:text-gray-300 mb-1">
                      공문 전문 미리보기 (자동 생성됨)
                    </label>
                    <textarea
                      readOnly
                      rows={10}
                      value={textContent}
                      className="w-full p-3 font-mono text-xs rounded-xl border border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-900 text-gray-800 dark:text-gray-200 leading-relaxed select-all"
                    />
                  </div>

                  <div className="flex items-center justify-between pt-2 border-t border-gray-100 dark:border-gray-700">
                    <button
                      type="button"
                      onClick={() => handleDownloadText(vName, textContent)}
                      className="px-3 py-2 rounded-lg text-xs font-semibold border border-gray-300 dark:border-gray-600 hover:bg-gray-50 dark:hover:bg-gray-700 flex items-center gap-1.5"
                    >
                      <Download size={14} /> 텍스트 저장 (.txt)
                    </button>

                    <div className="flex items-center gap-2">
                      <button
                        type="button"
                        onClick={() => { setAsVendor(null); setAsBatch(null); }}
                        className="px-4 py-2 rounded-lg text-xs font-semibold text-gray-500 hover:text-gray-700"
                      >
                        닫기
                      </button>
                      <button
                        type="button"
                        onClick={() => handleCopyText(textContent)}
                        className="px-4 py-2 rounded-lg text-xs font-bold text-white bg-indigo-600 hover:bg-indigo-700 shadow-sm flex items-center gap-1.5"
                      >
                        <Copy size={14} /> 전문 클립보드 복사
                      </button>
                    </div>
                  </div>
                </div>
              );
            })()}
          </div>
        </div>
      )}
    </div>
  );
}
