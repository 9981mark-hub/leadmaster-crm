import React, { useState, useMemo, useEffect } from 'react';
import { X, Building2, Save, Mail, User, MapPin, Hash, Check } from 'lucide-react';
import { OrgTaxInfo } from '../../services/billingService';
import { useToast } from '../../contexts/ToastContext';

interface TaxInfoEditModalProps {
  isOpen: boolean;
  onClose: () => void;
  taxInfo?: OrgTaxInfo;
  currentInfo?: OrgTaxInfo;
  onSave: (info: OrgTaxInfo) => Promise<void>;
  showToast?: (msg: string, type?: 'success' | 'error' | 'info') => void;
}

export const TaxInfoEditModal: React.FC<TaxInfoEditModalProps> = ({
  isOpen,
  onClose,
  taxInfo,
  currentInfo,
  onSave,
  showToast: propShowToast,
}) => {
  const { showToast: ctxShowToast } = useToast();
  const triggerToast = propShowToast || ctxShowToast;

  const initialInfo = useMemo<OrgTaxInfo>(() => {
    const src = currentInfo || taxInfo;
    return {
      businessNumber: src?.businessNumber || '',
      companyName: src?.companyName || '',
      representativeName: src?.representativeName || '',
      businessAddress: src?.businessAddress || '',
      taxInvoiceEmail: src?.taxInvoiceEmail || '',
      businessType: src?.businessType || '서비스업',
      businessItem: src?.businessItem || '콜영업 및 마케팅대행',
    };
  }, [currentInfo, taxInfo]);

  const [businessNumber, setBusinessNumber] = useState(initialInfo.businessNumber);
  const [companyName, setCompanyName] = useState(initialInfo.companyName);
  const [representativeName, setRepresentativeName] = useState(initialInfo.representativeName);
  const [businessAddress, setBusinessAddress] = useState(initialInfo.businessAddress);
  const [taxInvoiceEmail, setTaxInvoiceEmail] = useState(initialInfo.taxInvoiceEmail);
  const [businessType, setBusinessType] = useState(initialInfo.businessType);
  const [businessItem, setBusinessItem] = useState(initialInfo.businessItem);
  const [saving, setSaving] = useState(false);

  // 모달이 열릴 때 최신 initialInfo 동기화
  React.useEffect(() => {
    if (isOpen) {
      setBusinessNumber(initialInfo.businessNumber);
      setCompanyName(initialInfo.companyName);
      setRepresentativeName(initialInfo.representativeName);
      setBusinessAddress(initialInfo.businessAddress);
      setTaxInvoiceEmail(initialInfo.taxInvoiceEmail);
      setBusinessType(initialInfo.businessType);
      setBusinessItem(initialInfo.businessItem);
    }
  }, [isOpen, initialInfo]);

  if (!isOpen) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!companyName.trim()) {
      triggerToast('상호(회사명)를 입력해주세요.', 'error');
      return;
    }
    if (!representativeName.trim()) {
      triggerToast('대표자 성명을 입력해주세요.', 'error');
      return;
    }
    if (!taxInvoiceEmail.trim()) {
      triggerToast('세금계산서 수신 이메일을 입력해주세요.', 'error');
      return;
    }

    try {
      setSaving(true);
      await onSave({
        businessNumber: businessNumber.trim(),
        companyName: companyName.trim(),
        representativeName: representativeName.trim(),
        businessAddress: businessAddress.trim(),
        taxInvoiceEmail: taxInvoiceEmail.trim().toLowerCase(),
        businessType: businessType.trim(),
        businessItem: businessItem.trim(),
      });
      triggerToast('전자세금계산서 발행 정보가 성공적으로 저장되었습니다.', 'success');
      onClose();
    } catch (err: any) {
      triggerToast('세금계산서 정보 저장 중 오류가 발생했습니다: ' + (err.message || '다시 시도해주세요.'), 'error');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-5 bg-background/80 backdrop-blur-xs animate-in fade-in duration-200 overflow-y-auto">
      <div className="relative w-full max-w-lg max-h-[88vh] my-auto flex flex-col rounded-2xl bg-card border border-border shadow-2xl overflow-hidden text-card-foreground">
        {/* Header */}
        <div className="p-4 sm:p-5 border-b border-border flex items-center justify-between bg-card shrink-0">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-primary/10 border border-primary/20 text-primary flex items-center justify-center shrink-0">
              <Building2 size={18} strokeWidth={1.75} />
            </div>
            <div>
              <h3 className="text-base font-bold text-foreground flex items-center gap-2">
                <span>전자세금계산서 발행 정보 수정</span>
              </h3>
              <p className="text-xs text-muted-foreground mt-0.5">
                국세청 홈택스 정규 세금계산서 발행 시 반영되는 사업자 정보입니다.
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-lg text-muted-foreground hover:text-foreground hover:bg-muted transition-colors cursor-pointer"
            title="창 닫기"
          >
            <X size={18} />
          </button>
        </div>

        {/* Form Body (Scrollable) */}
        <form onSubmit={handleSubmit} className="flex-1 overflow-y-auto p-5 sm:p-6 space-y-4 custom-scrollbar text-xs">
          {/* 사업자등록번호 */}
          <div>
            <label className="block text-2xs font-semibold text-muted-foreground mb-1">
              사업자등록번호
            </label>
            <div className="relative">
              <Hash size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
              <input
                type="text"
                value={businessNumber}
                onChange={e => setBusinessNumber(e.target.value)}
                placeholder="예: 123-45-67890"
                className="w-full pl-9 pr-3 py-2 rounded-xl border border-input bg-background text-foreground font-mono focus:outline-none focus:ring-1 focus:ring-primary focus:border-primary transition-colors text-xs"
              />
            </div>
          </div>

          {/* 상호 & 대표자명 (2-Column) */}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-2xs font-semibold text-muted-foreground mb-1">
                상호 (법인명) <span className="text-primary">*</span>
              </label>
              <input
                type="text"
                value={companyName}
                onChange={e => setCompanyName(e.target.value)}
                required
                placeholder="예: 리드마스터 파트너스"
                className="w-full px-3 py-2 rounded-xl border border-input bg-background text-foreground font-medium focus:outline-none focus:ring-1 focus:ring-primary focus:border-primary transition-colors text-xs"
              />
            </div>
            <div>
              <label className="block text-2xs font-semibold text-muted-foreground mb-1">
                대표자 성명 <span className="text-primary">*</span>
              </label>
              <input
                type="text"
                value={representativeName}
                onChange={e => setRepresentativeName(e.target.value)}
                required
                placeholder="예: 홍길동"
                className="w-full px-3 py-2 rounded-xl border border-input bg-background text-foreground font-medium focus:outline-none focus:ring-1 focus:ring-primary focus:border-primary transition-colors text-xs"
              />
            </div>
          </div>

          {/* 세금계산서 수신 이메일 */}
          <div>
            <label className="block text-2xs font-semibold text-muted-foreground mb-1">
              세금계산서 수신 이메일 <span className="text-primary">*</span>
            </label>
            <div className="relative">
              <Mail size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
              <input
                type="email"
                value={taxInvoiceEmail}
                onChange={e => setTaxInvoiceEmail(e.target.value)}
                required
                placeholder="예: accounting@company.com"
                className="w-full pl-9 pr-3 py-2 rounded-xl border border-input bg-background text-foreground font-mono focus:outline-none focus:ring-1 focus:ring-primary focus:border-primary transition-colors text-xs"
              />
            </div>
            <p className="text-2xs text-muted-foreground mt-1">입금 완료 시 해당 메일로 국세청 전자세금계산서가 자동 발송됩니다.</p>
          </div>

          {/* 사업장 소재지 */}
          <div>
            <label className="block text-2xs font-semibold text-muted-foreground mb-1">
              사업장 주소
            </label>
            <div className="relative">
              <MapPin size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
              <input
                type="text"
                value={businessAddress}
                onChange={e => setBusinessAddress(e.target.value)}
                placeholder="예: 서울특별시 강남구 테헤란로 152, 10층"
                className="w-full pl-9 pr-3 py-2 rounded-xl border border-input bg-background text-foreground focus:outline-none focus:ring-1 focus:ring-primary focus:border-primary transition-colors text-xs"
              />
            </div>
          </div>

          {/* 업태 & 종목 (2-Column) */}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-2xs font-semibold text-muted-foreground mb-1">
                업태
              </label>
              <input
                type="text"
                value={businessType}
                onChange={e => setBusinessType(e.target.value)}
                placeholder="예: 서비스업"
                className="w-full px-3 py-2 rounded-xl border border-input bg-background text-foreground focus:outline-none focus:ring-1 focus:ring-primary focus:border-primary transition-colors text-xs"
              />
            </div>
            <div>
              <label className="block text-2xs font-semibold text-muted-foreground mb-1">
                종목
              </label>
              <input
                type="text"
                value={businessItem}
                onChange={e => setBusinessItem(e.target.value)}
                placeholder="예: 콜영업 및 마케팅대행"
                className="w-full px-3 py-2 rounded-xl border border-input bg-background text-foreground focus:outline-none focus:ring-1 focus:ring-primary focus:border-primary transition-colors text-xs"
              />
            </div>
          </div>

          {/* Footer Buttons */}
          <div className="pt-4 flex items-center justify-end gap-2 border-t border-border">
            <button
              type="button"
              onClick={onClose}
              disabled={saving}
              className="px-4 py-2.5 rounded-xl border border-border bg-secondary hover:bg-muted text-foreground text-xs font-bold transition-colors cursor-pointer shadow-2xs"
            >
              취소
            </button>
            <button
              type="submit"
              disabled={saving}
              className="px-5 py-2.5 rounded-xl bg-primary hover:bg-primary/90 text-primary-foreground font-bold transition-colors shadow-2xs flex items-center gap-1.5 cursor-pointer disabled:opacity-50 text-xs"
            >
              {saving ? '저장 중...' : '정보 저장하기'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
