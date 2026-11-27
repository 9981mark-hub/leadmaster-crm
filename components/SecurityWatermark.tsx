import React, { useEffect, useState } from 'react';
import { useLocation } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';

/** 고객 개인정보·DB가 직접 노출되는 경로만 워터마크 표시 */
const CUSTOMER_INFO_PREFIXES = ['/cases', '/case/', '/lite', '/auto-dial', '/schedule', '/new'];

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
  const { org, user, isPlatformAdmin } = useAuth();
  const { pathname } = useLocation();
  const [dateTimeStr, setDateTimeStr] = useState(formatWatermarkTime);

  useEffect(() => {
    const timer = setInterval(() => {
      setDateTimeStr(formatWatermarkTime());
    }, 60000);
    return () => clearInterval(timer);
  }, []);

  // 1. 서비스 총괄 관리자, TM 대표(owner), 총괄 관리자(Tier 3)는 워터마크 제외
  const isExecutiveOrPlatform =
    isPlatformAdmin ||
    org?.role === 'owner' ||
    org?.adminPermissions?.tier === 3;

  // 2. 고객 정보가 노출되는 페이지에서만 표시
  const isCustomerPage = CUSTOMER_INFO_PREFIXES.some(
    prefix => pathname === prefix || pathname.startsWith(prefix),
  );

  // 비로그인 · 제외 직급 · 비고객 페이지 · 개별 워터마크 해제 시 미노출
  if (!org || isExecutiveOrPlatform || !isCustomerPage || org.securityProfile?.watermark === false) {
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
      {/* 라이트 모드: 업무 방해 없는 초저대비 2.5% */}
      <div
        aria-hidden="true"
        className="pointer-events-none fixed inset-0 z-[99999] select-none overflow-hidden opacity-[0.025] dark:hidden"
        style={{ backgroundImage: makeSvgBg('#1e293b'), backgroundRepeat: 'repeat' }}
      />
      {/* 다크 모드: 업무 방해 없는 초저대비 2.5% */}
      <div
        aria-hidden="true"
        className="pointer-events-none fixed inset-0 z-[99999] select-none overflow-hidden opacity-[0.025] hidden dark:block"
        style={{ backgroundImage: makeSvgBg('#e2e8f0'), backgroundRepeat: 'repeat' }}
      />
    </>
  );
}
