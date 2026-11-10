# 계약 전 사전 구현 및 무결점 오픈 준비 계획서 (Pre-Launch Implementation Plan)

> **For agentic workers:** REQUIRED SUB-SKILL: Use `superpowers:subagent-driven-development` (recommended) or `superpowers:executing-plans` to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 유료 결제(Supabase Pro, Vercel Pro, GitHub Pro)를 첫 고객 계약 및 입금 확인 시점으로 유보한 상태에서, 비용 0원으로 시스템의 모든 기능, 멀티테넌트 데이터 완전 격리, 대량 상담원 온보딩 툴, 정식 서명 키 APK, 계약/과금 법적 서식, 그리고 전환 당일 5분 런북을 사전에 100% 구축하고 검증한다.

**Architecture:** 
1. **보안/격리 검증 계층**: Supabase RLS 정책 기반 회사 간(테넌트 A vs B) 교차 쿼리 자동 전수 검증 스크립트를 작성하여 데이터 누수율 0% 입증.
2. **관리 및 온보딩 계층**: 10~50명 상담원을 엑셀에서 복사하여 10초 만에 일괄 초대하는 대량 등록기 및 회사별 과금(인당 ₩48,000) 실시간 집계 대시보드 구축.
3. **앱 배포 계층**: 정식 릴리즈 서명 키(`leadmaster-release.jks`) 기반 APK 빌드 및 인앱 자동 업데이트 무결성 체계 확립.
4. **운영/법적 계층**: 고객사 계약용 개인정보 처리위탁 표준계약서, 이용약관, 관리자/상담원 배포 매뉴얼 완성.
5. **런북(Runbook) 계층**: 입금 당일 5분 만에 끝내는 스위칭 절차서 구축.

**Tech Stack:** React 19, Vite, TypeScript, Tailwind CSS, Supabase (PostgreSQL + RLS), Android Kotlin, Node.js (검증 스크립트).

**Spec:** `docs/오픈준비_체크리스트_v1.md`, `docs/기획서_리드마스터_SaaS_고도화_v1.md`

## Global Constraints
- 유료 플랜 전환 전까지 외부 유료 결제(월 구독료 발생)를 일체 발생시키지 않는다.
- 기존 운영 데이터(본사 '리드마스터 본사' 회사)의 업무 연속성과 무결성을 절대 훼손하지 않는다.
- 비밀값(API 키, 서명 비밀번호, 토큰)은 코드나 커밋에 노출하지 않고 `.env.local` 및 백업 디렉토리에 보존한다.
- 모든 웹 코드는 `tsc -b && vite build` 0 오류를 유지한다.

## Review Focus
1. **회사 간 데이터 교차 유출**: 회사 A의 상담원이 회사 B의 리드, 통화 기록, 녹음 파일에 접근 가능한 경로가 1개라도 존재하는지 여부.
2. **상담원 50명 동시 온보딩 부하**: 대량 초대 시 이메일 유효성, 중복 계정 처리, 순번 자동 배정 누락 여부.
3. **앱 릴리즈 서명 키 불일치**: 정식 키로 빌드된 APK가 구형 디버그 키 기기에서 설치 거부될 때의 전환 대응책.
4. **인당 ₩48,000 과금 정산 근거**: 플랫폼 관리자 화면에서 당월 활성 사용자 수가 정확히 카운트되는지 여부.
5. **개인정보 처리위탁 법적 하자**: 채무·소득 등 민감 금융 정보 위탁 시 법적 필수 고지 및 파기 기한 명시 여부.

---

## Tasks

### Task 1: 고객사 계약용 개인정보 처리위탁 표준계약서 & SaaS 과금 정산서 템플릿 작성

**Files:**
- Create: `docs/legal/개인정보_처리위탁_표준계약서_v1.md`
- Create: `docs/legal/SaaS_서비스_이용계약서_및_SLA_v1.md`
- Create: `docs/billing/월간_이용료_청구서_양식_v1.md`

