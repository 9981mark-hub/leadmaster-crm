import React, { useState, useMemo, useEffect, useCallback } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { 
  Phone, PhoneOff, PhoneCall, Sparkles, Search, X, RefreshCw, 
  ChevronLeft, ArrowRight, User, CheckCircle2, Clock, Moon, Sun, 
  Send, AlertCircle, Building2, Zap, Filter, Calculator, ShieldCheck, MessageSquare,
  Play, Headphones, Layers
} from 'lucide-react';
import { LiteDebtReliefCalculator } from '../components/lite/LiteDebtReliefCalculator';
import { LiteBattlecards } from '../components/lite/LiteBattlecards';
import { LiteQuickSmsModal } from '../components/lite/LiteQuickSmsModal';
import { useAuth } from '../contexts/AuthContext';
import { useToast } from '../contexts/ToastContext';
import { useTheme } from '../contexts/ThemeContext';
import { useCases, usePartners, useUpdateCaseMutation } from '../services/queries';
import { Case, Partner } from '../types';
import { parseGenericDate, isOverdueMissedCall, loadMissedCallTiers } from '../utils';
import { LiteInCallHud } from '../components/lite/LiteInCallHud';
import { LitePostCallSheet } from '../components/lite/LitePostCallSheet';
import { LiteTodayPerformanceBar } from '../components/lite/LiteTodayPerformanceBar';
import { useActiveCall } from '../contexts/ActiveCallContext';
import { enqueuePendingCall } from '../services/supabase';
import { AutoDialAgentHUD } from '../components/auto-dial/AutoDialAgentHUD';
import {
  fetchMyActiveAllocation,
  AutoDialAgentAllocation,
  AutoDialCampaign,
} from '../services/autoDialV4Service';

type LiteTab = 'all' | 'today' | 'new' | 'missed';

const getStatusBorderColor = (status: string) => {
  const s = (status || '').replace(/\s+/g, '');
  if (s.includes('재통화') || s.includes('재컨택')) return 'border-l-[#ffcb00]';
  if (s.includes('부재')) return 'border-l-[#ff642e]';
  if (s.includes('사무장') || s.includes('접수완료')) return 'border-l-[#00a2ae]';
  if (s.includes('신규') || s.includes('배정')) return 'border-l-[#0073ea]';
  if (s.includes('진행불가') || s.includes('기각') || s.includes('취소')) return 'border-l-[#e2445c]';
  if (s.includes('계약') || s.includes('수임')) return 'border-l-[#00c875]';
  return 'border-l-border';
};

const getStatusBadgeStyle = (status: string) => {
  const s = (status || '').replace(/\s+/g, '');
  if (s.includes('재통화') || s.includes('재컨택')) return 'bg-[#ffcb00] text-[#323338]';
  if (s.includes('부재')) return 'bg-[#ff642e] text-white';
  if (s.includes('사무장') || s.includes('접수완료')) return 'bg-[#00a2ae] text-white';
  if (s.includes('신규') || s.includes('배정')) return 'bg-[#0073ea] text-white';
  if (s.includes('진행불가') || s.includes('기각') || s.includes('취소')) return 'bg-[#e2445c] text-white';
  if (s.includes('계약') || s.includes('수임')) return 'bg-[#00c875] text-white';
  return 'bg-muted text-muted-foreground';
};

