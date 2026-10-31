// 멀티테넌트 RLS 로컬 점검 (2026-11-01)
import { PGlite } from '@electric-sql/pglite';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

// 실행: (임시 폴더에서) npm i @electric-sql/pglite 후 node <이 파일 경로>
// 운영 DB에 접속하지 않는다. 메모리 안의 Postgres에 001~005를 적용해 회사 분리 권한을 점검한다.
const MIG = fileURLToPath(new URL('../migrations/', import.meta.url));
const db = new PGlite();
let failures = 0;
const ok = (cond, msg) => { console.log(`${cond ? 'PASS' : 'FAIL'}  ${msg}`); if (!cond) failures++; };

const HQ = '00000000-0000-0000-0000-000000000001';
const U_OWNER = '11111111-1111-1111-1111-111111111111'; // 9981mark@gmail.com
const U_APP   = '22222222-2222-2222-2222-222222222222'; // android-app
const U_OTHER = '33333333-3333-3333-3333-333333333333'; // 2882a@naver.com
const U_B     = '44444444-4444-4444-4444-444444444444'; // 고객사 상담원
const U_B_ADM = '55555555-5555-5555-5555-555555555555'; // 고객사 대표

// Supabase 환경 흉내 (auth 스키마, 역할, publication)
await db.exec(`
  CREATE ROLE anon NOLOGIN; CREATE ROLE authenticated NOLOGIN; CREATE ROLE service_role NOLOGIN BYPASSRLS;
  CREATE SCHEMA auth;
  CREATE TABLE auth.users (id uuid PRIMARY KEY, email text, last_sign_in_at timestamptz);
  CREATE FUNCTION auth.jwt() RETURNS jsonb LANGUAGE sql STABLE AS $$
    SELECT coalesce(nullif(current_setting('request.jwt.claims', true), ''), '{}')::jsonb $$;
  CREATE FUNCTION auth.uid() RETURNS uuid LANGUAGE sql STABLE AS $$ SELECT nullif(auth.jwt()->>'sub', '')::uuid $$;
  CREATE FUNCTION auth.role() RETURNS text LANGUAGE sql STABLE AS $$ SELECT auth.jwt()->>'role' $$;
  CREATE PUBLICATION supabase_realtime;
  GRANT USAGE ON SCHEMA public, auth TO anon, authenticated, service_role;
  GRANT EXECUTE ON ALL FUNCTIONS IN SCHEMA auth TO anon, authenticated, service_role;
  ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT ALL ON TABLES TO anon, authenticated, service_role;
`);

const runFile = async (f) => {
  // PGlite에는 pgcrypto 확장이 없다. gen_random_uuid()는 PG13+ 기본 내장이라 확장 줄만 뺀다.
  const sql = readFileSync(MIG + f, 'utf8').replace(/^\s*CREATE EXTENSION[^\n]*$/gim, '-- (test) extension skipped');
  try { await db.exec(sql); console.log(`OK    ran ${f}`); }
  catch (e) { console.log(`FAIL  ${f}: ${e.message}`); failures++; process.exit(1); }
};

await runFile('001_complete_schema.sql');
await runFile('002_auto_dial.sql');
await runFile('003_lock_anon_tables.sql');

// 기존 운영 데이터 흉내
await db.exec(`
  INSERT INTO auth.users VALUES
    ('${U_OWNER}', '9981mark@gmail.com', now()), ('${U_APP}', 'android-app@leadmaster.com', now()),
    ('${U_OTHER}', '2882a@naver.com', now()), ('${U_B}', 'agent@customer.com', now()),
    ('${U_B_ADM}', 'boss@customer.com', now());
  INSERT INTO settings (key, value) VALUES
    ('allowedEmails', '["9981mark@gmail.com","2882a@naver.com"]'), ('partners', '[{"partnerId":"P001"}]');
  INSERT INTO cases (case_id, customer_name, phone, updated_at) VALUES
    ('C1', '홍길동', '01011112222', '2026-09-01T00:00:00Z'), ('C2', '김철수', '01033334444', '2026-09-02T00:00:00Z');
  INSERT INTO communication_logs (phone_number, type, timestamp) VALUES ('01011112222', 'CALL_OUT', now());
  INSERT INTO telegram_feedbacks (message_id, sender_name, feedback_type, feedback_content, chat_id) VALUES (100, 'A', '부재', 'x', '-1');
  INSERT INTO pending_sms (phone_number, content) VALUES ('01011112222', 'hi');
`);

