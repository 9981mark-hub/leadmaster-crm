
import React, { useState, useEffect, useRef, TouchEvent } from 'react';
import { createCase, updateCase, fetchCases, fetchInboundPaths, fetchPartners, markCaseAsSeen } from '../services/api';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { formatPhone, CASE_TYPES, MANAGER_NAME } from '../constants';
import { ChevronRight, ChevronLeft, Save, Plus, Trash2, Building, User, Briefcase, Home, Wallet, MessageSquare, AlertCircle } from 'lucide-react';
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

export default function NewCase() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const leadId = searchParams.get('leadId');
  const { showToast } = useToast();
  const [step, setStep] = useState(1);
  const [inboundPaths, setInboundPaths] = useState<string[]>([]);
  const [partners, setPartners] = useState<Partner[]>([]);

  // Swipe gesture state
  const touchStartX = useRef<number>(0);
  const touchEndX = useRef<number>(0);
  const isSwiping = useRef<boolean>(false);
  const SWIPE_THRESHOLD = 80; // Minimum distance for swipe

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

  // [Added] Duplicate Check State
  const [allCases, setAllCases] = useState<Case[]>([]);
  const [duplicateCase, setDuplicateCase] = useState<Case | undefined>(undefined);

  // [NEW] PC/Mobile responsive detection
  const [isDesktop, setIsDesktop] = useState(typeof window !== 'undefined' && window.innerWidth >= 768);
  useEffect(() => {
    const handler = () => setIsDesktop(window.innerWidth >= 768);
    window.addEventListener('resize', handler);
    return () => window.removeEventListener('resize', handler);
  }, []);

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

  // Swipe gesture handlers
  const handleTouchStart = (e: TouchEvent<HTMLDivElement>) => {
    touchStartX.current = e.touches[0].clientX;
    touchEndX.current = e.touches[0].clientX; // Reset to prevent tap-as-swipe
    isSwiping.current = true;
  };

  const handleTouchMove = (e: TouchEvent<HTMLDivElement>) => {
    if (!isSwiping.current) return;
    touchEndX.current = e.touches[0].clientX;
  };

  const handleTouchEnd = () => {
    if (!isSwiping.current) return;
    isSwiping.current = false;

    const swipeDistance = touchStartX.current - touchEndX.current;

    // Swipe left -> Next step
    if (swipeDistance > SWIPE_THRESHOLD && step < 5) {
      setStep(prev => prev + 1);
    }
    // Swipe right -> Previous step
    else if (swipeDistance < -SWIPE_THRESHOLD && step > 1) {
      setStep(prev => prev - 1);
    }

    // Reset
    touchStartX.current = 0;
    touchEndX.current = 0;
  };

  const handleNext = () => setStep(prev => prev + 1);
  const handleBack = () => setStep(prev => prev - 1);

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
          <div className="grid grid-cols-2 gap-4">
            <Input label="집 시세" value={formData.ownHousePrice} onChange={(v: any) => handleChange('ownHousePrice', v)} type="number" suffix="만원" isCurrency={true} />
            <Input label="집 담보 대출" value={formData.ownHouseLoan} onChange={(v: any) => handleChange('ownHouseLoan', v)} type="number" suffix="만원" isCurrency={true} />
          </div>
          <Select label="집 명의자" value={formData.ownHouseOwner} onChange={(v: any) => handleChange('ownHouseOwner', v)} options={['본인', '배우자', '배우자 공동명의']} />
        </>
      ) : formData.housingType === '무상거주' ? (
        <Select label="집 명의자" value={formData.freeHousingOwner} onChange={(v: any) => handleChange('freeHousingOwner', v)} options={FREE_HOUSING_OWNERS} />
      ) : (
        <>
          <div className="grid grid-cols-2 gap-4">
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
          <div className="space-y-2 mb-3">
            {formData.assets.length === 0 && <p className="text-xs text-gray-400 text-center py-2">등록된 자산이 없습니다.</p>}
            {formData.assets.map((asset: AssetItem) => (
              <div key={asset.id} className="bg-white p-2 rounded border flex justify-between items-center text-sm">
                <div className="flex-1">
                  <span className="font-bold text-blue-600 mr-2">[{asset.owner}]</span>
                  <span className="font-semibold mr-2">{asset.type}</span>
                  <span className="text-gray-800 mr-2">시세 {asset.amount > 0 ? `${asset.amount.toLocaleString()}만원` : '0원'}</span>
                  {asset.loanAmount > 0 && <span className="text-red-500 mr-2">담보 {asset.loanAmount.toLocaleString()}만원</span>}
                  {asset.rentDeposit && asset.rentDeposit > 0 && <span className="text-orange-600 mr-2">전세금 {asset.rentDeposit.toLocaleString()}만원</span>}
                </div>
                <button type="button" onClick={() => handleRemoveAsset(asset.id)} className="text-red-500 p-1"><Trash2 size={16} /></button>
              </div>
            ))}
          </div>
          <div className="grid grid-cols-2 gap-2 mb-2">
            <select className="p-2 border rounded text-sm bg-white" value={newAsset.owner} onChange={e => setNewAsset({ ...newAsset, owner: e.target.value as any })}>
              {ASSET_OWNERS.map(o => <option key={o} value={o}>{o}</option>)}
            </select>
            <select className="p-2 border rounded text-sm bg-white" value={newAsset.type} onChange={e => setNewAsset({ ...newAsset, type: e.target.value })}>
              {ASSET_TYPES.map(t => <option key={t} value={t}>{t}</option>)}
            </select>
          </div>
          <div className="grid grid-cols-2 gap-2 mb-2">
            <Input label="시세" value={newAsset.amount} onChange={(v: any) => setNewAsset({ ...newAsset, amount: v })} type="number" suffix="만원" isCurrency={true} placeholder="시세" />
            <Input label="담보대출" value={newAsset.loanAmount} onChange={(v: any) => setNewAsset({ ...newAsset, loanAmount: v })} type="number" suffix="만원" isCurrency={true} placeholder="담보대출" />
          </div>
          {['부동산', '토지'].includes(newAsset.type || '') && (
            <div className="mb-2">
              <Input label="전세금액" value={newAsset.rentDeposit} onChange={(v: any) => setNewAsset({ ...newAsset, rentDeposit: v })} type="number" suffix="만원" isCurrency={true} placeholder="전세금액" />
            </div>
          )}
          <div className="flex gap-2 mb-2">
            <input type="text" placeholder="상세 내용 (예: 차종 등)" className="flex-1 px-3.5 py-3 border border-transparent rounded-xl text-sm shadow-sm focus:border-indigo-400 focus:ring-2 focus:ring-indigo-500/40 outline-none transition-all dark:bg-gray-800 dark:text-gray-100 dark:placeholder-gray-500" value={newAsset.desc || ''} onChange={e => setNewAsset({ ...newAsset, desc: e.target.value })} />
            <button type="button" onClick={handleAddAsset} className="w-24 bg-indigo-600 text-white rounded-xl shadow-md shadow-indigo-500/20 text-sm font-bold flex justify-center items-center hover:bg-indigo-700 transition-all">
              <Plus size={16} className="mr-1" /> 추가
            </button>
          </div>
        </div>
      )}

      <div className="mb-8 bg-gray-50 dark:bg-gray-800/50 p-5 rounded-2xl border border-gray-100 dark:border-gray-700 shadow-sm relative overflow-hidden">
        {/* Subtle accent border top */}
        <div className="absolute top-0 left-0 w-full h-1 bg-rose-500/20"></div>
        <h4 className="font-bold text-gray-800 dark:text-gray-100 mb-4 text-[13px] flex items-center gap-1.5"><AlertCircle size={14} className="text-rose-500" />신용대출 목록</h4>
        <div className="space-y-2 mb-3">
          {(formData.creditLoan || []).length === 0 && <p className="text-xs text-gray-400 text-center py-2">등록된 신용대출이 없습니다.</p>}
          {formData.creditLoan?.map((loan: CreditLoanItem) => (
            <div key={loan.id} className="bg-white p-2 rounded border flex justify-between items-center text-sm">
              <div className="flex-1">
                <span className="font-semibold mr-2">{loan.desc}</span>
                <span className="text-gray-800">{loan.amount.toLocaleString()}만원</span>
              </div>
              <button type="button" onClick={() => handleRemoveCreditLoan(loan.id)} className="text-red-500 p-1"><Trash2 size={16} /></button>
            </div>
          ))}
        </div>
        <div className="grid grid-cols-2 gap-2 mb-2">
          <input type="text" placeholder="대출 내용 (예: 햇살론)" className="w-full px-3.5 py-3 border border-transparent rounded-xl text-sm shadow-sm focus:border-indigo-400 focus:ring-2 focus:ring-indigo-500/40 outline-none transition-all col-span-2 dark:bg-gray-800 dark:text-gray-100 dark:placeholder-gray-500" value={newCreditLoan.desc || ''} onChange={e => setNewCreditLoan({ ...newCreditLoan, desc: e.target.value })} />
          <Input label="금액" value={newCreditLoan.amount} onChange={(v: any) => setNewCreditLoan({ ...newCreditLoan, amount: v })} type="number" suffix="만원" isCurrency={true} />
          <div className="h-full flex flex-col justify-end">
            <button type="button" onClick={handleAddCreditLoan} className="w-full py-3 bg-indigo-600 text-white rounded-xl shadow-md shadow-indigo-500/20 text-sm font-bold flex justify-center items-center hover:bg-indigo-700 transition-all mb-5">
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
        <MessageSquare size={20} className="text-indigo-500" /> {isDesktop ? '상담 특이사항' : '마무리'}
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

  // ===== PC Layout =====
  if (isDesktop) {
    return (
      <div className="max-w-5xl mx-auto">
        {/* Header */}
        <div className="flex items-center justify-between mb-6">
          <div>
            <h2 className="text-2xl font-bold text-gray-800">신규 상담 입력</h2>
            <p className="text-sm text-gray-500 mt-1">모든 항목을 한 페이지에서 입력할 수 있습니다.</p>
          </div>
          {renderSaveButton()}
        </div>

        {/* 2-Column Grid */}
        <div className="grid grid-cols-2 gap-6">
          {/* Left Column */}
          <div className="space-y-6">
            <div className="bg-white md:bg-[#f8fafc] p-6 md:p-5 rounded-xl md:rounded-lg shadow-sm md:shadow-none border border-gray-100 md:border-slate-200">
              {renderSectionBasicInfo()}
            </div>
            <div className="bg-white md:bg-[#f8fafc] p-6 md:p-5 rounded-xl md:rounded-lg shadow-sm md:shadow-none border border-gray-100 md:border-slate-200">
              {renderSectionJobFamily()}
            </div>
          </div>

          {/* Right Column */}
          <div className="space-y-6">
            <div className="bg-white md:bg-[#f8fafc] p-6 md:p-5 rounded-xl md:rounded-lg shadow-sm md:shadow-none border border-gray-100 md:border-slate-200">
              {renderSectionHousing()}
            </div>
            <div className="bg-white md:bg-[#f8fafc] p-6 md:p-5 rounded-xl md:rounded-lg shadow-sm md:shadow-none border border-gray-100 md:border-slate-200">
              {renderSectionAssets()}
            </div>
          </div>
        </div>

        {/* Full-width: Finish Section */}
        <div className="mt-6 bg-white md:bg-[#f8fafc] p-6 md:p-5 rounded-xl md:rounded-lg shadow-sm md:shadow-none border border-gray-100 md:border-slate-200">
          {renderSectionFinish()}
          <div className="bg-blue-50 p-4 rounded-lg mt-2">
            <p className="text-sm text-blue-800 font-medium text-center">작성을 완료하고 케이스를 생성합니다.</p>
          </div>
        </div>

        {/* Bottom Save */}
        <div className="flex justify-end mt-6 pt-4 border-t border-gray-100">
          {renderSaveButton()}
        </div>
      </div>
    );
  }

  // ===== Mobile Layout (Existing Step Wizard) =====
  return (
    <div className="max-w-xl mx-auto bg-[#f8fafc] p-6 rounded-lg shadow-sm border border-slate-200">
      <div className="mb-6">
        <h2 className="text-xl font-bold text-gray-800">신규 상담 입력</h2>
        <div className="flex gap-1 mt-2">
          {[1, 2, 3, 4, 5].map(s => (
            <div key={s} className={`h-1 flex-1 rounded-full ${s <= step ? 'bg-blue-600' : 'bg-gray-200'}`} />
          ))}
        </div>
      </div>

      <div
        className="min-h-[300px]"
        onTouchStart={handleTouchStart}
        onTouchMove={handleTouchMove}
        onTouchEnd={handleTouchEnd}
      >
        {step === 1 && renderSectionBasicInfo()}
        {step === 2 && renderSectionJobFamily()}
        {step === 3 && renderSectionHousing()}
        {step === 4 && renderSectionAssets()}
        {step === 5 && (
          <div>
            {renderSectionFinish()}
            <div className="bg-blue-50 p-4 rounded-lg">
              <p className="text-sm text-blue-800 font-medium text-center">작성을 완료하고 케이스를 생성합니다.</p>
            </div>
          </div>
        )}
      </div>

      <div className="flex justify-between items-center gap-3 mt-6 pt-4 border-t border-slate-200">
        {step > 1 ? (
          <button onClick={handleBack} className="flex-shrink-0 whitespace-nowrap flex items-center text-gray-600 font-medium px-4 py-2 hover:bg-gray-100 rounded text-sm transition-colors border border-gray-300 bg-white shadow-sm">
            <ChevronLeft size={16} /> 이전
          </button>
        ) : <div />}

        <div className="flex-1 flex justify-end">
          {step < 5 ? (
            <button onClick={handleNext} className="flex items-center bg-blue-600 text-white px-5 py-2 rounded font-medium hover:bg-blue-700 text-sm shadow-none transition-colors">
              다음 <ChevronRight size={16} />
            </button>
          ) : (
            renderSaveButton()
          )}
        </div>
      </div>
    </div>
  );
}
