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
}

export const DataSecurityTab: React.FC<DataSecurityTabProps> = ({
    onDownloadBackup,
    onRestoreBackup,
    onForceSync,
    isOwner,
    onOpenEmergencyPurge
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
                    </div>
                </div>

                <div className="mt-5 pt-4 border-t border-gray-100 dark:border-gray-700/60 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
                    <div>
                        <div className="text-xs font-bold text-gray-700 dark:text-gray-300">
                            🔄 로컬 캐시 강제 동기화
                        </div>
                        <p className="text-[11px] text-gray-400 mt-0.5">
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

            {/* 2. 위험 구역 (Danger Zone) - 조직 소유자 전용 */}
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
