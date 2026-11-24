import React, { useState, useEffect } from 'react';
import { 
  Building2, Plus, Edit2, Trash2, Check, X, ShieldAlert, 
  Phone, DollarSign, FileText, Loader2, Sparkles, RefreshCw,
  Package, Tag
} from 'lucide-react';
import { 
  LeadVendor, fetchLeadVendors, createLeadVendor, 
  updateLeadVendor, deleteLeadVendor 
} from '../../services/vendor';
import { useToast } from '../../contexts/ToastContext';
import { useConfirmDialog } from '../../contexts/ConfirmDialogContext';

interface VendorManageModalProps {
  isOpen: boolean;
  onClose: () => void;
  onUpdated?: () => void;
}

export const VendorManageModal: React.FC<VendorManageModalProps> = ({
  isOpen,
  onClose,
  onUpdated,
}) => {
  const { showToast } = useToast();
  const { confirm } = useConfirmDialog();
  const [vendors, setVendors] = useState<LeadVendor[]>([]);
  const [loading, setLoading] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);

  // Form State: CPL 방식 또는 N건당 N원(패키지) 방식 완벽 지원
  const [formData, setFormData] = useState({
    name: '',
    pricingType: 'cpl' as 'cpl' | 'package',
    defaultUnitCost: 25000,
    packageLeads: 3000,
    packagePrice: 500000,
    leadType: '개인회생',
    asPolicy: '결번/중복 7일 이내 100% 무상 교환 또는 차감',
    contactPerson: '',
    memo: '',
  });

  const loadVendors = async () => {
    setLoading(true);
    try {
      const list = await fetchLeadVendors();
      setVendors(list);
    } catch (e: any) {
      showToast('거래처 목록 로드 실패: ' + e.message, 'error');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (isOpen) {
      loadVendors();
      resetForm();
    }
  }, [isOpen]);

  const resetForm = () => {
    setEditingId(null);
    setFormData({
      name: '',
      pricingType: 'cpl',
      defaultUnitCost: 25000,
      packageLeads: 3000,
      packagePrice: 500000,
      leadType: '개인회생',
      asPolicy: '결번/중복 7일 이내 100% 무상 교환 또는 차감',
      contactPerson: '',
      memo: '',
    });
  };

  const startEdit = (v: LeadVendor) => {
    setEditingId(v.id);
    const isPkg = v.pricingType === 'package';
    setFormData({
      name: v.name,
      pricingType: isPkg ? 'package' : 'cpl',
      defaultUnitCost: v.defaultUnitCost,
      packageLeads: v.packageLeads || 3000,
      packagePrice: v.packagePrice || (v.defaultUnitCost ? v.defaultUnitCost * 3000 : 500000),
      leadType: v.leadType,
      asPolicy: v.asPolicy || '',
      contactPerson: v.contactPerson || '',
      memo: v.memo || '',
    });
  };

  const computedUnitCost = formData.pricingType === 'package'
    ? (formData.packageLeads > 0 && formData.packagePrice > 0 ? Math.round(formData.packagePrice / formData.packageLeads) : 0)
    : formData.defaultUnitCost;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.name.trim()) {
      showToast('거래처 이름을 입력해주세요.', 'error');
      return;
    }

    setLoading(true);
    try {
      const payload = {
        name: formData.name.trim(),
        pricingType: formData.pricingType,
        packageLeads: formData.pricingType === 'package' ? formData.packageLeads : 0,
        packagePrice: formData.pricingType === 'package' ? formData.packagePrice : 0,
        defaultUnitCost: computedUnitCost,
        leadType: formData.leadType,
        asPolicy: formData.asPolicy,
        contactPerson: formData.contactPerson,
        memo: formData.memo,
      };

      if (editingId) {
        await updateLeadVendor(editingId, payload);
        showToast(`거래처 '${formData.name}' 정보가 수정되었습니다.`, 'success');
      } else {
        await createLeadVendor(payload);
        showToast(`새 거래처 '${formData.name}'이(가) 등록되었습니다.`, 'success');
      }
      resetForm();
      await loadVendors();
      onUpdated?.();
    } catch (err: any) {
      showToast(err.message || '저장 실패', 'error');
    } finally {
      setLoading(false);
    }
  };

  const handleDelete = async (id: string, name: string) => {
    const ok = await confirm({
      title: '거래처 삭제',
      message: `정말 거래처 '${name}'을(를) 삭제(비활성화)하시겠습니까?`,
      confirmText: '삭제',
      cancelText: '취소',
      variant: 'danger',
    });
    if (!ok) return;
    try {
      await deleteLeadVendor(id);
      showToast(`거래처 '${name}'이(가) 삭제되었습니다.`, 'success');
      await loadVendors();
      onUpdated?.();
    } catch (err: any) {
      showToast(err.message || '삭제 실패', 'error');
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-5 bg-background/80 backdrop-blur-xs animate-in fade-in duration-200 overflow-y-auto">
      <div className="relative w-full max-w-4xl max-h-[88vh] my-auto flex flex-col rounded-2xl bg-card border border-border shadow-2xl overflow-hidden text-card-foreground">
        
        {/* Header */}
        <div className="flex items-center justify-between p-4 sm:p-5 border-b border-border bg-card shrink-0">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-primary/10 border border-primary/20 flex items-center justify-center text-primary shrink-0">
              <Building2 size={20} strokeWidth={1.75} />
            </div>
            <div>
              <h2 className="text-base sm:text-lg font-bold text-foreground flex items-center gap-2">
                <span>DB 거래처(공급사) 마스터 관리</span>
                <span className="text-2xs px-2 py-0.5 rounded-md bg-primary/10 text-primary border border-primary/20 font-semibold">
                  {vendors.length}개 등록됨
                </span>
              </h2>
              <p className="text-xs text-muted-foreground mt-0.5">
                건당 CPL 방식 및 <strong>대량 패키지 구매(3,000건에 50만원 등)</strong> 정산 방식을 자유롭게 등록하고 관리합니다.
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 text-muted-foreground hover:text-foreground hover:bg-muted rounded-lg transition-colors cursor-pointer"
            title="창 닫기"
          >
            <X size={18} />
          </button>
        </div>

        {/* Content Body */}
        <div className="flex-1 overflow-y-auto p-5 sm:p-6 grid grid-cols-1 lg:grid-cols-12 gap-6 text-xs custom-scrollbar">
          
          {/* Left/Form: 등록/수정 패널 (5 cols) */}
          <div className="lg:col-span-5 bg-muted/30 p-5 rounded-xl border border-border flex flex-col">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-sm font-bold text-foreground flex items-center gap-1.5">
                {editingId ? <Edit2 size={14} className="text-primary" /> : <Plus size={14} className="text-primary" />}
                {editingId ? '거래처 정보 수정' : '신규 거래처 등록'}
              </h3>
              {editingId && (
                <button
                  type="button"
                  onClick={resetForm}
                  className="text-xs text-muted-foreground hover:text-foreground cursor-pointer"
                >
                  수정 취소
                </button>
              )}
            </div>

            <form onSubmit={handleSubmit} className="space-y-3.5 flex-1 flex flex-col justify-between">
              <div className="space-y-3.5">
                <div>
                  <label className="block text-2xs font-semibold text-muted-foreground mb-1">
                    거래처(공급사) 이름 <span className="text-destructive">*</span>
                  </label>
                  <input
                    type="text"
                    required
                    placeholder="예: 패스트애드, 메타 1팀, 네이버 파워링크, 대량DB센터"
                    value={formData.name}
                    onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                    className="w-full px-3 py-2 text-xs rounded-lg border border-input bg-background text-foreground focus:ring-1 focus:ring-primary focus:border-primary font-medium"
                  />
                </div>

                {/* 매입 정산 방식 선택 (CPL vs 대량 패키지) */}
                <div>
                  <label className="block text-2xs font-semibold text-muted-foreground mb-1">
                    매입 비용 정산 방식 선택
                  </label>
                  <div className="grid grid-cols-2 gap-1 p-0.5 bg-muted rounded-lg border border-border text-xs">
                    <button
                      type="button"
                      onClick={() => setFormData({ ...formData, pricingType: 'cpl' })}
                      className={`py-1.5 rounded-md font-semibold flex items-center justify-center gap-1.5 transition-all cursor-pointer ${
                        formData.pricingType === 'cpl'
                          ? 'bg-background text-primary font-bold shadow-2xs'
                          : 'text-muted-foreground hover:text-foreground'
                      }`}
                    >
                      <Tag size={13} /> 건당 단가 (CPL)
                    </button>
                    <button
                      type="button"
                      onClick={() => setFormData({ ...formData, pricingType: 'package' })}
                      className={`py-1.5 rounded-md font-semibold flex items-center justify-center gap-1.5 transition-all cursor-pointer ${
                        formData.pricingType === 'package'
                          ? 'bg-background text-primary font-bold shadow-2xs'
                          : 'text-muted-foreground hover:text-foreground'
                      }`}
                    >
                      <Package size={13} /> 📦 대량 패키지 (N건에 N원)
                    </button>
                  </div>
                </div>

                {/* 방식 1: CPL 건당 단가 입력 */}
                {formData.pricingType === 'cpl' ? (
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="block text-2xs font-semibold text-muted-foreground mb-1">
                        기본 매입 단가 (CPL)
                      </label>
                      <div className="relative">
                        <input
                          type="number"
                          min="0"
                          step="1"
                          placeholder="25000"
                          value={formData.defaultUnitCost}
                          onChange={(e) => setFormData({ ...formData, defaultUnitCost: Number(e.target.value) })}
                          className="w-full pl-6 pr-3 py-2 text-xs rounded-lg border border-input bg-background text-foreground focus:ring-1 focus:ring-primary focus:border-primary font-semibold tabular-nums"
                        />
                        <span className="absolute left-2 top-2 text-xs text-muted-foreground">₩</span>
                      </div>
                    </div>

                    <div>
                      <label className="block text-2xs font-semibold text-muted-foreground mb-1">
                        취급 DB 유형
                      </label>
                      <select
                        value={formData.leadType}
                        onChange={(e) => setFormData({ ...formData, leadType: e.target.value })}
                        className="w-full px-3 py-2 text-xs rounded-lg border border-input bg-background text-foreground focus:ring-1 focus:ring-primary focus:border-primary"
                      >
                        <option value="개인회생">개인회생</option>
                        <option value="파산">파산</option>
                        <option value="신용회복">신용회복</option>
                        <option value="새출발기금">새출발기금</option>
                        <option value="대출/금융">대출/금융</option>
                      </select>
                    </div>
                  </div>
                ) : (
                  /* 방식 2: 대량 패키지 (예: 3000건에 50만원) */
                  <div className="space-y-2.5 p-3.5 rounded-xl bg-muted/40 border border-border">
                    <div className="flex items-center justify-between text-2xs font-bold text-foreground">
                      <span>대량 패키지 계약 조건</span>
                      <span className="text-2xs font-normal text-muted-foreground">
                        예: 3,000건에 50만원
                      </span>
                    </div>

                    <div className="grid grid-cols-2 gap-2.5">
                      <div>
                        <label className="block text-2xs font-semibold text-muted-foreground mb-1">
                          공급 수량 (건수)
                        </label>
                        <input
                          type="number"
                          min="1"
                          step="1"
                          placeholder="3000"
                          value={formData.packageLeads}
                          onChange={(e) => setFormData({ ...formData, packageLeads: Math.max(0, Number(e.target.value)) })}
                          className="w-full px-3 py-1.5 text-xs rounded-lg border border-input bg-background text-foreground font-bold tabular-nums"
                        />
                      </div>

                      <div>
                        <label className="block text-2xs font-semibold text-muted-foreground mb-1">
                          패키지 총 매입금액 (원)
                        </label>
                        <div className="relative">
                          <input
                            type="number"
                            min="0"
                            step="1"
                            placeholder="500000"
                            value={formData.packagePrice}
                            onChange={(e) => setFormData({ ...formData, packagePrice: Math.max(0, Number(e.target.value)) })}
                            className="w-full pl-6 pr-3 py-1.5 text-xs rounded-lg border border-input bg-background text-foreground font-bold tabular-nums"
                          />
                          <span className="absolute left-2 top-1.5 text-xs text-muted-foreground">₩</span>
                        </div>
                      </div>
                    </div>

                    {/* 실시간 단가 환산 표시 배너 */}
                    <div className="flex items-center justify-between pt-2 border-t border-border text-2xs">
                      <span className="text-muted-foreground">
                        💡 <strong>{formData.packageLeads.toLocaleString()}건</strong>에 <strong>₩ {formData.packagePrice.toLocaleString()}원</strong>
                      </span>
                      <span className="font-bold text-primary tabular-nums">
                        건당 환산 단가: ₩ {computedUnitCost.toLocaleString()}원
                      </span>
                    </div>
                  </div>
                )}

                <div>
                  <label className="block text-2xs font-semibold text-muted-foreground mb-1">
                    불량 DB A/S 환불·교환 기준
                  </label>
                  <input
                    type="text"
                    placeholder="예: 결번/중복 7일 이내 100% 무상 교환 또는 차감"
                    value={formData.asPolicy}
                    onChange={(e) => setFormData({ ...formData, asPolicy: e.target.value })}
                    className="w-full px-3 py-2 text-xs rounded-lg border border-input bg-background text-foreground focus:ring-1 focus:ring-primary focus:border-primary"
                  />
                </div>

                <div>
                  <label className="block text-2xs font-semibold text-muted-foreground mb-1">
                    담당자 연락처 / 소통 채널
                  </label>
                  <input
                    type="text"
                    placeholder="예: 김영수 팀장 010-1234-5678 (카톡 fastad_kim)"
                    value={formData.contactPerson}
                    onChange={(e) => setFormData({ ...formData, contactPerson: e.target.value })}
                    className="w-full px-3 py-2 text-xs rounded-lg border border-input bg-background text-foreground focus:ring-1 focus:ring-primary focus:border-primary font-mono"
                  />
                </div>

                <div>
                  <label className="block text-2xs font-semibold text-muted-foreground mb-1">
                    특이사항 메모
                  </label>
                  <textarea
                    rows={2}
                    placeholder="정산일, 세금계산서 발행 조건 등 메모"
                    value={formData.memo}
                    onChange={(e) => setFormData({ ...formData, memo: e.target.value })}
                    className="w-full px-3 py-2 text-xs rounded-lg border border-input bg-background text-foreground focus:ring-1 focus:ring-primary focus:border-primary resize-none"
                  />
                </div>
              </div>

              <div className="pt-3 border-t border-border flex gap-2">
                <button
                  type="submit"
                  disabled={loading}
                  className="flex-1 py-2 px-4 rounded-lg bg-primary hover:bg-primary/90 text-primary-foreground font-semibold text-xs flex items-center justify-center gap-1.5 shadow-2xs transition-colors cursor-pointer"
                >
                  {loading ? <Loader2 size={14} className="animate-spin" /> : <Check size={14} />}
                  {editingId ? '수정 내용 저장' : '거래처 등록하기'}
                </button>
                {editingId && (
                  <button
                    type="button"
                    onClick={resetForm}
                    className="py-2 px-3 rounded-lg border border-border hover:bg-muted text-xs text-muted-foreground hover:text-foreground cursor-pointer"
                  >
                    취소
                  </button>
                )}
              </div>
            </form>
          </div>

          {/* Right/List: 거래처 목록 (7 cols) */}
          <div className="lg:col-span-7 flex flex-col space-y-3">
            <div className="flex items-center justify-between text-2xs text-muted-foreground pb-1">
              <span>등록된 거래처 목록</span>
              <button
                type="button"
                onClick={loadVendors}
                className="flex items-center gap-1 text-muted-foreground hover:text-primary transition-colors cursor-pointer"
              >
                <RefreshCw size={11} /> 새로고침
              </button>
            </div>

            <div className="flex-1 overflow-y-auto space-y-2.5 max-h-[490px] pr-1">
              {vendors.length === 0 ? (
                <div className="text-center py-16 border border-dashed border-border rounded-xl text-muted-foreground text-xs">
                  등록된 거래처가 없습니다. 좌측에서 신규 거래처를 등록하세요.
                </div>
              ) : (
                vendors.map((v) => (
                  <div
                    key={v.id}
                    className={`p-4 rounded-xl border transition-all ${
                      editingId === v.id
                        ? 'border-primary bg-primary/5 ring-1 ring-primary/30'
                        : 'border-border bg-card hover:border-primary/40 shadow-2xs'
                    }`}
                  >
                    <div className="flex items-start justify-between">
                      <div className="space-y-1.5">
                        <div className="flex items-center gap-2 flex-wrap">
                          <span className="font-bold text-sm text-foreground">
                            {v.name}
                          </span>
                          <span className="text-2xs px-2 py-0.5 rounded-md bg-muted text-muted-foreground font-semibold border border-border">
                            {v.leadType}
                          </span>
                          
                          {/* 가격 모델 뱃지 */}
                          {v.pricingType === 'package' ? (
                            <span className="inline-flex items-center gap-1 text-2xs font-bold px-2 py-0.5 rounded-md bg-primary/10 text-primary border border-primary/20">
                              <Package size={11} />
                              {(v.packageLeads || 0).toLocaleString()}건 ₩ {(v.packagePrice || 0).toLocaleString()}원 (건당 ₩ {v.defaultUnitCost.toLocaleString()}원)
                            </span>
                          ) : (
                            <span className="inline-flex items-center gap-1 text-2xs font-semibold px-2 py-0.5 rounded-md bg-primary/10 text-primary border border-primary/20 font-mono">
                              <Tag size={11} />
                              건당 CPL ₩ {v.defaultUnitCost.toLocaleString()}원
                            </span>
                          )}
                        </div>

                        {v.asPolicy && (
                          <div className="text-xs text-muted-foreground flex items-center gap-1.5">
                            <ShieldAlert size={12} className="text-amber-500 shrink-0" />
                            <span>A/S: {v.asPolicy}</span>
                          </div>
                        )}

                        {v.contactPerson && (
                          <div className="text-xs text-muted-foreground flex items-center gap-1.5 font-mono">
                            <Phone size={12} className="shrink-0 text-muted-foreground" />
                            <span>{v.contactPerson}</span>
                          </div>
                        )}
                      </div>

                      <div className="flex items-center gap-1 shrink-0 ml-2">
                        <button
                          onClick={() => startEdit(v)}
                          className="p-1.5 rounded-lg text-muted-foreground hover:text-foreground hover:bg-muted transition-colors cursor-pointer"
                          title="수정"
                        >
                          <Edit2 size={14} />
                        </button>
                        <button
                          onClick={() => handleDelete(v.id, v.name)}
                          className="p-1.5 rounded-lg text-muted-foreground hover:text-destructive hover:bg-destructive/10 transition-colors cursor-pointer"
                          title="삭제"
                        >
                          <Trash2 size={14} />
                        </button>
                      </div>
                    </div>
                  </div>
                ))
              )}
            </div>

            <div className="p-3 bg-muted/40 rounded-xl border border-border text-2xs text-muted-foreground flex items-start gap-2">
              <Sparkles size={14} className="shrink-0 mt-0.5 text-primary" />
              <span>
                <strong>팁:</strong> <strong>"3,000건에 50만원"</strong> 같은 대량 구매 거래처는 <strong>[대량 패키지]</strong> 방식을 선택하시면 건당 환산 단가(약 ₩ 167원)가 자동 산출되어 회차 등록 시 그대로 적용됩니다.
              </span>
            </div>
          </div>

        </div>

        {/* Footer */}
        <div className="p-4 border-t border-border bg-card flex justify-end shrink-0">
          <button
            onClick={onClose}
            className="px-4 py-2.5 rounded-xl bg-secondary hover:bg-muted text-foreground border border-border text-xs font-bold transition-colors cursor-pointer shadow-2xs"
          >
            닫기
          </button>
        </div>

      </div>
    </div>
  );
};
