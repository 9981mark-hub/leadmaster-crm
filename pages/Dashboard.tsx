import React, { useEffect, useState, useMemo } from 'react';
import { format } from 'date-fns';
import { ko } from 'date-fns/locale';
import { fetchCases, fetchPartners, fetchSettlementBatches, subscribe, getSyncStatus, refreshData } from '../services/api';
import { Case, Partner, ReminderItem, SettlementBatch } from '../types';
import { getCaseWarnings, getReminderStatus } from '../utils';
import { Link } from 'react-router-dom';
import { AlertCircle, Clock, X } from 'lucide-react';
import CalendarWidget from '../components/CalendarWidget';
import { MonthlyTrendChart, StatusPieChart } from '../components/DashboardCharts';
import { useTheme } from '../contexts/ThemeContext';
import { motion } from 'framer-motion';
import { CardSkeleton } from '../components/Skeleton';
import AiUsageWidget from '../components/AiUsageWidget';
import { fetchDetailedAiUsage, DetailedAiUsage } from '../services/aiUsage';
import { useAuth } from '../contexts/AuthContext';
import { fetchTeamMembers, TeamMember } from '../services/team';

// 직급별 신설 대시보드 컴포넌트
import DashboardModeSwitcher, { OwnerDashboardMode } from '../components/dashboard/DashboardModeSwitcher';
import AgentDashboardView from '../components/dashboard/AgentDashboardView';
import ManagerDashboardView from '../components/dashboard/ManagerDashboardView';
import OwnerDashboardView from '../components/dashboard/OwnerDashboardView';
import HybridDashboardView from '../components/dashboard/HybridDashboardView';

