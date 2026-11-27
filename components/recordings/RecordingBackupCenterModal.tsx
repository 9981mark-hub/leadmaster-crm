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
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-5 bg-background/80 backdrop-blur-xs animate-in fade-in duration-200 overflow-y-auto">
      <div className="relative w-full max-w-4xl max-h-[88vh] my-auto flex flex-col rounded-2xl bg-card border border-border shadow-2xl overflow-hidden text-card-foreground">
        {/* 헤더 */}
        <div className="px-5 sm:px-6 py-4 border-b border-border flex items-center justify-between shrink-0 bg-card">
          <div className="flex items-center gap-3.5">
            <div className="w-11 h-11 rounded-xl bg-primary/10 text-primary border border-primary/20 flex items-center justify-center shrink-0">
              <Archive size={22} />
            </div>
            <div>
              <h2 className="text-lg font-bold text-foreground flex items-center gap-2">
                통화 녹음 만료 & 백업 센터
                <span className="text-xs px-2.5 py-0.5 rounded-full font-bold bg-primary/15 text-primary border border-primary/30">
                  6개월 보관 · 3주 유예
                </span>
              </h2>
              <p className="text-xs text-muted-foreground mt-0.5">
                6개월(180일) 만료 30일 전(5개월차)부터 알림을 드리며, 만료 후 3주(21일) 유예 기간이 지나면 오디오 파일이 자동 삭제됩니다.
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-lg text-muted-foreground hover:text-foreground hover:bg-muted transition-colors cursor-pointer"
          >
            <X size={18} />
          </button>
        </div>

        {/* 정책 및 만료 통계 배너 */}
        <div className="p-5 sm:p-6 bg-muted/30 border-b border-border space-y-4 shrink-0">
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <div className="bg-card p-3.5 rounded-xl border border-border shadow-2xs flex items-center gap-3">
              <div className="w-9 h-9 rounded-xl bg-rose-500/10 text-rose-500 border border-rose-500/20 flex items-center justify-center shrink-0">
                <AlertTriangle size={18} />
              </div>
              <div>
                <div className="text-xs text-muted-foreground font-medium">30일 이내 만료 예정</div>
                <div className="text-base font-bold text-rose-500">
                  {stats.urgentCount}건 ({fmtBytes(stats.urgentBytes)})
                </div>
              </div>
            </div>

            <div className="bg-card p-3.5 rounded-xl border border-border shadow-2xs flex items-center gap-3">
              <div className="w-9 h-9 rounded-xl bg-blue-500/10 text-blue-500 border border-blue-500/20 flex items-center justify-center shrink-0">
                <Clock size={18} />
              </div>
              <div>
                <div className="text-xs text-muted-foreground font-medium">60일 이내 만료 예정</div>
                <div className="text-base font-bold text-foreground">
                  {stats.totalCount}건 ({fmtBytes(stats.totalBytes)})
                </div>
              </div>
            </div>

            <div className="bg-card p-3.5 rounded-xl border border-border shadow-2xs flex items-center gap-3">
              <div className="w-9 h-9 rounded-xl bg-emerald-500/10 text-emerald-500 border border-emerald-500/20 flex items-center justify-center shrink-0">
                <ShieldCheck size={18} />
              </div>
              <div>
                <div className="text-xs text-muted-foreground font-medium">AI 요약/대화록 영구 보존</div>
                <div className="text-xs font-semibold text-emerald-500 dark:text-emerald-400">
                  파일 삭제 후에도 텍스트 보존
                </div>
              </div>
            </div>
          </div>

          {/* 검색 및 액션 컨트롤 */}
          <div className="flex flex-wrap items-center justify-between gap-3 pt-1">
            <div className="relative flex-1 min-w-[240px]">
              <Search size={15} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-muted-foreground" />
              <input
                type="text"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="사건번호, 전화번호, 요약 검색…"
                className="w-full pl-9 pr-3 py-2 text-xs rounded-xl border border-border bg-card text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-primary"
              />
            </div>

            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={loadData}
                disabled={loading}
                className="p-2 rounded-xl border border-border bg-secondary hover:bg-muted text-muted-foreground hover:text-foreground text-xs flex items-center gap-1 transition-colors cursor-pointer"
                title="새로고침"
              >
                <RefreshCw size={14} className={loading ? 'animate-spin' : ''} />
              </button>

              <button
                type="button"
                onClick={handleDownloadZip}
                disabled={downloadingZip || selectedIds.size === 0}
                className="py-2 px-4 rounded-xl bg-primary hover:bg-primary/90 active:scale-95 text-primary-foreground text-xs font-bold flex items-center gap-1.5 shadow-2xs transition-all disabled:opacity-50 cursor-pointer"
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
        <div className="flex-1 overflow-y-auto p-5 sm:p-6 bg-background/50">
          {loading ? (
            <div className="py-20 flex flex-col items-center justify-center gap-3 text-muted-foreground">
              <Loader2 size={32} className="animate-spin text-primary" />
              <span className="text-xs">만료 예정 녹음 목록을 조회하고 있습니다…</span>
            </div>
          ) : filteredItems.length === 0 ? (
            <div className="py-20 flex flex-col items-center justify-center gap-2 text-muted-foreground">
              <ShieldCheck size={36} className="text-primary mb-1" />
              <span className="text-sm font-semibold text-foreground">
                만료 임박 대상 녹음이 없습니다.
              </span>
              <span className="text-xs text-muted-foreground">
                모든 통화 녹음이 1년 보관 정책 내에서 안전하게 유지되고 있습니다.
              </span>
            </div>
          ) : (
            <div className="space-y-2">
              <div className="flex items-center justify-between pb-2 px-1 text-xs text-muted-foreground border-b border-border">
                <button
                  type="button"
                  onClick={toggleSelectAll}
                  className="flex items-center gap-2 font-semibold hover:text-foreground cursor-pointer"
                >
                  {selectedIds.size === filteredItems.length ? (
                    <CheckSquare size={16} className="text-primary" />
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
                    className={`p-3.5 rounded-xl border transition-all flex items-center justify-between gap-3 ${
                      isSelected
                        ? 'bg-primary/10 border-primary/30'
                        : 'bg-card border-border hover:bg-muted/30'
                    }`}
                  >
                    <div className="flex items-center gap-3 min-w-0">
                      <button
                        type="button"
                        onClick={() => toggleSelect(it.id)}
                        className="text-muted-foreground hover:text-foreground cursor-pointer shrink-0"
                      >
                        {isSelected ? (
                          <CheckSquare size={18} className="text-primary" />
                        ) : (
                          <Square size={18} />
                        )}
                      </button>

                      <div className="w-8 h-8 rounded-lg bg-muted text-muted-foreground flex items-center justify-center shrink-0">
                        <FileAudio size={16} />
                      </div>

                      <div className="min-w-0">
                        <div className="flex items-center gap-2 flex-wrap">
                          <span className="text-xs font-bold text-foreground">
                            {it.caseId}
                          </span>
                          <span className="text-xs font-mono text-muted-foreground">
                            {it.phone}
                          </span>
                          <span className="text-xs text-muted-foreground">·</span>
                          <span className="text-xs text-muted-foreground">
                            {it.callStartedAt?.slice(0, 16).replace('T', ' ')} ({fmtDuration(it.durationSec)})
                          </span>
                          <span className="text-xs text-muted-foreground">·</span>
                          <span className="text-xs text-muted-foreground">
                            {fmtBytes(it.sizeBytes)}
                          </span>
                        </div>
                        {it.summary && (
                          <p className="text-xs text-muted-foreground truncate mt-0.5 max-w-lg">
                            {it.summary}
                          </p>
                        )}
                      </div>
                    </div>

                    <div className="flex items-center gap-3 shrink-0">
                      {it.daysLeft <= 0 ? (
                        <span className="px-2.5 py-1 rounded-lg text-xs font-bold bg-rose-500/15 text-rose-600 dark:text-rose-400 border border-rose-500/30 flex items-center gap-1">
                          <AlertTriangle size={13} />
                          <span>유예 {Math.max(0, 21 + it.daysLeft)}일 남음</span>
                        </span>
                      ) : isUrgent ? (
                        <span className="px-2.5 py-1 rounded-lg text-xs font-bold bg-rose-500/10 text-rose-500 border border-rose-500/20 flex items-center gap-1">
                          <AlertTriangle size={13} />
                          <span>D-{it.daysLeft} 만료</span>
                        </span>
                      ) : (
                        <span className="px-2 py-0.5 rounded-md text-xs font-medium text-muted-foreground bg-muted border border-border">
                          D-{it.daysLeft}
                        </span>
                      )}

                      <button
                        type="button"
                        onClick={() => handleDownloadSingle(it)}
                        className="p-2 rounded-xl border border-border bg-card text-muted-foreground hover:text-foreground hover:bg-muted transition-colors cursor-pointer"
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
        <div className="p-4 border-t border-border bg-card flex items-center justify-between text-xs text-muted-foreground shrink-0">
          <div className="flex items-center gap-1.5 hidden sm:flex">
            <ShieldCheck size={14} className="text-primary" />
            <span>다운로드 실행 시 정보보호 및 컴플라이언스를 위해 감사 로그에 영구 기록됩니다.</span>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2.5 rounded-xl border border-border bg-secondary hover:bg-muted text-foreground text-xs font-bold transition-colors cursor-pointer shadow-2xs ml-auto"
          >
            닫기
          </button>
        </div>
      </div>
    </div>
  );
}
