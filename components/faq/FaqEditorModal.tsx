import React, { useEffect, useState } from 'react';
import { X, Plus, Trash2, Save } from 'lucide-react';
import { FaqItem } from '../../data/faqData';
import { StandardRoleKey } from '../../services/org';
import {
  INQUIRY_CATEGORY_META,
  InquiryCategory,
} from '../../services/supportInquiryService';
import { SaveFaqInput } from '../../services/faqService';

interface FaqEditorModalProps {
  isOpen: boolean;
  onClose: () => void;
  editingItem: FaqItem | null;
  defaultRole: StandardRoleKey;
  existingCategories: string[];
  onSave: (input: SaveFaqInput) => Promise<void>;
}

const ROLE_OPTIONS: { key: StandardRoleKey; label: string }[] = [
  { key: 'owner', label: 'TM대표' },
  { key: 'general_admin', label: '총괄 관리자' },
  { key: 'team_admin', label: '일반 관리자(팀장)' },
  { key: 'agent', label: '상담원' },
];

const ROUTE_PRESETS: { label: string; to: string }[] = [
  { label: '통합 대시보드 이동', to: '/' },
  { label: '케이스 관리 이동', to: '/cases' },
  { label: '간편 콜 모드 열기', to: '/lite' },
  { label: '오토콜 관제 센터', to: '/auto-dial' },
  { label: '일정 캘린더 이동', to: '/schedule' },
  { label: '요금제·결제 페이지', to: '/billing' },
  { label: '정산·손익 센터', to: '/settlement' },
  { label: '팀 관리로 이동', to: '/team' },
  { label: '텔레그램 연동 센터', to: '/telegram' },
  { label: '사내 공지사항 이동', to: '/notices' },
  { label: '신입 교육·모의콜', to: '/training' },
  { label: '시스템 설정 이동', to: '/settings' },
  { label: '마이페이지로 이동', to: '/mypage' },
];

