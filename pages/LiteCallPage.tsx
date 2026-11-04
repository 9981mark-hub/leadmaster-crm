import React, { useState, useMemo, useEffect } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { 
  Phone, PhoneOff, PhoneCall, Sparkles, Search, X, RefreshCw, 
  ChevronLeft, ArrowRight, User, CheckCircle2, Clock, Moon, Sun, 
  Send, AlertCircle, Building2, Zap, Filter
} from 'lucide-react';
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

type LiteTab = 'all' | 'today' | 'new' | 'missed';

export default function LiteCallPage() {
  const navigate = useNavigate();
  const { org, isAdmin } = useAuth();
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

  // URL ?caseId= 파라미터 처리 (안드로이드 리다이렉트 흡수)
  const [searchParams, setSearchParams] = useSearchParams();
  const urlCaseId = searchParams.get('caseId');

  // 간편 모드 세션 활성 및 안드로이드 플로팅 버튼 자동 제어
  useEffect(() => {
    sessionStorage.setItem('lm_lite_mode_active', 'true');
    try {
      if (typeof (window as any).AndroidBridge?.setFloatingButtonEnabled === 'function') {
        (window as any).AndroidBridge.setFloatingButtonEnabled(false);
      }
    } catch (e) {
      console.warn('[Lite] Android floating button control failed:', e);
    }

    return () => {
      try {
        if (typeof (window as any).AndroidBridge?.setFloatingButtonEnabled === 'function') {
          (window as any).AndroidBridge.setFloatingButtonEnabled(true);
        }
      } catch {}
    };
  }, []);

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
        // 'pending' or 'dialing' 대기 중
        setIsCalling(false);
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
      // 통화 화면으로 튕기지 않고 앱 전면 유지 브릿지 호출 (지원 시)
      try {
        if (typeof (window as any).AndroidBridge?.bringToFront === 'function') {
          (window as any).AndroidBridge.bringToFront();
        }
      } catch {}
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

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900 text-gray-900 dark:text-gray-100 flex flex-col max-w-2xl mx-auto border-x border-gray-200 dark:border-gray-800 shadow-sm">
      
      {/* ── Top Header ── */}
      <header className="sticky top-0 z-40 bg-white/95 dark:bg-gray-800/95 backdrop-blur-md border-b border-gray-200 dark:border-gray-700 px-4 py-3 flex items-center justify-between shadow-sm">
        <div className="flex items-center gap-2">
          <div className="w-8 h-8 rounded-lg bg-gradient-to-tr from-amber-500 to-orange-500 flex items-center justify-center text-white shadow-sm">
            <Zap size={18} className="fill-white" />
          </div>
          <div>
            <h1 className="text-base font-bold tracking-tight text-gray-900 dark:text-white flex items-center gap-1.5">
              <span>LeadMaster Lite</span>
              <span className="text-[10px] bg-amber-100 dark:bg-amber-950 text-amber-800 dark:text-amber-300 px-1.5 py-0.5 rounded font-bold">
                간편 모드
              </span>
            </h1>
            <p className="text-[10px] text-gray-400">콜 & 텔레그램 전달 전용</p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={() => {
              refetchCases();
              setRefetchTrigger(prev => prev + 1);
            }}
            className="p-2 rounded-lg text-gray-500 hover:bg-gray-100 dark:hover:bg-gray-700"
            title="새로고침"
          >
            <RefreshCw size={16} className={isLoading ? 'animate-spin' : ''} />
          </button>
          
          <button
            onClick={toggleTheme}
            className="p-2 rounded-lg text-gray-500 hover:bg-gray-100 dark:hover:bg-gray-700"
            title="테마 전환"
          >
            {theme === 'dark' ? <Sun size={16} /> : <Moon size={16} />}
          </button>

          <button
            onClick={() => {
              sessionStorage.removeItem('lm_lite_mode_active');
              navigate('/cases');
            }}
            className="flex items-center gap-1 px-2.5 py-1.5 text-xs font-bold rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-700 dark:text-gray-200 hover:bg-gray-50"
          >
            <ChevronLeft size={14} />
            <span>일반 모드</span>
          </button>
        </div>
      </header>

      {/* ── 오늘 나의 실적 및 활동 요약 바 (Today's Performance & Activity Bar) ── */}
      <LiteTodayPerformanceBar
        cases={cases}
        onSelectTab={(tab) => setActiveTab(tab)}
        refetchTrigger={refetchTrigger}
      />

      {/* ── Search & Filter Controls ── */}
      <div className="p-3.5 space-y-2.5 bg-white dark:bg-gray-800/60 border-b border-gray-100 dark:border-gray-800">
        
        {/* Search Input */}
        <div className="relative">
          <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
          <input
            type="text"
            value={search}
            onChange={e => setSearch(e.target.value)}
            placeholder="고객명 또는 전화번호 검색..."
            className="w-full pl-9 pr-8 py-2 text-xs rounded-xl border border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-900 text-gray-900 dark:text-gray-100 outline-none focus:ring-2 focus:ring-amber-500/50"
          />
          {search && (
            <button
              onClick={() => setSearch('')}
              className="absolute right-2.5 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600 p-0.5"
            >
              <X size={14} />
            </button>
          )}
        </div>

        {/* Quick Tabs & MyLeads Switch */}
        <div className="flex items-center justify-between gap-1 overflow-x-auto no-scrollbar pt-1">
          <div className="flex gap-1.5">
            <button
              onClick={() => setActiveTab('all')}
              className={`px-3 py-1.5 rounded-full text-xs font-bold transition-all whitespace-nowrap ${
                activeTab === 'all'
                  ? 'bg-slate-900 dark:bg-white text-white dark:text-slate-900 shadow-sm'
                  : 'bg-gray-100 dark:bg-gray-700/60 text-gray-600 dark:text-gray-300'
              }`}
            >
              전체 {tabCounts.all}
            </button>
            <button
              onClick={() => setActiveTab('today')}
              className={`px-3 py-1.5 rounded-full text-xs font-bold transition-all whitespace-nowrap ${
                activeTab === 'today'
                  ? 'bg-slate-900 dark:bg-white text-white dark:text-slate-900 shadow-sm'
                  : 'bg-gray-100 dark:bg-gray-700/60 text-gray-600 dark:text-gray-300'
              }`}
            >
              오늘 할 일 {tabCounts.today}
            </button>
            <button
              onClick={() => setActiveTab('new')}
              className={`px-3 py-1.5 rounded-full text-xs font-bold transition-all whitespace-nowrap ${
                activeTab === 'new'
                  ? 'bg-slate-900 dark:bg-white text-white dark:text-slate-900 shadow-sm'
                  : 'bg-gray-100 dark:bg-gray-700/60 text-gray-600 dark:text-gray-300'
              }`}
            >
              신규 {tabCounts.new}
            </button>
            <button
              onClick={() => setActiveTab('missed')}
              className={`px-3 py-1.5 rounded-full text-xs font-bold transition-all whitespace-nowrap ${
                activeTab === 'missed'
                  ? 'bg-slate-900 dark:bg-white text-white dark:text-slate-900 shadow-sm'
                  : 'bg-gray-100 dark:bg-gray-700/60 text-gray-600 dark:text-gray-300'
              }`}
            >
              부재콜 {tabCounts.missed}
            </button>
          </div>

          {/* Toggle: 내 담당만 */}
          {org?.userId && (
            <button
              onClick={() => setOnlyMyLeads(!onlyMyLeads)}
              className={`px-2.5 py-1 rounded-lg text-[11px] font-bold border transition-colors whitespace-nowrap shrink-0 ${
                onlyMyLeads
                  ? 'bg-blue-50 border-blue-200 text-blue-700 dark:bg-blue-950 dark:border-blue-800 dark:text-blue-300'
                  : 'border-gray-200 dark:border-gray-700 text-gray-500'
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
            <p className="text-xs text-gray-400">콜 리스트를 불러오고 있습니다...</p>
          </div>
        ) : filteredCases.length === 0 ? (
          <div className="py-20 text-center space-y-3 bg-white dark:bg-gray-800/40 rounded-2xl border border-dashed border-gray-200 dark:border-gray-700 p-6">
            <CheckCircle2 size={36} className="text-emerald-500 mx-auto" />
            <h3 className="font-bold text-gray-700 dark:text-gray-200 text-sm">
              진행할 리드가 없습니다!
            </h3>
            <p className="text-xs text-gray-400">
              {search ? '검색 결과가 없습니다.' : '현재 필터 조건에 해당하는 고객이 모두 처리되었습니다.'}
            </p>
          </div>
        ) : (
          filteredCases.map((c) => {
            const partner = partners.find(p => p.partnerId === c.partnerId);
            const isMissed = c.status === '부재' || (c.missedCallCount || 0) > 0;
            const isNew = c.isNew || c.status === '신규접수';

            return (
              <div
                key={c.caseId}
                className={`bg-white dark:bg-gray-800 rounded-2xl p-4 shadow-sm border transition-all ${
                  isNew
                    ? 'border-red-300 dark:border-red-800 ring-1 ring-red-400/30'
                    : 'border-gray-200/90 dark:border-gray-700'
                }`}
              >
                {/* 1행: 상태 뱃지 & 유입경로 & 등록일 */}
                <div className="flex items-center justify-between text-xs mb-2">
                  <div className="flex items-center gap-1.5 flex-wrap">
                    <span className={`px-2 py-0.5 rounded-md font-bold text-[11px] ${
                      isNew 
                        ? 'bg-red-500 text-white animate-pulse'
                        : isMissed
                          ? 'bg-amber-100 text-amber-800 dark:bg-amber-950 dark:text-amber-300'
                          : 'bg-blue-100 text-blue-800 dark:bg-blue-950 dark:text-blue-300'
                    }`}>
                      {c.status}
                    </span>

                    {c.missedCallCount && c.missedCallCount > 0 ? (
                      <span className="px-1.5 py-0.5 rounded text-[10px] bg-rose-50 text-rose-600 font-bold border border-rose-200">
                        부재 {c.missedCallCount}회
                      </span>
                    ) : null}

                    <span className="text-[11px] font-bold text-indigo-600 dark:text-indigo-400">
                      {c.caseType || '개인회생'}
                    </span>
                  </div>

                  <span className="text-[11px] text-gray-400 font-mono">
                    {c.createdAt ? c.createdAt.split('T')[0] : ''}
                  </span>
                </div>

                {/* 2행: 고객명 & 프로필 & 전화번호 */}
                <div className="flex items-baseline justify-between mb-2">
                  <div>
                    <h3 className="text-lg font-bold text-gray-900 dark:text-white flex items-center gap-2">
                      <span>{c.customerName}</span>
                      {c.gender && (
                        <span className="text-xs text-gray-400 font-normal">
                          ({c.birth ? `${c.birth}년생` : ''} {c.gender})
                        </span>
                      )}
                    </h3>
                    <p className="text-xs text-gray-500 dark:text-gray-400 flex items-center gap-2 mt-0.5">
                      {c.region && <span>📍 {c.region}</span>}
                      <span>유입: {c.inboundPath || '기타'}</span>
                      {partner && <span>로펌: {partner.name}</span>}
                    </p>
                  </div>

                  <span className="text-base font-bold font-mono text-gray-800 dark:text-gray-200">
                    {c.phone}
                  </span>
                </div>

                {/* 3행: 사전 정보 또는 최근 메모 미리보기 */}
                {c.preInfo && (
                  <div className="bg-gray-50 dark:bg-gray-900/60 p-2.5 rounded-xl text-xs text-gray-600 dark:text-gray-300 mb-3 border border-gray-100 dark:border-gray-800 line-clamp-2">
                    <span className="font-bold text-blue-600 dark:text-blue-400 mr-1">[사전정보]</span>
                    {c.preInfo}
                  </div>
                )}

                {/* 4행: 빅 터치 액션 버튼 바 */}
                <div className="grid grid-cols-12 gap-2 pt-1">
                  
                  {/* Primary: 큰 원터치 전화 걸기 버튼 */}
                  <button
                    type="button"
                    onClick={() => handleDial(c)}
                    className="col-span-8 flex items-center justify-center gap-2 py-3.5 px-4 rounded-xl bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700 text-white font-bold text-sm shadow-md active:scale-95 transition-all"
                  >
                    <Phone size={17} className="fill-white" />
                    <span>전화 걸기 ({c.phone.slice(-4)})</span>
                  </button>

                  {/* Secondary: 원터치 부재 처리 */}
                  <button
                    type="button"
                    onClick={(e) => handleQuickMissedCall(c, e)}
                    className="col-span-2 flex flex-col items-center justify-center p-2 rounded-xl bg-amber-50 hover:bg-amber-100 text-amber-700 dark:bg-amber-950/60 dark:hover:bg-amber-900/60 dark:text-amber-300 border border-amber-200 dark:border-amber-800 text-[11px] font-bold active:scale-95 transition-all"
                    title="부재 카운트 +1 및 상태 '부재'로 자동 갱신"
                  >
                    <PhoneOff size={16} />
                    <span className="mt-0.5">부재</span>
                  </button>

                  {/* Tertiary: 상담 결과 및 텔레그램 전달 시트 열기 */}
                  <button
                    type="button"
                    onClick={() => {
                      setActiveCase(c);
                      setPostCallOpen(true);
                    }}
                    className="col-span-2 flex flex-col items-center justify-center p-2 rounded-xl bg-emerald-50 hover:bg-emerald-100 text-emerald-700 dark:bg-emerald-950/60 dark:hover:bg-emerald-900/60 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-800 text-[11px] font-bold active:scale-95 transition-all"
                    title="상담 요약문 확인 및 텔레그램 전달"
                  >
                    <Send size={16} />
                    <span className="mt-0.5">전달</span>
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
