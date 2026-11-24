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
        <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-5 bg-background/80 backdrop-blur-xs animate-in fade-in duration-200 overflow-y-auto">
            <motion.div
                initial={{ opacity: 0, scale: 0.95 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0, scale: 0.95 }}
                className="relative w-full max-w-3xl max-h-[88vh] my-auto flex flex-col rounded-2xl bg-card border border-border shadow-2xl overflow-hidden text-card-foreground"
            >
                {/* 헤더 */}
                <div className="p-4 sm:p-5 border-b border-border flex items-center justify-between bg-card shrink-0">
                    <div className="flex items-center gap-3">
                        <div className="w-10 h-10 rounded-xl bg-primary/10 border border-primary/20 text-primary flex items-center justify-center font-bold shrink-0">
                            <FileText size={20} />
                        </div>
                        <div>
                            <h3 className="text-base sm:text-lg font-bold text-foreground flex items-center gap-2">
                                <span>{partner.name}</span>
                                <span className="text-xs px-2.5 py-0.5 rounded-full bg-primary/15 text-primary border border-primary/20 font-semibold">
                                    B2B 정산 청구서
                                </span>
                            </h3>
                            <p className="text-xs text-muted-foreground">
                                {periodLabel} 수임 완료 {items.length}건 / TM 수령 인센티브 정산
                            </p>
                        </div>
                    </div>
                    <button
                        onClick={onClose}
                        className="p-1.5 text-muted-foreground hover:text-foreground rounded-lg hover:bg-muted transition-colors cursor-pointer"
                        title="청구서 닫기"
                    >
                        <X size={18} />
                    </button>
                </div>

                {/* 본문 (스크롤) */}
                <div className="flex-1 overflow-y-auto p-5 sm:p-6 space-y-5 custom-scrollbar text-xs sm:text-sm">
                    {/* 부가세 설정 바 */}
                    <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between p-3.5 bg-muted/40 rounded-xl border border-border gap-3">
                        <span className="text-xs font-bold text-foreground">
                            세금계산서 부가세(VAT) 모드:
                        </span>
                        <div className="flex items-center gap-1.5 bg-card p-1 rounded-lg border border-border text-xs">
                            {[
                                { mode: 'separate', label: '별도 (+10%)' },
                                { mode: 'included', label: '포함' },
                                { mode: 'none', label: '면세/없음' }
                            ].map(v => (
                                <button
                                    key={v.mode}
                                    type="button"
                                    onClick={() => setVatMode(v.mode as any)}
                                    className={`px-3 py-1.5 rounded-md font-bold transition-all cursor-pointer ${
                                        vatMode === v.mode
                                            ? 'bg-primary text-primary-foreground shadow-2xs'
                                            : 'text-muted-foreground hover:text-foreground hover:bg-muted'
                                    }`}
                                >
                                    {v.label}
                                </button>
                            ))}
                        </div>
                    </div>

                    {/* 금액 요약 카드 3단 */}
                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                        <div className="p-4 bg-muted/30 rounded-xl border border-border">
                            <span className="text-xs font-semibold text-muted-foreground block mb-1">총 수임료 합계</span>
                            <span className="text-lg font-bold text-foreground">
                                ₩ {totalContractFee.toLocaleString()} <span className="text-xs font-normal">만원</span>
                            </span>
                        </div>
                        <div className="p-4 bg-primary/5 rounded-xl border border-primary/20">
                            <span className="text-xs font-semibold text-primary block mb-1">인센티브 공급가액</span>
                            <span className="text-lg font-bold text-primary">
                                ₩ {totalIncentive.toLocaleString()} <span className="text-xs font-normal">만원</span>
                            </span>
                        </div>
                        <div className="p-4 bg-emerald-500/10 rounded-xl border border-emerald-500/30">
                            <span className="text-xs font-bold text-emerald-400 block mb-1">최종 청구 총액</span>
                            <span className="text-xl font-black text-emerald-400">
                                ₩ {totalBilled.toLocaleString()} <span className="text-xs font-semibold">만원</span>
                            </span>
                        </div>
                    </div>

                    {/* 수임 사건 상세 리스트 */}
                    <div className="border border-border rounded-xl overflow-hidden bg-card">
                        <div className="px-4 py-2.5 bg-muted/50 border-b border-border text-xs font-bold text-foreground flex justify-between items-center">
                            <span>정산 대상 수임 완료 내역 ({items.length}건)</span>
                            <span className="text-xs font-normal text-muted-foreground">
                                요율: {partner.incentiveType === 'fixed' ? `건당 ${partner.incentiveFixedAmount || 50}만` : `${partner.incentiveRate || 30}%`}
                            </span>
                        </div>
                        <div className="max-h-60 overflow-y-auto custom-scrollbar">
                            <table className="w-full text-left text-xs">
                                <thead className="bg-muted/40 text-muted-foreground sticky top-0 border-b border-border">
                                    <tr>
                                        <th className="py-2 px-3 text-center w-12">#</th>
                                        <th className="py-2 px-3">고객명</th>
                                        <th className="py-2 px-3">사건종류</th>
                                        <th className="py-2 px-3 text-center">계약일</th>
                                        <th className="py-2 px-3 text-right">수임료</th>
                                        <th className="py-2 px-3 text-right font-bold text-primary">TM 인센티브</th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-border/60">
                                    {items.map((it) => (
                                        <tr key={it.caseId} className="hover:bg-muted/30 transition-colors">
                                            <td className="py-2 px-3 text-center text-muted-foreground font-medium">{it.no}</td>
                                            <td className="py-2 px-3 font-semibold text-foreground">{it.customerName}</td>
                                            <td className="py-2 px-3 text-muted-foreground">{it.caseType}</td>
                                            <td className="py-2 px-3 text-center text-muted-foreground">{it.contractAt}</td>
                                            <td className="py-2 px-3 text-right text-foreground font-medium">{it.contractFee.toLocaleString()}만원</td>
                                            <td className="py-2 px-3 text-right font-bold text-primary">{it.incentiveFee.toLocaleString()}만원</td>
                                        </tr>
                                    ))}
                                    {items.length === 0 && (
                                        <tr>
                                            <td colSpan={6} className="py-8 text-center text-muted-foreground">
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
                <div className="p-4 border-t border-border bg-card flex flex-col sm:flex-row items-center justify-between gap-3 shrink-0">
                    <span className="text-xs text-muted-foreground flex items-center">
                        <ShieldCheck size={14} className="mr-1 text-primary shrink-0" />
                        복사된 양식은 카카오톡이나 문자에 그대로 붙여넣어 전송할 수 있습니다.
                    </span>
                    <div className="flex items-center gap-2 w-full sm:w-auto justify-end">
                        <button
                            type="button"
                            onClick={handleDownloadExcel}
                            disabled={items.length === 0}
                            className="flex-1 sm:flex-none px-4 py-2.5 rounded-xl border border-border bg-secondary text-foreground text-xs font-bold hover:bg-muted flex items-center justify-center gap-1.5 transition-colors disabled:opacity-40 cursor-pointer shadow-2xs"
                        >
                            <Download size={14} /> 엑셀 다운로드
                        </button>
                        <button
                            type="button"
                            onClick={handleCopy}
                            disabled={items.length === 0}
                            className="flex-1 sm:flex-none px-5 py-2.5 rounded-xl bg-primary text-primary-foreground text-xs font-bold hover:bg-primary/90 flex items-center justify-center gap-1.5 shadow-2xs transition-all disabled:opacity-40 cursor-pointer"
                        >
                            {copied ? (
                                <>
                                    <Check size={14} className="text-primary-foreground" />
                                    <span>클립보드 복사 완료!</span>
                                </>
                            ) : (
                                <>
                                    <Copy size={14} />
                                    <span>카카오톡 양식 복사</span>
                                </>
                            )}
                        </button>
                        <button
                            type="button"
                            onClick={onClose}
                            className="flex-1 sm:flex-none px-4 py-2.5 rounded-xl border border-border bg-secondary hover:bg-muted text-foreground text-xs font-bold transition-colors cursor-pointer shadow-2xs"
                        >
                            닫기
                        </button>
                    </div>
                </div>
            </motion.div>
        </div>
    );
};
