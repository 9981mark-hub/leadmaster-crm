/**
 * services/avatarService.ts
 * 사용자 대표 프로필 이미지 압축, 검증 및 비즈니스 아바타 프리셋 서비스
 */

/**
 * 사용자 업로드 이미지를 브라우저 캔버스로 고화질 리사이징 & 정사각 센터 크롭 압축
 * - 원본이 수십 MB 고용량이어도 400x400 규격의 ~40KB 고화질 JPEG로 압축하여 LocalStorage 및 세션에 최적화
 */
export const compressAvatarImage = (
  file: File,
  targetSize: number = 400,
  quality: number = 0.88
): Promise<string> => {
  return new Promise((resolve, reject) => {
    if (!file.type.startsWith('image/')) {
      reject(new Error('이미지 파일(PNG, JPG, WEBP, GIF 등)만 업로드할 수 있습니다.'));
      return;
    }

    // 파일 용량 15MB 초과 방어
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

          // 1. Center Square Crop: 원본 비율에 맞게 정중앙을 기준으로 정사각 추출
          const minDim = Math.min(img.width, img.height);
          const startX = (img.width - minDim) / 2;
          const startY = (img.height - minDim) / 2;

          ctx.imageSmoothingEnabled = true;
          ctx.imageSmoothingQuality = 'high';

          // 배경 흰색 채우기 (투명 PNG가 검게 변하는 현상 방지)
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
          console.warn('[AvatarService] Canvas crop failed, falling back to original:', err);
          resolve(e.target?.result as string);
        }
      };
      img.onerror = () => reject(new Error('이미지 파일을 해석하지 못했습니다. 유효한 사진을 선택해주세요.'));
      img.src = e.target?.result as string;
    };
    reader.onerror = () => reject(new Error('사진 파일을 읽는 도중 오류가 발생했습니다.'));
    reader.readAsDataURL(file);
  });
};

/**
 * CRM 업무 환경에 최적화된 고해상도 비즈니스 아바타 프리셋 (SVG Data URI)
 * 외부 인터넷 접속 없이도 언제나 즉시 렌더링되는 자립형 벡터 아바타 8종
 */
