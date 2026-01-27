import React from 'react';
import { Sparkles, Phone, X, ArrowUpDown } from 'lucide-react';

interface CaseListHeaderProps {
    totalItems: number;
    newCaseCount: number;
    showNewOnly: boolean;
    setShowNewOnly: (show: boolean) => void;
    overdueMissedCallCount: number;
    showOverdueMissedOnly: boolean;
    setShowOverdueMissedOnly: (show: boolean) => void;
    missedCallInterval: number;
    updateAvailable: boolean;
    newLeadsCount: number;
    onManualRefresh: () => void;
    onResetPage: () => void;
}

export const CaseListHeader: React.FC<CaseListHeaderProps> = ({
    totalItems,
    newCaseCount,
    showNewOnly,
    setShowNewOnly,
    overdueMissedCallCount,
    showOverdueMissedOnly,
    setShowOverdueMissedOnly,
    missedCallInterval,
    updateAvailable,
    newLeadsCount,
    onManualRefresh,
    onResetPage
}) => {
    return (
        <div className="space-y-4">
            {newCaseCount > 0 && (
                <div className="bg-red-50 border border-red-200 rounded-lg p-4 flex items-center justify-between animate-fade-in">
                    <div className="flex items-center gap-3">
                        <div className="bg-red-100 p-2 rounded-full">
                            <Sparkles className="text-red-600" size={20} />
                        </div>
                        <div>
                            <h3 className="font-bold text-red-800">새로운 접수 건이 {newCaseCount}건 있습니다!</h3>
                            <p className="text-sm text-red-600">신규 등록된 케이스를 <br className="block md:hidden" />확인하고 상담을 진행해주세요.</p>
                        </div>
                    </div>
                    <button
                        onClick={() => {
                            setShowNewOnly(true);
                            onResetPage();
                        }}
                        className="px-4 py-2 bg-red-600 text-white text-sm font-bold rounded-lg hover:bg-red-700 transition-colors shadow-sm whitespace-nowrap md:whitespace-normal"
                    >
                        <span className="hidden md:inline">확인하기</span>
                        <span className="md:hidden flex flex-col items-center leading-tight">
                            <span>확인</span>
                            <span>하기</span>
                        </span>
                    </button>
                    {showNewOnly && (
                        <button
                            onClick={() => { setShowNewOnly(false); onResetPage(); }}
                            className="absolute top-2 right-2 text-red-400 hover:text-red-600"
                        >
                            <X size={16} />
                        </button>
                    )}
                </div>
            )}

            {overdueMissedCallCount > 0 && !showOverdueMissedOnly && (
                <div className="bg-orange-50 border border-orange-200 rounded-lg p-4 flex items-center justify-between animate-fade-in">
                    <div className="flex items-center gap-3">
                        <div className="bg-orange-100 p-2 rounded-full">
                            <Phone className="text-orange-600" size={20} />
                        </div>
                        <div>
                            <h3 className="font-bold text-orange-800">재통화 필요 {overdueMissedCallCount}건</h3>
                            <p className="text-sm text-orange-600">마지막 통화 후 {missedCallInterval}일이 지났습니다.</p>
                        </div>
                    </div>
                    <button
                        onClick={() => {
                            setShowOverdueMissedOnly(true);
                            setShowNewOnly(false);
                            onResetPage();
                        }}
                        className="px-4 py-2 bg-orange-600 text-white text-sm font-bold rounded-lg hover:bg-orange-700 transition-colors shadow-sm whitespace-nowrap"
                    >
                        확인하기
                    </button>
                </div>
            )}

            {updateAvailable && (
                <div className="flex items-center justify-between bg-blue-50 border border-blue-200 p-3 rounded-lg animate-fade-in shadow-sm cursor-pointer hover:bg-blue-100 transition-colors" onClick={onManualRefresh}>
                    <div className="flex items-center gap-2">
                        <div className="bg-blue-100 p-1.5 rounded-full">
                            <ArrowUpDown className="text-blue-600 animate-bounce" size={16} />
                        </div>
                        <span className="text-sm font-bold text-blue-800">
                            {newLeadsCount > 0
                                ? `🔄 새 접수 ${newLeadsCount}건 도착(눌러서 새로고침)`
                                : '새로운 데이터가 감지되었습니다. (눌러서 새로고침)'}
                        </span>
                    </div>
                    <button className="px-3 py-1.5 bg-blue-600 hover:bg-blue-700 text-white text-xs font-bold rounded shadow-sm transition-colors">
                        새로고침
                    </button>
                </div>
            )}

            <div className="flex justify-between items-center">
                <h2 className="text-2xl font-bold text-gray-800 dark:text-white flex items-center gap-2">
                    케이스 관리
                    {showNewOnly && (
                        <span className="text-xs bg-red-100 text-red-600 px-2 py-0.5 rounded-full border border-red-200 cursor-pointer hover:bg-red-200" onClick={() => { setShowNewOnly(false); onResetPage(); }}>
                            필터링됨: 신규 접수 건 <span className="ml-1 font-bold">×</span>
                        </span>
                    )}
                    {showOverdueMissedOnly && (
                        <span className="text-xs bg-orange-100 text-orange-600 px-2 py-0.5 rounded-full border border-orange-200 cursor-pointer hover:bg-orange-200" onClick={() => { setShowOverdueMissedOnly(false); onResetPage(); }}>
                            필터링됨: 재통화 필요 <span className="ml-1 font-bold">×</span>
                        </span>
                    )}
                </h2>
                <span className="text-sm text-gray-500 dark:text-gray-400 font-medium">총 {totalItems}건</span>
            </div>
        </div>
    );
};
