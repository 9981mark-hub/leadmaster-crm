/**
 * services/companyLogoService.ts
 * 회사(워크스페이스) 대표 로고/사진 압축, 검증 및 비즈니스 심볼 프리셋 서비스
 */

/**
 * 회사 대표 로고/간판 사진을 브라우저 캔버스로 고화질 리사이징 & 정사각 센터 크롭 압축
 * - 원본 사진을 400x400 규격의 ~40KB 고화질 JPEG/PNG로 압축하여 LocalStorage 및 세션에 최적화
 */
export const compressCompanyLogoImage = (
  file: File,
  targetSize: number = 400,
  quality: number = 0.90
): Promise<string> => {
  return new Promise((resolve, reject) => {
    if (!file.type.startsWith('image/')) {
      reject(new Error('이미지 파일(PNG, JPG, WEBP, GIF, SVG 등)만 업로드할 수 있습니다.'));
      return;
    }

    if (file.size > 15 * 1024 * 1024) {
      reject(new Error('파일 용량이 너무 큽니다. 15MB 이하의 사진을 선택해주세요.'));
      return;
    }

    const reader = new FileReader();
    reader.onload = (e) => {
      const img = new Image();
      img.onload = () => {
        try {
          const canvas = document.createElement('canvas');
          canvas.width = targetSize;
          canvas.height = targetSize;
          const ctx = canvas.getContext('2d');
          if (!ctx) {
            resolve(e.target?.result as string);
            return;
          }

          // Center Square Crop: 정중앙 기준 정사각 추출
          const minDim = Math.min(img.width, img.height);
          const startX = (img.width - minDim) / 2;
          const startY = (img.height - minDim) / 2;

          ctx.imageSmoothingEnabled = true;
          ctx.imageSmoothingQuality = 'high';

          // 투명 배경 PNG 지원을 위해 기본 흰색 베이스
          ctx.fillStyle = '#ffffff';
          ctx.fillRect(0, 0, targetSize, targetSize);

          ctx.drawImage(
            img,
            startX,
            startY,
            minDim,
            minDim,
            0,
            0,
            targetSize,
            targetSize
          );

          const compressedDataUrl = canvas.toDataURL('image/jpeg', quality);
          resolve(compressedDataUrl);
        } catch (err) {
          console.warn('[CompanyLogoService] Canvas crop failed, using original data:', err);
          resolve(e.target?.result as string);
        }
      };
      img.onerror = () => reject(new Error('이미지 파일을 해석하지 못했습니다.'));
      img.src = e.target?.result as string;
    };
    reader.onerror = () => reject(new Error('파일을 읽는 도중 오류가 발생했습니다.'));
    reader.readAsDataURL(file);
  });
};

/**
 * 법률 사무소, 금융 컨설팅, TM 영업 센터에 최적화된 고해상도 벡터 심볼 프리셋 8종
 */