await runFile('004_multitenant_core.sql');
await runFile('005_multitenant_rls.sql');

// 테스트용 고객 회사 B
await db.exec(`
  INSERT INTO organizations (id, name, slug) VALUES ('00000000-0000-0000-0000-0000000000b2', '고객사B', 'b');
  INSERT INTO org_members (org_id, user_id, role) VALUES
    ('00000000-0000-0000-0000-0000000000b2', '${U_B}', 'agent'),
    ('00000000-0000-0000-0000-0000000000b2', '${U_B_ADM}', 'admin');
`);

// 특정 사용자로 쿼리 실행 (트랜잭션 + ROLLBACK)
const as = async (role, uid, email, sql, keep = false) => {
  await db.exec('BEGIN');
  try {
    await db.exec(`SET LOCAL ROLE ${role}`);
    const claims = uid ? JSON.stringify({ sub: uid, email, role }) : '';
    await db.query(`SELECT set_config('request.jwt.claims', $1, true)`, [claims]);
    const r = await db.query(sql);
    await db.exec(keep ? 'COMMIT' : 'ROLLBACK');
    return { rows: r.rows };
  } catch (e) {
    await db.exec('ROLLBACK');
    return { error: e.message };
  }
};
const n = async (role, uid, email, table) => Number((await as(role, uid, email, `SELECT count(*)::int AS c FROM ${table}`)).rows?.[0]?.c ?? -1);

// 1. 백필
const nulls = (await db.query(`SELECT count(*)::int c FROM cases WHERE org_id IS NULL`)).rows[0].c;
ok(nulls === 0, 'cases org_id 비어 있는 행 없음');
const upd = (await db.query(`SELECT updated_at FROM cases WHERE case_id='C1'`)).rows[0].updated_at;
ok(new Date(upd).toISOString().startsWith('2026-09-01'), `백필 때 updated_at 유지 (${new Date(upd).toISOString()})`);
const members = (await db.query(`SELECT u.email, m.role FROM org_members m JOIN auth.users u ON u.id=m.user_id WHERE m.org_id='${HQ}' ORDER BY 1`)).rows;
console.log('      본사 멤버:', members.map(m => `${m.email}=${m.role}`).join(', '));
ok(members.length === 3, '본사 멤버 3명');
ok(members.find(m => m.email === '2882a@naver.com')?.role === 'admin', '2882a@naver.com = 본사 admin');
ok(members.find(m => m.email === 'android-app@leadmaster.com')?.role === 'admin', '앱 서비스 계정 = 전환기간 admin');

// 2. 회사별 조회
ok(await n('authenticated', U_OWNER, '9981mark@gmail.com', 'cases') === 2, '본사 owner: 본사 리드 2건 보임');
ok(await n('authenticated', U_APP, 'android-app@leadmaster.com', 'pending_sms') === 1, '앱 서비스 계정: 본사 문자 대기열 보임');
ok(await n('authenticated', U_B, 'agent@customer.com', 'cases') === 0, '고객사 상담원: 본사 리드 0건');
ok(await n('authenticated', U_B, 'agent@customer.com', 'communication_logs') === 0, '고객사 상담원: 본사 통화기록 0건');
ok(await n('authenticated', U_B, 'agent@customer.com', 'settings') === 0, '고객사 상담원: 본사 설정 0건');
ok(await n('anon', null, null, 'cases') === 0, 'anon: 리드 0건');
ok(await n('anon', null, null, 'pending_sms') === 0, 'anon: 문자 대기열 0건');
ok(await n('anon', null, null, 'auto_dial_items') === 0, 'anon: 자동통화 목록 0건');

// 3. 기본값으로 org_id 자동 입력 (웹 코드가 org_id를 안 보내는 경우)
let r = await as('authenticated', U_B, 'agent@customer.com',
  `INSERT INTO cases (case_id, customer_name, phone) VALUES ('B1','고객사고객','01055556666') RETURNING org_id`, true);
ok(r.rows?.[0]?.org_id === '00000000-0000-0000-0000-0000000000b2', `고객사 상담원 등록 → 고객사 org_id 자동 (${r.error || r.rows?.[0]?.org_id})`);
const b1 = (await db.query(`SELECT assigned_user_id FROM cases WHERE case_id='B1'`)).rows[0];
ok(b1?.assigned_user_id === U_B, '상담원이 직접 등록한 리드 → 본인 자동 배정');
ok(await n('authenticated', U_OWNER, '9981mark@gmail.com', 'cases') === 2, '본사 owner: 고객사 리드는 안 보임 (여전히 2건)');

