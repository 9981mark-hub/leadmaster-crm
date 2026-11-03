import React, { useState, useEffect } from 'react';
import {
  AlertTriangle, Skull, ShieldAlert, X, Download, ArrowRight,
  CheckCircle2, Lock, Loader2, RefreshCw, FileText, Check, ShieldCheck
} from 'lucide-react';
import { useAuth } from '../../contexts/AuthContext';
import { useToast } from '../../contexts/ToastContext';
import { Case } from '../../types';
import {
  PurgeSummary, PurgeResult, fetchPurgeSummary,
  downloadEmergencyBackupFile, executeEmergencyPurge
} from '../../services/emergencyPurge';

interface EmergencyPurgeModalProps {
  isOpen: boolean;
  onClose: () => void;
  cases: Case[];
}

export const EmergencyPurgeModal: React.FC<EmergencyPurgeModalProps> = ({
  isOpen,
  onClose,
  cases,
}) => {
  const { org, user, logout } = useAuth();
  const { showToast } = useToast();

  const [step, setStep] = useState<1 | 2 | 3 | 4 | 5>(1);
  const [summary, setSummary] = useState<PurgeSummary | null>(null);
  const [loadingSummary, setLoadingSummary] = useState(true);

  // 3단계: 대표자 이메일 확인
  const [ownerEmailConfirm, setOwnerEmailConfirm] = useState('');

  // 4단계: 확인 문구 & 10초 타이머
  const [confirmPhraseInput, setConfirmPhraseInput] = useState('');
  const [purgeReason, setPurgeReason] = useState('비상 상황에 따른 대표자 직접 파기');
  const [cooldownSeconds, setCooldownSeconds] = useState(10);
  const [isPurging, setIsPurging] = useState(false);

  // 5단계: 파기 결과
  const [purgeResult, setPurgeResult] = useState<PurgeResult | null>(null);

  const orgName = org?.orgName || summary?.orgName || '회사';
  const expectedPhrase = `${orgName} / 모든 데이터를 영구 파기합니다`;
  const isPhraseMatched = confirmPhraseInput.trim() === expectedPhrase.trim();

  // 모달 오픈 시 요약 정보 로드
  useEffect(() => {
    if (!isOpen) {
      setStep(1);
      setConfirmPhraseInput('');
      setCooldownSeconds(10);
      setIsPurging(false);
      setPurgeResult(null);
      setOwnerEmailConfirm('');
      return;
    }

    let isMounted = true;
    setLoadingSummary(true);
    fetchPurgeSummary()
      .then(res => {
        if (isMounted) {
          setSummary(res);
          setLoadingSummary(false);
        }
      })
      .catch(err => {
        if (isMounted) {
          console.error('[EmergencyPurge] summary error:', err);
          setLoadingSummary(false);
          showToast(`요약 조회 실패: ${err.message}`, 'error');
        }
      });

    return () => {
      isMounted = false;
    };
  }, [isOpen, showToast]);

  // 4단계 진입 시 10초 쿨다운 타이머 시작
  useEffect(() => {
    if (step !== 4) return;
    setCooldownSeconds(10);
    const interval = setInterval(() => {
      setCooldownSeconds(prev => {
        if (prev <= 1) {
          clearInterval(interval);
          return 0;
        }
        return prev - 1;
      });
    }, 1000);

    return () => clearInterval(interval);
  }, [step]);

  if (!isOpen) return null;

  const handleDownloadBackup = () => {
    if (!summary) return;
    try {
      downloadEmergencyBackupFile(orgName, cases, summary);
      showToast('비상 백업 파일이 다운로드되었습니다.', 'success');
    } catch (e: any) {
      showToast(`백업 다운로드 실패: ${e.message}`, 'error');
    }
  };

  const handleFinalPurge = async () => {
    if (!isPhraseMatched || cooldownSeconds > 0) return;
    setIsPurging(true);
    try {
      const res = await executeEmergencyPurge(confirmPhraseInput, purgeReason);
      setPurgeResult(res);
      setStep(5);
      showToast('🚨 회사 데이터가 성공적으로 영구 파기되었습니다.', 'success');
    } catch (e: any) {
      console.error('[EmergencyPurge] execution error:', e);
      showToast(`파기 실패: ${e.message}`, 'error');
      setIsPurging(false);
    }
  };

  const handleFinishAndExit = () => {
    // 세션 종료 후 새로고침
    logout();
    window.location.href = '/';
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 md:p-6 bg-black/85 backdrop-blur-md animate-in fade-in duration-200">
      <div className="bg-gray-900 border-2 border-rose-600/70 text-gray-100 w-full max-w-2xl rounded-2xl shadow-2xl overflow-hidden flex flex-col">
        
        {/* 상단 붉은 경고 헤더 */}
        <div className="bg-rose-950/80 px-6 py-4 border-b border-rose-800/60 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <span className="p-2 rounded-xl bg-rose-600 text-white animate-pulse">
              <Skull size={22} />
            </span>
            <div>
              <h2 className="text-base md:text-lg font-bold text-white flex items-center gap-2">
                회사 데이터 긴급 영구 파기 (Emergency Kill-Switch)
              </h2>
              <p className="text-xs text-rose-300">
                {orgName} · 최고 책임자(Owner) 전용 비상 권한
              </p>
            </div>
          </div>
          {step !== 5 && (
            <button
              onClick={onClose}
              disabled={isPurging}
              className="p-1.5 text-gray-400 hover:text-white rounded-lg hover:bg-rose-900/40 transition-colors disabled:opacity-30"
            >
              <X size={20} />
            </button>
          )}
        </div>

        {/* 단계별 스텝 바 (5단계 완료 화면 제외) */}
        {step !== 5 && (
          <div className="bg-gray-950 px-6 py-2 border-b border-gray-800 flex items-center justify-between text-xs">
            <div className="flex items-center gap-2">
              <span className={`px-2 py-0.5 rounded font-bold ${step === 1 ? 'bg-rose-600 text-white' : 'bg-gray-800 text-gray-400'}`}>1. 영향도 확인</span>
              <span className="text-gray-600">→</span>
              <span className={`px-2 py-0.5 rounded font-bold ${step === 2 ? 'bg-rose-600 text-white' : 'bg-gray-800 text-gray-400'}`}>2. 비상 백업</span>
              <span className="text-gray-600">→</span>
              <span className={`px-2 py-0.5 rounded font-bold ${step === 3 ? 'bg-rose-600 text-white' : 'bg-gray-800 text-gray-400'}`}>3. 대표자 인증</span>
              <span className="text-gray-600">→</span>
              <span className={`px-2 py-0.5 rounded font-bold ${step === 4 ? 'bg-rose-600 text-white' : 'bg-gray-800 text-gray-400'}`}>4. 영구 파기</span>
            </div>
            <span className="text-rose-400 font-mono font-bold">Step {step}/4</span>
          </div>
        )}

        {/* 본문 컨텐츠 */}
        <div className="p-6 space-y-5 overflow-y-auto max-h-[70vh]">

          {/* STEP 1: 영향도 확인 */}
          {step === 1 && (
            <div className="space-y-4">
              <div className="p-4 bg-rose-950/40 border border-rose-800/80 rounded-xl space-y-2">
                <div className="flex items-center gap-2 text-rose-300 font-bold text-sm">
                  <AlertTriangle size={18} className="text-rose-400 shrink-0" />
                  <span>극도의 주의가 필요한 비가역적 파기 작업입니다</span>
                </div>
                <p className="text-xs text-rose-200/90 leading-relaxed">
                  본 기능은 개인정보 유출, 법적 비상 사태 등에 대응하기 위한 긴급 킬스위치입니다.
                  실행 즉시 본 회사의 <strong>모든 고객 인적사항, 채무 내역, 통화 녹음 파일, AI 요약문, 대화록, 메모</strong>가
                  데이터베이스 및 저장소에서 물리적으로 영구 삭제됩니다.
                </p>
                <p className="text-xs text-rose-400 font-bold">
                  ⚠️ 삭제된 데이터는 본사 관리자나 개발팀을 통해서도 어떠한 방법으로도 절대 복구할 수 없습니다.
                </p>
              </div>

              {loadingSummary ? (
                <div className="py-8 text-center text-gray-400 space-y-2">
                  <Loader2 size={24} className="animate-spin mx-auto text-rose-500" />
                  <p className="text-xs">파기 대상 데이터 건수를 집계하고 있습니다...</p>
                </div>
              ) : (
                <div className="grid grid-cols-2 gap-3 text-xs">
                  <div className="p-3 bg-gray-800/80 rounded-xl border border-gray-700">
                    <span className="text-gray-400 block mb-1">고객 리드 (케이스)</span>
                    <strong className="text-lg text-rose-400 font-bold">
                      {summary?.casesCount.toLocaleString() || cases.length.toLocaleString()}
                    </strong> <span className="text-gray-400">건</span>
                  </div>
                  <div className="p-3 bg-gray-800/80 rounded-xl border border-gray-700">
                    <span className="text-gray-400 block mb-1">통화 녹음 및 AI 요약문</span>
                    <strong className="text-lg text-rose-400 font-bold">
                      {summary?.recordingsCount.toLocaleString() || 0}
                    </strong> <span className="text-gray-400">건</span>
                  </div>
                  <div className="p-3 bg-gray-800/80 rounded-xl border border-gray-700">
                    <span className="text-gray-400 block mb-1">수신거부(DNC) 번호</span>
                    <strong className="text-lg text-gray-200 font-bold">
                      {summary?.dncCount.toLocaleString() || 0}
                    </strong> <span className="text-gray-400">건</span>
                  </div>
                  <div className="p-3 bg-gray-800/80 rounded-xl border border-gray-700">
                    <span className="text-gray-400 block mb-1">DB 업로드 묶음 회차</span>
                    <strong className="text-lg text-gray-200 font-bold">
                      {summary?.batchesCount.toLocaleString() || 0}
                    </strong> <span className="text-gray-400">회차</span>
                  </div>
                </div>
              )}

              <div className="pt-3 flex justify-end gap-2">
                <button
                  type="button"
                  onClick={onClose}
                  className="px-4 py-2 text-xs font-semibold rounded-lg bg-gray-800 hover:bg-gray-700 text-gray-300 transition-colors"
                >
                  취소
                </button>
                <button
                  type="button"
                  onClick={() => setStep(2)}
                  className="px-5 py-2 text-xs font-bold rounded-lg bg-rose-600 hover:bg-rose-700 text-white flex items-center gap-1.5 transition-colors shadow-md"
                >
                  <span>위험성을 확인했습니다 (다음 단계)</span>
                  <ArrowRight size={14} />
                </button>
              </div>
            </div>
          )}

          {/* STEP 2: 비상 백업 권고 */}
          {step === 2 && (
            <div className="space-y-4">
              <div className="p-4 bg-gray-800/70 border border-gray-700 rounded-xl space-y-2">
                <div className="flex items-center gap-2 text-blue-400 font-bold text-sm">
                  <ShieldCheck size={18} />
                  <span>비상 오프라인 백업 다운로드 (권장)</span>
                </div>
                <p className="text-xs text-gray-300 leading-relaxed">
                  비상 상황이라도 사후 법적 감사나 소송 등에서 정당한 입증 자료가 필요할 수 있습니다.
                  데이터를 파기하기 전, 대표자 본인만이 오프라인으로 소장할 수 있는 비상 JSON 백업 파일을 저장할 것을 권장합니다.
                </p>
              </div>

              <div className="p-4 border border-dashed border-gray-700 rounded-xl flex items-center justify-between gap-4">
                <div>
                  <h4 className="text-xs font-bold text-gray-200">현재 보관된 전체 리드 데이터 내보내기</h4>
                  <p className="text-[11px] text-gray-400 mt-0.5">총 {cases.length.toLocaleString()}건의 고객 정보가 단일 JSON 파일로 생성됩니다.</p>
                </div>
                <button
                  type="button"
                  onClick={handleDownloadBackup}
                  className="px-3.5 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg text-xs font-bold flex items-center gap-1.5 shrink-0 transition-colors shadow-sm"
                >
                  <Download size={14} />
                  <span>비상 백업 다운로드</span>
                </button>
              </div>

              <div className="pt-4 flex items-center justify-between">
                <button
                  type="button"
                  onClick={() => setStep(1)}
                  className="text-xs text-gray-400 hover:text-white"
                >
                  ← 이전 단계
                </button>
                <div className="flex gap-2">
                  <button
                    type="button"
                    onClick={() => setStep(3)}
                    className="px-5 py-2 text-xs font-bold rounded-lg bg-rose-600 hover:bg-rose-700 text-white flex items-center gap-1.5 transition-colors shadow-md"
                  >
                    <span>백업 완료 후 다음 단계로</span>
                    <ArrowRight size={14} />
                  </button>
                </div>
              </div>
            </div>
          )}

          {/* STEP 3: 대표자 본인 인증 */}
          {step === 3 && (
            <div className="space-y-4">
              <div className="p-4 bg-gray-800/70 border border-gray-700 rounded-xl space-y-2">
                <div className="flex items-center gap-2 text-amber-400 font-bold text-sm">
                  <Lock size={18} />
                  <span>회사 대표자(Owner) 본인 계정 확인</span>
                </div>
                <p className="text-xs text-gray-300 leading-relaxed">
                  도난이나 자리 비움 상태에서의 악의적인 오작동을 차단하기 위해, 현재 로그인된 대표자 계정 이메일을 확인합니다.
                </p>
              </div>

              <div className="space-y-2">
                <label className="text-xs text-gray-400 block">
                  현재 로그인된 대표자 이메일: <strong className="text-white">{user?.email || '대표자 계정'}</strong>
                </label>
                <input
                  type="email"
                  placeholder="본인의 로그인 이메일 주소를 입력하세요"
                  value={ownerEmailConfirm}
                  onChange={e => setOwnerEmailConfirm(e.target.value)}
                  className="w-full px-3 py-2 text-xs bg-gray-950 border border-gray-700 rounded-lg text-white placeholder-gray-500 focus:outline-none focus:border-rose-500"
                />
              </div>

              <div className="pt-4 flex items-center justify-between">
                <button
                  type="button"
                  onClick={() => setStep(2)}
                  className="text-xs text-gray-400 hover:text-white"
                >
                  ← 이전 단계
                </button>
                <button
                  type="button"
                  disabled={!user?.email || ownerEmailConfirm.trim().toLowerCase() !== user.email.trim().toLowerCase()}
                  onClick={() => setStep(4)}
                  className="px-5 py-2 text-xs font-bold rounded-lg bg-rose-600 hover:bg-rose-700 text-white flex items-center gap-1.5 transition-colors shadow-md disabled:opacity-40 disabled:cursor-not-allowed"
                >
                  <span>인증 확인 (다음 단계)</span>
                  <ArrowRight size={14} />
                </button>
              </div>
            </div>
          )}

          {/* STEP 4: 최종 타이핑 일치 & 10초 쿨다운 */}
          {step === 4 && (
            <div className="space-y-4">
              <div className="p-4 bg-rose-950/60 border border-rose-600 rounded-xl space-y-2 text-xs text-rose-200">
                <div className="flex items-center gap-2 font-bold text-sm text-rose-400">
                  <ShieldAlert size={18} />
                  <span>최종 영구 파기 명령 확인</span>
                </div>
                <p>
                  아래 확인 문구를 정확하게 입력해 주십시오. 문구가 완전히 일치하고 10초의 대기 시간이 종료되어야 파기 버튼이 활성화됩니다.
                </p>
                <div className="p-2.5 bg-black/60 rounded-lg font-mono text-xs text-amber-300 select-all border border-rose-900">
                  {expectedPhrase}
                </div>
              </div>

              <div className="space-y-1.5">
                <label className="text-xs text-gray-300 font-semibold block">
                  확인 문구 입력:
                </label>
                <input
                  type="text"
                  placeholder="위 노란색 박스의 문구를 그대로 입력하세요"
                  value={confirmPhraseInput}
                  onChange={e => setConfirmPhraseInput(e.target.value)}
                  disabled={isPurging}
                  className={`w-full px-3.5 py-2 text-xs bg-gray-950 border rounded-lg text-white focus:outline-none ${
                    isPhraseMatched ? 'border-emerald-500 ring-1 ring-emerald-500' : 'border-gray-700 focus:border-rose-500'
                  }`}
                />
                {isPhraseMatched ? (
                  <p className="text-[11px] text-emerald-400 flex items-center gap-1">
                    <Check size={13} /> 확인 문구가 정확히 일치합니다.
                  </p>
                ) : confirmPhraseInput.length > 0 ? (
                  <p className="text-[11px] text-rose-400">
                    문구가 일치하지 않습니다. 회사명 띄어쓰기까지 정확하게 입력해주세요.
                  </p>
                ) : null}
              </div>

              <div className="space-y-1.5">
                <label className="text-xs text-gray-400 block">
                  파기 사유 (감사 기록용):
                </label>
                <input
                  type="text"
                  value={purgeReason}
                  onChange={e => setPurgeReason(e.target.value)}
                  disabled={isPurging}
                  className="w-full px-3 py-1.5 text-xs bg-gray-950 border border-gray-700 rounded-lg text-gray-200 focus:outline-none"
                />
              </div>

              <div className="pt-4 flex items-center justify-between">
                <button
                  type="button"
                  onClick={() => setStep(3)}
                  disabled={isPurging}
                  className="text-xs text-gray-400 hover:text-white disabled:opacity-40"
                >
                  ← 이전 단계
                </button>

                <button
                  type="button"
                  onClick={handleFinalPurge}
                  disabled={!isPhraseMatched || cooldownSeconds > 0 || isPurging}
                  className="px-6 py-2.5 text-xs font-bold rounded-lg bg-rose-600 hover:bg-rose-700 text-white flex items-center gap-2 transition-all shadow-lg disabled:opacity-40 disabled:cursor-not-allowed active:scale-95"
                >
                  {isPurging ? (
                    <>
                      <Loader2 size={16} className="animate-spin" />
                      <span>원자적 영구 파기 진행 중...</span>
                    </>
                  ) : cooldownSeconds > 0 ? (
                    <>
                      <Lock size={14} />
                      <span>안전 쿨다운 대기 중 ({cooldownSeconds}초)</span>
                    </>
                  ) : (
                    <>
                      <Skull size={16} />
                      <span>⚠️ 지금 즉시 모든 데이터 영구 파기 실행</span>
                    </>
                  )}
                </button>
              </div>
            </div>
          )}

          {/* STEP 5: 파기 완료 및 법적 증빙서 */}
          {step === 5 && purgeResult && (
            <div className="space-y-5 text-center py-4">
              <div className="w-16 h-16 bg-emerald-500/20 text-emerald-400 rounded-full flex items-center justify-center mx-auto border border-emerald-500/40">
                <CheckCircle2 size={36} />
              </div>

              <div className="space-y-1">
                <h3 className="text-lg font-bold text-white">데이터 영구 파기 완료</h3>
                <p className="text-xs text-gray-400">
                  {purgeResult.orgName} 소속의 모든 고객 DB와 통화 녹음이 물리적으로 완전 소멸되었습니다.
                </p>
              </div>

              {/* 법적 증빙 카드 */}
              <div className="p-4 bg-gray-950 rounded-xl border border-gray-800 text-left text-xs space-y-2.5 font-mono">
                <div className="flex items-center justify-between border-b border-gray-800 pb-2">
                  <span className="text-gray-400">증빙 문서</span>
                  <span className="text-emerald-400 font-bold">개인정보 파기 증빙서 (제21조)</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-400">파기 대상 회사</span>
                  <span className="text-white font-bold">{purgeResult.orgName}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-400">파기 일시 (KST)</span>
                  <span className="text-white">{new Date(purgeResult.executedAt).toLocaleString('ko-KR')}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-400">영구 소멸된 고객 DB</span>
                  <span className="text-rose-400 font-bold">{purgeResult.purgedCases.toLocaleString()} 건</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-400">영구 소멸된 통화 녹음</span>
                  <span className="text-rose-400 font-bold">{purgeResult.purgedRecordings.toLocaleString()} 건</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-400">영구 소멸된 수신거부(DNC)</span>
                  <span className="text-gray-300">{purgeResult.purgedDnc.toLocaleString()} 건</span>
                </div>
              </div>

              <div className="pt-3">
                <button
                  type="button"
                  onClick={handleFinishAndExit}
                  className="w-full py-3 bg-gray-800 hover:bg-gray-700 text-white rounded-xl text-sm font-bold transition-colors shadow-md"
                >
                  확인 및 안전 로그아웃
                </button>
              </div>
            </div>
          )}

        </div>

      </div>
    </div>
  );
};
