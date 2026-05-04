# 📋 LeadMaster CRM — 마지막 세션 인계

업데이트: 2026-05-02 (대화 ID: ca94df4e — 작업 기억 보조 시스템 구축 세션)

---

## 📌 2026-05-02 세션 (ca94df4e) — 작업 기억 보조 시스템 구축

- [x] KI 카드 생성 완료 (`knowledge/leadmaster-crm/architecture.md`)
- [x] `AGENT_CONTEXT.md` / `LAST_SESSION.md` 확인 및 내용 최신화
- [x] Android 앱 내용은 LeadMaster CRM 컨텍스트에 통합 유지로 결정
- [ ] **다음 작업**: `ExportCaseModal.tsx` 구현 (기획서: `planning_export_cases.md`)

---



### 보안 강화 (2026-04-29)
- [x] Supabase 전 테이블 RLS 활성화
- [x] Android 앱 익명(Anon) 접근 → 전용 계정(`android-app@leadmaster.com`) JWT 인증으로 전환
- [x] `LeadMasterApi.kt` 자동 로그인 + JWT 토큰 50분 자동 갱신 구현
- [x] `PendingCallWorker.kt` → `LeadMasterApi` 인증망 사용으로 변경
- [x] 최종 보안 잠금 SQL 실행 완료

### UI/UX 개선 (2026-04-30)
- [x] 케이스 목록 고객명 hover 시 통화/문자 기록 툴팁 표시
- [x] 툴팁 내 수신/발신/부재중 통화 아이콘 및 통화 시간 표시
- [x] 툴팁 내 기록 순서: 오래된 것 위, 최신 아래 (상세 페이지와 동일)
- [x] 모바일 터치 충돌 해결: 고객명 우측 `History` 아이콘 클릭으로 툴팁 트리거 분리
- [x] 케이스 목록 검색 시 SMS 내용도 검색 가능 (debounce 0.5초)
- [x] 모바일 케이스 관리 헤더 반응형 레이아웃 수정

### 정렬 및 데이터
- [x] 1차 상태 `statusStages` 키 동기화 버그 수정 (모바일 캐시 미반영 문제)
- [x] 통화/문자 기록 전체 재동기화 (CommunicationSyncWorker 초기화)
- [x] 케이스 등록 페이지 → 단일 스크롤 페이지로 변경 (스텝 위저드 제거)
- [x] 캘린더 음력 반복 이벤트 구현 (주간/월간/연간 + 음력 변환)
- [x] 오늘 일정 페이지 Click-to-Call 기능 구현

---

## 🔄 현재 진행 중인 작업

### ExportCaseModal 구현 (기획 완료, 코드 미구현)
- 기획 문서: `planning_export_cases.md`
- 구현해야 할 것:
  - [ ] `ExportCaseModal.tsx` 컴포넌트 신규 생성
  - [ ] `utils/xlsxExport.ts`에 `exportCustomCases` 함수 추가
  - [ ] `CaseListHeader.tsx`에 버튼 위치 변경 및 모달 연결
- 기능 요구사항:
  - 추출 범위: 전체 / 담당자별 / 기간별 / 특정 케이스
  - 상태 필터: 전체 / 특정 상태 선택
  - 날짜 범위: 이번달 / 이번주 / 직접 설정
  - 다운로드: Excel(.xlsx) 형식

---

## 📌 다음 대화 시작 시 체크리스트

1. `AGENT_CONTEXT.md` 읽기 ✓ (이미 읽고 있다면 생략)
2. 이 파일(`LAST_SESSION.md`) 읽기 ✓
3. `planning_export_cases.md` 읽기 (ExportCaseModal 작업 시)
4. 필요한 파일 확인 후 작업 시작

---

## 📂 마지막으로 수정된 주요 파일들

- `components/case-list/CaseListTable.tsx` — 툴팁 아이콘 변경
- `components/case-list/CommunicationHistoryTooltipContent.tsx` — 툴팁 내용
- `components/case-list/CaseListHeader.tsx` — 모바일 반응형
- `components/HoverCheckTooltip.tsx` — 렌더 함수 지원 추가
- `pages/CaseList.tsx` — SMS 검색 기능 추가
- `services/supabase.ts` — `searchCommunicationLogsPhones` 함수 추가
- `services/api.ts` — `statusStages` 키 수정
- `LeadMasterApp/LeadMasterApi.kt` — JWT 자동 갱신, 인증 강화
- `LeadMasterApp/PendingCallWorker.kt` — LeadMasterApi 인증망 사용

---

## ⚠️ 주의사항

- **배포**: `git push origin main` → GitHub Actions → Vercel 자동 배포 (2~3분 소요)
- **상태 키**: `statusStages` (구 `statuses` 아님)
- **Android 빌드**: 코드 수정 후 Android Studio에서 직접 빌드/설치 필요
