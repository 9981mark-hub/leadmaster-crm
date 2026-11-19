import React, { useState } from 'react';
import { X, Building2, Save, Mail, User, MapPin, Hash, Check } from 'lucide-react';
import { OrgTaxInfo } from '../../services/billingService';

interface TaxInfoEditModalProps {
  isOpen: boolean;
  onClose: () => void;
  taxInfo: OrgTaxInfo;
  onSave: (info: OrgTaxInfo) => Promise<void>;
  showToast: (msg: string, type?: 'success' | 'error' | 'info') => void;
}

export const TaxInfoEditModal: React.FC<TaxInfoEditModalProps> = ({
  isOpen,
  onClose,
  taxInfo,
  onSave,
  showToast,
}) => {
  const [businessNumber, setBusinessNumber] = useState(taxInfo.businessNumber || '');
  const [companyName, setCompanyName] = useState(taxInfo.companyName || '');
  const [representativeName, setRepresentativeName] = useState(taxInfo.representativeName || '');
  const [businessAddress, setBusinessAddress] = useState(taxInfo.businessAddress || '');
  const [taxInvoiceEmail, setTaxInvoiceEmail] = useState(taxInfo.taxInvoiceEmail || '');
  const [businessType, setBusinessType] = useState(taxInfo.businessType || '서비스업');
  const [businessItem, setBusinessItem] = useState(taxInfo.businessItem || '콜영업 및 마케팅대행');
  const [saving, setSaving] = useState(false);

  if (!isOpen) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!companyName.trim()) {
      showToast('상호(회사명)를 입력해주세요.', 'error');
      return;
    }
    if (!representativeName.trim()) {
      showToast('대표자 성명을 입력해주세요.', 'error');
      return;
    }
    if (!taxInvoiceEmail.trim()) {
      showToast('세금계산서 수신 이메일을 입력해주세요.', 'error');
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
      showToast('전자세금계산서 발행 정보가 성공적으로 저장되었습니다.', 'success');
      onClose();
    } catch (err: any) {
      showToast('세금계산서 정보 저장 중 오류가 발생했습니다: ' + (err.message || '다시 시도해주세요.'), 'error');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs animate-fadeIn">
      <div className="w-full max-w-lg bg-white dark:bg-slate-900 rounded-2xl shadow-xl border border-slate-200 dark:border-slate-800 overflow-hidden">
        {/* Header */}
        <div className="p-4 sm:p-5 border-b border-slate-100 dark:border-slate-800 flex items-center justify-between bg-slate-50/70 dark:bg-slate-850">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-lg bg-blue-100 dark:bg-blue-950/60 text-blue-600 dark:text-blue-400 flex items-center justify-center">
              <Building2 size={18} />
            </div>
            <div>
              <h3 className="text-base font-bold text-slate-900 dark:text-white">
                전자세금계산서 발행 정보 수정
              </h3>
              <p className="text-xs text-slate-500 dark:text-slate-400">
                국세청 홈택스 정규 세금계산서 발행 시 반영되는 사업자 정보입니다.
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-lg text-slate-500 dark:text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-100 dark:bg-slate-800 transition-colors"
          >
            <X size={18} />
          </button>
        </div>

        {/* Form */}
        <form onSubmit={handleSubmit} className="p-5 space-y-3.5 text-xs">
          {/* 사업자등록번호 */}
          <div>
            <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
              사업자등록번호
            </label>
            <div className="relative">
              <Hash size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-500 dark:text-slate-400" />
              <input
                type="text"
                value={businessNumber}
                onChange={e => setBusinessNumber(e.target.value)}
                placeholder="예: 123-45-67890"
                className="w-full pl-9 pr-3 py-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-white font-mono focus:outline-none focus:border-blue-500"
              />
            </div>
          </div>

          {/* 상호 & 대표자명 (2-Column) */}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                상호 (법인명) *
              </label>
              <input
                type="text"
                value={companyName}
                onChange={e => setCompanyName(e.target.value)}
                required
                placeholder="예: 리드마스터 파트너스"
                className="w-full px-3 py-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-white font-medium focus:outline-none focus:border-blue-500"
              />
            </div>
            <div>
              <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                대표자 성명 *
              </label>
              <input
                type="text"
                value={representativeName}
                onChange={e => setRepresentativeName(e.target.value)}
                required
                placeholder="예: 홍길동"
                className="w-full px-3 py-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-white font-medium focus:outline-none focus:border-blue-500"
              />
            </div>
          </div>

          {/* 세금계산서 수신 이메일 */}
          <div>
            <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
              세금계산서 수신 이메일 *
            </label>
            <div className="relative">
              <Mail size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-500 dark:text-slate-400" />
              <input
                type="email"
                value={taxInvoiceEmail}
                onChange={e => setTaxInvoiceEmail(e.target.value)}
                required
                placeholder="예: accounting@company.com"
                className="w-full pl-9 pr-3 py-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-white font-mono focus:outline-none focus:border-blue-500"
              />
            </div>
            <p className="text-xs text-slate-500 mt-1">입금 완료 시 해당 메일로 국세청 전자세금계산서가 자동 발송됩니다.</p>
          </div>

          {/* 사업장 소재지 */}
          <div>
            <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
              사업장 주소
            </label>
            <div className="relative">
              <MapPin size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-500 dark:text-slate-400" />
              <input
                type="text"
                value={businessAddress}
                onChange={e => setBusinessAddress(e.target.value)}
                placeholder="예: 서울특별시 강남구 테헤란로 152, 10층"
                className="w-full pl-9 pr-3 py-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-white focus:outline-none focus:border-blue-500"
              />
            </div>
          </div>

          {/* 업태 & 종목 (2-Column) */}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                업태
              </label>
              <input
                type="text"
                value={businessType}
                onChange={e => setBusinessType(e.target.value)}
                placeholder="예: 서비스업"
                className="w-full px-3 py-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-white focus:outline-none focus:border-blue-500"
              />
            </div>
            <div>
              <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                종목
              </label>
              <input
                type="text"
                value={businessItem}
                onChange={e => setBusinessItem(e.target.value)}
                placeholder="예: 법률자문 보조, 마케팅"
                className="w-full px-3 py-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-white focus:outline-none focus:border-blue-500"
              />
            </div>
          </div>

          {/* Footer Buttons */}
          <div className="pt-3 flex items-center justify-end gap-2 border-t border-slate-100 dark:border-slate-800">
            <button
              type="button"
              onClick={onClose}
              disabled={saving}
              className="px-4 py-2 rounded-xl text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-100 dark:bg-slate-800 font-medium transition-colors cursor-pointer"
            >
              취소
            </button>
            <button
              type="submit"
              disabled={saving}
              className="px-5 py-2 rounded-xl bg-blue-600 hover:bg-blue-700 text-white font-bold transition-colors shadow-xs flex items-center gap-1.5 cursor-pointer disabled:opacity-50"
            >
              {saving ? '저장 중...' : '정보 저장하기'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
