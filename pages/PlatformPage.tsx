import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  Building2, Plus, RefreshCw, Ban, RotateCcw, Copy,
  DollarSign, Users, TrendingUp, Server, FileText, CheckCircle2, Sparkles, ShieldCheck, Settings, Shield, Mail
} from 'lucide-react';
import { useAuth } from '../contexts/AuthContext';
import { useToast } from '../contexts/ToastContext';
import {
  PlatformOrg, createOrganization, fetchOrganizations, setOrganizationStatus,
  computeBillingSummary, generateOrgInvoiceMarkdown, PRICE_PER_AGENT_MONTH,
  OrgFeaturePermissions, fetchAllOrgPermissions, calculateOrgMonthlyBill, generateApprovalEmailContent
} from '../services/platform';
import {
  fetchOrgApplications, approveOrgApplication, rejectOrgApplication, OrgApplication
} from '../services/orgApplicationService';
import { HQ_ORG_ID } from '../services/org';
import { useCountUp } from '../utils/useCountUp';
import { TenantPermissionModal } from '../components/platform/TenantPermissionModal';
import { ApprovalEmailModal } from '../components/platform/ApprovalEmailModal';

const fmtDate = (iso?: string) => (iso ? new Date(iso).toLocaleDateString('ko-KR') : '-');

