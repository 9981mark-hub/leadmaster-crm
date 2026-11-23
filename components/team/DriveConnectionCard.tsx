import React, { useCallback, useEffect, useState } from 'react';
import { HardDrive, Link2, FolderPlus, FolderOpen, FlaskConical, Unlink, RefreshCw, Check, X, FileAudio, Download } from 'lucide-react';
import { useToast } from '../../contexts/ToastContext';
import { useConfirmDialog } from '../../contexts/ConfirmDialogContext';
import {
  DriveStatus, fetchDriveStatus, startDriveConnect, createDriveFolder, setDriveFolder, testDrive, disconnectDrive,
  openDrivePicker, PICKER_API_KEY, takeDriveReturnFlag, DRIVE_RETURN_MESSAGES, importLegacyRecordings, LegacyImportStats,
} from '../../services/drive';

const fmt = (iso?: string | null) => {
  if (!iso) return '';
  const d = new Date(iso);
  const p = (n: number) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())} ${p(d.getHours())}:${p(d.getMinutes())}`;
};

/** 팀 관리 → 녹음 설정 안: 회사 구글 드라이브 연결 (녹음 장기 보관) */
export default function DriveConnectionCard() {
  const { showToast } = useToast();
  const { confirm } = useConfirmDialog();
  const [st, setSt] = useState<DriveStatus | null | undefined>(undefined); // undefined = 불러오는 중, null = 서버 준비 전
  const [busy, setBusy] = useState<string | null>(null);

  const reload = useCallback(async () => {
    try { setSt(await fetchDriveStatus()); }
    catch (e: any) { showToast(`드라이브 상태를 불러오지 못했습니다: ${e.message}`, 'error'); setSt(null); }
  }, [showToast]);

  useEffect(() => {
    const flag = takeDriveReturnFlag();
    if (flag) { const m = DRIVE_RETURN_MESSAGES[flag] || DRIVE_RETURN_MESSAGES.error; showToast(m.msg, m.type); }
    reload();
  }, [reload, showToast]);

  const run = async (key: string, fn: () => Promise<any>, okMsg?: string) => {
    setBusy(key);
    try { await fn(); if (okMsg) showToast(okMsg, 'success'); }
    catch (e: any) { showToast(e.message || '실패했습니다', 'error'); }
    finally { setBusy(null); reload(); }
  };

  const pickFolder = () => run('pick', async () => {
    const docs = await openDrivePicker('folder');
    if (!docs || !docs[0]) return;
    const r = await setDriveFolder(docs[0].id);
    showToast(`보관 폴더를 "${r.folder.name}"(으)로 정했습니다.`, 'success');
  });
  const allowFiles = () => run('allow', async () => {
    if (!st?.rootFolderId) return;
    const docs = await openDrivePicker('files', st.rootFolderId);
    if (!docs) return;
    showToast(`기존 파일 ${docs.length}개를 리드마스터에서 열 수 있게 허용했습니다. 연결 시험으로 확인하세요.`, 'success');
  });
  const newFolder = () => run('create', async () => {
    const name = window.prompt('드라이브에 만들 폴더 이름', '리드마스터 통화녹음');
    if (name === null) return;
    const r = await createDriveFolder(name);
    showToast(`드라이브에 "${r.folder.name}" 폴더를 만들어 보관 폴더로 정했습니다.`, 'success');
  });
  const [imp, setImp] = useState<LegacyImportStats | null>(null);
  const importLegacy = () => run('import', async () => {
    const r = await importLegacyRecordings(false);
    setImp(r.stats);
    const s = r.stats;
    showToast(`예전 녹음 ${s.imported}개를 드라이브 보관 녹음으로 등록했습니다.${s.need_allow ? ` 허용이 필요한 파일 ${s.need_allow}개` : ''}${s.more ? ' (남은 것이 있어 한 번 더 누르세요)' : ''}`, s.errors ? 'error' : 'success');
  });
  const test = () => run('test', async () => {
    const r = await testDrive();
    showToast(r.test.ok ? '연결 시험 성공: 드라이브에 올리고 지우기까지 됐습니다.' : '연결 시험 중 실패한 단계가 있습니다. 아래 결과를 보세요.', r.test.ok ? 'success' : 'error');
  });
  const disconnect = async () => {
    const ok = await confirm({
      title: '구글 드라이브 연결 해제',
      message: '구글 드라이브 연결을 해제할까요?\n\n드라이브에 있는 녹음 파일은 지워지지 않습니다. 해제하는 동안 새 녹음은 드라이브에 올라가지 않습니다.',
      confirmText: '연결 해제',
      cancelText: '취소',
      variant: 'danger',
    });
    if (!ok) return;
    run('disconnect', disconnectDrive, '구글 드라이브 연결을 해제했습니다.');
  };

  const btn = 'px-3 py-1.5 text-xs font-semibold rounded-lg border flex items-center gap-1 disabled:opacity-40';
  if (st === undefined) return <div className="text-xs text-muted-foreground px-1 py-2">드라이브 연결 상태 확인 중…</div>;
  if (st === null) return <div className="text-xs text-muted-foreground px-1 py-2 flex items-center gap-1"><HardDrive size={13} /> 구글 드라이브 보관은 서버 업데이트 후 사용할 수 있습니다.</div>;

  const ready = st.connected && !!st.rootFolderId;
  return (
    <div className="rounded-xl border border-border p-4 space-y-3 bg-muted/20 text-xs">
      <div className="flex flex-wrap items-center gap-2">
        <HardDrive size={16} className="text-primary" />
        <b className="text-sm font-bold text-foreground">녹음 원본 장기 보관 (회사 구글 드라이브)</b>
        {ready ? <span className="text-2xs px-2 py-0.5 rounded-md bg-primary/10 text-primary border border-primary/20 font-semibold">보관 준비됨</span>
          : st.connected ? <span className="text-2xs px-2 py-0.5 rounded-md bg-amber-500/10 text-amber-500 border border-amber-500/20 font-semibold">폴더를 정하세요</span>
          : st.status === 'error' ? <span className="text-2xs px-2 py-0.5 rounded-md bg-destructive/10 text-destructive border border-destructive/20 font-semibold">다시 연결 필요</span>
          : <span className="text-2xs px-2 py-0.5 rounded-md bg-muted text-muted-foreground border border-border font-semibold">연결 안 됨</span>}
        <button onClick={reload} className="ml-auto text-xs text-muted-foreground hover:text-foreground flex items-center gap-1 cursor-pointer transition-colors"><RefreshCw size={12} /> 새로고침</button>
      </div>
      <p className="text-2xs text-muted-foreground leading-relaxed">통화 녹음 원본을 <b className="text-foreground">회사 구글 드라이브</b>에 쌓습니다. 파일은 비공개이고, 리드마스터는 자기가 만든 파일과 허용받은 파일만 다룹니다(회사 드라이브의 다른 파일은 못 봄). 자동 삭제는 하지 않습니다.</p>

      {(st.connected || st.status === 'error') && (
        <div className="text-xs grid grid-cols-[7rem_1fr] gap-y-1 text-muted-foreground">
          <span>구글 계정</span><b className="text-foreground font-mono">{st.googleEmail || '-'}</b>
          <span>보관 폴더</span><b className="text-foreground">{st.rootFolderName ? `${st.rootFolderName} (${st.folderMode === 'picked' ? '기존 폴더' : '새로 만든 폴더'})` : '아직 안 정함'}</b>
          <span>연결한 시각</span><span className="font-mono">{fmt(st.connectedAt)}</span>
          {st.lastOkAt && <><span>마지막 정상</span><span className="font-mono">{fmt(st.lastOkAt)}</span></>}
          {st.lastError && <><span className="text-destructive font-semibold">문제</span><span className="text-destructive">{st.lastError}</span></>}
        </div>
      )}

      <div className="flex flex-wrap gap-2 pt-1">
        {!st.connected && (
          <button onClick={() => run('connect', startDriveConnect)} disabled={!!busy} className={`${btn} border-primary bg-primary text-primary-foreground hover:bg-primary/90 shadow-2xs cursor-pointer`}>
            <Link2 size={13} /> {st.status === 'error' ? '구글 드라이브 다시 연결' : '구글 드라이브 연결'}
          </button>
        )}
        {st.connected && (
          <>
            <button onClick={newFolder} disabled={!!busy} className={`${btn} border-border bg-card text-foreground hover:bg-muted shadow-2xs cursor-pointer`}><FolderPlus size={13} /> 새 폴더 만들기</button>
            <button onClick={pickFolder} disabled={!!busy || !PICKER_API_KEY} title={PICKER_API_KEY ? '' : '구글 파일 선택 창 설정(API 키) 후 사용할 수 있습니다'} className={`${btn} border-border bg-card text-foreground hover:bg-muted shadow-2xs cursor-pointer`}><FolderOpen size={13} /> 기존 폴더 고르기</button>
            {st.rootFolderId && st.folderMode === 'picked' && (
              <button onClick={allowFiles} disabled={!!busy || !PICKER_API_KEY} className={`${btn} border-border bg-card text-foreground hover:bg-muted shadow-2xs cursor-pointer`}><FileAudio size={13} /> 기존 파일 허용</button>
            )}
            {st.rootFolderId && (
              <button onClick={importLegacy} disabled={!!busy} title="리드 상세에 예전 방식으로 올린 드라이브 녹음을 '통화 녹음·AI' 탭의 드라이브 보관 녹음으로 등록합니다. 파일은 옮기지 않습니다." className={`${btn} border-border bg-card text-foreground hover:bg-muted shadow-2xs cursor-pointer`}><Download size={13} /> {busy === 'import' ? '등록 중…' : '예전 녹음 등록'}</button>
            )}
            <button onClick={test} disabled={!!busy || !st.rootFolderId} className={`${btn} border-primary/30 text-primary bg-primary/10 hover:bg-primary/20 shadow-2xs cursor-pointer`}><FlaskConical size={13} /> {busy === 'test' ? '시험 중…' : '연결 시험'}</button>
            <button onClick={() => run('connect', startDriveConnect)} disabled={!!busy} className={`${btn} border-border text-muted-foreground hover:text-foreground hover:bg-muted cursor-pointer`}><Link2 size={13} /> 다른 계정으로 다시 연결</button>
            <button onClick={disconnect} disabled={!!busy} className={`${btn} border-destructive/30 text-destructive hover:bg-destructive/10 cursor-pointer`}><Unlink size={13} /> 연결 해제</button>
          </>
        )}
      </div>
      {st.connected && !PICKER_API_KEY && <p className="text-xs text-muted-foreground">기존 폴더 고르기·기존 파일 허용은 구글 파일 선택 창 설정 후 열립니다.</p>}

      {imp && (
        <div className="rounded-lg bg-muted/40 border border-border p-3 text-xs text-muted-foreground grid grid-cols-[12rem_1fr] gap-y-0.5">
          <span>녹음이 있는 리드 / 녹음 링크</span><b>{imp.cases}건 / {imp.items}개</b>
          <span>이번에 등록</span><b className="text-primary font-bold">{imp.imported}개</b>
          <span>이미 등록됨</span><span>{imp.already}개</span>
          <span>허용 필요 (기존 파일 허용 후 다시)</span><span className={imp.need_allow ? 'text-amber-500 font-semibold' : ''}>{imp.need_allow}개</span>
          <span>드라이브 링크 아님 (임시 주소 등)</span><span>{imp.not_drive}개</span>
          {imp.trashed > 0 && <><span>드라이브 휴지통에 있음</span><span>{imp.trashed}개</span></>}
          {imp.errors > 0 && <><span className="text-destructive">오류</span><span className="text-destructive">{imp.errors}개</span></>}
          {imp.more && <span className="col-span-2 text-amber-500">시간 제한으로 일부만 처리했습니다. 한 번 더 누르세요.</span>}
        </div>
      )}

      {st.lastTest && (
        <div className="rounded-lg bg-muted/40 border border-border p-3 text-xs space-y-1">
          <div className="font-semibold text-foreground">마지막 연결 시험 {fmt(st.lastTest.at)} · {st.lastTest.ok ? '성공' : '실패'}</div>
          {st.lastTest.steps.map((s, i) => (
            <div key={i} className="flex items-start gap-1.5">
              {s.ok ? <Check size={12} className="text-primary mt-0.5" /> : <X size={12} className="text-destructive mt-0.5" />}
              <span className="text-foreground">{s.step}</span>
              {s.detail && <span className="text-muted-foreground">· {s.detail}</span>}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
