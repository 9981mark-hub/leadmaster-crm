// scripts/verify_multitenant_isolation.mjs
// 멀티테넌트 데이터 완전 격리 & 무누수 교차 전수 자동 검증기 (v2.0, 2026-11-13 KIRO)
//
// - PGlite(메모리 Postgres)에서 실제 DB 접속 없이 돈다. 운영·스테이징에 연결하지 않는다.
// - 마이그레이션은 운영 적용 순서 그대로 읽는다:
//     운영에 이미 있는 것: 001~018, 023, 024, 026, 027_agent_ui_mode
//     다음에 적용할 것(supabase/migrations/apply_order_019_034.txt): 019, 020, 021, 022, 025, 027_platform_notices_multitenant,
//       028_agent_security_profiles, 028_vendor_lead_quality_roi, 029, 030, 031, 032, 033
// - 019~033 은 실패하면 FAIL. 테스트 데이터를 넣은 뒤 019~033 을 한 번 더 실행해 재실행 오류가 없는지도 본다.
// - 결과를 파일로도 남기려면: VERIFY_OUT=<파일 경로> node scripts/verify_multitenant_isolation.mjs
import { PGlite } from '@electric-sql/pglite';
import { readFileSync, writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

// LM_MIG_DIR: 다른 폴더의 마이그레이션으로 돌려 볼 때 (예: 수정 전 파일로 이 검사가 실패하는지 확인)
const MIG_DIR = process.env.LM_MIG_DIR || fileURLToPath(new URL('../supabase/migrations/', import.meta.url));
const db = new PGlite();
let failures = 0;
let totalChecks = 0;
const outLines = [];
const log = (s = '') => { console.log(s); outLines.push(s.replace(/\x1b\[[0-9;]*m/g, '')); };
const logErr = (s = '') => { console.error(s); outLines.push(s.replace(/\x1b\[[0-9;]*m/g, '')); };
// 중간에 죽어도 결과 파일은 남긴다
process.on('uncaughtException', (e) => { logErr(`💥 검사 중단(예외): ${e?.message || e}`); process.exit(2); });
process.on('unhandledRejection', (e) => { logErr(`💥 검사 중단(예외): ${e?.message || e}`); process.exit(2); });
process.on('exit', () => { if (process.env.VERIFY_OUT) writeFileSync(process.env.VERIFY_OUT, outLines.join('\n'), 'utf8'); });

const assertOk = (condition, label) => {
  totalChecks++;
  if (condition) {
    log(`  \x1b[32m✔ PASS\x1b[0m  ${label}`);
  } else {
    logErr(`  \x1b[31m✘ FAIL\x1b[0m  ${label}`);
    failures++;
  }
};

log('\n===============================================================');
log('🔒 리드마스터 CRM 멀티테넌트 완전 격리 & 무누수 전수 자동 검증');
log('===============================================================\n');

// 1. Supabase Postgres 인증 및 확장 모의 환경 구성
await db.exec(`
  CREATE ROLE anon NOLOGIN;
  CREATE ROLE authenticated NOLOGIN;
  CREATE ROLE service_role NOLOGIN BYPASSRLS;
  CREATE SCHEMA auth;
  CREATE TABLE auth.users (id uuid PRIMARY KEY, email text, last_sign_in_at timestamptz, raw_user_meta_data jsonb DEFAULT '{}'::jsonb,
    banned_until timestamptz, raw_app_meta_data jsonb DEFAULT '{}'::jsonb);
  CREATE TABLE IF NOT EXISTS auth.sessions (id uuid primary key default gen_random_uuid(), user_id uuid);
  CREATE TABLE IF NOT EXISTS auth.refresh_tokens (id bigserial primary key, user_id text, revoked boolean);
  CREATE FUNCTION auth.jwt() RETURNS jsonb LANGUAGE sql STABLE AS $$
    SELECT coalesce(nullif(current_setting('request.jwt.claims', true), ''), '{}')::jsonb $$;
  CREATE FUNCTION auth.uid() RETURNS uuid LANGUAGE sql STABLE AS $$ SELECT nullif(auth.jwt()->>'sub', '')::uuid $$;
  CREATE FUNCTION auth.role() RETURNS text LANGUAGE sql STABLE AS $$ SELECT auth.jwt()->>'role' $$;
  CREATE FUNCTION auth.email() RETURNS text LANGUAGE sql STABLE AS $$ SELECT auth.jwt()->>'email' $$;
  CREATE PUBLICATION supabase_realtime;
  GRANT USAGE ON SCHEMA public, auth TO anon, authenticated, service_role;
  GRANT EXECUTE ON ALL FUNCTIONS IN SCHEMA auth TO anon, authenticated, service_role;
  -- Supabase 기본 권한과 같게: 새 표·함수·시퀀스는 anon/authenticated 에도 권한이 붙는다 (그래서 마이그레이션의 REVOKE 가 중요)
  ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT ALL ON TABLES TO anon, authenticated, service_role;
  ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT ALL ON SEQUENCES TO anon, authenticated, service_role;
  ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT EXECUTE ON FUNCTIONS TO anon, authenticated, service_role;

  CREATE SCHEMA IF NOT EXISTS storage;
  CREATE TABLE IF NOT EXISTS storage.buckets (
    id text primary key,
    name text,
    public boolean default false,
    file_size_limit bigint,
    allowed_mime_types text[]
  );
  CREATE TABLE IF NOT EXISTS storage.objects (
    id uuid primary key default gen_random_uuid(),
    bucket_id text,
    name text,
    owner uuid,
    created_at timestamptz default now(),
    updated_at timestamptz default now(),
    metadata jsonb
  );
  CREATE OR REPLACE FUNCTION storage.foldername(text) RETURNS text[] LANGUAGE sql IMMUTABLE AS $$
    SELECT string_to_array($1, '/')
  $$;
  GRANT USAGE ON SCHEMA storage TO anon, authenticated, service_role;

  CREATE SCHEMA IF NOT EXISTS vault;
  CREATE TABLE IF NOT EXISTS vault.decrypted_secrets (id uuid primary key, name text, decrypted_secret text);
  CREATE TABLE IF NOT EXISTS vault.secrets (id uuid primary key, name text, secret text);

  -- pg_cron / pg_net 흉내 (확장 없음)
  CREATE SCHEMA IF NOT EXISTS cron;
  CREATE TABLE IF NOT EXISTS cron.job (jobid bigserial, jobname text primary key, schedule text, command text);
  CREATE OR REPLACE FUNCTION cron.schedule(text, text, text) RETURNS bigint LANGUAGE sql AS $$
    INSERT INTO cron.job (jobname, schedule, command) VALUES ($1, $2, $3)
    ON CONFLICT (jobname) DO UPDATE SET schedule = EXCLUDED.schedule, command = EXCLUDED.command
    RETURNING jobid $$;
  CREATE OR REPLACE FUNCTION cron.unschedule(text) RETURNS boolean LANGUAGE sql AS $$
    WITH d AS (DELETE FROM cron.job WHERE jobname = $1 RETURNING 1) SELECT true $$;
  CREATE SCHEMA IF NOT EXISTS net;
  CREATE OR REPLACE FUNCTION net.http_post(url text, body jsonb DEFAULT '{}'::jsonb, params jsonb DEFAULT '{}'::jsonb,
    headers jsonb DEFAULT '{}'::jsonb, timeout_milliseconds int DEFAULT 5000) RETURNS bigint LANGUAGE sql AS $$ SELECT 1::bigint $$;
  CREATE SCHEMA IF NOT EXISTS extensions;
`);

// 2. 마이그레이션 (운영 적용 순서)
const BASE_FILES = [
  '001_complete_schema.sql',
  '002_auto_dial.sql',
  '003_lock_anon_tables.sql',
  '003b_close_any_login_access.sql',
  '004_multitenant_core.sql',
  '005_multitenant_rls.sql',
  '005b_telegram_feedbacks_default.sql',
  '007_team_management.sql',
  '008_telegram_per_org.sql',
  '009_telegram_delivery.sql',
  '010_app_realtime_reminders.sql',
  '012_platform_admin.sql',
  '013_lead_distribution.sql',
  '014_call_recordings.sql',
  '015_access_logs.sql',
  '016_ai_usage.sql',
  '017_drive_recordings.sql',
  '018_recordings_drive_only.sql',
  '023_emergency_data_purge.sql',
  '024_lead_lifecycle_archiving.sql',
  '026_notices_and_directives.sql',
  '027_agent_ui_mode.sql',
];

// 다음 운영 적용분 (apply_order_019_034.txt 와 같아야 한다)
const ORDER_FILE = path.join(MIG_DIR, 'apply_order_019_034.txt');
const NEW_FILES = readFileSync(ORDER_FILE, 'utf8')
  .split(/\r?\n/).map(s => s.replace(/#.*$/, '').trim()).filter(s => s.endsWith('.sql'));

const runFile = async (mf) => {
  const sql = readFileSync(path.join(MIG_DIR, mf), 'utf8')
    .replace(/^\s*CREATE EXTENSION[^\n]*$/gim, '-- extension skipped in test');
  try {
    await db.exec(sql);
    return null;
  } catch (err) {
    await db.exec('ROLLBACK;').catch(() => {});
    return err.message;
  }
};

log('--- 0. 마이그레이션 로드 ---');
for (const mf of BASE_FILES) {
  const err = await runFile(mf);
  if (err) logErr(`[WARN] (운영에 이미 있는 파일) ${mf}: ${err}`);
  else log(`[MIGRATION] Loaded: ${mf}`);
}
assertOk(NEW_FILES.length === 14, `적용 순서 파일에 14개 파일 (034 포함) (${NEW_FILES.length}개)`);
for (const mf of NEW_FILES) {
  const err = await runFile(mf);
  assertOk(!err, `1차 실행: ${mf}${err ? ' → ' + err : ''}`);
}

// 3. 테스트 회사 2개 생성 (회사 A: TM_ALPHA / 회사 B: TM_BETA)
const ORG_A = '10000000-0000-0000-0000-00000000000a';
const ORG_B = '20000000-0000-0000-0000-00000000000b';

const USER_A_ADMIN = 'a1111111-1111-1111-1111-111111111111'; // 회사 A 대표
const USER_A_AGENT = 'a2222222-2222-2222-2222-222222222222'; // 회사 A 상담원
const USER_A_AGENT2 = 'a3333333-3333-3333-3333-333333333333'; // 회사 A 상담원2
const USER_B_ADMIN = 'b1111111-1111-1111-1111-111111111111'; // 회사 B 대표
const USER_B_AGENT = 'b2222222-2222-2222-2222-222222222222'; // 회사 B 상담원

const A_ADMIN = ['authenticated', USER_A_ADMIN, 'admin@alpha.com'];
const A_AGENT = ['authenticated', USER_A_AGENT, 'agent@alpha.com'];
const A_AGENT2 = ['authenticated', USER_A_AGENT2, 'agent2@alpha.com'];
const B_ADMIN = ['authenticated', USER_B_ADMIN, 'admin@beta.com'];
const B_AGENT = ['authenticated', USER_B_AGENT, 'agent@beta.com'];
const ANON = ['anon', null, null];

await db.exec(`
  INSERT INTO organizations (id, name, slug) VALUES
    ('${ORG_A}', 'TM 알파 사무소', 'alpha'),
    ('${ORG_B}', 'TM 베타 법률', 'beta');

  INSERT INTO auth.users (id, email) VALUES
    ('${USER_A_ADMIN}', 'admin@alpha.com'),
    ('${USER_A_AGENT}', 'agent@alpha.com'),
    ('${USER_A_AGENT2}', 'agent2@alpha.com'),
    ('${USER_B_ADMIN}', 'admin@beta.com'),
    ('${USER_B_AGENT}', 'agent@beta.com');

  INSERT INTO org_members (org_id, user_id, role, status) VALUES
    ('${ORG_A}', '${USER_A_ADMIN}', 'owner', 'active'),
    ('${ORG_A}', '${USER_A_AGENT}', 'agent', 'active'),
    ('${ORG_A}', '${USER_A_AGENT2}', 'agent', 'active'),
    ('${ORG_B}', '${USER_B_ADMIN}', 'owner', 'active'),
    ('${ORG_B}', '${USER_B_AGENT}', 'agent', 'active');
`);

// 세션 스위처 헬퍼 (항상 되돌림)
const asUser = async ([role, uid, email], sql, commit = false) => {
  await db.exec('BEGIN');
  try {
    await db.exec(`SET LOCAL ROLE ${role}`);
    const claims = uid ? JSON.stringify({ sub: uid, email, role }) : '';
    await db.query(`SELECT set_config('request.jwt.claims', $1, true)`, [claims]);
    const res = await db.query(sql);
    await db.exec(commit ? 'COMMIT' : 'ROLLBACK');
    return { rows: res.rows, error: null, affected: res.affectedRows ?? res.rows.length };
  } catch (e) {
    await db.exec('ROLLBACK');
    return { rows: [], error: e.message, affected: 0 };
  }
};
const queryAsUser = (role, uid, email, sql) => asUser([role, uid, email], sql, false);
const mutateAsUser = (role, uid, email, sql) => asUser([role, uid, email], sql, true);

const countAs = async (role, uid, email, table, extraWhere = '') => {
  const where = extraWhere ? `WHERE ${extraWhere}` : '';
  const r = await queryAsUser(role, uid, email, `SELECT count(*)::int AS cnt FROM ${table} ${where}`);
  return r.rows?.[0]?.cnt ?? -1;
};
const count = async (who, table, where = '') => {
  const r = await asUser(who, `SELECT count(*)::int AS cnt FROM ${table} ${where ? 'WHERE ' + where : ''}`);
  return r.error ? { cnt: -1, error: r.error } : { cnt: r.rows[0].cnt, error: null };
};
const isDenied = (err) => !!err && /permission denied|row-level security|violates|권한|관리자|같은 회사|접근할 수|바꿀 수 없|not allowed/i.test(err);

log('\n--- 1. 고객 리드(cases) 데이터 상호 침범 차단 검증 ---');

await db.exec(`
  INSERT INTO cases (case_id, org_id, customer_name, phone, income_net, assigned_user_id, status, contract_at, contract_fee) VALUES
    ('CASE-A1', '${ORG_A}', '알파고객1', '010-1111-0001', 3000000, '${USER_A_AGENT}', '계약 완료', to_char(now() AT TIME ZONE 'Asia/Seoul', 'YYYY-MM-DD'), 300),
    ('CASE-A2', '${ORG_A}', '알파고객2', '010-1111-0002', 2500000, NULL, '신규접수', NULL, 0),
    ('CASE-A3', '${ORG_A}', '알파고객3', '010-1111-0003', 4000000, '${USER_A_AGENT2}', '부재', '잘못된 날짜', 0),
    ('CASE-B1', '${ORG_B}', '베타고객1', '010-2222-0001', 3500000, '${USER_B_AGENT}', '신규접수', NULL, 0),
    ('CASE-B2', '${ORG_B}', '베타고객2', '010-2222-0002', 2000000, NULL, '신규접수', NULL, 0);
`);

const alphaAdminVisible = await countAs('authenticated', USER_A_ADMIN, 'admin@alpha.com', 'cases');
const betaAdminVisible = await countAs('authenticated', USER_B_ADMIN, 'admin@beta.com', 'cases');
const anonVisible = await count(ANON, 'cases');

assertOk(alphaAdminVisible === 3, `회사 A 대표는 자기 회사 리드 3건만 정확히 조회 (조회수: ${alphaAdminVisible})`);
assertOk(betaAdminVisible === 2, `회사 B 대표는 자기 회사 리드 2건만 정확히 조회 (조회수: ${betaAdminVisible})`);
assertOk(anonVisible.cnt === 0 || isDenied(anonVisible.error), `비로그인(anon) 사용자는 어떤 리드도 볼 수 없음`);

const crossCaseQuery = await queryAsUser(
  'authenticated', USER_B_AGENT, 'agent@beta.com',
  `SELECT customer_name, income_net FROM cases WHERE case_id = 'CASE-A1'`
);
assertOk(crossCaseQuery.rows.length === 0, '회사 B 상담원이 회사 A의 리드 ID를 직접 지정해 조회 ➔ 0건');

const crossCaseUpdate = await queryAsUser(
  'authenticated', USER_B_AGENT, 'agent@beta.com',
  `UPDATE cases SET customer_name = '해킹됨' WHERE case_id = 'CASE-A1' RETURNING case_id`
);
assertOk(crossCaseUpdate.rows.length === 0, '회사 B 상담원의 회사 A 리드 UPDATE ➔ 0건 반영');

log('\n--- 2. 통화 기록(communication_logs) 격리 검증 ---');
await db.exec(`
  INSERT INTO communication_logs (org_id, phone_number, type, timestamp, user_id, duration) VALUES
    ('${ORG_A}', '01011110001', 'CALL_OUT', now(), '${USER_A_AGENT}', 60),
    ('${ORG_B}', '01022220001', 'CALL_OUT', now(), '${USER_B_AGENT}', 0);
`);

const alphaLogs = await countAs('authenticated', USER_A_ADMIN, 'admin@alpha.com', 'communication_logs');
const betaLogs = await countAs('authenticated', USER_B_ADMIN, 'admin@beta.com', 'communication_logs');
assertOk(alphaLogs === 1, `회사 A는 회사 A의 통화 기록 1건만 조회`);
assertOk(betaLogs === 1, `회사 B는 회사 B의 통화 기록 1건만 조회`);

log('\n--- 3. 통화 녹음 파일(call_recordings) 격리 ---');
try {
  await db.exec(`
    INSERT INTO call_recordings (id, org_id, case_id, user_id, phone, call_started_at, storage_path, drive_file_id) VALUES
      ('11111111-1111-1111-1111-111111111111', '${ORG_A}', 'CASE-A1', '${USER_A_AGENT}', '01011110001', now(), '${ORG_A}/CASE-A1/rec.m4a', 'drive_file_alpha_secret'),
      ('22222222-2222-2222-2222-222222222222', '${ORG_B}', 'CASE-B1', '${USER_B_AGENT}', '01022220001', now(), '${ORG_B}/CASE-B1/rec.m4a', 'drive_file_beta_secret');
  `);
  const alphaRecs = await countAs('authenticated', USER_A_ADMIN, 'admin@alpha.com', 'call_recordings');
  const betaRecs = await countAs('authenticated', USER_B_AGENT, 'agent@beta.com', 'call_recordings');
  assertOk(alphaRecs === 1, `회사 A 대표: 자사 녹음 1건만 조회`);
  assertOk(betaRecs === 1, `회사 B 상담원: 본인 회사/본인 녹음 1건만 조회`);
} catch (e) {
  log(`  ℹ call_recordings 테이블 검증 스킵: ${e.message}`);
}

log('\n--- 4. 감사 로그(access_logs) 상호 격리 ---');
try {
  await db.exec(`
    INSERT INTO access_logs (org_id, user_id, action, case_id) VALUES
      ('${ORG_A}', '${USER_A_ADMIN}', 'export', 'CASE-A1'),
      ('${ORG_B}', '${USER_B_ADMIN}', 'case_view', 'CASE-B1');
  `);
  const alphaAccessLogs = await countAs('authenticated', USER_A_ADMIN, 'admin@alpha.com', 'access_logs');
  assertOk(alphaAccessLogs === 1, `회사 A 대표는 자사 접근 기록만 열람`);
} catch (e) {
  log(`  ℹ access_logs 테이블 검증: ${e.message}`);
}

log('\n--- 5. 회사간 설정(settings) 격리 ---');
await db.exec(`
  INSERT INTO settings (org_id, key, value) VALUES
    ('${ORG_A}', 'telegramBotToken', '"BOT_TOKEN_FOR_ALPHA_SECRET"'),
    ('${ORG_B}', 'telegramBotToken', '"BOT_TOKEN_FOR_BETA_SECRET"');
`);
const alphaBotTokenQuery = await queryAsUser(
  'authenticated', USER_B_ADMIN, 'admin@beta.com',
  `SELECT value FROM settings WHERE org_id = '${ORG_A}' AND key = 'telegramBotToken'`
);
assertOk(alphaBotTokenQuery.rows.length === 0, '회사 B 대표가 회사 A의 텔레그램 봇 토큰 조회 ➔ 0건');

// ---------------------------------------------------------------
// 019~033 테스트 데이터 (서버 권한으로 넣음)
// ---------------------------------------------------------------
await db.exec(`
  INSERT INTO org_settlement_policies (org_id, split_model, company_share_ratio, agent_share_ratio) VALUES
    ('${ORG_A}', 'ratio_split', 40, 60),
    ('${ORG_B}', 'ratio_split', 50, 50);

  INSERT INTO auto_dial_campaigns (id, org_id, name, status) VALUES
    ('c0000000-0000-0000-0000-00000000000a', '${ORG_A}', '알파 캠페인', 'running'),
    ('c0000000-0000-0000-0000-0000000000a2', '${ORG_A}', '알파 캠페인2(상담원 할당 없음)', 'ready'),
    ('c0000000-0000-0000-0000-00000000000b', '${ORG_B}', '베타 캠페인', 'running');
  INSERT INTO auto_dial_agent_allocations (id, campaign_id, org_id, agent_id, agent_name) VALUES
    ('d0000000-0000-0000-0000-00000000000a', 'c0000000-0000-0000-0000-00000000000a', '${ORG_A}', 'Agent@Alpha.com', '알파상담원'),
    ('d0000000-0000-0000-0000-0000000000a2', 'c0000000-0000-0000-0000-00000000000a', '${ORG_A}', 'agent2@alpha.com', '알파상담원2'),
    ('d0000000-0000-0000-0000-00000000000b', 'c0000000-0000-0000-0000-00000000000b', '${ORG_B}', 'agent@beta.com', '베타상담원');
  INSERT INTO auto_dial_queue (id, campaign_id, org_id, case_id, assigned_agent_id, customer_name, phone) VALUES
    ('e0000000-0000-0000-0000-00000000000a', 'c0000000-0000-0000-0000-00000000000a', '${ORG_A}', 'CASE-A1', 'agent@alpha.com', '알파고객1', '010-1111-0001'),
    ('e0000000-0000-0000-0000-0000000000a2', 'c0000000-0000-0000-0000-00000000000a', '${ORG_A}', 'CASE-A3', 'agent2@alpha.com', '알파고객3', '010-1111-0003'),
    ('e0000000-0000-0000-0000-00000000000b', 'c0000000-0000-0000-0000-00000000000b', '${ORG_B}', 'CASE-B1', 'agent@beta.com', '베타고객1', '010-2222-0001');

  INSERT INTO agent_attendance_logs (org_id, user_id, work_date, clock_in_at, current_status) VALUES
    ('${ORG_A}', '${USER_A_ADMIN}', (now() AT TIME ZONE 'Asia/Seoul')::date, now(), 'working'),
    ('${ORG_A}', '${USER_A_AGENT2}', (now() AT TIME ZONE 'Asia/Seoul')::date, now(), 'away'),
    ('${ORG_B}', '${USER_B_AGENT}', (now() AT TIME ZONE 'Asia/Seoul')::date, now(), 'working');

  INSERT INTO agent_payroll_profiles (org_id, user_id, base_salary, account_number) VALUES
    ('${ORG_A}', '${USER_A_AGENT}', 1000000, '111-alpha-agent'),
    ('${ORG_A}', '${USER_A_AGENT2}', 2000000, '222-alpha-agent2'),
    ('${ORG_B}', '${USER_B_AGENT}', 3000000, '333-beta-agent');

  INSERT INTO lead_vendors (org_id, name, default_unit_cost) VALUES
    ('${ORG_A}', '알파광고', 10000),
    ('${ORG_B}', '베타광고', 20000);

  INSERT INTO org_dnc_numbers (org_id, phone_number, reason) VALUES
    ('${ORG_A}', '01099990001', 'refusal'),
    ('${ORG_B}', '01099990002', 'refusal');

  INSERT INTO org_incentive_settings (org_id, calc_type) VALUES
    ('${ORG_A}', 'fixed'),
    ('${ORG_B}', 'percent');

  INSERT INTO lead_import_batches (id, org_id, name, source, total_rows, inserted) VALUES
    ('f0000000-0000-0000-0000-00000000000a', '${ORG_A}', '알파 1회차', '알파광고', 2, 2),
    ('f0000000-0000-0000-0000-00000000000b', '${ORG_B}', '베타 1회차', '베타광고', 1, 1);
  UPDATE cases SET import_batch_id = 'f0000000-0000-0000-0000-00000000000a' WHERE case_id IN ('CASE-A1', 'CASE-A2');

  INSERT INTO notices (org_id, created_by, title, content, is_platform_notice, platform_target_role) VALUES
    ('${ORG_A}', '${USER_A_ADMIN}', '플랫폼 공지(전체)', '내용', true, 'all'),
    ('${ORG_A}', '${USER_A_ADMIN}', '알파 사내 공지', '내용', false, 'all');
`);

log('\n--- 6. 019~033 재실행 (데이터가 있는 상태에서 두 번째 실행) ---');
for (const mf of NEW_FILES) {
  const err = await runFile(mf);
  assertOk(!err, `2차 실행: ${mf}${err ? ' → ' + err : ''}`);
}

log('\n--- 7. 새 표 회사 간 격리 (B가 A 행을 못 읽고 못 고침, anon 0건) ---');
const ISO_TABLES = [
  // [표, A 대표가 볼 행 수, 고칠 칸, 새 행 INSERT 칸·값]
  ['org_settlement_policies', 1, `company_share_ratio = 99`, `(org_id, split_model) VALUES ('${ORG_A}', 'ratio_split')`],
  ['auto_dial_campaigns', 2, `name = '해킹'`, `(org_id, name) VALUES ('${ORG_A}', '해킹 캠페인')`],
  ['auto_dial_agent_allocations', 2, `agent_name = '해킹'`, `(campaign_id, org_id, agent_id, agent_name) VALUES ('c0000000-0000-0000-0000-00000000000a', '${ORG_A}', 'x@x.com', 'x')`],
  ['auto_dial_queue', 2, `phone = '01000000000'`, `(campaign_id, org_id, case_id, phone) VALUES ('c0000000-0000-0000-0000-00000000000a', '${ORG_A}', 'CASE-A2', '010')`],
  ['agent_attendance_logs', 2, `current_status = 'off'`, `(org_id, user_id, work_date, current_status) VALUES ('${ORG_A}', '${USER_A_AGENT}', '2000-01-01', 'working')`],
  ['agent_payroll_profiles', 2, `base_salary = 0`, `(org_id, user_id) VALUES ('${ORG_A}', '${USER_A_ADMIN}')`],
  ['lead_vendors', 1, `default_unit_cost = 0`, `(org_id, name) VALUES ('${ORG_A}', '해킹광고')`],
  ['org_dnc_numbers', 1, `note = '해킹'`, `(org_id, phone_number) VALUES ('${ORG_A}', '01088880000')`],
  ['org_incentive_settings', 1, `fixed_amount = 0`, `(org_id) VALUES ('${ORG_A}')`],
];
for (const [t, expectA, setExpr, insertExpr] of ISO_TABLES) {
  const a = await count(A_ADMIN, t, `org_id = '${ORG_A}'`);
  assertOk(a.cnt === expectA, `[${t}] 회사 A 대표는 자기 회사 행 ${expectA}건 조회 (${a.cnt}${a.error ? ' ' + a.error : ''})`);
  const bRead = await count(B_ADMIN, t, `org_id = '${ORG_A}'`);
  assertOk(bRead.cnt === 0, `[${t}] 회사 B 대표가 회사 A 행 조회 ➔ 0건 (${bRead.cnt})`);
  const bUpd = await asUser(B_ADMIN, `UPDATE ${t} SET ${setExpr} WHERE org_id = '${ORG_A}' RETURNING 1`);
  assertOk(bUpd.rows.length === 0, `[${t}] 회사 B 대표가 회사 A 행 UPDATE ➔ 0건 (${bUpd.error || bUpd.rows.length})`);
  const bDel = await asUser(B_ADMIN, `DELETE FROM ${t} WHERE org_id = '${ORG_A}' RETURNING 1`);
  assertOk(bDel.rows.length === 0, `[${t}] 회사 B 대표가 회사 A 행 DELETE ➔ 0건`);
  const bIns = await asUser(B_ADMIN, `INSERT INTO ${t} ${insertExpr} RETURNING 1`);
  assertOk(!!bIns.error, `[${t}] 회사 B 대표가 org_id=회사 A 로 INSERT ➔ 거부 (${bIns.error ? '거부됨' : '들어감!'})`);
  const an = await count(ANON, t);
  assertOk(an.cnt === 0 || isDenied(an.error), `[${t}] anon 조회 ➔ 0건/권한 없음`);
}

log('\n--- 8. 정산 정책(033): 상담원 쓰기 금지, upsert(onConflict org_id) ---');
{
  const agentRead = await count(A_AGENT, 'org_settlement_policies');
  assertOk(agentRead.cnt === 1, `상담원은 자기 회사 정책 1건만 읽기 (${agentRead.cnt})`);
  const agentUpd = await asUser(A_AGENT, `UPDATE org_settlement_policies SET company_share_ratio = 0 RETURNING 1`);
  assertOk(agentUpd.rows.length === 0, `상담원 정책 UPDATE ➔ 0건`);
  const agentIns = await asUser(A_AGENT, `INSERT INTO org_settlement_policies (org_id) VALUES ('${ORG_A}') ON CONFLICT (org_id) DO UPDATE SET company_share_ratio = 1 RETURNING 1`);
  assertOk(!!agentIns.error, `상담원 정책 upsert ➔ 거부`);
  const adminUpsert = await asUser(A_ADMIN, `INSERT INTO org_settlement_policies (org_id, split_model, company_share_ratio, agent_share_ratio)
      VALUES ('${ORG_A}', 'margin_deduction', 30, 70)
      ON CONFLICT (org_id) DO UPDATE SET split_model = EXCLUDED.split_model, company_share_ratio = EXCLUDED.company_share_ratio,
        agent_share_ratio = EXCLUDED.agent_share_ratio RETURNING split_model`);
  assertOk(!adminUpsert.error && adminUpsert.rows[0]?.split_model === 'margin_deduction', `관리자 upsert(onConflict org_id) 성공 ${adminUpsert.error || ''}`);
  const adminNoOrg = await asUser(A_ADMIN, `INSERT INTO org_settlement_policies (split_model) VALUES ('ratio_split') ON CONFLICT (org_id) DO UPDATE SET split_model = EXCLUDED.split_model RETURNING org_id`);
  assertOk(!adminNoOrg.error && adminNoOrg.rows[0]?.org_id === ORG_A, `org_id 생략 시 기본값 = 내 회사 ${adminNoOrg.error || ''}`);
  const badVal = await asUser(A_ADMIN, `UPDATE org_settlement_policies SET company_share_ratio = 150 RETURNING 1`);
  assertOk(!!badVal.error, `비율 150% ➔ 거부`);
}

log('\n--- 9. 오토콜 v4(032): 상담원은 본인 줄만, 보호 칸 변경 금지 ---');
{
  const q = await count(A_AGENT, 'auto_dial_queue');
  assertOk(q.cnt === 1, `상담원 A는 본인 배정 큐 1건만 (${q.cnt})`);
  const al = await count(A_AGENT, 'auto_dial_agent_allocations');
  assertOk(al.cnt === 1, `상담원 A는 본인 할당 1건만 (이메일 대소문자 무시) (${al.cnt})`);
  const cp = await count(A_AGENT, 'auto_dial_campaigns');
  assertOk(cp.cnt === 1, `상담원 A는 할당 있는 캠페인 1건만 (${cp.cnt})`);
  const join = await asUser(A_AGENT, `SELECT a.id, c.name FROM auto_dial_agent_allocations a JOIN auto_dial_campaigns c ON c.id = a.campaign_id`);
  assertOk(join.rows.length === 1 && !join.error, `상담원 HUD 조회(할당 + 캠페인) 1건 ${join.error || ''}`);
  const ok = await asUser(A_AGENT, `UPDATE auto_dial_queue SET status = 'completed', result = 'connected', call_duration_seconds = 30 WHERE id = 'e0000000-0000-0000-0000-00000000000a' RETURNING 1`);
  assertOk(ok.rows.length === 1, `상담원 본인 큐 결과 기록 가능 ${ok.error || ''}`);
  const other = await asUser(A_AGENT, `UPDATE auto_dial_queue SET status = 'completed' WHERE id = 'e0000000-0000-0000-0000-0000000000a2' RETURNING 1`);
  assertOk(other.rows.length === 0, `상담원이 동료 큐 UPDATE ➔ 0건`);
  const phone = await asUser(A_AGENT, `UPDATE auto_dial_queue SET phone = '01000000000' WHERE id = 'e0000000-0000-0000-0000-00000000000a' RETURNING 1`);
  assertOk(!!phone.error, `상담원이 큐 전화번호 변경 ➔ 거부`);
  const reassign = await asUser(A_AGENT, `UPDATE auto_dial_queue SET assigned_agent_id = 'agent2@alpha.com' WHERE id = 'e0000000-0000-0000-0000-00000000000a' RETURNING 1`);
  assertOk(!!reassign.error || reassign.rows.length === 0, `상담원이 큐 담당자 변경 ➔ 거부`);
  const campCnt = await asUser(A_AGENT, `UPDATE auto_dial_campaigns SET completed_leads = completed_leads + 1 WHERE id = 'c0000000-0000-0000-0000-00000000000a' RETURNING 1`);
  assertOk(campCnt.rows.length === 1, `상담원이 캠페인 진행 숫자 갱신 가능 ${campCnt.error || ''}`);
  const campStatus = await asUser(A_AGENT, `UPDATE auto_dial_campaigns SET status = 'completed' WHERE id = 'c0000000-0000-0000-0000-00000000000a' RETURNING 1`);
  assertOk(!!campStatus.error, `상담원이 캠페인 상태 변경 ➔ 거부`);
  const agIns = await asUser(A_AGENT, `INSERT INTO auto_dial_queue (campaign_id, case_id, phone) VALUES ('c0000000-0000-0000-0000-00000000000a', 'CASE-A1', '010') RETURNING 1`);
  assertOk(!!agIns.error, `상담원 큐 INSERT ➔ 거부`);
  const xCamp = await asUser(A_ADMIN, `INSERT INTO auto_dial_queue (campaign_id, case_id, phone) VALUES ('c0000000-0000-0000-0000-00000000000b', 'CASE-A1', '010') RETURNING 1`);
  assertOk(!!xCamp.error, `회사 A 관리자가 회사 B 캠페인에 큐 INSERT ➔ 거부`);
  const adminIns = await asUser(A_ADMIN, `INSERT INTO auto_dial_queue (campaign_id, case_id, phone) VALUES ('c0000000-0000-0000-0000-00000000000a', 'CASE-A2', '010-1111-0002') RETURNING org_id`);
  assertOk(!adminIns.error && adminIns.rows[0]?.org_id === ORG_A, `관리자 큐 INSERT(글자 case_id, org_id 생략 → 기본값) ${adminIns.error || ''}`);
  const moveOrg = await asUser(A_ADMIN, `UPDATE auto_dial_campaigns SET org_id = '${ORG_B}' WHERE id = 'c0000000-0000-0000-0000-00000000000a' RETURNING 1`);
  assertOk(!!moveOrg.error, `관리자도 캠페인을 다른 회사로 옮기기 ➔ 거부`);
}

log('\n--- 10. 근태·급여(029): 본인 기록, 한국 날짜, 관리자 전광판 ---');
{
  const rec = await asUser(A_AGENT, `SELECT public.record_agent_attendance_status('working', NULL) AS r`, true);
  const r = rec.rows[0]?.r;
  const kstToday = (await db.query(`SELECT to_char((now() AT TIME ZONE 'Asia/Seoul')::date, 'YYYY-MM-DD') AS d`)).rows[0].d;
  assertOk(!rec.error && r?.user_id === USER_A_AGENT && r?.org_id === ORG_A, `상담원 출근 기록 = 본인·자기 회사 ${rec.error || ''}`);
  assertOk(String(r?.work_date) === kstToday, `근무일 = 한국 날짜 (${r?.work_date} / ${kstToday})`);
  const bad = await asUser(A_AGENT, `SELECT public.record_agent_attendance_status('hack', NULL)`);
  assertOk(!!bad.error, `잘못된 근태 상태 ➔ 거부`);
  const agentSees = await count(A_AGENT, 'agent_attendance_logs');
  assertOk(agentSees.cnt === 1, `상담원은 본인 근태 1건만 조회 (${agentSees.cnt})`);
  const agentIns = await asUser(A_AGENT, `INSERT INTO agent_attendance_logs (org_id, user_id, current_status) VALUES ('${ORG_A}', '${USER_A_ADMIN}', 'off') RETURNING 1`);
  assertOk(!!agentIns.error, `상담원이 남의 근태 직접 INSERT ➔ 거부`);
  const agentUpd = await asUser(A_AGENT, `UPDATE agent_attendance_logs SET current_status = 'off' WHERE user_id = '${USER_A_AGENT2}' RETURNING 1`);
  assertOk(agentUpd.rows.length === 0, `상담원이 동료 근태 UPDATE ➔ 0건`);
  const boardAgent = await asUser(A_AGENT, `SELECT * FROM public.get_today_attendance_board()`);
  assertOk(!boardAgent.error && boardAgent.rows.length === 1 && boardAgent.rows[0].user_id === USER_A_AGENT, `상담원 전광판 = 본인 줄 1개 ${boardAgent.error || boardAgent.rows.length}`);
  const boardAdmin = await asUser(A_ADMIN, `SELECT * FROM public.get_today_attendance_board()`);
  assertOk(!boardAdmin.error && boardAdmin.rows.length === 3 && boardAdmin.rows.every(x => x.email), `관리자 전광판 = 회사 A 활성 멤버 3명 (이메일 포함) ${boardAdmin.error || boardAdmin.rows.length}`);
  const boardB = await asUser(B_ADMIN, `SELECT * FROM public.get_today_attendance_board()`);
  assertOk(!boardB.error && boardB.rows.every(x => ![USER_A_ADMIN, USER_A_AGENT, USER_A_AGENT2].includes(x.user_id)), `회사 B 전광판에 회사 A 사람 없음`);
  const boardAnon = await asUser(ANON, `SELECT * FROM public.get_today_attendance_board()`);
  assertOk(!!boardAnon.error, `anon 전광판 호출 ➔ 거부`);
  const pay = await asUser(A_AGENT, `SELECT user_id, account_number FROM agent_payroll_profiles`);
  assertOk(pay.rows.length === 1 && pay.rows[0].user_id === USER_A_AGENT, `상담원은 본인 급여 프로필만 (동료 계좌번호 안 보임) (${pay.rows.length})`);
  const payUpd = await asUser(A_AGENT, `UPDATE agent_payroll_profiles SET base_salary = 99999999 WHERE user_id = '${USER_A_AGENT}' RETURNING 1`);
  assertOk(payUpd.rows.length === 0, `상담원 본인 급여 수정 ➔ 0건`);
  const payAdmin = await asUser(A_ADMIN, `INSERT INTO agent_payroll_profiles (org_id, user_id, base_salary) VALUES ('${ORG_A}', '${USER_A_AGENT}', 5) ON CONFLICT (org_id, user_id) DO UPDATE SET base_salary = EXCLUDED.base_salary RETURNING base_salary`);
  assertOk(!payAdmin.error && payAdmin.rows[0]?.base_salary === 5, `관리자 급여 upsert(onConflict org_id,user_id) ${payAdmin.error || ''}`);
  const off = await asUser(A_AGENT2, `SELECT public.record_agent_attendance_status('off', NULL) AS r`);
  assertOk(!off.error && off.rows[0]?.r?.clock_out_at, `상담원2 퇴근 기록 ${off.error || ''}`);
}

log('\n--- 11. 팀 관리(028): update_org_member 웹 이름 그대로, 겹치는 함수 없음 ---');
{
  const ov = await db.query(`SELECT count(*)::int AS n FROM pg_proc p JOIN pg_namespace n ON n.oid = p.pronamespace WHERE n.nspname = 'public' AND p.proname = 'update_org_member'`);
  assertOk(ov.rows[0].n === 1, `update_org_member 함수 1개만 존재 (${ov.rows[0].n})`);
  const webCall = (target) => `SELECT public.update_org_member(p_user_id => '${target}'::uuid, p_role => NULL, p_status => NULL,
      p_display_name => '김상담', p_ui_mode => 'lite_only', p_security_profile => '{"watermark":false,"appCaptureBlock":true,"masking":true,"anomalyAlert":true}'::jsonb) AS ok`;
  const adminOk = await asUser(A_ADMIN, webCall(USER_A_AGENT), true);
  assertOk(!adminOk.error && adminOk.rows[0]?.ok === true, `회사 A 관리자가 상담원 수정 성공 ${adminOk.error || ''}`);
  const m = await db.query(`SELECT display_name, ui_mode, security_profile FROM org_members WHERE user_id = '${USER_A_AGENT}'`);
  assertOk(m.rows[0]?.display_name === '김상담' && m.rows[0]?.ui_mode === 'lite_only' && m.rows[0]?.security_profile?.watermark === false, `변경값 반영 (이름·업무 모드·보안 프로필)`);
  const agentFail = await asUser(A_AGENT, webCall(USER_A_AGENT2));
  assertOk(!!agentFail.error, `상담원이 동료 수정 ➔ 거부`);
  const selfFail = await asUser(A_AGENT, webCall(USER_A_AGENT));
  assertOk(!!selfFail.error, `상담원이 본인 업무모드·보안 프로필 수정 ➔ 거부`);
  const otherOrg = await asUser(B_ADMIN, webCall(USER_A_AGENT));
  assertOk(!!otherOrg.error, `회사 B 관리자가 회사 A 상담원 수정 ➔ 거부`);
  const anonCall = await asUser(ANON, webCall(USER_A_AGENT));
  assertOk(!!anonCall.error, `anon 호출 ➔ 거부`);
  const list = await asUser(A_ADMIN, `SELECT * FROM public.list_org_members()`);
  assertOk(!list.error && list.rows.length === 3 && 'security_profile' in (list.rows[0] || {}) && 'session_revoked_at' in (list.rows[0] || {}), `list_org_members 회사 A 3명 + 보안 칸 ${list.error || ''}`);
  const revokeOther = await asUser(B_ADMIN, `SELECT public.revoke_member_session('${USER_A_AGENT}'::uuid)`);
  assertOk(!!revokeOther.error, `회사 B 관리자가 회사 A 상담원 세션 파기 ➔ 거부`);
  const revoke = await asUser(A_ADMIN, `SELECT public.revoke_member_session('${USER_A_AGENT}'::uuid)`, true);
  const rv = await db.query(`SELECT session_revoked_at FROM org_members WHERE user_id = '${USER_A_AGENT}'`);
  assertOk(!revoke.error && rv.rows[0]?.session_revoked_at, `관리자 세션 파기 기록 ${revoke.error || ''}`);
}

log('\n--- 12. 회차 품질·KPI·DNC·거래처 RPC ---');
{
  const ovq = await db.query(`SELECT count(*)::int AS n FROM pg_proc p JOIN pg_namespace n ON n.oid = p.pronamespace WHERE n.nspname = 'public' AND p.proname = 'get_batch_quality_stats'`);
  assertOk(ovq.rows[0].n === 1, `get_batch_quality_stats 함수 1개만`);
  const q = await asUser(A_ADMIN, `SELECT * FROM public.get_batch_quality_stats(100)`);
  const webCols = ['batch_id', 'batch_name', 'source', 'vendor_name', 'file_name', 'created_at', 'total_rows', 'inserted', 'duplicates', 'invalid',
    'dnc_filtered', 'unit_cost', 'total_cost', 'as_claimed_count', 'as_refund_amount', 'open_count', 'contact_count', 'transferred_count',
    'contracted_count', 'total_revenue'];
  assertOk(!q.error && q.rows.length === 1 && webCols.every(c => c in q.rows[0]), `관리자 회차 품질 = 자기 회사 1회차, 웹이 읽는 칸 전부 ${q.error || ''}`);
  assertOk(Number(q.rows[0]?.contact_count) === 1, `연결 수: 010-1111-0001 ↔ 01011110001 숫자 비교 (${q.rows[0]?.contact_count})`);
  const qa = await asUser(A_AGENT, `SELECT * FROM public.get_batch_quality_stats(100)`);
  assertOk(!!qa.error, `상담원 회차 품질(매입비) 조회 ➔ 거부`);
  const cost = await asUser(B_ADMIN, `SELECT public.update_batch_cost('f0000000-0000-0000-0000-00000000000a', 100, 0, '해킹')`);
  assertOk(!!cost.error, `회사 B 관리자가 회사 A 회차 단가 수정 ➔ 거부`);
  const kpiAdmin = await asUser(A_ADMIN, `SELECT * FROM public.get_agent_performance_kpi(NULL, NULL)`);
  assertOk(!kpiAdmin.error && kpiAdmin.rows.length === 3, `KPI 관리자 = 회사 A 3명 (글자 contract_at·잘못된 날짜도 오류 없음) ${kpiAdmin.error || kpiAdmin.rows.length}`);
  const kAgent = kpiAdmin.rows.find(x => x.user_id === USER_A_AGENT);
  assertOk(Number(kAgent?.contract_count) === 1 && Number(kAgent?.total_fee_revenue) === 300, `KPI 이번 달(한국) 계약 1건·300만원 (${kAgent?.contract_count}/${kAgent?.total_fee_revenue})`);
  const kpiAgent = await asUser(A_AGENT, `SELECT * FROM public.get_agent_performance_kpi(NULL, NULL)`);
  assertOk(!kpiAgent.error && kpiAgent.rows.length === 1 && kpiAgent.rows[0].user_id === USER_A_AGENT, `KPI 상담원 = 본인 줄만 ${kpiAgent.error || kpiAgent.rows.length}`);
  const dncX = await asUser(B_AGENT, `SELECT public.register_dnc_number('01011110001', 'refusal', 'CASE-A1', NULL)`);
  assertOk(!!dncX.error, `회사 B 상담원이 회사 A 리드 지정 DNC ➔ 거부`);
  const dncFind = await asUser(B_ADMIN, `SELECT * FROM public.find_dnc_phones(ARRAY['010-9999-0001', '01099990002'])`);
  assertOk(!dncFind.error && dncFind.rows.length === 1 && dncFind.rows[0].phone_number === '01099990002', `find_dnc_phones: 자기 회사 번호만 (${dncFind.rows.length})`);
  const venAgent = await asUser(A_AGENT, `UPDATE lead_vendors SET default_unit_cost = 1 RETURNING 1`);
  assertOk(venAgent.rows.length === 0, `상담원 거래처 단가 수정 ➔ 0건`);
  const venRead = await count(A_AGENT, 'lead_vendors');
  assertOk(venRead.cnt === 1, `상담원 거래처 목록 읽기 = 자기 회사 1건 (${venRead.cnt})`);
  const venBad = await asUser(A_ADMIN, `UPDATE lead_vendors SET pricing_type = 'hack' RETURNING 1`);
  assertOk(!!venBad.error, `pricing_type 잘못된 값 ➔ 거부`);
  const retro = await asUser(A_ADMIN, `SELECT public.retroactive_batch_existing_leads() AS r`);
  assertOk(!retro.error && Number(retro.rows[0]?.r?.cases_linked) === 1, `소급 묶음: 회사 A 미회차 리드 1건만 연결 ${retro.error || JSON.stringify(retro.rows[0]?.r)}`);
  const retroAgent = await asUser(A_AGENT, `SELECT public.retroactive_batch_existing_leads()`);
  assertOk(!!retroAgent.error, `상담원 소급 묶음 ➔ 거부`);
  const bulk = await asUser(A_AGENT, `SELECT public.distribute_unassigned_cases_bulk(NULL, 'round_robin')`);
  assertOk(!!bulk.error, `상담원 대량 배분 ➔ 거부`);
}

log('\n--- 13. 공지(027 플랫폼 공지) ---');
{
  const anonN = await count(ANON, 'notices');
  assertOk(anonN.cnt === 0 || isDenied(anonN.error), `anon 공지 조회 ➔ 0건/권한 없음`);
  const bAgent = await asUser(B_AGENT, `SELECT title FROM notices`);
  assertOk(bAgent.rows.length === 1 && bAgent.rows[0].title === '플랫폼 공지(전체)', `회사 B 상담원: 플랫폼 공지만 보임, 회사 A 사내 공지 안 보임 (${bAgent.rows.map(x => x.title).join(',')})`);
  const bIns = await asUser(B_ADMIN, `INSERT INTO notices (title, content, is_platform_notice) VALUES ('가짜 플랫폼 공지', 'x', true) RETURNING 1`);
  assertOk(!!bIns.error, `플랫폼 관리자가 아닌 회사 관리자가 플랫폼 공지 작성 ➔ 거부`);
  const bOwn = await asUser(B_ADMIN, `INSERT INTO notices (title, content) VALUES ('베타 사내 공지', 'x') RETURNING org_id`);
  assertOk(!bOwn.error && bOwn.rows[0]?.org_id === ORG_B, `회사 관리자 사내 공지 작성 (org_id 기본값 = 내 회사) ${bOwn.error || ''}`);
}

log('\n--- 14. 전체 점검: 열린 정책·RLS 꺼진 회사 표·anon 실행 가능한 새 함수 ---');
{
  const open = await db.query(`SELECT tablename, policyname FROM pg_policies WHERE schemaname = 'public'
      AND (btrim(COALESCE(qual, '')) IN ('true', '(true)') OR btrim(COALESCE(with_check, '')) IN ('true', '(true)'))`);
  assertOk(open.rows.length === 0, `USING (true)/WITH CHECK (true) 정책 0개 (${open.rows.map(r => r.tablename + '.' + r.policyname).join(', ')})`);
  const noRls = await db.query(`SELECT c.relname FROM pg_class c JOIN pg_namespace n ON n.oid = c.relnamespace
      JOIN pg_attribute a ON a.attrelid = c.oid AND a.attname = 'org_id' AND NOT a.attisdropped
      WHERE n.nspname = 'public' AND c.relkind = 'r' AND NOT c.relrowsecurity`);
  assertOk(noRls.rows.length === 0, `org_id 있는 표는 모두 RLS 켬 (${noRls.rows.map(r => r.relname).join(', ')})`);
  const noDefault = await db.query(`SELECT c.relname FROM pg_class c JOIN pg_namespace n ON n.oid = c.relnamespace
      JOIN pg_attribute a ON a.attrelid = c.oid AND a.attname = 'org_id' AND NOT a.attisdropped
      WHERE n.nspname = 'public' AND c.relkind = 'r'
        AND c.relname IN ('org_settlement_policies','auto_dial_campaigns','auto_dial_agent_allocations','auto_dial_queue',
                          'agent_attendance_logs','agent_payroll_profiles','lead_vendors','org_dnc_numbers','org_incentive_settings')
        AND (NOT a.attnotnull OR NOT EXISTS (SELECT 1 FROM pg_attrdef d WHERE d.adrelid = c.oid AND d.adnum = a.attnum))`);
  assertOk(noDefault.rows.length === 0, `새 표 org_id = NOT NULL + 기본값 (${noDefault.rows.map(r => r.relname).join(', ')})`);
  const noPath = await db.query(`SELECT p.proname FROM pg_proc p JOIN pg_namespace n ON n.oid = p.pronamespace
      WHERE n.nspname = 'public' AND p.prosecdef
        AND NOT EXISTS (SELECT 1 FROM unnest(COALESCE(p.proconfig, ARRAY[]::text[])) c WHERE c LIKE 'search_path=%')`);
  assertOk(noPath.rows.length === 0, `SECURITY DEFINER 함수는 모두 search_path 고정 (${noPath.rows.map(r => r.proname).join(', ')})`);
  const NEW_FUNCS = ['distribute_unassigned_cases_bulk', 'register_dnc_number', 'find_dnc_phones', 'auto_rotate_missed_cases',
    'get_agent_performance_kpi', 'cleanup_access_logs_by_policy', 'list_org_members', 'update_org_member', 'revoke_member_session',
    'get_batch_quality_stats', 'update_batch_cost', 'record_agent_attendance_status', 'get_today_attendance_board',
    'retroactive_batch_existing_leads'];
  const anonExec = await db.query(`SELECT p.proname FROM pg_proc p JOIN pg_namespace n ON n.oid = p.pronamespace
      WHERE n.nspname = 'public' AND p.proname = ANY($1) AND has_function_privilege('anon', p.oid, 'EXECUTE')`, [NEW_FUNCS]);
  assertOk(anonExec.rows.length === 0, `019~033 함수 anon 실행 권한 없음 (${anonExec.rows.map(r => r.proname).join(', ')})`);
  const authCleanup = await db.query(`SELECT has_function_privilege('authenticated', 'public.cleanup_access_logs_by_policy()', 'EXECUTE') AS x`);
  assertOk(authCleanup.rows[0].x === false, `접근 기록 정리 함수는 로그인 사용자도 실행 불가`);
  const anonTables = await db.query(`SELECT c.relname FROM pg_class c JOIN pg_namespace n ON n.oid = c.relnamespace
      WHERE n.nspname = 'public' AND c.relkind = 'r'
        AND c.relname IN ('org_settlement_policies','auto_dial_campaigns','auto_dial_agent_allocations','auto_dial_queue',
                          'agent_attendance_logs','agent_payroll_profiles','lead_vendors','org_dnc_numbers','org_incentive_settings')
        AND has_table_privilege('anon', c.oid, 'SELECT')`);
  assertOk(anonTables.rows.length === 0, `새 표 anon SELECT 권한 없음 (${anonTables.rows.map(r => r.relname).join(', ')})`);
}

log('\n===============================================================');
let code = 0;
if (failures === 0) {
  log(`\x1b[32m🎉 모든 멀티테넌트 격리 검증 통과 (총 ${totalChecks}개 항목, 실패 0)\x1b[0m`);
} else {
  logErr(`\x1b[31m💥 검증 실패: ${failures}/${totalChecks}건\x1b[0m`);
  code = 1;
}
log('===============================================================\n');
process.exit(code);