export default function LiteCallPage() {
  const navigate = useNavigate();
  const { org, isAdmin, user } = useAuth();
  const { showToast } = useToast();
  const { theme, toggleTheme } = useTheme();
  const { startCall, callState } = useActiveCall();

  // Queries & Mutations
  const { data: cases = [], isLoading, refetch: refetchCases } = useCases();
  const { data: partners = [] } = usePartners();
  const updateCaseMutation = useUpdateCaseMutation();

  // Local State
  const [activeTab, setActiveTab] = useState<LiteTab>('all');
  const [search, setSearch] = useState('');
  const [onlyMyLeads, setOnlyMyLeads] = useState<boolean>(!isAdmin);
  const [refetchTrigger, setRefetchTrigger] = useState(0);
  // [NEW] 상단 퀵 툴 및 카드별 인라인 계산기/문자 모달 상태
  const [activeTool, setActiveTool] = useState<'calc' | 'battlecards' | null>(null);
  const [expandedCalcCaseId, setExpandedCalcCaseId] = useState<string | null>(null);
  const [smsTargetCase, setSmsTargetCase] = useState<Case | null>(null);

  // [NEW] 스마트 오토콜 연속 발신 통합 모드 & 배정 데이터
  const [isAutoDialHudOpen, setIsAutoDialHudOpen] = useState(false);
  const [myAllocation, setMyAllocation] = useState<{
    allocation: AutoDialAgentAllocation;
    campaign: AutoDialCampaign;
  } | null>(null);
  const [loadingAllocation, setLoadingAllocation] = useState(false);

  // 내 오토콜 배정 상태 조회
  const checkMyAllocation = useCallback(async () => {
    const agentEmail = user?.email || org?.userId;
    if (!agentEmail) return;
    try {
      setLoadingAllocation(true);
      const active = await fetchMyActiveAllocation(agentEmail);
      setMyAllocation(active);
    } catch (e) {
      console.warn('Failed to fetch autodial allocation:', e);
    } finally {
      setLoadingAllocation(false);
    }
  }, [user?.email, org?.userId]);

  useEffect(() => {
    checkMyAllocation();
  }, [checkMyAllocation]);

  // URL ?caseId= 또는 ?mode=autodial 파라미터 처리 (안드로이드 리다이렉트 흡수)
  const [searchParams, setSearchParams] = useSearchParams();
  const urlCaseId = searchParams.get('caseId');
  const urlMode = searchParams.get('mode');

  useEffect(() => {
    if (urlMode === 'autodial') {
      setIsAutoDialHudOpen(true);
    }
  }, [urlMode]);

  // 간편 모드 세션 활성 및 안드로이드 플로팅 버튼/라이트모드 자동 제어
  useEffect(() => {
    sessionStorage.setItem('lm_lite_mode_active', 'true');
    try {
      if (typeof (window as any).AndroidBridge?.setLiteModeActive === 'function') {
        (window as any).AndroidBridge.setLiteModeActive(true);
      }
      if (typeof (window as any).AndroidBridge?.setFloatingButtonEnabled === 'function') {
        (window as any).AndroidBridge.setFloatingButtonEnabled(false);
      }
    } catch (e) {
      console.warn('[Lite] Android bridge init failed:', e);
    }

    // 네이티브에서 통화 종료 시 직접 수신하는 JS 콜백 등록
    (window as any).onNativeCallEnded = (caseId: string) => {
      console.log('[LeadMaster Lite] onNativeCallEnded received:', caseId);
      if (caseId && cases.length > 0) {
        const match = cases.find(c => c.caseId === caseId);
        if (match) {
          setActiveCase(match);
          setIsCalling(false);
          setHudOpen(false);
          setPostCallOpen(true);
        }
      }
    };

    return () => {
      sessionStorage.removeItem('lm_lite_mode_active');
      delete (window as any).onNativeCallEnded;
      try {
        if (typeof (window as any).AndroidBridge?.setLiteModeActive === 'function') {
          (window as any).AndroidBridge.setLiteModeActive(false);
        }
        if (typeof (window as any).AndroidBridge?.setFloatingButtonEnabled === 'function') {
          (window as any).AndroidBridge.setFloatingButtonEnabled(true);
        }
      } catch {}
    };
  }, [cases]);

  // 외부(안드로이드 통화 종료 후)에서 ?caseId=로 접근 시 해당 고객 시트 즉시 오픈
  useEffect(() => {
    if (urlCaseId && cases.length > 0) {
      const match = cases.find(c => c.caseId === urlCaseId);
      if (match) {
        setActiveCase(match);
        setPostCallOpen(true);
        const nextParams = new URLSearchParams(searchParams);
        nextParams.delete('caseId');
        setSearchParams(nextParams, { replace: true });
      }
    }
  }, [urlCaseId, cases, searchParams, setSearchParams]);

  // Active Case for In-Call HUD or Post-Call Sheet
  const [activeCase, setActiveCase] = useState<Case | null>(null);
  const [hudOpen, setHudOpen] = useState(false);
  const [postCallOpen, setPostCallOpen] = useState(false);

  // Call timer
  const [callElapsed, setCallElapsed] = useState(0);
  const [isCalling, setIsCalling] = useState(false);

  // Sync with ActiveCallContext
  useEffect(() => {
    if (callState.isActive && callState.caseId) {
      const match = cases.find(c => c.caseId === callState.caseId);
      if (match && (!activeCase || activeCase.caseId !== match.caseId)) {
        setActiveCase(match);
        setHudOpen(true);
      }
      if (callState.mode === 'calling') {
        setIsCalling(true);
      } else if (callState.mode === 'ended') {
        setIsCalling(false);
        // 통화 종료 시 HUD를 닫고 자동으로 결과 입력 시트 열기
        setHudOpen(false);
        setPostCallOpen(true);
      } else {
        // 'pending' or 'dialing' 대기 중 (PC 모드일 때만 false로 대기 표시)
        const isDeviceCalling = /Android|iPhone|iPad|iPod/i.test(navigator.userAgent) || typeof (window as any).AndroidBridge?.makeCall === 'function';
        if (!isDeviceCalling) {
          setIsCalling(false);
        }
      }
    }
  }, [callState, cases, activeCase]);

  // Timer interval: 오직 실제 통화가 연결(isCalling === true)되었을 때만 시간 측정
  useEffect(() => {
    let interval: any = null;
    if (isCalling) {
      interval = setInterval(() => {
        if (callState.startedAt) {
          const sec = Math.floor((Date.now() - new Date(callState.startedAt).getTime()) / 1000);
          setCallElapsed(sec > 0 ? sec : 0);
        } else {
          setCallElapsed(prev => prev + 1);
        }
      }, 1000);
    } else {
      setCallElapsed(0);
    }
    return () => clearInterval(interval);
  }, [isCalling, callState.startedAt]);

  // Filtering
  const filteredCases = useMemo(() => {
    const missedTiers = loadMissedCallTiers();
    const missedStatus = '부재';

    return cases.filter(c => {
      // 1. 기본 활성 리드만 (삭제 및 보관 제외)
      if (c.status === '휴지통' || c.deletedAt || c.isArchived) return false;

      // 2. 담당자 필터 (상담원은 기본 본인 담당)
      if (onlyMyLeads && org?.userId) {
        if (c.assignedUserId !== org.userId) return false;
      }

      // 3. 탭 필터
      if (activeTab === 'today') {
        const isNew = c.isNew || c.status === '신규접수';
        const hasDueReminder = (c.reminders || []).some(r => {
          if (!r.datetime) return false;
          return r.datetime.split(' ')[0] <= new Date().toISOString().split('T')[0];
        });
        const isOverdue = isOverdueMissedCall(c, missedStatus, missedTiers);
        if (!isNew && !hasDueReminder && !isOverdue) return false;
      } else if (activeTab === 'new') {
        if (!c.isNew && c.status !== '신규접수') return false;
      } else if (activeTab === 'missed') {
        if (c.status !== '부재' && (c.missedCallCount || 0) === 0) return false;
      }

      // 4. 검색 필터
      if (search.trim()) {
        const q = search.trim().toLowerCase();
        const name = String(c.customerName || '').toLowerCase();
        const phone = String(c.phone || '').replace(/[^0-9]/g, '');
        const cleanQ = q.replace(/[^0-9]/g, '');
        if (!name.includes(q) && (!cleanQ || !phone.includes(cleanQ))) return false;
      }

      return true;
    }).sort((a, b) => {
      // 최신 등록순 우선
      return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime();
    });
  }, [cases, activeTab, search, onlyMyLeads, org?.userId]);

  // Counts for tabs
  const tabCounts = useMemo(() => {
    const live = cases.filter(c => c.status !== '휴지통' && !c.deletedAt && !c.isArchived);
    const myLive = onlyMyLeads && org?.userId 
      ? live.filter(c => c.assignedUserId === org.userId)
      : live;

    const missedTiers = loadMissedCallTiers();
    const todayCount = myLive.filter(c => {
      const isNew = c.isNew || c.status === '신규접수';
      const hasDueReminder = (c.reminders || []).some(r => r.datetime && r.datetime.split(' ')[0] <= new Date().toISOString().split('T')[0]);
      const isOverdue = isOverdueMissedCall(c, '부재', missedTiers);
      return isNew || hasDueReminder || isOverdue;
    }).length;

    const newCount = myLive.filter(c => c.isNew || c.status === '신규접수').length;
    const missedCount = myLive.filter(c => c.status === '부재' || (c.missedCallCount || 0) > 0).length;

    return { all: myLive.length, today: todayCount, new: newCount, missed: missedCount };
  }, [cases, onlyMyLeads, org?.userId]);

  // 전화 걸기 핸들러 (모바일/PC 환경 자동 감지 분기)
  const handleDial = async (target: Case) => {
    const cleanPhone = String(target.phone || '').replace(/[^0-9]/g, '');
    setActiveCase(target);
    setIsCalling(true);
    setCallElapsed(0);
    setHudOpen(true);

    // 오늘 발신 로컬 카운트 증가 및 실시간 알림
    try {
      const todayKey = new Date().toISOString().split('T')[0];
      const storageKey = `lm_lite_dials_${todayKey}_${org?.userId || 'me'}`;
      const curDials = parseInt(localStorage.getItem(storageKey) || '0', 10);
      localStorage.setItem(storageKey, String(curDials + 1));
      window.dispatchEvent(new Event('lm_lite_activity_updated'));
    } catch (e) {
      console.warn('Failed to update local dials:', e);
    }

    const isMobile = /Android|iPhone|iPad|iPod/i.test(navigator.userAgent);
    const hasBridge = !!(window as any).AndroidBridge?.makeCall;

    if (hasBridge) {
      // 1) 안드로이드 앱 웹뷰: 브릿지 호출 (앱에서 직접 발신)
      setIsCalling(true);
      startCall(target.customerName, target.phone, target.caseId);
      (window as any).AndroidBridge.makeCall(cleanPhone);
    } else if (isMobile) {
      // 2) 스마트폰 모바일 브라우저: tel: 프로토콜로 휴대폰 다이얼러 호출
      setIsCalling(true);
      startCall(target.customerName, target.phone, target.caseId);
      window.location.href = `tel:${cleanPhone}`;
    } else {
      // 3) PC 브라우저: tel: 호출 대신 스마트폰 원격 발신(Click-to-Call) 전송!
      // 스마트폰에서 전화를 받기 전까지는 isCalling=false(대기 중) 유지
      setIsCalling(false);
      startCall(target.customerName, target.phone, target.caseId);
      try {
        await enqueuePendingCall(cleanPhone, target.customerName, target.caseId);
        showToast(`핸드폰으로 전화 발신 요청을 보냈습니다. (${target.customerName})`);
      } catch (e: any) {
        console.error('enqueuePendingCall error:', e);
      }
    }
  };

  // 앱 내 통화 종료 (전화 끊기) 핸들러
  const handleEndCall = () => {
    try {
      if (typeof (window as any).AndroidBridge?.endCall === 'function') {
        (window as any).AndroidBridge.endCall();
      }
    } catch (e) {
      console.warn('[Lite] AndroidBridge.endCall failed:', e);
    }
    setIsCalling(false);
    setHudOpen(false);
    setPostCallOpen(true);
  };

  // 원터치 부재 처리
  const handleQuickMissedCall = async (target: Case, e?: React.MouseEvent) => {
    e?.stopPropagation();
    const nextCount = (target.missedCallCount || 0) + 1;
    const now = new Date().toISOString();
    const who = localStorage.getItem('managerName') || '상담원';

    try {
      await updateCaseMutation.mutateAsync({
        id: target.caseId,
        updates: {
          status: '부재',
          missedCallCount: nextCount,
          lastMissedCallAt: now,
          statusUpdatedAt: now,
          statusLogs: [
            {
              logId: `${Date.now()}_${target.caseId}`,
              caseId: target.caseId,
              fromStatus: target.status,
              toStatus: '부재',
              changedAt: now,
              changedBy: who,
              memo: `간편 모드 부재 처리 (누적 ${nextCount}회)`,
            },
            ...(target.statusLogs || []),
          ],
        },
      });

      showToast(`${target.customerName} 고객 부재 처리 완료 (누적 ${nextCount}회)`);
      window.dispatchEvent(new Event('lm_lite_activity_updated'));
      setRefetchTrigger(prev => prev + 1);
      if (hudOpen) {
        setHudOpen(false);
        setIsCalling(false);
      }
      handleNextCustomer(target.caseId);
    } catch (err: any) {
      showToast(err.message || '부재 처리 실패', 'error');
    }
  };

  // 다음 고객으로 이동
  const handleNextCustomer = (currentId?: string) => {
    const currentIndex = filteredCases.findIndex(c => c.caseId === (currentId || activeCase?.caseId));
    if (currentIndex !== -1 && currentIndex + 1 < filteredCases.length) {
      const next = filteredCases[currentIndex + 1];
      setActiveCase(next);
      setPostCallOpen(false);
      setHudOpen(false);
      setIsCalling(false);
    } else {
      setActiveCase(null);
      setPostCallOpen(false);
      setHudOpen(false);
      setIsCalling(false);
    }
  };

  // 케이스 저장 핸들러
  const handleSaveCase = async (updates: Partial<Case>, successMessage?: string) => {
    if (!activeCase) return;
    await updateCaseMutation.mutateAsync({
      id: activeCase.caseId,
      updates,
    });
    window.dispatchEvent(new Event('lm_lite_activity_updated'));
    setRefetchTrigger(prev => prev + 1);
    if (successMessage) {
      showToast(successMessage);
    }
  };

  // ── [NEW] 오토콜 연속 발신 몰입형 HUD 모드 ──
  if (isAutoDialHudOpen) {
    return (
      <AutoDialAgentHUD
        currentUserEmail={user?.email || org?.userId || 'agent'}
        onExit={() => {
          setIsAutoDialHudOpen(false);
          refetchCases();
          checkMyAllocation();
        }}
        cases={cases}
      />
    );
  }

  return (
    <div className="min-h-screen bg-background text-foreground flex flex-col max-w-2xl mx-auto border-x border-border">
      
      {/* ── Top Header ── */}
      <header className="sticky top-0 z-40 bg-card/95 backdrop-blur-md border-b border-border px-4 py-3 flex items-center justify-between shadow-xs">
        <div className="flex items-center gap-2.5">
          <div className="w-8 h-8 rounded-lg bg-primary/10 text-primary border border-primary/20 flex items-center justify-center shrink-0">
            <Zap size={16} strokeWidth={1.75} className="fill-current" />
          </div>
          <div>
            <h1 className="text-sm font-bold tracking-tight text-foreground flex items-center gap-1.5">
              <span>간편 콜 모드</span>
              <span className="text-[11px] bg-muted text-muted-foreground border border-border px-1.5 py-0.2 rounded font-semibold">
                집중 통화
              </span>
            </h1>
            <p className="hidden sm:block text-[11px] text-muted-foreground">콜 & 텔레그램 전달 전용</p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          {/* ── 콜 모드 스위처 (1건 직접 vs 연속 오토콜) ── */}
          <div className="flex items-center p-0.5 rounded-lg bg-muted/60 border border-border text-xs font-semibold">
            <button
              onClick={() => setIsAutoDialHudOpen(false)}
              className="px-2 py-1 rounded-md bg-card text-foreground shadow-2xs flex items-center gap-1"
            >
              <Zap size={12} strokeWidth={1.75} className="text-primary" />
              <span className="hidden sm:inline">1건</span> 직접
            </button>
            <button
              onClick={() => {
                if (myAllocation) {
                  setIsAutoDialHudOpen(true);
                } else {
                  showToast('현재 배정된 오토콜 캠페인이 없습니다. 관리자에게 배정을 요청하세요.', 'info');
                }
              }}
              className="px-2 py-1 rounded-md text-muted-foreground hover:text-foreground flex items-center gap-1 transition-colors"
              title="연속 자동 발신 오토콜 모드"
            >
              <Play size={12} strokeWidth={1.75} className="text-primary" />
              <span>오토콜</span>
              {myAllocation && (
                <span className="w-1.5 h-1.5 rounded-full bg-primary animate-pulse" />
              )}
            </button>
          </div>

          <button
            onClick={() => {
              refetchCases();
              checkMyAllocation();
              setRefetchTrigger(prev => prev + 1);
            }}
            className="p-1.5 rounded-lg text-muted-foreground hover:bg-muted hover:text-foreground transition-colors"
            title="새로고침"
          >
            <RefreshCw size={15} strokeWidth={1.75} className={isLoading ? 'animate-spin' : ''} />
          </button>
          
          <button
            onClick={toggleTheme}
            className="p-1.5 rounded-lg text-muted-foreground hover:bg-muted hover:text-foreground transition-colors"
            title="테마 전환"
          >
            {theme === 'dark' ? <Sun size={15} strokeWidth={1.75} className="text-amber-400" /> : <Moon size={15} strokeWidth={1.75} />}
          </button>

          <button
            onClick={() => {
              sessionStorage.removeItem('lm_lite_mode_active');
              navigate('/cases');
            }}
            className="flex items-center gap-1 px-2.5 py-1 text-xs font-semibold rounded-lg border border-border bg-card text-foreground hover:bg-muted transition-colors"
          >
            <ChevronLeft size={14} strokeWidth={1.75} />
            <span className="hidden sm:inline">일반 모드</span>
          </button>
        </div>
      </header>

      {/* ── [NEW] 스마트 오토콜 연속 발신 런처 스마트 배너 ── */}
      {myAllocation && (
        <div className="mx-3.5 my-2.5 p-3.5 rounded-xl bg-card text-card-foreground shadow-xs flex items-center justify-between gap-3 border border-border animate-in fade-in slide-in-from-top-1 duration-200">
          <div className="flex items-center gap-2.5 min-w-0">
            <div className="w-8 h-8 rounded-lg bg-primary/10 text-primary border border-primary/20 flex items-center justify-center shrink-0">
              <Sparkles size={16} strokeWidth={1.75} />
            </div>
            <div className="min-w-0">
              <div className="flex items-center gap-1.5 flex-wrap">
                <span className="font-semibold text-xs md:text-sm tracking-tight text-foreground">오늘 배정된 스마트 오토콜</span>
                <span className="text-[10px] font-semibold px-2 py-0.2 rounded-full bg-primary/10 text-primary border border-primary/20">
                  {Math.max(0, myAllocation.allocation.allocatedCount - myAllocation.allocation.completedCount)}건 대기
                </span>
              </div>
              <p className="text-[11px] text-muted-foreground truncate mt-0.5">
                {myAllocation.campaign.name} · 7초 연속 자동 발신
              </p>
            </div>
          </div>
          <button
            onClick={() => setIsAutoDialHudOpen(true)}
            className="px-3 py-1.5 bg-primary hover:bg-primary/90 text-primary-foreground rounded-lg text-xs font-semibold shadow-xs flex items-center gap-1.5 shrink-0 active:scale-95 transition-all cursor-pointer"
          >
            <Play size={12} strokeWidth={1.75} className="fill-current" />
            <span>오토콜 시작</span>
          </button>
        </div>
      )}

      {/* ── 오늘 나의 실적 및 활동 요약 바 (Today's Performance & Activity Bar) ── */}
      <LiteTodayPerformanceBar
        cases={cases}
        onSelectTab={(tab) => setActiveTab(tab)}
        refetchTrigger={refetchTrigger}
      />

      {/* ── Search & Filter Controls ── */}
      <div className="p-3.5 space-y-2.5 bg-card border-b border-border">
        
        {/* Search Input */}
        <div className="relative">
          <Search size={15} strokeWidth={1.75} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
          <input
            type="text"
            value={search}
            onChange={e => setSearch(e.target.value)}
            placeholder="고객명 또는 전화번호 검색..."
            className="w-full pl-9 pr-8 py-2 text-xs rounded-lg border border-border bg-muted/40 text-foreground placeholder:text-muted-foreground outline-none focus:ring-1 focus:ring-primary/40 transition-all"
          />
          {search && (
            <button
              onClick={() => setSearch('')}
              className="absolute right-2.5 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground p-0.5"
            >
              <X size={14} strokeWidth={1.75} />
            </button>
          )}
        </div>

        {/* Quick Tabs & MyLeads Switch */}
        <div className="flex items-center justify-between gap-1 overflow-x-auto no-scrollbar pt-1">
          <div className="flex gap-1.5">
            <button
              onClick={() => setActiveTab('all')}
              className={`px-2.5 py-1.5 rounded-[6px] text-xs font-semibold transition-all whitespace-nowrap flex items-center gap-1.5 ${
                activeTab === 'all'
                  ? 'bg-primary/10 text-primary border border-primary/25 shadow-2xs'
                  : 'bg-muted/40 text-muted-foreground hover:text-foreground border border-transparent'
              }`}
            >
              <span>전체</span>
              <span className={`text-[10px] font-mono px-1 py-0.2 rounded-[4px] ${activeTab === 'all' ? 'bg-primary/20 text-primary font-bold' : 'bg-muted text-muted-foreground'}`}>
                {tabCounts.all}
              </span>
            </button>
            <button
              onClick={() => setActiveTab('today')}
              className={`px-2.5 py-1.5 rounded-[6px] text-xs font-semibold transition-all whitespace-nowrap flex items-center gap-1.5 ${
                activeTab === 'today'
                  ? 'bg-primary/10 text-primary border border-primary/25 shadow-2xs'
                  : 'bg-muted/40 text-muted-foreground hover:text-foreground border border-transparent'
              }`}
            >
              <span>오늘 할 일</span>
              <span className={`text-[10px] font-mono px-1 py-0.2 rounded-[4px] ${activeTab === 'today' ? 'bg-primary/20 text-primary font-bold' : 'bg-muted text-muted-foreground'}`}>
                {tabCounts.today}
              </span>
            </button>
            <button
              onClick={() => setActiveTab('new')}
              className={`px-2.5 py-1.5 rounded-[6px] text-xs font-semibold transition-all whitespace-nowrap flex items-center gap-1.5 ${
                activeTab === 'new'
                  ? 'bg-primary/10 text-primary border border-primary/25 shadow-2xs'
                  : 'bg-muted/40 text-muted-foreground hover:text-foreground border border-transparent'
              }`}
            >
              <span>신규</span>
              <span className={`text-[10px] font-mono px-1 py-0.2 rounded-[4px] ${activeTab === 'new' ? 'bg-primary/20 text-primary font-bold' : 'bg-muted text-muted-foreground'}`}>
                {tabCounts.new}
              </span>
            </button>
            <button
              onClick={() => setActiveTab('missed')}
              className={`px-2.5 py-1.5 rounded-[6px] text-xs font-semibold transition-all whitespace-nowrap flex items-center gap-1.5 ${
                activeTab === 'missed'
                  ? 'bg-primary/10 text-primary border border-primary/25 shadow-2xs'
                  : 'bg-muted/40 text-muted-foreground hover:text-foreground border border-transparent'
              }`}
            >
              <span>부재콜</span>
              <span className={`text-[10px] font-mono px-1 py-0.2 rounded-[4px] ${activeTab === 'missed' ? 'bg-primary/20 text-primary font-bold' : 'bg-muted text-muted-foreground'}`}>
                {tabCounts.missed}
              </span>
            </button>
          </div>

          {/* Toggle: 내 담당만 */}
          {org?.userId && (
            <button
              onClick={() => setOnlyMyLeads(!onlyMyLeads)}
              className={`px-2.5 py-1 rounded-[6px] text-xs font-semibold border transition-colors whitespace-nowrap shrink-0 ${
                onlyMyLeads
                  ? 'bg-primary/10 border-primary/25 text-primary'
                  : 'border-border text-muted-foreground hover:bg-muted hover:text-foreground'
              }`}
            >
              {onlyMyLeads ? '내 담당만' : '전체 리드'}
            </button>
          )}
        </div>

      </div>

      {/* ── Card Queue List ── */}
      <main className="flex-1 p-3.5 space-y-3 pb-24">
        {isLoading ? (
          <div className="py-20 text-center space-y-2">
            <RefreshCw size={24} className="animate-spin text-amber-500 mx-auto" />
            <p className="text-xs text-gray-500 dark:text-gray-400">콜 리스트를 불러오고 있습니다...</p>
          </div>
        ) : filteredCases.length === 0 ? (
          <div className="py-20 text-center space-y-3 bg-card rounded-[8px] border border-dashed border-border p-6">
            <CheckCircle2 size={36} className="text-emerald-500 mx-auto" />
            <h3 className="font-bold text-foreground text-sm">
              진행할 리드가 없습니다!
            </h3>
            <p className="text-xs text-muted-foreground">
              {search ? '검색 결과가 없습니다.' : '현재 필터 조건에 해당하는 고객이 모두 처리되었습니다.'}
            </p>
          </div>
        ) : (
          filteredCases.map((c) => {
            const partner = partners.find(p => p.partnerId === c.partnerId);

            return (
              <div
                key={c.caseId}
                className={`bg-card text-card-foreground rounded-[8px] p-3.5 shadow-xs border border-border border-l-4 ${getStatusBorderColor(c.status)} hover:border-[#0073ea]/40 hover:shadow-xs transition-all duration-150`}
              >
                {/* 1행: 상태 뱃지 & 부재 횟수 & 사건 유형 & 등록일 */}
                <div className="flex items-center justify-between text-xs mb-2">
                  <div className="flex items-center gap-1.5 flex-wrap">
                    <span className={`px-2 py-0.5 rounded-[4px] font-bold text-[11px] tracking-tight ${getStatusBadgeStyle(c.status)}`}>
                      {c.status}
                    </span>

                    {c.missedCallCount && c.missedCallCount > 0 ? (
                      <span className="px-1.5 py-0.5 rounded-[4px] text-[11px] bg-[#ff642e]/10 text-[#ff642e] font-semibold border border-[#ff642e]/20 font-mono">
                        부재 {c.missedCallCount}회
                      </span>
                    ) : null}

                    <span className="text-[11px] font-semibold text-muted-foreground">
                      {c.caseType || '개인회생'}
                    </span>
                  </div>

                  <span className="text-[11px] text-muted-foreground font-mono">
                    {c.createdAt ? c.createdAt.split('T')[0] : ''}
                  </span>
                </div>

                {/* 2행: 고객명 & 프로필 & 전화번호 */}
                <div className="flex items-baseline justify-between mb-2">
                  <div>
                    <h3 className="text-[15px] font-bold text-foreground flex items-center gap-1.5">
                      <span>{c.customerName}</span>
                      {c.gender && (
                        <span className="text-xs text-muted-foreground font-normal">
                          ({c.birth ? `${c.birth}년생` : ''} {c.gender})
                        </span>
                      )}
                    </h3>
                    <p className="text-xs text-muted-foreground flex items-center gap-2 mt-0.5">
                      {c.region && <span>📍 {c.region}</span>}
                      <span>유입: {c.inboundPath || '기타'}</span>
                      {partner && <span>로펌: {partner.name}</span>}
                    </p>
                  </div>

                  <span className="text-[15px] font-bold font-mono tracking-tight tabular-nums text-primary">
                    {c.phone}
                  </span>
                </div>

                {/* 3행: 사전 정보 또는 최근 메모 미리보기 */}
                {c.preInfo && (
                  <div className="bg-[#f8f9fc] dark:bg-muted/40 p-2.5 rounded-[6px] text-xs text-foreground/85 mb-2.5 border-l-2 border-[#0073ea] border border-y-border border-r-border line-clamp-2">
                    <span className="font-semibold text-primary mr-1">[사전정보]</span>
                    {c.preInfo}
                  </div>
                )}

                {/* 카드별 인라인 탕감 계산기 (펼쳐졌을 때) */}
                {expandedCalcCaseId === c.caseId && (
                  <div className="mb-2.5">
                    <LiteDebtReliefCalculator c={c} />
                  </div>
                )}

                {/* 카드 빠른 보조 툴 (3초 탕감 계산 / 1-Click 문자) */}
                <div className="flex items-center justify-between text-xs pt-1.5 pb-2 border-t border-border/70 mb-1.5">
                  <button
                    type="button"
                    onClick={() => setExpandedCalcCaseId(expandedCalcCaseId === c.caseId ? null : c.caseId)}
                    className="flex items-center gap-1.5 px-2 py-0.5 rounded-[4px] text-xs font-semibold text-primary hover:bg-primary/10 transition-colors"
                  >
                    <Calculator size={13} strokeWidth={2} className="text-primary" />
                    <span>{expandedCalcCaseId === c.caseId ? '계산기 접기 ▲' : '⚡ 이 고객 탕감 계산 ▼'}</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => setSmsTargetCase(c)}
                    className="flex items-center gap-1.5 px-2 py-0.5 rounded-[4px] text-xs font-semibold text-muted-foreground hover:text-foreground hover:bg-muted transition-colors"
                  >
                    <MessageSquare size={13} strokeWidth={1.75} />
                    <span>📩 1-Click 문자</span>
                  </button>
                </div>

                {/* 4행: 균형 잡힌 38px 컴팩트 인라인 액션 툴바 */}
                <div className="flex items-center gap-1.5 pt-0.5">
                  {/* 1. Primary: 38px 높이의 균형 잡힌 통화 발신 버튼 (50% 너비) */}
                  <button
                    type="button"
                    onClick={() => handleDial(c)}
                    className="flex-[2] h-[38px] flex items-center justify-center gap-1.5 px-3 rounded-[6px] bg-[#0073ea] hover:bg-[#0060c0] text-white font-semibold text-xs tracking-tight shadow-2xs active:scale-[0.98] transition-all duration-75 cursor-pointer"
                    title="원터치 전화 발신"
                  >
                    <Phone size={14} strokeWidth={2} className="fill-current" />
                    <span>전화 걸기 ({c.phone.slice(-4)})</span>
                  </button>

                  {/* 2. Secondary: 인라인 가로형 부재 처리 (+1) (25% 너비) */}
                  <button
                    type="button"
                    onClick={(e) => handleQuickMissedCall(c, e)}
                    className="flex-1 h-[38px] flex items-center justify-center gap-1.5 px-2.5 rounded-[6px] bg-muted/40 hover:bg-[#ff642e]/10 hover:border-[#ff642e]/40 hover:text-[#ff642e] text-foreground border border-border text-xs font-semibold active:scale-[0.98] transition-all duration-75 cursor-pointer"
                    title="부재 카운트 +1 및 상태 '부재'로 자동 갱신"
                  >
                    <PhoneOff size={13} strokeWidth={1.75} />
                    <span>부재</span>
                  </button>

                  {/* 3. Tertiary: 인라인 가로형 상담 결과 & 텔레그램 전달 (25% 너비) */}
                  <button
                    type="button"
                    onClick={() => {
                      setActiveCase(c);
                      setPostCallOpen(true);
                    }}
                    className="flex-1 h-[38px] flex items-center justify-center gap-1.5 px-2.5 rounded-[6px] bg-muted/40 hover:bg-[#00a2ae]/10 hover:border-[#00a2ae]/40 hover:text-[#00a2ae] text-foreground border border-border text-xs font-semibold active:scale-[0.98] transition-all duration-75 cursor-pointer"
                    title="상담 요약문 확인 및 텔레그램 전달"
                  >
                    <Send size={13} strokeWidth={1.75} />
                    <span>전달</span>
                  </button>
                </div>

              </div>
            );
          })
        )}
      </main>

      {/* ── 통화 중 안내 HUD (In-Call Question Cheat Sheet) ── */}
      {hudOpen && activeCase && (
        <LiteInCallHud
          c={activeCase}
          partner={partners.find(p => p.partnerId === activeCase.partnerId)}
          elapsedSec={callElapsed}
          isCalling={isCalling}
          onEndCall={handleEndCall}
          onOpenPostCall={() => {
            setHudOpen(false);
            setPostCallOpen(true);
            setIsCalling(false);
          }}
          onQuickMissedCall={() => handleQuickMissedCall(activeCase)}
          onClose={() => {
            setHudOpen(false);
            setIsCalling(false);
          }}
        />
      )}

      {/* ── 통화 종료 스마트 후처리 & 텔레그램 전달 시트 ── */}
      {/* 카드 직접 발송용 1-Click 문자 모달 */}
      {smsTargetCase && (
        <LiteQuickSmsModal
          c={smsTargetCase}
          partner={partners.find(p => p.partnerId === smsTargetCase.partnerId)}
          isOpen={!!smsTargetCase}
          onClose={() => setSmsTargetCase(null)}
          showToast={showToast}
        />
      )}

      {postCallOpen && activeCase && (
        <LitePostCallSheet
          c={activeCase}
          partners={partners}
          onSaveCase={handleSaveCase}
          onNext={() => handleNextCustomer()}
          onClose={() => setPostCallOpen(false)}
          showToast={showToast}
        />
      )}

    </div>
  );
}
