
import React, { useState, useEffect } from 'react';
import { createCase, updateCase, fetchCases, fetchInboundPaths, fetchPartners, markCaseAsSeen } from '../services/api';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { formatPhone, CASE_TYPES, MANAGER_NAME } from '../constants';
import { ChevronRight, ChevronLeft, Save, Plus, Trash2, Building } from 'lucide-react';
import { JOB_TYPES, HOUSING_TYPES, HOUSING_DETAILS, ASSET_TYPES, ASSET_OWNERS, RENT_CONTRACTORS, HISTORY_TYPES, FREE_HOUSING_OWNERS } from '../constants';
import { normalizeBirthYear, checkIsDuplicate } from '../utils';
import { AssetItem, Partner, CreditLoanItem, Case } from '../types';
import { useToast } from '../contexts/ToastContext';

const Input = ({ label, value, onChange, onBlur, type = "text", placeholder = "", suffix = "" }: any) => {
  const displayValue = type === 'number' && value === 0 ? '' : value;

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const val = e.target.value;
    if (type === 'number') {
      // Allow only numbers (and empty string)
      if (val === '' || /^[0-9]+$/.test(val)) {
        onChange(val === '' ? 0 : Number(val));
      }
    } else {
      onChange(val);
    }
  };

  return (
    <div className="mb-4">
      <label className="block text-sm font-medium text-gray-700 mb-1">{label}</label>
      <div className="relative">
        <input
          type={type === 'number' ? 'text' : type}
          className="w-full p-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:outline-none"
          value={displayValue}
          onChange={handleInputChange}
          onBlur={onBlur}
          placeholder={placeholder}
        />
        {suffix && <span className="absolute right-3 top-2 text-gray-500 text-sm">{suffix}</span>}
      </div>
    </div>
  );
};

