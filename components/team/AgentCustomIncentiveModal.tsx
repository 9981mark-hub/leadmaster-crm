import React, { useState } from 'react';
import { 
  X, User, DollarSign, Building, Sparkles, Shield, 
  Check, CheckCircle2, AlertCircle, Info, ChevronDown
} from 'lucide-react';
import { 
  AgentCustomIncentiveRule, IncentiveContractType, 
  saveAgentCustomIncentive 
} from '../../services/performance';
import { TeamMember } from '../../services/team';

interface AgentCustomIncentiveModalProps {
  isOpen: boolean;
  onClose: () => void;
  agent: {
    userId: string;
    displayName: string;
    email: string;
    role: string;
  };
  contractTypes: IncentiveContractType[];
  teamMembers: TeamMember[];
  initialRule?: AgentCustomIncentiveRule;
  onSaved: () => void;
  showToast: (msg: string, type?: 'success' | 'error' | 'info') => void;
}

export const AgentCustomIncentiveModal: React.FC<AgentCustomIncentiveModalProps> = ({
  isOpen,
  onClose,
  agent,
  contractTypes,
  teamMembers,
  initialRule,
  onSaved,
  showToast,
}) => {
  if (!isOpen) return null;

  const [useCustom, setUseCustom] = useState<boolean>(initialRule?.useCustom ?? false);
  const [calcType, setCalcType] = useState<'fixed' | 'percent' | 'hybrid'>(initialRule?.calcType ?? 'fixed');
  const [managerUserId, setManagerUserId] = useState<string>(initialRule?.managerUserId || '');
  const [applySlidingBonus, setApplySlidingBonus] = useState<boolean>(initialRule?.applySlidingBonus ?? true);
  const [note, setNote] = useState<string>(initialRule?.note || '');

  // 계약 종류별 개별 금액/비율
  const [rates, setRates] = useState<Record<string, { amount?: number; rate?: number }>>(() => {
    const init: Record<string, { amount?: number; rate?: number }> = {};
    contractTypes.forEach(t => {
      const existing = initialRule?.contractRates?.[t.id];
      init[t.id] = {
        amount: existing?.amount ?? t.amount,
        rate: existing?.rate ?? t.rate,
      };
    });
    return init;
  });

  // 관리자 후보 (Owner 또는 Admin, 혹은 본인을 제외한 팀원)
  const managerCandidates = teamMembers.filter(m => m.userId !== agent.userId);

  const handleRateChange = (typeId: string, field: 'amount' | 'rate', val: string) => {
    const num = parseFloat(val) || 0;
    setRates(prev => ({
      ...prev,
      [typeId]: {
        ...prev[typeId],
        [field]: num,
      },
    }));
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      const rule: AgentCustomIncentiveRule = {
        userId: agent.userId,
        useCustom,
        managerUserId: managerUserId || undefined,
        calcType,
        contractRates: rates,
        applySlidingBonus,
        note,
        effectiveMonth: new Date().toISOString().slice(0, 7),
      };

      await saveAgentCustomIncentive(rule);
      showToast(`${agent.displayName} 상담원의 맞춤 인센티브가 저장되었습니다.`, 'success');
      onSaved();
      onClose();
    } catch (e: any) {
      showToast(`저장 실패: ${e.message}`, 'error');
    }
  };

  return (
    <div className="fixed inset-0 bg-black/60 z-50 flex items-center justify-center p-4 backdrop-blur-xs animate-fadeIn">
      <div className="bg-white dark:bg-gray-800 rounded-2xl max-w-xl w-full shadow-2xl overflow-hidden flex flex-col max-h-[90vh]">
        {/* Modal Header */}
        <div className="p-5 border-b border-gray-100 dark:border-gray-700 flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <div className="p-2 rounded-xl bg-blue-600 text-white shadow-sm">
              <DollarSign size={18} />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h3 className="font-bold text-base text-gray-900 dark:text-white">
                  상담원 맞춤 인센티브 설정
                </h3>
                <span className="text-[11px] font-semibold px-2 py-0.5 rounded-full bg-blue-100 dark:bg-blue-900/60 text-blue-700 dark:text-blue-300">
                  {agent.role === 'owner' ? '대표' : agent.role === 'admin' ? '관리자' : '상담원'}
                </span>
              </div>
              <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">
                {agent.displayName} ({agent.email}) 님에게 적용할 인센티브 방식을 개별 지정합니다.
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-1.5 rounded-lg text-gray-400 hover:text-gray-600 dark:hover:text-gray-200 hover:bg-gray-100 dark:hover:bg-gray-700 cursor-pointer"
          >
            <X size={18} />
          </button>
        </div>

        {/* Modal Body Form */}
        <form onSubmit={handleSave} className="p-5 overflow-y-auto space-y-5 flex-1 text-xs">
          {/* 1. Policy Mode Selector (전사 기본 준용 vs 개별 맞춤) */}
          <div className="p-4 rounded-xl border border-gray-200 dark:border-gray-700 bg-gray-50/50 dark:bg-gray-750 space-y-3">
            <label className="font-bold text-gray-800 dark:text-white block">
              인센티브 적용 모드
            </label>
            <div className="grid grid-cols-2 gap-3">
              <button
                type="button"
                onClick={() => setUseCustom(false)}
                className={`p-3 rounded-xl border text-left transition-all cursor-pointer ${
                  !useCustom
                    ? 'border-blue-600 bg-blue-50/50 dark:bg-blue-950/30 text-blue-900 dark:text-blue-200 ring-2 ring-blue-500/20'
                    : 'border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 text-gray-600 dark:text-gray-400'
                }`}
              >
                <div className="font-bold flex items-center justify-between">
                  <span>전사 기본 정책 준용</span>
                  {!useCustom && <CheckCircle2 size={16} className="text-blue-600 dark:text-blue-400" />}
                </div>
                <div className="text-[11px] text-gray-500 dark:text-gray-400 mt-1">
                  회사의 공통 계약별 단가표를 그대로 적용합니다.
                </div>
              </button>

              <button
                type="button"
                onClick={() => setUseCustom(true)}
                className={`p-3 rounded-xl border text-left transition-all cursor-pointer ${
                  useCustom
                    ? 'border-indigo-600 bg-indigo-50/50 dark:bg-indigo-950/30 text-indigo-900 dark:text-indigo-200 ring-2 ring-indigo-500/20'
                    : 'border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 text-gray-600 dark:text-gray-400'
                }`}
              >
                <div className="font-bold flex items-center justify-between">
                  <span>★ 개인 맞춤 인센티브</span>
                  {useCustom && <CheckCircle2 size={16} className="text-indigo-600 dark:text-indigo-400" />}
                </div>
                <div className="text-[11px] text-gray-500 dark:text-gray-400 mt-1">
                  이 상담원 전용 단가, 비율, 수임료 요율을 개별 책정합니다.
                </div>
              </button>
            </div>
          </div>

          {/* 2. Custom Settings Detail (useCustom === true 인 경우 노출) */}
          {useCustom && (
            <div className="space-y-4 animate-fadeIn">
              {/* 2.1 인센티브 계산 방식 */}
              <div>
                <label className="font-bold text-gray-800 dark:text-white block mb-1.5">
                  개인 인센티브 산정 방식
                </label>
                <div className="grid grid-cols-3 gap-2">
                  {[
                    { id: 'fixed', label: '건당 고정 금액', desc: '계약당 지정 금액' },
                    { id: 'percent', label: '수임료 비율 (%)', desc: '수임료 매출 비례' },
                    { id: 'hybrid', label: '하이브리드 (복합)', desc: '고정금액 + 비율' },
                  ].map(m => (
                    <button
                      key={m.id}
                      type="button"
                      onClick={() => setCalcType(m.id as any)}
                      className={`p-2.5 rounded-xl border text-center transition-all cursor-pointer ${
                        calcType === m.id
                          ? 'border-blue-600 bg-blue-50 dark:bg-blue-950/40 text-blue-700 dark:text-blue-300 font-bold'
                          : 'border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 text-gray-600 dark:text-gray-400'
                      }`}
                    >
                      <div className="text-xs">{m.label}</div>
                      <div className="text-[10px] text-gray-400 mt-0.5">{m.desc}</div>
                    </button>
                  ))}
                </div>
              </div>

              {/* 2.2 계약 종류별 개인 단가 설정 */}
              <div>
                <label className="font-bold text-gray-800 dark:text-white block mb-1.5">
                  계약 종류별 개인 맞춤 단가/요율
                </label>
                <div className="space-y-2 border border-gray-200 dark:border-gray-700 rounded-xl p-3 bg-white dark:bg-gray-800">
                  {contractTypes.map(t => {
                    const r = rates[t.id] || { amount: t.amount, rate: t.rate };

                    return (
                      <div key={t.id} className="p-2.5 rounded-lg bg-gray-50 dark:bg-gray-750 flex items-center justify-between gap-3">
                        <div className="min-w-0">
                          <div className="font-bold text-gray-800 dark:text-white truncate">
                            {t.name}
                          </div>
                          <div className="text-[11px] text-gray-400">
                            전사 기본: {t.calcType === 'fixed' ? `₩${t.amount.toLocaleString()}원` : `${t.rate}%`}
                          </div>
                        </div>

                        <div className="flex items-center gap-2 shrink-0">
                          {(calcType === 'fixed' || calcType === 'hybrid') && (
                            <div className="flex items-center gap-1">
                              <input
                                type="number"
                                step="1000"
                                value={r.amount ?? ''}
                                onChange={e => handleRateChange(t.id, 'amount', e.target.value)}
                                className="w-24 px-2 py-1 text-right font-mono font-bold bg-white dark:bg-gray-800 border border-gray-300 dark:border-gray-600 rounded-lg text-gray-900 dark:text-white"
                                placeholder="금액"
                              />
                              <span className="text-gray-500">원</span>
                            </div>
                          )}

                          {(calcType === 'percent' || calcType === 'hybrid') && (
                            <div className="flex items-center gap-1">
                              <input
                                type="number"
                                step="0.5"
                                value={r.rate ?? ''}
                                onChange={e => handleRateChange(t.id, 'rate', e.target.value)}
                                className="w-16 px-2 py-1 text-right font-mono font-bold bg-white dark:bg-gray-800 border border-gray-300 dark:border-gray-600 rounded-lg text-gray-900 dark:text-white"
                                placeholder="비율"
                              />
                              <span className="text-gray-500">%</span>
                            </div>
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            </div>
          )}

          {/* 3. 소속 관리자(오버라이드 수당 수령 팀장) 지정 */}
          <div>
            <label className="font-bold text-gray-800 dark:text-white flex items-center justify-between mb-1.5">
              <span>👔 담당 관리자(팀장) 지정 — 오버라이딩 수당 연동</span>
              <span className="text-[11px] text-gray-400 font-normal">선택 사항</span>
            </label>
            <select
              value={managerUserId}
              onChange={e => setManagerUserId(e.target.value)}
              className="w-full px-3 py-2 bg-white dark:bg-gray-800 border border-gray-300 dark:border-gray-600 rounded-xl text-gray-900 dark:text-white text-xs"
            >
              <option value="">-- 담당 팀장 없음 (오버라이드 미지급) --</option>
              {managerCandidates.map(m => (
                <option key={m.userId} value={m.userId}>
                  {m.displayName} ({m.role === 'owner' ? '대표' : m.role === 'admin' ? '관리자/팀장' : '상담원'}) - {m.email}
                </option>
              ))}
            </select>
            <p className="text-[11px] text-gray-500 dark:text-gray-400 mt-1">
              이 상담원이 계약을 체결할 때마다, 지정된 담당 팀장의 정산 장부에 <strong>관리자 오버라이드 수당</strong>이 자동 적립됩니다.
            </p>
          </div>

          {/* 4. 고성과자 구간 보너스(슬라이딩 스케일) 참여 여부 */}
          <div className="flex items-center justify-between p-3.5 rounded-xl border border-gray-200 dark:border-gray-700 bg-gray-50/50 dark:bg-gray-750">
            <div>
              <div className="font-bold text-gray-800 dark:text-white">
                고성과자 구간 추가 보너스(슬라이딩 스케일) 참여
              </div>
              <div className="text-[11px] text-gray-500 dark:text-gray-400 mt-0.5">
                당월 6건 돌파 시 건당 +2만, 11건 돌파 시 건당 +5만 등 전사 우대 보너스를 합산 적용합니다.
              </div>
            </div>
            <input
              type="checkbox"
              checked={applySlidingBonus}
              onChange={e => setApplySlidingBonus(e.target.checked)}
              className="w-4 h-4 text-blue-600 rounded-sm border-gray-300 focus:ring-blue-500"
            />
          </div>

          {/* 5. 메모 */}
          <div>
            <label className="font-bold text-gray-800 dark:text-white block mb-1">
              특이사항 / 계약 메모
            </label>
            <input
              type="text"
              value={note}
              onChange={e => setNote(e.target.value)}
              placeholder="예: 프리랜서 계약 (수임료 15%), 2026-11 신규 입사 프로모션 적용"
              className="w-full px-3 py-2 bg-white dark:bg-gray-800 border border-gray-300 dark:border-gray-600 rounded-xl text-gray-900 dark:text-white text-xs"
            />
          </div>

          {/* Modal Footer */}
          <div className="pt-4 border-t border-gray-100 dark:border-gray-700 flex items-center justify-end gap-2">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 rounded-xl text-xs font-semibold text-gray-600 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700 cursor-pointer"
            >
              취소
            </button>
            <button
              type="submit"
              className="px-5 py-2 rounded-xl text-xs font-bold text-white bg-blue-600 hover:bg-blue-700 shadow-sm cursor-pointer"
            >
              맞춤 인센티브 저장
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
