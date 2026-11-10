import React, { useState } from 'react';
import { motion } from 'framer-motion';
import { 
    X, Copy, Check, Download, Printer, DollarSign, 
    Calendar, CheckCircle2, ShieldCheck, FileText 
} from 'lucide-react';
import { AgentPayrollCalculation } from '../../services/hr';
import { useToast } from '../../contexts/ToastContext';
import * as XLSX from 'xlsx';
import { sanitizeRowData } from '../../utils/xlsxExport';

interface AgentPayslipModalProps {
    isOpen: boolean;
    onClose: () => void;
    calculation: AgentPayrollCalculation;
    payrollMonth: string; // "2026-11"
    orgName?: string;
}

export const AgentPayslipModal: React.FC<AgentPayslipModalProps> = ({
    isOpen,
    onClose,
    calculation,
    payrollMonth,
    orgName = '리드마스터'
}) => {
    const { showToast } = useToast();
    const [copied, setCopied] = useState(false);

    if (!isOpen) return null;

    const [year, month] = payrollMonth.split('-');
    const { profile, contractItems } = calculation;

    // 카카오톡 전송용 정식 텍스트 양식 생성
    const generatePayslipText = () => {
        const lines: string[] = [];
        lines.push(`━━━━━━━━━━━━━━━━━━━━━━━━━━━━`);
        lines.push(`📄 [${orgName}] ${Number(year)}년 ${Number(month)}월 급여/인센티브 명세서`);
        lines.push(`• 성명: ${calculation.displayName} 님`);
        lines.push(`• 지급 형태: ${profile.salaryType === 'pure_incentive' ? '순수 성과급 (프리랜서 위촉직)' : profile.salaryType === 'base_plus_incentive' ? '기본급 + 성과급' : '구간별 계단식 성과급'}`);
        lines.push(`━━━━━━━━━━━━━━━━━━━━━━━━━━━━`);
        lines.push(`[근태 및 활동 요약]`);
        lines.push(`• 출근 일수: ${calculation.attendanceDays}일`);
        const callH = Math.floor(calculation.totalCallDurationSeconds / 3600);
        const callM = Math.floor((calculation.totalCallDurationSeconds % 3600) / 60);
        lines.push(`• 총 통화 시간: ${callH > 0 ? `${callH}시간 ` : ''}${callM}분 (총 ${calculation.totalCalls}콜)`);
        lines.push(`• 당월 수임 완료: 총 ${calculation.contractCount}건 달성!`);
        lines.push(`────────────────────────────`);
        lines.push(`[수임 계약 상세 내역]`);
        if (contractItems.length === 0) {
            lines.push(`- 해당 월 수임 완료 계약 내역이 없습니다.`);
        } else {
            contractItems.forEach((it, idx) => {
                lines.push(`${idx + 1}. ${it.customerName} (${it.caseType}) / 수임료: ${it.contractFee}만 ➔ 인센티브: ${it.incentiveFee.toLocaleString()}원`);
            });
        }
        lines.push(`────────────────────────────`);
        lines.push(`[지급 항목]`);
        if (calculation.basePay > 0) {
            lines.push(`• 기본급: ₩ ${calculation.basePay.toLocaleString()} 원`);
        }
        lines.push(`• 인센티브 성과급: ₩ ${calculation.incentivePay.toLocaleString()} 원`);
        if (calculation.allowancePay > 0) {
            lines.push(`• 일비 / 만근 보너스: ₩ ${calculation.allowancePay.toLocaleString()} 원`);
        }
        lines.push(`• 총 지급액 (세전): ₩ ${calculation.grossPay.toLocaleString()} 원`);
        lines.push(`────────────────────────────`);
        lines.push(`[공제 항목]`);
        if (profile.taxType === 'freelancer_3_3') {
            const incomeTax = Math.floor(calculation.grossPay * 0.03);
            const localTax = Math.floor(calculation.grossPay * 0.003);
            lines.push(`• 사업소득세 (3.0%): ₩ ${incomeTax.toLocaleString()} 원`);
            lines.push(`• 지방소득세 (0.3%): ₩ ${localTax.toLocaleString()} 원`);
            lines.push(`• 총 공제액 (3.3%): ₩ ${calculation.taxDeduction.toLocaleString()} 원`);
        } else if (profile.taxType === 'four_insurances') {
            lines.push(`• 4대보험 공제: ₩ ${calculation.taxDeduction.toLocaleString()} 원`);
        } else {
            lines.push(`• 공제 항목: 0원`);
        }
        lines.push(`────────────────────────────`);
        lines.push(`★ 실지급액 (세후): ₩ ${calculation.netPay.toLocaleString()} 원`);
        if (profile.bankName && profile.accountNumber) {
            lines.push(`• 입금 계좌: ${profile.bankName} ${profile.accountNumber} (${profile.accountHolder || calculation.displayName})`);
        }
        lines.push(`━━━━━━━━━━━━━━━━━━━━━━━━━━━━`);
        lines.push(`한 달 동안 수고 많으셨습니다. 늘 감사드립니다!`);
        return lines.join('\n');
    };

    const handleCopy = async () => {
        const text = generatePayslipText();
        await navigator.clipboard.writeText(text);
        setCopied(true);
        showToast('카카오톡 급여명세서 양식이 클립보드에 복사되었습니다!', 'success');
        setTimeout(() => setCopied(false), 2500);
    };

    const handleDownloadExcel = () => {
        const rows = [
            sanitizeRowData({ '구분': '성명', '내용': calculation.displayName }),
            sanitizeRowData({ '구분': '대상월', '내용': payrollMonth }),
            sanitizeRowData({ '구분': '출근일수', '내용': `${calculation.attendanceDays}일` }),
            sanitizeRowData({ '구분': '수임완료건수', '내용': `${calculation.contractCount}건` }),
            sanitizeRowData({ '구분': '기본급', '내용': calculation.basePay }),
            sanitizeRowData({ '구분': '인센티브', '내용': calculation.incentivePay }),
            sanitizeRowData({ '구분': '수당/일비', '내용': calculation.allowancePay }),
            sanitizeRowData({ '구분': '세전총액', '내용': calculation.grossPay }),
            sanitizeRowData({ '구분': '3.3%세금공제', '내용': calculation.taxDeduction }),
            sanitizeRowData({ '구분': '실지급액', '내용': calculation.netPay }),
            sanitizeRowData({ '구분': '입금계좌', '내용': `${profile.bankName || ''} ${profile.accountNumber || ''} (${profile.accountHolder || ''})` }),
        ];

        const ws = XLSX.utils.json_to_sheet(rows);
        const wb = XLSX.utils.book_new();
        XLSX.utils.book_append_sheet(wb, ws, '급여명세서');
        XLSX.writeFile(wb, `[급여명세서]_${calculation.displayName}_${payrollMonth}.xlsx`);
    };

    const handlePrint = () => {
        window.print();
    };

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
            <motion.div
                initial={{ opacity: 0, scale: 0.95 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0, scale: 0.95 }}
                className="bg-white dark:bg-gray-800 rounded-2xl shadow-2xl border border-gray-200 dark:border-gray-700 w-full max-w-2xl max-h-[90vh] flex flex-col overflow-hidden"
            >
                {/* 헤더 */}
                <div className="p-5 border-b border-gray-100 dark:border-gray-700 flex items-center justify-between bg-slate-50 dark:bg-gray-800/80 no-print">
                    <div className="flex items-center gap-3">
                        <div className="w-10 h-10 rounded-xl bg-emerald-100 dark:bg-emerald-950/60 text-emerald-600 dark:text-emerald-400 flex items-center justify-center font-bold">
                            <FileText size={20} />
                        </div>
                        <div>
                            <h3 className="text-base font-bold text-gray-900 dark:text-white flex items-center gap-2">
                                <span>{calculation.displayName} 님</span>
                                <span className="text-xs px-2.5 py-0.5 rounded-full bg-emerald-50 dark:bg-emerald-900/40 text-emerald-700 dark:text-emerald-300 font-semibold">
                                    {year}년 {month}월 급여명세서
                                </span>
                            </h3>
                            <p className="text-xs text-gray-500 dark:text-gray-400">
                                출근 {calculation.attendanceDays}일 • 수임 완료 {calculation.contractCount}건 달성
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

                {/* 명세서 카드 본문 (인쇄 영역) */}
                <div className="p-6 overflow-y-auto space-y-5 print:p-0">
                    {/* 실지급액 메인 카드 */}
                    <div className="p-5 rounded-2xl bg-gradient-to-br from-indigo-50 to-emerald-50 dark:from-gray-750 dark:to-gray-750 border border-emerald-200 dark:border-emerald-800/60 flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
                        <div>
                            <span className="text-xs font-bold text-gray-500 dark:text-gray-400 block mb-1">
                                {year}년 {month}월 실 수령액 (세후)
                            </span>
                            <div className="text-3xl font-black text-emerald-600 dark:text-emerald-400">
                                ₩ {calculation.netPay.toLocaleString()} <span className="text-sm font-semibold">원</span>
                            </div>
                            <div className="text-xs text-gray-400 mt-1">
                                총 세전: ₩ {calculation.grossPay.toLocaleString()}원 • 공제: -₩ {calculation.taxDeduction.toLocaleString()}원
                            </div>
                        </div>

                        {profile.bankName && profile.accountNumber && (
                            <div className="text-right sm:border-l sm:border-gray-200 sm:dark:border-gray-600 sm:pl-4">
                                <span className="text-[11px] font-semibold text-gray-400 block">입금 예정 계좌</span>
                                <span className="text-xs font-bold text-gray-800 dark:text-gray-200 block">
                                    {profile.bankName} {profile.accountNumber}
                                </span>
                                <span className="text-[11px] text-gray-500">예금주: {profile.accountHolder || calculation.displayName}</span>
                            </div>
                        )}
                    </div>

                    {/* 지급 & 공제 상세 2열 그리드 */}
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                        {/* 지급 내역 */}
                        <div className="p-4 bg-slate-50 dark:bg-gray-750 rounded-xl border border-gray-200 dark:border-gray-700 space-y-2">
                            <span className="text-xs font-bold text-indigo-700 dark:text-indigo-300 block mb-2">
                                ➕ 지급 내역 (세전)
                            </span>
                            {calculation.basePay > 0 && (
                                <div className="flex justify-between text-xs">
                                    <span className="text-gray-600 dark:text-gray-400">기본급</span>
                                    <span className="font-bold text-gray-900 dark:text-white">₩ {calculation.basePay.toLocaleString()}원</span>
                                </div>
                            )}
                            <div className="flex justify-between text-xs">
                                <span className="text-gray-600 dark:text-gray-400">수임 인센티브 ({calculation.contractCount}건)</span>
                                <span className="font-bold text-indigo-600 dark:text-indigo-400">₩ {calculation.incentivePay.toLocaleString()}원</span>
                            </div>
                            {calculation.allowancePay > 0 && (
                                <div className="flex justify-between text-xs">
                                    <span className="text-gray-600 dark:text-gray-400">일비 / 만근 보너스</span>
                                    <span className="font-bold text-gray-900 dark:text-white">₩ {calculation.allowancePay.toLocaleString()}원</span>
                                </div>
                            )}
                            <div className="pt-2 border-t border-gray-200 dark:border-gray-600 flex justify-between text-xs font-bold">
                                <span>지급액 계</span>
                                <span className="text-indigo-600">₩ {calculation.grossPay.toLocaleString()}원</span>
                            </div>
                        </div>

                        {/* 공제 내역 */}
                        <div className="p-4 bg-slate-50 dark:bg-gray-750 rounded-xl border border-gray-200 dark:border-gray-700 space-y-2">
                            <span className="text-xs font-bold text-rose-700 dark:text-rose-300 block mb-2">
                                ➖ 공제 내역 (세금)
                            </span>
                            {profile.taxType === 'freelancer_3_3' ? (
                                <>
                                    <div className="flex justify-between text-xs">
                                        <span className="text-gray-600 dark:text-gray-400">사업소득세 (3.0%)</span>
                                        <span className="font-medium text-gray-700 dark:text-gray-300">
                                            ₩ {Math.floor(calculation.grossPay * 0.03).toLocaleString()}원
                                        </span>
                                    </div>
                                    <div className="flex justify-between text-xs">
                                        <span className="text-gray-600 dark:text-gray-400">지방소득세 (0.3%)</span>
                                        <span className="font-medium text-gray-700 dark:text-gray-300">
                                            ₩ {Math.floor(calculation.grossPay * 0.003).toLocaleString()}원
                                        </span>
                                    </div>
                                </>
                            ) : (
                                <div className="flex justify-between text-xs">
                                    <span className="text-gray-600 dark:text-gray-400">기타 공제</span>
                                    <span className="font-medium text-gray-700 dark:text-gray-300">₩ {calculation.taxDeduction.toLocaleString()}원</span>
                                </div>
                            )}
                            <div className="pt-2 border-t border-gray-200 dark:border-gray-600 flex justify-between text-xs font-bold">
                                <span>공제액 계 (3.3%)</span>
                                <span className="text-rose-600">₩ {calculation.taxDeduction.toLocaleString()}원</span>
                            </div>
                        </div>
                    </div>

                    {/* 수임 완료 사건 세부 내역 */}
                    <div className="border border-gray-200 dark:border-gray-700 rounded-xl overflow-hidden">
                        <div className="px-4 py-2 bg-gray-50 dark:bg-gray-750 text-xs font-bold text-gray-700 dark:text-gray-300 flex justify-between">
                            <span>수임 완료 계약 세부 명세 ({contractItems.length}건)</span>
                            <span className="text-[11px] text-gray-400 font-normal">
                                투명한 건당 인센티브 산출 내역
                            </span>
                        </div>
                        <div className="max-h-48 overflow-y-auto">
                            <table className="w-full text-left text-xs">
                                <thead className="bg-gray-50/50 dark:bg-gray-800 text-gray-400 sticky top-0">
                                    <tr className="border-b border-gray-100 dark:border-gray-700">
                                        <th className="py-2 px-3">#</th>
                                        <th className="py-2 px-3">고객명</th>
                                        <th className="py-2 px-3">사건종류</th>
                                        <th className="py-2 px-3 text-center">계약일자</th>
                                        <th className="py-2 px-3 text-right">수임료</th>
                                        <th className="py-2 px-3 text-right font-bold text-indigo-600">건당 인센티브</th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-gray-100 dark:divide-gray-700">
                                    {contractItems.map((it, idx) => (
                                        <tr key={it.caseId} className="hover:bg-gray-50 dark:hover:bg-gray-750">
                                            <td className="py-2 px-3 text-gray-400">{idx + 1}</td>
                                            <td className="py-2 px-3 font-semibold text-gray-800 dark:text-gray-200">{it.customerName}</td>
                                            <td className="py-2 px-3 text-gray-600 dark:text-gray-400">{it.caseType}</td>
                                            <td className="py-2 px-3 text-center text-gray-500">{it.contractAt}</td>
                                            <td className="py-2 px-3 text-right text-gray-600">{it.contractFee}만원</td>
                                            <td className="py-2 px-3 text-right font-bold text-indigo-600 dark:text-indigo-400">
                                                ₩ {it.incentiveFee.toLocaleString()}원
                                            </td>
                                        </tr>
                                    ))}
                                    {contractItems.length === 0 && (
                                        <tr>
                                            <td colSpan={6} className="py-6 text-center text-gray-400">
                                                해당 월 수임 완료 사건이 없습니다.
                                            </td>
                                        </tr>
                                    )}
                                </tbody>
                            </table>
                        </div>
                    </div>
                </div>

                {/* 하단 푸터 액션 버튼 */}
                <div className="p-4 border-t border-gray-100 dark:border-gray-700 bg-gray-50 dark:bg-gray-800/80 flex flex-col sm:flex-row items-center justify-between gap-3 no-print">
                    <span className="text-xs text-gray-400 flex items-center">
                        <ShieldCheck size={14} className="mr-1 text-emerald-500" />
                        복사된 양식은 카카오톡 또는 문자로 1초 전송 가능합니다.
                    </span>

                    <div className="flex items-center gap-2 w-full sm:w-auto">
                        <button
                            type="button"
                            onClick={handlePrint}
                            className="px-3 py-2 rounded-xl border border-gray-300 dark:border-gray-600 text-xs font-bold text-gray-700 dark:text-gray-300 hover:bg-gray-100 flex items-center gap-1"
                        >
                            <Printer size={13} /> 인쇄
                        </button>
                        <button
                            type="button"
                            onClick={handleDownloadExcel}
                            className="px-3 py-2 rounded-xl border border-gray-300 dark:border-gray-600 text-xs font-bold text-gray-700 dark:text-gray-300 hover:bg-gray-100 flex items-center gap-1"
                        >
                            <Download size={13} /> 엑셀
                        </button>
                        <button
                            type="button"
                            onClick={handleCopy}
                            className="px-4 py-2 rounded-xl bg-emerald-600 text-white text-xs font-bold hover:bg-emerald-700 shadow-sm flex items-center gap-1.5 transition-all"
                        >
                            {copied ? (
                                <>
                                    <Check size={14} />
                                    <span>복사 완료!</span>
                                </>
                            ) : (
                                <>
                                    <Copy size={14} />
                                    <span>카카오톡 양식 복사</span>
                                </>
                            )}
                        </button>
                    </div>
                </div>
            </motion.div>
        </div>
    );
};
