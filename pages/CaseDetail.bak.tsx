
import React, { useEffect, useState, useRef } from 'react';
import { useParams } from 'react-router-dom';
import { fetchCases, updateCase, changeStatus, fetchPartners, fetchInboundPaths, addRecording, fetchCaseStatusLogs } from '../services/api';
import { Case, CommissionRule, CaseStatus, AssetItem, Partner, MemoItem, CreditLoanItem, ReminderItem, RecordingItem, CaseStatusLog } from '../types';
import { STATUS_LIST, JOB_TYPES, HOUSING_TYPES, HOUSING_DETAILS, CASE_TYPES, ASSET_TYPES, ASSET_OWNERS, RENT_CONTRACTORS, HISTORY_TYPES, DEFAULT_AI_PROMPT, FREE_HOUSING_OWNERS } from '../constants';
import { generateSummary, getCaseWarnings, calculateCommission, normalizeBirthYear, fileToBase64 } from '../utils';
import { Save, Copy, AlertTriangle, Plus, Trash2, Edit2, X, Check, CalendarClock, Sparkles, Mic, FileText, Send, PlayCircle, PauseCircle, Archive } from 'lucide-react';
import { format } from 'date-fns';
import { useToast } from '../contexts/ToastContext';
import { GoogleGenAI } from "@google/genai";
import { v4 as uuidv4 } from 'uuid';

// Reusable Components within CaseDetail
const Input = ({ label, value, onChange, onBlur, type = "text", placeholder = "", suffix = "", readOnly = false }: any) => {
    const displayValue = type === 'number' && (value === 0 || value === undefined || value === null) ? '' : value;

    return (
        <div className="mb-4">
            <label className="block text-xs font-medium text-gray-500 mb-1">{label}</label>
            <div className="relative">
                <input
                    type={type}
                    className={`w-full p-2 border border-gray-300 rounded text-sm outline-none ${readOnly ? 'bg-gray-100 text-gray-500 cursor-not-allowed' : 'focus:ring-1 focus:ring-blue-500'}`}
                    value={displayValue}
                    onChange={e => !readOnly && onChange(type === 'number' ? Number(e.target.value) || 0 : e.target.value)}
                    onBlur={onBlur}
                    placeholder={placeholder}
                    readOnly={readOnly}
                />
                {suffix && <span className="absolute right-3 top-2 text-gray-500 text-xs">{suffix}</span>}
            </div>
        </div>
    );
};

const Select = ({ label, value, onChange, options, isMulti = false }: any) => (
    <div className="mb-4">
        <label className="block text-xs font-medium text-gray-500 mb-1">{label}</label>
        <div className="flex gap-2 flex-wrap">
            {options.map((opt: string) => {
                const isSelected = isMulti ? value?.includes(opt) : value === opt;
                return (
                    <button
                        key={opt}
                        type="button"
                        onClick={() => onChange(opt)}
                        className={`px-3 py-1.5 text-xs rounded border ${isSelected ? 'bg-blue-600 text-white border-blue-600' : 'bg-white text-gray-600 border-gray-300 hover:bg-gray-50'}`}
                    >
                        {opt}
                    </button>
                )
            })}
        </div>
    </div>
);

