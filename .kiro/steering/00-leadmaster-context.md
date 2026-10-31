# 리드마스터(LeadMaster) 프로젝트 맥락

모든 답변·보고는 한국어로 한다.

## 서비스
- 토스애즈·메타·카카오 등 광고로 모은 개인회생/파산 리드를 1차 콜로 상담하고, 기초 내용을 광고 위탁 변호사 사무실(파트너)에 전달하는 영업 CRM.
- 웹 CRM + 안드로이드 앱(구글 플레이 미등록, 삼성폰에 APK 직접 설치). 앱은 웹을 WebView로 띄우고 전화·문자·팝업 등 네이티브 기능을 붙인다.
- 2026-11-01: 같은 업종의 다른 회사(광고 + 광고 수신동의 DB로 1차 콜 후 채무 정리해서 변호사·사무장에게 전달)에 **유료 판매하기로 함**. 지금까지는 사용자 1명(본인) 전용.
- 고도화 기획서: `docs/기획서_리드마스터_SaaS_고도화_v1.md` (권장안: 멀티테넌트, 회사별 데이터 분리·사용자 권한·앱 사용자 로그인이 판매 전 필수). 13장 질문에 대한 사용자 답변을 받으면 이 파일과 기획서를 갱신한다.
- 확정(2026-11-01): **멀티테넌트**, 시작은 빠른 시일 내, 고객사 상담원 **30명**(대부분 삼성, 5년 이내 기종 ≈ Android 11~16), 변호사 사무실 전달은 **텔레그램**(회사별 봇 자동 전송 + 답장으로 회신 연결 방향). 진행 순서는 기획서 15.2: 기반 정리 → 회사 분리 → 사용자·앱 → 전달·배정 → 3~5명 시범 운영 → 30명 오픈.
- 순서 주의: 저장소 비공개 전에 새 호스팅 배포 + 새 주소 여는 앱 설치가 먼저(GitHub Pages가 멈춤).
- 확정(2026-11-01 추가): 고객사 상담원 전원 구글 계정 → **구글 로그인만**. 변호사 사무실이 만든 텔레그램 방이 이미 있음 → 그 방에 회사 봇 초대. **유료 플랜(Supabase Pro 등)은 시스템 완성 후** 전환, 개발·시범은 무료 플랜(대역폭 5GB 주의).
- 멀티테넌트 설계: `docs/설계_멀티테넌트_v1.md`, SQL `supabase/migrations/004~006` (운영 미실행), 로컬 점검 `supabase/tests/multitenant_rls_test.mjs`(PGlite, 21항목 통과). 핵심: org_id 기본값 = `current_org_id()` → 기존 코드가 org_id 없이 INSERT해도 자기 회사로 저장. 본사 org id `00000000-0000-0000-0000-000000000001`.
- **고객사 회사 생성 전에 telegram-webhook을 회사별로 고쳐 배포해야 함**(지금은 service_role로 전 회사 리드를 이름 검색).
- 확정(2026-11-01): **상담원은 관리자가 배정한 본인 리드만** 본다(`cases.assigned_user_id`, 상담원 직접 등록 시 자동 본인 배정, 넘기기 불가). 통화기록·전화요청·자동통화·피드백도 본인 것만. `2882a@naver.com` = 본사 admin. 앱 서비스 계정은 전환기간 admin. 로컬 점검 44항목 통과.
- 2026-11-01 운영 DB 백업: `D:\LeadMaster_Backup\20261101_0130_before_multitenant` (public 전체 dump, 스키마 SQL, auth.users, 정책 목록, 건수: cases 1463 / communication_logs 13886 / settings 17 / telegram_feedbacks 419). 고객 개인정보 포함, git·클라우드에 올리지 않는다. 도구: `D:\Tools\pgsql17\bin` (pg_dump 17.7), 접속 확인 스크립트는 `%TEMP%\lm-sqltest\dbping.mjs`.
- 운영 실제 상태(백업에서 확인): auth 사용자 3명(9981mark@gmail.com, beanhull@gmail.com, android-app), allowedEmails = [9981mark, beanhull]. `2882a@naver.com`은 미가입 → 004에서 본사 admin 초대로 생성. "Authenticated users can do all on …" 정책 때문에 아무 로그인 계정이나 전체 접근 가능했음 → `003b_close_any_login_access.sql` **2026-11-01 사용자가 운영 실행 완료**. 재점검: 열린 정책 0개, 모르는 구글 계정 0건, 9981mark·beanhull 전체, 앱 계정 필요한 테이블만.
- 계정: **9981mark@gmail.com = HOST(대표, owner·플랫폼 관리자)**, **beanhull@gmail.com = 대표 본인 서브계정(본사 admin 유지)**, 2882a@naver.com = 본사 admin(미가입, 초대로 생성).
- 스테이징: `leadmaster-staging` (eu-west-3). 2026-11-01 운영 구조 복원 + 003b + 가짜 데이터 + 004/005 적용, 실제 Supabase에서 35항목 통과(`%TEMP%\lm-sqltest\staging_test.mjs`, 재실행 시 organizations 있으면 중단). 테스트 고객사 '테스트고객사' 생성됨. Realtime publication은 스테이징에 복원 안 됨(웹 연결 시험 전 추가 필요). 실제 고객 데이터는 스테이징(EU)에 넣지 않는다. 접속 정보 `.env.local`의 `SUPABASE_STAGING_DB_URL`/`SUPABASE_STAGING_DB_PASSWORD`.
- 운영 DB: Postgres 17, 세션 풀러 호스트 `aws-1-ap-northeast-2.pooler.supabase.com:5432`, 사용자 `postgres.cenksfblktflfurxjmtv`. DB 비밀번호는 `.env.local`의 `SUPABASE_DB_PASSWORD`(사용자가 직접 입력, 채팅·로그에 출력 금지).

