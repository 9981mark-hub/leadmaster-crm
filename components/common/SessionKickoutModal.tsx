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
    <div className="fixed inset-0 z-[9999] bg-background/80 backdrop-blur-xs flex items-center justify-center p-3 sm:p-5 animate-in fade-in duration-200 overflow-y-auto">
      <div 
        className="relative w-full max-w-md max-h-[88vh] my-auto bg-card border border-destructive/60 rounded-2xl p-6 sm:p-8 shadow-2xl space-y-6 text-center text-card-foreground flex flex-col overflow-y-auto custom-scrollbar"
        role="alertdialog"
        aria-modal="true"
      >
        {/* 경고 아이콘 */}
        <div className="w-14 h-14 rounded-2xl bg-destructive/10 border border-destructive/20 flex items-center justify-center mx-auto text-destructive shadow-2xs">
          <ShieldAlert size={30} />
        </div>

        {/* 텍스트 안내 */}
        <div className="space-y-2">
          <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold bg-destructive/10 text-destructive border border-destructive/20">
            {isWeb ? <Monitor size={13} /> : <Smartphone size={13} />}
            <span>{isWeb ? 'PC 웹 브라우저 중복 접속' : '스마트폰 앱 중복 접속'}</span>
          </span>
          <h3 className="text-lg font-bold text-foreground tracking-tight">
            다른 기기에서 로그인되었습니다
          </h3>
          <p className="text-xs text-muted-foreground leading-relaxed max-w-sm mx-auto">
            동일한 계정으로 다른 {isWeb ? 'PC(또는 브라우저)' : '스마트폰'}에서 새로 로그인이 발생하여, 
            사내 보안 및 라이선스 정책에 따라 현재 기기의 세션이 안전하게 종료되었습니다.
          </p>
        </div>

        {/* 안내 카드 */}
        <div className="bg-secondary/40 p-4 rounded-xl border border-border text-left text-xs text-muted-foreground space-y-1.5">
          <div className="flex justify-between">
            <span>신규 로그인 시각:</span>
            <span className="text-foreground font-mono font-bold">{timeStr}</span>
          </div>
          <div className="flex justify-between">
            <span>세션 상태:</span>
            <span className="text-destructive font-bold">강제 만료 처리됨</span>
          </div>
          <div className="pt-2 border-t border-border text-xs text-muted-foreground leading-normal">
            💡 리드마스터는 1계정당 <b>[PC 웹 1대 + 폰 1대]</b>의 정상 페어링 사용을 지원하며, 
            동종 기기 간(PC-PC 또는 폰-폰) 동시 접속은 엄격히 차단됩니다.
          </div>
        </div>

        {/* 액션 버튼 */}
        <div className="space-y-2 pt-1">
          <button
            type="button"
            onClick={onConfirm}
            className="w-full py-3 rounded-xl bg-destructive hover:bg-destructive/90 text-destructive-foreground font-bold text-xs sm:text-sm shadow-2xs flex items-center justify-center gap-2 transition-all cursor-pointer"
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
