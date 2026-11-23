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
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {/* 다음 급여 지급일 */}
        <div className="bg-card text-card-foreground p-5 rounded-xl border border-border shadow-2xs flex flex-col justify-between hover:border-primary/40 transition-all card-interactive">
          <div>
            <div className="flex items-center justify-between text-xs text-muted-foreground font-medium mb-1.5">
              <span className="flex items-center gap-1.5">
                <Calendar className="w-3.5 h-3.5 text-primary" strokeWidth={1.75} />
                다음 수당 지급일
              </span>
              <span className={`text-[11px] px-2 py-0.5 rounded-full font-mono font-semibold border ${
                payoutDDay <= 3 ? 'bg-destructive/10 text-destructive border-destructive/20' : 'bg-primary/10 text-primary border-primary/20'
              }`}>
                {payoutDDay === 0 ? 'D-Day 오늘' : payoutDDay > 0 ? `D-${payoutDDay}` : `D+${Math.abs(payoutDDay)}`}
              </span>
            </div>
            <div className="text-2xl font-bold text-foreground font-mono tabular-nums tracking-tight">
              {nextPayoutDate}
            </div>
          </div>
          <div className="mt-2.5 text-xs text-muted-foreground flex items-center gap-1.5 font-normal">
            <span className="inline-block w-1.5 h-1.5 rounded-full bg-primary"></span>
            {payoutScheduleLabel}
          </div>
        </div>

        {/* 이번 달 상담원 총 수당 */}
        <div className="bg-card text-card-foreground p-5 rounded-xl border border-border shadow-2xs flex flex-col justify-between hover:border-primary/40 transition-all card-interactive">
          <div>
            <div className="flex items-center justify-between text-xs text-muted-foreground font-medium mb-1.5">
              <span className="flex items-center gap-1.5">
                <DollarSign className="w-3.5 h-3.5 text-primary" strokeWidth={1.75} />
                상담원 지급 총 수당
              </span>
              <span className="text-[11px] px-2 py-0.5 rounded-full font-semibold bg-muted text-muted-foreground border border-border">
                인건비성 지출
              </span>
            </div>
            <div className="flex items-baseline gap-1.5">
              <span className="text-2xl font-bold text-primary font-mono tabular-nums tracking-tight">
                ₩ {totalStats.totalAgentCommission.toLocaleString()}
              </span>
              <span className="text-xs font-semibold text-muted-foreground">원</span>
            </div>
          </div>
          <div className="mt-2.5 text-xs text-muted-foreground font-normal">
            총 {totalStats.totalCases.toLocaleString()}건 수임 달성 수당
          </div>
        </div>

        {/* 회사 순 마진 합계 */}
        <div className="bg-card text-card-foreground p-5 rounded-xl border border-border shadow-2xs flex flex-col justify-between hover:border-primary/40 transition-all card-interactive">
          <div>
            <div className="flex items-center justify-between text-xs text-muted-foreground font-medium mb-1.5">
              <span className="flex items-center gap-1.5">
                <ShieldCheck className="w-3.5 h-3.5 text-primary" strokeWidth={1.75} />
                회사 차감 마진 합계
              </span>
              <span className="text-[11px] px-2 py-0.5 rounded-full font-semibold bg-muted text-muted-foreground border border-border">
                회사 몫
              </span>
            </div>
            <div className="flex items-baseline gap-1.5">
              <span className="text-2xl font-bold text-foreground font-mono tabular-nums tracking-tight">
                ₩ {totalStats.totalCompanyMargin.toLocaleString()}
              </span>
              <span className="text-xs font-semibold text-muted-foreground">원</span>
            </div>
          </div>
          <div className="mt-2.5 text-xs text-muted-foreground font-normal">
            총 매출 ₩ {totalStats.totalPartnerFee.toLocaleString()}원 중 공제
          </div>
        </div>

        {/* 분배 정책 배너 */}
        <div className="bg-card text-card-foreground p-5 rounded-xl border border-border shadow-2xs flex flex-col justify-between hover:border-primary/40 transition-all card-interactive">
          <div>
            <div className="flex items-center justify-between text-xs text-muted-foreground font-medium mb-1.5">
              <span className="flex items-center gap-1.5">
                <Settings className="w-3.5 h-3.5 text-primary" strokeWidth={1.75} />
                적용 분배 정책
              </span>
              <span className="text-[11px] px-2 py-0.5 rounded-full font-semibold bg-primary/10 text-primary border border-primary/20">
                자동 분배
              </span>
            </div>
            <div className="text-sm font-semibold text-foreground line-clamp-1">
              {policyLabel}
            </div>
            <div className="text-xs text-muted-foreground mt-1">
              팀 관리 근태/성과 및 수임 건 100% 직통
            </div>
          </div>
          {onOpenPolicyModal && (
            <button
              onClick={onOpenPolicyModal}
              className="mt-3 w-full py-1.5 bg-muted/60 hover:bg-muted text-foreground text-xs font-semibold rounded-lg transition-all border border-border flex items-center justify-center gap-1.5 shadow-2xs cursor-pointer"
            >
              <Settings className="w-3.5 h-3.5 text-primary" strokeWidth={1.75} />
              정산 정책 및 분배율 변경
            </button>
          )}
        </div>
      </div>

      {/* 기간·정책 상태 안내 */}
      <div className="flex flex-wrap items-center gap-2 text-xs">
        {periodLabel && (
          <span className="px-2.5 py-1 rounded font-mono text-2xs bg-muted/60 text-muted-foreground border border-border">
            기간: {periodLabel} (거래처 수수료 지급 사유 발생일 기준, 부가세 제외)
          </span>
        )}
        {policyIsDefault && (
          <span className="px-2.5 py-1 rounded font-mono text-2xs bg-amber-500/10 text-amber-500 border border-amber-500/20" title={policyMessage}>
            분배 정책 기본값(저장 안 됨){policyMessage ? ` · ${policyMessage}` : ''}
          </span>
        )}
      </div>

      {problemCases.length > 0 && (
        <div className="bg-amber-500/5 border border-amber-500/20 rounded-xl p-4 text-xs text-foreground">
          <div className="font-semibold text-amber-500 mb-2 flex items-center gap-1.5">
            <span>⚠️</span>
            <span>수당 계산에서 뺀 리드 {problemCases.length}건 — 거래처 수당 규칙·수임료를 확인해 주세요</span>
          </div>
          <ul className="space-y-1.5 max-h-40 overflow-y-auto">
            {problemCases.slice(0, 50).map(p => (
              <li key={p.caseId} className="flex flex-wrap items-center gap-2 text-xs font-mono">
                <span className="font-semibold text-foreground">{p.customerName || p.caseId}</span>
                <span className="text-muted-foreground">담당 {p.agentName}</span>
                <span className="text-amber-500 font-medium">{p.problem}</span>
              </li>
            ))}
          </ul>
          {problemCases.length > 50 && <div className="mt-1 text-xs text-muted-foreground font-mono">외 {problemCases.length - 50}건</div>}
        </div>
      )}

      {/* 2. 검색 및 컨트롤 바 */}
      <div className="flex flex-col sm:flex-row items-center justify-between gap-3 bg-card p-4 rounded-xl border border-border shadow-2xs">
        <div className="relative w-full sm:w-72">
          <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" strokeWidth={1.75} />
          <input
            type="text"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            placeholder="상담원 이름 또는 계정 검색..."
            className="w-full pl-9 pr-8 py-2 bg-muted/40 border border-border rounded-lg text-xs font-mono text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-primary"
          />
          {searchTerm && (
            <button
              onClick={() => setSearchTerm('')}
              className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground cursor-pointer"
            >
              <X className="w-3.5 h-3.5" />
            </button>
          )}
        </div>

        <div className="flex items-center gap-2.5 w-full sm:w-auto justify-end">
          <select
            value={sortBy}
            onChange={(e) => setSortBy(e.target.value as any)}
            className="bg-muted/40 border border-border text-foreground text-xs rounded-lg px-3 py-2 focus:outline-none focus:ring-1 focus:ring-primary font-mono cursor-pointer"
          >
            <option value="commission_desc">실지급 수당 높은 순</option>
            <option value="cases_desc">수임 건수 많은 순</option>
            <option value="name_asc">상담원 이름 가나다 순</option>
          </select>

          <button
            onClick={handleExportExcel}
            className="flex items-center gap-1.5 px-3.5 py-2 bg-primary hover:bg-primary/90 text-primary-foreground text-xs font-semibold rounded-lg transition-all shadow-2xs cursor-pointer"
          >
            <Download className="w-3.5 h-3.5" strokeWidth={1.75} />
            엑셀 다운로드
          </button>
        </div>
      </div>

      {/* 3. 상담원 수당 정산 대장 테이블 */}
      <div className="bg-card border border-border rounded-xl overflow-hidden shadow-2xs">
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse text-xs">
            <thead>
              <tr className="bg-muted/40 border-b border-border text-muted-foreground font-mono font-medium">
                <th className="py-3 px-4">순위</th>
                <th className="py-3 px-4">상담원명</th>
                <th className="py-3 px-4 text-center">수임 성공</th>
                <th className="py-3 px-4 text-right">총 거래처 수수료</th>
                <th className="py-3 px-4 text-right">회사 마진 공제</th>
                <th className="py-3 px-4 text-right text-primary font-semibold">실지급 수당</th>
                <th className="py-3 px-4 text-center">지급 일정</th>
                <th className="py-3 px-4 text-center">상세</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border/60 text-foreground">
              {filteredAndSortedRows.length === 0 ? (
                <tr>
                  <td colSpan={8} className="py-12 text-center text-muted-foreground font-mono text-xs">
                    등록된 수임 건 또는 검색 조건과 일치하는 상담원이 없습니다.
                  </td>
                </tr>
              ) : (
                filteredAndSortedRows.map((row, idx) => (
                  <tr
                    key={row.agentId}
                    className="hover:bg-muted/40 transition-colors group cursor-pointer"
                    onClick={() => setSelectedAgent(row)}
                  >
                    <td className="py-3 px-4 text-muted-foreground font-mono">
                      {idx === 0 ? (
                        <span className="inline-flex items-center gap-1 text-primary font-bold">
                          <Award className="w-3.5 h-3.5" strokeWidth={2} /> 1위
                        </span>
                      ) : idx === 1 ? (
                        <span className="inline-flex items-center gap-1 text-foreground font-semibold">
                          <Award className="w-3.5 h-3.5 text-muted-foreground" strokeWidth={2} /> 2위
                        </span>
                      ) : idx === 2 ? (
                        <span className="inline-flex items-center gap-1 text-muted-foreground font-semibold">
                          <Award className="w-3.5 h-3.5 text-muted-foreground" strokeWidth={2} /> 3위
                        </span>
                      ) : (
                        `${idx + 1}`
                      )}
                    </td>
                    <td className="py-3 px-4">
                      <div className="font-semibold text-foreground group-hover:text-primary transition-colors">
                        {row.agentName}
                      </div>
                      <div className="text-2xs text-muted-foreground font-mono truncate max-w-[150px]">
                        {row.agentId}
                      </div>
                    </td>
                    <td className="py-3 px-4 text-center font-mono font-medium text-foreground">
                      {row.caseCount}건
                    </td>
                    <td className="py-3 px-4 text-right font-mono text-muted-foreground">
                      ₩ {row.totalPartnerFeeWon.toLocaleString()}
                    </td>
                    <td className="py-3 px-4 text-right text-muted-foreground text-xs font-mono">
                      -₩ {row.companyShareWon.toLocaleString()}
                    </td>
                    <td className="py-3 px-4 text-right font-bold text-primary text-sm font-mono tabular-nums">
                      ₩ {row.agentShareWon.toLocaleString()}
                    </td>
                    <td className="py-3 px-4 text-center text-xs">
                      <span className="px-2 py-0.5 bg-muted/60 text-muted-foreground rounded font-mono text-2xs border border-border">
                        {row.nextPayoutDate}
                      </span>
                      {row.payoutNote && <span className="block mt-0.5 text-2xs text-muted-foreground">{row.payoutNote}</span>}
                    </td>
                    <td className="py-3 px-4 text-center">
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          setSelectedAgent(row);
                        }}
                        className="p-1.5 hover:bg-muted rounded-md text-muted-foreground hover:text-foreground transition-all cursor-pointer"
                      >
                        <ChevronRight className="w-4 h-4" strokeWidth={1.75} />
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
        <div className="fixed inset-0 z-50 bg-black/70 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-card border border-border rounded-2xl w-full max-w-3xl overflow-hidden shadow-2xl animate-in fade-in zoom-in-95 duration-150 text-foreground">
            {/* 헤더 */}
            <div className="flex items-center justify-between p-5 border-b border-border bg-muted/30">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-primary/10 text-primary border border-primary/20 flex items-center justify-center font-bold">
                  <Users className="w-5 h-5" strokeWidth={1.75} />
                </div>
                <div>
                  <h3 className="text-base font-bold text-foreground flex items-center gap-2">
                    {selectedAgent.agentName} 상담원 수임 내역
                    <span className="text-2xs px-2 py-0.5 bg-primary/10 text-primary border border-primary/20 rounded-full font-mono font-medium">
                      총 {selectedAgent.caseCount}건
                    </span>
                  </h3>
                  <p className="text-xs text-muted-foreground font-mono mt-0.5">
                    지급 예정 수당: <strong className="text-primary font-bold">₩ {selectedAgent.agentShareWon.toLocaleString()}원</strong> (회사 차감 마진: ₩ {selectedAgent.companyShareWon.toLocaleString()}원)
                  </p>
                </div>
              </div>
              <button
                onClick={() => setSelectedAgent(null)}
                className="p-1.5 text-muted-foreground hover:text-foreground rounded-lg hover:bg-muted transition-colors cursor-pointer"
              >
                <X className="w-5 h-5" strokeWidth={1.75} />
              </button>
            </div>

            {/* 케이스 목록 */}
            <div className="p-5 max-h-[60vh] overflow-y-auto space-y-3">
              {selectedAgent.caseList.length === 0 ? (
                <div className="text-center py-8 text-muted-foreground text-xs font-mono">
                  상세 내역이 존재하지 않습니다.
                </div>
              ) : (
                <div className="divide-y divide-border/60 border border-border rounded-xl overflow-hidden bg-card">
                  <div className="grid grid-cols-5 gap-2 px-4 py-2.5 bg-muted/40 text-xs font-mono font-medium text-muted-foreground">
                    <span>고객명</span>
                    <span>계약일 / 수수료 발생일</span>
                    <span className="text-right">수임료</span>
                    <span className="text-right">거래처 수수료</span>
                    <span className="text-right text-primary font-semibold">상담원 수당</span>
                  </div>
                  {selectedAgent.caseList.map((c, i) => (
                    <div
                      key={c.caseId || i}
                      className="grid grid-cols-5 gap-2 px-4 py-3 text-xs text-foreground hover:bg-muted/40 transition-colors items-center font-mono tabular-nums"
                    >
                      <span className="font-semibold text-foreground">{c.customerName || '고객'}</span>
                      <span className="text-muted-foreground text-2xs">
                        {c.contractDate || '-'}
                        {c.earnedAt && <span className="block text-muted-foreground">발생 {c.earnedAt}</span>}
                      </span>
                      <span className="text-right text-muted-foreground">
                        ₩ {c.contractFeeWon ? c.contractFeeWon.toLocaleString() : '0'}
                      </span>
                      <span className="text-right text-muted-foreground">
                        ₩ {c.partnerFeeWon ? c.partnerFeeWon.toLocaleString() : '0'}
                      </span>
                      <span className="text-right font-bold text-primary text-sm">
                        ₩ {c.agentShareWon ? c.agentShareWon.toLocaleString() : '0'}
                      </span>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* 푸터 */}
            <div className="p-4 border-t border-border bg-muted/30 flex items-center justify-between text-xs text-muted-foreground">
              <div className="text-2xs">
                * 본 수당은 거래처 계약 수수료에서 회사 정책에 따른 마진을 공제한 실수령액입니다.
              </div>
              <button
                onClick={() => setSelectedAgent(null)}
                className="px-4 py-2 bg-primary hover:bg-primary/90 text-primary-foreground rounded-lg font-semibold text-xs shadow-2xs transition-colors cursor-pointer"
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
