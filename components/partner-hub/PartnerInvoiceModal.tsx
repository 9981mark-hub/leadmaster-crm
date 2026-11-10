import React, { useState, useMemo } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { 
    X, Copy, Check, Download, Building2, Calendar, 
    DollarSign, FileText, CheckCircle2, AlertCircle, ShieldCheck 
} from 'lucide-react';
import { Partner, Case } from '../../types';
import { calculatePartnerIncentive } from '../../utils';
import * as XLSX from 'xlsx';
import { sanitizeRowData } from '../../utils/xlsxExport';

interface PartnerInvoiceModalProps {
    isOpen: boolean;
    onClose: () => void;
    partner: Partner;
    cases: Case[];
    periodLabel: string;
    orgName?: string;
    bankInfo?: {
        bankName?: string;
        accountNumber?: string;
        accountHolder?: string;
    };
}

export const PartnerInvoiceModal: React.FC<PartnerInvoiceModalProps> = ({
    isOpen,
    onClose,
    partner,
    cases,
    periodLabel,
    orgName = '리드마스터 CRM',
    bankInfo
}) => {
    const [vatMode, setVatMode] = useState<'separate' | 'included' | 'none'>(partner.vatMode || 'separate');
    const [copied, setCopied] = useState(false);

    // 정산 대상 수임 완료 케이스 및 인센티브 집계
    const items = useMemo(() => {
        return cases
            .filter(c => c.contractAt && (c.contractFee || 0) > 0)
            .map((c, idx) => {
                const incentive = c.expectedIncentiveFee ?? calculatePartnerIncentive(c.contractFee || 0, c.caseType, partner).amount;
                return {
                    no: idx + 1,
                    caseId: c.caseId,
                    customerName: c.customerName,
                    caseType: c.contractType || c.caseType || '개인회생',
                    contractAt: c.contractAt || '-',
                    contractFee: c.contractFee || 0,
                    incentiveFee: incentive,
                    incentiveStatus: c.incentiveStatus || 'unpaid',
                    paidAt: c.incentivePaidAt || '-'
                };
            });
    }, [cases, partner]);

    const totalContractFee = useMemo(() => items.reduce((s, i) => s + i.contractFee, 0), [items]);
    const totalIncentive = useMemo(() => items.reduce((s, i) => s + i.incentiveFee, 0), [items]);

    // 부가세 계산
    const { vatAmount, totalBilled } = useMemo(() => {
        if (vatMode === 'separate') {
            const vat = Math.round(totalIncentive * 0.1 * 10) / 10;
            return { vatAmount: vat, totalBilled: Math.round((totalIncentive + vat) * 10) / 10 };
        } else if (vatMode === 'included') {
            const supply = Math.round((totalIncentive / 1.1) * 10) / 10;
            return { vatAmount: Math.round((totalIncentive - supply) * 10) / 10, totalBilled: totalIncentive };
        }
        return { vatAmount: 0, totalBilled: totalIncentive };
    }, [totalIncentive, vatMode]);

    if (!isOpen) return null;

    // 카카오톡/문자 양식 생성
    const generateInvoiceText = () => {
        const lines: string[] = [];
        lines.push(`━━━━━━━━━━━━━━━━━━━━━━━━━━━━`);
        lines.push(`📋 [${orgName} ➔ ${partner.name}]`);
        lines.push(`   ${periodLabel} B2B 인센티브 정산 청구서`);
        lines.push(`━━━━━━━━━━━━━━━━━━━━━━━━━━━━`);
        lines.push(`• 정산 대상: 총 ${items.length}건 수임 완료`);
        lines.push(`• 총 수임료 합계: ₩ ${totalContractFee.toLocaleString()} 만원`);
        lines.push(`• 인센티브 계산 방식: ${partner.incentiveType === 'fixed' ? `건당 ${partner.incentiveFixedAmount || 50}만원` : `${partner.incentiveRate || 30}% 정률`}`);
        lines.push(`────────────────────────────`);
        lines.push(`[수임 사건 상세 내역]`);
        items.forEach((it) => {
            lines.push(`${it.no}. ${it.customerName} (${it.caseType}) / 수임료: ${it.contractFee}만 ➔ 수수료: ${it.incentiveFee}만원`);
        });
        lines.push(`────────────────────────────`);
        if (vatMode === 'separate') {
            lines.push(`• 공급가액: ₩ ${totalIncentive.toLocaleString()} 만원`);
            lines.push(`• 부가세(10%): ₩ ${vatAmount.toLocaleString()} 만원`);
            lines.push(`• 최종 청구합계: ₩ ${totalBilled.toLocaleString()} 만원 (VAT 별도)`);
        } else if (vatMode === 'included') {
            lines.push(`• 최종 청구합계: ₩ ${totalBilled.toLocaleString()} 만원 (VAT 포함)`);
        } else {
            lines.push(`• 최종 청구합계: ₩ ${totalBilled.toLocaleString()} 만원`);
        }
        lines.push(`────────────────────────────`);
        if (bankInfo?.bankName && bankInfo?.accountNumber) {
            lines.push(`• 입금 계좌: ${bankInfo.bankName} ${bankInfo.accountNumber}`);
            lines.push(`• 예금주: ${bankInfo.accountHolder || orgName}`);
        } else if (partner.bankInfo?.bankName) {
            lines.push(`• 입금 계좌: ${partner.bankInfo.bankName} ${partner.bankInfo.accountNumber} (${partner.bankInfo.accountHolder})`);
        }
        lines.push(`━━━━━━━━━━━━━━━━━━━━━━━━━━━━`);
        lines.push(`※ 세금계산서 발행 및 입금 확인 후 회신 부탁드립니다. 감사합니다.`);
        return lines.join('\n');
    };

    const handleCopy = async () => {
        const text = generateInvoiceText();
        await navigator.clipboard.writeText(text);
        setCopied(true);
        setTimeout(() => setCopied(false), 2500);
    };

    const handleDownloadExcel = () => {
        const exportRows = items.map(it => sanitizeRowData({
            '순번': it.no,
            '고객명': it.customerName,
            '사건종류': it.caseType,
            '수임일자': it.contractAt,
            '총수임료(만원)': it.contractFee,
            'TM인센티브(만원)': it.incentiveFee,
            '정산상태': it.incentiveStatus === 'paid' ? '입금완료' : '미수금',
            '입금확인일': it.paidAt
        }));

        const ws = XLSX.utils.json_to_sheet(exportRows);
        const wb = XLSX.utils.book_new();
        XLSX.utils.book_append_sheet(wb, ws, '인센티브정산');
        XLSX.writeFile(wb, `[정산청구서]_${partner.name}_${periodLabel}.xlsx`);
    };

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
            <motion.div
                initial={{ opacity: 0, scale: 0.95 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0, scale: 0.95 }}
                className="bg-white dark:bg-gray-800 rounded-2xl shadow-2xl border border-gray-200 dark:border-gray-700 w-full max-w-3xl max-h-[90vh] flex flex-col overflow-hidden"
            >
                {/* 헤더 */}
                <div className="p-5 border-b border-gray-100 dark:border-gray-700 flex items-center justify-between bg-slate-50 dark:bg-gray-800/80">
                    <div className="flex items-center gap-3">
                        <div className="w-10 h-10 rounded-xl bg-indigo-100 dark:bg-indigo-950/60 text-indigo-600 dark:text-indigo-400 flex items-center justify-center font-bold">
                            <FileText size={20} />
                        </div>
                        <div>
                            <h3 className="text-lg font-bold text-gray-900 dark:text-white flex items-center gap-2">
                                <span>{partner.name}</span>
                                <span className="text-xs px-2.5 py-0.5 rounded-full bg-indigo-50 text-indigo-700 dark:bg-indigo-900/50 dark:text-indigo-300 font-semibold">
                                    B2B 정산 청구서
                                </span>
                            </h3>
                            <p className="text-xs text-gray-500 dark:text-gray-400">
                                {periodLabel} 수임 완료 {items.length}건 / TM 수령 인센티브 정산
                            </p>
                        </div>
                    </div>
                    <button
                        onClick={onClose}
                        className="p-1.5 text-gray-400 hover:text-gray-600 dark:hover:text-gray-200 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors"
                    >
                        <X size={20} />
                    </button>
                </div>

                {/* 본문 (스크롤) */}
                <div className="p-6 overflow-y-auto space-y-5">
                    {/* 부가세 설정 바 */}
                    <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between p-3.5 bg-gray-50 dark:bg-gray-750 rounded-xl border border-gray-200 dark:border-gray-700 gap-3">
                        <span className="text-xs font-bold text-gray-700 dark:text-gray-300">
                            세금계산서 부가세(VAT) 모드:
                        </span>
                        <div className="flex items-center gap-1.5 bg-white dark:bg-gray-800 p-1 rounded-lg border border-gray-200 dark:border-gray-700 text-xs">
                            {[
                                { mode: 'separate', label: '별도 (+10%)' },
                                { mode: 'included', label: '포함' },
                                { mode: 'none', label: '면세/없음' }
                            ].map(v => (
                                <button
                                    key={v.mode}
                                    type="button"
                                    onClick={() => setVatMode(v.mode as any)}
                                    className={`px-3 py-1.5 rounded-md font-bold transition-all ${
                                        vatMode === v.mode
                                            ? 'bg-indigo-600 text-white shadow-sm'
                                            : 'text-gray-600 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700'
                                    }`}
                                >
                                    {v.label}
                                </button>
                            ))}
                        </div>
                    </div>

                    {/* 금액 요약 카드 3단 */}
                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                        <div className="p-4 bg-slate-50 dark:bg-gray-750 rounded-xl border border-gray-200 dark:border-gray-700">
                            <span className="text-xs font-semibold text-gray-500 dark:text-gray-400 block mb-1">총 수임료 합계</span>
                            <span className="text-lg font-bold text-gray-800 dark:text-gray-100">
                                ₩ {totalContractFee.toLocaleString()} <span className="text-xs font-normal">만원</span>
                            </span>
                        </div>
                        <div className="p-4 bg-indigo-50/70 dark:bg-indigo-950/30 rounded-xl border border-indigo-100 dark:border-indigo-900/40">
                            <span className="text-xs font-semibold text-indigo-700 dark:text-indigo-300 block mb-1">인센티브 공급가액</span>
                            <span className="text-lg font-bold text-indigo-700 dark:text-indigo-300">
                                ₩ {totalIncentive.toLocaleString()} <span className="text-xs font-normal">만원</span>
                            </span>
                        </div>
                        <div className="p-4 bg-emerald-50/80 dark:bg-emerald-950/40 rounded-xl border border-emerald-200 dark:border-emerald-800">
                            <span className="text-xs font-bold text-emerald-800 dark:text-emerald-300 block mb-1">최종 청구 총액</span>
                            <span className="text-xl font-black text-emerald-600 dark:text-emerald-400">
                                ₩ {totalBilled.toLocaleString()} <span className="text-xs font-semibold">만원</span>
                            </span>
                        </div>
                    </div>

                    {/* 수임 사건 상세 리스트 */}
                    <div className="border border-gray-200 dark:border-gray-700 rounded-xl overflow-hidden">
                        <div className="px-4 py-2.5 bg-gray-50 dark:bg-gray-700/60 border-b border-gray-200 dark:border-gray-700 text-xs font-bold text-gray-600 dark:text-gray-300 flex justify-between items-center">
                            <span>정산 대상 수임 완료 내역 ({items.length}건)</span>
                            <span className="text-[11px] font-normal text-gray-400">
                                요율: {partner.incentiveType === 'fixed' ? `건당 ${partner.incentiveFixedAmount || 50}만` : `${partner.incentiveRate || 30}%`}
                            </span>
                        </div>
                        <div className="max-h-60 overflow-y-auto">
                            <table className="w-full text-left text-xs">
                                <thead className="bg-gray-50/40 dark:bg-gray-800 text-gray-500 sticky top-0">
                                    <tr className="border-b border-gray-100 dark:border-gray-700">
                                        <th className="py-2 px-3 text-center w-12">#</th>
                                        <th className="py-2 px-3">고객명</th>
                                        <th className="py-2 px-3">사건종류</th>
                                        <th className="py-2 px-3 text-center">계약일</th>
                                        <th className="py-2 px-3 text-right">수임료</th>
                                        <th className="py-2 px-3 text-right font-bold text-indigo-600 dark:text-indigo-400">TM 인센티브</th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-gray-100 dark:divide-gray-700">
                                    {items.map((it) => (
                                        <tr key={it.caseId} className="hover:bg-gray-50/60 dark:hover:bg-gray-700/30">
                                            <td className="py-2 px-3 text-center text-gray-400 font-medium">{it.no}</td>
                                            <td className="py-2 px-3 font-semibold text-gray-800 dark:text-gray-200">{it.customerName}</td>
                                            <td className="py-2 px-3 text-gray-600 dark:text-gray-400">{it.caseType}</td>
                                            <td className="py-2 px-3 text-center text-gray-500">{it.contractAt}</td>
                                            <td className="py-2 px-3 text-right text-gray-700 dark:text-gray-300 font-medium">{it.contractFee.toLocaleString()}만원</td>
                                            <td className="py-2 px-3 text-right font-bold text-indigo-600 dark:text-indigo-400">{it.incentiveFee.toLocaleString()}만원</td>
                                        </tr>
                                    ))}
                                    {items.length === 0 && (
                                        <tr>
                                            <td colSpan={6} className="py-8 text-center text-gray-400">
                                                해당 기간에 수임 완료된 케이스가 없습니다.
                                            </td>
                                        </tr>
                                    )}
                                </tbody>
                            </table>
                        </div>
                    </div>
                </div>

                {/* 푸터 액션 */}
                <div className="p-4 border-t border-gray-100 dark:border-gray-700 bg-gray-50 dark:bg-gray-800/80 flex flex-col sm:flex-row items-center justify-between gap-3">
                    <span className="text-xs text-gray-500 dark:text-gray-400 flex items-center">
                        <ShieldCheck size={14} className="mr-1 text-emerald-500" />
                        복사된 양식은 카카오톡이나 문자에 그대로 붙여넣어 전송할 수 있습니다.
                    </span>
                    <div className="flex items-center gap-2 w-full sm:w-auto">
                        <button
                            type="button"
                            onClick={handleDownloadExcel}
                            disabled={items.length === 0}
                            className="flex-1 sm:flex-none px-4 py-2.5 rounded-xl border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-700 dark:text-gray-200 text-xs font-bold hover:bg-gray-50 dark:hover:bg-gray-600 flex items-center justify-center gap-1.5 transition-colors disabled:opacity-40"
                        >
                            <Download size={14} /> 엑셀 다운로드
                        </button>
                        <button
                            type="button"
                            onClick={handleCopy}
                            disabled={items.length === 0}
                            className="flex-1 sm:flex-none px-5 py-2.5 rounded-xl bg-indigo-600 text-white text-xs font-bold hover:bg-indigo-700 flex items-center justify-center gap-1.5 shadow-sm transition-all disabled:opacity-40"
                        >
                            {copied ? (
                                <>
                                    <Check size={14} className="text-emerald-300" />
                                    <span>클립보드 복사 완료!</span>
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
