// scripts/app_build_release.mjs
// LeadMaster 안드로이드 앱 정식(release) 빌드 → 서명 확인 → 웹 배포 폴더로 복사.
//
// 비밀번호를 이 파일에 쓰지 않는다 (2026-11-13 [KIRO]).
// - 서명 정보: 앱 폴더의 keystore.properties (storeFile / storePassword / keyAlias / keyPassword).
//   Gradle(app/build.gradle.kts)이 이 파일로 assembleRelease를 직접 서명한다.
// - keystore.properties가 없으면 환경변수로 서명한다:
//   LM_KEYSTORE_FILE, LM_KEYSTORE_PASSWORD, LM_KEY_ALIAS, LM_KEY_PASSWORD(없으면 LM_KEYSTORE_PASSWORD)
//   비밀번호는 apksigner에 `env:` 형식으로만 넘긴다 (명령줄·로그에 값이 나오지 않음).
// - 버전(versionName/versionCode)은 app/build.gradle.kts에서 읽는다.
//
// 선택 환경변수: LM_APP_DIR(앱 폴더), LM_JAVA_HOME(JDK 17), LM_SDK_DIR, LM_APK_OUT_DIR
import { execSync } from 'node:child_process';
import { existsSync, copyFileSync, readFileSync, readdirSync, mkdirSync } from 'node:fs';
import path from 'node:path';

const APP_DIR = process.env.LM_APP_DIR || 'D:\\안드로이드 스튜디오 작업\\Projects\\LeadMasterApp';
const JAVA_HOME = process.env.LM_JAVA_HOME || 'D:\\안드로이드 스튜디오 작업\\jdk17'; // Gradle 8.13은 JDK 17 필요
const OUT_DIR = process.env.LM_APK_OUT_DIR || 'D:\\LeadMaster_APK';
const EXPECTED_FINGERPRINT = '7ee0d49ada13f6301fc5ca284a71f9ae44b343ba4e37ce5be6816cf3bb7e0359'; // 정식 인증서 SHA-256 (공개 정보)

function fail(msg) {
  console.error(`실패: ${msg}`);
  process.exit(1);
}

/** key=value 파일 읽기 (# 주석, Java properties의 \: \\ 이스케이프 처리) */
function readProperties(file) {
  const out = {};
  if (!existsSync(file)) return out;
  for (const raw of readFileSync(file, 'utf8').split(/\r?\n/)) {
    const line = raw.trim();
    if (!line || line.startsWith('#') || line.startsWith('!')) continue;
    const m = line.match(/^([^=:\s]+)\s*[=:]\s*(.*)$/);
    if (!m) continue;
    out[m[1]] = m[2].replace(/\\(.)/g, '$1');
  }
  return out;
}

function readVersion() {
  const gradleFile = path.join(APP_DIR, 'app', 'build.gradle.kts');
  if (!existsSync(gradleFile)) fail(`build.gradle.kts 없음: ${gradleFile}`);
  const src = readFileSync(gradleFile, 'utf8');
  const code = src.match(/^\s*versionCode\s*=\s*(\d+)/m)?.[1];
  const name = src.match(/^\s*versionName\s*=\s*"([^"]+)"/m)?.[1];
  if (!code || !name) fail('build.gradle.kts에서 versionCode/versionName을 찾지 못함');
  return { code: Number(code), name };
}

function findApksigner() {
  const props = readProperties(path.join(APP_DIR, 'local.properties'));
  const sdk = process.env.LM_SDK_DIR || props['sdk.dir'] || 'D:\\안드로이드 스튜디오 작업\\Sdk';
  const bt = path.join(sdk, 'build-tools');
  if (!existsSync(bt)) fail(`build-tools 폴더 없음: ${bt}`);
  const versions = readdirSync(bt)
    .filter((v) => existsSync(path.join(bt, v, 'apksigner.bat')))
    .sort((a, b) => a.localeCompare(b, undefined, { numeric: true }));
  if (!versions.length) fail('apksigner.bat을 찾지 못함');
  return path.join(bt, versions[versions.length - 1], 'apksigner.bat');
}

