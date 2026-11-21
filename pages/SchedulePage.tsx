import React, { useState, useEffect, useMemo } from 'react';
import { useCases, usePartners } from '../services/queries';
import { useAuth } from '../contexts/AuthContext';
import { fetchSettlementBatches, fetchExpenses } from '../services/api';
import { SettlementBatch, ExpenseItem } from '../types';

import { ScheduleRoleViewSwitcher, ScheduleViewMode } from '../components/schedule/ScheduleRoleViewSwitcher';
import { ExecutiveHybridAllInOneView } from '../components/schedule/ExecutiveHybridAllInOneView';
import { ExecutiveFinancialView } from '../components/schedule/ExecutiveFinancialView';
import { OperationsMasterView } from '../components/schedule/OperationsMasterView';
import { TeamSupervisionView } from '../components/schedule/TeamSupervisionView';
import { PersonalSalesView } from '../components/schedule/PersonalSalesView';

export default function SchedulePage() {
  const { data: cases = [], isLoading: isLoadingCases } = useCases();
  const { data: partners = [] } = usePartners();
  const { org, isPlatformAdmin } = useAuth();

  const [selectedDate, setSelectedDate] = useState<Date>(new Date());
  const [batches, setBatches] = useState<SettlementBatch[]>([]);
  const [expenses, setExpenses] = useState<ExpenseItem[]>([]);

  // 비동기 정산 배치 및 비용 데이터 조회 (대표/관리자 뷰 보강용)
  useEffect(() => {
    let isMounted = true;
    const loadSettlementData = async () => {
      try {
        const [bRes, eRes] = await Promise.allSettled([
          fetchSettlementBatches(),
          fetchExpenses()
        ]);
        if (isMounted) {
          if (bRes.status === 'fulfilled' && Array.isArray(bRes.value)) {
            setBatches(bRes.value);
          }
          if (eRes.status === 'fulfilled' && Array.isArray(eRes.value)) {
            setExpenses(eRes.value);
          }
        }
      } catch {
        // 비회원 또는 네트워크 실패 시 기본값 유지
      }
    };
    loadSettlementData();
    return () => {
      isMounted = false;
    };
  }, []);

  // 기본 권장 뷰 모드 결정
  const defaultMode = useMemo<ScheduleViewMode>(() => {
    const saved = localStorage.getItem('lm_schedule_active_mode') as ScheduleViewMode | null;
    
    // 대표 또는 플랫폼 호스트
    if (isPlatformAdmin || org?.role === 'owner') {
      const validModes: ScheduleViewMode[] = ['all_in_one', 'financial', 'operations', 'personal'];
      if (saved && validModes.includes(saved)) return saved;
      return 'all_in_one'; // 대표 겸직 올인원 기본
    }

    // 센터장 / 총괄 관리자
    if (org?.role === 'admin') {
      const validModes: ScheduleViewMode[] = ['operations', 'team', 'personal'];
      if (saved && validModes.includes(saved)) return saved;
      return 'operations';
    }

    // 일반 관리자 / 팀장 (Tier 1 이상)
    if (org?.adminPermissions?.tier && org.adminPermissions.tier >= 1) {
      const validModes: ScheduleViewMode[] = ['team', 'personal'];
      if (saved && validModes.includes(saved)) return saved;
      return 'team';
    }

    // 전문 상담원
    return 'personal';
  }, [org?.role, org?.adminPermissions?.tier, isPlatformAdmin]);

  const [activeMode, setActiveMode] = useState<ScheduleViewMode>(defaultMode);

  // 직급 권한 변경 시 모드 보정
  useEffect(() => {
    setActiveMode(defaultMode);
  }, [defaultMode]);

  const handleModeChange = (mode: ScheduleViewMode) => {
    setActiveMode(mode);
    localStorage.setItem('lm_schedule_active_mode', mode);
  };

  if (isLoadingCases) {
    return (
      <div className="max-w-[1600px] mx-auto flex justify-center items-center h-64">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-indigo-600"></div>
      </div>
    );
  }

  return (
    <div className="max-w-[1600px] mx-auto space-y-6 pb-12">
      {/* 1. 상단 직급 맞춤형 뷰 스위처 (Role-Adaptive View Switcher) */}
      <ScheduleRoleViewSwitcher
        role={org?.role}
        isPlatformAdmin={isPlatformAdmin}
        adminTier={org?.adminPermissions?.tier}
        activeMode={activeMode}
        onChangeMode={handleModeChange}
        teamName={org?.teamName}
      />

      {/* 2. 활성화된 직급별 맞춤 뷰 렌더링 */}
      {activeMode === 'all_in_one' && (
        <ExecutiveHybridAllInOneView
          cases={cases}
          partners={partners}
          batches={batches}
          expenses={expenses}
          onSelectDate={setSelectedDate}
        />
      )}

      {activeMode === 'financial' && (
        <ExecutiveFinancialView
          cases={cases}
          partners={partners}
          batches={batches}
          expenses={expenses}
          onSelectDate={setSelectedDate}
        />
      )}

      {activeMode === 'operations' && (
        <OperationsMasterView
          cases={cases}
          onSelectDate={setSelectedDate}
        />
      )}

      {activeMode === 'team' && (
        <TeamSupervisionView
          cases={cases}
          currentTeamName={org?.teamName || '영업 1팀'}
          onSelectDate={setSelectedDate}
        />
      )}

      {activeMode === 'personal' && (
        <PersonalSalesView
          cases={cases}
          selectedDate={selectedDate}
          onSelectDate={setSelectedDate}
          filterAssignee={org?.role === 'agent' ? org?.displayName : undefined}
        />
      )}
    </div>
  );
}
