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

  const handleDeleteCampaign = async (campaignId: string, name: string) => {
    if (!window.confirm(`'${name}' 캠페인을 삭제하시겠습니까? 관련 통화 이력과 배정이 해제됩니다.`)) return;
    try {
      await deleteCampaign(campaignId);
      showToast('캠페인이 삭제되었습니다.', 'success');
      loadAllData();
      if (activeCampaignId === campaignId) {
        setActiveCampaignId(null);
      }
    } catch (error) {
      showToast('캠페인 삭제에 실패했습니다.', 'error');
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
      <div className="max-w-[1600px] mx-auto">
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
      <div className="max-w-[1600px] mx-auto">
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
    <div className="max-w-[1600px] mx-auto space-y-6">
      {/* 1. 상단 타이틀 & 런처 바 */}
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 bg-card text-card-foreground p-5 sm:p-6 rounded-xl border border-border shadow-xs">
        <div>
          <div className="flex items-center gap-2 mb-1.5">
            <span className="text-2xs px-2 py-0.5 rounded font-mono font-medium bg-primary/10 text-primary border border-primary/20 flex items-center gap-1">
              <Sparkles size={11} strokeWidth={1.75} className="text-primary" />
              AUTO-DIALER v4.0
            </span>
            <span className="text-2xs text-muted-foreground font-medium">
              관리자 전용 캠페인 배정 & 실시간 플로어 관제탑
            </span>
          </div>
          <h1 className="text-xl sm:text-2xl font-bold tracking-tight text-foreground flex items-center gap-2.5">
            <PhoneCall className="w-6 h-6 text-primary" strokeWidth={1.75} />
            <span>오토콜 관제 센터</span>
          </h1>
          <p className="text-muted-foreground mt-0.5 text-xs max-w-xl leading-relaxed">
            상담원별 일일 타깃 DB 할당, 7초 연속 발신 템포 제어, 플로어 실시간 통화 현황을 중앙에서 관제합니다.
          </p>
        </div>

        {/* 액션 버튼 그룹 */}
        <div className="flex flex-wrap items-center gap-2 shrink-0">
          {/* 간편 콜 모드로 이동 안내 */}
          <button
            type="button"
            onClick={() => window.location.href = '#/lite'}
            className="h-8 px-3 bg-muted hover:bg-muted/80 text-foreground border border-border rounded-lg text-xs font-medium flex items-center gap-1.5 transition-colors cursor-pointer"
            title="상담원 간편 콜 & 오토콜 통합 워크스페이스로 이동"
          >
            <Zap size={13} strokeWidth={1.75} className="text-amber-500" />
            <span>간편콜 워크스페이스</span>
          </button>

          {/* 상담원: 오토콜 HUD 직접 시작 버튼 */}
          <button
            type="button"
            onClick={() => setViewMode('agent_hud')}
            className="h-8 px-3.5 bg-primary hover:bg-primary/90 text-primary-foreground rounded-lg text-xs font-medium shadow-2xs flex items-center gap-1.5 transition-colors cursor-pointer"
          >
            <Headphones size={14} strokeWidth={1.75} />
            <span>나의 오토콜 런타임</span>
          </button>

          {/* 관리자: 새 캠페인 생성 모달 버튼 */}
          {isAdmin && (
            <button
              type="button"
              onClick={() => setIsCampaignModalOpen(true)}
              className="h-8 px-3 bg-background hover:bg-muted text-foreground rounded-lg text-xs font-medium border border-border shadow-2xs flex items-center gap-1.5 transition-colors cursor-pointer"
            >
              <Plus size={13} strokeWidth={1.75} />
              <span>캠페인 생성</span>
            </button>
          )}

          <button
            type="button"
            onClick={loadAllData}
            disabled={loading}
            className="h-8 w-8 flex items-center justify-center bg-background hover:bg-muted rounded-lg text-foreground border border-border transition-colors cursor-pointer"
            title="새로고침"
          >
            <RefreshCw size={13} strokeWidth={1.75} className={loading ? 'animate-spin' : ''} />
          </button>
        </div>
      </div>

      {/* 2. 메인 네비게이션 탭 (Shadcn Segmented Control) */}
      <div className="bg-muted/70 p-1 rounded-lg border border-border/60 flex items-center gap-1">
        <button
          type="button"
          onClick={() => setMainTab('campaigns_v4')}
          className={`flex items-center gap-2 px-3.5 py-1.5 rounded-md text-xs font-medium transition-all ${
            mainTab === 'campaigns_v4'
              ? 'bg-background text-foreground shadow-2xs border border-border font-semibold'
              : 'text-muted-foreground hover:text-foreground hover:bg-background/40'
          }`}
        >
          <LayoutDashboard size={14} strokeWidth={1.75} />
          <span>캠페인 & 플로어 관제 (v4.0)</span>
          {campaigns.length > 0 && (
            <span className="px-1.5 py-0.2 rounded text-2xs font-mono bg-muted text-muted-foreground tabular-nums">
              {campaigns.length}
            </span>
          )}
        </button>

        <button
          type="button"
          onClick={() => setMainTab('batches_v1')}
          className={`flex items-center gap-2 px-3.5 py-1.5 rounded-md text-xs font-medium transition-all ${
            mainTab === 'batches_v1'
              ? 'bg-background text-foreground shadow-2xs border border-border font-semibold'
              : 'text-muted-foreground hover:text-foreground hover:bg-background/40'
          }`}
        >
          <FileSpreadsheet size={14} strokeWidth={1.75} />
          <span>간편 수동 배치 (v1.0 호환)</span>
          {batches.length > 0 && (
            <span className="px-1.5 py-0.2 rounded text-2xs font-mono bg-muted text-muted-foreground tabular-nums">
              {batches.length}
            </span>
          )}
        </button>
      </div>

      {/* 3-A. v4.0 캠페인 & 플로어 전광판 영역 */}
      {mainTab === 'campaigns_v4' && (
        <div className="space-y-6">
          {/* 캠페인 셀렉터 바 */}
          {campaigns.length > 0 ? (
            <div className="flex items-center gap-2 overflow-x-auto pb-1">
              <span className="text-2xs font-mono font-medium text-muted-foreground uppercase shrink-0">캠페인:</span>
              {campaigns.map(camp => {
                const isSelected = activeCampaignId === camp.id;
                return (
                  <button
                    key={camp.id}
                    type="button"
                    onClick={() => setActiveCampaignId(camp.id)}
                    className={`px-3 py-1.5 rounded-lg text-xs font-medium shrink-0 border transition-all flex items-center gap-2 ${
                      isSelected
                        ? 'bg-primary/10 border-primary/40 text-primary font-semibold shadow-2xs'
                        : 'bg-card border-border text-muted-foreground hover:text-foreground hover:border-border/80'
                    }`}
                  >
                    <span className={`w-1.5 h-1.5 rounded-full ${camp.status === 'running' ? 'bg-primary animate-pulse' : 'bg-muted-foreground/40'}`} />
                    <span>{camp.name}</span>
                    <span className="font-mono text-2xs text-muted-foreground tabular-nums">
                      ({camp.completedLeads}/{camp.totalLeads})
                    </span>
                    {isAdmin && (
                      <span
                        onClick={(e) => {
                          e.stopPropagation();
                          handleDeleteCampaign(camp.id, camp.name);
                        }}
                        className="hover:text-destructive p-0.5 rounded text-2xs"
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
            <div className="text-center py-12 bg-card rounded-xl border border-dashed border-border p-8 space-y-3">
              <div className="w-12 h-12 bg-primary/10 text-primary rounded-xl flex items-center justify-center mx-auto border border-primary/20">
                <PhoneCall size={22} strokeWidth={1.75} />
              </div>
              <h3 className="text-sm font-semibold text-foreground">
                등록된 오토콜 캠페인이 없습니다
              </h3>
              <p className="text-xs text-muted-foreground max-w-sm mx-auto leading-relaxed">
                상단의 <strong>[+ 캠페인 생성]</strong> 버튼을 눌러 오늘 투입할 리드와 상담원별 목표 콜수를 설정하세요.
              </p>
              {isAdmin && (
                <button
                  type="button"
                  onClick={() => setIsCampaignModalOpen(true)}
                  className="h-8 px-3.5 bg-primary text-primary-foreground rounded-lg text-xs font-medium hover:bg-primary/90 shadow-2xs transition-colors"
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
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <button 
              onClick={() => setActiveModal('missed')}
              className="p-5 text-left rounded-xl bg-card border border-border hover:border-primary/50 shadow-xs transition-all group"
            >
              <div className="w-10 h-10 rounded-lg bg-primary/10 text-primary border border-primary/20 flex items-center justify-center mb-3">
                <PhoneMissed className="h-5 w-5" strokeWidth={1.75} />
              </div>
              <h3 className="text-sm font-semibold text-foreground mb-1">부재건 자동 수집</h3>
              <p className="text-muted-foreground text-xs leading-relaxed line-clamp-2">
                부재중인 고객을 자동으로 수집하여 재발신 리스트를 생성합니다.
              </p>
              <div className="mt-3 flex items-center text-xs font-medium text-primary">
                <span>새 배치 만들기</span>
                <Plus className="ml-1 h-3.5 w-3.5 transition-transform group-hover:translate-x-0.5" strokeWidth={1.75} />
              </div>
            </button>

            <button 
              onClick={() => setActiveModal('excel')}
              className="p-5 text-left rounded-xl bg-card border border-border hover:border-primary/50 shadow-xs transition-all group"
            >
              <div className="w-10 h-10 rounded-lg bg-primary/10 text-primary border border-primary/20 flex items-center justify-center mb-3">
                <FileSpreadsheet className="h-5 w-5" strokeWidth={1.75} />
              </div>
              <h3 className="text-sm font-semibold text-foreground mb-1">엑셀 업로드</h3>
              <p className="text-muted-foreground text-xs leading-relaxed line-clamp-2">
                대량의 연락처를 포함한 엑셀 파일을 업로드하여 통화 리스트를 구성합니다.
              </p>
              <div className="mt-3 flex items-center text-xs font-medium text-primary">
                <span>새 배치 만들기</span>
                <Plus className="ml-1 h-3.5 w-3.5 transition-transform group-hover:translate-x-0.5" strokeWidth={1.75} />
              </div>
            </button>

            <button 
              onClick={() => setActiveModal('ocr')}
              className="p-5 text-left rounded-xl bg-card border border-border hover:border-primary/50 shadow-xs transition-all group"
            >
              <div className="w-10 h-10 rounded-lg bg-primary/10 text-primary border border-primary/20 flex items-center justify-center mb-3">
                <Camera className="h-5 w-5" strokeWidth={1.75} />
              </div>
              <h3 className="text-sm font-semibold text-foreground mb-1">이미지 OCR</h3>
              <p className="text-muted-foreground text-xs leading-relaxed line-clamp-2">
                명함 등의 이미지를 AI로 스캔하여 연락처를 자동 추출합니다.
              </p>
              <div className="mt-3 flex items-center text-xs font-medium text-primary">
                <span>새 배치 만들기</span>
                <Plus className="ml-1 h-3.5 w-3.5 transition-transform group-hover:translate-x-0.5" strokeWidth={1.75} />
              </div>
            </button>
          </div>

          {/* Batch Summary Stats */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <div className="bg-card text-card-foreground rounded-xl p-4 border border-border shadow-xs flex items-center gap-3.5">
              <div className="w-10 h-10 rounded-lg bg-primary/10 text-primary border border-primary/20 flex items-center justify-center shrink-0">
                <BarChart3 className="w-5 h-5" strokeWidth={1.75} />
              </div>
              <div>
                <p className="text-2xs font-medium text-muted-foreground">전체 시도</p>
                <p className="text-lg font-bold text-foreground font-mono tabular-nums">{todayStats.total}건</p>
              </div>
            </div>

            <div className="bg-card text-card-foreground rounded-xl p-4 border border-border shadow-xs flex items-center gap-3.5">
              <div className="w-10 h-10 rounded-lg bg-primary/10 text-primary border border-primary/20 flex items-center justify-center shrink-0">
                <PhoneCall className="w-5 h-5" strokeWidth={1.75} />
              </div>
              <div>
                <p className="text-2xs font-medium text-muted-foreground">연결 성공</p>
                <p className="text-lg font-bold text-primary font-mono tabular-nums">{todayStats.connected}건</p>
              </div>
            </div>

            <div className="bg-card text-card-foreground rounded-xl p-4 border border-border shadow-xs flex items-center gap-3.5">
              <div className="w-10 h-10 rounded-lg bg-amber-500/10 text-amber-500 border border-amber-500/20 flex items-center justify-center shrink-0">
                <PhoneMissed className="w-5 h-5" strokeWidth={1.75} />
              </div>
              <div>
                <p className="text-2xs font-medium text-muted-foreground">부재중</p>
                <p className="text-lg font-bold text-amber-500 font-mono tabular-nums">{todayStats.noAnswer}건</p>
              </div>
            </div>

            <div className="bg-card text-card-foreground rounded-xl p-4 border border-border shadow-xs flex items-center gap-3.5">
              <div className="w-10 h-10 rounded-lg bg-destructive/10 text-destructive border border-destructive/20 flex items-center justify-center shrink-0">
                <PhoneOff className="w-5 h-5" strokeWidth={1.75} />
              </div>
              <div>
                <p className="text-2xs font-medium text-muted-foreground">통화중/거절</p>
                <p className="text-lg font-bold text-destructive font-mono tabular-nums">{todayStats.busy}건</p>
              </div>
            </div>
          </div>

          {/* Batch List Table */}
          <div className="bg-card rounded-xl border border-border shadow-xs overflow-hidden flex flex-col">
            <div className="px-5 py-3.5 border-b border-border flex items-center justify-between">
              <h2 className="text-sm font-semibold text-foreground">최근 배치 목록</h2>
            </div>
            <div className="overflow-x-auto">
              {batches.length === 0 ? (
                <div className="text-center py-12 text-muted-foreground text-xs">
                  등록된 배치가 없습니다.
                </div>
              ) : (
                <table className="w-full text-left text-xs">
                  <thead className="bg-muted/60 text-muted-foreground font-medium border-b border-border text-2xs">
                    <tr>
                      <th className="py-2.5 px-5">배치명</th>
                      <th className="py-2.5 px-4">진행 현황</th>
                      <th className="py-2.5 px-4">연결 성공</th>
                      <th className="py-2.5 px-4">부재</th>
                      <th className="py-2.5 px-5 text-right">관리</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-border">
                    {batches.map(batch => (
                      <tr key={batch.id} className="hover:bg-muted/30 transition-colors">
                        <td className="py-3 px-5 font-medium text-foreground">
                          {batch.name}
                        </td>
                        <td className="py-3 px-4 font-mono text-muted-foreground tabular-nums">
                          {batch.completedCount} / {batch.totalCount} ({batch.totalCount > 0 ? Math.round((batch.completedCount / batch.totalCount) * 100) : 0}%)
                        </td>
                        <td className="py-3 px-4 text-primary font-mono font-medium tabular-nums">
                          {batch.connectedCount}
                        </td>
                        <td className="py-3 px-4 text-amber-500 font-mono font-medium tabular-nums">
                          {batch.noAnswerCount}
                        </td>
                        <td className="py-3 px-5 text-right">
                          <button
                            type="button"
                            onClick={() => handleDeleteBatch(batch.id)}
                            className="text-muted-foreground hover:text-destructive p-1 rounded transition-colors"
                          >
                            <Trash2 size={13} strokeWidth={1.75} />
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