## 경로 (2026-10-31 확인)
- 웹 CRM: `D:\안티그래피티 작업\01_03-leadmaster-crm` (GitHub `9981mark-hub/leadmaster-crm`, 브랜치 `main`, 공개 저장소)
- 안드로이드 앱 원본: `D:\안드로이드 스튜디오 작업\Projects\LeadMasterApp` (git `master`, 원격 저장소 없음)
- `D:\안티그래피티 작업\LeadMasterApp` 는 파일 없는 빈 껍데기 폴더다. 작업하지 않는다.
- 2026-10-24 폴더 이동 때 `D:\안티그래피티 작업` 아래 여러 프로젝트가 빈 폴더만 남았다. CRM은 2026-10-31 GitHub에서 복원했다.
- 백업본: `D:\다운로드_전체백업\01_03-leadmaster-crm`, `D:\다운로드_전체백업\LeadMasterApp`. 2026-10-31 비교 결과 작업 폴더와 내용이 같다(CRM a187e0c, 앱 87123d5 + AndroidBridge.kt 미커밋 변경 동일). 백업본은 읽기 전용 참고로만 두고 수정하지 않는다.
- 마이김변(legal-crm, DB `xgmmv…`)과 리드마스터(DB `cenks…`)는 완전히 별개 서비스. 코드·DB·계정을 섞지 않는다.

## 인계서(2026-10-31) 검증 결과
- ExportCaseModal은 이미 구현·연결됨(`components/case-list/ExportCaseModal.tsx`, `pages/CaseList.tsx`). 2026-10-31 "상태변경일 기준" 추가(statusLogs 최신 changedAt, 없으면 등록일). 엑셀 날짜는 한국 시간 기준.
- 통화 종료 시 메모 팝업 유실: 사실. `PhoneMonitorService.hideAllOverlays()` → `FloatingButtonService.ACTION_HIDE` → `hideAllViews()`가 작성 중인 메모 창까지 제거.
- 녹음 자동 업로드: 앱에 없음. 웹에서 수동 업로드 → Apps Script → 구글 드라이브(`ANYONE_WITH_LINK` 공개 링크).
- AI 요약: `cases.ai_summary` 한 칸에 덮어씀. 특이사항 일부만 specialMemo로 누적. Gemini는 브라우저에서 직접 호출.
- 랜딩 리드: Apps Script `create_external`로 시트에 쌓임. 시트 → Supabase로 옮기는 코드는 레포에 없음(실제 경로 사용자 확인 필요).
- 수신 팝업 이전 고객 노출: PhoneNumberCache(callId·generation)로 일부 대응됨. 현재도 재현되는지 사용자 확인 필요.

## 배포
- 실제 운영: `main` push → GitHub Actions(`.github/workflows/deploy.yml`) → GitHub Pages `https://9981mark-hub.github.io/leadmaster-crm/` (vite `base: '/leadmaster-crm/'`). 앱 WebView도 이 주소를 연다.
- Vercel(`0103-leadmaster-crm-sigma.vercel.app`)은 보조 배포. 앱은 이 도메인을 외부 브라우저로 넘긴다.
- GitHub push 계정은 `markjin9981` (`gh auth switch --user markjin9981`). `legal-crm` 계정으로는 403.
- 빌드 확인: `npx tsc --noEmit`, `npx vite build`. git 명령은 페이저 때문에 멈추므로 `$env:GIT_PAGER='cat'` 또는 `--no-pager`.

## 웹 구조 요약
- React 19 + Vite 6 + TS, HashRouter, React Query, Supabase(프로젝트 ref `cenksfblktflfurxjmtv`), Gemini.
- 핵심 파일: `services/api.ts`(로컬 캐시·동기화·CRUD), `services/supabase.ts`(DB 매핑·Realtime·pending_calls/pending_sms), `App.tsx`(라우트), `supabase/functions/telegram-webhook`(파트너 텔레그램 피드백 자동 분류·반영).
- 설정값 대부분(partners, statusStages, geminiApiKey 등)은 `settings` 테이블 key/value JSON.
- Egress(대역폭) 초과 이력 있음(2026-07). 전체 cases 재조회를 늘리는 변경은 피한다.

