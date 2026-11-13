import React, { useState, useMemo } from 'react';
import { AgentSettlementRowItem, AgentProblemCase, SettlementPolicy, policyLabel as policyLabelOf, payoutScheduleLabel as payoutScheduleLabelOf } from '../../services/settlementMasterService';
import { Users, DollarSign, Calendar, TrendingUp, Settings, Download, Search, ChevronRight, X, Award, ShieldCheck } from 'lucide-react';
import * as XLSX from 'xlsx';

interface AgentCommissionTabProps {
  agentRows: AgentSettlementRowItem[];
  problemCases?: AgentProblemCase[];
  policy: SettlementPolicy;
  policyIsDefault?: boolean;
  policyMessage?: string;
  periodLabel?: string;
  onOpenPolicyModal?: () => void;
}

export default function AgentCommissionTab({
  agentRows = [],
  problemCases = [],
  policy,
  policyIsDefault = false,
  policyMessage,
  periodLabel,
  onOpenPolicyModal,
}: AgentCommissionTabProps) {
  const [searchTerm, setSearchTerm] = useState('');
  const [sortBy, setSortBy] = useState<'commission_desc' | 'cases_desc' | 'name_asc'>('commission_desc');
  const [selectedAgent, setSelectedAgent] = useState<AgentSettlementRowItem | null>(null);

  const safeRows = useMemo(() => Array.isArray(agentRows) ? agentRows : [], [agentRows]);

  // 1. 전체 합계 지표 계산
  const totalStats = useMemo(() => {
    const totalCases = safeRows.reduce((sum, r) => sum + (r.caseCount || 0), 0);
    const totalPartnerFee = safeRows.reduce((sum, r) => sum + (r.totalPartnerFeeWon || 0), 0);
    const totalCompanyMargin = safeRows.reduce((sum, r) => sum + (r.companyShareWon || 0), 0);
    const totalAgentCommission = safeRows.reduce((sum, r) => sum + (r.agentShareWon || 0), 0);
    return {
      totalCases,
      totalPartnerFee,
      totalCompanyMargin,
      totalAgentCommission,
    };
  }, [safeRows]);

  // 2. 지급 일정 정보
  const nextPayoutDate = safeRows[0]?.nextPayoutDate || '-';
  const payoutDDay = safeRows[0]?.payoutDDay ?? 0;

  const payoutScheduleLabel = payoutScheduleLabelOf(policy);

  // 정책 요약 라벨
  const policyLabel = policyLabelOf(policy);

  // 3. 필터 및 정렬
  const filteredAndSortedRows = useMemo(() => {
    let list = safeRows.filter(r =>
      (r.agentName || '').toLowerCase().includes(searchTerm.toLowerCase()) ||
      (r.agentId || '').toLowerCase().includes(searchTerm.toLowerCase())
    );

    if (sortBy === 'commission_desc') {
      list.sort((a, b) => b.agentShareWon - a.agentShareWon);
    } else if (sortBy === 'cases_desc') {
      list.sort((a, b) => b.caseCount - a.caseCount);
    } else if (sortBy === 'name_asc') {
      list.sort((a, b) => a.agentName.localeCompare(b.agentName));
    }

    return list;
  }, [safeRows, searchTerm, sortBy]);

  // 엑셀 내보내기
  const handleExportExcel = () => {
    const exportData = filteredAndSortedRows.map(r => ({
      '상담원명': r.agentName,
      '아이디/계정': r.agentId,
      '수임 건수': r.caseCount,
      '발생 수수료(원)': r.totalPartnerFeeWon,
      '회사 몫(원)': r.companyShareWon,
      '실지급 수당(원)': r.agentShareWon,
      '지급 예정일': r.nextPayoutDate,
      '지급 메모': r.payoutNote || '',
    }));

    const ws = XLSX.utils.json_to_sheet(exportData);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, '상담원수당정산');
    XLSX.writeFile(wb, `상담원_수당_정산대장_${new Date().toISOString().slice(0, 10)}.xlsx`);
  };

  return (
    <div className="space-y-6">
      {/* 1. 상단 메인 KPI 전광판 & 지급 안내 */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        {/* 다음 급여 지급일 */}
        <div className="bg-gradient-to-br from-indigo-900/60 to-purple-900/40 border border-indigo-700/50 rounded-xl p-5 shadow-lg backdrop-blur relative overflow-hidden">
          <div className="flex items-center justify-between mb-2">
            <span className="text-xs font-semibold text-indigo-300 flex items-center gap-1.5">
              <Calendar className="w-4 h-4 text-indigo-400" />
              다음 수당 지급일
            </span>
            <span className={`text-xs px-2 py-0.5 rounded-full font-bold ${
              payoutDDay <= 3 ? 'bg-rose-500/20 text-rose-300 border border-rose-500/40' : 'bg-indigo-500/20 text-indigo-300'
            }`}>
              {payoutDDay === 0 ? 'D-Day 오늘!' : payoutDDay > 0 ? `D-${payoutDDay}` : `D+${Math.abs(payoutDDay)}`}
            </span>
          </div>
          <div className="text-2xl font-black text-white tracking-tight">
            {nextPayoutDate}
          </div>
          <div className="mt-2 text-xs text-indigo-200/80 flex items-center gap-1">
            <span className="inline-block w-2 h-2 rounded-full bg-emerald-400"></span>
            {payoutScheduleLabel}
          </div>
        </div>

        {/* 이번 달 상담원 총 수당 */}
        <div className="bg-slate-900/80 border border-slate-800 rounded-xl p-5 shadow-lg">
          <div className="flex items-center justify-between mb-2">
            <span className="text-xs font-semibold text-slate-400 flex items-center gap-1.5">
              <DollarSign className="w-4 h-4 text-emerald-400" />
              상담원 지급 총 수당
            </span>
            <span className="text-xs bg-emerald-500/10 text-emerald-400 px-2 py-0.5 rounded-full font-medium">
              인건비성 지출
            </span>
          </div>
          <div className="text-2xl font-black text-emerald-400 tracking-tight">
            ₩{totalStats.totalAgentCommission.toLocaleString()}
          </div>
          <div className="mt-2 text-xs text-slate-400">
            총 {totalStats.totalCases}건 수임 달성 수당
          </div>
        </div>

        {/* 회사 순 마진 합계 */}
        <div className="bg-slate-900/80 border border-slate-800 rounded-xl p-5 shadow-lg">
          <div className="flex items-center justify-between mb-2">
            <span className="text-xs font-semibold text-slate-400 flex items-center gap-1.5">
              <ShieldCheck className="w-4 h-4 text-sky-400" />
              회사 차감 마진 합계
            </span>
            <span className="text-xs bg-sky-500/10 text-sky-400 px-2 py-0.5 rounded-full font-medium">
              회사 몫
            </span>
          </div>
          <div className="text-2xl font-black text-sky-400 tracking-tight">
            ₩{totalStats.totalCompanyMargin.toLocaleString()}
          </div>
          <div className="mt-2 text-xs text-slate-400">
            총 매출 ₩{totalStats.totalPartnerFee.toLocaleString()} 중 공제
          </div>
        </div>

        {/* 분배 정책 배너 */}
        <div className="bg-slate-900/80 border border-slate-800 rounded-xl p-5 shadow-lg flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between mb-2">
              <span className="text-xs font-semibold text-slate-400 flex items-center gap-1.5">
                <Settings className="w-4 h-4 text-amber-400" />
                적용 분배 정책
              </span>
              <span className="text-xs bg-amber-500/10 text-amber-300 px-2 py-0.5 rounded-full font-medium">
                자동 분배
              </span>
            </div>
            <div className="text-sm font-bold text-white line-clamp-1">
              {policyLabel}
            </div>
            <div className="text-xs text-slate-400 mt-1">
              팀 관리 근태/성과 및 수임 건 100% 직통
            </div>
          </div>
          {onOpenPolicyModal && (
            <button
              onClick={onOpenPolicyModal}
              className="mt-3 w-full py-1.5 bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-semibold rounded-lg transition-all border border-slate-700 flex items-center justify-center gap-1.5 shadow-sm"
            >
              <Settings className="w-3.5 h-3.5 text-amber-400" />
              정산 정책 및 분배율 변경
            </button>
          )}
        </div>
      </div>

      {/* 기간·정책 상태 안내 */}
      <div className="flex flex-wrap items-center gap-2 text-xs">
        {periodLabel && (
          <span className="px-2.5 py-1 rounded-full bg-slate-800 text-slate-300 border border-slate-700">
            기간: {periodLabel} (거래처 수수료 지급 사유 발생일 기준, 부가세 제외)
          </span>
        )}
        {policyIsDefault && (
          <span className="px-2.5 py-1 rounded-full bg-amber-500/15 text-amber-300 border border-amber-500/40" title={policyMessage}>
            분배 정책 기본값(저장 안 됨){policyMessage ? ` · ${policyMessage}` : ''}
          </span>
        )}
      </div>

      {problemCases.length > 0 && (
        <div className="bg-amber-950/40 border border-amber-700/50 rounded-xl p-4 text-xs text-amber-200">
          <div className="font-bold mb-2">
            ⚠ 수당 계산에서 뺀 리드 {problemCases.length}건 — 거래처 수당 규칙·수임료를 확인해 주세요
          </div>
          <ul className="space-y-1 max-h-40 overflow-y-auto">
            {problemCases.slice(0, 50).map(p => (
              <li key={p.caseId} className="flex flex-wrap gap-2">
                <span className="font-semibold text-white">{p.customerName || p.caseId}</span>
                <span className="text-amber-300/80">담당 {p.agentName}</span>
                <span className="text-amber-400">{p.problem}</span>
              </li>
            ))}
          </ul>
          {problemCases.length > 50 && <div className="mt-1 text-amber-300/70">외 {problemCases.length - 50}건</div>}
        </div>
      )}

      {/* 2. 검색 및 컨트롤 바 */}
      <div className="flex flex-col sm:flex-row items-center justify-between gap-4 bg-slate-900/60 p-4 rounded-xl border border-slate-800">
        <div className="relative w-full sm:w-72">
          <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
          <input
            type="text"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            placeholder="상담원 이름 또는 계정 검색..."
            className="w-full pl-9 pr-4 py-2 bg-slate-950 border border-slate-800 rounded-lg text-sm text-slate-200 placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-indigo-500"
          />
          {searchTerm && (
            <button
              onClick={() => setSearchTerm('')}
              className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-200"
            >
              <X className="w-3.5 h-3.5" />
            </button>
          )}
        </div>

        <div className="flex items-center gap-2.5 w-full sm:w-auto justify-end">
          <select
            value={sortBy}
            onChange={(e) => setSortBy(e.target.value as any)}
            className="bg-slate-950 border border-slate-800 text-slate-200 text-xs rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-indigo-500"
          >
            <option value="commission_desc">실지급 수당 높은 순</option>
            <option value="cases_desc">수임 건수 많은 순</option>
            <option value="name_asc">상담원 이름 가나다 순</option>
          </select>

          <button
            onClick={handleExportExcel}
            className="flex items-center gap-1.5 px-3.5 py-2 bg-emerald-600/90 hover:bg-emerald-500 text-white text-xs font-semibold rounded-lg transition-all shadow-sm"
          >
            <Download className="w-3.5 h-3.5" />
            엑셀 다운로드
          </button>
        </div>
      </div>

      {/* 3. 상담원 수당 정산 대장 테이블 */}
      <div className="bg-slate-900/80 border border-slate-800 rounded-xl overflow-hidden shadow-xl">
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse text-sm">
            <thead>
              <tr className="bg-slate-950/70 border-b border-slate-800 text-xs font-semibold text-slate-400">
                <th className="py-3.5 px-4">순위</th>
                <th className="py-3.5 px-4">상담원명</th>
                <th className="py-3.5 px-4 text-center">수임 성공</th>
                <th className="py-3.5 px-4 text-right">총 거래처 수수료</th>
                <th className="py-3.5 px-4 text-right">회사 마진 공제</th>
                <th className="py-3.5 px-4 text-right text-emerald-400 font-bold">실지급 수당</th>
                <th className="py-3.5 px-4 text-center">지급 일정</th>
                <th className="py-3.5 px-4 text-center">상세</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800/60 text-slate-200">
              {filteredAndSortedRows.length === 0 ? (
                <tr>
                  <td colSpan={8} className="py-12 text-center text-slate-500">
                    등록된 수임 건 또는 검색 조건과 일치하는 상담원이 없습니다.
                  </td>
                </tr>
              ) : (
                filteredAndSortedRows.map((row, idx) => (
                  <tr
                    key={row.agentId}
                    className="hover:bg-slate-800/40 transition-colors group cursor-pointer"
                    onClick={() => setSelectedAgent(row)}
                  >
                    <td className="py-3.5 px-4 text-slate-400 text-xs">
                      {idx === 0 ? (
                        <span className="flex items-center gap-1 text-amber-400 font-bold">
                          <Award className="w-4 h-4" /> 1위
                        </span>
                      ) : idx === 1 ? (
                        <span className="flex items-center gap-1 text-slate-300 font-bold">
                          <Award className="w-4 h-4 text-slate-300" /> 2위
                        </span>
                      ) : idx === 2 ? (
                        <span className="flex items-center gap-1 text-amber-600 font-bold">
                          <Award className="w-4 h-4 text-amber-600" /> 3위
                        </span>
                      ) : (
                        `${idx + 1}`
                      )}
                    </td>
                    <td className="py-3.5 px-4">
                      <div className="font-semibold text-white group-hover:text-indigo-400 transition-colors">
                        {row.agentName}
                      </div>
                      <div className="text-xs text-slate-500 truncate max-w-[150px]">
                        {row.agentId}
                      </div>
                    </td>
                    <td className="py-3.5 px-4 text-center font-bold text-indigo-300">
                      {row.caseCount}건
                    </td>
                    <td className="py-3.5 px-4 text-right font-medium text-slate-300">
                      ₩{row.totalPartnerFeeWon.toLocaleString()}
                    </td>
                    <td className="py-3.5 px-4 text-right text-rose-400/90 font-medium text-xs">
                      -₩{row.companyShareWon.toLocaleString()}
                    </td>
                    <td className="py-3.5 px-4 text-right font-extrabold text-emerald-400 text-base">
                      ₩{row.agentShareWon.toLocaleString()}
                    </td>
                    <td className="py-3.5 px-4 text-center text-xs">
                      <span className="px-2 py-1 bg-slate-800 text-slate-300 rounded font-medium">
                        {row.nextPayoutDate}
                      </span>
                      {row.payoutNote && <span className="block mt-1 text-[10px] text-slate-500">{row.payoutNote}</span>}
                    </td>
                    <td className="py-3.5 px-4 text-center">
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          setSelectedAgent(row);
                        }}
                        className="p-1.5 hover:bg-slate-700/60 rounded-lg text-slate-400 hover:text-white transition-all"
                      >
                        <ChevronRight className="w-4 h-4" />
                      </button>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* 4. 상담원별 수임 건 상세 모달 */}
      {selectedAgent && (
        <div className="fixed inset-0 z-50 bg-black/70 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-slate-900 border border-slate-800 rounded-2xl w-full max-w-3xl overflow-hidden shadow-2xl animate-in fade-in zoom-in-95 duration-200">
            {/* 헤더 */}
            <div className="flex items-center justify-between p-5 border-b border-slate-800 bg-slate-950/80">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-indigo-600/20 text-indigo-400 flex items-center justify-center font-bold">
                  <Users className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="text-lg font-bold text-white flex items-center gap-2">
                    {selectedAgent.agentName} 상담원 수임 내역
                    <span className="text-xs px-2 py-0.5 bg-indigo-500/20 text-indigo-300 rounded-full font-medium">
                      총 {selectedAgent.caseCount}건
                    </span>
                  </h3>
                  <p className="text-xs text-slate-400">
                    지급 예정 수당: <strong className="text-emerald-400">₩{selectedAgent.agentShareWon.toLocaleString()}</strong> (회사 차감 마진: ₩{selectedAgent.companyShareWon.toLocaleString()})
                  </p>
                </div>
              </div>
              <button
                onClick={() => setSelectedAgent(null)}
                className="p-2 text-slate-400 hover:text-white rounded-lg hover:bg-slate-800 transition-colors"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* 케이스 목록 */}
            <div className="p-5 max-h-[60vh] overflow-y-auto space-y-3">
              {selectedAgent.caseList.length === 0 ? (
                <div className="text-center py-8 text-slate-500 text-sm">
                  상세 내역이 존재하지 않습니다.
                </div>
              ) : (
                <div className="divide-y divide-slate-800/80 border border-slate-800 rounded-xl overflow-hidden">
                  <div className="grid grid-cols-5 gap-2 px-4 py-2.5 bg-slate-950 text-xs font-semibold text-slate-400">
                    <span>고객명</span>
                    <span>계약일 / 수수료 발생일</span>
                    <span className="text-right">수임료</span>
                    <span className="text-right">거래처 수수료</span>
                    <span className="text-right text-emerald-400 font-bold">상담원 수당</span>
                  </div>
                  {selectedAgent.caseList.map((c, i) => (
                    <div
                      key={c.caseId || i}
                      className="grid grid-cols-5 gap-2 px-4 py-3 text-xs text-slate-300 hover:bg-slate-800/40 items-center"
                    >
                      <span className="font-medium text-white">{c.customerName || '고객'}</span>
                      <span className="text-slate-400">
                        {c.contractDate || '-'}
                        {c.earnedAt && <span className="block text-[10px] text-slate-500">발생 {c.earnedAt}</span>}
                      </span>
                      <span className="text-right text-slate-300">
                        ₩{c.contractFeeWon ? c.contractFeeWon.toLocaleString() : '0'}
                      </span>
                      <span className="text-right text-slate-300 font-medium">
                        ₩{c.partnerFeeWon ? c.partnerFeeWon.toLocaleString() : '0'}
                      </span>
                      <span className="text-right font-bold text-emerald-400 text-sm">
                        ₩{c.agentShareWon ? c.agentShareWon.toLocaleString() : '0'}
                      </span>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* 푸터 */}
            <div className="p-4 border-t border-slate-800 bg-slate-950/80 flex items-center justify-between text-xs text-slate-400">
              <div>
                * 본 수당은 거래처 계약 수수료에서 회사 정책에 따른 마진을 공제한 실수령액입니다.
              </div>
              <button
                onClick={() => setSelectedAgent(null)}
                className="px-4 py-2 bg-slate-800 hover:bg-slate-700 text-white rounded-lg font-semibold transition-colors"
              >
                닫기
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