// 4. 다른 회사 데이터 수정·이동 시도
r = await as('authenticated', U_B, 'agent@customer.com', `UPDATE cases SET status='해킹' WHERE case_id='C1' RETURNING case_id`);
ok(!r.error && r.rows.length === 0, '고객사 상담원: 본사 리드 수정 0건');
r = await as('authenticated', U_B, 'agent@customer.com', `INSERT INTO cases (case_id, org_id, customer_name) VALUES ('X1','${HQ}','침투')`);
ok(!!r.error, '고객사 상담원: 본사 org_id로 직접 등록 거부');
r = await as('authenticated', U_B, 'agent@customer.com', `UPDATE cases SET org_id='${HQ}' WHERE case_id='B1' RETURNING case_id`);
ok(!!r.error, '고객사 상담원: 자기 리드를 본사로 옮기기 거부');

// 5. 설정: 웹의 upsert(key,value) 그대로 동작 + 상담원은 쓰기 불가
r = await as('authenticated', U_B_ADM, 'boss@customer.com',
  `INSERT INTO settings (key, value) VALUES ('partners', '[{"partnerId":"P001","name":"B법무"}]')
   ON CONFLICT (org_id, key) DO UPDATE SET value = EXCLUDED.value RETURNING org_id`, true);
ok(r.rows?.[0]?.org_id === '00000000-0000-0000-0000-0000000000b2', `고객사 관리자: 같은 key 'partners' 따로 저장 (${r.error || 'ok'})`);
const hqPartners = (await db.query(`SELECT value FROM settings WHERE org_id='${HQ}' AND key='partners'`)).rows[0].value;
ok(JSON.stringify(hqPartners) === '[{"partnerId":"P001"}]', '본사 partners 설정은 그대로');
r = await as('authenticated', U_B, 'agent@customer.com',
  `INSERT INTO settings (key, value) VALUES ('statusStages', '[]') ON CONFLICT (org_id, key) DO UPDATE SET value = EXCLUDED.value`);
ok(!!r.error, '고객사 상담원: 설정 변경 거부');
r = await as('authenticated', U_B, 'agent@customer.com', `DELETE FROM cases WHERE case_id='B1' RETURNING case_id`);
ok(!r.error && r.rows.length === 0, '상담원: 리드 영구 삭제 0건');
r = await as('authenticated', U_B_ADM, 'boss@customer.com', `DELETE FROM cases WHERE case_id='B1' RETURNING case_id`);
ok(r.rows?.length === 1, '관리자: 리드 영구 삭제 가능');

// 6. 텔레그램: 같은 message_id, 다른 방 허용 / 웹훅(service_role) 전환기간 기본값
r = await as('service_role', null, null,
  `INSERT INTO telegram_feedbacks (message_id, sender_name, feedback_type, feedback_content, chat_id) VALUES (100,'B','부재','y','-2') RETURNING org_id`, true);
ok(r.rows?.[0]?.org_id === HQ, `웹훅(service_role) org_id 미지정 → 전환기간 본사 기본값 (${r.error || r.rows?.[0]?.org_id})`);
r = await as('service_role', null, null,
  `INSERT INTO telegram_feedbacks (message_id, sender_name, feedback_type, feedback_content, chat_id) VALUES (100,'B','부재','y','-2')`);
ok(!!r.error, '같은 방·같은 message_id 중복은 거부 (웹훅 중복 처리 유지)');
r = await as('service_role', null, null, `INSERT INTO cases (case_id, customer_name) VALUES ('S1','x')`);
ok(!!r.error, 'service_role이 cases에 org_id 없이 등록 → 거부 (실수 방지)');

