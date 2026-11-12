/**
 * components/settlement/SettlementPolicyModal.tsx
 * 회사별 정산 정책 & 수수료 분배 룰 & 이중 정산 주기 설정 모달
 */
import React, { useState } from 'react';
import {
  X, Settings2, Sliders, Calendar, Clock,
  CheckCircle2, DollarSign, Percent, ShieldCheck, RefreshCw
} from 'lucide-react';
import { useToast } from '../../contexts/ToastContext';
import {
  SettlementPolicy,
  saveSettlementPolicy
} from '../../services/settlementMasterService';

interface SettlementPolicyModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: () => void;
  orgId: string;
  initialPolicy: SettlementPolicy;
}

export const SettlementPolicyModal: React.FC<SettlementPolicyModalProps> = ({
  isOpen,
  onClose,
  onSuccess,
  orgId,
  initialPolicy,
}) => {
  const { showToast } = useToast();
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [policy, setPolicy] = useState<SettlementPolicy>({ ...initialPolicy });

  if (!isOpen) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSubmitting(true);
    try {
      await saveSettlementPolicy(policy, orgId);
      showToast('정산 및 수수료 분배 정책이 성공적으로 저장되었습니다.', 'success');
      onSuccess();
      onClose();
    } catch (err: any) {
      console.error('[SettlementPolicyModal] Save error:', err);
      showToast('정책 저장에 실패했습니다.', 'error');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-in fade-in duration-200">
      <div className="bg-white dark:bg-gray-800 rounded-3xl w-full max-w-2xl shadow-2xl border border-gray-100 dark:border-gray-700 overflow-hidden flex flex-col max-h-[90vh]">
        {/* 헤더 */}
        <div className="flex items-center justify-between px-6 py-4.5 border-b border-gray-100 dark:border-gray-700 bg-gradient-to-r from-indigo-50/60 via-white to-purple-50/60 dark:from-gray-800 dark:via-gray-800 dark:to-gray-800">
          <div className="flex items-center gap-3">
            <div className="p-2.5 bg-indigo-600 text-white rounded-2xl shadow-md shadow-indigo-500/20">
              <Settings2 size={20} />
            </div>
            <div>
              <h2 className="text-lg font-bold text-gray-900 dark:text-gray-100 flex items-center gap-2">
                정산 정책 & 수수료 분배 마스터 설정
                <span className="text-xs px-2.5 py-0.5 rounded-full font-semibold bg-indigo-100 text-indigo-700 dark:bg-indigo-900/50 dark:text-indigo-300">
                  v4.5
                </span>
              </h2>
              <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">
                거래처 수수료에서 회사 몫을 떼고 상담원에게 지급하는 분배 룰과 지급일을 설정합니다.
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-2 text-gray-400 hover:text-gray-600 dark:hover:text-gray-200 rounded-xl hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors"
          >
            <X size={20} />
          </button>
        </div>

        {/* 본문 폼 */}
        <form onSubmit={handleSubmit} className="flex-1 overflow-y-auto p-6 space-y-6">
          {/* 1. 수수료 분배 모델 선택 */}
          <div className="space-y-3">
            <label className="block text-xs font-bold text-gray-700 dark:text-gray-300 uppercase tracking-wider">
              1. 수수료 분배 모델 선택 (Revenue Split Model)
            </label>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
              {/* 모델 A: 비율 분배 */}
              <div
                onClick={() => setPolicy(p => ({ ...p, splitModel: 'ratio_split' }))}
                className={`p-4 rounded-2xl border cursor-pointer transition-all ${
                  policy.splitModel === 'ratio_split'
                    ? 'bg-indigo-50/80 dark:bg-indigo-950/40 border-indigo-500 ring-2 ring-indigo-500/20 shadow-sm'
                    : 'bg-white dark:bg-gray-800 border-gray-200 dark:border-gray-700 hover:border-gray-300'
                }`}
              >
                <div className="flex items-center justify-between mb-1.5">
                  <span className="font-bold text-sm text-gray-900 dark:text-gray-100 flex items-center gap-1.5">
                    <Percent size={15} className="text-indigo-600" />
                    비율 분배형
                  </span>
                  <input
                    type="radio"
                    name="splitModel"
                    checked={policy.splitModel === 'ratio_split'}
                    onChange={() => {}}
                    className="text-indigo-600 focus:ring-indigo-500"
                  />
                </div>
                <p className="text-xs text-gray-500 leading-relaxed">
                  거래처 수수료 총액에서 회사 N%를 떼고 나머지 (100-N)%를 상담원에게 지급합니다. (표준 정률제)
                </p>
              </div>

              {/* 모델 B: 회사 고정 마진 차감 */}
              <div
                onClick={() => setPolicy(p => ({ ...p, splitModel: 'margin_deduction' }))}
                className={`p-4 rounded-2xl border cursor-pointer transition-all ${
                  policy.splitModel === 'margin_deduction'
                    ? 'bg-indigo-50/80 dark:bg-indigo-950/40 border-indigo-500 ring-2 ring-indigo-500/20 shadow-sm'
                    : 'bg-white dark:bg-gray-800 border-gray-200 dark:border-gray-700 hover:border-gray-300'
                }`}
              >
                <div className="flex items-center justify-between mb-1.5">
                  <span className="font-bold text-sm text-gray-900 dark:text-gray-100 flex items-center gap-1.5">
                    <DollarSign size={15} className="text-purple-600" />
                    회사 마진 차감형
                  </span>
                  <input
                    type="radio"
                    name="splitModel"
                    checked={policy.splitModel === 'margin_deduction'}
                    onChange={() => {}}
                    className="text-indigo-600 focus:ring-indigo-500"
                  />
                </div>
                <p className="text-xs text-gray-500 leading-relaxed">
                  수수료에서 회사 고정 몫(예: 30만원)을 먼저 떼고 남은 잔액 전액을 상담원에게 지급합니다.
                </p>
              </div>

              {/* 모델 C: 상담원 고정 수당형 */}
              <div
                onClick={() => setPolicy(p => ({ ...p, splitModel: 'fixed_agent_incentive' }))}
                className={`p-4 rounded-2xl border cursor-pointer transition-all ${
                  policy.splitModel === 'fixed_agent_incentive'
                    ? 'bg-indigo-50/80 dark:bg-indigo-950/40 border-indigo-500 ring-2 ring-indigo-500/20 shadow-sm'
                    : 'bg-white dark:bg-gray-800 border-gray-200 dark:border-gray-700 hover:border-gray-300'
                }`}
              >
                <div className="flex items-center justify-between mb-1.5">
                  <span className="font-bold text-sm text-gray-900 dark:text-gray-100 flex items-center gap-1.5">
                    <CheckCircle2 size={15} className="text-emerald-600" />
                    상담원 고정 수당형
                  </span>
                  <input
                    type="radio"
                    name="splitModel"
                    checked={policy.splitModel === 'fixed_agent_incentive'}
                    onChange={() => {}}
                    className="text-indigo-600 focus:ring-indigo-500"
                  />
                </div>
                <p className="text-xs text-gray-500 leading-relaxed">
                  상담원에게 건당 고정 인센티브(예: 15만원)를 지급하고 나머지 수수료는 회사로 귀속합니다.
                </p>
              </div>
            </div>
          </div>

          {/* 2. 세부 수치 설정 */}
          <div className="p-4.5 bg-gray-50 dark:bg-gray-900/50 rounded-2xl border border-gray-200 dark:border-gray-700 space-y-4">
            <span className="text-xs font-bold text-gray-700 dark:text-gray-300 uppercase tracking-wider flex items-center gap-1.5">
              <Sliders size={14} className="text-indigo-600" />
              2. 세부 분배 기준값 설정
            </span>

            {policy.splitModel === 'ratio_split' && (
              <div className="space-y-3">
                <div className="flex items-center justify-between text-xs">
                  <span className="font-bold text-gray-800 dark:text-gray-200">
                    🏢 회사 몫: <span className="text-indigo-600 font-mono text-sm">{policy.companyShareRatio}%</span>
                  </span>
                  <span className="font-bold text-gray-800 dark:text-gray-200">
                    🎧 상담원 지급 몫: <span className="text-emerald-600 font-mono text-sm">{policy.agentShareRatio}%</span>
                  </span>
                </div>
                <input
                  type="range"
                  min="0"
                  max="100"
                  step="5"
                  value={policy.companyShareRatio}
                  onChange={e => {
                    const cShare = Number(e.target.value);
                    setPolicy(p => ({
                      ...p,
                      companyShareRatio: cShare,
                      agentShareRatio: 100 - cShare,
                    }));
                  }}
                  className="w-full accent-indigo-600 cursor-pointer"
                />
                <div className="flex justify-between text-[11px] text-gray-400 font-mono">
                  <span>회사 0% : 상담원 100%</span>
                  <span>40% : 60% (추천 기본)</span>
                  <span>50% : 50%</span>
                  <span>회사 100% : 상담원 0%</span>
                </div>
              </div>
            )}

            {policy.splitModel === 'margin_deduction' && (
              <div>
                <label className="block text-xs font-medium text-gray-600 dark:text-gray-400 mb-1.5">
                  수임 1건당 회사 고정 공제 마진 (원):
                </label>
                <div className="relative">
                  <input
                    type="number"
                    step="50000"
                    value={policy.companyFixedMargin}
                    onChange={e => setPolicy(p => ({ ...p, companyFixedMargin: Math.max(0, parseInt(e.target.value, 10) || 0) }))}
                    className="w-full px-4 py-2.5 bg-white dark:bg-gray-800 border border-gray-300 dark:border-gray-600 rounded-xl text-sm font-bold font-mono text-gray-900 dark:text-white"
                  />
                  <span className="absolute right-3.5 top-2.5 text-xs text-gray-400">
                    ₩{(policy.companyFixedMargin / 10000).toLocaleString()}만원
                  </span>
                </div>
                <p className="text-[11px] text-gray-400 mt-1">
                  예: 거래처 수수료가 120만원이면 회사가 30만원을 떼고 나머지 90만원을 상담원에게 지급합니다.
                </p>
              </div>
            )}

            {policy.splitModel === 'fixed_agent_incentive' && (
              <div>
                <label className="block text-xs font-medium text-gray-600 dark:text-gray-400 mb-1.5">
                  수임 1건당 상담원 고정 지급 인센티브 (원):
                </label>
                <div className="relative">
                  <input
                    type="number"
                    step="10000"
                    value={policy.agentFixedIncentive}
                    onChange={e => setPolicy(p => ({ ...p, agentFixedIncentive: Math.max(0, parseInt(e.target.value, 10) || 0) }))}
                    className="w-full px-4 py-2.5 bg-white dark:bg-gray-800 border border-gray-300 dark:border-gray-600 rounded-xl text-sm font-bold font-mono text-gray-900 dark:text-white"
                  />
                  <span className="absolute right-3.5 top-2.5 text-xs text-gray-400">
                    ₩{(policy.agentFixedIncentive / 10000).toLocaleString()}만원
                  </span>
                </div>
                <p className="text-[11px] text-gray-400 mt-1">
                  예: 거래처 수수료 금액과 관계없이 상담원에게는 수임 성공 1건당 15만원을 지급합니다.
                </p>
              </div>
            )}
          </div>

          {/* 3. 상담원 수당 지급 일정 (Agent Outflow Schedule) */}
          <div className="p-4.5 bg-gray-50 dark:bg-gray-900/50 rounded-2xl border border-gray-200 dark:border-gray-700 space-y-4">
            <span className="text-xs font-bold text-gray-700 dark:text-gray-300 uppercase tracking-wider flex items-center gap-1.5">
              <Clock size={14} className="text-amber-500" />
              3. 상담원 수당 지급 주기 및 날짜 (Agent Payout Schedule)
            </span>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
              {/* 월급 정기 지급 */}
              <label
                className={`p-3.5 rounded-xl border cursor-pointer transition-all ${
                  policy.agentPayoutCycle === 'monthly_fixed'
                    ? 'bg-white dark:bg-gray-800 border-indigo-500 shadow-sm'
                    : 'bg-white/60 dark:bg-gray-800/60 border-gray-200 dark:border-gray-700'
                }`}
              >
                <div className="flex items-center justify-between mb-2">
                  <span className="text-xs font-bold text-gray-800 dark:text-gray-200">
                    📅 매월 정기일 지급
                  </span>
                  <input
                    type="radio"
                    name="agentPayoutCycle"
                    checked={policy.agentPayoutCycle === 'monthly_fixed'}
                    onChange={() => setPolicy(p => ({ ...p, agentPayoutCycle: 'monthly_fixed' }))}
                    className="text-indigo-600 focus:ring-indigo-500"
                  />
                </div>
                <select
                  disabled={policy.agentPayoutCycle !== 'monthly_fixed'}
                  value={policy.agentPayoutDay}
                  onChange={e => setPolicy(p => ({ ...p, agentPayoutDay: parseInt(e.target.value, 10) }))}
                  className="w-full text-xs font-bold p-1.5 bg-gray-50 dark:bg-gray-900 border border-gray-200 dark:border-gray-700 rounded-lg text-gray-800 dark:text-gray-200 disabled:opacity-50"
                >
                  <option value={10}>매월 10일 (추천)</option>
                  <option value={15}>매월 15일</option>
                  <option value={20}>매월 20일</option>
                  <option value={25}>매월 25일</option>
                  <option value={31}>매월 말일</option>
                </select>
              </label>

              {/* 주급 정기 지급 */}
              <label
                className={`p-3.5 rounded-xl border cursor-pointer transition-all ${
                  policy.agentPayoutCycle === 'weekly_fixed'
                    ? 'bg-white dark:bg-gray-800 border-indigo-500 shadow-sm'
                    : 'bg-white/60 dark:bg-gray-800/60 border-gray-200 dark:border-gray-700'
                }`}
              >
                <div className="flex items-center justify-between mb-2">
                  <span className="text-xs font-bold text-gray-800 dark:text-gray-200">
                    ⏱️ 매주 정기 주급 지급
                  </span>
                  <input
                    type="radio"
                    name="agentPayoutCycle"
                    checked={policy.agentPayoutCycle === 'weekly_fixed'}
                    onChange={() => setPolicy(p => ({ ...p, agentPayoutCycle: 'weekly_fixed' }))}
                    className="text-indigo-600 focus:ring-indigo-500"
                  />
                </div>
                <select
                  disabled={policy.agentPayoutCycle !== 'weekly_fixed'}
                  value={policy.agentPayoutDay}
                  onChange={e => setPolicy(p => ({ ...p, agentPayoutDay: parseInt(e.target.value, 10) }))}
                  className="w-full text-xs font-bold p-1.5 bg-gray-50 dark:bg-gray-900 border border-gray-200 dark:border-gray-700 rounded-lg text-gray-800 dark:text-gray-200 disabled:opacity-50"
                >
                  <option value={5}>매주 금요일 (추천)</option>
                  <option value={1}>매주 월요일</option>
                  <option value={3}>매주 수요일</option>
                </select>
              </label>

              {/* 입금 확인 후 지급 */}
              <label
                className={`p-3.5 rounded-xl border cursor-pointer transition-all ${
                  policy.agentPayoutCycle === 'after_partner_deposit'
                    ? 'bg-white dark:bg-gray-800 border-indigo-500 shadow-sm'
                    : 'bg-white/60 dark:bg-gray-800/60 border-gray-200 dark:border-gray-700'
                }`}
              >
                <div className="flex items-center justify-between mb-2">
                  <span className="text-xs font-bold text-gray-800 dark:text-gray-200">
                    🛡️ 입금 확인 후 지급
                  </span>
                  <input
                    type="radio"
                    name="agentPayoutCycle"
                    checked={policy.agentPayoutCycle === 'after_partner_deposit'}
                    onChange={() => setPolicy(p => ({ ...p, agentPayoutCycle: 'after_partner_deposit' }))}
                    className="text-indigo-600 focus:ring-indigo-500"
                  />
                </div>
                <select
                  disabled={policy.agentPayoutCycle !== 'after_partner_deposit'}
                  value={policy.payoutDelayDays}
                  onChange={e => setPolicy(p => ({ ...p, payoutDelayDays: parseInt(e.target.value, 10) }))}
                  className="w-full text-xs font-bold p-1.5 bg-gray-50 dark:bg-gray-900 border border-gray-200 dark:border-gray-700 rounded-lg text-gray-800 dark:text-gray-200 disabled:opacity-50"
                >
                  <option value={1}>입금 확인 익일</option>
                  <option value={3}>입금 확인 3일 이내</option>
                  <option value={7}>입금 확인 7일 이내</option>
                </select>
              </label>
            </div>
          </div>
        </form>

        {/* 푸터 액션 버튼 */}
        <div className="px-6 py-4 bg-gray-50 dark:bg-gray-900 border-t border-gray-100 dark:border-gray-700 flex items-center justify-between">
          <div className="text-xs text-gray-500">
            * 저장 즉시 전체 정산서 및 경영 손익(P&L)에 실시간 자동 반영됩니다.
          </div>
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={onClose}
              disabled={isSubmitting}
              className="px-4 py-2 text-xs font-semibold text-gray-600 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-800 rounded-xl transition-colors"
            >
              취소
            </button>
            <button
              type="button"
              onClick={handleSubmit}
              disabled={isSubmitting}
              className="px-5 py-2.5 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl text-xs font-bold shadow-md shadow-indigo-500/20 flex items-center gap-2 disabled:opacity-50 transition-all"
            >
              {isSubmitting ? (
                <>
                  <RefreshCw size={14} className="animate-spin" />
                  저장중...
                </>
              ) : (
                <>
                  <CheckCircle2 size={14} />
                  정산 정책 저장 및 적용
                </>
              )}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default SettlementPolicyModal;
