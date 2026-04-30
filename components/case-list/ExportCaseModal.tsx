import React, { useState, useEffect } from 'react';
import { X, Download, Calendar, Filter } from 'lucide-react';
import { Case } from '../../types';
import { exportCustomCases } from '../../utils/xlsxExport';

interface ExportCaseModalProps {
    isOpen: boolean;
    onClose: () => void;
    allCases: Case[];
    currentListCases: Case[];
    statuses: string[];
}

export const ExportCaseModal: React.FC<ExportCaseModalProps> = ({
    isOpen,
    onClose,
    allCases,
    currentListCases,
    statuses
}) => {
    const [targetScope, setTargetScope] = useState<'all' | 'special' | 'current'>('all');
    
    // Status filters
    const [isAllStatuses, setIsAllStatuses] = useState(true);
    const [selectedStatuses, setSelectedStatuses] = useState<string[]>([]);
    
    // Date filters
    const [dateType, setDateType] = useState<'createdAt' | 'contractAt'>('createdAt');
    const [dateRangeType, setDateRangeType] = useState<'all' | 'month' | 'custom'>('all');
    const [selectedMonth, setSelectedMonth] = useState<string>(''); // YYYY-MM
    const [customStartDate, setCustomStartDate] = useState<string>(''); // YYYY-MM-DD
    const [customEndDate, setCustomEndDate] = useState<string>(''); // YYYY-MM-DD

    // Set default month to current month
    useEffect(() => {
        if (isOpen) {
            const now = new Date();
            const year = now.getFullYear();
            const month = String(now.getMonth() + 1).padStart(2, '0');
            setSelectedMonth(`${year}-${month}`);
        }
    }, [isOpen]);

    if (!isOpen) return null;

    const handleToggleStatus = (status: string) => {
        if (isAllStatuses) {
            setIsAllStatuses(false);
            setSelectedStatuses([status]);
        } else {
            if (selectedStatuses.includes(status)) {
                const newStatuses = selectedStatuses.filter(s => s !== status);
                setSelectedStatuses(newStatuses);
                if (newStatuses.length === 0) setIsAllStatuses(true);
            } else {
                setSelectedStatuses([...selectedStatuses, status]);
            }
        }
    };

    const handleSelectAllStatuses = () => {
        setIsAllStatuses(true);
        setSelectedStatuses([]);
    };

    const handleExport = () => {
        const sourceData = targetScope === 'current' ? currentListCases : allCases;
        const filename = `cases_export_${new Date().toISOString().split('T')[0]}`;
        
        exportCustomCases(
            sourceData, 
            filename, 
            targetScope, 
            isAllStatuses ? [] : selectedStatuses, 
            dateType, 
            dateRangeType, 
            selectedMonth, 
            customStartDate, 
            customEndDate
        );
        onClose();
    };

    return (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
            <div className="bg-white dark:bg-gray-800 rounded-xl shadow-xl w-full max-w-2xl flex flex-col max-h-[90vh]">
                
                {/* Header */}
                <div className="flex items-center justify-between p-4 border-b dark:border-gray-700">
                    <h2 className="text-xl font-bold text-gray-800 dark:text-white flex items-center gap-2">
                        <Download size={20} className="text-blue-600" />
                        데이터 내보내기 (Excel)
                    </h2>
                    <button onClick={onClose} className="text-gray-500 hover:text-gray-700 dark:hover:text-gray-300">
                        <X size={24} />
                    </button>
                </div>

                {/* Body */}
                <div className="p-6 space-y-6 overflow-y-auto">
                    
                    {/* 1. 추출 대상 */}
                    <div className="space-y-3">
                        <h3 className="text-sm font-bold text-gray-700 dark:text-gray-300 flex items-center gap-2">
                            <Filter size={16} /> 1. 내보낼 데이터 대상
                        </h3>
                        <div className="flex flex-wrap gap-3">
                            <label className={`flex items-center gap-2 p-3 border rounded-lg cursor-pointer transition-colors ${targetScope === 'all' ? 'border-blue-500 bg-blue-50 dark:bg-blue-900/20' : 'border-gray-200 hover:bg-gray-50 dark:border-gray-700 dark:hover:bg-gray-750'}`}>
                                <input type="radio" name="targetScope" checked={targetScope === 'all'} onChange={() => setTargetScope('all')} className="w-4 h-4 text-blue-600" />
                                <span className="text-sm font-medium dark:text-gray-200">전체 케이스</span>
                            </label>
                            <label className={`flex items-center gap-2 p-3 border rounded-lg cursor-pointer transition-colors ${targetScope === 'special' ? 'border-blue-500 bg-blue-50 dark:bg-blue-900/20' : 'border-gray-200 hover:bg-gray-50 dark:border-gray-700 dark:hover:bg-gray-750'}`}>
                                <input type="radio" name="targetScope" checked={targetScope === 'special'} onChange={() => setTargetScope('special')} className="w-4 h-4 text-blue-600" />
                                <span className="text-sm font-medium dark:text-gray-200">특수 케이스 (부재/불가/취소)</span>
                            </label>
                            <label className={`flex items-center gap-2 p-3 border rounded-lg cursor-pointer transition-colors ${targetScope === 'current' ? 'border-blue-500 bg-blue-50 dark:bg-blue-900/20' : 'border-gray-200 hover:bg-gray-50 dark:border-gray-700 dark:hover:bg-gray-750'}`}>
                                <input type="radio" name="targetScope" checked={targetScope === 'current'} onChange={() => setTargetScope('current')} className="w-4 h-4 text-blue-600" />
                                <span className="text-sm font-medium dark:text-gray-200">현재 목록 (검색/필터 결과)</span>
                            </label>
                        </div>
                    </div>

                    {/* 2. 상태 필터 */}
                    <div className="space-y-3">
                        <h3 className="text-sm font-bold text-gray-700 dark:text-gray-300 flex items-center gap-2">
                            <Filter size={16} /> 2. 진행 상태 (1차 상태)
                        </h3>
                        <div className="flex flex-wrap gap-2">
                            <button
                                onClick={handleSelectAllStatuses}
                                className={`px-4 py-2 rounded-full text-sm font-medium border transition-colors ${isAllStatuses ? 'bg-blue-600 text-white border-blue-600' : 'bg-white text-gray-700 border-gray-300 hover:border-blue-400 dark:bg-gray-800 dark:text-gray-300 dark:border-gray-600'}`}
                            >
                                전체 상태
                            </button>
                            {statuses.filter(s => s !== '휴지통').map(status => (
                                <button
                                    key={status}
                                    onClick={() => handleToggleStatus(status)}
                                    className={`px-4 py-2 rounded-full text-sm font-medium border transition-colors ${!isAllStatuses && selectedStatuses.includes(status) ? 'bg-blue-600 text-white border-blue-600' : 'bg-white text-gray-700 border-gray-300 hover:border-blue-400 dark:bg-gray-800 dark:text-gray-300 dark:border-gray-600'}`}
                                >
                                    {status}
                                </button>
                            ))}
                        </div>
                    </div>

                    {/* 3. 기간 필터 */}
                    <div className="space-y-3">
                        <div className="flex items-center justify-between">
                            <h3 className="text-sm font-bold text-gray-700 dark:text-gray-300 flex items-center gap-2">
                                <Calendar size={16} /> 3. 기간 설정
                            </h3>
                            <select 
                                value={dateType} 
                                onChange={(e) => setDateType(e.target.value as any)}
                                className="text-sm border-gray-300 rounded-md focus:ring-blue-500 focus:border-blue-500 dark:bg-gray-700 dark:border-gray-600 dark:text-white"
                            >
                                <option value="createdAt">등록일 기준</option>
                                <option value="contractAt">계약일 기준</option>
                            </select>
                        </div>
                        
                        <div className="space-y-2">
                            <label className="flex items-center gap-2 cursor-pointer">
                                <input type="radio" name="dateRange" checked={dateRangeType === 'all'} onChange={() => setDateRangeType('all')} className="text-blue-600" />
                                <span className="text-sm dark:text-gray-200">전체 기간</span>
                            </label>
                            
                            <label className="flex items-center gap-2 cursor-pointer">
                                <input type="radio" name="dateRange" checked={dateRangeType === 'month'} onChange={() => setDateRangeType('month')} className="text-blue-600" />
                                <span className="text-sm dark:text-gray-200">월별 선택</span>
                                {dateRangeType === 'month' && (
                                    <input 
                                        type="month" 
                                        value={selectedMonth}
                                        onChange={(e) => setSelectedMonth(e.target.value)}
                                        className="ml-2 text-sm border-gray-300 rounded-md py-1 px-2 dark:bg-gray-700 dark:border-gray-600 dark:text-white"
                                    />
                                )}
                            </label>

                            <label className="flex items-center gap-2 cursor-pointer">
                                <input type="radio" name="dateRange" checked={dateRangeType === 'custom'} onChange={() => setDateRangeType('custom')} className="text-blue-600" />
                                <span className="text-sm dark:text-gray-200">직접 지정</span>
                                {dateRangeType === 'custom' && (
                                    <div className="flex items-center gap-2 ml-2">
                                        <input 
                                            type="date" 
                                            value={customStartDate}
                                            onChange={(e) => setCustomStartDate(e.target.value)}
                                            className="text-sm border-gray-300 rounded-md py-1 px-2 dark:bg-gray-700 dark:border-gray-600 dark:text-white"
                                        />
                                        <span className="text-gray-500 dark:text-gray-400">~</span>
                                        <input 
                                            type="date" 
                                            value={customEndDate}
                                            onChange={(e) => setCustomEndDate(e.target.value)}
                                            className="text-sm border-gray-300 rounded-md py-1 px-2 dark:bg-gray-700 dark:border-gray-600 dark:text-white"
                                        />
                                    </div>
                                )}
                            </label>
                        </div>
                    </div>
                </div>

                {/* Footer */}
                <div className="p-4 border-t dark:border-gray-700 flex justify-end gap-2 bg-gray-50 dark:bg-gray-800 rounded-b-xl">
                    <button 
                        onClick={onClose}
                        className="px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-lg hover:bg-gray-50 dark:bg-gray-700 dark:text-gray-200 dark:border-gray-600 dark:hover:bg-gray-600"
                    >
                        취소
                    </button>
                    <button 
                        onClick={handleExport}
                        className="px-4 py-2 text-sm font-bold text-white bg-blue-600 rounded-lg hover:bg-blue-700 flex items-center gap-2 shadow-sm"
                    >
                        <Download size={16} />
                        다운로드 실행
                    </button>
                </div>
            </div>
        </div>
    );
};
