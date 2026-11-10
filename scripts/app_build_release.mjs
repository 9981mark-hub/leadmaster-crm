// scripts/app_build_release.mjs
// 안드로이드 정식 릴리즈 서명 키(leadmaster-release.jks) 자동 서명 및 배포 파이프라인
import { execSync } from 'node:child_process';
import { existsSync, copyFileSync } from 'node:fs';
import path from 'node:path';

const VERSION = '1.7.5';
const JAVA_HOME = 'C:\\Program Files\\Android\\Android Studio\\jbr';
const APKSIGNER = 'D:\\안드로이드 스튜디오 작업\\Sdk\\build-tools\\35.0.0\\apksigner.bat';
const KEYSTORE = 'D:\\안드로이드 스튜디오 작업\\Projects\\LeadMasterApp\\leadmaster-release.jks';
const KEYSTORE_PASS = 'TQyjYjvERfMi4kSfJZoW9L95fkJwSazY';
const KEY_ALIAS = 'leadmaster';
const EXPECTED_FINGERPRINT = '7ee0d49ada13f6301fc5ca284a71f9ae44b343ba4e37ce5be6816cf3bb7e0359';

const inputApk = `D:\\LeadMaster_APK\\LeadMaster_${VERSION}.apk`;
const releaseApk = `D:\\LeadMaster_APK\\LeadMaster_Release_v${VERSION}.apk`;
const publicApk = path.resolve('public', 'app', 'LeadMaster.apk');
const distApk = path.resolve('dist', 'app', 'LeadMaster.apk');

console.log('\n==========================================================');
console.log('📱 LeadMaster 안드로이드 정식 릴리즈 서명 파이프라인 (Node)');
console.log('==========================================================\n');

if (!existsSync(inputApk)) {
  console.error(`❌ 원본 APK 파일을 찾을 수 없습니다: ${inputApk}`);
  process.exit(1);
}

const env = { ...process.env, JAVA_HOME };

console.log('[1/3] 정식 릴리즈 서명 키(leadmaster-release.jks) 서명 진행 중...');
const signCmd = `"${APKSIGNER}" sign --ks "${KEYSTORE}" --ks-pass pass:${KEYSTORE_PASS} --ks-key-alias ${KEY_ALIAS} --key-pass pass:${KEYSTORE_PASS} --in "${inputApk}" --out "${releaseApk}"`;
execSync(signCmd, { env, stdio: 'inherit' });

console.log('\n[2/3] 서명 인증서 지문(SHA-256) 검증 중...');
const verifyCmd = `"${APKSIGNER}" verify --print-certs "${releaseApk}"`;
const verifyOutput = execSync(verifyCmd, { env, encoding: 'utf8' });

if (verifyOutput.toLowerCase().includes(EXPECTED_FINGERPRINT)) {
  console.log(`  \x1b[32m✔ 검증 성공: 정식 릴리즈 키 (${EXPECTED_FINGERPRINT}) 일치 확인!\x1b[0m`);
} else {
  console.error(`❌ 서명 검증 실패: 정식 릴리즈 키 지문 불일치!\n${verifyOutput}`);
  process.exit(1);
}

console.log('\n[3/3] 웹 배포 디렉토리(public/app, dist/app)로 복사 중...');
copyFileSync(releaseApk, publicApk);
console.log(`  ✔ 복사 완료: ${publicApk}`);

if (existsSync(path.dirname(distApk))) {
  copyFileSync(releaseApk, distApk);
  console.log(`  ✔ 복사 완료: ${distApk}`);
}

console.log('\n==========================================================');
console.log('🎉 정식 릴리즈 서명 APK 배포 완료 (무결성 검증 100%)');
console.log(`  - 릴리즈 원본: ${releaseApk}`);
console.log(`  - 웹 배포 대상: ${publicApk}`);
console.log('==========================================================\n');
