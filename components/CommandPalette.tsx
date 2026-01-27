import React, { useEffect, useState, useMemo } from 'react';
import { Command } from 'cmdk';
import { useNavigate } from 'react-router-dom';
import { fetchCases, fetchStatuses, updateCase } from '../services/api';
import { Case } from '../types';
import { Search, Calculator, Calendar, User, Phone, FileText, Zap, ChevronRight, CheckCircle } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { useToast } from '../contexts/ToastContext';

export const CommandPalette = () => {
    const [open, setOpen] = useState(false);
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
                <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm">
                    <motion.div
                        initial={{ opacity: 0, scale: 0.95 }}
                        animate={{ opacity: 1, scale: 1 }}
                        exit={{ opacity: 0, scale: 0.95 }}
                        className="w-full max-w-2xl bg-white dark:bg-gray-800 rounded-xl shadow-2xl border border-gray-200 dark:border-gray-700 overflow-hidden"
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
                            <div className="flex items-center border-b border-gray-100 dark:border-gray-700 px-4">
                                {page !== 'root' && (
                                    <button
                                        onClick={() => {
                                            if (page === 'status-select') setPage('status-case-select');
                                            else setPage('root');
                                        }}
                                        className="mr-2 p-1 hover:bg-gray-100 rounded text-gray-500"
                                    >
                                        <ChevronLeftIcon />
                                    </button>
                                )}
                                <Search className="w-5 h-5 text-gray-400 mr-2" />
                                <Command.Input
                                    value={search}
                                    onValueChange={setSearch}
                                    className="w-full p-4 bg-transparent outline-none text-gray-800 dark:text-gray-100 placeholder-gray-400"
                                    placeholder={
                                        page === 'root' ? "검색할 내용을 입력하세요 (고객명, 전화번호, 기능)..." :
                                            page === 'status-case-select' ? "상태를 변경할 고객을 검색..." :
                                                "변경할 상태 선택..."
                                    }
                                />
                            </div>
                            <Command.List className="max-h-[60vh] overflow-y-auto p-2 scrollbar-hide">
                                <Command.Empty className="p-4 text-center text-gray-500">검색 결과가 없습니다.</Command.Empty>

                                {page === 'root' && (
                                    <>
                                        <Command.Group heading="빠른 실행" className="text-xs font-semibold text-gray-500 mb-2 px-2">
                                            <Command.Item
                                                onSelect={() => {
                                                    setPage('status-case-select');
                                                    setSearch('');
                                                }}
                                                className="flex items-center p-2 rounded-lg cursor-pointer hover:bg-gray-100 dark:hover:bg-gray-700 data-[selected=true]:bg-blue-50 dark:data-[selected=true]:bg-blue-900/20 data-[selected=true]:text-blue-600"
                                            >
                                                <div className="bg-orange-100 p-1.5 rounded mr-3 text-orange-600"><Zap size={16} /></div>
                                                <div className="flex flex-col">
                                                    <span className="text-sm font-medium">상태 빠른 변경</span>
                                                    <span className="text-[10px] text-gray-400">검색 없이 즉시 사건 상태 업데이트</span>
                                                </div>
                                                <ChevronRight className="ml-auto w-4 h-4 text-gray-400" />
                                            </Command.Item>
                                        </Command.Group>

                                        <Command.Group heading="페이지 이동" className="text-xs font-semibold text-gray-500 mb-2 px-2">
                                            <Command.Item
                                                onSelect={() => runCommand(() => navigate('/'))}
                                                className="flex items-center p-2 rounded-lg cursor-pointer hover:bg-gray-100 dark:hover:bg-gray-700 data-[selected=true]:bg-blue-50 dark:data-[selected=true]:bg-blue-900/20 data-[selected=true]:text-blue-600"
                                            >
                                                <div className="bg-blue-100 p-1.5 rounded mr-3 text-blue-600"><Calculator size={16} /></div>
                                                <span className="text-sm font-medium">대시보드</span>
                                            </Command.Item>
                                            <Command.Item
                                                onSelect={() => runCommand(() => navigate('/cases'))}
                                                className="flex items-center p-2 rounded-lg cursor-pointer hover:bg-gray-100 dark:hover:bg-gray-700 data-[selected=true]:bg-blue-50 dark:data-[selected=true]:bg-blue-900/20 data-[selected=true]:text-blue-600"
                                            >
                                                <div className="bg-purple-100 p-1.5 rounded mr-3 text-purple-600"><FileText size={16} /></div>
                                                <span className="text-sm font-medium">케이스 관리</span>
                                            </Command.Item>
                                            <Command.Item
                                                onSelect={() => runCommand(() => navigate('/new'))}
                                                className="flex items-center p-2 rounded-lg cursor-pointer hover:bg-gray-100 dark:hover:bg-gray-700 data-[selected=true]:bg-blue-50 dark:data-[selected=true]:bg-blue-900/20 data-[selected=true]:text-blue-600"
                                            >
                                                <div className="bg-green-100 p-1.5 rounded mr-3 text-green-600"><User size={16} /></div>
                                                <span className="text-sm font-medium">신규 접수 등록</span>
                                            </Command.Item>
                                        </Command.Group>

                                        <Command.Group heading="최근 고객" className="text-xs font-semibold text-gray-500 mb-2 px-2 mt-2">
                                            {cases.slice(0, 5).map(c => (
                                                <Command.Item
                                                    key={c.caseId}
                                                    onSelect={() => runCommand(() => navigate(`/case/${c.caseId}`))}
                                                    className="flex items-center p-2 rounded-lg cursor-pointer hover:bg-gray-100 dark:hover:bg-gray-700 data-[selected=true]:bg-blue-50 dark:data-[selected=true]:bg-blue-900/20 data-[selected=true]:text-blue-600"
                                                >
                                                    <div className="bg-gray-100 dark:bg-gray-700 p-1.5 rounded mr-3 text-gray-600 dark:text-gray-300"><User size={16} /></div>
                                                    <div className="flex flex-col">
                                                        <span className="text-sm font-medium text-gray-800 dark:text-gray-200">{c.customerName}</span>
                                                        <span className="text-xs text-gray-500">{c.phone} | {c.status}</span>
                                                    </div>
                                                </Command.Item>
                                            ))}
                                        </Command.Group>
                                    </>
                                )}

                                {page === 'status-case-select' && (
                                    <Command.Group heading="고객 선택 (상태 변경)" className="text-xs font-semibold text-gray-500 mb-2 px-2">
                                        {filteredCases.slice(0, 20).map(c => (
                                            <Command.Item
                                                key={'status-' + c.caseId}
                                                onSelect={() => {
                                                    setSelectedCaseId(c.caseId);
                                                    setPage('status-select');
                                                    setSearch('');
                                                }}
                                                className="flex items-center p-2 rounded-lg cursor-pointer hover:bg-gray-100 dark:hover:bg-gray-700 data-[selected=true]:bg-blue-50 dark:data-[selected=true]:bg-blue-900/20 data-[selected=true]:text-blue-600"
                                            >
                                                <div className="bg-gray-100 dark:bg-gray-700 p-1.5 rounded mr-3 text-gray-600 dark:text-gray-300"><User size={16} /></div>
                                                <div className="flex flex-col">
                                                    <span className="text-sm font-medium text-gray-800 dark:text-gray-200">{c.customerName}</span>
                                                    <span className="text-xs text-gray-500">{c.phone} | 현재: {c.status}</span>
                                                </div>
                                                <ChevronRight className="ml-auto w-4 h-4 text-gray-400" />
                                            </Command.Item>
                                        ))}
                                    </Command.Group>
                                )}

                                {page === 'status-select' && (
                                    <Command.Group heading="변경할 상태 선택" className="text-xs font-semibold text-gray-500 mb-2 px-2">
                                        {statuses.filter(s => s !== '휴지통').map(status => (
                                            <Command.Item
                                                key={status}
                                                onSelect={() => handleStatusUpdate(status)}
                                                className="flex items-center p-2 rounded-lg cursor-pointer hover:bg-gray-100 dark:hover:bg-gray-700 data-[selected=true]:bg-blue-50 dark:data-[selected=true]:bg-blue-900/20 data-[selected=true]:text-blue-600"
                                            >
                                                <div className="bg-gray-100 p-1.5 rounded mr-3 text-gray-600"><CheckCircle size={16} /></div>
                                                <span className="text-sm font-medium text-gray-800">{status}</span>
                                            </Command.Item>
                                        ))}
                                    </Command.Group>
                                )}

                            </Command.List>
                            <div className="border-t border-gray-100 dark:border-gray-700 p-2 px-4 flex justify-between items-center text-[10px] text-gray-400 bg-gray-50 dark:bg-gray-900/50">
                                <span>선택: ↵</span>
                                <span>이동: ↑↓</span>
                                <span>뒤로: Bksp</span>
                                <span>닫기: ESC</span>
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