export const FaqEditorModal: React.FC<FaqEditorModalProps> = ({
  isOpen,
  onClose,
  editingItem,
  defaultRole,
  existingCategories,
  onSave,
}) => {
  const [roles, setRoles] = useState<StandardRoleKey[]>([defaultRole]);
  const [category, setCategory] = useState('');
  const [question, setQuestion] = useState('');
  const [summary, setSummary] = useState('');
  const [steps, setSteps] = useState<string[]>(['']);
  const [tip, setTip] = useState('');
  const [warning, setWarning] = useState('');
  const [routeTo, setRouteTo] = useState('');
  const [routeLabel, setRouteLabel] = useState('');
  const [inquiryCategory, setInquiryCategory] = useState<InquiryCategory>('account_auth');
  const [tagsText, setTagsText] = useState('');
  const [sortOrder, setSortOrder] = useState(50);
  const [saving, setSaving] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');

  useEffect(() => {
    if (!isOpen) return;
    setErrorMsg('');
    if (editingItem) {
      setRoles(editingItem.roles);
      setCategory(editingItem.category);
      setQuestion(editingItem.question);
      setSummary(editingItem.summary);
      setSteps(editingItem.steps.length > 0 ? editingItem.steps : ['']);
      setTip(editingItem.tip || '');
      setWarning(editingItem.warning || '');
      setRouteTo(editingItem.relatedRoute?.to || '');
      setRouteLabel(editingItem.relatedRoute?.label || '');
      setInquiryCategory(editingItem.inquiryCategory);
      setTagsText(editingItem.tags.join(', '));
      setSortOrder(editingItem.sortOrder ?? 50);
    } else {
      setRoles([defaultRole]);
      setCategory(existingCategories.find(c => c !== '전체') || '공통 안내');
      setQuestion('');
      setSummary('');
      setSteps(['', '']);
      setTip('');
      setWarning('');
      setRouteTo('');
      setRouteLabel('');
      setInquiryCategory('account_auth');
      setTagsText('');
      setSortOrder(50);
    }
  }, [isOpen, editingItem, defaultRole, existingCategories]);

  if (!isOpen) return null;

  const toggleRole = (key: StandardRoleKey) => {
    setRoles(prev =>
      prev.includes(key) ? prev.filter(r => r !== key) : [...prev, key]
    );
  };

  const handleRoutePresetChange = (to: string) => {
    setRouteTo(to);
    const matched = ROUTE_PRESETS.find(p => p.to === to);
    setRouteLabel(matched ? matched.label : '');
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (roles.length === 0) {
      setErrorMsg('노출할 대상 직급을 최소 1개 이상 선택해주세요.');
      return;
    }
    if (!category.trim() || !question.trim() || !summary.trim()) {
      setErrorMsg('카테고리, 질문, 핵심 요약은 필수 입력 항목입니다.');
      return;
    }
    const cleanSteps = steps.map(s => s.trim()).filter(Boolean);
    if (cleanSteps.length === 0) {
      setErrorMsg('단계별 해결 방법을 최소 1단계 이상 입력해주세요.');
      return;
    }

    setSaving(true);
    setErrorMsg('');
    try {
      await onSave({
        id: editingItem?.id,
        roles,
        category: category.trim(),
        question: question.trim(),
        summary: summary.trim(),
        steps: cleanSteps,
        tip: tip.trim() || undefined,
        warning: warning.trim() || undefined,
        relatedRoute:
          routeTo && routeLabel ? { label: routeLabel, to: routeTo } : undefined,
        inquiryCategory,
        tags: tagsText
          .split(',')
          .map(t => t.trim())
          .filter(Boolean),
        sortOrder: Number(sortOrder) || 50,
      });
      onClose();
    } catch (err: any) {
      setErrorMsg(err?.message || 'FAQ 저장 중 오류가 발생했습니다.');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-5 bg-background/80 backdrop-blur-xs overflow-y-auto">
      <form
        onSubmit={handleSubmit}
        className="w-full max-w-2xl my-auto bg-card text-card-foreground rounded-2xl border border-border shadow-2xl overflow-hidden flex flex-col max-h-[92vh]"
      >
        {/* Header */}
        <div className="px-5 py-4 border-b border-border flex items-center justify-between bg-muted/30 shrink-0">
          <div>
            <h2 className="text-base font-bold text-foreground">
              {editingItem ? 'FAQ 항목 수정' : '새 FAQ 항목 등록'}
            </h2>
            <p className="text-xs text-muted-foreground mt-0.5">
              최고 서비스 관리자 전용 · 저장 즉시 해당 직급 사용자에게 반영됩니다.
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-1.5 rounded-lg text-muted-foreground hover:text-foreground hover:bg-muted cursor-pointer"
          >
            <X size={18} />
          </button>
        </div>

        {/* Body */}
        <div className="p-5 space-y-4 overflow-y-auto text-xs">
          {errorMsg && (
            <div className="p-3 rounded-xl bg-destructive/10 border border-destructive/30 text-destructive font-semibold">
              {errorMsg}
            </div>
          )}

          {/* 노출 대상 직급 */}
          <div className="space-y-1.5">
            <label className="font-bold text-foreground block">노출 대상 직급 (다중 선택)</label>
            <div className="flex flex-wrap gap-2">
              {ROLE_OPTIONS.map(opt => {
                const checked = roles.includes(opt.key);
                return (
                  <button
                    key={opt.key}
                    type="button"
                    onClick={() => toggleRole(opt.key)}
                    className={`px-3 py-1.5 rounded-lg font-semibold border transition-colors cursor-pointer ${
                      checked
                        ? 'bg-primary text-primary-foreground border-primary'
                        : 'bg-muted/40 text-muted-foreground border-border hover:text-foreground'
                    }`}
                  >
                    {checked ? '✓ ' : ''}
                    {opt.label}
                  </button>
                );
              })}
            </div>
          </div>

          {/* 카테고리 + 순서 */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <div className="sm:col-span-2 space-y-1.5">
              <label className="font-bold text-foreground block">카테고리</label>
              <input
                type="text"
                value={category}
                onChange={e => setCategory(e.target.value)}
                placeholder="예: 초기 세팅 · 멤버 초대"
                className="w-full px-3 py-2 rounded-xl bg-background border border-border text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-primary/50"
              />
              <div className="flex flex-wrap gap-1 pt-0.5">
                {existingCategories
                  .filter(c => c !== '전체')
                  .slice(0, 6)
                  .map(cat => (
                    <button
                      key={cat}
                      type="button"
                      onClick={() => setCategory(cat)}
                      className="px-2 py-0.5 rounded bg-muted hover:bg-muted/80 text-[10.5px] text-muted-foreground cursor-pointer"
                    >
                      {cat}
                    </button>
                  ))}
              </div>
            </div>
            <div className="space-y-1.5">
              <label className="font-bold text-foreground block">정렬 순서</label>
              <input
                type="number"
                value={sortOrder}
                onChange={e => setSortOrder(Number(e.target.value))}
                className="w-full px-3 py-2 rounded-xl bg-background border border-border text-sm text-foreground font-mono focus:outline-none focus:ring-2 focus:ring-primary/50"
              />
              <span className="text-[10.5px] text-muted-foreground block">작을수록 위쪽 노출</span>
            </div>
          </div>

          {/* 질문 */}
          <div className="space-y-1.5">
            <label className="font-bold text-foreground block">질문 (Q)</label>
            <input
              type="text"
              value={question}
              onChange={e => setQuestion(e.target.value)}
              placeholder="사용자가 실제로 묻는 형태의 질문을 입력하세요"
              className="w-full px-3 py-2 rounded-xl bg-background border border-border text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-primary/50"
            />
          </div>

          {/* 핵심 요약 */}
          <div className="space-y-1.5">
            <label className="font-bold text-foreground block">핵심 요약 (한눈에 보는 결론)</label>
            <textarea
              rows={2}
              value={summary}
              onChange={e => setSummary(e.target.value)}
              placeholder="질문에 대한 1~2줄 핵심 답변을 입력하세요"
              className="w-full px-3 py-2 rounded-xl bg-background border border-border text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-primary/50"
            />
          </div>

          {/* 단계별 상세 가이드 */}
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <label className="font-bold text-foreground">단계별 상세 해결 방법</label>
              <button
                type="button"
                onClick={() => setSteps(prev => [...prev, ''])}
                className="px-2.5 py-1 rounded-lg bg-primary/10 text-primary font-bold inline-flex items-center gap-1 cursor-pointer"
              >
                <Plus size={12} /> 단계 추가
              </button>
            </div>
            <div className="space-y-2">
              {steps.map((step, idx) => (
                <div key={idx} className="flex items-start gap-2">
                  <span className="w-6 h-8 rounded-lg bg-muted text-muted-foreground font-bold flex items-center justify-center shrink-0">
                    {idx + 1}
                  </span>
                  <input
                    type="text"
                    value={step}
                    onChange={e =>
                      setSteps(prev => prev.map((s, i) => (i === idx ? e.target.value : s)))
                    }
                    placeholder={`${idx + 1}단계 안내 문구`}
                    className="flex-1 px-3 py-1.5 rounded-xl bg-background border border-border text-xs text-foreground focus:outline-none focus:ring-2 focus:ring-primary/50"
                  />
                  {steps.length > 1 && (
                    <button
                      type="button"
                      onClick={() => setSteps(prev => prev.filter((_, i) => i !== idx))}
                      className="p-2 rounded-lg text-muted-foreground hover:text-destructive cursor-pointer"
                    >
                      <Trash2 size={14} />
                    </button>
                  )}
                </div>
              ))}
            </div>
          </div>

          {/* 팁 / 주의사항 */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <label className="font-bold text-foreground block">실무 팁 (선택)</label>
              <textarea
                rows={2}
                value={tip}
                onChange={e => setTip(e.target.value)}
                placeholder="알아두면 좋은 실무 팁"
                className="w-full px-3 py-2 rounded-xl bg-background border border-border text-xs text-foreground focus:outline-none focus:ring-2 focus:ring-primary/50"
              />
            </div>
            <div className="space-y-1.5">
              <label className="font-bold text-foreground block">주의사항 (선택)</label>
              <textarea
                rows={2}
                value={warning}
                onChange={e => setWarning(e.target.value)}
                placeholder="실수하기 쉬운 주의사항"
                className="w-full px-3 py-2 rounded-xl bg-background border border-border text-xs text-foreground focus:outline-none focus:ring-2 focus:ring-primary/50"
              />
            </div>
          </div>

          {/* 연관 메뉴 바로가기 + 연결 문의 카테고리 */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <label className="font-bold text-foreground block">연관 메뉴 바로가기 (선택)</label>
              <select
                value={routeTo}
                onChange={e => handleRoutePresetChange(e.target.value)}
                className="w-full px-3 py-2 rounded-xl bg-background border border-border text-xs text-foreground focus:outline-none focus:ring-2 focus:ring-primary/50"
              >
                <option value="">바로가기 없음</option>
                {ROUTE_PRESETS.map(p => (
                  <option key={p.to} value={p.to}>
                    {p.label} ({p.to})
                  </option>
                ))}
              </select>
            </div>
            <div className="space-y-1.5">
              <label className="font-bold text-foreground block">연결 1:1 문의 유형</label>
              <select
                value={inquiryCategory}
                onChange={e => setInquiryCategory(e.target.value as InquiryCategory)}
                className="w-full px-3 py-2 rounded-xl bg-background border border-border text-xs text-foreground focus:outline-none focus:ring-2 focus:ring-primary/50"
              >
                {(Object.keys(INQUIRY_CATEGORY_META) as InquiryCategory[]).map(k => (
                  <option key={k} value={k}>
                    {INQUIRY_CATEGORY_META[k].label}
                  </option>
                ))}
              </select>
            </div>
          </div>

          {/* 검색 태그 */}
          <div className="space-y-1.5">
            <label className="font-bold text-foreground block">검색 태그 (쉼표로 구분)</label>
            <input
              type="text"
              value={tagsText}
              onChange={e => setTagsText(e.target.value)}
              placeholder="예: 텔레그램, 봇, 토큰, 그룹방"
              className="w-full px-3 py-2 rounded-xl bg-background border border-border text-xs text-foreground focus:outline-none focus:ring-2 focus:ring-primary/50"
            />
          </div>
        </div>

        {/* Footer */}
        <div className="px-5 py-3.5 border-t border-border bg-muted/20 flex items-center justify-end gap-2 shrink-0">
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2 rounded-xl bg-muted hover:bg-muted/80 text-xs font-semibold text-foreground cursor-pointer"
          >
            취소
          </button>
          <button
            type="submit"
            disabled={saving}
            className="px-4 py-2 rounded-xl bg-primary hover:bg-primary/90 text-primary-foreground text-xs font-bold inline-flex items-center gap-1.5 cursor-pointer disabled:opacity-50"
          >
            <Save size={14} />
            <span>{saving ? '저장 중...' : editingItem ? '수정 내용 저장' : 'FAQ 등록하기'}</span>
          </button>
        </div>
      </form>
    </div>
  );
};
