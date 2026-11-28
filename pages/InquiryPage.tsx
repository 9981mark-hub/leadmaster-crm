import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import {
  MessageSquareHeart,
  Send,
  Clock,
  CheckCircle2,
  AlertCircle,
  Sparkles,
  HelpCircle,
  ChevronDown,
  ChevronUp,
  RefreshCw,
  ShieldCheck,
} from 'lucide-react';
import { useAuth } from '../contexts/AuthContext';
import { useToast } from '../contexts/ToastContext';
import {
  INQUIRY_CATEGORY_META,
  InquiryCategory,
  InquiryPriority,
  SupportInquiry,
  fetchMyInquiries,
  markInquiryReplyRead,
  submitSupportInquiry,
  subscribeToSupportAlerts,
} from '../services/supportInquiryService';
import { FAQ_ITEMS, FAQ_ROLE_META, resolveFaqRoleKey } from '../data/faqData';

export default function InquiryPage() {
  const location = useLocation();
  const navigate = useNavigate();
  const { user, org } = useAuth();
  const { showToast } = useToast();

  const statePrefill = (location.state || {}) as {
    category?: InquiryCategory;
    subject?: string;
  };

  const myRoleKey = resolveFaqRoleKey(org?.role, org?.adminPermissions?.tier);
  const roleLabel = FAQ_ROLE_META[myRoleKey].label;

  const [category, setCategory] = useState<InquiryCategory>(
    statePrefill.category || 'account_auth'
  );
  const [priority, setPriority] = useState<InquiryPriority>('normal');
  const [subject, setSubject] = useState(statePrefill.subject || '');
  const [content, setContent] = useState('');
  const [submitting, setSubmitting] = useState(false);

  const [myInquiries, setMyInquiries] = useState<SupportInquiry[]>([]);
  const [loadingList, setLoadingList] = useState(true);
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [expandedFaqId, setExpandedFaqId] = useState<string | null>(null);

  const loadInquiries = useCallback(async () => {
    if (!org?.userId) return;
    setLoadingList(true);
    try {
      const list = await fetchMyInquiries(org.userId);
      setMyInquiries(list);
    } finally {
      setLoadingList(false);
    }
  }, [org?.userId]);

  useEffect(() => {
    loadInquiries();
  }, [loadInquiries]);

  useEffect(() => {
    if (!org?.userId) return;
    const unsub = subscribeToSupportAlerts(payload => {
      if (!payload?.userId || payload.userId === org.userId) {
        loadInquiries();
      }
    });
    return unsub;
  }, [org?.userId, loadInquiries]);

  // 문의 전 셀프 해결을 돕는 실시간 추천 FAQ 2건
  const suggestedFaqs = useMemo(() => {
    const q = `${subject} ${content}`.trim().toLowerCase();
    const roleFaqs = FAQ_ITEMS.filter(f => f.roles.includes(myRoleKey));
    const matched = roleFaqs.filter(f => {
      if (q.length >= 2) {
        const text = `${f.question} ${f.summary} ${f.tags.join(' ')}`.toLowerCase();
        const words = q.split(/\s+/).filter(w => w.length >= 2);
        if (words.some(w => text.includes(w))) return true;
      }
      return f.inquiryCategory === category;
    });
    return matched.slice(0, 2);
  }, [myRoleKey, category, subject, content]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!org?.userId || !user?.email) {
      showToast('로그인 계정 정보를 확인할 수 없습니다.', 'error');
      return;
    }
    if (!subject.trim() || !content.trim()) {
      showToast('문의 제목과 상세 내용을 모두 입력해주세요.', 'error');
      return;
    }

    setSubmitting(true);
    try {
      const isAndroidApp = Boolean((window as any).AndroidBridge?.isAndroidApp?.());
      const appVersion = (() => {
        try {
          return (window as any).AndroidBridge?.getAppVersion?.() || '';
        } catch {
          return '';
        }
      })();

      const created = await submitSupportInquiry({
        orgId: org.orgId,
        orgName: org.orgName || '소속 미지정',
        userId: org.userId,
        userEmail: user.email,
        userName: user.name || org.userName || user.email,
        userRole: myRoleKey,
        category,
        priority,
        subject,
        content,
        contextMeta: {
          platform: isAndroidApp ? 'Android App' : 'Web Browser',
          appVersion: appVersion || undefined,
          userAgent: typeof navigator !== 'undefined' ? navigator.userAgent : undefined,
        },
      });

      setMyInquiries(prev => [created, ...prev]);
      setExpandedId(created.id);
      setSubject('');
      setContent('');
      setPriority('normal');
      showToast('문의가 접수되었습니다. 서비스 총괄 관리자에게 실시간 알림이 전송되었습니다.', 'success');
    } catch (err: any) {
      showToast(err?.message || '문의 접수 중 오류가 발생했습니다.', 'error');
    } finally {
      setSubmitting(false);
    }
  };

  const handleToggleExpand = async (item: SupportInquiry) => {
    const nextOpen = expandedId === item.id ? null : item.id;
    setExpandedId(nextOpen);
    if (nextOpen && !item.userReadReply && item.adminReply) {
      await markInquiryReplyRead(item.id);
      setMyInquiries(prev =>
        prev.map(it => (it.id === item.id ? { ...it, userReadReply: true } : it))
      );
      window.dispatchEvent(new CustomEvent('lm-support-reply-read'));
    }
  };

  const fmtDate = (iso?: string | null) => {
    if (!iso) return '-';
    const d = new Date(iso);
    return `${d.toLocaleDateString('ko-KR')} ${String(d.getHours()).padStart(2, '0')}:${String(
      d.getMinutes()
    ).padStart(2, '0')}`;
  };

  const unreadCount = myInquiries.filter(i => i.status === 'answered' && !i.userReadReply).length;

  return (
    <div className="max-w-6xl mx-auto space-y-5 pb-14">
      {/* 상단 헤더 */}
      <div className="bg-card rounded-2xl border border-border p-5 sm:p-6 shadow-xs flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div className="space-y-1">
          <div className="flex items-center gap-2 flex-wrap">
            <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-bold bg-blue-500/10 text-blue-600 dark:text-blue-400 border border-blue-500/20">
              <ShieldCheck size={12} />
              서비스 총괄 관리자 직통 1:1 지원
            </span>
            {unreadCount > 0 && (
              <span className="px-2.5 py-0.5 rounded-full text-xs font-bold bg-emerald-500/15 text-emerald-600 dark:text-emerald-400 border border-emerald-500/30 animate-pulse">
                새 답변 {unreadCount}건 도착
              </span>
            )}
          </div>
          <h1 className="text-xl sm:text-2xl font-bold text-foreground flex items-center gap-2">
            <MessageSquareHeart size={22} className="text-primary shrink-0" />
            <span>1:1 문의하기 &amp; 답변 확인</span>
          </h1>
          <p className="text-xs sm:text-sm text-muted-foreground break-keep">
            오류 신고, 계정·설정 질문, 기능 개선 제안을 보내시면 서비스 총괄 관리자가 확인 후 실시간 답변을 드립니다.
          </p>
        </div>

        <button
          type="button"
          onClick={() => navigate('/faq')}
          className="shrink-0 px-4 py-2 rounded-xl bg-muted hover:bg-muted/80 border border-border text-xs font-bold text-foreground inline-flex items-center justify-center gap-1.5 cursor-pointer whitespace-nowrap"
        >
          <HelpCircle size={15} className="text-primary" />
          <span>먼저 FAQ 확인하기</span>
        </button>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-5 items-start">
        {/* 좌측: 문의 접수 폼 */}
        <form
          onSubmit={handleSubmit}
          className="lg:col-span-7 bg-card rounded-2xl border border-border p-5 space-y-4 shadow-xs"
        >
          <div className="flex items-center justify-between border-b border-border pb-3">
            <h2 className="text-base font-bold text-foreground">새 문의 작성</h2>
            <span className="text-[11px] font-mono text-muted-foreground">
              {org?.orgName} · {roleLabel}
            </span>
          </div>

          {/* 카테고리 선택 */}
          <div className="space-y-1.5">
            <label className="text-xs font-bold text-foreground">문의 유형</label>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
              {(Object.keys(INQUIRY_CATEGORY_META) as InquiryCategory[]).map(key => {
                const meta = INQUIRY_CATEGORY_META[key];
                const active = category === key;
                return (
                  <button
                    key={key}
                    type="button"
                    onClick={() => setCategory(key)}
                    className={`p-2.5 rounded-xl border text-left transition-all cursor-pointer ${
                      active
                        ? 'bg-primary/10 border-primary text-foreground shadow-2xs'
                        : 'bg-muted/30 border-border text-muted-foreground hover:text-foreground hover:bg-muted/60'
                    }`}
                  >
                    <div className="text-xs font-bold">{meta.label}</div>
                    <div className="text-[11px] opacity-80 truncate mt-0.5">{meta.desc}</div>
                  </button>
                );
              })}
            </div>
          </div>

          {/* 긴급도 */}
          <div className="flex items-center justify-between gap-3 pt-1">
            <label className="text-xs font-bold text-foreground">긴급도</label>
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => setPriority('normal')}
                className={`px-3 py-1.5 rounded-lg text-xs font-semibold border cursor-pointer ${
                  priority === 'normal'
                    ? 'bg-foreground text-background border-foreground'
                    : 'bg-muted/40 text-muted-foreground border-border'
                }`}
              >
                일반 문의
              </button>
              <button
                type="button"
                onClick={() => setPriority('urgent')}
                className={`px-3 py-1.5 rounded-lg text-xs font-bold border cursor-pointer ${
                  priority === 'urgent'
                    ? 'bg-destructive text-white border-destructive'
                    : 'bg-muted/40 text-muted-foreground border-border hover:text-destructive'
                }`}
              >
                🚨 긴급 (업무 중단/장애)
              </button>
            </div>
          </div>

          {/* 제목 */}
          <div className="space-y-1.5">
            <label className="text-xs font-bold text-foreground">제목</label>
            <input
              type="text"
              value={subject}
              onChange={e => setSubject(e.target.value)}
              placeholder="예: 텔레그램 방 전송 시 오류가 납니다 / 특정 메뉴가 보이지 않습니다"
              maxLength={120}
              className="w-full px-3.5 py-2.5 rounded-xl bg-background border border-border text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-primary/50"
            />
          </div>

          {/* 상세 내용 */}
          <div className="space-y-1.5">
            <label className="text-xs font-bold text-foreground">상세 내용</label>
            <textarea
              value={content}
              onChange={e => setContent(e.target.value)}
              rows={5}
              placeholder="언제, 어떤 화면에서 어떤 버튼을 눌렀을 때 발생한 상황인지 구체적으로 적어주시면 더 빠르게 해결해 드릴 수 있습니다."
              className="w-full px-3.5 py-2.5 rounded-xl bg-background border border-border text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-primary/50 resize-y"
            />
          </div>

          {/* 실시간 추천 FAQ (문의 전송 전 셀프 해결 유도) */}
          {suggestedFaqs.length > 0 && (
            <div className="rounded-xl bg-blue-500/5 border border-blue-500/20 p-3.5 space-y-2">
              <div className="flex items-center gap-1.5 text-xs font-bold text-blue-600 dark:text-blue-400">
                <Sparkles size={13} />
                <span>문의 전 아래 FAQ로 바로 해결될 수도 있습니다!</span>
              </div>
              <div className="space-y-1.5">
                {suggestedFaqs.map(faq => {
                  const open = expandedFaqId === faq.id;
                  return (
                    <div
                      key={faq.id}
                      className="rounded-lg bg-card border border-border/80 overflow-hidden"
                    >
                      <button
                        type="button"
                        onClick={() => setExpandedFaqId(open ? null : faq.id)}
                        className="w-full px-3 py-2 text-left flex items-center justify-between gap-2 text-xs font-semibold text-foreground cursor-pointer"
                      >
                        <span className="truncate">Q. {faq.question}</span>
                        {open ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
                      </button>
                      {open && (
                        <div className="px-3 pb-2.5 text-[11.5px] text-muted-foreground space-y-1.5 border-t border-border/60 pt-2">
                          <p className="font-semibold text-foreground">{faq.summary}</p>
                          <ul className="list-disc pl-4 space-y-0.5">
                            {faq.steps.map((s, i) => (
                              <li key={i}>{s}</li>
                            ))}
                          </ul>
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {/* 자동 첨부 정보 안내 + 전송 버튼 */}
          <div className="pt-2 flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-t border-border">
            <span className="text-[11px] text-muted-foreground">
              계정({user?.email}) 및 접속 환경 정보가 자동 첨부됩니다.
            </span>
            <button
              type="submit"
              disabled={submitting || !subject.trim() || !content.trim()}
              className="px-5 py-2.5 rounded-xl bg-primary hover:bg-primary/90 text-primary-foreground text-sm font-bold flex items-center justify-center gap-2 shadow-sm disabled:opacity-50 transition-all cursor-pointer whitespace-nowrap"
            >
              <Send size={15} />
              <span>{submitting ? '전송 중...' : '총괄 관리자에게 문의 보내기'}</span>
            </button>
          </div>
        </form>

        {/* 우측: 내 문의 내역 및 답변 확인 */}
        <div className="lg:col-span-5 bg-card rounded-2xl border border-border p-5 space-y-4 shadow-xs">
          <div className="flex items-center justify-between border-b border-border pb-3">
            <h2 className="text-base font-bold text-foreground">
              내 문의 내역 <span className="text-primary font-mono text-sm">({myInquiries.length})</span>
            </h2>
            <button
              type="button"
              onClick={loadInquiries}
              disabled={loadingList}
              className="text-xs text-muted-foreground hover:text-foreground inline-flex items-center gap-1 cursor-pointer"
            >
              <RefreshCw size={12} className={loadingList ? 'animate-spin' : ''} />
              <span>새로고침</span>
            </button>
          </div>

          {myInquiries.length === 0 ? (
            <div className="py-10 text-center text-xs text-muted-foreground border border-dashed border-border rounded-xl space-y-1">
              <p className="font-semibold text-foreground/80">접수된 문의가 없습니다.</p>
              <p>문의를 남기시면 답변 진행 상태와 관리자 답변을 이곳에서 바로 확인하실 수 있습니다.</p>
            </div>
          ) : (
            <div className="space-y-2.5 max-h-[640px] overflow-y-auto pr-0.5">
              {myInquiries.map(item => {
                const isOpen = expandedId === item.id;
                const isNewReply = item.status === 'answered' && !item.userReadReply;
                return (
                  <div
                    key={item.id}
                    className={`rounded-xl border transition-all overflow-hidden ${
                      isNewReply
                        ? 'border-emerald-500/50 bg-emerald-500/5'
                        : 'border-border bg-background/60'
                    }`}
                  >
                    <button
                      type="button"
                      onClick={() => handleToggleExpand(item)}
                      className="w-full p-3.5 text-left space-y-1.5 cursor-pointer"
                    >
                      <div className="flex items-center justify-between gap-2">
                        <div className="flex items-center gap-1.5 flex-wrap">
                          {item.priority === 'urgent' && (
                            <span className="px-1.5 py-0.5 rounded text-[10px] font-extrabold bg-destructive text-white">
                              긴급
                            </span>
                          )}
                          <span className="text-[10.5px] font-semibold px-2 py-0.5 rounded bg-muted text-muted-foreground">
                            {INQUIRY_CATEGORY_META[item.category]?.label || item.category}
                          </span>
                          {isNewReply && (
                            <span className="px-2 py-0.5 rounded-full text-[10px] font-extrabold bg-emerald-500 text-white animate-pulse">
                              NEW 답변
                            </span>
                          )}
                        </div>

                        {item.status === 'answered' || item.status === 'closed' ? (
                          <span className="inline-flex items-center gap-1 text-[11px] font-bold text-emerald-600 dark:text-emerald-400 whitespace-nowrap shrink-0">
                            <CheckCircle2 size={12} /> 답변 완료
                          </span>
                        ) : item.status === 'in_progress' ? (
                          <span className="inline-flex items-center gap-1 text-[11px] font-bold text-blue-600 dark:text-blue-400 whitespace-nowrap shrink-0">
                            <Clock size={12} /> 확인 중
                          </span>
                        ) : (
                          <span className="inline-flex items-center gap-1 text-[11px] font-bold text-amber-600 dark:text-amber-400 whitespace-nowrap shrink-0">
                            <AlertCircle size={12} /> 접수 대기
                          </span>
                        )}
                      </div>

                      <div className="text-xs sm:text-sm font-bold text-foreground break-keep">
                        {item.subject}
                      </div>

                      <div className="flex items-center justify-between text-[11px] text-muted-foreground font-mono">
                        <span>{fmtDate(item.createdAt)}</span>
                        <span>{isOpen ? '접기 ▲' : '상세 보기 ▼'}</span>
                      </div>
                    </button>

                    {isOpen && (
                      <div className="px-3.5 pb-3.5 pt-2 border-t border-border/70 space-y-3 text-xs">
                        <div className="p-3 rounded-lg bg-muted/40 text-foreground whitespace-pre-wrap leading-relaxed break-words">
                          {item.content}
                        </div>

                        {item.adminReply ? (
                          <div className="p-3 rounded-lg bg-emerald-500/10 border border-emerald-500/25 space-y-1.5">
                            <div className="flex items-center justify-between text-[11px] font-bold text-emerald-700 dark:text-emerald-300">
                              <span>👑 서비스 총괄 관리자 답변</span>
                              <span className="font-mono font-normal opacity-80">
                                {fmtDate(item.repliedAt)}
                              </span>
                            </div>
                            <p className="text-foreground whitespace-pre-wrap leading-relaxed break-words">
                              {item.adminReply}
                            </p>
                          </div>
                        ) : (
                          <div className="p-2.5 rounded-lg bg-muted/30 text-[11px] text-muted-foreground text-center">
                            서비스 총괄 관리자가 확인 중입니다. 답변이 등록되면 상단 종 아이콘으로 바로 알림이 뜹니다.
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
