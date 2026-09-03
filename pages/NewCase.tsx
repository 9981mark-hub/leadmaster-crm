
import React, { useState, useEffect, useRef, TouchEvent } from 'react';
import { createCase, updateCase, fetchCases, fetchInboundPaths, fetchPartners, markCaseAsSeen } from '../services/api';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { formatPhone, CASE_TYPES, MANAGER_NAME } from '../constants';
import { ArrowLeft, ChevronRight, ChevronLeft, Save, Plus, Trash2, Building, User, Briefcase, Home, Wallet, MessageSquare, AlertCircle, CheckCircle2, Tag } from 'lucide-react';
import { JOB_TYPES, HOUSING_TYPES, HOUSING_DETAILS, ASSET_TYPES, ASSET_OWNERS, RENT_CONTRACTORS, HISTORY_TYPES, FREE_HOUSING_OWNERS } from '../constants';
import { normalizeBirthYear, checkIsDuplicate } from '../utils';
import { AssetItem, Partner, CreditLoanItem, Case } from '../types';
import { useToast } from '../contexts/ToastContext';

const Input = ({ label, value, onChange, onBlur, type = "text", placeholder = "", suffix = "", readOnly = false, isPhone = false, isCurrency = false }: any) => {
  let displayValue = value;

  if (type === 'number') {
    if (!isCurrency && (value === 0 || value === undefined || value === null)) {
      displayValue = '';
    }
  }

  if (isCurrency && (typeof value === 'number' || !isNaN(Number(value)))) {
    displayValue = Number(value).toLocaleString();
  }

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    let val = e.target.value;

    if (isPhone) {
      // Remove non-digits and re-format
      const raw = val.replace(/[^0-9]/g, '');
      let formatted = raw;
      if (raw.length > 3 && raw.length <= 7) {
        formatted = `${raw.slice(0, 3)}-${raw.slice(3)}`;
      } else if (raw.length > 7) {
        formatted = `${raw.slice(0, 3)}-${raw.slice(3, 7)}-${raw.slice(7, 11)}`;
      }
      onChange(formatted);
      return;
    }

    if (isCurrency) {
      const cleanVal = val.replace(/,/g, '');
      if (cleanVal === '' || /^[0-9]+$/.test(cleanVal)) {
        onChange(cleanVal === '' ? 0 : Number(cleanVal));
      }
      return;
    }

    if (type === 'number') {
      if (val === '' || /^[0-9]+$/.test(val)) {
        onChange(val === '' ? 0 : Number(val));
      }
    } else {
      onChange(val);
    }
  };

  return (
    <div className="mb-4">
      <label className="block text-sm font-bold text-gray-700 dark:text-gray-300 mb-1">{label}</label>
      <div className="relative">
        <input
          type={type === 'number' && !isCurrency ? 'text' : 'text'}
          autoComplete="off"
          className={`w-full px-3 py-2 bg-white dark:bg-gray-800/50 border border-gray-300 rounded focus:bg-white dark:focus:bg-gray-800 focus:ring-1 focus:ring-blue-500 focus:border-blue-500 focus:outline-none transition-all placeholder-gray-400 dark:placeholder-gray-500 text-sm shadow-none ${readOnly ? 'bg-gray-50 text-gray-400 cursor-not-allowed dark:bg-gray-900/50' : 'text-gray-900 dark:text-gray-100'}`}
          value={displayValue || ''}
          onChange={!readOnly ? handleInputChange : undefined}
          onBlur={onBlur}
          placeholder={placeholder}
          readOnly={readOnly}
        />
        {suffix && <span className="absolute right-3 top-2.5 text-gray-500 dark:text-gray-400 text-sm font-medium">{suffix}</span>}
      </div>
    </div>
  );
};

const Select = ({ label, value, onChange, options, isMulti = false }: any) => (
  <div className="mb-4">
    <label className="block text-sm font-bold text-gray-700 dark:text-gray-300 mb-1">{label}</label>
    <div className="flex gap-1.5 flex-wrap">
      {options.map((opt: string) => {
        const isSelected = isMulti ? value?.includes(opt) : value === opt;
        return (
          <button
            key={opt}
            type="button"
            onClick={() => onChange(opt)}
            className={`flex-1 whitespace-nowrap transition-all duration-200 border px-1.5 py-1.5 text-[13px] tracking-tight rounded font-semibold ${
              isSelected 
                ? 'bg-blue-600 text-white shadow-none border-blue-600 hover:bg-blue-700' 
                : 'bg-white border-gray-300 text-gray-600 hover:bg-gray-50 dark:bg-gray-800 dark:text-gray-300 dark:border-gray-600 dark:hover:bg-gray-700'
            }`}
          >
            {opt}
          </button>
        );
      })}
    </div>
  </div>
);

// PC 콕핏 전용 컴팩트 폼 컴포넌트
const CompactInput = ({ label, value, onChange, onBlur, type = "text", placeholder = "", suffix = "", readOnly = false, isPhone = false, isCurrency = false, required = false }: any) => {
  let displayValue = value;

  if (type === 'number') {
    if (!isCurrency && (value === 0 || value === undefined || value === null)) {
      displayValue = '';
    }
  }

  if (isCurrency && (typeof value === 'number' || !isNaN(Number(value)))) {
    displayValue = Number(value).toLocaleString();
  }

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    let val = e.target.value;

    if (isPhone) {
      const raw = val.replace(/[^0-9]/g, '');
      let formatted = raw;
      if (raw.length > 3 && raw.length <= 7) {
        formatted = `${raw.slice(0, 3)}-${raw.slice(3)}`;
      } else if (raw.length > 7) {
        formatted = `${raw.slice(0, 3)}-${raw.slice(3, 7)}-${raw.slice(7, 11)}`;
      }
      onChange(formatted);
      return;
    }

    if (isCurrency) {
      const cleanVal = val.replace(/,/g, '');
      if (cleanVal === '' || /^[0-9]+$/.test(cleanVal)) {
        onChange(cleanVal === '' ? 0 : Number(cleanVal));
      }
      return;
    }

    if (type === 'number') {
      if (val === '' || /^[0-9]+$/.test(val)) {
        onChange(val === '' ? 0 : Number(val));
      }
    } else {
      onChange(val);
    }
  };

  return (
    <div className="mb-3">
      {label && (
        <label className="block text-xs font-bold text-gray-800 dark:text-gray-200 mb-1.5">
          {label} {required && <span className="text-red-500 font-bold">*</span>}
        </label>
      )}
      <div className="relative">
        <input
          type="text"
          autoComplete="off"
          className={`w-full px-3 py-2 bg-white dark:bg-gray-800 border border-gray-300 dark:border-gray-600 rounded-lg focus:bg-white dark:focus:bg-gray-800 focus:ring-2 focus:ring-blue-500 focus:border-blue-500 focus:outline-none transition-all placeholder-gray-400 dark:placeholder-gray-500 text-sm font-medium shadow-none ${readOnly ? 'bg-gray-50 text-gray-400 cursor-not-allowed dark:bg-gray-900/50' : 'text-gray-900 dark:text-gray-100'}`}
          value={displayValue || ''}
          onChange={!readOnly ? handleInputChange : undefined}
          onBlur={onBlur}
          placeholder={placeholder}
          readOnly={readOnly}
        />
        {suffix && <span className="absolute right-3 top-2.5 text-gray-400 dark:text-gray-400 text-xs font-bold">{suffix}</span>}
      </div>
    </div>
  );
};

const CompactSelect = ({ label, value, onChange, options, isMulti = false, required = false }: any) => (
  <div className="mb-3">
    {label && (
      <label className="block text-xs font-bold text-gray-800 dark:text-gray-200 mb-1.5">
        {label} {required && <span className="text-red-500 font-bold">*</span>}
      </label>
    )}
    <div className="flex gap-1.5 flex-wrap">
      {options.map((opt: string) => {
        const isSelected = isMulti ? value?.includes(opt) : value === opt;
        return (
          <button
            key={opt}
            type="button"
            onClick={() => onChange(opt)}
            className={`flex-1 whitespace-nowrap transition-all duration-150 border px-2 py-1.5 text-xs tracking-tight rounded-lg font-semibold ${
              isSelected 
                ? 'bg-blue-600 text-white border-blue-600 shadow-xs' 
                : 'bg-white border-gray-300 text-gray-700 hover:bg-gray-50 dark:bg-gray-800 dark:text-gray-300 dark:border-gray-600 dark:hover:bg-gray-700'
            }`}
          >
            {opt}
          </button>
        );
      })}
    </div>
  </div>
);

