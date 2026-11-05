import React, { useState, useEffect, useRef } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { ArrowLeft, Layout } from 'lucide-react';
import { Case, CaseStatus, ReminderItem, MemoItem, RecordingItem } from '../types';
import { useCase, usePartners, useInboundPaths, useStatuses, useSecondaryStatuses, useTertiaryStatuses, useUpdateCaseMutation, UPDATE_CASE_MUTATION_KEY } from '../services/queries';
import { useMutationState } from '@tanstack/react-query';
import { getCheckProgress } from '../utils/intake';
import type { SaveState } from '../components/case-detail/CaseDetailHeader';
import { calculateCommission, generateAiSummary, convertToPlayableUrl, parseAiTranscript } from '../utils';
import { CommandPalette } from '../components/CommandPalette';
// Sub-components
import { CaseDetailHeader } from '../components/case-detail/CaseDetailHeader';
import { CaseBriefingBanner } from '../components/case-detail/CaseBriefingBanner';
import { CaseInfoTab } from '../components/case-detail/info/CaseInfoTab';
import { CaseSummaryTab } from '../components/case-detail/CaseSummaryTab';
import { CaseSettlementTab } from '../components/case-detail/CaseSettlementTab';
import { CaseTimeline } from '../components/case-detail/CaseTimeline';
import { CaseCallsSmsTab } from '../components/case-detail/CaseCallsSmsTab';
import { TelegramDeliverModal } from '../components/case-detail/TelegramDeliverModal';
import { CallRecordingsTab } from '../components/case-detail/CallRecordingsTab';
import { logCaseView } from '../services/accessLog';
import { registerDnc } from '../services/dnc';