export default function Dashboard() {
  const { theme } = useTheme();
  const { isAdmin, isPlatformAdmin, org, user } = useAuth();
  const [cases, setCases] = useState<Case[]>([]);
  const [teamMembers, setTeamMembers] = useState<TeamMember[]>([]);
  const [selectedMemberId, setSelectedMemberId] = useState<string>('all');
  const [partners, setPartners] = useState<Partner[]>([]);
  const [batches, setBatches] = useState<SettlementBatch[]>([]);
  const [loading, setLoading] = useState(true);

  // 캘린더 날짜 상태
  const [selectedDate, setSelectedDate] = useState(new Date());

  // 지연 리마인더 및 조치 필요 모달
  const [showOverdueModal, setShowOverdueModal] = useState(false);
  const [showWarningModal, setShowWarningModal] = useState(false);
  const [aiUsageSummary, setAiUsageSummary] = useState<DetailedAiUsage | null>(null);

  // 직급 판별: 대표(owner), 팀장(admin), 일반 상담원(agent)
  const role = org?.role || 'agent';
  const isOwner = role === 'owner';
  const isManager = role === 'admin';

  // 대표 전용 뷰 모드 스위처 (기본값: 'hybrid' 올인원 겸직 모드)
  const [ownerMode, setOwnerMode] = useState<OwnerDashboardMode>(() => {
    const saved = localStorage.getItem('lm_owner_dashboard_view_mode') as OwnerDashboardMode;
    return saved || 'hybrid';
  });

  const handleOwnerModeChange = (mode: OwnerDashboardMode) => {
    setOwnerMode(mode);
    try {
      localStorage.setItem('lm_owner_dashboard_view_mode', mode);
    } catch {
      // 로컬스토리지 예외 방어
    }
  };

  useEffect(() => {
    if (isPlatformAdmin) {
      fetchDetailedAiUsage().then(res => setAiUsageSummary(res)).catch(() => {});
    }
  }, [isPlatformAdmin]);

  useEffect(() => {
    if (isAdmin && org?.orgId) {
      fetchTeamMembers().then(setTeamMembers).catch(() => setTeamMembers([]));
    }
  }, [isAdmin, org?.orgId]);

  const loadAllData = () => {
    Promise.all([fetchCases(), fetchPartners(), fetchSettlementBatches()]).then(([data, partnerData, batchData]) => {
      setCases(data);
      setPartners(partnerData);
      setBatches(batchData);
      setLoading(false);
    });
  };

  useEffect(() => {
    loadAllData();
  }, []);

  // 백그라운드 데이터 변경 구독
  useEffect(() => {
    const unsubscribe = subscribe(() => {
      loadAllData();
      if (isAdmin && org?.orgId) {
        fetchTeamMembers().then(setTeamMembers).catch(() => {});
      }
    });
    return () => unsubscribe();
  }, [isAdmin, org?.orgId]);

  // 본인 배정 리드 판별자 (상담원 기준)
  const isMyCase = useMemo(() => {
    return (c: Case) => {
      if (c.assignedUserId) return c.assignedUserId === org?.userId;
      if (org?.displayName && c.managerName) return c.managerName === org.displayName;
      return false;
    };
  }, [org?.userId, org?.displayName]);

  // 본인 케이스 목록
  const myCases = useMemo(() => {
    return cases.filter(isMyCase);
  }, [cases, isMyCase]);

  // 미배정 리드 건수 (대표 스위처 뱃지용)
  const unassignedCount = useMemo(() => {
    return cases.filter(c => !c.assignedUserId && c.status !== '휴지통' && !c.deletedAt).length;
  }, [cases]);

  // 차트 표시용 케이스
  const chartCases = useMemo(() => {
    if (!isAdmin && !isOwner) return myCases;
    if (selectedMemberId === 'all') return cases;
    if (selectedMemberId === 'unassigned') return cases.filter(c => !c.assignedUserId);
    return cases.filter(c => c.assignedUserId === selectedMemberId);
  }, [cases, myCases, isAdmin, isOwner, selectedMemberId]);

  // 활성 케이스
  const activeCases = useMemo(() => {
    return (isAdmin || isOwner ? cases : myCases).filter(c => c.status !== '휴지통' && !c.deletedAt);
  }, [cases, myCases, isAdmin, isOwner]);

  const allRemindersWithCase = useMemo(() => {
    return activeCases.flatMap(c =>
      (c.reminders || []).map(r => ({ reminder: r, caseData: c }))
    );
  }, [activeCases]);

  // 지연 리마인더 목록 (모달용)
  const thirtyDaysAgo = useMemo(() => {
    const d = new Date();
    d.setDate(d.getDate() - 30);
    return d;
  }, []);

  const overdueReminders = useMemo(() => {
    return allRemindersWithCase.filter(item => {
      if (getReminderStatus(item.reminder.datetime) !== 'overdue') return false;
      if (item.reminder.resultStatus || item.reminder.isCompleted) return false;
      if (item.reminder.datetime) {
        const reminderDate = new Date(item.reminder.datetime.replace(' ', 'T'));
        if (!isNaN(reminderDate.getTime()) && reminderDate < thirtyDaysAgo) return false;
      }
      return true;
    });
  }, [allRemindersWithCase, thirtyDaysAgo]);

  // 경고 케이스 목록 (모달용)
  const warningCasesWithDetails = useMemo(() => {
    return activeCases.map(c => {
      const partner = partners.find(p => p.partnerId === c.partnerId);
      const warnings = getCaseWarnings(c, partner);
      return { caseData: c, warnings };
    }).filter(item => item.warnings.length > 0);
  }, [activeCases, partners]);

  if (loading) {
    return (
      <div className="max-w-7xl mx-auto space-y-6 pt-6">
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <CardSkeleton />
          <CardSkeleton />
          <CardSkeleton />
          <CardSkeleton />
        </div>
        <div className="h-64 glass-panel rounded-xl" />
      </div>
    );
  }

  return (
    <motion.div
      initial={{ opacity: 0, y: 15 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.35 }}
      className="space-y-6 max-w-7xl mx-auto pb-6"
    >
      {/* 최상단 타이틀 & 동기화 상태 */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
        <div>
          <h2 className="text-2xl font-bold tracking-tight text-foreground flex items-center gap-2">
            <span>대시보드</span>
            {isOwner && (
              <span className="text-xs px-2.5 py-0.5 rounded-md bg-amber-500/10 text-amber-600 dark:text-amber-400 font-semibold border border-amber-500/20">
                TM 대표 계정
              </span>
            )}
            {isManager && (
              <span className="text-xs px-2.5 py-0.5 rounded-md bg-primary/10 text-primary font-semibold border border-primary/20">
                중간 관리자(팀장) 계정
              </span>
            )}
            {!isOwner && !isManager && (
              <span className="text-xs px-2.5 py-0.5 rounded-md bg-primary/10 text-primary font-semibold border border-primary/20">
                상담원 계정
              </span>
            )}
          </h2>
          {(!isOwner || isManager) && (
            <p className="text-xs text-muted-foreground mt-0.5">
              {org?.name ? `${org.name} · ` : ''}
              {isManager ? '실시간 플로어 모니터링 및 리드 관제' : '개인 상담 리마인더 및 인센티브 달성'}
            </p>
          )}
        </div>

        {/* 동기화 실패 시 재시도 버튼 */}
        {getSyncStatus().status !== 'ok' && (
          <div className="flex items-center gap-2 p-2 bg-amber-500/10 border border-amber-500/20 rounded-lg text-xs text-amber-700 dark:text-amber-300">
            <AlertCircle size={15} strokeWidth={1.75} />
            <span>동기화 지연</span>
            <button onClick={() => refreshData()} className="px-2 py-0.5 bg-amber-600 hover:bg-amber-700 text-white rounded font-medium">
              재시도
            </button>
          </div>
        )}
      </div>

      {/* 👑 대표(Owner) 전용: 스마트 뷰 모드 스위처 */}
      {isOwner && (
        <DashboardModeSwitcher
          currentMode={ownerMode}
          onChange={handleOwnerModeChange}
          unassignedCount={unassignedCount}
        />
      )}

      {/* 직급 및 선택 모드에 따른 뷰 컴포넌트 렌더링 */}
      {(() => {
        // 1. 대표(Owner) 분기
        if (isOwner) {
          if (ownerMode === 'owner') {
            return (
              <OwnerDashboardView
                cases={cases}
                partners={partners}
                batches={batches}
                teamMembers={teamMembers}
              />
            );
          }
          if (ownerMode === 'manager') {
            return (
              <ManagerDashboardView
                cases={cases}
                teamMembers={teamMembers}
                partners={partners}
                onRefreshCases={loadAllData}
                onShowOverdueModal={() => setShowOverdueModal(true)}
                onShowWarningModal={() => setShowWarningModal(true)}
              />
            );
          }
          if (ownerMode === 'agent') {
            return (
              <AgentDashboardView
                myCases={myCases}
                allCasesCount={cases.length}
                onShowOverdueModal={() => setShowOverdueModal(true)}
                onShowWarningModal={() => setShowWarningModal(true)}
                selectedDate={selectedDate}
                onSelectDate={setSelectedDate}
                userName={org?.displayName || user?.displayName || '대표'}
                isOwner={true}
              />
            );
          }
          // 기본값: hybrid (올인원 통합 뷰 - 추천)
          return (
            <HybridDashboardView
              cases={cases}
              partners={partners}
              batches={batches}
              teamMembers={teamMembers}
              onRefreshCases={loadAllData}
              onShowOverdueModal={() => setShowOverdueModal(true)}
              onShowWarningModal={() => setShowWarningModal(true)}
            />
          );
        }

        // 2. 중간 관리자(Admin/팀장) 분기
        if (isManager) {
          return (
            <ManagerDashboardView
              cases={cases}
              teamMembers={teamMembers}
              partners={partners}
              onRefreshCases={loadAllData}
              onShowOverdueModal={() => setShowOverdueModal(true)}
              onShowWarningModal={() => setShowWarningModal(true)}
            />
          );
        }

        // 3. 일반 상담원(Agent) 분기
        return (
          <AgentDashboardView
            myCases={myCases}
            allCasesCount={cases.length}
            onShowOverdueModal={() => setShowOverdueModal(true)}
            onShowWarningModal={() => setShowWarningModal(true)}
            selectedDate={selectedDate}
            onSelectDate={setSelectedDate}
            userName={org?.displayName || user?.displayName || '상담원'}
            isOwner={false}
          />
        );
      })()}

      {/* 최고관리자(HOST HQ) 전용: Gemini AI 실시간 사용량 위젯 */}
      {isPlatformAdmin && <AiUsageWidget />}

      {/* 공통 영업 현황 차트 섹션 */}
      <div className="space-y-3 pt-2">
        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-2">
          <div className="flex items-center gap-3">
            <h3 className="text-sm font-semibold text-foreground">
              영업 추이 및 상태 분포
            </h3>
            {(isAdmin || isOwner) && teamMembers.length > 0 && (
              <div className="flex items-center gap-1.5 text-xs">
                <span className="text-muted-foreground">조회 대상:</span>
                <select
                  value={selectedMemberId}
                  onChange={e => setSelectedMemberId(e.target.value)}
                  className="h-8 px-2.5 py-1 text-xs rounded-lg border border-border bg-card text-foreground font-medium shadow-xs focus:outline-none focus:ring-1 focus:ring-ring"
                >
                  <option value="all">전체 상담원 (전사 통합)</option>
                  <option value="unassigned">미배정 리드</option>
                  {teamMembers.filter(m => m.status === 'active').map(m => (
                    <option key={m.userId} value={m.userId}>
                      {m.displayName}
                    </option>
                  ))}
                </select>
              </div>
            )}
            {!isAdmin && !isOwner && (
              <span className="text-xs px-2.5 py-1 rounded-md bg-muted text-foreground font-medium border border-border">
                내 배정 리드 기준
              </span>
            )}
          </div>
          {(isAdmin || isOwner) && (
            <Link
              to="/statistics"
              className="text-xs text-primary hover:underline font-medium flex items-center gap-1"
            >
              상세 통계 센터 바로가기 →
            </Link>
          )}
        </div>
        <div className="grid md:grid-cols-2 gap-6">
          <MonthlyTrendChart cases={chartCases} isDark={theme === 'dark'} />
          <StatusPieChart cases={chartCases} isDark={theme === 'dark'} />
        </div>
      </div>

      {/* 캘린더 위젯 섹션 */}
      <div>
        <CalendarWidget
          cases={isOwner || isManager ? cases : myCases}
          batches={batches}
          partners={partners}
          selectedDate={selectedDate}
          onDateSelect={setSelectedDate}
        />
      </div>

      {/* 지연된 리마인더 상세 모달 */}
      {showOverdueModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-xs" onClick={() => setShowOverdueModal(false)}>
          <div className="bg-card border border-border rounded-xl shadow-xl w-full max-w-lg mx-4 max-h-[80vh] flex flex-col overflow-hidden" onClick={e => e.stopPropagation()}>
            <div className="flex items-center justify-between p-4 border-b border-border bg-destructive/10">
              <h3 className="font-semibold text-destructive flex items-center gap-2 text-sm">
                <Clock size={16} strokeWidth={1.75} />
                지연된 리마인더 ({overdueReminders.length}건)
              </h3>
              <button onClick={() => setShowOverdueModal(false)} className="p-1 hover:bg-destructive/20 text-destructive rounded-lg transition-colors">
                <X size={16} strokeWidth={1.75} />
              </button>
            </div>

            <div className="flex-1 overflow-y-auto p-4">
              {overdueReminders.length === 0 ? (
                <div className="text-center text-muted-foreground text-xs py-8">
                  지연된 리마인더가 없습니다.
                </div>
              ) : (
                <div className="space-y-2">
                  {overdueReminders.map(item => (
                    <Link
                      key={item.reminder.id}
                      to={`/case/${item.caseData.caseId}`}
                      onClick={() => setShowOverdueModal(false)}
                      className="block p-3 bg-muted/30 hover:bg-muted border border-border rounded-lg transition-colors"
                    >
                      <div className="flex items-center justify-between">
                        <div>
                          <div className="flex items-center gap-2">
                            <span className="font-semibold text-xs text-foreground">{item.caseData.customerName}</span>
                            <span className="text-xs text-muted-foreground">|</span>
                            <span className="text-xs text-muted-foreground tabular-nums">{item.caseData.phone}</span>
                          </div>
                          <div className="text-xs text-destructive mt-1 font-medium tabular-nums">
                            📅 {item.reminder.datetime}
                          </div>
                          {item.reminder.content && (
                            <div className="text-xs text-muted-foreground mt-1 truncate max-w-[300px]">
                              {item.reminder.content}
                            </div>
                          )}
                        </div>
                        <span className="text-xs bg-destructive/10 text-destructive border border-destructive/20 px-2 py-0.5 rounded-md font-semibold">
                          지연
                        </span>
                      </div>
                    </Link>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* 조치 필요 케이스 상세 모달 */}
      {showWarningModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-xs" onClick={() => setShowWarningModal(false)}>
          <div className="bg-card border border-border rounded-xl shadow-xl w-full max-w-lg mx-4 max-h-[80vh] flex flex-col overflow-hidden" onClick={e => e.stopPropagation()}>
            <div className="flex items-center justify-between p-4 border-b border-border bg-amber-500/10">
              <h3 className="font-semibold text-amber-600 dark:text-amber-400 flex items-center gap-2 text-sm">
                <AlertCircle size={16} strokeWidth={1.75} />
                조치 필요 케이스 ({warningCasesWithDetails.length}건)
              </h3>
              <button onClick={() => setShowWarningModal(false)} className="p-1 hover:bg-amber-500/20 text-amber-600 dark:text-amber-400 rounded-lg transition-colors">
                <X size={16} strokeWidth={1.75} />
              </button>
            </div>

            <div className="flex-1 overflow-y-auto p-4">
              {warningCasesWithDetails.length === 0 ? (
                <div className="text-center text-muted-foreground text-xs py-8">
                  조치가 필요한 케이스가 없습니다.
                </div>
              ) : (
                <div className="space-y-2">
                  {warningCasesWithDetails.map(item => (
                    <Link
                      key={item.caseData.caseId}
                      to={`/case/${item.caseData.caseId}`}
                      onClick={() => setShowWarningModal(false)}
                      className="block p-3 bg-muted/30 hover:bg-muted border border-border rounded-lg transition-colors"
                    >
                      <div className="flex items-start justify-between gap-2">
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2">
                            <span className="font-semibold text-xs text-foreground">{item.caseData.customerName}</span>
                            <span className="text-xs text-muted-foreground">|</span>
                            <span className="text-xs text-muted-foreground tabular-nums">{item.caseData.phone}</span>
                          </div>
                          <div className="text-xs text-muted-foreground mt-1">
                            {item.caseData.status}
                          </div>
                          <div className="flex flex-wrap gap-1 mt-2">
                            {item.warnings.map((warning, idx) => (
                              <span key={idx} className="text-xs bg-amber-500/10 text-amber-600 dark:text-amber-400 border border-amber-500/20 px-2 py-0.5 rounded-md font-medium">
                                ⚠ {warning}
                              </span>
                            ))}
                          </div>
                        </div>
                        <span className="text-xs text-muted-foreground mt-1">→</span>
                      </div>
                    </Link>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </motion.div>
  );
}