**Requirements:**
- 「개인정보 보호법」 제26조(업무위탁에 따른 개인정보의 처리 제한)에 따른 법적 필수 기재 사항 6대 항목(위탁업무 목적/범위, 기술적·관리적 보호조치, 재위탁 제한, 안전성 확보조치, 수탁자 의무, 손해배상) 완비.
- 과금 모델: 상담원 1인당 월 ₩48,000 (VAT 별도 또는 포함 선택), 최소 약정 기간, 1~2주 무료 시범 운영 조항 포함.
- 결제 및 입금 계좌, 세금계산서 발행 프로세스 명시.

**Steps:**
- [ ] 1. `docs/legal/개인정보_처리위탁_표준계약서_v1.md` 작성 (위탁자: 고객사, 수탁자: 리드마스터 진성훈).
- [ ] 2. `docs/legal/SaaS_서비스_이용계약서_및_SLA_v1.md` 작성 (월 이용료 ₩48,000/인, 99.5% 가용성, 데이터 백업 주기).
- [ ] 3. `docs/billing/월간_이용료_청구서_양식_v1.md` 작성 (회사명, 청구 월, 활성 상담원 명단/수, 공급가액/세액 자동 계산 서식).
- [ ] 4. 산출물 검토 및 Git 커밋.

---

### Task 2: 멀티테넌트 데이터 완전 격리 교차 자동 검증 스크립트 구축

**Files:**
- Create: `scripts/verify_multitenant_isolation.mjs`
- Test: `node scripts/verify_multitenant_isolation.mjs`

**Requirements:**
- 운영 DB 연결 후, 테스트용 가상 테넌트 2개(`테스트회사_Alpha`, `테스트회사_Beta`)의 컨텍스트를 시뮬레이션.
- Alpha의 RLS 세션에서 `cases`, `communication_logs`, `call_recordings`, `access_logs`, `team_members` 테이블 쿼리 시 Beta 데이터가 **0건(Empty)** 반환되는지 자동 검증.
- 만약 1건이라도 교차 노출 시 `exit(1)`로 즉시 빌드 차단.
- 검증 후 테스트 데이터는 안전하게 롤백(Rollback)되거나 테스트 전용 격리 유지.

**Steps:**
- [ ] 1. `scripts/verify_multitenant_isolation.mjs` 작성 (Supabase Service Role 및 익명/인증 사용자 토큰 시뮬레이션).
- [ ] 2. RLS 정책 전수 점검 로직 구현:
  - `cases` 테이블 `org_id` 격리 확인
  - `communication_logs` 격리 확인
  - `call_recordings` 격리 확인
  - `org_drive_connections` 드라이브 토큰 격리 확인
- [ ] 3. 로컬 실행 및 100% 무누수(PASS) 검증 완료.
- [ ] 4. Git 커밋.

---

### Task 3: 플랫폼 관리자(`/platform`) 실시간 사용자 과금 집계 & 사용량 관제 위젯 구현

**Files:**
- Modify: `pages/PlatformPage.tsx`
- Modify: `services/platform.ts`
- Modify: `types.ts`

**Requirements:**
- 플랫폼 관리자(진성훈 대표) 전용 페이지(`/platform`)에서 각 고객 회사별:
  1. **현재 활성 상담원 수 (인원수)**
  2. **당월 예상 청구 금액 (인원수 × ₩48,000)**
  3. **당월 리드 등록 건수 & 통화 건수**
  4. **AI 토큰 사용량 & 예상 원가**
  5. **원클릭 이용 상태 토글 (정상 운영 `active` / 연체·정지 `suspended`)**
- 10명~50명 규모의 고객사 3~5곳이 등록되었을 때 총합 월 매출 및 인프라 원가(마진율 ~90%)가 실시간 카드에 표기될 것.

**Steps:**
- [ ] 1. `services/platform.ts`에 회사별 활성 사용자 수 집계 및 월간 청구액 계산 함수(`getOrgBillingSummary`) 구현.
- [ ] 2. `pages/PlatformPage.tsx` 상단에 **[💰 고객사별 과금 및 청구 관제 카드]** 탑재.
- [ ] 3. 회사 목록 테이블에 [활성 상담원 수], [월 청구 예정액(₩)], [원클릭 청구서 생성] 액션 버튼 추가.
- [ ] 4. `npm run build` 검증 및 Git 커밋.

