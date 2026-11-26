import React, { useState } from 'react';
import { 
  X, Printer, Copy, Check, Download, 
  FileText, ShieldCheck, Building2, CheckCircle2 
} from 'lucide-react';
import { MonthlyInvoiceRecord, OrgTaxInfo, generateOfficialInvoiceMarkdown } from '../../services/billingService';
import { useToast } from '../../contexts/ToastContext';

interface OrgInvoiceModalProps {
  invoice: MonthlyInvoiceRecord | null;
  taxInfo: OrgTaxInfo;
  ownerEmail?: string;
  isOpen?: boolean;
  onClose: () => void;
  showToast?: (msg: string, type?: 'success' | 'error' | 'info') => void;
}

export const OrgInvoiceModal: React.FC<OrgInvoiceModalProps> = ({
  invoice,
  taxInfo,
  ownerEmail,
  onClose,
  showToast: propShowToast,
}) => {
  const { showToast: ctxShowToast } = useToast();
  const triggerToast = propShowToast || ctxShowToast;
  const [copied, setCopied] = useState(false);

  const safeTaxInfo = taxInfo || {
    businessNumber: '',
    companyName: '리드마스터 파트너스',
    representativeName: '대표자',
    businessAddress: '',
    taxInvoiceEmail: ownerEmail || '',
  };

  if (!invoice) return null;

  const handlePrint = () => {
    window.print();
  };

  const handleCopyMarkdown = () => {
    const md = generateOfficialInvoiceMarkdown(invoice, safeTaxInfo, ownerEmail);
    navigator.clipboard.writeText(md).then(() => {
      setCopied(true);
      triggerToast('청구서 마크다운이 클립보드에 복사되었습니다.', 'success');
      setTimeout(() => setCopied(false), 2000);
    });
  };

  const handleDownloadTxt = () => {
    const md = generateOfficialInvoiceMarkdown(invoice, safeTaxInfo, ownerEmail);
    const blob = new Blob([md], { type: 'text/plain;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `청구서_${invoice.invoiceNumber}.txt`;
    a.click();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-5 bg-background/80 backdrop-blur-xs animate-in fade-in duration-200 overflow-y-auto">
      <div className="relative w-full max-w-3xl max-h-[88vh] my-auto flex flex-col rounded-2xl bg-card border border-border shadow-2xl overflow-hidden text-card-foreground">
        {/* Top Action Bar (Don't Print) - Fixed Header */}
        <div className="p-4 sm:p-5 border-b border-border flex items-center justify-between bg-card shrink-0 print:hidden">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-lg bg-primary/10 border border-primary/20 text-primary flex items-center justify-center shrink-0">
              <FileText size={18} strokeWidth={1.75} />
            </div>
            <div>
              <h3 className="text-base font-bold text-foreground">
                공식 서비스 이용료 청구서 (LM-BILL)
              </h3>
              <p className="text-xs text-muted-foreground font-mono">
                문서번호: {invoice.invoiceNumber}
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={handlePrint}
              className="px-3 py-1.5 text-xs font-semibold text-foreground bg-secondary border border-border hover:bg-muted rounded-xl transition-colors flex items-center gap-1.5 cursor-pointer shadow-2xs"
            >
              <Printer size={13} strokeWidth={1.75} /> 인쇄하기
            </button>
            <button
              onClick={handleCopyMarkdown}
              className="px-3 py-1.5 text-xs font-semibold text-foreground bg-secondary border border-border hover:bg-muted rounded-xl transition-colors flex items-center gap-1.5 cursor-pointer shadow-2xs"
            >
              {copied ? <Check size={13} className="text-primary" strokeWidth={2} /> : <Copy size={13} strokeWidth={1.75} />}
              {copied ? '복사됨' : '마크다운 복사'}
            </button>
            <button
              onClick={handleDownloadTxt}
              className="hidden sm:flex px-3 py-1.5 text-xs font-semibold text-foreground bg-secondary border border-border hover:bg-muted rounded-xl transition-colors items-center gap-1.5 cursor-pointer shadow-2xs"
            >
              <Download size={13} strokeWidth={1.75} /> 파일 저장
            </button>
            <button
              onClick={onClose}
              className="p-1.5 rounded-xl text-muted-foreground hover:text-foreground hover:bg-muted transition-colors ml-1 cursor-pointer"
              title="청구서 닫기 (Esc)"
            >
              <X size={18} />
            </button>
          </div>
        </div>

        {/* Printable Document Body - Scrollable Body */}
        <div id="printable-invoice" className="flex-1 overflow-y-auto p-6 sm:p-10 space-y-8 bg-card text-card-foreground custom-scrollbar">
          {/* Document Header */}
          <div className="border-b border-border pb-6 flex flex-col sm:flex-row sm:items-end justify-between gap-4">
            <div>
              <div className="flex items-center gap-2 text-primary font-bold text-xs tracking-wider uppercase">
                <ShieldCheck size={16} strokeWidth={1.75} /> LeadMaster Enterprise Cloud CRM
              </div>
              <h1 className="text-2xl sm:text-3xl font-black text-foreground mt-1">
                서비스 이용료 청구서 (INVOICE)
              </h1>
            </div>

            <div className="text-xs font-mono text-muted-foreground space-y-1 sm:text-right">
              <div><strong>문서번호:</strong> {invoice.invoiceNumber}</div>
              <div><strong>발행일자:</strong> {invoice.issueDate}</div>
              <div><strong>청구기간:</strong> {invoice.billingMonth} (1개월)</div>
              <div><strong>납부기한:</strong> <span className="text-destructive font-bold">{invoice.dueDate} 까지</span></div>
            </div>
          </div>

          {/* 1. 공급자 vs 공급받는 자 (2-Column Grid) */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6 text-xs">
            {/* 공급자 */}
            <div className="p-4 rounded-xl border border-border bg-muted/30 space-y-2">
              <div className="font-bold text-foreground pb-2 border-b border-border flex items-center justify-between">
                <span>[공급자] 서비스 제공사</span>
                <span className="text-xs text-primary font-medium">정식 사업자</span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">상호 / 회사명</span>
                <span className="font-bold text-foreground">몬스터랩 (리드마스터 CRM)</span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">대표자</span>
                <span className="text-foreground">진성호</span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">사업자등록번호</span>
                <span className="font-mono text-foreground">521-39-01355</span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">담당 이메일</span>
                <span className="font-mono text-foreground">support@lmaster.xyz</span>
              </div>
            </div>

            {/* 공급받는 자 */}
            <div className="p-4 rounded-xl border border-border bg-muted/30 space-y-2">
              <div className="font-bold text-foreground pb-2 border-b border-border flex items-center justify-between">
                <span>[공급받는 자] 고객사</span>
                <span className="text-xs text-primary font-semibold">엔터프라이즈 테넌트</span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">상호 / 회사명</span>
                <span className="font-bold text-foreground">{safeTaxInfo.companyName || '미등록'}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">대표자명</span>
                <span className="text-foreground">{safeTaxInfo.representativeName || '대표자'}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">사업자등록번호</span>
                <span className="font-mono text-foreground">{safeTaxInfo.businessNumber || '미등록'}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">계산서 수신처</span>
                <span className="font-mono text-primary">{safeTaxInfo.taxInvoiceEmail || ownerEmail || '등록 계정'}</span>
              </div>
            </div>
          </div>

          {/* 2. 산출 내역 상세 테이블 */}
          <div className="space-y-3">
            <h4 className="text-xs font-bold uppercase tracking-wider text-muted-foreground">
              2. 당월 이용 내역 및 청구 금액 산출
            </h4>

            <div className="border border-border rounded-xl overflow-hidden text-xs">
              <table className="w-full text-left">
                <thead className="bg-muted/50 border-b border-border text-muted-foreground font-semibold">
                  <tr>
                    <th className="py-2.5 px-3">서비스 항목</th>
                    <th className="py-2.5 px-3">과금 기준</th>
                    <th className="py-2.5 px-3 text-center">수량 (좌석)</th>
                    <th className="py-2.5 px-3 text-right">적용 단가</th>
                    <th className="py-2.5 px-3 text-right">공급가액</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border/60 font-mono">
                  <tr>
                    <td className="py-3 px-3 font-sans font-medium text-foreground">
                      LeadMaster CRM 라이선스 ({invoice.tierName})
                    </td>
                    <td className="py-3 px-3 font-sans text-muted-foreground">
                      활성 상담원 계정 수
                    </td>
                    <td className="py-3 px-3 text-center font-bold font-sans text-foreground">
                      {invoice.activeSeats} 석
                    </td>
                    <td className="py-3 px-3 text-right text-muted-foreground font-mono">
                      ₩ {invoice.unitPrice.toLocaleString()}원
                    </td>
                    <td className="py-3 px-3 text-right font-bold text-foreground font-mono">
                      ₩ {invoice.supplyPrice.toLocaleString()}원
                    </td>
                  </tr>
                  <tr className="text-muted-foreground bg-muted/20 font-sans">
                    <td className="py-2.5 px-3">안드로이드 스마트 자동콜 무제한 연동</td>
                    <td className="py-2.5 px-3">기본 인프라</td>
                    <td className="py-2.5 px-3 text-center">무제한</td>
                    <td className="py-2.5 px-3 text-right font-mono">₩ 0</td>
                    <td className="py-2.5 px-3 text-right font-mono font-semibold text-primary">포함 (무료)</td>
                  </tr>
                  <tr className="text-muted-foreground bg-muted/20 font-sans">
                    <td className="py-2.5 px-3">m4a 통화녹음 1년 무제한 보관 & AI 트레이닝</td>
                    <td className="py-2.5 px-3">기본 인프라</td>
                    <td className="py-2.5 px-3 text-center">표준 제공</td>
                    <td className="py-2.5 px-3 text-right font-mono">₩ 0</td>
                    <td className="py-2.5 px-3 text-right font-mono font-semibold text-primary">포함 (무료)</td>
                  </tr>
                </tbody>
              </table>

              {/* Total Summary Footer */}
              <div className="p-4 bg-muted/40 border-t border-border space-y-1.5 text-xs">
                <div className="flex justify-between font-mono">
                  <span className="font-sans text-muted-foreground">공급가액</span>
                  <span className="font-semibold text-foreground">₩ {invoice.supplyPrice.toLocaleString()} 원</span>
                </div>
                <div className="flex justify-between font-mono">
                  <span className="font-sans text-muted-foreground">부가가치세 (VAT 10%)</span>
                  <span className="text-muted-foreground">₩ {invoice.vat.toLocaleString()} 원</span>
                </div>
                <div className="flex justify-between items-baseline pt-2 border-t border-border">
                  <span className="font-bold text-foreground text-sm">최종 청구 합계 금액</span>
                  <span className="text-xl sm:text-2xl font-black text-primary font-mono">
                    ₩ {invoice.totalPrice.toLocaleString()} 원
                  </span>
                </div>
              </div>
            </div>
          </div>

          {/* 3. 결제 계좌 안내 */}
          <div className="p-5 rounded-xl border border-border bg-muted/30 text-xs space-y-2">
            <div className="font-bold text-foreground">
              3. 입금 계좌 및 세금계산서 발행 안내
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-muted-foreground">
              <div>• <strong className="text-foreground">입금 은행:</strong> 카카오뱅크</div>
              <div>• <strong className="text-foreground">계좌 번호:</strong> <span className="font-mono font-bold text-foreground">3333-35-6862273</span></div>
              <div>• <strong className="text-foreground">예금주:</strong> 진성호(몬스터랩)</div>
              <div>• <strong className="text-foreground">입금자명 표기:</strong> [{taxInfo.companyName}_{taxInfo.representativeName}]</div>
            </div>
            <p className="text-xs text-muted-foreground pt-1">
              입금 확인 후 24시간 이내에 홈택스를 통해 전자세금계산서(영수)가 자동 발행됩니다.
            </p>
          </div>

          {/* Seal / Footer */}
          <div className="pt-4 flex items-center justify-between text-xs text-muted-foreground border-t border-border/40">
            <span>LeadMaster Cloud CRM Platform Operation Team</span>
            <span className="text-primary font-medium">공식 전자 청구서 인증 완료</span>
          </div>
        </div>

        {/* Bottom Fixed Action Footer (Don't Print) */}
        <div className="p-4 border-t border-border bg-card flex items-center justify-between gap-3 shrink-0 print:hidden">
          <span className="text-xs text-muted-foreground hidden sm:flex items-center gap-1.5">
            <ShieldCheck size={14} className="text-primary" />
            계좌 입금 확인 시 전자세금계산서(영수)가 국세청 홈택스에 자동 전송됩니다.
          </span>
          <div className="flex items-center gap-2 ml-auto w-full sm:w-auto justify-end">
            <button
              onClick={handlePrint}
              className="px-4 py-2.5 rounded-xl border border-border bg-secondary hover:bg-muted text-foreground text-xs font-bold flex items-center gap-1.5 transition-colors cursor-pointer"
            >
              <Printer size={14} /> 인쇄
            </button>
            <button
              onClick={onClose}
              className="px-5 py-2.5 rounded-xl bg-secondary hover:bg-muted text-foreground border border-border text-xs font-bold transition-colors cursor-pointer shadow-2xs"
            >
              청구서 닫기
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
