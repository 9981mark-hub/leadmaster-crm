/**
 * MissedCallBatchModal.tsx
 * 부재건 자동 수집 → 배치 생성 모달
 * 개별 체크박스로 선택/해제 가능
 * 
 * NOTE: 완전히 신규 파일 — 기존 시스템에 영향 없음
 */
import React, { useState, useEffect, useMemo } from 'react';
import { X, Phone, Search, CheckSquare, Square, Loader2, Clock, ArrowUpDown } from 'lucide-react';
import { useToast } from '../../contexts/ToastContext';
import { Case } from '../../types';
import { createBatch } from '../../services/autoDialService';

interface MissedCallBatchModalProps {
  isOpen: boolean;
  onClose: () => void;
  onCreated: () => void;
  cases: Case[];
  missedStatus: string;
}

type SortKey = 'lastMissedCallAt' | 'missedCallCount' | 'createdAt';

const MissedCallBatchModal: React.FC<MissedCallBatchModalProps> = ({
  isOpen, onClose, onCreated, cases, missedStatus
}) => {
  const { showToast } = useToast();
  const [loading, setLoading] = useState(false);
  const [batchName, setBatchName] = useState(`${new Date().toLocaleDateString('ko-KR')} 부재콜 재통화`);
  const [ringTimeout, setRingTimeout] = useState(30);
  const [gapSeconds, setGapSeconds] = useState(5);
  const [sortKey, setSortKey] = useState<SortKey>('lastMissedCallAt');
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [search, setSearch] = useState('');

  // Filter missed cases
  const missedCases = useMemo(() => {
    return cases.filter(c => 
      c.status === missedStatus && 
      !c.deletedAt &&
      c.phone
    );
  }, [cases, missedStatus]);

  // Sort
  const sortedCases = useMemo(() => {
    const sorted = [...missedCases];
    switch (sortKey) {
      case 'lastMissedCallAt':
        sorted.sort((a, b) => {
          const aDate = a.lastMissedCallAt || '9999';
          const bDate = b.lastMissedCallAt || '9999';
          return aDate.localeCompare(bDate); // Oldest first
        });
        break;
      case 'missedCallCount':
        sorted.sort((a, b) => (a.missedCallCount || 0) - (b.missedCallCount || 0));
        break;
      case 'createdAt':
        sorted.sort((a, b) => b.createdAt.localeCompare(a.createdAt));
        break;
    }
    return sorted;
  }, [missedCases, sortKey]);

  // Search filter
  const filteredCases = useMemo(() => {
    if (!search.trim()) return sortedCases;
    const q = search.trim().toLowerCase();
    return sortedCases.filter(c =>
      c.customerName.toLowerCase().includes(q) ||
      c.phone.includes(q)
    );
  }, [sortedCases, search]);

  // Initialize selection (select all)
  useEffect(() => {
    if (isOpen) {
      setSelectedIds(new Set(filteredCases.map(c => c.caseId)));
    }
  }, [isOpen, filteredCases.length]);

  const toggleSelect = (caseId: string) => {
    setSelectedIds(prev => {
      const next = new Set(prev);
      if (next.has(caseId)) {
        next.delete(caseId);
      } else {
        next.add(caseId);
      }
      return next;
    });
  };

  const toggleAll = () => {
    if (selectedIds.size === filteredCases.length) {
      setSelectedIds(new Set());
    } else {
      setSelectedIds(new Set(filteredCases.map(c => c.caseId)));
    }
  };

  const handleCreate = async () => {
    if (selectedIds.size === 0) {
      showToast('선택된 건이 없습니다', 'error');
      return;
    }
    if (!batchName.trim()) {
      showToast('배치명을 입력해주세요', 'error');
      return;
    }

    setLoading(true);
    try {
      const selectedCases = filteredCases.filter(c => selectedIds.has(c.caseId));
      const result = await createBatch({
        name: batchName.trim(),
        source: 'missed_calls',
        ringTimeoutSeconds: ringTimeout,
        gapSeconds: gapSeconds,
        items: selectedCases.map(c => ({
          caseId: c.caseId,
          customerName: c.customerName,
          phone: c.phone,
          memo: c.preInfo || (c.missedCallCount ? `부재 ${c.missedCallCount}회` : undefined)
        }))
      });

      if (result) {
        showToast(`${selectedIds.size}건 배치 생성 완료`, 'success');
        onCreated();
        onClose();
      } else {
        showToast('배치 생성 실패', 'error');
      }
    } catch (err) {
      console.error('[MissedCallBatch] Create error:', err);
      showToast('배치 생성 중 오류 발생', 'error');
    } finally {
      setLoading(false);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-5 bg-background/80 backdrop-blur-xs animate-in fade-in duration-200 overflow-y-auto">
      <div className="relative w-full max-w-2xl max-h-[88vh] my-auto flex flex-col rounded-2xl bg-card border border-border shadow-2xl overflow-hidden text-card-foreground">
        {/* Header */}
        <div className="flex items-center justify-between p-4 sm:p-5 border-b border-border bg-card shrink-0">
          <h2 className="text-base font-bold text-foreground flex items-center gap-2">
            <span className="w-2.5 h-2.5 rounded-full bg-rose-500 animate-pulse" />
            <span>부재건 자동 수집 & 재통화 배치 생성</span>
          </h2>
          <button onClick={onClose} className="p-1.5 hover:bg-muted text-muted-foreground hover:text-foreground rounded-lg transition-colors cursor-pointer" title="창 닫기">
            <X size={18} />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto p-5 sm:p-6 space-y-4 custom-scrollbar text-xs">
          {/* Batch name */}
          <div>
            <label className="text-xs font-semibold text-foreground block mb-1">배치명</label>
            <input
              type="text"
              value={batchName}
              onChange={(e) => setBatchName(e.target.value)}
              className="w-full px-3 py-2 border border-input rounded-xl bg-background text-foreground focus:ring-1 focus:ring-primary outline-none transition-colors text-xs"
            />
          </div>

          {/* Sort + Search */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="text-xs font-semibold text-foreground block mb-1">정렬 기준</label>
              <select
                value={sortKey}
                onChange={(e) => setSortKey(e.target.value as SortKey)}
                className="w-full px-3 py-2 border border-input rounded-xl bg-background text-foreground text-xs focus:ring-1 focus:ring-primary outline-none"
              >
                <option value="lastMissedCallAt">마지막 부재 오래된 순</option>
                <option value="missedCallCount">부재 횟수 적은 순</option>
                <option value="createdAt">케이스 최신순</option>
              </select>
            </div>
            <div>
              <label className="text-xs font-semibold text-foreground block mb-1">검색</label>
              <div className="relative">
                <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
                <input
                  type="text"
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  placeholder="이름/번호 검색"
                  className="w-full pl-9 pr-3 py-2 border border-input rounded-xl bg-background text-foreground text-xs focus:ring-1 focus:ring-primary outline-none"
                />
              </div>
            </div>
          </div>

          {/* Call settings */}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-xs font-semibold text-foreground block mb-1">
                <Clock size={12} className="inline mr-1 text-primary" />벨 타임아웃
              </label>
              <div className="flex items-center gap-2">
                <input
                  type="number"
                  value={ringTimeout}
                  onChange={(e) => setRingTimeout(Number(e.target.value))}
                  min={10}
                  max={120}
                  className="w-20 px-3 py-1.5 border border-input rounded-xl bg-background text-foreground text-xs text-center font-mono focus:ring-1 focus:ring-primary outline-none"
                />
                <span className="text-xs text-muted-foreground">초 (≈{Math.round(ringTimeout / 6)}벨)</span>
              </div>
            </div>
            <div>
              <label className="text-xs font-semibold text-foreground block mb-1">
                건 사이 대기
              </label>
              <div className="flex items-center gap-2">
                <input
                  type="number"
                  value={gapSeconds}
                  onChange={(e) => setGapSeconds(Number(e.target.value))}
                  min={1}
                  max={60}
                  className="w-20 px-3 py-1.5 border border-input rounded-xl bg-background text-foreground text-xs text-center font-mono focus:ring-1 focus:ring-primary outline-none"
                />
                <span className="text-xs text-muted-foreground">초</span>
              </div>
            </div>
          </div>

          {/* Preview table */}
          <div>
            <div className="flex items-center justify-between mb-2">
              <button
                onClick={toggleAll}
                className="text-xs text-primary hover:text-primary/90 flex items-center gap-1 font-semibold cursor-pointer"
              >
                {selectedIds.size === filteredCases.length ? <CheckSquare size={14} /> : <Square size={14} />}
                전체 {selectedIds.size === filteredCases.length ? '해제' : '선택'} ({selectedIds.size}/{filteredCases.length})
              </button>
            </div>

            <div className="border border-border rounded-xl max-h-40 md:max-h-64 overflow-y-auto custom-scrollbar">
              {filteredCases.length === 0 ? (
                <div className="p-8 text-center text-gray-500 dark:text-gray-400">
                  <Phone size={32} className="mx-auto mb-2 opacity-50" />
                  <p>부재 상태의 케이스가 없습니다</p>
                </div>
              ) : (
                filteredCases.map((c) => (
                  <div
                    key={c.caseId}
                    onClick={() => toggleSelect(c.caseId)}
                    className={`flex items-center gap-3 px-3 py-2.5 border-b border-border/60 last:border-0 cursor-pointer transition-colors ${
                      selectedIds.has(c.caseId)
                        ? 'bg-primary/5 hover:bg-primary/10'
                        : 'hover:bg-muted/30'
                    }`}
                  >
                    {selectedIds.has(c.caseId) ? (
                      <CheckSquare size={16} className="text-primary shrink-0" />
                    ) : (
                      <Square size={16} className="text-muted-foreground shrink-0" />
                    )}
                    <span className="text-xs font-semibold text-foreground min-w-[60px]">
                      {c.customerName}
                    </span>
                    <span className="text-xs text-muted-foreground font-mono flex-1">{c.phone}</span>
                    <span className="text-xs font-bold text-amber-500">
                      부재 {c.missedCallCount || 0}회
                    </span>
                    {c.lastMissedCallAt && (
                      <span className="text-xs text-muted-foreground font-mono">
                        {new Date(c.lastMissedCallAt).toLocaleDateString('ko-KR', { month: '2-digit', day: '2-digit' })}
                      </span>
                    )}
                  </div>
                ))
              )}
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="p-4 border-t border-border bg-card flex justify-end gap-2 shrink-0">
          <button
            onClick={onClose}
            className="px-4 py-2.5 text-xs font-bold text-foreground bg-secondary hover:bg-muted border border-border rounded-xl transition-colors cursor-pointer shadow-2xs"
          >
            취소 / 닫기
          </button>
          <button
            onClick={handleCreate}
            disabled={loading || selectedIds.size === 0}
            className="px-5 py-2.5 text-xs font-bold bg-primary hover:bg-primary/90 text-primary-foreground rounded-xl transition-all shadow-2xs disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2 cursor-pointer"
          >
            {loading ? <Loader2 size={14} className="animate-spin" /> : <Phone size={14} />}
            배치 생성 (선택된 {selectedIds.size}건)
          </button>
        </div>
      </div>
    </div>
  );
};

export default MissedCallBatchModal;