export default function CaseDetail() {
    const { caseId } = useParams();
    const id = caseId; // Alias for compatibility with existing code
    const navigate = useNavigate();

    // Data Fetching
    const { data: c, isLoading, error } = useCase(id!);

    // [015] 접근 기록: 리드 상세를 연 것 (같은 탭에서 10분 안에 다시 열면 한 번만)
    const viewedCaseId = c?.caseId;
    useEffect(() => { if (viewedCaseId) logCaseView(viewedCaseId); }, [viewedCaseId]);
    const { data: partners = [] } = usePartners();
    const { data: inboundPaths = [] } = useInboundPaths();
    const { data: statuses = [] } = useStatuses();
    const { data: globalSecondaryStatuses = [] } = useSecondaryStatuses();
    const { data: globalTertiaryStatuses = {} } = useTertiaryStatuses();
    const updateCaseMutation = useUpdateCaseMutation();

    // UI State
    const [activeTab, setActiveTab] = useState<'info' | 'summary' | 'settlement' | 'timeline' | 'calls_sms' | 'recordings'>('info');
    const [toast, setToast] = useState<{ msg: string, type: 'success' | 'error' } | null>(null);
    const [isCmdPaletteOpen, setIsCmdPaletteOpen] = useState(false);
    const [isDeliverOpen, setIsDeliverOpen] = useState(false);

    // Status Change Modal State
    const [isSecondaryStatusModalOpen, setIsSecondaryStatusModalOpen] = useState(false);
    const [pendingSecondaryStatus, setPendingSecondaryStatus] = useState<string | null>(null);
    const [secondaryStatusChangeReason, setSecondaryStatusChangeReason] = useState('');

    // [NEW] Tertiary Status Modal State
    const [isTertiaryStatusModalOpen, setIsTertiaryStatusModalOpen] = useState(false);
    const [pendingTertiaryStatus, setPendingTertiaryStatus] = useState<string | null>(null);
    const [tertiaryStatusChangeReason, setTertiaryStatusChangeReason] = useState('');
    const [secondaryStatuses, setSecondaryStatuses] = useState<string[]>([]);

    // [New] Primary Status Change Modal State
    const [isPrimaryStatusModalOpen, setIsPrimaryStatusModalOpen] = useState(false);
    const [pendingPrimaryStatus, setPendingPrimaryStatus] = useState<CaseStatus | null>(null);
    const [primaryStatusChangeReason, setPrimaryStatusChangeReason] = useState('');

    // [NEW] 이탈 사유 (고객취소/진행불가 시)
    const DROP_OFF_STATUSES = ['고객취소', '진행불가'];
    const DROP_OFF_REASONS = ['비용 부담', '타 사무소 선택', '연락 두절', '자격 미달', '본인 의사 취소', '시기 미정', '기타'];
    const [selectedDropOffReason, setSelectedDropOffReason] = useState<string>('');
    const isDropOffStatus = pendingPrimaryStatus ? DROP_OFF_STATUSES.includes(pendingPrimaryStatus) : false;

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
            const firstArchive = (c.recordings || []).find(r => !r.fromApp);
            if (firstArchive && !audioUrl && !currentAudioFile) {
                setAudioUrl(firstArchive.url);
            }
            if (c.status === '사무장 접수') {
                // [Fix] Use global dynamic list instead of hardcoded
                setSecondaryStatuses(globalSecondaryStatuses.length > 0 ? globalSecondaryStatuses : []);
            } else {
                setSecondaryStatuses([]);
            }
        }
    }, [c, globalSecondaryStatuses]);

    // Reset audio and UI states when caseId changes to prevent state leakage from previous case
    useEffect(() => {
        setCurrentAudioFile(null);
        setAudioUrl(null);
        setIsFileUploading(false);
        setIsAiLoading(false);
        setAiSummaryEditMode(false);
        setIsPrimaryStatusModalOpen(false);
        setIsSecondaryStatusModalOpen(false);
        setIsTertiaryStatusModalOpen(false);
        setPendingPrimaryStatus(null);
        setPendingSecondaryStatus(null);
        setPendingTertiaryStatus(null);
    }, [caseId]);

    // [Refactor Restore] Mark as viewed on mount


    // Derived Data
    const currentPartner = partners.find(p => p.partnerId === c?.partnerId)
        || partners.find(p => p.name === (c as any)?.partnerName)
        || partners.find(p => p.name === (c as any)?.lawFirm);
    const commission = c ? calculateCommission(c.contractFee || 0, currentPartner?.commissionRules || []) : 0;
    const checkProgress = c ? getCheckProgress(c, currentPartner) : undefined;

    // 저장 상태 (이 리드의 저장 요청만): 저장 중 / 저장됨 HH:mm / 저장 안 됨
    const saveRuns = useMutationState({
        filters: { mutationKey: UPDATE_CASE_MUTATION_KEY },
        select: m => ({ status: m.state.status, at: m.state.submittedAt, id: (m.state.variables as any)?.id as string | undefined }),
    });
    const saveState: SaveState = (() => {
        const mine = saveRuns.filter(r => r.id === id);
        if (mine.length === 0) return { state: 'idle' };
        if (mine.some(r => r.status === 'pending')) return { state: 'saving' };
        const last = mine[mine.length - 1];
        return last.status === 'error' ? { state: 'error' } : { state: 'saved', at: last.at };
    })();

    // 상태 기록에 남길 이름 (로그인 때 회사 표시 이름 저장)
    const actorName = () => localStorage.getItem('managerName') || '상담원';

    // 신규 리드: 전화·문자를 시작하면 "상담 시작" (신규 표시 해제 + 상태 신규접수 → 상담중)
    const handleEngage = () => {
        if (!c || !c.isNew) return;
        const toStatus = c.status === '신규접수' && statuses.includes('상담중' as CaseStatus) ? ('상담중' as CaseStatus) : null;
        updateCaseMutation.mutate({
            id: c.caseId,
            silent: true,
            updates: {
                isViewed: true,
                isNew: false,
                ...(toStatus ? {
                    status: toStatus,
                    statusLogs: [{ logId: Date.now().toString(), caseId: c.caseId, fromStatus: c.status, toStatus, changedAt: new Date().toISOString(), changedBy: actorName(), memo: '상담 시작' }, ...(c.statusLogs || [])],
                } : {}),
            },
        });
    };

    // 다음 통화 예약 (작업대 빠른 선택)
    const handleAddCallReminder = (datetime: string, label: string) => {
        if (!c) return;
        const r: ReminderItem = { id: Date.now().toString(), datetime, type: '통화', content: '다시 통화' };
        updateCaseMutation.mutate({ id: c.caseId, updates: { reminders: [...(c.reminders || []), r] }, silent: true });
        showToast(`다음 통화를 ${label}(${datetime.slice(5)})로 잡았습니다.`);
    };

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

    // Missed Call Increment Handler (+ button)
    const handleMissedCallIncrement = () => {
        if (!c) return;
        const now = new Date().toISOString();
        const nextCount = (c.missedCallCount || 0) + 1;
        updateCaseMutation.mutate({
            id: c.caseId,
            updates: {
                missedCallCount: nextCount,
                lastMissedCallAt: now
            }
        });
        showToast(`부재 ${nextCount}회 기록됨 (${new Date().toLocaleTimeString('ko-KR', { hour: '2-digit', minute: '2-digit' })})`);
    };

    // Status Change Logic
    const handleStatusChangeStart = (newStatus: CaseStatus) => {
        if (newStatus === c?.status) return;
        setPendingPrimaryStatus(newStatus);
        setPrimaryStatusChangeReason('');
        setSelectedDropOffReason('');
        setIsPrimaryStatusModalOpen(true);
    };

    const confirmPrimaryStatusChange = () => {
        if (!c || !pendingPrimaryStatus) return;

        // [NEW] 이탈 사유 필수 체크
        const isDropOff = DROP_OFF_STATUSES.includes(pendingPrimaryStatus);
        if (isDropOff && !selectedDropOffReason) {
            showToast('이탈 사유를 선택해주세요.', 'error');
            return;
        }

        // Update local secondary statuses logic if needed
        if (pendingPrimaryStatus === '사무장 접수') {
            setSecondaryStatuses(globalSecondaryStatuses);
        } else {
            setSecondaryStatuses([]);
        }

        const log = {
            logId: Date.now().toString(),
            fromStatus: c.status,
            toStatus: pendingPrimaryStatus,
            changedAt: new Date().toISOString(),
            changedBy: actorName(),
            memo: isDropOff
                ? `[이탈사유: ${selectedDropOffReason}] ${primaryStatusChangeReason}`.trim()
                : primaryStatusChangeReason
        };

        const missedCallStatus = localStorage.getItem('lm_missedStatus') || '부재';
        const now = new Date().toISOString();

        updateCaseMutation.mutate({
            id: c.caseId,
            updates: {
                status: pendingPrimaryStatus,
                statusLogs: [log, ...(c.statusLogs || [])],
                ...(pendingPrimaryStatus !== '사무장 접수' ? { secondaryStatus: undefined, tertiaryStatus: undefined } : {}),
                // [NEW] 이탈 사유 저장
                ...(isDropOff ? {
                    dropOffReason: selectedDropOffReason,
                    dropOffDetail: primaryStatusChangeReason || undefined
                } : {}),
                // [FIX] 부재로 변경 시 부재 카운트/시간 초기화
                ...(pendingPrimaryStatus === missedCallStatus && !c.missedCallCount ? {
                    missedCallCount: 1,
                    lastMissedCallAt: now
                } : {}),
                ...(pendingPrimaryStatus === missedCallStatus && c.missedCallCount ? {
                    lastMissedCallAt: c.lastMissedCallAt || now
                } : {})
            }
        });

        // [NEW] 수신정지 상태 또는 수신거부/오신청 이탈 사유인 경우 자동으로 회사 DNC(수신거부) 목록에 등록
        if (
            pendingPrimaryStatus === '수신정지' ||
            selectedDropOffReason?.includes('수신거부') ||
            selectedDropOffReason?.includes('통화거부') ||
            selectedDropOffReason?.includes('오신청')
        ) {
            const dncReason = selectedDropOffReason?.includes('오신청') ? 'wrong_number' : 'refusal';
            registerDnc(
                c.phone,
                dncReason,
                c.caseId,
                `[케이스 ${c.customerName || ''}] ${selectedDropOffReason || pendingPrimaryStatus} 등록`
            ).catch(err => console.warn('[DNC] 자동 등록 알림/오류:', err));
        }

        showToast(`상태가 ${pendingPrimaryStatus}(으)로 변경되었습니다.`);
        setIsPrimaryStatusModalOpen(false);
        setPendingPrimaryStatus(null);
        setSelectedDropOffReason('');
    };

    // [텔레그램 전달] 성공 후: 요청 시 상태를 '사무장 접수'로 (상태변경 기록 포함)
    const handleDelivered = ({ changeStatus, chatTitle }: { changeStatus: boolean; chatTitle?: string }) => {
        if (!c || !changeStatus || c.status === '사무장 접수') return;
        setSecondaryStatuses(globalSecondaryStatuses);
        const log = {
            logId: Date.now().toString(),
            fromStatus: c.status,
            toStatus: '사무장 접수' as CaseStatus,
            changedAt: new Date().toISOString(),
            changedBy: actorName(),
            memo: `텔레그램 전달${chatTitle ? ` (${chatTitle})` : ''}`
        };
        updateCaseMutation.mutate({
            id: c.caseId,
            updates: {
                status: '사무장 접수' as CaseStatus,
                statusLogs: [log, ...(c.statusLogs || [])]
            }
        });
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
            changedBy: actorName(),
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
        // [NEW] Reset tertiary status when secondary status changes
        updateCaseMutation.mutate({
            id: c.caseId,
            updates: {
                secondaryStatus: pendingSecondaryStatus,
                tertiaryStatus: undefined,
                statusLogs: [log, ...(c.statusLogs || [])],
                specialMemo: [newMemo, ...(c.specialMemo || [])]
            }
        });

        setIsSecondaryStatusModalOpen(false);
        setPendingSecondaryStatus(null);
        showToast('2차 상태가 변경되었습니다.');
    };

    // [NEW] Tertiary Status Change Handlers
    const handleTertiaryStatusChangeStart = (status: string | null) => {
        if (status === c?.tertiaryStatus) return;
        setPendingTertiaryStatus(status);
        setTertiaryStatusChangeReason('');
        setIsTertiaryStatusModalOpen(true);
    };

    const confirmTertiaryStatusChange = () => {
        if (!c || pendingTertiaryStatus === null) return;

        const log = {
            logId: Date.now().toString(),
            fromStatus: `${c.status} (${c.secondaryStatus || '없음'}) [${c.tertiaryStatus || '없음'}]`,
            toStatus: `${c.status} (${c.secondaryStatus || '없음'}) [${pendingTertiaryStatus || '없음'}]`,
            changedAt: new Date().toISOString(),
            changedBy: actorName(),
            memo: tertiaryStatusChangeReason
        };

        const memoContent = `[3차 상태 변경] ${c.tertiaryStatus || '없음'} → ${pendingTertiaryStatus || '없음'}${tertiaryStatusChangeReason ? `\n사유: ${tertiaryStatusChangeReason}` : ''}`;
        const newMemo: MemoItem = {
            id: Date.now().toString(),
            createdAt: new Date().toISOString(),
            content: memoContent
        };

        updateCaseMutation.mutate({
            id: c.caseId,
            updates: {
                tertiaryStatus: pendingTertiaryStatus || undefined,
                statusLogs: [log, ...(c.statusLogs || [])],
                specialMemo: [newMemo, ...(c.specialMemo || [])]
            }
        });

        setIsTertiaryStatusModalOpen(false);
        setPendingTertiaryStatus(null);
        showToast('3차 상태가 변경되었습니다.');
    };

    // Audio & AI Handlers
    const handleAudioFileSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
        if (e.target.files && e.target.files[0]) {
            const file = e.target.files[0];
            setCurrentAudioFile(file);
            setAudioUrl(URL.createObjectURL(file));

            setIsFileUploading(true);
            try {
                if (!c) throw new Error('리드 정보가 없습니다');
                // [2026-11-02] 앱과 같은 길: 회사 구글 드라이브(비공개) + 통화 녹음·AI 탭 기록. Apps Script·공개 링크 안 씀
                const { uploadRecordingToDrive } = await import('../services/recordings');
                const r = await uploadRecordingToDrive(c.caseId, c.phone, file);
                // 회사 설정 "올리면 바로 AI 정리"가 켜져 있으면 통화 녹음·AI 탭에서 채무 정리까지 (앱 녹음과 같게)
                if (!r.exists) {
                    import('../services/recordings').then(m => m.requestAnalyze(r.recordingId, true)).catch(() => { /* 탭에서 다시 가능 */ });
                }

                // 녹음 아카이브(이 칸)에도 남긴다: 듣기는 서버 경유(recording-play), 통화별 AI 요약 보관에 씀
                const already = (c.recordings || []).some(x => r.driveFileId && x.url.includes(r.driveFileId));
                if (!already && r.driveFileId) {
                    const newRecording: RecordingItem = {
                        id: r.recordingId || `rec-${Date.now()}`,
                        recordingId: r.recordingId,
                        filename: file.name,
                        url: `https://drive.google.com/file/d/${r.driveFileId}/view`,
                        uploadDate: r.startedAt || new Date().toISOString(),
                        mimeType: file.type || 'audio/mp4',
                        duration: r.durationSec,
                        aiCurrent: true,
                    };
                    const updatedRecs = [newRecording, ...(c.recordings || []).map(x => ({ ...x, aiCurrent: false }))];
                    handleUpdate('recordings', updatedRecs);
                    window.dispatchEvent(new CustomEvent('crm:call_history_reload'));
                }
                showToast(r.exists
                    ? '이미 드라이브에 보관된 녹음입니다. 통화 녹음·AI 탭에서 볼 수 있습니다.'
                    : '회사 구글 드라이브에 비공개로 저장했습니다. 통화 녹음·AI 탭에도 올라갔습니다.');
            } catch (err: any) {
                console.error("Upload Error:", err);
                showToast(`드라이브 업로드 실패: ${err?.message || '알 수 없는 오류'}`, 'error');
            } finally {
                setIsFileUploading(false);
                // Reset file input value to allow selecting the same file again
                e.target.value = '';
            }
        }
    };

    const handleGenerateAiSummary = async () => {
        if (!c) return;
        if (!currentAudioFile && !audioUrl) {
            showToast('분석할 녹음 파일이 없습니다.', 'error');
            return;
        }
        // [2026-11-02] 드라이브에 보관된 녹음이면 서버(recording-analyze)가 정리 → 요약문·상담 이력·통화별 보관까지 서버가 한다.
        // (예전엔 목록에서 고른 녹음을 누르면 빈 파일이 AI로 넘어갔음)
        const recs = c.recordings || [];
        const item = currentAudioFile
            ? recs.find(r => !r.fromApp && r.filename === currentAudioFile.name)
            : recs.find(r => r.url === audioUrl);
        setIsAiLoading(true);
        try {
            const m = await import('../services/recordings');
            let serverRec: Awaited<ReturnType<typeof m.fetchRecording>> = null;
            try {
                serverRec = item?.recordingId
                    ? await m.fetchRecording(item.recordingId)
                    : (item ? await m.findRecordingByDriveFile(c.caseId, m.driveFileIdFromUrl(item.url)) : null);
            } catch { serverRec = null; }
            if (serverRec && !serverRec.audioDeletedAt) {
                if (serverRec.status === 'done' && !window.confirm('이 녹음은 이미 AI 정리가 끝났습니다. 다시 정리할까요?\n(다시 정리하면 AI 사용량이 한 번 더 듭니다)')) return;
                if (serverRec.status !== 'processing') await m.requestAnalyze(serverRec.id);
                showToast('AI가 녹음을 정리하는 중입니다. 1분 정도 걸립니다.');
                const done = await m.waitAnalyzed(serverRec.id);
                if (done?.status === 'done') {
                    const { buildCombinedText } = await import('../services/callHistory');
                    const combined = buildCombinedText(done);
                    if (combined) {
                        setAiSummaryText(combined);
                    }
                    const { refreshChangedCases } = await import('../services/api');
                    await refreshChangedCases().catch(() => { /* Realtime으로도 들어옴 */ });
                    window.dispatchEvent(new CustomEvent('crm:call_history_reload'));
                    showToast('✅ 이 통화 내용으로 요약문을 바꿨습니다. 통화 히스토리에 새 통화가 추가되었습니다.');
                } else if (done?.status === 'failed') {
                    showToast(`AI 정리 실패: ${done.error || '알 수 없는 오류'}`, 'error');
                } else {
                    showToast('정리가 오래 걸리고 있습니다. 끝나면 요약문이 자동으로 바뀝니다.');
                }
                return;
            }
            if (!currentAudioFile) {
                showToast('이 녹음은 서버에 보관된 파일을 찾지 못해 AI 분석을 할 수 없습니다. 녹음 파일을 다시 올려 주세요.', 'error');
                return;
            }
            // [Modified] Use Partner's Custom Prompt if available
            const customPrompt = currentPartner?.aiPromptTemplate;
            const context = {
                customerName: c?.customerName || '',
                phone: c?.phone || '',
                managerName: localStorage.getItem('managerName') || 'Mark' // Default to Mark if not set
            };
            const summary = await generateAiSummary(currentAudioFile || new File([], "mock.mp3"), customPrompt, context);
            setAiSummaryText(summary);
            setAiSummaryEditMode(false); // No need for edit mode - auto pipeline

            // [Step 1 & 2 Merge] Auto save AI summary & send to consultation memo in a single mutation to prevent race conditions
            const { summaryText } = parseAiTranscript(summary);
            let memoContent = '';
            const specialMatch = summaryText.match(/(?:^|\n)(?:[\*\-0-9\.\s]*)특이사항[:\s]*([\s\S]*)$/i);
            if (specialMatch && specialMatch[1]) {
                memoContent = specialMatch[1].trim().slice(0, 1000);
            } else {
                memoContent = `[AI 요약 전체]\n${summaryText.slice(0, 1000)}`;
            }

            const newMemo: MemoItem = {
                id: Date.now().toString(),
                createdAt: new Date().toISOString(),
                content: memoContent
            };

            if (c) {
                // [2026-11-02] 통화별 요약 보관: 지금 리드 요약(이전 통화)을 그 녹음에 옮겨 두고, 이번 녹음을 "최근 요약"으로 표시
                const isError = /^\s*\[오류 발생\]/.test(summary);
                let recordings = c.recordings || [];
                const nowIso = new Date().toISOString();
                if (!isError) {
                    const target = (currentAudioFile && recordings.find(r => r.filename === currentAudioFile.name)) || undefined;
                    const prevCurrent = recordings.find(r => r.aiCurrent);
                    const oldText = (c.aiSummary || '').trim();
                    if (target) {
                        recordings = recordings.map(r => {
                            if (target && r.id === target.id) return { ...r, aiCurrent: true, aiSummary: undefined, analyzedAt: nowIso };
                            if (prevCurrent && r.id === prevCurrent.id) return { ...r, aiCurrent: false, aiSummary: oldText && !/^\s*\[오류 발생\]/.test(oldText) ? oldText : r.aiSummary };
                            return r;
                        });
                    } else if (currentAudioFile) {
                        const newRec: RecordingItem = {
                            id: `rec-${Date.now()}`,
                            filename: currentAudioFile.name,
                            url: audioUrl || '',
                            uploadDate: nowIso,
                            mimeType: currentAudioFile.type || 'audio/mp4',
                            aiCurrent: true,
                            analyzedAt: nowIso,
                        };
                        recordings = [
                            newRec,
                            ...recordings.map(r => ({
                                ...r,
                                aiCurrent: false,
                                aiSummary: r.aiCurrent && oldText && !/^\s*\[오류 발생\]/.test(oldText) ? oldText : r.aiSummary,
                            }))
                        ];
                    }
                }
                // 어느 녹음 것인지 모르는 예전 요약(통화별 보관 전)은 지우지 않고 상담 메모로 보관
                const legacyOld = (!isError && !(c.recordings || []).some(r => r.aiCurrent) && (c.aiSummary || '').trim() && !/^\s*\[오류 발생\]/.test(c.aiSummary || ''))
                    ? [{ id: `${Date.now()}o`, createdAt: nowIso, content: `[이전 AI 요약 보관]\n${(c.aiSummary || '').trim()}`.slice(0, 4000) } as MemoItem]
                    : [];
                updateCaseMutation.mutate({
                    id: c.caseId,
                    updates: {
                        aiSummary: summary,
                        ...(isError ? {} : { recordings }),
                        specialMemo: [newMemo, ...legacyOld, ...(c.specialMemo || [])]
                    },
                    silent: true
                }, {
                    onSuccess: () => {
                        window.dispatchEvent(new CustomEvent('crm:call_history_reload'));
                        showToast('✅ AI 요약 → 저장 → 상담 이력 전송 완료! 통화 히스토리에 새 통화가 추가되었습니다.');
                    },
                    onError: () => {
                        showToast('⚠️ AI 요약은 생성되었으나 서버 저장에 실패했습니다. 다시 시도해주세요.', 'error');
                    }
                });
            }
        } catch (error) {
            console.error(error);
            showToast('AI 요약 생성 중 오류가 발생했습니다.', 'error');
        } finally {
            setIsAiLoading(false);
        }
    };

    const handleUpdateAiSummaryText = (textOverride?: string) => {
        const textToSave = typeof textOverride === 'string' ? textOverride : aiSummaryText;
        if (textToSave) {
            handleUpdate('aiSummary', textToSave);
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

    const handleSaveSummaryToMemo = (textOverride?: string) => {
        const textToUse = typeof textOverride === "string" ? textOverride : aiSummaryText;
        if (!textToUse) return;
        // Extract '특이사항' section from the AI summary (ignoring transcript)
        const { summaryText } = parseAiTranscript(textToUse);
        let memoContent = '';
        const simpleMatch = summaryText.match(/(?:^|\n)(?:[\*\-0-9\.\s]*)특이사항[:\s]*([\s\S]*)$/i);

        if (simpleMatch && simpleMatch[1]) {
            const specialNotes = simpleMatch[1].trim();
            memoContent = `${specialNotes.slice(0, 1000)}`;
        } else {
            memoContent = `[AI 요약 전체]\n${summaryText.slice(0, 1000)}`;
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
            const rec = (c?.recordings || []).find(r => r.id === id);
            // 지난 통화 AI 요약이 붙어 있으면 지우지 않고 상담 메모로 옮긴다
            if (c && rec?.aiSummary && rec.aiSummary.trim()) {
                const memo: MemoItem = { id: `${Date.now()}r`, createdAt: new Date().toISOString(), content: `[삭제한 녹음의 AI 요약 보관 · ${rec.filename}]\n${rec.aiSummary.trim()}`.slice(0, 4000) };
                updateCaseMutation.mutate({ id: c.caseId, updates: { recordings: (c.recordings || []).filter(r => r.id !== id), specialMemo: [memo, ...(c.specialMemo || [])] }, silent: true });
                return;
            }
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
        <div className="pb-20">
            <div className="w-full max-w-5xl xl:max-w-[1920px] mx-auto space-y-4">

                <CaseDetailHeader
                    c={c}
                    partner={currentPartner}
                    statuses={statuses}
                    secondaryStatuses={secondaryStatuses}
                    tertiaryStatuses={globalTertiaryStatuses}
                    onStatusChangeStart={handleStatusChangeStart}
                    onSecondaryStatusChangeStart={handleSecondaryStatusChangeStart}
                    onTertiaryStatusChangeStart={handleTertiaryStatusChangeStart}
                    onMissedCallIncrement={handleMissedCallIncrement}
                    onDeliverClick={() => setIsDeliverOpen(true)}
                    onAddCallReminder={handleAddCallReminder}
                    onEngage={handleEngage}
                    onBack={() => navigate(-1)}
                    onOpenPalette={() => setIsCmdPaletteOpen(true)}
                    saveState={saveState}
                    progress={checkProgress}
                />

                {c.isNew && (
                    <div className="rounded-xl border border-blue-200 bg-blue-50 dark:bg-blue-900/20 dark:border-blue-800 px-4 py-3 flex flex-wrap items-center gap-3 text-sm">
                        <span className="text-blue-900 dark:text-blue-200"><b>새로 들어온 리드입니다.</b> 전화하거나 문자를 보내면 상담을 시작한 것으로 바뀝니다. 아래 순서대로 물어보며 채우세요.</span>
                        <button onClick={handleEngage} className="ml-auto h-8 px-3 rounded-lg bg-blue-700 text-white font-semibold">상담 시작</button>
                    </div>
                )}

                {isDeliverOpen && (
                    <TelegramDeliverModal
                        c={c}
                        partner={currentPartner}
                        statuses={statuses}
                        onClose={() => setIsDeliverOpen(false)}
                        onDelivered={handleDelivered}
                        showToast={showToast}
                    />
                )}

                {/* [NEW] 고객 상황 및 채무 종합 브리핑 배너 (AI 요약문 우선 연동) */}
                <CaseBriefingBanner
                    c={c}
                    aiSummaryText={aiSummaryText}
                    showToast={showToast}
                />

                {/* Primary Status Modal */}
                {isPrimaryStatusModalOpen && pendingPrimaryStatus !== null && (
                    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
                        <div className={`bg-white dark:bg-gray-800 dark:text-gray-100 rounded-xl p-6 w-full max-w-[440px] mx-3 shadow-xl border-t-4 ${isDropOffStatus ? 'border-red-500' : 'border-blue-500'}`}>
                            <h3 className={`text-lg font-bold mb-4 ${isDropOffStatus ? 'text-red-700' : 'text-blue-700'}`}>
                                {isDropOffStatus ? '⚠ 상담 중단 확인' : '상태 변경 확인'}
                            </h3>
                            <p className="mb-4 text-gray-700 dark:text-gray-200">
                                상태를 <span className="font-bold text-blue-600 dark:text-blue-400">{c.status}</span>에서{' '}
                                <span className={`font-bold ${isDropOffStatus ? 'text-red-600 dark:text-red-400' : 'text-blue-600 dark:text-blue-400'}`}>{pendingPrimaryStatus}</span>
                                (으)로 변경하시겠습니까?
                            </p>

                            {/* [NEW] 이탈 사유 카테고리 선택 (고객취소/진행불가 시에만 표시) */}
                            {isDropOffStatus && (
                                <div className="mb-4">
                                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                                        이탈 사유 <span className="text-red-500">*필수</span>
                                    </label>
                                    <div className="flex flex-wrap gap-2">
                                        {DROP_OFF_REASONS.map(reason => (
                                            <button
                                                key={reason}
                                                type="button"
                                                onClick={() => setSelectedDropOffReason(reason)}
                                                className={`px-3 py-1.5 rounded-full text-sm font-medium border transition-all ${selectedDropOffReason === reason
                                                        ? 'bg-red-600 text-white border-red-600 shadow-sm'
                                                        : 'bg-white dark:bg-gray-700 text-gray-600 dark:text-gray-300 border-gray-300 dark:border-gray-600 hover:border-red-400 hover:text-red-600 dark:hover:text-red-400'
                                                    }`}
                                            >
                                                {reason}
                                            </button>
                                        ))}
                                    </div>
                                </div>
                            )}

                            <div className="mb-4">
                                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                                    {isDropOffStatus ? '상세 메모 (선택)' : '변경 사유 (선택)'}
                                </label>
                                <textarea
                                    className={`w-full p-2 border rounded resize-none h-20 focus:ring-2 outline-none bg-white dark:bg-gray-700 text-gray-900 dark:text-white dark:placeholder-gray-400 ${isDropOffStatus
                                            ? 'border-red-200 dark:border-red-900/50 focus:ring-red-500'
                                            : 'border-blue-200 dark:border-blue-900/50 focus:ring-blue-500'
                                        }`}
                                    placeholder={isDropOffStatus
                                        ? '추가 메모를 입력하세요... (예: 상담 3회 진행 후 비용 문제로 포기)'
                                        : '상태 변경 사유를 입력하세요... (예: 부재중, 상담 완료 등)'
                                    }
                                    value={primaryStatusChangeReason}
                                    onChange={e => setPrimaryStatusChangeReason(e.target.value)}
                                />
                            </div>
                            <div className="flex justify-end gap-2">
                                <button
                                    onClick={() => { setIsPrimaryStatusModalOpen(false); setPendingPrimaryStatus(null); setSelectedDropOffReason(''); }}
                                    className="px-4 py-2 bg-gray-200 dark:bg-gray-700 rounded text-gray-800 dark:text-gray-200 font-medium hover:bg-gray-300 dark:hover:bg-gray-600 transition-colors"
                                >
                                    취소
                                </button>
                                <button
                                    onClick={confirmPrimaryStatusChange}
                                    className={`px-4 py-2 rounded text-white font-medium ${isDropOffStatus
                                            ? 'bg-red-600 hover:bg-red-700'
                                            : 'bg-blue-600 hover:bg-blue-700'
                                        }`}
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
                        <div className="bg-white dark:bg-gray-800 dark:text-gray-100 rounded-xl p-6 w-full max-w-[400px] mx-3 shadow-xl border-t-4 border-purple-500">
                            <h3 className="text-lg font-bold mb-4 text-purple-700">2차 상태 변경 확인</h3>
                            <p className="mb-4 text-gray-700 dark:text-gray-200">
                                2차 상태를 <span className="font-bold text-purple-600 dark:text-purple-400">{c.secondaryStatus || '없음'}</span>에서 <span className="font-bold text-purple-600 dark:text-purple-400">{pendingSecondaryStatus || '없음'}</span>(으)로 변경하시겠습니까?
                            </p>
                            <div className="mb-4">
                                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">변경 사유 / 메모</label>
                                <textarea
                                    className="w-full p-2 border border-purple-200 dark:border-purple-900/50 bg-white dark:bg-gray-700 text-gray-900 dark:text-white dark:placeholder-gray-400 rounded resize-none h-24 focus:ring-2 focus:ring-purple-500 outline-none"
                                    placeholder="상태 변경 사유를 입력하세요..."
                                    value={secondaryStatusChangeReason}
                                    onChange={e => setSecondaryStatusChangeReason(e.target.value)}
                                />
                            </div>
                            <div className="flex justify-end gap-2">
                                <button
                                    onClick={() => { setIsSecondaryStatusModalOpen(false); setPendingSecondaryStatus(null); }}
                                    className="px-4 py-2 bg-gray-200 dark:bg-gray-700 rounded text-gray-800 dark:text-gray-200 font-medium hover:bg-gray-300 dark:hover:bg-gray-600 transition-colors"
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

                {/* Tertiary Status Modal */}
                {isTertiaryStatusModalOpen && pendingTertiaryStatus !== null && (
                    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
                        <div className="bg-white dark:bg-gray-800 dark:text-gray-100 rounded-xl p-6 w-full max-w-[400px] mx-3 shadow-xl border-t-4 border-amber-500">
                            <h3 className="text-lg font-bold mb-4 text-amber-700">3차 상태 변경 확인</h3>
                            <p className="mb-4 text-gray-700 dark:text-gray-200">
                                3차 상태를 <span className="font-bold text-amber-600 dark:text-amber-400">{c.tertiaryStatus || '없음'}</span>에서 <span className="font-bold text-amber-600 dark:text-amber-400">{pendingTertiaryStatus || '없음'}</span>(으)로 변경하시겠습니까?
                            </p>
                            <div className="mb-4">
                                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">변경 사유 / 메모</label>
                                <textarea
                                    className="w-full p-2 border border-amber-200 dark:border-amber-900/50 bg-white dark:bg-gray-700 text-gray-900 dark:text-white dark:placeholder-gray-400 rounded resize-none h-24 focus:ring-2 focus:ring-amber-500 outline-none"
                                    placeholder="상태 변경 사유를 입력하세요..."
                                    value={tertiaryStatusChangeReason}
                                    onChange={e => setTertiaryStatusChangeReason(e.target.value)}
                                />
                            </div>
                            <div className="flex justify-end gap-2">
                                <button
                                    onClick={() => { setIsTertiaryStatusModalOpen(false); setPendingTertiaryStatus(null); }}
                                    className="px-4 py-2 bg-gray-200 dark:bg-gray-700 rounded text-gray-800 dark:text-gray-200 font-medium hover:bg-gray-300 dark:hover:bg-gray-600 transition-colors"
                                >
                                    취소
                                </button>
                                <button
                                    onClick={confirmTertiaryStatusChange}
                                    className="px-4 py-2 bg-amber-600 rounded text-white font-medium hover:bg-amber-700"
                                >
                                    변경하기
                                </button>
                            </div>
                        </div>
                    </div>
                )}

                {/* Tabs */}
                <div className="flex gap-1 border-b border-slate-200 dark:border-gray-700 px-1 overflow-x-auto no-scrollbar">
                    {[
                        { id: 'info', label: '상담 정보' },
                        { id: 'recordings', label: '통화 녹음·AI' },
                        { id: 'summary', label: '요약문' },
                        { id: 'calls_sms', label: '통화·문자 기록' },
                        { id: 'timeline', label: '타임라인' },
                        { id: 'settlement', label: '수임료/정산' }
                    ].map(tab => (
                        <button
                            key={tab.id}
                            onClick={() => setActiveTab(tab.id as any)}
                            className={"px-4 py-2.5 text-sm border-b-2 -mb-px whitespace-nowrap transition-colors " + (activeTab === tab.id ? 'border-slate-900 dark:border-white text-slate-900 dark:text-white font-bold' : 'border-transparent text-slate-500 hover:text-slate-800 dark:hover:text-gray-200 font-medium')}
                        >
                            {tab.label}
                        </button>
                    ))}
                </div>

                <div className={activeTab === 'info' || activeTab === 'settlement' ? 'min-h-[600px]' : 'bg-white dark:bg-gray-800 p-4 md:p-6 rounded-2xl border border-slate-200 dark:border-gray-700 min-h-[600px]'}>
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
                            onOpenRecordingsTab={() => setActiveTab('recordings')}
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

                    {activeTab === 'timeline' && (
                        <CaseTimeline
                            c={c}
                            statusLogs={c.statusLogs || []}
                        />
                    )}

                    {activeTab === 'settlement' && (
                        <CaseSettlementTab
                            c={c}
                            commission={commission}
                            onUpdate={handleUpdate}
                            partner={currentPartner}
                        />
                    )}

                    {activeTab === 'calls_sms' && (
                        <CaseCallsSmsTab c={c} />
                    )}

                    {activeTab === 'recordings' && (
                        <CallRecordingsTab
                            c={c}
                            showToast={showToast}
                            onApply={(updates) => updateCaseMutation.mutate(
                                { id: c.caseId, updates, silent: true },
                                {
                                    onSuccess: () => showToast('AI 정리를 상담 정보에 반영했습니다.'),
                                    onError: () => showToast('반영하지 못했습니다. 다시 시도해주세요.', 'error'),
                                }
                            )}
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