/** HOST(플랫폼 관리자) 전용: 고객 회사 만들기·목록·실시간 과금 정산·사용 중지 관제 */
export default function PlatformPage() {
  const { org, isPlatformAdmin } = useAuth();
  const { showToast } = useToast();
  const [orgs, setOrgs] = useState<PlatformOrg[]>([]);
  const [applications, setApplications] = useState<OrgApplication[]>([]);
  const [permissionsMap, setPermissionsMap] = useState<Record<string, OrgFeaturePermissions>>({});
  const [selectedOrgForPerm, setSelectedOrgForPerm] = useState<PlatformOrg | null>(null);

  // 이메일 검토 및 자동 발송 모달 상태
  const [emailModalApp, setEmailModalApp] = useState<OrgApplication | null>(null);
  const [emailModalDirect, setEmailModalDirect] = useState<{ name: string; ownerEmail: string } | null>(null);
  const [isEmailModalOpen, setIsEmailModalOpen] = useState(false);

  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [name, setName] = useState('');
  const [ownerEmail, setOwnerEmail] = useState('');
  const [applyTmPreset, setApplyTmPreset] = useState(true);

  const reload = useCallback(async () => {
    setLoading(true);
    try {
      const [fetchedOrgs, fetchedApps] = await Promise.all([
        fetchOrganizations(),
        fetchOrgApplications(),
      ]);
      setOrgs(fetchedOrgs);
      setApplications(fetchedApps);

      // 테넌트 권한 일괄 로드
      const orgIds = fetchedOrgs.map(o => o.id);
      const perms = await fetchAllOrgPermissions(orgIds);
      setPermissionsMap(perms);
    } catch (e: any) {
      showToast(`회사 목록을 불러오지 못했습니다: ${e.message}`, 'error');
    } finally {
      setLoading(false);
    }
  }, [showToast]);

  useEffect(() => { reload(); }, [reload]);

  const billingSummary = useMemo(() => computeBillingSummary(orgs), [orgs]);

  // 성과 지표 카운트업
  const animatedActiveOrgs = useCountUp(billingSummary.activeOrgs);
  const animatedTotalSeats = useCountUp(billingSummary.totalSeats);
  const animatedRevenue = useCountUp(billingSummary.totalMonthlyRevenue);
  const animatedNetMargin = useCountUp(billingSummary.netMargin);

  if (!isPlatformAdmin) {
    return <div className="p-6 text-gray-500">플랫폼 관리자만 볼 수 있는 화면입니다.</div>;
  }

  const handleCreate = async () => {
    if (busy) return;
    const confirmMsg = `'${name.trim()}' 회사를 만들고 ${ownerEmail.trim()} 을(를) 대표로 초대할까요?` +
      (applyTmPreset ? '\n(TM 실무 표준 1·2차 상태, 첫인사 스크립트, 10년 녹음보존 프리셋이 함께 적용됩니다)' : '');
    if (!window.confirm(confirmMsg)) return;
    setBusy(true);
    try {
      await createOrganization(name, ownerEmail, applyTmPreset);
      showToast('회사를 생성했습니다. 대표가 구글 로그인 시 즉시 활성화됩니다.', 'success');
      setName('');
      setOwnerEmail('');
      await reload();
    } catch (e: any) {
      showToast(e.message, 'error');
    } finally {
      setBusy(false);
    }
  };

  const openApprovalModalForApp = (app: OrgApplication) => {
    setEmailModalApp(app);
    setEmailModalDirect(null);
    setIsEmailModalOpen(true);
  };

  const openApprovalModalForCompany = (companyName: string, email: string) => {
    setEmailModalApp(null);
    setEmailModalDirect({ name: companyName, ownerEmail: email });
    setIsEmailModalOpen(true);
  };

  const handleSendApprovalEmail = (companyName: string, ownerEmail: string) => {
    openApprovalModalForCompany(companyName, ownerEmail);
  };

  const handleApproveApp = async (app: OrgApplication) => {
    // 승인 전 확인 및 자동 발송 모달 호출
    openApprovalModalForApp(app);
  };

  const handleRejectApp = async (id: string) => {
    if (busy) return;
    setBusy(true);
    try {
      await rejectOrgApplication(id);
      showToast('가입 신청을 반려 처리했습니다.', 'info');
      await reload();
    } catch (e: any) {
      showToast(`반려 처리 실패: ${e.message}`, 'error');
    } finally {
      setBusy(false);
    }
  };

  const toggleStatus = async (o: PlatformOrg) => {
    const next = o.status === 'active' ? 'suspended' : 'active';
    const msg = next === 'suspended'
      ? `'${o.name}' 회사를 사용 중지할까요?\n중지하면 해당 회사 소속 사용자들은 로그인해도 데이터가 완전히 차단됩니다. (데이터는 안전 보존)`
      : `'${o.name}' 회사를 다시 정상 사용으로 전환할까요?`;
    if (!window.confirm(msg)) return;
    setBusy(true);
    try {
      await setOrganizationStatus(o.id, next);
      showToast(next === 'suspended' ? '사용 중지 처리되었습니다.' : '정상 사용으로 활성화되었습니다.', 'success');
      await reload();
    } catch (e: any) {
      showToast(e.message, 'error');
    } finally {
      setBusy(false);
    }
  };

  const copyInvoice = (o: PlatformOrg) => {
    const markdown = generateOrgInvoiceMarkdown(o);
    navigator.clipboard.writeText(markdown).then(() => {
      showToast(`'${o.name}' 당월 청구서(마크다운)를 클립보드에 복사했습니다.`, 'success');
    });
  };

  const appUrl = `${window.location.origin}${window.location.pathname}`;
  const apkUrl = `${appUrl.replace(/\/$/, '')}/app/LeadMaster.apk`;
  const copy = (text: string) => navigator.clipboard.writeText(text).then(() => showToast('복사했습니다.', 'success'));

  return (
    <div className="max-w-7xl mx-auto space-y-6 pb-12 animate-page-in">
      {/* Title Bar */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 dark:text-white flex items-center gap-2.5">
            <div className="p-2 bg-blue-50 dark:bg-blue-950/50 rounded-xl border border-blue-100 dark:border-blue-900/50 text-blue-600 dark:text-blue-400">
              <Building2 size={24} />
            </div>
            <span>플랫폼 과금 및 회사 관제 센터</span>
            <span className="text-xs px-2.5 py-0.5 rounded-full font-bold bg-blue-100 dark:bg-blue-900/40 text-blue-700 dark:text-blue-300 border border-blue-200 dark:border-blue-800">
              HOST HQ
            </span>
          </h1>
          <p className="text-sm text-gray-500 dark:text-gray-400 mt-1.5">
            고객사별 활성 상담원 과금(₩48,000/인) 현황, 서버 원가 마진율 및 테넌트 라이프사이클을 총괄합니다.
          </p>
        </div>
        <button
          onClick={reload}
          className="px-3.5 py-2 border border-gray-200 dark:border-gray-700 rounded-xl text-sm font-semibold flex items-center gap-1.5 hover:bg-gray-50 dark:hover:bg-gray-800 transition-colors shadow-xs"
        >
          <RefreshCw size={14} className={loading ? 'animate-spin' : ''} /> 새로고침
        </button>
      </div>

      {/* 4대 핵심 재무 & 인프라 KPI 카드 */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {/* KPI 1: 유료 고객사 */}
        <div className="bg-white dark:bg-gray-800 p-5 rounded-2xl border border-gray-200/80 dark:border-gray-700/80 shadow-xs hover:border-blue-500/30 transition-all">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold text-gray-500 dark:text-gray-400 uppercase tracking-wider">유료 고객사</span>
            <div className="p-2 bg-blue-50 dark:bg-blue-950/40 rounded-xl text-blue-600 dark:text-blue-400">
              <Building2 size={18} />
            </div>
          </div>
          <div className="mt-2 flex items-baseline gap-2">
            <span className="text-3xl font-black text-gray-900 dark:text-white font-mono tabular-nums">
              {animatedActiveOrgs}
            </span>
            <span className="text-xs text-gray-400 font-mono tabular-nums">/ 총 {billingSummary.totalOrgs}개사</span>
          </div>
          <div className="mt-2 text-xs text-emerald-600 dark:text-emerald-400 font-semibold flex items-center gap-1">
            <CheckCircle2 size={13} /> {billingSummary.activeOrgs > 0 ? '정상 서비스 가동 중' : '첫 고객사 유치 대기'}
          </div>
        </div>

        {/* KPI 2: 과금 상담원 */}
        <div className="bg-white dark:bg-gray-800 p-5 rounded-2xl border border-gray-200/80 dark:border-gray-700/80 shadow-xs hover:border-indigo-500/30 transition-all">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold text-gray-500 dark:text-gray-400 uppercase tracking-wider">과금 상담원 (합계)</span>
            <div className="p-2 bg-indigo-50 dark:bg-indigo-950/40 rounded-xl text-indigo-600 dark:text-indigo-400">
              <Users size={18} />
            </div>
          </div>
          <div className="mt-2 flex items-baseline gap-2">
            <span className="text-3xl font-black text-gray-900 dark:text-white font-mono tabular-nums">
              {animatedTotalSeats}
            </span>
            <span className="text-xs text-gray-400">석 (활성 계정)</span>
          </div>
          <div className="mt-2 text-xs text-gray-500 dark:text-gray-400">
            좌석당 단가: <span className="font-semibold text-gray-800 dark:text-gray-200">₩48,000 / 월</span>
          </div>
        </div>

        {/* KPI 3: 당월 총 예상 매출 */}
        <div className="bg-white dark:bg-gray-800 p-5 rounded-2xl border border-gray-200/80 dark:border-gray-700/80 shadow-xs hover:border-emerald-500/30 transition-all">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold text-gray-500 dark:text-gray-400 uppercase tracking-wider">당월 총 예상 매출</span>
            <div className="p-2 bg-emerald-50 dark:bg-emerald-950/40 rounded-xl text-emerald-600 dark:text-emerald-400">
              <DollarSign size={18} />
            </div>
          </div>
          <div className="mt-2 flex items-baseline gap-1">
            <span className="text-3xl font-black text-emerald-600 dark:text-emerald-400 font-mono tabular-nums">
              ₩{animatedRevenue.toLocaleString()}
            </span>
          </div>
          <div className="mt-2 text-xs text-gray-500 dark:text-gray-400">
            VAT 별도 공급가액 기준
          </div>
        </div>

        {/* KPI 4: 인프라 원가 & 순마진 */}
        <div className="bg-white dark:bg-gray-800 p-5 rounded-2xl border border-gray-200/80 dark:border-gray-700/80 shadow-xs hover:border-amber-500/30 transition-all">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold text-gray-500 dark:text-gray-400 uppercase tracking-wider">인프라 원가 & 순마진</span>
            <div className="p-2 bg-amber-50 dark:bg-amber-950/40 rounded-xl text-amber-600 dark:text-amber-400">
              <TrendingUp size={18} />
            </div>
          </div>
          <div className="mt-2 flex items-baseline gap-2">
            <span className="text-2xl font-black text-gray-900 dark:text-white font-mono tabular-nums">
              ₩{animatedNetMargin.toLocaleString()}
            </span>
            <span className="text-xs font-bold text-emerald-600 dark:text-emerald-400 font-mono tabular-nums">
              ({billingSummary.marginPercent}%)
            </span>
          </div>
          <div className="mt-2 text-xs text-gray-500 dark:text-gray-400 flex items-center gap-1 font-mono">
            <Server size={12} /> Pro 인프라 비용: ₩{billingSummary.estimatedInfraCost.toLocaleString()}/월
          </div>
        </div>
      </div>

      {/* 🏢 1. 신규 TM 회사 가입 신청 대기열 (옵션 A 실시간 승인 체계) */}
      <section className="bg-white dark:bg-gray-800 rounded-2xl border border-gray-200/80 dark:border-gray-700/80 p-5 space-y-4 shadow-xs">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <h2 className="font-bold text-gray-900 dark:text-white flex items-center gap-2">
              <Building2 size={18} className="text-indigo-600 dark:text-indigo-400" /> 
              신규 TM 회사 가입 신청 대기열
            </h2>
            {applications.filter(a => a.status === 'pending').length > 0 ? (
              <span className="px-2.5 py-0.5 rounded-full text-xs font-bold bg-amber-500/15 text-amber-600 dark:text-amber-400 border border-amber-500/30 animate-pulse">
                대기 {applications.filter(a => a.status === 'pending').length}건
              </span>
            ) : (
              <span className="px-2.5 py-0.5 rounded-full text-xs font-medium bg-gray-100 dark:bg-gray-700 text-gray-500 dark:text-gray-400">
                대기 0건
              </span>
            )}
          </div>
          <button
            onClick={reload}
            disabled={loading}
            className="text-xs text-gray-500 hover:text-gray-700 dark:hover:text-gray-300 flex items-center gap-1 cursor-pointer"
          >
            <RefreshCw size={12} className={loading ? 'animate-spin' : ''} /> 새로고침
          </button>
        </div>

        {applications.length === 0 ? (
          <div className="p-8 text-center text-xs text-gray-400 border border-dashed border-gray-200 dark:border-gray-700 rounded-xl">
            접수된 가입 신청이 없습니다. 로그인 페이지에서 [TM 회사 가입 신청]이 접수되면 여기에 실시간 표시됩니다.
          </div>
        ) : (
          <div className="space-y-3">
            {applications.map(app => (
              <div 
                key={app.id}
                className={`p-4 rounded-xl border transition-all flex flex-col md:flex-row md:items-center justify-between gap-4 ${
                  app.status === 'pending'
                    ? 'bg-amber-500/5 border-amber-500/30 dark:bg-amber-950/20 shadow-xs'
                    : app.status === 'approved'
                    ? 'bg-emerald-500/5 border-emerald-500/20 dark:bg-emerald-950/15 opacity-85'
                    : 'bg-gray-50 dark:bg-gray-900/40 border-gray-200 dark:border-gray-800 opacity-60'
                }`}
              >
                <div className="space-y-1.5 flex-1">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="font-bold text-sm text-gray-900 dark:text-white">{app.companyName}</span>
                    <span className="text-xs font-medium text-gray-600 dark:text-gray-300">({app.ownerName} 대표)</span>
                    <span className="text-xs font-mono text-blue-600 dark:text-blue-400">{app.ownerEmail}</span>
                    <span className="text-xs text-gray-400">| {app.phone}</span>
                    <span className="text-[11px] px-2 py-0.5 rounded-md bg-gray-200 dark:bg-gray-700 text-gray-700 dark:text-gray-300">
                      상담원 {app.agentCountTier === '1-5' ? '1~5명' : app.agentCountTier === '6-20' ? '6~20명' : '21명 이상'}
                    </span>
                    <span className={`text-[11px] px-2 py-0.5 rounded-full font-bold ${
                      app.status === 'pending'
                        ? 'bg-amber-100 dark:bg-amber-900/40 text-amber-600 dark:text-amber-400'
                        : app.status === 'approved'
                        ? 'bg-emerald-100 dark:bg-emerald-900/40 text-emerald-600 dark:text-emerald-400'
                        : 'bg-rose-100 dark:bg-rose-900/40 text-rose-600 dark:text-rose-400'
                    }`}>
                      {app.status === 'pending' ? '승인 대기중' : app.status === 'approved' ? '승인 완료' : '반려됨'}
                    </span>
                  </div>
                  {app.memo && (
                    <div className="text-xs text-gray-500 dark:text-gray-400 bg-black/5 dark:bg-white/5 p-2 rounded-lg">
                      문의/메모: {app.memo}
                    </div>
                  )}
                  <div className="text-[11px] text-gray-400">
                    신청일: {new Date(app.createdAt).toLocaleString('ko-KR')}
                    {app.approvedAt && ` • 승인일: ${new Date(app.approvedAt).toLocaleString('ko-KR')}`}
                  </div>
                </div>

                {app.status === 'pending' && (
                  <div className="flex items-center gap-2 shrink-0">
                    <button
                      onClick={() => handleApproveApp(app)}
                      disabled={busy}
                      className="px-4 py-2 rounded-xl bg-blue-600 hover:bg-blue-700 text-white font-bold text-xs shadow-md transition-all flex items-center gap-1.5 cursor-pointer disabled:opacity-50"
                    >
                      <CheckCircle2 size={14} />
                      <span>1클릭 승인 & 개설</span>
                    </button>
                    <button
                      onClick={() => handleRejectApp(app.id)}
                      disabled={busy}
                      className="px-3 py-2 rounded-xl bg-gray-200 dark:bg-gray-700 hover:bg-gray-300 dark:hover:bg-gray-600 text-gray-700 dark:text-gray-300 font-medium text-xs transition-colors cursor-pointer"
                    >
                      반려
                    </button>
                  </div>
                )}

                {app.status === 'approved' && (
                  <div className="flex items-center gap-2 shrink-0">
                    <span className="text-[11px] font-semibold text-emerald-600 dark:text-emerald-400 bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-200 dark:border-emerald-800 px-2.5 py-1 rounded-lg">
                      승인 완료
                    </span>
                    <button
                      onClick={() => handleSendApprovalEmail(app.companyName, app.ownerEmail)}
                      className="px-2.5 py-1 rounded-lg bg-gray-50 dark:bg-gray-800/60 border border-gray-200 dark:border-gray-700 text-gray-600 dark:text-gray-300 hover:bg-gray-100 font-medium text-xs transition-all flex items-center gap-1 cursor-pointer"
                      title="대표자 이메일로 7일 무료체험 승인 안내 메일 재발송"
                    >
                      <Mail size={12} />
                      <span>재발송</span>
                    </button>
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
      </section>

      {/* 새 고객 회사 등록 폼 (TM 표준 프리셋 원클릭 지원) */}
      <section className="bg-white dark:bg-gray-800 rounded-2xl border border-gray-200/80 dark:border-gray-700/80 p-5 space-y-4 shadow-xs">
        <div className="flex items-center justify-between">
          <h2 className="font-bold text-gray-900 dark:text-white flex items-center gap-2">
            <Plus size={18} className="text-blue-600 dark:text-blue-400" /> 신규 고객 회사 등록 (테넌트 생성)
          </h2>
          <span className="text-xs text-blue-600 dark:text-blue-400 font-semibold flex items-center gap-1 bg-blue-50 dark:bg-blue-950/40 px-2.5 py-1 rounded-full border border-blue-100 dark:border-blue-900/40">
            <Sparkles size={13} /> TM 사무실 실무 프리셋 자동 주입 지원
          </span>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
          <input
            className="p-2.5 border border-gray-200 dark:border-gray-700 rounded-xl text-sm bg-gray-50/50 dark:bg-gray-900 text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
            placeholder="회사 이름 (예: 한마음파트너스, 로앤파트너스)"
            value={name}
            onChange={e => setName(e.target.value)}
          />
          <input
            className="p-2.5 border border-gray-200 dark:border-gray-700 rounded-xl text-sm bg-gray-50/50 dark:bg-gray-900 text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
            placeholder="대표 구글 이메일 (초대장 발송)"
            value={ownerEmail}
            onChange={e => setOwnerEmail(e.target.value)}
          />
          <button
            onClick={handleCreate}
            disabled={busy || !name.trim() || !ownerEmail.trim()}
            className="px-5 py-2.5 rounded-xl bg-blue-600 hover:bg-blue-700 text-white font-bold text-sm shadow-md shadow-blue-500/20 disabled:opacity-50 transition-all flex items-center justify-center gap-2"
          >
            <Plus size={16} /> 회사 만들기 & 초대
          </button>
        </div>

        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pt-2 border-t border-gray-100 dark:border-gray-700">
          <label className="flex items-center gap-2 text-xs text-gray-600 dark:text-gray-300 cursor-pointer">
            <input
              type="checkbox"
              checked={applyTmPreset}
              onChange={e => setApplyTmPreset(e.target.checked)}
              className="rounded border-gray-300 text-blue-600 focus:ring-blue-500"
            />
            <span className="font-semibold text-gray-800 dark:text-gray-200">
              TM 표준 프리셋 자동 적용
            </span>
            <span className="text-gray-400">
              (10종 1·2차 상태, 법률 첫인사 스크립트, 10년 녹음 보존 설정 일괄 주입)
            </span>
          </label>

          <div className="flex flex-wrap gap-2 text-xs">
            <button
              onClick={() => copy(appUrl)}
              className="px-3 py-1.5 border border-gray-200 dark:border-gray-700 rounded-lg flex items-center gap-1.5 text-gray-600 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors"
            >
              <Copy size={12} /> 웹 로그인 주소 복사
            </button>
            <button
              onClick={() => copy(apkUrl)}
              className="px-3 py-1.5 border border-gray-200 dark:border-gray-700 rounded-lg flex items-center gap-1.5 text-gray-600 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors"
            >
              <Copy size={12} /> 안드로이드 정식 APK 주소 복사
            </button>
          </div>
        </div>
      </section>

      {/* 고객 회사 목록 및 실시간 과금 테이블 */}
      <section className="bg-white dark:bg-gray-800 rounded-2xl border border-gray-200/80 dark:border-gray-700/80 overflow-hidden shadow-xs">
        <div className="px-5 py-3.5 border-b border-gray-100 dark:border-gray-700 bg-gray-50/50 dark:bg-gray-750 flex items-center justify-between">
          <h3 className="font-bold text-gray-900 dark:text-white text-sm flex items-center gap-2">
            <span>고객사 테넌트 목록 및 월간 청구 현황</span>
            <span className="px-2 py-0.5 rounded-full text-xs font-mono font-bold bg-blue-100 dark:bg-blue-900/40 text-blue-700 dark:text-blue-300">
              {orgs.length}
            </span>
          </h3>
          <span className="text-xs text-gray-500 dark:text-gray-400">
            * 청구서 복사 버튼으로 정산용 공식 마크다운 서식을 바로 추출할 수 있습니다.
          </span>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-gray-50/80 dark:bg-gray-700/50 text-gray-500 dark:text-gray-400 text-left border-b border-gray-100 dark:border-gray-700 text-xs">
              <tr>
                <th className="p-3.5">회사명</th>
                <th className="p-3.5">상태</th>
                <th className="p-3.5">대표 계정 (초대)</th>
                <th className="p-3.5 text-right">활성 / 전체 멤버</th>
                <th className="p-3.5 text-right">당월 청구 예정액</th>
                <th className="p-3.5 text-right">보유 리드</th>
                <th className="p-3.5">텔레그램 봇</th>
                <th className="p-3.5">등록일</th>
                <th className="p-3.5 text-right">액션</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100 dark:divide-gray-700">
              {orgs.map(o => {
                const isHq = o.id === HQ_ORG_ID || o.slug === 'hq';
                const bill = calculateOrgMonthlyBill(Math.max(1, o.activeMembers), permissionsMap[o.id]);
                const monthlyBill = isHq ? 0 : bill.totalPrice;

                return (
                  <tr key={o.id} className="hover:bg-gray-50/50 dark:hover:bg-gray-750/30 transition-colors">
                    <td className="p-3.5 font-medium text-gray-900 dark:text-white">
                      <div className="flex items-center gap-2">
                        <span className="font-bold">{o.name}</span>
                        {isHq && (
                          <span className="px-1.5 py-0.5 text-[10px] font-bold text-blue-700 dark:text-blue-300 bg-blue-100 dark:bg-blue-900/40 rounded">
                            본사(면제)
                          </span>
                        )}
                      </div>
                      {/* 권한 요약 칩 표시 */}
                      {!isHq && permissionsMap[o.id] && (
                        <div className="flex items-center gap-1.5 mt-1.5 flex-wrap">
                          <span className={`text-[10px] px-1.5 py-0.2 rounded font-semibold ${
                            permissionsMap[o.id].settlementEnabled
                              ? 'bg-amber-100 dark:bg-amber-950/50 text-amber-700 dark:text-amber-300 border border-amber-300 dark:border-amber-800'
                              : 'bg-gray-100 dark:bg-gray-800 text-gray-400 line-through'
                          }`}>
                            광고비·정산 {permissionsMap[o.id].settlementEnabled ? 'ON' : 'OFF'}
                          </span>
                          <span className={`text-[10px] px-1.5 py-0.2 rounded font-semibold ${
                            permissionsMap[o.id].autoDialEnabled
                              ? 'bg-blue-100 dark:bg-blue-950/50 text-blue-700 dark:text-blue-300 border border-blue-300 dark:border-blue-800'
                              : 'bg-gray-100 dark:bg-gray-800 text-gray-400 line-through'
                          }`}>
                            오토콜 {permissionsMap[o.id].autoDialEnabled ? 'ON' : 'OFF'}
                          </span>
                          <span className={`text-[10px] px-1.5 py-0.2 rounded font-semibold ${
                            permissionsMap[o.id].aiTrainingEnabled
                              ? 'bg-emerald-100 dark:bg-emerald-950/50 text-emerald-700 dark:text-emerald-300 border border-emerald-300 dark:border-emerald-800'
                              : 'bg-gray-100 dark:bg-gray-800 text-gray-400 line-through'
                          }`}>
                            AI교육 {permissionsMap[o.id].aiTrainingEnabled ? 'ON' : 'OFF'}
                          </span>
                        </div>
                      )}
                    </td>
                    <td className="p-3.5">
                      {o.status === 'active' ? (
                        <span className="inline-flex items-center gap-1 text-xs font-bold text-emerald-700 dark:text-emerald-400 bg-emerald-50 dark:bg-emerald-950/40 px-2 py-0.5 rounded-md border border-emerald-200/50 dark:border-emerald-800/40">
                          <CheckCircle2 size={12} /> 정상 가동
                        </span>
                      ) : (
                        <span className="inline-flex items-center gap-1 text-xs font-bold text-red-600 dark:text-red-400 bg-red-50 dark:bg-red-950/40 px-2 py-0.5 rounded-md border border-red-200/50 dark:border-red-800/40">
                          <Ban size={12} /> 사용 중지
                        </span>
                      )}
                    </td>
                    <td className="p-3.5 text-xs text-gray-600 dark:text-gray-300">
                      {o.ownerInviteEmail ? (
                        <div className="flex flex-col gap-1 min-w-[190px]">
                          <div 
                            className="font-mono text-xs text-gray-900 dark:text-gray-100 select-all truncate max-w-[240px]" 
                            title={o.ownerInviteEmail}
                          >
                            {o.ownerInviteEmail}
                          </div>
                          <div className="flex items-center gap-1.5 text-[11px]">
                            {o.ownerInviteAccepted ? (
                              <span className="inline-flex items-center gap-1 text-emerald-600 dark:text-emerald-400 font-semibold">
                                <span className="w-1.5 h-1.5 rounded-full bg-emerald-500"></span>
                                가입 완료
                              </span>
                            ) : (
                              <span className="inline-flex items-center gap-1 text-amber-600 dark:text-amber-400 font-semibold">
                                <span className="w-1.5 h-1.5 rounded-full bg-amber-500 animate-pulse"></span>
                                초대 수락 대기
                              </span>
                            )}
                          </div>
                        </div>
                      ) : (
                        <span className="text-gray-400">-</span>
                      )}
                    </td>
                    <td className="p-3.5 text-right font-mono tabular-nums text-gray-900 dark:text-gray-100">
                      <span className="font-bold text-blue-600 dark:text-blue-400">{o.activeMembers}</span> / {o.members}명
                    </td>
                    <td className="p-3.5 text-right font-mono tabular-nums font-bold">
                      {isHq ? (
                        <span className="text-gray-400 text-xs font-normal">본사 운영</span>
                      ) : (
                        <div>
                          <span className="text-gray-900 dark:text-white">
                            ₩{monthlyBill.toLocaleString()}
                          </span>
                          <div className="text-[10px] text-gray-400 font-normal">
                            (₩{bill.unitPrice.toLocaleString()}/석 • {bill.tierName})
                          </div>
                        </div>
                      )}
                    </td>
                    <td className="p-3.5 text-right font-mono tabular-nums text-gray-700 dark:text-gray-300">
                      {o.cases.toLocaleString()}건
                    </td>
                    <td className="p-3.5 text-xs">
                      {isHq ? (
                        <span className="text-blue-600 font-medium">본사 봇</span>
                      ) : o.hasTelegramBot ? (
                        <span className="text-emerald-600 font-medium">연동 완료</span>
                      ) : (
                        <span className="text-gray-400">미등록</span>
                      )}
                    </td>
                    <td className="p-3.5 text-xs text-gray-500 font-mono tabular-nums">
                      {fmtDate(o.createdAt)}
                    </td>
                    <td className="p-3.5 text-right">
                      <div className="flex items-center justify-end gap-1.5">
                        {!isHq && o.ownerInviteEmail && (
                          o.ownerInviteAccepted ? (
                            <button
                              onClick={() => handleSendApprovalEmail(o.name, o.ownerInviteEmail!)}
                              className="px-2 py-1 text-xs text-gray-500 dark:text-gray-400 bg-gray-50 dark:bg-gray-800/60 border border-gray-200 dark:border-gray-700 hover:bg-gray-100 dark:hover:bg-gray-700/60 rounded-lg flex items-center gap-1 transition-colors shadow-xs cursor-pointer"
                              title="이미 가입 완료된 테넌트입니다. 필요 시 접속 주소 및 안내 메일을 재발송합니다."
                            >
                              <Mail size={12} /> 재안내
                            </button>
                          ) : (
                            <button
                              onClick={() => handleSendApprovalEmail(o.name, o.ownerInviteEmail!)}
                              className="px-2.5 py-1 text-xs font-semibold text-blue-700 dark:text-blue-300 bg-blue-50 dark:bg-blue-950/40 border border-blue-200 dark:border-blue-800 hover:bg-blue-100 dark:hover:bg-blue-900/60 rounded-lg flex items-center gap-1 transition-colors shadow-xs cursor-pointer"
                              title="대표자 이메일로 7일 무료체험 승인 안내 메일 발송 및 클립보드 복사"
                            >
                              <Mail size={12} /> 승인 메일
                            </button>
                          )
                        )}
                        {!isHq && (
                          <button
                            onClick={() => setSelectedOrgForPerm(o)}
                            className="px-2.5 py-1 text-xs font-semibold text-indigo-700 dark:text-indigo-300 bg-indigo-50 dark:bg-indigo-950/40 border border-indigo-200 dark:border-indigo-800 hover:bg-indigo-100 dark:hover:bg-indigo-900/60 rounded-lg flex items-center gap-1 transition-colors shadow-xs cursor-pointer"
                            title="광고비/정산 등 5대 기능 권한 및 라이선스 설정"
                          >
                            <Settings size={12} /> 권한 설정
                          </button>
                        )}
                        {!isHq && (
                          <button
                            onClick={() => copyInvoice(o)}
                            className="px-2.5 py-1 text-xs font-semibold text-gray-700 dark:text-gray-200 border border-gray-200 dark:border-gray-700 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg flex items-center gap-1 transition-colors shadow-xs"
                            title="공식 청구서 마크다운 복사"
                          >
                            <FileText size={12} /> 청구서 복사
                          </button>
                        )}
                        {!isHq && (
                          <button
                            onClick={() => toggleStatus(o)}
                            disabled={busy}
                            className={`px-2.5 py-1 rounded-lg text-xs font-semibold border flex items-center gap-1 transition-colors shadow-xs ${
                              o.status === 'active'
                                ? 'text-red-600 border-red-200 dark:border-red-900 hover:bg-red-50 dark:hover:bg-red-950/30'
                                : 'text-emerald-700 border-emerald-200 dark:border-emerald-900 hover:bg-emerald-50 dark:hover:bg-emerald-950/30'
                            }`}
                          >
                            {o.status === 'active' ? (
                              <><Ban size={12} /> 중지</>
                            ) : (
                              <><RotateCcw size={12} /> 재개</>
                            )}
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>
                );
              })}
              {!loading && orgs.length === 0 && (
                <tr>
                  <td colSpan={9} className="p-8 text-center text-gray-400">
                    등록된 고객 회사가 없습니다.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </section>

      {/* ⚙️ 테넌트별 5대 기능 권한 설정 모달 (광고비·정산 등) */}
      {selectedOrgForPerm && (
        <TenantPermissionModal
          isOpen={!!selectedOrgForPerm}
          onClose={() => setSelectedOrgForPerm(null)}
          org={selectedOrgForPerm}
          currentPermissions={permissionsMap[selectedOrgForPerm.id]}
          onSaved={(orgId, updated) => {
            setPermissionsMap(prev => ({
              ...prev,
              [orgId]: updated,
            }));
            showToast(`'${selectedOrgForPerm.name}' 기능 권한이 성공적으로 저장되었습니다.`, 'success');
          }}
        />
      )}

      {/* 📩 신규 가입 승인 검토 및 이메일 자동 발송 모달 */}
      <ApprovalEmailModal
        isOpen={isEmailModalOpen}
        onClose={() => {
          setIsEmailModalOpen(false);
          setEmailModalApp(null);
          setEmailModalDirect(null);
        }}
        application={emailModalApp}
        directCompany={emailModalDirect}
        onSuccess={() => {
          reload();
        }}
      />
    </div>
  );
}
