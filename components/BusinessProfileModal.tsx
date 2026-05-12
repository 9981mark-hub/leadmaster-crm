import React, { useState, useEffect } from 'react';
import { X, Save, Building, Users } from 'lucide-react';
import { useToast } from '../contexts/ToastContext';

interface BusinessProfile {
    businessType: '간이과세자' | '일반과세자' | '법인사업자' | '면세사업자';
    hasEmployees: boolean;
    hasFreelancers: boolean;
}

const DEFAULT_PROFILE: BusinessProfile = {
    businessType: '일반과세자',
    hasEmployees: false,
    hasFreelancers: true,
};

interface Props {
    isOpen: boolean;
    onClose: () => void;
}

export default function BusinessProfileModal({ isOpen, onClose }: Props) {
    const { showToast } = useToast();
    const [profile, setProfile] = useState<BusinessProfile>(DEFAULT_PROFILE);

    useEffect(() => {
        if (isOpen) {
            try {
                const saved = localStorage.getItem('leadmaster_business_profile');
                if (saved) {
                    setProfile(JSON.parse(saved));
                }
            } catch (e) {
                console.error(e);
            }
        }
    }, [isOpen]);

    const handleSave = () => {
        localStorage.setItem('leadmaster_business_profile', JSON.stringify(profile));
        showToast('비즈니스 프로필이 저장되었습니다.', 'success');
        onClose();
        // 페이지 새로고침하여 다른 섹션에 설정 반영 (원천세 등)
        setTimeout(() => window.location.reload(), 500);
    };

    if (!isOpen) return null;

    return (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
            <div className="bg-white rounded-2xl w-full max-w-md shadow-xl overflow-hidden">
                <div className="p-4 border-b border-gray-100 flex justify-between items-center bg-gray-50">
                    <h3 className="font-bold text-gray-800 flex items-center gap-2">
                        <Building size={18} className="text-blue-500" />
                        내 사업 유형 설정
                    </h3>
                    <button onClick={onClose} className="p-1 text-gray-400 hover:text-gray-600 rounded-lg hover:bg-gray-200">
                        <X size={20} />
                    </button>
                </div>

                <div className="p-5 space-y-5">
                    {/* 과세 유형 */}
                    <div>
                        <label className="block text-sm font-bold text-gray-700 mb-2">과세 유형 (부가세 신고 기준)</label>
                        <div className="grid grid-cols-2 gap-2">
                            {['간이과세자', '일반과세자', '법인사업자', '면세사업자'].map(type => (
                                <button
                                    key={type}
                                    onClick={() => setProfile(p => ({ ...p, businessType: type as any }))}
                                    className={`px-3 py-2 text-sm rounded-lg border text-left ${
                                        profile.businessType === type 
                                            ? 'border-blue-500 bg-blue-50 text-blue-700 font-bold' 
                                            : 'border-gray-200 text-gray-600 hover:bg-gray-50'
                                    }`}
                                >
                                    {type}
                                </button>
                            ))}
                        </div>
                        <p className="text-xs text-gray-500 mt-2">일반과세자는 1, 7월 부가세 신고 대상입니다.</p>
                    </div>

                    <hr className="border-gray-100" />

                    {/* 인건비 설정 */}
                    <div>
                        <label className="block text-sm font-bold text-gray-700 mb-2 flex items-center gap-1">
                            <Users size={16} className="text-gray-500" /> 인건비 지급 여부
                        </label>
                        
                        <div className="space-y-3">
                            <label className="flex items-start gap-3 p-3 border rounded-lg cursor-pointer hover:bg-gray-50">
                                <input 
                                    type="checkbox" 
                                    checked={profile.hasEmployees}
                                    onChange={(e) => setProfile(p => ({ ...p, hasEmployees: e.target.checked }))}
                                    className="mt-0.5 w-4 h-4 text-blue-600 rounded border-gray-300 focus:ring-blue-500"
                                />
                                <div>
                                    <p className="text-sm font-bold text-gray-800">정규직 / 알바 (근로소득)</p>
                                    <p className="text-xs text-gray-500">4대보험 가입자 또는 간이세액 대상자</p>
                                </div>
                            </label>

                            <label className="flex items-start gap-3 p-3 border rounded-lg cursor-pointer hover:bg-gray-50">
                                <input 
                                    type="checkbox" 
                                    checked={profile.hasFreelancers}
                                    onChange={(e) => setProfile(p => ({ ...p, hasFreelancers: e.target.checked }))}
                                    className="mt-0.5 w-4 h-4 text-blue-600 rounded border-gray-300 focus:ring-blue-500"
                                />
                                <div>
                                    <p className="text-sm font-bold text-gray-800">프리랜서 / 외주 (사업소득 3.3%)</p>
                                    <p className="text-xs text-gray-500">지급액의 3.3%를 원천징수 후 지급하는 대상</p>
                                </div>
                            </label>
                        </div>
                    </div>
                </div>

                <div className="p-4 border-t border-gray-100 bg-gray-50 flex justify-end gap-2">
                    <button onClick={onClose} className="px-4 py-2 text-sm font-medium text-gray-600 hover:bg-gray-200 rounded-lg">
                        취소
                    </button>
                    <button onClick={handleSave} className="px-4 py-2 text-sm font-bold text-white bg-blue-600 hover:bg-blue-700 rounded-lg flex items-center gap-2">
                        <Save size={16} /> 설정 저장
                    </button>
                </div>
            </div>
        </div>
    );
}
