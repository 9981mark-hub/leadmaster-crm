/**
 * components/settlement/SettlementPolicyModal.tsx
 * 회사별 정산 정책 & 수수료 분배 룰 & 이중 정산 주기 설정 모달
 */
import React, { useEffect, useState } from 'react';
import {
  X, Settings2, Sliders, Calendar, Clock,
  CheckCircle2, DollarSign, Percent, ShieldCheck, RefreshCw
} from 'lucide-react';
import { useToast } from '../../contexts/ToastContext';
import {
  SettlementPolicy,
  SettlementPolicySource,
  normalizePolicy,
  saveSettlementPolicy
} from '../../services/settlementMasterService';

interface SettlementPolicyModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: (saved: SettlementPolicy) => void;
  orgId?: string;
  initialPolicy: SettlementPolicy;
  policySource?: SettlementPolicySource;
  policyMessage?: string;
}

export const SettlementPolicyModal: React.FC<SettlementPolicyModalProps> = ({
  isOpen,
  onClose,
  onSuccess,
  orgId,
  initialPolicy,
  policySource = 'saved',
  policyMessage,
}) => {
  const { showToast } = useToast();
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [policy, setPolicy] = useState<SettlementPolicy>({ ...initialPolicy });
  const tableMissing = policySource === 'table_missing';

  // 열 때마다 지금 불러온 정책으로 다시 채운다 (처음 렌더 때 기본값으로 굳지 않게)
  useEffect(() => {
    if (isOpen) setPolicy({ ...initialPolicy });
  }, [isOpen, initialPolicy]);

  if (!isOpen) return null;

  // 지급 주기를 바꾸면 그 주기에 맞는 날짜로 (월: 1~31일, 주: 요일 0~6)
  const setCycle = (cycle: SettlementPolicy['agentPayoutCycle']) => setPolicy(p => {
    let day = p.agentPayoutDay;
    if (cycle === 'weekly_fixed' && ![1, 3, 5].includes(day)) day = 5;
    if (cycle === 'monthly_fixed' && ![10, 15, 20, 25, 31].includes(day)) day = 10;
    return { ...p, agentPayoutCycle: cycle, agentPayoutDay: day };
  });

  const handleSubmit = async (e: React.FormEvent | React.MouseEvent) => {
    e.preventDefault();
    if (tableMissing) {
      showToast(policyMessage || '서버 업데이트 필요: 정산 정책을 아직 저장할 수 없습니다.', 'error');
      return;
    }
    setIsSubmitting(true);
    try {
      const saved = await saveSettlementPolicy(normalizePolicy(policy), orgId || undefined);
      showToast('정산 정책을 저장했습니다.', 'success');
      onSuccess(saved);
      onClose();
    } catch (err: any) {
      console.error('[SettlementPolicyModal] Save error:', err);
      showToast(err?.message || '정책 저장에 실패했습니다.', 'error');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm animate-in fade-in duration-200">
      <div className="bg-card text-card-foreground rounded-2xl w-full max-w-2xl shadow-2xl border border-border overflow-hidden flex flex-col max-h-[90vh]">
        {/* 헤더 */}
        <div className="flex items-center justify-between px-6 py-5 border-b border-border bg-card">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-primary/10 border border-primary/20 text-primary flex items-center justify-center shrink-0">
              <Settings2 size={20} strokeWidth={1.75} />
            </div>
            <div>
              <h2 className="text-base sm:text-lg font-bold text-foreground flex items-center gap-2">
                <span>정산 정책 & 수수료 분배 마스터 설정</span>
                <span className="text-2xs font-semibold px-2 py-0.5 rounded-md bg-primary/10 text-primary border border-primary/20 tracking-tight">
                  v4.5
                </span>
              </h2>
              <p className="text-xs text-muted-foreground mt-0.5">
                거래처 수수료에서 회사 몫을 떼고 상담원에게 지급하는 분배 룰과 지급일을 설정합니다.
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-2 text-muted-foreground hover:text-foreground hover:bg-muted rounded-lg transition-colors"
          >
            <X size={18} strokeWidth={1.75} />
          </button>
        </div>

        {/* 본문 폼 */}
        <form onSubmit={handleSubmit} className="flex-1 overflow-y-auto p-6 space-y-6">
          {policySource !== 'saved' && (
            <div className={`rounded-xl border px-4 py-3 text-xs leading-relaxed ${tableMissing ? 'bg-destructive/10 border-destructive/30 text-destructive' : 'bg-amber-500/10 border-amber-500/20 text-amber-500'}`}>
              <span className="font-bold">{tableMissing ? '서버 업데이트 필요' : '기본값(저장 안 됨)'}</span>
              {' — '}
              {policyMessage || '아직 저장한 정산 정책이 없어 기본값으로 계산하고 있습니다. 저장하면 이 회사 정책으로 바뀝니다.'}
            </div>
          )}

          {/* 1. 수수료 분배 모델 선택 */}
          <div className="space-y-2.5">
            <label className="block text-xs font-semibold text-foreground uppercase tracking-wider">
              1. 수수료 분배 모델 선택 (REVENUE SPLIT MODEL)
            </label>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
              {/* 모델 A: 비율 분배 */}
              <div
                onClick={() => setPolicy(p => ({ ...p, splitModel: 'ratio_split' }))}
                className={`p-4 rounded-xl border cursor-pointer transition-all ${
                  policy.splitModel === 'ratio_split'
                    ? 'bg-primary/5 border-primary/40 ring-1 ring-primary/30 shadow-2xs'
                    : 'bg-card border-border hover:border-border/80'
                }`}
              >
                <div className="flex items-center justify-between mb-1.5">
                  <span className="font-semibold text-sm text-foreground flex items-center gap-1.5">
                    <Percent size={15} strokeWidth={1.75} className="text-primary" />
                    비율 분배형
                  </span>
                  <input
                    type="radio"
                    name="splitModel"
                    checked={policy.splitModel === 'ratio_split'}
                    onChange={() => {}}
                    className="accent-primary"
                  />
                </div>
                <p className="text-xs text-muted-foreground leading-relaxed">
                  거래처 수수료 총액에서 회사 N%를 떼고 나머지 (100-N)%를 상담원에게 지급합니다. (표준 정률제)
                </p>
              </div>

              {/* 모델 B: 회사 고정 마진 차감 */}
              <div
                onClick={() => setPolicy(p => ({ ...p, splitModel: 'margin_deduction' }))}
                className={`p-4 rounded-xl border cursor-pointer transition-all ${
                  policy.splitModel === 'margin_deduction'
                    ? 'bg-primary/5 border-primary/40 ring-1 ring-primary/30 shadow-2xs'
                    : 'bg-card border-border hover:border-border/80'
                }`}
              >
                <div className="flex items-center justify-between mb-1.5">
                  <span className="font-semibold text-sm text-foreground flex items-center gap-1.5">
                    <DollarSign size={15} strokeWidth={1.75} className="text-primary" />
                    회사 마진 차감형
                  </span>
                  <input
                    type="radio"
                    name="splitModel"
                    checked={policy.splitModel === 'margin_deduction'}
                    onChange={() => {}}
                    className="accent-primary"
                  />
                </div>
                <p className="text-xs text-muted-foreground leading-relaxed">
                  수수료에서 회사 고정 몫(예: 30만원)을 먼저 떼고 남은 잔액 전액을 상담원에게 지급합니다.
                </p>
              </div>

              {/* 모델 C: 상담원 고정 수당형 */}
              <div
                onClick={() => setPolicy(p => ({ ...p, splitModel: 'fixed_agent_incentive' }))}
                className={`p-4 rounded-xl border cursor-pointer transition-all ${
                  policy.splitModel === 'fixed_agent_incentive'
                    ? 'bg-primary/5 border-primary/40 ring-1 ring-primary/30 shadow-2xs'
                    : 'bg-card border-border hover:border-border/80'
                }`}
              >
                <div className="flex items-center justify-between mb-1.5">
                  <span className="font-semibold text-sm text-foreground flex items-center gap-1.5">
                    <CheckCircle2 size={15} strokeWidth={1.75} className="text-primary" />
                    상담원 고정 수당형
                  </span>
                  <input
                    type="radio"
                    name="splitModel"
                    checked={policy.splitModel === 'fixed_agent_incentive'}
                    onChange={() => {}}
                    className="accent-primary"
                  />
                </div>
                <p className="text-xs text-muted-foreground leading-relaxed">
                  상담원에게 건당 고정 인센티브(예: 15만원)를 지급하고 나머지 수수료는 회사로 귀속합니다.
                </p>
              </div>
            </div>
          </div>

          {/* 2. 세부 분배 기준값 설정 (컨테이너 상단 라벨과 내부 박스를 명확히 분리하여 텍스트 걸침 원천 차단) */}
          <div className="space-y-2.5">
            <label className="text-xs font-semibold text-foreground uppercase tracking-wider flex items-center gap-1.5">
              <Sliders size={14} strokeWidth={1.75} className="text-primary" />
              <span>2. 세부 분배 기준값 설정</span>
            </label>

            <div className="p-4 sm:p-5 bg-muted/30 rounded-xl border border-border space-y-4">
              {policy.splitModel === 'ratio_split' && (
                <div className="space-y-3">
                  <div className="flex items-center justify-between text-xs">
                    <span className="font-medium text-foreground flex items-center gap-1.5">
                      <span>🏢 회사 몫:</span>
                      <span className="text-primary font-bold text-sm tabular-nums">{policy.companyShareRatio}%</span>
                    </span>
                    <span className="font-medium text-foreground flex items-center gap-1.5">
                      <span>🎧 상담원 지급 몫:</span>
                      <span className="text-primary font-bold text-sm tabular-nums">{policy.agentShareRatio}%</span>
                    </span>
                  </div>

                  {/* 슬라이더 바 */}
                  <div className="pt-1 pb-0.5">
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
                      className="w-full h-2 bg-muted rounded-lg appearance-none cursor-pointer accent-primary"
                    />
                  </div>

                  {/* 하단 틱 (Pretendard 폰트로 단정하게 정렬) */}
                  <div className="flex justify-between text-2xs text-muted-foreground font-medium pt-1">
                    <span>회사 0% : 상담원 100%</span>
                    <span>40% : 60% (추천 기본)</span>
                    <span>50% : 50%</span>
                    <span>회사 100% : 상담원 0%</span>
                  </div>
                </div>
              )}

              {policy.splitModel === 'margin_deduction' && (
                <div className="space-y-2">
                  <label className="block text-xs font-medium text-muted-foreground">
                    수임 1건당 회사 고정 공제 마진 (원):
                  </label>
                  <div className="relative">
                    <input
                      type="number"
                      step="50000"
                      value={policy.companyFixedMargin}
                      onChange={e => setPolicy(p => ({ ...p, companyFixedMargin: Math.max(0, parseInt(e.target.value, 10) || 0) }))}
                      className="w-full px-4 py-2.5 bg-background border border-input rounded-xl text-sm font-semibold text-foreground tabular-nums focus:ring-1 focus:ring-primary outline-none"
                    />
                    <span className="absolute right-3.5 top-2.5 text-xs text-muted-foreground font-medium">
                      ₩ {(policy.companyFixedMargin / 10000).toLocaleString()} 만원
                    </span>
                  </div>
                  <p className="text-xs text-muted-foreground mt-1">
                    예: 거래처 수수료가 120만원이면 회사가 30만원을 떼고 나머지 90만원을 상담원에게 지급합니다.
                  </p>
                </div>
              )}

              {policy.splitModel === 'fixed_agent_incentive' && (
                <div className="space-y-2">
                  <label className="block text-xs font-medium text-muted-foreground">
                    수임 1건당 상담원 고정 지급 인센티브 (원):
                  </label>
                  <div className="relative">
                    <input
                      type="number"
                      step="10000"
                      value={policy.agentFixedIncentive}
                      onChange={e => setPolicy(p => ({ ...p, agentFixedIncentive: Math.max(0, parseInt(e.target.value, 10) || 0) }))}
                      className="w-full px-4 py-2.5 bg-background border border-input rounded-xl text-sm font-semibold text-foreground tabular-nums focus:ring-1 focus:ring-primary outline-none"
                    />
                    <span className="absolute right-3.5 top-2.5 text-xs text-muted-foreground font-medium">
                      ₩ {(policy.agentFixedIncentive / 10000).toLocaleString()} 만원
                    </span>
                  </div>
                  <p className="text-xs text-muted-foreground mt-1">
                    예: 거래처 수수료 금액과 관계없이 상담원에게는 수임 성공 1건당 15만원을 지급합니다.
                  </p>
                </div>
              )}
            </div>
          </div>

          {/* 3. 상담원 수당 지급 일정 (타이틀과 그리드 명확히 분리) */}
          <div className="space-y-2.5">
            <label className="text-xs font-semibold text-foreground uppercase tracking-wider flex items-center gap-1.5">
              <Clock size={14} strokeWidth={1.75} className="text-primary" />
              <span>3. 상담원 수당 지급 주기 및 날짜 (AGENT PAYOUT SCHEDULE)</span>
            </label>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
              {/* 월급 정기 지급 */}
              <label
                className={`p-3.5 rounded-xl border cursor-pointer transition-all ${
                  policy.agentPayoutCycle === 'monthly_fixed'
                    ? 'bg-primary/5 border-primary/40 ring-1 ring-primary/30 shadow-2xs'
                    : 'bg-card border-border hover:border-border/80'
                }`}
              >
                <div className="flex items-center justify-between mb-2">
                  <span className="text-xs font-semibold text-foreground flex items-center gap-1.5">
                    <Calendar size={13} strokeWidth={1.75} className="text-primary" />
                    <span>매월 정기일 지급</span>
                  </span>
                  <input
                    type="radio"
                    name="agentPayoutCycle"
                    checked={policy.agentPayoutCycle === 'monthly_fixed'}
                    onChange={() => setCycle('monthly_fixed')}
                    className="accent-primary"
                  />
                </div>
                <select
                  disabled={policy.agentPayoutCycle !== 'monthly_fixed'}
                  value={policy.agentPayoutDay}
                  onChange={e => setPolicy(p => ({ ...p, agentPayoutDay: parseInt(e.target.value, 10) }))}
                  className="w-full text-xs font-semibold p-2 bg-background border border-input rounded-lg text-foreground disabled:opacity-50 outline-none focus:ring-1 focus:ring-primary"
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
                    ? 'bg-primary/5 border-primary/40 ring-1 ring-primary/30 shadow-2xs'
                    : 'bg-card border-border hover:border-border/80'
                }`}
              >
                <div className="flex items-center justify-between mb-2">
                  <span className="text-xs font-semibold text-foreground flex items-center gap-1.5">
                    <Clock size={13} strokeWidth={1.75} className="text-primary" />
                    <span>매주 정기 주급 지급</span>
                  </span>
                  <input
                    type="radio"
                    name="agentPayoutCycle"
                    checked={policy.agentPayoutCycle === 'weekly_fixed'}
                    onChange={() => setCycle('weekly_fixed')}
                    className="accent-primary"
                  />
                </div>
                <select
                  disabled={policy.agentPayoutCycle !== 'weekly_fixed'}
                  value={policy.agentPayoutDay}
                  onChange={e => setPolicy(p => ({ ...p, agentPayoutDay: parseInt(e.target.value, 10) }))}
                  className="w-full text-xs font-semibold p-2 bg-background border border-input rounded-lg text-foreground disabled:opacity-50 outline-none focus:ring-1 focus:ring-primary"
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
                    ? 'bg-primary/5 border-primary/40 ring-1 ring-primary/30 shadow-2xs'
                    : 'bg-card border-border hover:border-border/80'
                }`}
              >
                <div className="flex items-center justify-between mb-2">
                  <span className="text-xs font-semibold text-foreground flex items-center gap-1.5">
                    <ShieldCheck size={13} strokeWidth={1.75} className="text-primary" />
                    <span>입금 확인 후 지급</span>
                  </span>
                  <input
                    type="radio"
                    name="agentPayoutCycle"
                    checked={policy.agentPayoutCycle === 'after_partner_deposit'}
                    onChange={() => setCycle('after_partner_deposit')}
                    className="accent-primary"
                  />
                </div>
                <select
                  disabled={policy.agentPayoutCycle !== 'after_partner_deposit'}
                  value={policy.payoutDelayDays}
                  onChange={e => setPolicy(p => ({ ...p, payoutDelayDays: parseInt(e.target.value, 10) }))}
                  className="w-full text-xs font-semibold p-2 bg-background border border-input rounded-lg text-foreground disabled:opacity-50 outline-none focus:ring-1 focus:ring-primary"
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
        <div className="px-6 py-4 bg-muted/20 border-t border-border flex items-center justify-between">
          <div className="text-2xs text-muted-foreground">
            * 저장 즉시 전체 정산서 및 경영 손익(P&L)에 실시간 자동 반영됩니다.
          </div>
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={onClose}
              disabled={isSubmitting}
              className="px-4 py-2 text-xs font-medium text-muted-foreground hover:text-foreground hover:bg-muted rounded-lg transition-colors"
            >
              취소
            </button>
            <button
              type="button"
              onClick={handleSubmit}
              disabled={isSubmitting || tableMissing}
              className="px-5 py-2.5 bg-primary hover:bg-primary/90 text-primary-foreground font-semibold rounded-lg text-xs shadow-xs flex items-center gap-2 disabled:opacity-50 transition-all cursor-pointer"
            >
              {isSubmitting ? (
                <>
                  <RefreshCw size={14} className="animate-spin" />
                  저장중...
                </>
              ) : (
                <>
                  <CheckCircle2 size={14} strokeWidth={1.75} />
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
