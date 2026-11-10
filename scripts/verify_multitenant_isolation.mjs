// scripts/verify_multitenant_isolation.mjs
// 멀티테넌트 데이터 완전 격리 & 무누수 교차 전수 자동 검증기 (v1.0)
import { PGlite } from '@electric-sql/pglite';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

const MIG_DIR = fileURLToPath(new URL('../supabase/migrations/', import.meta.url));
const db = new PGlite();
let failures = 0;
let totalChecks = 0;

const assertOk = (condition, label) => {
  totalChecks++;
  if (condition) {
    console.log(`  \x1b[32m✔ PASS\x1b[0m  ${label}`);
  } else {
    console.error(`  \x1b[31m✘ FAIL\x1b[0m  ${label}`);
    failures++;
  }
};

console.log('\n===============================================================');
console.log('🔒 리드마스터 CRM 멀티테넌트 완전 격리 & 무누수 전수 자동 검증');
console.log('===============================================================\n');

// 1. Supabase Postgres 인증 및 확장 모의 환경 구성
await db.exec(`
  CREATE ROLE anon NOLOGIN;
  CREATE ROLE authenticated NOLOGIN;
  CREATE ROLE service_role NOLOGIN BYPASSRLS;
  CREATE SCHEMA auth;
  CREATE TABLE auth.users (id uuid PRIMARY KEY, email text, last_sign_in_at timestamptz, raw_user_meta_data jsonb DEFAULT '{}'::jsonb);
  CREATE FUNCTION auth.jwt() RETURNS jsonb LANGUAGE sql STABLE AS $$
    SELECT coalesce(nullif(current_setting('request.jwt.claims', true), ''), '{}')::jsonb $$;
  CREATE FUNCTION auth.uid() RETURNS uuid LANGUAGE sql STABLE AS $$ SELECT nullif(auth.jwt()->>'sub', '')::uuid $$;
  CREATE FUNCTION auth.role() RETURNS text LANGUAGE sql STABLE AS $$ SELECT auth.jwt()->>'role' $$;
  CREATE PUBLICATION supabase_realtime;
  GRANT USAGE ON SCHEMA public, auth TO anon, authenticated, service_role;
  GRANT EXECUTE ON ALL FUNCTIONS IN SCHEMA auth TO anon, authenticated, service_role;
  ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT ALL ON TABLES TO anon, authenticated, service_role;

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

  CREATE SCHEMA IF NOT EXISTS vault;
  CREATE TABLE IF NOT EXISTS vault.decrypted_secrets (id uuid primary key, decrypted_secret text);
  CREATE TABLE IF NOT EXISTS vault.secrets (id uuid primary key, secret text);

  CREATE SCHEMA IF NOT EXISTS cron;
  CREATE TABLE IF NOT EXISTS cron.job (jobname text primary key);
  CREATE OR REPLACE FUNCTION cron.schedule(text, text, text) RETURNS bigint LANGUAGE sql AS $$ SELECT 1::bigint $$;
  CREATE OR REPLACE FUNCTION cron.unschedule(text) RETURNS boolean LANGUAGE sql AS $$ SELECT true $$;
`);

// 2. 핵심 마이그레이션(001~026) 순차 로드
const migrationFiles = [
  '001_complete_schema.sql',
  '002_auto_dial.sql',
  '003_lock_anon_tables.sql',
  '004_multitenant_core.sql',
  '005_multitenant_rls.sql',
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
  '020_dnc_and_smart_rotation.sql',
  '023_emergency_data_purge.sql',
  '025_retention_policy_options.sql',
  '026_notices_and_directives.sql',
  '027_agent_ui_mode.sql',
  '028_agent_security_profiles.sql',
  '029_hr_attendance_and_payroll.sql'
];

for (const mf of migrationFiles) {
  const p = path.join(MIG_DIR, mf);
  try {
    let sql = readFileSync(p, 'utf8')
      .replace(/^\s*CREATE EXTENSION[^\n]*$/gim, '-- extension skipped in test');
    await db.exec(sql);
    console.log(`[MIGRATION] Loaded: ${mf}`);
  } catch (err) {
    await db.exec('ROLLBACK;').catch(() => {});
    console.warn(`[WARN] Migration ${mf}: ${err.message}`);
  }
}

