# 🧠 LeadMaster CRM — Agent Context

> **Antigravity 필독 문서** | 업데이트: 2026-05-02
> 새 대화 시작 시 이 파일 + `LAST_SESSION.md`를 반드시 먼저 읽을 것

---

## 📌 프로젝트 개요

- **목적**: 개인회생 관련 고객 케이스 관리 CRM (B2B 내부 도구)
- **사용자**: JSH (단일 관리자 + 안드로이드 앱 연동)
- **특징**: PC 웹앱 + Android 앱이 Supabase를 공유 백엔드로 사용

---

## 🛠️ 기술 스택

| 항목 | 기술 |
|------|------|
| 프레임워크 | React + TypeScript + Vite |
| 스타일 | TailwindCSS |
| 백엔드 | Supabase (PostgreSQL + RLS + Edge Functions) |
| 배포 | Vercel (GitHub Actions 자동 배포) |
| Android 앱 | Kotlin (`C:\Users\JSH\Downloads\LeadMasterApp`) |
| 인증 | Google OAuth (Supabase Auth) |

---

## 📁 핵심 파일 맵

```
01_03-leadmaster-crm/
├── App.tsx                          # 라우팅 (RequireAuth 포함)
├── types.ts                         # 전체 TypeScript 타입 정의
├── constants.ts                     # 공통 상수
├── utils.ts                         # 유틸 함수 (exportCustomCases 등)
├── pages/
│   ├── CaseList.tsx                 # 케이스 목록 (검색, 필터, SMS 검색 포함)
│   ├── CaseDetail.tsx               # 케이스 상세 페이지
│   ├── CaseNew.tsx                  # 신규 케이스 등록 (단일 페이지 스크롤 방식)
│   ├── Dashboard.tsx                # 대시보드 (캘린더 위젯 포함)
│   ├── TodaySchedule.tsx            # 오늘 일정 (Click-to-Call 포함)
│   ├── Statistics.tsx               # 통계
│   └── Settings.tsx                 # 설정 (상태 종류, 파트너사 등)
├── components/
│   ├── case-list/
│   │   ├── CaseListTable.tsx        # 케이스 목록 테이블
│   │   ├── CaseListHeader.tsx       # 헤더 (데이터 내보내기 버튼)
│   │   └── CommunicationHistoryTooltipContent.tsx  # 통화/문자 툴팁
│   ├── case-detail/
│   │   └── CaseDetailHeader.tsx     # 케이스 상세 헤더
│   ├── HoverCheckTooltip.tsx        # 범용 툴팁 컴포넌트
│   ├── CalendarWidget.tsx           # 음력 지원 캘린더
│   └── CallConfirmPopup.tsx         # Click-to-Call 팝업
├── services/
│   ├── supabase.ts                  # Supabase 클라이언트 + 쿼리 함수
│   ├── api.ts                       # 앱 데이터 fetch/sync 로직
│   └── queries.ts                   # React Query hooks
├── contexts/
│   └── AuthContext.tsx              # Google OAuth 인증 컨텍스트
├── utils/
│   └── xlsxExport.ts                # Excel 내보내기 유틸
└── supabase/
    └── functions/
        └── telegram-webhook/        # Telegram 웹훅 Edge Function
```

---

## 🗄️ Supabase 데이터베이스

- **프로젝트 ID**: `cenksfblktflfurxjmtv`
- **URL**: `https://cenksfblktflfurxjmtv.supabase.co`

### 주요 테이블
| 테이블 | 설명 |
|--------|------|
| `cases` | 고객 케이스 (이름, 전화번호, 상태, 메모 등) |
| `settings` | 앱 설정 (상태 종류: `statusStages` 키 사용) |
| `partners` | 파트너사 정보 |
| `communication_logs` | 통화/문자 기록 (Android 앱 동기화) |
| `pending_calls` | Click-to-Call 대기 목록 |
| `pending_sms` | 예약 문자 대기 목록 |
| `sms_templates` | 문자 템플릿 |
| `calendar_memos` | 캘린더 메모 (음력 반복 지원) |

### RLS 보안 정책 (중요!)
- **모든 주요 테이블**: Authenticated 사용자만 접근 가능
- **Android 전용 계정**: `android-app@leadmaster.com` (JWT 토큰 인증)
- **익명(Anon) 접근**: 완전 차단 (2026-04-29 보안 강화 완료)
- **communication_logs, pending_calls**: Android 앱 전용 계정만 write 가능

---

## 📱 Android 앱 (LeadMasterApp)

- **경로**: `C:\Users\JSH\Downloads\LeadMasterApp`
- **언어**: Kotlin
- **주요 파일**:
  - `LeadMasterApi.kt` — 인증(JWT 토큰 자동 갱신, 50분마다 refresh) + Supabase 통신
  - `PendingCallWorker.kt` — Click-to-Call 폴링 워커
  - `CommunicationSyncWorker.kt` — 통화/문자 기록 동기화
  - `TelegramFeedbackWorker.kt` — 텔레그램 피드백 동기화
- **인증 방식**: `android-app@leadmaster.com` 계정으로 자동 로그인 후 JWT 토큰 사용
- **토큰 갱신**: 50분마다 자동 재발급 (수동 재로그인 불필요)

---

## 🔄 배포 방식

```bash
git add . && git commit -m "feat: 설명" && git push origin main
# → GitHub Actions 자동 빌드 → Vercel 자동 배포
```

---

## ⚠️ 알려진 이슈 & 중요 패턴

1. **상태 키 주의**: 설정의 상태 종류는 `statusStages` 키 사용 (구 `statuses` 아님)
2. **캐시 동기화**: `performBackgroundFetch`가 설정 동기화 담당
3. **문자 검색**: `searchCommunicationLogsPhones` 함수로 Supabase에서 검색 후 케이스 필터링
4. **툴팁 트리거**: 모바일/PC 모두 `History` 아이콘 클릭으로 통화/문자 기록 표시 (고객명 클릭은 상세 페이지 이동)
5. **통화/문자 정렬**: 오래된 것이 위, 최신이 아래 (카카오톡 방식)

---

## 🔜 현재 진행 중인 작업

- [ ] `planning_export_cases.md` 참고하여 ExportCaseModal 구현 (상세 기획 있음)

---

## 📎 관련 문서

- 작업 인계: `LAST_SESSION.md`
- 내보내기 기획: `planning_export_cases.md`