---

### Task 4: 상담원 대량 초대(10~50명) 원클릭 배치 모달 구현

**Files:**
- Create: `components/team/BulkInviteModal.tsx`
- Modify: `pages/TeamPage.tsx`
- Modify: `services/team.ts`

**Requirements:**
- 고객사 관리자가 10명~50명의 상담원을 1명씩 손으로 등록하지 않고, 엑셀이나 카카오톡 명단에서 `이름, 이메일`을 한 번에 복사-붙여넣기하여 일괄 초대할 수 있는 대량 등록 모달.
- 파싱 지원 형식:
  - 엑셀 탭 구분: `홍길동\thong@gmail.com`
  - 쉼표 구분: `홍길동, hong@gmail.com`
  - 줄바꿈 이메일 전용: `hong@gmail.com` (이름은 이메일 앞자리로 자동 생성)
- 유효성 검사: 구글 이메일 형식 체크, 사내 중복 등록 필터링, 성공/실패 미리보기 테이블 제공.
- [일괄 초대 발송] 클릭 시 Supabase `team_members`에 즉시 안전 배치 등록.

**Steps:**
- [ ] 1. `components/team/BulkInviteModal.tsx` 생성 및 스마트 텍스트 파서 구현.
- [ ] 2. `services/team.ts`에 대량 초대 배치 함수(`bulkInviteMembers`) 추가.
- [ ] 3. `pages/TeamPage.tsx` 상단에 `[👥 상담원 대량 초대 (10~50명)]` 버튼 배치 및 모달 연동.
- [ ] 4. 30명 가상 텍스트 붙여넣기 파싱 및 빌드 검증 (`npm run build`).
- [ ] 5. Git 커밋.

---

### Task 5: 신규 고객사 원클릭 온보딩 프리셋 세팅기 구현

**Files:**
- Create: `components/platform/QuickOrgSetupModal.tsx`
- Modify: `pages/PlatformPage.tsx`
- Modify: `services/org.ts`

**Requirements:**
- 새 회사를 만들 때, 빈 화면이 아니라 **TM사무실 실무에 즉시 투입 가능한 표준 프리셋**이 1초 만에 자동 주입되어야 함:
  1. 기본 1차/2차 상태 프리셋 (접수, 부재, 상담중, 사무장인계, 계약완료 등)
  2. 회생/파산 또는 금융 전문 첫인사 스크립트 기본 템플릿
  3. 기본 수수료/인센티브 규칙 템플릿
  4. 통화 녹음 및 보존 주기(1년 기본) 설정
- 관리자가 체크박스 하나로 "TM 표준 프리셋 적용"을 선택하면 회사 생성과 동시에 초기 세팅 완료.

**Steps:**
- [ ] 1. `services/org.ts`에 `createOrgWithPresets` 함수 구현 (상태값, 첫인사 스크립트, 기본 정책 시드 데이터 일괄 주입).
- [ ] 2. `components/platform/QuickOrgSetupModal.tsx` 생성.
- [ ] 3. `pages/PlatformPage.tsx` 회사 생성 폼을 퀵 프리셋 모달과 통합.
- [ ] 4. `npm run build` 검증 및 Git 커밋.

---

### Task 6: 안드로이드 정식 릴리즈 서명 키(`leadmaster-release.jks`) 빌드 및 인앱 배포 파이프라인 정비

**Files:**
- Modify/Verify: `D:\안드로이드 스튜디오 작업\Projects\LeadMasterApp\app\build.gradle.kts`
- Modify/Verify: `D:\안드로이드 스튜디오 작업\Projects\LeadMasterApp\keystore.properties`
- Create/Verify: `scripts/app_build_release.ps1`
- Target: `public/app/LeadMaster_Release.apk`

