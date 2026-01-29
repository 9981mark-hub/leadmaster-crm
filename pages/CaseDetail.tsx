import React, { useState, useEffect, useRef } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { ArrowLeft, Layout } from 'lucide-react';
import { Case, CaseStatus, ReminderItem, MemoItem, RecordingItem } from '../types';
import { useCase, usePartners, useInboundPaths, useStatuses, useSecondaryStatuses, useUpdateCaseMutation } from '../services/queries';
import { calculateCommission, generateAiSummary, convertToPlayableUrl } from '../utils';
import { CommandPalette } from '../components/CommandPalette';
// Sub-components
import { CaseDetailHeader } from '../components/case-detail/CaseDetailHeader';
import { CaseInfoTab } from '../components/case-detail/info/CaseInfoTab';
import { CaseSummaryTab } from '../components/case-detail/CaseSummaryTab';
import { CaseSettlementTab } from '../components/case-detail/CaseSettlementTab';

export default function CaseDetail() {
    const { caseId } = useParams();
    const id = caseId; // Alias for compatibility with existing code
    const navigate = useNavigate();

    // Data Fetching
    const { data: c, isLoading, error } = useCase(id!);
    const { data: partners = [] } = usePartners();
    const { data: inboundPaths = [] } = useInboundPaths();
    const { data: statuses = [] } = useStatuses();
    const { data: globalSecondaryStatuses = [] } = useSecondaryStatuses();
    const updateCaseMutation = useUpdateCaseMutation();

    // UI State
    const [activeTab, setActiveTab] = useState<'info' | 'summary' | 'settlement'>('info');
    const [toast, setToast] = useState<{ msg: string, type: 'success' | 'error' } | null>(null);
    const [isCmdPaletteOpen, setIsCmdPaletteOpen] = useState(false);

    // Status Change Modal State
    const [isSecondaryStatusModalOpen, setIsSecondaryStatusModalOpen] = useState(false);
    const [pendingSecondaryStatus, setPendingSecondaryStatus] = useState<string | null>(null);
    const [secondaryStatusChangeReason, setSecondaryStatusChangeReason] = useState('');
    const [secondaryStatuses, setSecondaryStatuses] = useState<string[]>([]);

    // [New] Primary Status Change Modal State
    const [isPrimaryStatusModalOpen, setIsPrimaryStatusModalOpen] = useState(false);
    const [pendingPrimaryStatus, setPendingPrimaryStatus] = useState<CaseStatus | null>(null);
    const [primaryStatusChangeReason, setPrimaryStatusChangeReason] = useState('');

    // AI Summary & Audio State (Managed here to share between tabs if needed, though primarily allowed in Info)
    const [aiSummaryText, setAiSummaryText] = useState<string | null>(null);
    const [aiSummaryEditMode, setAiSummaryEditMode] = useState(false);
    const [isAiLoading, setIsAiLoading] = useState(false);
    const [currentAudioFile, setCurrentAudioFile] = useState<File | null>(null);
    const [audioUrl, setAudioUrl] = useState<string | null>(null);
    const [isFileUploading, setIsFileUploading] = useState(false);

    // Initialize state from fetched data
    useEffect(() => {
        if (c) {
            setAiSummaryText(c.aiSummary || null);
            if (c.status === '사무장 접수') {
                // [Fix] Use global dynamic list instead of hardcoded
                setSecondaryStatuses(globalSecondaryStatuses.length > 0 ? globalSecondaryStatuses : []);
            } else {
                setSecondaryStatuses([]);
            }
        }
    }, [c, globalSecondaryStatuses]);

    // [Refactor Restore] Mark as viewed on mount


    // Derived Data
    const currentPartner = partners.find(p => p.partnerId === c?.partnerId);
    const commission = c ? calculateCommission(c.contractFee || 0, currentPartner?.commissionRules || []) : 0;

    // Toast Helper
    const showToast = (msg: string, type: 'success' | 'error' = 'success') => {
        setToast({ msg, type });
        setTimeout(() => setToast(null), 3000);
    };

    // Global Command Palette Shortcut
    useEffect(() => {
        const handleKeyDown = (e: KeyboardEvent) => {
            if ((e.metaKey || e.ctrlKey) && e.key === 'k') {
                e.preventDefault();
                setIsCmdPaletteOpen(true);
            }
        };
        window.addEventListener('keydown', handleKeyDown);
        return () => window.removeEventListener('keydown', handleKeyDown);
    }, []);

    // Handlers
    const handleUpdate = (field: string, value: any) => {
        if (!c) return;
        updateCaseMutation.mutate({
            id: c.caseId,
            updates: { [field]: value },
            silent: true
        });
    };

    const handleIncomeChange = (type: 'salary' | 'business' | 'freelance', value: any) => {
        if (!c) return;
        const newIncomeDetails = { ...c.incomeDetails, [type]: value };
        handleUpdate('incomeDetails', newIncomeDetails);
    };

    const handleJobTypeChange = (value: string) => {
        if (!c) return;
        let newTypes = c.jobTypes ? [...c.jobTypes] : [];
        if (newTypes.includes(value)) {
            newTypes = newTypes.filter(t => t !== value);
        } else {
            newTypes.push(value);
        }
        handleUpdate('jobTypes', newTypes);
    };

    const handleUpdateReminders = (reminders: ReminderItem[]) => {
        handleUpdate('reminders', reminders);
    };

    const handleUpdateMemos = (memos: MemoItem[]) => {
        handleUpdate('specialMemo', memos);
    };

    // Status Change Logic
    const handleStatusChangeStart = (newStatus: CaseStatus) => {
        if (newStatus === c?.status) return;
        setPendingPrimaryStatus(newStatus);
        setPrimaryStatusChangeReason('');
        setIsPrimaryStatusModalOpen(true);
    };

    const confirmPrimaryStatusChange = () => {
        if (!c || !pendingPrimaryStatus) return;

        // Update local secondary statuses logic if needed
        if (pendingPrimaryStatus === '사무장 접수') {
            // [Fix] Use global dynamic list
            setSecondaryStatuses(globalSecondaryStatuses);
        } else {
            setSecondaryStatuses([]);
        }

        const log = {
            logId: Date.now().toString(),
            fromStatus: c.status,
            toStatus: pendingPrimaryStatus,
            changedAt: new Date().toISOString(),
            changedBy: 'User', // Todo: Auth
            memo: primaryStatusChangeReason
        };

        // Optimistic update handled by mutation
        updateCaseMutation.mutate({
            id: c.caseId,
            updates: {
                status: pendingPrimaryStatus,
                statusLogs: [log, ...(c.statusLogs || [])],
                // Clear secondary status if moving away from '사무장 접수' (Optional, mostly handled by business logic but good to clear)
                ...(pendingPrimaryStatus !== '사무장 접수' ? { secondaryStatus: undefined } : {})
            }
        });

        showToast(`상태가 ${pendingPrimaryStatus}(으)로 변경되었습니다.`);
        setIsPrimaryStatusModalOpen(false);
        setPendingPrimaryStatus(null);
    };

    const handleSecondaryStatusChangeStart = (status: string | null) => {
        if (status === c?.secondaryStatus) return;
        setPendingSecondaryStatus(status);
        setSecondaryStatusChangeReason('');
        setIsSecondaryStatusModalOpen(true);
    };

    const confirmSecondaryStatusChange = () => {
        if (!c || !pendingSecondaryStatus) return;

        const log = {
            logId: Date.now().toString(),
            fromStatus: `${c.status} (${c.secondaryStatus || '없음'})`,
            toStatus: `${c.status} (${pendingSecondaryStatus})`,
            changedAt: new Date().toISOString(),
            changedBy: 'User',
            memo: secondaryStatusChangeReason
        };

        // [New] Add detailed memo for List Tooltip Compatibility
        // Format: [2차 상태 변경] Prev -> Next \n사유: ...
        const memoContent = `[2차 상태 변경] ${c.secondaryStatus || '없음'} → ${pendingSecondaryStatus}${secondaryStatusChangeReason ? `\n사유: ${secondaryStatusChangeReason}` : ''}`;
        const newMemo: MemoItem = {
            id: Date.now().toString(),
            createdAt: new Date().toISOString(),
            content: memoContent
        };

        // We need to update multiple fields: secondaryStatus, statusLogs, specialMemo
        // useUpdateCaseMutation handles merging updates.
        updateCaseMutation.mutate({
            id: c.caseId,
            updates: {
                secondaryStatus: pendingSecondaryStatus,
                statusLogs: [log, ...(c.statusLogs || [])],
                specialMemo: [newMemo, ...(c.specialMemo || [])]
            }
        });

        setIsSecondaryStatusModalOpen(false);
        setPendingSecondaryStatus(null);
        showToast('2차 상태가 변경되었습니다.');
    };

    // Audio & AI Handlers
    const handleAudioFileSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
        if (e.target.files && e.target.files[0]) {
            const file = e.target.files[0];
            setCurrentAudioFile(file);
            setAudioUrl(URL.createObjectURL(file));

            setIsFileUploading(true);
            try {
                // Mock upload delay
                await new Promise(resolve => setTimeout(resolve, 1500));

                const newRecording: RecordingItem = {
                    id: Date.now().toString(),
                    filename: file.name,
                    url: URL.createObjectURL(file), // In real app, this would be cloud URL
                    uploadDate: new Date().toISOString(),
                    mimeType: file.type || 'audio/mp3',
                    duration: 0
                };

                handleUpdate('recordings', [newRecording, ...(c?.recordings || [])]);
                showToast('녹음 파일이 업로드되었습니다.');
            } catch (err) {
                showToast('파일 업로드 실패', 'error');
            } finally {
                setIsFileUploading(false);
            }
        }
    };

    const handleGenerateAiSummary = async () => {
        if (!currentAudioFile && !audioUrl) {
            showToast('분석할 녹음 파일이 없습니다.', 'error');
            return;
        }
        setIsAiLoading(true);
        try {
            // [Modified] Use Partner's Custom Prompt if available
            const customPrompt = currentPartner?.aiPromptTemplate;
            const context = {
                customerName: c?.customerName || '',
                phone: c?.phone || '',
                managerName: localStorage.getItem('managerName') || 'Mark' // Default to Mark if not set
            };
            const summary = await generateAiSummary(currentAudioFile || new File([], "mock.mp3"), customPrompt, context);
            setAiSummaryText(summary);
            setAiSummaryEditMode(true);

            // Auto save
            handleUpdate('aiSummary', summary);
            showToast('AI 요약이 완료되었습니다.');
        } catch (error) {
            console.error(error);
            showToast('AI 요약 생성 중 오류가 발생했습니다.', 'error');
        } finally {
            setIsAiLoading(false);
        }
    };

    const handleUpdateAiSummaryText = () => {
        if (aiSummaryText) {
            handleUpdate('aiSummary', aiSummaryText);
            setAiSummaryEditMode(false);
            showToast('AI 요약이 저장되었습니다.');
        }
    };

    const handleDeleteAiSummary = () => {
        if (window.confirm('AI 요약본을 삭제하시겠습니까?')) {
            setAiSummaryText(null);
            handleUpdate('aiSummary', null);
            showToast('삭제되었습니다.');
        }
    };

    const handleSaveSummaryToMemo = () => {
        if (!aiSummaryText) return;

        // Extract '특이사항' section from the AI summary
        // Supports: *특이사항, 4. 특이사항, - 특이사항, 특이사항:
        let memoContent = '';
        const specialNotesMatch = aiSummaryText.match(/(?:^|\n)(?:[\*\-0-9\.\s]*특이사항)[:\s]*([\s\S]*?)(?=\n[0-9]+\.|^$|$)/i);
        // Note: The regex looks for "Usage" section or EOF as terminator if needed, but usually Special Memo is last.
        // Simplified regex to just grab everything after "특이사항" header if it's the last section.

        // Robust Regex: Finds "특이사항" (with optional prefixes) and captures everything after it
        const simpleMatch = aiSummaryText.match(/(?:^|\n)(?:[\*\-0-9\.\s]*)특이사항[:\s]*([\s\S]*)$/i);

        if (simpleMatch && simpleMatch[1]) {
            // Found the special notes section
            const specialNotes = simpleMatch[1].trim();
            memoContent = `${specialNotes.slice(0, 1000)}`;
        } else {
            // Fallback: If not found, save whole summary with label
            memoContent = `[AI 요약 전체]\n${aiSummaryText.slice(0, 1000)}`;
        }

        const newMemo: MemoItem = {
            id: Date.now().toString(),
            createdAt: new Date().toISOString(),
            content: memoContent
        };
        handleUpdateMemos([newMemo, ...(c?.specialMemo || [])]);
        showToast('특이사항이 상담 이력에 저장되었습니다.');
    };

    const handlePlayRecording = (rec: RecordingItem) => {
        setAudioUrl(rec.url);
        setCurrentAudioFile(null); // Clear manual file if playing from list
    };

    const handleDeleteRecording = (id: string) => {
        if (window.confirm('녹음 파일을 삭제하시겠습니까?')) {
            handleUpdate('recordings', (c?.recordings || []).filter(r => r.id !== id));
        }
    };

    if (isLoading) return <div className="p-8 text-center text-gray-500">데이터를 불러오는 중...</div>;
    if (isLoading) return <div className="p-8 text-center text-gray-500">데이터를 불러오는 중...</div>;
    if (error || !c) return (
        <div className="p-8 text-center text-red-500 flex flex-col items-center gap-4">
            <p className="text-xl font-bold">사건 정보를 불러올 수 없습니다.</p>
            <p className="text-sm text-gray-500">ID: {id}</p>
            <div className="text-xs bg-gray-100 p-2 rounded max-w-md break-all">
                데이터 동기화가 지연되고 있을 수 있습니다.<br />
                잠시 후 다시 시도하거나, 새로고침(F5)을 해주세요.
            </div>
            <button
                onClick={() => window.location.reload()}
                className="px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700"
            >
                페이지 새로고침
            </button>
        </div>
    );

    return (
        <div className="min-h-screen bg-gray-50 pb-20">
            {/* Header / Nav */}
            <div className="bg-white border-b border-gray-200 px-4 py-3 flex justify-between items-center sticky top-0 z-20 shadow-sm">
                <div className="flex items-center gap-2">
                    <button onClick={() => navigate(-1)} className="p-2 hover:bg-gray-100 rounded-full text-gray-600 transition-colors">
                        <ArrowLeft size={20} />
                    </button>
                    <span className="font-bold text-gray-700 text-lg">상세 정보</span>
                </div>
                <div className="flex gap-2">
                    <button
                        onClick={() => setIsCmdPaletteOpen(true)}
                        className="p-2 hover:bg-gray-100 rounded-full text-gray-500 transition-colors"
                        title="커맨드 팔레트 (Cmd+K)"
                    >
                        <Layout size={20} />
                    </button>
                </div>
            </div>

            <div className="max-w-5xl mx-auto p-4 md:p-6 space-y-6">

                <CaseDetailHeader
                    c={c}
                    partner={currentPartner}
                    statuses={statuses}
                    secondaryStatuses={secondaryStatuses}
                    onStatusChangeStart={handleStatusChangeStart}
                    onSecondaryStatusChangeStart={handleSecondaryStatusChangeStart}
                />

                {/* Primary Status Modal */}
                {isPrimaryStatusModalOpen && pendingPrimaryStatus !== null && (
                    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
                        <div className="bg-white rounded-lg p-6 w-[400px] shadow-xl border-t-4 border-blue-500">
                            <h3 className="text-lg font-bold mb-4 text-blue-700">상태 변경 확인</h3>
                            <p className="mb-4 text-gray-700">
                                상태를 <span className="font-bold text-blue-600">{c.status}</span>에서 <span className="font-bold text-blue-600">{pendingPrimaryStatus}</span>(으)로 변경하시겠습니까?
                            </p>
                            <div className="mb-4">
                                <label className="block text-sm font-medium text-gray-700 mb-1">변경 사유 (선택)</label>
                                <textarea
                                    className="w-full p-2 border border-blue-200 rounded resize-none h-24 focus:ring-2 focus:ring-blue-500 outline-none"
                                    placeholder="상태 변경 사유를 입력하세요... (예: 부재중, 상담 완료 등)"
                                    value={primaryStatusChangeReason}
                                    onChange={e => setPrimaryStatusChangeReason(e.target.value)}
                                />
                            </div>
                            <div className="flex justify-end gap-2">
                                <button
                                    onClick={() => { setIsPrimaryStatusModalOpen(false); setPendingPrimaryStatus(null); }}
                                    className="px-4 py-2 bg-gray-200 rounded text-gray-800 font-medium hover:bg-gray-300"
                                >
                                    취소
                                </button>
                                <button
                                    onClick={confirmPrimaryStatusChange}
                                    className="px-4 py-2 bg-blue-600 rounded text-white font-medium hover:bg-blue-700"
                                >
                                    변경하기
                                </button>
                            </div>
                        </div>
                    </div>
                )}

                {/* Secondary Status Modal */}
                {isSecondaryStatusModalOpen && pendingSecondaryStatus !== null && (
                    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
                        <div className="bg-white rounded-lg p-6 w-[400px] shadow-xl border-t-4 border-purple-500">
                            <h3 className="text-lg font-bold mb-4 text-purple-700">2차 상태 변경 확인</h3>
                            <p className="mb-4 text-gray-700">
                                2차 상태를 <span className="font-bold text-purple-600">{c.secondaryStatus || '없음'}</span>에서 <span className="font-bold text-purple-600">{pendingSecondaryStatus || '없음'}</span>(으)로 변경하시겠습니까?
                            </p>
                            <div className="mb-4">
                                <label className="block text-sm font-medium text-gray-700 mb-1">변경 사유 / 메모</label>
                                <textarea
                                    className="w-full p-2 border border-purple-200 rounded resize-none h-24 focus:ring-2 focus:ring-purple-500 outline-none"
                                    placeholder="상태 변경 사유를 입력하세요..."
                                    value={secondaryStatusChangeReason}
                                    onChange={e => setSecondaryStatusChangeReason(e.target.value)}
                                />
                            </div>
                            <div className="flex justify-end gap-2">
                                <button
                                    onClick={() => { setIsSecondaryStatusModalOpen(false); setPendingSecondaryStatus(null); }}
                                    className="px-4 py-2 bg-gray-200 rounded text-gray-800 font-medium hover:bg-gray-300"
                                >
                                    취소
                                </button>
                                <button
                                    onClick={confirmSecondaryStatusChange}
                                    className="px-4 py-2 bg-purple-600 rounded text-white font-medium hover:bg-purple-700"
                                >
                                    변경하기
                                </button>
                            </div>
                        </div>
                    </div>
                )}

                {/* Tabs */}
                <div className="flex border-b border-gray-200 bg-white px-4 rounded-t-lg overflow-x-auto no-scrollbar">
                    {[
                        { id: 'info', label: '정보 수정' },
                        { id: 'summary', label: '요약문' },
                        { id: 'settlement', label: '수임료/정산' }
                    ].map(tab => (
                        <button
                            key={tab.id}
                            onClick={() => setActiveTab(tab.id as any)}
                            className={"px-4 py-3 text-sm font-medium border-b-2 whitespace-nowrap " + (activeTab === tab.id ? 'border-blue-600 text-blue-600' : 'border-transparent text-gray-500 hover:text-gray-700')}
                        >
                            {tab.label}
                        </button>
                    ))}
                </div>

                <div className="bg-white p-6 rounded-b-xl shadow-sm border border-gray-100 border-t-0 min-h-[600px]">
                    {activeTab === 'info' && (
                        <CaseInfoTab
                            c={c}
                            partners={partners}
                            inboundPaths={inboundPaths}
                            onUpdate={handleUpdate}
                            onIncomeChange={handleIncomeChange}
                            onJobTypeChange={handleJobTypeChange}
                            reminders={c.reminders || []}
                            memos={c.specialMemo || []}
                            onUpdateReminders={handleUpdateReminders}
                            onUpdateMemos={handleUpdateMemos}
                            aiSummaryText={aiSummaryText}
                            setAiSummaryText={setAiSummaryText}
                            aiSummaryEditMode={aiSummaryEditMode}
                            setAiSummaryEditMode={setAiSummaryEditMode}
                            handleUpdateAiSummaryText={handleUpdateAiSummaryText}
                            handleDeleteAiSummary={handleDeleteAiSummary}
                            handleSaveSummaryToMemo={handleSaveSummaryToMemo}
                            currentAudioFile={currentAudioFile}
                            audioUrl={audioUrl}
                            isFileUploading={isFileUploading}
                            isAiLoading={isAiLoading}
                            onAudioFileSelect={handleAudioFileSelect}
                            onTriggerAudioInput={() => { /* Handled in component via local ref */ }}
                            onGenerateAiSummary={handleGenerateAiSummary}
                            onPlayRecording={handlePlayRecording}
                            onDeleteRecording={handleDeleteRecording}
                            statusLogs={c.statusLogs || []}
                            showToast={showToast}
                        />
                    )}

                    {activeTab === 'summary' && (
                        <CaseSummaryTab
                            c={c}
                            currentPartner={currentPartner}
                            aiSummaryText={aiSummaryText}
                            setAiSummaryText={setAiSummaryText}
                            aiSummaryEditMode={aiSummaryEditMode}
                            setAiSummaryEditMode={setAiSummaryEditMode}
                            handleUpdateAiSummaryText={handleUpdateAiSummaryText}
                            handleSaveSummaryToMemo={handleSaveSummaryToMemo}
                            showToast={showToast}
                        />
                    )}

                    {activeTab === 'settlement' && (
                        <CaseSettlementTab
                            c={c}
                            commission={commission}
                            onUpdate={handleUpdate}
                        />
                    )}
                </div>
            </div>

            {/* Toast Overlay */}
            {toast && (
                <div className={`fixed bottom-24 left-1/2 transform -translate-x-1/2 px-6 py-3 rounded-full shadow-lg text-white text-sm font-bold z-50 animate-fade-in-up ${toast.type === 'error' ? 'bg-red-500' : 'bg-gray-900'}`}>
                    {toast.msg}
                </div>
            )}

            {/* Command Palette */}
            <CommandPalette isOpen={isCmdPaletteOpen} onClose={() => setIsCmdPaletteOpen(false)} />
        </div>
    );
}