const Select = ({ label, value, onChange, options, isMulti = false }: any) => (
  <div className="mb-4">
    <label className="block text-sm font-medium text-gray-700 mb-1">{label}</label>
    <div className="flex gap-2 flex-wrap">
      {options.map((opt: string) => {
        const isSelected = isMulti ? value?.includes(opt) : value === opt;
        return (
          <button
            key={opt}
            type="button"
            onClick={() => onChange(opt)}
            className={`px-3 py-2 text-sm rounded-md border ${isSelected ? 'bg-blue-600 text-white border-blue-600' : 'bg-white text-gray-600 border-gray-300 hover:bg-gray-50'}`}
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

  return (
    <div className="max-w-xl mx-auto bg-white p-6 rounded-xl shadow-sm border border-gray-100">
      <div className="mb-6">
        <h2 className="text-xl font-bold text-gray-800">신규 상담 입력</h2>
        <div className="flex gap-1 mt-2">
          {[1, 2, 3, 4, 5].map(s => (
            <div key={s} className={`h-1 flex-1 rounded-full ${s <= step ? 'bg-blue-600' : 'bg-gray-200'}`} />
          ))}
        </div>
      </div>

      <div className="min-h-[300px]">
        {step === 1 && (
          <div>
            <h3 className="text-lg font-semibold mb-4 text-blue-600">1. 기본 정보</h3>

            <div className="mb-4">
              <label className="block text-sm font-medium text-gray-700 mb-1">거래처 (법률사무소)</label>
              <div className="relative">
                <select
                  className="w-full p-2 pl-8 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:outline-none bg-blue-50 text-blue-900 font-bold"
                  value={formData.partnerId}
                  onChange={e => handleChange('partnerId', e.target.value)}
                >
                  {partners.map(p => <option key={p.partnerId} value={p.partnerId}>{p.name}</option>)}
                </select>
                <Building className="absolute left-2.5 top-2.5 text-blue-500" size={18} />
              </div>
            </div>

            <Select label="사건 유형" value={formData.caseType} onChange={(v: any) => handleChange('caseType', v)} options={CASE_TYPES} />

            <div className="mb-4">
              <label className="block text-sm font-medium text-gray-700 mb-1">유입 경로</label>
              <select
                className="w-full p-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:outline-none"
                value={formData.inboundPath}
                onChange={e => handleChange('inboundPath', e.target.value)}
              >
                <option value="">선택하세요</option>
                {inboundPaths.map(p => <option key={p} value={p}>{p}</option>)}
              </select>
            </div>

            <hr className="my-4 border-gray-100" />

            {/* [ADDED] Pre-customer Information (Lead Info) with Filtering */}
            {formData.preInfo && (
              <div className="mb-4 animate-fade-in">
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  사전 고객 정보 (리드 수집 정보)
                </label>
                <div className="w-full p-3 border border-indigo-100 rounded-lg text-sm bg-indigo-50 text-gray-700 whitespace-pre-wrap leading-relaxed shadow-sm">
                  {formData.preInfo.split(/\s\/\s|\n/).filter((line: string) => {
                    // Filter out technical/consent fields
                    const lower = line.toLowerCase();
                    return !lower.includes('[referrer]') &&
                      !lower.includes('[marketing_consent]') &&
                      !lower.includes('[third_party_consent]') &&
                      !lower.includes('[user_agent]') &&
                      line.trim() !== '';
                  }).join('\n') || <span className="text-gray-400 italic">표시할 추가 정보가 없습니다. (기술 정보 제외됨)</span>}
                </div>
              </div>
            )}

            <Input label="고객명" value={formData.customerName} onChange={(v: any) => handleChange('customerName', v)} />

            <div>
              <Input label="연락처" value={formData.phone} onChange={(v: any) => handleChange('phone', v)} placeholder="01012345678" />
              {duplicateCase && (
                <div className="mb-4 -mt-3 animate-pulse">
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
            </div>
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
        )}

        {step === 2 && (
          <div>
            <h3 className="text-lg font-semibold mb-4 text-blue-600">2. 직업/소득/가족</h3>
            <Select label="직업 (복수선택 가능)" value={formData.jobTypes} onChange={handleJobTypeChange} options={JOB_TYPES} isMulti={true} />

            {formData.jobTypes?.includes('직장인') &&
              <Input label="직장인 월수입" value={formData.incomeDetails?.salary} onChange={(v: any) => handleIncomeChange('salary', v)} type="number" suffix="만원" />
            }
            {(formData.jobTypes?.includes('개인사업자') || formData.jobTypes?.includes('법인사업자')) &&
              <Input label="사업자 월수입" value={formData.incomeDetails?.business} onChange={(v: any) => handleIncomeChange('business', v)} type="number" suffix="만원" />
            }
            {formData.jobTypes?.includes('프리랜서') &&
              <Input label="프리랜서 월수입" value={formData.incomeDetails?.freelance} onChange={(v: any) => handleIncomeChange('freelance', v)} type="number" suffix="만원" />
            }

            <Select label="4대보험" value={formData.insurance4} onChange={(v: any) => handleChange('insurance4', v)} options={['가입', '미가입']} />
            <Select label="결혼여부" value={formData.maritalStatus} onChange={(v: any) => handleChange('maritalStatus', v)} options={['미혼', '기혼', '이혼']} />

            {['기혼', '이혼'].includes(formData.maritalStatus) && isFieldVisible('childrenCount') && (
              <div className="mb-4">
                <label className="block text-sm font-medium text-gray-700 mb-1">미성년 자녀 수</label>
                <div className="flex gap-2 flex-wrap">
                  {[0, 1, 2, 3, 4, 5, 6, 7].map(num => (
                    <button
                      key={num}
                      type="button"
                      onClick={() => handleChange('childrenCount', num)}
                      className={`px-3 py-2 border rounded-md text-sm ${formData.childrenCount === num ? 'bg-blue-600 text-white border-blue-600' : 'bg-white text-gray-700 hover:bg-gray-50'}`}
                    >
                      {num}명
                    </button>
                  ))}
                </div>
              </div>
            )}
          </div>
        )}

        {step === 3 && (
          <div>
            <h3 className="text-lg font-semibold mb-4 text-blue-600">3. 주거</h3>
            <Select label="거주형태" value={formData.housingType} onChange={(v: any) => handleChange('housingType', v)} options={HOUSING_TYPES} />
            <Select label="주거타입" value={formData.housingDetail} onChange={(v: any) => handleChange('housingDetail', v)} options={HOUSING_DETAILS} />

            {/* Conditional Fields based on Housing Type */}
            {formData.housingType === '자가' ? (
              <>
                <div className="grid grid-cols-2 gap-4">
                  <Input label="집 시세" value={formData.ownHousePrice} onChange={(v: any) => handleChange('ownHousePrice', v)} type="number" suffix="만원" />
                  <Input label="집 담보 대출" value={formData.ownHouseLoan} onChange={(v: any) => handleChange('ownHouseLoan', v)} type="number" suffix="만원" />
                </div>
                <Select label="집 명의자" value={formData.ownHouseOwner} onChange={(v: any) => handleChange('ownHouseOwner', v)} options={['본인', '배우자', '배우자 공동명의']} />
              </>
            ) : formData.housingType === '무상거주' ? (
              <>
                <Select label="집 명의자" value={formData.freeHousingOwner} onChange={(v: any) => handleChange('freeHousingOwner', v)} options={FREE_HOUSING_OWNERS} />
              </>
            ) : (
              <>
                <div className="grid grid-cols-2 gap-4">
                  <Input label="보증금" value={formData.deposit} onChange={(v: any) => handleChange('deposit', v)} type="number" suffix="만원" />
                  {isFieldVisible('depositLoan') && (
                    <Input label="보증금 대출" value={formData.depositLoanAmount} onChange={(v: any) => handleChange('depositLoanAmount', v)} type="number" suffix="만원" />
                  )}
                </div>

                <Input label="월세" value={formData.rent} onChange={(v: any) => handleChange('rent', v)} type="number" suffix="만원" />

                {/* Always show rent contractor for Jeonse/Wolse */}
                <div className="mb-4">
                  <label className="block text-sm font-medium text-gray-700 mb-1">임대차 계약인</label>
                  <div className="flex gap-2">
                    {RENT_CONTRACTORS.map(opt => (
                      <button
                        key={opt}
                        type="button"
                        onClick={() => handleChange('rentContractor', opt)}
                        className={`flex-1 py-2 text-sm rounded-md border ${formData.rentContractor === opt ? 'bg-blue-600 text-white border-blue-600' : 'bg-white text-gray-600 border-gray-300 hover:bg-gray-50'}`}
                      >
                        {opt}
                      </button>
                    ))}
                  </div>
                </div>
              </>
            )}

            <Input label="거주지역" value={formData.region} onChange={(v: any) => handleChange('region', v)} placeholder="예: 서울 강남" />
          </div>
        )}

        {step === 4 && (
          <div>
            <h3 className="text-lg font-semibold mb-4 text-blue-600">4. 자산/부채</h3>

            {isFieldVisible('assets') && (
              <div className="mb-6 bg-blue-50 p-4 rounded-lg border border-blue-200">
                <h4 className="font-bold text-gray-700 mb-2 text-sm">자산 목록 (본인/배우자 포함)</h4>

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
                      <button type="button" onClick={() => handleRemoveAsset(asset.id)} className="text-red-500 p-1">
                        <Trash2 size={16} />
                      </button>
                    </div>
                  ))}
                </div>

                <div className="grid grid-cols-2 gap-2 mb-2">
                  <select
                    className="p-2 border rounded text-sm bg-white"
                    value={newAsset.owner}
                    onChange={e => setNewAsset({ ...newAsset, owner: e.target.value as any })}
                  >
                    {ASSET_OWNERS.map(o => <option key={o} value={o}>{o}</option>)}
                  </select>
                  <select
                    className="p-2 border rounded text-sm bg-white"
                    value={newAsset.type}
                    onChange={e => setNewAsset({ ...newAsset, type: e.target.value })}
                  >
                    {ASSET_TYPES.map(t => <option key={t} value={t}>{t}</option>)}
                  </select>
                </div>
                <div className="grid grid-cols-2 gap-2 mb-2">
                  <input
                    type="text"
                    placeholder="시세 (만원)"
                    className="w-full p-2 border rounded text-sm"
                    value={newAsset.amount === 0 ? '' : newAsset.amount}
                    onChange={e => {
                      const val = e.target.value;
                      if (val === '' || /^[0-9]+$/.test(val)) {
                        setNewAsset({ ...newAsset, amount: Number(val) || 0 });
                      }
                    }}
                  />
                  <input
                    type="text"
                    placeholder="담보대출 (만원)"
                    className="w-full p-2 border rounded text-sm"
                    value={newAsset.loanAmount === 0 ? '' : newAsset.loanAmount}
                    onChange={e => {
                      const val = e.target.value;
                      if (val === '' || /^[0-9]+$/.test(val)) {
                        setNewAsset({ ...newAsset, loanAmount: Number(val) || 0 });
                      }
                    }}
                  />
                </div>
                {['부동산', '토지'].includes(newAsset.type || '') && (
                  <div className="mb-2">
                    <input
                      type="text"
                      placeholder="전세금액 (만원)"
                      className="w-full p-2 border rounded text-sm bg-orange-50 border-orange-200"
                      value={newAsset.rentDeposit === 0 ? '' : newAsset.rentDeposit}
                      onChange={e => {
                        const val = e.target.value;
                        if (val === '' || /^[0-9]+$/.test(val)) {
                          setNewAsset({ ...newAsset, rentDeposit: Number(val) || 0 });
                        }
                      }}
                    />
                  </div>
                )}
                <div className="flex gap-2 mb-2">
                  <input
                    type="text"
                    placeholder="상세 내용 (예: 차종 등)"
                    className="flex-1 p-2 border rounded text-sm"
                    value={newAsset.desc || ''}
                    onChange={e => setNewAsset({ ...newAsset, desc: e.target.value })}
                  />
                  <button
                    type="button"
                    onClick={handleAddAsset}
                    className="w-24 bg-blue-600 text-white rounded text-sm font-bold flex justify-center items-center hover:bg-blue-700"
                  >
                    <Plus size={16} className="mr-1" /> 추가
                  </button>
                </div>
              </div>
            )}

            <div className="mb-6 bg-pink-50 p-4 rounded-lg border border-pink-200">
              <h4 className="font-bold text-gray-700 mb-2 text-sm">신용대출 목록</h4>
              <div className="space-y-2 mb-3">
                {(formData.creditLoan || []).length === 0 && <p className="text-xs text-gray-400 text-center py-2">등록된 신용대출이 없습니다.</p>}
                {formData.creditLoan?.map((loan: CreditLoanItem) => (
                  <div key={loan.id} className="bg-white p-2 rounded border flex justify-between items-center text-sm">
                    <div className="flex-1">
                      <span className="font-semibold mr-2">{loan.desc}</span>
                      <span className="text-gray-800">{loan.amount.toLocaleString()}만원</span>
                    </div>
                    <button type="button" onClick={() => handleRemoveCreditLoan(loan.id)} className="text-red-500 p-1">
                      <Trash2 size={16} />
                    </button>
                  </div>
                ))}
              </div>
              <div className="grid grid-cols-2 gap-2 mb-2">
                <input
                  type="text"
                  placeholder="대출 내용 (예: 햇살론)"
                  className="w-full p-2 border rounded text-sm col-span-2"
                  value={newCreditLoan.desc || ''}
                  onChange={e => setNewCreditLoan({ ...newCreditLoan, desc: e.target.value })}
                />
                <input
                  type="text"
                  placeholder="금액 (만원)"
                  className="w-full p-2 border rounded text-sm"
                  value={newCreditLoan.amount === 0 ? '' : newCreditLoan.amount}
                  onChange={e => {
                    const val = e.target.value;
                    if (val === '' || /^[0-9]+$/.test(val)) {
                      setNewCreditLoan({ ...newCreditLoan, amount: Number(val) || 0 });
                    }
                  }}
                />
                <button
                  type="button"
                  onClick={handleAddCreditLoan}
                  className="w-full py-2 bg-blue-600 text-white rounded text-sm font-bold flex justify-center items-center hover:bg-blue-700"
                >
                  <Plus size={16} className="mr-1" /> 신용대출 추가
                </button>
              </div>
            </div>

            <div className="mb-4">
              <label className="block text-sm font-medium text-gray-700 mb-1">담보 대출 내용 (자동 집계 + 추가)</label>
              <div className="bg-gray-50 p-2 rounded text-sm text-blue-800 font-medium mb-1">
                자동 집계: {getAutoCollateralString()}
              </div>
              <input
                type="text"
                className="w-full p-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:outline-none"
                value={formData.collateralLoanMemo}
                onChange={e => handleChange('collateralLoanMemo', e.target.value)}
                placeholder="추가로 작성할 담보 대출 내용"
              />
            </div>

            <div className="grid grid-cols-2 gap-4">
              {isFieldVisible('creditCard') && (
                <>
                  <Select label="신용카드 사용" value={formData.creditCardUse} onChange={(v: any) => handleChange('creditCardUse', v)} options={['사용', '미사용']} />
                  {formData.creditCardUse === '사용' && (
                    <Input label="사용 금액" value={formData.creditCardAmount} onChange={(v: any) => handleChange('creditCardAmount', v)} type="number" suffix="만원" />
                  )}
                </>
              )}
            </div>

            <Input label="월 대출납입" value={formData.loanMonthlyPay} onChange={(v: any) => handleChange('loanMonthlyPay', v)} type="number" suffix="만원" />

            {isFieldVisible('history') && (
              <div className="mb-4">
                <label className="block text-sm font-medium text-gray-700 mb-1">개인회생/파산/회복 이력</label>
                <div className="flex gap-2 mb-2 flex-wrap">
                  {HISTORY_TYPES.map(opt => (
                    <button
                      key={opt}
                      type="button"
                      onClick={() => handleChange('historyType', opt)}
                      className={`px-3 py-2 text-sm rounded-md border ${formData.historyType === opt ? 'bg-blue-600 text-white border-blue-600' : 'bg-white text-gray-600 border-gray-300 hover:bg-gray-50'}`}
                    >
                      {opt}
                    </button>
                  ))}
                </div>
                {formData.historyType && formData.historyType !== '없음' && (
                  <textarea
                    className="w-full p-2 border border-gray-300 rounded-md h-20 text-sm focus:ring-2 focus:ring-blue-500 focus:outline-none"
                    value={formData.historyMemo}
                    onChange={e => handleChange('historyMemo', e.target.value)}
                    placeholder="이력 상세 내용을 입력하세요."
                  />
                )}
              </div>
            )}
          </div>
        )}

        {step === 5 && (
          <div>
            <h3 className="text-lg font-semibold mb-4 text-blue-600">5. 마무리</h3>
            <div className="mb-4">
              <label className="block text-sm font-medium text-gray-700 mb-1">상담 특이사항</label>
              <textarea
                className="w-full p-2 border border-gray-300 rounded-md h-32 text-sm focus:ring-2 focus:ring-blue-500 focus:outline-none"
                value={formData.specialMemo}
                onChange={e => handleChange('specialMemo', e.target.value)}
                placeholder="상담 내용을 자유롭게 기록하세요."
              />
            </div>
            <div className="bg-blue-50 p-4 rounded-lg">
              <p className="text-sm text-blue-800 font-medium text-center">작성을 완료하고 케이스를 생성합니다.</p>
            </div>
          </div>
        )}
      </div>

      <div className="flex justify-between mt-6 pt-4 border-t border-gray-100">
        {step > 1 ? (
          <button onClick={handleBack} className="flex items-center text-gray-600 font-medium px-4 py-2 hover:bg-gray-100 rounded-lg">
            <ChevronLeft size={18} /> 이전
          </button>
        ) : <div />}

        {step < 5 ? (
          <button onClick={handleNext} className="flex items-center bg-blue-600 text-white px-6 py-2 rounded-lg font-medium hover:bg-blue-700">
            다음 <ChevronRight size={18} />
          </button>
        ) : (
          <button onClick={handleSubmit} className="flex items-center bg-green-600 text-white px-6 py-2 rounded-lg font-medium hover:bg-green-700">
            <Save size={18} className="mr-2" /> 저장하기
          </button>
        )}
      </div>
    </div>
  );
}
