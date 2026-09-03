import React, { useState, useMemo } from 'react';
import { Sparkles, FileText, Copy, ChevronDown, ChevronUp, UserCheck, Home, CreditCard, MessageSquare, Phone } from 'lucide-react';
import { Case } from '../../types';
import { extractBriefingFromSummary, CustomerBriefingData } from '../../utils';

interface CaseBriefingBannerProps {
    c: Case;
    aiSummaryText: string | null;
    showToast: (msg: string, type?: 'success' | 'error') => void;
}

export const CaseBriefingBanner: React.FC<CaseBriefingBannerProps> = ({
    c,
    aiSummaryText,
    showToast
}) => {
    // Accordion expand/collapse state (stored in localStorage, default collapsed for clean layout)
    const [isExpanded, setIsExpanded] = useState<boolean>(() => {
        const saved = localStorage.getItem('lm_briefing_expanded');
        return saved !== null ? saved === 'true' : false; // Default collapsed
    });

    const toggleExpanded = () => {
        const next = !isExpanded;
        setIsExpanded(next);
        localStorage.setItem('lm_briefing_expanded', String(next));
    };

    // Extract briefing data (prioritize AI summary, fallback to CRM case fields)
    const data: CustomerBriefingData = useMemo(() => {
        return extractBriefingFromSummary(aiSummaryText, c);
    }, [aiSummaryText, c]);

    // Copy formatted briefing text to clipboard
    const handleCopyBriefing = (e: React.MouseEvent) => {
        e.stopPropagation();
        const copyText = `* 고객이름 : ${data.customerName}
* 연락처 : ${data.phone}
* 출생년도 : ${data.birthYear}
* 성별 : ${data.gender}
* 거주지역 : ${data.region}
* 직업 : ${data.job}
* 4대보험 가입유무 : ${data.insurance4}
* 결혼유무 : ${data.maritalStatus}
* 미성년 자녀 수 : ${data.childrenCount}
* 월 세후소득 (실급여) : ${data.income}
* 월 대출납입금 : ${data.loanMonthlyPay}
* 거주 형태 : ${data.housingType}
* 보증금, 월세 : ${data.depositRent}
* 자산 : ${data.assets}
* 신용 대출 : ${data.creditLoan}
* 담보 대출 (차량 /집/토지 등) : ${data.collateralLoan}
* 신용카드 사용유무 : ${data.creditCardUse}
* 개인회생 / 파산 / 회복 이력 : ${data.history}
* 특이사항 :
${data.specialMemo || '없음'}`;

        navigator.clipboard.writeText(copyText);
        showToast('고객 상황 및 채무 브리핑이 복사되었습니다.', 'success');
    };

    return (
        <div className="bg-white dark:bg-gray-800 rounded-xl border border-indigo-200 dark:border-indigo-900/60 shadow-xs overflow-hidden transition-all">
            {/* Header Toolbar */}
            <div
                onClick={toggleExpanded}
                className="px-4 py-2.5 bg-gradient-to-r from-slate-50 via-indigo-50/40 to-slate-50 dark:from-gray-800 dark:via-indigo-950/20 dark:to-gray-800 border-b border-indigo-100 dark:border-indigo-900/40 flex items-center justify-between cursor-pointer select-none gap-2"
            >
                <div className="flex items-center gap-2 flex-wrap">
                    <span className="font-bold text-slate-800 dark:text-gray-100 text-sm flex items-center gap-1.5">
                        <span className="text-base">📋</span>
                        고객 종합 브리핑
                        <span className="text-xs font-normal text-slate-500 dark:text-gray-400">(상황 및 채무 요약)</span>
                    </span>

                    {/* Data Source Badge */}
                    {data.isAiSource ? (
                        <span className="bg-purple-100 text-purple-700 dark:bg-purple-950/60 dark:text-purple-300 text-[11px] font-bold px-2 py-0.5 rounded-full flex items-center gap-1 border border-purple-200 dark:border-purple-800">
                            <Sparkles size={11} className="text-purple-600 dark:text-purple-400" />
                            AI 통화 분석 기반
                        </span>
                    ) : (
                        <span className="bg-blue-50 text-blue-700 dark:bg-blue-950/60 dark:text-blue-300 text-[11px] font-bold px-2 py-0.5 rounded-full flex items-center gap-1 border border-blue-200 dark:border-blue-800">
                            <FileText size={11} className="text-blue-500 dark:text-blue-400" />
                            CRM 입력 데이터 기반
                        </span>
                    )}
                </div>

                <div className="flex items-center gap-2">
                    <button
                        type="button"
                        onClick={handleCopyBriefing}
                        className="px-2.5 py-1 text-xs font-bold text-slate-700 dark:text-gray-200 bg-white dark:bg-gray-700 hover:bg-slate-100 dark:hover:bg-gray-600 border border-slate-300 dark:border-gray-600 rounded-lg shadow-2xs flex items-center gap-1 transition-all active:scale-95"
                        title="브리핑 전체 텍스트 복사"
                    >
                        <Copy size={13} className="text-slate-500 dark:text-gray-300" />
                        <span className="hidden sm:inline">브리핑 복사</span>
                    </button>

                    <button
                        type="button"
                        className="p-1 rounded-lg hover:bg-slate-200/60 dark:hover:bg-gray-700 text-slate-600 dark:text-gray-300 transition-colors"
                        aria-label={isExpanded ? '접기' : '펼치기'}
                    >
                        {isExpanded ? <ChevronUp size={18} /> : <ChevronDown size={18} />}
                    </button>
                </div>
            </div>

            {/* Compact Summary View (When collapsed) */}
            {!isExpanded && (
                <div
                    onClick={toggleExpanded}
                    className="px-4 py-2 text-xs text-slate-600 dark:text-gray-300 flex items-center justify-between cursor-pointer hover:bg-slate-50/50 dark:hover:bg-gray-750 gap-2 flex-wrap"
                >
                    <div className="flex items-center gap-2 flex-wrap font-medium">
                        <span className="font-bold text-slate-900 dark:text-white">{data.customerName}</span>
                        <span className="text-slate-400">({data.gender}, {data.birthYear}, {data.region})</span>
                        <span className="text-slate-300 dark:text-gray-600">|</span>
                        <span>직업: <b className="text-slate-800 dark:text-gray-200">{data.job}</b></span>
                        <span className="text-slate-400">(실급여: {data.income})</span>
                        <span className="text-slate-300 dark:text-gray-600">|</span>
                        <span>주거: <b className="text-slate-800 dark:text-gray-200">{data.housingType}</b></span>
                        <span className="text-slate-400">({data.depositRent})</span>
                        <span className="text-slate-300 dark:text-gray-600">|</span>
                        <span>신용대출: <b className="text-rose-600 dark:text-rose-400">{data.creditLoan}</b></span>
                        <span className="text-slate-400">({data.loanMonthlyPay})</span>
                    </div>
                    <span className="text-[11px] text-blue-600 dark:text-blue-400 font-semibold shrink-0">
                        상세 보기 ▼
                    </span>
                </div>
            )}

            {/* Expanded Detailed Grid (When expanded) */}
            {isExpanded && (
                <div className="p-3.5 md:p-4 grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-3 bg-white dark:bg-gray-800">
                    
                    {/* SECTION 1: 인적 및 직업/가족 */}
                    <div className="bg-slate-50/80 dark:bg-gray-900/40 rounded-xl p-3 border border-slate-200/80 dark:border-gray-700/60 flex flex-col gap-2">
                        <div className="flex items-center gap-1.5 text-blue-700 dark:text-blue-400 font-bold text-xs pb-1.5 border-b border-slate-200 dark:border-gray-700">
                            <UserCheck size={14} />
                            <span>1. 인적 및 직업/가족</span>
                        </div>
                        <div className="space-y-1 text-xs">
                            <div className="flex justify-between items-center py-0.5">
                                <span className="text-slate-500 dark:text-gray-400 text-[11px]">고객이름</span>
                                <span className="font-bold text-slate-800 dark:text-gray-100">{data.customerName}</span>
                            </div>
                            <div className="flex justify-between items-center py-0.5">
                                <span className="text-slate-500 dark:text-gray-400 text-[11px]">연락처</span>
                                <span className="font-bold text-blue-600 dark:text-blue-400 font-mono flex items-center gap-1">
                                    <Phone size={11} className="text-emerald-500" />
                                    {data.phone}
                                </span>
                            </div>
                            <div className="flex justify-between items-center py-0.5">
                                <span className="text-slate-500 dark:text-gray-400 text-[11px]">출생년도 / 성별</span>
                                <span className="text-slate-800 dark:text-gray-200 font-medium">{data.birthYear} ({data.gender})</span>
                            </div>
                            <div className="flex justify-between items-center py-0.5">
                                <span className="text-slate-500 dark:text-gray-400 text-[11px]">거주지역</span>
                                <span className="text-slate-800 dark:text-gray-200 font-medium">{data.region}</span>
                            </div>
                            <div className="flex justify-between items-center py-0.5">
                                <span className="text-slate-500 dark:text-gray-400 text-[11px]">직업</span>
                                <span className="font-bold text-slate-800 dark:text-gray-100 bg-white dark:bg-gray-800 px-1.5 py-0.5 rounded border border-slate-200 dark:border-gray-700">{data.job}</span>
                            </div>
                            <div className="flex justify-between items-center py-0.5">
                                <span className="text-slate-500 dark:text-gray-400 text-[11px]">4대보험 가입유무</span>
                                <span className={`font-semibold ${data.insurance4.includes('가입') ? 'text-blue-600 dark:text-blue-400' : 'text-slate-600 dark:text-gray-300'}`}>{data.insurance4}</span>
                            </div>
                            <div className="flex justify-between items-center py-0.5">
                                <span className="text-slate-500 dark:text-gray-400 text-[11px]">결혼 / 미성년 자녀</span>
                                <span className="text-slate-800 dark:text-gray-200">{data.maritalStatus} / 자녀 {data.childrenCount}</span>
                            </div>
                        </div>
                    </div>

                    {/* SECTION 2: 소득 및 주거 환경 */}
                    <div className="bg-slate-50/80 dark:bg-gray-900/40 rounded-xl p-3 border border-slate-200/80 dark:border-gray-700/60 flex flex-col gap-2">
                        <div className="flex items-center gap-1.5 text-emerald-700 dark:text-emerald-400 font-bold text-xs pb-1.5 border-b border-slate-200 dark:border-gray-700">
                            <Home size={14} />
                            <span>2. 소득 및 주거 환경</span>
                        </div>
                        <div className="space-y-1.5 text-xs">
                            <div className="bg-emerald-50/60 dark:bg-emerald-950/30 p-2 rounded-lg border border-emerald-100 dark:border-emerald-900/40">
                                <span className="text-slate-500 dark:text-gray-400 text-[11px] block mb-0.5">월 세후소득 (실급여)</span>
                                <div className="font-bold text-emerald-700 dark:text-emerald-300 text-sm">
                                    {data.income}
                                </div>
                            </div>
                            <div className="flex justify-between items-center py-0.5">
                                <span className="text-slate-500 dark:text-gray-400 text-[11px]">거주 형태</span>
                                <span className="font-bold text-slate-800 dark:text-gray-100 bg-white dark:bg-gray-800 px-1.5 py-0.5 rounded border border-slate-200 dark:border-gray-700">{data.housingType}</span>
                            </div>
                            <div className="py-0.5">
                                <span className="text-slate-500 dark:text-gray-400 text-[11px] block mb-0.5">보증금, 월세</span>
                                <p className="text-slate-800 dark:text-gray-200 font-medium leading-snug bg-white dark:bg-gray-800 p-1.5 rounded border border-slate-200 dark:border-gray-700 text-[11px]">
                                    {data.depositRent}
                                </p>
                            </div>
                        </div>
                    </div>

                    {/* SECTION 3: 채무 및 자산 현황 (Core Priority) */}
                    <div className="bg-rose-50/40 dark:bg-rose-950/20 rounded-xl p-3 border border-rose-200/70 dark:border-rose-900/50 flex flex-col gap-2">
                        <div className="flex items-center gap-1.5 text-rose-700 dark:text-rose-400 font-bold text-xs pb-1.5 border-b border-rose-100 dark:border-rose-900/40">
                            <CreditCard size={14} />
                            <span>3. 채무 및 자산 현황</span>
                        </div>
                        <div className="space-y-1.5 text-xs">
                            <div>
                                <span className="text-slate-500 dark:text-gray-400 text-[11px] block mb-0.5">신용 대출</span>
                                <p className="font-bold text-rose-700 dark:text-rose-300 leading-snug bg-white dark:bg-gray-800 p-1.5 rounded border border-rose-200 dark:border-rose-900/50 text-[11px]">
                                    {data.creditLoan}
                                </p>
                            </div>
                            <div className="flex justify-between items-center py-0.5">
                                <span className="text-slate-500 dark:text-gray-400 text-[11px]">담보 대출</span>
                                <span className="font-medium text-slate-800 dark:text-gray-200">{data.collateralLoan}</span>
                            </div>
                            <div className="flex justify-between items-center py-0.5">
                                <span className="text-slate-500 dark:text-gray-400 text-[11px]">월 대출납입금</span>
                                <span className="font-bold text-amber-700 dark:text-amber-400">{data.loanMonthlyPay}</span>
                            </div>
                            <div>
                                <span className="text-slate-500 dark:text-gray-400 text-[11px] block mb-0.5">보유 자산</span>
                                <p className="text-slate-800 dark:text-gray-200 font-medium leading-snug bg-white dark:bg-gray-800 p-1.5 rounded border border-slate-200 dark:border-gray-700 text-[11px]">
                                    {data.assets}
                                </p>
                            </div>
                            <div className="flex justify-between items-center py-0.5">
                                <span className="text-slate-500 dark:text-gray-400 text-[11px]">신용카드 사용유무</span>
                                <span className="text-slate-800 dark:text-gray-200 font-medium">{data.creditCardUse}</span>
                            </div>
                            <div className="flex justify-between items-center py-0.5">
                                <span className="text-slate-500 dark:text-gray-400 text-[11px]">회생/파산 이력</span>
                                <span className="font-semibold text-slate-800 dark:text-gray-200">{data.history}</span>
                            </div>
                        </div>
                    </div>

                    {/* SECTION 4: 상담 특이사항 */}
                    <div className="bg-slate-50/80 dark:bg-gray-900/40 rounded-xl p-3 border border-slate-200/80 dark:border-gray-700/60 flex flex-col gap-2">
                        <div className="flex items-center gap-1.5 text-purple-700 dark:text-purple-400 font-bold text-xs pb-1.5 border-b border-slate-200 dark:border-gray-700">
                            <MessageSquare size={14} />
                            <span>4. 상담 특이사항</span>
                        </div>
                        <div className="flex-1 overflow-y-auto max-h-[190px] bg-white dark:bg-gray-800 p-2.5 rounded-lg border border-slate-200 dark:border-gray-700 text-slate-700 dark:text-gray-200 text-[11px] leading-relaxed whitespace-pre-wrap">
                            {data.specialMemo ? (
                                data.specialMemo
                            ) : (
                                <span className="text-slate-400 italic">등록된 특이사항이 없습니다.</span>
                            )}
                        </div>
                    </div>

                </div>
            )}
        </div>
    );
};
