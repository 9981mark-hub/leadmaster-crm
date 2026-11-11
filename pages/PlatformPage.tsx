import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  Building2, Plus, RefreshCw, Ban, RotateCcw, Copy,
  DollarSign, Users, TrendingUp, Server, FileText, CheckCircle2, Sparkles
} from 'lucide-react';
import { useAuth } from '../contexts/AuthContext';
import { useToast } from '../contexts/ToastContext';
import {
  PlatformOrg, createOrganization, fetchOrganizations, setOrganizationStatus,
  computeBillingSummary, generateOrgInvoiceMarkdown, PRICE_PER_AGENT_MONTH
} from '../services/platform';
import { HQ_ORG_ID } from '../services/org';

const fmtDate = (iso?: string) => (iso ? new Date(iso).toLocaleDateString('ko-KR') : '-');

/** HOST(플랫폼 관리자) 전용: 고객 회사 만들기·목록·실시간 과금 정산·사용 중지 관제 */
export default function PlatformPage() {
  const { org, isPlatformAdmin } = useAuth();
  const { showToast } = useToast();
  const [orgs, setOrgs] = useState<PlatformOrg[]>([]);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [name, setName] = useState('');
  const [ownerEmail, setOwnerEmail] = useState('');
  const [applyTmPreset, setApplyTmPreset] = useState(true);

  const reload = useCallback(async () => {
    setLoading(true);
    try {
      setOrgs(await fetchOrganizations());
    } catch (e: any) {
      showToast(`회사 목록을 불러오지 못했습니다: ${e.message}`, 'error');
    } finally {
      setLoading(false);
    }
  }, [showToast]);

  useEffect(() => { reload(); }, [reload]);

  const billingSummary = useMemo(() => computeBillingSummary(orgs), [orgs]);

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
    <div className="max-w-7xl mx-auto space-y-6 pb-12">
      {/* Title Bar */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 dark:text-white flex items-center gap-2.5">
            <Building2 className="text-blue-600 dark:text-blue-400" size={26} />
            플랫폼 과금 및 회사 관제 센터
          </h1>
          <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">
            고객사별 활성 상담원 과금(₩48,000/인) 현황, 서버 원가 마진율 및 테넌트 라이프사이클을 총괄합니다.
          </p>
        </div>
        <button
          onClick={reload}
          className="px-3.5 py-2 border border-gray-200 dark:border-gray-700 rounded-xl text-sm font-semibold flex items-center gap-1.5 hover:bg-gray-50 dark:hover:bg-gray-800 transition-colors"
        >
          <RefreshCw size={14} className={loading ? 'animate-spin' : ''} /> 새로고침
        </button>
      </div>

      {/* 4대 핵심 재무 & 인프라 KPI 카드 */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {/* KPI 1 */}
        <div className="bg-white dark:bg-gray-800 p-5 rounded-2xl border border-gray-200/80 dark:border-gray-700/80 shadow-sm">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold text-gray-500 uppercase tracking-wider">유료 고객사</span>
            <div className="p-2 bg-blue-50 dark:bg-blue-950/40 rounded-xl text-blue-600 dark:text-blue-400">
              <Building2 size={18} />
            </div>
          </div>
          <div className="mt-2 flex items-baseline gap-2">
            <span className="text-2xl font-black text-gray-900 dark:text-white">
              {billingSummary.activeOrgs}
            </span>
            <span className="text-xs text-gray-400">/ 총 {billingSummary.totalOrgs}개사</span>
          </div>
          <div className="mt-2 text-xs text-emerald-600 dark:text-emerald-400 font-semibold flex items-center gap-1">
            <CheckCircle2 size={13} /> {billingSummary.activeOrgs > 0 ? '정상 서비스 가동 중' : '첫 고객사 유치 대기'}
          </div>
        </div>

        {/* KPI 2 */}
        <div className="bg-white dark:bg-gray-800 p-5 rounded-2xl border border-gray-200/80 dark:border-gray-700/80 shadow-sm">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold text-gray-500 uppercase tracking-wider">과금 상담원 (합계)</span>
            <div className="p-2 bg-indigo-50 dark:bg-indigo-950/40 rounded-xl text-indigo-600 dark:text-indigo-400">
              <Users size={18} />
            </div>
          </div>
          <div className="mt-2 flex items-baseline gap-2">
            <span className="text-2xl font-black text-gray-900 dark:text-white">
              {billingSummary.totalSeats}
            </span>
            <span className="text-xs text-gray-400">석 (활성 계정)</span>
          </div>
          <div className="mt-2 text-xs text-gray-500">
            좌석당 단가: <span className="font-semibold text-gray-800 dark:text-gray-200">₩48,000 / 월</span>
          </div>
        </div>

        {/* KPI 3 */}
        <div className="bg-white dark:bg-gray-800 p-5 rounded-2xl border border-gray-200/80 dark:border-gray-700/80 shadow-sm">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold text-gray-500 uppercase tracking-wider">당월 총 예상 매출</span>
            <div className="p-2 bg-emerald-50 dark:bg-emerald-950/40 rounded-xl text-emerald-600 dark:text-emerald-400">
              <DollarSign size={18} />
            </div>
          </div>
          <div className="mt-2 flex items-baseline gap-1">
            <span className="text-2xl font-black text-emerald-600 dark:text-emerald-400">
              ₩{billingSummary.totalMonthlyRevenue.toLocaleString()}
            </span>
          </div>
          <div className="mt-2 text-xs text-gray-500">
            VAT 별도 공급가액 기준
          </div>
        </div>

        {/* KPI 4 */}
        <div className="bg-white dark:bg-gray-800 p-5 rounded-2xl border border-gray-200/80 dark:border-gray-700/80 shadow-sm">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold text-gray-500 uppercase tracking-wider">인프라 원가 & 순마진</span>
            <div className="p-2 bg-amber-50 dark:bg-amber-950/40 rounded-xl text-amber-600 dark:text-amber-400">
              <TrendingUp size={18} />
            </div>
          </div>
          <div className="mt-2 flex items-baseline gap-2">
            <span className="text-xl font-black text-gray-900 dark:text-white">
              ₩{billingSummary.netMargin.toLocaleString()}
            </span>
            <span className="text-xs font-bold text-emerald-600 dark:text-emerald-400">
              ({billingSummary.marginPercent}%)
            </span>
          </div>
          <div className="mt-2 text-xs text-gray-500 flex items-center gap-1">
            <Server size={12} /> Pro 인프라 비용: ₩{billingSummary.estimatedInfraCost.toLocaleString()}/월
          </div>
        </div>
      </div>

      {/* 새 고객 회사 등록 폼 (TM 표준 프리셋 원클릭 지원) */}
      <section className="bg-white dark:bg-gray-800 rounded-2xl border border-gray-200/80 dark:border-gray-700/80 p-5 space-y-4 shadow-sm">
        <div className="flex items-center justify-between">
          <h2 className="font-bold text-gray-800 dark:text-gray-200 flex items-center gap-2">
            <Plus size={18} className="text-blue-600 dark:text-blue-400" /> 신규 고객 회사 등록 (테넌트 생성)
          </h2>
          <span className="text-xs text-blue-600 dark:text-blue-400 font-semibold flex items-center gap-1">
            <Sparkles size={14} /> TM 사무실 실무 프리셋 자동 주입 지원
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

        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pt-1 border-t border-gray-100 dark:border-gray-750">
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
      <section className="bg-white dark:bg-gray-800 rounded-2xl border border-gray-200/80 dark:border-gray-700/80 overflow-hidden shadow-sm">
        <div className="px-5 py-3.5 border-b border-gray-100 dark:border-gray-700 bg-gray-50/50 dark:bg-gray-750 flex items-center justify-between">
          <h3 className="font-bold text-gray-900 dark:text-white text-sm">
            고객사 테넌트 목록 및 월간 청구 현황 ({orgs.length}개사)
          </h3>
          <span className="text-xs text-gray-500">
            * 청구서 복사 버튼으로 정산용 공식 마크다운 서식을 바로 추출할 수 있습니다.
          </span>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-gray-50/80 dark:bg-gray-700/50 text-gray-500 dark:text-gray-400 text-left border-b border-gray-100 dark:border-gray-700">
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
                const monthlyBill = isHq ? 0 : o.activeMembers * PRICE_PER_AGENT_MONTH;

                return (
                  <tr key={o.id} className="hover:bg-gray-50/50 dark:hover:bg-gray-750/30 transition-colors">
                    <td className="p-3.5 font-medium text-gray-900 dark:text-white">
                      {o.name}
                      {isHq && (
                        <span className="ml-2 px-1.5 py-0.5 text-[10px] font-bold text-blue-700 dark:text-blue-300 bg-blue-100 dark:bg-blue-900/40 rounded">
                          본사(면제)
                        </span>
                      )}
                    </td>
                    <td className="p-3.5">
                      {o.status === 'active' ? (
                        <span className="inline-flex items-center gap-1 text-xs font-bold text-emerald-700 dark:text-emerald-400 bg-emerald-50 dark:bg-emerald-950/40 px-2 py-0.5 rounded-md">
                          <CheckCircle2 size={12} /> 정상 가동
                        </span>
                      ) : (
                        <span className="inline-flex items-center gap-1 text-xs font-bold text-red-600 dark:text-red-400 bg-red-50 dark:bg-red-950/40 px-2 py-0.5 rounded-md">
                          <Ban size={12} /> 사용 중지
                        </span>
                      )}
                    </td>
                    <td className="p-3.5 text-xs text-gray-600 dark:text-gray-300">
                      {o.ownerInviteEmail ? (
                        <div>
                          <div className="font-mono">{o.ownerInviteEmail}</div>
                          <div className="mt-0.5 text-[11px]">
                            {o.ownerInviteAccepted ? (
                              <span className="text-emerald-600 dark:text-emerald-400 font-semibold">가입 완료</span>
                            ) : (
                              <span className="text-amber-600 dark:text-amber-400 font-semibold">초대 수락 대기</span>
                            )}
                          </div>
                        </div>
                      ) : (
                        '-'
                      )}
                    </td>
                    <td className="p-3.5 text-right font-mono text-gray-900 dark:text-gray-100">
                      <span className="font-bold text-blue-600 dark:text-blue-400">{o.activeMembers}</span> / {o.members}명
                    </td>
                    <td className="p-3.5 text-right font-mono font-bold">
                      {isHq ? (
                        <span className="text-gray-400 text-xs">본사 운영</span>
                      ) : (
                        <span className="text-gray-900 dark:text-white">
                          ₩{monthlyBill.toLocaleString()}
                        </span>
                      )}
                    </td>
                    <td className="p-3.5 text-right font-mono text-gray-700 dark:text-gray-300">
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
                    <td className="p-3.5 text-xs text-gray-500 font-mono">
                      {fmtDate(o.createdAt)}
                    </td>
                    <td className="p-3.5 text-right">
                      <div className="flex items-center justify-end gap-1.5">
                        {!isHq && (
                          <button
                            onClick={() => copyInvoice(o)}
                            className="px-2.5 py-1 text-xs font-semibold text-gray-700 dark:text-gray-200 border border-gray-200 dark:border-gray-700 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg flex items-center gap-1 transition-colors"
                            title="공식 청구서 마크다운 복사"
                          >
                            <FileText size={12} /> 청구서 복사
                          </button>
                        )}
                        {!isHq && (
                          <button
                            onClick={() => toggleStatus(o)}
                            disabled={busy}
                            className={`px-2.5 py-1 rounded-lg text-xs font-semibold border flex items-center gap-1 transition-colors ${
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
    </div>
  );
}
