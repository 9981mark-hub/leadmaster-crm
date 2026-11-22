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
        <div className="bg-card text-foreground rounded-xl border border-border shadow-xs overflow-hidden transition-all">
            {/* Header Toolbar */}
            <div
                onClick={toggleExpanded}
                className="px-4 py-2.5 bg-muted/40 border-b border-border flex items-center justify-between cursor-pointer select-none gap-2"
            >
                <div className="flex items-center gap-2.5 flex-wrap">
                    <span className="w-2 h-2 rounded-full bg-primary animate-pulse"></span>
                    <span className="font-semibold text-foreground text-sm flex items-center gap-1.5" title={data.isAiSource ? 'AI 통화 분석 기반' : 'CRM 입력 데이터 기반'}>
                        <span className="text-base">📋</span>
                        고객 종합 브리핑
                    </span>
                </div>

                <div className="flex items-center gap-2">
                    <button
                        type="button"
                        onClick={handleCopyBriefing}
                        className="px-2.5 py-1 text-xs font-semibold text-foreground bg-card hover:bg-muted border border-border rounded-lg shadow-2xs flex items-center gap-1.5 transition-colors cursor-pointer"
                        title="브리핑 전체 텍스트 복사"
                    >
                        <Copy size={13} strokeWidth={1.75} className="text-muted-foreground" />
                        <span className="hidden sm:inline">브리핑 복사</span>
                    </button>

                    <button
                        type="button"
                        className="p-1 rounded-lg hover:bg-muted text-muted-foreground hover:text-foreground transition-colors cursor-pointer"
                        aria-label={isExpanded ? '접기' : '펼치기'}
                    >
                        {isExpanded ? <ChevronUp size={16} strokeWidth={1.75} /> : <ChevronDown size={16} strokeWidth={1.75} />}
                    </button>
                </div>
            </div>

            {/* Compact Summary View (When collapsed) */}
            {!isExpanded && (
                <div
                    onClick={toggleExpanded}
                    className="px-4 py-2.5 text-xs text-muted-foreground flex items-center justify-between cursor-pointer hover:bg-muted/30 gap-2 flex-wrap bg-card"
                >
                    <div className="flex items-center gap-2 flex-wrap font-medium">
                        <span className="font-semibold text-foreground">{data.customerName}</span>
                        <span className="text-muted-foreground">({data.gender}, {data.birthYear}, {data.region})</span>
                        <span className="text-border">|</span>
                        <span>직업: <b className="text-foreground">{data.job}</b></span>
                        <span className="text-muted-foreground">(실급여: {data.income})</span>
                        <span className="text-border">|</span>
                        <span>주거: <b className="text-foreground">{data.housingType}</b></span>
                        <span className="text-muted-foreground">({data.depositRent})</span>
                        <span className="text-border">|</span>
                        <span>신용대출: <b className="text-foreground font-mono font-semibold">{data.creditLoan}</b></span>
                        <span className="text-muted-foreground">({data.loanMonthlyPay})</span>
                    </div>
                    <span className="text-xs text-primary font-semibold shrink-0 hover:underline">
                        상세 보기 ▼
                    </span>
                </div>
            )}

            {/* Expanded Detailed Grid (When expanded - 4 Monotone Charcoal Panels) */}
            {isExpanded && (
                <div className="p-3.5 md:p-4 grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-3 bg-card">
                    
                    {/* SECTION 1: 인적 및 직업/가족 */}
                    <div className="bg-muted/30 rounded-xl p-3 border border-border flex flex-col gap-2">
                        <div className="flex items-center gap-1.5 text-foreground font-semibold text-xs pb-1.5 border-b border-border">
                            <UserCheck size={14} strokeWidth={1.75} className="text-primary" />
                            <span>1. 인적 및 직업/가족</span>
                        </div>
                        <div className="space-y-1 text-xs">
                            <div className="flex justify-between items-center py-0.5">
                                <span className="text-muted-foreground text-xs">고객이름</span>
                                <span className="font-semibold text-foreground text-sm">{data.customerName}</span>
                            </div>
                            <div className="flex justify-between items-center py-0.5">
                                <span className="text-muted-foreground text-xs">연락처</span>
                                <span className="font-semibold text-primary font-mono flex items-center gap-1">
                                    <Phone size={11} strokeWidth={1.75} className="text-primary" />
                                    {data.phone}
                                </span>
                            </div>
                            <div className="flex justify-between items-center py-0.5">
                                <span className="text-muted-foreground text-xs">출생년도 / 성별</span>
                                <span className="text-foreground font-medium">{data.birthYear} ({data.gender})</span>
                            </div>
                            <div className="flex justify-between items-center py-0.5">
                                <span className="text-muted-foreground text-xs">거주지역</span>
                                <span className="text-foreground font-medium">{data.region}</span>
                            </div>
                            <div className="flex justify-between items-center py-0.5">
                                <span className="text-muted-foreground text-xs">직업</span>
                                <span className="font-semibold text-foreground bg-muted px-2 py-0.5 rounded border border-border">{data.job}</span>
                            </div>
                            <div className="flex justify-between items-center py-0.5">
                                <span className="text-muted-foreground text-xs">4대보험 가입유무</span>
                                <span className="text-foreground font-medium">{data.insurance4}</span>
                            </div>
                            <div className="flex justify-between items-center py-0.5">
                                <span className="text-muted-foreground text-xs">결혼 / 미성년 자녀</span>
                                <span className="text-foreground font-medium">{data.maritalStatus} / 자녀 {data.childrenCount}</span>
                            </div>
                        </div>
                    </div>

                    {/* SECTION 2: 소득 및 주거 환경 */}
                    <div className="bg-muted/30 rounded-xl p-3 border border-border flex flex-col gap-2">
                        <div className="flex items-center gap-1.5 text-foreground font-semibold text-xs pb-1.5 border-b border-border">
                            <Home size={14} strokeWidth={1.75} className="text-primary" />
                            <span>2. 소득 및 주거 환경</span>
                        </div>
                        <div className="space-y-2 text-xs">
                            <div className="bg-card p-2.5 rounded-lg border border-border">
                                <span className="text-muted-foreground text-xs block mb-0.5">월 세후소득 (실급여)</span>
                                <div className="font-semibold text-primary font-mono text-sm">
                                    {data.income}
                                </div>
                            </div>
                            <div className="flex justify-between items-center py-0.5">
                                <span className="text-muted-foreground text-xs">거주 형태</span>
                                <span className="font-medium text-foreground bg-muted px-2 py-0.5 rounded border border-border">{data.housingType}</span>
                            </div>
                            <div className="py-0.5">
                                <span className="text-muted-foreground text-xs block mb-1">보증금, 월세</span>
                                <p className="text-foreground font-medium leading-snug bg-card p-2 rounded-lg border border-border text-xs">
                                    {data.depositRent}
                                </p>
                            </div>
                        </div>
                    </div>

                    {/* SECTION 3: 채무 및 자산 현황 */}
                    <div className="bg-muted/30 rounded-xl p-3 border border-border flex flex-col gap-2">
                        <div className="flex items-center gap-1.5 text-foreground font-semibold text-xs pb-1.5 border-b border-border">
                            <CreditCard size={14} strokeWidth={1.75} className="text-primary" />
                            <span>3. 채무 및 자산 현황</span>
                        </div>
                        <div className="space-y-1.5 text-xs">
                            <div>
                                <span className="text-muted-foreground text-xs block mb-0.5">신용 대출</span>
                                <p className="font-semibold text-foreground font-mono leading-snug bg-card p-2 rounded-lg border border-border text-xs">
                                    {data.creditLoan}
                                </p>
                            </div>
                            <div className="flex justify-between items-center py-0.5">
                                <span className="text-muted-foreground text-xs">담보 대출</span>
                                <span className="font-medium text-foreground">{data.collateralLoan}</span>
                            </div>
                            <div className="flex justify-between items-center py-0.5">
                                <span className="text-muted-foreground text-xs">월 대출납입금</span>
                                <span className="font-semibold text-foreground font-mono">{data.loanMonthlyPay}</span>
                            </div>
                            <div>
                                <span className="text-muted-foreground text-xs block mb-0.5">보유 자산</span>
                                <p className="text-foreground font-medium leading-snug bg-card p-2 rounded-lg border border-border text-xs">
                                    {data.assets}
                                </p>
                            </div>
                            <div className="flex justify-between items-center py-0.5">
                                <span className="text-muted-foreground text-xs">신용카드 사용유무</span>
                                <span className="text-foreground font-medium">{data.creditCardUse}</span>
                            </div>
                            <div className="flex justify-between items-center py-0.5">
                                <span className="text-muted-foreground text-xs">회생/파산 이력</span>
                                <span className="font-semibold text-foreground">{data.history}</span>
                            </div>
                        </div>
                    </div>

                    {/* SECTION 4: 상담 특이사항 */}
                    <div className="bg-muted/30 rounded-xl p-3 border border-border flex flex-col gap-2">
                        <div className="flex items-center gap-1.5 text-foreground font-semibold text-xs pb-1.5 border-b border-border">
                            <MessageSquare size={14} strokeWidth={1.75} className="text-primary" />
                            <span>4. 상담 특이사항</span>
                        </div>
                        <div className="flex-1 overflow-y-auto max-h-[190px] bg-card p-3 rounded-lg border border-border text-muted-foreground text-xs leading-relaxed whitespace-pre-wrap">
                            {data.specialMemo ? (
                                data.specialMemo
                            ) : (
                                <span className="text-muted-foreground italic">등록된 특이사항이 없습니다.</span>
                            )}
                        </div>
                    </div>

                </div>
            )}
        </div>
    );
};