const makeSvgLogoDataUrl = (
  id: string,
  bgStart: string,
  bgEnd: string,
  iconColor: string,
  symbolType: 'scale' | 'building' | 'shield' | 'handshake' | 'crown' | 'wings' | 'cube' | 'heart'
): string => {
  let symbolSvg = '';
  if (symbolType === 'scale') {
    // 정의의 저울 (법무/회생/파산/법률 특화)
    symbolSvg = `
      <path d="M 60 26 L 60 94" stroke="${iconColor}" stroke-width="4.5" stroke-linecap="round"/>
      <path d="M 40 94 L 80 94" stroke="${iconColor}" stroke-width="4.5" stroke-linecap="round"/>
      <path d="M 32 38 L 88 38" stroke="${iconColor}" stroke-width="4.5" stroke-linecap="round"/>
      <circle cx="60" cy="26" r="4.5" fill="${iconColor}"/>
      <!-- Left Pan -->
      <path d="M 32 38 L 22 62 L 42 62 Z" fill="none" stroke="${iconColor}" stroke-width="3"/>
      <path d="M 18 62 Q 32 72 46 62 Z" fill="${iconColor}"/>
      <!-- Right Pan -->
      <path d="M 88 38 L 78 62 L 98 62 Z" fill="none" stroke="${iconColor}" stroke-width="3"/>
      <path d="M 74 62 Q 88 72 102 62 Z" fill="${iconColor}"/>
    `;
  } else if (symbolType === 'building') {
    // 랜드마크 타워 빌딩 (금융/본사/기업 특화)
    symbolSvg = `
      <rect x="36" y="32" width="48" height="64" rx="4" fill="none" stroke="${iconColor}" stroke-width="4.5"/>
      <rect x="46" y="42" width="8" height="10" rx="1.5" fill="${iconColor}"/>
      <rect x="66" y="42" width="8" height="10" rx="1.5" fill="${iconColor}"/>
      <rect x="46" y="58" width="8" height="10" rx="1.5" fill="${iconColor}"/>
      <rect x="66" y="58" width="8" height="10" rx="1.5" fill="${iconColor}"/>
      <path d="M 54 96 L 54 82 L 66 82 L 66 96" fill="${iconColor}"/>
      <polygon points="60,18 36,32 84,32" fill="${iconColor}"/>
    `;
  } else if (symbolType === 'shield') {
    // 신뢰와 채무 방어 쉴드 (안심 상담/보안 특화)
    symbolSvg = `
      <path d="M 60 22 C 78 22, 92 28, 92 48 C 92 74, 68 94, 60 98 C 52 94, 28 74, 28 48 C 28 28, 42 22, 60 22 Z" 
            fill="none" stroke="${iconColor}" stroke-width="5" stroke-linejoin="round"/>
      <path d="M 44 58 L 54 68 L 76 44" fill="none" stroke="${iconColor}" stroke-width="6" stroke-linecap="round" stroke-linejoin="round"/>
    `;
  } else if (symbolType === 'handshake') {
    // 상생 파트너십 악수 (협력/제휴/파트너스 특화)
    symbolSvg = `
      <circle cx="60" cy="60" r="34" fill="none" stroke="${iconColor}" stroke-width="4"/>
      <path d="M 40 54 L 52 64 L 68 50 L 80 60" fill="none" stroke="${iconColor}" stroke-width="5" stroke-linecap="round" stroke-linejoin="round"/>
      <circle cx="52" cy="64" r="4.5" fill="${iconColor}"/>
      <circle cx="68" cy="50" r="4.5" fill="${iconColor}"/>
    `;
  } else if (symbolType === 'crown') {
    // 탑티어 프리미엄 크라운 (HQ/대표/마스터 특화)
    symbolSvg = `
      <path d="M 28 82 L 92 82 L 92 74 L 84 46 L 68 64 L 60 32 L 52 64 L 36 46 L 28 74 Z" 
            fill="${iconColor}" stroke="${iconColor}" stroke-width="3" stroke-linejoin="round"/>
      <circle cx="28" cy="42" r="4" fill="${iconColor}"/>
      <circle cx="60" cy="28" r="4.5" fill="${iconColor}"/>
      <circle cx="92" cy="42" r="4" fill="${iconColor}"/>
      <line x1="32" y1="88" x2="88" y2="88" stroke="${iconColor}" stroke-width="4" stroke-linecap="round"/>
    `;
  } else if (symbolType === 'wings') {
    // 비상과 성장 윙 (성공/재도약/도약 특화)
    symbolSvg = `
      <path d="M 60 88 L 60 30" stroke="${iconColor}" stroke-width="4.5" stroke-linecap="round"/>
      <path d="M 60 30 Q 86 36 94 62 Q 80 62 60 52" fill="${iconColor}"/>
      <path d="M 60 30 Q 34 36 26 62 Q 40 62 60 52" fill="${iconColor}"/>
      <path d="M 60 52 Q 80 62 90 80 Q 76 78 60 68" fill="${iconColor}" opacity="0.85"/>
      <path d="M 60 52 Q 40 62 30 80 Q 44 78 60 68" fill="${iconColor}" opacity="0.85"/>
    `;
  } else if (symbolType === 'cube') {
    // 모던 테크 큐브 (시스템/솔루션/스마트 CRM 특화)
    symbolSvg = `
      <polygon points="60,24 94,42 60,60 26,42" fill="none" stroke="${iconColor}" stroke-width="4.5" stroke-linejoin="round"/>
      <polygon points="26,42 60,60 60,96 26,78" fill="${iconColor}" opacity="0.85"/>
      <polygon points="94,42 60,60 60,96 94,78" fill="${iconColor}"/>
    `;
  } else {
    // 고객 감동 케어 하트 (신뢰/상담/동행 특화)
    symbolSvg = `
      <path d="M 60 88 C 30 68, 22 46, 36 32 C 48 20, 58 30, 60 36 C 62 30, 72 20, 84 32 C 98 46, 90 68, 60 88 Z" 
            fill="${iconColor}"/>
    `;
  }

  const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 120 120" width="120" height="120">
    <defs>
      <linearGradient id="c_bg_${id}" x1="0%" y1="0%" x2="100%" y2="100%">
        <stop offset="0%" stop-color="${bgStart}"/>
        <stop offset="100%" stop-color="${bgEnd}"/>
      </linearGradient>
    </defs>
    <rect width="120" height="120" rx="28" fill="url(#c_bg_${id})"/>
    ${symbolSvg}
  </svg>`;

  return `data:image/svg+xml;utf8,${encodeURIComponent(svg)}`;
};

export interface CompanyPresetItem {
  id: string;
  name: string;
  category: string;
  bgLabel: string;
  dataUrl: string;
}

export const COMPANY_LOGO_PRESETS: CompanyPresetItem[] = [
  {
    id: 'preset_scale_gold',
    name: '정의의 골드 저울',
    category: '법무·회생 전용',
    bgLabel: '골드 & 딥네이비',
    dataUrl: makeSvgLogoDataUrl('scale1', '#1e293b', '#0f172a', '#fbbf24', 'scale'),
  },
  {
    id: 'preset_scale_blue',
    name: '신뢰의 블루 저울',
    category: '법률·공공 파트너',
    bgLabel: '로얄 블루',
    dataUrl: makeSvgLogoDataUrl('scale2', '#1d4ed8', '#1e3a8a', '#ffffff', 'scale'),
  },
  {
    id: 'preset_building_blue',
    name: '메트로 타워 빌딩',
    category: '금융 본사·기업',
    bgLabel: '스카이 & 블루',
    dataUrl: makeSvgLogoDataUrl('bld1', '#2563eb', '#1d4ed8', '#ffffff', 'building'),
  },
  {
    id: 'preset_shield_emerald',
    name: '에메랄드 세이프가드',
    category: '채무 방어·보안',
    bgLabel: '에메랄드 그린',
    dataUrl: makeSvgLogoDataUrl('shld1', '#059669', '#047857', '#ffffff', 'shield'),
  },
  {
    id: 'preset_partnership_indigo',
    name: '인디고 파트너스',
    category: '상생 영업·파트너십',
    bgLabel: '인디고 & 퍼플',
    dataUrl: makeSvgLogoDataUrl('part1', '#4f46e5', '#3730a3', '#ffffff', 'handshake'),
  },
  {
    id: 'preset_crown_amber',
    name: '탑티어 크라운',
    category: '최고 관리국·HQ',
    bgLabel: '골드 앰버',
    dataUrl: makeSvgLogoDataUrl('crwn1', '#d97706', '#b45309', '#ffffff', 'crown'),
  },
  {
    id: 'preset_wings_cyan',
    name: '도약과 성공의 윙',
    category: '서민 금융·재도약',
    bgLabel: '사이언 & 딥블루',
    dataUrl: makeSvgLogoDataUrl('wing1', '#0284c7', '#0369a1', '#ffffff', 'wings'),
  },
  {
    id: 'preset_cube_dark',
    name: '모던 큐브 솔루션',
    category: '스마트 CRM 센터',
    bgLabel: '다크 슬레이트',
    dataUrl: makeSvgLogoDataUrl('cube1', '#334155', '#1e293b', '#38bdf8', 'cube'),
  },
];