// 7. 초대 수락
await db.exec(`INSERT INTO org_invites (org_id, email, role) VALUES ('00000000-0000-0000-0000-0000000000b2', 'new@customer.com', 'agent')`);
await db.exec(`INSERT INTO auth.users VALUES ('66666666-6666-6666-6666-666666666666', 'New@Customer.com', now())`);
r = await as('authenticated', '66666666-6666-6666-6666-666666666666', 'New@Customer.com', `SELECT public.accept_my_invites() AS c`, true);
ok(r.rows?.[0]?.c === 1, `초대 수락 함수: 1건 수락 (${r.error || JSON.stringify(r.rows?.[0])})`);
r = await as('authenticated', '66666666-6666-6666-6666-666666666666', 'New@Customer.com', `SELECT public.current_org_id() AS org, public.current_org_role() AS role`);
ok(r.rows?.[0]?.org === '00000000-0000-0000-0000-0000000000b2' && r.rows?.[0]?.role === 'agent', `수락 후 다음 요청부터 고객사 상담원 (${r.error || JSON.stringify(r.rows?.[0])})`);
const prof = (await db.query(`SELECT active_org_id FROM user_profiles WHERE user_id='66666666-6666-6666-6666-666666666666'`)).rows[0];
ok(prof?.active_org_id === '00000000-0000-0000-0000-0000000000b2', `수락 시 활성 회사 기록 (${JSON.stringify(prof)})`);
r = await as('authenticated', '66666666-6666-6666-6666-666666666666', 'New@Customer.com', `SELECT public.accept_my_invites() AS c`, true);
ok(r.rows?.[0]?.c === 0, '같은 초대 두 번 수락 안 됨');
r = await as('authenticated', U_B, 'agent@customer.com', `SELECT public.create_organization('몰래', 'x@x.com') AS id`);
ok(!!r.error, '일반 사용자: 회사 생성 거부');
r = await as('anon', null, null, `SELECT public.accept_my_invites()`);
ok(!!r.error, 'anon: 초대 수락 함수 실행 거부');
r = await as('authenticated', U_OWNER, '9981mark@gmail.com', `SELECT public.create_organization('고객사C', 'c@c.com') AS id`, true);
ok(!!r.rows?.[0]?.id, `플랫폼 관리자: 회사 생성 가능 (${r.error || 'ok'})`);

// 8. 상담원 권한 상승 시도
r = await as('authenticated', U_B, 'agent@customer.com', `UPDATE org_members SET role='owner' WHERE user_id='${U_B}' RETURNING role`);
ok(!r.error && r.rows.length === 0, '상담원: 자기 역할을 owner로 변경 0건');
r = await as('authenticated', U_B, 'agent@customer.com', `UPDATE user_profiles SET is_platform_admin=true RETURNING user_id`);
ok(!r.error && r.rows.length === 0, '상담원: 플랫폼 관리자 권한 부여 0건');

// 9. 상담원은 관리자가 배정한 본인 리드만 (2026-11-01 확정)
const ORG_B = '00000000-0000-0000-0000-0000000000b2';
const U_B2 = '77777777-7777-7777-7777-777777777777'; // 고객사 두 번째 상담원
await db.exec(`INSERT INTO auth.users VALUES ('${U_B2}', 'agent2@customer.com', now());
               INSERT INTO org_members (org_id, user_id, role) VALUES ('${ORG_B}', '${U_B2}', 'agent');`);
const A1 = ['authenticated', U_B, 'agent@customer.com'];
const A2 = ['authenticated', U_B2, 'agent2@customer.com'];
const ADM = ['authenticated', U_B_ADM, 'boss@customer.com'];

r = await as(...ADM, `INSERT INTO cases (case_id, customer_name, phone) VALUES ('B3','배정대상','010-7777-8888') RETURNING assigned_user_id`, true);
ok(!r.error && r.rows?.[0]?.assigned_user_id === null, `관리자 등록 리드 → 미배정 (${r.error || 'ok'})`);
// 이 시점 고객사 리드: B1(상담원1 본인 등록·본인 배정, 위 삭제 테스트는 ROLLBACK됨), B3(미배정)
const visibleIds = async (who) => ((await as(...who, `SELECT case_id FROM cases ORDER BY case_id`)).rows || []).map(x => x.case_id).join(',');
let ids = await visibleIds(A1);
ok(ids === 'B1', `배정 전: 상담원1은 본인 리드(B1)만, 미배정 B3 안 보임 (${ids})`);
ids = await visibleIds(ADM);
ok(ids === 'B1,B3', `관리자: 미배정 포함 회사 전체 (${ids})`);
r = await as(...ADM, `UPDATE cases SET assigned_user_id='${U_B}' WHERE case_id='B3' RETURNING case_id`, true);
ok(r.rows?.length === 1, `관리자: 상담원1에게 배정 (${r.error || 'ok'})`);
ids = await visibleIds(A1);
ok(ids === 'B1,B3', `배정 후: 상담원1에게 B3 보임 (${ids})`);
ok(await n(...A2, 'cases') === 0, '상담원2에게는 안 보임');
r = await as(...A1, `UPDATE cases SET assigned_user_id='${U_B2}' WHERE case_id='B3' RETURNING case_id`);
ok(!!r.error, '상담원1: 다른 상담원에게 넘기기 거부');
r = await as(...A1, `UPDATE cases SET assigned_user_id=NULL WHERE case_id='B3' RETURNING case_id`);
ok(!!r.error, '상담원1: 배정 해제 거부');
r = await as(...A1, `UPDATE cases SET status='상담중' WHERE case_id='B3' RETURNING case_id`);
ok(r.rows?.length === 1, `상담원1: 본인 리드 상태 수정 가능 (${r.error || 'ok'})`);
r = await as(...A2, `UPDATE cases SET status='해킹' WHERE case_id='B3' RETURNING case_id`);
ok(!r.error && r.rows.length === 0, '상담원2: 남의 리드 수정 0건');

