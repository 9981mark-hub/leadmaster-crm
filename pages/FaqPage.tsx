import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  HelpCircle,
  Search,
  ChevronDown,
  ChevronUp,
  ArrowRight,
  MessageSquarePlus,
  Lightbulb,
  AlertTriangle,
  Sparkles,
  ExternalLink,
  Plus,
  Pencil,
  Trash2,
} from 'lucide-react';
import { useAuth } from '../contexts/AuthContext';
import { useToast } from '../contexts/ToastContext';
import { useConfirmDialog } from '../contexts/ConfirmDialogContext';
import { StandardRoleKey } from '../services/org';
import {
  FAQ_ITEMS,
  FAQ_ROLE_META,
  FaqItem,
  resolveFaqRoleKey,
} from '../data/faqData';
import {
  SaveFaqInput,
  deleteFaqItem,
  fetchFaqItems,
  saveFaqItem,
  subscribeToFaqChanges,
} from '../services/faqService';
import { FaqEditorModal } from '../components/faq/FaqEditorModal';

const ROLE_SWITCH_OPTIONS: { key: StandardRoleKey; label: string }[] = [
  { key: 'owner', label: 'TM대표' },
  { key: 'general_admin', label: '총괄관리자' },
  { key: 'team_admin', label: '팀장(일반)' },
  { key: 'agent', label: '상담원' },
];

