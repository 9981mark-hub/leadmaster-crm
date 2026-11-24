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
        <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-5 bg-background/80 backdrop-blur-xs animate-in fade-in duration-200 overflow-y-auto">
            <div className="relative w-full max-w-md max-h-[88vh] my-auto flex flex-col rounded-2xl bg-card border border-border shadow-2xl overflow-hidden text-card-foreground">
                <div className="p-4 sm:p-5 border-b border-border flex justify-between items-center bg-card shrink-0">
                    <h3 className="font-bold text-base text-foreground flex items-center gap-2">
                        <Building size={18} className="text-primary" />
                        내 사업 유형 설정
                    </h3>
                    <button onClick={onClose} className="p-1.5 text-muted-foreground hover:text-foreground rounded-lg hover:bg-muted transition-colors cursor-pointer" title="창 닫기">
                        <X size={18} />
                    </button>
                </div>

                <div className="flex-1 overflow-y-auto p-5 sm:p-6 space-y-5 custom-scrollbar text-xs">
                    {/* 과세 유형 */}
                    <div>
                        <label className="block text-xs font-bold text-foreground mb-2">과세 유형 (부가세 신고 기준)</label>
                        <div className="grid grid-cols-2 gap-2">
                            {['간이과세자', '일반과세자', '법인사업자', '면세사업자'].map(type => (
                                <button
                                    key={type}
                                    onClick={() => setProfile(p => ({ ...p, businessType: type as any }))}
                                    className={`px-3 py-2 text-xs rounded-xl border text-left transition-colors cursor-pointer ${
                                        profile.businessType === type 
                                            ? 'border-primary bg-primary/10 text-primary font-bold shadow-2xs' 
                                            : 'border-border text-muted-foreground hover:bg-muted hover:text-foreground'
                                    }`}
                                >
                                    {type}
                                </button>
                            ))}
                        </div>
                        <p className="text-2xs text-muted-foreground mt-2">일반과세자는 1, 7월 부가세 신고 대상입니다.</p>
                    </div>

                    <hr className="border-border" />

                    {/* 인건비 설정 */}
                    <div>
                        <label className="block text-xs font-bold text-foreground mb-2 flex items-center gap-1">
                            <Users size={14} className="text-primary" /> 인건비 지급 여부
                        </label>
                        
                        <div className="space-y-2.5">
                            <label className="flex items-start gap-3 p-3 border border-border rounded-xl cursor-pointer hover:bg-muted/40 transition-colors">
                                <input 
                                    type="checkbox" 
                                    checked={profile.hasEmployees}
                                    onChange={(e) => setProfile(p => ({ ...p, hasEmployees: e.target.checked }))}
                                    className="mt-0.5 w-4 h-4 accent-primary"
                                />
                                <div>
                                    <p className="text-xs font-bold text-foreground">정규직 / 알바 (근로소득)</p>
                                    <p className="text-2xs text-muted-foreground">4대보험 가입자 또는 간이세액 대상자</p>
                                </div>
                            </label>

                            <label className="flex items-start gap-3 p-3 border border-border rounded-xl cursor-pointer hover:bg-muted/40 transition-colors">
                                <input 
                                    type="checkbox" 
                                    checked={profile.hasFreelancers}
                                    onChange={(e) => setProfile(p => ({ ...p, hasFreelancers: e.target.checked }))}
                                    className="mt-0.5 w-4 h-4 accent-primary"
                                />
                                <div>
                                    <p className="text-xs font-bold text-foreground">프리랜서 / 외주 (사업소득 3.3%)</p>
                                    <p className="text-2xs text-muted-foreground">지급액의 3.3%를 원천징수 후 지급하는 대상</p>
                                </div>
                            </label>
                        </div>
                    </div>
                </div>

                <div className="p-4 border-t border-border bg-card flex justify-end gap-2 shrink-0">
                    <button onClick={onClose} className="px-4 py-2.5 text-xs font-bold text-foreground bg-secondary hover:bg-muted border border-border rounded-xl transition-colors cursor-pointer shadow-2xs">
                        취소 / 닫기
                    </button>
                    <button onClick={handleSave} className="px-5 py-2.5 text-xs font-bold text-primary-foreground bg-primary hover:bg-primary/90 rounded-xl flex items-center gap-1.5 shadow-2xs transition-colors cursor-pointer">
                        <Save size={14} /> 설정 저장
                    </button>
                </div>
            </div>
        </div>
    );
}
