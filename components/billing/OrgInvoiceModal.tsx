import React, { useState } from 'react';
import { 
  X, Printer, Copy, Check, Download, 
  FileText, ShieldCheck, Building2, CheckCircle2 
} from 'lucide-react';
import { MonthlyInvoiceRecord, OrgTaxInfo, generateOfficialInvoiceMarkdown } from '../../services/billingService';

interface OrgInvoiceModalProps {
  invoice: MonthlyInvoiceRecord | null;
  taxInfo: OrgTaxInfo;
  ownerEmail?: string;
  onClose: () => void;
  showToast: (msg: string, type?: 'success' | 'error' | 'info') => void;
}

export const OrgInvoiceModal: React.FC<OrgInvoiceModalProps> = ({
  invoice,
  taxInfo,
  ownerEmail,
  onClose,
  showToast,
}) => {
  const [copied, setCopied] = useState(false);

  if (!invoice) return null;

  const handlePrint = () => {
    window.print();
  };

  const handleCopyMarkdown = () => {
    const md = generateOfficialInvoiceMarkdown(invoice, taxInfo, ownerEmail);
    navigator.clipboard.writeText(md).then(() => {
      setCopied(true);
      showToast('청구서 마크다운이 클립보드에 복사되었습니다.', 'success');
      setTimeout(() => setCopied(false), 2000);
    });
  };

  const handleDownloadTxt = () => {
    const md = generateOfficialInvoiceMarkdown(invoice, taxInfo, ownerEmail);
    const blob = new Blob([md], { type: 'text/plain;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `청구서_${invoice.invoiceNumber}.txt`;
    a.click();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-xs animate-fadeIn overflow-y-auto">
      <div className="w-full max-w-3xl my-8 bg-white dark:bg-slate-900 rounded-2xl shadow-2xl border border-slate-200 dark:border-slate-800 overflow-hidden flex flex-col">
        {/* Top Action Bar (Don't Print) */}
        <div className="p-4 sm:p-5 border-b border-slate-100 dark:border-slate-800 flex items-center justify-between bg-slate-50 dark:bg-slate-850 print:hidden">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-lg bg-blue-100 dark:bg-blue-950/60 text-blue-600 dark:text-blue-400 flex items-center justify-center">
              <FileText size={18} />
            </div>
            <div>
              <h3 className="text-base font-bold text-slate-900 dark:text-white">
                공식 서비스 이용료 청구서 (LM-BILL)
              </h3>
              <p className="text-xs text-slate-500 dark:text-slate-400">
                문서번호: {invoice.invoiceNumber}
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={handlePrint}
              className="px-3 py-1.5 text-xs font-semibold text-slate-700 dark:text-slate-200 bg-white dark:bg-slate-800 border border-slate-300 dark:border-slate-700 hover:bg-slate-100 dark:hover:bg-slate-700 rounded-lg transition-colors flex items-center gap-1.5 cursor-pointer shadow-2xs"
            >
              <Printer size={13} /> 인쇄하기
            </button>
            <button
              onClick={handleCopyMarkdown}
              className="px-3 py-1.5 text-xs font-semibold text-slate-700 dark:text-slate-200 bg-white dark:bg-slate-800 border border-slate-300 dark:border-slate-700 hover:bg-slate-100 dark:hover:bg-slate-700 rounded-lg transition-colors flex items-center gap-1.5 cursor-pointer shadow-2xs"
            >
              {copied ? <Check size={13} className="text-emerald-500" /> : <Copy size={13} />}
              {copied ? '복사됨' : '마크다운 복사'}
            </button>
            <button
              onClick={handleDownloadTxt}
              className="px-3 py-1.5 text-xs font-semibold text-slate-700 dark:text-slate-200 bg-white dark:bg-slate-800 border border-slate-300 dark:border-slate-700 hover:bg-slate-100 dark:hover:bg-slate-700 rounded-lg transition-colors flex items-center gap-1.5 cursor-pointer shadow-2xs"
            >
              <Download size={13} /> 파일 저장
            </button>
            <button
              onClick={onClose}
              className="p-1.5 rounded-lg text-slate-500 dark:text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-100 dark:bg-slate-800 transition-colors ml-2"
            >
              <X size={18} />
            </button>
          </div>
        </div>

        {/* Printable Document Body */}
        <div id="printable-invoice" className="p-6 sm:p-10 space-y-8 bg-white dark:bg-slate-900 text-slate-900 dark:text-slate-100">
          {/* Document Header */}
          <div className="border-b-2 border-slate-200 dark:border-slate-900 dark:border-slate-100 pb-6 flex flex-col sm:flex-row sm:items-end justify-between gap-4">
            <div>
              <div className="flex items-center gap-2 text-blue-600 dark:text-blue-400 font-extrabold text-sm tracking-wider uppercase">
                <ShieldCheck size={18} /> LeadMaster Enterprise Cloud CRM
              </div>
              <h1 className="text-2xl sm:text-3xl font-black text-slate-900 dark:text-white mt-1">
                서비스 이용료 청구서 (INVOICE)
              </h1>
            </div>

            <div className="text-xs font-mono text-slate-600 dark:text-slate-400 space-y-1 sm:text-right">
              <div><strong>문서번호:</strong> {invoice.invoiceNumber}</div>
              <div><strong>발행일자:</strong> {invoice.issueDate}</div>
              <div><strong>청구기간:</strong> {invoice.billingMonth} (1개월)</div>
              <div><strong>납부기한:</strong> <span className="text-rose-600 dark:text-rose-400 font-bold">{invoice.dueDate} 까지</span></div>
            </div>
          </div>

          {/* 1. 공급자 vs 공급받는 자 (2-Column Grid) */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6 text-xs">
            {/* 공급자 */}
            <div className="p-4 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50/60 dark:bg-slate-850/60 space-y-2">
              <div className="font-bold text-slate-900 dark:text-white pb-2 border-b border-slate-200 dark:border-slate-700 flex items-center justify-between">
                <span>[공급자] 서비스 제공사</span>
                <span className="text-xs text-blue-600 font-normal">정식 사업자</span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-500">상호 / 회사명</span>
                <span className="font-bold">리드마스터 (LeadMaster CRM)</span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-500">대표자</span>
                <span>진성호</span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-500">사업자등록번호</span>
                <span className="font-mono">214-12-89201</span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-500">담당 이메일</span>
                <span className="font-mono">support@lmaster.xyz</span>
              </div>
            </div>

            {/* 공급받는 자 */}
            <div className="p-4 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50/60 dark:bg-slate-850/60 space-y-2">
              <div className="font-bold text-slate-900 dark:text-white pb-2 border-b border-slate-200 dark:border-slate-700 flex items-center justify-between">
                <span>[공급받는 자] 고객사</span>
                <span className="text-xs text-emerald-600 font-semibold">엔터프라이즈 테넌트</span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-500">상호 / 회사명</span>
                <span className="font-bold">{taxInfo.companyName}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-500">대표자명</span>
                <span>{taxInfo.representativeName}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-500">사업자등록번호</span>
                <span className="font-mono">{taxInfo.businessNumber || '미등록'}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-500">계산서 수신처</span>
                <span className="font-mono text-blue-600 dark:text-blue-400">{taxInfo.taxInvoiceEmail || ownerEmail || '등록 계정'}</span>
              </div>
            </div>
          </div>

          {/* 2. 산출 내역 상세 테이블 */}
          <div className="space-y-3">
            <h4 className="text-xs font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400">
              2. 당월 이용 내역 및 청구 금액 산출
            </h4>

            <div className="border border-slate-200 dark:border-slate-700 rounded-xl overflow-hidden text-xs">
              <table className="w-full text-left">
                <thead className="bg-slate-100 dark:bg-slate-800 border-b border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-300 font-semibold">
                  <tr>
                    <th className="py-2.5 px-3">서비스 항목</th>
                    <th className="py-2.5 px-3">과금 기준</th>
                    <th className="py-2.5 px-3 text-center">수량 (좌석)</th>
                    <th className="py-2.5 px-3 text-right">적용 단가</th>
                    <th className="py-2.5 px-3 text-right">공급가액</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 dark:divide-slate-800 font-mono">
                  <tr>
                    <td className="py-3 px-3 font-sans font-medium text-slate-900 dark:text-white">
                      LeadMaster CRM 라이선스 ({invoice.tierName})
                    </td>
                    <td className="py-3 px-3 font-sans text-slate-500">
                      활성 상담원 계정 수
                    </td>
                    <td className="py-3 px-3 text-center font-bold font-sans">
                      {invoice.activeSeats} 석
                    </td>
                    <td className="py-3 px-3 text-right text-slate-700 dark:text-slate-300">
                      ₩{invoice.unitPrice.toLocaleString()}원
                    </td>
                    <td className="py-3 px-3 text-right font-bold text-slate-900 dark:text-white">
                      ₩{invoice.supplyPrice.toLocaleString()}원
                    </td>
                  </tr>
                  <tr className="text-slate-500 bg-slate-50/40 dark:bg-slate-850/40 font-sans">
                    <td className="py-2.5 px-3">안드로이드 스마트 자동콜 무제한 연동</td>
                    <td className="py-2.5 px-3">기본 인프라</td>
                    <td className="py-2.5 px-3 text-center">무제한</td>
                    <td className="py-2.5 px-3 text-right font-mono">₩0</td>
                    <td className="py-2.5 px-3 text-right font-mono font-semibold text-emerald-600">포함 (무료)</td>
                  </tr>
                  <tr className="text-slate-500 bg-slate-50/40 dark:bg-slate-850/40 font-sans">
                    <td className="py-2.5 px-3">m4a 통화녹음 1년 무제한 보관 & AI 트레이닝</td>
                    <td className="py-2.5 px-3">기본 인프라</td>
                    <td className="py-2.5 px-3 text-center">표준 제공</td>
                    <td className="py-2.5 px-3 text-right font-mono">₩0</td>
                    <td className="py-2.5 px-3 text-right font-mono font-semibold text-emerald-600">포함 (무료)</td>
                  </tr>
                </tbody>
              </table>

              {/* Total Summary Footer */}
              <div className="p-4 bg-slate-50 dark:bg-slate-800/80 border-t border-slate-200 dark:border-slate-700 space-y-1.5 text-xs">
                <div className="flex justify-between font-mono">
                  <span className="font-sans text-slate-600 dark:text-slate-400">공급가액</span>
                  <span className="font-semibold text-slate-900 dark:text-white">₩{invoice.supplyPrice.toLocaleString()} 원</span>
                </div>
                <div className="flex justify-between font-mono">
                  <span className="font-sans text-slate-600 dark:text-slate-400">부가가치세 (VAT 10%)</span>
                  <span className="text-slate-700 dark:text-slate-300">₩{invoice.vat.toLocaleString()} 원</span>
                </div>
                <div className="flex justify-between items-baseline pt-2 border-t border-slate-200 dark:border-slate-700">
                  <span className="font-bold text-slate-900 dark:text-white text-sm">최종 청구 합계 금액</span>
                  <span className="text-xl sm:text-2xl font-black text-blue-600 dark:text-blue-400 font-mono">
                    ₩{invoice.totalPrice.toLocaleString()} 원
                  </span>
                </div>
              </div>
            </div>
          </div>

          {/* 3. 결제 계좌 안내 */}
          <div className="p-5 rounded-xl border border-amber-200 dark:border-amber-900/60 bg-amber-50/50 dark:bg-amber-950/20 text-xs space-y-2">
            <div className="font-bold text-amber-900 dark:text-amber-300">
              3. 입금 계좌 및 세금계산서 발행 안내
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-slate-700 dark:text-slate-300">
              <div>• <strong>입금 은행:</strong> 카카오뱅크</div>
              <div>• <strong>계좌 번호:</strong> <span className="font-mono font-bold text-slate-900 dark:text-white">3333-21-490199</span></div>
              <div>• <strong>예금주:</strong> 진성훈 (리드마스터)</div>
              <div>• <strong>입금자명 표기:</strong> [{taxInfo.companyName}_{taxInfo.representativeName}]</div>
            </div>
            <p className="text-xs text-slate-500 dark:text-slate-400 pt-1">
              입금 확인 후 24시간 이내에 홈택스를 통해 전자세금계산서(영수)가 자동 발행됩니다.
            </p>
          </div>

          {/* Seal / Footer */}
          <div className="pt-4 flex items-center justify-between text-xs text-slate-500 dark:text-slate-400">
            <span>LeadMaster Cloud CRM Platform Operation Team</span>
            <span>공식 전자 청구서 인증 완료</span>
          </div>
        </div>
      </div>
    </div>
  );
};
