import React, { useRef, useState } from 'react';
import {
  PhoneIncoming, PhoneOutgoing, Clock, Upload, Loader2, Sparkles,
  History, RotateCcw, AlertCircle, CheckCircle2
} from 'lucide-react';
import { CaseCallItem } from '../../services/callHistory';
import { uploadRecordingToDrive, requestAnalyze } from '../../services/recordings';

interface CallHistoryTimelineProps {
  caseId: string;
  phone?: string;
  calls: CaseCallItem[];
  selectedId: string | null;
  onSelectCall: (id: string) => void;
  isLatestSelected: boolean;
  onRefresh: () => Promise<void>;
  showToast: (msg: string, type?: 'success' | 'error') => void;
  className?: string;
}

export const CallHistoryTimeline: React.FC<CallHistoryTimelineProps> = ({
  caseId,
  phone,
  calls,
  selectedId,
  onSelectCall,
  isLatestSelected,
  onRefresh,
  showToast,
  className = '',
}) => {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [uploading, setUploading] = useState(false);
  const [uploadStep, setUploadStep] = useState<string>('');

  const latestCall = calls.find(c => c.isLatest) || calls[0];
  const selectedCall = calls.find(c => c.id === selectedId) || latestCall;

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setUploading(true);
    setUploadStep('업로드 준비 중...');
    try {
      showToast('녹음 파일 업로드를 시작합니다.');
      const r = await uploadRecordingToDrive(caseId, phone || '', file, (step) => {
        setUploadStep(step);
      });

      if (!r.exists && r.recordingId) {
        setUploadStep('AI 분석 요청 중...');
        await requestAnalyze(r.recordingId, true);
        showToast('✅ 파일 업로드 완료! AI 분석이 시작되었습니다. 1~2분 뒤 요약이 갱신됩니다.', 'success');

        // Background monitor for completion
        import('../../services/recordings').then(({ waitAnalyzed }) => {
          waitAnalyzed(r.recordingId, 180_000).then(async (done) => {
            if (done?.status === 'done') {
              await onRefresh();
              window.dispatchEvent(new CustomEvent('crm:call_history_reload'));
              showToast('✅ 통화 분석이 완료되어 요약문과 대화록이 갱신되었습니다.', 'success');
            }
          }).catch(() => {});
        });
      } else {
        showToast('이미 보관된 파일입니다.', 'success');
      }

      await onRefresh();
      window.dispatchEvent(new CustomEvent('crm:call_history_reload'));
    } catch (err: any) {
      console.error('Manual recording upload failed:', err);
      showToast(`업로드 실패: ${err?.message || '알 수 없는 오류'}`, 'error');
    } finally {
      setUploading(false);
      setUploadStep('');
      if (e.target) e.target.value = '';
    }
  };

  // If there are no calls and no active summary, show empty prompt with upload button
  if (calls.length === 0) {
    return (
      <div className={`bg-slate-50 dark:bg-gray-800/70 p-3.5 rounded-xl border border-slate-200 dark:border-gray-700 flex items-center justify-between gap-3 ${className}`}>
        <div className="flex items-center gap-2 text-xs text-gray-500 dark:text-gray-400">
          <History size={16} className="text-purple-600" />
          <span>등록된 통화 분석 기록이 없습니다. 통화 녹음 파일을 업로드해보세요.</span>
        </div>
        <div>
          <input
            type="file"
            ref={fileInputRef}
            className="hidden"
            accept="audio/*"
            onChange={handleFileChange}
          />
          <button
            type="button"
            disabled={uploading}
            onClick={() => fileInputRef.current?.click()}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold bg-purple-600 hover:bg-purple-700 text-white rounded-lg transition-colors shadow-xs disabled:opacity-50"
          >
            {uploading ? (
              <>
                <Loader2 size={13} className="animate-spin" />
                <span>{uploadStep || '업로드 중...'}</span>
              </>
            ) : (
              <>
                <Upload size={13} />
                <span>+ 녹음 직접 올려 요약</span>
              </>
            )}
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className={`space-y-2.5 ${className}`}>
      {/* 1. Header Bar: Title + Call Count + Upload Button */}
      <div className="bg-slate-50 dark:bg-gray-800/80 p-3 rounded-xl border border-slate-200 dark:border-gray-700 shadow-xs">
        <div className="flex flex-wrap items-center justify-between gap-2 mb-2 pb-2 border-b border-slate-200/70 dark:border-gray-700/60">
          <div className="flex items-center gap-2">
            <span className="p-1 rounded-md bg-purple-100 dark:bg-purple-950/60 text-purple-700 dark:text-purple-300">
              <History size={15} />
            </span>
            <span className="text-xs sm:text-sm font-bold text-gray-800 dark:text-gray-100">
              통화 히스토리
            </span>
            <span className="text-xs px-2 py-0.5 rounded-full bg-purple-50 dark:bg-purple-950/50 text-purple-700 dark:text-purple-300 font-semibold border border-purple-200 dark:border-purple-800">
              총 {calls.length}회 통화
            </span>
          </div>

          <div className="flex items-center gap-2">
            <input
              type="file"
              ref={fileInputRef}
              className="hidden"
              accept="audio/*"
              onChange={handleFileChange}
            />
            <button
              type="button"
              disabled={uploading}
              onClick={() => fileInputRef.current?.click()}
              className="inline-flex items-center gap-1 px-2.5 py-1 text-xs font-semibold bg-purple-600 hover:bg-purple-700 text-white rounded-lg transition-colors shadow-2xs disabled:opacity-50"
              title="컴퓨터에 저장된 통화 녹음 파일을 직접 올려 AI 요약을 생성합니다"
            >
              {uploading ? (
                <>
                  <Loader2 size={12} className="animate-spin" />
                  <span>{uploadStep || '업로드 중...'}</span>
                </>
              ) : (
                <>
                  <Upload size={12} />
                  <span>+ 녹음 직접 올려 요약</span>
                </>
              )}
            </button>
          </div>
        </div>

        {/* 2. Timeline Chips Bar (Horizontal Scrollable) */}
        <div className="flex items-center gap-2 overflow-x-auto py-1 scrollbar-thin">
          {calls.map((call) => {
            const isSelected = call.id === selectedId;
            return (
              <button
                key={call.id}
                type="button"
                onClick={() => onSelectCall(call.id)}
                className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium whitespace-nowrap transition-all shrink-0 ${
                  isSelected
                    ? 'bg-purple-600 text-white shadow-sm ring-2 ring-purple-300 dark:ring-purple-900 font-bold'
                    : 'bg-white dark:bg-gray-700/80 text-gray-700 dark:text-gray-200 border border-gray-200 dark:border-gray-600 hover:border-purple-300 dark:hover:border-purple-600 hover:bg-purple-50/50 dark:hover:bg-gray-700'
                }`}
              >
                {/* Direction Icon */}
                {call.direction === 'CALL_IN' ? (
                  <PhoneIncoming size={12} className={isSelected ? 'text-green-300' : 'text-green-600 dark:text-green-400'} />
                ) : (
                  <PhoneOutgoing size={12} className={isSelected ? 'text-blue-200' : 'text-blue-500 dark:text-blue-400'} />
                )}

                {/* Call Number */}
                <span>{call.callNumber}차 통화</span>

                {/* Call Date / Time */}
                <span className={`text-[11px] ${isSelected ? 'text-purple-100' : 'text-gray-500 dark:text-gray-400'}`}>
                  {call.formattedDate}
                </span>

                {/* Duration if available */}
                {call.durationLabel && (
                  <span className={`text-[10px] ${isSelected ? 'text-purple-200' : 'text-gray-400'}`}>
                    ({call.durationLabel})
                  </span>
                )}

                {/* Latest Badge */}
                {call.isLatest && (
                  <span
                    className={`ml-0.5 px-1.5 py-0.2 rounded-full text-[10px] font-bold ${
                      isSelected
                        ? 'bg-white text-purple-700'
                        : 'bg-purple-100 text-purple-700 dark:bg-purple-900/60 dark:text-purple-200'
                    }`}
                  >
                    최신
                  </span>
                )}

                {/* Manual Source Tag */}
                {call.source === 'manual' && !call.isLatest && (
                  <span className={`text-[10px] opacity-75 ${isSelected ? 'text-purple-200' : 'text-gray-400'}`}>
                    수동
                  </span>
                )}

                {/* Status indicator if not done */}
                {(call.status === 'processing' || call.status === 'uploaded') && (
                  <span className={`inline-flex items-center gap-0.5 text-[10px] ${isSelected ? 'text-amber-200' : 'text-amber-600 dark:text-amber-400'}`}>
                    <Loader2 size={11} className="animate-spin" />
                    <span>분석중</span>
                  </span>
                )}
                {call.status === 'failed' && (
                  <AlertCircle size={11} className="text-red-400" />
                )}
              </button>
            );
          })}
        </div>
      </div>

      {/* 3. Past Call Inspection Banner (When a past call is selected) */}
      {!isLatestSelected && selectedCall && (
        <div className="bg-amber-50 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-900/60 rounded-xl px-4 py-2.5 flex flex-wrap items-center justify-between gap-2 animate-in fade-in duration-150">
          <div className="flex items-center gap-2 text-xs text-amber-900 dark:text-amber-200">
            <Clock size={15} className="text-amber-600 shrink-0" />
            <span>
              <b>{selectedCall.callNumber}차 통화</b> ({selectedCall.formattedDate}) 기록을 조회하고 있습니다. <span className="opacity-75">(과거 기록은 읽기 전용으로 보존됩니다)</span>
            </span>
          </div>
          {latestCall && (
            <button
              type="button"
              onClick={() => onSelectCall(latestCall.id)}
              className="inline-flex items-center gap-1 px-2.5 py-1 text-xs font-bold text-amber-800 dark:text-amber-200 bg-white dark:bg-gray-800 border border-amber-300 dark:border-amber-700 rounded-lg hover:bg-amber-100/50 dark:hover:bg-gray-700 transition-colors shadow-2xs"
            >
              <RotateCcw size={12} />
              <span>최신 통화로 돌아가기</span>
            </button>
          )}
        </div>
      )}
    </div>
  );
};
