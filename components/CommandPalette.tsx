import React, { useEffect, useState } from 'react';
import { Command } from 'cmdk';
import { useNavigate } from 'react-router-dom';
import { fetchCases } from '../services/api';
import { Case } from '../types';
import { Search, Calculator, Calendar, User, Phone, FileText } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';

export const CommandPalette = () => {
    const [open, setOpen] = useState(false);
    const [cases, setCases] = useState<Case[]>([]);
    const navigate = useNavigate();

    // Toggle with Cmd+K or Ctrl+K
    useEffect(() => {
        const down = (e: KeyboardEvent) => {
            if (e.key === 'k' && (e.metaKey || e.ctrlKey)) {
                e.preventDefault();
                setOpen((open) => !open);
            }
        };
        document.addEventListener('keydown', down);
        return () => document.removeEventListener('keydown', down);
    }, []);

    // Fetch data when opening to ensure freshness
    useEffect(() => {
        if (open) {
            fetchCases().then(setCases);
        }
    }, [open]);

    const runCommand = (command: () => void) => {
        setOpen(false);
        command();
    };

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
                        <Command className="w-full">
                            <div className="flex items-center border-b border-gray-100 dark:border-gray-700 px-4">
                                <Search className="w-5 h-5 text-gray-400 mr-2" />
                                <Command.Input
                                    className="w-full p-4 bg-transparent outline-none text-gray-800 dark:text-gray-100 placeholder-gray-400"
                                    placeholder="검색할 내용을 입력하세요 (고객명, 전화번호, 기능)..."
                                />
                            </div>
                            <Command.List className="max-h-[60vh] overflow-y-auto p-2 scrollbar-hide">
                                <Command.Empty className="p-4 text-center text-gray-500">검색 결과가 없습니다.</Command.Empty>

                                <Command.Group heading="빠른 이동" className="text-xs font-semibold text-gray-500 mb-2 px-2">
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

                                <Command.Group heading="전체 고객 검색" className="text-xs font-semibold text-gray-500 mb-2 px-2 mt-2">
                                    {cases.map(c => (
                                        <Command.Item
                                            key={`all-${c.caseId}`}
                                            value={`${c.customerName} ${c.phone}`}
                                            onSelect={() => runCommand(() => navigate(`/case/${c.caseId}`))}
                                            className="hidden data-[selected=true]:flex items-center p-2 rounded-lg cursor-pointer hover:bg-gray-100 dark:hover:bg-gray-700 data-[selected=true]:bg-blue-50 dark:data-[selected=true]:bg-blue-900/20 data-[selected=true]:text-blue-600"
                                        >
                                            <div className="bg-gray-100 dark:bg-gray-700 p-1.5 rounded mr-3 text-gray-600 dark:text-gray-300"><Search size={16} /></div>
                                            <div className="flex flex-col">
                                                <span className="text-sm font-medium text-gray-800 dark:text-gray-200">{c.customerName}</span>
                                                <span className="text-xs text-gray-500">{c.phone}</span>
                                            </div>
                                        </Command.Item>
                                    ))}
                                </Command.Group>
                            </Command.List>
                            <div className="border-t border-gray-100 dark:border-gray-700 p-2 px-4 flex justify-between items-center text-[10px] text-gray-400 bg-gray-50 dark:bg-gray-900/50">
                                <span>선택: ↵</span>
                                <span>이동: ↑↓</span>
                                <span>닫기: ESC</span>
                            </div>
                        </Command>
                    </motion.div>
                </div>
            )}
        </AnimatePresence>
    );
};
