import React, { useMemo, useState } from 'react';
import { X, Users, AlertCircle, CheckCircle2, UserPlus, Upload, Shield } from 'lucide-react';
import { OrgRole, ROLE_LABEL } from '../../services/org';
import { BulkInviteInput, bulkInviteMembers } from '../../services/team';

interface BulkInviteModalProps {
  orgId: string;
  isOpen: boolean;
  onClose: () => void;
  onSuccess: () => void;
  existingEmails?: string[];
}

interface ParsedEntry extends BulkInviteInput {
  raw: string;
  isValid: boolean;
  errorReason?: string;
}

export default function BulkInviteModal({
  orgId,
  isOpen,
  onClose,
  onSuccess,
  existingEmails = []
}: BulkInviteModalProps) {
  const [rawText, setRawText] = useState('');
  const [defaultRole, setDefaultRole] = useState<OrgRole>('agent');
  const [busy, setBusy] = useState(false);
  const [resultMsg, setResultMsg] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  const existingEmailSet = useMemo(() => {
    return new Set(existingEmails.map(e => e.toLowerCase().trim()));
  }, [existingEmails]);

  // 스마트 텍스트 파싱 로직
  const parsedEntries = useMemo<ParsedEntry[]>(() => {
    if (!rawText.trim()) return [];

    const lines = rawText.split(/\r?\n/).map(l => l.trim()).filter(Boolean);
    const seenInBatch = new Set<string>();

    return lines.map(line => {
      let name = '';
      let email = '';

      // 1. 탭 구분 (엑셀 복사-붙여넣기)
      if (line.includes('\t')) {
        const parts = line.split('\t').map(p => p.trim());
        if (parts[0].includes('@')) {
          email = parts[0];
          name = parts[1] || '';
        } else {
          name = parts[0];
          email = parts[1] || '';
        }
      }
      // 2. 쉼표 구분 (CSV)
      else if (line.includes(',')) {
        const parts = line.split(',').map(p => p.trim());
        if (parts[0].includes('@')) {
          email = parts[0];
          name = parts[1] || '';
        } else {
          name = parts[0];
          email = parts[1] || '';
        }
      }
      // 3. 공백 또는 슬래시 구분
      else if (line.includes('/') || line.includes(' ')) {
        const parts = line.split(/[\/\s]+/).map(p => p.trim()).filter(Boolean);
        const emailIdx = parts.findIndex(p => p.includes('@'));
        if (emailIdx !== -1) {
          email = parts[emailIdx];
          name = parts.filter((_, idx) => idx !== emailIdx).join(' ');
        } else {
          name = parts[0];
          email = parts[1] || '';
        }
      }
      // 4. 단일 이메일
      else {
        email = line;
      }

      const cleanEmail = email.toLowerCase().trim();
      const isEmailValid = /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(cleanEmail);

      let isValid = true;
      let errorReason: string | undefined;

      if (!isEmailValid) {
        isValid = false;
        errorReason = '이메일 형식 오류';
      } else if (seenInBatch.has(cleanEmail)) {
        isValid = false;
        errorReason = '입력창 내 중복';
      } else if (existingEmailSet.has(cleanEmail)) {
        isValid = false;
        errorReason = '이미 등록된 멤버';
      }

      if (isEmailValid) {
        seenInBatch.add(cleanEmail);
      }

      const displayName = name.trim() || cleanEmail.split('@')[0];

      return {
        raw: line,
        email: cleanEmail,
        displayName,
        role: defaultRole,
        isValid,
        errorReason
      };
    });
  }, [rawText, defaultRole, existingEmailSet]);

  const validEntries = useMemo(() => parsedEntries.filter(e => e.isValid), [parsedEntries]);
  const invalidEntries = useMemo(() => parsedEntries.filter(e => !e.isValid), [parsedEntries]);

  if (!isOpen) return null;

  const handleBulkSubmit = async () => {
    if (validEntries.length === 0 || busy) return;
    setBusy(true);
    setResultMsg(null);

    try {
      const res = await bulkInviteMembers(
        orgId,
        validEntries.map(e => ({
          email: e.email,
          displayName: e.displayName,
          role: e.role
        }))
      );

      if (res.failedCount === 0) {
        setResultMsg({
          type: 'success',
          text: `총 ${res.successCount}명의 상담원 초대를 성공적으로 발송했습니다!`
        });
        setTimeout(() => {
          onSuccess();
          onClose();
        }, 1200);
      } else {
        setResultMsg({
          type: 'error',
          text: `성공 ${res.successCount}건 / 실패 ${res.failedCount}건 (${res.errors.map(e => e.email).join(', ')})`
        });
        onSuccess();
      }
    } catch (err: any) {
      setResultMsg({
        type: 'error',
        text: err.message || '초대 처리 중 오류가 발생했습니다.'
      });
    } finally {
      setBusy(false);
    }
  };

  const sampleTemplate = `홍길동\thong@gmail.com\n이순신\tlee@gmail.com\n강감찬\tkang@gmail.com\n김유신\tkim@gmail.com`;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-in fade-in duration-200">
      <div className="relative w-full max-w-3xl bg-card text-card-foreground rounded-2xl shadow-2xl border border-border overflow-hidden flex flex-col max-h-[90vh]">
        {/* Header */}
        <div className="px-6 py-4 border-b border-border flex items-center justify-between bg-muted/40">
          <div className="flex items-center gap-3">
            <div className="p-2.5 bg-primary/10 border border-primary/20 rounded-xl text-primary shadow-2xs">
              <Users size={18} strokeWidth={1.75} />
            </div>
            <div>
              <h3 className="font-bold text-foreground text-base">상담원 대량 초대 (10~50명)</h3>
              <p className="text-2xs text-muted-foreground mt-0.5">
                엑셀이나 명단에서 [이름, 구글 이메일]을 한 번에 복사-붙여넣기하여 즉시 초대합니다.
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-1.5 text-muted-foreground hover:text-foreground rounded-lg hover:bg-muted transition-colors cursor-pointer"
          >
            <X size={18} />
          </button>
        </div>

        {/* Content Body */}
        <div className="p-6 overflow-y-auto space-y-5">
          {/* Default Role Selection */}
          <div className="flex items-center justify-between bg-muted/30 border border-border rounded-xl p-3.5 shadow-2xs">
            <div className="flex items-center gap-2 text-xs text-foreground font-medium">
              <Shield size={16} className="text-primary" strokeWidth={1.75} />
              <span>기본 부여 권한:</span>
            </div>
            <select
              value={defaultRole}
              onChange={e => setDefaultRole(e.target.value as OrgRole)}
              className="text-xs font-semibold px-3 py-1.5 border border-input rounded-lg bg-background text-foreground outline-none focus:ring-1 focus:ring-primary cursor-pointer shadow-2xs"
            >
              <option value="agent">상담원 (본인 리드 및 통화 전용)</option>
              <option value="admin">관리자 (사무장/팀장 전용)</option>
            </select>
          </div>

          {/* Paste Input Area */}
          <div className="space-y-2">
            <div className="flex items-center justify-between text-xs">
              <label className="font-semibold text-foreground flex items-center gap-1.5">
                <Upload size={14} className="text-primary" /> 
                <span>엑셀/텍스트 데이터 붙여넣기</span>
              </label>
              <button
                type="button"
                onClick={() => setRawText(sampleTemplate)}
                className="text-xs font-semibold text-primary hover:underline cursor-pointer"
              >
                예시 템플릿 채우기
              </button>
            </div>
            <textarea
              rows={6}
              value={rawText}
              onChange={e => setRawText(e.target.value)}
              placeholder={`엑셀에서 복사하여 그대로 붙여넣으세요:\n홍길동\thong@gmail.com\n이순신\tlee@gmail.com\n강감찬\tkang@gmail.com`}
              className="w-full font-mono text-xs p-3.5 border border-input rounded-xl bg-background text-foreground focus:outline-none focus:ring-1 focus:ring-primary leading-relaxed resize-y shadow-2xs"
            />
          </div>

          {/* Real-time Validation Summary Badge */}
          {parsedEntries.length > 0 && (
            <div className="flex items-center gap-4 text-xs font-mono">
              <span className="text-muted-foreground">감지: {parsedEntries.length}명</span>
              <span className="text-primary flex items-center gap-1 font-semibold">
                <CheckCircle2 size={13} /> 유효 초대 가능: {validEntries.length}명
              </span>
              {invalidEntries.length > 0 && (
                <span className="text-destructive flex items-center gap-1 font-semibold">
                  <AlertCircle size={13} /> 제외/오류: {invalidEntries.length}명
                </span>
              )}
            </div>
          )}

          {/* Parsed Preview Table */}
          {parsedEntries.length > 0 && (
            <div className="border border-border rounded-xl overflow-hidden max-h-56 overflow-y-auto bg-card shadow-2xs">
              <table className="w-full text-xs text-left">
                <thead className="bg-muted text-muted-foreground font-mono text-2xs uppercase sticky top-0 z-10 border-b border-border">
                  <tr>
                    <th className="p-2.5">상태</th>
                    <th className="p-2.5">이름</th>
                    <th className="p-2.5">구글 이메일</th>
                    <th className="p-2.5">부여 권한</th>
                    <th className="p-2.5">사유</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border bg-card">
                  {parsedEntries.map((item, idx) => (
                    <tr key={idx} className={item.isValid ? 'hover:bg-muted/30' : 'bg-destructive/5'}>
                      <td className="p-2.5">
                        {item.isValid ? (
                          <span className="inline-flex items-center text-primary font-bold">
                            <CheckCircle2 size={13} className="mr-1" /> 정상
                          </span>
                        ) : (
                          <span className="inline-flex items-center text-destructive font-bold">
                            <AlertCircle size={13} className="mr-1" /> 제외
                          </span>
                        )}
                      </td>
                      <td className="p-2.5 font-medium text-foreground">{item.displayName}</td>
                      <td className="p-2.5 font-mono text-muted-foreground">{item.email}</td>
                      <td className="p-2.5 text-muted-foreground">{ROLE_LABEL[item.role || 'agent']}</td>
                      <td className="p-2.5 text-destructive font-medium">{item.errorReason || '-'}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}

          {/* Status Feedback Banner */}
          {resultMsg && (
            <div
              className={`p-3.5 rounded-xl text-xs font-semibold flex items-center gap-2 ${
                resultMsg.type === 'success'
                  ? 'bg-primary/10 text-primary border border-primary/20'
                  : 'bg-destructive/10 text-destructive border border-destructive/20'
              }`}
            >
              {resultMsg.type === 'success' ? <CheckCircle2 size={16} /> : <AlertCircle size={16} />}
              <span>{resultMsg.text}</span>
            </div>
          )}
        </div>

        {/* Footer Actions */}
        <div className="px-6 py-4 border-t border-border bg-muted/40 flex items-center justify-between">
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2 text-xs font-semibold text-foreground bg-card border border-border rounded-lg hover:bg-muted transition-colors shadow-2xs cursor-pointer"
          >
            닫기
          </button>
          <button
            type="button"
            onClick={handleBulkSubmit}
            disabled={validEntries.length === 0 || busy}
            className="px-5 py-2 text-xs font-bold text-primary-foreground bg-primary hover:bg-primary/90 disabled:opacity-40 rounded-lg shadow-2xs flex items-center gap-1.5 transition-all cursor-pointer"
          >
            <UserPlus size={14} />
            <span>{busy ? '일괄 초대 발송 중…' : `${validEntries.length}명 일괄 초대 발송`}</span>
          </button>
        </div>
      </div>
    </div>
  );
}
