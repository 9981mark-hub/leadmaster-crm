import React, { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { 
    X, Save, DollarSign, Settings, Check, Plus, Trash2, 
    ShieldCheck, Building, HelpCircle, Layers, CreditCard 
} from 'lucide-react';
import { AgentPayrollProfile, DEFAULT_PAYROLL_PROFILE, PayrollTierRule } from '../../services/hr';
import { useToast } from '../../contexts/ToastContext';

interface AgentPayrollModalProps {
    isOpen: boolean;
    onClose: () => void;
    agentName: string;
    profile: AgentPayrollProfile;
    onSave: (updated: AgentPayrollProfile) => Promise<void>;
}

export const AgentPayrollModal: React.FC<AgentPayrollModalProps> = ({
    isOpen,
    onClose,
    agentName,
    profile,
    onSave
}) => {
    const { showToast } = useToast();
    const [submitting, setSubmitting] = useState(false);
    const [salaryType, setSalaryType] = useState<AgentPayrollProfile['salaryType']>(profile.salaryType || 'pure_incentive');
    const [baseSalary, setBaseSalary] = useState<number>(profile.baseSalary || 0);
    const [unitIncentive, setUnitIncentive] = useState<number>(profile.unitIncentive || 150000);
    const [incentiveRate, setIncentiveRate] = useState<number>(profile.incentiveRate || 0);
    const [tierRules, setTierRules] = useState<PayrollTierRule[]>(
        profile.tierRules?.length ? profile.tierRules : DEFAULT_PAYROLL_PROFILE.tierRules
    );
    const [dailyAllowance, setDailyAllowance] = useState<number>(profile.dailyAllowance || 0);
    const [bonusAllowance, setBonusAllowance] = useState<number>(profile.bonusAllowance || 0);
    const [taxType, setTaxType] = useState<AgentPayrollProfile['taxType']>(profile.taxType || 'freelancer_3_3');
    const [bankName, setBankName] = useState<string>(profile.bankName || '');
    const [accountNumber, setAccountNumber] = useState<string>(profile.accountNumber || '');
    const [accountHolder, setAccountHolder] = useState<string>(profile.accountHolder || agentName);

    if (!isOpen) return null;

    // 구간 규칙 추가
    const handleAddTier = () => {
        const last = tierRules[tierRules.length - 1];
        const nextMin = last ? last.max + 1 : 1;
        setTierRules([...tierRules, { min: nextMin, max: nextMin + 2, fee: (last ? last.fee : 150000) + 50000 }]);
    };

    // 구간 규칙 삭제
    const handleDeleteTier = (idx: number) => {
        setTierRules(tierRules.filter((_, i) => i !== idx));
    };

    // 구간 규칙 업데이트
    const handleUpdateTier = (idx: number, field: keyof PayrollTierRule, val: number) => {
        const copy = [...tierRules];
        copy[idx] = { ...copy[idx], [field]: val };
        setTierRules(copy);
    };

    // 저장 핸들러
    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setSubmitting(true);
        try {
            const updatedProfile = {
                userId: profile.userId,
                salaryType,
                baseSalary,
                unitIncentive,
                incentiveRate,
                tierRules,
                dailyAllowance,
                bonusAllowance,
                taxType,
                bankName,
                accountNumber,
                accountHolder
            };
            await onSave(updatedProfile);

            // 로컬 payroll 캐시 즉시 업데이트
            try {
                localStorage.setItem(`leadmaster_payroll_${profile.userId}`, JSON.stringify(updatedProfile));
            } catch {}

            showToast(`[${agentName}] 급여/인센티브 체계가 저장되었습니다.`, 'success');
            onClose();
        } catch (err) {
            console.error('Failed to save payroll profile:', err);
            showToast('급여 설정 저장에 실패했습니다.', 'error');
        } finally {
            setSubmitting(false);
        }
    };

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-xs animate-fadeIn">
            <motion.div
                initial={{ opacity: 0, scale: 0.96 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0, scale: 0.96 }}
                className="bg-card text-card-foreground rounded-2xl shadow-2xl border border-border w-full max-w-xl max-h-[90vh] flex flex-col overflow-hidden"
            >
                {/* 헤더 */}
                <div className="p-5 border-b border-border flex items-center justify-between bg-muted/40">
                    <div className="flex items-center gap-3">
                        <div className="w-10 h-10 rounded-xl bg-primary/10 text-primary border border-primary/20 flex items-center justify-center font-bold shrink-0 shadow-2xs">
                            <DollarSign size={20} strokeWidth={1.75} />
                        </div>
                        <div>
                            <h3 className="text-base font-bold text-foreground flex items-center gap-2">
                                <span>{agentName}</span>
                                <span className="text-xs px-2.5 py-0.5 rounded-full bg-primary/10 text-primary border border-primary/20 font-semibold">
                                    급여 / 인센티브 맞춤 설정
                                </span>
                            </h3>
                            <p className="text-xs text-muted-foreground mt-0.5">
                                성과급 유형(순수 건당 인센, 기본급+인센, 구간식) 및 공제 방식을 지정합니다.
                            </p>
                        </div>
                    </div>
                    <button
                        onClick={onClose}
                        className="p-1.5 text-muted-foreground hover:text-foreground rounded-lg hover:bg-muted transition-colors cursor-pointer"
                    >
                        <X size={20} />
                    </button>
                </div>

                {/* 폼 본문 */}
                <form onSubmit={handleSubmit} className="p-6 overflow-y-auto space-y-5 text-xs">
                    {/* 1. 급여 모델 선택 */}
                    <div>
                        <label className="text-xs font-bold text-foreground block mb-2">
                            급여 지급 방식 선택
                        </label>
                        <div className="grid grid-cols-3 gap-2">
                            {[
                                { type: 'pure_incentive', label: '순수 건당 성과급', desc: '100% 인센티브제 (프리랜서)' },
                                { type: 'base_plus_incentive', label: '기본급 + 인센티브', desc: '하이브리드형 (기본급 보장)' },
                                { type: 'tiered', label: '구간별 계단식', desc: '건수 증가 시 요율 상승' }
                            ].map(opt => (
                                <button
                                    key={opt.type}
                                    type="button"
                                    onClick={() => setSalaryType(opt.type as any)}
                                    className={`p-3 rounded-xl border text-left transition-all cursor-pointer ${
                                        salaryType === opt.type
                                            ? 'bg-primary/15 text-primary border-primary shadow-xs font-bold'
                                            : 'bg-muted/30 text-foreground border-border hover:bg-muted/60'
                                    }`}
                                >
                                    <div className="font-bold text-xs">{opt.label}</div>
                                    <div className={`text-[11px] mt-0.5 leading-snug ${salaryType === opt.type ? 'text-primary/90' : 'text-muted-foreground'}`}>
                                        {opt.desc}
                                    </div>
                                </button>
                            ))}
                        </div>
                    </div>

                    {/* 2. 기본급 설정 (기본급+인센일 때만) */}
                    {salaryType === 'base_plus_incentive' && (
                        <div className="p-4 bg-muted/30 rounded-xl border border-border flex items-center justify-between">
                            <div>
                                <span className="text-xs font-bold text-foreground block">월 기본급</span>
                                <span className="text-xs text-muted-foreground">수임 계약과 무관하게 지급되는 고정 급여입니다.</span>
                            </div>
                            <div className="flex items-center gap-1.5">
                                <input
                                    type="number"
                                    min="0"
                                    step="50000"
                                    value={baseSalary}
                                    onChange={(e) => setBaseSalary(Number(e.target.value))}
                                    className="w-32 p-2 text-right text-xs font-mono font-bold border border-input rounded-lg outline-none bg-background text-foreground focus:ring-1 focus:ring-primary tabular-nums"
                                />
                                <span className="text-xs font-bold text-muted-foreground">원</span>
                            </div>
                        </div>
                    )}

                    {/* 3. 건당 인센티브 설정 (순수 건당 또는 기본급+인센) */}
                    {(salaryType === 'pure_incentive' || salaryType === 'base_plus_incentive') && (
                        <div className="p-4 bg-muted/30 rounded-xl border border-border space-y-3">
                            <div className="flex items-center justify-between">
                                <div>
                                    <span className="text-xs font-bold text-foreground block">
                                        수임 성공 1건당 고정 인센티브
                                    </span>
                                    <span className="text-xs text-muted-foreground">계약 1건당 상담원에게 지급할 성과급입니다.</span>
                                </div>
                                <div className="flex items-center gap-1.5">
                                    <input
                                        type="number"
                                        min="0"
                                        step="10000"
                                        value={unitIncentive}
                                        onChange={(e) => setUnitIncentive(Number(e.target.value))}
                                        className="w-28 p-2 text-right text-xs font-mono font-bold border border-input rounded-lg outline-none bg-background text-primary focus:ring-1 focus:ring-primary tabular-nums"
                                    />
                                    <span className="text-xs font-bold text-muted-foreground">원</span>
                                </div>
                            </div>

                            <div className="pt-2 border-t border-border flex items-center justify-between text-xs">
                                <span className="text-muted-foreground">또는 수임료 비율(%) 지급 (0% 시 고정 금액 적용):</span>
                                <div className="flex items-center gap-1">
                                    <input
                                        type="number"
                                        min="0"
                                        max="50"
                                        value={incentiveRate}
                                        onChange={(e) => setIncentiveRate(Number(e.target.value))}
                                        className="w-16 p-1.5 text-right font-mono font-bold border border-input rounded-lg outline-none bg-background text-foreground focus:ring-1 focus:ring-primary tabular-nums"
                                    />
                                    <span className="font-bold text-foreground">%</span>
                                </div>
                            </div>
                        </div>
                    )}

                    {/* 4. 구간식 계단형 인센티브 테이블 */}
                    {salaryType === 'tiered' && (
                        <div className="space-y-3 p-4 bg-muted/30 rounded-xl border border-border">
                            <div className="flex items-center justify-between">
                                <span className="text-xs font-bold text-foreground">
                                    구간별 계단식 인센티브 테이블
                                </span>
                                <button
                                    type="button"
                                    onClick={handleAddTier}
                                    className="px-2.5 py-1 rounded-lg bg-primary/10 text-primary border border-primary/20 text-xs font-semibold flex items-center gap-1 hover:bg-primary/20 transition-colors cursor-pointer"
                                >
                                    <Plus size={12} /> 구간 추가
                                </button>
                            </div>

                            <div className="space-y-2">
                                {tierRules.map((t, idx) => (
                                    <div key={idx} className="flex items-center gap-2 bg-background p-2.5 rounded-lg border border-border text-xs">
                                        <span className="text-muted-foreground font-mono font-bold w-6">{idx + 1}구간</span>
                                        <input
                                            type="number"
                                            value={t.min}
                                            onChange={(e) => handleUpdateTier(idx, 'min', Number(e.target.value))}
                                            className="w-12 p-1 text-center font-mono font-bold border border-input rounded bg-muted/50 text-foreground"
                                        />
                                        <span className="text-muted-foreground">~</span>
                                        <input
                                            type="number"
                                            value={t.max}
                                            onChange={(e) => handleUpdateTier(idx, 'max', Number(e.target.value))}
                                            className="w-12 p-1 text-center font-mono font-bold border border-input rounded bg-muted/50 text-foreground"
                                        />
                                        <span className="text-muted-foreground">건 달성 시:</span>
                                        <span className="text-muted-foreground font-medium">건당</span>
                                        <input
                                            type="number"
                                            step="10000"
                                            value={t.fee}
                                            onChange={(e) => handleUpdateTier(idx, 'fee', Number(e.target.value))}
                                            className="w-24 p-1 text-right font-mono font-bold text-primary border border-input rounded bg-muted/50 ml-auto tabular-nums"
                                        />
                                        <span className="text-foreground">원</span>
                                        {tierRules.length > 1 && (
                                            <button
                                                type="button"
                                                onClick={() => handleDeleteTier(idx)}
                                                className="text-destructive hover:bg-destructive/10 p-1 rounded transition-colors cursor-pointer"
                                            >
                                                <Trash2 size={13} />
                                            </button>
                                        )}
                                    </div>
                                ))}
                            </div>
                        </div>
                    )}

                    {/* 5. 출근 일비 & 수당 */}
                    <div className="grid grid-cols-2 gap-3">
                        <div className="p-3 bg-muted/30 rounded-xl border border-border">
                            <label className="text-xs font-semibold text-muted-foreground block mb-1">
                                출근 1일당 일비/식대 (선택)
                            </label>
                            <div className="flex items-center gap-1.5">
                                <input
                                    type="number"
                                    min="0"
                                    step="5000"
                                    value={dailyAllowance}
                                    onChange={(e) => setDailyAllowance(Number(e.target.value))}
                                    placeholder="0"
                                    className="w-full p-2 text-right text-xs font-mono font-bold border border-input rounded-lg outline-none bg-background text-foreground focus:ring-1 focus:ring-primary tabular-nums"
                                />
                                <span className="text-xs font-medium text-muted-foreground">원/일</span>
                            </div>
                        </div>

                        <div className="p-3 bg-muted/30 rounded-xl border border-border">
                            <label className="text-xs font-semibold text-muted-foreground block mb-1">
                                만근 보너스 / 고정 수당 (선택)
                            </label>
                            <div className="flex items-center gap-1.5">
                                <input
                                    type="number"
                                    min="0"
                                    step="50000"
                                    value={bonusAllowance}
                                    onChange={(e) => setBonusAllowance(Number(e.target.value))}
                                    placeholder="0"
                                    className="w-full p-2 text-right text-xs font-mono font-bold border border-input rounded-lg outline-none bg-background text-foreground focus:ring-1 focus:ring-primary tabular-nums"
                                />
                                <span className="text-xs font-medium text-muted-foreground">원/월</span>
                            </div>
                        </div>
                    </div>

                    {/* 6. 세금 및 원천징수 설정 */}
                    <div>
                        <label className="text-xs font-bold text-foreground block mb-2">
                            세금 공제 방식
                        </label>
                        <div className="grid grid-cols-3 gap-2">
                            {[
                                { type: 'freelancer_3_3', label: '프리랜서 3.3%', desc: '사업소득세 3% + 지방소득세 0.3%' },
                                { type: 'four_insurances', label: '4대보험 공제', desc: '정규직 간이 산출 (약 9.3%)' },
                                { type: 'none', label: '세금 공제 없음', desc: '세전 총액 그대로 지급' }
                            ].map(opt => (
                                <button
                                    key={opt.type}
                                    type="button"
                                    onClick={() => setTaxType(opt.type as any)}
                                    className={`p-2.5 rounded-xl border text-left transition-all cursor-pointer ${
                                        taxType === opt.type
                                            ? 'bg-primary/15 text-primary border-primary shadow-xs font-bold'
                                            : 'bg-muted/30 text-foreground border-border hover:bg-muted/60'
                                    }`}
                                >
                                    <div className="font-bold text-xs">{opt.label}</div>
                                    <div className={`text-[11px] mt-0.5 ${taxType === opt.type ? 'text-primary/90' : 'text-muted-foreground'}`}>
                                        {opt.desc}
                                    </div>
                                </button>
                            ))}
                        </div>
                    </div>

                    {/* 7. 급여 수령 계좌 */}
                    <div className="p-4 bg-muted/30 rounded-xl border border-border space-y-2.5">
                        <span className="text-xs font-bold text-foreground flex items-center gap-1.5">
                            <CreditCard size={14} className="text-primary" /> 급여 입금 계좌 정보
                        </span>
                        <div className="grid grid-cols-3 gap-2 text-xs">
                            <input
                                type="text"
                                placeholder="은행명 (예: 카카오뱅크)"
                                value={bankName}
                                onChange={(e) => setBankName(e.target.value)}
                                className="p-2 border border-input rounded-lg bg-background text-foreground focus:ring-1 focus:ring-primary outline-none"
                            />
                            <input
                                type="text"
                                placeholder="계좌번호 (- 없이 입력)"
                                value={accountNumber}
                                onChange={(e) => setAccountNumber(e.target.value)}
                                className="p-2 border border-input rounded-lg bg-background text-foreground font-mono focus:ring-1 focus:ring-primary outline-none tabular-nums"
                            />
                            <input
                                type="text"
                                placeholder="예금주 성명"
                                value={accountHolder}
                                onChange={(e) => setAccountHolder(e.target.value)}
                                className="p-2 border border-input rounded-lg bg-background text-foreground focus:ring-1 focus:ring-primary outline-none"
                            />
                        </div>
                    </div>

                    {/* 액션 버튼 */}
                    <div className="pt-3 border-t border-border flex justify-end gap-2">
                        <button
                            type="button"
                            onClick={onClose}
                            className="px-4 py-2.5 rounded-xl border border-border text-xs font-semibold text-muted-foreground hover:text-foreground hover:bg-muted transition-colors cursor-pointer"
                        >
                            취소
                        </button>
                        <button
                            type="submit"
                            disabled={submitting}
                            className="px-5 py-2.5 rounded-xl bg-primary hover:bg-primary/90 text-primary-foreground text-xs font-bold shadow-xs flex items-center gap-1.5 disabled:opacity-50 transition-colors cursor-pointer"
                        >
                            <Save size={14} /> 설정 저장
                        </button>
                    </div>
                </form>
            </motion.div>
        </div>
    );
};
