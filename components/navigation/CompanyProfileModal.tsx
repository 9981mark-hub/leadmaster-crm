import React, { useState, useRef, useEffect } from 'react';
import {
  X,
  Upload,
  Building2,
  Sparkles,
  Link as LinkIcon,
  Check,
  RotateCcw,
  AlertCircle,
  ShieldCheck,
  Building,
} from 'lucide-react';
import {
  compressCompanyLogoImage,
  COMPANY_LOGO_PRESETS,
  CompanyPresetItem,
} from '../../services/companyLogoService';

interface CompanyProfileModalProps {
  isOpen: boolean;
  onClose: () => void;
  currentOrgName: string;
  currentOrgLogo?: string;
  onSave: (updates: { orgName: string; orgLogo: string | null }) => Promise<void>;
}

export const CompanyProfileModal: React.FC<CompanyProfileModalProps> = ({
  isOpen,
  onClose,
  currentOrgName,
  currentOrgLogo,
  onSave,
}) => {
  const [activeTab, setActiveTab] = useState<'upload' | 'preset' | 'url'>('upload');
  const [orgNameInput, setOrgNameInput] = useState<string>(currentOrgName || '리드마스터 본사');
  const [logoPreview, setLogoPreview] = useState<string | null>(currentOrgLogo || null);
  const [selectedPresetId, setSelectedPresetId] = useState<string | null>(null);
  const [urlInput, setUrlInput] = useState<string>('');
  const [isProcessing, setIsProcessing] = useState<boolean>(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [isDragOver, setIsDragOver] = useState<boolean>(false);

  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (isOpen) {
      setOrgNameInput(currentOrgName || '리드마스터 본사');
      setLogoPreview(currentOrgLogo || null);
      setSelectedPresetId(null);
      setUrlInput('');
      setErrorMsg(null);
      setIsProcessing(false);
      setActiveTab('upload');
    }
  }, [isOpen, currentOrgName, currentOrgLogo]);

  if (!isOpen) return null;

  // 1. 파일 선택 및 캔버스 자동 리사이징 & 압축
  const handleFileChange = async (file: File) => {
    setErrorMsg(null);
    setIsProcessing(true);
    try {
      const compressedDataUrl = await compressCompanyLogoImage(file, 400, 0.90);
      setLogoPreview(compressedDataUrl);
      setSelectedPresetId(null);
    } catch (err: any) {
      setErrorMsg(err.message || '사진 파일을 처리하지 못했습니다.');
    } finally {
      setIsProcessing(false);
    }
  };

  const onFileInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) handleFileChange(file);
    e.target.value = '';
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragOver(false);
    const file = e.dataTransfer.files?.[0];
    if (file) handleFileChange(file);
  };

  // 2. 프리셋 선택
  const handleSelectPreset = (preset: CompanyPresetItem) => {
    setSelectedPresetId(preset.id);
    setLogoPreview(preset.dataUrl);
    setErrorMsg(null);
  };

  // 3. 웹 URL 적용
  const handleApplyUrl = () => {
    if (!urlInput.trim()) {
      setErrorMsg('이미지 URL을 입력해주세요.');
      return;
    }
    if (!urlInput.startsWith('http://') && !urlInput.startsWith('https://') && !urlInput.startsWith('data:')) {
      setErrorMsg('http:// 또는 https:// 로 시작하는 웹 링크를 입력해주세요.');
      return;
    }
    setLogoPreview(urlInput.trim());
    setSelectedPresetId(null);
    setErrorMsg(null);
  };

  // 4. 저장 실행
  const handleSave = async () => {
    const trimmedName = orgNameInput.trim();
    if (!trimmedName) {
      setErrorMsg('회사명(상호)을 입력해주세요.');
      return;
    }

    setIsProcessing(true);
    try {
      await onSave({
        orgName: trimmedName,
        orgLogo: logoPreview,
      });
      onClose();
    } catch (err: any) {
      setErrorMsg('회사 정보 저장 중 오류가 발생했습니다.');
    } finally {
      setIsProcessing(false);
    }
  };

  // 5. 기본 빌딩 아이콘으로 초기화
  const handleResetToDefault = () => {
    setLogoPreview(null);
    setSelectedPresetId(null);
    setErrorMsg(null);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs animate-in fade-in duration-200">
      <div className="relative w-full max-w-lg bg-white dark:bg-gray-800 rounded-3xl shadow-2xl border border-gray-100 dark:border-gray-700 overflow-hidden flex flex-col max-h-[90vh]">
        {/* Header */}
        <div className="px-6 py-4 border-b border-gray-150 dark:border-gray-700/80 flex items-center justify-between bg-gray-50/70 dark:bg-gray-900/40">
          <div className="flex items-center gap-2">
            <div className="p-2 rounded-xl bg-indigo-100 dark:bg-indigo-950/60 text-indigo-600 dark:text-indigo-400">
              <Building2 size={18} />
            </div>
            <div>
              <div className="flex items-center gap-1.5">
                <h3 className="text-sm font-black text-gray-900 dark:text-gray-100">회사(워크스페이스) 프로필 설정</h3>
                <span className="px-1.5 py-0.2 rounded text-[10px] font-bold bg-amber-100 text-amber-800 dark:bg-amber-950/60 dark:text-amber-300">
                  대표 전용
                </span>
              </div>
              <p className="text-[11px] text-gray-500 dark:text-gray-400">사이드바 및 상단 헤더에 노출되는 공식 회사명과 대표 사진을 설정합니다.</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-xl text-gray-400 hover:text-gray-600 dark:hover:text-gray-200 hover:bg-gray-200/60 dark:hover:bg-gray-700 transition-colors"
          >
            <X size={18} />
          </button>
        </div>

        {/* Content Body */}
        <div className="flex-1 overflow-y-auto p-6 space-y-6">
          {/* Live Preview Card (사이드바 반영 형태 미리보기) */}
          <div className="space-y-1.5">
            <label className="block text-xs font-bold text-gray-700 dark:text-gray-300">
              사이드바 노출 실시간 미리보기
            </label>
            <div className="p-3 rounded-2xl bg-slate-50 dark:bg-slate-900/60 border border-slate-200 dark:border-slate-700/80 flex items-center justify-between gap-3 shadow-2xs">
              <div className="flex items-center gap-2.5 min-w-0">
                {logoPreview ? (
                  <img
                    src={logoPreview}
                    alt="Company Logo"
                    className="w-8 h-8 rounded-xl object-cover border border-slate-200 dark:border-slate-700 shrink-0 shadow-2xs"
                  />
                ) : (
                  <div className="w-8 h-8 rounded-xl bg-blue-600/10 dark:bg-blue-400/20 text-blue-600 dark:text-blue-400 flex items-center justify-center shrink-0 border border-blue-200/50 dark:border-blue-800/50">
                    <Building2 size={16} />
                  </div>
                )}
                <div className="min-w-0">
                  <p className="text-xs font-bold text-slate-900 dark:text-slate-100 truncate leading-tight">
                    {orgNameInput.trim() || '회사명을 입력하세요'}
                  </p>
                  <p className="text-[10px] text-slate-400 leading-tight mt-0.5">
                    멀티테넌트 워크스페이스
                  </p>
                </div>
              </div>
              <span className="shrink-0 rounded-full px-2 py-0.5 text-[10px] font-bold bg-indigo-100 text-indigo-700 dark:bg-indigo-950/60 dark:text-indigo-300">
                대표
              </span>
            </div>
          </div>

          {/* 에러 메시지 안내 */}
          {errorMsg && (
            <div className="p-3 rounded-xl bg-red-50 dark:bg-red-950/40 border border-red-200 dark:border-red-900/60 text-red-700 dark:text-red-300 text-xs flex items-center gap-2">
              <AlertCircle size={16} className="shrink-0" />
              <span>{errorMsg}</span>
            </div>
          )}

          {/* Form: 회사명 입력 */}
          <div className="space-y-1.5">
            <label className="block text-xs font-bold text-gray-700 dark:text-gray-300">
              회사명 / 상호 <span className="text-red-500">*</span>
            </label>
            <div className="relative">
              <input
                type="text"
                value={orgNameInput}
                onChange={(e) => setOrgNameInput(e.target.value)}
                placeholder="예: 법무법인 한결, 리드마스터 본사, 신안 파트너스"
                className="w-full p-2.5 pl-9 text-xs font-bold border border-gray-200 dark:border-gray-700 rounded-xl focus:ring-2 focus:ring-indigo-500 outline-none bg-white dark:bg-gray-800 text-gray-900 dark:text-white"
              />
              <Building className="absolute left-3 top-2.5 text-gray-400" size={15} />
            </div>
            <p className="text-[11px] text-gray-400">
              사이드바, 상단 앱바, 스크립트 변수 및 보고서에 표시되는 공식 상호명입니다.
            </p>
          </div>

          {/* Form: 회사 사진 / 로고 탭 */}
          <div className="space-y-3 pt-2 border-t border-gray-150 dark:border-gray-700/80">
            <div className="flex items-center justify-between">
              <label className="block text-xs font-bold text-gray-700 dark:text-gray-300">
                회사 대표 사진 / 로고 설정
              </label>
              {logoPreview && (
                <button
                  type="button"
                  onClick={handleResetToDefault}
                  className="text-[11px] font-semibold text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200 flex items-center gap-1 transition-colors"
                >
                  <RotateCcw size={11} /> 기본 아이콘으로 초기화
                </button>
              )}
            </div>

            {/* Tab Menu */}
            <div className="flex border-b border-gray-200 dark:border-gray-700 text-xs font-bold">
              <button
                type="button"
                onClick={() => setActiveTab('upload')}
                className={`flex-1 pb-2 flex items-center justify-center gap-1.5 transition-all border-b-2 ${
                  activeTab === 'upload'
                    ? 'border-indigo-600 text-indigo-600 dark:text-indigo-400'
                    : 'border-transparent text-gray-400 hover:text-gray-600 dark:hover:text-gray-300'
                }`}
              >
                <Upload size={13} /> 사진 직접 업로드
              </button>
              <button
                type="button"
                onClick={() => setActiveTab('preset')}
                className={`flex-1 pb-2 flex items-center justify-center gap-1.5 transition-all border-b-2 ${
                  activeTab === 'preset'
                    ? 'border-indigo-600 text-indigo-600 dark:text-indigo-400'
                    : 'border-transparent text-gray-400 hover:text-gray-600 dark:hover:text-gray-300'
                }`}
              >
                <Sparkles size={13} /> 비즈니스 심볼 프리셋
              </button>
              <button
                type="button"
                onClick={() => setActiveTab('url')}
                className={`flex-1 pb-2 flex items-center justify-center gap-1.5 transition-all border-b-2 ${
                  activeTab === 'url'
                    ? 'border-indigo-600 text-indigo-600 dark:text-indigo-400'
                    : 'border-transparent text-gray-400 hover:text-gray-600 dark:hover:text-gray-300'
                }`}
              >
                <LinkIcon size={13} /> 로고 웹 주소
              </button>
            </div>

            {/* Tab 1: 파일 업로드 */}
            {activeTab === 'upload' && (
              <div className="space-y-3">
                <input
                  type="file"
                  ref={fileInputRef}
                  onChange={onFileInputChange}
                  accept="image/png, image/jpeg, image/jpg, image/webp, image/svg+xml, image/gif"
                  className="hidden"
                />

                <div
                  onDragOver={(e) => {
                    e.preventDefault();
                    setIsDragOver(true);
                  }}
                  onDragLeave={() => setIsDragOver(false)}
                  onDrop={handleDrop}
                  onClick={() => fileInputRef.current?.click()}
                  className={`p-6 border-2 border-dashed rounded-2xl flex flex-col items-center justify-center cursor-pointer transition-all ${
                    isDragOver
                      ? 'border-indigo-500 bg-indigo-50/50 dark:bg-indigo-950/30 scale-[1.01]'
                      : 'border-gray-250 dark:border-gray-700 hover:border-indigo-400 dark:hover:border-indigo-500 bg-gray-50/50 dark:bg-gray-850/50'
                  }`}
                >
                  <div className="p-3 rounded-2xl bg-indigo-100 dark:bg-indigo-900/40 text-indigo-600 dark:text-indigo-300 mb-2.5">
                    <Upload size={22} />
                  </div>
                  <p className="text-xs font-bold text-gray-800 dark:text-gray-200">
                    클릭하여 회사 간판 사진/로고 선택 또는 드래그
                  </p>
                  <p className="text-[11px] text-gray-400 dark:text-gray-500 mt-1">
                    PNG, JPG, SVG, WEBP 지원 (400x400 정사각형 자동 최적화)
                  </p>
                </div>
              </div>
            )}

            {/* Tab 2: 비즈니스 심볼 프리셋 */}
            {activeTab === 'preset' && (
              <div className="space-y-3">
                <p className="text-[11px] text-gray-500 dark:text-gray-400">
                  준비된 로고가 없어도 전문직에 어울리는 대표 심볼을 1클릭으로 적용할 수 있습니다:
                </p>
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5">
                  {COMPANY_LOGO_PRESETS.map((preset) => {
                    const isSelected = selectedPresetId === preset.id || logoPreview === preset.dataUrl;
                    return (
                      <div
                        key={preset.id}
                        onClick={() => handleSelectPreset(preset)}
                        className={`relative p-2.5 rounded-2xl border-2 flex flex-col items-center text-center cursor-pointer transition-all ${
                          isSelected
                            ? 'border-indigo-600 bg-indigo-50/60 dark:bg-indigo-950/40 shadow-xs scale-102'
                            : 'border-gray-150 dark:border-gray-700 hover:border-indigo-300 dark:hover:border-gray-600 bg-white dark:bg-gray-800'
                        }`}
                      >
                        {isSelected && (
                          <div className="absolute top-1.5 right-1.5 w-4 h-4 rounded-full bg-indigo-600 text-white flex items-center justify-center shadow-xs">
                            <Check size={10} strokeWidth={3} />
                          </div>
                        )}
                        <img
                          src={preset.dataUrl}
                          alt={preset.name}
                          className="w-12 h-12 rounded-xl shadow-xs object-cover mb-1.5"
                        />
                        <span className="text-[11px] font-bold text-gray-800 dark:text-gray-200 truncate w-full">
                          {preset.name}
                        </span>
                        <span className="text-[9.5px] text-gray-400 dark:text-gray-500 truncate w-full">
                          {preset.category}
                        </span>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}

            {/* Tab 3: 웹 이미지 링크 */}
            {activeTab === 'url' && (
              <div className="space-y-2.5">
                <label className="block text-xs font-bold text-gray-700 dark:text-gray-300">
                  로고 이미지 웹 주소 (URL)
                </label>
                <div className="flex gap-2">
                  <input
                    type="text"
                    value={urlInput}
                    onChange={(e) => setUrlInput(e.target.value)}
                    placeholder="https://example.com/company-logo.png"
                    className="flex-1 p-2.5 text-xs rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 text-gray-900 dark:text-white focus:ring-2 focus:ring-indigo-500 outline-none"
                  />
                  <button
                    type="button"
                    onClick={handleApplyUrl}
                    className="px-3 py-2 text-xs font-bold rounded-xl bg-gray-100 hover:bg-gray-200 dark:bg-gray-700 dark:hover:bg-gray-600 text-gray-800 dark:text-gray-200 transition-colors"
                  >
                    미리보기
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Footer Actions */}
        <div className="px-6 py-4 border-t border-gray-150 dark:border-gray-700/80 bg-gray-50/70 dark:bg-gray-900/40 flex items-center justify-between">
          <div className="flex items-center gap-1.5 text-xs text-gray-400">
            <ShieldCheck size={14} className="text-emerald-500" />
            <span>전사 상담원에게 실시간 즉시 반영</span>
          </div>
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={onClose}
              disabled={isProcessing}
              className="px-4 py-2 text-xs font-bold rounded-xl text-gray-600 dark:text-gray-400 hover:bg-gray-200/60 dark:hover:bg-gray-700 transition-colors"
            >
              취소
            </button>
            <button
              type="button"
              onClick={handleSave}
              disabled={isProcessing}
              className="inline-flex items-center gap-1.5 px-5 py-2 text-xs font-bold rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white shadow-md shadow-indigo-500/20 disabled:opacity-50 transition-all cursor-pointer"
            >
              {isProcessing ? (
                <span>저장 중...</span>
              ) : (
                <>
                  <Check size={14} strokeWidth={3} />
                  <span>설정 저장 및 전사 반영</span>
                </>
              )}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
