/**
 * AutoDialReport.tsx
 * 자동 통화 완료 리포트 화면
 * 
 * NOTE: 완전히 신규 파일 — 기존 시스템에 영향 없음
 */
import React, { useState, useEffect } from 'react';
import {
  Phone, PhoneOff, PhoneMissed, CheckCircle2,
  SkipForward, Clock, BarChart3, Download,
  RefreshCw, ArrowLeft, Loader2, AlertCircle
} from 'lucide-react';
import { useToast } from '../../contexts/ToastContext';
import {
  AutoDialBatch, AutoDialItem,
  fetchBatch, fetchBatchItems
} from '../../services/autoDialService';

interface AutoDialReportProps {
  batchId: string;
  onClose: () => void;
  onRebatch?: (failedItems: AutoDialItem[]) => void;
}

const AutoDialReport: React.FC<AutoDialReportProps> = ({ batchId, onClose, onRebatch }) => {
  const { showToast } = useToast();
  const [batch, setBatch] = useState<AutoDialBatch | null>(null);
  const [items, setItems] = useState<AutoDialItem[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    (async () => {
      try {
        const [b, i] = await Promise.all([
          fetchBatch(batchId),
          fetchBatchItems(batchId)
        ]);
        setBatch(b);
        setItems(i);
      } catch (err) {
        console.error('[Report] Load error:', err);
      } finally {
        setLoading(false);
      }
    })();
  }, [batchId]);

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 className="w-10 h-10 animate-spin text-blue-500" />
      </div>
    );
  }

  if (!batch) {
    return (
      <div className="text-center py-12 text-gray-500">
        <p>리포트를 찾을 수 없습니다</p>
        <button onClick={onClose} className="mt-4 text-blue-500 hover:underline">돌아가기</button>
      </div>
    );
  }

  const connected = items.filter(i => i.result === 'connected');
  const noAnswer = items.filter(i => i.result === 'no_answer');
  const busy = items.filter(i => i.result === 'busy');
  const skipped = items.filter(i => i.status === 'skipped');
  const errors = items.filter(i => i.result === 'error' || i.result === 'invalid');
  const failedItems = [...noAnswer, ...busy, ...errors];

  // Duration calculation
  const startTime = batch.startedAt ? new Date(batch.startedAt) : null;
  const endTime = batch.completedAt ? new Date(batch.completedAt) : null;
  const durationMs = startTime && endTime ? endTime.getTime() - startTime.getTime() : 0;
  const durationMin = Math.floor(durationMs / 60000);
  const durationSec = Math.floor((durationMs % 60000) / 1000);

  const avgRingDuration = items.filter(i => i.ringDurationSeconds).length > 0
    ? Math.round(items.reduce((sum, i) => sum + (i.ringDurationSeconds || 0), 0) / items.filter(i => i.ringDurationSeconds).length)
    : 0;

  const getResultIcon = (result?: string | null) => {
    switch (result) {
      case 'connected': return <CheckCircle2 size={16} className="text-green-500" />;
      case 'no_answer': return <PhoneMissed size={16} className="text-orange-500" />;
      case 'busy': return <PhoneOff size={16} className="text-red-500" />;
      case 'error': case 'invalid': return <AlertCircle size={16} className="text-red-500" />;
      default: return <SkipForward size={16} className="text-gray-400" />;
    }
  };

  const getResultLabel = (item: AutoDialItem) => {
    if (item.status === 'skipped') return '건너뜀';
    switch (item.result) {
      case 'connected': return '연결';
      case 'no_answer': return '미응답';
      case 'busy': return '통화중';
      case 'rejected': return '거절';
      case 'error': return '오류';
      case 'invalid': return '잘못된 번호';
      default: return '-';
    }
  };

  return (
    <div className="max-w-3xl mx-auto space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-xl font-bold text-gray-900 dark:text-white flex items-center gap-2">
            <BarChart3 className="text-blue-500" size={24} />
            자동 통화 완료 리포트
          </h2>
          <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">배치: {batch.name}</p>
        </div>
        <button
          onClick={onClose}
          className="flex items-center gap-1 text-sm text-gray-500 hover:text-gray-700 dark:hover:text-gray-300"
        >
          <ArrowLeft size={16} />
          돌아가기
        </button>
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <div className="bg-white dark:bg-gray-800 rounded-xl p-4 border border-gray-200 dark:border-gray-700 text-center">
          <p className="text-2xl font-bold text-gray-900 dark:text-white">{batch.totalCount}</p>
          <p className="text-sm text-gray-500">총 처리</p>
        </div>
        <div className="bg-white dark:bg-gray-800 rounded-xl p-4 border border-green-200 dark:border-green-800 text-center">
          <p className="text-2xl font-bold text-green-600">{connected.length}</p>
          <p className="text-sm text-gray-500">✅ 연결</p>
          <p className="text-xs text-green-600 mt-1">
            {batch.totalCount > 0 ? Math.round((connected.length / batch.totalCount) * 100) : 0}%
          </p>
        </div>
        <div className="bg-white dark:bg-gray-800 rounded-xl p-4 border border-orange-200 dark:border-orange-800 text-center">
          <p className="text-2xl font-bold text-orange-500">{noAnswer.length}</p>
          <p className="text-sm text-gray-500">📵 미응답</p>
          <p className="text-xs text-orange-500 mt-1">
            {batch.totalCount > 0 ? Math.round((noAnswer.length / batch.totalCount) * 100) : 0}%
          </p>
        </div>
        <div className="bg-white dark:bg-gray-800 rounded-xl p-4 border border-red-200 dark:border-red-800 text-center">
          <p className="text-2xl font-bold text-red-500">{busy.length + skipped.length}</p>
          <p className="text-sm text-gray-500">📞 통화중/건너뜀</p>
          <p className="text-xs text-red-500 mt-1">
            {batch.totalCount > 0 ? Math.round(((busy.length + skipped.length) / batch.totalCount) * 100) : 0}%
          </p>
        </div>
      </div>

      {/* Duration Stats */}
      <div className="bg-white dark:bg-gray-800 rounded-xl p-4 border border-gray-200 dark:border-gray-700">
        <div className="flex items-center justify-around text-sm">
          <div className="text-center">
            <p className="text-gray-500 dark:text-gray-400">소요 시간</p>
            <p className="font-bold text-gray-900 dark:text-white mt-1">{durationMin}분 {durationSec}초</p>
          </div>
          <div className="w-px h-8 bg-gray-200 dark:bg-gray-700" />
          <div className="text-center">
            <p className="text-gray-500 dark:text-gray-400">평균 벨 시간</p>
            <p className="font-bold text-gray-900 dark:text-white mt-1">{avgRingDuration}초</p>
          </div>
          <div className="w-px h-8 bg-gray-200 dark:bg-gray-700" />
          <div className="text-center">
            <p className="text-gray-500 dark:text-gray-400">연결률</p>
            <p className="font-bold text-green-600 mt-1">
              {batch.totalCount > 0 ? Math.round((connected.length / batch.totalCount) * 100) : 0}%
            </p>
          </div>
        </div>
      </div>

      {/* Detailed Table */}
      <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 overflow-hidden">
        <div className="px-4 py-3 border-b border-gray-200 dark:border-gray-700">
          <h3 className="text-sm font-medium text-gray-700 dark:text-gray-300">상세 내역</h3>
        </div>
        <div className="max-h-96 overflow-y-auto">
          {items.map((item, idx) => (
            <div
              key={item.id}
              className="flex items-center justify-between px-4 py-2.5 border-b border-gray-50 dark:border-gray-700 last:border-0 hover:bg-gray-50 dark:hover:bg-gray-750"
            >
              <div className="flex items-center gap-3">
                <span className="text-xs text-gray-400 w-6 text-right">{idx + 1}</span>
                {getResultIcon(item.status === 'skipped' ? 'skipped' : item.result)}
                <span className="text-sm font-medium text-gray-900 dark:text-white">{item.customerName}</span>
                <span className="text-xs text-gray-500">{item.phone}</span>
              </div>
              <div className="flex items-center gap-3">
                <span className={`text-xs px-2 py-0.5 rounded-full ${
                  item.result === 'connected' ? 'bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-400' :
                  item.result === 'no_answer' ? 'bg-orange-100 dark:bg-orange-900/30 text-orange-700 dark:text-orange-400' :
                  item.result === 'busy' ? 'bg-red-100 dark:bg-red-900/30 text-red-700 dark:text-red-400' :
                  'bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-400'
                }`}>
                  {getResultLabel(item)}
                </span>
                {item.ringDurationSeconds !== undefined && item.ringDurationSeconds > 0 && (
                  <span className="text-xs text-gray-400 flex items-center gap-1">
                    <Clock size={12} />
                    {item.ringDurationSeconds}초
                  </span>
                )}
                {item.resultMemo && (
                  <span className="text-xs text-gray-500 max-w-[120px] truncate" title={item.resultMemo}>
                    {item.resultMemo}
                  </span>
                )}
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Actions */}
      <div className="flex justify-center gap-3 pb-4">
        {failedItems.length > 0 && onRebatch && (
          <button
            onClick={() => onRebatch(failedItems)}
            className="px-4 py-2.5 bg-orange-100 dark:bg-orange-900/30 text-orange-700 dark:text-orange-400 rounded-xl hover:bg-orange-200 transition-colors flex items-center gap-2"
          >
            <RefreshCw size={18} />
            미연결 {failedItems.length}건 재배치
          </button>
        )}
        <button
          onClick={onClose}
          className="px-6 py-2.5 bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300 rounded-xl hover:bg-gray-200 dark:hover:bg-gray-600 transition-colors"
        >
          닫기
        </button>
      </div>
    </div>
  );
};

export default AutoDialReport;
