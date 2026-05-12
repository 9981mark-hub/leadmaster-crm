import React, { useMemo, useState } from 'react';
import { AlertTriangle, ShieldCheck, ShieldAlert, AlertCircle, HelpCircle, Settings } from 'lucide-react';
import { Case, SettlementBatch, Partner } from '../types';
import BusinessProfileModal from './BusinessProfileModal';

interface TaxRiskDashboardProps {
    cases: Case[];
    batches: SettlementBatch[];
    partners: Partner[];
}

export default function TaxRiskDashboardSection({ cases, batches, partners }: TaxRiskDashboardProps) {
    const [isProfileModalOpen, setIsProfileModalOpen] = useState(false);

    // 1. 매출 누락 리스크: 정산(batch)은 되었으나 수임료(contractFee)가 0이거나 미입력된 케이스 (추정)
    const missingFeeCases = cases.filter(c => ['계약 완료', '1차 입금완료', '2차 입금완료'].includes(c.status) && (!c.contractFee || c.contractFee === 0));

    // 2. 프리랜서 원천세 누락 의심: 이건 기존 localStorage에서 가져올 수 있으나 간소화하여 표시
    let withholdingRecords: any[] = [];
    try {
        const raw = localStorage.getItem('leadmaster_withholding_records');
        if (raw) withholdingRecords = JSON.parse(raw);
    } catch {}
    
    const overdueWithholding = withholdingRecords.filter(r => !r.isFilingDone && r.filingMonth < new Date().toISOString().slice(0, 7));

    // 3. 증빙 없는 지출 의심: localStorage의 leadmaster_expenses 확인 (공제/불공제 여부)
    let expenses: any[] = [];
    try {
        const raw = localStorage.getItem('leadmaster_expenses');
        if (raw) expenses = JSON.parse(raw);
    } catch {}
    
    // 사업용이면서 증빙이 불확실한 항목 (단순 추정 로직)
    const riskyExpenses = expenses.filter(e => e.category === '기타' && e.amount > 5); // 5만원 이상 기타 지출

    // 위험도 산정 (간단 로직)
    let riskScore = 100;
    riskScore -= (missingFeeCases.length * 5);
    riskScore -= (overdueWithholding.length * 10);
    riskScore -= (riskyExpenses.length * 2);
    
    riskScore = Math.max(0, Math.min(100, riskScore));

    let riskLevel = '안정';
    let riskColor = 'text-green-600';
    let riskBg = 'bg-green-50 border-green-200';
    let RiskIcon = ShieldCheck;

    if (riskScore < 40) {
        riskLevel = '위험';
        riskColor = 'text-red-600';
        riskBg = 'bg-red-50 border-red-200';
        RiskIcon = ShieldAlert;
    } else if (riskScore < 80) {
        riskLevel = '주의';
        riskColor = 'text-orange-600';
        riskBg = 'bg-orange-50 border-orange-200';
        RiskIcon = AlertTriangle;
    }

    return (
        <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden mb-6">
            <div className="p-4 border-b border-gray-100 bg-gray-50 flex justify-between items-center">
                <div>
                    <h3 className="font-bold text-gray-800 flex items-center gap-2 text-base">
                        <AlertCircle size={18} className="text-blue-500" />
                        세무 리스크 대시보드
                    </h3>
                    <p className="text-xs text-gray-500 mt-0.5">신고 전 누락·가산세 위험을 미리 점검하세요.</p>
                </div>
                <button 
                    onClick={() => setIsProfileModalOpen(true)}
                    className="flex items-center gap-1.5 px-3 py-1.5 bg-white border border-gray-300 rounded-lg text-xs font-bold text-gray-700 hover:bg-gray-50"
                >
                    <Settings size={14} className="text-gray-500" /> 사업 유형 설정
                </button>
            </div>

            <div className="p-4 grid md:grid-cols-4 gap-4">
                {/* 종합 점수 */}
                <div className={`p-4 rounded-xl border flex flex-col items-center justify-center ${riskBg}`}>
                    <RiskIcon size={32} className={`mb-2 ${riskColor}`} />
                    <p className="text-sm font-bold text-gray-700">종합 리스크 점수</p>
                    <p className={`text-3xl font-black ${riskColor}`}>{riskScore}점</p>
                    <p className={`text-xs font-bold px-2 py-0.5 rounded-full mt-2 bg-white ${riskColor} border`}>
                        {riskLevel} 상태
                    </p>
                </div>

                {/* 리스크 항목들 */}
                <div className="md:col-span-3 space-y-3">
                    {/* 매출 누락 경고 */}
                    <div className={`p-3 rounded-lg border ${missingFeeCases.length > 0 ? 'bg-red-50 border-red-200' : 'bg-green-50 border-green-100'}`}>
                        <div className="flex justify-between items-center mb-1">
                            <span className="text-sm font-bold text-gray-700">매출 누락 의심 건</span>
                            <span className={`text-xs font-bold px-2 py-0.5 rounded-full ${missingFeeCases.length > 0 ? 'bg-red-100 text-red-700' : 'bg-green-100 text-green-700'}`}>
                                {missingFeeCases.length}건
                            </span>
                        </div>
                        <p className="text-xs text-gray-500">계약은 진행되었으나 수임료가 미입력된 건은 세금계산서 발행 시 누락될 수 있습니다.</p>
                    </div>

                    {/* 원천세 미신고 */}
                    <div className={`p-3 rounded-lg border ${overdueWithholding.length > 0 ? 'bg-orange-50 border-orange-200' : 'bg-green-50 border-green-100'}`}>
                        <div className="flex justify-between items-center mb-1">
                            <span className="text-sm font-bold text-gray-700">원천세 기한 초과 미신고</span>
                            <span className={`text-xs font-bold px-2 py-0.5 rounded-full ${overdueWithholding.length > 0 ? 'bg-orange-100 text-orange-700' : 'bg-green-100 text-green-700'}`}>
                                {overdueWithholding.length}건
                            </span>
                        </div>
                        <p className="text-xs text-gray-500">신고 기한이 지난 원천세 미신고 내역입니다. 가산세가 발생할 수 있습니다.</p>
                    </div>

                    {/* 증빙 미흡 지출 */}
                    <div className={`p-3 rounded-lg border ${riskyExpenses.length > 0 ? 'bg-yellow-50 border-yellow-200' : 'bg-green-50 border-green-100'}`}>
                        <div className="flex justify-between items-center mb-1">
                            <span className="text-sm font-bold text-gray-700">증빙 확인 필요 지출</span>
                            <span className={`text-xs font-bold px-2 py-0.5 rounded-full ${riskyExpenses.length > 0 ? 'bg-yellow-100 text-yellow-700' : 'bg-green-100 text-green-700'}`}>
                                {riskyExpenses.length}건
                            </span>
                        </div>
                        <p className="text-xs text-gray-500">사업용 지출이나 증빙(적격증빙)이 명확하지 않은 건입니다. 비용 처리가 부인될 수 있습니다.</p>
                    </div>
                </div>
            </div>
            
            <BusinessProfileModal 
                isOpen={isProfileModalOpen} 
                onClose={() => setIsProfileModalOpen(false)} 
            />
        </div>
    );
}
