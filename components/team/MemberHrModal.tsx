import React, { useState, useEffect } from 'react';
import {
  X, User, Phone, MapPin, Calendar, CreditCard,
  AlertTriangle, Shield, Check, HeartHandshake, Briefcase,
  FileText, Clock, Building, Save, Sparkles, UserCheck, DollarSign, ExternalLink
} from 'lucide-react';
import { TeamMember } from '../../services/team';
import {
  MemberHrProfile, fetchMemberHrProfile, saveMemberHrProfile,
  calculateTenure, MAJOR_BANKS
} from '../../services/memberHr';
import { saveAgentPayrollProfile, AgentPayrollProfile } from '../../services/hr';
import { AgentPayrollModal } from '../hr/AgentPayrollModal';
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
  const [isPayrollModalOpen, setIsPayrollModalOpen] = useState(false);

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
    salaryType: 'pure_incentive',
    baseSalary: 0,
    unitIncentive: 150000,
    incentiveRate: 0,
    dailyAllowance: 0,
    bonusAllowance: 0,
    taxType: 'freelancer_3_3'
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
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-5 bg-background/80 backdrop-blur-xs animate-in fade-in duration-200 overflow-y-auto">
      <div className="relative w-full max-w-2xl max-h-[88vh] my-auto bg-card text-foreground rounded-2xl shadow-2xl border border-border flex flex-col overflow-hidden">
        {/* Header */}
        <div className="p-4 sm:p-5 border-b border-border bg-card flex items-start justify-between gap-4 shrink-0">
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
            title="창 닫기"
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
            <DollarSign size={13} /> 급여 & 인센티브
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
                        className="w-full p-2.5 text-xs font-mono rounded-lg border border-input bg-background text-foreground placeholder:text-muted-foreground focus:ring-1 focus:ring-primary shadow-2xs outline-none"
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
                          className="w-full p-2.5 pl-8 text-xs font-mono rounded-lg border border-input bg-background text-foreground placeholder:text-muted-foreground focus:ring-1 focus:ring-primary shadow-2xs outline-none"
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
                        className="w-full p-2.5 text-xs font-mono rounded-lg border border-input bg-background text-foreground focus:ring-1 focus:ring-primary shadow-2xs outline-none"
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
                        className="w-full p-2.5 text-xs font-mono rounded-lg border border-input bg-background text-foreground focus:ring-1 focus:ring-primary shadow-2xs outline-none cursor-pointer"
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
                        className="w-full p-2.5 pl-8 text-xs font-mono rounded-lg border border-input bg-background text-foreground placeholder:text-muted-foreground focus:ring-1 focus:ring-primary shadow-2xs outline-none"
                      />
                      <MapPin size={13} className="absolute left-2.5 top-3 text-muted-foreground" />
                    </div>
                    <input
                      type="text"
                      value={formData.addressDetail || ''}
                      disabled={!canEdit}
                      onChange={(e) => setFormData({ ...formData, addressDetail: e.target.value })}
                      placeholder="상세 주소 (동, 호수, 건물명 등)"
                      className="w-full p-2.5 text-xs font-mono rounded-lg border border-input bg-background text-foreground placeholder:text-muted-foreground focus:ring-1 focus:ring-primary shadow-2xs outline-none"
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
                        className="w-full p-2.5 text-xs font-mono rounded-lg border border-input bg-background text-foreground placeholder:text-muted-foreground focus:ring-1 focus:ring-primary shadow-2xs outline-none"
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
                        className="w-full p-2.5 text-xs font-mono rounded-lg border border-input bg-background text-foreground focus:ring-1 focus:ring-primary shadow-2xs outline-none cursor-pointer"
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
                          className="w-full p-2.5 pl-8 text-xs font-mono rounded-lg border border-input bg-background text-foreground focus:ring-1 focus:ring-primary shadow-2xs outline-none"
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

              {/* TAB 3: 급여 및 성과급 인센티브 연동 */}
              {activeTab === 'payroll' && (
                <div className="space-y-5 animate-in fade-in duration-150 text-xs">
                  {/* 상단 안내 배너 */}
                  <div className="p-3.5 rounded-xl bg-primary/10 border border-primary/20 text-xs font-mono text-primary flex items-center justify-between gap-2 shadow-2xs">
                    <div className="flex items-center gap-2">
                      <Sparkles size={15} className="shrink-0" />
                      <span>입력하신 급여 계좌 및 인센티브 요율은 [정산·손익 센터] 및 [급여명세서]에 실시간 자동 연동됩니다.</span>
                    </div>
                    {canEdit && (
                      <button
                        type="button"
                        onClick={() => setIsPayrollModalOpen(true)}
                        className="px-2.5 py-1 text-2xs font-bold rounded-lg bg-primary hover:bg-primary/90 text-primary-foreground flex items-center gap-1 shrink-0 transition-colors shadow-xs cursor-pointer"
                      >
                        <ExternalLink size={12} />
                        <span>상세 구간 모달 열기</span>
                      </button>
                    )}
                  </div>

                  {/* 1. 급여 입금 계좌 정보 */}
                  <div className="p-4 rounded-xl border border-border bg-muted/30 space-y-3">
                    <div className="flex items-center gap-2 font-bold text-foreground">
                      <CreditCard size={15} className="text-primary" />
                      <span>급여 입금 계좌 정보</span>
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                      <div>
                        <label className="block text-2xs font-mono font-medium text-muted-foreground mb-1">
                          은행명
                        </label>
                        <select
                          value={formData.bankName || ''}
                          disabled={!canEdit}
                          onChange={(e) => setFormData({ ...formData, bankName: e.target.value })}
                          className="w-full p-2.5 text-xs font-mono rounded-lg border border-input bg-background text-foreground focus:ring-1 focus:ring-primary outline-none cursor-pointer"
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
                        <label className="block text-2xs font-mono font-medium text-muted-foreground mb-1">
                          계좌번호 (숫자만 입력 또는 하이픈 포함)
                        </label>
                        <div className="relative">
                          <input
                            type="text"
                            value={formData.accountNumber || ''}
                            disabled={!canEdit}
                            onChange={(e) => setFormData({ ...formData, accountNumber: e.target.value })}
                            placeholder="예: 110-123-456789"
                            className="w-full p-2.5 pl-8 text-xs font-mono rounded-lg border border-input bg-background text-foreground focus:ring-1 focus:ring-primary outline-none tabular-nums"
                          />
                          <CreditCard size={13} className="absolute left-2.5 top-3 text-muted-foreground" />
                        </div>
                      </div>

                      <div>
                        <label className="block text-2xs font-mono font-medium text-muted-foreground mb-1">
                          예금주명
                        </label>
                        <input
                          type="text"
                          value={formData.accountHolder || ''}
                          disabled={!canEdit}
                          onChange={(e) => setFormData({ ...formData, accountHolder: e.target.value })}
                          placeholder="예: 홍길동"
                          className="w-full p-2.5 text-xs font-mono rounded-lg border border-input bg-background text-foreground focus:ring-1 focus:ring-primary outline-none"
                        />
                      </div>
                    </div>
                  </div>

                  {/* 2. 성과급 & 급여 지급 방식 선택 */}
                  <div className="p-4 rounded-xl border border-border bg-muted/30 space-y-3">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2 font-bold text-foreground">
                        <DollarSign size={15} className="text-primary" />
                        <span>성과급 및 급여 체계 연동 설정</span>
                      </div>
                      <span className="text-2xs font-mono text-primary font-semibold">
                        {formData.salaryType === 'pure_incentive' ? '100% 인센티브제' : formData.salaryType === 'base_plus_incentive' ? '기본급 보장형' : '구간별 누진제'}
                      </span>
                    </div>

                    {/* 급여 모델 선택 카드 3종 */}
                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
                      {[
                        { type: 'pure_incentive', label: '순수 건당 성과급', desc: '100% 인센티브제 (프리랜서)' },
                        { type: 'base_plus_incentive', label: '기본급 + 인센티브', desc: '하이브리드형 (기본급 보장)' },
                        { type: 'tiered', label: '구간별 계단식', desc: '건수 증가 시 요율 상승' }
                      ].map(opt => (
                        <button
                          key={opt.type}
                          type="button"
                          disabled={!canEdit}
                          onClick={() => setFormData({ ...formData, salaryType: opt.type as any })}
                          className={`p-2.5 rounded-xl border text-left transition-all cursor-pointer ${
                            formData.salaryType === opt.type
                              ? 'bg-primary/15 text-primary border-primary font-bold shadow-2xs'
                              : 'bg-background text-foreground border-input hover:bg-muted/60'
                          }`}
                        >
                          <div className="font-bold text-xs">{opt.label}</div>
                          <div className={`text-[11px] mt-0.5 ${formData.salaryType === opt.type ? 'text-primary/90' : 'text-muted-foreground'}`}>
                            {opt.desc}
                          </div>
                        </button>
                      ))}
                    </div>

                    {/* 기본급 (기본급+인센일 때만) */}
                    {formData.salaryType === 'base_plus_incentive' && (
                      <div className="p-3 bg-background rounded-lg border border-input flex items-center justify-between">
                        <div>
                          <span className="text-xs font-bold text-foreground block">월 기본급</span>
                          <span className="text-2xs text-muted-foreground">수임 계약과 무관하게 지급되는 고정 급여입니다.</span>
                        </div>
                        <div className="flex items-center gap-1.5">
                          <input
                            type="number"
                            min="0"
                            step="50000"
                            disabled={!canEdit}
                            value={formData.baseSalary || 0}
                            onChange={(e) => setFormData({ ...formData, baseSalary: Number(e.target.value) })}
                            className="w-28 p-1.5 text-right text-xs font-mono font-bold border border-input rounded-lg outline-none bg-background text-foreground focus:ring-1 focus:ring-primary tabular-nums"
                          />
                          <span className="text-xs text-muted-foreground">원</span>
                        </div>
                      </div>
                    )}

                    {/* 건당 인센티브 및 수임료 비율 */}
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-1">
                      <div className="p-3 rounded-lg bg-background border border-input">
                        <label className="block text-2xs font-mono font-medium text-muted-foreground mb-1">
                          수임 성공 1건당 고정 인센티브
                        </label>
                        <div className="flex items-center gap-1.5">
                          <input
                            type="number"
                            min="0"
                            step="10000"
                            disabled={!canEdit}
                            value={formData.unitIncentive ?? 150000}
                            onChange={(e) => setFormData({ ...formData, unitIncentive: Number(e.target.value) })}
                            className="w-full p-2 text-right text-xs font-mono font-bold border border-input rounded-lg outline-none bg-background text-primary focus:ring-1 focus:ring-primary tabular-nums"
                          />
                          <span className="text-xs text-muted-foreground font-medium">원</span>
                        </div>
                      </div>

                      <div className="p-3 rounded-lg bg-background border border-input">
                        <label className="block text-2xs font-mono font-medium text-muted-foreground mb-1">
                          또는 수임료 비율(%) 지급 (0% 시 고정 금액 적용)
                        </label>
                        <div className="flex items-center gap-1.5">
                          <input
                            type="number"
                            min="0"
                            max="50"
                            disabled={!canEdit}
                            value={formData.incentiveRate || 0}
                            onChange={(e) => setFormData({ ...formData, incentiveRate: Number(e.target.value) })}
                            className="w-full p-2 text-right text-xs font-mono font-bold border border-input rounded-lg outline-none bg-background text-foreground focus:ring-1 focus:ring-primary tabular-nums"
                          />
                          <span className="text-xs text-muted-foreground font-medium">%</span>
                        </div>
                      </div>
                    </div>

                    {/* 출근 일비 / 만근 보너스 */}
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                      <div>
                        <label className="block text-2xs font-mono font-medium text-muted-foreground mb-1">
                          출근 1일당 일비/식대 (선택)
                        </label>
                        <div className="flex items-center gap-1.5">
                          <input
                            type="number"
                            min="0"
                            step="5000"
                            disabled={!canEdit}
                            value={formData.dailyAllowance || 0}
                            onChange={(e) => setFormData({ ...formData, dailyAllowance: Number(e.target.value) })}
                            placeholder="0"
                            className="w-full p-2 text-right text-xs font-mono font-bold border border-input rounded-lg outline-none bg-background text-foreground focus:ring-1 focus:ring-primary tabular-nums"
                          />
                          <span className="text-2xs text-muted-foreground">원/일</span>
                        </div>
                      </div>

                      <div>
                        <label className="block text-2xs font-mono font-medium text-muted-foreground mb-1">
                          만근 보너스 / 고정 수당 (선택)
                        </label>
                        <div className="flex items-center gap-1.5">
                          <input
                            type="number"
                            min="0"
                            step="50000"
                            disabled={!canEdit}
                            value={formData.bonusAllowance || 0}
                            onChange={(e) => setFormData({ ...formData, bonusAllowance: Number(e.target.value) })}
                            placeholder="0"
                            className="w-full p-2 text-right text-xs font-mono font-bold border border-input rounded-lg outline-none bg-background text-foreground focus:ring-1 focus:ring-primary tabular-nums"
                          />
                          <span className="text-2xs text-muted-foreground">원/월</span>
                        </div>
                      </div>
                    </div>

                    {/* 세금 공제 방식 3종 */}
                    <div className="pt-2 border-t border-border">
                      <label className="block text-2xs font-mono font-medium text-muted-foreground mb-1.5">
                        세금 공제 방식
                      </label>
                      <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
                        {[
                          { type: 'freelancer_3_3', label: '프리랜서 3.3%', desc: '사업소득세 3% + 지방소득세 0.3%' },
                          { type: 'four_insurances', label: '4대보험 공제', desc: '정규직 간이 산출 (약 9.3%)' },
                          { type: 'none', label: '세금 공제 없음', desc: '세전 총액 그대로 지급' }
                        ].map(opt => (
                          <button
                            key={opt.type}
                            type="button"
                            disabled={!canEdit}
                            onClick={() => setFormData({ ...formData, taxType: opt.type as any })}
                            className={`p-2.5 rounded-xl border text-left transition-all cursor-pointer ${
                              formData.taxType === opt.type
                                ? 'bg-primary/15 text-primary border-primary font-bold shadow-2xs'
                                : 'bg-background text-foreground border-input hover:bg-muted/60'
                            }`}
                          >
                            <div className="font-bold text-xs">{opt.label}</div>
                            <div className={`text-[11px] mt-0.5 ${formData.taxType === opt.type ? 'text-primary/90' : 'text-muted-foreground'}`}>
                              {opt.desc}
                            </div>
                          </button>
                        ))}
                      </div>
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
                          className="w-full p-2.5 text-xs font-mono rounded-lg border border-input bg-background text-foreground placeholder:text-muted-foreground focus:ring-1 focus:ring-primary shadow-2xs outline-none"
                        />
                      </div>
                      <div>
                        <select
                          value={formData.emergencyContactRelation || ''}
                          disabled={!canEdit}
                          onChange={(e) => setFormData({ ...formData, emergencyContactRelation: e.target.value })}
                          className="w-full p-2.5 text-xs font-mono rounded-lg border border-input bg-background text-foreground focus:ring-1 focus:ring-primary shadow-2xs outline-none cursor-pointer"
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
                          className="w-full p-2.5 text-xs font-mono rounded-lg border border-input bg-background text-foreground placeholder:text-muted-foreground focus:ring-1 focus:ring-primary shadow-2xs outline-none"
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
                      className="w-full p-3 text-xs font-mono rounded-lg border border-input bg-background text-foreground placeholder:text-muted-foreground focus:ring-1 focus:ring-primary shadow-2xs outline-none leading-relaxed"
                    />
                  </div>
                </div>
              )}
            </>
          )}

          {/* Footer Actions */}
          <div className="pt-4 border-t border-border flex items-center justify-between shrink-0">
            <div className="text-2xs font-mono text-muted-foreground">
              {formData.updatedAt ? `마지막 수정: ${formData.updatedAt.split('T')[0]}` : ''}
            </div>
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={onClose}
                disabled={saving}
                className="px-4 py-2.5 rounded-xl border border-border bg-secondary hover:bg-muted text-foreground text-xs font-bold transition-colors cursor-pointer shadow-2xs"
              >
                취소 / 닫기
              </button>

              {canEdit && (
                <button
                  type="submit"
                  disabled={saving || loading}
                  className="inline-flex items-center gap-1.5 px-5 py-2.5 text-xs font-bold rounded-xl bg-primary hover:bg-primary/90 text-primary-foreground shadow-2xs disabled:opacity-50 transition-colors cursor-pointer"
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

      {/* 급여 / 인센티브 상세 구간 설정 모달 연동 */}
      {isPayrollModalOpen && member && (
        <AgentPayrollModal
          isOpen={isPayrollModalOpen}
          onClose={() => setIsPayrollModalOpen(false)}
          agentName={member.displayName}
          profile={{
            userId: member.userId,
            salaryType: formData.salaryType || 'pure_incentive',
            baseSalary: formData.baseSalary || 0,
            unitIncentive: formData.unitIncentive ?? 150000,
            incentiveRate: formData.incentiveRate || 0,
            tierRules: [],
            dailyAllowance: formData.dailyAllowance || 0,
            bonusAllowance: formData.bonusAllowance || 0,
            taxType: formData.taxType || 'freelancer_3_3',
            bankName: formData.bankName,
            accountNumber: formData.accountNumber,
            accountHolder: formData.accountHolder || member.displayName
          }}
          onSave={async (updated: AgentPayrollProfile) => {
            await saveAgentPayrollProfile(updated);
            setFormData(prev => ({
              ...prev,
              salaryType: updated.salaryType,
              baseSalary: updated.baseSalary,
              unitIncentive: updated.unitIncentive,
              incentiveRate: updated.incentiveRate,
              dailyAllowance: updated.dailyAllowance,
              bonusAllowance: updated.bonusAllowance,
              taxType: updated.taxType,
              bankName: updated.bankName,
              accountNumber: updated.accountNumber,
              accountHolder: updated.accountHolder
            }));
            showToast(`${member.displayName} 상담원의 인센티브 설정이 연동되어 업데이트되었습니다.`, 'success');
          }}
        />
      )}
    </div>
  );
};

export default MemberHrModal;
