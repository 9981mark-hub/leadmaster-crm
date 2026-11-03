import React, { useState, useEffect, useMemo, useCallback } from 'react';
import {
  PhoneCall, Sparkles, Clock, Calendar, User, Search, Filter,
  RefreshCw, Play, FileText, ChevronRight, CheckCircle2, AlertCircle,
  ExternalLink, ShieldCheck, ChevronLeft, Award, HelpCircle, PhoneIncoming, PhoneOutgoing
} from 'lucide-react';
import { useQuery } from '@tanstack/react-query';
import { fetchCases } from '../../services/api';
import { TeamMember, fetchTeamMembers } from '../../services/team';
import {
  CallAuditFilter, CallAuditType, TeamCallAuditItem, TeamCallAuditStats,
  fetchTeamCallAudits, fmtDuration, getKstDateRange
} from '../../services/teamCallAudit';
import { TeamCallDetailModal } from './TeamCallDetailModal';
import { useNavigate } from 'react-router-dom';

interface TeamCallAuditPanelProps {
  members?: TeamMember[];
}

export default function TeamCallAuditPanel({ members: initialMembers }: TeamCallAuditPanelProps) {
  const navigate = useNavigate();

  // 필터 상태 (기본값: 오늘 + 의미있는 상담만)
  const [filter, setFilter] = useState<CallAuditFilter>({
    preset: 'today',
    auditType: 'meaningful_only',
    userId: 'all',
    minDurationSec: 0,
    searchKeyword: '',
  });

  const [customDateInput, setCustomDateInput] = useState<string>(() => {
    const d = new Date();
    return d.toISOString().split('T')[0];
  });

  // 데이터 상태
  const [items, setItems] = useState<TeamCallAuditItem[]>([]);
  const [stats, setStats] = useState<TeamCallAuditStats>({
    totalCalls: 0,
    meaningfulCalls: 0,
    meaningfulRate: 0,
    appointmentCalls: 0,
    totalDurationSec: 0,
    avgDurationSec: 0,
  });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // 모달 상세 보기 상태
  const [selectedItem, setSelectedItem] = useState<TeamCallAuditItem | null>(null);

  // 페이지네이션 (페이지당 20건)
  const [page, setPage] = useState(1);
  const PAGE_SIZE = 20;

  // 전체 케이스 데이터 (고객명/상태 매핑)
  const { data: allCases = [] } = useQuery({
    queryKey: ['cases'],
    queryFn: fetchCases,
    staleTime: 60_000,
  });

  // 멤버 목록
  const [teamMembers, setTeamMembers] = useState<TeamMember[]>(initialMembers || []);
  useEffect(() => {
    if (initialMembers && initialMembers.length > 0) {
      setTeamMembers(initialMembers);
    } else {
      fetchTeamMembers()
        .then(setTeamMembers)
        .catch(err => console.warn('[TeamCallAudit] fetchTeamMembers error:', err));
    }
  }, [initialMembers]);

  // 데이터 로드
  const loadData = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const activeFilter = {
        ...filter,
        customDate: filter.preset === 'custom' ? customDateInput : undefined,
      };
      const res = await fetchTeamCallAudits(activeFilter, allCases, teamMembers);
      setItems(res.items);
      setStats(res.stats);
      setPage(1); // 필터 변경 시 첫 페이지로 리셋
    } catch (err: any) {
      console.error('[TeamCallAudit] load error:', err);
      setError(err?.message || '통화 데이터를 불러오지 못했습니다.');
    } finally {
      setLoading(false);
    }
  }, [filter, customDateInput, allCases, teamMembers]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  // 페이징 계산
  const totalPages = Math.max(1, Math.ceil(items.length / PAGE_SIZE));
  const paginatedItems = useMemo(() => {
    const start = (page - 1) * PAGE_SIZE;
    return items.slice(start, start + PAGE_SIZE);
  }, [items, page]);

  return (
    <div className="space-y-6">
      
      {/* 1. 상단 안내 및 필터 컨트롤 바 */}
      <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 shadow-sm p-4 md:p-5 space-y-4">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-2">
            <span className="p-2 rounded-xl bg-purple-100 text-purple-700 dark:bg-purple-950 dark:text-purple-300">
              <PhoneCall size={20} />
            </span>
            <div>
              <h2 className="text-lg font-bold text-gray-900 dark:text-white flex items-center gap-2">
                콜 활동 · AI 요약 및 대화록 모니터링
                <span className="px-2 py-0.5 text-xs font-semibold rounded-full bg-purple-100 text-purple-700 dark:bg-purple-900/60 dark:text-purple-300">
                  실시간
                </span>
              </h2>
              <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">
                직원들의 금일 통화 중 의미 있는 실전 상담을 선별하고 AI 요약문과 녹음 원본을 즉시 청취·검토합니다.
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={loadData}
              disabled={loading}
              className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold rounded-lg border border-gray-300 dark:border-gray-600 text-gray-700 dark:text-gray-200 hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors disabled:opacity-50"
            >
              <RefreshCw size={14} className={loading ? 'animate-spin' : ''} /> 새로고침
            </button>
          </div>
        </div>

        {/* 필터 툴바 */}
        <div className="flex flex-wrap items-center gap-2.5 pt-3 border-t border-gray-100 dark:border-gray-700">
          
          {/* 일자 프리셋 버튼 */}
          <div className="flex items-center bg-gray-100 dark:bg-gray-700 p-0.5 rounded-lg text-xs font-medium">
            <button
              onClick={() => setFilter(f => ({ ...f, preset: 'today' }))}
              className={`px-3 py-1.5 rounded-md transition-all ${
                filter.preset === 'today'
                  ? 'bg-white dark:bg-gray-800 text-purple-700 dark:text-purple-300 shadow-xs font-bold'
                  : 'text-gray-600 dark:text-gray-400 hover:text-gray-900'
              }`}
            >
              오늘
            </button>
            <button
              onClick={() => setFilter(f => ({ ...f, preset: 'yesterday' }))}
              className={`px-3 py-1.5 rounded-md transition-all ${
                filter.preset === 'yesterday'
                  ? 'bg-white dark:bg-gray-800 text-purple-700 dark:text-purple-300 shadow-xs font-bold'
                  : 'text-gray-600 dark:text-gray-400 hover:text-gray-900'
              }`}
            >
              어제
            </button>
            <button
              onClick={() => setFilter(f => ({ ...f, preset: 'week' }))}
              className={`px-3 py-1.5 rounded-md transition-all ${
                filter.preset === 'week'
                  ? 'bg-white dark:bg-gray-800 text-purple-700 dark:text-purple-300 shadow-xs font-bold'
                  : 'text-gray-600 dark:text-gray-400 hover:text-gray-900'
              }`}
            >
              이번 주
            </button>
            <button
              onClick={() => setFilter(f => ({ ...f, preset: 'custom' }))}
              className={`px-3 py-1.5 rounded-md transition-all ${
                filter.preset === 'custom'
                  ? 'bg-white dark:bg-gray-800 text-purple-700 dark:text-purple-300 shadow-xs font-bold'
                  : 'text-gray-600 dark:text-gray-400 hover:text-gray-900'
              }`}
            >
              날짜 지정
            </button>
          </div>

          {/* 특정 일자 입력 (custom일 때 활성화) */}
          {filter.preset === 'custom' && (
            <input
              type="date"
              value={customDateInput}
              onChange={e => setCustomDateInput(e.target.value)}
              className="px-2.5 py-1.5 text-xs bg-white dark:bg-gray-700 border border-gray-300 dark:border-gray-600 rounded-lg text-gray-800 dark:text-gray-200"
            />
          )}

          {/* 직원(상담원) 선택 */}
          <select
            value={filter.userId}
            onChange={e => setFilter(f => ({ ...f, userId: e.target.value }))}
            className="px-3 py-1.5 text-xs bg-white dark:bg-gray-700 border border-gray-300 dark:border-gray-600 rounded-lg text-gray-800 dark:text-gray-200"
          >
            <option value="all">전체 직원</option>
            {teamMembers.map(m => (
              <option key={m.userId} value={m.userId}>
                {m.displayName} ({m.role === 'admin' || m.role === 'owner' ? '관리자' : '상담원'})
              </option>
            ))}
          </select>

          {/* 통화 유형 / 적격성 필터 */}
          <select
            value={filter.auditType}
            onChange={e => setFilter(f => ({ ...f, auditType: e.target.value as CallAuditType }))}
            className="px-3 py-1.5 text-xs bg-white dark:bg-gray-700 border border-purple-300 dark:border-purple-600 text-purple-900 dark:text-purple-200 font-semibold rounded-lg"
          >
            <option value="meaningful_only">⭐ 의미있는 상담만 (추천)</option>
            <option value="deep">💬 심층 상담 (채무/소득 확인)</option>
            <option value="appointment">📅 통화 예약/일정 약속</option>
            <option value="simple">ℹ️ 단순 안내/일반 문의</option>
            <option value="all">전체 통화 (단순 부재 포함)</option>
            <option value="skipped">생략/부재 통화만</option>
          </select>

          {/* 최소 통화 시간 */}
          <select
            value={filter.minDurationSec}
            onChange={e => setFilter(f => ({ ...f, minDurationSec: Number(e.target.value) }))}
            className="px-3 py-1.5 text-xs bg-white dark:bg-gray-700 border border-gray-300 dark:border-gray-600 rounded-lg text-gray-800 dark:text-gray-200"
          >
            <option value={0}>통화시간 전체</option>
            <option value={30}>30초 이상</option>
            <option value={60}>1분 이상</option>
            <option value={180}>3분 이상</option>
          </select>

          {/* 검색창 */}
          <div className="relative flex-1 min-w-[180px]">
            <Search size={14} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-gray-400" />
            <input
              type="text"
              placeholder="고객명, 연락처, 요약 키워드 검색..."
              value={filter.searchKeyword}
              onChange={e => setFilter(f => ({ ...f, searchKeyword: e.target.value }))}
              className="w-full pl-8 pr-3 py-1.5 text-xs bg-white dark:bg-gray-700 border border-gray-300 dark:border-gray-600 rounded-lg text-gray-800 dark:text-gray-200 placeholder-gray-400 focus:outline-none focus:ring-1 focus:ring-purple-500"
            />
          </div>

        </div>
      </div>

      {/* 2. KPI 요약 카드 */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        
        <div className="bg-white dark:bg-gray-800 p-4 rounded-xl border border-gray-200 dark:border-gray-700 shadow-xs">
          <div className="flex items-center justify-between text-gray-500 dark:text-gray-400 mb-1">
            <span className="text-xs font-medium">총 통화 건수</span>
            <PhoneCall size={16} className="text-blue-600" />
          </div>
          <div className="text-2xl font-bold text-gray-900 dark:text-white">
            {stats.totalCalls.toLocaleString()} <span className="text-xs font-normal text-gray-400">건</span>
          </div>
          <div className="text-[11px] text-gray-400 mt-1">
            선택 기간 내 발생한 전체 콜
          </div>
        </div>

        <div className="bg-white dark:bg-gray-800 p-4 rounded-xl border border-purple-200 dark:border-purple-800 shadow-xs">
          <div className="flex items-center justify-between text-purple-700 dark:text-purple-300 mb-1">
            <span className="text-xs font-bold">의미있는 실전 상담</span>
            <Sparkles size={16} className="text-purple-600" />
          </div>
          <div className="text-2xl font-bold text-purple-700 dark:text-purple-300">
            {stats.meaningfulCalls.toLocaleString()} <span className="text-xs font-normal text-gray-400">건</span>
            <span className="ml-2 text-xs font-medium px-2 py-0.5 rounded-full bg-purple-100 text-purple-700 dark:bg-purple-900/60 dark:text-purple-300">
              {stats.meaningfulRate}%
            </span>
          </div>
          <div className="text-[11px] text-gray-400 mt-1">
            심층 상담 및 일정 약속 체결
          </div>
        </div>

        <div className="bg-white dark:bg-gray-800 p-4 rounded-xl border border-gray-200 dark:border-gray-700 shadow-xs">
          <div className="flex items-center justify-between text-gray-500 dark:text-gray-400 mb-1">
            <span className="text-xs font-medium">재통화 · 일정 약속</span>
            <Calendar size={16} className="text-amber-600" />
          </div>
          <div className="text-2xl font-bold text-amber-600 dark:text-amber-400">
            {stats.appointmentCalls.toLocaleString()} <span className="text-xs font-normal text-gray-400">건</span>
          </div>
          <div className="text-[11px] text-gray-400 mt-1">
            서류 안내 및 2차 통화 예약
          </div>
        </div>

        <div className="bg-white dark:bg-gray-800 p-4 rounded-xl border border-gray-200 dark:border-gray-700 shadow-xs">
          <div className="flex items-center justify-between text-gray-500 dark:text-gray-400 mb-1">
            <span className="text-xs font-medium">평균 통화 시간</span>
            <Clock size={16} className="text-emerald-600" />
          </div>
          <div className="text-2xl font-bold text-emerald-600 dark:text-emerald-400">
            {fmtDuration(stats.avgDurationSec)}
          </div>
          <div className="text-[11px] text-gray-400 mt-1">
            총 {fmtDuration(stats.totalDurationSec)}
          </div>
        </div>

      </div>

      {/* 3. 통화 목록 테이블 */}
      <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 shadow-sm overflow-hidden">
        
        <div className="px-5 py-4 border-b border-gray-100 dark:border-gray-700 flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-2">
            <h3 className="font-bold text-gray-900 dark:text-white text-sm">
              통화 모니터링 목록
            </h3>
            <span className="text-xs font-medium text-gray-500 dark:text-gray-400">
              (총 {items.length}건)
            </span>
          </div>
          {filter.auditType === 'meaningful_only' && (
            <span className="text-xs text-purple-600 dark:text-purple-400 bg-purple-50 dark:bg-purple-950/40 px-2.5 py-1 rounded-md">
              단순 부재나 1초 오발신 등 무의미한 통화는 자동으로 제외되어 있습니다.
            </span>
          )}
        </div>

        {loading ? (
          <div className="py-20 text-center text-gray-400 dark:text-gray-500 space-y-2">
            <RefreshCw size={28} className="animate-spin mx-auto text-purple-600 opacity-60" />
            <p className="text-sm">통화 내역 및 AI 요약 분석 데이터를 불러오는 중입니다...</p>
          </div>
        ) : error ? (
          <div className="py-16 text-center text-rose-500 space-y-2">
            <AlertCircle size={28} className="mx-auto" />
            <p className="text-sm font-semibold">{error}</p>
            <button
              onClick={loadData}
              className="text-xs text-blue-600 underline hover:text-blue-800"
            >
              다시 시도
            </button>
          </div>
        ) : items.length === 0 ? (
          <div className="py-20 text-center text-gray-400 dark:text-gray-500 space-y-3">
            <Sparkles size={40} className="mx-auto opacity-20" />
            <p className="text-sm font-medium">선택하신 조건에 해당하는 통화 활동이 없습니다.</p>
            <p className="text-xs text-gray-400">
              필터에서 '전체 통화 (단순 부재 포함)'를 선택하거나 다른 날짜를 선택해보세요.
            </p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse text-xs">
              <thead>
                <tr className="bg-gray-50/80 dark:bg-gray-800/80 text-gray-500 dark:text-gray-400 border-b border-gray-200 dark:border-gray-700 font-semibold">
                  <th className="py-3 px-4 w-28">시각 / 방향</th>
                  <th className="py-3 px-4 w-28">담당 상담원</th>
                  <th className="py-3 px-4 w-36">고객 정보</th>
                  <th className="py-3 px-4 w-24">통화시간</th>
                  <th className="py-3 px-4 w-28">통화 판정</th>
                  <th className="py-3 px-4">AI 핵심 요약 스니펫</th>
                  <th className="py-3 px-4 w-20 text-center">대화록</th>
                  <th className="py-3 px-4 w-36 text-right">작업</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100 dark:divide-gray-700/60 text-gray-700 dark:text-gray-300">
                {paginatedItems.map(item => (
                  <tr
                    key={item.id}
                    onClick={() => setSelectedItem(item)}
                    className="hover:bg-purple-50/40 dark:hover:bg-gray-750 transition-colors cursor-pointer group"
                  >
                    {/* 1. 시각 / 방향 */}
                    <td className="py-3 px-4 whitespace-nowrap">
                      <div className="flex items-center gap-1.5 font-medium text-gray-800 dark:text-gray-200">
                        {item.direction === 'CALL_IN' ? (
                          <PhoneIncoming size={13} className="text-blue-500 shrink-0" title="수신" />
                        ) : (
                          <PhoneOutgoing size={13} className="text-emerald-500 shrink-0" title="발신" />
                        )}
                        <span>{item.formattedTime}</span>
                      </div>
                      <span className="text-[10px] text-gray-400 block mt-0.5">
                        {item.formattedDate.split(' ')[0]}
                      </span>
                    </td>

                    {/* 2. 담당 상담원 */}
                    <td className="py-3 px-4 whitespace-nowrap">
                      <div className="font-semibold text-gray-900 dark:text-white">
                        {item.userName}
                      </div>
                      <span className="text-[10px] text-gray-400">
                        {item.userRole === 'admin' || item.userRole === 'owner' ? '관리자' : '상담원'}
                      </span>
                    </td>

                    {/* 3. 고객 정보 */}
                    <td className="py-3 px-4 whitespace-nowrap">
                      <div className="font-semibold text-gray-900 dark:text-white">
                        {item.customerName}
                      </div>
                      <div className="text-[11px] text-gray-400 font-mono">
                        {item.customerPhone}
                      </div>
                      <span className="inline-block mt-0.5 text-[10px] px-1.5 py-0.2 rounded bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-300">
                        {item.caseStatus}
                      </span>
                    </td>

                    {/* 4. 통화 시간 */}
                    <td className="py-3 px-4 whitespace-nowrap">
                      <span className={`font-medium ${
                        item.durationSec >= 180
                          ? 'text-purple-600 dark:text-purple-400 font-bold'
                          : item.durationSec >= 60
                          ? 'text-gray-800 dark:text-gray-200'
                          : 'text-gray-400'
                      }`}>
                        {item.durationLabel}
                      </span>
                    </td>

                    {/* 5. 통화 판정 뱃지 */}
                    <td className="py-3 px-4 whitespace-nowrap">
                      <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-semibold ${
                        item.qualification.callType === 'deep_consultation'
                          ? 'bg-purple-100 text-purple-700 dark:bg-purple-950 dark:text-purple-300'
                          : item.qualification.callType === 'appointment'
                          ? 'bg-amber-100 text-amber-700 dark:bg-amber-950 dark:text-amber-300'
                          : item.qualification.isMeaningful
                          ? 'bg-blue-100 text-blue-700 dark:bg-blue-950 dark:text-blue-300'
                          : 'bg-gray-100 text-gray-500 dark:bg-gray-800 dark:text-gray-400'
                      }`}>
                        {item.qualification.isMeaningful && <Sparkles size={11} />}
                        {item.qualification.callTypeLabel}
                      </span>
                    </td>

                    {/* 6. AI 핵심 요약 스니펫 */}
                    <td className="py-3 px-4">
                      <p className="line-clamp-2 text-xs text-gray-600 dark:text-gray-300 leading-snug">
                        {item.summarySnippet}
                      </p>
                      {item.qualification.scheduleNote && (
                        <p className="text-[11px] text-amber-600 dark:text-amber-400 font-medium mt-0.5">
                          📅 약속: {item.qualification.scheduleNote}
                        </p>
                      )}
                    </td>

                    {/* 7. 대화록 건수 */}
                    <td className="py-3 px-4 text-center whitespace-nowrap">
                      {item.transcriptCount > 0 ? (
                        <span className="px-2 py-0.5 rounded bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300 font-mono text-[11px]">
                          {item.transcriptCount}건
                        </span>
                      ) : (
                        <span className="text-gray-300 dark:text-gray-600">-</span>
                      )}
                    </td>

                    {/* 8. 작업 버튼 */}
                    <td className="py-3 px-4 text-right whitespace-nowrap" onClick={e => e.stopPropagation()}>
                      <div className="flex items-center justify-end gap-1.5">
                        <button
                          onClick={() => setSelectedItem(item)}
                          className="px-2.5 py-1 text-xs font-semibold text-purple-700 dark:text-purple-300 bg-purple-50 dark:bg-purple-950/60 hover:bg-purple-100 dark:hover:bg-purple-900/60 rounded-md transition-colors flex items-center gap-1 border border-purple-200 dark:border-purple-800"
                        >
                          <FileText size={12} /> 요약·대화록
                        </button>
                        <button
                          onClick={() => navigate(`/cases/${item.caseId}`)}
                          className="p-1 text-gray-400 hover:text-blue-600 dark:hover:text-blue-400 hover:bg-blue-50 dark:hover:bg-gray-700 rounded-md transition-colors"
                          title="고객 상세 화면으로 이동"
                        >
                          <ExternalLink size={14} />
                        </button>
                      </div>
                    </td>

                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {/* 페이지네이션 하단 바 */}
        {!loading && items.length > 0 && (
          <div className="px-5 py-3 border-t border-gray-100 dark:border-gray-700 bg-gray-50/50 dark:bg-gray-800/50 flex items-center justify-between text-xs text-gray-500">
            <div>
              {items.length}건 중 {(page - 1) * PAGE_SIZE + 1} - {Math.min(page * PAGE_SIZE, items.length)}건 표시
            </div>
            <div className="flex items-center gap-1">
              <button
                onClick={() => setPage(p => Math.max(1, p - 1))}
                disabled={page <= 1}
                className="p-1 rounded border border-gray-200 dark:border-gray-700 hover:bg-gray-100 dark:hover:bg-gray-700 disabled:opacity-40"
              >
                <ChevronLeft size={16} />
              </button>
              <span className="px-2 font-medium">
                {page} / {totalPages}
              </span>
              <button
                onClick={() => setPage(p => Math.min(totalPages, p + 1))}
                disabled={page >= totalPages}
                className="p-1 rounded border border-gray-200 dark:border-gray-700 hover:bg-gray-100 dark:hover:bg-gray-700 disabled:opacity-40"
              >
                <ChevronRight size={16} />
              </button>
            </div>
          </div>
        )}

      </div>

      {/* 4. 상세 모달 뷰어 */}
      {selectedItem && (
        <TeamCallDetailModal
          item={selectedItem}
          onClose={() => setSelectedItem(null)}
        />
      )}

    </div>
  );
}