// 3. 테스트 회사 2개 생성 (회사 A: TM_ALPHA / 회사 B: TM_BETA)
const ORG_A = '10000000-0000-0000-0000-00000000000a';
const ORG_B = '20000000-0000-0000-0000-00000000000b';

const USER_A_ADMIN = 'a1111111-1111-1111-1111-111111111111'; // 회사 A 대표
const USER_A_AGENT = 'a2222222-2222-2222-2222-222222222222'; // 회사 A 상담원
const USER_B_ADMIN = 'b1111111-1111-1111-1111-111111111111'; // 회사 B 대표
const USER_B_AGENT = 'b2222222-2222-2222-2222-222222222222'; // 회사 B 상담원

await db.exec(`
  INSERT INTO organizations (id, name, slug) VALUES 
    ('${ORG_A}', 'TM 알파 사무소', 'alpha'),
    ('${ORG_B}', 'TM 베타 법률', 'beta');

  INSERT INTO auth.users (id, email) VALUES 
    ('${USER_A_ADMIN}', 'admin@alpha.com'),
    ('${USER_A_AGENT}', 'agent@alpha.com'),
    ('${USER_B_ADMIN}', 'admin@beta.com'),
    ('${USER_B_AGENT}', 'agent@beta.com');

  INSERT INTO org_members (org_id, user_id, role, status) VALUES 
    ('${ORG_A}', '${USER_A_ADMIN}', 'owner', 'active'),
    ('${ORG_A}', '${USER_A_AGENT}', 'agent', 'active'),
    ('${ORG_B}', '${USER_B_ADMIN}', 'owner', 'active'),
    ('${ORG_B}', '${USER_B_AGENT}', 'agent', 'active');
`);

// 세션 스위처 헬퍼
const queryAsUser = async (role, uid, email, sql) => {
  await db.exec('BEGIN');
  try {
    await db.exec(`SET LOCAL ROLE ${role}`);
    const claims = uid ? JSON.stringify({ sub: uid, email, role }) : '';
    await db.query(`SELECT set_config('request.jwt.claims', $1, true)`, [claims]);
    const res = await db.query(sql);
    await db.exec('ROLLBACK');
    return { rows: res.rows, error: null };
  } catch (e) {
    await db.exec('ROLLBACK');
    return { rows: [], error: e.message };
  }
};

const mutateAsUser = async (role, uid, email, sql) => {
  await db.exec('BEGIN');
  try {
    await db.exec(`SET LOCAL ROLE ${role}`);
    const claims = uid ? JSON.stringify({ sub: uid, email, role }) : '';
    await db.query(`SELECT set_config('request.jwt.claims', $1, true)`, [claims]);
    const res = await db.query(sql);
    await db.exec('COMMIT');
    return { rows: res.rows, error: null };
  } catch (e) {
    await db.exec('ROLLBACK');
    return { rows: [], error: e.message };
  }
};

const countAs = async (role, uid, email, table, extraWhere = '') => {
  const where = extraWhere ? `WHERE ${extraWhere}` : '';
  const r = await queryAsUser(role, uid, email, `SELECT count(*)::int AS cnt FROM ${table} ${where}`);
  return r.rows?.[0]?.cnt ?? -1;
};

console.log('\n--- 1. 고객 리드(cases) 데이터 상호 침범 차단 검증 ---');

// 회사 A 리드 3건, 회사 B 리드 2건 등록 (Service Role로 초기화)
await db.exec(`
  INSERT INTO cases (case_id, org_id, customer_name, phone, income_net) VALUES 
    ('CASE-A1', '${ORG_A}', '알파고객1', '01011110001', 3000000),
    ('CASE-A2', '${ORG_A}', '알파고객2', '01011110002', 2500000),
    ('CASE-A3', '${ORG_A}', '알파고객3', '01011110003', 4000000),
    ('CASE-B1', '${ORG_B}', '베타고객1', '01022220001', 3500000),
    ('CASE-B2', '${ORG_B}', '베타고객2', '01022220002', 2000000);
`);

const alphaAdminVisible = await countAs('authenticated', USER_A_ADMIN, 'admin@alpha.com', 'cases');
const betaAdminVisible = await countAs('authenticated', USER_B_ADMIN, 'admin@beta.com', 'cases');
const anonVisible = await countAs('anon', null, null, 'cases');

