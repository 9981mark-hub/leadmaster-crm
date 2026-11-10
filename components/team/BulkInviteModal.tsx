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
      <div className="relative w-full max-w-3xl bg-white dark:bg-gray-800 rounded-2xl shadow-2xl border border-gray-100 dark:border-gray-700 overflow-hidden flex flex-col max-h-[90vh]">
        {/* Header */}
        <div className="px-6 py-4 border-b border-gray-100 dark:border-gray-700 flex items-center justify-between bg-gray-50/70 dark:bg-gray-800/70">
          <div className="flex items-center gap-2.5">
            <div className="p-2 bg-blue-50 dark:bg-blue-900/40 rounded-xl text-blue-600 dark:text-blue-400">
              <Users size={20} />
            </div>
            <div>
              <h3 className="font-bold text-gray-900 dark:text-white text-lg">상담원 대량 초대 (10~50명)</h3>
              <p className="text-xs text-gray-500 dark:text-gray-400">
                엑셀이나 명단에서 [이름, 구글 이메일]을 한 번에 복사-붙여넣기하여 즉시 초대합니다.
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-2 text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors"
          >
            <X size={18} />
          </button>
        </div>

        {/* Content Body */}
        <div className="p-6 overflow-y-auto space-y-5">
          {/* Default Role Selection */}
          <div className="flex items-center justify-between bg-blue-50/50 dark:bg-blue-950/20 border border-blue-100 dark:border-blue-900/30 rounded-xl p-3">
            <div className="flex items-center gap-2 text-xs text-blue-800 dark:text-blue-300">
              <Shield size={16} />
              <span>기본 부여 권한:</span>
            </div>
            <select
              value={defaultRole}
              onChange={e => setDefaultRole(e.target.value as OrgRole)}
              className="text-xs font-semibold px-3 py-1.5 border border-blue-200 dark:border-blue-800 rounded-lg bg-white dark:bg-gray-700 text-gray-800 dark:text-white"
            >
              <option value="agent">상담원 (본인 리드 및 통화 전용)</option>
              <option value="admin">관리자 (사무장/팀장 전용)</option>
            </select>
          </div>

          {/* Paste Input Area */}
          <div className="space-y-2">
            <div className="flex items-center justify-between text-xs">
              <label className="font-semibold text-gray-700 dark:text-gray-300 flex items-center gap-1.5">
                <Upload size={14} /> 엑셀/텍스트 데이터 붙여넣기
              </label>
              <button
                type="button"
                onClick={() => setRawText(sampleTemplate)}
                className="text-blue-600 hover:underline"
              >
                예시 템플릿 채우기
              </button>
            </div>
            <textarea
              rows={6}
              value={rawText}
              onChange={e => setRawText(e.target.value)}
              placeholder={`엑셀에서 복사하여 그대로 붙여넣으세요:\n홍길동\thong@gmail.com\n이순신\tlee@gmail.com\n강감찬\tkang@gmail.com`}
              className="w-full font-mono text-xs p-3 border border-gray-200 dark:border-gray-700 rounded-xl bg-gray-50 dark:bg-gray-900 text-gray-800 dark:text-gray-100 focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>

          {/* Real-time Validation Summary Badge */}
          {parsedEntries.length > 0 && (
            <div className="flex items-center gap-4 text-xs font-medium">
              <span className="text-gray-500">감지: {parsedEntries.length}명</span>
              <span className="text-emerald-600 dark:text-emerald-400 flex items-center gap-1">
                <CheckCircle2 size={13} /> 유효 초대 가능: {validEntries.length}명
              </span>
              {invalidEntries.length > 0 && (
                <span className="text-amber-600 dark:text-amber-400 flex items-center gap-1">
                  <AlertCircle size={13} /> 제외/오류: {invalidEntries.length}명
                </span>
              )}
            </div>
          )}

          {/* Parsed Preview Table */}
          {parsedEntries.length > 0 && (
            <div className="border border-gray-200 dark:border-gray-700 rounded-xl overflow-hidden max-h-56 overflow-y-auto">
              <table className="w-full text-xs text-left">
                <thead className="bg-gray-100 dark:bg-gray-700 text-gray-500 font-semibold sticky top-0">
                  <tr>
                    <th className="p-2.5">상태</th>
                    <th className="p-2.5">이름</th>
                    <th className="p-2.5">구글 이메일</th>
                    <th className="p-2.5">부여 권한</th>
                    <th className="p-2.5">사유</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100 dark:divide-gray-700 bg-white dark:bg-gray-800">
                  {parsedEntries.map((item, idx) => (
                    <tr key={idx} className={item.isValid ? '' : 'bg-red-50/40 dark:bg-red-950/20'}>
                      <td className="p-2.5">
                        {item.isValid ? (
                          <span className="inline-flex items-center text-emerald-600 font-bold">
                            <CheckCircle2 size={13} className="mr-1" /> 정상
                          </span>
                        ) : (
                          <span className="inline-flex items-center text-red-500 font-bold">
                            <AlertCircle size={13} className="mr-1" /> 제외
                          </span>
                        )}
                      </td>
                      <td className="p-2.5 font-medium text-gray-800 dark:text-gray-200">{item.displayName}</td>
                      <td className="p-2.5 font-mono text-gray-600 dark:text-gray-300">{item.email}</td>
                      <td className="p-2.5 text-gray-500">{ROLE_LABEL[item.role || 'agent']}</td>
                      <td className="p-2.5 text-red-500 font-medium">{item.errorReason || '-'}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}

          {/* Status Feedback Banner */}
          {resultMsg && (
            <div
              className={`p-3 rounded-xl text-xs font-semibold flex items-center gap-2 ${
                resultMsg.type === 'success'
                  ? 'bg-emerald-50 text-emerald-800 border border-emerald-200 dark:bg-emerald-950/40 dark:text-emerald-300'
                  : 'bg-red-50 text-red-800 border border-red-200 dark:bg-red-950/40 dark:text-red-300'
              }`}
            >
              {resultMsg.type === 'success' ? <CheckCircle2 size={16} /> : <AlertCircle size={16} />}
              <span>{resultMsg.text}</span>
            </div>
          )}
        </div>

        {/* Footer Actions */}
        <div className="px-6 py-4 border-t border-gray-100 dark:border-gray-700 bg-gray-50/70 dark:bg-gray-800/70 flex items-center justify-between">
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2 text-xs font-semibold text-gray-600 dark:text-gray-300 hover:bg-gray-200/60 dark:hover:bg-gray-700 rounded-xl transition-colors"
          >
            닫기
          </button>
          <button
            type="button"
            onClick={handleBulkSubmit}
            disabled={validEntries.length === 0 || busy}
            className="px-5 py-2 text-xs font-bold text-white bg-blue-600 hover:bg-blue-700 disabled:opacity-50 rounded-xl shadow-md shadow-blue-500/20 flex items-center gap-1.5 transition-all"
          >
            <UserPlus size={14} />
            {busy ? '일괄 초대 발송 중...' : `${validEntries.length}명 일괄 초대 발송`}
          </button>
        </div>
      </div>
    </div>
  );
}
