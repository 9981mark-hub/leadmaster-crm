import React, { useState } from 'react';
import {
  CompanyTrainingConfig,
  getCompanyTrainingConfig,
  saveCompanyTrainingConfig,
  PRESETS_CONFIG,
  interpolateOpeningScript,
  DEFAULT_TRAINING_CONFIG,
} from '../../services/trainingService';
import { useToast } from '../../contexts/ToastContext';
import { useConfirmDialog } from '../../contexts/ConfirmDialogContext';
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
  Eye,
  Send,
  PhoneForwarded,
  Info,
  Scale,
} from 'lucide-react';

interface Props {
  onClose: () => void;
  onSaved: (config: CompanyTrainingConfig) => void;
}

export const TrainingConfigModal: React.FC<Props> = ({ onClose, onSaved }) => {
  const { showToast } = useToast();
  const { confirm: confirmDialog } = useConfirmDialog();
  const [config, setConfig] = useState<CompanyTrainingConfig>(() => getCompanyTrainingConfig());
  const [activeTab, setActiveTab] = useState<'outbound' | 'inbound' | 'compliance'>('outbound');
  const [newRequiredKeyword, setNewRequiredKeyword] = useState('');
  const [newBannedKeyword, setNewBannedKeyword] = useState('');
  const [isSaved, setIsSaved] = useState(false);

  // 프리셋 로드
  const handleApplyPreset = async (key: string) => {
    const preset = PRESETS_CONFIG[key];
    if (preset) {
      const ok = await confirmDialog({
        title: '훈련 프리셋 적용',
        message: `'${preset.label}' 표준 템플릿과 설정으로 덮어씌우시겠습니까?`,
        confirmLabel: '프리셋 적용',
        cancelLabel: '취소'
      });
      if (ok) {
        setConfig(JSON.parse(JSON.stringify(preset.config)));
        setIsSaved(false);
        showToast(`'${preset.label}' 템플릿이 적용되었습니다.`, 'success');
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

  // 태그 클릭 시 활성 텍스트 에디터에 태그 삽입
  const handleInsertTag = (targetField: 'outboundOpening' | 'inboundOpening' | 'outboundQuick' | 'inboundQuick' | 'handover', tag: string) => {
    if (targetField === 'outboundOpening') {
      setConfig(prev => ({
        ...prev,
        outbound: { ...prev.outbound, openingScript: prev.outbound.openingScript + ' ' + tag },
      }));
    } else if (targetField === 'outboundQuick') {
      setConfig(prev => ({
        ...prev,
        outbound: { ...prev.outbound, quickOpeningScript: prev.outbound.quickOpeningScript + ' ' + tag },
      }));
    } else if (targetField === 'handover') {
      setConfig(prev => ({
        ...prev,
        outbound: { ...prev.outbound, closingHandoverScript: (prev.outbound.closingHandoverScript || '') + ' ' + tag },
      }));
    } else if (targetField === 'inboundOpening') {
      setConfig(prev => ({
        ...prev,
        inbound: { ...prev.inbound, openingScript: prev.inbound.openingScript + ' ' + tag },
      }));
    } else if (targetField === 'inboundQuick') {
      setConfig(prev => ({
        ...prev,
        inbound: { ...prev.inbound, quickOpeningScript: prev.inbound.quickOpeningScript + ' ' + tag },
      }));
    }
    setIsSaved(false);
  };

  // 설정 저장
  const handleSave = async () => {
    // 하위 호환 필드도 함께 동기화
    const finalConfig: CompanyTrainingConfig = {
      ...config,
      companyName: config.outbound.orgName,
      departmentName: config.inbound.departmentName,
      leadChannelName: config.inbound.leadChannelName,
      standardOpening: config.outbound.openingScript,
      quickOpening: config.outbound.quickOpeningScript,
    };

    const error = await saveCompanyTrainingConfig(finalConfig);
    if (error) {
      showToast(`훈련 설정을 저장하지 못했습니다: ${error}`, 'error');
      return;
    }
    showToast('회사 맞춤 훈련 및 멘트 설정이 저장되었습니다.', 'success');
    setIsSaved(true);
    onSaved(finalConfig);
    setTimeout(() => {
      onClose();
    }, 600);
  };

  // 실시간 프리뷰 텍스트 (현재 선택된 탭 기준)
  const samplePreviewText = activeTab === 'inbound'
    ? interpolateOpeningScript(config.inbound.openingScript, config, '홍길동', '김고객', 'inbound_lead')
    : interpolateOpeningScript(config.outbound.openingScript, config, '홍길동', '김고객', 'cold_call');

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-xs animate-in fade-in duration-200">
      <div className="relative w-full max-w-4xl max-h-[92vh] overflow-y-auto rounded-2xl bg-card text-card-foreground shadow-2xl border border-border flex flex-col">
        {/* Header */}
        <div className="sticky top-0 z-10 px-6 py-4 bg-card/95 backdrop-blur border-b border-border flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <div className="w-10 h-10 rounded-xl bg-primary/10 border border-primary/20 text-primary flex items-center justify-center shrink-0">
              <Settings className="w-5 h-5" strokeWidth={1.75} />
            </div>
            <div>
              <h3 className="text-base font-bold text-foreground flex items-center gap-2">
                회사 맞춤 훈련 정책 & 듀얼 브랜딩 스크립트 설정
              </h3>
              <p className="text-xs text-muted-foreground">
                변호사법 사칭 방지 아웃바운드 TM 화법과 공식 광고 리드 인바운드 화법을 회사별로 독립 구성합니다.
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-lg text-muted-foreground hover:text-foreground hover:bg-muted transition-colors cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Content Body */}
        <div className="p-6 space-y-5 text-xs">
          {/* Quick Presets Bar */}
          <div className="p-3.5 rounded-2xl bg-muted/40 border border-border space-y-2">
            <div className="flex items-center justify-between">
              <span className="font-bold text-foreground flex items-center gap-1.5">
                <Sparkles className="w-3.5 h-3.5 text-primary" />
                회사 운영 유형별 표준 프리셋 (원클릭 세팅)
              </span>
              <span className="text-2xs text-muted-foreground">클릭 시 자동 반영</span>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-2">
              {Object.entries(PRESETS_CONFIG).map(([key, item]) => (
                <button
                  key={key}
                  type="button"
                  onClick={() => handleApplyPreset(key)}
                  className="p-2.5 rounded-xl bg-card border border-border hover:border-primary/40 text-left transition-all shadow-2xs cursor-pointer"
                >
                  <div className="font-bold text-foreground text-xs">{item.label}</div>
                  <div className="text-2xs text-muted-foreground line-clamp-2 mt-0.5">{item.desc}</div>
                </button>
              ))}
            </div>
          </div>

          {/* 3대 메인 설정 탭 */}
          <div className="flex items-center gap-1 p-1 bg-muted/50 rounded-xl border border-border">
            <button
              type="button"
              onClick={() => setActiveTab('outbound')}
              className={`flex-1 flex items-center justify-center gap-2 py-2 rounded-lg font-bold text-xs transition-all cursor-pointer ${
                activeTab === 'outbound'
                  ? 'bg-card text-primary font-bold shadow-2xs border border-border/80'
                  : 'text-muted-foreground hover:text-foreground'
              }`}
            >
              <PhoneCall className="w-3.5 h-3.5" />
              <span>📞 아웃바운드 콜드콜 (TM 대행사/센터 화법)</span>
            </button>

            <button
              type="button"
              onClick={() => setActiveTab('inbound')}
              className={`flex-1 flex items-center justify-center gap-2 py-2 rounded-lg font-bold text-xs transition-all cursor-pointer ${
                activeTab === 'inbound'
                  ? 'bg-card text-primary font-bold shadow-2xs border border-border/80'
                  : 'text-muted-foreground hover:text-foreground'
              }`}
            >
              <Send className="w-3.5 h-3.5" />
              <span>📋 인바운드 광고리드 (법무법인/신청 접수건)</span>
            </button>

            <button
              type="button"
              onClick={() => setActiveTab('compliance')}
              className={`flex-1 flex items-center justify-center gap-2 py-2 rounded-lg font-bold text-xs transition-all cursor-pointer ${
                activeTab === 'compliance'
                  ? 'bg-card text-primary font-bold shadow-2xs border border-border/80'
                  : 'text-muted-foreground hover:text-foreground'
              }`}
            >
              <ShieldCheck className="w-3.5 h-3.5" />
              <span>🛡️ 공통 품질 & 금지어 관리</span>
            </button>
          </div>

          {/* TAB 1: 아웃바운드 (콜드콜) 설정 */}
          {activeTab === 'outbound' && (
            <div className="space-y-4 animate-in fade-in duration-150">
              <div className="p-3 rounded-xl bg-blue-50/70 dark:bg-blue-950/30 border border-blue-200 dark:border-blue-900/60 flex items-start gap-2">
                <Info className="w-4 h-4 text-blue-600 shrink-0 mt-0.5" />
                <p className="text-xs text-blue-900 dark:text-blue-200 leading-relaxed">
                  <strong>변호사법 준수 핵심 안내:</strong> 독립 TM 대행사/파트너사는 법무법인 직원이 아니므로 "법무법인" 사칭이 법적으로 불가합니다. 일반적으로 <strong>"채무조정 지원센터 OOO 팀장"</strong>과 같이 공신력 있는 센터 명칭과 책임감 있는 직책으로 소명합니다.
                </p>
              </div>

              <div className="p-4 rounded-2xl bg-gray-50 dark:bg-gray-900/50 border border-gray-200 dark:border-gray-700 space-y-3">
                <h4 className="font-bold text-gray-900 dark:text-white flex items-center gap-1.5">
                  <Building2 className="w-4 h-4 text-blue-500" />
                  아웃바운드 발신 소속 및 직책 프로필
                </h4>
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                  <div>
                    <label className="block text-xs font-semibold text-gray-700 dark:text-gray-300 mb-1">
                      소속 기관/센터명 <span className="text-red-500">*</span>
                    </label>
                    <input
                      type="text"
                      value={config.outbound.orgName}
                      onChange={e => {
                        setConfig({
                          ...config,
                          outbound: { ...config.outbound, orgName: e.target.value },
                        });
                        setIsSaved(false);
                      }}
                      placeholder="예: 채무조정 지원센터, 서민금융 지원본부"
                      className="w-full px-3 py-2 rounded-xl bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 text-xs focus:ring-2 focus:ring-blue-500"
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-semibold text-gray-700 dark:text-gray-300 mb-1">
                      상담원 직책/호칭 <span className="text-red-500">*</span>
                    </label>
                    <input
                      type="text"
                      value={config.outbound.roleTitle}
                      onChange={e => {
                        setConfig({
                          ...config,
                          outbound: { ...config.outbound, roleTitle: e.target.value },
                        });
                        setIsSaved(false);
                      }}
                      placeholder="예: 팀장, 수석팀장, 과장, 전담위원"
                      className="w-full px-3 py-2 rounded-xl bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 text-xs focus:ring-2 focus:ring-blue-500"
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-semibold text-gray-700 dark:text-gray-300 mb-1">
                      DB 출처 소명 문구 <span className="text-red-500">*</span>
                    </label>
                    <input
                      type="text"
                      value={config.outbound.sourceText}
                      onChange={e => {
                        setConfig({
                          ...config,
                          outbound: { ...config.outbound, sourceText: e.target.value },
                        });
                        setIsSaved(false);
                      }}
                      placeholder="예: 온라인 제휴 안심 자가진단 이력"
                      className="w-full px-3 py-2 rounded-xl bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 text-xs focus:ring-2 focus:ring-blue-500"
                    />
                  </div>
                </div>
              </div>

              {/* 스크립트 작성 영역 */}
              <div className="p-4 rounded-2xl bg-gray-50 dark:bg-gray-900/50 border border-gray-200 dark:border-gray-700 space-y-3">
                <div className="flex items-center justify-between">
                  <h4 className="font-bold text-gray-900 dark:text-white flex items-center gap-1.5">
                    <PhoneCall className="w-4 h-4 text-blue-500" />
                    아웃바운드 표준 첫인사 템플릿
                  </h4>
                  <span className="text-xs text-gray-500">클릭 시 태그 자동 삽입</span>
                </div>

                <div className="flex flex-wrap items-center gap-1.5 p-2 rounded-xl bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700">
                  <span className="text-xs font-bold text-gray-500">치환 태그:</span>
                  {['{소속명}', '{직책}', '{상담원명}', '{고객명}', '{출처}', '{대표번호}'].map(tag => (
                    <button
                      key={tag}
                      type="button"
                      onClick={() => handleInsertTag('outboundOpening', tag)}
                      className="px-2 py-0.5 rounded bg-blue-50 dark:bg-blue-900/40 text-blue-700 dark:text-blue-300 font-mono text-xs font-bold hover:bg-blue-100 transition-colors"
                    >
                      +{tag}
                    </button>
                  ))}
                </div>

                <div>
                  <label className="block text-xs font-semibold text-gray-700 dark:text-gray-300 mb-1">
                    정규 1차 오프닝 (상담원 콜드콜 통화 화면 상단 가이드 배너에 표시)
                  </label>
                  <textarea
                    rows={3}
                    value={config.outbound.openingScript}
                    onChange={e => {
                      setConfig({
                        ...config,
                        outbound: { ...config.outbound, openingScript: e.target.value },
                      });
                      setIsSaved(false);
                    }}
                    placeholder="안녕하십니까, {고객명} 고객님! {소속명}의 {상담원명} {직책}입니다..."
                    className="w-full p-2.5 rounded-xl bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 text-xs focus:ring-2 focus:ring-blue-500 font-sans leading-relaxed"
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-gray-700 dark:text-gray-300 mb-1 flex items-center gap-1.5">
                    <PhoneForwarded className="w-3.5 h-3.5 text-emerald-500" />
                    7대 문진 완료 후 수석 사무장 인계 브릿지 멘트 (권장)
                  </label>
                  <input
                    type="text"
                    value={config.outbound.closingHandoverScript || ''}
                    onChange={e => {
                      setConfig({
                        ...config,
                        outbound: { ...config.outbound, closingHandoverScript: e.target.value },
                      });
                      setIsSaved(false);
                    }}
                    placeholder="고객님, 1차 지원센터 가심사 결과 조건에 적격하셔서, 법원 도산 전문 수석 사무장님께 사건을 직통 배정해 드리겠습니다."
                    className="w-full px-3 py-2 rounded-xl bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 text-xs focus:ring-2 focus:ring-emerald-500"
                  />
                  <span className="text-xs text-gray-500 dark:text-gray-400 mt-0.5 block">
                    아웃바운드 1차 문진 성공 시 제휴 법무법인 사무장에게 안심하고 바통 터치하는 연결 스크립트입니다.
                  </span>
                </div>
              </div>
            </div>
          )}

          {/* TAB 2: 인바운드 (광고신청) 설정 */}
          {activeTab === 'inbound' && (
            <div className="space-y-4 animate-in fade-in duration-150">
              <div className="p-3 rounded-xl bg-purple-50/70 dark:bg-purple-950/30 border border-purple-200 dark:border-purple-900/60 flex items-start gap-2">
                <Info className="w-4 h-4 text-purple-600 shrink-0 mt-0.5" />
                <p className="text-xs text-purple-900 dark:text-purple-200 leading-relaxed">
                  <strong>인바운드 신속 리콜 원칙:</strong> 고객이 SNS/포털 광고에서 직접 신청서를 제출했으므로, 신청한 <strong>공식 법인명(법무법인명)과 신청 건명</strong>을 즉각 상기시켜 주어야 보이스피싱 의심 없이 바로 본론으로 진입합니다.
                </p>
              </div>

              <div className="p-4 rounded-2xl bg-gray-50 dark:bg-gray-900/50 border border-gray-200 dark:border-gray-700 space-y-3">
                <h4 className="font-bold text-gray-900 dark:text-white flex items-center gap-1.5">
                  <Scale className="w-4 h-4 text-purple-500" />
                  인바운드 법인명 및 유입 채널 프로필
                </h4>
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
                  <div>
                    <label className="block text-xs font-semibold text-gray-700 dark:text-gray-300 mb-1">
                      공식 법인/회사명 <span className="text-red-500">*</span>
                    </label>
                    <input
                      type="text"
                      value={config.inbound.companyName}
                      onChange={e => {
                        setConfig({
                          ...config,
                          inbound: { ...config.inbound, companyName: e.target.value },
                        });
                        setIsSaved(false);
                      }}
                      placeholder="예: 법무법인 신안"
                      className="w-full px-3 py-2 rounded-xl bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 text-xs focus:ring-2 focus:ring-purple-500"
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-semibold text-gray-700 dark:text-gray-300 mb-1">
                      담당 부서/팀명
                    </label>
                    <input
                      type="text"
                      value={config.inbound.departmentName}
                      onChange={e => {
                        setConfig({
                          ...config,
                          inbound: { ...config.inbound, departmentName: e.target.value },
                        });
                        setIsSaved(false);
                      }}
                      placeholder="예: 회생파산 전담팀"
                      className="w-full px-3 py-2 rounded-xl bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 text-xs focus:ring-2 focus:ring-purple-500"
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-semibold text-gray-700 dark:text-gray-300 mb-1">
                      상담원 직책/호칭
                    </label>
                    <input
                      type="text"
                      value={config.inbound.roleTitle}
                      onChange={e => {
                        setConfig({
                          ...config,
                          inbound: { ...config.inbound, roleTitle: e.target.value },
                        });
                        setIsSaved(false);
                      }}
                      placeholder="예: 전담 상담원, 선임상담관"
                      className="w-full px-3 py-2 rounded-xl bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 text-xs focus:ring-2 focus:ring-purple-500"
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-semibold text-gray-700 dark:text-gray-300 mb-1">
                      대표 인입 채널명 <span className="text-red-500">*</span>
                    </label>
                    <input
                      type="text"
                      value={config.inbound.leadChannelName}
                      onChange={e => {
                        setConfig({
                          ...config,
                          inbound: { ...config.inbound, leadChannelName: e.target.value },
                        });
                        setIsSaved(false);
                      }}
                      placeholder="예: 온라인 무료 안심 자가진단"
                      className="w-full px-3 py-2 rounded-xl bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 text-xs focus:ring-2 focus:ring-purple-500"
                    />
                  </div>
                </div>
              </div>

              {/* 스크립트 작성 영역 */}
              <div className="p-4 rounded-2xl bg-gray-50 dark:bg-gray-900/50 border border-gray-200 dark:border-gray-700 space-y-3">
                <div className="flex items-center justify-between">
                  <h4 className="font-bold text-gray-900 dark:text-white flex items-center gap-1.5">
                    <Send className="w-4 h-4 text-purple-500" />
                    인바운드 신속 회신 첫인사 템플릿
                  </h4>
                  <span className="text-xs text-gray-500">클릭 시 태그 자동 삽입</span>
                </div>

                <div className="flex flex-wrap items-center gap-1.5 p-2 rounded-xl bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700">
                  <span className="text-xs font-bold text-gray-500">치환 태그:</span>
                  {['{회사명}', '{부서명}', '{상담원명}', '{고객명}', '{인입채널}', '{대표번호}'].map(tag => (
                    <button
                      key={tag}
                      type="button"
                      onClick={() => handleInsertTag('inboundOpening', tag)}
                      className="px-2 py-0.5 rounded bg-purple-50 dark:bg-purple-900/40 text-purple-700 dark:text-purple-300 font-mono text-xs font-bold hover:bg-purple-100 transition-colors"
                    >
                      +{tag}
                    </button>
                  ))}
                </div>

                <div>
                  <textarea
                    rows={3}
                    value={config.inbound.openingScript}
                    onChange={e => {
                      setConfig({
                        ...config,
                        inbound: { ...config.inbound, openingScript: e.target.value },
                      });
                      setIsSaved(false);
                    }}
                    placeholder="안녕하세요, {고객명} 고객님 맞으실까요? 방금 {인입채널}에서 신청 남겨주신 [{회사명} 개인회생 자격진단] 건으로 신속히 도움드리고자 연락드렸습니다..."
                    className="w-full p-2.5 rounded-xl bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 text-xs focus:ring-2 focus:ring-purple-500 font-sans leading-relaxed"
                  />
                </div>
              </div>
            </div>
          )}

          {/* TAB 3: 공통 품질 & 금지어 관리 */}
          {activeTab === 'compliance' && (
            <div className="space-y-4 animate-in fade-in duration-150">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                {/* 필수 키워드 */}
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
                        className="inline-flex items-center gap-1 px-2.5 py-1 rounded-md bg-emerald-100 text-emerald-800 dark:bg-emerald-900/60 dark:text-emerald-200 text-xs font-semibold"
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

                {/* 금지어 */}
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
                        className="inline-flex items-center gap-1 px-2.5 py-1 rounded-md bg-rose-100 text-rose-800 dark:bg-rose-900/60 dark:text-rose-200 text-xs font-semibold"
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

              {/* 환경 및 대표번호 */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="p-4 rounded-2xl bg-gray-50 dark:bg-gray-900/50 border border-gray-200 dark:border-gray-700 space-y-1.5">
                  <label className="block text-xs font-semibold text-gray-700 dark:text-gray-300">
                    공식 유선 대표번호
                  </label>
                  <input
                    type="text"
                    value={config.representativePhone}
                    onChange={e => {
                      setConfig({ ...config, representativePhone: e.target.value });
                      setIsSaved(false);
                    }}
                    placeholder="예: 1588-4920, 02-588-7119"
                    className="w-full px-3 py-2 rounded-xl bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 text-xs focus:ring-2 focus:ring-blue-500"
                  />
                  <span className="text-xs text-gray-500 dark:text-gray-400">보이스피싱 의심 고객에게 역발신을 제안할 공신력 있는 대표번호</span>
                </div>

                <div className="p-4 rounded-2xl bg-indigo-50/40 dark:bg-indigo-950/20 border border-indigo-200 dark:border-indigo-900/50 flex items-center justify-between">
                  <div>
                    <h4 className="font-bold text-indigo-900 dark:text-indigo-300 flex items-center gap-1.5 text-xs">
                      <PhoneCall className="w-4 h-4 text-indigo-600" />
                      전사 스마트폰 수화기 음질 필터 (300~3400Hz)
                    </h4>
                    <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">
                      모든 상담원의 모의 훈련 시 실제 전화 통화 수화기 주파수를 적용합니다.
                    </p>
                  </div>
                  <button
                    type="button"
                    onClick={() => {
                      setConfig(prev => ({
                        ...prev,
                        usePhoneFilter: prev.usePhoneFilter === false ? true : false,
                      }));
                      setIsSaved(false);
                    }}
                    className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all shrink-0 ml-2 ${
                      config.usePhoneFilter !== false
                        ? 'bg-emerald-600 text-white shadow-xs'
                        : 'bg-gray-200 dark:bg-gray-700 text-gray-600 dark:text-gray-300'
                    }`}
                  >
                    {config.usePhoneFilter !== false ? '필터 ON (적용 중)' : '필터 OFF (원음)'}
                  </button>
                </div>
              </div>
            </div>
          )}

          {/* Live Preview (현재 탭에 맞춰 즉시 렌더링) */}
          <div className="p-3.5 rounded-xl bg-emerald-50/60 dark:bg-emerald-950/30 border border-emerald-200 dark:border-emerald-900/50 text-xs space-y-1">
            <div className="flex items-center justify-between">
              <span className="font-bold text-emerald-900 dark:text-emerald-300 flex items-center gap-1 text-xs">
                <Eye className="w-3.5 h-3.5" />
                상담원 통화 화면 실시간 렌더링 미리보기 ({activeTab === 'inbound' ? '인바운드 모드' : '아웃바운드 모드'})
              </span>
              <span className="text-xs text-emerald-700 dark:text-emerald-400 font-medium">
                치환 결과 확인
              </span>
            </div>
            <p className="text-gray-800 dark:text-gray-200 italic leading-relaxed font-sans">
              "{samplePreviewText}"
            </p>
          </div>
        </div>

        {/* Footer */}
        <div className="sticky bottom-0 px-6 py-4 bg-muted/40 backdrop-blur border-t border-border flex items-center justify-between">
          <button
            type="button"
            onClick={async () => {
              const ok = await confirmDialog({
                title: '설정 기본값 복원',
                message: '모든 설정을 기본값(독립 TM 대행사 표준)으로 초기화하시겠습니까?',
                confirmLabel: '기본값 복원',
                cancelLabel: '취소',
                variant: 'destructive'
              });
              if (ok) {
                setConfig(JSON.parse(JSON.stringify(DEFAULT_TRAINING_CONFIG)));
                setIsSaved(false);
                showToast('표준 기본값으로 초기화되었습니다.', 'success');
              }
            }}
            className="flex items-center gap-1.5 px-4 py-2.5 rounded-xl text-xs font-semibold text-foreground bg-card border border-border hover:bg-muted transition-colors cursor-pointer"
          >
            <RotateCcw className="w-3.5 h-3.5" />
            기본값 복원
          </button>

          <div className="flex items-center gap-2">
            {isSaved && (
              <span className="text-xs text-primary font-bold flex items-center gap-1">
                <Check className="w-4 h-4" /> 저장 완료!
              </span>
            )}
            <button
              type="button"
              onClick={handleSave}
              className="flex items-center gap-1.5 px-6 py-2.5 rounded-xl text-xs font-semibold text-primary-foreground bg-primary hover:bg-primary/90 shadow-xs transition-colors cursor-pointer"
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