**Requirements:**
- 고객사 상담원 폰에 첫 배포될 APK는 반드시 **영구 정식 릴리즈 키(`leadmaster-release.jks`, 지문 `7ee0d49a...`)**로 서명되어야 함. (디버그 키로 나가면 나중에 50명이 전원 앱을 삭제하고 재설치해야 하는 대참사 발생).
- 원클릭 릴리즈 빌드 스크립트(`app_build_release.ps1`) 구축:
  - Gradle `assembleRelease` 실행
  - 서명 키 지문 자동 검증 (`keytool -printcert -jarfile`)
  - 성공 시 `D:\LeadMaster_APK\LeadMaster_Release_v1.6.8.apk` 및 `public/app/LeadMaster.apk`로 복사.
- `public/app/version.json` 메타데이터 무결성 확인.

**Steps:**
- [ ] 1. `keystore.properties` 및 `leadmaster-release.jks` 서명 구성 점검.
- [ ] 2. 릴리즈 빌드 스크립트 실행 및 서명 지문 `7ee0d49a...` 일치 확인.
- [ ] 3. `public/app/LeadMaster.apk`에 릴리즈 빌드본 탑재.
- [ ] 4. Git 커밋.

---

### Task 7: 고객사 관리자 & 상담원 현장 배포용 3분 매뉴얼 패키지 완성

**Files:**
- Create: `docs/manuals/고객사_관리자_온보딩_가이드_v1.md`
- Create: `docs/manuals/상담원_앱설치_및_권한설정_v1.md`
- Create: `docs/manuals/기종별_호환성_점검표_v1.md`

**Requirements:**
- **고객사 관리자 가이드**:
  - 구글 로그인 ➔ 텔레그램 봇 토큰 연결(5분) ➔ 거래처 방 연동 ➔ 상담원 대량 초대 ➔ 리드 자동 순환 배분 설정.
- **상담원 현장 설치 가이드**:
  - 폰 크롬 접속 ➔ APK 다운로드 ➔ 출처 허용 ➔ Play 프로텍트 '무시하고 설치' ➔ 권한 점검 원터치 완료 (1인당 3분 소요).
- **기종별 호환성 점검표**:
  - 삼성 Galaxy S20~S25, Note, A시리즈, Z플립/폴드 (One UI 3.0~8.0, Android 11~16) 체크리스트.

**Steps:**
- [ ] 1. `docs/manuals/고객사_관리자_온보딩_가이드_v1.md` 작성.
- [ ] 2. `docs/manuals/상담원_앱설치_및_권한설정_v1.md` 작성.
- [ ] 3. `docs/manuals/기종별_호환성_점검표_v1.md` 작성.
- [ ] 4. Git 커밋.

---

### Task 8: 첫 계약 & 입금 확인 당일 "5분 컷 유료 전환 런북" (Runbook) 작성

**Files:**
- Create: `docs/RUNBOOK_UPGRADE_PRO.md`

**Requirements:**
- 고객사 계약서 서명 및 첫 달 이용료 입금이 확인된 순간, 대표님과 엔지니어가 5분 만에 프로 플랜으로 전환하고 비공개로 잠그는 분 단위 매뉴얼.
- 타임라인:
  - 0분: 고객 입금 확인
  - 1분: Supabase 대시보드 ➔ Settings ➔ Billing ➔ Upgrade to Pro (\$25)
  - 2분: Vercel 계정 ➔ Upgrade to Pro (\$20)
  - 3분: GitHub 저장소 (`9981mark-hub/leadmaster-crm`) Settings ➔ Change visibility ➔ **Private** 전환
  - 4분: `AppConfig.WEB_BASE` 새 도메인 연동 상태 점검
  - 5분: 고객사 대표에게 관리자 초대 링크 전달 및 정식 오픈!

**Steps:**
- [ ] 1. `docs/RUNBOOK_UPGRADE_PRO.md` 작성 (클릭할 버튼 위치, 스크린샷 텍스트, 확인 체크리스트).
- [ ] 2. Git 커밋.

---

## Plan Verification

- **무비용 원칙 검증**: 모든 작업은 비용 \$0으로 로컬 및 현 환경에서 100% 완료됨.
- **빌드 무결성 검증**: `npm run build` 오류 0건 유지.
- **멀티테넌트 검증**: `node scripts/verify_multitenant_isolation.mjs` PASS.
- **서명 검증**: APK 서명 지문 `7ee0d49a...` 확인.
