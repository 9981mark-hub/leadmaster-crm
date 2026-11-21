import React, { useRef } from 'react';
import { SettingsCard } from '../SettingsCard';
import { SettingsRow } from '../SettingsRow';
import { Download, Upload, ShieldAlert, Skull, Check, Trash2, RefreshCw, Shield, Lock } from 'lucide-react';

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
                icon={<Download size={18} strokeWidth={1.75} />}
            >
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    {/* 백업 다운로드 */}
                    <div className="p-4 bg-muted/30 rounded-xl border border-border flex flex-col justify-between">
                        <div>
                            <div className="flex items-center gap-2 text-foreground font-semibold text-xs mb-1">
                                <Download size={15} strokeWidth={1.75} className="text-primary" />
                                <span>전체 데이터 백업 다운로드</span>
                            </div>
                            <p className="text-2xs text-muted-foreground mt-1 leading-relaxed">
                                현재 시스템의 모든 데이터(케이스, 거래처, 정산 내역)를 타임스탬프가 포함된 안전한 JSON 파일로 내보냅니다.
                            </p>
                        </div>
                        <button
                            type="button"
                            onClick={onDownloadBackup}
                            className="mt-4 w-full h-9 bg-primary hover:bg-primary/90 text-primary-foreground text-xs font-medium rounded-lg shadow-2xs transition-colors flex items-center justify-center gap-1.5"
                        >
                            <Download size={14} strokeWidth={1.75} />
                            <span>백업 파일 생성 및 다운로드</span>
                        </button>
                    </div>

                    {/* 백업 복원 */}
                    <div className="p-4 bg-muted/30 rounded-xl border border-border flex flex-col justify-between">
                        <div>
                            <div className="flex items-center gap-2 text-foreground font-semibold text-xs mb-1">
                                <Upload size={15} strokeWidth={1.75} className="text-amber-500" />
                                <span>백업 파일 복원 (Restore)</span>
                            </div>
                            <p className="text-2xs text-muted-foreground mt-1 leading-relaxed">
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
                                    className="mt-4 w-full h-9 bg-amber-600 hover:bg-amber-700 text-white text-xs font-medium rounded-lg shadow-2xs transition-colors flex items-center justify-center gap-1.5"
                                >
                                    <Upload size={14} strokeWidth={1.75} />
                                    <span>백업 파일 선택 및 복원</span>
                                </button>
                            </div>
                        ) : (
                            <div className="mt-4 p-2.5 bg-muted/60 rounded-lg text-center border border-border">
                                <p className="text-2xs text-muted-foreground font-medium flex items-center justify-center gap-1">
                                    <Lock size={12} strokeWidth={1.75} />
                                    <span>데이터 복원은 조직 대표(Owner) 전용 권한입니다.</span>
                                </p>
                            </div>
                        )}
                    </div>
                </div>

                <div className="mt-5 pt-4 border-t border-border/60 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
                    <div>
                        <div className="text-xs font-semibold text-foreground flex items-center gap-1.5">
                            <RefreshCw size={13} strokeWidth={1.75} className="text-primary" />
                            <span>로컬 캐시 강제 동기화</span>
                        </div>
                        <p className="text-2xs text-muted-foreground mt-0.5 leading-relaxed">
                            PC와 모바일의 케이스 수량이 일치하지 않을 때, 로컬 캐시를 비우고 서버에서 최신 상태를 강제 수신합니다.
                        </p>
                    </div>
                    <button
                        type="button"
                        onClick={onForceSync}
                        className="h-8 px-3.5 bg-muted hover:bg-muted/80 text-foreground text-xs font-medium rounded-lg border border-border transition-colors shrink-0 flex items-center gap-1.5"
                    >
                        <RefreshCw size={12} strokeWidth={1.75} />
                        <span>캐시 비우고 서버 재동기화</span>
                    </button>
                </div>
            </SettingsCard>

            {/* 2. 회사 전체 리드 목록 개인정보 보호 정책 (대표/총괄 관리자 선택형) */}
            <SettingsCard
                title="리드 목록 대량 유출 방어(마스킹) 정책"
                description="케이스 목록(/cases) 화면에서 일반 상담원에게 고객 전화번호를 마스킹할지, 전체 공개할지 회사의 운영 방침에 맞춰 선택합니다."
                icon={<Shield size={18} strokeWidth={1.75} />}
            >
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <div 
                        onClick={() => onChangeCompanyMaskingPolicy?.('masked')}
                        className={`p-4 rounded-xl border cursor-pointer transition-all ${
                            companyMaskingPolicy === 'masked'
                                ? 'bg-primary/5 border-primary shadow-2xs'
                                : 'bg-muted/20 border-border hover:border-primary/40'
                        }`}
                    >
                        <div className="flex items-center justify-between mb-2">
                            <span className="font-semibold text-xs text-foreground flex items-center gap-1.5">
                                <Lock size={13} strokeWidth={1.75} className="text-primary" />
                                <span>대량 유출 방어 모드 (권장)</span>
                            </span>
                            {companyMaskingPolicy === 'masked' && (
                                <span className="text-2xs font-mono font-medium px-2 py-0.5 rounded bg-primary text-primary-foreground">
                                    적용중
                                </span>
                            )}
                        </div>
                        <p className="text-2xs text-muted-foreground leading-relaxed">
                            일반 상담원의 목록 화면에서 전화번호 가운데가 마스킹(010-****-1234)됩니다. 상세페이지 진입 시에만 온전한 번호가 보이며 열람 감사 로그가 기록됩니다.
                        </p>
                    </div>

                    <div 
                        onClick={() => onChangeCompanyMaskingPolicy?.('unmasked')}
                        className={`p-4 rounded-xl border cursor-pointer transition-all ${
                            companyMaskingPolicy === 'unmasked'
                                ? 'bg-primary/5 border-primary shadow-2xs'
                                : 'bg-muted/20 border-border hover:border-primary/40'
                        }`}
                    >
                        <div className="flex items-center justify-between mb-2">
                            <span className="font-semibold text-xs text-foreground flex items-center gap-1.5">
                                <Shield size={13} strokeWidth={1.75} className="text-primary" />
                                <span>속도 우선 공개 모드</span>
                            </span>
                            {companyMaskingPolicy === 'unmasked' && (
                                <span className="text-2xs font-mono font-medium px-2 py-0.5 rounded bg-primary text-primary-foreground">
                                    적용중
                                </span>
                            )}
                        </div>
                        <p className="text-2xs text-muted-foreground leading-relaxed">
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
                    icon={<ShieldAlert size={18} strokeWidth={1.75} />}
                    danger
                >
                    <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 p-4 bg-destructive/10 rounded-xl border border-destructive/20">
                        <div>
                            <div className="flex items-center gap-2 text-destructive font-semibold text-xs">
                                <Skull size={15} strokeWidth={1.75} />
                                <span>조직 내 모든 데이터 완전 영구 파기</span>
                            </div>
                            <p className="text-2xs text-destructive/80 mt-1 leading-relaxed">
                                케이스, 상담 내역, 녹취 이력, 거래처 설정을 포함한 모든 DB를 영구 삭제합니다.
                            </p>
                        </div>
                        <button
                            type="button"
                            onClick={onOpenEmergencyPurge}
                            className="h-9 px-4 bg-destructive hover:bg-destructive/90 text-destructive-foreground text-xs font-medium rounded-lg shadow-2xs transition-colors shrink-0 flex items-center gap-1.5"
                        >
                            <Trash2 size={13} strokeWidth={1.75} />
                            <span>긴급 데이터 파기 실행</span>
                        </button>
                    </div>
                </SettingsCard>
            )}
        </div>
    );
};
