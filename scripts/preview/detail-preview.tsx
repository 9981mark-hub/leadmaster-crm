// 개발용 리드 상세 미리보기 (서버·로그인 없이 가짜 데이터로 실제 CaseDetail 화면을 그림)
// 배포 빌드에 들어가지 않는다: vite build 입력은 루트 index.html 하나뿐이다.
// 실행: npx vite --port 5199 --host 127.0.0.1
// 주소: http://127.0.0.1:5199/leadmaster-crm/scripts/preview/detail-preview.html
// 옵션: ?tab=settlement · ?dark=1 · ?new=1 · ?house=자가|무상거주
// 가짜 데이터는 scripts/smoke_render.tsx와 같은 리드에 사전 정보·상태 기록·메모를 조금 더 넣은 것.
// 미리 넣은 캐시만 쓰고 다시 불러오지 않으므로 서버 요청이 없다. (칸을 고치면 저장 요청이 나갈 수 있으니 보기만 할 것)
import React, { useEffect } from 'react';
import ReactDOM from 'react-dom/client';
import { MemoryRouter, Routes, Route } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { ToastProvider } from '../../contexts/ToastContext';
import { QUERY_KEYS } from '../../services/queries';
import CaseDetail from '../../pages/CaseDetail';

const params = new URLSearchParams(window.location.search);
const house = params.get('house');

const partner: any = {
    partnerId: 'p1', name: '테스트 법무법인', active: true, vatMode: 'separate', requiredFields: [], summaryTemplate: '', checkItems: undefined,
    settlementConfig: { cutoffDay: 0, payoutDay: 2, payoutWeekDelay: 0, downPaymentPercentage: 10, firstPayoutPercentage: 50 },
    commissionRules: [{ ruleId: 'r1', minFee: 300, maxFee: 499, commission: 100, fullPayoutThreshold: 0, priority: 1, active: true, updatedAt: '2026-01-01' }],
};

const c: any = {
    caseId: 'abc12345', partnerId: 'p1', createdAt: '2026-10-30T01:00:00Z', updatedAt: '2026-10-30T01:00:00Z', status: '상담중', statusUpdatedAt: '', managerName: '마크',
    isNew: params.get('new') === '1', customerName: '홍길동', phone: '010-1234-5678', birth: '1977', gender: '남', region: '서울 강남', jobTypes: ['직장인'], insurance4: '가입', maritalStatus: '기혼', childrenCount: 2,
    incomeDetails: { salary: 280 }, incomeNet: 280, loanMonthlyPay: 120, housingType: '월세', housingDetail: '빌라', deposit: 1000, rent: 50,
    assets: [{ id: 'a1', owner: '본인', type: '자동차', amount: 800, loanAmount: 300, desc: '아반떼' }],
    creditLoan: [{ id: 'l1', amount: 2500, desc: '국민카드 카드론' }, { id: 'l2', amount: 12000, desc: '저축은행' }],
    specialMemo: [
        { id: 'm2', createdAt: '2026-10-31T05:00:00Z', content: '배우자 모르게 진행 원함. 저녁 7시 이후 통화 가능.' },
        { id: 'm1', createdAt: '2026-10-30T02:00:00Z', content: '독촉 심함' },
    ],
    reminders: [{ id: 'r1', datetime: '2026-10-31 10:00', type: '통화', content: '재통화' }],
    recordings: [], depositHistory: [{ date: '2026-10-01', amount: 40 }, { date: '2026-12-01', amount: 360 }], contractAt: '2026-09-30', contractFee: 400,
    creditCardUse: '사용', creditCardAmount: 300, historyType: '없음',
    // 미리보기용으로 더 넣은 값
    caseType: '개인회생', inboundPath: '토스광고',
    preInfo: '채무 금액: 5천만원~1억 / 월 소득: 200~300만원 / 연체 여부: 3개월 이상 / 상담 희망 시간: 평일 오후 / [referrer]: https://example.com',
    statusLogs: [
        { logId: 's2', caseId: 'abc12345', fromStatus: '부재', toStatus: '상담중', changedAt: '2026-10-31T04:50:00Z', changedBy: '마크', memo: '' },
        { logId: 's1', caseId: 'abc12345', fromStatus: '신규접수', toStatus: '부재', changedAt: '2026-10-30T02:10:00Z', changedBy: '마크', memo: '1차 부재' },
    ],
    ...(house === '자가' ? { housingType: '자가', housingDetail: '아파트', ownHousePrice: 32000, ownHouseLoan: 18000, ownHouseOwner: '본인' } : {}),
    ...(house === '무상거주' ? { housingType: '무상거주', housingDetail: '아파트', freeHousingOwner: '부모님' } : {}),
};

