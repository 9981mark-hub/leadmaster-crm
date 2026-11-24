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
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-background/80 backdrop-blur-xs p-3 sm:p-4 animate-in fade-in duration-200 overflow-y-auto">
            <div className="relative bg-card text-card-foreground w-full max-w-md my-auto rounded-2xl shadow-2xl border border-border overflow-hidden flex flex-col max-h-[85vh]">
                <div className="flex items-center justify-between p-4 border-b border-border bg-card shrink-0">
                    <h3 className="font-bold text-foreground flex items-center gap-2">
                        <div className="w-8 h-8 rounded-lg bg-primary/10 border border-primary/20 text-primary flex items-center justify-center shrink-0">
                            <EyeOff size={16} />
                        </div>
                        보기 설정
                    </h3>
                    <button onClick={onClose} className="p-1.5 rounded-lg text-muted-foreground hover:text-foreground hover:bg-muted transition-colors cursor-pointer">
                        <X size={18} />
                    </button>
                </div>

                <div className="p-3.5 bg-muted/30 border-b border-border text-xs text-muted-foreground shrink-0 break-keep leading-relaxed">
                    <p className="text-foreground/90 font-medium">💡 체크 해제된 상태는 <b>'전체 보기'</b> 목록에서 숨겨집니다.</p>
                    <p className="mt-0.5 text-muted-foreground text-2xs">(단, 필터에서 해당 상태를 직접 선택하면 다시 표시됩니다.)</p>
                </div>

                <div className="flex-1 overflow-y-auto p-4 custom-scrollbar">
                    <div className="flex gap-2 mb-3">
                        <button
                            onClick={handleSelectAll}
                            className="flex-1 py-2 text-xs font-bold bg-secondary hover:bg-muted text-foreground border border-border rounded-xl transition-colors cursor-pointer"
                        >
                            모두 보이기
                        </button>
                        <button
                            onClick={handleDeselectAll}
                            className="flex-1 py-2 text-xs font-bold bg-secondary hover:bg-muted text-foreground border border-border rounded-xl transition-colors cursor-pointer"
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
                                    className={`flex items-center justify-between p-3 rounded-xl border cursor-pointer transition-all ${isVisible
                                            ? 'bg-card border-primary/40 shadow-2xs ring-1 ring-primary/20'
                                            : 'bg-muted/20 border-border text-muted-foreground hover:bg-muted/40'
                                        }`}
                                >
                                    <div className="flex items-center gap-3">
                                        <div className={`w-5 h-5 rounded-md flex items-center justify-center border transition-colors ${isVisible
                                                ? 'bg-primary border-primary text-primary-foreground'
                                                : 'bg-card border-border text-transparent'
                                            }`}>
                                            {isVisible && <Check size={14} strokeWidth={3} />}
                                        </div>
                                        <span className={`font-semibold text-xs sm:text-sm ${isVisible ? 'text-foreground' : 'text-muted-foreground'}`}>
                                            {status}
                                        </span>
                                    </div>
                                    <input
                                        type="checkbox"
                                        className="hidden"
                                        checked={isVisible}
                                        onChange={() => onToggleStatus(status)}
                                    />
                                    {isHidden && <span className="text-2xs text-rose-500 font-bold px-1.5 py-0.5 bg-rose-500/10 rounded border border-rose-500/20">숨김</span>}
                                </label>
                            );
                        })}
                    </div>
                </div>

                <div className="p-4 border-t border-border bg-card shrink-0 flex items-center justify-end gap-2">
                    <button
                        type="button"
                        onClick={onClose}
                        className="px-4 py-2.5 border border-border bg-secondary hover:bg-muted text-foreground font-bold rounded-xl shadow-2xs transition-all cursor-pointer text-xs sm:text-sm"
                    >
                        닫기
                    </button>
                    <button
                        type="button"
                        onClick={onClose}
                        className="px-6 py-2.5 bg-primary hover:bg-primary/90 text-primary-foreground font-bold rounded-xl shadow-2xs transition-all active:scale-95 cursor-pointer text-xs sm:text-sm"
                    >
                        적용 완료
                    </button>
                </div>
            </div>
        </div>
    );
}
