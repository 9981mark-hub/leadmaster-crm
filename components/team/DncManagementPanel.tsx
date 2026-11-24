import React, { useEffect, useState, useCallback } from 'react';
import { Ban, Plus, Trash2, Search, RefreshCw, AlertTriangle, ShieldCheck, PhoneOff, ArrowRightLeft, X } from 'lucide-react';
import { useToast } from '../../contexts/ToastContext';
import { useConfirmDialog } from '../../contexts/ConfirmDialogContext';
import { fetchDncList, registerDnc, removeDnc, DncRecord, DNC_REASON_LABEL, runSmartRotation } from '../../services/dnc';

export default function DncManagementPanel() {
  const { showToast } = useToast();
  const { confirm } = useConfirmDialog();
  const [list, setList] = useState<DncRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [showAddModal, setShowAddModal] = useState(false);
  const [newPhone, setNewPhone] = useState('');
  const [newReason, setNewReason] = useState<'refusal' | 'wrong_number' | 'abuse' | 'invalid'>('refusal');
  const [newNote, setNewNote] = useState('');
  const [rotating, setRotating] = useState(false);

  const loadData = useCallback(async () => {
    setLoading(true);
    try {
      const data = await fetchDncList(200);
      setList(data);
    } catch (e: any) {
      showToast(`DNC 목록 로드 실패: ${e.message}`, 'error');
    } finally {
      setLoading(false);
    }
  }, [showToast]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  const handleAdd = async (e: React.FormEvent) => {
    e.preventDefault();
    const clean = newPhone.replace(/[^0-9]/g, '');
    if (clean.length < 9) {
      showToast('올바른 전화번호를 입력하세요.', 'error');
      return;
    }
    try {
      await registerDnc(clean, newReason, undefined, newNote);
      showToast('수신거부(DNC) 번호가 등록되었습니다.', 'success');
      setShowAddModal(false);
      setNewPhone('');
      setNewNote('');
      loadData();
    } catch (err: any) {
      showToast(`등록 실패: ${err.message}`, 'error');
    }
  };

  const handleDelete = async (item: DncRecord) => {
    const ok = await confirm({
      title: '수신거부(DNC) 차단 해제',
      message: `${item.phoneNumber} 번호의 수신거부 차단을 해제하시겠습니까?\n해제 시 상담원들이 다시 발신 및 배정할 수 있게 됩니다.`,
      confirmText: '차단 해제',
      type: 'warning'
    });
    if (!ok) return;
    try {
      await removeDnc(item.id);
      showToast('차단이 해제되었습니다.', 'success');
      setList(prev => prev.filter(x => x.id !== item.id));
    } catch (err: any) {
      showToast(`해제 실패: ${err.message}`, 'error');
    }
  };

  const handleRunRotation = async () => {
    const ok = await confirm({
      title: '장기 부재 리드 자동 교체(로테이션)',
      message: '상태가 [부재]이고 48시간 이상 경과한 리드를 다른 활동 상담원에게 자동 교체(로테이션)하시겠습니까?',
      confirmText: '로테이션 실행',
      type: 'info'
    });
    if (!ok) return;
    setRotating(true);
    try {
      const res = await runSmartRotation(3, 48, 200);
      if (res.success) {
        showToast(`부재 리드 ${res.rotatedCount}건의 담당자가 타 상담원에게 자동 교체되었습니다!`, 'success');
      }
    } catch (err: any) {
      showToast(`로테이션 실패: ${err.message}`, 'error');
    } finally {
      setRotating(false);
    }
  };

  const filtered = list.filter(item => {
    if (!search.trim()) return true;
    const q = search.trim().toLowerCase();
    return (
      item.phoneNumber.includes(q) ||
      (item.note || '').toLowerCase().includes(q) ||
      (DNC_REASON_LABEL[item.reason] || '').toLowerCase().includes(q)
    );
  });

  return (
    <div className="bg-card rounded-xl border border-border shadow-xs overflow-hidden">
      {/* Header */}
      <div className="p-4 border-b border-border flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-2.5">
          <div className="p-2 rounded-lg bg-destructive/10 text-destructive border border-destructive/20 shadow-2xs">
            <PhoneOff size={18} strokeWidth={1.75} />
          </div>
          <div>
            <h2 className="text-base font-semibold text-foreground flex items-center gap-2">
              수신거부 / 통화거부 (DNC) 블랙리스트 관리
              <span className="text-2xs font-mono font-medium px-2 py-0.5 rounded bg-destructive/10 text-destructive border border-destructive/20">
                총 {list.length}건 차단 중
              </span>
            </h2>
            <p className="text-xs text-muted-foreground mt-0.5">
              통화를 원치 않는 고객을 격리하고, 신규 엑셀 DB 업로드 시 자동으로 배정에서 사전 제외합니다.
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={handleRunRotation}
            disabled={rotating}
            className="flex items-center gap-1.5 px-2.5 py-1 text-2xs font-mono font-medium rounded-md bg-muted text-foreground border border-border hover:bg-muted/80 transition-colors shadow-2xs"
            title="48시간 이상 경과한 부재 리드를 타 상담원에게 자동 토스"
          >
            <ArrowRightLeft size={13} className={rotating ? 'animate-spin' : ''} />
            부재 리드 스마트 로테이션 실행
          </button>

          <button
            onClick={() => setShowAddModal(true)}
            className="flex items-center gap-1.5 px-2.5 py-1 text-2xs font-mono font-medium rounded-md bg-primary text-primary-foreground hover:bg-primary/90 shadow-2xs transition-colors"
          >
            <Plus size={13} strokeWidth={1.75} />
            DNC 번호 추가
          </button>

          <button
            onClick={loadData}
            disabled={loading}
            className="p-1 rounded-md border border-border text-muted-foreground hover:text-foreground hover:bg-muted transition-colors"
          >
            <RefreshCw size={13} className={loading ? 'animate-spin' : ''} />
          </button>
        </div>
      </div>

      {/* Filter bar */}
      <div className="p-3 bg-muted/30 border-b border-border flex flex-wrap gap-2.5 items-center">
        <div className="relative flex-1 min-w-[240px]">
          <Search size={15} className="absolute left-3 top-2.5 text-gray-500 dark:text-gray-400" />
          <input
            type="text"
            placeholder="전화번호, 사유, 메모 검색..."
            value={search}
            onChange={e => setSearch(e.target.value)}
            className="w-full pl-9 pr-3 py-1.5 text-sm border border-gray-300 dark:border-gray-600 rounded-lg dark:bg-gray-700 dark:text-white outline-none focus:ring-1 focus:ring-red-500"
          />
        </div>
        <span className="text-xs text-gray-500">
          검색 결과: <b className="text-gray-800 dark:text-white">{filtered.length}</b>건
        </span>
      </div>

      {/* DNC Table */}
      <div className="overflow-x-auto max-h-[460px] overflow-y-auto">
        <table className="w-full text-sm text-left">
          <thead className="bg-muted text-muted-foreground text-xs uppercase tracking-wider sticky top-0 z-10 border-b border-border font-mono">
            <tr>
              <th className="px-5 py-2.5">차단 번호</th>
              <th className="px-3 py-2.5">차단 사유</th>
              <th className="px-3 py-2.5">메모 / 비고</th>
              <th className="px-3 py-2.5">등록일시</th>
              <th className="px-5 py-2.5 text-right">관리</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100 dark:divide-gray-700">
            {filtered.map(item => {
              let reasonColor = 'bg-orange-100 text-orange-800 dark:bg-orange-900/40 dark:text-orange-300';
              if (item.reason === 'abuse') reasonColor = 'bg-red-100 text-red-800 dark:bg-red-900/40 dark:text-red-300 font-bold';
              if (item.reason === 'invalid') reasonColor = 'bg-gray-100 text-gray-700 dark:bg-gray-700 dark:text-gray-300';

              return (
                <tr key={item.id} className="hover:bg-gray-50/80 dark:hover:bg-gray-700/40">
                  <td className="px-5 py-3 font-semibold text-gray-800 dark:text-gray-100 tabular-nums">
                    {item.phoneNumber.replace(/(\d{3})(\d{3,4})(\d{4})/, '$1-$2-$3')}
                  </td>
                  <td className="px-3 py-3">
                    <span className={`inline-block px-2 py-0.5 rounded text-xs ${reasonColor}`}>
                      {DNC_REASON_LABEL[item.reason] || item.reason}
                    </span>
                  </td>
                  <td className="px-3 py-3 text-xs text-gray-500 max-w-xs truncate" title={item.note}>
                    {item.note || '-'}
                  </td>
                  <td className="px-3 py-3 text-xs text-gray-500 dark:text-gray-400">
                    {new Date(item.createdAt).toLocaleString('ko-KR', {
                      year: 'numeric',
                      month: '2-digit',
                      day: '2-digit',
                      hour: '2-digit',
                      minute: '2-digit',
                    })}
                  </td>
                  <td className="px-5 py-3 text-right">
                    <button
                      onClick={() => handleDelete(item)}
                      className="text-xs text-gray-500 dark:text-gray-400 hover:text-red-600 transition-colors p-1"
                      title="차단 해제"
                    >
                      <Trash2 size={15} />
                    </button>
                  </td>
                </tr>
              );
            })}

            {!loading && filtered.length === 0 && (
              <tr>
                <td colSpan={5} className="px-5 py-12 text-center text-gray-500 dark:text-gray-400">
                  {search ? '검색된 DNC 번호가 없습니다.' : '등록된 수신거부 번호가 없습니다.'}
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      {/* Add Modal */}
      {showAddModal && (
        <div className="fixed inset-0 bg-background/80 backdrop-blur-xs z-50 flex items-center justify-center p-4 animate-in fade-in duration-150">
          <div className="bg-card text-foreground rounded-2xl max-w-md w-full p-6 shadow-2xl border border-border space-y-4">
            <div className="flex items-center justify-between pb-3.5 border-b border-border">
              <h3 className="font-bold text-base text-foreground flex items-center gap-2">
                <div className="p-1.5 rounded-lg bg-destructive/10 text-destructive border border-destructive/20">
                  <PhoneOff size={16} />
                </div>
                <span>수신거부(DNC) 번호 직접 등록</span>
              </h3>
              <button
                type="button"
                onClick={() => setShowAddModal(false)}
                className="p-1.5 rounded-lg text-muted-foreground hover:text-foreground hover:bg-muted transition-colors cursor-pointer"
              >
                <X size={18} />
              </button>
            </div>
            <form onSubmit={handleAdd} className="space-y-3.5">
              <div>
                <label className="block text-2xs font-mono font-semibold text-muted-foreground uppercase tracking-wider mb-1.5">
                  전화번호
                </label>
                <input
                  type="text"
                  placeholder="예: 01012345678"
                  value={newPhone}
                  onChange={e => setNewPhone(e.target.value)}
                  className="w-full p-2.5 text-xs font-mono border border-input rounded-lg bg-background text-foreground placeholder:text-muted-foreground outline-none focus:ring-1 focus:ring-primary shadow-2xs"
                  required
                />
              </div>

              <div>
                <label className="block text-2xs font-mono font-semibold text-muted-foreground uppercase tracking-wider mb-1.5">
                  차단 사유
                </label>
                <select
                  value={newReason}
                  onChange={e => setNewReason(e.target.value as any)}
                  className="w-full p-2.5 text-xs font-mono border border-input rounded-lg bg-background text-foreground outline-none focus:ring-1 focus:ring-primary shadow-2xs cursor-pointer"
                >
                  <option value="refusal">수신 거부 (통화 원치 않음)</option>
                  <option value="wrong_number">신청 안 함 (오신청/타인)</option>
                  <option value="abuse">악성 민원 / 욕설</option>
                  <option value="invalid">결번 / 없는 번호</option>
                </select>
              </div>

              <div>
                <label className="block text-2xs font-mono font-semibold text-muted-foreground uppercase tracking-wider mb-1.5">
                  메모 (선택)
                </label>
                <textarea
                  placeholder="고객 요청 사항 또는 차단 배경..."
                  value={newNote}
                  onChange={e => setNewNote(e.target.value)}
                  rows={2}
                  className="w-full p-2.5 text-xs font-mono border border-input rounded-lg bg-background text-foreground placeholder:text-muted-foreground outline-none focus:ring-1 focus:ring-primary shadow-2xs"
                />
              </div>

              <div className="flex justify-end gap-2 pt-3 border-t border-border">
                <button
                  type="button"
                  onClick={() => setShowAddModal(false)}
                  className="px-4 py-2 text-xs font-semibold text-muted-foreground hover:text-foreground bg-card border border-border hover:bg-muted rounded-xl transition-colors cursor-pointer"
                >
                  취소
                </button>
                <button
                  type="submit"
                  className="px-5 py-2 text-xs font-bold bg-destructive text-destructive-foreground hover:bg-destructive/90 rounded-xl shadow-2xs transition-colors cursor-pointer"
                >
                  차단 등록
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
