
import React, { useEffect, useState, useRef } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { fetchCases, fetchPartners, updateCase, addMemo, deleteMemo, fetchCaseStatusLogs, fetchInboundPaths, fetchStatuses, changeStatus, markCaseAsSeen, fetchSecondaryStatuses } from '../services/api';
import { Case, Partner, MemoItem, CaseStatusLog, CaseStatus, AssetItem, CreditLoanItem, ReminderItem, RecordingItem, ReminderType } from '../types';
import { ChevronLeft, Save, Plus, Trash2, Phone, MessageSquare, AlertTriangle, CalendarClock, Send, Play, Pause, Download, Volume2, Mic, Clock, FileText, Archive, PlayCircle, X, Edit2, Sparkles, Check, Copy } from 'lucide-react';
import { format } from 'date-fns';
import { formatPhone, MANAGER_NAME, CASE_TYPES, JOB_TYPES, HOUSING_TYPES, HOUSING_DETAILS, ASSET_OWNERS, ASSET_TYPES, RENT_CONTRACTORS, HISTORY_TYPES, FREE_HOUSING_OWNERS, AVAILABLE_FIELDS_CONFIG, formatMoney, DEFAULT_AI_PROMPT, STATUS_COLOR_MAP } from '../constants';
import { useToast } from '../contexts/ToastContext';
import { generateSummary, getCaseWarnings, calculateCommission, normalizeBirthYear, fileToBase64, convertToPlayableUrl, convertToPreviewUrl, injectSummaryMetadata, extractSummarySpecifics } from '../utils';
import { GoogleGenerativeAI } from "@google/generative-ai";
import { v4 as uuidv4 } from 'uuid';
import { CustomAudioPlayer } from '../components/CustomAudioPlayer';

