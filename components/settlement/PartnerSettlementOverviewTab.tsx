/**
 * components/settlement/PartnerSettlementOverviewTab.tsx
 * 거래처(법무법인/법률사무소)별 정산 관제 탭
 * - 거래처마다 정산 받을 금액, 정산 주기/시기(D-Day), 건수 실시간 표시
 * - 미수금 및 입금 지연(연체) 경고
 * - 텔레그램/카톡 전송용 정산서 텍스트 원클릭 복사 및 엑셀 내보내기
 */
import React, { useState, useMemo } from 'react';
import {
  Building, Calendar, Clock, DollarSign, AlertTriangle,
  CheckCircle2, Copy, Check, Download, Search, ChevronRight,
  Filter, FileText, ArrowUpRight
} from 'lucide-react';
import { useToast } from '../../contexts/ToastContext';
import { PartnerSettlementCardItem, computePartnerSettlementCards } from '../../services/settlementMasterService';
import { exportToExcel } from '../../utils/xlsxExport';
import { Partner, Case } from '../../types';
import { Collection } from '../../utils/settlement';

interface PartnerSettlementOverviewTabProps {
  partnerCards?: PartnerSettlementCardItem[];
  partners?: Partner[];
  cases?: Case[];
  collections?: Collection[];
  onSelectPartner?: (partnerId: string) => void;
  onOpenPolicyModal?: () => void;
}