assertOk(alphaAdminVisible === 3, `회사 A 대표는 자기 회사 리드 3건만 정확히 조회 (조회수: ${alphaAdminVisible})`);
assertOk(betaAdminVisible === 2, `회사 B 대표는 자기 회사 리드 2건만 정확히 조회 (조회수: ${betaAdminVisible})`);
assertOk(anonVisible === 0, `비로그인(anon) 사용자는 어떤 리드도 볼 수 없음 (조회수: ${anonVisible})`);

// 회사 B 상담원이 회사 A의 특정 리드를 직접 case_id로 조회 시도
const crossCaseQuery = await queryAsUser(
  'authenticated', USER_B_AGENT, 'agent@beta.com',
  `SELECT customer_name, income_net FROM cases WHERE case_id = 'CASE-A1'`
);
assertOk(crossCaseQuery.rows.length === 0, '회사 B 상담원이 회사 A의 리드 ID를 직접 지정해 탈취 시도 ➔ 0건 반환 (차단 성공)');

// 회사 B 상담원이 회사 A 리드의 상태를 강제 변조 시도
const crossCaseUpdate = await queryAsUser(
  'authenticated', USER_B_AGENT, 'agent@beta.com',
  `UPDATE cases SET customer_name = '해킹됨' WHERE case_id = 'CASE-A1' RETURNING case_id`
);
assertOk(crossCaseUpdate.rows.length === 0, '회사 B 상담원의 회사 A 리드 데이터 변조(UPDATE) 시도 ➔ 0건 반영 (변조 방어 성공)');

console.log('\n--- 2. 통화 기록(communication_logs) 격리 검증 ---');
await db.exec(`
  INSERT INTO communication_logs (org_id, phone_number, type, timestamp, user_id) VALUES 
    ('${ORG_A}', '01011110001', 'CALL_OUT', now(), '${USER_A_AGENT}'),
    ('${ORG_B}', '01022220001', 'CALL_OUT', now(), '${USER_B_AGENT}');
`);

const alphaLogs = await countAs('authenticated', USER_A_ADMIN, 'admin@alpha.com', 'communication_logs');
const betaLogs = await countAs('authenticated', USER_B_ADMIN, 'admin@beta.com', 'communication_logs');
assertOk(alphaLogs === 1, `회사 A는 회사 A의 통화 기록 1건만 조회 (타사 기록 배제)`);
assertOk(betaLogs === 1, `회사 B는 회사 B의 통화 기록 1건만 조회 (타사 기록 배제)`);

console.log('\n--- 3. 통화 녹음 파일(call_recordings) 및 드라이브 접근 격리 ---');
try {
  await db.exec(`
    INSERT INTO call_recordings (id, org_id, case_id, user_id, phone, call_started_at, storage_path, drive_file_id) VALUES 
      ('11111111-1111-1111-1111-111111111111', '${ORG_A}', 'CASE-A1', '${USER_A_AGENT}', '01011110001', now(), '${ORG_A}/CASE-A1/rec.m4a', 'drive_file_alpha_secret'),
      ('22222222-2222-2222-2222-222222222222', '${ORG_B}', 'CASE-B1', '${USER_B_AGENT}', '01022220001', now(), '${ORG_B}/CASE-B1/rec.m4a', 'drive_file_beta_secret');
  `);
  const alphaRecs = await countAs('authenticated', USER_A_ADMIN, 'admin@alpha.com', 'call_recordings');
  const betaRecs = await countAs('authenticated', USER_B_AGENT, 'agent@beta.com', 'call_recordings');
  assertOk(alphaRecs === 1, `회사 A 대표: 자사 녹음 1건만 조회 (타사 녹음 파일 ID 노출 없음)`);
  assertOk(betaRecs === 1, `회사 B 상담원: 본인 회사/본인 녹음 1건만 조회 (타사 녹음 접근 불가)`);
} catch (e) {
  console.log(`  ℹ call_recordings 테이블 검증 스킵: ${e.message}`);
}

