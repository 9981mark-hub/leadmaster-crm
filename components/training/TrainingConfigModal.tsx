import React, { useState } from 'react';
import {
  CompanyTrainingConfig,
  getCompanyTrainingConfig,
  saveCompanyTrainingConfig,
  PRESETS_CONFIG,
  interpolateOpeningScript,
  DEFAULT_TRAINING_CONFIG,
} from '../../services/trainingService';
import {
  Settings,
  X,
  Building2,
  Check,
  RotateCcw,
  Sparkles,
  ShieldAlert,
  ShieldCheck,
  PhoneCall,
  Save,
  HelpCircle,
  Eye,
  Plus,
} from 'lucide-react';

interface Props {
  onClose: () => void;
  onSaved: (config: CompanyTrainingConfig) => void;
}

export const TrainingConfigModal: React.FC<Props> = ({ onClose, onSaved }) => {
  const [config, setConfig] = useState<CompanyTrainingConfig>(() => getCompanyTrainingConfig());
  const [newRequiredKeyword, setNewRequiredKeyword] = useState('');
  const [newBannedKeyword, setNewBannedKeyword] = useState('');
  const [isSaved, setIsSaved] = useState(false);

  // 프리셋 로드
  const handleApplyPreset = (key: string) => {
    const preset = PRESETS_CONFIG[key];
    if (preset) {
      if (confirm(`'${preset.label}' 표준 템플릿과 설정으로 덮어씌우시겠습니까?`)) {
        setConfig(preset.config);
        setIsSaved(false);
      }
    }
  };

  // 필수 키워드 추가/삭제
  const handleAddRequired = () => {
    const val = newRequiredKeyword.trim();
    if (val && !config.requiredKeywords.includes(val)) {
      setConfig(prev => ({ ...prev, requiredKeywords: [...prev.requiredKeywords, val] }));
      setNewRequiredKeyword('');
      setIsSaved(false);
    }
  };

  const handleRemoveRequired = (kw: string) => {
    setConfig(prev => ({
      ...prev,
      requiredKeywords: prev.requiredKeywords.filter(k => k !== kw),
    }));
    setIsSaved(false);
  };

  // 금지어 추가/삭제
  const handleAddBanned = () => {
    const val = newBannedKeyword.trim();
    if (val && !config.bannedKeywords.includes(val)) {
      setConfig(prev => ({ ...prev, bannedKeywords: [...prev.bannedKeywords, val] }));
      setNewBannedKeyword('');
      setIsSaved(false);
    }
  };

  const handleRemoveBanned = (kw: string) => {
    setConfig(prev => ({
      ...prev,
      bannedKeywords: prev.bannedKeywords.filter(k => k !== kw),
    }));
    setIsSaved(false);
  };

  // 태그 클릭 시 텍스트 에디터에 태그 삽입
  const handleInsertTag = (field: 'standardOpening' | 'quickOpening', tag: string) => {
    setConfig(prev => ({
      ...prev,
      [field]: prev[field] + ' ' + tag,
    }));
    setIsSaved(false);
  };

  // 설정 저장
  const handleSave = () => {
    saveCompanyTrainingConfig(config);
    setIsSaved(true);
    onSaved(config);
    setTimeout(() => {
      onClose();
    }, 600);
  };

  // 실시간 프리뷰 텍스트
  const samplePreviewText = interpolateOpeningScript(
    config.standardOpening,
    config,
    '홍길동',
    '김고객'
  );

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-in fade-in duration-200">
      <div className="relative w-full max-w-3xl max-h-[92vh] overflow-y-auto rounded-2xl bg-white dark:bg-gray-800 shadow-2xl border border-gray-100 dark:border-gray-700 flex flex-col">
        {/* Header */}
        <div className="sticky top-0 z-10 px-6 py-4 bg-white/95 dark:bg-gray-800/95 backdrop-blur border-b border-gray-100 dark:border-gray-700 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="p-2 rounded-xl bg-blue-50 dark:bg-blue-900/30 text-blue-600 dark:text-blue-400">
              <Settings className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-base font-bold text-gray-900 dark:text-white flex items-center gap-2">
                회사 훈련 정책 & 아웃바운드 스크립트 관리자 설정
              </h3>
              <p className="text-xs text-gray-500 dark:text-gray-400">
                자사 법인명, DB 인입 채널, 표준 오프닝 및 금지어 규칙을 직접 설정하면 AI 고객과 상담원 훈련에 실시간 반영됩니다.
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-lg text-gray-400 hover:text-gray-600 dark:hover:text-gray-200 hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Content Body */}
        <div className="p-6 space-y-6 text-xs">
          {/* Quick Presets Bar */}
          <div className="p-3.5 rounded-2xl bg-gradient-to-r from-blue-50/80 via-indigo-50/50 to-purple-50/70 dark:from-blue-950/30 dark:via-indigo-950/20 dark:to-purple-950/30 border border-blue-100 dark:border-blue-900/50 space-y-2">
            <div className="flex items-center justify-between">
              <span className="font-bold text-blue-950 dark:text-blue-200 flex items-center gap-1.5">
                <Sparkles className="w-3.5 h-3.5 text-blue-600" />
                업종별 표준 프리셋 원클릭 불러오기
              </span>
              <span className="text-[10px] text-gray-500 dark:text-gray-400">클릭 시 자동 세팅</span>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
              {Object.entries(PRESETS_CONFIG).map(([key, item]) => (
                <button
                  key={key}
                  type="button"
                  onClick={() => handleApplyPreset(key)}
                  className="p-2.5 rounded-xl bg-white dark:bg-gray-800 border border-blue-200 dark:border-blue-800/80 hover:border-blue-500 text-left transition-all shadow-2xs hover:scale-[1.01]"
                >
                  <div className="font-bold text-gray-900 dark:text-white text-xs">{item.label}</div>
                  <div className="text-[10px] text-gray-500 dark:text-gray-400 truncate mt-0.5">{item.desc}</div>
                </button>
              ))}
            </div>
          </div>

          {/* 1. 회사 기본 프로필 */}
          <div className="p-4 rounded-2xl bg-gray-50 dark:bg-gray-900/50 border border-gray-200 dark:border-gray-700 space-y-3">
            <h4 className="font-bold text-gray-900 dark:text-white flex items-center gap-1.5">
              <Building2 className="w-4 h-4 text-blue-500" />
              1. 회사 및 인입 채널 기본 프로필
            </h4>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <label className="block text-[11px] font-semibold text-gray-700 dark:text-gray-300 mb-1">
                  공식 회사/법인명 <span className="text-red-500">*</span>
                </label>
                <input
                  type="text"
                  value={config.companyName}
                  onChange={e => { setConfig({ ...config, companyName: e.target.value }); setIsSaved(false); }}
                  placeholder="예: 법무법인 신안, 리드파트너스"
                  className="w-full px-3 py-2 rounded-xl bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 text-xs focus:ring-2 focus:ring-blue-500"
                />
              </div>

              <div>
                <label className="block text-[11px] font-semibold text-gray-700 dark:text-gray-300 mb-1">
                  담당 부서/팀명
                </label>
                <input
                  type="text"
                  value={config.departmentName}
                  onChange={e => { setConfig({ ...config, departmentName: e.target.value }); setIsSaved(false); }}
                  placeholder="예: 회생파산 종합지원센터, 상담1팀"
                  className="w-full px-3 py-2 rounded-xl bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 text-xs focus:ring-2 focus:ring-blue-500"
                />
              </div>

              <div>
                <label className="block text-[11px] font-semibold text-gray-700 dark:text-gray-300 mb-1">
                  대표 DB 인입 채널명 <span className="text-red-500">*</span>
                </label>
                <input
                  type="text"
                  value={config.leadChannelName}
                  onChange={e => { setConfig({ ...config, leadChannelName: e.target.value }); setIsSaved(false); }}
                  placeholder="예: 온라인 무료 안심 자가진단, 유튜브 간편조회"
                  className="w-full px-3 py-2 rounded-xl bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 text-xs focus:ring-2 focus:ring-blue-500"
                />
                <span className="text-[10px] text-gray-400 mt-0.5 block">AI 고객이 이 신청 경로를 듣고 경계를 풉니다.</span>
              </div>

              <div>
                <label className="block text-[11px] font-semibold text-gray-700 dark:text-gray-300 mb-1">
                  공식 유선 대표번호
                </label>
                <input
                  type="text"
                  value={config.representativePhone}
                  onChange={e => { setConfig({ ...config, representativePhone: e.target.value }); setIsSaved(false); }}
                  placeholder="예: 02-588-7119, 1588-4920"
                  className="w-full px-3 py-2 rounded-xl bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 text-xs focus:ring-2 focus:ring-blue-500"
                />
                <span className="text-[10px] text-gray-400 mt-0.5 block">보이스피싱 의심 시 안심 역발신 제안 번호</span>
              </div>
            </div>
          </div>

          {/* 2. 표준 첫인사 오프닝 스크립트 */}
          <div className="p-4 rounded-2xl bg-gray-50 dark:bg-gray-900/50 border border-gray-200 dark:border-gray-700 space-y-3">
            <div className="flex items-center justify-between">
              <h4 className="font-bold text-gray-900 dark:text-white flex items-center gap-1.5">
                <PhoneCall className="w-4 h-4 text-emerald-500" />
                2. 표준 첫인사 오프닝 스크립트 템플릿
              </h4>
              <span className="text-[10px] text-gray-500 dark:text-gray-400">태그 클릭 시 텍스트에 자동 삽입</span>
            </div>

            {/* Variable Tags Palette */}
            <div className="flex flex-wrap items-center gap-1.5 p-2 rounded-xl bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700">
              <span className="text-[10px] font-bold text-gray-500">치환 태그:</span>
              {['{회사명}', '{부서명}', '{상담원명}', '{인입채널}', '{대표번호}', '{고객명}'].map(tag => (
                <button
                  key={tag}
                  type="button"
                  onClick={() => handleInsertTag('standardOpening', tag)}
                  className="px-2 py-0.5 rounded bg-blue-50 dark:bg-blue-900/40 text-blue-700 dark:text-blue-300 font-mono text-[10px] font-bold hover:bg-blue-100 transition-colors"
                >
                  +{tag}
                </button>
              ))}
            </div>

            <div>
              <label className="block text-[11px] font-semibold text-gray-700 dark:text-gray-300 mb-1">
                기본 정규 첫인사 템플릿 (상담원 통화 화면 상단 미션 배너로 출력)
              </label>
              <textarea
                rows={3}
                value={config.standardOpening}
                onChange={e => { setConfig({ ...config, standardOpening: e.target.value }); setIsSaved(false); }}
                placeholder="예: 안녕하십니까, {고객명} 고객님! {회사명} {부서명}의 {상담원명}입니다. 남겨주신 {인입채널} 건으로 연락드렸습니다."
                className="w-full p-2.5 rounded-xl bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 text-xs focus:ring-2 focus:ring-blue-500 font-sans leading-relaxed"
              />
            </div>

            {/* Live Preview */}
            <div className="p-3 rounded-xl bg-emerald-50/60 dark:bg-emerald-950/30 border border-emerald-200 dark:border-emerald-900/50 text-xs space-y-1">
              <span className="font-bold text-emerald-900 dark:text-emerald-300 flex items-center gap-1 text-[11px]">
                <Eye className="w-3.5 h-3.5" /> 상담원 화면 실시간 렌더링 미리보기
              </span>
              <p className="text-gray-800 dark:text-gray-200 italic leading-relaxed">
                "{samplePreviewText}"
              </p>
            </div>
          </div>

          {/* 3. 필수 포함 키워드 & 엄격 금지어 */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            {/* Required Keywords */}
            <div className="p-4 rounded-2xl bg-emerald-50/40 dark:bg-emerald-950/20 border border-emerald-200 dark:border-emerald-900/50 space-y-2.5">
              <h4 className="font-bold text-emerald-900 dark:text-emerald-300 flex items-center gap-1.5 text-xs">
                <ShieldCheck className="w-4 h-4 text-emerald-600" />
                필수 포함 강조 키워드 (미언급 시 감점)
              </h4>
              <div className="flex gap-1.5">
                <input
                  type="text"
                  value={newRequiredKeyword}
                  onChange={e => setNewRequiredKeyword(e.target.value)}
                  onKeyDown={e => { if (e.key === 'Enter') { e.preventDefault(); handleAddRequired(); } }}
                  placeholder="예: 비밀 보장, 수수료 없음"
                  className="flex-1 px-2.5 py-1.5 rounded-lg bg-white dark:bg-gray-800 border border-emerald-200 dark:border-emerald-800 text-xs"
                />
                <button
                  type="button"
                  onClick={handleAddRequired}
                  className="px-3 py-1.5 rounded-lg bg-emerald-600 text-white font-bold text-xs"
                >
                  추가
                </button>
              </div>
              <div className="flex flex-wrap gap-1.5 pt-1">
                {config.requiredKeywords.map(kw => (
                  <span
                    key={kw}
                    className="inline-flex items-center gap-1 px-2.5 py-1 rounded-md bg-emerald-100 text-emerald-800 dark:bg-emerald-900/60 dark:text-emerald-200 text-[11px] font-semibold"
                  >
                    ✓ {kw}
                    <button
                      type="button"
                      onClick={() => handleRemoveRequired(kw)}
                      className="hover:text-red-500 ml-0.5"
                    >
                      ×
                    </button>
                  </span>
                ))}
              </div>
            </div>

            {/* Banned Keywords */}
            <div className="p-4 rounded-2xl bg-rose-50/40 dark:bg-rose-950/20 border border-rose-200 dark:border-rose-900/50 space-y-2.5">
              <h4 className="font-bold text-rose-900 dark:text-rose-300 flex items-center gap-1.5 text-xs">
                <ShieldAlert className="w-4 h-4 text-rose-600" />
                엄격 금지어 (과장광고/위법 방지)
              </h4>
              <div className="flex gap-1.5">
                <input
                  type="text"
                  value={newBannedKeyword}
                  onChange={e => setNewBannedKeyword(e.target.value)}
                  onKeyDown={e => { if (e.key === 'Enter') { e.preventDefault(); handleAddBanned(); } }}
                  placeholder="예: 100% 무조건 승인, 전액 탕감"
                  className="flex-1 px-2.5 py-1.5 rounded-lg bg-white dark:bg-gray-800 border border-rose-200 dark:border-rose-800 text-xs"
                />
                <button
                  type="button"
                  onClick={handleAddBanned}
                  className="px-3 py-1.5 rounded-lg bg-rose-600 text-white font-bold text-xs"
                >
                  추가
                </button>
              </div>
              <div className="flex flex-wrap gap-1.5 pt-1">
                {config.bannedKeywords.map(kw => (
                  <span
                    key={kw}
                    className="inline-flex items-center gap-1 px-2.5 py-1 rounded-md bg-rose-100 text-rose-800 dark:bg-rose-900/60 dark:text-rose-200 text-[11px] font-semibold"
                  >
                    🚫 {kw}
                    <button
                      type="button"
                      onClick={() => handleRemoveBanned(kw)}
                      className="hover:text-black ml-0.5"
                    >
                      ×
                    </button>
                  </span>
                ))}
              </div>
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="sticky bottom-0 px-6 py-4 bg-gray-50 dark:bg-gray-900/90 border-t border-gray-100 dark:border-gray-700 flex items-center justify-between">
          <button
            type="button"
            onClick={() => {
              if (confirm('기본값으로 초기화하시겠습니까?')) {
                setConfig(DEFAULT_TRAINING_CONFIG);
                setIsSaved(false);
              }
            }}
            className="flex items-center gap-1.5 px-4 py-2.5 rounded-xl text-xs font-semibold text-gray-700 dark:text-gray-300 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 hover:bg-gray-100 transition-colors"
          >
            <RotateCcw className="w-3.5 h-3.5" />
            기본값 복원
          </button>

          <div className="flex items-center gap-2">
            {isSaved && (
              <span className="text-xs text-emerald-600 font-bold flex items-center gap-1">
                <Check className="w-4 h-4" /> 저장 완료!
              </span>
            )}
            <button
              type="button"
              onClick={handleSave}
              className="flex items-center gap-1.5 px-6 py-2.5 rounded-xl text-xs font-bold text-white bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700 shadow-md shadow-blue-500/20 transition-all hover:scale-[1.02]"
            >
              <Save className="w-4 h-4" />
              설정 저장 & 훈련 센터에 즉시 반영
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