export const PartnerSettlementOverviewTab: React.FC<PartnerSettlementOverviewTabProps> = ({
  partnerCards = [],
  partners,
  cases,
  collections,
  onSelectPartner,
  onOpenPolicyModal,
}) => {
  const { showToast } = useToast();
  const [searchTerm, setSearchTerm] = useState('');
  const [cycleFilter, setCycleFilter] = useState<'all' | 'weekly' | 'monthly'>('all');
  const [copiedId, setCopiedId] = useState<string | null>(null);

  // partnerCards가 직접 주어지지 않고 partners/cases가 주어진 경우 자동 계산
  const effectiveCards = useMemo(() => {
    if (Array.isArray(partnerCards) && partnerCards.length > 0) return partnerCards;
    if (Array.isArray(partners) && Array.isArray(cases) && partners.length > 0) {
      return computePartnerSettlementCards(partners, cases, collections || []);
    }
    return Array.isArray(partnerCards) ? partnerCards : [];
  }, [partnerCards, partners, cases, collections]);

  // 상단 집계 지표
  const totals = useMemo(() => {
    const cards = effectiveCards || [];
    return {
      partnerCount: cards.length,
      billedWon: cards.reduce((s, c) => s + (c.billedCommissionWon || 0), 0),
      collectedWon: cards.reduce((s, c) => s + (c.collectedCommissionWon || 0), 0),
      outstandingWon: cards.reduce((s, c) => s + (c.outstandingWon || 0), 0),
      overdueWon: cards.reduce((s, c) => s + (c.overdueWon || 0), 0),
      dueSoonWon: cards.reduce((s, c) => s + (c.dueSoonWon || 0), 0),
      totalCases: cards.reduce((s, c) => s + (c.caseCount || 0), 0),
    };
  }, [effectiveCards]);

  const collectionRate = totals.billedWon > 0
    ? Math.round((totals.collectedWon / totals.billedWon) * 100)
    : 0;

  // 필터링된 카드 목록
  const filteredCards = useMemo(() => {
    const cards = effectiveCards || [];
    return cards.filter(c => {
      if (searchTerm && !c.partnerName.toLowerCase().includes(searchTerm.toLowerCase())) {
        return false;
      }
      if (cycleFilter === 'weekly' && !c.settlementCycleDisplay.includes('매주')) return false;
      if (cycleFilter === 'monthly' && c.settlementCycleDisplay.includes('매주')) return false;
      return true;
    });
  }, [effectiveCards, searchTerm, cycleFilter]);

  // 텔레그램 / 카카오톡 전송용 포맷 텍스트 복사
  const handleCopyStatement = (card: PartnerSettlementCardItem) => {
    const today = new Date().toLocaleDateString('ko-KR');
    const text = `[리드마스터 정산 청구서]
■ 거래처: ${card.partnerName}
■ 기준일: ${today}
■ 정산 주기: ${card.settlementCycleDisplay} (다음 정산일: ${card.nextSettlementDate})
-----------------------------
- 총 수임 완료: ${card.caseCount}건
- 총 수임금액: ₩${(card.totalContractFeeWon / 10000).toLocaleString()}만원
- 청구 수수료: ₩${(card.billedCommissionWon / 10000).toLocaleString()}만원
- 입금 확인액: ₩${(card.collectedCommissionWon / 10000).toLocaleString()}만원
- 미수 잔액: ₩${(card.outstandingWon / 10000).toLocaleString()}만원
-----------------------------
확인 후 입금 부탁드립니다. 감사합니다.`;

    navigator.clipboard.writeText(text);
    setCopiedId(card.partnerId);
    showToast(`${card.partnerName} 정산서가 클립보드에 복사되었습니다!`, 'success');
    setTimeout(() => setCopiedId(null), 2000);
  };

  // 엑셀 다운로드
  const handleExportExcel = () => {
    const cards = effectiveCards || [];
    const rows = cards.map(c => ({
      '거래처명': c.partnerName,
      '정산 주기': c.settlementCycleDisplay,
      '다음 정산일': c.nextSettlementDate,
      'D-Day': c.dDay === 0 ? '당일' : c.dDay > 0 ? `D-${c.dDay}` : `연체 ${Math.abs(c.dDay)}일`,
      '대상 건수': c.caseCount,
      '총 수임금액(원)': c.totalContractFeeWon,
      '청구 수수료(원)': c.billedCommissionWon,
      '입금 확인액(원)': c.collectedCommissionWon,
      '미수금 잔액(원)': c.outstandingWon,
      '연체 금액(원)': c.overdueWon,
    }));
    exportToExcel(`거래처별_수수료_정산현황_${new Date().toISOString().slice(0, 10)}`, rows);
    showToast('엑셀 다운로드가 완료되었습니다.', 'success');
  };

  return (
    <div className="space-y-6">
      {/* 1. 상단 총괄 지표 카드 */}
      <div className="grid grid-cols-2 md:grid-cols-5 gap-3.5">
        {/* 총 청구 수수료 */}
        <div className="bg-white dark:bg-gray-800 p-4 rounded-2xl border border-gray-100 dark:border-gray-700 shadow-sm flex flex-col justify-between">
          <span className="text-xs font-semibold text-gray-500 dark:text-gray-400">
            총 청구 수수료 (매출)
          </span>
          <div className="mt-2">
            <span className="text-xl md:text-2xl font-black text-gray-900 dark:text-white font-mono">
              ₩{(totals.billedWon / 10000).toLocaleString()}
            </span>
            <span className="text-xs text-gray-400 font-bold ml-1">만원</span>
          </div>
          <span className="text-[11px] text-gray-400 mt-1">
            총 {totals.totalCases}건 수임 분배
          </span>
        </div>

        {/* 입금 확인액 */}
        <div className="bg-emerald-50/70 dark:bg-emerald-950/30 p-4 rounded-2xl border border-emerald-200 dark:border-emerald-800 flex flex-col justify-between">
          <div className="flex items-center justify-between text-xs font-bold text-emerald-800 dark:text-emerald-300">
            <span>입금 확인 (완료)</span>
            <CheckCircle2 size={14} className="text-emerald-600" />
          </div>
          <div className="mt-2">
            <span className="text-xl md:text-2xl font-black text-emerald-700 dark:text-emerald-200 font-mono">
              ₩{(totals.collectedWon / 10000).toLocaleString()}
            </span>
            <span className="text-xs text-emerald-600 font-bold ml-1">만원</span>
          </div>
          <div className="w-full bg-emerald-200 dark:bg-emerald-800 h-1.5 rounded-full mt-1.5 overflow-hidden">
            <div
              className="bg-emerald-500 h-1.5 rounded-full"
              style={{ width: `${collectionRate}%` }}
            />
          </div>
        </div>

        {/* 남은 미수금 */}
        <div className="bg-amber-50/70 dark:bg-amber-950/30 p-4 rounded-2xl border border-amber-200 dark:border-amber-800 flex flex-col justify-between">
          <div className="flex items-center justify-between text-xs font-bold text-amber-800 dark:text-amber-300">
            <span>남은 미수금 (받을 돈)</span>
            <Clock size={14} className="text-amber-600" />
          </div>
          <div className="mt-2">
            <span className="text-xl md:text-2xl font-black text-amber-700 dark:text-amber-200 font-mono">
              ₩{(totals.outstandingWon / 10000).toLocaleString()}
            </span>
            <span className="text-xs text-amber-600 font-bold ml-1">만원</span>
          </div>
          <span className="text-[11px] text-amber-700 dark:text-amber-400 mt-1">
            7일 내 도래: ₩{(totals.dueSoonWon / 10000).toLocaleString()}만
          </span>
        </div>

        {/* 기한 초과 연체금 */}
        <div className="bg-rose-50/70 dark:bg-rose-950/30 p-4 rounded-2xl border border-rose-200 dark:border-rose-800 flex flex-col justify-between">
          <div className="flex items-center justify-between text-xs font-bold text-rose-800 dark:text-rose-300">
            <span>입금 기한 지난 연체</span>
            <AlertTriangle size={14} className="text-rose-600" />
          </div>
          <div className="mt-2">
            <span className="text-xl md:text-2xl font-black text-rose-700 dark:text-rose-200 font-mono">
              ₩{(totals.overdueWon / 10000).toLocaleString()}
            </span>
            <span className="text-xs text-rose-600 font-bold ml-1">만원</span>
          </div>
          <span className="text-[11px] text-rose-600 dark:text-rose-400 mt-1 font-semibold">
            {totals.overdueWon > 0 ? '⚠️ 즉시 확인 필요' : '정상 수금 관리중'}
          </span>
        </div>

        {/* 총 파트너 거래처 */}
        <div className="bg-white dark:bg-gray-800 p-4 rounded-2xl border border-gray-100 dark:border-gray-700 shadow-sm flex flex-col justify-between">
          <span className="text-xs font-semibold text-gray-500 dark:text-gray-400">
            제휴 법무법인
          </span>
          <div className="mt-2">
            <span className="text-xl md:text-2xl font-black text-indigo-600 dark:text-indigo-400 font-mono">
              {totals.partnerCount}
            </span>
            <span className="text-xs text-gray-400 font-bold ml-1">개 사무소</span>
          </div>
          <span className="text-[11px] text-gray-400 mt-1">
            정산 회수율: {collectionRate}%
          </span>
        </div>
      </div>

      {/* 2. 검색 & 필터 & 엑셀 액션 바 */}
      <div className="flex flex-col sm:flex-row items-center justify-between gap-3">
        <div className="flex items-center gap-2 w-full sm:w-auto">
          {/* 검색창 */}
          <div className="relative flex-1 sm:w-64">
            <Search size={14} className="absolute left-3 top-3 text-gray-400" />
            <input
              type="text"
              value={searchTerm}
              onChange={e => setSearchTerm(e.target.value)}
              placeholder="거래처명 검색..."
              className="w-full pl-9 pr-3 py-2 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-xl text-xs font-semibold text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-indigo-500"
            />
          </div>

          {/* 주기 필터 */}
          <div className="flex items-center bg-gray-100 dark:bg-gray-800 p-1 rounded-xl text-xs">
            <button
              type="button"
              onClick={() => setCycleFilter('all')}
              className={`px-3 py-1 rounded-lg font-bold transition-all ${
                cycleFilter === 'all' ? 'bg-white dark:bg-gray-700 text-indigo-600 shadow-sm' : 'text-gray-500'
              }`}
            >
              전체
            </button>
            <button
              type="button"
              onClick={() => setCycleFilter('weekly')}
              className={`px-3 py-1 rounded-lg font-bold transition-all ${
                cycleFilter === 'weekly' ? 'bg-white dark:bg-gray-700 text-indigo-600 shadow-sm' : 'text-gray-500'
              }`}
            >
              주간 정산
            </button>
            <button
              type="button"
              onClick={() => setCycleFilter('monthly')}
              className={`px-3 py-1 rounded-lg font-bold transition-all ${
                cycleFilter === 'monthly' ? 'bg-white dark:bg-gray-700 text-indigo-600 shadow-sm' : 'text-gray-500'
              }`}
            >
              월말/월간 정산
            </button>
          </div>
        </div>

        <button
          type="button"
          onClick={handleExportExcel}
          className="px-4 py-2 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-xl text-xs font-bold text-gray-700 dark:text-gray-200 hover:bg-gray-50 dark:hover:bg-gray-700 flex items-center gap-1.5 shadow-sm transition-colors"
        >
          <Download size={14} />
          정산 현황 엑셀 다운로드
        </button>
      </div>

      {/* 3. 거래처별 정산 관제 카드 그리드 */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {filteredCards.map(card => {
          const isCopied = copiedId === card.partnerId;
          const progress = card.billedCommissionWon > 0
            ? Math.round((card.collectedCommissionWon / card.billedCommissionWon) * 100)
            : 0;

          return (
            <div
              key={card.partnerId}
              className={`bg-white dark:bg-gray-800 rounded-2xl border p-5 shadow-sm flex flex-col justify-between transition-all hover:shadow-md ${
                card.isOverdue
                  ? 'border-rose-300 dark:border-rose-800/80 ring-1 ring-rose-500/20'
                  : 'border-gray-200 dark:border-gray-700'
              }`}
            >
              <div>
                {/* 상단 거래처명 & 정산 주기 뱃지 */}
                <div className="flex items-start justify-between gap-2 mb-3">
                  <div>
                    <h3 className="font-black text-base text-gray-900 dark:text-white flex items-center gap-2">
                      <Building size={16} className="text-indigo-600 shrink-0" />
                      {card.partnerName}
                    </h3>
                    <div className="flex items-center gap-2 mt-1">
                      <span className="text-xs px-2 py-0.5 rounded-md font-bold bg-indigo-50 dark:bg-indigo-950/60 text-indigo-700 dark:text-indigo-300 border border-indigo-200 dark:border-indigo-800">
                        {card.settlementCycleDisplay}
                      </span>
                      <span className={`text-xs px-2 py-0.5 rounded-md font-bold font-mono ${
                        card.dDay < 0
                          ? 'bg-rose-100 text-rose-700 dark:bg-rose-950/60 dark:text-rose-400'
                          : card.dDay === 0
                          ? 'bg-amber-100 text-amber-700 dark:bg-amber-950/60 dark:text-amber-400 animate-pulse'
                          : 'bg-gray-100 text-gray-600 dark:bg-gray-700 dark:text-gray-300'
                      }`}>
                        {card.dDay === 0 ? '오늘 입금 예정' : card.dDay > 0 ? `D-${card.dDay}` : `연체 ${Math.abs(card.dDay)}일`}
                      </span>
                    </div>
                  </div>

                  <span className="text-xs font-mono font-bold px-2 py-1 bg-gray-50 dark:bg-gray-700/60 text-gray-600 dark:text-gray-300 rounded-lg">
                    {card.caseCount}건 수임
                  </span>
                </div>

                {/* 금액 상세 */}
                <div className="space-y-2 py-3 border-y border-gray-100 dark:border-gray-700/60 text-xs">
                  <div className="flex justify-between items-center">
                    <span className="text-gray-500">총 수임료 규모:</span>
                    <span className="font-mono font-bold text-gray-900 dark:text-white">
                      ₩{(card.totalContractFeeWon / 10000).toLocaleString()}만원
                    </span>
                  </div>

                  <div className="flex justify-between items-center">
                    <span className="text-gray-500 font-semibold">청구 수수료액:</span>
                    <span className="font-mono font-black text-indigo-600 dark:text-indigo-400 text-sm">
                      ₩{(card.billedCommissionWon / 10000).toLocaleString()}만원
                    </span>
                  </div>

                  <div className="flex justify-between items-center text-emerald-600 dark:text-emerald-400 font-semibold">
                    <span>입금 확인액:</span>
                    <span className="font-mono font-bold">
                      ₩{(card.collectedCommissionWon / 10000).toLocaleString()}만원 ({progress}%)
                    </span>
                  </div>

                  <div className="flex justify-between items-center text-amber-600 dark:text-amber-400 font-semibold">
                    <span>미수 잔액:</span>
                    <span className="font-mono font-bold">
                      ₩{(card.outstandingWon / 10000).toLocaleString()}만원
                    </span>
                  </div>

                  {card.overdueWon > 0 && (
                    <div className="flex justify-between items-center text-rose-600 font-bold bg-rose-50 dark:bg-rose-950/40 p-1.5 rounded-lg">
                      <span>연체 경고:</span>
                      <span className="font-mono">
                        ₩{(card.overdueWon / 10000).toLocaleString()}만원 연체중
                      </span>
                    </div>
                  )}

                  {/* 수금 진척도 바 */}
                  <div className="w-full bg-gray-100 dark:bg-gray-700 h-1.5 rounded-full overflow-hidden mt-1">
                    <div
                      className="bg-indigo-600 h-1.5 rounded-full"
                      style={{ width: `${Math.min(100, progress)}%` }}
                    />
                  </div>
                </div>
              </div>

              {/* 하단 액션 버튼 */}
              <div className="mt-4 flex items-center justify-between gap-2 pt-1">
                <button
                  type="button"
                  onClick={() => handleCopyStatement(card)}
                  className={`flex-1 py-2 px-3 rounded-xl text-xs font-bold border flex items-center justify-center gap-1.5 transition-all ${
                    isCopied
                      ? 'bg-emerald-600 text-white border-emerald-600'
                      : 'bg-gray-50 dark:bg-gray-700/60 hover:bg-gray-100 text-gray-700 dark:text-gray-200 border-gray-200 dark:border-gray-600'
                  }`}
                  title="텔레그램/카톡에 붙여넣을 수 있는 정산서 텍스트를 복사합니다."
                >
                  {isCopied ? <Check size={13} /> : <Copy size={13} />}
                  {isCopied ? '복사 완료' : '정산서 텍스트 복사'}
                </button>

                {onSelectPartner && (
                  <button
                    type="button"
                    onClick={() => onSelectPartner(card.partnerId)}
                    className="p-2 text-gray-400 hover:text-indigo-600 hover:bg-indigo-50 dark:hover:bg-gray-700 rounded-xl transition-colors"
                    title="상세 정산 원장 보기"
                  >
                    <ArrowUpRight size={16} />
                  </button>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
};

export default PartnerSettlementOverviewTab;
