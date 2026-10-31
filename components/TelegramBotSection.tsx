import React, { useCallback, useEffect, useState } from 'react';
import { Send, RefreshCw, CheckCircle2, AlertTriangle, Link2 } from 'lucide-react';
import { useToast } from '../contexts/ToastContext';
import { HQ_ORG_ID } from '../services/org';
import {
  TelegramBotDbStatus, TelegramBotLiveStatus, fetchTelegramBotDbStatus, fetchTelegramBotLiveStatus,
  saveTelegramBotToken, saveTelegramOwnSenders, registerTelegramWebhook,
} from '../services/telegramBot';

/** 팀 관리 화면의 "텔레그램 봇 연결" 영역 (관리자 전용) */
export default function TelegramBotSection({ orgId }: { orgId: string }) {
  const { showToast } = useToast();
  const isHq = orgId === HQ_ORG_ID;
  const [db, setDb] = useState<TelegramBotDbStatus | null>(null);
  const [live, setLive] = useState<TelegramBotLiveStatus | null>(null);
  const [liveError, setLiveError] = useState<string | null>(null);
  const [token, setToken] = useState('');
  const [senders, setSenders] = useState('');
  const [busy, setBusy] = useState(false);

  const load = useCallback(async () => {
    let hasBot = false;
    try {
      const s = await fetchTelegramBotDbStatus();
      setDb(s);
      hasBot = !!s?.hasBot;
      setSenders((s?.ownSenderNames || []).join(', ') || (isHq ? 'markjin, 마크진' : ''));
    } catch (e: any) {
      setDb(null);
    }
    if (isHq || hasBot) {
      try { setLive(await fetchTelegramBotLiveStatus()); setLiveError(null); }
      catch (e: any) { setLive(null); setLiveError(e.message); }
    }
  }, [isHq]);

  useEffect(() => { load(); }, [load]);

  const checkLive = async () => {
    setBusy(true);
    try { setLive(await fetchTelegramBotLiveStatus()); setLiveError(null); }
    catch (e: any) { setLive(null); setLiveError(e.message); }
    finally { setBusy(false); }
  };

  const handleSaveToken = async () => {
    setBusy(true);
    try {
      await saveTelegramBotToken(token, senders.split(',').map(s => s.trim()).filter(Boolean));
      setToken('');
      const name = await registerTelegramWebhook();
      showToast(`봇 연결 완료${name ? `: @${name}` : ''}. 이제 변호사 사무실 방에 이 봇을 초대하세요.`, 'success');
      await load();
      await checkLive();
    } catch (e: any) {
      showToast(`봇 연결 실패: ${e.message}`, 'error');
    } finally {
      setBusy(false);
    }
  };

  const handleSaveSenders = async () => {
    setBusy(true);
    try {
      await saveTelegramOwnSenders(senders.split(',').map(s => s.trim()).filter(Boolean));
      showToast('저장했습니다', 'success');
      await load();
    } catch (e: any) {
      showToast(`저장 실패: ${e.message}`, 'error');
    } finally {
      setBusy(false);
    }
  };

  const handleReRegister = async () => {
    setBusy(true);
    try {
      await registerTelegramWebhook();
      showToast('웹훅을 다시 연결했습니다', 'success');
      await checkLive();
    } catch (e: any) {
      showToast(`다시 연결 실패: ${e.message}`, 'error');
    } finally {
      setBusy(false);
    }
  };

  return (
    <section className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 shadow-sm">
      <div className="px-5 py-4 border-b border-gray-100 dark:border-gray-700 flex items-center gap-2">
        <Send size={18} className="text-sky-600" />
        <h2 className="font-bold text-gray-800 dark:text-white">텔레그램 봇 연결</h2>
        <span className="text-xs text-gray-400">변호사 사무실 방의 피드백을 이 회사 리드에만 연결합니다</span>
        <button onClick={checkLive} disabled={busy} className="ml-auto text-xs flex items-center gap-1 text-gray-500 hover:text-gray-800 dark:hover:text-gray-200">
          <RefreshCw size={14} className={busy ? 'animate-spin' : ''} /> 상태 확인
        </button>
      </div>

      <div className="p-5 space-y-4 text-sm">
        {/* 현재 상태 */}
        <div className="flex flex-wrap items-center gap-3">
          {live?.webhookConnected ? (
            <span className="flex items-center gap-1 text-green-700 dark:text-green-400 font-semibold"><CheckCircle2 size={16} /> 연결됨{live.botUsername ? ` (@${live.botUsername})` : ''}</span>
          ) : (isHq || db?.hasBot) ? (
            <span className="flex items-center gap-1 text-orange-600 font-semibold"><AlertTriangle size={16} /> {liveError ? `확인 불가: ${liveError}` : '웹훅 미연결'}</span>
          ) : (
            <span className="flex items-center gap-1 text-gray-500"><AlertTriangle size={16} /> 아직 봇이 없습니다</span>
          )}
          {isHq && <span className="text-xs text-gray-400">본사는 기존 봇(서버 설정)을 사용합니다</span>}
          {db?.tokenTail && <span className="text-xs text-gray-400">저장된 토큰 ****{db.tokenTail}</span>}
          {live?.lastError && <span className="text-xs text-red-500">최근 오류: {live.lastError}</span>}
          {(isHq || db?.hasBot) && !live?.webhookConnected && (
            <button onClick={handleReRegister} disabled={busy}
              className="px-3 py-1 text-xs font-bold text-white bg-sky-600 rounded hover:bg-sky-700 disabled:opacity-50 flex items-center gap-1">
              <Link2 size={12} /> 웹훅 다시 연결
            </button>
          )}
        </div>

        {/* 토큰 등록 (본사 제외) */}
        {!isHq && (
          <div className="space-y-2">
            <label className="font-semibold text-gray-700 dark:text-gray-200">{db?.hasBot ? '봇 토큰 교체' : '봇 토큰 등록'}</label>
            <div className="flex flex-wrap gap-2">
              <input type="password" value={token} onChange={e => setToken(e.target.value)} placeholder="BotFather가 준 토큰 (123456789:ABC...)"
                autoComplete="off"
                className="flex-1 min-w-[260px] border border-gray-300 dark:border-gray-600 rounded-lg px-3 py-2 dark:bg-gray-700 dark:text-white" />
              <button onClick={handleSaveToken} disabled={busy || !token.trim()}
                className="px-4 py-2 font-bold text-white bg-sky-600 rounded-lg hover:bg-sky-700 disabled:opacity-50">저장하고 연결</button>
            </div>
            <ol className="text-xs text-gray-500 list-decimal ml-4 space-y-0.5">
              <li>텔레그램에서 <b>@BotFather</b>를 열고 <b>/newbot</b> → 봇 이름 입력 → 받은 토큰을 위 칸에 붙여넣습니다.</li>
              <li>"저장하고 연결"을 누르면 이 회사 전용 웹훅이 자동으로 연결됩니다.</li>
              <li>변호사 사무실 텔레그램 방 관리자에게 이 봇을 <b>방에 초대</b>해 달라고 요청합니다.</li>
              <li>BotFather에서 <b>/setprivacy</b> → 봇 선택 → <b>Disable</b> 로 바꿔야 방의 모든 메시지를 받을 수 있습니다.</li>
            </ol>
          </div>
        )}

        {/* 우리 쪽 발신자 */}
        {(isHq ? true : db?.hasBot) && (
          <div className="space-y-2">
            <label className="font-semibold text-gray-700 dark:text-gray-200">우리 쪽 발신자 이름 (수집 제외)</label>
            <div className="flex flex-wrap gap-2">
              <input value={senders} onChange={e => setSenders(e.target.value)} placeholder="예: 홍길동, 김실장 (쉼표로 구분)"
                disabled={isHq}
                className="flex-1 min-w-[260px] border border-gray-300 dark:border-gray-600 rounded-lg px-3 py-2 dark:bg-gray-700 dark:text-white disabled:opacity-60" />
              {!isHq && (
                <button onClick={handleSaveSenders} disabled={busy}
                  className="px-4 py-2 font-bold text-gray-700 dark:text-gray-200 border border-gray-300 dark:border-gray-600 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-700 disabled:opacity-50">저장</button>
              )}
            </div>
            <p className="text-xs text-gray-500">
              이 이름의 텔레그램 계정이 방에 쓴 글은 변호사 사무실 피드백으로 저장하지 않습니다 (우리 직원이 보낸 리포트·안내 등).
              {isHq && ' 본사는 기존 설정("markjin, 마크진")을 그대로 씁니다.'}
            </p>
          </div>
        )}
      </div>
    </section>
  );
}