## 앱 ↔ 웹 연동 계약
- JS 인터페이스 `window.AndroidBridge`: isAndroidApp, makeCall, makeCallWithAccount, getPhoneAccounts, getPopupSettings, getAppTheme, setPopupTemplate, setFloatingButtonEnabled, getAvailableTemplates, setMissedCallConfig, openReceiptCamera, isReceiptCameraAvailable.
- 앱 → 웹 콜백: `window.onReceiptCameraResult(dataUrl|null)`. 정산 화면 영수증 스캔(OCR)용. 2026-10-31 웹 `ReceiptOcrSection`을 `AndroidBridge` + `onReceiptCameraResult`로 맞춤(옛 이름 `window.Android`/`onReceiptImageCaptured`도 호환). 사용자가 쓰는 기능이므로 유지.
- URL: `tel:`(다이얼러), `autocall:`(바로 발신).
- Supabase 경유: PC 클릭투콜 → `pending_calls` → 앱 폴링 발신. 문자 → `pending_sms`. 앱이 통화/문자 기록을 `communication_logs`에 업로드.

## 앱 빌드 주의
- 빌드 JDK는 17: `D:\안드로이드 스튜디오 작업\jdk17`. Android Studio 내장 jbr(Java 25)로는 Gradle 8.13이 실패한다.
- 서명: 이 PC의 `%USERPROFILE%\.android\debug.keystore`(SHA-256 `66b2246b…`)가 폰에 깔린 기존 APK와 같은 키. 사본 `D:\안드로이드 스튜디오 작업\Config_Backup\leadmaster-debug.keystore`. 다른 PC에서 빌드하면 이 사본을 복사해야 업데이트 설치가 된다.
- 배포할 때마다 `app/build.gradle.kts` versionCode를 1씩 올린다(2026-10-31 기준 2 / 1.1.0). release 서명은 `keystore.properties`가 있을 때만(선택).
- 2026-10-31 `.gitignore` 추가, build/.gradle/.idea/local.properties를 git 추적에서 뺐다(파일은 그대로).

## 동기화(Egress) 구조 (2026-10-31 변경)
- 첫 로딩·수동 새로고침·마지막 전체 동기화 후 6시간 경과 → 전체 동기화(`performBackgroundFetch`).
- 탭/앱 복귀, Realtime 재연결 → `performIncrementalFetch`: `cases.updated_at >= 마지막 조회 - 2분`만 받음. settings는 바뀐 key가 있을 때만 전체 settings 재조회.
- 증분 동기화는 `cases.updated_at` 갱신에 의존한다. 서버 쪽에서 cases를 고치는 코드(edge function, 앱)는 updated_at도 같이 써야 한다(트리거 `cases_updated_at`도 있음).
- Realtime(`app-realtime`)이 끊기면 지수 백오프로 실제 재구독(최대 5회).

## DB 보안(RLS) 현황 (2026-10-31 anon 키로 점검)
- anon으로 보이던 테이블: `pending_sms`(15건), `auto_dial_batches`(1건), `auto_dial_items`(206건, 고객명·번호). 나머지는 0건.
- 잠금 SQL: `supabase/migrations/003_lock_anon_tables.sql` (화이트리스트 로그인 사용자 + 앱 서비스 계정만 허용). **2026-11-01 운영 DB 실행 완료**, 재점검 결과 anon으로 모든 테이블 0건.
- 앱 `AutoDialWorker`는 서비스 계정 토큰을 쓰도록 바꿈(기존 anon 키 직접 사용). `PendingCallWorker`의 anon 전용 미사용 코드 삭제.

## 보안 규칙
- 키·비밀번호·토큰 값은 답변이나 로그에 그대로 쓰지 않는다(마스킹).

## 작업 진행 규칙 (2026-11-01 사용자 지정, 속도 우선)
- **묻지 않고 진행**: 스테이징 DB 작업, 내 PC 테스트, 문서·설계, 로컬 커밋.
- **진행 후 보고**: 웹 코드 수정 → `tsc`·`vite build` 통과 → GitHub push → 운영 사이트(GitHub Pages) 배포. 배포 후 무엇이 바뀌었는지와 확인할 점을 보고.
- **반드시 먼저 확인**: 운영 DB 변경(SQL 실행), 고객사 회사 생성, 앱(APK) 배포, 비용이 드는 작업, 되돌리기 어려운 작업.
- 사용자 확인을 기다리는 동안에도 확인이 필요 없는 다음 작업(웹 코드 준비 등)을 병행한다.
