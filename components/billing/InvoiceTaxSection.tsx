import React, { useState } from 'react';
import { 
  FileText, Copy, Check, Printer, Edit3, 
  Building2, CreditCard, Mail, MapPin, Hash, User, ShieldCheck
} from 'lucide-react';
import { MonthlyInvoiceRecord, OrgTaxInfo } from '../../services/billingService';

interface InvoiceTaxSectionProps {
  invoices: MonthlyInvoiceRecord[];
  taxInfo: OrgTaxInfo;
  onOpenInvoiceModal: (inv: MonthlyInvoiceRecord) => void;
  onOpenTaxInfoModal: () => void;
  showToast: (msg: string, type?: 'success' | 'error' | 'info') => void;
}

export const InvoiceTaxSection: React.FC<InvoiceTaxSectionProps> = ({
  invoices,
  taxInfo,
  onOpenInvoiceModal,
  onOpenTaxInfoModal,
  showToast,
}) => {
  const [copiedAccount, setCopiedAccount] = useState(false);

  const handleCopyAccount = () => {
    navigator.clipboard.writeText('3333-21-490199').then(() => {
      setCopiedAccount(true);
      showToast('공식 입금 계좌번호(카카오뱅크 3333-21-490199)가 복사되었습니다.', 'success');
      setTimeout(() => setCopiedAccount(false), 2000);
    });
  };

  return (
    <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-sm overflow-hidden transition-colors">
      {/* Header */}
      <div className="p-5 sm:p-6 border-b border-slate-100 dark:border-slate-800/80">
        <div className="flex items-center gap-2">
          <span className="text-xs font-bold px-2 py-0.5 rounded bg-blue-100 text-blue-800 dark:bg-blue-900/60 dark:text-blue-300">
            청구 및 세무 정산
          </span>
          <span className="text-xs text-slate-500 dark:text-slate-400">
            공식 납부 계좌 & 월간 청구서 보관함
          </span>
        </div>
        <h2 className="text-lg sm:text-xl font-bold text-slate-900 dark:text-slate-100 mt-1">
          월간 이용료 청구서 & 전자세금계산서 관리
        </h2>
      </div>

      {/* 2-Column: Official Bank Account + Tax Invoice Info */}
      <div className="p-5 sm:p-6 border-b border-slate-100 dark:border-slate-800/80 grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Left: Official Receiving Account Card */}
        <div className="p-5 rounded-xl bg-gradient-to-br from-amber-500/10 via-amber-500/5 to-transparent border border-amber-200/80 dark:border-amber-800/60 flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold text-amber-800 dark:text-amber-400 flex items-center gap-1.5">
                <CreditCard size={14} /> 리드마스터 CRM 공식 수납 계좌
              </span>
              <span className="text-xs font-semibold px-2 py-0.5 rounded-full bg-amber-100 dark:bg-amber-900/60 text-amber-800 dark:text-amber-300">
                무통장 입금
              </span>
            </div>

            <div className="mt-3">
              <div className="text-xs text-slate-500 dark:text-slate-400">카카오뱅크</div>
              <div className="text-xl sm:text-2xl font-black text-slate-900 dark:text-white font-mono mt-0.5 flex items-center gap-2">
                3333-21-490199
                <button
                  onClick={handleCopyAccount}
                  className="p-1.5 rounded-lg bg-white dark:bg-slate-800 text-slate-600 dark:text-slate-300 hover:text-blue-600 border border-slate-200 dark:border-slate-700 shadow-2xs transition-colors cursor-pointer"
                  title="계좌번호 복사"
                >
                  {copiedAccount ? <Check size={14} className="text-emerald-500" /> : <Copy size={14} />}
                </button>
              </div>
              <div className="text-xs text-slate-600 dark:text-slate-400 mt-1">
                예금주: <span className="font-bold text-slate-900 dark:text-white">진성훈 (리드마스터)</span>
              </div>
            </div>

            <div className="mt-4 p-3 rounded-lg bg-white/80 dark:bg-slate-800/80 border border-amber-200/50 dark:border-amber-900/40 text-xs text-slate-600 dark:text-slate-400 space-y-1">
              <div>• 입금자명 표기: <strong className="text-amber-700 dark:text-amber-400">[{taxInfo.companyName}_{taxInfo.representativeName}]</strong></div>
              <div>• 입금 확인 후 기재하신 세금계산서 수신 메일로 영수증이 24시간 내 자동 발송됩니다.</div>
            </div>
          </div>

          <div className="mt-4 pt-3 border-t border-amber-200/60 dark:border-amber-900/40 text-xs text-slate-500 dark:text-slate-400 flex items-center justify-between">
            <span>정기 결제일: 매월 10일</span>
            <span className="text-amber-700 dark:text-amber-400 font-semibold">100% 세금계산서 발행 보장</span>
          </div>
        </div>

        {/* Right: Electronic Tax Invoice Information Card */}
        <div className="p-5 rounded-xl bg-slate-50 dark:bg-slate-850/70 border border-slate-200/80 dark:border-slate-700/80 flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold text-slate-700 dark:text-slate-300 flex items-center gap-1.5">
                <Building2 size={14} /> 전자세금계산서 발행 정보
              </span>
              <button
                onClick={onOpenTaxInfoModal}
                className="px-2.5 py-1 text-xs font-semibold text-blue-600 dark:text-blue-400 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 hover:bg-blue-50 dark:hover:bg-blue-100/40 dark:bg-blue-950/40 rounded-lg transition-colors flex items-center gap-1 cursor-pointer"
              >
                <Edit3 size={12} /> 정보 수정
              </button>
            </div>

            <div className="mt-3 space-y-2 text-xs">
              <div className="flex items-center gap-2">
                <Hash size={13} className="text-slate-500 dark:text-slate-400 shrink-0" />
                <span className="text-slate-500 dark:text-slate-400 w-20">사업자번호:</span>
                <span className="font-mono font-bold text-slate-900 dark:text-slate-100">
                  {taxInfo.businessNumber || '미등록 (수정 필요)'}
                </span>
              </div>
              <div className="flex items-center gap-2">
                <Building2 size={13} className="text-slate-500 dark:text-slate-400 shrink-0" />
                <span className="text-slate-500 dark:text-slate-400 w-20">상호 (법인명):</span>
                <span className="font-bold text-slate-900 dark:text-slate-100">
                  {taxInfo.companyName}
                </span>
              </div>
              <div className="flex items-center gap-2">
                <User size={13} className="text-slate-500 dark:text-slate-400 shrink-0" />
                <span className="text-slate-500 dark:text-slate-400 w-20">대표자명:</span>
                <span className="text-slate-800 dark:text-slate-200">
                  {taxInfo.representativeName}
                </span>
              </div>
              <div className="flex items-center gap-2">
                <Mail size={13} className="text-slate-500 dark:text-slate-400 shrink-0" />
                <span className="text-slate-500 dark:text-slate-400 w-20">계산서 이메일:</span>
                <span className="font-mono text-blue-600 dark:text-blue-400 font-semibold">
                  {taxInfo.taxInvoiceEmail}
                </span>
              </div>
              <div className="flex items-start gap-2">
                <MapPin size={13} className="text-slate-500 dark:text-slate-400 shrink-0 mt-0.5" />
                <span className="text-slate-500 dark:text-slate-400 w-20">사업장 주소:</span>
                <span className="text-slate-700 dark:text-slate-300 truncate">
                  {taxInfo.businessAddress || '미등록'}
                </span>
              </div>
            </div>
          </div>

          <div className="mt-4 pt-3 border-t border-slate-200 dark:border-slate-700 text-xs text-slate-500 dark:text-slate-400 flex items-center justify-between">
            <span>홈택스 표준 전자세금계산서 연동</span>
            <span className="text-emerald-600 dark:text-emerald-400 font-medium">인증 완료</span>
          </div>
        </div>
      </div>

      {/* Monthly Invoices Archive Table */}
      <div className="p-5 sm:p-6">
        <h3 className="text-sm font-bold text-slate-900 dark:text-slate-100 mb-3 flex items-center gap-2">
          <FileText size={16} className="text-blue-600 dark:text-blue-400" />
          <span>월별 CRM 서비스 청구서 보관함 (최근 6개월)</span>
        </h3>

        <div className="overflow-x-auto border border-slate-200 dark:border-slate-700/80 rounded-xl">
          <table className="w-full text-xs text-left">
            <thead>
              <tr className="bg-slate-100/80 dark:bg-slate-800/80 border-b border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-300 font-semibold">
                <th className="py-2.5 px-3">청구 문서 번호</th>
                <th className="py-2.5 px-3">청구 기간</th>
                <th className="py-2.5 px-3 text-center">활성 좌석</th>
                <th className="py-2.5 px-3 text-right">공급가액</th>
                <th className="py-2.5 px-3 text-right">부가가치세 (10%)</th>
                <th className="py-2.5 px-3 text-right">합계 청구액 (VAT포함)</th>
                <th className="py-2.5 px-3">납부 기한</th>
                <th className="py-2.5 px-3 text-center">상태</th>
                <th className="py-2.5 px-3 text-center">청구서 열람</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 dark:divide-slate-800 font-mono">
              {invoices.map(inv => (
                <tr key={inv.invoiceNumber} className="hover:bg-slate-50 dark:hover:bg-slate-100/50 dark:bg-slate-800/50 transition-colors">
                  <td className="py-2.5 px-3 font-semibold text-slate-800 dark:text-slate-200">
                    {inv.invoiceNumber}
                  </td>
                  <td className="py-2.5 px-3 font-sans font-medium text-slate-900 dark:text-slate-100">
                    {inv.billingMonth}
                  </td>
                  <td className="py-2.5 px-3 text-center font-sans">
                    <span className="px-2 py-0.5 rounded-full bg-slate-100 dark:bg-slate-800 font-bold text-slate-700 dark:text-slate-300">
                      {inv.activeSeats}석
                    </span>
                  </td>
                  <td className="py-2.5 px-3 text-right text-slate-700 dark:text-slate-300">
                    ₩{inv.supplyPrice.toLocaleString()}
                  </td>
                  <td className="py-2.5 px-3 text-right text-slate-500 dark:text-slate-400">
                    ₩{inv.vat.toLocaleString()}
                  </td>
                  <td className="py-2.5 px-3 text-right font-bold text-slate-900 dark:text-white">
                    ₩{inv.totalPrice.toLocaleString()}원
                  </td>
                  <td className="py-2.5 px-3 text-slate-600 dark:text-slate-400">
                    {inv.dueDate}
                  </td>
                  <td className="py-2.5 px-3 text-center font-sans">
                    <span className={`px-2 py-0.5 rounded text-xs font-bold ${
                      inv.status === 'paid'
                        ? 'bg-emerald-100 text-emerald-800 dark:bg-emerald-950/60 dark:text-emerald-300'
                        : 'bg-amber-100 text-amber-800 dark:bg-amber-950/60 dark:text-amber-300'
                    }`}>
                      {inv.status === 'paid' ? '완납' : '납부 대기'}
                    </span>
                  </td>
                  <td className="py-2.5 px-3 text-center font-sans">
                    <button
                      onClick={() => onOpenInvoiceModal(inv)}
                      className="px-2.5 py-1 text-xs font-semibold text-blue-600 dark:text-blue-400 bg-white dark:bg-slate-800 border border-blue-200 dark:border-blue-800 hover:bg-blue-50 dark:hover:bg-blue-100/40 dark:bg-blue-950/40 rounded-lg transition-colors inline-flex items-center gap-1 cursor-pointer"
                    >
                      <FileText size={12} /> 청구서 보기
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};