export default function NewCase() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const leadId = searchParams.get('leadId');
  const { showToast } = useToast();
  const [inboundPaths, setInboundPaths] = useState<string[]>([]);
  const [partners, setPartners] = useState<Partner[]>([]);

  const [formData, setFormData] = useState<any>({
    partnerId: '',
    caseType: '개인회생', inboundPath: '',
    customerName: '', phone: '010', birth: '', gender: '남', region: '',
    jobTypes: ['직장인'], insurance4: '미가입', maritalStatus: '미혼', childrenCount: 0,
    incomeDetails: {}, incomeNet: 0, loanMonthlyPay: 0,
    housingType: '월세', housingDetail: '빌라', deposit: 0, rent: 0,
    depositLoanAmount: 0, rentContractor: '본인',
    ownHousePrice: 0, ownHouseLoan: 0, ownHouseOwner: '본인',
    freeHousingOwner: '부모님',
    assets: [],
    creditLoan: [], creditCardUse: '미사용', creditCardAmount: 0,
    collateralLoanMemo: '', historyType: '없음', historyMemo: '', specialMemo: ''
  });

  const [newAsset, setNewAsset] = useState<Partial<AssetItem>>({ owner: '본인', type: '자동차', amount: 0, loanAmount: 0, desc: '' });
  const [newCreditLoan, setNewCreditLoan] = useState<Partial<CreditLoanItem>>({ amount: 0, desc: '' });

  const [allCases, setAllCases] = useState<Case[]>([]);
  const [duplicateCase, setDuplicateCase] = useState<Case | undefined>(undefined);

  useEffect(() => {
    const init = async () => {
      const [paths, partnerData, cases] = await Promise.all([
        fetchInboundPaths(),
        fetchPartners(),
        fetchCases() // Always fetch all for dup check
      ]);

      setAllCases(cases);
      setInboundPaths(paths);
      setPartners(partnerData);

      if (partnerData.length > 0 && !formData.partnerId) {
        setFormData((prev: any) => ({ ...prev, partnerId: partnerData[0].partnerId }));
      }

      // If leadId provided, find and populate
      if (leadId) {
        const lead = cases.find((c: any) => c.caseId === leadId);
        if (lead) {
          // Merge lead data into formData
          setFormData((prev: any) => ({
            ...prev,
            ...lead,
            // Ensure complex objects are handled if needed, defaulting to existing if not present
            jobTypes: lead.jobTypes && lead.jobTypes.length > 0 ? lead.jobTypes : ['직장인'],
          }));
        }
      }
    };
    init();
  }, [leadId]);

  const handleChange = (field: string, value: any) => {
    if (field === 'phone') {
      value = formatPhone(value);
      // Real-time Duplicate Check
      const dup = checkIsDuplicate(value, allCases);
      // Don't flag itself if editing existing
      if (dup && dup.caseId !== leadId) {
        setDuplicateCase(dup);
      } else {
        setDuplicateCase(undefined);
      }
    }
    setFormData((prev: any) => ({ ...prev, [field]: value }));
  };

  const handleIncomeChange = (type: 'salary' | 'business' | 'freelance', value: number) => {
    const newIncomeDetails = { ...formData.incomeDetails, [type]: value };
    const totalIncome = Object.values(newIncomeDetails).reduce((sum, val: any) => sum + (val || 0), 0);
    setFormData((prev: any) => ({
      ...prev,
      incomeDetails: newIncomeDetails,
      incomeNet: totalIncome
    }));
  };

  const handleJobTypeChange = (jobType: string) => {
    const currentTypes = formData.jobTypes || [];
    const newTypes = currentTypes.includes(jobType)
      ? currentTypes.filter((t: string) => t !== jobType)
      : [...currentTypes, jobType];

    // Also clean up incomeDetails if a job type is removed
    const newIncomeDetails = { ...formData.incomeDetails };
    if (jobType === '직장인' && !newTypes.includes('직장인')) delete newIncomeDetails.salary;
    if (['개인사업자', '법인사업자'].includes(jobType) && !newTypes.some((t: string) => ['개인사업자', '법인사업자'].includes(t))) delete newIncomeDetails.business;
    if (jobType === '프리랜서' && !newTypes.includes('프리랜서')) delete newIncomeDetails.freelance;

    const totalIncome = Object.values(newIncomeDetails).reduce((sum: any, val: any) => sum + (val || 0), 0);

    setFormData((prev: any) => ({
      ...prev,
      jobTypes: newTypes,
      incomeDetails: newIncomeDetails,
      incomeNet: totalIncome
    }));
  };

  const handleBirthBlur = () => {
    const normalized = normalizeBirthYear(formData.birth);
    if (normalized !== formData.birth) {
      handleChange('birth', normalized);
    }
  };

  const handleAddAsset = () => {
    if (!newAsset.type) return;
    const asset: AssetItem = {
      id: Date.now().toString(),
      owner: newAsset.owner as any || '본인',
      type: newAsset.type || '기타',
      amount: newAsset.amount || 0,
      loanAmount: newAsset.loanAmount || 0,
      rentDeposit: newAsset.rentDeposit || 0,
      desc: newAsset.desc || ''
    };
    handleChange('assets', [...formData.assets, asset]);
    setNewAsset({ owner: '본인', type: '자동차', amount: 0, loanAmount: 0, rentDeposit: 0, desc: '' });
  };

  const handleAddCreditLoan = () => {
    if (!newCreditLoan.amount || !newCreditLoan.desc) {
      showToast('대출금액과 내용을 모두 입력해주세요.', 'error');
      return;
    }
    const loan: CreditLoanItem = {
      id: Date.now().toString(),
      amount: newCreditLoan.amount || 0,
      desc: newCreditLoan.desc || ''
    };
    handleChange('creditLoan', [...(formData.creditLoan || []), loan]);
    setNewCreditLoan({ amount: 0, desc: '' });
  };

  const handleRemoveAsset = (id: string) => {
    handleChange('assets', formData.assets.filter((a: AssetItem) => a.id !== id));
  };

  const handleRemoveCreditLoan = (id: string) => {
    handleChange('creditLoan', formData.creditLoan.filter((l: CreditLoanItem) => l.id !== id));
  };

  // Quick tag addition for Consultation Memo
  const handleAddMemoTag = (tagText: string) => {
    const current = formData.specialMemo ? formData.specialMemo.trim() : '';
    const updated = current ? `${current}\n- ${tagText}` : `- ${tagText}`;
    handleChange('specialMemo', updated);
  };



  const handleSubmit = async () => {
    try {
      const payload = { ...formData };

      // [Fix] Default name if empty to prevent nameless cases
      if (!payload.customerName || payload.customerName.trim() === '') {
        payload.customerName = '이름없음';
      }

      // Handle specialMemo array structure
      if (payload.specialMemo && typeof payload.specialMemo === 'string' && payload.specialMemo.trim()) {
        payload.specialMemo = [{
          id: Date.now().toString(),
          createdAt: new Date().toISOString(),
          content: payload.specialMemo.trim(),
        }];
      } else if (!Array.isArray(payload.specialMemo)) {
        payload.specialMemo = [];
      }

      let savedCase;
      if (leadId) {
        // Update existing lead
        // [Logic Change] Status change is what removes the "NEW" badge now.
        // We assume "saving" a new lead means consultation has started.
        savedCase = await updateCase(leadId, {
          ...payload,
          isNew: false, // Explicitly remove new badge
          status: payload.status === '신규접수' ? '상담진행' : payload.status
        });
        showToast('케이스가 정식 등록되었습니다.');
      } else {
        // Create new
        const newCasePayload = {
          ...payload,
          managerName: MANAGER_NAME, // Explicitly set manager to mark as handled
          isNew: false, // Local flag
          isViewed: true // [Fix] Explicitly mark as viewed so it doesn't trigger "New Case" notification
        };
        savedCase = await createCase(newCasePayload);
        showToast('신규 케이스가 등록되었습니다.');
      }

      // [Fix] Mark as seen immediately so it doesn't appear as NEW when re-fetched
      if (savedCase?.caseId) {
        markCaseAsSeen(savedCase.caseId);
      }

      navigate(`/case/${savedCase.caseId}`);
    } catch (e) {
      console.error(e);
      showToast('저장 중 오류가 발생했습니다.', 'error');
    }
  };


  const getAutoCollateralString = () => {
    const parts = [];
    if (formData.depositLoanAmount > 0) parts.push(`보증금 대출 ${formData.depositLoanAmount}만원`);
    if (formData.ownHouseLoan > 0) parts.push(`집 담보 대출 ${formData.ownHouseLoan}만원`);
    formData.assets.forEach((a: AssetItem) => {
      if (a.loanAmount > 0) parts.push(`${a.type} 담보 ${a.loanAmount}만원`);
      if (a.rentDeposit && a.rentDeposit > 0) parts.push(`${a.type} 임대보증금(채무) ${a.rentDeposit}만원`);
    });
    return parts.length > 0 ? parts.join(' + ') : '없음';
  };

  // Logic to check if field is visible
  const currentPartner = partners.find(p => p.partnerId === formData.partnerId);
  const isFieldVisible = (fieldKey: string) => {
    if (!currentPartner) return true; // Default to show all
    return currentPartner.requiredFields.includes(fieldKey);
  };

  // ===== Section Render Functions (shared between PC & Mobile) =====

  const renderSectionBasicInfo = () => (
    <div>
      <h3 className="text-lg font-bold mb-6 flex items-center gap-2 text-gray-800 dark:text-gray-100 border-b border-gray-100 dark:border-gray-700 pb-3">
        <User size={20} className="text-indigo-500" /> 기본 정보
      </h3>

      <div className="mb-5">
        <label className="block text-[13px] font-bold text-gray-700 dark:text-gray-300 mb-1.5">거래처 (법률사무소)</label>
        <div className="relative">
          <select
            className="w-full px-3.5 py-3 pl-10 bg-indigo-50/50 dark:bg-indigo-900/20 border border-transparent rounded-xl focus:bg-white dark:focus:bg-gray-800 focus:ring-2 focus:ring-indigo-500/40 focus:border-indigo-400 focus:outline-none transition-all text-indigo-900 dark:text-indigo-300 font-bold text-sm shadow-sm"
            value={formData.partnerId}
            onChange={e => handleChange('partnerId', e.target.value)}
          >
            {partners.map(p => <option key={p.partnerId} value={p.partnerId}>{p.name}</option>)}
          </select>
          <Building className="absolute left-3.5 top-3 text-indigo-500" size={18} />
        </div>
      </div>

      <Select label="사건 유형" value={formData.caseType} onChange={(v: any) => handleChange('caseType', v)} options={CASE_TYPES} />

      <div className="mb-5">
        <label className="block text-[13px] font-bold text-gray-700 dark:text-gray-300 mb-1.5">유입 경로</label>
        <select
          className="w-full px-3.5 py-3 bg-gray-50 dark:bg-gray-800/50 border border-transparent rounded-xl focus:bg-white dark:focus:bg-gray-800 focus:ring-2 focus:ring-indigo-500/40 focus:border-indigo-400 focus:outline-none transition-all text-sm shadow-sm text-gray-900 dark:text-gray-100"
          value={formData.inboundPath}
          onChange={e => handleChange('inboundPath', e.target.value)}
        >
          <option value="">선택하세요</option>
          {inboundPaths.map(p => <option key={p} value={p}>{p}</option>)}
        </select>
      </div>

      <div className="my-6 border-t border-gray-100 dark:border-gray-800" />

      {formData.preInfo && (
        <div className="mb-4 animate-fade-in">
          <label className="block text-xs font-medium text-gray-500 mb-1">사전 고객 정보 (리드 수집 정보)</label>
          <div className="w-full p-3 border border-indigo-100 rounded-lg text-sm bg-indigo-50 text-gray-700 whitespace-pre-wrap leading-relaxed shadow-sm">
            {formData.preInfo.split(/\s\/\s|\n/).filter((line: string) => {
              const lower = line.toLowerCase();
              return !lower.includes('[referrer]') && !lower.includes('[marketing_consent]') && !lower.includes('[third_party_consent]') && !lower.includes('[user_agent]') && line.trim() !== '';
            }).map((line: string, idx: number) => (
              <div key={idx} className="flex items-start gap-1">
                <span className="text-indigo-500 font-bold">*</span>
                <span>{line.trim()}</span>
              </div>
            ))}
          </div>
        </div>
      )}

      <div className="grid grid-cols-2 gap-3 md:gap-4">
        <Input label="고객명" value={formData.customerName} onChange={(v: any) => handleChange('customerName', v)} />
        <Input label="연락처" value={formData.phone} onChange={(v: any) => handleChange('phone', v)} placeholder="010-0000-0000" isPhone={true} />
      </div>

      {duplicateCase && (
        <div className="mb-4 -mt-1 animate-pulse">
          <div className="bg-red-50 border border-red-200 rounded-lg p-3 text-sm flex flex-col gap-1">
            <div className="flex items-center gap-2 text-red-700 font-bold">
              <span className="text-lg">⚠️</span> 이미 등록된 연락처입니다!
            </div>
            <div className="text-gray-600 pl-7 text-xs">
              <p>등록된 고객명: <b>{duplicateCase.customerName}</b></p>
              <p>담당자: <b>{duplicateCase.managerName}</b></p>
              <p>현재 상태: <span className="font-medium text-red-600">{duplicateCase.status}</span></p>
            </div>
          </div>
        </div>
      )}

      <div className="grid grid-cols-2 gap-4">
        <Input
          label="출생년도 (2자리)"
          value={formData.birth}
          onChange={(v: any) => handleChange('birth', v)}
          onBlur={handleBirthBlur}
          placeholder="예: 77"
          suffix={formData.birth.length === 4 ? "년생" : ""}
        />
        <Select label="성별" value={formData.gender} onChange={(v: any) => handleChange('gender', v)} options={['남', '여']} />
      </div>
    </div>
  );

  const renderSectionJobFamily = () => (
    <div>
      <h3 className="text-lg font-bold mb-6 flex items-center gap-2 text-gray-800 dark:text-gray-100 border-b border-gray-100 dark:border-gray-700 pb-3">
        <Briefcase size={20} className="text-indigo-500" /> 직업/소득/가족
      </h3>
      <Select label="직업 (복수선택 가능)" value={formData.jobTypes} onChange={handleJobTypeChange} options={JOB_TYPES} isMulti={true} />

      {formData.jobTypes?.includes('직장인') &&
        <Input label="직장인 월수입" value={formData.incomeDetails?.salary} onChange={(v: any) => handleIncomeChange('salary', v)} type="number" suffix="만원" isCurrency={true} />
      }
      {(formData.jobTypes?.includes('개인사업자') || formData.jobTypes?.includes('법인사업자')) &&
        <Input label="사업자 월수입" value={formData.incomeDetails?.business} onChange={(v: any) => handleIncomeChange('business', v)} type="number" suffix="만원" isCurrency={true} />
      }
      {formData.jobTypes?.includes('프리랜서') &&
        <Input label="프리랜서 월수입" value={formData.incomeDetails?.freelance} onChange={(v: any) => handleIncomeChange('freelance', v)} type="number" suffix="만원" isCurrency={true} />
      }

      <Select label="4대보험" value={formData.insurance4} onChange={(v: any) => handleChange('insurance4', v)} options={['가입', '미가입']} />
      <Select label="결혼여부" value={formData.maritalStatus} onChange={(v: any) => handleChange('maritalStatus', v)} options={['미혼', '기혼', '이혼']} />

      {['기혼', '이혼'].includes(formData.maritalStatus) && isFieldVisible('childrenCount') && (
        <div className="mb-5">
          <label className="block text-[13px] font-bold text-gray-700 dark:text-gray-300 mb-1.5">미성년 자녀 수</label>
          <div className="flex gap-2 flex-wrap">
            {[0, 1, 2, 3, 4, 5, 6, 7].map(num => (
              <button key={num} type="button" onClick={() => handleChange('childrenCount', num)}
                className={`w-11 h-11 rounded-full font-medium transition-all text-sm border ${formData.childrenCount === num ? 'bg-indigo-600 text-white shadow-md shadow-indigo-500/20 border-transparent hover:bg-indigo-700' : 'bg-gray-100 text-gray-600 border-transparent hover:bg-gray-200 dark:bg-gray-800 dark:text-gray-300 dark:hover:bg-gray-700'}`}
              >{num}명</button>
            ))}
          </div>
        </div>
      )}
    </div>
  );

  const renderSectionHousing = () => (
    <div>
      <h3 className="text-lg font-bold mb-6 flex items-center gap-2 text-gray-800 dark:text-gray-100 border-b border-gray-100 dark:border-gray-700 pb-3">
        <Home size={20} className="text-indigo-500" /> 주거
      </h3>
      <Select label="거주형태" value={formData.housingType} onChange={(v: any) => handleChange('housingType', v)} options={HOUSING_TYPES} />
      <Select label="주거타입" value={formData.housingDetail} onChange={(v: any) => handleChange('housingDetail', v)} options={HOUSING_DETAILS} />

      {formData.housingType === '자가' ? (
        <>
          <div className="grid grid-cols-1 sm:grid-cols-2 sm:gap-4">
            <Input label="집 시세" value={formData.ownHousePrice} onChange={(v: any) => handleChange('ownHousePrice', v)} type="number" suffix="만원" isCurrency={true} />
            <Input label="집 담보 대출" value={formData.ownHouseLoan} onChange={(v: any) => handleChange('ownHouseLoan', v)} type="number" suffix="만원" isCurrency={true} />
          </div>
          <Select label="집 명의자" value={formData.ownHouseOwner} onChange={(v: any) => handleChange('ownHouseOwner', v)} options={['본인', '배우자', '배우자 공동명의']} />
        </>
      ) : formData.housingType === '무상거주' ? (
        <Select label="집 명의자" value={formData.freeHousingOwner} onChange={(v: any) => handleChange('freeHousingOwner', v)} options={FREE_HOUSING_OWNERS} />
      ) : (
        <>
          <div className="grid grid-cols-1 sm:grid-cols-2 sm:gap-4">
            <Input label="보증금" value={formData.deposit} onChange={(v: any) => handleChange('deposit', v)} type="number" suffix="만원" isCurrency={true} />
            {isFieldVisible('depositLoan') && (
              <Input label="보증금 대출" value={formData.depositLoanAmount} onChange={(v: any) => handleChange('depositLoanAmount', v)} type="number" suffix="만원" isCurrency={true} />
            )}
          </div>
          <Input label="월세" value={formData.rent} onChange={(v: any) => handleChange('rent', v)} type="number" suffix="만원" isCurrency={true} />
          <div className="mb-5">
            <label className="block text-[13px] font-bold text-gray-700 dark:text-gray-300 mb-1.5">임대차 계약인</label>
            <div className="flex gap-2">
              {RENT_CONTRACTORS.map(opt => (
                <button key={opt} type="button" onClick={() => handleChange('rentContractor', opt)}
                  className={`flex-1 py-2.5 text-sm rounded-xl font-medium transition-all duration-200 border ${formData.rentContractor === opt ? 'bg-indigo-600 text-white shadow-md border-transparent hover:bg-indigo-700' : 'bg-gray-100 text-gray-600 border-transparent hover:bg-gray-200 dark:bg-gray-800 dark:text-gray-300 dark:hover:bg-gray-700'}`}
                >{opt}</button>
              ))}
            </div>
          </div>
        </>
      )}
      <Input label="거주지역" value={formData.region} onChange={(v: any) => handleChange('region', v)} placeholder="예: 서울 강남" />
    </div>
  );

  const renderSectionAssets = () => (
    <div>
      <h3 className="text-lg font-bold mb-6 flex items-center gap-2 text-gray-800 dark:text-gray-100 border-b border-gray-100 dark:border-gray-700 pb-3">
        <Wallet size={20} className="text-indigo-500" /> 자산/부채
      </h3>

      {isFieldVisible('assets') && (
        <div className="mb-8 bg-gray-50 dark:bg-gray-800/50 p-5 rounded-2xl border border-gray-100 dark:border-gray-700 shadow-sm relative overflow-hidden">
          {/* Subtle accent border top */}
          <div className="absolute top-0 left-0 w-full h-1 bg-indigo-500/20"></div>
          <h4 className="font-bold text-gray-800 dark:text-gray-100 mb-4 text-[13px] flex items-center gap-1.5"><AlertCircle size={14} className="text-indigo-500" />자산 목록 (본인/배우자 포함)</h4>
          <div className="space-y-3 mb-4">
            {formData.assets.length === 0 && <p className="text-xs text-gray-400 text-center py-2">등록된 자산이 없습니다.</p>}
            {formData.assets.map((asset: AssetItem) => (
              <div key={asset.id} className="bg-white p-3.5 rounded-xl border flex justify-between items-center text-sm shadow-sm">
                <div className="flex flex-col sm:flex-row flex-1 gap-1">
                  <div>
                    <span className="font-bold text-blue-600 mr-2">[{asset.owner}]</span>
                    <span className="font-semibold mr-2">{asset.type}</span>
                  </div>
                  <div className="flex flex-wrap gap-x-2 text-[13px] sm:text-sm mt-1 sm:mt-0">
                    <span className="text-gray-800">시세 {asset.amount > 0 ? `${asset.amount.toLocaleString()}만원` : '0원'}</span>
                    {asset.loanAmount > 0 && <span className="text-red-500">담보 {asset.loanAmount.toLocaleString()}만원</span>}
                    {asset.rentDeposit && asset.rentDeposit > 0 && <span className="text-orange-600">전세금 {asset.rentDeposit.toLocaleString()}만원</span>}
                  </div>
                </div>
                <button type="button" onClick={() => handleRemoveAsset(asset.id)} className="text-red-500 p-2 ml-2 hover:bg-red-50 rounded-lg transition-colors"><Trash2 size={18} /></button>
              </div>
            ))}
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 mb-3">
            <select className="p-3 border border-gray-300 rounded-xl text-sm bg-white focus:ring-2 focus:ring-indigo-500/40 outline-none transition-all dark:bg-gray-800 dark:border-gray-600 dark:text-gray-200" value={newAsset.owner} onChange={e => setNewAsset({ ...newAsset, owner: e.target.value as any })}>
              {ASSET_OWNERS.map(o => <option key={o} value={o}>{o}</option>)}
            </select>
            <select className="p-3 border border-gray-300 rounded-xl text-sm bg-white focus:ring-2 focus:ring-indigo-500/40 outline-none transition-all dark:bg-gray-800 dark:border-gray-600 dark:text-gray-200" value={newAsset.type} onChange={e => setNewAsset({ ...newAsset, type: e.target.value })}>
              {ASSET_TYPES.map(t => <option key={t} value={t}>{t}</option>)}
            </select>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 sm:gap-4">
            <Input label="시세" value={newAsset.amount} onChange={(v: any) => setNewAsset({ ...newAsset, amount: v })} type="number" suffix="만원" isCurrency={true} placeholder="시세" />
            <Input label="담보대출" value={newAsset.loanAmount} onChange={(v: any) => setNewAsset({ ...newAsset, loanAmount: v })} type="number" suffix="만원" isCurrency={true} placeholder="담보대출" />
          </div>
          {['부동산', '토지'].includes(newAsset.type || '') && (
            <div className="mb-2">
              <Input label="전세금액" value={newAsset.rentDeposit} onChange={(v: any) => setNewAsset({ ...newAsset, rentDeposit: v })} type="number" suffix="만원" isCurrency={true} placeholder="전세금액" />
            </div>
          )}
          <div className="flex flex-col sm:flex-row gap-2 mb-2">
            <input type="text" placeholder="상세 내용 (예: 차종 등)" className="w-full sm:flex-1 px-3.5 py-3.5 border border-transparent rounded-xl text-sm shadow-sm focus:border-indigo-400 focus:ring-2 focus:ring-indigo-500/40 outline-none transition-all dark:bg-gray-800 dark:text-gray-100 dark:placeholder-gray-500" value={newAsset.desc || ''} onChange={e => setNewAsset({ ...newAsset, desc: e.target.value })} />
            <button type="button" onClick={handleAddAsset} className="w-full sm:w-28 py-3.5 bg-indigo-600 text-white rounded-xl shadow-md shadow-indigo-500/20 text-sm font-bold flex justify-center items-center hover:bg-indigo-700 transition-all">
              <Plus size={16} className="mr-1" /> 자산 추가
            </button>
          </div>
        </div>
      )}

      <div className="mb-8 bg-gray-50 dark:bg-gray-800/50 p-5 rounded-2xl border border-gray-100 dark:border-gray-700 shadow-sm relative overflow-hidden">
        {/* Subtle accent border top */}
        <div className="absolute top-0 left-0 w-full h-1 bg-rose-500/20"></div>
        <h4 className="font-bold text-gray-800 dark:text-gray-100 mb-4 text-[13px] flex items-center gap-1.5"><AlertCircle size={14} className="text-rose-500" />신용대출 목록</h4>
          <div className="space-y-3 mb-4">
          {(formData.creditLoan || []).length === 0 && <p className="text-xs text-gray-400 text-center py-2">등록된 신용대출이 없습니다.</p>}
          {formData.creditLoan?.map((loan: CreditLoanItem) => (
            <div key={loan.id} className="bg-white p-3.5 rounded-xl border flex justify-between items-center text-sm shadow-sm">
              <div className="flex flex-col sm:flex-row flex-1 gap-1">
                <span className="font-semibold mr-2">{loan.desc}</span>
                <span className="text-gray-800">{loan.amount.toLocaleString()}만원</span>
              </div>
              <button type="button" onClick={() => handleRemoveCreditLoan(loan.id)} className="text-red-500 p-2 ml-2 hover:bg-red-50 rounded-lg transition-colors"><Trash2 size={18} /></button>
            </div>
          ))}
        </div>
        <div className="flex flex-col sm:grid sm:grid-cols-2 gap-2 mb-2 items-end">
          <div className="sm:col-span-2">
            <input type="text" placeholder="대출 내용 (예: 햇살론)" className="w-full px-3.5 py-3.5 border border-transparent rounded-xl text-sm shadow-sm focus:border-indigo-400 focus:ring-2 focus:ring-indigo-500/40 outline-none transition-all dark:bg-gray-800 dark:text-gray-100 dark:placeholder-gray-500" value={newCreditLoan.desc || ''} onChange={e => setNewCreditLoan({ ...newCreditLoan, desc: e.target.value })} />
          </div>
          <div className="w-full">
            <Input label="금액" value={newCreditLoan.amount} onChange={(v: any) => setNewCreditLoan({ ...newCreditLoan, amount: v })} type="number" suffix="만원" isCurrency={true} />
          </div>
          <div className="w-full h-full flex flex-col justify-end">
            <button type="button" onClick={handleAddCreditLoan} className="w-full py-3.5 bg-indigo-600 text-white rounded-xl shadow-md shadow-indigo-500/20 text-sm font-bold flex justify-center items-center hover:bg-indigo-700 transition-all mb-4">
              <Plus size={16} className="mr-1" /> 신용대출 추가
            </button>
          </div>
        </div>
      </div>

      <div className="mb-5">
        <label className="block text-[13px] font-bold text-gray-700 dark:text-gray-300 mb-1.5">담보 대출 내용 (자동 집계)</label>
        <div className="bg-indigo-50 dark:bg-indigo-900/20 p-3 rounded-xl text-[13px] text-indigo-800 dark:text-indigo-300 font-medium shadow-sm border border-indigo-100 dark:border-indigo-800/30">자동 집계: {getAutoCollateralString()}</div>
      </div>

      <div className="grid grid-cols-2 gap-4">
        {isFieldVisible('creditCard') && (
          <>
            <Select label="신용카드 사용" value={formData.creditCardUse} onChange={(v: any) => handleChange('creditCardUse', v)} options={['사용', '미사용']} />
            {formData.creditCardUse === '사용' && (
              <Input label="사용 금액" value={formData.creditCardAmount} onChange={(v: any) => handleChange('creditCardAmount', v)} type="number" suffix="만원" isCurrency={true} />
            )}
          </>
        )}
      </div>

      <Input label="월 대출납입" value={formData.loanMonthlyPay} onChange={(v: any) => handleChange('loanMonthlyPay', v)} type="number" suffix="만원" isCurrency={true} />

      {isFieldVisible('history') && (
        <div className="mb-4">
          <label className="block text-xs font-medium text-gray-500 mb-1">개인회생/파산/회복 이력</label>
          <div className="flex gap-2 mb-2 flex-wrap">
            {HISTORY_TYPES.map(opt => (
              <button key={opt} type="button" onClick={() => handleChange('historyType', opt)}
                className={`px-3 py-2 text-sm rounded-md border ${formData.historyType === opt ? 'bg-blue-600 text-white border-blue-600' : 'bg-white text-gray-600 border-gray-300 hover:bg-gray-50'}`}
              >{opt}</button>
            ))}
          </div>
          {formData.historyType && formData.historyType !== '없음' && (
            <textarea className="w-full p-2 border border-gray-300 rounded-md h-20 text-sm focus:ring-2 focus:ring-blue-500 focus:outline-none" value={formData.historyMemo} onChange={e => handleChange('historyMemo', e.target.value)} placeholder="이력 상세 내용을 입력하세요." />
          )}
        </div>
      )}
    </div>
  );

  const renderSectionFinish = () => (
    <div>
      <h3 className="text-lg font-bold mb-6 flex items-center gap-2 text-gray-800 dark:text-gray-100 border-b border-gray-100 dark:border-gray-700 pb-3">
        <MessageSquare size={20} className="text-indigo-500" /> 상담 특이사항
      </h3>
      <div className="mb-5">
        <label className="block text-[13px] font-bold text-gray-700 dark:text-gray-300 mb-1.5">상담 특이사항</label>
        <textarea
          className="w-full p-4 bg-gray-50 dark:bg-gray-800/50 border border-transparent rounded-xl h-32 focus:ring-2 focus:ring-indigo-500/40 focus:border-indigo-400 focus:outline-none transition-all placeholder-gray-400 dark:placeholder-gray-500 text-sm shadow-sm focus:bg-white dark:focus:bg-gray-800 text-gray-900 dark:text-gray-100"
          value={formData.specialMemo}
          onChange={e => handleChange('specialMemo', e.target.value)}
          placeholder="상담 내용을 자유롭게 기록하세요."
        />
      </div>
    </div>
  );

  const renderSaveButton = () => (
    <button onClick={handleSubmit} className="flex items-center justify-center bg-blue-600 text-white px-5 py-2 rounded font-bold hover:bg-blue-700 transition-all shadow-none text-sm w-full md:w-auto">
      <Save size={16} className="mr-1.5" /> 저장하기
    </button>
  );

  // ===== Mobile Layout (100% Preserved) =====
  const renderMobileLayout = () => (
    <div>
      {/* Header / Nav */}
      <div className="bg-white dark:bg-gray-800 border-b border-gray-200 dark:border-gray-700 px-4 py-3 flex justify-between items-center sticky top-0 z-20 shadow-sm">
        <div className="flex items-center gap-2">
          <button onClick={() => navigate(-1)} className="p-2 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-full text-gray-600 dark:text-gray-300 transition-colors">
            <ArrowLeft size={20} />
          </button>
          <span className="font-bold text-gray-700 dark:text-gray-200 text-lg">신규 상담 입력</span>
        </div>
        <div className="flex gap-2">
          {renderSaveButton()}
        </div>
      </div>

      <div className="max-w-5xl mx-auto p-4 md:p-6 space-y-6">
        <div className="bg-white dark:bg-gray-800 p-6 rounded-xl shadow-sm border border-gray-100 dark:border-gray-700 min-h-[600px] space-y-8">
          <div className="grid md:grid-cols-2 gap-8">
            {renderSectionBasicInfo()}
            {renderSectionJobFamily()}
          </div>

          <hr className="border-gray-100 dark:border-gray-800" />

          <div className="grid md:grid-cols-2 gap-8">
            {renderSectionHousing()}
            {renderSectionAssets()}
          </div>

          <hr className="border-gray-100 dark:border-gray-800" />

          {renderSectionFinish()}

          <div className="bg-blue-50 dark:bg-blue-900/20 p-4 rounded-lg mt-2">
            <p className="text-sm text-blue-800 dark:text-blue-300 font-medium text-center">모든 항목 작성을 완료한 후 저장하여 케이스를 생성하세요.</p>
          </div>

          <div className="flex justify-end mt-6 pt-4 border-t border-gray-100 dark:border-gray-800">
            {renderSaveButton()}
          </div>
        </div>
      </div>
    </div>
  );

  // ===== PC 3-Column Cockpit Layout (High Density & Zero-Scroll) =====
  const renderDesktopLayout = () => (
    <div className="w-full">
      {/* Desktop Sticky Header */}
      <div className="bg-white dark:bg-gray-800 border-b border-gray-200 dark:border-gray-700 px-6 py-2.5 flex justify-between items-center sticky top-0 z-20 shadow-xs">
        <div className="flex items-center gap-3">
          <button onClick={() => navigate(-1)} className="p-1.5 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg text-gray-600 dark:text-gray-300 transition-colors">
            <ArrowLeft size={18} />
          </button>
          <div className="flex items-center gap-2">
            <span className="font-bold text-gray-800 dark:text-gray-100 text-base">신규 상담 입력</span>
            <span className="bg-blue-50 text-blue-600 dark:bg-blue-900/30 dark:text-blue-400 font-semibold px-2 py-0.5 rounded text-[11px] border border-blue-200 dark:border-blue-800">
              PC 와이드 콕핏 모드
            </span>
          </div>
          <span className="text-gray-400 dark:text-gray-500 text-xs hidden lg:inline">
            | 실시간 상담 입력 &amp; Zero-Scroll 레이아웃
          </span>
        </div>

        {/* Quick Header Indicators & Save Action */}
        <div className="flex items-center gap-3">
          <div className="hidden xl:flex items-center gap-3 bg-gray-50 dark:bg-gray-900/50 px-3 py-1 rounded-lg border border-gray-200 dark:border-gray-700 text-xs">
            <span className="text-gray-500 dark:text-gray-400">고객: <b className="text-gray-800 dark:text-gray-200 font-semibold">{formData.customerName || '미입력'}</b></span>
            <span className="text-gray-300 dark:text-gray-600">|</span>
            <span className="text-gray-500 dark:text-gray-400">연락처: <b className="text-blue-600 dark:text-blue-400 font-mono">{formData.phone || '010'}</b></span>
            <span className="text-gray-300 dark:text-gray-600">|</span>
            <span className="text-gray-500 dark:text-gray-400">유형: <b className="text-indigo-600 dark:text-indigo-400">{formData.caseType}</b></span>
          </div>

          <button
            onClick={handleSubmit}
            className="flex items-center gap-1.5 bg-blue-600 hover:bg-blue-700 text-white font-bold px-4 py-1.5 rounded-lg shadow-sm text-xs transition-all active:scale-95"
          >
            <Save size={14} />
            <span>케이스 정식 저장</span>
          </button>
        </div>
      </div>

      {/* 3-Column Cockpit Workspace */}
      <div className="w-full max-w-[1920px] mx-auto p-4 lg:p-5">
        <div className="grid grid-cols-12 gap-4 items-start">

          {/* ========================================================= */}
          {/* COLUMN 1: 인적사항 & 직업/소득 (Col 1: 4/12) */}
          {/* ========================================================= */}
          <div className="col-span-12 lg:col-span-4 space-y-4">

            {/* Card 1-1: 기본 정보 & 접수 (BLUE IDENTITY) */}
            <div className="bg-white dark:bg-gray-800 rounded-2xl border-2 border-blue-200/90 dark:border-blue-900/60 shadow-xs overflow-hidden">
              {/* 컬러 헤더 밴드 */}
              <div className="bg-gradient-to-r from-blue-50 to-indigo-50/40 dark:from-blue-950/50 dark:to-indigo-950/30 px-4 py-2.5 border-b border-blue-200 dark:border-blue-800 flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <span className="w-5 h-5 rounded-full bg-blue-600 text-white font-black text-xs flex items-center justify-center shadow-xs">
                    1
                  </span>
                  <h2 className="font-extrabold text-gray-900 dark:text-gray-100 text-sm">
                    기본 인적사항 및 접수
                  </h2>
                </div>
                <span className="text-[11px] font-bold text-blue-700 dark:text-blue-300 bg-blue-100/80 dark:bg-blue-900/50 px-2 py-0.5 rounded">
                  필수 항목 *
                </span>
              </div>

              {/* 카드 본문 */}
              <div className="p-4 space-y-3">
                {/* 거래처 & 유입경로 (인라인 2열) */}
                <div className="grid grid-cols-2 gap-3 mb-1">
                  <div>
                    <label className="block text-xs font-bold text-gray-800 dark:text-gray-200 mb-1.5">거래처 (법률사무소)</label>
                    <div className="relative">
                      <select
                        className="w-full pl-8 pr-2.5 py-2 bg-blue-50/50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-lg text-sm font-bold text-blue-900 dark:text-blue-300 focus:outline-none focus:ring-2 focus:ring-blue-500"
                        value={formData.partnerId}
                        onChange={e => handleChange('partnerId', e.target.value)}
                      >
                        {partners.map(p => <option key={p.partnerId} value={p.partnerId}>{p.name}</option>)}
                      </select>
                      <Building className="absolute left-2.5 top-2.5 text-blue-500" size={15} />
                    </div>
                  </div>

                  <div>
                    <label className="block text-xs font-bold text-gray-800 dark:text-gray-200 mb-1.5">유입 경로</label>
                    <select
                      className="w-full px-3 py-2 bg-white dark:bg-gray-800 border border-gray-300 dark:border-gray-600 rounded-lg text-sm text-gray-800 dark:text-gray-200 focus:outline-none focus:ring-2 focus:ring-blue-500"
                      value={formData.inboundPath}
                      onChange={e => handleChange('inboundPath', e.target.value)}
                    >
                      <option value="">선택하세요</option>
                      {inboundPaths.map(p => <option key={p} value={p}>{p}</option>)}
                    </select>
                  </div>
                </div>

                {/* 사건 유형 (컴팩트 4분할 버튼) */}
                <CompactSelect
                  label="사건 유형"
                  value={formData.caseType}
                  onChange={(v: any) => handleChange('caseType', v)}
                  options={CASE_TYPES}
                />

                {/* 사전 리드 정보 배너 (있을 때만) */}
                {formData.preInfo && (
                  <div className="mb-3 p-2.5 bg-indigo-50/80 dark:bg-indigo-950/40 border border-indigo-200 dark:border-indigo-800 rounded-xl text-xs leading-snug">
                    <div className="flex items-center gap-1.5 text-indigo-700 dark:text-indigo-400 font-bold mb-1 text-xs">
                      <AlertCircle size={13} />
                      <span>웹 사전 수집 정보</span>
                    </div>
                    <div className="text-gray-700 dark:text-gray-300 space-y-0.5 text-xs">
                      {formData.preInfo.split(/\s\/\s|\n/).filter((line: string) => {
                        const lower = line.toLowerCase();
                        return !lower.includes('[referrer]') && !lower.includes('[marketing_consent]') && !lower.includes('[third_party_consent]') && !lower.includes('[user_agent]') && line.trim() !== '';
                      }).map((line: string, idx: number) => (
                        <div key={idx} className="truncate">• {line.trim()}</div>
                      ))}
                    </div>
                  </div>
                )}

                {/* 고객명 & 연락처 (2열) */}
                <div className="grid grid-cols-2 gap-3">
                  <CompactInput
                    label="고객명"
                    value={formData.customerName}
                    onChange={(v: any) => handleChange('customerName', v)}
                    placeholder="이름 입력"
                    required={true}
                  />
                  <CompactInput
                    label="연락처"
                    value={formData.phone}
                    onChange={(v: any) => handleChange('phone', v)}
                    placeholder="010-0000-0000"
                    isPhone={true}
                    required={true}
                  />
                </div>

                {/* 중복 고객 경고 알림 */}
                {duplicateCase && (
                  <div className="mb-2.5 p-2.5 bg-red-50 dark:bg-red-950/40 border border-red-200 dark:border-red-800 rounded-xl text-xs text-red-800 dark:text-red-300 animate-pulse">
                    <div className="font-bold flex items-center gap-1">
                      <span>⚠️ 이미 등록된 연락처입니다!</span>
                    </div>
                    <div className="text-xs text-gray-600 dark:text-gray-400 mt-0.5">
                      고객명: <b>{duplicateCase.customerName}</b> | 담당: <b>{duplicateCase.managerName}</b> | 상태: <b className="text-red-600">{duplicateCase.status}</b>
                    </div>
                  </div>
                )}

                {/* 출생년도 & 성별 (2열) */}
                <div className="grid grid-cols-2 gap-3">
                  <CompactInput
                    label="출생년도 (2자리)"
                    value={formData.birth}
                    onChange={(v: any) => handleChange('birth', v)}
                    onBlur={handleBirthBlur}
                    placeholder="예: 85"
                    suffix={formData.birth.length === 4 ? "년생" : ""}
                  />
                  <CompactSelect
                    label="성별"
                    value={formData.gender}
                    onChange={(v: any) => handleChange('gender', v)}
                    options={['남', '여']}
                  />
                </div>

                {/* 거주지역 */}
                <CompactInput
                  label="거주지역 (관할법원 연계)"
                  value={formData.region}
                  onChange={(v: any) => handleChange('region', v)}
                  placeholder="예: 서울 강남 / 수원 팔달"
                />
              </div>
            </div>

            {/* Card 1-2: 직업 / 소득 / 가족 (EMERALD IDENTITY) */}
            <div className="bg-white dark:bg-gray-800 rounded-2xl border-2 border-emerald-200/90 dark:border-emerald-900/60 shadow-xs overflow-hidden">
              {/* 컬러 헤더 밴드 */}
              <div className="bg-gradient-to-r from-emerald-50 to-teal-50/40 dark:from-emerald-950/50 dark:to-teal-950/30 px-4 py-2.5 border-b border-emerald-200 dark:border-emerald-800 flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <span className="w-5 h-5 rounded-full bg-emerald-600 text-white font-black text-xs flex items-center justify-center shadow-xs">
                    2
                  </span>
                  <h2 className="font-extrabold text-gray-900 dark:text-gray-100 text-sm">
                    직업 · 소득 및 부양가족
                  </h2>
                </div>
                {formData.incomeNet > 0 && (
                  <span className="text-[11px] text-emerald-700 dark:text-emerald-300 bg-emerald-100/80 dark:bg-emerald-900/50 px-2 py-0.5 rounded font-bold">
                    월 소득: {formData.incomeNet.toLocaleString()}만원
                  </span>
                )}
              </div>

              {/* 카드 본문 */}
              <div className="p-4 space-y-3">
                {/* 직업 복수선택 */}
                <CompactSelect
                  label="직업 형태 (복수선택 가능)"
                  value={formData.jobTypes}
                  onChange={handleJobTypeChange}
                  options={JOB_TYPES}
                  isMulti={true}
                />

                {/* 직업별 소득 인풋 (조건부) */}
                {(formData.jobTypes?.includes('직장인') ||
                  formData.jobTypes?.includes('개인사업자') ||
                  formData.jobTypes?.includes('법인사업자') ||
                  formData.jobTypes?.includes('프리랜서')) && (
                  <div className="p-3 bg-emerald-50/60 dark:bg-emerald-950/30 border border-emerald-200 dark:border-emerald-900/50 rounded-xl mb-2.5 space-y-2.5">
                    {formData.jobTypes?.includes('직장인') && (
                      <CompactInput
                        label="직장인 월수입"
                        value={formData.incomeDetails?.salary}
                        onChange={(v: any) => handleIncomeChange('salary', v)}
                        type="number"
                        suffix="만원"
                        isCurrency={true}
                        placeholder="급여 실수령액"
                      />
                    )}
                    {(formData.jobTypes?.includes('개인사업자') || formData.jobTypes?.includes('법인사업자')) && (
                      <CompactInput
                        label="사업자 월수입"
                        value={formData.incomeDetails?.business}
                        onChange={(v: any) => handleIncomeChange('business', v)}
                        type="number"
                        suffix="만원"
                        isCurrency={true}
                        placeholder="사업 순소득"
                      />
                    )}
                    {formData.jobTypes?.includes('프리랜서') && (
                      <CompactInput
                        label="프리랜서 월수입"
                        value={formData.incomeDetails?.freelance}
                        onChange={(v: any) => handleIncomeChange('freelance', v)}
                        type="number"
                        suffix="만원"
                        isCurrency={true}
                        placeholder="프리랜서 소득"
                      />
                    )}
                  </div>
                )}

                {/* 4대보험 & 결혼여부 (2열) */}
                <div className="grid grid-cols-2 gap-3">
                  <CompactSelect
                    label="4대보험"
                    value={formData.insurance4}
                    onChange={(v: any) => handleChange('insurance4', v)}
                    options={['가입', '미가입']}
                  />
                  <CompactSelect
                    label="결혼여부"
                    value={formData.maritalStatus}
                    onChange={(v: any) => handleChange('maritalStatus', v)}
                    options={['미혼', '기혼', '이혼']}
                  />
                </div>

                {/* 미성년 자녀 수 (기혼/이혼 시) */}
                {['기혼', '이혼'].includes(formData.maritalStatus) && isFieldVisible('childrenCount') && (
                  <div className="mb-3">
                    <label className="block text-xs font-bold text-gray-800 dark:text-gray-200 mb-1.5">미성년 자녀 수</label>
                    <div className="flex gap-1 flex-wrap">
                      {[0, 1, 2, 3, 4, 5, 6, 7].map(num => (
                        <button
                          key={num}
                          type="button"
                          onClick={() => handleChange('childrenCount', num)}
                          className={`flex-1 py-1.5 rounded-lg text-xs font-bold transition-all border ${
                            formData.childrenCount === num
                              ? 'bg-emerald-600 text-white border-emerald-600 shadow-xs'
                              : 'bg-white border-gray-300 text-gray-700 hover:bg-gray-50 dark:bg-gray-800 dark:border-gray-600 dark:text-gray-300'
                          }`}
                        >
                          {num}명
                        </button>
                      ))}
                    </div>
                  </div>
                )}

                {/* 회생/파산/회복 과거 이력 */}
                {isFieldVisible('history') && (
                  <div>
                    <label className="block text-xs font-bold text-gray-800 dark:text-gray-200 mb-1.5">회생 / 파산 / 회복 이력</label>
                    <div className="grid grid-cols-4 gap-1.5 mb-2">
                      {HISTORY_TYPES.map(opt => (
                        <button
                          key={opt}
                          type="button"
                          onClick={() => handleChange('historyType', opt)}
                          className={`py-1.5 text-xs rounded-lg font-semibold border transition-all ${
                            formData.historyType === opt
                              ? 'bg-blue-600 text-white border-blue-600 shadow-xs'
                              : 'bg-white border-gray-300 text-gray-700 hover:bg-gray-50 dark:bg-gray-800 dark:border-gray-600 dark:text-gray-300'
                          }`}
                        >
                          {opt}
                        </button>
                      ))}
                    </div>
                    {formData.historyType && formData.historyType !== '없음' && (
                      <textarea
                        className="w-full p-2.5 border border-gray-300 dark:border-gray-600 rounded-xl text-sm bg-white dark:bg-gray-800 text-gray-800 dark:text-gray-200 focus:outline-none focus:ring-2 focus:ring-blue-500 h-16 leading-snug"
                        value={formData.historyMemo}
                        onChange={e => handleChange('historyMemo', e.target.value)}
                        placeholder="이력 상세 내용을 입력하세요. (사건번호, 법원, 면책여부 등)"
                      />
                    )}
                  </div>
                )}
              </div>
            </div>

          </div>

          {/* ========================================================= */}
          {/* COLUMN 2: 주거 & 자산/부채 (Col 2: 4/12) */}
          {/* ========================================================= */}
          <div className="col-span-12 lg:col-span-4 space-y-4">

            {/* Card 2-1: 주거 상황 (AMBER IDENTITY) */}
            <div className="bg-white dark:bg-gray-800 rounded-2xl border-2 border-amber-200/90 dark:border-amber-900/60 shadow-xs overflow-hidden">
              {/* 컬러 헤더 밴드 */}
              <div className="bg-gradient-to-r from-amber-50 to-orange-50/40 dark:from-amber-950/50 dark:to-orange-950/30 px-4 py-2.5 border-b border-amber-200 dark:border-amber-800 flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <span className="w-5 h-5 rounded-full bg-amber-600 text-white font-black text-xs flex items-center justify-center shadow-xs">
                    3
                  </span>
                  <h2 className="font-extrabold text-gray-900 dark:text-gray-100 text-sm">
                    주거 형태 및 주거비
                  </h2>
                </div>
                <span className="text-[11px] text-amber-800 dark:text-amber-300 font-bold bg-amber-100/80 dark:bg-amber-900/50 px-2 py-0.5 rounded">
                  {formData.housingType} {formData.housingDetail && `(${formData.housingDetail})`}
                </span>
              </div>

              {/* 카드 본문 */}
              <div className="p-4 space-y-3">
                {/* 거주형태 & 주거타입 */}
                <div className="grid grid-cols-2 gap-3 mb-1">
                  <CompactSelect
                    label="거주형태"
                    value={formData.housingType}
                    onChange={(v: any) => handleChange('housingType', v)}
                    options={HOUSING_TYPES}
                  />
                  <CompactSelect
                    label="주거타입"
                    value={formData.housingDetail}
                    onChange={(v: any) => handleChange('housingDetail', v)}
                    options={HOUSING_DETAILS}
                  />
                </div>

                {/* 조건부 주거 상세 필드 */}
                {formData.housingType === '자가' ? (
                  <div className="p-3 bg-amber-50/60 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-900/50 rounded-xl space-y-2.5">
                    <div className="grid grid-cols-2 gap-2.5">
                      <CompactInput
                        label="집 시세"
                        value={formData.ownHousePrice}
                        onChange={(v: any) => handleChange('ownHousePrice', v)}
                        type="number"
                        suffix="만원"
                        isCurrency={true}
                        placeholder="시세(만)"
                      />
                      <CompactInput
                        label="집 담보 대출"
                        value={formData.ownHouseLoan}
                        onChange={(v: any) => handleChange('ownHouseLoan', v)}
                        type="number"
                        suffix="만원"
                        isCurrency={true}
                        placeholder="대출금(만)"
                      />
                    </div>
                    <CompactSelect
                      label="집 명의자"
                      value={formData.ownHouseOwner}
                      onChange={(v: any) => handleChange('ownHouseOwner', v)}
                      options={['본인', '배우자', '배우자 공동명의']}
                    />
                  </div>
                ) : formData.housingType === '무상거주' ? (
                  <div className="p-3 bg-amber-50/60 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-900/50 rounded-xl">
                    <CompactSelect
                      label="집 명의자"
                      value={formData.freeHousingOwner}
                      onChange={(v: any) => handleChange('freeHousingOwner', v)}
                      options={FREE_HOUSING_OWNERS}
                    />
                  </div>
                ) : (
                  <div className="p-3 bg-amber-50/60 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-900/50 rounded-xl space-y-2.5">
                    <div className="grid grid-cols-2 gap-2.5">
                      <CompactInput
                        label="보증금"
                        value={formData.deposit}
                        onChange={(v: any) => handleChange('deposit', v)}
                        type="number"
                        suffix="만원"
                        isCurrency={true}
                        placeholder="보증금(만)"
                      />
                      {isFieldVisible('depositLoan') ? (
                        <CompactInput
                          label="보증금 대출"
                          value={formData.depositLoanAmount}
                          onChange={(v: any) => handleChange('depositLoanAmount', v)}
                          type="number"
                          suffix="만원"
                          isCurrency={true}
                          placeholder="대출금(만)"
                        />
                      ) : (
                        <CompactInput
                          label="월세"
                          value={formData.rent}
                          onChange={(v: any) => handleChange('rent', v)}
                          type="number"
                          suffix="만원"
                          isCurrency={true}
                          placeholder="월세(만)"
                        />
                      )}
                    </div>
                    {isFieldVisible('depositLoan') && (
                      <CompactInput
                        label="월세"
                        value={formData.rent}
                        onChange={(v: any) => handleChange('rent', v)}
                        type="number"
                        suffix="만원"
                        isCurrency={true}
                        placeholder="월세(만)"
                      />
                    )}
                    <CompactSelect
                      label="임대차 계약인"
                      value={formData.rentContractor}
                      onChange={(v: any) => handleChange('rentContractor', v)}
                      options={RENT_CONTRACTORS}
                    />
                  </div>
                )}
              </div>
            </div>

            {/* Card 2-2: 자산 / 부채 관리 (ROSE IDENTITY) */}
            <div className="bg-white dark:bg-gray-800 rounded-2xl border-2 border-rose-200/90 dark:border-rose-900/60 shadow-xs overflow-hidden">
              {/* 컬러 헤더 밴드 */}
              <div className="bg-gradient-to-r from-rose-50 to-pink-50/40 dark:from-rose-950/50 dark:to-pink-950/30 px-4 py-2.5 border-b border-rose-200 dark:border-rose-800 flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <span className="w-5 h-5 rounded-full bg-rose-600 text-white font-black text-xs flex items-center justify-center shadow-xs">
                    4
                  </span>
                  <h2 className="font-extrabold text-gray-900 dark:text-gray-100 text-sm">
                    자산 및 부채 관리
                  </h2>
                </div>
                <span className="text-[11px] font-bold text-rose-700 dark:text-rose-300 bg-rose-100/80 dark:bg-rose-900/50 px-2 py-0.5 rounded">
                  대출 {formData.creditLoan.length}건 | 자산 {formData.assets.length}건
                </span>
              </div>

              {/* 카드 본문 */}
              <div className="p-4 space-y-3.5">
                {/* 4-A: 자산 목록 (본인/배우자) */}
                {isFieldVisible('assets') && (
                  <div>
                    <div className="flex items-center justify-between mb-1.5">
                      <label className="text-xs font-bold text-gray-800 dark:text-gray-200 flex items-center gap-1.5">
                        <span>🚗 보유 자산 목록</span>
                        <span className="bg-blue-100 text-blue-700 dark:bg-blue-900/40 dark:text-blue-300 px-2 py-0.5 rounded-full text-[11px] font-bold">
                          {formData.assets.length}건
                        </span>
                      </label>
                    </div>

                    {/* 등록된 자산 목록 */}
                    <div className="space-y-1.5 mb-2.5 max-h-40 overflow-y-auto pr-1">
                      {formData.assets.length === 0 && (
                        <p className="text-xs text-gray-400 dark:text-gray-500 text-center py-2.5 bg-gray-50 dark:bg-gray-900/30 rounded-xl border border-dashed border-gray-200 dark:border-gray-700">
                          등록된 자산이 없습니다.
                        </p>
                      )}
                      {formData.assets.map((asset: AssetItem) => (
                        <div key={asset.id} className="bg-gray-50 dark:bg-gray-900/50 p-2.5 rounded-xl border border-gray-200 dark:border-gray-700 flex justify-between items-center text-xs">
                          <div className="flex-1 min-w-0">
                            <div className="font-bold text-gray-800 dark:text-gray-200 truncate">
                              <span className="text-blue-600 dark:text-blue-400 font-bold mr-1">[{asset.owner}]</span>
                              <span>{asset.type}</span>
                              {asset.desc && <span className="text-gray-500 dark:text-gray-400 font-normal ml-1">({asset.desc})</span>}
                            </div>
                            <div className="flex gap-2.5 text-xs text-gray-600 dark:text-gray-400 mt-0.5">
                              <span>시세: <b>{asset.amount > 0 ? `${asset.amount.toLocaleString()}만` : '0'}</b></span>
                              {asset.loanAmount > 0 && <span className="text-rose-600 dark:text-rose-400">담보: <b>{asset.loanAmount.toLocaleString()}만</b></span>}
                              {asset.rentDeposit && asset.rentDeposit > 0 && <span className="text-amber-600">전세: <b>{asset.rentDeposit.toLocaleString()}만</b></span>}
                            </div>
                          </div>
                          <button
                            type="button"
                            onClick={() => handleRemoveAsset(asset.id)}
                            className="p-1.5 text-gray-400 hover:text-red-500 rounded-lg transition-colors"
                            title="삭제"
                          >
                            <Trash2 size={15} />
                          </button>
                        </div>
                      ))}
                    </div>

                    {/* 자산 빠른 추가 폼 (컴팩트 압축) */}
                    <div className="p-3 bg-gray-50 dark:bg-gray-900/40 rounded-xl border border-gray-200 dark:border-gray-700 space-y-2">
                      <div className="grid grid-cols-2 gap-2">
                        <select
                          className="px-2.5 py-2 border border-gray-300 dark:border-gray-600 rounded-lg text-xs font-medium bg-white dark:bg-gray-800 text-gray-800 dark:text-gray-200 outline-none"
                          value={newAsset.owner}
                          onChange={e => setNewAsset({ ...newAsset, owner: e.target.value as any })}
                        >
                          {ASSET_OWNERS.map(o => <option key={o} value={o}>{o}</option>)}
                        </select>
                        <select
                          className="px-2.5 py-2 border border-gray-300 dark:border-gray-600 rounded-lg text-xs font-medium bg-white dark:bg-gray-800 text-gray-800 dark:text-gray-200 outline-none"
                          value={newAsset.type}
                          onChange={e => setNewAsset({ ...newAsset, type: e.target.value })}
                        >
                          {ASSET_TYPES.map(t => <option key={t} value={t}>{t}</option>)}
                        </select>
                      </div>

                      <div className="grid grid-cols-2 gap-2">
                        <input
                          type="number"
                          placeholder="시세 (만원)"
                          className="px-2.5 py-2 border border-gray-300 dark:border-gray-600 rounded-lg text-xs bg-white dark:bg-gray-800 text-gray-800 dark:text-gray-200 outline-none"
                          value={newAsset.amount || ''}
                          onChange={e => setNewAsset({ ...newAsset, amount: Number(e.target.value) })}
                        />
                        <input
                          type="number"
                          placeholder="담보대출 (만원)"
                          className="px-2.5 py-2 border border-gray-300 dark:border-gray-600 rounded-lg text-xs bg-white dark:bg-gray-800 text-gray-800 dark:text-gray-200 outline-none"
                          value={newAsset.loanAmount || ''}
                          onChange={e => setNewAsset({ ...newAsset, loanAmount: Number(e.target.value) })}
                        />
                      </div>

                      {['부동산', '토지'].includes(newAsset.type || '') && (
                        <input
                          type="number"
                          placeholder="전세금액 (만원)"
                          className="w-full px-2.5 py-2 border border-gray-300 dark:border-gray-600 rounded-lg text-xs bg-white dark:bg-gray-800 text-gray-800 dark:text-gray-200 outline-none"
                          value={newAsset.rentDeposit || ''}
                          onChange={e => setNewAsset({ ...newAsset, rentDeposit: Number(e.target.value) })}
                        />
                      )}

                      <div className="flex gap-2">
                        <input
                          type="text"
                          placeholder="상세 내용 (차종, 지목 등)"
                          className="flex-1 px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg text-xs bg-white dark:bg-gray-800 text-gray-800 dark:text-gray-200 outline-none"
                          value={newAsset.desc || ''}
                          onChange={e => setNewAsset({ ...newAsset, desc: e.target.value })}
                        />
                        <button
                          type="button"
                          onClick={handleAddAsset}
                          className="bg-slate-800 hover:bg-slate-900 text-white font-bold px-3 py-2 rounded-lg text-xs flex items-center gap-1 shrink-0"
                        >
                          <Plus size={13} />
                          <span>자산 추가</span>
                        </button>
                      </div>
                    </div>
                  </div>
                )}

                {/* 4-B: 신용대출 목록 */}
                <div className="pt-2 border-t border-gray-100 dark:border-gray-700">
                  <div className="flex items-center justify-between mb-1.5">
                    <label className="text-xs font-bold text-gray-800 dark:text-gray-200 flex items-center gap-1.5">
                      <span>💳 신용대출 내역</span>
                      <span className="bg-rose-100 text-rose-700 dark:bg-rose-900/40 dark:text-rose-300 px-2 py-0.5 rounded-full text-[11px] font-bold">
                        {formData.creditLoan.length}건
                      </span>
                    </label>
                  </div>

                  {/* 등록된 신용대출 리스트 */}
                  <div className="space-y-1.5 mb-2.5 max-h-36 overflow-y-auto pr-1">
                    {formData.creditLoan.length === 0 && (
                      <p className="text-xs text-gray-400 dark:text-gray-500 text-center py-2.5 bg-gray-50 dark:bg-gray-900/30 rounded-xl border border-dashed border-gray-200 dark:border-gray-700">
                        등록된 신용대출이 없습니다.
                      </p>
                    )}
                    {formData.creditLoan.map((loan: CreditLoanItem) => (
                      <div key={loan.id} className="bg-rose-50/50 dark:bg-rose-950/20 p-2.5 rounded-xl border border-rose-200/70 dark:border-rose-900/40 flex justify-between items-center text-xs">
                        <div className="flex-1 min-w-0">
                          <span className="font-bold text-gray-900 dark:text-gray-100">{loan.desc || '신용대출'}</span>
                          <span className="text-rose-600 dark:text-rose-400 font-extrabold ml-2 text-xs">
                            {loan.amount > 0 ? `${loan.amount.toLocaleString()}만원` : '0원'}
                          </span>
                        </div>
                        <button
                          type="button"
                          onClick={() => handleRemoveCreditLoan(loan.id)}
                          className="p-1.5 text-gray-400 hover:text-red-500 rounded-lg transition-colors"
                          title="삭제"
                        >
                          <Trash2 size={15} />
                        </button>
                      </div>
                    ))}
                  </div>

                  {/* 신용대출 인라인 추가 바 */}
                  <div className="flex gap-2">
                    <input
                      type="text"
                      placeholder="대출 내용 (예: 햇살론, 카카오)"
                      className="flex-1 px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg text-xs bg-white dark:bg-gray-800 text-gray-800 dark:text-gray-200 outline-none"
                      value={newCreditLoan.desc || ''}
                      onChange={e => setNewCreditLoan({ ...newCreditLoan, desc: e.target.value })}
                    />
                    <input
                      type="number"
                      placeholder="금액(만원)"
                      className="w-28 px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg text-xs bg-white dark:bg-gray-800 text-gray-800 dark:text-gray-200 outline-none text-right"
                      value={newCreditLoan.amount || ''}
                      onChange={e => setNewCreditLoan({ ...newCreditLoan, amount: Number(e.target.value) })}
                    />
                    <button
                      type="button"
                      onClick={handleAddCreditLoan}
                      className="bg-rose-600 hover:bg-rose-700 text-white font-bold px-3.5 py-2 rounded-lg text-xs flex items-center gap-1 shrink-0"
                    >
                      <Plus size={13} />
                      <span>추가</span>
                    </button>
                  </div>
                </div>

              {/* 담보대출 자동 집계 스트링 */}
              <div className="mb-3 p-2 bg-indigo-50/60 dark:bg-indigo-950/30 border border-indigo-100 dark:border-indigo-900/40 rounded-lg text-xs">
                <span className="font-bold text-indigo-700 dark:text-indigo-400">담보대출 자동 집계: </span>
                <span className="text-gray-700 dark:text-gray-300">{getAutoCollateralString()}</span>
              </div>

              {/* 신용카드 사용 & 사용금액 (2열) */}
              {isFieldVisible('creditCard') && (
                <div className="grid grid-cols-2 gap-2.5 mb-2.5">
                  <CompactSelect
                    label="신용카드 사용"
                    value={formData.creditCardUse}
                    onChange={(v: any) => handleChange('creditCardUse', v)}
                    options={['사용', '미사용']}
                  />
                  {formData.creditCardUse === '사용' ? (
                    <CompactInput
                      label="월 카드 사용액"
                      value={formData.creditCardAmount}
                      onChange={(v: any) => handleChange('creditCardAmount', v)}
                      type="number"
                      suffix="만원"
                      isCurrency={true}
                      placeholder="사용액(만)"
                    />
                  ) : (
                    <div className="hidden" />
                  )}
                </div>
              )}

              {/* 월 총 대출 납입액 */}
              <CompactInput
                label="월 총 대출 납입액"
                value={formData.loanMonthlyPay}
                onChange={(v: any) => handleChange('loanMonthlyPay', v)}
                type="number"
                suffix="만원"
                isCurrency={true}
                placeholder="월 상환금액(만)"
              />
            </div>
          </div>

        </div>

          {/* ========================================================= */}
          {/* COLUMN 3: 실시간 상담 메모 & 등록 콕핏 (Col 3: 4/12, Sticky) */}
          {/* ========================================================= */}
          <div className="col-span-12 lg:col-span-4 space-y-4 lg:sticky lg:top-16">

            {/* Card 3-1: 실시간 통화 메모장 (상담 특이사항) (INDIGO IDENTITY) */}
            <div className="bg-white dark:bg-gray-800 rounded-2xl border-2 border-indigo-200/90 dark:border-indigo-900/60 shadow-xs overflow-hidden flex flex-col">
              {/* 컬러 헤더 밴드 */}
              <div className="bg-gradient-to-r from-indigo-50 to-purple-50/40 dark:from-indigo-950/50 dark:to-purple-950/30 px-4 py-2.5 border-b border-indigo-200 dark:border-indigo-800 flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <span className="w-5 h-5 rounded-full bg-indigo-600 text-white font-black text-xs flex items-center justify-center shadow-xs">
                    5
                  </span>
                  <h2 className="font-extrabold text-gray-900 dark:text-gray-100 text-sm">
                    실시간 상담 메모 (특이사항)
                  </h2>
                </div>
                <span className="text-[11px] font-bold text-indigo-700 dark:text-indigo-300">
                  Ctrl+Enter 즉시 등록
                </span>
              </div>

              {/* 카드 본문 */}
              <div className="p-4 space-y-3">
                {/* 빠른 태그 클릭 삽입 (자주 쓰는 상담 키워드) */}
                <div>
                  <div className="flex items-center gap-1.5 text-xs text-gray-700 dark:text-gray-300 mb-1.5 font-bold">
                    <Tag size={12} className="text-indigo-500" />
                    <span>빠른 문구 삽입 (클릭 시 자동 추가):</span>
                  </div>
                  <div className="flex flex-wrap gap-1.5">
                    {[
                      '급여압류 위기',
                      '배우자 모름 (우편물주의)',
                      '독촉 심함',
                      '서류안내 완료',
                      '재통화 요청',
                      '타 사무소 취소'
                    ].map(tag => (
                      <button
                        key={tag}
                        type="button"
                        onClick={() => handleAddMemoTag(tag)}
                        className="px-2.5 py-1 bg-gray-100 hover:bg-indigo-50 hover:text-indigo-700 hover:border-indigo-300 border border-gray-200 dark:bg-gray-700 dark:hover:bg-gray-600 text-gray-700 dark:text-gray-200 rounded-lg text-xs font-semibold transition-colors"
                      >
                        +{tag}
                      </button>
                    ))}
                  </div>
                </div>

                {/* 대형 텍스트에어리어 (통화하면서 시원하게 작성) */}
                <div>
                  <textarea
                    className="w-full h-72 lg:h-[340px] p-3.5 bg-gray-50/50 dark:bg-gray-900/50 border border-gray-300 dark:border-gray-700 rounded-xl text-sm leading-relaxed text-gray-900 dark:text-gray-100 placeholder-gray-400 dark:placeholder-gray-500 focus:bg-white dark:focus:bg-gray-800 focus:border-indigo-500 focus:outline-none transition-all resize-none shadow-inner font-medium"
                    value={formData.specialMemo}
                    onChange={e => handleChange('specialMemo', e.target.value)}
                    placeholder="고객과의 통화 상담 내용을 실시간으로 입력하세요.

(예시)
- 최근 3개월 카드 연체로 금융사 독촉 전화가 극심함.
- 배우자는 채무 사실을 전혀 모르고 있어 모든 우편물 직장 수령 강력 요청.
- 금요일 오후 3시 신분증 및 통장거래내역서 준비하여 2차 상담 진행하기로 함."
                  />
                </div>

                {/* 안내 문구 & 저장 버튼 */}
                <div className="p-3 bg-blue-50/80 dark:bg-blue-950/40 border border-blue-200 dark:border-blue-900/50 rounded-xl">
                  <div className="flex items-center gap-1.5 text-blue-800 dark:text-blue-300 text-xs font-bold">
                    <CheckCircle2 size={15} className="text-blue-600" />
                    <span>상담 입력 준비 완료</span>
                  </div>
                  <p className="text-xs text-gray-600 dark:text-gray-400 mt-1 leading-snug">
                    인적사항 및 상담 메모 작성이 완료되면 아래 버튼을 눌러 케이스를 정식 등록하세요.
                  </p>
                </div>

                <button
                  onClick={handleSubmit}
                  className="w-full py-3.5 bg-blue-600 hover:bg-blue-700 text-white font-extrabold rounded-xl shadow-md shadow-blue-500/10 text-sm flex items-center justify-center gap-2 transition-all active:scale-98"
                >
                  <Save size={16} />
                  <span>상담 완료 및 케이스 등록</span>
                </button>
              </div>
            </div>

          </div>

        </div>
      </div>
    </div>
  );

  // ===== Unified Return with Responsive Split =====
  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900 pb-20 md:pb-8">
      {/* Mobile View: 100% Exact Preservation */}
      <div className="md:hidden">
        {renderMobileLayout()}
      </div>

      {/* Desktop PC View: 3-Column Cockpit Mode */}
      <div className="hidden md:block">
        {renderDesktopLayout()}
      </div>
    </div>
  );
}
