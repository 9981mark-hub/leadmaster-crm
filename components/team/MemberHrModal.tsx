import React, { useState, useEffect } from 'react';
import {
  X, User, Phone, MapPin, Calendar, CreditCard,
  AlertTriangle, Shield, Check, HeartHandshake, Briefcase,
  FileText, Clock, Building, Save, Sparkles, UserCheck
} from 'lucide-react';
import { TeamMember } from '../../services/team';
import {
  MemberHrProfile, fetchMemberHrProfile, saveMemberHrProfile,
  calculateTenure, MAJOR_BANKS
} from '../../services/memberHr';
import { useToast } from '../../contexts/ToastContext';
import { getStandardRoleInfo } from '../../services/org';

interface MemberHrModalProps {
  isOpen: boolean;
  onClose: () => void;
  member: TeamMember | null;
  orgId: string;
  canEdit?: boolean;
  onSaved?: () => void;
}

type HrTab = 'basic' | 'job' | 'payroll' | 'emergency';

export const MemberHrModal: React.FC<MemberHrModalProps> = ({
  isOpen,
  onClose,
  member,
  orgId,
  canEdit = true,
  onSaved
}) => {
  const { showToast } = useToast();
  const [activeTab, setActiveTab] = useState<HrTab>('basic');
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);

  // Form State
  const [formData, setFormData] = useState<MemberHrProfile>({
    userId: '',
    orgId: '',
    displayName: '',
    email: '',
    phone: '',
    birthDate: '',
    gender: '',
    address: '',
    addressDetail: '',
    jobTitle: '',
    employmentType: 'regular',
    hireDate: '',
    bankName: '',
    accountNumber: '',
    accountHolder: '',
    emergencyContactName: '',
    emergencyContactRelation: '',
    emergencyContactPhone: '',
    notes: '',
  });

  // 전화번호 자동 하이픈 포맷팅
  const formatPhone = (val: string) => {
    const raw = val.replace(/[^0-9]/g, '');
    if (raw.length <= 3) return raw;
    if (raw.length <= 7) return `${raw.slice(0, 3)}-${raw.slice(3)}`;
    return `${raw.slice(0, 3)}-${raw.slice(3, 7)}-${raw.slice(7, 11)}`;
  };

  // 프로필 데이터 로드
  useEffect(() => {
    if (!isOpen || !member) return;

    let isMounted = true;
    setLoading(true);

    fetchMemberHrProfile(orgId, member.userId, {
      displayName: member.displayName,
      email: member.email
    })
      .then((profile) => {
        if (!isMounted) return;
        setFormData(profile);
      })
      .catch((err) => {
        console.error('Failed to load member HR profile:', err);
        showToast('인사 정보를 불러오는데 실패했습니다.', 'error');
      })
      .finally(() => {
        if (isMounted) setLoading(false);
      });

    return () => {
      isMounted = false;
    };
  }, [isOpen, member, orgId]);

  if (!isOpen || !member) return null;

  const roleInfo = getStandardRoleInfo(member.role, member.adminPermissions?.tier);
  const tenure = calculateTenure(formData.hireDate);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!canEdit) return;

    setSaving(true);
    try {
      await saveMemberHrProfile(orgId, {
        ...formData,
        userId: member.userId,
        orgId
      });
      showToast(`${member.displayName}님의 인사 정보가 성공적으로 저장되었습니다.`, 'success');
      onSaved?.();
      onClose();
    } catch (err: any) {
      console.error('Failed to save HR profile:', err);
      showToast(`저장 실패: ${err?.message || '알 수 없는 오류'}`, 'error');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-background/80 backdrop-blur-xs animate-in fade-in duration-200">
      <div className="relative w-full max-w-2xl bg-card text-foreground rounded-2xl shadow-2xl border border-border flex flex-col max-h-[92vh] overflow-hidden">
        {/* Header */}
        <div className="p-5 md:p-6 pb-4 border-b border-border bg-muted/40 flex items-start justify-between gap-4">
          <div className="flex items-center gap-3 min-w-0">
            <div className="w-10 h-10 rounded-xl bg-primary/10 text-primary border border-primary/20 flex items-center justify-center shrink-0 shadow-2xs font-mono font-bold text-base">
              {member.displayName?.slice(0, 1) || 'M'}
            </div>
            <div className="min-w-0">
              <div className="flex items-center gap-2 flex-wrap">
                <h2 className="text-base font-semibold text-foreground truncate">
                  {member.displayName}
                </h2>
                <span className="text-2xs font-mono px-2 py-0.5 rounded-md bg-muted/60 text-foreground border border-border">
                  {member.teamName || '1팀'}
                </span>
                <span className={`text-2xs font-mono px-2 py-0.5 rounded-md font-medium border ${roleInfo.colorClass}`}>
                  {roleInfo.badgeText}
                </span>
                {member.status === 'disabled' && (
                  <span className="text-2xs font-mono px-2 py-0.5 rounded-md bg-destructive/10 text-destructive border border-destructive/20 font-medium">
                    사용 중지
                  </span>
                )}
              </div>
              <p className="text-xs text-muted-foreground font-mono truncate mt-0.5">
                {member.email} · 전사 직원 인사 및 세부 프로필 관리
              </p>
            </div>
          </div>

          <button
            onClick={onClose}
            className="p-1.5 rounded-lg text-muted-foreground hover:text-foreground hover:bg-muted transition-colors cursor-pointer shrink-0"
          >
            <X size={18} />
          </button>
        </div>

        {/* Tab Switcher */}
        <div className="px-6 pt-2 border-b border-border bg-card flex gap-1.5 overflow-x-auto text-xs font-mono">
          <button
            type="button"
            onClick={() => setActiveTab('basic')}
            className={`pb-2.5 px-3 border-b-2 font-medium transition-colors flex items-center gap-1.5 cursor-pointer whitespace-nowrap ${
              activeTab === 'basic'
                ? 'border-primary text-primary font-semibold'
                : 'border-transparent text-muted-foreground hover:text-foreground'
            }`}
          >
            <User size={13} /> 기본 인적사항
          </button>
          <button
            type="button"
            onClick={() => setActiveTab('job')}
            className={`pb-2.5 px-3 border-b-2 font-medium transition-colors flex items-center gap-1.5 cursor-pointer whitespace-nowrap ${
              activeTab === 'job'
                ? 'border-primary text-primary font-semibold'
                : 'border-transparent text-muted-foreground hover:text-foreground'
            }`}
          >
            <Briefcase size={13} /> 직무 및 재직
          </button>
          <button
            type="button"
            onClick={() => setActiveTab('payroll')}
            className={`pb-2.5 px-3 border-b-2 font-medium transition-colors flex items-center gap-1.5 cursor-pointer whitespace-nowrap ${
              activeTab === 'payroll'
                ? 'border-primary text-primary font-semibold'
                : 'border-transparent text-muted-foreground hover:text-foreground'
            }`}
          >
            <CreditCard size={13} /> 급여 계좌
          </button>
          <button
            type="button"
            onClick={() => setActiveTab('emergency')}
            className={`pb-2.5 px-3 border-b-2 font-medium transition-colors flex items-center gap-1.5 cursor-pointer whitespace-nowrap ${
              activeTab === 'emergency'
                ? 'border-primary text-primary font-semibold'
                : 'border-transparent text-muted-foreground hover:text-foreground'
            }`}
          >
            <HeartHandshake size={13} /> 비상연락망 & 메모
          </button>
        </div>

        {/* Body Content Form */}
        <form onSubmit={handleSubmit} className="flex-1 overflow-y-auto p-5 md:p-6 space-y-4">
          {loading ? (
            <div className="py-16 text-center text-xs font-mono text-muted-foreground">
              인사 프로필을 불러오고 있습니다...
            </div>
          ) : (
            <>
              {/* TAB 1: 기본 인적사항 */}
              {activeTab === 'basic' && (
                <div className="space-y-4 animate-in fade-in duration-150">
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
                    <div>
                      <label className="block text-xs font-mono font-medium text-foreground mb-1.5">
                        성명 (실명) <span className="text-destructive">*</span>
                      </label>
                      <input
                        type="text"
                        value={formData.displayName}
                        disabled={!canEdit}
                        onChange={(e) => setFormData({ ...formData, displayName: e.target.value })}
                        placeholder="홍길동"
                        className="w-full p-2.5 text-xs font-mono rounded-lg border border-border bg-card text-foreground focus:ring-1 focus:ring-primary outline-none"
                        required
                      />
                    </div>

                    <div>
                      <label className="block text-xs font-mono font-medium text-foreground mb-1.5">
                        휴대전화 번호 <span className="text-destructive">*</span>
                      </label>
                      <div className="relative">
                        <input
                          type="tel"
                          value={formData.phone}
                          disabled={!canEdit}
                          onChange={(e) => setFormData({ ...formData, phone: formatPhone(e.target.value) })}
                          placeholder="010-0000-0000"
                          className="w-full p-2.5 pl-8 text-xs font-mono rounded-lg border border-border bg-card text-foreground focus:ring-1 focus:ring-primary outline-none"
                        />
                        <Phone size={13} className="absolute left-2.5 top-3 text-muted-foreground" />
                      </div>
                    </div>

                    <div>
                      <label className="block text-xs font-mono font-medium text-foreground mb-1.5">
                        생년월일
                      </label>
                      <input
                        type="date"
                        value={formData.birthDate || ''}
                        disabled={!canEdit}
                        onChange={(e) => setFormData({ ...formData, birthDate: e.target.value })}
                        className="w-full p-2.5 text-xs font-mono rounded-lg border border-border bg-card text-foreground focus:ring-1 focus:ring-primary outline-none"
                      />
                    </div>

                    <div>
                      <label className="block text-xs font-mono font-medium text-foreground mb-1.5">
                        성별
                      </label>
                      <select
                        value={formData.gender || ''}
                        disabled={!canEdit}
                        onChange={(e) => setFormData({ ...formData, gender: e.target.value as any })}
                        className="w-full p-2.5 text-xs font-mono rounded-lg border border-border bg-card text-foreground focus:ring-1 focus:ring-primary outline-none cursor-pointer"
                      >
                        <option value="">선택 안 함</option>
                        <option value="M">남성 (Male)</option>
                        <option value="F">여성 (Female)</option>
                        <option value="other">기타</option>
                      </select>
                    </div>
                  </div>

                  {/* 주소 입력 */}
                  <div className="space-y-2 pt-1 border-t border-border">
                    <label className="block text-xs font-mono font-medium text-foreground">
                      자택 주소
                    </label>
                    <div className="relative">
                      <input
                        type="text"
                        value={formData.address || ''}
                        disabled={!canEdit}
                        onChange={(e) => setFormData({ ...formData, address: e.target.value })}
                        placeholder="기본 도로명 주소 (예: 서울특별시 서초구 반포대로 123)"
                        className="w-full p-2.5 pl-8 text-xs font-mono rounded-lg border border-border bg-card text-foreground focus:ring-1 focus:ring-primary outline-none"
                      />
                      <MapPin size={13} className="absolute left-2.5 top-3 text-muted-foreground" />
                    </div>
                    <input
                      type="text"
                      value={formData.addressDetail || ''}
                      disabled={!canEdit}
                      onChange={(e) => setFormData({ ...formData, addressDetail: e.target.value })}
                      placeholder="상세 주소 (동, 호수, 건물명 등)"
                      className="w-full p-2.5 text-xs font-mono rounded-lg border border-border bg-card text-foreground focus:ring-1 focus:ring-primary outline-none"
                    />
                  </div>
                </div>
              )}

              {/* TAB 2: 직무 및 재직 정보 */}
              {activeTab === 'job' && (
                <div className="space-y-4 animate-in fade-in duration-150">
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
                    <div>
                      <label className="block text-xs font-mono font-medium text-foreground mb-1.5">
                        직위 / 직책
                      </label>
                      <input
                        type="text"
                        value={formData.jobTitle || ''}
                        disabled={!canEdit}
                        onChange={(e) => setFormData({ ...formData, jobTitle: e.target.value })}
                        placeholder="예: 수석 상담관, 파트장, 대리, 주임"
                        className="w-full p-2.5 text-xs font-mono rounded-lg border border-border bg-card text-foreground focus:ring-1 focus:ring-primary outline-none"
                      />
                    </div>

                    <div>
                      <label className="block text-xs font-mono font-medium text-foreground mb-1.5">
                        고용 형태
                      </label>
                      <select
                        value={formData.employmentType || 'regular'}
                        disabled={!canEdit}
                        onChange={(e) => setFormData({ ...formData, employmentType: e.target.value as any })}
                        className="w-full p-2.5 text-xs font-mono rounded-lg border border-border bg-card text-foreground focus:ring-1 focus:ring-primary outline-none cursor-pointer"
                      >
                        <option value="regular">정규직 (4대보험 가입)</option>
                        <option value="freelancer">위임직 / 프리랜서 (3.3% 원천징수)</option>
                        <option value="contract">계약직 (기간제)</option>
                        <option value="intern">수습 / 인턴</option>
                      </select>
                    </div>

                    <div>
                      <label className="block text-xs font-mono font-medium text-foreground mb-1.5">
                        입사일 (출근 시작일)
                      </label>
                      <div className="relative">
                        <input
                          type="date"
                          value={formData.hireDate || ''}
                          disabled={!canEdit}
                          onChange={(e) => setFormData({ ...formData, hireDate: e.target.value })}
                          className="w-full p-2.5 pl-8 text-xs font-mono rounded-lg border border-border bg-card text-foreground focus:ring-1 focus:ring-primary outline-none"
                        />
                        <Calendar size={13} className="absolute left-2.5 top-3 text-muted-foreground" />
                      </div>
                    </div>

                    <div>
                      <label className="block text-xs font-mono font-medium text-foreground mb-1.5">
                        현재 근속 현황
                      </label>
                      <div className="p-2.5 rounded-lg bg-muted/40 border border-border flex items-center justify-between">
                        <span className="text-xs font-mono font-medium text-primary">
                          {tenure.text}
                        </span>
                        <Clock size={13} className="text-muted-foreground" />
                      </div>
                    </div>
                  </div>

                  {/* 시스템 등록 메타데이터 카드 */}
                  <div className="p-3.5 rounded-xl bg-muted/30 border border-border space-y-2 text-xs font-mono">
                    <div className="text-muted-foreground font-semibold flex items-center gap-1.5">
                      <Shield size={13} className="text-primary" /> 시스템 등록 정보
                    </div>
                    <div className="grid grid-cols-2 gap-2 text-2xs text-muted-foreground">
                      <div>
                        <span>계정 가입일: </span>
                        <strong className="text-foreground">{member.joinedAt?.split('T')[0] || '-'}</strong>
                      </div>
                      <div>
                        <span>최근 접속: </span>
                        <strong className="text-foreground">{member.lastSignInAt ? member.lastSignInAt.split('T')[0] : '-'}</strong>
                      </div>
                      <div>
                        <span>소속 팀: </span>
                        <strong className="text-foreground">{member.teamName || '1팀'}</strong>
                      </div>
                      <div>
                        <span>보안 등급: </span>
                        <strong className="text-foreground">{roleInfo.badgeText}</strong>
                      </div>
                    </div>
                  </div>
                </div>
              )}

              {/* TAB 3: 급여 및 정산 계좌 */}
              {activeTab === 'payroll' && (
                <div className="space-y-4 animate-in fade-in duration-150">
                  <div className="p-3 rounded-lg bg-primary/10 border border-primary/20 text-xs font-mono text-primary flex items-center gap-2">
                    <Sparkles size={14} className="shrink-0" />
                    <span>입력하신 급여 계좌는 [정산·손익 센터] 및 [급여명세서]에 자동 연동됩니다.</span>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-3.5">
                    <div>
                      <label className="block text-xs font-mono font-medium text-foreground mb-1.5">
                        은행명
                      </label>
                      <select
                        value={formData.bankName || ''}
                        disabled={!canEdit}
                        onChange={(e) => setFormData({ ...formData, bankName: e.target.value })}
                        className="w-full p-2.5 text-xs font-mono rounded-lg border border-border bg-card text-foreground focus:ring-1 focus:ring-primary outline-none cursor-pointer"
                      >
                        <option value="">은행 선택</option>
                        {MAJOR_BANKS.map((b) => (
                          <option key={b} value={b}>
                            {b}
                          </option>
                        ))}
                      </select>
                    </div>

                    <div className="sm:col-span-2">
                      <label className="block text-xs font-mono font-medium text-foreground mb-1.5">
                        계좌번호 (숫자만 입력 또는 하이픈 포함)
                      </label>
                      <div className="relative">
                        <input
                          type="text"
                          value={formData.accountNumber || ''}
                          disabled={!canEdit}
                          onChange={(e) => setFormData({ ...formData, accountNumber: e.target.value })}
                          placeholder="예: 110-123-456789"
                          className="w-full p-2.5 pl-8 text-xs font-mono rounded-lg border border-border bg-card text-foreground focus:ring-1 focus:ring-primary outline-none tabular-nums"
                        />
                        <CreditCard size={13} className="absolute left-2.5 top-3 text-muted-foreground" />
                      </div>
                    </div>

                    <div>
                      <label className="block text-xs font-mono font-medium text-foreground mb-1.5">
                        예금주명
                      </label>
                      <input
                        type="text"
                        value={formData.accountHolder || ''}
                        disabled={!canEdit}
                        onChange={(e) => setFormData({ ...formData, accountHolder: e.target.value })}
                        placeholder="예: 홍길동"
                        className="w-full p-2.5 text-xs font-mono rounded-lg border border-border bg-card text-foreground focus:ring-1 focus:ring-primary outline-none"
                      />
                    </div>
                  </div>
                </div>
              )}

              {/* TAB 4: 비상연락망 & 특이사항 메모 */}
              {activeTab === 'emergency' && (
                <div className="space-y-4 animate-in fade-in duration-150">
                  <div className="space-y-3">
                    <label className="block text-xs font-mono font-medium text-foreground">
                      비상 연락망 (긴급 상황 시 연락처)
                    </label>
                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                      <div>
                        <input
                          type="text"
                          value={formData.emergencyContactName || ''}
                          disabled={!canEdit}
                          onChange={(e) => setFormData({ ...formData, emergencyContactName: e.target.value })}
                          placeholder="비상 연락인 성명 (예: 김철수)"
                          className="w-full p-2.5 text-xs font-mono rounded-lg border border-border bg-card text-foreground focus:ring-1 focus:ring-primary outline-none"
                        />
                      </div>
                      <div>
                        <select
                          value={formData.emergencyContactRelation || ''}
                          disabled={!canEdit}
                          onChange={(e) => setFormData({ ...formData, emergencyContactRelation: e.target.value })}
                          className="w-full p-2.5 text-xs font-mono rounded-lg border border-border bg-card text-foreground focus:ring-1 focus:ring-primary outline-none cursor-pointer"
                        >
                          <option value="">관계 선택</option>
                          <option value="부모">부모 (부/모)</option>
                          <option value="배우자">배우자</option>
                          <option value="형제/자매">형제 / 자매</option>
                          <option value="자녀">자녀</option>
                          <option value="친척">친척</option>
                          <option value="지인">지인 / 동료</option>
                          <option value="기타">기타</option>
                        </select>
                      </div>
                      <div>
                        <input
                          type="tel"
                          value={formData.emergencyContactPhone || ''}
                          disabled={!canEdit}
                          onChange={(e) => setFormData({ ...formData, emergencyContactPhone: formatPhone(e.target.value) })}
                          placeholder="연락처 (010-0000-0000)"
                          className="w-full p-2.5 text-xs font-mono rounded-lg border border-border bg-card text-foreground focus:ring-1 focus:ring-primary outline-none"
                        />
                      </div>
                    </div>
                  </div>

                  {/* 인사 특이사항 메모 */}
                  <div className="space-y-2 pt-2 border-t border-border">
                    <label className="block text-xs font-mono font-medium text-foreground flex items-center justify-between">
                      <span>인사 특이사항 및 관리자 메모</span>
                      <span className="text-2xs text-muted-foreground font-mono">관리자만 열람 가능</span>
                    </label>
                    <textarea
                      rows={4}
                      value={formData.notes || ''}
                      disabled={!canEdit}
                      onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
                      placeholder="특이사항, 면담 내역, 건강 상태, 포상 및 징계, 기타 인사업무 메모를 자유롭게 입력하세요."
                      className="w-full p-3 text-xs font-mono rounded-lg border border-border bg-card text-foreground focus:ring-1 focus:ring-primary outline-none leading-relaxed"
                    />
                  </div>
                </div>
              )}
            </>
          )}

          {/* Footer Actions */}
          <div className="pt-4 border-t border-border flex items-center justify-between">
            <div className="text-2xs font-mono text-muted-foreground">
              {formData.updatedAt ? `마지막 수정: ${formData.updatedAt.split('T')[0]}` : ''}
            </div>
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={onClose}
                disabled={saving}
                className="px-3.5 py-1.5 text-xs font-mono font-medium rounded-md bg-card border border-border text-muted-foreground hover:text-foreground hover:bg-muted transition-colors cursor-pointer"
              >
                닫기
              </button>

              {canEdit && (
                <button
                  type="submit"
                  disabled={saving || loading}
                  className="inline-flex items-center gap-1.5 px-4 py-1.5 text-xs font-mono font-medium rounded-md bg-primary hover:bg-primary/90 text-primary-foreground shadow-2xs disabled:opacity-50 transition-colors cursor-pointer"
                >
                  {saving ? (
                    <span>저장 중...</span>
                  ) : (
                    <>
                      <Save size={13} strokeWidth={2.5} />
                      <span>인사 정보 저장</span>
                    </>
                  )}
                </button>
              )}
            </div>
          </div>
        </form>
      </div>
    </div>
  );
};

export default MemberHrModal;
