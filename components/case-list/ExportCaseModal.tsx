import React, { useState, useEffect } from 'react';
import { X, Download, Calendar, Filter } from 'lucide-react';
import { Case } from '../../types';
import { exportCustomCases, ExportDateType } from '../../utils/xlsxExport';
import { useAuth } from '../../contexts/AuthContext';
import { useToast } from '../../contexts/ToastContext';

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
    // [015] 리드 데이터 내보내기는 회사 관리자만
    const { isAdmin } = useAuth();
    const { showToast } = useToast();
    const [targetScope, setTargetScope] = useState<'all' | 'special' | 'current'>('all');
    
    // Status filters
    const [isAllStatuses, setIsAllStatuses] = useState(true);
    const [selectedStatuses, setSelectedStatuses] = useState<string[]>([]);
    
    // Date filters
    const [dateType, setDateType] = useState<ExportDateType>('createdAt');
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

    if (!isOpen || !isAdmin) return null;

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
        if (!isAdmin) { showToast('데이터 내보내기는 관리자만 가능합니다.', 'error'); onClose(); return; }
        const sourceData = targetScope === 'current' ? currentListCases : allCases;
        const filename = `cases_export_${new Date().toISOString().split('T')[0]}`;
        
        const done = exportCustomCases(
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
        if (!done) showToast('데이터 내보내기는 관리자만 가능합니다.', 'error');
        onClose();
    };

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-5 bg-background/80 backdrop-blur-xs animate-in fade-in duration-200 overflow-y-auto">
            <div className="relative w-full max-w-2xl max-h-[88vh] my-auto flex flex-col rounded-2xl bg-card border border-border shadow-2xl overflow-hidden text-card-foreground">
                
                {/* Header */}
                <div className="p-4 sm:p-5 border-b border-border flex items-center justify-between bg-card shrink-0">
                    <h2 className="text-base font-bold text-foreground flex items-center gap-2">
                        <Download size={18} className="text-primary" />
                        데이터 내보내기 (Excel)
                    </h2>
                    <button onClick={onClose} className="p-1.5 rounded-lg text-muted-foreground hover:text-foreground hover:bg-muted transition-colors cursor-pointer" title="창 닫기">
                        <X size={18} />
                    </button>
                </div>

                {/* Body */}
                <div className="flex-1 overflow-y-auto p-5 sm:p-6 space-y-5 custom-scrollbar text-xs">
                    
                    {/* 1. 추출 대상 */}
                    <div className="space-y-3">
                        <h3 className="text-xs font-semibold text-foreground flex items-center gap-2 uppercase tracking-wider">
                            <Filter size={14} className="text-primary" /> 1. 내보낼 데이터 대상
                        </h3>
                        <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5">
                            <label className={`flex items-center gap-2.5 p-3 rounded-xl border cursor-pointer transition-colors ${targetScope === 'all' ? 'border-primary bg-primary/10 text-foreground ring-1 ring-primary/20' : 'border-border bg-card hover:bg-muted/50 text-muted-foreground'}`}>
                                <input type="radio" name="targetScope" checked={targetScope === 'all'} onChange={() => setTargetScope('all')} className="w-4 h-4 accent-primary" />
                                <span className="text-xs font-medium">전체 케이스</span>
                            </label>
                            <label className={`flex items-center gap-2.5 p-3 rounded-xl border cursor-pointer transition-colors ${targetScope === 'special' ? 'border-primary bg-primary/10 text-foreground ring-1 ring-primary/20' : 'border-border bg-card hover:bg-muted/50 text-muted-foreground'}`}>
                                <input type="radio" name="targetScope" checked={targetScope === 'special'} onChange={() => setTargetScope('special')} className="w-4 h-4 accent-primary" />
                                <span className="text-xs font-medium">특수 케이스 (부재/불가/취소)</span>
                            </label>
                            <label className={`flex items-center gap-2.5 p-3 rounded-xl border cursor-pointer transition-colors ${targetScope === 'current' ? 'border-primary bg-primary/10 text-foreground ring-1 ring-primary/20' : 'border-border bg-card hover:bg-muted/50 text-muted-foreground'}`}>
                                <input type="radio" name="targetScope" checked={targetScope === 'current'} onChange={() => setTargetScope('current')} className="w-4 h-4 accent-primary" />
                                <span className="text-xs font-medium">현재 목록 (검색/필터 결과)</span>
                            </label>
                        </div>
                    </div>

                    {/* 2. 상태 필터 */}
                    <div className="space-y-3">
                        <h3 className="text-xs font-semibold text-foreground flex items-center gap-2 uppercase tracking-wider">
                            <Filter size={14} className="text-primary" /> 2. 진행 상태 (1차 상태)
                        </h3>
                        <div className="flex flex-wrap gap-2">
                            <button
                                onClick={handleSelectAllStatuses}
                                className={`px-3 py-1.5 rounded-lg text-xs font-semibold border transition-colors ${isAllStatuses ? 'bg-primary text-primary-foreground border-primary shadow-2xs' : 'bg-card text-muted-foreground border-border hover:text-foreground hover:bg-muted'}`}
                            >
                                전체 상태
                            </button>
                            {statuses.filter(s => s !== '휴지통').map(status => (
                                <button
                                    key={status}
                                    onClick={() => handleToggleStatus(status)}
                                    className={`px-3 py-1.5 rounded-lg text-xs font-medium border transition-colors ${!isAllStatuses && selectedStatuses.includes(status) ? 'bg-primary text-primary-foreground border-primary shadow-2xs' : 'bg-card text-muted-foreground border-border hover:text-foreground hover:bg-muted'}`}
                                >
                                    {status}
                                </button>
                            ))}
                        </div>
                    </div>

                    {/* 3. 기간 필터 */}
                    <div className="space-y-3">
                        <div className="flex items-center justify-between">
                            <h3 className="text-xs font-semibold text-foreground flex items-center gap-2 uppercase tracking-wider">
                                <Calendar size={14} className="text-primary" /> 3. 기간 설정
                            </h3>
                            <select 
                                value={dateType} 
                                onChange={(e) => setDateType(e.target.value as ExportDateType)}
                                className="text-xs border border-border rounded-lg py-1 px-2 bg-card text-foreground font-mono"
                            >
                                <option value="createdAt">등록일 기준</option>
                                <option value="statusChangedAt">상태변경일 기준</option>
                                <option value="contractAt">계약일 기준</option>
                            </select>
                        </div>
                        
                        <div className="space-y-2">
                            <label className="flex items-center gap-2 cursor-pointer text-xs text-muted-foreground hover:text-foreground">
                                <input type="radio" name="dateRange" checked={dateRangeType === 'all'} onChange={() => setDateRangeType('all')} className="accent-primary" />
                                <span>전체 기간</span>
                            </label>
                            
                            <label className="flex items-center gap-2 cursor-pointer text-xs text-muted-foreground hover:text-foreground">
                                <input type="radio" name="dateRange" checked={dateRangeType === 'month'} onChange={() => setDateRangeType('month')} className="accent-primary" />
                                <span>월별 선택</span>
                                {dateRangeType === 'month' && (
                                    <input 
                                        type="month" 
                                        value={selectedMonth}
                                        onChange={(e) => setSelectedMonth(e.target.value)}
                                        className="ml-2 text-xs border border-border rounded-lg py-1 px-2 bg-card text-foreground font-mono"
                                    />
                                )}
                            </label>

                            <label className="flex items-center gap-2 cursor-pointer text-xs text-muted-foreground hover:text-foreground">
                                <input type="radio" name="dateRange" checked={dateRangeType === 'custom'} onChange={() => setDateRangeType('custom')} className="accent-primary" />
                                <span>직접 지정</span>
                                {dateRangeType === 'custom' && (
                                    <div className="flex items-center gap-2 ml-2">
                                        <input 
                                            type="date" 
                                            value={customStartDate}
                                            onChange={(e) => setCustomStartDate(e.target.value)}
                                            className="text-xs border border-border rounded-lg py-1 px-2 bg-card text-foreground font-mono"
                                        />
                                        <span className="text-muted-foreground font-mono">~</span>
                                        <input 
                                            type="date" 
                                            value={customEndDate}
                                            onChange={(e) => setCustomEndDate(e.target.value)}
                                            className="text-xs border border-border rounded-lg py-1 px-2 bg-card text-foreground font-mono"
                                        />
                                    </div>
                                )}
                            </label>
                        </div>
                    </div>
                </div>

                {/* Footer */}
                <div className="p-4 border-t border-border flex justify-end gap-2 bg-card shrink-0">
                    <button 
                        onClick={onClose}
                        className="px-4 py-2.5 text-xs font-bold text-foreground bg-secondary hover:bg-muted border border-border rounded-xl transition-colors cursor-pointer shadow-2xs"
                    >
                        취소 / 닫기
                    </button>
                    <button 
                        onClick={handleExport}
                        className="px-5 py-2.5 text-xs font-bold text-primary-foreground bg-primary hover:bg-primary/90 rounded-xl flex items-center gap-1.5 shadow-2xs transition-colors cursor-pointer"
                    >
                        <Download size={14} />
                        다운로드 실행
                    </button>
                </div>
            </div>
        </div>
    );
};
