import React, { useEffect, useState, useMemo } from 'react';
import { Command } from 'cmdk';
import { useNavigate } from 'react-router-dom';
import { fetchCases, fetchStatuses, updateCase } from '../services/api';
import { Case } from '../types';
import { Search, Calculator, Calendar, User, Phone, FileText, Zap, ChevronRight, CheckCircle } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { useToast } from '../contexts/ToastContext';

interface CommandPaletteProps {
    /** 바깥 버튼(⌘)으로 열 때. 없으면 Ctrl+K로만 연다 */
    isOpen?: boolean;
    onClose?: () => void;
}

export const CommandPalette: React.FC<CommandPaletteProps> = ({ isOpen, onClose }) => {
    const [open, setOpenRaw] = useState(false);
    // [2026-11-02] 예전엔 isOpen을 안 받아서 상세 화면 ⌘ 버튼이 아무 반응이 없었다. 닫힐 때 바깥에도 알린다
    const setOpen = (v: boolean | ((o: boolean) => boolean)) => {
        setOpenRaw(prev => {
            const next = typeof v === 'function' ? v(prev) : v;
            if (prev && !next) setTimeout(() => onClose?.(), 0);
            return next;
        });
    };
    useEffect(() => {
        if (isOpen) {
            setPage('root');
            setSearch('');
            setOpenRaw(true);
        }
    }, [isOpen]);
    // ESC로 닫기 (아래 안내 문구대로)
    useEffect(() => {
        if (!open) return;
        const esc = (e: KeyboardEvent) => { if (e.key === 'Escape') { e.preventDefault(); setOpen(false); } };
        document.addEventListener('keydown', esc);
        return () => document.removeEventListener('keydown', esc);
    }, [open]);
    const [cases, setCases] = useState<Case[]>([]);
    const [statuses, setStatuses] = useState<string[]>([]);
    const [page, setPage] = useState<'root' | 'status-case-select' | 'status-select'>('root');
    const [selectedCaseId, setSelectedCaseId] = useState<string | null>(null);
    const [search, setSearch] = useState('');

    const navigate = useNavigate();
    const { showToast } = useToast();

    // Toggle with Cmd+K or Ctrl+K
    useEffect(() => {
        const down = (e: KeyboardEvent) => {
            if (e.key === 'k' && (e.metaKey || e.ctrlKey)) {
                e.preventDefault();
                setOpen((open) => {
                    if (!open) {
                        setPage('root');
                        setSearch('');
                    }
                    return !open;
                });
            }
        };
        document.addEventListener('keydown', down);
        return () => document.removeEventListener('keydown', down);
    }, []);

    // Fetch data when opening
    useEffect(() => {
        if (open) {
            fetchCases().then(setCases);
            fetchStatuses().then(setStatuses);
        }
    }, [open]);

    const runCommand = (command: () => void) => {
        setOpen(false);
        command();
    };

    const handleStatusUpdate = async (newStatus: string) => {
        if (!selectedCaseId) return;

        // Optimistic UI update for local list (optional but good for UX if checking again)
        const caseToUpdate = cases.find(c => c.caseId === selectedCaseId);
        const oldStatus = caseToUpdate?.status;

        try {
            await updateCase(selectedCaseId, { status: newStatus });
            showToast(`${caseToUpdate?.customerName}님의 상태가 ${newStatus}(으)로 변경되었습니다.`, 'success');
            setOpen(false);
            setPage('root');
            // Refresh cases in background
            fetchCases().then(setCases);
        } catch (error) {
            console.error("Failed to update status", error);
            showToast('상태 변경에 실패했습니다.', 'error');
        }
    };

    // Filter cases for sub-pages to allow searching within the context
    const filteredCases = useMemo(() => {
        if (!search) return cases;
        const lower = search.toLowerCase();
        return cases.filter(c =>
            c.customerName.toLowerCase().includes(lower) ||
            c.phone.includes(lower)
        );
    }, [cases, search]);

    if (!open) return null;

    return (
        <AnimatePresence>
            {open && (
                <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm" onClick={() => setOpen(false)}>
                    <motion.div
                        onClick={e => e.stopPropagation()}
                        initial={{ opacity: 0, scale: 0.96, y: -8 }}
                        animate={{ opacity: 1, scale: 1, y: 0 }}
                        exit={{ opacity: 0, scale: 0.96, y: -8 }}
                        transition={{ duration: 0.15 }}
                        className="w-full max-w-2xl bg-card text-card-foreground rounded-2xl shadow-2xl border border-border overflow-hidden"
                    >
                        <Command
                            className="w-full"
                            onKeyDown={(e) => {
                                if (e.key === 'Backspace' && !search) {
                                    e.preventDefault();
                                    if (page === 'status-select') setPage('status-case-select');
                                    if (page === 'status-case-select') setPage('root');
                                }
                            }}
                        >
                            <div className="flex items-center border-b border-border px-4 py-0.5 bg-card">
                                {page !== 'root' && (
                                    <button
                                        onClick={() => {
                                            if (page === 'status-select') setPage('status-case-select');
                                            else setPage('root');
                                        }}
                                        className="mr-2 p-1.5 hover:bg-muted text-muted-foreground hover:text-foreground rounded-lg transition-colors cursor-pointer"
                                    >
                                        <ChevronLeftIcon />
                                    </button>
                                )}
                                <Search className="w-5 h-5 text-muted-foreground mr-3 shrink-0" />
                                <Command.Input
                                    value={search}
                                    onValueChange={setSearch}
                                    className="w-full py-4 text-sm bg-transparent outline-none text-foreground placeholder:text-muted-foreground font-sans"
                                    placeholder={
                                        page === 'root' ? "검색할 내용을 입력하세요 (고객명, 전화번호, 기능)..." :
                                            page === 'status-case-select' ? "상태를 변경할 고객을 검색..." :
                                                "변경할 상태 선택..."
                                    }
                                />
                            </div>
                            <Command.List className="max-h-[60vh] overflow-y-auto p-2.5 scrollbar-hide space-y-1">
                                <Command.Empty className="py-12 text-center text-xs font-mono text-muted-foreground">검색 결과가 없습니다.</Command.Empty>

                                {page === 'root' && (
                                    <>
                                        <Command.Group heading="빠른 실행" className="text-2xs font-semibold uppercase tracking-wider text-muted-foreground mb-1 px-2 font-mono">
                                            <Command.Item
                                                onSelect={() => {
                                                    setPage('status-case-select');
                                                    setSearch('');
                                                }}
                                                className="group flex items-center gap-3 p-2.5 rounded-lg cursor-pointer transition-colors text-foreground hover:bg-muted/50 data-[selected=true]:bg-primary/15 data-[selected=true]:text-primary border border-transparent data-[selected=true]:border-primary/25"
                                            >
                                                <div className="w-7 h-7 rounded-md bg-amber-500/10 text-amber-500 border border-amber-500/20 flex items-center justify-center shrink-0">
                                                    <Zap size={15} />
                                                </div>
                                                <div className="flex flex-col min-w-0">
                                                    <span className="text-sm font-medium">상태 빠른 변경</span>
                                                    <span className="text-xs text-muted-foreground font-mono">검색 없이 즉시 사건 상태 업데이트</span>
                                                </div>
                                                <ChevronRight className="ml-auto w-4 h-4 text-muted-foreground" />
                                            </Command.Item>
                                        </Command.Group>

                                        <Command.Group heading="페이지 이동" className="text-2xs font-semibold uppercase tracking-wider text-muted-foreground mb-1 px-2 font-mono mt-2">
                                            <Command.Item
                                                onSelect={() => runCommand(() => navigate('/'))}
                                                className="group flex items-center gap-3 p-2.5 rounded-lg cursor-pointer transition-colors text-foreground hover:bg-muted/50 data-[selected=true]:bg-primary/15 data-[selected=true]:text-primary border border-transparent data-[selected=true]:border-primary/25"
                                            >
                                                <div className="w-7 h-7 rounded-md bg-primary/10 text-primary border border-primary/20 flex items-center justify-center shrink-0">
                                                    <Calculator size={15} />
                                                </div>
                                                <span className="text-sm font-medium">대시보드</span>
                                            </Command.Item>
                                            <Command.Item
                                                onSelect={() => runCommand(() => navigate('/cases'))}
                                                className="group flex items-center gap-3 p-2.5 rounded-lg cursor-pointer transition-colors text-foreground hover:bg-muted/50 data-[selected=true]:bg-primary/15 data-[selected=true]:text-primary border border-transparent data-[selected=true]:border-primary/25"
                                            >
                                                <div className="w-7 h-7 rounded-md bg-indigo-500/10 text-indigo-400 border border-indigo-500/20 flex items-center justify-center shrink-0">
                                                    <FileText size={15} />
                                                </div>
                                                <span className="text-sm font-medium">케이스 관리</span>
                                            </Command.Item>
                                            <Command.Item
                                                onSelect={() => runCommand(() => navigate('/new'))}
                                                className="group flex items-center gap-3 p-2.5 rounded-lg cursor-pointer transition-colors text-foreground hover:bg-muted/50 data-[selected=true]:bg-primary/15 data-[selected=true]:text-primary border border-transparent data-[selected=true]:border-primary/25"
                                            >
                                                <div className="w-7 h-7 rounded-md bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 flex items-center justify-center shrink-0">
                                                    <User size={15} />
                                                </div>
                                                <span className="text-sm font-medium">신규 접수 등록</span>
                                            </Command.Item>
                                        </Command.Group>

                                        <Command.Group heading="최근 고객" className="text-2xs font-semibold uppercase tracking-wider text-muted-foreground mb-1 px-2 font-mono mt-2">
                                            {cases.slice(0, 5).map(c => (
                                                <Command.Item
                                                    key={c.caseId}
                                                    onSelect={() => runCommand(() => navigate(`/case/${c.caseId}`))}
                                                    className="group flex items-center gap-3 p-2.5 rounded-lg cursor-pointer transition-colors text-foreground hover:bg-muted/50 data-[selected=true]:bg-primary/15 data-[selected=true]:text-primary border border-transparent data-[selected=true]:border-primary/25"
                                                >
                                                    <div className="w-7 h-7 rounded-md bg-muted text-muted-foreground border border-border flex items-center justify-center shrink-0">
                                                        <User size={15} />
                                                    </div>
                                                    <div className="flex flex-col min-w-0">
                                                        <span className="text-sm font-medium">{c.customerName}</span>
                                                        <span className="text-xs text-muted-foreground font-mono">{c.phone} · {c.status}</span>
                                                    </div>
                                                </Command.Item>
                                            ))}
                                        </Command.Group>
                                    </>
                                )}

                                {page === 'status-case-select' && (
                                    <Command.Group heading="고객 선택 (상태 변경)" className="text-2xs font-semibold uppercase tracking-wider text-muted-foreground mb-1 px-2 font-mono">
                                        {filteredCases.slice(0, 20).map(c => (
                                            <Command.Item
                                                key={'status-' + c.caseId}
                                                onSelect={() => {
                                                    setSelectedCaseId(c.caseId);
                                                    setPage('status-select');
                                                    setSearch('');
                                                }}
                                                className="group flex items-center gap-3 p-2.5 rounded-lg cursor-pointer transition-colors text-foreground hover:bg-muted/50 data-[selected=true]:bg-primary/15 data-[selected=true]:text-primary border border-transparent data-[selected=true]:border-primary/25"
                                            >
                                                <div className="w-7 h-7 rounded-md bg-muted text-muted-foreground border border-border flex items-center justify-center shrink-0">
                                                    <User size={15} />
                                                </div>
                                                <div className="flex flex-col min-w-0">
                                                    <span className="text-sm font-medium">{c.customerName}</span>
                                                    <span className="text-xs text-muted-foreground font-mono">{c.phone} · 현재: {c.status}</span>
                                                </div>
                                                <ChevronRight className="ml-auto w-4 h-4 text-muted-foreground" />
                                            </Command.Item>
                                        ))}
                                    </Command.Group>
                                )}

                                {page === 'status-select' && (
                                    <Command.Group heading="변경할 상태 선택" className="text-2xs font-semibold uppercase tracking-wider text-muted-foreground mb-1 px-2 font-mono">
                                        {statuses.filter(s => s !== '휴지통').map(status => (
                                            <Command.Item
                                                key={status}
                                                onSelect={() => handleStatusUpdate(status)}
                                                className="group flex items-center gap-3 p-2.5 rounded-lg cursor-pointer transition-colors text-foreground hover:bg-muted/50 data-[selected=true]:bg-primary/15 data-[selected=true]:text-primary border border-transparent data-[selected=true]:border-primary/25"
                                            >
                                                <div className="w-7 h-7 rounded-md bg-primary/10 text-primary border border-primary/20 flex items-center justify-center shrink-0">
                                                    <CheckCircle size={15} />
                                                </div>
                                                <span className="text-sm font-medium">{status}</span>
                                            </Command.Item>
                                        ))}
                                    </Command.Group>
                                )}

                            </Command.List>
                            <div className="border-t border-border p-2.5 px-4 flex justify-between items-center text-xs text-muted-foreground bg-muted/30 font-mono">
                                <span className="flex items-center gap-1.5"><kbd className="px-1.5 py-0.5 rounded bg-muted border border-border text-2xs font-semibold">↵</kbd> 선택</span>
                                <span className="flex items-center gap-1.5"><kbd className="px-1.5 py-0.5 rounded bg-muted border border-border text-2xs font-semibold">↑↓</kbd> 이동</span>
                                <span className="flex items-center gap-1.5"><kbd className="px-1.5 py-0.5 rounded bg-muted border border-border text-2xs font-semibold">Bksp</kbd> 뒤로</span>
                                <span className="flex items-center gap-1.5"><kbd className="px-1.5 py-0.5 rounded bg-muted border border-border text-2xs font-semibold">ESC</kbd> 닫기</span>
                            </div>
                        </Command>
                    </motion.div>
                </div>
            )}
        </AnimatePresence>
    );
};

const ChevronLeftIcon = () => (
    <svg width="15" height="15" viewBox="0 0 15 15" fill="none" xmlns="http://www.w3.org/2000/svg" className="w-4 h-4"><path d="M8.84182 3.13514C9.04327 3.32401 9.05348 3.64042 8.86462 3.84188L5.43521 7.49991L8.86462 11.1579C9.05348 11.3594 9.04327 11.6758 8.84182 11.8647C8.64036 12.0535 8.32394 12.0433 8.13508 11.8419L4.38508 7.84188C4.20477 7.64955 4.20477 7.35027 4.38508 7.15794L8.13508 3.15794C8.32394 2.95648 8.64036 2.94628 8.84182 3.13514Z" fill="currentColor" fillRule="evenodd" clipRule="evenodd"></path></svg>
);
