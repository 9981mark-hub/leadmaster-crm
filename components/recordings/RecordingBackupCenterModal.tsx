import React, { useState, useEffect, useMemo } from 'react';
import {
  X, Download, Archive, AlertTriangle, ShieldCheck, Clock,
  Search, CheckSquare, Square, Loader2, FileAudio, RefreshCw
} from 'lucide-react';
import JSZip from 'jszip';
import {
  ExpiringRecordingItem, fetchExpiringRecordings, getRecordingDownloadUrl, fmtBytes, fmtDuration
} from '../../services/recordings';
import { logAccess } from '../../services/accessLog';

interface Props {
  orgId: string;
  isOpen: boolean;
  onClose: () => void;
  showToast: (msg: string, type?: 'success' | 'error') => void;
}

export default function RecordingBackupCenterModal({
  orgId,
  isOpen,
  onClose,
  showToast
}: Props) {
  const [items, setItems] = useState<ExpiringRecordingItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [downloadingZip, setDownloadingZip] = useState(false);
  const [zipProgress, setZipProgress] = useState<{ current: number; total: number } | null>(null);

  const loadData = async () => {
    setLoading(true);
    try {
      const data = await fetchExpiringRecordings(orgId, 60); // 60일 이내 만료 대상 조회
      setItems(data);
      // 기본적으로 30일 이내 만료 대상을 전체 선택
      const urgentIds = new Set(data.filter(d => d.daysLeft <= 30).map(d => d.id));
      setSelectedIds(urgentIds);
    } catch (e: any) {
      showToast(`만료 예정 녹음을 불러오지 못했습니다: ${e.message}`, 'error');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (isOpen) {
      loadData();
    }
  }, [isOpen, orgId]);

  // 검색 필터링
  const filteredItems = useMemo(() => {
    if (!search.trim()) return items;
    const q = search.toLowerCase();
    return items.filter(it =>
      it.caseId.toLowerCase().includes(q) ||
      it.phone.includes(q) ||
      (it.summary && it.summary.toLowerCase().includes(q))
    );
  }, [items, search]);

  // 통계 계산
  const stats = useMemo(() => {
    const totalCount = items.length;
    const totalBytes = items.reduce((acc, cur) => acc + cur.sizeBytes, 0);
    const urgentCount = items.filter(it => it.daysLeft <= 30).length;
    const urgentBytes = items.filter(it => it.daysLeft <= 30).reduce((acc, cur) => acc + cur.sizeBytes, 0);
    return { totalCount, totalBytes, urgentCount, urgentBytes };
  }, [items]);

  // 전체 선택 / 해제
  const toggleSelectAll = () => {
    if (selectedIds.size === filteredItems.length) {
      setSelectedIds(new Set());
    } else {
      setSelectedIds(new Set(filteredItems.map(it => it.id)));
    }
  };

  const toggleSelect = (id: string) => {
    const next = new Set(selectedIds);
    if (next.has(id)) next.delete(id);
    else next.add(id);
    setSelectedIds(next);
  };

  // 단건 다운로드
  const handleDownloadSingle = async (it: ExpiringRecordingItem) => {
    try {
      const dlUrl = await getRecordingDownloadUrl({
        id: it.id,
        caseId: it.caseId,
        storagePath: it.storagePath,
        fileName: it.fileName,
        storageKind: 'supabase',
      } as any);
      logAccess('recording_download', { caseId: it.caseId, detail: { recording_id: it.id, source: 'backup_center' } });
      const a = document.createElement('a');
      a.href = dlUrl;
      a.download = it.fileName || `${it.caseId}_${it.callStartedAt}.m4a`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      showToast(`${it.caseId} 통화 녹음 다운로드를 시작했습니다.`, 'success');
    } catch (e: any) {
      showToast(`다운로드 실패: ${e.message}`, 'error');
    }
  };

  // 선택 녹음 일괄 ZIP 다운로드
  const handleDownloadZip = async () => {
    const targetItems = items.filter(it => selectedIds.has(it.id));
    if (targetItems.length === 0) {
      showToast('다운로드할 녹음 항목을 선택해주세요.', 'error');
      return;
    }

    setDownloadingZip(true);
    setZipProgress({ current: 0, total: targetItems.length });
    const zip = new JSZip();
    const folder = zip.folder('통화녹음_백업') || zip;

    try {
      let completed = 0;
      // 3개씩 병렬 다운로드
      const chunkSize = 3;
      for (let i = 0; i < targetItems.length; i += chunkSize) {
        const chunk = targetItems.slice(i, i + chunkSize);
        await Promise.all(chunk.map(async (it) => {
          try {
            const dlUrl = await getRecordingDownloadUrl({
              id: it.id,
              caseId: it.caseId,
              storagePath: it.storagePath,
              fileName: it.fileName,
              storageKind: 'supabase',
            } as any);
            const res = await fetch(dlUrl);
            if (res.ok) {
              const blob = await res.blob();
              const datePrefix = it.callStartedAt ? it.callStartedAt.slice(0, 10) : 'unknown_date';
              const cleanFileName = `${datePrefix}_${it.caseId}_${it.phone}_${it.id.slice(0, 8)}.m4a`;
              folder.file(cleanFileName, blob);
            }
          } catch (err) {
            console.error('Failed to fetch recording blob:', it.id, err);
          } finally {
            completed++;
            setZipProgress({ current: completed, total: targetItems.length });
          }
        }));
      }

      showToast('ZIP 압축 파일을 생성하는 중입니다…', 'success');
      const content = await zip.generateAsync({ type: 'blob' });
      const today = new Date().toISOString().slice(0, 10);
      const zipFileName = `리드마스터_통화녹음백업_${today}_(${targetItems.length}건).zip`;

      const a = document.createElement('a');
      a.href = URL.createObjectURL(content);
      a.download = zipFileName;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(a.href);

      logAccess('recording_download', {
        caseId: 'bulk_archive',
        detail: { count: targetItems.length, zipName: zipFileName }
      });

      showToast(`총 ${targetItems.length}건의 녹음 ZIP 다운로드가 완료되었습니다.`, 'success');
    } catch (e: any) {
      showToast(`ZIP 생성 실패: ${e.message}`, 'error');
    } finally {
      setDownloadingZip(false);
      setZipProgress(null);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-5 bg-black/60 backdrop-blur-xs">
      <div className="bg-white dark:bg-gray-900 rounded-3xl border border-gray-200 dark:border-gray-800 shadow-2xl w-full max-w-4xl max-h-[90vh] flex flex-col overflow-hidden animate-in fade-in zoom-in-95 duration-200">
        {/* 헤더 */}
        <div className="px-6 py-4.5 border-b border-gray-100 dark:border-gray-800 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-2xl bg-amber-500/10 text-amber-600 dark:text-amber-400 flex items-center justify-center">
              <Archive size={22} />
            </div>
            <div>
              <h2 className="text-lg font-bold text-gray-900 dark:text-white flex items-center gap-2">
                통화 녹음 만료 & 백업 센터
                <span className="text-xs px-2.5 py-0.5 rounded-full font-semibold bg-amber-100 text-amber-800 dark:bg-amber-950 dark:text-amber-300">
                  1년 보관 정책
                </span>
              </h2>
              <p className="text-xs text-gray-500 dark:text-gray-400">
                1년(365일)이 지난 오디오 파일은 자동 정리되므로, 만료 30일 전 PC나 외장하드로 일괄 백업하세요.
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-2 rounded-xl text-gray-400 hover:text-gray-700 dark:hover:text-gray-200 hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors"
          >
            <X size={20} />
          </button>
        </div>

        {/* 정책 및 만료 통계 배너 */}
        <div className="p-6 bg-slate-50 dark:bg-gray-800/40 border-b border-gray-100 dark:border-gray-800 space-y-4">
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <div className="bg-white dark:bg-gray-800 p-3.5 rounded-2xl border border-slate-200/80 dark:border-gray-700 shadow-xs flex items-center gap-3">
              <div className="w-9 h-9 rounded-xl bg-amber-50 dark:bg-amber-950/60 text-amber-600 flex items-center justify-center shrink-0">
                <AlertTriangle size={18} />
              </div>
              <div>
                <div className="text-xs text-gray-400 font-medium">30일 이내 만료 예정</div>
                <div className="text-base font-bold text-amber-600 dark:text-amber-400">
                  {stats.urgentCount}건 ({fmtBytes(stats.urgentBytes)})
                </div>
              </div>
            </div>

            <div className="bg-white dark:bg-gray-800 p-3.5 rounded-2xl border border-slate-200/80 dark:border-gray-700 shadow-xs flex items-center gap-3">
              <div className="w-9 h-9 rounded-xl bg-blue-50 dark:bg-blue-950/60 text-blue-600 flex items-center justify-center shrink-0">
                <Clock size={18} />
              </div>
              <div>
                <div className="text-xs text-gray-400 font-medium">60일 이내 만료 예정</div>
                <div className="text-base font-bold text-gray-800 dark:text-gray-100">
                  {stats.totalCount}건 ({fmtBytes(stats.totalBytes)})
                </div>
              </div>
            </div>

            <div className="bg-white dark:bg-gray-800 p-3.5 rounded-2xl border border-slate-200/80 dark:border-gray-700 shadow-xs flex items-center gap-3">
              <div className="w-9 h-9 rounded-xl bg-green-50 dark:bg-green-950/60 text-green-600 flex items-center justify-center shrink-0">
                <ShieldCheck size={18} />
              </div>
              <div>
                <div className="text-xs text-gray-400 font-medium">AI 요약/대화록 영구 보존</div>
                <div className="text-xs font-semibold text-green-600 dark:text-green-400">
                  파일 삭제 후에도 텍스트 보존
                </div>
              </div>
            </div>
          </div>

          {/* 검색 및 액션 컨트롤 */}
          <div className="flex flex-wrap items-center justify-between gap-3 pt-1">
            <div className="relative flex-1 min-w-[240px]">
              <Search size={15} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-gray-400" />
              <input
                type="text"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="사건번호, 전화번호, 요약 검색…"
                className="w-full pl-9 pr-3 py-2 text-xs rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900 text-gray-800 dark:text-gray-100 focus:outline-hidden focus:ring-2 focus:ring-amber-500"
              />
            </div>

            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={loadData}
                disabled={loading}
                className="p-2 rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 text-gray-600 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700 text-xs flex items-center gap-1 transition-colors"
                title="새로고침"
              >
                <RefreshCw size={14} className={loading ? 'animate-spin' : ''} />
              </button>

              <button
                type="button"
                onClick={handleDownloadZip}
                disabled={downloadingZip || selectedIds.size === 0}
                className="py-2 px-4 rounded-xl bg-amber-600 hover:bg-amber-700 active:scale-95 text-white text-xs font-bold flex items-center gap-1.5 shadow-sm transition-all disabled:opacity-50"
              >
                {downloadingZip ? (
                  <>
                    <Loader2 size={14} className="animate-spin" />
                    <span>
                      압축 중 ({zipProgress ? `${zipProgress.current}/${zipProgress.total}` : '준비'})…
                    </span>
                  </>
                ) : (
                  <>
                    <Download size={14} />
                    <span>선택 녹음 {selectedIds.size}건 일괄 ZIP 다운로드</span>
                  </>
                )}
              </button>
            </div>
          </div>
        </div>

        {/* 목록 테이블 */}
        <div className="flex-1 overflow-y-auto p-6">
          {loading ? (
            <div className="py-20 flex flex-col items-center justify-center gap-3 text-gray-400">
              <Loader2 size={32} className="animate-spin text-amber-500" />
              <span className="text-xs">만료 예정 녹음 목록을 조회하고 있습니다…</span>
            </div>
          ) : filteredItems.length === 0 ? (
            <div className="py-20 flex flex-col items-center justify-center gap-2 text-gray-400">
              <ShieldCheck size={36} className="text-green-500 mb-1" />
              <span className="text-sm font-semibold text-gray-700 dark:text-gray-200">
                만료 임박 대상 녹음이 없습니다.
              </span>
              <span className="text-xs text-gray-400">
                모든 통화 녹음이 1년 보관 정책 내에서 안전하게 유지되고 있습니다.
              </span>
            </div>
          ) : (
            <div className="space-y-2">
              <div className="flex items-center justify-between pb-2 px-1 text-xs text-gray-500 border-b border-gray-100 dark:border-gray-800">
                <button
                  type="button"
                  onClick={toggleSelectAll}
                  className="flex items-center gap-2 font-semibold hover:text-gray-700 dark:hover:text-gray-200"
                >
                  {selectedIds.size === filteredItems.length ? (
                    <CheckSquare size={16} className="text-amber-600" />
                  ) : (
                    <Square size={16} />
                  )}
                  <span>전체 선택 ({selectedIds.size}/{filteredItems.length})</span>
                </button>
                <span>만료 잔여일 순 정렬</span>
              </div>

              {filteredItems.map((it) => {
                const isSelected = selectedIds.has(it.id);
                const isUrgent = it.daysLeft <= 30;

                return (
                  <div
                    key={it.id}
                    className={`p-3.5 rounded-2xl border transition-all flex items-center justify-between gap-3 ${
                      isSelected
                        ? 'bg-amber-50/60 dark:bg-amber-950/20 border-amber-300 dark:border-amber-800'
                        : 'bg-white dark:bg-gray-800/80 border-gray-200 dark:border-gray-700 hover:border-gray-300'
                    }`}
                  >
                    <div className="flex items-center gap-3 min-w-0">
                      <button
                        type="button"
                        onClick={() => toggleSelect(it.id)}
                        className="text-gray-400 hover:text-amber-600 shrink-0"
                      >
                        {isSelected ? (
                          <CheckSquare size={18} className="text-amber-600" />
                        ) : (
                          <Square size={18} />
                        )}
                      </button>

                      <div className="w-8 h-8 rounded-xl bg-slate-100 dark:bg-gray-700 flex items-center justify-center shrink-0 text-gray-500">
                        <FileAudio size={16} />
                      </div>

                      <div className="min-w-0">
                        <div className="flex items-center gap-2 flex-wrap">
                          <span className="text-xs font-bold text-gray-900 dark:text-gray-100">
                            {it.caseId}
                          </span>
                          <span className="text-xs font-mono text-gray-500">
                            {it.phone}
                          </span>
                          <span className="text-xs text-gray-400">
                            {it.callStartedAt?.slice(0, 16).replace('T', ' ')} ({fmtDuration(it.durationSec)})
                          </span>
                          <span className="text-xs text-gray-400">
                            {fmtBytes(it.sizeBytes)}
                          </span>
                        </div>
                        {it.summary && (
                          <p className="text-xs text-gray-500 dark:text-gray-400 truncate mt-0.5 max-w-lg">
                            {it.summary}
                          </p>
                        )}
                      </div>
                    </div>

                    <div className="flex items-center gap-3 shrink-0">
                      {isUrgent ? (
                        <span className="px-2.5 py-1 rounded-lg text-xs font-bold bg-red-100 text-red-700 dark:bg-red-950 dark:text-red-300 flex items-center gap-1 border border-red-200 dark:border-red-800">
                          <AlertTriangle size={13} />
                          <span>D-{it.daysLeft} 만료</span>
                        </span>
                      ) : (
                        <span className="px-2 py-0.5 rounded-md text-xs font-medium text-gray-500 dark:text-gray-400 bg-gray-100 dark:bg-gray-700">
                          D-{it.daysLeft}
                        </span>
                      )}

                      <button
                        type="button"
                        onClick={() => handleDownloadSingle(it)}
                        className="p-2 rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-700 text-gray-600 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-600 transition-colors"
                        title="개별 다운로드"
                      >
                        <Download size={15} />
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* 풋터 */}
        <div className="px-6 py-4 border-t border-gray-100 dark:border-gray-800 bg-slate-50 dark:bg-gray-900/60 flex items-center justify-between text-xs text-gray-500">
          <div className="flex items-center gap-1.5">
            <ShieldCheck size={14} className="text-green-500" />
            <span>다운로드 실행 시 정보보호 및 컴플라이언스를 위해 감사 로그에 영구 기록됩니다.</span>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2 rounded-xl border border-gray-300 dark:border-gray-700 bg-white dark:bg-gray-800 text-gray-700 dark:text-gray-200 font-semibold hover:bg-gray-50"
          >
            닫기
          </button>
        </div>
      </div>
    </div>
  );
}
