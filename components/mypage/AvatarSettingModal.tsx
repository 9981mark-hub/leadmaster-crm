import React, { useState, useRef, useEffect } from 'react';
import {
  X,
  Upload,
  Camera,
  RotateCcw,
  Sparkles,
  Link as LinkIcon,
  Check,
  Trash2,
  Image as ImageIcon,
  AlertCircle,
} from 'lucide-react';
import { compressAvatarImage, PRESET_AVATARS, AvatarPresetItem } from '../../services/avatarService';

interface AvatarSettingModalProps {
  isOpen: boolean;
  onClose: () => void;
  currentPicture?: string;
  googlePicture?: string;
  userName?: string;
  onSavePicture: (newPictureUrl: string | null) => Promise<void>;
}

export const AvatarSettingModal: React.FC<AvatarSettingModalProps> = ({
  isOpen,
  onClose,
  currentPicture,
  googlePicture,
  userName = '사용자',
  onSavePicture,
}) => {
  const [activeTab, setActiveTab] = useState<'upload' | 'preset' | 'url'>('upload');
  const [previewUrl, setPreviewUrl] = useState<string | null>(currentPicture || googlePicture || null);
  const [selectedPresetId, setSelectedPresetId] = useState<string | null>(null);
  const [urlInput, setUrlInput] = useState<string>('');
  const [isProcessing, setIsProcessing] = useState<boolean>(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [isDragOver, setIsDragOver] = useState<boolean>(false);

  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (isOpen) {
      setPreviewUrl(currentPicture || googlePicture || null);
      setSelectedPresetId(null);
      setUrlInput('');
      setErrorMsg(null);
      setIsProcessing(false);
      setActiveTab('upload');
    }
  }, [isOpen, currentPicture, googlePicture]);

  if (!isOpen) return null;

  // 1. 파일 선택 및 캔버스 자동 리사이즈 압축
  const handleFileChange = async (file: File) => {
    setErrorMsg(null);
    setIsProcessing(true);
    try {
      const compressedDataUrl = await compressAvatarImage(file, 400, 0.88);
      setPreviewUrl(compressedDataUrl);
      setSelectedPresetId(null);
    } catch (err: any) {
      setErrorMsg(err.message || '사진을 처리하지 못했습니다.');
    } finally {
      setIsProcessing(false);
    }
  };

  const onFileInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) handleFileChange(file);
    e.target.value = '';
  };

  // 드래그 앤 드롭
  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragOver(false);
    const file = e.dataTransfer.files?.[0];
    if (file) handleFileChange(file);
  };

  // 2. 프리셋 선택
  const handleSelectPreset = (preset: AvatarPresetItem) => {
    setSelectedPresetId(preset.id);
    setPreviewUrl(preset.dataUrl);
    setErrorMsg(null);
  };

  // 3. 웹 URL 적용
  const handleApplyUrl = () => {
    if (!urlInput.trim()) {
      setErrorMsg('이미지 URL을 입력해주세요.');
      return;
    }
    if (!urlInput.startsWith('http://') && !urlInput.startsWith('https://') && !urlInput.startsWith('data:')) {
      setErrorMsg('http:// 또는 https:// 로 시작하는 올바른 웹 링크를 입력해주세요.');
      return;
    }
    setPreviewUrl(urlInput.trim());
    setSelectedPresetId(null);
    setErrorMsg(null);
  };

  // 4. 저장 실행
  const handleSave = async () => {
    setIsProcessing(true);
    try {
      await onSavePicture(previewUrl);
      onClose();
    } catch (err: any) {
      setErrorMsg('사진 저장 중 오류가 발생했습니다.');
    } finally {
      setIsProcessing(false);
    }
  };

  // 5. 구글 원본 복원
  const handleRestoreGoogle = async () => {
    setIsProcessing(true);
    try {
      await onSavePicture(null); // null 전달 시 로컬스토리지 삭제 및 구글 계정 사진으로 복구
      onClose();
    } catch (err: any) {
      setErrorMsg('구글 사진 복원 중 오류가 발생했습니다.');
    } finally {
      setIsProcessing(false);
    }
  };

  // 6. 이미지 완전 삭제 (이니셜만 사용)
  const handleRemovePicture = async () => {
    if (!confirm('대표 이미지를 삭제하고 기본 이니셜 아바타를 사용하시겠습니까?')) return;
    setIsProcessing(true);
    try {
      await onSavePicture('NONE');
      onClose();
    } catch (err: any) {
      setErrorMsg('이미지 삭제 중 오류가 발생했습니다.');
    } finally {
      setIsProcessing(false);
    }
  };

  const isCurrentUsingCustom = !!currentPicture && currentPicture !== googlePicture;
  const isGoogleAvailable = !!googlePicture;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-5 bg-background/80 backdrop-blur-xs animate-in fade-in duration-200 overflow-y-auto">
      <div className="relative w-full max-w-lg max-h-[88vh] my-auto flex flex-col rounded-2xl bg-card border border-border shadow-2xl overflow-hidden text-card-foreground">
        {/* Header */}
        <div className="p-4 sm:p-5 border-b border-border flex items-center justify-between bg-card shrink-0">
          <div className="flex items-center gap-2.5">
            <div className="p-2 rounded-xl bg-primary/10 border border-primary/20 text-primary shrink-0">
              <Camera size={18} />
            </div>
            <div>
              <h3 className="text-sm font-bold text-foreground">대표 프로필 이미지 설정</h3>
              <p className="text-xs text-muted-foreground">마이페이지 및 상단 헤더에 노출되는 내 프로필 사진을 변경합니다.</p>
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
          {/* Live Preview Display */}
          <div className="flex flex-col items-center justify-center p-4 bg-linear-to-b from-gray-50 to-white dark:from-gray-850 dark:to-gray-800 rounded-2xl border border-gray-150 dark:border-gray-700/60">
            <div className="relative">
              {previewUrl && previewUrl !== 'NONE' ? (
                <img
                  src={previewUrl}
                  alt="Avatar Preview"
                  className="w-24 h-24 rounded-2xl border-4 border-white dark:border-gray-700 shadow-lg object-cover"
                />
              ) : (
                <div className="w-24 h-24 rounded-2xl bg-linear-to-br from-blue-600 to-indigo-600 text-white flex items-center justify-center font-black text-3xl shadow-lg border-4 border-white dark:border-gray-700">
                  {userName.charAt(0) || 'U'}
                </div>
              )}
            </div>

            <div className="mt-3 flex items-center gap-2">
              <span className="text-xs font-bold text-gray-800 dark:text-gray-200">{userName}</span>
              {previewUrl === googlePicture && isGoogleAvailable ? (
                <span className="px-2 py-0.5 rounded-full text-xs font-bold bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-300 border border-gray-200 dark:border-gray-600">
                  🌐 구글 계정 원본
                </span>
              ) : previewUrl && previewUrl !== 'NONE' ? (
                <span className="px-2 py-0.5 rounded-full text-xs font-bold bg-blue-50 dark:bg-blue-950/60 text-blue-600 dark:text-blue-400 border border-blue-200 dark:border-blue-800">
                  ✨ 새 대표 이미지 선택됨
                </span>
              ) : (
                <span className="px-2 py-0.5 rounded-full text-xs font-bold bg-amber-50 dark:bg-amber-950/60 text-amber-700 dark:text-amber-300 border border-amber-200 dark:border-amber-800">
                  🔤 이니셜 기본 아바타
                </span>
              )}
            </div>
          </div>

          {/* 에러 메시지 안내 */}
          {errorMsg && (
            <div className="p-3 rounded-xl bg-red-50 dark:bg-red-950/40 border border-red-200 dark:border-red-900/60 text-red-700 dark:text-red-300 text-xs flex items-center gap-2">
              <AlertCircle size={16} className="shrink-0" />
              <span>{errorMsg}</span>
            </div>
          )}

          {/* Tab Menu */}
          <div className="flex border-b border-gray-200 dark:border-gray-700 text-xs font-bold">
            <button
              type="button"
              onClick={() => setActiveTab('upload')}
              className={`flex-1 pb-2.5 flex items-center justify-center gap-1.5 transition-all border-b-2 ${
                activeTab === 'upload'
                  ? 'border-blue-600 text-blue-600 dark:text-blue-400'
                  : 'border-transparent text-gray-500 dark:text-gray-400 hover:text-gray-600 dark:hover:text-gray-600 dark:text-gray-300'
              }`}
            >
              <Upload size={14} /> 내 사진 직접 업로드
            </button>
            <button
              type="button"
              onClick={() => setActiveTab('preset')}
              className={`flex-1 pb-2.5 flex items-center justify-center gap-1.5 transition-all border-b-2 ${
                activeTab === 'preset'
                  ? 'border-blue-600 text-blue-600 dark:text-blue-400'
                  : 'border-transparent text-gray-500 dark:text-gray-400 hover:text-gray-600 dark:hover:text-gray-600 dark:text-gray-300'
              }`}
            >
              <Sparkles size={14} /> 비즈니스 아바타 프리셋
            </button>
            <button
              type="button"
              onClick={() => setActiveTab('url')}
              className={`flex-1 pb-2.5 flex items-center justify-center gap-1.5 transition-all border-b-2 ${
                activeTab === 'url'
                  ? 'border-blue-600 text-blue-600 dark:text-blue-400'
                  : 'border-transparent text-gray-500 dark:text-gray-400 hover:text-gray-600 dark:hover:text-gray-600 dark:text-gray-300'
              }`}
            >
              <LinkIcon size={14} /> 이미지 웹 링크
            </button>
          </div>

          {/* Tab 1: 파일 업로드 */}
          {activeTab === 'upload' && (
            <div className="space-y-4">
              <input
                type="file"
                ref={fileInputRef}
                onChange={onFileInputChange}
                accept="image/png, image/jpeg, image/jpg, image/webp, image/gif"
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
                    ? 'border-blue-500 bg-blue-50/50 dark:bg-blue-950/30 scale-[1.01]'
                    : 'border-gray-250 dark:border-gray-700 hover:border-blue-400 dark:hover:border-blue-500 bg-gray-50/50 dark:bg-gray-850/50'
                }`}
              >
                <div className="p-3.5 rounded-2xl bg-blue-100 dark:bg-blue-900/40 text-blue-600 dark:text-blue-300 mb-3">
                  <Upload size={24} />
                </div>
                <p className="text-xs font-bold text-gray-800 dark:text-gray-200">
                  클릭하여 사진 파일 선택 또는 여기에 드래그
                </p>
                <p className="text-xs text-gray-500 dark:text-gray-400 dark:text-gray-500 mt-1">
                  JPG, PNG, WEBP 지원 (자동 정사각형 크롭 & 400x400 압축)
                </p>
              </div>
            </div>
          )}

          {/* Tab 2: 비즈니스 아바타 프리셋 */}
          {activeTab === 'preset' && (
            <div className="space-y-3">
              <p className="text-xs text-gray-500 dark:text-gray-400">
                실제 CRM 업무에 최적화된 고품질 비즈니스 캐릭터 아바타를 선택하세요:
              </p>
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                {PRESET_AVATARS.map((preset) => {
                  const isSelected = selectedPresetId === preset.id || previewUrl === preset.dataUrl;
                  return (
                    <div
                      key={preset.id}
                      onClick={() => handleSelectPreset(preset)}
                      className={`relative p-2.5 rounded-2xl border-2 flex flex-col items-center text-center cursor-pointer transition-all ${
                        isSelected
                          ? 'border-blue-600 bg-blue-50/60 dark:bg-blue-950/40 shadow-sm scale-102'
                          : 'border-gray-150 dark:border-gray-700 hover:border-blue-300 dark:hover:border-gray-600 bg-white dark:bg-gray-800'
                      }`}
                    >
                      {isSelected && (
                        <div className="absolute top-1.5 right-1.5 w-5 h-5 rounded-full bg-blue-600 text-white flex items-center justify-center shadow-xs">
                          <Check size={12} strokeWidth={3} />
                        </div>
                      )}
                      <img
                        src={preset.dataUrl}
                        alt={preset.name}
                        className="w-14 h-14 rounded-xl shadow-xs object-cover mb-2"
                      />
                      <span className="text-xs font-bold text-gray-800 dark:text-gray-200 truncate w-full">
                        {preset.name}
                      </span>
                      <span className="text-xs text-gray-500 dark:text-gray-400 dark:text-gray-500 truncate w-full mt-0.5">
                        {preset.roleHint}
                      </span>
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {/* Tab 3: 웹 이미지 링크 */}
          {activeTab === 'url' && (
            <div className="space-y-3">
              <label className="block text-xs font-bold text-gray-700 dark:text-gray-300">
                이미지 주소 (URL)
              </label>
              <div className="flex gap-2">
                <input
                  type="text"
                  value={urlInput}
                  onChange={(e) => setUrlInput(e.target.value)}
                  placeholder="https://example.com/profile.jpg"
                  className="flex-1 p-2.5 text-xs rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 text-gray-900 dark:text-white focus:ring-2 focus:ring-blue-500 outline-none"
                />
                <button
                  type="button"
                  onClick={handleApplyUrl}
                  className="px-3 py-2 text-xs font-bold rounded-xl bg-gray-100 hover:bg-gray-200 dark:bg-gray-700 dark:hover:bg-gray-600 text-gray-800 dark:text-gray-200 transition-colors"
                >
                  미리보기
                </button>
              </div>
              <p className="text-xs text-gray-500 dark:text-gray-400">
                웹상에 호스팅된 이미지 링크를 직접 지정하여 대표 이미지로 사용할 수 있습니다.
              </p>
            </div>
          )}

          {/* 보조 관리 옵션: 구글 원본 복원 및 이니셜 전환 */}
          <div className="pt-4 border-t border-gray-150 dark:border-gray-700/80 flex flex-wrap items-center justify-between gap-2 text-xs">
            {isGoogleAvailable && (
              <button
                type="button"
                onClick={handleRestoreGoogle}
                disabled={isProcessing}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl font-bold text-gray-600 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors"
                title="Google 계정에 설정된 원래 프로필 사진으로 복구합니다."
              >
                <RotateCcw size={14} className="text-gray-500 dark:text-gray-400" />
                <span>구글 계정 원래 사진으로 복원</span>
              </button>
            )}

            <button
              type="button"
              onClick={handleRemovePicture}
              disabled={isProcessing}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl font-medium text-red-600 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-950/40 transition-colors ml-auto"
            >
              <Trash2 size={13} />
              <span>사진 삭제 (이니셜 아바타)</span>
            </button>
          </div>
        </div>

        {/* Footer Actions */}
        <div className="p-4 border-t border-border bg-card flex items-center justify-end gap-2 shrink-0">
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
            className="inline-flex items-center gap-1.5 px-5 py-2.5 text-xs font-bold rounded-xl bg-primary hover:bg-primary/90 text-primary-foreground shadow-2xs disabled:opacity-50 transition-all cursor-pointer"
          >
            {isProcessing ? (
              <span>저장 중...</span>
            ) : (
              <>
                <Check size={14} strokeWidth={2.5} />
                <span>이 사진으로 대표이미지 저장</span>
              </>
            )}
          </button>
        </div>
      </div>
    </div>
  );
};
