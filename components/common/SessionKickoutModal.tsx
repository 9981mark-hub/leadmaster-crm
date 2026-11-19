import React, { useState, useEffect } from 'react';
import { ShieldAlert, LogOut, ArrowRight, Monitor, Smartphone } from 'lucide-react';
import { KickoutEvent } from '../../services/sessionGuard';

interface SessionKickoutModalProps {
  event: KickoutEvent | null;
  onConfirm: () => void;
}

export default function SessionKickoutModal({ event, onConfirm }: SessionKickoutModalProps) {
  const [countdown, setCountdown] = useState(5);

  useEffect(() => {
    if (!event) {
      setCountdown(5);
      return;
    }

    const timer = setInterval(() => {
      setCountdown((prev) => {
        if (prev <= 1) {
          clearInterval(timer);
          onConfirm();
          return 0;
        }
        return prev - 1;
      });
    }, 1000);

    return () => clearInterval(timer);
  }, [event, onConfirm]);

  if (!event) return null;

  const isWeb = event.platform === 'web';
  const timeStr = new Date(event.timestamp).toLocaleTimeString('ko-KR', {
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
  });

  return (
    <div className="fixed inset-0 z-[9999] bg-slate-50/90 dark:bg-slate-950/90 backdrop-blur-md flex items-center justify-center p-4 animate-in fade-in duration-200">
      <div 
        className="w-full max-w-md bg-white dark:bg-slate-900 border border-rose-200 dark:border-rose-900/60 rounded-3xl p-6 sm:p-8 shadow-2xl space-y-6 text-center text-slate-900 dark:text-slate-100"
        role="alertdialog"
        aria-modal="true"
      >
        {/* 경고 아이콘 */}
        <div className="w-16 h-16 rounded-3xl bg-rose-50 dark:bg-rose-950/50 border border-rose-200 dark:border-rose-800/80 flex items-center justify-center mx-auto text-rose-600 dark:text-rose-400 shadow-inner">
          <ShieldAlert size={34} />
        </div>

        {/* 텍스트 안내 */}
        <div className="space-y-2">
          <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold bg-rose-100 dark:bg-rose-950/80 text-rose-700 dark:text-rose-300 border border-rose-300 dark:border-rose-800">
            {isWeb ? <Monitor size={13} /> : <Smartphone size={13} />}
            <span>{isWeb ? 'PC 웹 브라우저 중복 접속' : '스마트폰 앱 중복 접속'}</span>
          </span>
          <h3 className="text-xl font-black text-gray-900 dark:text-white tracking-tight">
            다른 기기에서 로그인되었습니다
          </h3>
          <p className="text-xs sm:text-sm text-gray-600 dark:text-slate-300 leading-relaxed max-w-sm mx-auto">
            동일한 계정으로 다른 {isWeb ? 'PC(또는 브라우저)' : '스마트폰'}에서 새로 로그인이 발생하여, 
            사내 보안 및 라이선스 정책에 따라 현재 기기의 세션이 안전하게 종료되었습니다.
          </p>
        </div>

        {/* 안내 카드 */}
        <div className="bg-gray-50 dark:bg-slate-950/60 p-4 rounded-2xl border border-gray-200 dark:border-slate-800 text-left text-xs text-gray-500 dark:text-slate-400 space-y-1.5">
          <div className="flex justify-between">
            <span>신규 로그인 시각:</span>
            <span className="text-gray-800 dark:text-slate-200 font-mono font-bold">{timeStr}</span>
          </div>
          <div className="flex justify-between">
            <span>세션 상태:</span>
            <span className="text-rose-600 dark:text-rose-400 font-bold">강제 만료 처리됨</span>
          </div>
          <div className="pt-2 border-t border-gray-200 dark:border-slate-800/80 text-xs text-gray-500 dark:text-slate-400 leading-normal">
            💡 리드마스터는 1계정당 <b>[PC 웹 1대 + 폰 1대]</b>의 정상 페어링 사용을 지원하며, 
            동종 기기 간(PC-PC 또는 폰-폰) 동시 접속은 엄격히 차단됩니다.
          </div>
        </div>

        {/* 액션 버튼 */}
        <div className="space-y-2 pt-1">
          <button
            type="button"
            onClick={onConfirm}
            className="w-full py-3.5 rounded-xl bg-rose-600 hover:bg-rose-500 text-white font-bold text-sm shadow-lg shadow-rose-600/25 flex items-center justify-center gap-2 transition-all cursor-pointer active:scale-98"
          >
            <LogOut size={16} />
            <span>로그인 화면으로 이동 ({countdown}초)</span>
            <ArrowRight size={14} />
          </button>
        </div>
      </div>
    </div>
  );
}
