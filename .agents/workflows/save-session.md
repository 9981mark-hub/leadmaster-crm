---
description: 대화 단기 기억 손실 방지, 원본 로그 스캔, ADR-lite 기록, 자동 분할 저장(Batch Save) 및 상태 기반 무결점 병합을 지원하는 세션 저장 명령어 V2.6 (운영 단순화)
---
# /save-session

이 워크플로우는 사용자가 `/save-session` 명령어를 입력했을 때 실행됩니다.
AI 에이전트는 제 자신의 단기 기억(Context Window)에 의존하지 않고, 다음 **V2.6 8단계 프로세스**를 엄격하게 준수하여 장시간의 작업을 누락 없이 안전하게 세션으로 기록해야 합니다. (사용자는 하루 끝에 `/save-session` 한 번만 입력하면 되며, 시스템은 백그라운드에서 자동으로 Auto Batch, Coverage Check, 커서 갱신 검증을 수행합니다.)

## 0단계: 이전 저장 지점 확인 (이중 커서 스캔)
`/save-session` 명령어는 신규 로그만 안전하게 저장하기 위해 먼저 상태 파일을 확인합니다.
- **대상 파일**: `<appDataDir>\knowledge\<workspace-name>\artifacts\session_state.json`
- **고정 스키마**:
```json
{
  "project": "<workspace-name>",
  "conversation_id": "<conversation-id>",
  "last_session_save_id": "20260511-0942",
  "last_saved_at": "2026-05-11T09:42:00+09:00",
  "last_processed_line": 1842,
  "last_processed_log_hash": "sha256:<전체 로그 해시>",
  "last_processed_tail_hash": "sha256:<마지막 20줄 해시>",
  "last_git_branch": "main",
  "last_git_commit": "<commit-sha>",
  "last_workflow_version": "save-session-v2.5"
}
```
- **이중 커서 규칙**: `last_processed_line` 단독 사용을 금지합니다. 현재 로그의 이전 tail hash나 log hash가 기존 값과 다르면 전체 로그를 재스캔하되, 기존 `session_save_id` 기준으로 중복을 방지합니다.

## 1단계: 미저장 로그 전체 범위 확정
1. `<appDataDir>\brain\<conversation-id>\.system_generated\logs\overview.txt` 파일을 읽어옵니다.
2. `session_state.json`의 `last_processed_line + 1`부터 현재 `overview.txt`의 마지막 줄까지를 **미저장 로그 전체 범위**로 확정합니다. (예: line 2251-6420)
3. 미저장 범위 전체를 반드시 처리해야 하며, 중간 일부만 요약하거나 생략해서는 절대 안 됩니다.

## 2단계: 작업 단위 자동 분할 (Batch Save - Auto Mode)
`/save-session`은 기본적으로 `batch_mode: auto`로 동작합니다. 미저장 범위 길이에 따라 AI가 알아서 분할 여부를 결정합니다.
- **500줄 이하**: 단일 Save Point로 저장
- **501~2500줄**: 작업 전환 신호가 있으면 2~4개 Save Point로 자동 분할
- **2501줄 이상**: Batch Mode 자동 활성화 (기본 3~8개 권장, 최대 12개를 넘지 않도록 유사 작업 병합)

**[작업 분할 기준]**
1. 사용자가 새로운 목표를 말한 시점
2. 주요 파일군이 바뀐 시점
3. `git commit` 또는 `git push` 발생 시점
4. 빌드/테스트/린트 등의 검증 단계 종료 시점
5. 큰 에러 발생 및 해결이 완료된 시점
6. `pending_tasks` 상태 변경이 발생한 시점
7. 60~120분 이상의 긴 시간 간격이 발생한 시점
8. **작업 전환 마커가 등장한 시점 (최우선 존중)**
   - 허용되는 마커 별칭: `[전환]`, `[CHECKPOINT]`, `[체크포인트]`, `[작업전환]`, `[다음작업]`

**[Save Point 분할 크기 및 개수 제한 규칙]**
- **개수 제한**: 최대 12개를 초과하지 않도록 합니다. 초과 시 유사한 작업을 병합하되 `[전환]` 마커는 최우선적으로 존중합니다.
- **크기 제한**: 하나의 Save Point가 1500~2500 lines를 초과하면 추가 분할을 검토합니다. 단, 끊을 수 없는 단일 에러 분석 흐름이나 긴 테스트 로그 구간인 경우는 예외로 묶어 유지합니다.

## 3단계: 분할된 Save Point별 데이터 구조화
분할된 각 Save Point마다 다음 포맷으로 구조화합니다.

- `### 💾 Save Point: YYYY-MM-DD HH:mm KST`
- `- save_point_id`: 20260511-1045-01 (날짜-시간-일련번호)
- `- session_save_id`: 20260511-1045 (상위 배치 ID)
- `- log_range`: line 2251-2810 (해당 조각의 원본 로그 범위)
- `- content_hash`: sha256:<hash> (중복 방지용 해시)
- `### 🎯 작업 목표`
- `### ⏱️ 시간순 작업 로그`
- `### 📂 변경 파일 요약`
- `### ❌ 에러 및 해결 (Troubleshooting)`
- `### 🤔 주요 의사결정 및 작업 맥락 (ADR-lite)`

## 4단계: 저장 전 검증, 백업 및 원본 아카이브 생성
모든 Save Point들을 `session_history.md`에 병합하기 전, 빈 내용이나 중복이 없는지 자체 검증합니다.

