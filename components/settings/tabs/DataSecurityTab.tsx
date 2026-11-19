import React, { useRef } from 'react';
import { SettingsCard } from '../SettingsCard';
import { SettingsRow } from '../SettingsRow';
import { Download, Upload, AlertTriangle, ShieldAlert, Skull, CheckCircle, Trash2 } from 'lucide-react';

interface DataSecurityTabProps {
    onDownloadBackup: () => void;
    onRestoreBackup: (e: React.ChangeEvent<HTMLInputElement>) => void;
    onForceSync: () => void;
    isOwner: boolean;
    onOpenEmergencyPurge: () => void;
    companyMaskingPolicy?: 'masked' | 'unmasked';
    onChangeCompanyMaskingPolicy?: (val: 'masked' | 'unmasked') => void;
}

export const DataSecurityTab: React.FC<DataSecurityTabProps> = ({
    onDownloadBackup,
    onRestoreBackup,
    onForceSync,
    isOwner,
    onOpenEmergencyPurge,
    companyMaskingPolicy = 'masked',
    onChangeCompanyMaskingPolicy
}) => {
    const fileInputRef = useRef<HTMLInputElement>(null);

    return (
        <div className="space-y-6">
            {/* 1. 데이터 백업 및 복원 */}
            <SettingsCard
                title="데이터 백업 및 안전 복원"
                description="전체 고객 케이스, 통화 이력, 정산 데이터 등을 안전하게 로컬에 백업하거나 이전 백업본에서 복구합니다."
                icon={<Download size={18} />}
            >
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    {/* 백업 다운로드 */}
                    <div className="p-5 bg-blue-50/50 dark:bg-blue-950/20 rounded-2xl border border-blue-200 dark:border-blue-800/60 flex flex-col justify-between">
                        <div>
                            <div className="flex items-center gap-2 text-blue-700 dark:text-blue-300 font-bold text-sm mb-1">
                                <Download size={16} />
                                <span>전체 데이터 백업 다운로드</span>
                            </div>
                            <p className="text-xs text-gray-500 dark:text-gray-400 mt-1 leading-relaxed">
                                현재 시스템의 모든 데이터(케이스, 거래처, 정산 내역)를 타임스탬프가 포함된 안전한 JSON 파일로 내보냅니다.
                            </p>
                        </div>
                        <button
                            type="button"
                            onClick={onDownloadBackup}
                            className="mt-4 w-full py-2.5 bg-blue-600 hover:bg-blue-700 text-white text-xs font-bold rounded-xl shadow-xs transition-colors flex items-center justify-center gap-1.5"
                        >
                            <Download size={14} /> 백업 파일 생성 및 다운로드
                        </button>
                    </div>

                    {/* 백업 복원 */}
                    <div className="p-5 bg-amber-50/50 dark:bg-amber-950/20 rounded-2xl border border-amber-200 dark:border-amber-800/60 flex flex-col justify-between">
                        <div>
                            <div className="flex items-center gap-2 text-amber-700 dark:text-amber-300 font-bold text-sm mb-1">
                                <Upload size={16} />
                                <span>백업 파일 복원 (Restore)</span>
                            </div>
                            <p className="text-xs text-gray-500 dark:text-gray-400 mt-1 leading-relaxed">
                                이전에 다운로드한 JSON 백업 파일을 선택하여 시스템 데이터를 복구합니다. (기존 데이터가 덮어씌워질 수 있습니다.)
                            </p>
                        </div>
                        {isOwner ? (
                            <div>
                                <input
                                    type="file"
                                    ref={fileInputRef}
                                    accept=".json"
                                    onChange={onRestoreBackup}
                                    className="hidden"
                                />
                                <button
                                    type="button"
                                    onClick={() => fileInputRef.current?.click()}
                                    className="mt-4 w-full py-2.5 bg-amber-600 hover:bg-amber-700 text-white text-xs font-bold rounded-xl shadow-xs transition-colors flex items-center justify-center gap-1.5"
                                >
                                    <Upload size={14} /> 백업 파일 선택 및 복원
                                </button>
                            </div>
                        ) : (
                            <div className="mt-4 p-2.5 bg-gray-100 dark:bg-gray-800 rounded-xl text-center border border-gray-200 dark:border-gray-700">
                                <p className="text-xs text-gray-500 dark:text-gray-400 font-medium">
                                    🔒 데이터 복원은 조직 대표(Owner) 전용 권한입니다.
                                </p>
                            </div>
                        )}
                    </div>
                </div>

                <div className="mt-5 pt-4 border-t border-gray-100 dark:border-gray-700/60 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
                    <div>
                        <div className="text-xs font-bold text-gray-700 dark:text-gray-300">
                            🔄 로컬 캐시 강제 동기화
                        </div>
                        <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">
                            PC와 모바일의 케이스 수량이 일치하지 않을 때, 로컬 캐시를 비우고 서버에서 최신 상태를 강제 수신합니다.
                        </p>
                    </div>
                    <button
                        type="button"
                        onClick={onForceSync}
                        className="px-3.5 py-2 bg-gray-100 hover:bg-gray-200 dark:bg-gray-700 dark:hover:bg-gray-600 text-gray-700 dark:text-gray-200 text-xs font-bold rounded-xl transition-colors shrink-0"
                    >
                        캐시 비우고 서버 재동기화
                    </button>
                </div>
            </SettingsCard>

            {/* 2. 회사 전체 리드 목록 개인정보 보호 정책 (대표/총괄 관리자 선택형) */}
            <SettingsCard
                title="리드 목록 대량 유출 방어(마스킹) 정책"
                description="케이스 목록(/cases) 화면에서 일반 상담원에게 고객 전화번호를 마스킹할지, 전체 공개할지 회사의 운영 방침에 맞춰 선택합니다."
                icon={<ShieldAlert size={18} />}
            >
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <div 
                        onClick={() => onChangeCompanyMaskingPolicy?.('masked')}
                        className={`p-4 rounded-2xl border cursor-pointer transition-all ${
                            companyMaskingPolicy === 'masked'
                                ? 'bg-indigo-50/60 dark:bg-indigo-950/40 border-indigo-500 ring-2 ring-indigo-500/20'
                                : 'bg-white dark:bg-gray-800 border-gray-200 dark:border-gray-700 hover:border-gray-300'
                        }`}
                    >
                        <div className="flex items-center justify-between mb-2">
                            <span className="font-bold text-sm text-gray-900 dark:text-white flex items-center gap-1.5">
                                🛡️ 대량 유출 방어 모드 (권장)
                            </span>
                            {companyMaskingPolicy === 'masked' && (
                                <span className="text-xs font-bold px-2 py-0.5 rounded-full bg-indigo-600 text-white">적용중</span>
                            )}
                        </div>
                        <p className="text-xs text-gray-500 dark:text-gray-400 leading-relaxed">
                            일반 상담원의 목록 화면에서 전화번호 가운데가 마스킹(010-****-1234)됩니다. 상세페이지 진입 시에만 온전한 번호가 보이며 열람 감사 로그가 기록됩니다.
                        </p>
                    </div>

                    <div 
                        onClick={() => onChangeCompanyMaskingPolicy?.('unmasked')}
                        className={`p-4 rounded-2xl border cursor-pointer transition-all ${
                            companyMaskingPolicy === 'unmasked'
                                ? 'bg-emerald-50/60 dark:bg-emerald-950/40 border-emerald-500 ring-2 ring-emerald-500/20'
                                : 'bg-white dark:bg-gray-800 border-gray-200 dark:border-gray-700 hover:border-gray-300'
                        }`}
                    >
                        <div className="flex items-center justify-between mb-2">
                            <span className="font-bold text-sm text-gray-900 dark:text-white flex items-center gap-1.5">
                                🔓 속도 우선 공개 모드
                            </span>
                            {companyMaskingPolicy === 'unmasked' && (
                                <span className="text-xs font-bold px-2 py-0.5 rounded-full bg-emerald-600 text-white">적용중</span>
                            )}
                        </div>
                        <p className="text-xs text-gray-500 dark:text-gray-400 leading-relaxed">
                            일반 상담원도 목록 화면에서 전화번호 전체(010-1234-5678)를 즉시 확인하고 바로 다이얼러를 실행할 수 있습니다. (상담 속도 및 통화량 우선 센터)
                        </p>
                    </div>
                </div>
            </SettingsCard>

            {/* 3. 위험 구역 (Danger Zone) - 조직 소유자 전용 */}
            {isOwner && (
                <SettingsCard
                    title="위험 구역 (Danger Zone)"
                    description="조직 소유자(Owner) 전용 긴급 데이터 완전 파기 기능입니다. 복구가 불가능하므로 극도로 신중하게 사용해야 합니다."
                    icon={<ShieldAlert size={18} />}
                    danger
                >
                    <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 p-4 bg-rose-50 dark:bg-rose-950/30 rounded-xl border border-rose-200 dark:border-rose-900/50">
                        <div>
                            <div className="flex items-center gap-2 text-rose-700 dark:text-rose-300 font-bold text-sm">
                                <Skull size={16} />
                                <span>조직 내 모든 데이터 완전 영구 파기</span>
                            </div>
                            <p className="text-xs text-rose-600/80 dark:text-rose-400/80 mt-1">
                                케이스, 상담 내역, 녹취 이력, 거래처 설정을 포함한 모든 DB를 영구 삭제합니다.
                            </p>
                        </div>
                        <button
                            type="button"
                            onClick={onOpenEmergencyPurge}
                            className="px-4 py-2.5 bg-rose-600 hover:bg-rose-700 text-white text-xs font-bold rounded-xl shadow-xs transition-colors shrink-0 flex items-center gap-1.5"
                        >
                            <Trash2 size={14} /> 긴급 데이터 파기 실행
                        </button>
                    </div>
                </SettingsCard>
            )}
        </div>
    );
};
