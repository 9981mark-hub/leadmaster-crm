# 5분 컷 유료 전환 런북 (Runbook: Upgrade to Pro)
> **실행 시점**: 첫 고객사 계약서 날인 및 첫 달 이용료(예: 30인 기준 ₩144만 원) 입금 확인 즉시  
> **총 소요 시간**: 약 5분  
> **총 월 비용**: \$49 / 월 (약 ₩66,500원) ➔ 마진율 95% 이상  

---

## ⏱️ 분 단위 전환 타임라인

```
[00:00] 고객사 계약서 날인 및 이용료 입금 확인 (계좌 조회)
   ⬇
[00:01] Supabase 대시보드 ➔ Pro 플랜 ($25/mo) 업그레이드
   ⬇
[00:02] Vercel 계정 ➔ Pro 플랜 ($20/mo) 업그레이드
   ⬇
[00:03] GitHub 저장소 (leadmaster-crm) ➔ Private (비공개) 전환
   ⬇
[00:04] 웹 & 안드로이드 앱 통신 무결성 1분 핑 테스트
   ⬇
[00:05] 고객사 대표 구글 이메일로 관리자 초대 발송 및 정식 오픈!
```

---

## [1분] Step 1. Supabase Pro 전환 ($25/월)

- **목적**: 7일 미사용 자동 일시정지(Pause) 원천 방지, 7일 일일 자동 백업 활성화, 100GB 스토리지 및 무제한 이그레스 확보.
- **실행 절차**:
  1. [Supabase Dashboard](https://supabase.com/dashboard/project/oenksfblktflfurxjmtv) 에 접속합니다.
  2. 좌측 메뉴 맨 아래 **`Project Settings` (톱니바퀴)** ➔ **`Billing`** (또는 `Subscription`) 클릭.
  3. **Change Plan** 버튼 클릭 ➔ **`Pro Plan ($25/month)`** 선택.
  4. 결제 카드(해외 결제 가능 법인/개인 카드) 등록 및 결제 승인.
  5. *확인*: 플랜 배지가 `Free`에서 초록색 `Pro`로 바뀐 것을 확인합니다.

---

## [2분] Step 2. Vercel Pro 전환 ($20/월)

- **목적**: 상용 서비스 SLA 확보, 무제한 대역폭(1TB), 팀원 권한 관리.
- **실행 절차**:
  1. [Vercel Dashboard](https://vercel.com/dashboard) 에 접속합니다.
  2. 우측 상단 프로필 ➔ **`Settings`** ➔ **`Billing`** 클릭.
  3. **Upgrade to Pro ($20/month)** 클릭 후 결제 승인.
  4. `Settings` ➔ `Domains`에서 공식 도메인(예: `crm.leadmaster.co.kr`) 연결 여부 점검.

---

## [3분] Step 3. GitHub 저장소 Private (비공개) 전환 ($4/월)

- **목적**: 경쟁사/외부에 리드마스터 CRM 핵심 소스코드 및 비즈니스 로직 유출을 100% 방지.
- **실행 절차**:
  1. [GitHub Settings](https://github.com/settings/billing) 에서 GitHub Pro($4/월) 가입 (또는 무료 비공개 전환).
  2. [leadmaster-crm 저장소 설정](https://github.com/9981mark-hub/leadmaster-crm/settings) 에 접속합니다.
  3. 화면 맨 아래 **`Danger Zone`**으로 스크롤합니다.
  4. **`Change repository visibility`** 버튼 클릭 ➔ **`Make Private`** 선택.
  5. 확인 팝업창에 `9981mark-hub/leadmaster-crm`을 입력하고 확인 버튼 클릭.
  6. *완료*: 저장소가 비공개(Private)로 전환되어 소스코드가 외부에서 완전히 숨겨집니다.

---

## [4분] Step 4. 무결성 1분 핑 테스트

1. 스마트폰에서 리드마스터 앱 실행 ➔ 로그인 정상 확인.
2. PC 브라우저에서 웹 CRM 접속 ➔ 리드 목록 정상 로드 확인.
3. 테스트 리드 1건 전화 걸기 ➔ 폰 진동 및 화면 콜 팝업 출력 확인.

---

## [5분] Step 5. 고객사 테넌트 생성 및 정식 개통 전달

1. 플랫폼 관리자 화면 (`/platform`)에 접속합니다.
2. **`[새 고객 회사]`** 폼에 고객사 명칭(예: `○○컨설팅`)과 대표님 구글 이메일을 입력합니다.
3. **`TM 표준 프리셋 자동 적용`** 체크박스가 켜진 상태에서 `[회사 만들기 & 초대]`를 클릭합니다.
4. 고객사 대표에게 아래 메시지와 함께 개통 안내를 전달합니다:

```text
[리드마스터 CRM 정식 서비스 개통 안내]

○○컨설팅 대표님, 안녕하십니까.
리드마스터 클라우드 CRM의 독립 전용 테넌트 구축 및 보안 세팅이 완료되었습니다.

- 공식 웹 관리자 접속 주소: https://9981mark-hub.github.io/leadmaster-crm/
- 안드로이드 정식 앱 다운로드: https://9981mark-hub.github.io/leadmaster-crm/app/LeadMaster.apk
- 대표자 승인 계정: (등록하신 구글 계정)

접속 가이드 및 상담원 엑셀 대량 초대 매뉴얼을 동봉해 드리오니 업무에 참고하시기 바랍니다.
감사합니다.
```
