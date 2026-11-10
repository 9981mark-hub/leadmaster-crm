import React, { useEffect, useState } from 'react';
import { useAuth } from '../contexts/AuthContext';

/**
 * [Security Feature 1] 동적 화면 보안 워터마크
 * 관리자가 상담원에게 보안 워터마크를 활성화한 경우,
 * CRM 화면 전체에 은은하게(투명도 ~5%) [회사명 · 상담원명 · 이메일 · 날짜]가 대각선으로 반복 노출됩니다.
 * pointer-events-none 설정으로 모든 마우스 클릭/스크롤/터치는 100% 정상 투과됩니다.
 * 모니터를 스마트폰 카메라로 촬영하거나 화면 캡처 시 유출자의 신원이 영구 박제됩니다.
 */
export default function SecurityWatermark() {
  const { org } = useAuth();
  const [dateStr, setDateStr] = useState(() => {
    const d = new Date();
    return `${d.getFullYear()}.${String(d.getMonth() + 1).padStart(2, '0')}.${String(d.getDate()).padStart(2, '0')}`;
  });

  useEffect(() => {
    const timer = setInterval(() => {
      const d = new Date();
      setDateStr(`${d.getFullYear()}.${String(d.getMonth() + 1).padStart(2, '0')}.${String(d.getDate()).padStart(2, '0')}`);
    }, 60000);
    return () => clearInterval(timer);
  }, []);

  // 비로그인 또는 워터마크 비활성화(팀장급 해제/대표/관리자)인 경우 미노출
  if (!org || org.securityProfile?.watermark === false) {
    return null;
  }

  const agentLabel = org.displayName || '상담원';
  const orgLabel = org.orgName || '리드마스터';
  const watermarkText = `${orgLabel} · ${agentLabel} · ${dateStr}`;

  return (
    <div
      aria-hidden="true"
      className="pointer-events-none fixed inset-0 z-[99999] select-none overflow-hidden opacity-[0.045] dark:opacity-[0.07] transition-opacity"
      style={{
        backgroundImage: `url("data:image/svg+xml;utf8,<svg xmlns='http://www.w3.org/2000/svg' width='380' height='220'><text x='30' y='120' transform='rotate(-22 190 110)' fill='%23666666' font-size='13' font-weight='600' font-family='sans-serif'>${encodeURIComponent(watermarkText)}</text></svg>")`,
        backgroundRepeat: 'repeat',
      }}
    />
  );
}