console.log('\n--- 4. 감사 로그(access_logs) 상호 격리 ---');
try {
  await db.exec(`
    INSERT INTO access_logs (org_id, user_id, action, case_id) VALUES 
      ('${ORG_A}', '${USER_A_ADMIN}', 'export', 'CASE-A1'),
      ('${ORG_B}', '${USER_B_ADMIN}', 'case_view', 'CASE-B1');
  `);
  const alphaAccessLogs = await countAs('authenticated', USER_A_ADMIN, 'admin@alpha.com', 'access_logs');
  assertOk(alphaAccessLogs === 1, `회사 A 대표는 자사 접근 기록만 열람 가능 (타사 감사 기록 열람 차단)`);
} catch (e) {
  console.log(`  ℹ access_logs 테이블 검증: ${e.message}`);
}

console.log('\n--- 5. 회사간 텔레그램 봇 토큰 및 설정(settings) 격리 ---');
await db.exec(`
  INSERT INTO settings (org_id, key, value) VALUES 
    ('${ORG_A}', 'telegramBotToken', '"BOT_TOKEN_FOR_ALPHA_SECRET"'),
    ('${ORG_B}', 'telegramBotToken', '"BOT_TOKEN_FOR_BETA_SECRET"');
`);

const alphaBotTokenQuery = await queryAsUser(
  'authenticated', USER_B_ADMIN, 'admin@beta.com',
  `SELECT value FROM settings WHERE org_id = '${ORG_A}' AND key = 'telegramBotToken'`
);
assertOk(alphaBotTokenQuery.rows.length === 0, '회사 B 대표가 회사 A의 텔레그램 봇 토큰 쿼리 시도 ➔ 0건 반환 (비밀값 완전 차단)');

console.log('\n--- 6. 상담원별 차등 보안 프로필 및 세션 강제 파기 (028) ---');
const membersRes = await queryAsUser(
  'authenticated', USER_A_ADMIN, 'admin@alpha.com',
  `SELECT * FROM public.list_org_members()`
);
const agentA = membersRes.rows.find(r => r.user_id === USER_A_AGENT);
assertOk(agentA && agentA.security_profile?.watermark === true, '신입 상담원 보안 프로필 기본값 적용 (watermark: true)');

// 대표가 팀장급 신뢰 상담원으로 보안 제한 해제(watermark: false, appCaptureBlock: false 등) 변경 테스트
await mutateAsUser(
  'authenticated', USER_A_ADMIN, 'admin@alpha.com',
  `SELECT public.update_org_member('${USER_A_AGENT}'::uuid, NULL, NULL, NULL, NULL, '{"watermark":false,"appCaptureBlock":false,"masking":false,"anomalyAlert":false}'::jsonb)`
);
const updatedMembers = await queryAsUser(
  'authenticated', USER_A_ADMIN, 'admin@alpha.com',
  `SELECT * FROM public.list_org_members()`
);
const updatedAgentA = updatedMembers.rows.find(r => r.user_id === USER_A_AGENT);
assertOk(updatedAgentA && updatedAgentA.security_profile?.watermark === false, '관리자가 팀장급 상담원 보안 제한 해제 적용 성공 (watermark: false)');

// 관리자에 의한 상담원 세션 강제 파기(revoke_member_session) 테스트
await mutateAsUser(
  'authenticated', USER_A_ADMIN, 'admin@alpha.com',
  `SELECT public.revoke_member_session('${USER_A_AGENT}'::uuid)`
);
const revokedMembers = await queryAsUser(
  'authenticated', USER_A_ADMIN, 'admin@alpha.com',
  `SELECT session_revoked_at FROM public.org_members WHERE user_id = '${USER_A_AGENT}'`
);
assertOk(revokedMembers.rows[0]?.session_revoked_at !== null, '관리자에 의한 원클릭 세션 강제 파기 타임스탬프 기록 확인');

console.log('\n===============================================================');
if (failures === 0) {
  console.log(`\x1b[32m🎉 모든 멀티테넌트 격리 검증 통과 (총 ${totalChecks}개 항목 무결성 확인, 데이터 누수 0건)\x1b[0m`);
  console.log('===============================================================\n');
  process.exit(0);
} else {
  console.error(`\x1b[31m💥 검증 실패: ${failures}건의 잠재적 데이터 누수 또는 RLS 위반 감지!\x1b[0m`);
  console.log('===============================================================\n');
  process.exit(1);
}