// 통화·문자 기록: 배정 리드 번호 기록은 담당 상담원에게 보임
await db.exec(`INSERT INTO communication_logs (org_id, phone_number, type, timestamp, user_id)
               VALUES ('${ORG_B}', '01077778888', 'CALL_IN', now(), '${U_B_ADM}')`);
ok(await n(...A1, 'communication_logs') === 1, '상담원1: 배정 리드 번호의 통화기록 보임 (하이픈 차이 무시)');
ok(await n(...A2, 'communication_logs') === 0, '상담원2: 남의 리드 통화기록 0건');
r = await as(...A2, `INSERT INTO communication_logs (phone_number, type, timestamp) VALUES ('01099990000','CALL_OUT',now()) RETURNING user_id`, true);
ok(r.rows?.[0]?.user_id === U_B2, `상담원2: 본인 폰 기록 업로드 → user_id 자동 (${r.error || 'ok'})`);
ok(await n(...A2, 'communication_logs') === 1, '상담원2: 본인 폰 기록은 보임');
ok(await n(...A1, 'communication_logs') === 1, '상담원1: 상담원2 개인 기록은 안 보임');

// 전화 요청: PC에서 누른 본인 요청 / 본인 폰 대상만
r = await as(...A1, `INSERT INTO pending_calls (phone_number, customer_name) VALUES ('01077778888','배정대상') RETURNING target_user_id`, true);
ok(r.rows?.[0]?.target_user_id === U_B, `상담원1 전화 요청 → 본인 폰 대상 (${r.error || 'ok'})`);
ok(await n(...A2, 'pending_calls') === 0, '상담원2: 상담원1 전화 요청 안 보임');
ok(await n(...ADM, 'pending_calls') === 1, '관리자: 전화 요청 보임');

// 자동통화 묶음
r = await as(...A1, `INSERT INTO auto_dial_batches (name, source) VALUES ('내묶음','manual') RETURNING id`, true);
const batchId = r.rows?.[0]?.id;
r = await as(...A1, `INSERT INTO auto_dial_items (batch_id, case_id, phone) VALUES ('${batchId}','B3','01077778888') RETURNING id`, true);
ok(!r.error, `상담원1: 본인 묶음에 항목 추가 (${r.error || 'ok'})`);
ok(await n(...A2, 'auto_dial_batches') === 0 && await n(...A2, 'auto_dial_items') === 0, '상담원2: 상담원1 자동통화 안 보임');
ok(await n(...ADM, 'auto_dial_items') === 1, '관리자: 자동통화 항목 보임');

// 텔레그램 피드백
await db.exec(`INSERT INTO telegram_feedbacks (org_id, message_id, sender_name, feedback_type, feedback_content, chat_id, matched_case_id)
               VALUES ('${ORG_B}', 200, '변호사', '부재', '연락안됨', '-9', 'B3')`);
ok(await n(...A1, 'telegram_feedbacks') === 1, '상담원1: 본인 리드 피드백 보임');
ok(await n(...A2, 'telegram_feedbacks') === 0, '상담원2: 남의 리드 피드백 0건');

// 문자 템플릿은 관리자만 변경
r = await as(...A1, `INSERT INTO sms_templates (title, content) VALUES ('x','y')`);
ok(!!r.error, '상담원: 문자 템플릿 추가 거부');
r = await as(...ADM, `INSERT INTO sms_templates (title, content) VALUES ('고객사 인사','안녕하세요') RETURNING org_id`, true);
ok(r.rows?.[0]?.org_id === ORG_B, `관리자: 문자 템플릿 추가 → 고객사 소속 (${r.error || 'ok'})`);

console.log(failures === 0 ? '\nALL_PASS' : `\nFAILURES=${failures}`);
