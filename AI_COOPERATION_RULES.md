# 🤝 Kiro(키로) ⇄ Antigravity(안티그래피티) 협업 프로토콜 및 개발 가이드

이 문서는 **Kiro**와 **Antigravity** 두 AI 에이전트가 교대로 개발을 진행할 때, 코드 충돌과 버전 꼬임을 원천 방지하고 지속적으로 작업 맥락을 100% 동기화하기 위한 **공통 운영 원칙**입니다.

---

## 1. 📁 절대 기준 디렉토리 (Single Source of Truth)

작업 시 아래의 **진짜 원본 경로**만 열고 작업해야 합니다. 과거 백업 폴더를 열어 빌드하면 이전 코드가 덮어씌워져 시스템이 다운됩니다.

| 대상 | 진짜 원본 경로 (작업 대상) | 주의 및 절대 금지 경로 |
| :--- | :--- | :--- |
| **웹 CRM** | `D:\안티그래피티 작업\01_03-leadmaster-crm`<br>(또는 심링크 `C:\Users\JSH\Downloads\01_03-leadmaster-crm`) | `D:\다운로드_전체백업\01_03-leadmaster-crm` (백업용, 수정 금지) |
| **안드로이드 앱** | `D:\안드로이드 스튜디오 작업\Projects\LeadMasterApp`<br>(또는 심링크 `C:\Users\JSH\Downloads\LeadMasterApp`) | `D:\다운로드_전체백업\LeadMasterApp` (과거 10월 백업본, 절대 수정 금지)<br>`D:\안티그래피티 작업\LeadMasterApp` (구 복사본, 작업 금지) |

> 💡 **참고**: `C:\Users\JSH\Downloads\LeadMasterApp`은 현재 진짜 원본인 `D:\안드로이드 스튜디오 작업\Projects\LeadMasterApp`으로 Junction 연결되어 안전합니다.

---

## 2. 📝 공통 인계 프로토콜 (`docs/작업_이어가기.md`)

두 에이전트 간의 공식 소통 창구는 **`docs/작업_이어가기.md`**입니다.

### ① 작업 시작 전 (필수)
1. **`docs/작업_이어가기.md`의 최상단(1번 줄~)** 최신 항목을 읽어 상대방 에이전트가 어떤 작업을 마치고 인계했는지 확인합니다. (최신순 역순 기록)
2. Kiro는 자동 로드되는 `.kiro/steering/00-leadmaster-context.md`와 필요 시 `docs/두세션_대화및작업_통합동기화_2026-11-10_to_11-17.md`를 함께 확인합니다.
3. Git 로그(`git log -n 10 --oneline`)를 확인하여 최신 커밋 상태를 점검합니다.

### ② 작업 진행 중 (버전 및 네이밍)
- **웹 버전**: `App.tsx`의 `CURRENT_VERSION`을 작업 내용에 따라 갱신 (현재 `3.80`).
- **앱 버전**: `app/build.gradle.kts`의 `versionCode`를 1씩 올리고, `versionName`을 적절히 증가 (현재 `1.8.3` / `versionCode 35`, 11/17 녹음·32kbps 압축 커밋 반영 시 `36+` 증분).
- **커밋 메시지**: 작업 주체를 알 수 있게 태그를 붙입니다:
  - 예: `feat(team): [AGY] ...` (안티그래피티 작업)
  - 예: `fix(call): [KIRO] ...` (키로 작업)

### ③ 작업 완료 후 (필수)
1. 빌드 및 타입 검사 수행:
   - 웹: `npx tsc --noEmit` & `npm run build`
   - 앱: `D:\안드로이드 스튜디오 작업\Projects\LeadMasterApp`에서 빌드
2. **`docs/작업_이어가기.md` 최상단(제목 바로 아래)에 이번 작업 내역을 즉시 기록**:
   - 일시, 작업자(`[AGY]` or `[KIRO]`), 수정한 파일, 적용된 주요 기능, 대표님 확인 대기 사항 및 다음 남은 일(Next Steps).
   - 중요한 정책/인프라/권한 변경이 있으면 `.kiro/steering/00-leadmaster-context.md` 상단 최신 현황도 함께 갱신.
3. Git commit & push.

---

## 3. 🔒 보안 및 계정 취급 주의사항

1. **공용 계정 사용 금지**:
   - 11월 1일 멀티테넌트 전환으로 과거 공용 서비스 계정(`android-app@leadmaster.com`)은 영구 차단되었습니다.
   - 앱 및 웹의 모든 인증은 Supabase 세션 및 사용자별 구글 로그인(`AppSession`)을 기반으로 동작해야 합니다.
2. **서명 키 및 비밀번호 보호**:
   - 정식 서명 키 파일(`leadmaster-release.jks`) 및 비밀번호는 코드에 직접 하드코딩하지 않고 환경 설정 파일에만 보관합니다.
3. **Egress(네트워크 대역폭) 절약**:
   - 화면 포커스나 탭 복귀 시 전체 리드(`cases`)를 통째로 다시 긁어오는 불필요한 Polling이나 Egress 유발 로직을 작성하지 않습니다.

---

## 4. 🚀 현재 시스템 최신 버전 현황 (2026-11-18 기준)

- **웹 CRM**: `v3.80` (공식 도메인 `https://www.lmaster.xyz/`, Vercel + GitHub Pages 듀얼 라우터)
  - 4대 직급(대표·총괄실장·팀장·상담원) + Admin Tier 1~3 전사 권한 체계, TM 대표 빌링 & 광고비 관제 센터(`/billing`), 요금제(`/pricing`) & Clickwrap 4대 전자계약, PC+폰 단일 세션 가드 & 좌석 하드 리밋, Supabase Storage 1년 보관 & D-30 ZIP 백업 센터, 아웃바운드⇄인바운드 AI 트레이닝·9단계 신입 온보딩·300제 평가시험
- **안드로이드 앱**: `1.8.3` (`versionCode 35`, 정식 키 `bf6eb8fe…`)
  - 11/17 커밋(`85d60ee` Supabase 직접 업로드, `d78a253` 32kbps AAC `AudioTranscoder.kt`) 반영을 위해 `versionCode 36+` 정식 릴리즈 재빌드·배포 예정