export default function CaseDetail() {
    const { caseId } = useParams();
    const { showToast } = useToast();
    const [c, setCase] = useState<Case | null>(null);
    const [partners, setPartners] = useState<Partner[]>([]);
    const [inboundPaths, setInboundPaths] = useState<string[]>([]);
    const [activeTab, setActiveTab] = useState<'info' | 'summary' | 'settlement'>('info');

    const [newAsset, setNewAsset] = useState<Partial<AssetItem>>({ owner: '본인', type: '자동차', amount: 0, loanAmount: 0, desc: '' });
    const [newCreditLoan, setNewCreditLoan] = useState<Partial<CreditLoanItem>>({ amount: 0, desc: '' });
    const [newMemoContent, setNewMemoContent] = useState('');

    // Reminder State
    const [newReminderDateTime, setNewReminderDateTime] = useState('');
    const [confirmingDeleteReminderId, setConfirmingDeleteReminderId] = useState<string | null>(null);

    // Memo Edit State
    const [editingMemoId, setEditingMemoId] = useState<string | null>(null);
    const [editMemoContent, setEditMemoContent] = useState('');
    const [confirmingDeleteMemoId, setConfirmingDeleteMemoId] = useState<string | null>(null);

    // AI Summary & Audio State
    const [isAiLoading, setIsAiLoading] = useState(false);
    const [aiSummaryEditMode, setAiSummaryEditMode] = useState(false);
    const [aiSummaryText, setAiSummaryText] = useState('');
    const [currentAudioFile, setCurrentAudioFile] = useState<File | null>(null);
    const [audioUrl, setAudioUrl] = useState<string | null>(null);
    const audioInputRef = useRef<HTMLInputElement>(null);
    const audioPlayerRef = useRef<HTMLAudioElement>(null);

    // Status Change History
    const [statusLogs, setStatusLogs] = useState<CaseStatusLog[]>([]);
    const [isStatusModalOpen, setIsStatusModalOpen] = useState(false);
    const [pendingStatus, setPendingStatus] = useState<CaseStatus | null>(null);
    const [statusChangeReason, setStatusChangeReason] = useState('');


    useEffect(() => {
        if (caseId) {
            Promise.all([fetchCases(), fetchPartners(), fetchInboundPaths()]).then(([caseData, partnerData, pathData]) => {
                const foundCase = caseData.find(x => x.caseId === caseId) || null;
                if (foundCase) {
                    // Ensure data structure is up-to-date for older records
                    if (typeof (foundCase as any).jobType === 'string') {
                        foundCase.jobTypes = [(foundCase as any).jobType];
                        delete (foundCase as any).jobType;
                    }
                    if (!foundCase.jobTypes) foundCase.jobTypes = [];
                    if (!foundCase.incomeDetails) foundCase.incomeDetails = {};
                    if (!foundCase.reminders) foundCase.reminders = [];
                    if (!foundCase.recordings) foundCase.recordings = [];
                }
                setCase(foundCase);
                setPartners(partnerData);
                setInboundPaths(pathData);
                if (foundCase?.aiSummary) {
                    setAiSummaryText(foundCase.aiSummary);
                }
            });
            fetchCaseStatusLogs(caseId).then(setStatusLogs);
        }
        return () => {
            if (audioUrl) URL.revokeObjectURL(audioUrl);
        };
    }, [caseId]);

    if (!c) return <div className="p-8 text-center text-gray-500">로딩중...</div>;

    const currentPartner = partners.find(p => p.partnerId === c.partnerId);
    const rules = currentPartner ? currentPartner.commissionRules : [];

    const handleStatusChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
        const newStatus = e.target.value as CaseStatus;
        setPendingStatus(newStatus);
        setIsStatusModalOpen(true);
        setStatusChangeReason('');
    };

    const confirmStatusChange = async () => {
        if (!caseId || !pendingStatus) return;
        try {
            const updated = await changeStatus(caseId, pendingStatus, statusChangeReason);
            setCase(updated);

            // Refresh logs
            const logs = await fetchCaseStatusLogs(caseId);
            setStatusLogs(logs);

            showToast('상태가 변경되었습니다.');
            setIsStatusModalOpen(false);
            setPendingStatus(null);
        } catch (error) {
            showToast("상태 변경에 실패했습니다.", 'error');
        }
    };

    const handleUpdate = (field: string, value: any) => {
        if (!c) return;
        const updatedCase = { ...c, [field]: value };

        if (field === 'incomeDetails') {
            updatedCase.incomeNet = Object.values(value).reduce((sum: any, val: any) => sum + (val || 0), 0) as number;
        }

        setCase(updatedCase);
        updateCase(c.caseId, { [field]: value });
    };

    const handleIncomeChange = (type: 'salary' | 'business' | 'freelance', value: number) => {
        if (!c) return;
        const newIncomeDetails = { ...(c.incomeDetails || {}), [type]: value };
        handleUpdate('incomeDetails', newIncomeDetails);
    };

    const handleJobTypeChange = (jobType: string) => {
        if (!c) return;
        const currentTypes = c.jobTypes || [];
        const newTypes = currentTypes.includes(jobType)
            ? currentTypes.filter(t => t !== jobType)
            : [...currentTypes, jobType];

        // Also clean up incomeDetails if a job type is removed
        const newIncomeDetails = { ...(c.incomeDetails || {}) };
        if (jobType === '직장인' && !newTypes.includes('직장인')) delete newIncomeDetails.salary;
        if (['개인사업자', '법인사업자'].includes(jobType) && !newTypes.some(t => ['개인사업자', '법인사업자'].includes(t))) delete newIncomeDetails.business;
        if (jobType === '프리랜서' && !newTypes.includes('프리랜서')) delete newIncomeDetails.freelance;

        // Recalculate net income
        const newIncomeNet = Object.values(newIncomeDetails).reduce((sum: any, val: any) => sum + (val || 0), 0) as number;

        // Update state once to avoid race condition
        const updatedCase = {
            ...c,
            jobTypes: newTypes,
            incomeDetails: newIncomeDetails,
            incomeNet: newIncomeNet
        };

        setCase(updatedCase);
        // Update API
        updateCase(c.caseId, { jobTypes: newTypes, incomeDetails: newIncomeDetails, incomeNet: newIncomeNet });
    };


    const handleBirthBlur = () => {
        const normalized = normalizeBirthYear(c.birth);
        if (normalized !== c.birth) {
            handleUpdate('birth', normalized);
        }
    };

    const handleAddAsset = () => {
        if (!newAsset.type || !c) return;
        const asset: AssetItem = {
            id: Date.now().toString(),
            owner: newAsset.owner as any || '본인',
            type: newAsset.type || '기타',
            amount: newAsset.amount || 0,
            loanAmount: newAsset.loanAmount || 0,
            desc: newAsset.desc || ''
        };
        const updatedAssets = c.assets ? [...c.assets, asset] : [asset];
        handleUpdate('assets', updatedAssets);
        setNewAsset({ owner: '본인', type: '자동차', amount: 0, loanAmount: 0, desc: '' }); // Reset
    };

    const handleAddCreditLoan = () => {
        if (!newCreditLoan.amount || !newCreditLoan.desc) {
            showToast('대출금액과 내용을 모두 입력해주세요.', 'error');
            return;
        }
        const loan: CreditLoanItem = {
            id: Date.now().toString(),
            amount: newCreditLoan.amount || 0,
            desc: newCreditLoan.desc || ''
        };
        handleUpdate('creditLoan', [...(c.creditLoan || []), loan]);
        setNewCreditLoan({ amount: 0, desc: '' });
    };

    const handleRemoveAsset = (id: string) => {
        if (!c) return;
        const updatedAssets = c.assets.filter(a => a.id !== id);
        handleUpdate('assets', updatedAssets);
    };

    const handleRemoveCreditLoan = (id: string) => {
        if (!c) return;
        const updatedLoans = (c.creditLoan || []).filter(l => l.id !== id);
        handleUpdate('creditLoan', updatedLoans);
    };

    // --- Memo Logic ---
    const handleAddMemo = () => {
        if (!newMemoContent.trim() || !c) return;
        const newMemo: MemoItem = {
            id: Date.now().toString(),
            createdAt: new Date().toISOString(),
            content: newMemoContent.trim(),
        };
        const updatedMemos = [newMemo, ...(c.specialMemo || [])];
        handleUpdate('specialMemo', updatedMemos);
        setNewMemoContent('');
        showToast('상담 내용이 추가되었습니다.');
    };

    const handleEditMemoStart = (memo: MemoItem) => {
        setEditingMemoId(memo.id);
        setEditMemoContent(memo.content);
        setConfirmingDeleteMemoId(null); // Cancel any pending delete
    };

    const handleEditMemoSave = () => {
        if (!c || !editingMemoId) return;
        const updatedMemos = (c.specialMemo || []).map(m =>
            m.id === editingMemoId ? { ...m, content: editMemoContent } : m
        );
        handleUpdate('specialMemo', updatedMemos);
        setEditingMemoId(null);
        setEditMemoContent('');
        showToast('상담 내용이 수정되었습니다.');
    };

    const handleDeleteMemo = (id: string) => {
        if (!c) return;
        const updatedMemos = (c.specialMemo || []).filter(m => m.id !== id);
        handleUpdate('specialMemo', updatedMemos);
        showToast('상담 내용이 삭제되었습니다.');
        setConfirmingDeleteMemoId(null);
    };

    // --- Reminder Logic ---
    const handleAddReminder = () => {
        if (!newReminderDateTime) {
            showToast('날짜와 시간을 선택해주세요.', 'error');
            return;
        }
        if (!c || !c.reminders) return;
        if (c.reminders.length >= 5) {
            showToast('리마인더는 최대 5개까지 등록할 수 있습니다.', 'error');
            return;
        }
        const newReminder: ReminderItem = {
            id: Date.now().toString(),
            datetime: newReminderDateTime.replace('T', ' '),
        };
        const updatedReminders = [...c.reminders, newReminder];
        handleUpdate('reminders', updatedReminders);
        setNewReminderDateTime('');
        showToast('다음 통화 일정이 추가되었습니다.');
    };

    const handleDeleteReminder = (id: string) => {
        if (!c || !c.reminders) return;
        const updatedReminders = c.reminders.filter(r => r.id !== id);
        handleUpdate('reminders', updatedReminders);
        setConfirmingDeleteReminderId(null);
        showToast('일정이 삭제되었습니다.');
    };

    // --- Audio & AI Summary Logic ---
    const handleAudioFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (file) {
            if (file.size > 20 * 1024 * 1024) { // 20MB limit for demo
                showToast('파일 크기는 20MB를 초과할 수 없습니다.', 'error');
                return;
            }
            setCurrentAudioFile(file);
            const url = URL.createObjectURL(file);
            setAudioUrl(url);
            showToast(`'${file.name}' 파일이 준비되었습니다.`);

            // Auto add to recording list (simulate save)
            const newRecording: RecordingItem = {
                id: uuidv4(),
                filename: file.name,
                uploadDate: new Date().toISOString(),
                url: url, // In a real app, this would be a server URL
                mimeType: file.type
            };

            if (c) {
                const updatedRecordings = [newRecording, ...(c.recordings || [])];
                handleUpdate('recordings', updatedRecordings);
            }
        }
    };

    const triggerAudioInput = () => {
        audioInputRef.current?.click();
    };

    const handlePlayRecording = (rec: RecordingItem) => {
        if (audioPlayerRef.current) {
            audioPlayerRef.current.src = rec.url;
            audioPlayerRef.current.play();
            showToast(`${rec.filename} 재생을 시작합니다.`);
        }
    };

    const handleDeleteRecording = (id: string) => {
        if (!c) return;
        if (confirm('이 녹음 파일을 목록에서 삭제하시겠습니까?')) {
            const updated = (c.recordings || []).filter(r => r.id !== id);
            handleUpdate('recordings', updated);
        }
    };

    const handleGenerateAiSummary = async () => {
        if (!c) return;

        // Use current file or try to fetch from latest recording if exists
        let fileToProcess = currentAudioFile;
        // In a real scenario, we'd need to fetch the blob from the URL if currentAudioFile is null but c.recordings has items.
        // For this client-side demo, we rely on the user having just selected the file or re-uploading.

        if (!fileToProcess && (!c.recordings || c.recordings.length === 0)) {
            showToast("분석할 통화 녹음 파일이 없습니다.", 'error');
            return;
        }

        // If no current file selected but we have recordings, we might prompt user (or just use current logic requiring explicit upload for analysis)
        if (!fileToProcess) {
            showToast("분석을 위해 파일을 선택해주세요.", 'error');
            triggerAudioInput();
            return;
        }

        const partner = partners.find(p => p.partnerId === c.partnerId);
        const promptTemplate = partner?.aiPromptTemplate || DEFAULT_AI_PROMPT;

        setIsAiLoading(true);
        try {
            const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });

            const contextText = `
          [기본 정보]
          고객명: ${c.customerName}
          연락처: ${c.phone}
          직업: ${c.jobTypes?.join(', ')}
          
          [기존 상담 이력]
          ${c.specialMemo?.map(m => m.content).join('\n') || '없음'}
          
          [사전 정보]
          ${c.preInfo || '없음'}
        `;

            const parts: any[] = [];

            // Add Audio
            if (fileToProcess) {
                const base64Audio = await fileToBase64(fileToProcess);
                parts.push({
                    inlineData: {
                        mimeType: fileToProcess.type,
                        data: base64Audio
                    }
                });
            }

            // Add Text Prompt
            parts.push({
                text: `${promptTemplate}\n\n${contextText}`
            });

            const response = await ai.models.generateContent({
                model: 'gemini-2.0-flash-exp',
                contents: { parts }
            });

            const summary = response.text;

            if (summary) {
                setAiSummaryText(summary);
                handleUpdate('aiSummary', summary);
                showToast('AI 요약이 생성되었습니다.');
            } else {
                showToast('AI 요약 내용이 비어있습니다.', 'error');
            }

        } catch (e) {
            console.error(e);
            showToast('AI 요약 생성 중 오류가 발생했습니다. API Key를 확인해주세요.', 'error');
        } finally {
            setIsAiLoading(false);
        }
    };

    const handleSaveSummaryToMemo = () => {
        if (!aiSummaryText.trim()) return;
        // Modified: Removed specific header, just kept simple tag
        const newMemo: MemoItem = {
            id: Date.now().toString(),
            createdAt: new Date().toISOString(),
            content: `[AI 요약]\n${aiSummaryText}`,
        };
        const updatedMemos = [newMemo, ...(c.specialMemo || [])];
        handleUpdate('specialMemo', updatedMemos);
        showToast('상담 내용으로 저장되었습니다.');
    };

    const handleUpdateAiSummaryText = () => {
        handleUpdate('aiSummary', aiSummaryText);
        setAiSummaryEditMode(false);
        showToast('요약 내용이 수정되었습니다.');
    };

    const handleDeleteAiSummary = () => {
        if (confirm('AI 요약 내용을 삭제하시겠습니까?')) {
            setAiSummaryText('');
            handleUpdate('aiSummary', '');
            showToast('삭제되었습니다.');
        }
    };


    const handleCopySummary = () => {
        const template = currentPartner ? currentPartner.summaryTemplate : undefined;
        const text = generateSummary(c, template);
        navigator.clipboard.writeText(text);
        showToast('요약문이 클립보드에 복사되었습니다.');
    };

    const getAutoCollateralString = () => {
        const parts = [];
        if ((c.depositLoanAmount || 0) > 0) parts.push(`보증금 대출 ${c.depositLoanAmount}만원`);
        if ((c.ownHouseLoan || 0) > 0) parts.push(`집 담보 대출 ${c.ownHouseLoan}만원`);
        if (c.assets) {
            c.assets.forEach((a: AssetItem) => {
                if (a.loanAmount > 0) parts.push(`${a.type} 담보 ${a.loanAmount}만원`);
            });
        }
        return parts.length > 0 ? parts.join(' + ') : '없음';
    };

    const warnings = getCaseWarnings(c, currentPartner);
    const commission = calculateCommission(c.contractFee || 0, rules);
    const sortedMemos = c.specialMemo ? [...c.specialMemo].sort((a, b) => b.createdAt.localeCompare(a.createdAt)) : [];
    const sortedReminders = c.reminders ? [...c.reminders].sort((a, b) => a.datetime.localeCompare(b.datetime)) : [];


    return (
        <div className="max-w-4xl mx-auto space-y-4">
            {/* Header Card */}
            <div className="bg-white p-4 rounded-xl shadow-sm border border-gray-100 sticky top-0 z-10">
                <div className="flex flex-col md:flex-row justify-between md:items-center gap-4">
                    <div>
                        <div className="flex items-center gap-2">
                            <span className={`px-2 py-0.5 rounded text-xs font-bold text-white ${['개인회생', '파산'].includes(c.caseType || '') ? 'bg-indigo-500' : 'bg-gray-500'}`}>
                                {c.caseType}
                            </span>
                            <span className="text-xs bg-gray-100 text-gray-600 px-2 py-0.5 rounded font-bold border border-gray-200">
                                {currentPartner?.name || '거래처 미정'}
                            </span>
                            <h1 className="text-2xl font-bold text-gray-900">{c.customerName}</h1>
                            <span className="text-gray-500">{c.phone}</span>
                        </div>
                        {warnings.length > 0 && (
                            <div className="flex gap-2 mt-2">
                                {warnings.map(w => (
                                    <span key={w} className="text-xs bg-red-100 text-red-600 px-2 py-0.5 rounded font-bold flex items-center">
                                        <AlertTriangle size={12} className="mr-1" /> {w}
                                    </span>
                                ))}
                            </div>
                        )}
                    </div>

                    <div className="flex flex-col gap-2 min-w-[200px]">
                        <label className="text-xs text-gray-400 font-medium">현재 상태 변경</label>
                        <select
                            className="p-2 border border-gray-300 rounded font-semibold bg-blue-50 text-blue-800"
                            value={c.status}
                            onChange={handleStatusChange}
                        >
                            {STATUS_LIST.map(s => <option key={s} value={s}>{s}</option>)}
                        </select>
                    </div>
                </div>
            </div>

            {/* Status Change Modal */}
            {isStatusModalOpen && pendingStatus && (
                <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
                    <div className="bg-white rounded-lg p-6 w-[400px] shadow-xl">
                        <h3 className="text-lg font-bold mb-4">상태 변경 확인</h3>
                        <p className="mb-4 text-gray-700">
                            상태를 <span className="font-bold text-blue-600">{c.status}</span>에서 <span className="font-bold text-blue-600">{pendingStatus}</span>(으)로 변경하시겠습니까?
                        </p>
                        <div className="mb-4">
                            <label className="block text-sm font-medium text-gray-700 mb-1">변경 사유 / 메모</label>
                            <textarea
                                className="w-full p-2 border rounded resize-none h-24 focus:ring-2 focus:ring-blue-500 outline-none"
                                placeholder="상태 변경 사유를 입력하세요..."
                                value={statusChangeReason}
                                onChange={e => setStatusChangeReason(e.target.value)}
                            />
                        </div>
                        <div className="flex justify-end gap-2">
                            <button
                                onClick={() => { setIsStatusModalOpen(false); setPendingStatus(null); }}
                                className="px-4 py-2 bg-gray-200 rounded text-gray-800 font-medium hover:bg-gray-300"
                            >
                                취소
                            </button>
                            <button
                                onClick={confirmStatusChange}
                                className="px-4 py-2 bg-blue-600 rounded text-white font-medium hover:bg-blue-700"
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
                        className={`px-4 py-3 text-sm font-medium border-b-2 whitespace-nowrap ${activeTab === tab.id ? 'border-blue-600 text-blue-600' : 'border-transparent text-gray-500 hover:text-gray-700'}`}
                    >
                        {tab.label}
                    </button>
                ))}
            </div>

            <div className="bg-white p-6 rounded-b-xl shadow-sm border border-gray-100 border-t-0 min-h-[600px]">
                {activeTab === 'info' && (
                    <div className="space-y-8">
                        {/* Section 1: Reminder & Memos */}
                        <div className="bg-yellow-50 p-4 rounded-lg border border-yellow-100">
                            <h3 className="font-bold text-yellow-800 mb-2 flex items-center gap-2">📅 리마인더 및 상담 이력</h3>
                            <div className="grid md:grid-cols-2 gap-4">
                                {/* Reminder Settings */}
                                <div className="bg-white p-3 rounded-lg border border-yellow-200 shadow-sm">
                                    <label className="block text-xs font-bold text-yellow-800 mb-2">다음 통화 예정일 ({sortedReminders.length}/5)</label>
                                    <div className="flex gap-2 mb-3">
                                        <input
                                            type="datetime-local"
                                            className="flex-1 p-2 border border-gray-300 rounded text-sm disabled:bg-gray-100"
                                            value={newReminderDateTime}
                                            onChange={e => setNewReminderDateTime(e.target.value)}
                                            disabled={(c.reminders?.length || 0) >= 5}
                                        />
                                        <button
                                            onClick={handleAddReminder}
                                            disabled={(c.reminders?.length || 0) >= 5}
                                            className="bg-yellow-500 text-white px-3 py-2 rounded text-sm font-bold hover:bg-yellow-600 whitespace-nowrap disabled:bg-gray-400"
                                        >
                                            추가
                                        </button>
                                    </div>
                                    <div className="space-y-2">
                                        {sortedReminders.length === 0 ? (
                                            <div className="text-center py-2 text-xs text-gray-400 bg-gray-50 rounded border border-gray-100 border-dashed">
                                                지정된 일정이 없습니다.
                                            </div>
                                        ) : (
                                            sortedReminders.map(reminder => (
                                                <div key={reminder.id} className="bg-blue-50 border border-blue-100 rounded p-2 flex justify-between items-center">
                                                    <div className="flex items-center gap-2">
                                                        <CalendarClock size={16} className="text-blue-600" />
                                                        <span className="text-sm font-bold text-gray-800">{reminder.datetime}</span>
                                                    </div>
                                                    {confirmingDeleteReminderId === reminder.id ? (
                                                        <div className="flex gap-2">
                                                            <button onClick={() => handleDeleteReminder(reminder.id)} className="text-green-600 text-xs font-bold">확인</button>
                                                            <button onClick={() => setConfirmingDeleteReminderId(null)} className="text-red-500 text-xs">취소</button>
                                                        </div>
                                                    ) : (
                                                        <button
                                                            onClick={() => setConfirmingDeleteReminderId(reminder.id)}
                                                            className="text-red-500 p-1 hover:bg-red-50 rounded"
                                                            title="일정 삭제"
                                                        >
                                                            <Trash2 size={16} />
                                                        </button>
                                                    )}
                                                </div>
                                            ))
                                        )}
                                    </div>
                                </div>

                                {/* New Memo Input */}
                                <div>
                                    <label className="block text-xs font-medium text-yellow-800 mb-1">상담 특이사항 추가</label>
                                    <textarea
                                        className="w-full p-2 border border-yellow-300 rounded bg-white h-[60px] text-sm focus:ring-1 focus:ring-yellow-500 outline-none"
                                        value={newMemoContent}
                                        onChange={e => setNewMemoContent(e.target.value)}
                                        placeholder="추가할 상담 내용을 입력하세요..."
                                    />
                                    <button
                                        onClick={handleAddMemo}
                                        className="w-full mt-1 bg-yellow-100 text-yellow-800 border border-yellow-300 px-3 py-1.5 rounded text-xs font-bold hover:bg-yellow-200"
                                    >
                                        상담 내용 추가
                                    </button>
                                </div>
                            </div>

                            {/* Memo List */}
                            <div className="mt-4">
                                <label className="block text-xs font-medium text-yellow-800 mb-2">상담 이력</label>
                                <div className="max-h-64 overflow-y-auto space-y-2 bg-yellow-100/30 p-2 rounded">
                                    {sortedMemos.length === 0 && <p className="text-center text-xs text-gray-500 py-4">저장된 상담 내용이 없습니다.</p>}
                                    {sortedMemos.map(memo => (
                                        <div key={memo.id} className="bg-white p-3 rounded text-xs shadow-sm border border-yellow-100">
                                            <div className="flex justify-between items-start mb-1">
                                                <p className="font-bold text-gray-500 text-[10px]">{format(new Date(memo.createdAt), 'yyyy-MM-dd HH:mm')}</p>
                                                <div className="flex gap-1">
                                                    {editingMemoId === memo.id ? (
                                                        <>
                                                            <button type="button" onClick={handleEditMemoSave} className="text-green-600 hover:bg-green-50 p-1 rounded" title="저장">
                                                                <Check size={14} />
                                                            </button>
                                                            <button type="button" onClick={() => setEditingMemoId(null)} className="text-gray-400 hover:bg-gray-100 p-1 rounded" title="취소">
                                                                <X size={14} />
                                                            </button>
                                                        </>
                                                    ) : confirmingDeleteMemoId === memo.id ? (
                                                        <>
                                                            <button type="button" onClick={() => handleDeleteMemo(memo.id)} className="text-green-600 hover:bg-green-50 p-1 rounded font-bold" title="확인">
                                                                확인
                                                            </button>
                                                            <button type="button" onClick={() => setConfirmingDeleteMemoId(null)} className="text-red-500 hover:bg-red-50 p-1 rounded" title="취소">
                                                                취소
                                                            </button>
                                                        </>
                                                    ) : (
                                                        <>
                                                            <button type="button" onClick={() => handleEditMemoStart(memo)} className="text-blue-500 hover:bg-blue-50 p-1 rounded" title="수정">
                                                                <Edit2 size={14} />
                                                            </button>
                                                            <button type="button" onClick={() => setConfirmingDeleteMemoId(memo.id)} className="text-red-500 hover:bg-red-50 p-1 rounded" title="삭제">
                                                                <Trash2 size={14} />
                                                            </button>
                                                        </>
                                                    )}
                                                </div>
                                            </div>

                                            {editingMemoId === memo.id ? (
                                                <textarea
                                                    className="w-full p-1 border rounded text-xs h-20"
                                                    value={editMemoContent}
                                                    onChange={e => setEditMemoContent(e.target.value)}
                                                />
                                            ) : (
                                                <p className="text-gray-800 whitespace-pre-wrap leading-relaxed">{memo.content}</p>
                                            )}
                                        </div>
                                    ))}
                                </div>
                            </div>
                        </div>

                        {/* AI Summary Section (Improved) */}
                        <div className="bg-purple-50 p-4 rounded-lg border border-purple-100">
                            <div className="flex justify-between items-center mb-3">
                                <h3 className="font-bold text-purple-800 flex items-center gap-2">
                                    <Sparkles size={18} /> AI 상담 요약 & 녹음
                                </h3>

                                <div className="flex items-center gap-2">
                                    <input
                                        type="file"
                                        ref={audioInputRef}
                                        className="hidden"
                                        accept="audio/*"
                                        onChange={handleAudioFileSelect}
                                    />
                                    <button
                                        onClick={triggerAudioInput}
                                        className={`flex items-center gap-1 text-xs px-2 py-1.5 rounded border ${currentAudioFile ? 'bg-green-100 text-green-700 border-green-300' : 'bg-white text-gray-600 border-gray-300'}`}
                                    >
                                        <Mic size={14} /> {currentAudioFile ? '파일 변경' : '녹음파일 업로드'}
                                    </button>

                                    <button
                                        onClick={handleGenerateAiSummary}
                                        disabled={isAiLoading}
                                        className="flex items-center gap-1 text-xs bg-purple-600 text-white px-3 py-1.5 rounded font-bold hover:bg-purple-700 disabled:opacity-50 transition-colors shadow-sm"
                                    >
                                        {isAiLoading ? '분석 중...' : '요약 실행'}
                                    </button>
                                </div>
                            </div>

                            {/* Audio Player for Current or Selected */}
                            <div className="mb-4 bg-white p-3 rounded-lg border border-purple-100">
                                <audio ref={audioPlayerRef} controls className="w-full h-8 mb-2" src={audioUrl || ''} />
                                {currentAudioFile && <p className="text-xs text-gray-500">현재 선택된 파일: {currentAudioFile.name}</p>}
                            </div>

                            {/* Recording List (Archive) */}
                            {(c.recordings && c.recordings.length > 0) && (
                                <div className="mb-4">
                                    <h4 className="text-xs font-bold text-gray-600 mb-2 flex items-center"><Archive size={12} className="mr-1" /> 녹음 아카이브</h4>
                                    <div className="space-y-1 max-h-32 overflow-y-auto no-scrollbar">
                                        {c.recordings.map(rec => (
                                            <div key={rec.id} className="flex justify-between items-center bg-white p-2 rounded border border-gray-200 text-xs">
                                                <div className="flex items-center gap-2 overflow-hidden">
                                                    <PlayCircle
                                                        size={16}
                                                        className="text-blue-500 cursor-pointer flex-shrink-0"
                                                        onClick={() => handlePlayRecording(rec)}
                                                    />
                                                    <div className="truncate">
                                                        <span className="font-medium">{rec.filename}</span>
                                                        <span className="text-gray-400 text-[10px] ml-1">{format(new Date(rec.uploadDate), 'yy.MM.dd HH:mm')}</span>
                                                    </div>
                                                </div>
                                                <button onClick={() => handleDeleteRecording(rec.id)} className="text-gray-400 hover:text-red-500">
                                                    <X size={14} />
                                                </button>
                                            </div>
                                        ))}
                                    </div>
                                </div>
                            )}

                            <div className="bg-white p-3 rounded-lg border border-purple-100 shadow-sm relative min-h-[80px]">
                                {aiSummaryEditMode ? (
                                    <div className="space-y-2">
                                        <textarea
                                            className="w-full h-32 p-2 text-sm border border-purple-200 rounded focus:outline-none focus:ring-1 focus:ring-purple-500"
                                            value={aiSummaryText}
                                            onChange={e => setAiSummaryText(e.target.value)}
                                        />
                                        <div className="flex justify-end gap-2">
                                            <button onClick={handleUpdateAiSummaryText} className="text-xs bg-green-600 text-white px-3 py-1 rounded hover:bg-green-700">저장</button>
                                            <button onClick={() => setAiSummaryEditMode(false)} className="text-xs bg-gray-200 text-gray-700 px-3 py-1 rounded hover:bg-gray-300">취소</button>
                                        </div>
                                    </div>
                                ) : (
                                    <div className="group">
                                        <div className="absolute top-2 right-2 flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                                            <button onClick={() => setAiSummaryEditMode(true)} className="p-1 text-blue-500 hover:bg-blue-50 rounded" title="수정">
                                                <Edit2 size={14} />
                                            </button>
                                            <button onClick={handleDeleteAiSummary} className="p-1 text-red-500 hover:bg-red-50 rounded" title="삭제">
                                                <Trash2 size={14} />
                                            </button>
                                        </div>
                                        <div className="text-sm text-gray-700 whitespace-pre-wrap leading-relaxed pr-10">
                                            {aiSummaryText || <span className="text-gray-400">요약된 상담 내용이 없습니다. 통화 파일을 업로드하거나 기존 상담 내역을 바탕으로 요약을 실행해보세요.</span>}
                                        </div>
                                    </div>
                                )}
                            </div>

                            {aiSummaryText && !aiSummaryEditMode && (
                                <div className="mt-3 flex justify-end">
                                    <button
                                        onClick={handleSaveSummaryToMemo}
                                        className="flex items-center gap-1 text-xs bg-indigo-50 text-indigo-700 px-3 py-2 rounded font-bold hover:bg-indigo-100 border border-indigo-200 transition-colors"
                                    >
                                        <Send size={14} /> 상담 내용으로 보내기 (특이사항 추가)
                                    </button>
                                </div>
                            )}
                        </div>

                        <div className="grid md:grid-cols-2 gap-8">
                            {/* Section 2: Personal Info */}
                            <div>
                                <h3 className="font-bold text-gray-700 border-b pb-2 mb-4">기본 정보</h3>
                                <div className="mb-4">
                                    <label className="block text-xs font-medium text-gray-500 mb-1">거래처 (법률사무소)</label>
                                    <select
                                        className="w-full p-2 border border-gray-300 rounded text-sm bg-gray-50"
                                        value={c.partnerId}
                                        onChange={e => handleUpdate('partnerId', e.target.value)}
                                    >
                                        {partners.map(p => <option key={p.partnerId} value={p.partnerId}>{p.name}</option>)}
                                    </select>
                                </div>

                                {/* Status History Section */}
                                {statusLogs.length > 0 && (
                                    <div className="bg-blue-50 p-4 rounded-lg border border-blue-100 mb-6">
                                        <h4 className="font-bold text-blue-800 mb-3 flex items-center gap-2">
                                            <CalendarClock size={16} /> 상태 변경 이력
                                        </h4>
                                        <div className="space-y-3 max-h-60 overflow-y-auto pr-2">
                                            {statusLogs.map(log => (
                                                <div key={log.logId} className="bg-white p-3 rounded-lg border border-blue-100 shadow-sm text-sm">
                                                    <div className="flex justify-between items-center mb-1">
                                                        <div className="flex items-center gap-2">
                                                            <span className="font-bold text-gray-400 line-through text-xs px-2 py-0.5 bg-gray-100 rounded">{log.fromStatus}</span>
                                                            <span className="text-gray-400">→</span>
                                                            <span className="font-bold text-blue-600 text-xs px-2 py-0.5 bg-blue-50 rounded border border-blue-100">{log.toStatus}</span>
                                                        </div>
                                                        <span className="text-[10px] text-gray-400">{format(new Date(log.changedAt), 'yy.MM.dd HH:mm')}</span>
                                                    </div>
                                                    {log.memo && (
                                                        <div className="mt-2 text-gray-600 bg-gray-50 p-2 rounded text-xs leading-relaxed">
                                                            {log.memo}
                                                        </div>
                                                    )}
                                                    <div className="mt-1 text-right">
                                                        <span className="text-[10px] text-gray-400">Changed by {log.changedBy}</span>
                                                    </div>
                                                </div>
                                            ))}
                                        </div>
                                    </div>
                                )}

                                <Input
                                    label="최초 등록일시"
                                    value={c.createdAt ? format(new Date(c.createdAt), 'yyyy-MM-dd HH:mm') : '-'}
                                    readOnly={true}
                                    onChange={() => { }}
                                />
                                <div className="grid grid-cols-2 gap-2 mb-4">
                                    <div className="col-span-2">
                                        <Select label="사건 유형" value={c.caseType} onChange={(v: any) => handleUpdate('caseType', v)} options={CASE_TYPES} />
                                    </div>
                                    <div className="col-span-2 mb-4">
                                        <label className="block text-xs font-medium text-gray-500 mb-1">유입 경로</label>
                                        <select
                                            className="w-full p-2 border border-gray-300 rounded text-sm focus:ring-1 focus:ring-blue-500 outline-none"
                                            value={c.inboundPath}
                                            onChange={e => handleUpdate('inboundPath', e.target.value)}
                                        >
                                            <option value="">선택</option>
                                            {inboundPaths.map(p => <option key={p} value={p}>{p}</option>)}
                                        </select>
                                    </div>
                                </div>

                                <Input label="이름" value={c.customerName} onChange={(v: any) => handleUpdate('customerName', v)} />
                                <Input label="연락처" value={c.phone} onChange={(v: any) => handleUpdate('phone', v)} placeholder="010-0000-0000" />
                                <div className="grid grid-cols-2 gap-2">
                                    <Input
                                        label="출생년도 (2자리)"
                                        value={c.birth}
                                        onChange={(v: any) => handleUpdate('birth', v)}
                                        onBlur={handleBirthBlur}
                                        placeholder="예: 77"
                                        suffix={c.birth?.length === 4 ? "년생" : ""}
                                    />
                                    <Select label="성별" value={c.gender} onChange={(v: any) => handleUpdate('gender', v)} options={['남', '여']} />
                                </div>
                            </div>

                            {/* Section 3: Job & Family */}
                            <div>
                                <h3 className="font-bold text-gray-700 border-b pb-2 mb-4">직업 / 가족</h3>
                                <Select label="직업 (복수선택 가능)" value={c.jobTypes} onChange={handleJobTypeChange} options={JOB_TYPES} isMulti={true} />

                                {c.jobTypes?.includes('직장인') &&
                                    <Input label="직장인 월수입(만원)" type="number" value={c.incomeDetails.salary} onChange={(v: any) => handleIncomeChange('salary', v)} />
                                }
                                {(c.jobTypes?.includes('개인사업자') || c.jobTypes?.includes('법인사업자')) &&
                                    <Input label="사업자 월수입(만원)" type="number" value={c.incomeDetails.business} onChange={(v: any) => handleIncomeChange('business', v)} />
                                }
                                {c.jobTypes?.includes('프리랜서') &&
                                    <Input label="프리랜서 월수입(만원)" type="number" value={c.incomeDetails.freelance} onChange={(v: any) => handleIncomeChange('freelance', v)} />
                                }

                                <Select label="4대보험" value={c.insurance4} onChange={(v: any) => handleUpdate('insurance4', v)} options={['가입', '미가입']} />
                                <Select label="결혼여부" value={c.maritalStatus} onChange={(v: any) => handleUpdate('maritalStatus', v)} options={['미혼', '기혼', '이혼']} />

                                {c.maritalStatus !== '미혼' && (
                                    <div className="mb-4">
                                        <label className="block text-xs font-medium text-gray-500 mb-1">미성년 자녀 수</label>
                                        <div className="flex gap-2 flex-wrap">
                                            {[0, 1, 2, 3, 4, 5, 6, 7].map(num => (
                                                <button
                                                    key={num}
                                                    type="button"
                                                    onClick={() => handleUpdate('childrenCount', num)}
                                                    className={`px-3 py-1.5 text-xs rounded border ${c.childrenCount === num ? 'bg-blue-600 text-white border-blue-600' : 'bg-white text-gray-600 border-gray-300 hover:bg-gray-50'}`}
                                                >
                                                    {num}명
                                                </button>
                                            ))}
                                        </div>
                                    </div>
                                )}
                            </div>
                        </div>

                        <hr className="border-gray-100" />

                        <div className="grid md:grid-cols-2 gap-8">
                            <div>
                                <h3 className="font-bold text-gray-700 border-b pb-2 mb-4">주거</h3>
                                <Select label="거주형태" value={c.housingType} onChange={(v: any) => handleUpdate('housingType', v)} options={HOUSING_TYPES} />
                                <Select label="주거상세" value={c.housingDetail} onChange={(v: any) => handleUpdate('housingDetail', v)} options={HOUSING_DETAILS} />

                                {/* Conditional Fields based on Housing Type */}
                                {c.housingType === '자가' ? (
                                    <>
                                        <div className="grid grid-cols-2 gap-2">
                                            <Input label="집 시세(만원)" type="number" value={c.ownHousePrice} onChange={(v: any) => handleUpdate('ownHousePrice', v)} />
                                            <Input label="집 담보 대출(만원)" type="number" value={c.ownHouseLoan} onChange={(v: any) => handleUpdate('ownHouseLoan', v)} />
                                        </div>
                                        <Select label="집 명의자" value={c.ownHouseOwner} onChange={(v: any) => handleUpdate('ownHouseOwner', v)} options={['본인', '배우자']} />
                                    </>
                                ) : c.housingType === '무상거주' ? (
                                    <>
                                        <Select label="집 명의자" value={c.freeHousingOwner} onChange={(v: any) => handleUpdate('freeHousingOwner', v)} options={FREE_HOUSING_OWNERS} />
                                    </>
                                ) : (
                                    <>
                                        <div className="grid grid-cols-2 gap-2">
                                            <Input label="보증금(만원)" type="number" value={c.deposit} onChange={(v: any) => handleUpdate('deposit', v)} />
                                            <Input label="보증금 대출(만원)" type="number" value={c.depositLoanAmount} onChange={(v: any) => handleUpdate('depositLoanAmount', v)} />
                                        </div>
                                        <Input label="월세(만원)" type="number" value={c.rent} onChange={(v: any) => handleUpdate('rent', v)} />
                                        <div className="mb-4">
                                            <label className="block text-xs font-medium text-gray-500 mb-1">임대차 계약인</label>
                                            <div className="flex gap-2">
                                                {RENT_CONTRACTORS.map(opt => (
                                                    <button
                                                        key={opt}
                                                        type="button"
                                                        onClick={() => handleUpdate('rentContractor', opt)}
                                                        className={`flex-1 py-1.5 text-xs rounded border ${c.rentContractor === opt ? 'bg-blue-600 text-white border-blue-600' : 'bg-white text-gray-600 border-gray-300 hover:bg-gray-50'}`}
                                                    >
                                                        {opt}
                                                    </button>
                                                ))}
                                            </div>
                                        </div>
                                    </>
                                )}

                                <Input label="거주지역" value={c.region} onChange={(v: any) => handleUpdate('region', v)} />
                            </div>

                            <div>
                                <h3 className="font-bold text-gray-700 border-b pb-2 mb-4">자산 / 부채</h3>

                                <div className="mb-6 bg-blue-50 p-4 rounded-lg border border-blue-200">
                                    <h4 className="font-bold text-gray-700 mb-2 text-xs">자산 목록</h4>
                                    <div className="space-y-2 mb-3">
                                        {(!c.assets || c.assets.length === 0) && <p className="text-xs text-gray-400 text-center py-2">등록된 자산이 없습니다.</p>}
                                        {c.assets && c.assets.map((asset: AssetItem) => (
                                            <div key={asset.id} className="bg-white p-2 rounded border flex justify-between items-center text-xs">
                                                <div className="flex-1">
                                                    <span className="font-bold text-blue-600 mr-2">[{asset.owner}]</span>
                                                    <span className="font-semibold mr-2">{asset.type}</span>
                                                    <span className="text-gray-800 mr-2">시세 {asset.amount > 0 ? `${asset.amount.toLocaleString()}만원` : '0원'}</span>
                                                    {asset.loanAmount > 0 && <span className="text-red-500 mr-2">담보 {asset.loanAmount.toLocaleString()}만원</span>}
                                                    {asset.desc && <span className="text-gray-500">({asset.desc})</span>}
                                                </div>
                                                <button onClick={() => handleRemoveAsset(asset.id)} className="text-red-500 p-1">
                                                    <Trash2 size={14} />
                                                </button>
                                            </div>
                                        ))}
                                    </div>

                                    {/* Add New Asset Form */}
                                    <div className="grid grid-cols-2 gap-2 mb-2">
                                        <select
                                            className="p-1.5 border rounded text-xs bg-white"
                                            value={newAsset.owner}
                                            onChange={e => setNewAsset({ ...newAsset, owner: e.target.value as any })}
                                        >
                                            {ASSET_OWNERS.map(o => <option key={o} value={o}>{o}</option>)}
                                        </select>
                                        <select
                                            className="p-1.5 border rounded text-xs bg-white"
                                            value={newAsset.type}
                                            onChange={e => setNewAsset({ ...newAsset, type: e.target.value })}
                                        >
                                            {ASSET_TYPES.map(t => <option key={t} value={t}>{t}</option>)}
                                        </select>
                                    </div>
                                    <div className="grid grid-cols-2 gap-2 mb-2">
                                        <input
                                            type="number"
                                            placeholder="시세 (만원)"
                                            className="w-full p-1.5 border rounded text-xs"
                                            value={newAsset.amount || ''}
                                            onChange={e => setNewAsset({ ...newAsset, amount: Number(e.target.value) })}
                                        />
                                        <input
                                            type="number"
                                            placeholder="담보대출 (만원)"
                                            className="w-full p-1.5 border rounded text-xs"
                                            value={newAsset.loanAmount || ''}
                                            onChange={e => setNewAsset({ ...newAsset, loanAmount: Number(e.target.value) })}
                                        />
                                    </div>
                                    <input
                                        type="text"
                                        placeholder="상세 내용 (예: 차종 등)"
                                        className="w-full p-1.5 border rounded text-xs mb-2"
                                        value={newAsset.desc || ''}
                                        onChange={e => setNewAsset({ ...newAsset, desc: e.target.value })}
                                    />
                                    <button
                                        type="button"
                                        onClick={handleAddAsset}
                                        className="w-full py-1.5 bg-blue-600 text-white rounded text-xs font-bold flex justify-center items-center hover:bg-blue-700"
                                    >
                                        <Plus size={14} className="mr-1" /> 자산 추가
                                    </button>
                                </div>

                                <div className="mb-6 bg-pink-50 p-4 rounded-lg border border-pink-200">
                                    <h4 className="font-bold text-gray-700 mb-2 text-xs">신용대출 목록</h4>
                                    <div className="space-y-2 mb-3">
                                        {(!c.creditLoan || c.creditLoan.length === 0) && <p className="text-xs text-gray-400 text-center py-2">등록된 신용대출이 없습니다.</p>}
                                        {c.creditLoan?.map((loan: CreditLoanItem) => (
                                            <div key={loan.id} className="bg-white p-2 rounded border flex justify-between items-center text-xs">
                                                <div className="flex-1">
                                                    <span className="font-semibold mr-2">{loan.desc}</span>
                                                    <span className="text-gray-800">{loan.amount.toLocaleString()}만원</span>
                                                </div>
                                                <button type="button" onClick={() => handleRemoveCreditLoan(loan.id)} className="text-red-500 p-1">
                                                    <Trash2 size={14} />
                                                </button>
                                            </div>
                                        ))}
                                    </div>
                                    <div className="grid grid-cols-2 gap-2 mb-2">
                                        <input
                                            type="text"
                                            placeholder="대출 내용 (예: 햇살론)"
                                            className="w-full p-1.5 border rounded text-xs col-span-2"
                                            value={newCreditLoan.desc || ''}
                                            onChange={e => setNewCreditLoan({ ...newCreditLoan, desc: e.target.value })}
                                        />
                                        <input
                                            type="number"
                                            placeholder="금액 (만원)"
                                            className="w-full p-1.5 border rounded text-xs"
                                            value={newCreditLoan.amount || ''}
                                            onChange={e => setNewCreditLoan({ ...newCreditLoan, amount: Number(e.target.value) })}
                                        />
                                        <button
                                            type="button"
                                            onClick={handleAddCreditLoan}
                                            className="w-full py-1.5 bg-blue-600 text-white rounded text-xs font-bold flex justify-center items-center hover:bg-blue-700"
                                        >
                                            <Plus size={14} className="mr-1" /> 신용대출 추가
                                        </button>
                                    </div>
                                </div>

                                <div className="mb-4">
                                    <label className="block text-xs font-medium text-gray-500 mb-1">담보 대출 내용 (자동 집계 + 추가)</label>
                                    <div className="bg-gray-50 p-2 rounded text-xs text-blue-800 font-medium mb-1">
                                        자동 집계: {getAutoCollateralString()}
                                    </div>
                                    <input
                                        type="text"
                                        className="w-full p-2 border border-gray-300 rounded text-sm outline-none focus:ring-1 focus:ring-blue-500"
                                        value={c.collateralLoanMemo || ''}
                                        onChange={e => handleUpdate('collateralLoanMemo', e.target.value)}
                                        placeholder="추가로 작성할 담보 대출 내용"
                                    />
                                </div>

                                <div className="grid grid-cols-2 gap-2">
                                    <Select label="신용카드 사용" value={c.creditCardUse} onChange={(v: any) => handleUpdate('creditCardUse', v)} options={['사용', '미사용']} />
                                    {c.creditCardUse === '사용' && (
                                        <Input label="사용 금액(만원)" type="number" value={c.creditCardAmount} onChange={(v: any) => handleUpdate('creditCardAmount', v)} />
                                    )}
                                </div>
                                <Input label="월 대출납입(만원)" type="number" value={c.loanMonthlyPay} onChange={(v: any) => handleUpdate('loanMonthlyPay', v)} />
                            </div>
                        </div>

                        <div className="mt-4">
                            <h3 className="font-bold text-gray-700 border-b pb-2 mb-4">개인회생 / 파산 이력</h3>
                            <div className="flex gap-2 mb-2 flex-wrap">
                                {HISTORY_TYPES.map(opt => (
                                    <button
                                        key={opt}
                                        type="button"
                                        onClick={() => handleUpdate('historyType', opt)}
                                        className={`px-3 py-1.5 text-xs rounded border ${c.historyType === opt ? 'bg-blue-600 text-white border-blue-600' : 'bg-white text-gray-600 border-gray-300 hover:bg-gray-50'}`}
                                    >
                                        {opt}
                                    </button>
                                ))}
                            </div>
                            {c.historyType && c.historyType !== '없음' && (
                                <textarea
                                    className="w-full p-2 border border-gray-300 rounded text-sm h-24"
                                    value={c.historyMemo}
                                    onChange={e => handleUpdate('historyMemo', e.target.value)}
                                    placeholder="이력 상세 내용을 입력하세요."
                                />
                            )}
                        </div>
                    </div>
                )}

                {activeTab === 'summary' && (
                    <div className="text-center space-y-4">
                        <div className="bg-gray-800 text-white p-4 rounded text-left text-sm whitespace-pre-wrap font-mono leading-relaxed">
                            {generateSummary(c, currentPartner ? currentPartner.summaryTemplate : undefined)}
                        </div>
                        <button onClick={handleCopySummary} className="bg-blue-600 text-white px-6 py-3 rounded-lg font-bold flex items-center justify-center mx-auto hover:bg-blue-700">
                            <Copy className="mr-2" /> 요약문 복사하기
                        </button>
                    </div>
                )}

                {activeTab === 'settlement' && (
                    <div className="space-y-6">
                        <div className="bg-green-50 p-6 rounded-xl border border-green-100">
                            <h3 className="font-bold text-green-800 mb-4 text-lg">계약 및 수임료</h3>
                            <div className="grid md:grid-cols-2 gap-6">
                                <div>
                                    <label className="block text-sm font-bold text-green-900 mb-1">계약완료일 (정산기준)</label>
                                    <input
                                        type="date"
                                        className="w-full p-2 border border-green-300 rounded"
                                        value={c.contractAt || ''}
                                        onChange={e => handleUpdate('contractAt', e.target.value)}
                                    />
                                </div>
                                <div>
                                    <label className="block text-sm font-bold text-green-900 mb-1">총 수임료 (만원)</label>
                                    <input
                                        type="number"
                                        className="w-full p-2 border border-green-300 rounded text-right font-mono"
                                        value={c.contractFee || 0}
                                        onChange={e => handleUpdate('contractFee', Number(e.target.value))}
                                    />
                                </div>
                            </div>

                            <div className="mt-4 pt-4 border-t border-green-200 flex justify-between items-center">
                                <span className="text-sm text-green-700 font-medium">예상 수당 (Commission):</span>
                                <span className="text-xl font-bold text-green-900">{commission.toLocaleString()}만원</span>
                            </div>
                        </div>

                        <div className="grid md:grid-cols-2 gap-6">
                            <div className="bg-gray-50 p-4 rounded">
                                <h4 className="font-bold text-gray-600 mb-3">1차 입금</h4>
                                <Input label="금액(만원)" type="number" value={c.deposit1Amount || 0} onChange={(v: any) => handleUpdate('deposit1Amount', v)} />
                                <Input label="입금일" type="date" value={c.deposit1Date || ''} onChange={(v: any) => handleUpdate('deposit1Date', v)} />
                            </div>
                            <div className="bg-gray-50 p-4 rounded">
                                <h4 className="font-bold text-gray-600 mb-3">2차 입금</h4>
                                <Input label="금액(만원)" type="number" value={c.deposit2Amount || 0} onChange={(v: any) => handleUpdate('deposit2Amount', v)} />
                                <Input label="입금일" type="date" value={c.deposit2Date || ''} onChange={(v: any) => handleUpdate('deposit2Date', v)} />
                            </div>
                        </div>
                    </div>
                )}
            </div>
        </div>
    );
}
