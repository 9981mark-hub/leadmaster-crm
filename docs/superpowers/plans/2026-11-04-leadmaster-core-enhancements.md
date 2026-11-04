# LeadMaster CRM Core Feature Enhancements Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Implement 5 high-impact, zero-additional-cost features for LeadMaster CRM focused on 1st-call qualification and office manager hand-off: (1) Slide-out Peek Drawer in CaseList, (2) In-Call 3-Second Debt Relief Calculator, (3) 1-Tap Objection Battlecards, (4) Post-Call 1-Click SMS Follow-Up Dispatcher, and (5) AI Post-Call Schedule Extraction with 1-Click Calendar Add.

**Architecture:** 
- React 18 + Tailwind CSS + Lucide Icons + Framer Motion.
- Clean component decomposition under `components/case-list/` and `components/lite/`.
- Integration into `CaseList.tsx`, `CaseListTable.tsx`, `LiteInCallHud.tsx`, and `LitePostCallSheet.tsx`.
- Android Bridge (`AndroidBridge.makeCall`, `AndroidBridge.sendSms`) & native fallback support (`tel:`, `sms:`).

**Tech Stack:** React 18, TypeScript, Tailwind CSS, Lucide React, Framer Motion, Supabase, date-fns.

**Spec:** `C:\Users\rom96\.gemini\antigravity\brain\682a2d4f-cfa9-4c00-9dfb-8405f9658558\leadmaster-feature-ui-enhancement-proposal.md`

## Global Constraints
- Preserve all existing comments, docstrings, and features.
- Zero extra cloud API cost for Battlecards (100% in-browser).
- Android mobile compatibility with dark/light mode coherence.
- Do not break existing CaseDetail routes (`/case/:id`); Peek Drawer offers fast preview while maintaining full detail navigation.

---

### Task 1: 우측 슬라이드 퀵 인스펙터 (Peek Drawer)
**Files:**
- Create: `components/case-list/CaseDetailDrawer.tsx`
- Modify: `components/case-list/CaseListTable.tsx`
- Modify: `pages/CaseList.tsx`

**Details:**
- Renders a 480px width (or full width on mobile) slide-out drawer using Framer Motion.
- Displays lead status, customer name, phone, birth/gender, job, income, housing, debts, assets, recent memos, and reminders.
- Includes action toolbar:
  - 📞 [전화 걸기] (invokes `handleDial` / `AndroidBridge.makeCall`)
  - 🔄 [상태 변경 셀렉트 박스]
  - 📝 [빠른 한 줄 메모 추가]
  - 🔗 [전체 상세 페이지로 이동 (`/case/:id`)]
  - ⬆️ / ⬇️ [이전 고객 / 다음 고객] 키보드 및 버튼 내비게이션.
- In `CaseListTable.tsx`, clicking a customer row opens the drawer for that customer without leaving the page.

---

### Task 2: 통화 중 실시간 탕감율 & 변제금 3초 즉석 계산기 (In-Call HUD 내장)
**Files:**
- Create: `components/lite/LiteDebtReliefCalculator.tsx`
- Modify: `components/lite/LiteInCallHud.tsx`

**Details:**
- Interactive calculator embedded directly into `LiteInCallHud.tsx`.
- Pre-fills values from the current case (`incomeNet`, `childrenCount`, total debts from `creditLoan`).
- 2026 Korean standard minimum living costs table (1 person ~139만, 2 persons ~231만, 3 persons ~295만, 4 persons ~357만, 5 persons ~418만, 6 persons ~477만).
- Live calculation:
  - Monthly disposable income = `max(0, netIncome - livingCost)`
  - 36-month total repayment = `monthlyDisposable * 36`
  - Total forgiven principal = `max(0, totalDebt - totalRepayment)`
  - Debt forgiveness rate (%) = `(totalForgiven / totalDebt) * 100`
- Instant actions:
  - [📋 계산 결과 복사]
  - [💾 메모에 자동 기록]

---

### Task 3: 1-Tap 원터치 반론 극복 치트키 (Battlecards)
**Files:**
- Create: `components/lite/LiteBattlecards.tsx`
- Modify: `components/lite/LiteInCallHud.tsx`

**Details:**
- 4 primary objection chips:
  1. 💰 [수임료 분납]: 무이자 분납, 착수금 0원, 첫 달 전 금지명령
  2. 🏢 [직장/가족 비밀]: 법원 송달 송달장소 변경, 회사/가족 일체 미통보
  3. 🚫 [기각 걱정]: 기각률 1% 미만, 1차 심사 통과 사건만 수임
  4. ⚡ [사채/독촉]: 접수 3~7일 내 금지명령, 불법추심 즉시 중단
- Tapping a chip slides open a high-readability modal/drawer with bulletproof scripts, key talking points, and empathy hooks.
- Zero API cost, instant 0.05s response time.

---

### Task 4: 통화 후 1-Click 문자/알림톡 템플릿 발송기
**Files:**
- Create: `components/lite/LiteQuickSmsModal.tsx`
- Modify: `components/lite/LitePostCallSheet.tsx`

**Details:**
- Post-Call sheet quick SMS buttons:
  - 📩 [부재중 1차 콜백 안내]
  - 📩 [부재중 2/3차 안내]
  - ⚖️ [사무장 배정 안내] ("1차 자격 검토 완료, 전문 사무장님이 곧 연락드립니다")
- Allows 1-click preview and sending via `AndroidBridge.sendSms` or Android default SMS handler (`sms:010...?body=...`).

---

### Task 5: 통화 녹음 AI 일정 감지 & 1-Click 캘린더 등록
**Files:**
- Modify: `components/lite/LitePostCallSheet.tsx`
- Modify: `services/recordings.ts`

**Details:**
- Checks the latest analyzed recording for appointment/re-call intent or parses appointment keywords ("내일", "오후", "몇시", "재통화").
- Surfaces a prompt card in `LitePostCallSheet`:
  - "💡 감지된 재통화 일정: 2026-11-05 14:00 (고객 재통화 요청)"
  - [📅 캘린더에 원클릭 등록] 버튼 제공 -> 클릭 시 `c.reminders`에 즉시 추가 및 Supabase 동기화.

---

### Task 6: 빌드 검증 및 릴리스 검증
**Files:**
- Build check: `npx vite build` from canonical path `D:\안티그래피티 작업\01_03-leadmaster-crm`.
- Manual/automated verification of all new components and screens.
