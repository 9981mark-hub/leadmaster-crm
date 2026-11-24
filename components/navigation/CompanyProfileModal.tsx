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
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-5 bg-background/80 backdrop-blur-xs animate-in fade-in duration-200 overflow-y-auto">
      <div className="relative w-full max-w-lg max-h-[88vh] my-auto flex flex-col rounded-2xl bg-card border border-border shadow-2xl overflow-hidden text-card-foreground">
        {/* Header */}
        <div className="p-4 sm:p-5 border-b border-border flex items-center justify-between bg-card shrink-0">
          <div className="flex items-center gap-2.5">
            <div className="p-2 rounded-lg bg-primary/10 text-primary border border-primary/20 shadow-2xs shrink-0">
              <Building2 size={18} />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h3 className="text-sm font-bold text-foreground">회사(워크스페이스) 프로필 설정</h3>
                <span className="px-2 py-0.5 rounded-md text-2xs font-mono font-bold bg-primary/10 text-primary border border-primary/20">
                  대표 전용
                </span>
              </div>
              <p className="text-xs text-muted-foreground mt-0.5">사이드바 및 상단 헤더에 노출되는 공식 회사명과 대표 사진을 설정합니다.</p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-1.5 rounded-lg text-muted-foreground hover:text-foreground hover:bg-muted transition-colors cursor-pointer"
            title="창 닫기"
          >
            <X size={18} />
          </button>
        </div>

        {/* Content Body */}
        <div className="flex-1 overflow-y-auto p-5 sm:p-6 space-y-5 custom-scrollbar text-xs">
          {/* Live Preview Card (사이드바 반영 형태 미리보기) */}
          <div className="space-y-1.5">
            <label className="block text-xs font-mono font-medium text-foreground">
              사이드바 노출 실시간 미리보기
            </label>
            <div className="p-3 rounded-xl bg-muted/40 border border-border flex items-center justify-between gap-3 shadow-2xs">
              <div className="flex items-center gap-2.5 min-w-0">
                {logoPreview ? (
                  <img
                    src={logoPreview}
                    alt="Company Logo"
                    className="w-8 h-8 rounded-lg object-cover border border-border shrink-0 shadow-2xs"
                  />
                ) : (
                  <div className="w-8 h-8 rounded-lg bg-primary/10 text-primary flex items-center justify-center shrink-0 border border-primary/20">
                    <Building2 size={16} />
                  </div>
                )}
                <div className="min-w-0">
                  <p className="text-xs font-semibold text-foreground truncate leading-tight">
                    {orgNameInput.trim() || '회사명을 입력하세요'}
                  </p>
                </div>
              </div>
              <span className="shrink-0 rounded-md px-2 py-0.5 text-2xs font-mono font-medium bg-primary/10 text-primary border border-primary/20">
                대표
              </span>
            </div>
          </div>

          {/* 에러 메시지 안내 */}
          {errorMsg && (
            <div className="p-3 rounded-lg bg-destructive/10 border border-destructive/20 text-destructive text-xs flex items-center gap-2 font-mono">
              <AlertCircle size={15} className="shrink-0" />
              <span>{errorMsg}</span>
            </div>
          )}

          {/* Form: 회사명 입력 */}
          <div className="space-y-1.5">
            <label className="block text-xs font-mono font-medium text-foreground">
              회사명 / 상호 <span className="text-destructive">*</span>
            </label>
            <div className="relative">
              <input
                type="text"
                value={orgNameInput}
                onChange={(e) => setOrgNameInput(e.target.value)}
                placeholder="예: 법무법인 한결, 리드마스터 본사, 신안 파트너스"
                className="w-full p-2.5 pl-9 text-xs font-mono border border-border rounded-lg focus:ring-1 focus:ring-primary outline-none bg-card text-foreground"
              />
              <Building className="absolute left-3 top-2.5 text-muted-foreground" size={15} />
            </div>
            <p className="text-2xs text-muted-foreground font-mono">
              사이드바, 상단 앱바, 스크립트 변수 및 보고서에 표시되는 공식 상호명입니다.
            </p>
          </div>

          {/* Form: 회사 사진 / 로고 탭 */}
          <div className="space-y-3 pt-2 border-t border-border">
            <div className="flex items-center justify-between">
              <label className="block text-xs font-mono font-medium text-foreground">
                회사 대표 사진 / 로고 설정
              </label>
              {logoPreview && (
                <button
                  type="button"
                  onClick={handleResetToDefault}
                  className="text-xs font-mono text-muted-foreground hover:text-foreground flex items-center gap-1 transition-colors cursor-pointer"
                >
                  <RotateCcw size={11} /> 기본 아이콘으로 초기화
                </button>
              )}
            </div>

            {/* Tab Menu */}
            <div className="flex border-b border-border text-xs font-mono font-medium">
              <button
                type="button"
                onClick={() => setActiveTab('upload')}
                className={`flex-1 pb-2 flex items-center justify-center gap-1.5 transition-all border-b-2 cursor-pointer ${
                  activeTab === 'upload'
                    ? 'border-primary text-primary font-semibold'
                    : 'border-transparent text-muted-foreground hover:text-foreground'
                }`}
              >
                <Upload size={13} /> 사진 직접 업로드
              </button>
              <button
                type="button"
                onClick={() => setActiveTab('preset')}
                className={`flex-1 pb-2 flex items-center justify-center gap-1.5 transition-all border-b-2 cursor-pointer ${
                  activeTab === 'preset'
                    ? 'border-primary text-primary font-semibold'
                    : 'border-transparent text-muted-foreground hover:text-foreground'
                }`}
              >
                <Sparkles size={13} /> 비즈니스 심볼 프리셋
              </button>
              <button
                type="button"
                onClick={() => setActiveTab('url')}
                className={`flex-1 pb-2 flex items-center justify-center gap-1.5 transition-all border-b-2 cursor-pointer ${
                  activeTab === 'url'
                    ? 'border-primary text-primary font-semibold'
                    : 'border-transparent text-muted-foreground hover:text-foreground'
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
                  className={`p-6 border-2 border-dashed rounded-xl flex flex-col items-center justify-center cursor-pointer transition-colors ${
                    isDragOver
                      ? 'border-primary bg-primary/10 ring-1 ring-primary/20'
                      : 'border-border hover:border-primary/50 bg-muted/30'
                  }`}
                >
                  <div className="p-2.5 rounded-lg bg-primary/10 text-primary border border-primary/20 mb-2 shadow-2xs">
                    <Upload size={20} />
                  </div>
                  <p className="text-xs font-mono font-medium text-foreground">
                    클릭하여 회사 간판 사진/로고 선택 또는 드래그
                  </p>
                  <p className="text-2xs text-muted-foreground font-mono mt-1">
                    PNG, JPG, SVG, WEBP 지원 (400x400 정사각형 자동 최적화)
                  </p>
                </div>
              </div>
            )}

            {/* Tab 2: 비즈니스 심볼 프리셋 */}
            {activeTab === 'preset' && (
              <div className="space-y-3">
                <p className="text-2xs font-mono text-muted-foreground">
                  준비된 로고가 없어도 전문직에 어울리는 대표 심볼을 1클릭으로 적용할 수 있습니다:
                </p>
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5">
                  {COMPANY_LOGO_PRESETS.map((preset) => {
                    const isSelected = selectedPresetId === preset.id || logoPreview === preset.dataUrl;
                    return (
                      <div
                        key={preset.id}
                        onClick={() => handleSelectPreset(preset)}
                        className={`relative p-2.5 rounded-xl border flex flex-col items-center text-center cursor-pointer transition-colors shadow-2xs ${
                          isSelected
                            ? 'border-primary bg-primary/10 ring-1 ring-primary/20'
                            : 'border-border hover:border-primary/40 bg-card'
                        }`}
                      >
                        {isSelected && (
                          <div className="absolute top-1.5 right-1.5 w-4 h-4 rounded-full bg-primary text-primary-foreground flex items-center justify-center shadow-2xs">
                            <Check size={10} strokeWidth={2.5} />
                          </div>
                        )}
                        <img
                          src={preset.dataUrl}
                          alt={preset.name}
                          className="w-12 h-12 rounded-lg shadow-2xs object-cover mb-1.5 border border-border"
                        />
                        <span className="text-xs font-medium text-foreground truncate w-full font-mono">
                          {preset.name}
                        </span>
                        <span className="text-2xs text-muted-foreground truncate w-full font-mono">
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
              <div className="space-y-2">
                <label className="block text-xs font-mono font-medium text-foreground">
                  로고 이미지 웹 주소 (URL)
                </label>
                <div className="flex gap-2">
                  <input
                    type="text"
                    value={urlInput}
                    onChange={(e) => setUrlInput(e.target.value)}
                    placeholder="https://example.com/company-logo.png"
                    className="flex-1 p-2 text-xs font-mono rounded-lg border border-border bg-card text-foreground focus:ring-1 focus:ring-primary outline-none"
                  />
                  <button
                    type="button"
                    onClick={handleApplyUrl}
                    className="px-3 py-1.5 text-xs font-mono font-medium rounded-md bg-muted hover:bg-muted/80 text-foreground border border-border transition-colors cursor-pointer"
                  >
                    미리보기
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Footer Actions */}
        <div className="p-4 border-t border-border bg-card flex items-center justify-between shrink-0">
          <div className="flex items-center gap-1.5 text-xs text-muted-foreground hidden sm:flex">
            <ShieldCheck size={14} className="text-primary" />
            <span>전사 상담원에게 실시간 즉시 반영</span>
          </div>
          <div className="flex items-center gap-2 ml-auto">
            <button
              type="button"
              onClick={onClose}
              disabled={isProcessing}
              className="px-4 py-2.5 rounded-xl border border-border bg-secondary hover:bg-muted text-foreground text-xs font-bold transition-colors cursor-pointer shadow-2xs"
            >
              취소
            </button>
            <button
              type="button"
              onClick={handleSave}
              disabled={isProcessing}
              className="inline-flex items-center gap-1.5 px-5 py-2.5 rounded-xl bg-primary hover:bg-primary/90 text-primary-foreground text-xs font-bold shadow-2xs disabled:opacity-50 transition-colors cursor-pointer"
            >
              {isProcessing ? (
                <span>저장 중...</span>
              ) : (
                <>
                  <Check size={14} strokeWidth={2.5} />
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