const makeSvgAvatarDataUrl = (
  id: string,
  gradientStart: string,
  gradientEnd: string,
  faceTone: string,
  suitColor: string,
  tieOrAccent: string,
  accessory: 'glasses' | 'headset' | 'briefcase' | 'none'
): string => {
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 120 120" width="120" height="120">
    <defs>
      <linearGradient id="bg_${id}" x1="0%" y1="0%" x2="100%" y2="100%">
        <stop offset="0%" stop-color="${gradientStart}"/>
        <stop offset="100%" stop-color="${gradientEnd}"/>
      </linearGradient>
      <filter id="shadow_${id}" x="-10%" y="-10%" width="120%" height="120%">
        <feDropShadow dx="0" dy="2" stdDeviation="2" flood-opacity="0.15"/>
      </filter>
    </defs>
    <!-- Background Circle/Rounded -->
    <rect width="120" height="120" rx="36" fill="url(#bg_${id})"/>
    
    <!-- Body / Suit -->
    <path d="M 22 120 C 22 92, 40 82, 60 82 C 80 82, 98 92, 98 120 Z" fill="${suitColor}" filter="url(#shadow_${id})"/>
    <!-- Inner Shirt Collar -->
    <path d="M 50 82 L 60 98 L 70 82 Z" fill="#ffffff"/>
    <!-- Tie / Accent Lapel -->
    <path d="M 57 88 L 63 88 L 62 108 L 60 114 L 58 108 Z" fill="${tieOrAccent}"/>

    <!-- Head / Neck -->
    <rect x="52" y="66" width="16" height="20" rx="4" fill="${faceTone}"/>
    <ellipse cx="60" cy="52" rx="22" ry="24" fill="${faceTone}" filter="url(#shadow_${id})"/>

    <!-- Hair Cap -->
    <path d="M 38 46 C 38 30, 48 24, 60 24 C 72 24, 82 30, 82 46 C 76 40, 70 38, 60 38 C 50 38, 44 40, 38 46 Z" fill="#2d3748"/>

    <!-- Eyes -->
    <circle cx="52" cy="52" r="2.5" fill="#1a202c"/>
    <circle cx="68" cy="52" r="2.5" fill="#1a202c"/>

    <!-- Smile -->
    <path d="M 54 62 Q 60 67 66 62" stroke="#4a5568" stroke-width="2" stroke-linecap="round" fill="none"/>

    ${accessory === 'glasses' ? `
      <!-- Glasses -->
      <rect x="46" y="47" width="12" height="9" rx="2" fill="none" stroke="#2b6cb0" stroke-width="2"/>
      <rect x="62" y="47" width="12" height="9" rx="2" fill="none" stroke="#2b6cb0" stroke-width="2"/>
      <line x1="58" y1="51" x2="62" y2="51" stroke="#2b6cb0" stroke-width="2"/>
    ` : ''}

    ${accessory === 'headset' ? `
      <!-- Professional TM Headset -->
      <path d="M 37 52 C 37 36, 45 30, 60 30 C 75 30, 83 36, 83 52" fill="none" stroke="#4a5568" stroke-width="3" stroke-linecap="round"/>
      <rect x="34" y="48" width="6" height="12" rx="3" fill="#2d3748"/>
      <rect x="80" y="48" width="6" height="12" rx="3" fill="#2d3748"/>
      <path d="M 37 56 Q 42 70 54 70" fill="none" stroke="#2d3748" stroke-width="2.5" stroke-linecap="round"/>
      <circle cx="55" cy="70" r="3" fill="#e53e3e"/>
    ` : ''}
  </svg>`;

  return `data:image/svg+xml;utf8,${encodeURIComponent(svg)}`;
};

export interface AvatarPresetItem {
  id: string;
  name: string;
  roleHint: string;
  accentBg: string;
  dataUrl: string;
}

export const PRESET_AVATARS: AvatarPresetItem[] = [
  {
    id: 'preset_agent_headset_blue',
    name: '블루 헤드셋 상담원',
    roleHint: '전화 상담 전문',
    accentBg: 'from-blue-500 to-indigo-600',
    dataUrl: makeSvgAvatarDataUrl('p1', '#3b82f6', '#1d4ed8', '#fbd38d', '#1e293b', '#2563eb', 'headset'),
  },
  {
    id: 'preset_agent_headset_purple',
    name: '퍼플 헤드셋 실장',
    roleHint: '인바운드 총괄',
    accentBg: 'from-purple-500 to-indigo-600',
    dataUrl: makeSvgAvatarDataUrl('p2', '#8b5cf6', '#6366f1', '#fcd34d', '#312e81', '#a855f7', 'headset'),
  },
  {
    id: 'preset_agent_male_suit',
    name: '네이비 정장 매니저',
    roleHint: '비즈니스 & 관리',
    accentBg: 'from-slate-600 to-slate-900',
    dataUrl: makeSvgAvatarDataUrl('p3', '#475569', '#0f172a', '#fbcfe8', '#1e293b', '#3b82f6', 'none'),
  },
  {
    id: 'preset_agent_glasses_advisor',
    name: '스마트 전문 사무장',
    roleHint: '법률 상담 & 심층 문진',
    accentBg: 'from-emerald-500 to-teal-700',
    dataUrl: makeSvgAvatarDataUrl('p4', '#10b981', '#0f766e', '#fed7aa', '#134e4a', '#059669', 'glasses'),
  },
  {
    id: 'preset_agent_amber_exec',
    name: '골드 최고 관리자',
    roleHint: '대표 & 의사결정',
    accentBg: 'from-amber-400 to-orange-600',
    dataUrl: makeSvgAvatarDataUrl('p5', '#f59e0b', '#d97706', '#fef08a', '#451a03', '#b45309', 'none'),
  },
  {
    id: 'preset_agent_rose_specialist',
    name: '로즈 고객만족 스페셜리스트',
    roleHint: 'VIP 케어 & 클로징',
    accentBg: 'from-rose-500 to-pink-600',
    dataUrl: makeSvgAvatarDataUrl('p6', '#f43f5e', '#be185d', '#ffedd5', '#881337', '#fb7185', 'headset'),
  },
  {
    id: 'preset_agent_cyan_tech',
    name: '사이언 AI 코디네이터',
    roleHint: '스마트 CRM 오퍼레이터',
    accentBg: 'from-cyan-500 to-blue-600',
    dataUrl: makeSvgAvatarDataUrl('p7', '#06b6d4', '#2563eb', '#fde047', '#082f49', '#0284c7', 'glasses'),
  },
  {
    id: 'preset_agent_dark_clean',
    name: '모던 젠틀맨 상담관',
    roleHint: '채권 채무 법률 전담',
    accentBg: 'from-gray-700 to-gray-950',
    dataUrl: makeSvgAvatarDataUrl('p8', '#374151', '#111827', '#fed7aa', '#1f2937', '#e11d48', 'none'),
  },
];
