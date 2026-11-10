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
            await onSave({
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
            });
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
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
            <motion.div
                initial={{ opacity: 0, scale: 0.95 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0, scale: 0.95 }}
                className="bg-white dark:bg-gray-800 rounded-2xl shadow-2xl border border-gray-200 dark:border-gray-700 w-full max-w-xl max-h-[90vh] flex flex-col overflow-hidden"
            >
                {/* 헤더 */}
                <div className="p-5 border-b border-gray-100 dark:border-gray-700 flex items-center justify-between bg-slate-50 dark:bg-gray-800/80">
                    <div className="flex items-center gap-3">
                        <div className="w-10 h-10 rounded-xl bg-indigo-100 dark:bg-indigo-950/60 text-indigo-600 dark:text-indigo-400 flex items-center justify-center font-bold">
                            <DollarSign size={20} />
                        </div>
                        <div>
                            <h3 className="text-base font-bold text-gray-900 dark:text-white flex items-center gap-2">
                                <span>{agentName}</span>
                                <span className="text-xs px-2.5 py-0.5 rounded-full bg-indigo-50 dark:bg-indigo-900/40 text-indigo-700 dark:text-indigo-300 font-semibold">
                                    급여 / 인센티브 맞춤 설정
                                </span>
                            </h3>
                            <p className="text-xs text-gray-500 dark:text-gray-400">
                                성과급 유형(순수 건당 인센, 기본급+인센, 구간식) 및 공제 방식을 지정합니다.
                            </p>
                        </div>
                    </div>
                    <button
                        onClick={onClose}
                        className="p-1.5 text-gray-400 hover:text-gray-600 dark:hover:text-gray-200 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-700"
                    >
                        <X size={20} />
                    </button>
                </div>

                {/* 폼 본문 */}
                <form onSubmit={handleSubmit} className="p-6 overflow-y-auto space-y-5">
                    {/* 1. 급여 모델 선택 */}
                    <div>
                        <label className="text-xs font-bold text-gray-700 dark:text-gray-300 block mb-2">
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
                                    className={`p-3 rounded-xl border text-left transition-all ${
                                        salaryType === opt.type
                                            ? 'bg-indigo-600 text-white border-indigo-600 shadow-sm'
                                            : 'bg-white dark:bg-gray-750 text-gray-700 dark:text-gray-300 border-gray-200 dark:border-gray-700 hover:border-indigo-300'
                                    }`}
                                >
                                    <div className="font-bold text-xs">{opt.label}</div>
                                    <div className={`text-[10px] mt-0.5 ${salaryType === opt.type ? 'text-indigo-100' : 'text-gray-400'}`}>
                                        {opt.desc}
                                    </div>
                                </button>
                            ))}
                        </div>
                    </div>

                    {/* 2. 기본급 설정 (기본급+인센일 때만) */}
                    {salaryType === 'base_plus_incentive' && (
                        <div className="p-4 bg-gray-50 dark:bg-gray-750 rounded-xl border border-gray-200 dark:border-gray-700 flex items-center justify-between">
                            <div>
                                <span className="text-xs font-bold text-gray-800 dark:text-gray-200 block">월 기본급</span>
                                <span className="text-[11px] text-gray-400">수임 계약과 무관하게 지급되는 고정 급여입니다.</span>
                            </div>
                            <div className="flex items-center gap-1.5">
                                <input
                                    type="number"
                                    min="0"
                                    step="50000"
                                    value={baseSalary}
                                    onChange={(e) => setBaseSalary(Number(e.target.value))}
                                    className="w-32 p-2 text-right text-xs font-bold border border-gray-300 dark:border-gray-600 rounded-lg outline-none bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                                />
                                <span className="text-xs font-bold text-gray-600 dark:text-gray-400">원</span>
                            </div>
                        </div>
                    )}

                    {/* 3. 건당 인센티브 설정 (순수 건당 또는 기본급+인센) */}
                    {(salaryType === 'pure_incentive' || salaryType === 'base_plus_incentive') && (
                        <div className="p-4 bg-indigo-50/50 dark:bg-indigo-950/20 rounded-xl border border-indigo-100 dark:border-indigo-900/40 space-y-3">
                            <div className="flex items-center justify-between">
                                <div>
                                    <span className="text-xs font-bold text-indigo-900 dark:text-indigo-200 block">
                                        수임 성공 1건당 고정 인센티브
                                    </span>
                                    <span className="text-[11px] text-gray-500">계약 1건당 상담원에게 지급할 성과급입니다.</span>
                                </div>
                                <div className="flex items-center gap-1.5">
                                    <input
                                        type="number"
                                        min="0"
                                        step="10000"
                                        value={unitIncentive}
                                        onChange={(e) => setUnitIncentive(Number(e.target.value))}
                                        className="w-28 p-2 text-right text-xs font-extrabold border border-indigo-300 dark:border-indigo-700 rounded-lg outline-none bg-white dark:bg-gray-700 text-indigo-600 dark:text-indigo-400"
                                    />
                                    <span className="text-xs font-bold text-gray-600 dark:text-gray-400">원</span>
                                </div>
                            </div>

                            <div className="pt-2 border-t border-indigo-100 dark:border-indigo-900/40 flex items-center justify-between text-xs">
                                <span className="text-gray-500">또는 수임료 비율(%) 지급 (0% 시 고정 금액 적용):</span>
                                <div className="flex items-center gap-1">
                                    <input
                                        type="number"
                                        min="0"
                                        max="50"
                                        value={incentiveRate}
                                        onChange={(e) => setIncentiveRate(Number(e.target.value))}
                                        className="w-16 p-1.5 text-right font-bold border border-gray-300 dark:border-gray-600 rounded-lg outline-none bg-white dark:bg-gray-700 text-gray-800 dark:text-white"
                                    />
                                    <span className="font-bold">%</span>
                                </div>
                            </div>
                        </div>
                    )}

                    {/* 4. 구간식 계단형 인센티브 테이블 */}
                    {salaryType === 'tiered' && (
                        <div className="space-y-3 p-4 bg-gray-50 dark:bg-gray-750 rounded-xl border border-gray-200 dark:border-gray-700">
                            <div className="flex items-center justify-between">
                                <span className="text-xs font-bold text-gray-800 dark:text-gray-200">
                                    구간별 계단식 인센티브 테이블
                                </span>
                                <button
                                    type="button"
                                    onClick={handleAddTier}
                                    className="px-2 py-1 rounded-lg bg-indigo-50 dark:bg-indigo-950/60 text-indigo-600 text-xs font-bold flex items-center gap-1"
                                >
                                    <Plus size={12} /> 구간 추가
                                </button>
                            </div>

                            <div className="space-y-2">
                                {tierRules.map((t, idx) => (
                                    <div key={idx} className="flex items-center gap-2 bg-white dark:bg-gray-700 p-2.5 rounded-lg border border-gray-200 dark:border-gray-600 text-xs">
                                        <span className="text-gray-400 font-bold w-6">{idx + 1}구간</span>
                                        <input
                                            type="number"
                                            value={t.min}
                                            onChange={(e) => handleUpdateTier(idx, 'min', Number(e.target.value))}
                                            className="w-12 p-1 text-center font-bold border rounded bg-gray-50 dark:bg-gray-600"
                                        />
                                        <span>~</span>
                                        <input
                                            type="number"
                                            value={t.max}
                                            onChange={(e) => handleUpdateTier(idx, 'max', Number(e.target.value))}
                                            className="w-12 p-1 text-center font-bold border rounded bg-gray-50 dark:bg-gray-600"
                                        />
                                        <span>건 달성 시:</span>
                                        <span className="text-gray-400 font-medium">건당</span>
                                        <input
                                            type="number"
                                            step="10000"
                                            value={t.fee}
                                            onChange={(e) => handleUpdateTier(idx, 'fee', Number(e.target.value))}
                                            className="w-24 p-1 text-right font-bold text-indigo-600 border rounded bg-gray-50 dark:bg-gray-600 ml-auto"
                                        />
                                        <span>원</span>
                                        {tierRules.length > 1 && (
                                            <button
                                                type="button"
                                                onClick={() => handleDeleteTier(idx)}
                                                className="text-red-400 hover:text-red-600 p-1"
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
                        <div className="p-3 bg-gray-50 dark:bg-gray-750 rounded-xl border border-gray-200 dark:border-gray-700">
                            <label className="text-[11px] font-semibold text-gray-500 dark:text-gray-400 block mb-1">
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
                                    className="w-full p-2 text-right text-xs font-bold border border-gray-300 dark:border-gray-600 rounded-lg outline-none bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                                />
                                <span className="text-xs font-medium text-gray-500">원/일</span>
                            </div>
                        </div>

                        <div className="p-3 bg-gray-50 dark:bg-gray-750 rounded-xl border border-gray-200 dark:border-gray-700">
                            <label className="text-[11px] font-semibold text-gray-500 dark:text-gray-400 block mb-1">
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
                                    className="w-full p-2 text-right text-xs font-bold border border-gray-300 dark:border-gray-600 rounded-lg outline-none bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                                />
                                <span className="text-xs font-medium text-gray-500">원/월</span>
                            </div>
                        </div>
                    </div>

                    {/* 6. 세금 및 원천징수 설정 */}
                    <div>
                        <label className="text-xs font-bold text-gray-700 dark:text-gray-300 block mb-2">
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
                                    className={`p-2.5 rounded-xl border text-left transition-all ${
                                        taxType === opt.type
                                            ? 'bg-slate-800 dark:bg-gray-600 text-white border-slate-800'
                                            : 'bg-white dark:bg-gray-750 text-gray-700 dark:text-gray-300 border-gray-200 dark:border-gray-700'
                                    }`}
                                >
                                    <div className="font-bold text-xs">{opt.label}</div>
                                    <div className={`text-[10px] mt-0.5 ${taxType === opt.type ? 'text-gray-200' : 'text-gray-400'}`}>
                                        {opt.desc}
                                    </div>
                                </button>
                            ))}
                        </div>
                    </div>

                    {/* 7. 급여 수령 계좌 */}
                    <div className="p-4 bg-gray-50 dark:bg-gray-750 rounded-xl border border-gray-200 dark:border-gray-700 space-y-2.5">
                        <span className="text-xs font-bold text-gray-700 dark:text-gray-300 flex items-center gap-1.5">
                            <CreditCard size={14} className="text-indigo-600" /> 급여 입금 계좌 정보
                        </span>
                        <div className="grid grid-cols-3 gap-2 text-xs">
                            <input
                                type="text"
                                placeholder="은행명 (예: 카카오뱅크)"
                                value={bankName}
                                onChange={(e) => setBankName(e.target.value)}
                                className="p-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 outline-none"
                            />
                            <input
                                type="text"
                                placeholder="계좌번호 (- 없이 입력)"
                                value={accountNumber}
                                onChange={(e) => setAccountNumber(e.target.value)}
                                className="p-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 outline-none"
                            />
                            <input
                                type="text"
                                placeholder="예금주 성명"
                                value={accountHolder}
                                onChange={(e) => setAccountHolder(e.target.value)}
                                className="p-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 outline-none"
                            />
                        </div>
                    </div>

                    {/* 액션 버튼 */}
                    <div className="pt-3 border-t border-gray-100 dark:border-gray-700 flex justify-end gap-2">
                        <button
                            type="button"
                            onClick={onClose}
                            className="px-4 py-2.5 rounded-xl border border-gray-300 dark:border-gray-600 text-xs font-bold text-gray-600 dark:text-gray-300 hover:bg-gray-100"
                        >
                            취소
                        </button>
                        <button
                            type="submit"
                            disabled={submitting}
                            className="px-5 py-2.5 rounded-xl bg-indigo-600 text-white text-xs font-bold hover:bg-indigo-700 shadow-sm flex items-center gap-1.5 disabled:opacity-50"
                        >
                            <Save size={14} /> 설정 저장
                        </button>
                    </div>
                </form>
            </motion.div>
        </div>
    );
};
