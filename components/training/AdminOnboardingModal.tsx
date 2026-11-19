import React, { useState, useEffect } from 'react';
import {
  UserOnboardingProfile,
  ONBOARDING_STEP_METAS,
  getAllOnboardingProfiles,
  approveOnboarding,
  resetOnboardingProfile,
} from '../../services/trainingOnboardingService';
import { useAuth } from '../../contexts/AuthContext';
import { useToast } from '../../contexts/ToastContext';
import {
  Users,
  X,
  CheckCircle2,
  Clock,
  Award,
  RotateCcw,
  ShieldCheck,
  Search,
  ExternalLink,
  ChevronRight,
} from 'lucide-react';

interface Props {
  isOpen: boolean;
  onClose: () => void;
  onSelectUserForDetail?: (profile: UserOnboardingProfile) => void;
}

export const AdminOnboardingModal: React.FC<Props> = ({ isOpen, onClose }) => {
  const { user } = useAuth();
  const { addToast } = useToast();

  const [profiles, setProfiles] = useState<UserOnboardingProfile[]>([]);
  const [searchKeyword, setSearchKeyword] = useState('');
  const [filterStatus, setFilterStatus] = useState<'all' | 'pending' | 'approved' | 'in_progress'>('all');
  const [selectedProfile, setSelectedProfile] = useState<UserOnboardingProfile | null>(null);

  useEffect(() => {
    if (isOpen) {
      loadData();
    }
  }, [isOpen]);

  const loadData = () => {
    const list = getAllOnboardingProfiles();
    setProfiles(list);
  };

  const handleApprove = (targetUserId: string, userName: string) => {
    const adminName = user?.name || user?.email || '대표/관리자';
    approveOnboarding(targetUserId, adminName);
    addToast(`✅ [${userName}] 상담원의 실전 콜 발신 권한을 정식 승인했습니다!`, 'success');
    loadData();
    if (selectedProfile && selectedProfile.userId === targetUserId) {
      setSelectedProfile((prev) => (prev ? { ...prev, isApprovedByAdmin: true, approvedBy: adminName } : null));
    }
  };

  const handleReset = (targetUserId: string, userName: string) => {
    if (
      window.confirm(
        `정말로 [${userName}] 상담원의 온보딩 훈련 기록을 초기화하시겠습니까?\n모든 퀘스트가 1단계로 되돌아갑니다.`
      )
    ) {
      resetOnboardingProfile(targetUserId);
      addToast(`[${userName}] 상담원의 온보딩 기록이 초기화되었습니다.`, 'info');
      loadData();
      if (selectedProfile && selectedProfile.userId === targetUserId) {
        setSelectedProfile(null);
      }
    }
  };

  if (!isOpen) return null;

  // 필터링
  const filteredProfiles = profiles.filter((p) => {
    const matchesKeyword =
      p.userName.toLowerCase().includes(searchKeyword.toLowerCase()) ||
      p.userId.toLowerCase().includes(searchKeyword.toLowerCase());

    if (!matchesKeyword) return false;

    if (filterStatus === 'pending') {
      return p.isCompleted && !p.isApprovedByAdmin;
    }
    if (filterStatus === 'approved') {
      return p.isApprovedByAdmin;
    }
    if (filterStatus === 'in_progress') {
      return !p.isCompleted;
    }
    return true;
  });

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-fade-in">
      <div className="w-full max-w-5xl bg-white dark:bg-gray-800 rounded-3xl shadow-2xl border border-gray-200 dark:border-gray-700 overflow-hidden flex flex-col max-h-[90vh]">
        {/* 모달 상단 헤더 */}
        <div className="p-6 border-b border-gray-200 dark:border-gray-700 bg-gradient-to-r from-indigo-900 to-slate-900 text-white flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-2xl bg-indigo-500/20 flex items-center justify-center border border-indigo-400/30">
              <Users className="w-5 h-5 text-indigo-600 dark:text-indigo-400" />
            </div>
            <div>
              <h2 className="text-lg font-black tracking-tight text-white flex items-center gap-2">
                <span>신입 온보딩 패스트트랙 전사 관제 보드</span>
                <span className="px-2 py-0.5 rounded-full bg-amber-400 text-gray-950 text-xs font-black">
                  관리자 전용
                </span>
              </h2>
              <p className="text-xs text-indigo-200/80">
                신입 상담원들의 9단계 자율 훈련 진척도를 확인하고, 완주 시 실전 콜 발신 권한을 원클릭으로 부여합니다.
              </p>
            </div>
          </div>

          <button
            onClick={onClose}
            className="p-2 rounded-2xl text-gray-400 hover:text-white hover:bg-white/10 transition-all"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* 필터 및 검색 바 */}
        <div className="p-4 border-b border-gray-100 dark:border-gray-700/60 bg-gray-50/50 dark:bg-gray-900 flex flex-col sm:flex-row items-center justify-between gap-3">
          <div className="flex items-center gap-2 w-full sm:w-auto">
            <div className="relative flex-1 sm:w-64">
              <Search className="w-4 h-4 text-gray-400 absolute left-3 top-1/2 -translate-y-1/2" />
              <input
                type="text"
                placeholder="상담원 이름 / 아이디 검색..."
                value={searchKeyword}
                onChange={(e) => setSearchKeyword(e.target.value)}
                className="w-full pl-9 pr-3 py-2 text-xs rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900 text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-indigo-500"
              />
            </div>
          </div>

          <div className="flex items-center gap-1.5 p-1 rounded-xl bg-gray-200/70 dark:bg-gray-800 text-xs font-bold">
            <button
              onClick={() => setFilterStatus('all')}
              className={`px-3 py-1.5 rounded-lg transition-all ${
                filterStatus === 'all'
                  ? 'bg-white dark:bg-gray-900 text-indigo-600 dark:text-indigo-400 shadow-sm'
                  : 'text-gray-600 dark:text-gray-400'
              }`}
            >
              전체 ({profiles.length})
            </button>
            <button
              onClick={() => setFilterStatus('pending')}
              className={`px-3 py-1.5 rounded-lg transition-all flex items-center gap-1 ${
                filterStatus === 'pending'
                  ? 'bg-amber-500 text-slate-900 dark:text-white shadow-sm'
                  : 'text-gray-600 dark:text-gray-400'
              }`}
            >
              <span>승인 대기</span>
              <span className="px-1.5 py-0.2 rounded-full text-xs bg-amber-600 text-white">
                {profiles.filter((p) => p.isCompleted && !p.isApprovedByAdmin).length}
              </span>
            </button>
            <button
              onClick={() => setFilterStatus('in_progress')}
              className={`px-3 py-1.5 rounded-lg transition-all ${
                filterStatus === 'in_progress'
                  ? 'bg-white dark:bg-gray-900 text-indigo-600 dark:text-indigo-400 shadow-sm'
                  : 'text-gray-600 dark:text-gray-400'
              }`}
            >
              훈련 진행 중
            </button>
            <button
              onClick={() => setFilterStatus('approved')}
              className={`px-3 py-1.5 rounded-lg transition-all ${
                filterStatus === 'approved'
                  ? 'bg-emerald-600 text-slate-900 dark:text-white shadow-sm'
                  : 'text-gray-600 dark:text-gray-400'
              }`}
            >
              실전 승인 완료
            </button>
          </div>
        </div>

        {/* 본문 테이블 및 상세 뷰 */}
        <div className="flex-1 overflow-y-auto p-6 space-y-4">
          {filteredProfiles.length === 0 ? (
            <div className="text-center py-16 space-y-3">
              <div className="w-16 h-16 rounded-full bg-gray-100 dark:bg-gray-800 flex items-center justify-center mx-auto text-gray-400">
                <Users className="w-8 h-8" />
              </div>
              <p className="text-sm font-bold text-gray-600 dark:text-gray-300">
                등록된 신입 상담원 온보딩 데이터가 없습니다.
              </p>
              <p className="text-xs text-gray-400">
                신입 상담원이 로그인하여 [신입 온보딩 패키지]에 접속하면 자동으로 집계됩니다.
              </p>
            </div>
          ) : (
            <div className="border border-gray-200 dark:border-gray-700 rounded-2xl overflow-hidden shadow-sm">
              <table className="w-full text-left text-xs">
                <thead className="bg-gray-100/80 dark:bg-gray-900 text-gray-600 dark:text-gray-300 font-bold border-b border-gray-200 dark:border-gray-700">
                  <tr>
                    <th className="p-3.5">상담원 정보</th>
                    <th className="p-3.5">시작 일시</th>
                    <th className="p-3.5">진척도 (9개 단계)</th>
                    <th className="p-3.5">현재 진행 퀘스트</th>
                    <th className="p-3.5">최종 상태</th>
                    <th className="p-3.5 text-right">관리 액션</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100 dark:divide-gray-800">
                  {filteredProfiles.map((p) => {
                    const currentMeta = ONBOARDING_STEP_METAS.find((m) => m.id === p.currentStepId);
                    const isPendingApproval = p.isCompleted && !p.isApprovedByAdmin;

                    return (
                      <tr
                        key={p.userId}
                        className="hover:bg-gray-50/80 dark:hover:bg-gray-700/50 transition-all"
                      >
                        <td className="p-3.5">
                          <div className="font-bold text-gray-900 dark:text-white flex items-center gap-1.5">
                            <span>{p.userName}</span>
                            {p.isApprovedByAdmin && (
                              <ShieldCheck className="w-3.5 h-3.5 text-emerald-500" title="발신 권한 승인됨" />
                            )}
                          </div>
                          <div className="text-xs text-gray-400 font-mono">{p.userId}</div>
                        </td>

                        <td className="p-3.5 text-gray-500 dark:text-gray-400">
                          {p.startedAt ? p.startedAt.split('T')[0] : '-'}
                        </td>

                        <td className="p-3.5">
                          <div className="space-y-1 w-32">
                            <div className="flex items-center justify-between text-xs">
                              <span className="font-bold text-indigo-600 dark:text-indigo-400">
                                {p.progressPercent}%
                              </span>
                              <span className="text-gray-400">{p.completedCount}/9완료</span>
                            </div>
                            <div className="h-1.5 w-full bg-gray-200 dark:bg-gray-700 rounded-full overflow-hidden">
                              <div
                                className={`h-full rounded-full transition-all duration-300 ${
                                  p.isCompleted ? 'bg-emerald-500' : 'bg-indigo-600'
                                }`}
                                style={{ width: `${p.progressPercent}%` }}
                              />
                            </div>
                          </div>
                        </td>

                        <td className="p-3.5">
                          {p.isCompleted ? (
                            <span className="text-emerald-600 dark:text-emerald-400 font-bold flex items-center gap-1">
                              <CheckCircle2 className="w-3.5 h-3.5" /> 9단계 전원 완료
                            </span>
                          ) : (
                            <div className="text-gray-700 dark:text-gray-300 font-medium">
                              Step {currentMeta?.order}. {currentMeta?.title}
                            </div>
                          )}
                        </td>

                        <td className="p-3.5">
                          {p.isApprovedByAdmin ? (
                            <span className="px-2.5 py-1 rounded-full text-xs font-bold bg-emerald-100 dark:bg-emerald-950 text-emerald-700 dark:text-emerald-300 border border-emerald-300 dark:border-emerald-800">
                              ✅ 실전 발신 승인완료
                            </span>
                          ) : isPendingApproval ? (
                            <span className="px-2.5 py-1 rounded-full text-xs font-bold bg-amber-100 dark:bg-amber-950 text-amber-800 dark:text-amber-300 border border-amber-300 dark:border-amber-700 animate-pulse">
                              ⏳ 승인 대기 중
                            </span>
                          ) : (
                            <span className="px-2.5 py-1 rounded-full text-xs font-medium bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-300">
                              훈련 진행 중
                            </span>
                          )}
                        </td>

                        <td className="p-3.5 text-right">
                          <div className="flex items-center justify-end gap-1.5">
                            {isPendingApproval && (
                              <button
                                onClick={() => handleApprove(p.userId, p.userName)}
                                className="px-3 py-1.5 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white font-bold shadow-sm transition-all text-xs flex items-center gap-1"
                              >
                                <Award className="w-3.5 h-3.5" />
                                <span>실전 발신 승인</span>
                              </button>
                            )}

                            <button
                              onClick={() => setSelectedProfile(p)}
                              className="px-2.5 py-1.5 rounded-xl bg-gray-100 dark:bg-gray-700 hover:bg-gray-200 dark:hover:bg-gray-600 text-gray-700 dark:text-gray-300 transition-all font-bold text-xs"
                            >
                              상세보기
                            </button>

                            <button
                              onClick={() => handleReset(p.userId, p.userName)}
                              className="p-1.5 rounded-xl text-rose-500 hover:bg-rose-50 dark:hover:bg-rose-950/40 transition-all"
                              title="온보딩 기록 초기화"
                            >
                              <RotateCcw className="w-3.5 h-3.5" />
                            </button>
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}

          {/* 특정 상담원 상세 이력 팝업/카드 */}
          {selectedProfile && (
            <div className="p-5 rounded-2xl bg-indigo-50/50 dark:bg-gray-900 border border-indigo-200 dark:border-gray-700 space-y-4">
              <div className="flex items-center justify-between pb-3 border-b border-gray-200 dark:border-gray-700">
                <div className="flex items-center gap-2">
                  <span className="font-black text-sm text-gray-900 dark:text-white">
                    [{selectedProfile.userName}] 상담원 9단계 세부 이력표
                  </span>
                  <span className="text-xs text-gray-400 font-mono">({selectedProfile.userId})</span>
                </div>
                <button
                  onClick={() => setSelectedProfile(null)}
                  className="text-xs text-gray-400 hover:text-gray-600 dark:hover:text-gray-200 font-bold"
                >
                  닫기
                </button>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                {ONBOARDING_STEP_METAS.map((m) => {
                  const sState = selectedProfile.steps[m.id];
                  const isDone = sState?.status === 'completed';

                  return (
                    <div
                      key={m.id}
                      className={`p-3 rounded-xl border text-xs space-y-1 ${
                        isDone
                          ? 'bg-emerald-50/70 dark:bg-emerald-950/40 border-emerald-300 dark:border-emerald-700 text-gray-800 dark:text-gray-200'
                          : sState?.status === 'in_progress'
                          ? 'bg-indigo-50/70 dark:bg-indigo-950/40 border-indigo-300 dark:border-indigo-600 text-gray-800 dark:text-gray-200'
                          : 'bg-gray-50 dark:bg-gray-800/80 border-gray-200 dark:border-gray-700 text-gray-700 dark:text-gray-300'
                      }`}
                    >
                      <div className="flex items-center justify-between font-bold">
                        <span className="text-gray-900 dark:text-white">Step {m.order}. {m.title}</span>
                        {isDone ? (
                          <span className="text-emerald-600 dark:text-emerald-400 font-black">완료</span>
                        ) : (
                          <span className="text-gray-500 dark:text-gray-400 font-normal">
                            {sState?.status === 'in_progress' ? '진행 중' : '잠김'}
                          </span>
                        )}
                      </div>
                      <div className="text-xs text-gray-600 dark:text-gray-300">
                        {m.requirement}
                      </div>
                      {sState?.score !== undefined && (
                        <div className="text-xs font-bold text-indigo-600 dark:text-indigo-400">
                          점수: {sState.score}점
                        </div>
                      )}
                      {sState?.completedAt && (
                        <div className="text-xs text-gray-400">
                          완료일시: {sState.completedAt.replace('T', ' ').substring(0, 16)}
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>

              {selectedProfile.isCompleted && !selectedProfile.isApprovedByAdmin && (
                <div className="pt-2 flex justify-end">
                  <button
                    onClick={() => handleApprove(selectedProfile.userId, selectedProfile.userName)}
                    className="px-4 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs shadow-md transition-all flex items-center gap-1.5"
                  >
                    <Award className="w-4 h-4" />
                    <span>실전 발신 권한 원클릭 승인하기</span>
                  </button>
                </div>
              )}
            </div>
          )}
        </div>

        {/* 모달 하단 닫기 바 */}
        <div className="p-4 border-t border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-900 flex items-center justify-between">
          <div className="text-xs text-gray-500 dark:text-gray-400">
            실전 승인 시 CTI 전화 발신 및 인입 DB 배정이 자동으로 가동됩니다.
          </div>
          <button
            onClick={onClose}
            className="px-4 py-2 rounded-xl bg-gray-200 dark:bg-gray-700 text-gray-700 dark:text-gray-200 hover:bg-gray-300 dark:hover:bg-gray-600 text-xs font-bold transition-all"
          >
            닫기
          </button>
        </div>
      </div>
    </div>
  );
};
