/**
 * AutoDialDashboard.tsx — 차세대 스마트 오토콜(v4.0) 및 배치 통합 대시보드
 * 
 * 1. v4.0 메인 탭: 오토콜 캠페인 중앙 관리, 상담원 일일 배정, 실시간 플로어 전광판, 상담원 몰입형 HUD
 * 2. v1.0 레거시 탭: 부재건 수집, 엑셀 업로드, OCR 수집 등 수동 배치 목록 호환 보존
 */
import React, { useState, useEffect, useCallback, useMemo } from 'react';
import {
  Phone, FileSpreadsheet, Camera, Play, Pause, Square, Trash2,
  BarChart3, CheckSquare, RefreshCw, Clock, PhoneCall, PhoneOff,
  PhoneMissed, Loader2, Plus, Eye, Users, Zap, Shield, Sparkles,
  Smartphone, Headphones, LayoutDashboard
} from 'lucide-react';
import { useAuth } from '../../contexts/AuthContext';
import { useToast } from '../../contexts/ToastContext';
import { fetchBatches, deleteBatch, updateBatchStatus, AutoDialBatch } from '../../services/autoDialService';
import {
  fetchAutoDialCampaigns,
  deleteCampaign,
  AutoDialCampaign
} from '../../services/autoDialV4Service';
import { fetchTeamMembers, TeamMember } from '../../services/team';
import { fetchCases } from '../../services/api';
import { Case } from '../../types';

import MissedCallBatchModal from './MissedCallBatchModal';
import ExcelBatchModal from './ExcelBatchModal';
import OcrBatchModal from './OcrBatchModal';
import AutoDialRunner from './AutoDialRunner';
import AutoDialReport from './AutoDialReport';
import AutoDialCampaignModal from './AutoDialCampaignModal';
import AutoDialFloorMonitor from './AutoDialFloorMonitor';
import AutoDialAgentHUD from './AutoDialAgentHUD';

type ViewMode = 'dashboard' | 'runner' | 'report' | 'agent_hud';
type MainTab = 'campaigns_v4' | 'batches_v1';