const { code, name } = readVersion();
const keystoreFile = path.join(APP_DIR, 'keystore.properties');
const ks = readProperties(keystoreFile);
const gradleSigns = Boolean(ks.storeFile);

console.log('\n=== LeadMaster 정식 빌드 ===');
console.log(`앱 폴더: ${APP_DIR}`);
console.log(`버전: ${name} (versionCode ${code})`);
console.log(`서명: ${gradleSigns ? 'keystore.properties (Gradle이 서명)' : '환경변수 (apksigner로 서명)'}\n`);

const env = { ...process.env, JAVA_HOME, PATH: `${path.join(JAVA_HOME, 'bin')}${path.delimiter}${process.env.PATH}` };

// 1. 빌드
console.log('[1/4] gradlew assembleRelease ...');
execSync('gradlew.bat assembleRelease --no-daemon', { cwd: APP_DIR, env, stdio: 'inherit', shell: true });

const outDirApk = path.join(APP_DIR, 'app', 'build', 'outputs', 'apk', 'release');
const apksigner = findApksigner();
const releaseApk = path.join(OUT_DIR, `LeadMaster_Release_v${name}.apk`);
mkdirSync(OUT_DIR, { recursive: true });

// 2. 서명 (keystore.properties가 없을 때만)
if (gradleSigns) {
  const signed = path.join(outDirApk, 'app-release.apk');
  if (!existsSync(signed)) fail(`서명된 APK가 없음: ${signed} (keystore.properties 확인)`);
  copyFileSync(signed, releaseApk);
  console.log('\n[2/4] Gradle이 keystore.properties로 서명함');
} else {
  const unsigned = path.join(outDirApk, 'app-release-unsigned.apk');
  if (!existsSync(unsigned)) fail(`서명 전 APK가 없음: ${unsigned}`);
  const ksPath = process.env.LM_KEYSTORE_FILE;
  const alias = process.env.LM_KEY_ALIAS;
  if (!ksPath || !alias || !process.env.LM_KEYSTORE_PASSWORD) {
    fail('keystore.properties가 없고 LM_KEYSTORE_FILE / LM_KEY_ALIAS / LM_KEYSTORE_PASSWORD 환경변수도 없음');
  }
  if (!existsSync(ksPath)) fail(`키 파일 없음: ${ksPath}`);
  const keyPassVar = process.env.LM_KEY_PASSWORD ? 'LM_KEY_PASSWORD' : 'LM_KEYSTORE_PASSWORD';
  console.log('\n[2/4] apksigner 서명 (비밀번호는 환경변수로 전달) ...');
  execSync(
    `"${apksigner}" sign --ks "${ksPath}" --ks-pass env:LM_KEYSTORE_PASSWORD --ks-key-alias "${alias}" --key-pass env:${keyPassVar} --out "${releaseApk}" "${unsigned}"`,
    { env, stdio: 'inherit', shell: true },
  );
}

// 3. 인증서 확인
console.log('\n[3/4] 서명 인증서 SHA-256 확인 ...');
const verifyOutput = execSync(`"${apksigner}" verify --print-certs "${releaseApk}"`, { env, encoding: 'utf8', shell: true });
if (!verifyOutput.toLowerCase().includes(EXPECTED_FINGERPRINT)) {
  console.error(verifyOutput);
  fail('정식 인증서 지문이 다름 (다른 키로 서명됨)');
}
console.log(`  확인: 정식 인증서 ${EXPECTED_FINGERPRINT.slice(0, 16)}…`);

// 4. 웹 배포 폴더로 복사
console.log('\n[4/4] public/app, dist/app으로 복사 ...');
const publicApk = path.resolve('public', 'app', 'LeadMaster.apk');
const distApk = path.resolve('dist', 'app', 'LeadMaster.apk');
copyFileSync(releaseApk, publicApk);
console.log(`  ${publicApk}`);
if (existsSync(path.dirname(distApk))) {
  copyFileSync(releaseApk, distApk);
  console.log(`  ${distApk}`);
}

console.log('\n=== 완료 ===');
console.log(`원본: ${releaseApk}`);
console.log(`public/app/version.json의 versionCode를 ${code}, versionName을 ${name}로 맞췄는지 확인하세요.\n`);