**[백업 생성]**
`<appDataDir>\knowledge\<workspace-name>\artifacts\backups\` 폴더에 `session_history.[session_save_id].bak.md` 및 `pending_tasks.[session_save_id].bak.md` 를 생성합니다.

**[Raw Session Archive]**
최근 30개 세션 원본은 압축 없이 `<appDataDir>\knowledge\<workspace-name>\artifacts\raw_sessions\<session_save_id>\`에 유지하고, 이전 세션은 압축 보관합니다. `index.json`을 통해 검색성을 확보합니다. `.gitignore`를 통해 아카이브와 백업은 반드시 커밋에서 제외합니다.

## 5단계: 지식 베이스 병합 및 Batch Coverage 검증
작성된 여러 개의 Save Point를 순서대로 `<appDataDir>\knowledge\<workspace-name>\artifacts\session_history.md`에 Append 합니다.

**[All-or-nothing 커서 업데이트 원칙 및 복구]**
- 저장이 완료되면 원본 미저장 범위(2251-6420)와 분할된 Save Point들의 `log_range`를 대조하여 **누락이나 중복이 없는지 Coverage 검증**을 수행합니다.
- Coverage 검증까지 모두 통과한 **최종 성공 시에만** `session_state.json`의 커서를 마지막 라인(예: 6420)으로 전진시킵니다.
- 중간에 오류가 발생하면 즉시 백업(`bak.md`)에서 복구하고 커서를 전진시키지 않으며, `recovery_required: true`를 남깁니다.

**[저장 실패 시 사용자 안내문 규칙]**
만약 저장이 실패하거나 Coverage 검증을 통과하지 못한 경우, 완료 보고서 대신 다음 안내문을 출력하여 사용자가 당황하지 않도록 합니다:
> ⚠️ **저장 실패 안내**
> - 저장은 완료되지 않았습니다.
> - `session_state.json` 커서는 전진하지 않았습니다.
> - 안전하게 이전 백업본으로 복구했습니다.
> - `recovery_required: true` 상태입니다.
> - 다시 실행 전 `/save-session --dry-run`으로 로그 상태를 확인하세요.

## 6단계: 남은 작업 동기화 (`pending_tasks.md`)
세분화된 상태값(`todo`, `in_progress`, `blocked`, `implemented`, `needs_validation`, `needs_user_review`, `done`)을 기준으로 `pending_tasks.md`를 동기화합니다. 임시 코드 잔존이나 테스트 미통과 시 절대 `done`으로 처리하지 않습니다.
**[Task Transition 규칙]**: 각 Save Point 내부에는 해당 구간에서 발생한 작업 상태의 변화(Transition)를 상세히 기록하되, 실제 `pending_tasks.md` 파일에는 **Batch Save가 종료되는 시점의 최종 상태**만 반영하여 중간 상태가 꼬이는 것을 방지합니다.

## 7단계: 완료 보고 포맷 (고정)
작업이 완료되면 반드시 아래 양식에 맞추어 보고합니다. (V2.6 Batch Save 포맷 적용)

```md
## ✅ /save-session 완료 보고
- workflow_version: save-session-v2.6
- batch_mode: auto
- session_save_id: 20260511-2130
- conversation_id: abc123def
- unsaved_log_range: line 2251-6420
- generated_save_points_count: 4

### 📦 Save Point 분할 범위
1. 20260511-2130-01: line 2251-2810 (작업 요약)
2. 20260511-2130-02: line 2811-3540 (작업 요약)
3. 20260511-2130-03: line 3541-4720 (작업 요약)
4. 20260511-2130-04: line 4721-6420 (작업 요약)

### 🛡️ Coverage Check
- 누락 구간: 없음
- 중복 구간: 없음
- 연속성: PASS
- final_cursor_line: 6420
- session_state.json 갱신: 완료
- 아카이브 경로: raw_sessions/20260511-2130/

### 📋 기타 상태
- 수정된 문서: session_history.md, pending_tasks.md, session_state.json, index.json
- 압축 권장 여부: 양호
- 완료 처리된 태스크: N개 / 신규 등록 태스크: N개
- 복구 발생 여부: false

## 🔴 다음 최우선 작업
(가장 중요한 1개 작업 지시)

## 🚀 다음 세션 시작 프롬프트
(다음 접속 시 바로 복붙 가능한 형태의 요약 프롬프트)
```

---

## 🛠️ 고급 운영 모드 (V2.6)

명령어 실행 시 아래 플래그를 추가하여 고급 기능을 사용할 수 있습니다. (일반 사용자는 하루 끝에 `/save-session`만 사용해도 충분합니다.)

- `/save-session --batch`
  - 기본 `auto` 모드와 동일하며, 명시적으로 배치 저장을 지시할 때 사용합니다.
- `/save-session --checkpoint "<메모>"`
  - 실제 `session_history.md` 저장은 수행하지 않습니다. 현재 overview 로그에 `[CHECKPOINT] <메모>` 형식의 마커를 기록합니다. 
  - ※ 팁: 굳이 명령어를 치지 않고 채팅창에 `[전환] 다음 작업으로 이동` 이라고만 남겨도 동일한 효과를 냅니다.
- `/save-session --dry-run`
  - 실제 파일을 절대 수정하지 않고, V2.5 Batch 분할 Preview를 출력합니다.
  - 출력 포함 내용: `unsaved_log_range`, `generated_save_points_count`, `save_point_ranges` (각 조각의 예상 목표 포함), `coverage_preview`, `final_cursor_line` 예상값.
- `/save-session --force-rescan`
  - `session_state.json` 커서를 무시하고 전체 `overview.txt`를 강제로 재스캔합니다.

**[동시 실행 방지 Lock 규칙]**
병렬 작업 충돌을 막기 위해 `<appDataDir>\knowledge\<workspace-name>\artifacts\.save-session.lock` 파일을 생성합니다. 실패 시에도 finally 단계에서 해제를 시도하며 복구 상황에서는 사용자 확인을 위해 남깁니다. dry-run 시에는 Lock 파일을 생성하지 않습니다.
