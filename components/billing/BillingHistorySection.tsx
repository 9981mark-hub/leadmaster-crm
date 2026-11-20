import React, { useState, useMemo } from 'react';
import { 
  CreditCard, FileText, Download, CheckCircle2, Clock, 
  AlertCircle, Building2, Copy, Check, ExternalLink, Calendar,
  ShieldCheck, History, ArrowUpRight, Receipt, RefreshCw, X
} from 'lucide-react';
import { 
  MonthlyInvoiceRecord, OrgTaxInfo, PaymentTransactionRecord, 
  SubscriptionAuditLogItem 
} from '../../services/billingService';
import { exportToExcel } from '../../utils/xlsxExport';

interface BillingHistorySectionProps {
  invoices: MonthlyInvoiceRecord[];
  transactions: PaymentTransactionRecord[];
  auditLogs: SubscriptionAuditLogItem[];
  taxInfo: OrgTaxInfo;
  onOpenInvoiceModal: (inv: MonthlyInvoiceRecord) => void;
  onOpenTaxInfoModal: () => void;
  showToast: (msg: string, type?: 'success' | 'error' | 'info') => void;
}

export const BillingHistorySection: React.FC<BillingHistorySectionProps> = ({
  invoices,
  transactions,
  auditLogs,
  taxInfo,
  onOpenInvoiceModal,
  onOpenTaxInfoModal,
  showToast,
}) => {
  const [activeTab, setActiveTab] = useState<'transactions' | 'audit_log'>('transactions');
  const [selectedPeriod, setSelectedPeriod] = useState<'all' | '3m' | '6m'>('all');
  const [copiedAccount, setCopiedAccount] = useState(false);
  const [selectedReceipt, setSelectedReceipt] = useState<PaymentTransactionRecord | null>(null);

  // 계좌번호 복사 핸들러
  const handleCopyAccount = () => {
    navigator.clipboard.writeText('3333-21-490199').then(() => {
      setCopiedAccount(true);
      showToast('공식 입금 계좌번호(카카오뱅크 3333-21-490199)가 복사되었습니다.', 'success');
      setTimeout(() => setCopiedAccount(false), 2000);
    });
  };

  // 기간별 트랜잭션 필터
  const filteredTransactions = useMemo(() => {
    if (selectedPeriod === 'all') return transactions;
    const limit = selectedPeriod === '3m' ? 3 : 6;
    return transactions.slice(0, limit);
  }, [transactions, selectedPeriod]);

  // 엑셀 다운로드
  const handleExportExcel = () => {
    try {
      const dataToExport = filteredTransactions.map((tx) => ({
        '거래번호': tx.id,
        '결제일시': tx.transactionDate,
        '청구 항목': tx.description,
        '결제 수단': tx.paymentMethod,
        '공급가액(원)': tx.supplyPrice,
        '부가가치세(원)': tx.vat,
        '합계 결제금액(원)': tx.totalPrice,
        '결제상태': tx.status === 'paid' ? '완납' : '미납/대기',
        '승인번호': tx.approvalNumber,
        '세금계산서 승인번호': tx.taxInvoiceApproveNo || '발행 대기',
      }));

      exportToExcel(`리드마스터_구독료_결제내역_${new Date().toISOString().slice(0, 10)}`, dataToExport);
      showToast('구독료 결제 내역 엑셀 파일이 다운로드되었습니다.', 'success');
    } catch (e: any) {
      showToast('엑셀 다운로드 중 오류가 발생했습니다: ' + e.message, 'error');
    }
  };

  return (
    <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-sm overflow-hidden transition-colors space-y-0">
      {/* 1. Header */}
      <div className="p-5 sm:p-6 border-b border-slate-100 dark:border-slate-800/80 bg-gradient-to-r from-slate-50 via-blue-50/20 to-white dark:from-slate-800/50 dark:via-slate-850 dark:to-slate-900 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <span className="text-xs font-bold px-2 py-0.5 rounded bg-blue-100 text-blue-800 dark:bg-blue-900/60 dark:text-blue-300 flex items-center gap-1">
              <History size={12} /> 결제 관리 & 히스토리
            </span>
            <span className="text-xs text-slate-500 dark:text-slate-400">
              구독료 납부 내역과 플랜 라이프사이클 변동 기록을 통합 관제합니다.
            </span>
          </div>
          <h3 className="text-lg sm:text-xl font-bold text-slate-900 dark:text-slate-100 mt-1">
            결제 수단, 청구 영수증 및 구독 히스토리
          </h3>
        </div>

        {/* Sub-tab Switcher Buttons */}
        <div className="flex items-center self-start sm:self-auto bg-slate-100 dark:bg-slate-800 p-1 rounded-xl border border-slate-200 dark:border-slate-700">
          <button
            type="button"
            onClick={() => setActiveTab('transactions')}
            className={`px-3.5 py-1.5 text-xs font-semibold rounded-lg transition-all flex items-center gap-1.5 cursor-pointer ${
              activeTab === 'transactions'
                ? 'bg-white dark:bg-slate-700 text-blue-600 dark:text-blue-400 shadow-2xs font-bold'
                : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
            }`}
          >
            <Receipt size={14} />
            <span>결제 승인 내역 & 영수증</span>
          </button>
          <button
            type="button"
            onClick={() => setActiveTab('audit_log')}
            className={`px-3.5 py-1.5 text-xs font-semibold rounded-lg transition-all flex items-center gap-1.5 cursor-pointer ${
              activeTab === 'audit_log'
                ? 'bg-white dark:bg-slate-700 text-blue-600 dark:text-blue-400 shadow-2xs font-bold'
                : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
            }`}
          >
            <History size={14} />
            <span>구독 & 좌석 변동 감사 로그</span>
          </button>
        </div>
      </div>

      {/* 2. Top Summary Cards: Registered Payment Card & Tax Invoice Info */}
      <div className="p-5 sm:p-6 border-b border-slate-100 dark:border-slate-800/80 grid grid-cols-1 lg:grid-cols-2 gap-6 bg-slate-50/50 dark:bg-slate-850/30">
        {/* Left: Registered Card & Bank Account */}
        <div className="p-5 rounded-xl bg-white dark:bg-slate-800/80 border border-slate-200/80 dark:border-slate-700/80 flex flex-col justify-between shadow-2xs">
          <div>
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold text-slate-700 dark:text-slate-300 flex items-center gap-1.5">
                <CreditCard size={15} className="text-blue-600 dark:text-blue-400" />
                기본 정기 결제 수단
              </span>
              <span className="text-[11px] font-bold px-2 py-0.5 rounded-full bg-emerald-100 dark:bg-emerald-950 text-emerald-700 dark:text-emerald-300">
                자동 승인 활성
              </span>
            </div>

            <div className="mt-3 flex items-center gap-3">
              <div className="w-12 h-8 rounded-md bg-gradient-to-r from-blue-600 to-indigo-700 text-white flex items-center justify-center font-bold text-xs tracking-wider shadow-2xs">
                CARD
              </div>
              <div>
                <div className="text-sm font-bold text-slate-900 dark:text-white">
                  신한 법인카드 (끝자리 4242)
                </div>
                <div className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                  다음 정기 결제 예정일: <strong className="text-slate-800 dark:text-slate-200">2026년 12월 1일</strong>
                </div>
              </div>
            </div>

            <div className="mt-4 pt-3 border-t border-slate-100 dark:border-slate-700/60 text-xs text-slate-500 dark:text-slate-400 flex items-center justify-between">
              <span>무통장 납부용 공식 계좌:</span>
              <div className="flex items-center gap-1.5 font-mono font-semibold text-slate-700 dark:text-slate-300">
                <span>카카오뱅크 3333-21-490199</span>
                <button
                  onClick={handleCopyAccount}
                  className="p-1 rounded hover:bg-slate-100 dark:hover:bg-slate-700 text-slate-500 cursor-pointer"
                  title="계좌 복사"
                >
                  {copiedAccount ? <Check size={12} className="text-emerald-500" /> : <Copy size={12} />}
                </button>
              </div>
            </div>
          </div>
        </div>

        {/* Right: Electronic Tax Invoice Information */}
        <div className="p-5 rounded-xl bg-white dark:bg-slate-800/80 border border-slate-200/80 dark:border-slate-700/80 flex flex-col justify-between shadow-2xs">
          <div>
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold text-slate-700 dark:text-slate-300 flex items-center gap-1.5">
                <Building2 size={15} className="text-blue-600 dark:text-blue-400" />
                전자세금계산서 발행 정보
              </span>
              <button
                type="button"
                onClick={onOpenTaxInfoModal}
                className="text-xs font-semibold text-blue-600 dark:text-blue-400 hover:underline cursor-pointer"
              >
                정보 수정
              </button>
            </div>

            <div className="mt-3 grid grid-cols-2 gap-3 text-xs">
              <div>
                <span className="text-slate-400 dark:text-slate-500">상호(법인명):</span>
                <div className="font-semibold text-slate-800 dark:text-slate-200 mt-0.5">{taxInfo.companyName}</div>
              </div>
              <div>
                <span className="text-slate-400 dark:text-slate-500">사업자등록번호:</span>
                <div className="font-semibold font-mono text-slate-800 dark:text-slate-200 mt-0.5">{taxInfo.businessNumber || '123-45-67890'}</div>
              </div>
              <div>
                <span className="text-slate-400 dark:text-slate-500">대표자명:</span>
                <div className="font-semibold text-slate-800 dark:text-slate-200 mt-0.5">{taxInfo.representativeName}</div>
              </div>
              <div>
                <span className="text-slate-400 dark:text-slate-500">계산서 수신 이메일:</span>
                <div className="font-semibold text-slate-800 dark:text-slate-200 truncate mt-0.5">{taxInfo.taxInvoiceEmail}</div>
              </div>
            </div>

            <div className="mt-4 pt-3 border-t border-slate-100 dark:border-slate-700/60 text-[11px] text-emerald-600 dark:text-emerald-400 flex items-center gap-1">
              <ShieldCheck size={13} />
              <span>결제 완료 즉시 국세청 홈택스 정식 영수(청구) 전자세금계산서가 자동 발행됩니다.</span>
            </div>
          </div>
        </div>
      </div>

      {/* 3. Tab 1 Content: Payment Transactions & Receipts */}
      {activeTab === 'transactions' && (
        <div className="p-5 sm:p-6 space-y-4">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div className="flex items-center gap-2">
              <span className="text-xs font-semibold text-slate-600 dark:text-slate-300">조회 기간:</span>
              <div className="inline-flex rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 p-0.5 text-xs">
                <button
                  type="button"
                  onClick={() => setSelectedPeriod('all')}
                  className={`px-2.5 py-1 rounded-md transition-colors ${
                    selectedPeriod === 'all'
                      ? 'bg-white dark:bg-slate-700 text-blue-600 dark:text-blue-400 font-bold shadow-2xs'
                      : 'text-slate-600 dark:text-slate-400'
                  }`}
                >
                  전체
                </button>
                <button
                  type="button"
                  onClick={() => setSelectedPeriod('3m')}
                  className={`px-2.5 py-1 rounded-md transition-colors ${
                    selectedPeriod === '3m'
                      ? 'bg-white dark:bg-slate-700 text-blue-600 dark:text-blue-400 font-bold shadow-2xs'
                      : 'text-slate-600 dark:text-slate-400'
                  }`}
                >
                  최근 3개월
                </button>
                <button
                  type="button"
                  onClick={() => setSelectedPeriod('6m')}
                  className={`px-2.5 py-1 rounded-md transition-colors ${
                    selectedPeriod === '6m'
                      ? 'bg-white dark:bg-slate-700 text-blue-600 dark:text-blue-400 font-bold shadow-2xs'
                      : 'text-slate-600 dark:text-slate-400'
                  }`}
                >
                  최근 6개월
                </button>
              </div>
            </div>

            <button
              type="button"
              onClick={handleExportExcel}
              className="px-3 py-1.5 text-xs font-semibold text-slate-700 dark:text-slate-200 bg-white dark:bg-slate-800 border border-slate-300 dark:border-slate-700 hover:bg-slate-50 dark:hover:bg-slate-700 rounded-xl transition-all shadow-2xs flex items-center gap-1.5 self-start sm:self-auto cursor-pointer"
            >
              <Download size={13} className="text-blue-600 dark:text-blue-400" />
              <span>결제 내역 엑셀 다운로드 (XLSX)</span>
            </button>
          </div>

          {/* Transactions Table */}
          <div className="border border-slate-200 dark:border-slate-800 rounded-xl overflow-x-auto shadow-2xs">
            <table className="w-full text-left text-xs">
              <thead className="bg-slate-50 dark:bg-slate-800/80 border-b border-slate-200 dark:border-slate-800 text-slate-600 dark:text-slate-400 font-bold">
                <tr>
                  <th className="p-3.5 whitespace-nowrap">결제 일시</th>
                  <th className="p-3.5 whitespace-nowrap">청구 항목</th>
                  <th className="p-3.5 whitespace-nowrap">결제 수단</th>
                  <th className="p-3.5 whitespace-nowrap text-right">공급가액</th>
                  <th className="p-3.5 whitespace-nowrap text-right">부가세</th>
                  <th className="p-3.5 whitespace-nowrap text-right">총 결제금액</th>
                  <th className="p-3.5 whitespace-nowrap text-center">결제 상태</th>
                  <th className="p-3.5 whitespace-nowrap text-center">회계 증빙 서류</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                {filteredTransactions.map((tx) => {
                  const isPaid = tx.status === 'paid';

                  return (
                    <tr key={tx.id} className="hover:bg-slate-50/60 dark:hover:bg-slate-800/40 transition-colors">
                      <td className="p-3.5 font-mono text-slate-700 dark:text-slate-300 whitespace-nowrap">
                        {tx.transactionDate}
                      </td>
                      <td className="p-3.5 whitespace-nowrap">
                        <div className="font-bold text-slate-900 dark:text-white">
                          {tx.description}
                        </div>
                        <div className="text-[11px] text-slate-400 dark:text-slate-500 font-mono">
                          문서번호: {tx.invoice.invoiceNumber}
                        </div>
                      </td>
                      <td className="p-3.5 text-slate-600 dark:text-slate-300 whitespace-nowrap">
                        {tx.paymentMethod}
                      </td>
                      <td className="p-3.5 text-right font-mono font-medium text-slate-700 dark:text-slate-300 whitespace-nowrap">
                        ₩{tx.supplyPrice.toLocaleString()}
                      </td>
                      <td className="p-3.5 text-right font-mono text-slate-500 dark:text-slate-400 whitespace-nowrap">
                        ₩{tx.vat.toLocaleString()}
                      </td>
                      <td className="p-3.5 text-right font-mono font-extrabold text-slate-900 dark:text-white whitespace-nowrap">
                        ₩{tx.totalPrice.toLocaleString()}
                      </td>
                      <td className="p-3.5 text-center whitespace-nowrap">
                        {isPaid ? (
                          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full bg-emerald-100 dark:bg-emerald-950 text-emerald-700 dark:text-emerald-300 font-bold text-[11px]">
                            <CheckCircle2 size={11} /> 완납 (결제완료)
                          </span>
                        ) : (
                          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full bg-amber-100 dark:bg-amber-950 text-amber-700 dark:text-amber-300 font-bold text-[11px]">
                            <Clock size={11} /> 납부 대기
                          </span>
                        )}
                      </td>
                      <td className="p-3.5 text-center whitespace-nowrap">
                        <div className="flex items-center justify-center gap-1.5">
                          {isPaid && (
                            <button
                              type="button"
                              onClick={() => setSelectedReceipt(tx)}
                              className="px-2 py-1 rounded bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 hover:bg-blue-50 dark:hover:bg-blue-900/40 hover:text-blue-600 font-semibold text-[11px] border border-slate-200 dark:border-slate-700 transition-colors cursor-pointer"
                              title="신용카드 매출전표 영수증 보기"
                            >
                              🧾 전표
                            </button>
                          )}
                          <button
                            type="button"
                            onClick={() => onOpenInvoiceModal(tx.invoice)}
                            className="px-2 py-1 rounded bg-blue-50 dark:bg-blue-950/60 text-blue-700 dark:text-blue-300 hover:bg-blue-100 font-semibold text-[11px] border border-blue-200 dark:border-blue-800 transition-colors cursor-pointer"
                            title="공식 청구서 인보이스 보기"
                          >
                            📄 청구서
                          </button>
                          {isPaid && tx.taxInvoiceApproveNo && (
                            <span 
                              className="px-2 py-1 rounded bg-emerald-50 dark:bg-emerald-950/60 text-emerald-700 dark:text-emerald-300 font-semibold text-[11px] border border-emerald-200 dark:border-emerald-800 cursor-default"
                              title={`국세청 승인번호: ${tx.taxInvoiceApproveNo}`}
                            >
                              🏛️ 세금계산서
                            </span>
                          )}
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* 4. Tab 2 Content: Subscription & Seat Audit Timeline (Slack/AWS 스타일 감사 로그) */}
      {activeTab === 'audit_log' && (
        <div className="p-5 sm:p-6 space-y-6">
          <div className="text-xs text-slate-500 dark:text-slate-400">
            조직의 플랜 변경, 좌석 확장/축소, 결제 수단 교체 등 라이선스 라이프사이클의 모든 감사 이력이 영구 기록됩니다.
          </div>

          <div className="relative pl-6 sm:pl-8 space-y-6 before:absolute before:left-3 sm:before:left-4 before:top-2 before:bottom-2 before:w-0.5 before:bg-slate-200 dark:before:bg-slate-800">
            {auditLogs.map((log) => {
              return (
                <div key={log.id} className="relative group">
                  {/* Timeline Point */}
                  <div className="absolute -left-6 sm:-left-8 top-1 w-3 h-3 rounded-full bg-blue-600 ring-4 ring-white dark:ring-slate-900" />

                  <div className="p-4 rounded-xl bg-slate-50 dark:bg-slate-800/60 border border-slate-200/80 dark:border-slate-800 transition-all hover:border-slate-300 dark:hover:border-slate-700">
                    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-1 mb-1">
                      <div className="flex items-center gap-2">
                        <span className="text-xs font-black text-slate-900 dark:text-white">
                          {log.actionTitle}
                        </span>
                        <span className="text-[11px] font-semibold px-2 py-0.2 rounded-md bg-blue-100/70 dark:bg-blue-900/40 text-blue-700 dark:text-blue-300">
                          {log.operator}
                        </span>
                      </div>
                      <span className="text-xs font-mono text-slate-400 dark:text-slate-500">
                        {log.timestamp}
                      </span>
                    </div>

                    <p className="text-xs text-slate-600 dark:text-slate-300 mt-1">
                      {log.description}
                    </p>

                    {log.details && (
                      <div className="mt-2 text-[11px] font-mono text-slate-500 dark:text-slate-400 bg-white dark:bg-slate-900/80 p-2 rounded-lg border border-slate-200 dark:border-slate-800">
                        {log.details}
                      </div>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* 5. 신용카드 매출전표 영수증 모달 (Receipt Modal) */}
      {selectedReceipt && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs animate-fadeIn">
          <div className="w-full max-w-md bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-2xl p-6 space-y-4">
            <div className="flex items-center justify-between border-b border-slate-100 dark:border-slate-800 pb-3">
              <div className="flex items-center gap-2">
                <Receipt size={18} className="text-blue-600 dark:text-blue-400" />
                <h4 className="font-extrabold text-slate-900 dark:text-white text-base">
                  신용카드 매출전표 (영수증)
                </h4>
              </div>
              <button
                type="button"
                onClick={() => setSelectedReceipt(null)}
                className="p-1 rounded-lg text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 cursor-pointer"
              >
                <X size={18} />
              </button>
            </div>

            <div className="space-y-3 text-xs">
              <div className="p-3 rounded-xl bg-slate-50 dark:bg-slate-800/80 font-mono space-y-1.5 text-slate-700 dark:text-slate-300">
                <div className="flex justify-between">
                  <span className="text-slate-400">가맹점명:</span>
                  <span className="font-bold">리드마스터 (LeadMaster CRM)</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-400">사업자등록번호:</span>
                  <span>214-12-89201</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-400">승인일시:</span>
                  <span>{selectedReceipt.transactionDate}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-400">승인번호:</span>
                  <span className="font-bold text-blue-600">{selectedReceipt.approvalNumber}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-400">카드종류:</span>
                  <span>신한 법인카드 (9410-****-****-4242)</span>
                </div>
              </div>

              <div className="pt-2 border-t border-slate-100 dark:border-slate-800 space-y-1 text-slate-700 dark:text-slate-300">
                <div className="flex justify-between">
                  <span>공급가액:</span>
                  <span className="font-mono">₩{selectedReceipt.supplyPrice.toLocaleString()} 원</span>
                </div>
                <div className="flex justify-between text-slate-500">
                  <span>부가가치세 (VAT 10%):</span>
                  <span className="font-mono">₩{selectedReceipt.vat.toLocaleString()} 원</span>
                </div>
                <div className="flex justify-between font-black text-sm text-slate-900 dark:text-white pt-2 border-t border-slate-200 dark:border-slate-700">
                  <span>총 결제금액:</span>
                  <span className="font-mono text-base text-blue-600 dark:text-blue-400">
                    ₩{selectedReceipt.totalPrice.toLocaleString()} 원
                  </span>
                </div>
              </div>
            </div>

            <div className="pt-3 border-t border-slate-100 dark:border-slate-800 flex justify-end">
              <button
                type="button"
                onClick={() => {
                  window.print();
                }}
                className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white font-bold text-xs rounded-xl shadow-xs cursor-pointer"
              >
                영수증 인쇄
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
