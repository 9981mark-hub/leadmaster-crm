/**
 * components/auto-dial/AutoDialCampaignModal.tsx
 * 관리자 전용 오토콜 캠페인 생성 및 상담원별 목표 콜수 일일 자동 배정 모달
 */
import React, { useState, useMemo } from 'react';
import {
  X, PhoneCall, Users, Settings2, Filter,
  CheckCircle2, AlertCircle, RefreshCw, Smartphone,
  Clock, Zap, Check, ChevronRight
} from 'lucide-react';
import { useToast } from '../../contexts/ToastContext';
import { Case } from '../../types';
import { TeamMember } from '../../services/team';
import {
  createAutoDialCampaign,
  AutoDialCampaignFilter,
  AutoDialCampaignPacing
} from '../../services/autoDialV4Service';

interface AutoDialCampaignModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: () => void;
  orgId: string;
  cases: Case[];
  teamMembers: TeamMember[];
  currentUserEmail?: string;
}

export const AutoDialCampaignModal: React.FC<AutoDialCampaignModalProps> = ({
  isOpen,
  onClose,
  onSuccess,
  orgId,
  cases,
  teamMembers,
  currentUserEmail,
}) => {
  const { showToast } = useToast();
  const [isSubmitting, setIsSubmitting] = useState(false);

  // 기본 정보
  const todayStr = new Date().toISOString().slice(0, 10).replace(/-/g, '.');
  const [name, setName] = useState(`[${todayStr}] 오토콜 1차 집중 캠페인`);

  // 타깃 DB 필터
  const [selectedBatches, setSelectedBatches] = useState<string[]>([]);
  const [selectedStatuses, setSelectedStatuses] = useState<string[]>([
    '신규 접수', '신규', '부재 1차', '부재1차', '부재 2차', '부재2차'
  ]);
  const [excludeRecentHours, setExcludeRecentHours] = useState<number>(2);
  const [excludeDnc, setExcludeDnc] = useState<boolean>(true);

  // 상담원 배정
  const activeMembers = useMemo(() => {
    return teamMembers.filter(m => m.status === 'active');
  }, [teamMembers]);

  const [selectedAgentIds, setSelectedAgentIds] = useState<string[]>(() => 
    activeMembers.map(m => m.email)
  );
  const [isRoundRobin, setIsRoundRobin] = useState<boolean>(true);
  const [customQuotas, setCustomQuotas] = useState<Record<string, number>>({});

  // 발신 파라미터
  const [pacing, setPacing] = useState<AutoDialCampaignPacing>({
    ringTimeoutSeconds: 20,
    gapSeconds: 4,
    wrapUpLimitSeconds: 10,
    maxRetry: 3,
    retryIntervalMinutes: 120,
    dualSimRotation: true,
    autoSkipWrapUp: true,
  });

  // 사용 가능한 고유 회차 목록
  const availableBatches = useMemo(() => {
    const set = new Set<string>();
    cases.forEach(c => {
      if ((c as any).batchName) set.add((c as any).batchName);
      else if (c.inflowPath) set.add(c.inflowPath);
    });
    return Array.from(set).filter(Boolean);
  }, [cases]);

  // 실시간 타깃 후보 리드 필터링
  const candidateCases = useMemo(() => {
    const now = Date.now();
    const recentLimitMs = excludeRecentHours * 3600 * 1000;

    return cases.filter(c => {
      // 1. 유효 전화번호 확인
      if (!c.phone || c.phone.replace(/[^0-9]/g, '').length < 9) return false;

      // 2. 수신거부 제외
      if (excludeDnc && (c.status?.includes('거절') || c.status?.includes('진행불가') || c.status?.includes('종결'))) {
        return false;
      }

      // 3. 회차 필터
      if (selectedBatches.length > 0) {
        const bName = (c as any).batchName || c.inflowPath || '';
        if (!selectedBatches.includes(bName)) return false;
      }

      // 4. 상태 필터
      if (selectedStatuses.length > 0) {
        const cStatus = c.status || '신규';
        const matches = selectedStatuses.some(st => cStatus.includes(st));
        if (!matches) return false;
      }

      // 5. 최근 N시간 내 통화 건 제외
      if (excludeRecentHours > 0 && c.lastContactDate) {
        const lastMs = new Date(c.lastContactDate).getTime();
        if (now - lastMs < recentLimitMs) return false;
      }

      return true;
    });
  }, [cases, selectedBatches, selectedStatuses, excludeRecentHours, excludeDnc]);

  // 상담원별 배정 건수 계산
  const agentQuotas = useMemo(() => {
    const total = candidateCases.length;
    const agentCount = selectedAgentIds.length;
    if (agentCount === 0 || total === 0) return {};

    const result: Record<string, number> = {};
    if (isRoundRobin) {
      const perAgent = Math.floor(total / agentCount);
      const remainder = total % agentCount;
      selectedAgentIds.forEach((id, idx) => {
        result[id] = perAgent + (idx < remainder ? 1 : 0);
      });
    } else {
      selectedAgentIds.forEach(id => {
        result[id] = customQuotas[id] !== undefined ? customQuotas[id] : Math.floor(total / agentCount);
      });
    }
    return result;
  }, [candidateCases.length, selectedAgentIds, isRoundRobin, customQuotas]);

  if (!isOpen) return null;

  const handleToggleAgent = (email: string) => {
    setSelectedAgentIds(prev =>
      prev.includes(email) ? prev.filter(e => e !== email) : [...prev, email]
    );
  };

  const handleBatchToggle = (bName: string) => {
    setSelectedBatches(prev =>
      prev.includes(bName) ? prev.filter(b => b !== bName) : [...prev, bName]
    );
  };

  const handleStatusToggle = (status: string) => {
    setSelectedStatuses(prev =>
      prev.includes(status) ? prev.filter(s => s !== status) : [...prev, status]
    );
  };

  const handleSubmit = async () => {
    if (!name.trim()) {
      showToast('캠페인 이름을 입력해주세요.', 'warning');
      return;
    }
    if (selectedAgentIds.length === 0) {
      showToast('최소 1명 이상의 상담원을 배정해야 합니다.', 'warning');
      return;
    }
    if (candidateCases.length === 0) {
      showToast('선택한 조건에 일치하는 대상 리드가 없습니다.', 'warning');
      return;
    }

    setIsSubmitting(true);
    try {
      const allocations = selectedAgentIds.map(email => {
        const member = activeMembers.find(m => m.email === email);
        return {
          agentId: email,
          agentName: member?.displayName || email.split('@')[0],
          targetCount: agentQuotas[email] || 0,
        };
      });

      const res = await createAutoDialCampaign({
        orgId,
        name: name.trim(),
        createdBy: currentUserEmail || 'admin',
        filter: {
          batchIds: selectedBatches,
          statuses: selectedStatuses,
          excludeRecentHours,
          excludeDnc,
        },
        pacing,
        allocations,
        candidateCases,
      });

      showToast(`캠페인이 생성되었습니다! (총 ${res.totalAssigned}건 상담원 자동 배정 완료)`, 'success');
      onSuccess();
      onClose();
    } catch (err: any) {
      console.error('[AutoDialCampaignModal] Creation error:', err);
      showToast(err.message || '캠페인 생성에 실패했습니다.', 'error');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-in fade-in duration-200">
      <div className="bg-white dark:bg-gray-800 rounded-2xl w-full max-w-4xl max-h-[92vh] flex flex-col shadow-2xl border border-gray-100 dark:border-gray-700 overflow-hidden">
        {/* 헤더 */}
        <div className="flex items-center justify-between px-6 py-4.5 border-b border-gray-100 dark:border-gray-700 bg-gradient-to-r from-indigo-50/50 via-white to-purple-50/50 dark:from-gray-800 dark:via-gray-800 dark:to-gray-800">
          <div className="flex items-center gap-3">
            <div className="p-2.5 bg-indigo-600 text-white rounded-xl shadow-md shadow-indigo-500/20">
              <PhoneCall size={20} />
            </div>
            <div>
              <h2 className="text-lg font-bold text-gray-900 dark:text-gray-100 flex items-center gap-2">
                차세대 오토콜 캠페인 생성 & 일일 자동 배정
                <span className="text-xs px-2.5 py-0.5 rounded-full font-semibold bg-indigo-100 text-indigo-700 dark:bg-indigo-900/50 dark:text-indigo-300">
                  v4.0
                </span>
              </h2>
              <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">
                상담원의 고민 없는 연속 발신을 위해 관리자가 오늘 투입할 DB와 목표 콜수를 일괄 배정합니다.
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-2 text-gray-400 hover:text-gray-600 dark:hover:text-gray-200 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors"
          >
            <X size={20} />
          </button>
        </div>

        {/* 본문 스크롤 영역 */}
        <div className="flex-1 overflow-y-auto p-6 space-y-6">
          {/* 1. 캠페인 기본명 */}
          <div>
            <label className="block text-xs font-bold text-gray-700 dark:text-gray-300 uppercase tracking-wider mb-2">
              1. 캠페인 명칭
            </label>
            <input
              type="text"
              value={name}
              onChange={e => setName(e.target.value)}
              placeholder="예: [2026.11.12 오전] 신규 개인회생 1차 콜 캠페인"
              className="w-full px-4 py-2.5 bg-gray-50 dark:bg-gray-900 border border-gray-200 dark:border-gray-700 rounded-xl text-sm font-semibold text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-indigo-500"
            />
          </div>

          {/* 2. 대상 리드 필터링 & 추출 미리보기 */}
          <div className="p-4.5 bg-gray-50 dark:bg-gray-900/50 rounded-2xl border border-gray-200 dark:border-gray-700 space-y-4">
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold text-gray-700 dark:text-gray-300 uppercase tracking-wider flex items-center gap-1.5">
                <Filter size={14} className="text-indigo-600" />
                2. 타깃 리드 필터링 (Target DB)
              </span>
              <span className="text-xs font-bold px-3 py-1 bg-indigo-50 dark:bg-indigo-950/60 text-indigo-700 dark:text-indigo-300 border border-indigo-200 dark:border-indigo-800 rounded-full">
                추출 대상: 총 {candidateCases.length.toLocaleString()}건
              </span>
            </div>

            {/* 상태 선택 */}
            <div>
              <span className="text-xs font-medium text-gray-600 dark:text-gray-400 block mb-2">
                포함할 고객 상태:
              </span>
              <div className="flex flex-wrap gap-2">
                {[
                  { id: '신규 접수', label: '신규 접수 (미처리)' },
                  { id: '부재 1차', label: '부재 1차' },
                  { id: '부재 2차', label: '부재 2차' },
                  { id: '재통화', label: '재통화 요망' },
                  { id: '간편콜', label: '간편콜 인입' },
                ].map(st => {
                  const active = selectedStatuses.includes(st.id);
                  return (
                    <button
                      key={st.id}
                      type="button"
                      onClick={() => handleStatusToggle(st.id)}
                      className={`px-3 py-1.5 rounded-lg text-xs font-semibold border transition-all ${
                        active
                          ? 'bg-indigo-600 text-white border-indigo-600 shadow-sm'
                          : 'bg-white dark:bg-gray-800 text-gray-600 dark:text-gray-300 border-gray-200 dark:border-gray-700 hover:border-gray-300'
                      }`}
                    >
                      {active && <Check size={12} className="inline mr-1" />}
                      {st.label}
                    </button>
                  );
                })}
              </div>
            </div>

            {/* 회차 선택 */}
            {availableBatches.length > 0 && (
              <div>
                <div className="flex items-center justify-between mb-2">
                  <span className="text-xs font-medium text-gray-600 dark:text-gray-400">
                    대상 회차 (선택 안 할 시 전체 회차):
                  </span>
                  {selectedBatches.length > 0 && (
                    <button
                      type="button"
                      onClick={() => setSelectedBatches([])}
                      className="text-xs text-indigo-600 hover:underline"
                    >
                      전체 회차로 초기화
                    </button>
                  )}
                </div>
                <div className="flex flex-wrap gap-1.5 max-h-28 overflow-y-auto p-1">
                  {availableBatches.map(bName => {
                    const active = selectedBatches.includes(bName);
                    return (
                      <button
                        key={bName}
                        type="button"
                        onClick={() => handleBatchToggle(bName)}
                        className={`px-2.5 py-1 rounded-md text-xs border transition-all ${
                          active
                            ? 'bg-purple-600 text-white border-purple-600 font-bold'
                            : 'bg-white dark:bg-gray-800 text-gray-600 dark:text-gray-400 border-gray-200 dark:border-gray-700'
                        }`}
                      >
                        {bName}
                      </button>
                    );
                  })}
                </div>
              </div>
            )}

            {/* 제외 조건 */}
            <div className="flex flex-wrap items-center gap-6 pt-2 border-t border-gray-200/60 dark:border-gray-700 text-xs text-gray-600 dark:text-gray-400">
              <label className="flex items-center gap-2 cursor-pointer select-none">
                <input
                  type="checkbox"
                  checked={excludeRecentHours > 0}
                  onChange={e => setExcludeRecentHours(e.target.checked ? 2 : 0)}
                  className="rounded text-indigo-600 focus:ring-indigo-500"
                />
                <span>최근 2시간 이내 통화 시도 건 제외</span>
              </label>

              <label className="flex items-center gap-2 cursor-pointer select-none">
                <input
                  type="checkbox"
                  checked={excludeDnc}
                  onChange={e => setExcludeDnc(e.target.checked)}
                  className="rounded text-indigo-600 focus:ring-indigo-500"
                />
                <span>수신거부(DNC) 및 종결 리드 제외</span>
              </label>
            </div>
          </div>

          {/* 3. 상담원별 배정 & 목표 콜수 (Allocation Engine) */}
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold text-gray-700 dark:text-gray-300 uppercase tracking-wider flex items-center gap-1.5">
                <Users size={14} className="text-indigo-600" />
                3. 상담원 배정 & 일일 목표 콜수 (Agent Allocation)
              </span>
              <div className="flex items-center gap-2 bg-gray-100 dark:bg-gray-700 p-1 rounded-lg text-xs">
                <button
                  type="button"
                  onClick={() => setIsRoundRobin(true)}
                  className={`px-3 py-1 rounded-md font-semibold transition-all ${
                    isRoundRobin ? 'bg-white dark:bg-gray-800 text-indigo-600 shadow-sm' : 'text-gray-500'
                  }`}
                >
                  🔄 균등 분배 (Round-Robin)
                </button>
                <button
                  type="button"
                  onClick={() => setIsRoundRobin(false)}
                  className={`px-3 py-1 rounded-md font-semibold transition-all ${
                    !isRoundRobin ? 'bg-white dark:bg-gray-800 text-indigo-600 shadow-sm' : 'text-gray-500'
                  }`}
                >
                  🎯 차등 목표 지정
                </button>
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-3">
              {activeMembers.map(member => {
                const isSelected = selectedAgentIds.includes(member.email);
                const quota = agentQuotas[member.email] || 0;

                return (
                  <div
                    key={member.userId}
                    onClick={() => handleToggleAgent(member.email)}
                    className={`p-3.5 rounded-xl border cursor-pointer transition-all ${
                      isSelected
                        ? 'bg-indigo-50/70 dark:bg-indigo-950/40 border-indigo-300 dark:border-indigo-800 shadow-sm'
                        : 'bg-white dark:bg-gray-800 border-gray-200 dark:border-gray-700 opacity-60'
                    }`}
                  >
                    <div className="flex items-center justify-between mb-2">
                      <div className="flex items-center gap-2">
                        <div
                          className={`w-4 h-4 rounded border flex items-center justify-center ${
                            isSelected
                              ? 'bg-indigo-600 border-indigo-600 text-white'
                              : 'border-gray-300 dark:border-gray-600'
                          }`}
                        >
                          {isSelected && <Check size={12} />}
                        </div>
                        <span className="font-bold text-sm text-gray-900 dark:text-gray-100">
                          {member.displayName}
                        </span>
                      </div>
                      <span className="text-xs text-gray-400 font-mono">
                        {member.role}
                      </span>
                    </div>

                    <div className="flex items-center justify-between text-xs mt-2 pt-2 border-t border-gray-100 dark:border-gray-700">
                      <span className="text-gray-500">배정 예정 콜수:</span>
                      {isRoundRobin ? (
                        <span className="font-bold text-indigo-700 dark:text-indigo-400 font-mono text-sm">
                          {isSelected ? `${quota} 콜` : '-'}
                        </span>
                      ) : (
                        <input
                          type="number"
                          value={customQuotas[member.email] ?? quota}
                          onClick={e => e.stopPropagation()}
                          onChange={e => {
                            const val = parseInt(e.target.value, 10) || 0;
                            setCustomQuotas(prev => ({ ...prev, [member.email]: val }));
                          }}
                          disabled={!isSelected}
                          className="w-20 px-2 py-1 text-right font-mono font-bold bg-white dark:bg-gray-900 border border-gray-300 dark:border-gray-600 rounded text-xs"
                        />
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          {/* 4. 오토콜 발신 속도 및 강제성 파라미터 (Pacing & Wrap-up) */}
          <div className="p-4.5 bg-gray-50 dark:bg-gray-900/50 rounded-2xl border border-gray-200 dark:border-gray-700 space-y-4">
            <span className="text-xs font-bold text-gray-700 dark:text-gray-300 uppercase tracking-wider flex items-center gap-1.5">
              <Zap size={14} className="text-amber-500" />
              4. 발신 속도 및 강제성 통제 (Pacing & Zero-Click Settings)
            </span>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              {/* 링 타임아웃 */}
              <div className="bg-white dark:bg-gray-800 p-3 rounded-xl border border-gray-200 dark:border-gray-700">
                <span className="text-xs font-semibold text-gray-600 dark:text-gray-300 flex items-center gap-1 mb-1.5">
                  <Clock size={13} className="text-indigo-500" />
                  신호 대기 (Ring Limit)
                </span>
                <select
                  value={pacing.ringTimeoutSeconds}
                  onChange={e => setPacing(prev => ({ ...prev, ringTimeoutSeconds: parseInt(e.target.value, 10) }))}
                  className="w-full text-xs font-bold p-2 bg-gray-50 dark:bg-gray-900 border border-gray-200 dark:border-gray-700 rounded-lg text-gray-800 dark:text-gray-200"
                >
                  <option value={15}>15초 (초고속 부재 판정)</option>
                  <option value={20}>20초 (추천 표준)</option>
                  <option value={25}>25초 (여유 대기)</option>
                  <option value={30}>30초</option>
                </select>
                <p className="text-[11px] text-gray-400 mt-1">20초 경과 시 자동 부재 처리</p>
              </div>

              {/* 휴식 갭 */}
              <div className="bg-white dark:bg-gray-800 p-3 rounded-xl border border-gray-200 dark:border-gray-700">
                <span className="text-xs font-semibold text-gray-600 dark:text-gray-300 flex items-center gap-1 mb-1.5">
                  <Clock size={13} className="text-emerald-500" />
                  콜 간격 휴식 (Gap)
                </span>
                <select
                  value={pacing.gapSeconds}
                  onChange={e => setPacing(prev => ({ ...prev, gapSeconds: parseInt(e.target.value, 10) }))}
                  className="w-full text-xs font-bold p-2 bg-gray-50 dark:bg-gray-900 border border-gray-200 dark:border-gray-700 rounded-lg text-gray-800 dark:text-gray-200"
                >
                  <option value={3}>3초 (초밀착 연속)</option>
                  <option value={4}>4초 (추천 표준)</option>
                  <option value={6}>6초</option>
                  <option value={10}>10초</option>
                </select>
                <p className="text-[11px] text-gray-400 mt-1">결과 저장 후 다음 발신 대기</p>
              </div>

              {/* 후처리 제한시간 */}
              <div className="bg-white dark:bg-gray-800 p-3 rounded-xl border border-gray-200 dark:border-gray-700">
                <span className="text-xs font-semibold text-gray-600 dark:text-gray-300 flex items-center gap-1 mb-1.5">
                  <Clock size={13} className="text-amber-500" />
                  후처리 제한 (Wrap-up)
                </span>
                <select
                  value={pacing.wrapUpLimitSeconds}
                  onChange={e => setPacing(prev => ({ ...prev, wrapUpLimitSeconds: parseInt(e.target.value, 10) }))}
                  className="w-full text-xs font-bold p-2 bg-gray-50 dark:bg-gray-900 border border-gray-200 dark:border-gray-700 rounded-lg text-gray-800 dark:text-gray-200"
                >
                  <option value={7}>7초 (초단축)</option>
                  <option value={10}>10초 (추천 표준)</option>
                  <option value={15}>15초</option>
                  <option value={20}>20초</option>
                </select>
                <p className="text-[11px] text-gray-400 mt-1">통화 종료 후 카운트다운</p>
              </div>
            </div>

            {/* 핵심 스위치: 듀얼 SIM & 강제 발신 */}
            <div className="pt-2 border-t border-gray-200/60 dark:border-gray-700 grid grid-cols-1 sm:grid-cols-2 gap-4 text-xs">
              <label className="flex items-start gap-2.5 cursor-pointer select-none bg-white dark:bg-gray-800 p-3 rounded-xl border border-gray-200 dark:border-gray-700">
                <input
                  type="checkbox"
                  checked={pacing.dualSimRotation}
                  onChange={e => setPacing(prev => ({ ...prev, dualSimRotation: e.target.checked }))}
                  className="rounded text-indigo-600 mt-0.5"
                />
                <div>
                  <span className="font-bold text-gray-800 dark:text-gray-200 flex items-center gap-1">
                    <Smartphone size={13} className="text-indigo-600" />
                    듀얼 SIM 스마트 교차 발신 (SIM1 ↔ SIM2)
                  </span>
                  <p className="text-[11px] text-gray-500 mt-0.5">
                    통신사 일일 발신 한도(500콜) 및 스팸 제재를 방어하기 위해 2개 유심으로 번갈아 발신합니다.
                  </p>
                </div>
              </label>

              <label className="flex items-start gap-2.5 cursor-pointer select-none bg-white dark:bg-gray-800 p-3 rounded-xl border border-gray-200 dark:border-gray-700">
                <input
                  type="checkbox"
                  checked={pacing.autoSkipWrapUp}
                  onChange={e => setPacing(prev => ({ ...prev, autoSkipWrapUp: e.target.checked }))}
                  className="rounded text-indigo-600 mt-0.5"
                />
                <div>
                  <span className="font-bold text-gray-800 dark:text-gray-200 flex items-center gap-1">
                    <Zap size={13} className="text-amber-500" />
                    후처리 제한시간 만료 시 강제 다음 콜 발신
                  </span>
                  <p className="text-[11px] text-gray-500 mt-0.5">
                    상담원이 멍때리거나 자리를 비우지 않도록 카운트다운 종료 시 기본값 저장 후 다음 콜로 강제 진행합니다.
                  </p>
                </div>
              </label>
            </div>
          </div>
        </div>

        {/* 푸터 액션 버튼 */}
        <div className="px-6 py-4 bg-gray-50 dark:bg-gray-900 border-t border-gray-100 dark:border-gray-700 flex items-center justify-between">
          <div className="text-xs text-gray-500">
            총 <span className="font-bold text-indigo-600">{candidateCases.length}건</span>의 리드를{' '}
            <span className="font-bold text-gray-700 dark:text-gray-300">{selectedAgentIds.length}명</span>의 상담원에게
            배정합니다.
          </div>

          <div className="flex items-center gap-2.5">
            <button
              type="button"
              onClick={onClose}
              disabled={isSubmitting}
              className="px-4 py-2.5 text-xs font-semibold text-gray-600 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-800 rounded-xl transition-colors"
            >
              취소
            </button>
            <button
              type="button"
              onClick={handleSubmit}
              disabled={isSubmitting || candidateCases.length === 0 || selectedAgentIds.length === 0}
              className="px-5 py-2.5 bg-gradient-to-r from-indigo-600 to-purple-600 hover:from-indigo-700 hover:to-purple-700 text-white rounded-xl text-xs font-bold shadow-md shadow-indigo-500/20 flex items-center gap-2 disabled:opacity-50 transition-all"
            >
              {isSubmitting ? (
                <>
                  <RefreshCw size={14} className="animate-spin" />
                  캠페인 배정 생성중...
                </>
              ) : (
                <>
                  <PhoneCall size={14} />
                  캠페인 생성 & 오토콜 큐 일괄 배정
                </>
              )}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default AutoDialCampaignModal;
