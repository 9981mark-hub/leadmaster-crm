import React, { useEffect, useMemo, useRef, useState } from 'react';
import { Link, Navigate, useNavigate, useSearchParams } from 'react-router-dom';
import { useQueryClient } from '@tanstack/react-query';
import { PhoneCall, ArrowRight, Plus, AlertTriangle, Loader2 } from 'lucide-react';
import { useCases, usePartners, useInboundPaths, QUERY_KEYS } from '../services/queries';
import { createCase } from '../services/api';
import { CASE_TYPES, formatPhone } from '../constants';
import { checkIsDuplicate } from '../utils';
import { useToast } from '../contexts/ToastContext';
import { Case, MemoItem } from '../types';

const LAST_KEY = 'lm_quicknew_last'; // 마지막에 고른 거래처·유입경로·유형

/**
 * 새 리드 등록 (빠른 접수)
 * [2026-11-01] 번호 → 이름 → 거래처만 넣고 바로 상담 화면으로. 나머지는 상담 화면에서 순서대로 채운다.
 * 예전 전체 입력 화면은 /new/full 에 남겨 둔다.
 * 신규 리드 목록에서 들어오던 /new?leadId= 는 상담 화면으로 보낸다.
 */
export default function QuickNewCase() {
  const [params] = useSearchParams();
  const leadId = params.get('leadId');
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const { showToast } = useToast();
  const { data: cases = [] } = useCases();
  const { data: partners = [] } = usePartners();
  const { data: inboundPaths = [] } = useInboundPaths();

  const last = useMemo(() => { try { return JSON.parse(localStorage.getItem(LAST_KEY) || '{}'); } catch { return {}; } }, []);
  const [phone, setPhone] = useState('');
  const [name, setName] = useState('');
  const [partnerId, setPartnerId] = useState<string>(last.partnerId || '');
  const [caseType, setCaseType] = useState<string>(last.caseType || '개인회생');
  const [inboundPath, setInboundPath] = useState<string>(last.inboundPath || '');
  const [preInfo, setPreInfo] = useState('');
  const [memo, setMemo] = useState('');
  const [allowDup, setAllowDup] = useState(false);
  const [saving, setSaving] = useState(false);
  const [tried, setTried] = useState(false);
  const phoneRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (!partnerId && partners.length > 0) setPartnerId(partners[0].partnerId);
  }, [partners, partnerId]);
  useEffect(() => { phoneRef.current?.focus(); }, []);

  const digits = phone.replace(/[^0-9]/g, '');
  const phoneOk = /^0\d{8,10}$/.test(digits);
  const dup = useMemo(() => (digits.length >= 9 ? checkIsDuplicate(phone, cases as Case[]) : undefined), [digits, phone, cases]);
  const nameOk = name.trim().length > 0;
  const canSave = phoneOk && nameOk && (!dup || allowDup) && !saving;

  if (leadId) return <Navigate to={`/case/${leadId}`} replace />;

  const submit = async (next: 'open' | 'another') => {
    setTried(true);
    if (!canSave) return;
    setSaving(true);
    try {
      const memoItems: MemoItem[] = memo.trim() ? [{ id: Date.now().toString(), createdAt: new Date().toISOString(), content: memo.trim() }] : [];
      const created = await createCase({
        customerName: name.trim(),
        phone: formatPhone(digits),
        partnerId,
        caseType,
        inboundPath,
        preInfo: preInfo.trim(),
        specialMemo: memoItems,
        managerName: localStorage.getItem('managerName') || '',
        isNew: false,
        isViewed: true,
      } as Partial<Case>);
      localStorage.setItem(LAST_KEY, JSON.stringify({ partnerId, caseType, inboundPath }));
      queryClient.invalidateQueries({ queryKey: QUERY_KEYS.cases });
      if (next === 'open') {
        navigate(`/case/${created.caseId}`);
      } else {
        showToast(`${created.customerName}님을 등록했습니다. 다음 리드를 입력하세요.`);
        setPhone(''); setName(''); setPreInfo(''); setMemo(''); setAllowDup(false); setTried(false);
        phoneRef.current?.focus();
      }
    } catch (e: any) {
      showToast(`등록하지 못했습니다: ${e?.message || '알 수 없는 오류'}`, 'error');
    } finally {
      setSaving(false);
    }
  };

  const onKey = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && (e.ctrlKey || e.metaKey)) { e.preventDefault(); submit('open'); }
  };

  const field = 'w-full h-11 px-3 rounded-xl border border-slate-300 dark:border-gray-600 bg-white dark:bg-gray-800 text-slate-900 dark:text-gray-100 outline-none focus:border-blue-600 focus:ring-2 focus:ring-blue-600/15';
  const label = 'block text-sm font-semibold text-slate-700 dark:text-gray-200 mb-1.5';

  return (
    <div className="max-w-2xl mx-auto pb-24" onKeyDown={onKey}>
      <header className="mb-6">
        <h1 className="text-2xl font-extrabold tracking-tight text-slate-900 dark:text-white">새 리드 등록</h1>
        <p className="text-sm text-slate-500 mt-1">번호와 이름만 넣고 바로 상담을 시작하세요. 직업·소득·채무는 상담 화면에서 순서대로 채웁니다.</p>
      </header>

      <div className="bg-white dark:bg-gray-800 rounded-2xl border border-slate-200 dark:border-gray-700 p-5 md:p-6 space-y-5">
        <div className="grid md:grid-cols-2 gap-4">
          <div>
            <label className={label} htmlFor="qn-phone">연락처 <span className="text-red-600">*</span></label>
            <input id="qn-phone" ref={phoneRef} inputMode="tel" autoComplete="off" value={phone}
              onChange={e => { setPhone(formatPhone(e.target.value)); setAllowDup(false); }}
              placeholder="010-0000-0000" className={`${field} text-lg tabular-nums ${tried && !phoneOk ? 'border-red-400' : ''}`} />
            {tried && !phoneOk && <p className="text-xs text-red-600 mt-1">전화번호를 끝까지 넣어 주세요 (예: 010-1234-5678)</p>}
          </div>
          <div>
            <label className={label} htmlFor="qn-name">이름 <span className="text-red-600">*</span></label>
            <input id="qn-name" autoComplete="off" value={name} onChange={e => setName(e.target.value)}
              placeholder="모르면 '미상'" className={`${field} text-lg ${tried && !nameOk ? 'border-red-400' : ''}`} />
            {tried && !nameOk && <p className="text-xs text-red-600 mt-1">이름을 넣어 주세요. 모르면 '미상'이라고 적으세요.</p>}
          </div>
        </div>

        {dup && (
          <div className="rounded-xl border border-red-200 bg-red-50 dark:bg-red-900/20 dark:border-red-800 p-3 text-sm">
            <div className="flex items-start gap-2 text-red-800 dark:text-red-200">
              <AlertTriangle size={16} className="mt-0.5 shrink-0" />
              <div className="flex-1">
                <b>이미 있는 번호입니다.</b> {dup.customerName} · {dup.status}{dup.managerName ? ` · 담당 ${dup.managerName}` : ''}
                <div className="mt-2 flex flex-wrap items-center gap-3">
                  <Link to={`/case/${dup.caseId}`} className="h-8 px-3 rounded-lg bg-red-700 text-white font-semibold inline-flex items-center gap-1">그 리드 열기 <ArrowRight size={14} /></Link>
                  <label className="flex items-center gap-1.5 text-red-900 dark:text-red-200">
                    <input type="checkbox" checked={allowDup} onChange={e => setAllowDup(e.target.checked)} /> 그래도 새로 등록
                  </label>
                </div>
              </div>
            </div>
          </div>
        )}

        <div className="grid md:grid-cols-2 gap-4">
          <div>
            <label className={label} htmlFor="qn-partner">받는 사무실</label>
            <select id="qn-partner" value={partnerId} onChange={e => setPartnerId(e.target.value)} className={field}>
              <option value="">미정</option>
              {partners.map(p => <option key={p.partnerId} value={p.partnerId}>{p.name}</option>)}
            </select>
          </div>
          <div>
            <label className={label} htmlFor="qn-inbound">유입 경로</label>
            <select id="qn-inbound" value={inboundPath} onChange={e => setInboundPath(e.target.value)} className={field}>
              <option value="">선택</option>
              {inboundPaths.map(p => <option key={p} value={p}>{p}</option>)}
            </select>
          </div>
        </div>

        <div>
          <span className={label}>사건 유형</span>
          <div className="grid grid-cols-4 gap-2">
            {CASE_TYPES.map(t => (
              <button key={t} type="button" onClick={() => setCaseType(t)}
                className={`h-10 rounded-xl text-sm font-semibold border transition-colors ${caseType === t ? 'bg-slate-900 text-white border-slate-900 dark:bg-white dark:text-slate-900' : 'bg-white dark:bg-gray-800 border-slate-300 dark:border-gray-600 text-slate-700 dark:text-gray-200 hover:bg-slate-50'}`}>
                {t}
              </button>
            ))}
          </div>
        </div>

        <details className="group">
          <summary className="cursor-pointer text-sm font-semibold text-slate-600 dark:text-gray-300 select-none">사전 정보 · 첫 메모 (선택)</summary>
          <div className="mt-3 grid md:grid-cols-2 gap-4">
            <div>
              <label className={label} htmlFor="qn-pre">사전 정보</label>
              <textarea id="qn-pre" rows={4} value={preInfo} onChange={e => setPreInfo(e.target.value)} placeholder="광고 신청서 내용 등" className={`${field} h-auto py-2 text-sm`} />
            </div>
            <div>
              <label className={label} htmlFor="qn-memo">첫 상담 메모</label>
              <textarea id="qn-memo" rows={4} value={memo} onChange={e => setMemo(e.target.value)} placeholder="통화하며 들은 내용" className={`${field} h-auto py-2 text-sm`} />
            </div>
          </div>
        </details>

        <div className="flex flex-col sm:flex-row gap-2 pt-1">
          <button type="button" onClick={() => submit('open')} disabled={saving}
            className="flex-1 h-12 rounded-xl bg-slate-900 hover:bg-slate-800 text-white font-bold flex items-center justify-center gap-2 disabled:opacity-50">
            {saving ? <Loader2 size={18} className="animate-spin" /> : <PhoneCall size={18} />} 등록하고 상담 시작
          </button>
          <button type="button" onClick={() => submit('another')} disabled={saving}
            className="h-12 px-5 rounded-xl border border-slate-300 dark:border-gray-600 text-slate-700 dark:text-gray-200 font-semibold flex items-center justify-center gap-1.5 hover:bg-slate-50 dark:hover:bg-gray-700 disabled:opacity-50">
            <Plus size={16} /> 등록하고 다음 리드
          </button>
        </div>
        <p className="text-xs text-slate-400">Ctrl+Enter = 등록하고 상담 시작 · 여러 건은 케이스 목록의 업로드나 팀 관리 → 수신동의 DB 업로드를 쓰세요 · <Link to="/new/full" className="underline">예전 전체 입력 화면</Link></p>
      </div>
    </div>
  );
}
