// 화면 그리기 점검 (서버 없이): npx vite-node scripts/smoke_render.tsx
// 바뀐 화면을 가짜 데이터로 한 번씩 그려서, 그리는 도중 오류가 나는지 본다 (클릭·저장은 점검 안 함)
const mem: Record<string, string> = {};
const storage = { getItem: (k: string) => (k in mem ? mem[k] : null), setItem: (k: string, v: string) => { mem[k] = String(v); }, removeItem: (k: string) => { delete mem[k]; }, clear: () => {}, key: () => null, length: 0 };
(globalThis as any).localStorage = storage;
(globalThis as any).sessionStorage = storage;
if (!(globalThis as any).window) (globalThis as any).window = globalThis;
(globalThis as any).document = (globalThis as any).document || { getElementById: () => null, addEventListener: () => {}, removeEventListener: () => {}, documentElement: { classList: { add() {}, remove() {} } } };

const run = async () => {
  const React = (await import('react')).default;
  const { renderToString } = await import('react-dom/server');
  const { MemoryRouter } = await import('react-router-dom');
  const { QueryClient, QueryClientProvider } = await import('@tanstack/react-query');
  const { ToastProvider } = await import('../contexts/ToastContext');
  const { CaseInfoTab } = await import('../components/case-detail/info/CaseInfoTab');
  const { CaseDetailHeader } = await import('../components/case-detail/CaseDetailHeader');
  const { CaseSettlementTab } = await import('../components/case-detail/CaseSettlementTab');
  const ReceivablesTab = (await import('../components/settlement/ReceivablesTab')).default;
  const QuickNewCase = (await import('../pages/QuickNewCase')).default;
  const { CaseListPagination } = await import('../components/case-list/CaseListPagination');
  const { getCheckProgress } = await import('../utils/intake');

  const partner: any = {
    partnerId: 'p1', name: '테스트 법무법인', active: true, vatMode: 'separate', requiredFields: [], summaryTemplate: '', checkItems: undefined,
    settlementConfig: { cutoffDay: 0, payoutDay: 2, payoutWeekDelay: 0, downPaymentPercentage: 10, firstPayoutPercentage: 50 },
    commissionRules: [{ ruleId: 'r1', minFee: 300, maxFee: 499, commission: 100, fullPayoutThreshold: 0, priority: 1, active: true, updatedAt: '2026-01-01' }],
  };
  const c: any = {
    caseId: 'abc12345', partnerId: 'p1', createdAt: '2026-10-30T01:00:00Z', updatedAt: '2026-10-30T01:00:00Z', status: '신규접수', statusUpdatedAt: '', managerName: '마크',
    isNew: true, customerName: '홍길동', phone: '010-1234-5678', birth: '1977', gender: '남', region: '서울 강남', jobTypes: ['직장인'], insurance4: '가입', maritalStatus: '기혼', childrenCount: 2,
    incomeDetails: { salary: 280 }, incomeNet: 280, loanMonthlyPay: 120, housingType: '월세', housingDetail: '빌라', deposit: 1000, rent: 50,
    assets: [{ id: 'a1', owner: '본인', type: '자동차', amount: 800, loanAmount: 300, desc: '아반떼' }],
    creditLoan: [{ id: 'l1', amount: 2500, desc: '국민카드 카드론' }, { id: 'l2', amount: 12000, desc: '저축은행' }],
    specialMemo: [{ id: 'm1', createdAt: '2026-10-30T02:00:00Z', content: '독촉 심함' }], reminders: [{ id: 'r1', datetime: '2026-10-31 10:00', type: '통화', content: '재통화' }],
    recordings: [], depositHistory: [{ date: '2026-10-01', amount: 40 }, { date: '2026-12-01', amount: 360 }], contractAt: '2026-09-30', contractFee: 400,
    creditCardUse: '사용', creditCardAmount: 300, historyType: '없음',
  };
  const qc = new QueryClient();
  const wrap = (el: any) => React.createElement(QueryClientProvider, { client: qc },
    React.createElement(ToastProvider, null, React.createElement(MemoryRouter, null, el)));
  const noop = () => {};
  let fail = 0;
  const check = (name: string, el: any, must: string[]) => {
    try {
      const html = renderToString(wrap(el));
      const missing = must.filter(m => !html.includes(m));
      console.log(`${missing.length ? 'FAIL' : 'PASS'}  ${name} (${html.length.toLocaleString()}자)${missing.length ? ' 없음: ' + missing.join(', ') : ''}`);
      if (missing.length) fail++;
    } catch (e: any) {
      console.log(`FAIL  ${name}: ${e?.message}`);
      fail++;
    }
  };

  check('상담 정보 탭', React.createElement(CaseInfoTab as any, {
    c, partners: [partner], inboundPaths: ['토스광고'], onUpdate: noop, onIncomeChange: noop, onJobTypeChange: noop,
    reminders: c.reminders, memos: c.specialMemo, onUpdateReminders: noop, onUpdateMemos: noop,
    aiSummaryText: null, setAiSummaryText: noop, aiSummaryEditMode: false, setAiSummaryEditMode: noop, handleUpdateAiSummaryText: noop,
    handleDeleteAiSummary: noop, handleSaveSummaryToMemo: noop, currentAudioFile: null, audioUrl: null, isFileUploading: false, isAiLoading: false,
    onAudioFileSelect: noop, onTriggerAudioInput: noop, onGenerateAiSummary: noop, onPlayRecording: noop, onDeleteRecording: noop, statusLogs: [], showToast: noop,
  }), ['채무 · 재산', '총 채무', '1억 5,100만원', '국민카드 카드론', '접수 · 인적사항']);

  check('통화 작업대', React.createElement(CaseDetailHeader as any, {
    c, partner, statuses: ['신규접수', '상담중', '부재'], secondaryStatuses: [], tertiaryStatuses: {},
    onStatusChangeStart: noop, onSecondaryStatusChangeStart: noop, onTertiaryStatusChangeStart: noop, onMissedCallIncrement: noop,
    onDeliverClick: noop, onAddCallReminder: noop, onEngage: noop, onBack: noop, onOpenPalette: noop,
    saveState: { state: 'saved', at: Date.now() }, progress: getCheckProgress(c, partner),
  }), ['홍길동', '010-1234-5678', '전화', '다음 통화', '사무실 전달', '필수 확인', '저장됨']);

  check('수임료/정산 탭', React.createElement(CaseSettlementTab as any, { c, commission: 100, onUpdate: noop, partner }),
    ['받을 수수료', '계약금 단계', '고객 입금 내역']);

  check('정산 → 받을 돈', React.createElement(ReceivablesTab as any, { cases: [{ ...c, status: '계약 완료' }], partners: [partner] }), ['불러오는 중']);

  check('새 리드 등록', React.createElement(QuickNewCase as any), ['새 리드 등록', '연락처', '등록하고 상담 시작']);

  check('쪽 넘김', React.createElement(CaseListPagination as any, { currentPage: 2, totalPages: 9, onPageChange: noop, pageSize: 20, onPageSizeChange: noop, totalItems: 170 }),
    ['170', '21', '40', '한 쪽에']);

  const { CaseListTable } = await import('../components/case-list/CaseListTable');
  const { ActiveCallProvider } = await import('../contexts/ActiveCallContext');
  check('케이스 목록 표', React.createElement(ActiveCallProvider as any, null, React.createElement(CaseListTable as any, {
    cases: [c, { ...c, caseId: 'zz999999', customerName: '김둘', isNew: false, assignedUserId: 'u1', reminders: [{ id: 'r2', datetime: '2026-10-01 09:00', type: '통화' }] }],
    partners: [partner], viewMode: 'active', missedCallStatus: '부재', missedCallIntervalTiers: [], statuses: ['신규접수', '상담중'],
    onDelete: noop, onRestore: noop, onMissedCall: noop, onStatusChange: noop, onToggleStar: noop,
    selectedIds: new Set(['abc12345']), onToggleSelect: noop, onToggleSelectAll: noop, memberName: () => '상담원A',
  })), ['홍길동', '김둘', '지난 일정', '담당', '미배정']);

  console.log(fail ? `\nFAIL=${fail}` : '\nSMOKE_ALL_PASS');
  process.exit(fail ? 1 : 0);
};
run().catch(e => { console.log('CRASH', e?.stack || e); process.exit(2); });
