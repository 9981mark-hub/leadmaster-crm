import React, { useState } from 'react';
import {
  MessageSquareHeart,
  RefreshCw,
  CheckCircle2,
  Clock,
  AlertCircle,
  Send,
  Smartphone,
  Monitor,
} from 'lucide-react';
import {
  INQUIRY_CATEGORY_META,
  SupportInquiry,
  replyToSupportInquiry,
} from '../../services/supportInquiryService';
import { FAQ_ROLE_META } from '../../data/faqData';

interface SupportInquiriesPanelProps {
  inquiries: SupportInquiry[];
  adminEmail: string;
  loading: boolean;
  onRefresh: () => void;
  onUpdated: (updated: SupportInquiry) => void;
  showToast: (msg: string, type?: 'success' | 'error' | 'info') => void;
}

export const SupportInquiriesPanel: React.FC<SupportInquiriesPanelProps> = ({
  inquiries,
  adminEmail,
  loading,
  onRefresh,
  onUpdated,
  showToast,
}) => {
  const [filter, setFilter] = useState<'all' | 'pending' | 'answered'>('all');
  const [draftReplies, setDraftReplies] = useState<Record<string, string>>({});
  const [busyId, setBusyId] = useState<string | null>(null);

  const pendingCount = inquiries.filter(
    i => i.status === 'open' || i.status === 'in_progress'
  ).length;

  const filtered = inquiries.filter(i => {
    if (filter === 'pending') return i.status === 'open' || i.status === 'in_progress';
    if (filter === 'answered') return i.status === 'answered' || i.status === 'closed';
    return true;
  });

  const handleSendReply = async (
    item: SupportInquiry,
    status: 'in_progress' | 'answered'
  ) => {
    const text = (draftReplies[item.id] ?? item.adminReply ?? '').trim();
    if (!text) {
      showToast('답변 내용을 입력해주세요.', 'error');
      return;
    }
    setBusyId(item.id);
    try {
      const updated = await replyToSupportInquiry(item, text, status, adminEmail);
      onUpdated(updated);
      showToast(
        status === 'answered'
          ? `'${item.userName || item.userEmail}'님께 답변 완료 알림을 전송했습니다.`
          : '처리 중 상태와 메모를 저장했습니다.',
        'success'
      );
    } catch (e: any) {
      showToast(e?.message || '답변 저장에 실패했습니다.', 'error');
    } finally {
      setBusyId(null);
    }
  };

  const fmtDate = (iso?: string | null) => {
    if (!iso) return '-';
    const d = new Date(iso);
    return `${d.toLocaleDateString('ko-KR')} ${String(d.getHours()).padStart(2, '0')}:${String(
      d.getMinutes()
    ).padStart(2, '0')}`;
  };

  return (
    <section
      id="platform-inquiries-section"
      className="bg-card rounded-xl border border-border p-4 space-y-3.5 shadow-xs"
    >
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div className="flex items-center justify-between sm:justify-start gap-2 min-w-0">
          <h2 className="font-bold text-foreground flex items-center gap-2 text-sm sm:text-base break-keep min-w-0">
            <MessageSquareHeart size={18} className="text-primary shrink-0" />
            <span>고객사 1:1 문의 관제 (전 직급 실시간 접수)</span>
          </h2>
          {pendingCount > 0 ? (
            <span className="px-2.5 py-0.5 rounded-full text-xs font-bold bg-rose-500/15 text-rose-500 border border-rose-500/30 animate-pulse whitespace-nowrap shrink-0">
              미답변 {pendingCount}건
            </span>
          ) : (
            <span className="px-2.5 py-0.5 rounded-full text-xs font-medium bg-muted text-muted-foreground whitespace-nowrap shrink-0">
              미답변 0건
            </span>
          )}
        </div>

        <div className="flex items-center justify-between sm:justify-end gap-2">
          <div className="flex items-center bg-muted/60 p-0.5 rounded-lg text-2xs font-medium border border-border">
            {([
              { id: 'all', label: `전체 (${inquiries.length})` },
              { id: 'pending', label: `미답변 (${pendingCount})` },
              { id: 'answered', label: `완료 (${inquiries.length - pendingCount})` },
            ] as const).map(tab => (
              <button
                key={tab.id}
                type="button"
                onClick={() => setFilter(tab.id)}
                className={`px-2.5 py-1 rounded-md transition-colors cursor-pointer whitespace-nowrap ${
                  filter === tab.id
                    ? 'bg-card text-foreground font-bold shadow-2xs'
                    : 'text-muted-foreground hover:text-foreground'
                }`}
              >
                {tab.label}
              </button>
            ))}
          </div>

          <button
            type="button"
            onClick={onRefresh}
            disabled={loading}
            className="text-xs text-muted-foreground hover:text-foreground flex items-center gap-1 cursor-pointer whitespace-nowrap shrink-0"
          >
            <RefreshCw size={12} className={loading ? 'animate-spin' : ''} /> 새로고침
          </button>
        </div>
      </div>

      {filtered.length === 0 ? (
        <div className="p-5 sm:p-8 text-center text-xs text-muted-foreground border border-dashed border-border rounded-xl break-keep">
          해당 상태의 1:1 문의가 없습니다. 고객사 대표·관리자·상담원이 문의를 접수하면 이곳과 상단 종 아이콘에 실시간 표시됩니다.
        </div>
      ) : (
        <div className="space-y-3">
          {filtered.map(item => {
            const draftVal = draftReplies[item.id] ?? item.adminReply ?? '';
            const roleMeta = FAQ_ROLE_META[item.userRole];
            const isPending = item.status === 'open' || item.status === 'in_progress';

            return (
              <div
                key={item.id}
                className={`p-4 rounded-xl border space-y-3 transition-all ${
                  item.priority === 'urgent' && isPending
                    ? 'bg-destructive/5 border-destructive/35'
                    : isPending
                    ? 'bg-primary/5 border-primary/25'
                    : 'bg-background/60 border-border'
                }`}
              >
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                  <div className="flex items-center gap-2 flex-wrap">
                    {item.priority === 'urgent' && (
                      <span className="px-2 py-0.5 rounded text-[10.5px] font-extrabold bg-destructive text-white whitespace-nowrap">
                        🚨 긴급
                      </span>
                    )}
                    <span className="px-2 py-0.5 rounded-md text-[11px] font-bold bg-card border border-border text-foreground whitespace-nowrap">
                      {item.orgName}
                    </span>
                    <span className="px-2 py-0.5 rounded-md text-[11px] font-semibold bg-primary/10 text-primary whitespace-nowrap">
                      {roleMeta?.label || item.userRole}
                    </span>
                    <span className="text-xs font-bold text-foreground">
                      {item.userName || item.userEmail}
                    </span>
                    <span className="text-[11px] font-mono text-muted-foreground">
                      ({item.userEmail})
                    </span>
                  </div>

                  <div className="flex items-center gap-2 text-[11px] shrink-0">
                    <span className="px-2 py-0.5 rounded bg-muted text-muted-foreground whitespace-nowrap">
                      {INQUIRY_CATEGORY_META[item.category]?.label || item.category}
                    </span>
                    {item.status === 'answered' || item.status === 'closed' ? (
                      <span className="inline-flex items-center gap-1 font-bold text-emerald-600 dark:text-emerald-400 whitespace-nowrap">
                        <CheckCircle2 size={12} /> 답변 완료
                      </span>
                    ) : item.status === 'in_progress' ? (
                      <span className="inline-flex items-center gap-1 font-bold text-blue-600 dark:text-blue-400 whitespace-nowrap">
                        <Clock size={12} /> 확인 중
                      </span>
                    ) : (
                      <span className="inline-flex items-center gap-1 font-bold text-amber-600 dark:text-amber-400 whitespace-nowrap">
                        <AlertCircle size={12} /> 미답변
                      </span>
                    )}
                  </div>
                </div>

                <div className="space-y-1.5">
                  <div className="text-sm font-bold text-foreground">{item.subject}</div>
                  <div className="p-3 rounded-lg bg-muted/40 border border-border/60 text-xs text-foreground whitespace-pre-wrap leading-relaxed break-words">
                    {item.content}
                  </div>
                  <div className="flex items-center gap-3 flex-wrap text-[11px] text-muted-foreground font-mono">
                    <span>접수: {fmtDate(item.createdAt)}</span>
                    {item.contextMeta?.platform && (
                      <span className="inline-flex items-center gap-1">
                        {item.contextMeta.platform === 'Android App' ? (
                          <Smartphone size={11} />
                        ) : (
                          <Monitor size={11} />
                        )}
                        {item.contextMeta.platform}
                        {item.contextMeta.appVersion ? ` (${item.contextMeta.appVersion})` : ''}
                      </span>
                    )}
                    {item.repliedAt && <span>답변: {fmtDate(item.repliedAt)}</span>}
                  </div>
                </div>

                {/* 답변 입력 및 전송 */}
                <div className="pt-2 border-t border-border/60 space-y-2">
                  <textarea
                    rows={2}
                    value={draftVal}
                    onChange={e =>
                      setDraftReplies(prev => ({ ...prev, [item.id]: e.target.value }))
                    }
                    placeholder="문의자에게 전달할 답변을 입력하세요. 전송 시 문의자의 상단 종 아이콘으로 즉시 알림이 갑니다."
                    className="w-full px-3 py-2 rounded-lg bg-background border border-border text-xs text-foreground focus:outline-none focus:ring-2 focus:ring-primary/50"
                  />
                  <div className="flex items-center justify-end gap-2">
                    <button
                      type="button"
                      disabled={busyId === item.id}
                      onClick={() => handleSendReply(item, 'in_progress')}
                      className="px-3 py-1.5 rounded-lg bg-muted hover:bg-muted/80 border border-border text-xs font-semibold text-foreground cursor-pointer disabled:opacity-50"
                    >
                      확인 중 표시
                    </button>
                    <button
                      type="button"
                      disabled={busyId === item.id}
                      onClick={() => handleSendReply(item, 'answered')}
                      className="px-3.5 py-1.5 rounded-lg bg-primary hover:bg-primary/90 text-primary-foreground text-xs font-bold inline-flex items-center gap-1.5 cursor-pointer disabled:opacity-50"
                    >
                      <Send size={12} />
                      <span>{item.adminReply ? '답변 수정 및 재알림' : '답변 완료 & 알림 전송'}</span>
                    </button>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </section>
  );
};
