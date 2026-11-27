import React, { useEffect, useState } from 'react';
import { useAuth } from '../contexts/AuthContext';

/**
 * [Security Feature 1] 동적 화면 보안 워터마크
 * 관리자가 상담원에게 보안 워터마크를 활성화한 경우,
 * CRM 화면 전체에 은은하게(투명도 ~5%) [회사명 · 상담원명 · 이메일 · 날짜]가 대각선으로 반복 노출됩니다.
 * pointer-events-none 설정으로 모든 마우스 클릭/스크롤/터치는 100% 정상 투과됩니다.
 * 모니터를 스마트폰 카메라로 촬영하거나 화면 캡처 시 유출자의 신원이 영구 박제됩니다.
 */
const formatWatermarkTime = () => {
  const d = new Date();
  const date = `${d.getFullYear()}.${String(d.getMonth() + 1).padStart(2, '0')}.${String(d.getDate()).padStart(2, '0')}`;
  const time = `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`;
  return `${date} ${time}`;
};

export default function SecurityWatermark() {
  const { org, user } = useAuth();
  const [dateTimeStr, setDateTimeStr] = useState(formatWatermarkTime);

  useEffect(() => {
    const timer = setInterval(() => {
      setDateTimeStr(formatWatermarkTime());
    }, 60000);
    return () => clearInterval(timer);
  }, []);

  // 비로그인 또는 워터마크 비활성화(팀장급 해제/대표/관리자)인 경우 미노출
  if (!org || org.securityProfile?.watermark === false) {
    return null;
  }

  const orgLabel = org.orgName || '리드마스터';
  const agentLabel = org.displayName || '상담원';
  const emailLabel = user?.email ? `(${user.email})` : '';
  const identityLabel = emailLabel && agentLabel !== user?.email ? `${agentLabel}${emailLabel}` : (user?.email || agentLabel);
  const watermarkText = `${orgLabel} · ${identityLabel} · ${dateTimeStr}`;

  const makeSvgBg = (hexColor: string) =>
    `url("data:image/svg+xml;utf8,<svg xmlns='http://www.w3.org/2000/svg' width='520' height='280'><text x='24' y='150' transform='rotate(-22 260 140)' fill='${encodeURIComponent(hexColor)}' font-size='12' font-weight='600' font-family='sans-serif'>${encodeURIComponent(watermarkText)}</text></svg>")`;

  return (
    <>
      {/* 라이트 모드: 은은하지만 캡처 시 판독 가능한 5.5% 딥 슬레이트 */}
      <div
        aria-hidden="true"
        className="pointer-events-none fixed inset-0 z-[99999] select-none overflow-hidden opacity-[0.055] dark:hidden"
        style={{ backgroundImage: makeSvgBg('#1e293b'), backgroundRepeat: 'repeat' }}
      />
      {/* 다크 모드: 어두운 배경에서도 동일하게 은은히 보이는 5.5% 라이트 슬레이트 */}
      <div
        aria-hidden="true"
        className="pointer-events-none fixed inset-0 z-[99999] select-none overflow-hidden opacity-[0.055] hidden dark:block"
        style={{ backgroundImage: makeSvgBg('#e2e8f0'), backgroundRepeat: 'repeat' }}
      />
    </>
  );
}
