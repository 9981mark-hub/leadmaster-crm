import React, { useCallback, useEffect, useState } from 'react';
import { Building2, Plus, RefreshCw, Ban, RotateCcw, Copy } from 'lucide-react';
import { useAuth } from '../contexts/AuthContext';
import { useToast } from '../contexts/ToastContext';
import { PlatformOrg, createOrganization, fetchOrganizations, setOrganizationStatus } from '../services/platform';
import { HQ_ORG_ID } from '../services/org';

const fmtDate = (iso?: string) => (iso ? new Date(iso).toLocaleDateString('ko-KR') : '-');

/** HOST(플랫폼 관리자) 전용: 고객 회사 만들기·목록·사용 중지 */
export default function PlatformPage() {
  const { org } = useAuth();
  const { showToast } = useToast();
  const [orgs, setOrgs] = useState<PlatformOrg[]>([]);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [name, setName] = useState('');
  const [ownerEmail, setOwnerEmail] = useState('');

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

  if (!org?.isPlatformAdmin) {
    return <div className="p-6 text-gray-500">플랫폼 관리자만 볼 수 있는 화면입니다.</div>;
  }

  const handleCreate = async () => {
    if (busy) return;
    if (!window.confirm(`'${name.trim()}' 회사를 만들고 ${ownerEmail.trim()} 을(를) 대표로 초대할까요?`)) return;
    setBusy(true);
    try {
      await createOrganization(name, ownerEmail);
      showToast('회사를 만들었습니다. 대표가 그 구글 계정으로 로그인하면 자동으로 연결됩니다.', 'success');
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
      ? `'${o.name}' 회사를 사용 중지할까요?\n중지하면 그 회사 사람들은 로그인해도 데이터가 하나도 보이지 않습니다. (데이터는 지워지지 않음)`
      : `'${o.name}' 회사를 다시 사용하게 할까요?`;
    if (!window.confirm(msg)) return;
    setBusy(true);
    try {
      await setOrganizationStatus(o.id, next);
      showToast(next === 'suspended' ? '사용 중지했습니다.' : '다시 사용하게 했습니다.', 'success');
      await reload();
    } catch (e: any) {
      showToast(e.message, 'error');
    } finally {
      setBusy(false);
    }
  };

  const appUrl = `${window.location.origin}${window.location.pathname}`;
  const apkUrl = `${appUrl.replace(/\/$/, '')}/app/LeadMaster.apk`;
  const copy = (text: string) => navigator.clipboard.writeText(text).then(() => showToast('복사했습니다.', 'success'));

  return (
    <div className="max-w-5xl mx-auto p-4 md:p-6 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-800 dark:text-white flex items-center gap-2"><Building2 size={24} /> 회사 관리</h1>
          <p className="text-sm text-gray-500 mt-1">고객 회사를 만들고 대표를 초대합니다. HOST 계정에만 보이는 화면입니다.</p>
        </div>
        <button onClick={reload} className="px-3 py-2 border rounded text-sm flex items-center gap-1 hover:bg-gray-50">
          <RefreshCw size={14} className={loading ? 'animate-spin' : ''} /> 새로고침
        </button>
      </div>

      <section className="bg-white dark:bg-gray-800 rounded-xl border p-4 space-y-3">
        <h2 className="font-bold text-gray-700 dark:text-gray-200 flex items-center gap-2"><Plus size={16} /> 새 고객 회사</h2>
        <div className="grid md:grid-cols-3 gap-2">
          <input className="p-2 border rounded" placeholder="회사 이름 (예: ○○컨설팅)" value={name} onChange={e => setName(e.target.value)} />
          <input className="p-2 border rounded" placeholder="대표 구글 이메일" value={ownerEmail} onChange={e => setOwnerEmail(e.target.value)} />
          <button onClick={handleCreate} disabled={busy || !name.trim() || !ownerEmail.trim()}
            className="px-4 py-2 rounded bg-blue-600 text-white font-bold disabled:opacity-50">회사 만들기</button>
        </div>
        <p className="text-xs text-gray-400">
          대표가 아래 주소에서 그 구글 계정으로 로그인하면 바로 그 회사 관리자로 들어갑니다(초대 14일 유효).
          그다음 대표가 팀 관리에서 상담원을 초대하고, 텔레그램 봇과 거래처(변호사 사무실)를 등록합니다.
        </p>
        <div className="flex flex-wrap gap-2 text-xs">
          <button onClick={() => copy(appUrl)} className="px-2 py-1 border rounded flex items-center gap-1"><Copy size={12} /> 웹 주소 복사</button>
          <button onClick={() => copy(apkUrl)} className="px-2 py-1 border rounded flex items-center gap-1"><Copy size={12} /> 앱 설치 파일 주소 복사</button>
        </div>
      </section>

      <section className="bg-white dark:bg-gray-800 rounded-xl border overflow-x-auto">
        <table className="w-full text-sm">
          <thead className="bg-gray-50 dark:bg-gray-700 text-gray-500 text-left">
            <tr>
              <th className="p-3">회사</th>
              <th className="p-3">상태</th>
              <th className="p-3">대표 초대</th>
              <th className="p-3 text-right">멤버</th>
              <th className="p-3 text-right">리드</th>
              <th className="p-3">텔레그램 봇</th>
              <th className="p-3">만든 날</th>
              <th className="p-3"></th>
            </tr>
          </thead>
          <tbody>
            {orgs.map(o => (
              <tr key={o.id} className="border-t">
                <td className="p-3 font-medium">{o.name}{o.id === HQ_ORG_ID && <span className="ml-1 text-xs text-blue-600">본사</span>}</td>
                <td className="p-3">{o.status === 'active'
                  ? <span className="text-green-700">사용 중</span>
                  : <span className="text-red-600">중지됨</span>}</td>
                <td className="p-3 text-xs">{o.ownerInviteEmail
                  ? <>{o.ownerInviteEmail} · {o.ownerInviteAccepted ? <span className="text-green-700">가입함</span> : <span className="text-amber-600">대기</span>}</>
                  : '-'}</td>
                <td className="p-3 text-right">{o.activeMembers}/{o.members}</td>
                <td className="p-3 text-right">{o.cases.toLocaleString()}</td>
                <td className="p-3">{o.id === HQ_ORG_ID ? '기존 봇' : (o.hasTelegramBot ? '등록됨' : <span className="text-gray-400">없음</span>)}</td>
                <td className="p-3">{fmtDate(o.createdAt)}</td>
                <td className="p-3 text-right">
                  {o.id !== HQ_ORG_ID && (
                    <button onClick={() => toggleStatus(o)} disabled={busy}
                      className={`px-2 py-1 rounded text-xs border flex items-center gap-1 ${o.status === 'active' ? 'text-red-600 border-red-200' : 'text-green-700 border-green-200'}`}>
                      {o.status === 'active' ? <><Ban size={12} /> 사용 중지</> : <><RotateCcw size={12} /> 다시 사용</>}
                    </button>
                  )}
                </td>
              </tr>
            ))}
            {!loading && orgs.length === 0 && (
              <tr><td colSpan={8} className="p-6 text-center text-gray-400">회사가 없습니다.</td></tr>
            )}
          </tbody>
        </table>
      </section>
    </div>
  );
}