// Reusable Components within CaseDetail
const Input = ({ label, value, onChange, onBlur, type = "text", placeholder = "", suffix = "", readOnly = false }: any) => {
    // [Fix] Handle number inputs as text to prevent IME mode switching
    const displayValue = type === 'number' && (value === 0 || value === undefined || value === null) ? '' : value;

    const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        const val = e.target.value;
        if (type === 'number') {
            // Allow only numbers
            if (val === '' || /^[0-9]+$/.test(val)) {
                onChange(val === '' ? 0 : Number(val));
            }
        } else {
            onChange(val);
        }
    };

    return (
        <div className="mb-4">
            <label className="block text-xs font-medium text-gray-500 mb-1">{label}</label>
            <div className="relative">
                <input
                    type={type === 'number' ? 'text' : type}
                    autoComplete="off"
                    className={"w-full p-2 border border-blue-300 rounded text-sm outline-none " + (readOnly ? 'bg-gray-100 text-gray-500 cursor-not-allowed' : 'focus:ring-1 focus:ring-blue-500')}
                    value={displayValue}
                    onChange={!readOnly ? handleInputChange : undefined}
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
                        className={"px-3 py-1.5 text-xs rounded border " + (isSelected ? 'bg-blue-600 text-white border-blue-600' : 'bg-white text-gray-600 border-gray-300 hover:bg-gray-50')}
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
    const [isLoading, setIsLoading] = useState(true);
    const [partners, setPartners] = useState<Partner[]>([]);
    const [inboundPaths, setInboundPaths] = useState<string[]>([]);
    const [statuses, setStatuses] = useState<CaseStatus[]>([]);
    const [secondaryStatuses, setSecondaryStatuses] = useState<string[]>([]);
    const [activeTab, setActiveTab] = useState<'info' | 'summary' | 'settlement'>('info');

    const [newAsset, setNewAsset] = useState<Partial<AssetItem>>({ owner: '본인', type: '자동차', amount: 0, loanAmount: 0, rentDeposit: 0, desc: '' });
    const [newCreditLoan, setNewCreditLoan] = useState<Partial<CreditLoanItem>>({ amount: 0, desc: '' });
    const [newMemoContent, setNewMemoContent] = useState('');

    // Reminder State
    // Split Date/Time state for custom UI
    const [remDate, setRemDate] = useState('');
    const [remHour, setRemHour] = useState('09');
    const [remMinute, setRemMinute] = useState('00');
    // Derived Full DateTime for API (kept for compatibility)
    const [newReminderDateTime, setNewReminderDateTime] = useState('');

    // Effect to sync separate fields to full datetime string
    useEffect(() => {
        if (remDate && remHour && remMinute) {
            setNewReminderDateTime(`${remDate} ${remHour}:${remMinute}`);
        } else {
            setNewReminderDateTime('');
        }
    }, [remDate, remHour, remMinute]);
    const [newReminderType, setNewReminderType] = useState<ReminderType>('통화');
    const [newReminderContent, setNewReminderContent] = useState('');
    const [confirmingDeleteReminderId, setConfirmingDeleteReminderId] = useState<string | null>(null);

    // Memo Edit State
    const [editingMemoId, setEditingMemoId] = useState<string | null>(null);
    const [editMemoContent, setEditMemoContent] = useState('');
    const [confirmingDeleteMemoId, setConfirmingDeleteMemoId] = useState<string | null>(null);

    // AI Summary & Audio State
    const [isAiLoading, setIsAiLoading] = useState(false);
    const [aiSummaryEditMode, setAiSummaryEditMode] = useState(false);
    const [aiSummaryText, setAiSummaryText] = useState('');
    // [NEW] Manual Summary State
    const [manualSummary, setManualSummary] = useState('');
    const [isManualSummaryEdit, setIsManualSummaryEdit] = useState(false);

    const [currentAudioFile, setCurrentAudioFile] = useState<File | null>(null);
    const [audioUrl, setAudioUrl] = useState<string | null>(null);
    const [isFileUploading, setIsFileUploading] = useState(false); // [NEW] Upload State
    const audioInputRef = useRef<HTMLInputElement>(null);
    const audioPlayerRef = useRef<HTMLAudioElement>(null);

    // Status Change History
    const [statusLogs, setStatusLogs] = useState<CaseStatusLog[]>([]);
    const [isStatusModalOpen, setIsStatusModalOpen] = useState(false);
    const [pendingStatus, setPendingStatus] = useState<CaseStatus | null>(null);
    const [statusChangeReason, setStatusChangeReason] = useState('');

    // [NEW] Secondary Status Change Modal
    const [isSecondaryStatusModalOpen, setIsSecondaryStatusModalOpen] = useState(false);
    const [pendingSecondaryStatus, setPendingSecondaryStatus] = useState<string | null>(null);
    const [secondaryStatusChangeReason, setSecondaryStatusChangeReason] = useState('');


    useEffect(() => {
        if (caseId) {
            Promise.all([fetchCases(), fetchPartners(), fetchInboundPaths(), fetchStatuses(), fetchSecondaryStatuses()]).then(([caseData, partnerData, pathData, statusData, secondaryStatusData]) => {
                const foundCase = caseData.find(x => x.caseId === caseId) || null;
                if (foundCase) {
                    // Remove isNew flag if present (Mark as read)
                    if (foundCase.isNew) {
                        foundCase.isNew = false;
                        updateCase(foundCase.caseId, { isNew: false });
                    }

                    // Ensure data structure is up-to-date for older records
                    if (typeof (foundCase as any).jobType === 'string') {
                        foundCase.jobTypes = [(foundCase as any).jobType];
                        delete (foundCase as any).jobType;
                    }
                    if (!foundCase.jobTypes) foundCase.jobTypes = [];
                    if (!foundCase.incomeDetails) foundCase.incomeDetails = {};
                    if (!foundCase.reminders) foundCase.reminders = [];
                    if (!foundCase.recordings) foundCase.recordings = [];

                    setCase(foundCase);
                    markCaseAsSeen(foundCase.caseId);
                }
                setPartners(partnerData);
                setInboundPaths(pathData);
                setStatuses(statusData);
                setSecondaryStatuses(secondaryStatusData);
                if (foundCase?.aiSummary) {
                    setAiSummaryText(injectSummaryMetadata(foundCase.aiSummary, foundCase));
                }


            }).finally(() => setIsLoading(false));
            fetchCaseStatusLogs(caseId).then(setStatusLogs);
        }
        return () => {
            if (audioUrl) URL.revokeObjectURL(audioUrl);
        };
    }, [caseId]);

    if (isLoading) return <div className="p-8 text-center text-gray-500">로딩중...</div>;
    if (!c) return <div className="p-8 text-center text-gray-500">데이터를 찾을 수 없습니다.</div>;

    const currentPartner = partners.find(p => p.partnerId === c.partnerId);
    const rules = currentPartner ? currentPartner.commissionRules : [];

    const handleStatusChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
        const newStatus = e.target.value as CaseStatus;
        setPendingStatus(newStatus);
        // Delay modal slightly to allow native mobile picker to close cleanly
        setTimeout(() => {
            setIsStatusModalOpen(true);
        }, 100);
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

    // [NEW] 2차 상태 변경 핸들러
    const handleSecondaryStatusChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
        const newStatus = e.target.value;
        if (newStatus === (c?.secondaryStatus || '')) return; // No change
        setPendingSecondaryStatus(newStatus || null);
        setTimeout(() => {
            setIsSecondaryStatusModalOpen(true);
        }, 100);
        setSecondaryStatusChangeReason('');
    };

    // [NEW] 2차 상태 변경 확인
    const confirmSecondaryStatusChange = async () => {
        if (!c || pendingSecondaryStatus === null) return;
        try {
            const newSecondaryStatus = pendingSecondaryStatus || undefined;
            const oldSecondaryStatus = c.secondaryStatus || '없음';

            // 상담 이력에 변경 내용 기록
            const changeNote = `[2차 상태 변경] ${oldSecondaryStatus} → ${pendingSecondaryStatus || '없음'}${secondaryStatusChangeReason ? '\n사유: ' + secondaryStatusChangeReason : ''}`;
            const newMemo: MemoItem = {
                id: Date.now().toString(),
                createdAt: new Date().toISOString(),
                content: changeNote,
            };
            const updatedMemos = [newMemo, ...(c.specialMemo || [])];

            // 케이스 업데이트
            const updatedCase = { ...c, secondaryStatus: newSecondaryStatus, specialMemo: updatedMemos };
            setCase(updatedCase);
            await updateCase(c.caseId, { secondaryStatus: newSecondaryStatus, specialMemo: updatedMemos });

            showToast('2차 상태가 변경되었습니다.');
            setIsSecondaryStatusModalOpen(false);
            setPendingSecondaryStatus(null);
        } catch (error) {
            showToast("2차 상태 변경에 실패했습니다.", 'error');
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
            rentDeposit: newAsset.rentDeposit || 0,
            desc: newAsset.desc || ''
        };
        const updatedAssets = c.assets ? [...c.assets, asset] : [asset];
        handleUpdate('assets', updatedAssets);
        setNewAsset({ owner: '본인', type: '자동차', amount: 0, loanAmount: 0, rentDeposit: 0, desc: '' }); // Reset
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
            type: newReminderType,
            content: newReminderContent
        };
        const updatedReminders = [...c.reminders, newReminder];
        handleUpdate('reminders', updatedReminders);

        // Reset fields
        setRemDate('');
        setRemHour('09');
        setRemMinute('00');
        setNewReminderDateTime('');
        setNewReminderContent('');
        setNewReminderType('통화');
        showToast('다음 일정이 추가되었습니다.');
    };

    const handleDeleteReminder = (id: string) => {
        if (!c || !c.reminders) return;
        const updatedReminders = c.reminders.filter(r => r.id !== id);
        handleUpdate('reminders', updatedReminders);
        setConfirmingDeleteReminderId(null);
        showToast('일정이 삭제되었습니다.');
    };

    // --- Audio & AI Summary Logic ---
    const handleAudioFileSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (file) {
            // 20MB Limit check
            if (file.size > 20 * 1024 * 1024) {
                showToast('파일 크기는 20MB를 초과할 수 없습니다.', 'error');
                return;
            }

            setCurrentAudioFile(file);

            // 1. Temporary Local Playback
            const localUrl = URL.createObjectURL(file);
            setAudioUrl(localUrl);

            // 2. Upload to Server (Google Drive)
            try {
                setIsFileUploading(true);
                showToast("클라우드(구글 드라이브)에 업로드 중입니다... 잠시만 기다려주세요.");

                // Dynamic Import to avoid cycle if any, though api is already imported
                const { uploadRecording } = await import('../services/api');
                const { fileToBase64, convertToPlayableUrl } = await import('../utils');
                const { url: serverUrl, id: fileId } = await uploadRecording(file);

                showToast("업로드가 완료되었습니다. 이제 어디서든 듣기가 가능합니다!", 'success');

                const newRecording: RecordingItem = {
                    id: fileId || uuidv4(),
                    filename: file.name,
                    uploadDate: new Date().toISOString(),
                    url: serverUrl, // Persistent Drive URL
                    mimeType: file.type
                };

                if (c) {
                    const updatedRecordings = [newRecording, ...(c.recordings || [])];
                    handleUpdate('recordings', updatedRecordings);
                }

            } catch (error) {
                console.error("Upload failed", error);
                showToast('업로드 실패: 로컬에서만 재생 가능합니다.', 'error');

                // Fallback: Save with Local URL (Will expire) - Better than nothing?
                // Or maybe just fail. Let's add it locally with a warning.
                const fallbackRecording: RecordingItem = {
                    id: uuidv4(),
                    filename: file.name + " (미동기화)",
                    uploadDate: new Date().toISOString(),
                    url: localUrl,
                    mimeType: file.type
                };
                if (c) {
                    handleUpdate('recordings', [fallbackRecording, ...(c.recordings || [])]);
                }
            } finally {
                setIsFileUploading(false);
            }
        }
    };

    const triggerAudioInput = () => {
        audioInputRef.current?.click();
    };

    const handlePlayRecording = (rec: RecordingItem) => {
        // Just set the URL, the conditional render below will handle the iframe vs audio tag
        setAudioUrl(rec.url);
        setCurrentAudioFile(null); // Clear local file selection if playing from list
        showToast(rec.filename + " 재생을 준비합니다.");
    };

    const handleDeleteRecording = (id: string) => {
        if (!c) return;
        if (confirm('이 녹음 파일을 목록에서 삭제하시겠습니까?')) {
            const updated = (c.recordings || []).filter(r => r.id !== id);
            handleUpdate('recordings', updated);
        }
    };

    // [Fix] Inject metadata when generating
    const handleGenerateAiSummary = async () => {
        if (!c) return;

        // Use current file or try to fetch from latest recording if exists
        let fileToProcess = currentAudioFile;

        if (!fileToProcess && (!c.recordings || c.recordings.length === 0)) {
            showToast("분석할 통화 녹음 파일이 없습니다.", 'error');
            return;
        }

        if (!fileToProcess) {
            showToast("분석을 위해 파일을 선택해주세요.", 'error');
            triggerAudioInput();
            return;
        }

        const partner = partners.find(p => p.partnerId === c.partnerId);
        const promptTemplate = partner?.aiPromptTemplate || DEFAULT_AI_PROMPT;

        setIsAiLoading(true);
        try {
            // [Security Warning] Hardcoded fallback for immediate deployment stability. 
            // Ideally, set VITE_GEMINI_API_KEY in Vercel/Pipeline environment variables.
            const apiKey = import.meta.env.VITE_GEMINI_API_KEY || "AIzaSyAcY0S1fvge0FtV_GsmEo5u15vdsau4sBU";

            if (!apiKey) {
                throw new Error("API Key is missing. Check VITE_GEMINI_API_KEY in .env file.");
            }

            const genAI = new GoogleGenerativeAI(apiKey);
            // using 'gemini-flash-latest' for better stability and free tier limits
            const model = genAI.getGenerativeModel({ model: "gemini-flash-latest" });

            const contextText = "\n[기본 정보]\n고객명: " + c.customerName + "\n연락처: " + c.phone + "\n직업: " + (c.jobTypes?.join(', ')) + "\n\n[기존 상담 이력]\n" + (c.specialMemo?.map(m => m.content).join('\n') || '없음') + "\n\n[사전 정보]\n" + (c.preInfo || '없음') + "\n";

            const parts: any[] = [];

            // Add Audio
            if (fileToProcess) {
                const base64Content = await fileToBase64(fileToProcess); // utils already removes the header
                // Fallback mime type if file.type is empty (common with some audio recordings)
                const mimeType = fileToProcess.type || 'audio/mp3';

                parts.push({
                    inlineData: {
                        mimeType: mimeType,
                        data: base64Content
                    }
                });
            }

            // Add Text Prompt
            parts.push({
                text: promptTemplate + "\n\n" + contextText
            });

            // Retry Logic with Exponential Backoff
            let attempt = 0;
            const maxRetries = 3;
            let summary = "";

            while (attempt < maxRetries) {
                try {
                    const result = await model.generateContent(parts);
                    const response = await result.response;
                    summary = response.text();
                    break; // Success
                } catch (err: any) {
                    attempt++;
                    console.warn(`AI Attempt ${attempt} failed: `, err);

                    // Check for 429 or 503 errors and retry
                    if ((err.message?.includes('429') || err.message?.includes('503')) && attempt < maxRetries) {
                        const waitTime = Math.pow(2, attempt) * 1000 + Math.random() * 500; // Exponential backoff + Jitter
                        await new Promise(resolve => setTimeout(resolve, waitTime));
                        continue;
                    }
                    throw err; // Re-throw if not retryable or max retries reached
                }
            }

            if (summary) {
                const injected = injectSummaryMetadata(summary, c);
                setAiSummaryText(injected);
                handleUpdate('aiSummary', injected);
                showToast('AI 요약이 생성되었습니다.');
            } else {
                showToast('AI 요약 내용이 비어있습니다.', 'error');
            }

        } catch (e: any) {
            console.error("AI Generation Error:", e);
            if (e.message?.includes('429')) {
                showToast('사용량이 많아 지연되고 있습니다. 잠시 후 다시 시도해주세요.', 'error');
            } else {
                showToast('오류: ' + (e.message || "AI 요약 생성 실패"), 'error');
            }
        } finally {
            setIsAiLoading(false);
        }
    };



    const handleSaveSummaryToMemo = () => {
        if (!aiSummaryText.trim()) return;

        // [Refactor] Extract Specifics only using helper
        const specifics = extractSummarySpecifics(aiSummaryText);
        // If specifics is same as full text (extraction failed or returned full), use full label?
        // Actually, helper returns full text if not found.
        // User wants "Specifics Only". If extraction fails, maybe we label it as full?
        const finalContent = specifics.length < aiSummaryText.length
            ? "[AI 요약 - 특이사항]\n" + specifics
            : "[AI 요약]\n" + aiSummaryText;

        const newMemo: MemoItem = {
            id: Date.now().toString(),
            createdAt: new Date().toISOString(),
            content: finalContent,
        };
        const updatedMemos = [newMemo, ...(c.specialMemo || [])];
        handleUpdate('specialMemo', updatedMemos);
        showToast('상담 내용(특이사항)으로 저장되었습니다.');
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
        if ((c.depositLoanAmount || 0) > 0) parts.push("보증금 대출 " + c.depositLoanAmount + " 만원");
        if ((c.ownHouseLoan || 0) > 0) parts.push("집 담보 대출 " + c.ownHouseLoan + " 만원");
        if (c.assets) {
            c.assets.forEach((a: AssetItem) => {
                if (a.loanAmount > 0) parts.push(a.type + " 담보 " + a.loanAmount + " 만원");
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
                        <div className="flex flex-wrap items-center gap-2">
                            <span className={"px-2 py-0.5 rounded text-xs font-bold text-white whitespace-nowrap " + (['개인회생', '파산'].includes(c.caseType || '') ? 'bg-indigo-500' : 'bg-gray-500')}>
                                {c.caseType}
                            </span>
                            <span className="text-xs bg-gray-100 text-gray-600 px-2 py-0.5 rounded font-bold border border-gray-200 whitespace-nowrap">
                                {currentPartner?.name || '거래처 미정'}
                            </span>
                            <h1 className="text-xl md:text-2xl font-bold text-gray-900 whitespace-nowrap">{c.customerName}</h1>
                            <span className="text-gray-500 whitespace-nowrap">{c.phone}</span>
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

                    <div className="flex flex-col md:flex-row gap-2">
                        <div className="flex flex-col gap-1">
                            <label className="text-xs text-gray-400 font-medium">1차 상태</label>
                            <select
                                className={"p-2 border border-gray-300 rounded font-semibold outline-none min-w-[140px] " + (STATUS_COLOR_MAP[c.status] || 'bg-blue-50 text-blue-800')}
                                value={pendingStatus || c.status}
                                onChange={handleStatusChange}
                            >
                                {statuses.map(s => <option key={s} value={s}>{s}</option>)}
                            </select>
                        </div>
                        {/* 2차 상태 (사무장 접수 이후에만 표시) */}
                        {c.status === '사무장 접수' && (
                            <div className="flex flex-col gap-1">
                                <label className="text-xs text-purple-500 font-medium">2차 상태</label>
                                <select
                                    className="p-2 border border-purple-300 rounded font-semibold outline-none min-w-[140px] bg-purple-50 text-purple-800"
                                    value={pendingSecondaryStatus !== null ? pendingSecondaryStatus : (c.secondaryStatus || '')}
                                    onChange={handleSecondaryStatusChange}
                                >
                                    <option value="">선택 안함</option>
                                    {secondaryStatuses.map(s => <option key={s} value={s}>{s}</option>)}
                                </select>
                            </div>
                        )}
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

            {/* [NEW] Secondary Status Change Modal */}
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
                    <div className="space-y-8">
                        {/* Section 1: Reminder & Memos */}
                        <div className="bg-yellow-50 p-4 rounded-lg border border-yellow-100">
                            <h3 className="font-bold text-yellow-800 mb-2 flex items-center gap-2">📅 리마인더 및 상담 이력</h3>
                            <div className="grid md:grid-cols-2 gap-4">
                                {/* Reminder Settings */}
                                <div className="bg-white p-3 rounded-lg border border-yellow-200 shadow-sm">
                                    <label className="block text-xs font-bold text-yellow-800 mb-2">다음 일정 등록 ({sortedReminders.length}/5)</label>
                                    <div className="flex flex-col md:flex-row gap-2 mb-3">
                                        <div className="flex flex-col gap-2 flex-[2]">
                                            {/* Date Picker (Full Width on Mobile) */}
                                            <input
                                                type="date"
                                                className="w-full p-2 border border-blue-300 rounded text-sm outline-none focus:ring-1 focus:ring-blue-500"
                                                value={remDate}
                                                onChange={e => setRemDate(e.target.value)}
                                                disabled={(c.reminders?.length || 0) >= 5}
                                            />
                                            {/* Time & Type (Row on Mobile) */}
                                            <div className="flex gap-1">
                                                {/* Hour Select */}
                                                <select
                                                    className="flex-1 p-2 border border-blue-300 rounded text-sm outline-none focus:ring-1 focus:ring-blue-500"
                                                    value={remHour}
                                                    onChange={e => setRemHour(e.target.value)}
                                                    disabled={(c.reminders?.length || 0) >= 5}
                                                >
                                                    {Array.from({ length: 24 }).map((_, i) => {
                                                        const h = i.toString().padStart(2, '0');
                                                        return <option key={h} value={h}>{h}시</option>;
                                                    })}
                                                </select>
                                                {/* Minute Select */}
                                                <select
                                                    className="flex-1 p-2 border border-blue-300 rounded text-sm outline-none focus:ring-1 focus:ring-blue-500"
                                                    value={remMinute}
                                                    onChange={e => setRemMinute(e.target.value)}
                                                    disabled={(c.reminders?.length || 0) >= 5}
                                                >
                                                    {['00', '10', '20', '30', '40', '50'].map(m => (
                                                        <option key={m} value={m}>{m}분</option>
                                                    ))}
                                                </select>
                                                <select
                                                    className="flex-1 p-2 border border-blue-300 rounded text-sm outline-none focus:ring-1 focus:ring-blue-500 min-w-[60px]"
                                                    value={newReminderType}
                                                    onChange={e => setNewReminderType(e.target.value as any)}
                                                >
                                                    <option value="통화">통화</option>
                                                    <option value="출장미팅">출장미팅</option>
                                                    <option value="방문미팅">방문미팅</option>
                                                    <option value="입금">입금</option>
                                                    <option value="기타">기타</option>
                                                </select>
                                            </div>
                                        </div>
                                    </div>
                                    <div className="flex gap-2">
                                        <input
                                            type="text"
                                            className="flex-1 p-2 border border-gray-300 rounded text-sm"
                                            placeholder={newReminderType === '기타' ? "일정 내용을 입력하세요" : "메모 (선택사항)"}
                                            value={newReminderContent}
                                            onChange={e => setNewReminderContent(e.target.value)}
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
                                                <div key={reminder.id} className="bg-blue-50 border border-blue-100 rounded p-2 flex flex-col gap-2">
                                                    <div className="flex flex-col md:flex-row md:justify-between md:items-center w-full gap-2">
                                                        <div className="flex items-center gap-2 flex-wrap">
                                                            <CalendarClock size={16} className="text-blue-600 flex-shrink-0" />
                                                            <span className="text-sm font-bold text-gray-800 whitespace-nowrap">{reminder.datetime}</span>
                                                            <span className={`text-[10px] px-1.5 py-0.5 rounded font-bold whitespace-nowrap ${reminder.type === '방문미팅' ? 'bg-purple-100 text-purple-700' :
                                                                reminder.type === '출장미팅' ? 'bg-green-100 text-green-700' :
                                                                    'bg-blue-100 text-blue-700'
                                                                }`}>
                                                                {reminder.type || '통화'}
                                                            </span>
                                                        </div>
                                                        {reminder.content && (
                                                            <span className="text-xs text-gray-600 break-words w-full md:w-auto md:max-w-[200px]">
                                                                {reminder.content}
                                                            </span>
                                                        )}
                                                    </div>

                                                    {/* Result Action Area */}
                                                    <div className="pt-2 border-t border-blue-100 w-full">
                                                        {reminder.resultStatus ? (
                                                            <div className="flex justify-between items-center text-xs">
                                                                <span className={`font-bold px-2 py-0.5 rounded ${reminder.resultStatus === '완료' ? 'bg-green-100 text-green-700' :
                                                                    reminder.resultStatus === '미연결' ? 'bg-red-100 text-red-700' :
                                                                        reminder.resultStatus === '재예약' ? 'bg-blue-100 text-blue-700' :
                                                                            'bg-gray-100 text-gray-700'
                                                                    }`}>
                                                                    {reminder.resultStatus}
                                                                </span>
                                                                <div className="flex items-center gap-2">
                                                                    <span className="text-gray-500 truncate max-w-[150px]">{reminder.resultNote}</span>
                                                                    <button onClick={() => {
                                                                        const newReminders = c.reminders.map(r => r.id === reminder.id ? { ...r, resultStatus: undefined, resultNote: undefined } : r);
                                                                        handleUpdate('reminders', newReminders);
                                                                    }} className="text-gray-400 hover:text-gray-600 underline whitespace-nowrap">수정</button>
                                                                </div>
                                                            </div>
                                                        ) : (
                                                            <div className="flex items-center gap-2 overflow-x-auto no-scrollbar pb-1">
                                                                <span className="text-xs text-blue-400 font-bold flex-shrink-0">결과:</span>
                                                                {['완료', '미연결', '재예약', '취소'].map((status) => (
                                                                    <button
                                                                        key={status}
                                                                        type="button"
                                                                        onClick={() => {
                                                                            const note = prompt(`${status} 처리에 대한 메모를 남겨주세요 (선택):`);
                                                                            const newReminders = c.reminders.map(r => r.id === reminder.id ? { ...r, resultStatus: status, resultNote: note || '' } : r);
                                                                            handleUpdate('reminders', newReminders);

                                                                            if (status === '재예약') {
                                                                                // Optional: Trigger focus to date input or show toast
                                                                            }
                                                                        }}
                                                                        className={`text-[10px] px-2 py-1 rounded border flex-shrink-0 transition-colors ${status === '완료' ? 'border-green-200 text-green-700 hover:bg-green-50' :
                                                                            status === '미연결' ? 'border-red-200 text-red-700 hover:bg-red-50' :
                                                                                status === '재예약' ? 'border-blue-200 text-blue-700 hover:bg-blue-50' :
                                                                                    'border-gray-200 text-gray-600 hover:bg-gray-50'
                                                                            }`}
                                                                    >
                                                                        {status}
                                                                    </button>
                                                                ))}
                                                                {confirmingDeleteReminderId === reminder.id ? (
                                                                    <div className="flex gap-2 flex-shrink-0">
                                                                        <button onClick={() => handleDeleteReminder(reminder.id)} className="text-green-600 text-xs font-bold">확인</button>
                                                                        <button onClick={() => setConfirmingDeleteReminderId(null)} className="text-red-500 text-xs">취소</button>
                                                                    </div>
                                                                ) : (
                                                                    <button
                                                                        onClick={() => setConfirmingDeleteReminderId(reminder.id)}
                                                                        className="text-red-500 p-1 hover:bg-red-50 rounded flex-shrink-0"
                                                                        title="일정 삭제"
                                                                    >
                                                                        <Trash2 size={16} />
                                                                    </button>
                                                                )}
                                                            </div>
                                                        )}
                                                    </div>
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
                                    <Sparkles size={18} className="flex-shrink-0" />
                                    <div className="flex flex-col leading-none">
                                        <span>AI 상담 요약</span>
                                        <span>& 녹음</span>
                                    </div>
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
                                        disabled={isFileUploading}
                                        className={"flex items-center gap-1 text-xs px-2 py-1.5 rounded border " + (currentAudioFile ? 'bg-green-100 text-green-700 border-green-300' : 'bg-white text-gray-600 border-gray-300') + (isFileUploading ? ' opacity-50 cursor-not-allowed' : '')}
                                    >
                                        <Mic size={14} className="flex-shrink-0" />
                                        <span className="text-center leading-tight">
                                            {isFileUploading ? '업로드중...' : (currentAudioFile ? '파일 변경' : <>녹음파일<br />업로드</>)}
                                        </span>
                                    </button>

                                    <button
                                        onClick={handleGenerateAiSummary}
                                        disabled={isAiLoading}
                                        className="flex items-center gap-1 text-xs bg-purple-600 text-white px-3 py-1.5 rounded font-bold hover:bg-purple-700 disabled:opacity-50 transition-colors shadow-sm"
                                    >
                                        {isAiLoading ? '분석 중...' : <span className="text-center leading-tight">요약<br />실행</span>}
                                    </button>
                                </div>
                            </div>

                            {/* Audio Player for Current or Selected */}
                            <div className="mb-4">
                                {(audioUrl || currentAudioFile) && (
                                    <CustomAudioPlayer
                                        src={audioUrl && audioUrl.includes('drive.google.com') ? convertToPlayableUrl(audioUrl) : (audioUrl || '')}
                                        fileName={currentAudioFile ? currentAudioFile.name : `녹음 파일 (ID: ${c.recordings?.find(r => r.url === audioUrl)?.id.substring(0, 8)}...)`}
                                    />
                                )}
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

                                {/* Partner & Inbound PathRow */}
                                <div className="grid grid-cols-2 gap-2 mb-4">
                                    <div className="flex-1">
                                        <label className="block text-xs font-medium text-gray-500 mb-1">거래처 (법률사무소)</label>
                                        <select
                                            className="w-full p-2 border border-gray-300 rounded text-sm bg-gray-50"
                                            value={c.partnerId}
                                            onChange={e => handleUpdate('partnerId', e.target.value)}
                                        >
                                            {partners.map(p => <option key={p.partnerId} value={p.partnerId}>{p.name}</option>)}
                                        </select>
                                    </div>
                                    <div className="flex-1">
                                        <label className="block text-xs font-medium text-gray-500 mb-1">유입 경로</label>
                                        <select
                                            className="w-full p-2 border border-gray-300 rounded text-sm focus:ring-1 focus:ring-blue-500 outline-none"
                                            value={c.inboundPath}
                                            onChange={e => handleUpdate('inboundPath', e.target.value)}
                                        >
                                            <option value="">선택하세요</option>
                                            {inboundPaths.map(p => <option key={p} value={p}>{p}</option>)}
                                        </select>
                                    </div>
                                </div>

                                <div className="mb-4">
                                    <label className="block text-xs font-medium text-gray-500 mb-1">사전 고객 정보 (리드 수집 정보)</label>
                                    <div className={"w-full p-2 border border-gray-200 rounded text-sm bg-gray-50 min-h-[40px] " + (!c.preInfo ? 'text-gray-400' : 'text-gray-800')}>
                                        {c.preInfo ? c.preInfo.split(/\s\/\s|\n/).filter((line: string) => {
                                            const lower = line.toLowerCase();
                                            return !lower.includes('[referrer]') &&
                                                !lower.includes('[marketing_consent]') &&
                                                !lower.includes('[third_party_consent]') &&
                                                !lower.includes('[user_agent]') &&
                                                line.trim() !== '';
                                        }).map((line: string, idx: number) => (
                                            <div key={idx} className="flex items-start gap-1">
                                                <span className="text-blue-500 font-bold">*</span>
                                                <span>{line.trim()}</span>
                                            </div>
                                        )) : <span className="text-gray-400 italic">사전 정보 없음</span>}
                                    </div>
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
                                <div className="mb-4">
                                    <Select label="사건 유형" value={c.caseType} onChange={(v: any) => handleUpdate('caseType', v)} options={CASE_TYPES} />
                                </div>

                                <Input label="이름" value={c.customerName} onChange={(v: any) => handleUpdate('customerName', v)} />
                                <Input
                                    label="연락처"
                                    value={c.phone}
                                    onChange={(v: any) => handleUpdate('phone', formatPhone(v))}
                                    placeholder="010-0000-0000"
                                />
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
                                                    className={"px-3 py-1.5 text-xs rounded border " + (c.childrenCount === num ? 'bg-blue-600 text-white border-blue-600' : 'bg-white text-gray-600 border-gray-300 hover:bg-gray-50')}
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
                                        <Select label="집 명의자" value={c.ownHouseOwner} onChange={(v: any) => handleUpdate('ownHouseOwner', v)} options={['본인', '배우자', '배우자 공동명의']} />
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
                                                        className={"flex-1 py-1.5 text-xs rounded border " + (c.rentContractor === opt ? 'bg-blue-600 text-white border-blue-600' : 'bg-white text-gray-600 border-gray-300 hover:bg-gray-50')}
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
                                                    <span className="text-gray-800 mr-2">시세 {asset.amount > 0 ? (asset.amount.toLocaleString() + " 만원") : '0원'}</span>
                                                    {asset.loanAmount > 0 && <span className="text-red-500 mr-2">담보 {asset.loanAmount.toLocaleString()}만원</span>}
                                                    {asset.rentDeposit && asset.rentDeposit > 0 && <span className="text-green-600 mr-2">전세 {asset.rentDeposit.toLocaleString()}만원</span>}
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
                                            type="text"
                                            autoComplete="off"
                                            placeholder="시세 (만원)"
                                            className="w-full p-1.5 border rounded text-xs"
                                            value={newAsset.amount || ''}
                                            onChange={e => {
                                                const val = e.target.value;
                                                if (val === '' || /^[0-9]+$/.test(val)) {
                                                    setNewAsset({ ...newAsset, amount: val === '' ? 0 : Number(val) });
                                                }
                                            }}
                                        />
                                        <input
                                            type="text"
                                            autoComplete="off"
                                            placeholder="담보대출 (만원)"
                                            className="w-full p-1.5 border rounded text-xs"
                                            value={newAsset.loanAmount || ''}
                                            onChange={e => {
                                                const val = e.target.value;
                                                if (val === '' || /^[0-9]+$/.test(val)) {
                                                    setNewAsset({ ...newAsset, loanAmount: val === '' ? 0 : Number(val) });
                                                }
                                            }}
                                        />
                                    </div>
                                    {['부동산', '토지'].includes(newAsset.type || '') && (
                                        <div className="mb-2">
                                            <input
                                                type="text"
                                                autoComplete="off"
                                                placeholder="전세금액 (만원)"
                                                className="w-full p-1.5 border rounded text-xs bg-green-50 focus:bg-white"
                                                value={newAsset.rentDeposit || ''}
                                                onChange={e => {
                                                    const val = e.target.value;
                                                    if (val === '' || /^[0-9]+$/.test(val)) {
                                                        setNewAsset({ ...newAsset, rentDeposit: val === '' ? 0 : Number(val) });
                                                    }
                                                }}
                                            />
                                        </div>
                                    )}
                                    <div className="flex gap-2 mb-2">
                                        <input
                                            type="text"
                                            placeholder="상세 내용 (예: 차종 등)"
                                            className="flex-1 p-1.5 border rounded text-xs"
                                            value={newAsset.desc || ''}
                                            onChange={e => setNewAsset({ ...newAsset, desc: e.target.value })}
                                        />
                                        <button
                                            type="button"
                                            onClick={handleAddAsset}
                                            className="w-24 bg-blue-600 text-white rounded text-xs font-bold flex justify-center items-center hover:bg-blue-700 flex-shrink-0"
                                        >
                                            <Plus size={14} className="mr-1" /> 추가
                                        </button>
                                    </div>
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
                                            type="text"
                                            autoComplete="off"
                                            placeholder="금액 (만원)"
                                            className="w-full p-1.5 border rounded text-xs"
                                            value={newCreditLoan.amount || ''}
                                            onChange={e => {
                                                const val = e.target.value;
                                                if (val === '' || /^[0-9]+$/.test(val)) {
                                                    setNewCreditLoan({ ...newCreditLoan, amount: val === '' ? 0 : Number(val) });
                                                }
                                            }}
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
                                        className={"px-3 py-1.5 text-xs rounded border " + (c.historyType === opt ? 'bg-blue-600 text-white border-blue-600' : 'bg-white text-gray-600 border-gray-300 hover:bg-gray-50')}
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
                    <div className="grid md:grid-cols-2 gap-4 h-full min-h-[400px] md:min-h-[500px]">
                        {/* LEFT: Basic Summary */}
                        <div className="bg-white p-4 rounded-xl border border-gray-200 shadow-sm flex flex-col h-full">
                            <div className="flex justify-between items-center mb-3">
                                <h3 className="font-bold text-gray-700 flex items-center gap-2">
                                    <FileText size={18} /> 기본 요약문
                                </h3>
                                <div className="flex gap-2">
                                    {isManualSummaryEdit ? (
                                        <>
                                            <button onClick={() => {
                                                // Cancel Edit
                                                setIsManualSummaryEdit(false);
                                            }} className="text-xs bg-gray-200 text-gray-700 px-3 py-1.5 rounded hover:bg-gray-300">취소</button>
                                        </>
                                    ) : (
                                        <button onClick={() => {
                                            // Init with FRESH generated summary logic
                                            setManualSummary(generateSummary(c, currentPartner?.summaryTemplate));
                                            setIsManualSummaryEdit(true);
                                        }} className="text-xs bg-gray-100 text-gray-600 px-3 py-1.5 rounded hover:bg-gray-200 flex items-center gap-1">
                                            <Edit2 size={12} /> 수정
                                        </button>
                                    )}
                                </div>
                            </div>

                            <div className="flex-1 relative h-full">
                                {isManualSummaryEdit ? (
                                    <textarea
                                        className="w-full h-full p-4 border rounded-lg text-sm leading-relaxed resize-none focus:ring-2 focus:ring-blue-500 outline-none min-h-[200px] md:min-h-[250px] max-h-[400px] md:max-h-[500px] overflow-y-auto"
                                        value={manualSummary}
                                        onChange={e => setManualSummary(e.target.value)}
                                    />
                                ) : (
                                    <div className="w-full h-full p-4 bg-gray-50 rounded-lg text-sm whitespace-pre-wrap leading-relaxed border border-gray-100 overflow-y-auto min-h-[200px] md:min-h-[250px] max-h-[400px] md:max-h-[500px]">
                                        {generateSummary(c, currentPartner?.summaryTemplate)}
                                    </div>
                                )}
                            </div>

                            <div className="mt-4 flex justify-center">
                                <button onClick={() => {
                                    const textToCopy = isManualSummaryEdit ? manualSummary : generateSummary(c, currentPartner?.summaryTemplate);
                                    navigator.clipboard.writeText(textToCopy);
                                    showToast('복사되었습니다.');
                                }} className="bg-gray-800 text-white px-6 py-3 rounded-lg font-bold flex items-center hover:bg-gray-900 w-full justify-center">
                                    <Copy className="mr-2" size={16} /> 전체 복사하기
                                </button>
                            </div>
                        </div>

                        {/* RIGHT: AI Summary */}
                        <div className="bg-purple-50 p-4 rounded-xl border border-purple-100 shadow-sm flex flex-col h-full">
                            <div className="flex justify-between items-center mb-3">
                                <h3 className="font-bold text-purple-800 flex items-center gap-2">
                                    <Sparkles size={18} /> AI 요약문
                                </h3>
                                <div className="flex gap-2">
                                    {aiSummaryEditMode ? (
                                        <>
                                            <button onClick={handleUpdateAiSummaryText} className="text-xs bg-green-600 text-white px-3 py-1.5 rounded hover:bg-green-700 font-bold">저장</button>
                                            <button onClick={() => setAiSummaryEditMode(false)} className="text-xs bg-gray-200 text-gray-700 px-3 py-1.5 rounded hover:bg-gray-300">취소</button>
                                        </>
                                    ) : (
                                        <button onClick={() => {
                                            // Inject metadata on edit start
                                            setAiSummaryText(injectSummaryMetadata(aiSummaryText || '', c));
                                            setAiSummaryEditMode(true);
                                        }} className="text-xs bg-purple-100 text-purple-700 px-3 py-1.5 rounded hover:bg-purple-200 flex items-center gap-1">
                                            <Edit2 size={12} /> 수정
                                        </button>
                                    )}
                                </div>
                            </div>

                            <div className="flex-1 relative h-full">
                                {aiSummaryText ? (
                                    aiSummaryEditMode ? (
                                        <textarea
                                            className="w-full h-full p-4 border border-purple-200 rounded-lg text-sm leading-relaxed resize-none focus:ring-2 focus:ring-purple-500 outline-none min-h-[200px] md:min-h-[250px] max-h-[400px] md:max-h-[500px] overflow-y-auto"
                                            value={aiSummaryText}
                                            onChange={e => setAiSummaryText(e.target.value)}
                                        />
                                    ) : (
                                        <div className="w-full h-full p-4 bg-white rounded-lg text-sm whitespace-pre-wrap leading-relaxed border border-purple-100 overflow-y-auto cursor-text hover:bg-purple-50/50 transition-colors min-h-[200px] md:min-h-[250px] max-h-[400px] md:max-h-[500px]"
                                            onClick={() => { setAiSummaryText(injectSummaryMetadata(aiSummaryText, c)); setAiSummaryEditMode(true); }} // Click to edit convenience
                                        >
                                            {aiSummaryText}
                                        </div>
                                    )
                                ) : (
                                    <div className="flex flex-col items-center justify-center h-full text-gray-400 gap-4 min-h-[200px]">
                                        <Sparkles size={48} className="opacity-20" />
                                        <p className="text-center text-sm">AI 요약 결과가 없습니다.<br />'정보 수정' 탭에서 녹음 파일을 업로드하고<br />AI 요약을 실행해보세요.</p>
                                        <button onClick={() => setActiveTab('info')} className="text-purple-600 underline text-sm">
                                            정보 수정 탭으로 이동
                                        </button>
                                    </div>
                                )}
                            </div>

                            {aiSummaryText && (
                                <div className="mt-4 flex flex-col gap-2">
                                    {/* User Request #2: Copy Button & Adjusted Send Button */}
                                    <div className="grid grid-cols-2 gap-2">
                                        <button
                                            onClick={() => { navigator.clipboard.writeText(aiSummaryText); showToast('복사되었습니다.'); }}
                                            className="bg-gray-700 text-white px-4 py-3 rounded-lg font-bold flex items-center justify-center hover:bg-gray-800 shadow-sm transition-all active:scale-95 text-xs md:text-sm"
                                        >
                                            <Copy className="mr-2" size={16} /> 전체 복사
                                        </button>
                                        <button
                                            onClick={handleSaveSummaryToMemo}
                                            className="bg-indigo-600 text-white px-4 py-3 rounded-lg font-bold flex items-center justify-center hover:bg-indigo-700 w-full shadow-sm transition-all active:scale-95 text-xs md:text-sm"
                                        >
                                            <Send className="mr-2" size={16} /> 상담이력 전송
                                        </button>
                                    </div>
                                    <p className="text-[10px] text-center text-purple-400">
                                        * 전송 시 '특이사항' 부분만 자동으로 추출되어 저장됩니다.
                                    </p>
                                </div>
                            )}
                        </div>
                    </div>
                )}

                {activeTab === 'settlement' && (
                    <div className="space-y-6">
                        <div className="bg-green-50 p-6 rounded-xl border border-green-100">
                            <h3 className="font-bold text-green-800 mb-4 text-lg">계약 및 수임료</h3>
                            <div className="grid md:grid-cols-2 gap-6">
                                <div className="space-y-4">
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
                                        <label className="block text-sm font-bold text-green-900 mb-1 flex items-center justify-between">
                                            분납 개월
                                            <label className="flex items-center gap-1 cursor-pointer text-blue-600 bg-white px-2 py-0.5 rounded border border-blue-100">
                                                <input
                                                    type="checkbox"
                                                    className="form-checkbox h-3 w-3"
                                                    checked={c.useCapital || false}
                                                    onChange={e => handleUpdate('useCapital', e.target.checked)}
                                                />
                                                <span className="text-xs">캐피탈 사용</span>
                                            </label>
                                        </label>
                                        <select
                                            className="w-full p-2 border border-green-300 rounded bg-white"
                                            value={c.installmentMonths || ''}
                                            onChange={e => handleUpdate('installmentMonths', e.target.value)}
                                        >
                                            <option value="">선택</option>
                                            {!c.useCapital && <option value="완납">완납</option>}
                                            {Array.from({ length: 8 }, (_, i) => i + 1).map(num => (
                                                (c.useCapital || num >= 2) ? (
                                                    <option key={num} value={`${num} 개월`}>{num}개월</option>
                                                ) : null
                                            ))}
                                        </select>
                                    </div>
                                </div>
                                <div>
                                    <label className="block text-sm font-bold text-green-900 mb-1">총 수임료 (만원)</label>
                                    <input
                                        type="number"
                                        className="w-full p-2 border border-green-300 rounded text-right font-mono text-lg font-bold"
                                        value={c.contractFee || 0}
                                        onChange={e => handleUpdate('contractFee', Number(e.target.value))}
                                    />

                                    <div className="mt-4 pt-4 border-t border-green-200 flex justify-between items-center">
                                        <span className="text-sm text-green-700 font-medium">예상 수당 (Commission):</span>
                                        <span className="text-xl font-bold text-green-900">{commission.toLocaleString()}만원</span>
                                    </div>
                                </div>
                            </div>
                        </div>

                        <div className="bg-gray-50 p-6 rounded-xl border border-gray-200">
                            <div className="flex justify-between items-center mb-4">
                                <h3 className="font-bold text-gray-700 text-lg">입금 내역</h3>
                                <button
                                    onClick={() => {
                                        const currentHistory = (c.depositHistory && c.depositHistory.length > 0)
                                            ? c.depositHistory
                                            : [
                                                { date: c.deposit1Date || '', amount: c.deposit1Amount || 0 },
                                                { date: c.deposit2Date || '', amount: c.deposit2Amount || 0 }
                                            ];
                                        const newHistory = [...currentHistory, { date: '', amount: 0 }];
                                        handleUpdate('depositHistory', newHistory);
                                    }}
                                    className="flex items-center gap-1 bg-blue-600 text-white px-3 py-1.5 rounded-lg text-sm font-bold hover:bg-blue-700 shadow-sm"
                                >
                                    <Plus size={16} /> 추가 ({(c.depositHistory?.length || 2) + 1}차)
                                </button>
                            </div>

                            <div className="grid md:grid-cols-2 gap-4">
                                {/* Use depositHistory if available, else fallback to 1st/2nd legacy fields visually (but mapped) */}
                                {((c.depositHistory && c.depositHistory.length > 0) ? c.depositHistory : [
                                    { date: c.deposit1Date || '', amount: c.deposit1Amount || 0 }, // 1차
                                    { date: c.deposit2Date || '', amount: c.deposit2Amount || 0 }  // 2차
                                ]).map((deposit, idx) => (
                                    <div key={idx} className="bg-white p-4 rounded border border-gray-200 shadow-sm relative group">
                                        <div className="flex justify-between items-center mb-2">
                                            <h4 className="font-bold text-gray-600 text-sm">{idx + 1}차 입금</h4>
                                            {idx >= 2 && (
                                                <button
                                                    onClick={() => {
                                                        const current = c.depositHistory || [];
                                                        const newHistory = current.filter((_, i) => i !== idx);
                                                        handleUpdate('depositHistory', newHistory);
                                                    }}
                                                    className="text-gray-400 hover:text-red-500"
                                                >
                                                    <X size={16} />
                                                </button>
                                            )}
                                        </div>
                                        <div className="space-y-3">
                                            <div>
                                                <label className="block text-xs text-gray-500 mb-1">금액 (만원)</label>
                                                <input
                                                    type="number"
                                                    className="w-full p-2 border border-gray-300 rounded text-sm font-bold"
                                                    value={deposit.amount || ''}
                                                    onChange={e => {
                                                        const currentHistory = (c.depositHistory && c.depositHistory.length > 0) ? [...c.depositHistory] : [
                                                            { date: c.deposit1Date || '', amount: c.deposit1Amount || 0 },
                                                            { date: c.deposit2Date || '', amount: c.deposit2Amount || 0 }
                                                        ];
                                                        currentHistory[idx].amount = Number(e.target.value);
                                                        handleUpdate('depositHistory', currentHistory);
                                                    }}
                                                />
                                            </div>
                                            <div>
                                                <label className="block text-xs text-gray-500 mb-1">입금일</label>
                                                <input
                                                    type="date"
                                                    className="w-full p-2 border border-gray-300 rounded text-sm"
                                                    value={deposit.date || ''}
                                                    onChange={e => {
                                                        const currentHistory = (c.depositHistory && c.depositHistory.length > 0) ? [...c.depositHistory] : [
                                                            { date: c.deposit1Date || '', amount: c.deposit1Amount || 0 },
                                                            { date: c.deposit2Date || '', amount: c.deposit2Amount || 0 }
                                                        ];
                                                        currentHistory[idx].date = e.target.value;
                                                        handleUpdate('depositHistory', currentHistory);
                                                    }}
                                                />
                                            </div>
                                        </div>
                                    </div>
                                ))}
                            </div>

                            <div className="mt-6 pt-4 border-t border-gray-200 flex justify-between items-center">
                                <span className="font-bold text-gray-700">총 누적 입금액</span>
                                <span className="text-2xl font-bold text-blue-600">
                                    {((c.depositHistory && c.depositHistory.length > 0)
                                        ? c.depositHistory.reduce((sum, d) => sum + (d.amount || 0), 0)
                                        : (c.deposit1Amount || 0) + (c.deposit2Amount || 0)
                                    ).toLocaleString()} 만원
                                </span>
                            </div>
                        </div>
                    </div>
                )}
            </div>
        </div >
    );
}