const queryClient = new QueryClient({
    defaultOptions: {
        queries: { staleTime: Infinity, gcTime: Infinity, retry: false, refetchOnMount: false, refetchOnWindowFocus: false, refetchOnReconnect: false },
        mutations: { retry: false },
    },
});
queryClient.setQueryData(QUERY_KEYS.case(c.caseId), c);
queryClient.setQueryData(QUERY_KEYS.cases, [c]);
queryClient.setQueryData(QUERY_KEYS.partners, [partner]);
queryClient.setQueryData(QUERY_KEYS.inboundPaths, ['토스광고', '메타', '카카오']);
queryClient.setQueryData(QUERY_KEYS.statuses, ['신규접수', '상담중', '부재', '사무장 접수', '계약 완료', '고객취소', '진행불가']);
queryClient.setQueryData(QUERY_KEYS.secondaryStatuses, ['서류 준비', '접수 완료']);
queryClient.setQueryData(QUERY_KEYS.tertiaryStatuses, {});

/** App.tsx의 Layout과 같은 틀 (왼쪽 메뉴 w-64, 본문 스크롤 #main-scroll-container p-4 md:p-8) */
const Shell: React.FC<{ children: React.ReactNode }> = ({ children }) => (
    <div className="flex h-[100dvh] bg-gray-50 dark:bg-gray-900">
        <aside className="hidden md:flex flex-col w-64 bg-white dark:bg-gray-800 border-r border-gray-200 dark:border-gray-700">
            <div className="p-6 border-b border-gray-100">
                <h1 className="text-xl font-bold text-gray-800 dark:text-white tracking-tight">LeadMaster</h1>
                <p className="text-xs text-gray-400 mt-1">미리보기 (가짜 데이터)</p>
            </div>
        </aside>
        <main className="flex-1 flex flex-col overflow-hidden relative">
            <div className="md:hidden flex items-center justify-between p-4 bg-white dark:bg-gray-800 border-b border-gray-200 dark:border-gray-700 z-10">
                <h1 className="text-xl font-bold text-gray-800 dark:text-white tracking-tight">LeadMaster</h1>
            </div>
            <div id="main-scroll-container" className="flex-1 overflow-y-scroll p-4 md:p-8 pb-40 md:pb-8">
                {children}
            </div>
        </main>
    </div>
);

/** ?tab=settlement 이면 정산 탭 버튼을 눌러 둔다 (탭 상태는 CaseDetail 안에 있음) */
const TabOpener: React.FC = () => {
    useEffect(() => {
        const want = params.get('tab');
        if (want !== 'settlement') return;
        const t = setTimeout(() => {
            const btn = Array.from(document.querySelectorAll('button')).find(b => b.textContent?.trim() === '수임료/정산');
            btn?.click();
        }, 50);
        return () => clearTimeout(t);
    }, []);
    return null;
};

ReactDOM.createRoot(document.getElementById('root')!).render(
    <QueryClientProvider client={queryClient}>
        <ToastProvider>
            <MemoryRouter initialEntries={[`/case/${c.caseId}`]}>
                <Shell>
                    <Routes>
                        <Route path="/case/:caseId" element={<CaseDetail />} />
                    </Routes>
                </Shell>
                <TabOpener />
            </MemoryRouter>
        </ToastProvider>
    </QueryClientProvider>
);