const AutoDialDashboard: React.FC = () => {
  const { user, isAdmin, org } = useAuth();
  const { showToast } = useToast();

  const [mainTab, setMainTab] = useState<MainTab>('campaigns_v4');
  const [viewMode, setViewMode] = useState<ViewMode>('dashboard');
  
  // v4.0 캠페인 상태
  const [campaigns, setCampaigns] = useState<AutoDialCampaign[]>([]);
  const [activeCampaignId, setActiveCampaignId] = useState<string | null>(null);
  const [isCampaignModalOpen, setIsCampaignModalOpen] = useState<boolean>(false);
  const [teamMembers, setTeamMembers] = useState<TeamMember[]>([]);
  const [cases, setCases] = useState<Case[]>([]);

  // v1.0 배치 상태
  const [batches, setBatches] = useState<AutoDialBatch[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [activeBatchId, setActiveBatchId] = useState<string | null>(null);
  const [activeModal, setActiveModal] = useState<'missed' | 'excel' | 'ocr' | null>(null);

  // 데이터 로드
  const loadAllData = useCallback(async () => {
    setLoading(true);
    try {
      const [batchList, campList, caseList, memberList] = await Promise.all([
        fetchBatches().catch(() => []),
        fetchAutoDialCampaigns(org?.orgId).catch(() => []),
        fetchCases().catch(() => []),
        fetchTeamMembers().catch(() => []),
      ]);
      setBatches(batchList);
      setCampaigns(campList);
      setCases(caseList);
      setTeamMembers(memberList);

      // 진행 중인 캠페인이 있으면 기본 활성화
      if (campList.length > 0 && !activeCampaignId) {
        const running = campList.find(c => c.status === 'running') || campList[0];
        setActiveCampaignId(running.id);
      }
    } catch (error) {
      console.error('Failed to load autodial data:', error);
      showToast('오토콜 데이터를 불러오는데 실패했습니다.', 'error');
    } finally {
      setLoading(false);
    }
  }, [org?.orgId, activeCampaignId, showToast]);

  useEffect(() => {
    loadAllData();
  }, [loadAllData]);

  // 모바일 환경 감지
  const isMobileDevice = () => {
    const androidBridge = (window as any).AndroidBridge;
    if (androidBridge?.makeCall) return true;
    return /Android|iPhone|iPad|iPod|Mobile/i.test(navigator.userAgent);
  };

  // 모바일에서 running 배치가 있으면 runner 자동 진입
  const userDismissedRef = React.useRef(false);
  useEffect(() => {
    if (!loading && batches.length > 0 && viewMode === 'dashboard' && isMobileDevice() && !userDismissedRef.current) {
      const runningBatch = batches.find(b => b.status === 'running');
      if (runningBatch) {
        setActiveBatchId(runningBatch.id);
        setViewMode('runner');
      }
    }
  }, [loading, batches, viewMode]);

  // 캠페인 삭제
  const handleDeleteCampaign = async (id: string, name: string) => {
    if (!window.confirm(`정말 '${name}' 캠페인을 삭제하시겠습니까? (상담원 큐도 함께 삭제됩니다)`)) return;
    try {
      await deleteCampaign(id);
      showToast('캠페인이 삭제되었습니다.', 'success');
      if (activeCampaignId === id) setActiveCampaignId(null);
      loadAllData();
    } catch (err) {
      showToast('캠페인 삭제에 실패했습니다.', 'error');
    }
  };

  // v1.0 배치 핸들러
  const handleStatusChange = async (id: string, newStatus: AutoDialBatch['status']) => {
    try {
      await updateBatchStatus(id, newStatus);
      showToast('상태가 변경되었습니다.', 'success');
      loadAllData();
    } catch (error) {
      showToast('상태 변경에 실패했습니다.', 'error');
    }
  };

  const handleDeleteBatch = async (id: string) => {
    if (!window.confirm('정말 이 배치를 삭제하시겠습니까?')) return;
    try {
      await deleteBatch(id);
      showToast('배치가 삭제되었습니다.', 'success');
      loadAllData();
    } catch (error) {
      showToast('배치 삭제에 실패했습니다.', 'error');
    }
  };

  // === 1. 상담원 몰입형 HUD View ===
  if (viewMode === 'agent_hud') {
    return (
      <AutoDialAgentHUD
        currentUserEmail={user?.email || 'agent'}
        onExit={() => {
          setViewMode('dashboard');
          loadAllData();
        }}
        cases={cases}
      />
    );
  }

  // === 2. Runner View (v1.0 호환) ===
  if (viewMode === 'runner' && activeBatchId) {
    return (
      <div className="p-4 md:p-6 lg:p-8 max-w-7xl mx-auto">
        <AutoDialRunner
          batchId={activeBatchId}
          onClose={() => {
            userDismissedRef.current = true;
            setViewMode('dashboard');
            setActiveBatchId(null);
            loadAllData();
          }}
          onComplete={() => setViewMode('report')}
        />
      </div>
    );
  }

  // === 3. Report View (v1.0 호환) ===
  if (viewMode === 'report' && activeBatchId) {
    return (
      <div className="p-4 md:p-6 lg:p-8 max-w-7xl mx-auto">
        <AutoDialReport
          batchId={activeBatchId}
          onClose={() => {
            setViewMode('dashboard');
            setActiveBatchId(null);
            loadAllData();
          }}
        />
      </div>
    );
  }

  // v1.0 배치 통계
  const todayStats = batches.reduce((acc, curr) => ({
    total: acc.total + curr.completedCount,
    connected: acc.connected + curr.connectedCount,
    noAnswer: acc.noAnswer + curr.noAnswerCount,
    busy: acc.busy + curr.busyCount,
  }), { total: 0, connected: 0, noAnswer: 0, busy: 0 });

  return (
    <div className="p-4 md:p-6 lg:p-8 max-w-7xl mx-auto space-y-6 animate-in fade-in duration-300">
      {/* 1. 상단 타이틀 & 런처 바 */}
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 bg-gradient-to-r from-indigo-900 via-indigo-800 to-purple-900 text-white p-6 rounded-3xl shadow-xl shadow-indigo-950/20 relative overflow-hidden">
        <div className="relative z-10">
          <div className="flex items-center gap-2 mb-2">
            <span className="text-xs px-2.5 py-0.5 rounded-full font-black bg-indigo-500/30 text-indigo-200 border border-indigo-400/30 flex items-center gap-1">
              <Sparkles size={12} className="text-amber-300" />
              SMART AUTO-DIALER v4.0
            </span>
            <span className="text-xs font-semibold text-indigo-300">
              010 스마트폰 앱 연동 무사고 몰입형 다이얼러
            </span>
          </div>
          <h1 className="text-2xl md:text-3xl font-black flex items-center gap-3">
            <PhoneCall className="w-8 h-8 text-amber-400" />
            스마트 오토콜 센터
          </h1>
          <p className="text-indigo-200 mt-1 text-xs md:text-sm max-w-xl">
            상담원은 고민 없이 7초 카운트다운과 함께 배당 콜을 연속 소화하고, 관리자는 일일 할당 및 발신 템포를 실시간 통제합니다.
          </p>
        </div>

        {/* 액션 버튼 그룹 */}
        <div className="flex flex-wrap items-center gap-2.5 relative z-10 shrink-0">
          {/* 상담원: 오토콜 HUD 시작 버튼 */}
          <button
            type="button"
            onClick={() => setViewMode('agent_hud')}
            className="px-5 py-3 bg-gradient-to-r from-emerald-500 to-teal-500 hover:from-emerald-600 hover:to-teal-600 text-white rounded-2xl text-xs md:text-sm font-black shadow-lg shadow-emerald-950/30 flex items-center gap-2 active:scale-95 transition-all"
          >
            <Headphones size={18} />
            🎧 나의 오토콜 런타임 시작
          </button>

          {/* 관리자: 새 캠페인 생성 모달 버튼 */}
          {isAdmin && (
            <button
              type="button"
              onClick={() => setIsCampaignModalOpen(true)}
              className="px-4 py-3 bg-white/10 hover:bg-white/20 text-white rounded-2xl text-xs md:text-sm font-bold border border-white/20 backdrop-blur-sm flex items-center gap-2 transition-all"
            >
              <Plus size={16} />
              + 캠페인 생성 & 일일 배정
            </button>
          )}

          <button
            type="button"
            onClick={loadAllData}
            disabled={loading}
            className="p-3 bg-white/10 hover:bg-white/20 rounded-2xl text-white transition-colors"
            title="새로고침"
          >
            <RefreshCw size={16} className={loading ? 'animate-spin' : ''} />
          </button>
        </div>

        {/* 배경 은은한 광채 효과 */}
        <div className="absolute -right-16 -top-16 w-64 h-64 bg-indigo-500/20 rounded-full blur-3xl pointer-events-none" />
      </div>

      {/* 2. 메인 네비게이션 탭 (v4.0 캠페인 vs v1.0 레거시 배치) */}
      <div className="flex items-center justify-between border-b border-gray-200 dark:border-gray-700 pb-1">
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => setMainTab('campaigns_v4')}
            className={`px-4 py-2.5 rounded-xl text-xs md:text-sm font-bold flex items-center gap-2 transition-all ${
              mainTab === 'campaigns_v4'
                ? 'bg-indigo-600 text-white shadow-md shadow-indigo-600/20'
                : 'text-gray-600 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-800'
            }`}
          >
            <LayoutDashboard size={16} />
            캠페인 & 플로어 관제 (v4.0)
            {campaigns.length > 0 && (
              <span className="ml-1 px-2 py-0.5 rounded-full text-[11px] bg-white/20 text-white">
                {campaigns.length}
              </span>
            )}
          </button>

          <button
            type="button"
            onClick={() => setMainTab('batches_v1')}
            className={`px-4 py-2.5 rounded-xl text-xs md:text-sm font-bold flex items-center gap-2 transition-all ${
              mainTab === 'batches_v1'
                ? 'bg-indigo-600 text-white shadow-md shadow-indigo-600/20'
                : 'text-gray-600 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-800'
            }`}
          >
            <FileSpreadsheet size={16} />
            간편 수동 배치 (v1.0 호환)
            {batches.length > 0 && (
              <span className="ml-1 px-2 py-0.5 rounded-full text-[11px] bg-gray-200 dark:bg-gray-700 text-gray-700 dark:text-gray-300">
                {batches.length}
              </span>
            )}
          </button>
        </div>
      </div>

      {/* 3-A. v4.0 캠페인 & 플로어 전광판 영역 */}
      {mainTab === 'campaigns_v4' && (
        <div className="space-y-6">
          {/* 캠페인 셀렉터 바 (캠페인이 여러 개일 경우 탭 전환) */}
          {campaigns.length > 0 ? (
            <div className="flex items-center gap-2 overflow-x-auto pb-1">
              <span className="text-xs font-bold text-gray-400 shrink-0">캠페인 선택:</span>
              {campaigns.map(camp => {
                const isSelected = activeCampaignId === camp.id;
                return (
                  <button
                    key={camp.id}
                    type="button"
                    onClick={() => setActiveCampaignId(camp.id)}
                    className={`px-3.5 py-1.5 rounded-xl text-xs font-bold shrink-0 border transition-all flex items-center gap-2 ${
                      isSelected
                        ? 'bg-indigo-50 dark:bg-indigo-950/60 border-indigo-400 text-indigo-700 dark:text-indigo-300 shadow-sm'
                        : 'bg-white dark:bg-gray-800 border-gray-200 dark:border-gray-700 text-gray-600 dark:text-gray-400 hover:border-gray-300'
                    }`}
                  >
                    <span className={`w-2 h-2 rounded-full ${camp.status === 'running' ? 'bg-emerald-500 animate-pulse' : 'bg-gray-400'}`} />
                    <span>{camp.name}</span>
                    <span className="font-mono text-[11px] text-gray-400">
                      ({camp.completedLeads}/{camp.totalLeads})
                    </span>
                    {isAdmin && (
                      <span
                        onClick={(e) => {
                          e.stopPropagation();
                          handleDeleteCampaign(camp.id, camp.name);
                        }}
                        className="hover:text-red-500 p-0.5"
                        title="캠페인 삭제"
                      >
                        ×
                      </span>
                    )}
                  </button>
                );
              })}
            </div>
          ) : (
            <div className="text-center py-12 bg-white dark:bg-gray-800 rounded-3xl border border-dashed border-gray-300 dark:border-gray-700 p-8 space-y-3">
              <div className="w-14 h-14 bg-indigo-50 dark:bg-indigo-950/50 text-indigo-600 rounded-2xl flex items-center justify-center mx-auto">
                <PhoneCall size={28} />
              </div>
              <h3 className="text-base font-bold text-gray-900 dark:text-white">
                등록된 오토콜 캠페인이 없습니다
              </h3>
              <p className="text-xs text-gray-500 max-w-sm mx-auto">
                상단의 <strong>[+ 캠페인 생성 & 일일 배정]</strong> 버튼을 눌러 오늘 투입할 리드와 상담원별 목표 콜수를 설정하세요.
              </p>
              {isAdmin && (
                <button
                  type="button"
                  onClick={() => setIsCampaignModalOpen(true)}
                  className="px-4 py-2 bg-indigo-600 text-white rounded-xl text-xs font-bold hover:bg-indigo-700 transition-colors"
                >
                  캠페인 생성하기
                </button>
              )}
            </div>
          )}

          {/* 선택된 캠페인의 실시간 플로어 전광판 */}
          {activeCampaignId && (
            <AutoDialFloorMonitor
              campaignId={activeCampaignId}
              onClose={() => setActiveCampaignId(null)}
            />
          )}
        </div>
      )}

      {/* 3-B. v1.0 레거시 배치 영역 (부재건, 엑셀, OCR 및 배치 목록) */}
      {mainTab === 'batches_v1' && (
        <div className="space-y-6">
          {/* Quick Action Cards */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            <button 
              onClick={() => setActiveModal('missed')}
              className="group relative overflow-hidden rounded-2xl bg-gradient-to-br from-blue-500 to-indigo-600 p-6 text-left shadow-lg transition-all hover:-translate-y-1 hover:shadow-xl"
            >
              <div className="absolute -right-8 -top-8 h-32 w-32 rounded-full bg-white/10 blur-2xl transition-all group-hover:bg-white/20"></div>
              <PhoneMissed className="h-8 w-8 text-white/90 mb-4" />
              <h3 className="text-lg font-bold text-white mb-1">부재건 자동 수집</h3>
              <p className="text-blue-100 text-sm line-clamp-2">
                부재중인 고객을 자동으로 수집하여 재발신 리스트를 생성합니다.
              </p>
              <div className="mt-4 flex items-center text-xs font-medium text-white/80">
                <span>새 배치 만들기</span>
                <Plus className="ml-1 h-3 w-3 transition-transform group-hover:translate-x-1" />
              </div>
            </button>

            <button 
              onClick={() => setActiveModal('excel')}
              className="group relative overflow-hidden rounded-2xl bg-gradient-to-br from-emerald-500 to-teal-600 p-6 text-left shadow-lg transition-all hover:-translate-y-1 hover:shadow-xl"
            >
              <div className="absolute -right-8 -top-8 h-32 w-32 rounded-full bg-white/10 blur-2xl transition-all group-hover:bg-white/20"></div>
              <FileSpreadsheet className="h-8 w-8 text-white/90 mb-4" />
              <h3 className="text-lg font-bold text-white mb-1">엑셀 업로드</h3>
              <p className="text-emerald-100 text-sm line-clamp-2">
                대량의 연락처를 포함한 엑셀 파일을 업로드하여 통화 리스트를 구성합니다.
              </p>
              <div className="mt-4 flex items-center text-xs font-medium text-white/80">
                <span>새 배치 만들기</span>
                <Plus className="ml-1 h-3 w-3 transition-transform group-hover:translate-x-1" />
              </div>
            </button>

            <button 
              onClick={() => setActiveModal('ocr')}
              className="group relative overflow-hidden rounded-2xl bg-gradient-to-br from-amber-500 to-orange-600 p-6 text-left shadow-lg transition-all hover:-translate-y-1 hover:shadow-xl"
            >
              <div className="absolute -right-8 -top-8 h-32 w-32 rounded-full bg-white/10 blur-2xl transition-all group-hover:bg-white/20"></div>
              <Camera className="h-8 w-8 text-white/90 mb-4" />
              <h3 className="text-lg font-bold text-white mb-1">이미지 OCR</h3>
              <p className="text-amber-100 text-sm line-clamp-2">
                명함 등의 이미지를 AI로 스캔하여 연락처를 자동 추출합니다.
              </p>
              <div className="mt-4 flex items-center text-xs font-medium text-white/80">
                <span>새 배치 만들기</span>
                <Plus className="ml-1 h-3 w-3 transition-transform group-hover:translate-x-1" />
              </div>
            </button>
          </div>

          {/* Batch Summary Stats */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <div className="bg-white dark:bg-gray-800 rounded-xl p-4 md:p-5 border border-gray-100 dark:border-gray-700 shadow-sm flex items-center gap-4">
              <div className="p-3 bg-blue-50 dark:bg-blue-900/30 rounded-lg text-blue-600 dark:text-blue-400">
                <BarChart3 className="w-5 h-5 md:w-6 md:h-6" />
              </div>
              <div>
                <p className="text-xs md:text-sm font-medium text-gray-500 dark:text-gray-400">전체 시도</p>
                <p className="text-xl md:text-2xl font-bold text-gray-900 dark:text-white">{todayStats.total}건</p>
              </div>
            </div>
            <div className="bg-white dark:bg-gray-800 rounded-xl p-4 md:p-5 border border-gray-100 dark:border-gray-700 shadow-sm flex items-center gap-4">
              <div className="p-3 bg-emerald-50 dark:bg-emerald-900/30 rounded-lg text-emerald-600 dark:text-emerald-400">
                <PhoneCall className="w-5 h-5 md:w-6 md:h-6" />
              </div>
              <div>
                <p className="text-xs md:text-sm font-medium text-gray-500 dark:text-gray-400">연결 성공</p>
                <p className="text-xl md:text-2xl font-bold text-gray-900 dark:text-white">{todayStats.connected}건</p>
              </div>
            </div>
            <div className="bg-white dark:bg-gray-800 rounded-xl p-4 md:p-5 border border-gray-100 dark:border-gray-700 shadow-sm flex items-center gap-4">
              <div className="p-3 bg-amber-50 dark:bg-amber-900/30 rounded-lg text-amber-600 dark:text-amber-400">
                <PhoneMissed className="w-5 h-5 md:w-6 md:h-6" />
              </div>
              <div>
                <p className="text-xs md:text-sm font-medium text-gray-500 dark:text-gray-400">부재중</p>
                <p className="text-xl md:text-2xl font-bold text-gray-900 dark:text-white">{todayStats.noAnswer}건</p>
              </div>
            </div>
            <div className="bg-white dark:bg-gray-800 rounded-xl p-4 md:p-5 border border-gray-100 dark:border-gray-700 shadow-sm flex items-center gap-4">
              <div className="p-3 bg-red-50 dark:bg-red-900/30 rounded-lg text-red-600 dark:text-red-400">
                <PhoneOff className="w-5 h-5 md:w-6 md:h-6" />
              </div>
              <div>
                <p className="text-xs md:text-sm font-medium text-gray-500 dark:text-gray-400">통화중/거절</p>
                <p className="text-xl md:text-2xl font-bold text-gray-900 dark:text-white">{todayStats.busy}건</p>
              </div>
            </div>
          </div>

          {/* Batch List Table */}
          <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 shadow-sm overflow-hidden flex flex-col">
            <div className="px-6 py-5 border-b border-gray-200 dark:border-gray-700 flex items-center justify-between">
              <h2 className="text-lg font-bold text-gray-900 dark:text-white">최근 배치 목록</h2>
            </div>
            <div className="overflow-x-auto">
              {batches.length === 0 ? (
                <div className="text-center py-12 text-gray-400 text-xs">
                  등록된 배치가 없습니다.
                </div>
              ) : (
                <table className="w-full text-left text-xs">
                  <thead className="bg-gray-50 dark:bg-gray-900 text-gray-500 font-semibold border-b border-gray-100 dark:border-gray-700">
                    <tr>
                      <th className="py-3 px-6">배치명</th>
                      <th className="py-3 px-4">진행 현황</th>
                      <th className="py-3 px-4">연결 성공</th>
                      <th className="py-3 px-4">부재</th>
                      <th className="py-3 px-6 text-right">관리</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-100 dark:divide-gray-700/60 font-medium">
                    {batches.map(batch => (
                      <tr key={batch.id} className="hover:bg-gray-50/50">
                        <td className="py-3.5 px-6 font-bold text-gray-900 dark:text-white">
                          {batch.name}
                        </td>
                        <td className="py-3.5 px-4 font-mono">
                          {batch.completedCount} / {batch.totalCount} ({batch.totalCount > 0 ? Math.round((batch.completedCount / batch.totalCount) * 100) : 0}%)
                        </td>
                        <td className="py-3.5 px-4 text-emerald-600 font-mono font-bold">
                          {batch.connectedCount}
                        </td>
                        <td className="py-3.5 px-4 text-amber-600 font-mono font-bold">
                          {batch.noAnswerCount}
                        </td>
                        <td className="py-3.5 px-6 text-right">
                          <button
                            type="button"
                            onClick={() => handleDeleteBatch(batch.id)}
                            className="text-red-500 hover:text-red-700"
                          >
                            <Trash2 size={14} />
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
            </div>
          </div>
        </div>
      )}

      {/* 모달 레이어 */}
      {isCampaignModalOpen && (
        <AutoDialCampaignModal
          isOpen={isCampaignModalOpen}
          onClose={() => setIsCampaignModalOpen(false)}
          onSuccess={() => {
            loadAllData();
            setMainTab('campaigns_v4');
          }}
          orgId={org?.orgId || ''}
          cases={cases}
          teamMembers={teamMembers}
          currentUserEmail={user?.email}
        />
      )}

      {activeModal === 'missed' && (
        <MissedCallBatchModal
          isOpen={true}
          onClose={() => setActiveModal(null)}
          onSuccess={() => {
            setActiveModal(null);
            loadAllData();
          }}
          cases={cases}
        />
      )}

      {activeModal === 'excel' && (
        <ExcelBatchModal
          isOpen={true}
          onClose={() => setActiveModal(null)}
          onCreated={() => {
            setActiveModal(null);
            loadAllData();
          }}
        />
      )}

      {activeModal === 'ocr' && (
        <OcrBatchModal
          isOpen={true}
          onClose={() => setActiveModal(null)}
          onCreated={() => {
            setActiveModal(null);
            loadAllData();
          }}
        />
      )}
    </div>
  );
};

export default AutoDialDashboard;