export default function FaqPage() {
  const navigate = useNavigate();
  const { org, isPlatformAdmin } = useAuth();
  const { showToast } = useToast();
  const { confirm } = useConfirmDialog();

  const myRoleKey = resolveFaqRoleKey(org?.role, org?.adminPermissions?.tier);
  const canPreviewOtherRoles = isPlatformAdmin || myRoleKey === 'owner';

  const [allFaqs, setAllFaqs] = useState<FaqItem[]>(FAQ_ITEMS);
  const [selectedRole, setSelectedRole] = useState<StandardRoleKey>(myRoleKey);
  const [selectedCategory, setSelectedCategory] = useState<string>('전체');
  const [searchQuery, setSearchQuery] = useState('');
  const [openId, setOpenId] = useState<string | null>(null);

  // 최고 서비스 관리자(isPlatformAdmin) 전용 등록·수정 모달 상태
  const [isEditorOpen, setIsEditorOpen] = useState(false);
  const [editingItem, setEditingItem] = useState<FaqItem | null>(null);

  const loadFaqs = useCallback(async () => {
    const items = await fetchFaqItems();
    setAllFaqs(items);
  }, []);

  useEffect(() => {
    loadFaqs();
    const unsub = subscribeToFaqChanges(() => {
      loadFaqs();
    });
    return unsub;
  }, [loadFaqs]);

  const activeRole: StandardRoleKey = canPreviewOtherRoles ? selectedRole : myRoleKey;
  const roleMeta = FAQ_ROLE_META[activeRole];

  const roleItems = useMemo(
    () => allFaqs.filter(item => item.roles.includes(activeRole)),
    [allFaqs, activeRole]
  );

  const categories = useMemo(() => {
    const unique = Array.from(new Set(roleItems.map(i => i.category)));
    return ['전체', ...unique];
  }, [roleItems]);

  const allCategories = useMemo(
    () => Array.from(new Set(allFaqs.map(i => i.category))),
    [allFaqs]
  );

  const filteredItems = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    return roleItems.filter(item => {
      if (selectedCategory !== '전체' && item.category !== selectedCategory) return false;
      if (!q) return true;
      const haystack = [
        item.question,
        item.summary,
        item.category,
        ...item.steps,
        ...item.tags,
      ]
        .join(' ')
        .toLowerCase();
      return haystack.includes(q);
    });
  }, [roleItems, selectedCategory, searchQuery]);

  const handleRoleChange = (nextRole: StandardRoleKey) => {
    setSelectedRole(nextRole);
    setSelectedCategory('전체');
    setOpenId(null);
  };

  const handleEscalateToInquiry = (item: FaqItem) => {
    navigate('/inquiry', {
      state: {
        category: item.inquiryCategory,
        subject: `[FAQ 관련 문의] ${item.question}`,
      },
    });
  };

  const handleOpenCreate = () => {
    setEditingItem(null);
    setIsEditorOpen(true);
  };

  const handleOpenEdit = (e: React.MouseEvent, item: FaqItem) => {
    e.stopPropagation();
    setEditingItem(item);
    setIsEditorOpen(true);
  };

  const handleSaveFaq = async (input: SaveFaqInput) => {
    await saveFaqItem(input);
    await loadFaqs();
    showToast(
      input.id ? 'FAQ 항목이 수정되었습니다.' : '새 FAQ 항목이 등록되었습니다.',
      'success'
    );
  };

  const handleDeleteFaq = async (e: React.MouseEvent, item: FaqItem) => {
    e.stopPropagation();
    const ok = await confirm({
      title: 'FAQ 항목 삭제',
      message: `'${item.question}' 항목을 삭제할까요?\n삭제 즉시 모든 사용자 화면에서 숨겨집니다.`,
      confirmLabel: '삭제',
      cancelLabel: '취소',
      tone: 'danger',
    });
    if (!ok) return;
    try {
      await deleteFaqItem(item);
      await loadFaqs();
      if (openId === item.id) setOpenId(null);
      showToast('FAQ 항목을 삭제했습니다.', 'success');
    } catch (err: any) {
      showToast(err?.message || 'FAQ 삭제 중 오류가 발생했습니다.', 'error');
    }
  };

  return (
    <div className="max-w-5xl mx-auto space-y-5 pb-14">
      {/* 상단 직급 맞춤 헤더 카드 */}
      <div className="bg-card rounded-2xl border border-border p-5 sm:p-6 shadow-xs space-y-4">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div className="space-y-1.5 min-w-0">
            <div className="flex items-center gap-2 flex-wrap">
              <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-bold bg-primary/10 text-primary border border-primary/20">
                <Sparkles size={12} />
                {roleMeta.badge}
              </span>
              {canPreviewOtherRoles && selectedRole !== myRoleKey && (
                <span className="text-[11px] font-semibold px-2 py-0.5 rounded-md bg-amber-500/10 text-amber-600 dark:text-amber-400 border border-amber-500/20">
                  타 직급 미리보기 중
                </span>
              )}
              {isPlatformAdmin && (
                <span className="text-[11px] font-bold px-2 py-0.5 rounded-md bg-purple-500/15 text-purple-600 dark:text-purple-300 border border-purple-500/25">
                  최고관리자 편집 가능
                </span>
              )}
            </div>
            <h1 className="text-xl sm:text-2xl font-bold text-foreground flex items-center gap-2 break-keep">
              <HelpCircle size={22} className="text-primary shrink-0" />
              <span>자주 묻는 질문 (사용 가이드 &amp; 설정 FAQ)</span>
            </h1>
            <p className="text-xs sm:text-sm text-muted-foreground break-keep leading-relaxed">
              {roleMeta.desc}
            </p>
          </div>

          <div className="flex items-center gap-2 flex-wrap shrink-0">
            {isPlatformAdmin && (
              <button
                type="button"
                onClick={handleOpenCreate}
                className="px-3.5 py-2.5 rounded-xl bg-foreground text-background hover:opacity-90 text-xs sm:text-sm font-bold flex items-center justify-center gap-1.5 shadow-xs transition-all cursor-pointer whitespace-nowrap"
              >
                <Plus size={16} />
                <span>새 FAQ 등록</span>
              </button>
            )}
            <button
              type="button"
              onClick={() => navigate('/inquiry')}
              className="px-4 py-2.5 rounded-xl bg-primary hover:bg-primary/90 text-primary-foreground text-xs sm:text-sm font-bold flex items-center justify-center gap-2 shadow-xs transition-all cursor-pointer whitespace-nowrap"
            >
              <MessageSquarePlus size={16} />
              <span>해결 안 될 땐 1:1 문의하기</span>
            </button>
          </div>
        </div>

        {/* 대표/플랫폼 관리자 전용: 직급별 FAQ 미리보기 전환 */}
        {canPreviewOtherRoles && (
          <div className="pt-3 border-t border-border flex flex-col sm:flex-row sm:items-center justify-between gap-2">
            <span className="text-xs font-semibold text-muted-foreground">
              직급별 FAQ 전환 보기:
            </span>
            <div className="flex items-center gap-1.5 flex-wrap">
              {ROLE_SWITCH_OPTIONS.map(opt => (
                <button
                  key={opt.key}
                  type="button"
                  onClick={() => handleRoleChange(opt.key)}
                  className={`px-3 py-1 rounded-lg text-xs font-semibold border transition-colors cursor-pointer whitespace-nowrap ${
                    activeRole === opt.key
                      ? 'bg-primary text-primary-foreground border-primary shadow-2xs'
                      : 'bg-muted/50 text-muted-foreground border-border hover:text-foreground'
                  }`}
                >
                  {opt.label}
                  {opt.key === myRoleKey ? ' (내 직급)' : ''}
                </button>
              ))}
            </div>
          </div>
        )}
      </div>

      {/* 검색창 & 카테고리 필터 */}
      <div className="space-y-3">
        <div className="relative">
          <Search
            size={16}
            className="absolute left-3.5 top-1/2 -translate-y-1/2 text-muted-foreground pointer-events-none"
          />
          <input
            type="text"
            value={searchQuery}
            onChange={e => setSearchQuery(e.target.value)}
            placeholder="궁금한 기능이나 오류를 검색해 보세요 (예: 텔레그램, 녹음, 별칭, APK, 권한, 정산)"
            className="w-full pl-10 pr-4 py-2.5 rounded-xl bg-card border border-border text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary/50 shadow-2xs"
          />
        </div>

        <div className="flex items-center gap-1.5 flex-wrap">
          {categories.map(cat => {
            const count =
              cat === '전체'
                ? roleItems.length
                : roleItems.filter(i => i.category === cat).length;
            const active = selectedCategory === cat;
            return (
              <button
                key={cat}
                type="button"
                onClick={() => setSelectedCategory(cat)}
                className={`px-3 py-1.5 rounded-full text-xs font-semibold border transition-all cursor-pointer whitespace-nowrap ${
                  active
                    ? 'bg-foreground text-background border-foreground shadow-2xs'
                    : 'bg-card text-muted-foreground border-border hover:text-foreground hover:bg-muted/50'
                }`}
              >
                {cat} <span className="opacity-70 font-mono">({count})</span>
              </button>
            );
          })}
        </div>
      </div>

      {/* FAQ 아코디언 목록 */}
      {filteredItems.length === 0 ? (
        <div className="bg-card rounded-2xl border border-dashed border-border p-8 text-center space-y-3">
          <p className="text-sm font-semibold text-foreground">
            {searchQuery
              ? `“${searchQuery}”에 대한 FAQ 검색 결과가 없습니다.`
              : '등록된 FAQ 항목이 없습니다.'}
          </p>
          <p className="text-xs text-muted-foreground">
            다른 키워드로 검색하거나 서비스 총괄 관리자에게 1:1 문의를 남겨주세요.
          </p>
          <button
            type="button"
            onClick={() =>
              navigate('/inquiry', {
                state: { subject: searchQuery ? `[질문] ${searchQuery}` : '' },
              })
            }
            className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl bg-primary text-primary-foreground text-xs font-bold cursor-pointer"
          >
            <MessageSquarePlus size={14} />
            <span>이 내용으로 1:1 문의하기</span>
          </button>
        </div>
      ) : (
        <div className="space-y-2.5">
          {filteredItems.map(item => {
            const isOpen = openId === item.id;
            return (
              <div
                key={item.id}
                className={`bg-card rounded-2xl border transition-all overflow-hidden ${
                  isOpen
                    ? 'border-primary/50 shadow-sm'
                    : 'border-border hover:border-primary/30'
                }`}
              >
                <div
                  role="button"
                  tabIndex={0}
                  onClick={() => setOpenId(isOpen ? null : item.id)}
                  onKeyDown={e => {
                    if (e.key === 'Enter' || e.key === ' ') {
                      e.preventDefault();
                      setOpenId(isOpen ? null : item.id);
                    }
                  }}
                  className="w-full px-4 sm:px-5 py-4 text-left flex items-start justify-between gap-3 cursor-pointer"
                >
                  <div className="space-y-1.5 min-w-0 flex-1">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="text-[11px] font-bold px-2 py-0.5 rounded-md bg-muted text-muted-foreground border border-border/70">
                        {item.category}
                      </span>
                      {isPlatformAdmin && (
                        <span className="text-[10.5px] font-mono text-muted-foreground">
                          대상: {item.roles.map(r => FAQ_ROLE_META[r]?.label.split(' ')[0]).join('·')}
                        </span>
                      )}
                    </div>
                    <h2 className="text-sm sm:text-[15px] font-bold text-foreground break-keep leading-snug">
                      Q. {item.question}
                    </h2>
                    {!isOpen && (
                      <p className="text-xs text-muted-foreground line-clamp-2 break-keep leading-relaxed">
                        {item.summary}
                      </p>
                    )}
                  </div>

                  <div className="flex items-center gap-1.5 shrink-0 mt-0.5">
                    {isPlatformAdmin && (
                      <>
                        <button
                          type="button"
                          onClick={e => handleOpenEdit(e, item)}
                          title="FAQ 수정"
                          className="p-1.5 rounded-lg bg-muted/60 hover:bg-primary/15 text-muted-foreground hover:text-primary transition-colors cursor-pointer"
                        >
                          <Pencil size={14} />
                        </button>
                        <button
                          type="button"
                          onClick={e => handleDeleteFaq(e, item)}
                          title="FAQ 삭제"
                          className="p-1.5 rounded-lg bg-muted/60 hover:bg-destructive/15 text-muted-foreground hover:text-destructive transition-colors cursor-pointer"
                        >
                          <Trash2 size={14} />
                        </button>
                      </>
                    )}
                    <div className="p-1.5 rounded-lg bg-muted/60 text-muted-foreground">
                      {isOpen ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
                    </div>
                  </div>
                </div>

                {isOpen && (
                  <div className="px-4 sm:px-5 pb-5 pt-1 border-t border-border/60 space-y-4 bg-muted/15">
                    {/* 한눈에 요약 */}
                    <div className="p-3.5 rounded-xl bg-primary/5 border border-primary/20 text-xs sm:text-[13px] font-semibold text-foreground leading-relaxed break-keep">
                      {item.summary}
                    </div>

                    {/* 단계별 상세 가이드 */}
                    <div className="space-y-2">
                      <span className="text-[11px] font-bold uppercase tracking-wider text-muted-foreground">
                        단계별 해결 방법
                      </span>
                      <ol className="space-y-2">
                        {item.steps.map((step, idx) => (
                          <li
                            key={idx}
                            className="flex items-start gap-2.5 text-xs sm:text-[13px] text-foreground/90 leading-relaxed break-keep"
                          >
                            <span className="w-5 h-5 rounded-full bg-primary text-primary-foreground text-[11px] font-bold flex items-center justify-center shrink-0 mt-0.5">
                              {idx + 1}
                            </span>
                            <span>{step}</span>
                          </li>
                        ))}
                      </ol>
                    </div>

                    {/* 실무 팁 / 주의사항 */}
                    {item.tip && (
                      <div className="p-3 rounded-xl bg-blue-500/10 border border-blue-500/20 flex items-start gap-2 text-xs text-blue-700 dark:text-blue-300 leading-relaxed break-keep">
                        <Lightbulb size={15} className="shrink-0 mt-0.5" />
                        <span>
                          <strong>실무 팁:</strong> {item.tip}
                        </span>
                      </div>
                    )}

                    {item.warning && (
                      <div className="p-3 rounded-xl bg-amber-500/10 border border-amber-500/25 flex items-start gap-2 text-xs text-amber-700 dark:text-amber-300 leading-relaxed break-keep">
                        <AlertTriangle size={15} className="shrink-0 mt-0.5" />
                        <span>
                          <strong>주의사항:</strong> {item.warning}
                        </span>
                      </div>
                    )}

                    {/* 하단 바로가기 & 문의 연결 */}
                    <div className="pt-2 border-t border-border/60 flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                      <div className="flex items-center gap-1.5 flex-wrap">
                        {item.tags.slice(0, 4).map(t => (
                          <span
                            key={t}
                            className="text-[10.5px] px-2 py-0.5 rounded bg-muted text-muted-foreground"
                          >
                            #{t}
                          </span>
                        ))}
                      </div>

                      <div className="flex items-center gap-2 flex-wrap">
                        {item.relatedRoute && (
                          <button
                            type="button"
                            onClick={() => navigate(item.relatedRoute!.to)}
                            className="px-3 py-1.5 rounded-lg bg-card hover:bg-muted border border-border text-xs font-semibold text-foreground inline-flex items-center gap-1.5 cursor-pointer transition-colors"
                          >
                            <span>{item.relatedRoute.label}</span>
                            <ExternalLink size={12} />
                          </button>
                        )}
                        <button
                          type="button"
                          onClick={() => handleEscalateToInquiry(item)}
                          className="px-3 py-1.5 rounded-lg bg-primary/10 hover:bg-primary/20 border border-primary/25 text-xs font-bold text-primary inline-flex items-center gap-1.5 cursor-pointer transition-colors"
                        >
                          <MessageSquarePlus size={12} />
                          <span>그래도 안 되면 문의하기</span>
                        </button>
                      </div>
                    </div>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}

      {/* 하단 문의 유도 카드 */}
      <div className="bg-card rounded-2xl border border-border p-4 sm:p-5 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div className="space-y-0.5">
          <h3 className="text-sm font-bold text-foreground">
            가이드로 해결되지 않거나 오류·개선 건의가 있으신가요?
          </h3>
          <p className="text-xs text-muted-foreground break-keep">
            1:1 문의를 남기시면 서비스 총괄 관리자에게 실시간 알림이 전달되며, 답변 시 상단 종 아이콘으로 바로 안내됩니다.
          </p>
        </div>
        <button
          type="button"
          onClick={() => navigate('/inquiry')}
          className="shrink-0 px-4 py-2.5 rounded-xl bg-foreground text-background hover:opacity-90 text-xs font-bold inline-flex items-center justify-center gap-1.5 cursor-pointer whitespace-nowrap"
        >
          <span>1:1 문의 접수하기</span>
          <ArrowRight size={14} />
        </button>
      </div>

      {/* 최고 서비스 관리자 전용 FAQ 등록/수정 모달 */}
      {isPlatformAdmin && (
        <FaqEditorModal
          isOpen={isEditorOpen}
          onClose={() => {
            setIsEditorOpen(false);
            setEditingItem(null);
          }}
          editingItem={editingItem}
          defaultRole={activeRole}
          existingCategories={allCategories}
          onSave={handleSaveFaq}
        />
      )}
    </div>
  );
}
