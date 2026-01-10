import React from 'react';
import { X, Check, EyeOff } from 'lucide-react';

interface StatusVisibilityModalProps {
    isOpen: boolean;
    onClose: () => void;
    allStatuses: string[];
    hiddenStatuses: string[];
    onToggleStatus: (status: string) => void;
}

export default function StatusVisibilityModal({
    isOpen,
    onClose,
    allStatuses,
    hiddenStatuses,
    onToggleStatus
}: StatusVisibilityModalProps) {
    if (!isOpen) return null;

    const handleSelectAll = () => {
        // Unhide all (clear hidden list)
        allStatuses.forEach(s => {
            if (hiddenStatuses.includes(s)) onToggleStatus(s);
        });
    };

    const handleDeselectAll = () => {
        // Hide all (add all to hidden list if not present)
        allStatuses.forEach(s => {
            if (!hiddenStatuses.includes(s)) onToggleStatus(s);
        });
    };

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-4 animate-fade-in">
            <div className="bg-white dark:bg-gray-800 w-full max-w-md rounded-2xl shadow-xl border border-gray-100 dark:border-gray-700 overflow-hidden flex flex-col max-h-[90vh]">
                <div className="flex items-center justify-between p-4 border-b border-gray-100 dark:border-gray-700 bg-gray-50/50 dark:bg-gray-900/50">
                    <h3 className="font-bold text-gray-800 dark:text-white flex items-center gap-2">
                        <EyeOff className="text-gray-500" size={20} />
                        보기 설정
                    </h3>
                    <button onClick={onClose} className="p-2 hover:bg-gray-200 dark:hover:bg-gray-700 rounded-full transition-colors">
                        <X size={20} className="text-gray-500" />
                    </button>
                </div>

                <div className="p-4 bg-blue-50 dark:bg-blue-900/20 text-xs text-blue-800 dark:text-blue-300">
                    <p>💡 체크 해제된 상태는 <b>'전체 보기'</b> 목록에서 숨겨집니다.</p>
                    <p className="mt-1 opacity-75">(단, 필터에서 해당 상태를 직접 선택하면 다시 표시됩니다.)</p>
                </div>

                <div className="flex-1 overflow-y-auto p-4 custom-scrollbar">
                    <div className="flex gap-2 mb-4">
                        <button
                            onClick={handleSelectAll}
                            className="flex-1 py-2 text-xs font-bold bg-gray-100 hover:bg-gray-200 dark:bg-gray-700 dark:hover:bg-gray-600 text-gray-700 dark:text-gray-300 rounded-lg transition-colors"
                        >
                            모두 보이기
                        </button>
                        <button
                            onClick={handleDeselectAll}
                            className="flex-1 py-2 text-xs font-bold bg-gray-100 hover:bg-gray-200 dark:bg-gray-700 dark:hover:bg-gray-600 text-gray-700 dark:text-gray-300 rounded-lg transition-colors"
                        >
                            모두 숨기기
                        </button>
                    </div>

                    <div className="grid grid-cols-1 gap-2">
                        {allStatuses.map(status => {
                            const isHidden = hiddenStatuses.includes(status);
                            const isVisible = !isHidden;

                            return (
                                <label
                                    key={status}
                                    className={`flex items-center justify-between p-3 rounded-lg border cursor-pointer transition-all ${isVisible
                                            ? 'bg-white border-blue-200 shadow-sm ring-1 ring-blue-100 dark:bg-gray-700 dark:border-blue-500/50'
                                            : 'bg-gray-50 border-gray-100 text-gray-400 dark:bg-gray-800 dark:border-gray-700'
                                        }`}
                                >
                                    <div className="flex items-center gap-3">
                                        <div className={`w-5 h-5 rounded flex items-center justify-center border transition-colors ${isVisible
                                                ? 'bg-blue-500 border-blue-600 text-white'
                                                : 'bg-white border-gray-300 dark:bg-gray-800 dark:border-gray-600'
                                            }`}>
                                            {isVisible && <Check size={14} strokeWidth={3} />}
                                        </div>
                                        <span className={`font-medium ${isVisible ? 'text-gray-800 dark:text-white' : 'text-gray-400'}`}>
                                            {status}
                                        </span>
                                    </div>
                                    <input
                                        type="checkbox"
                                        className="hidden"
                                        checked={isVisible}
                                        onChange={() => onToggleStatus(status)}
                                    />
                                    {isHidden && <span className="text-xs text-red-400 font-bold">숨김</span>}
                                </label>
                            );
                        })}
                    </div>
                </div>

                <div className="p-4 border-t border-gray-100 dark:border-gray-700 bg-gray-50/50 dark:bg-gray-900/50 flex justify-end">
                    <button
                        onClick={onClose}
                        className="px-6 py-2.5 bg-blue-600 hover:bg-blue-700 text-white font-bold rounded-xl shadow-lg shadow-blue-500/20 transition-all active:scale-95"
                    >
                        완료
                    </button>
                </div>
            </div>
        </div>
    );
}
