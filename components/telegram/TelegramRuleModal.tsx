import React, { useState, useEffect } from 'react';
import { X, Settings2, Sparkles, Zap, Shield, Check, RotateCcw, AlertTriangle } from 'lucide-react';
import { 
  TelegramCompanyRules, 
  TelegramFeedbackRuleItem, 
  PRESET_SMART_DEFAULT, 
  PRESET_FAST_CLOSE, 
  PRESET_DEEP_CARE, 
  saveTelegramCompanyRules 
} from '../../services/telegramRules';
import { DEFAULT_STATUS_LIST } from '../../constants';
import { CaseStatus } from '../../types';

interface Props {
  isOpen: boolean;
  onClose: () => void;
  currentRules: TelegramCompanyRules;
  onSaved: (rules: TelegramCompanyRules) => void;
  availableStatuses?: CaseStatus[];
  orgId?: string;
}

export const TelegramRuleModal: React.FC<Props> = ({
  isOpen,
  onClose,
  currentRules,
  onSaved,
  availableStatuses = DEFAULT_STATUS_LIST,
  orgId,
}) => {
  const [rules, setRules] = useState<TelegramCompanyRules>(currentRules);
  const [activePreset, setActivePreset] = useState<'custom' | 'smart' | 'fast' | 'care'>('custom');
  const [isSaving, setIsSaving] = useState(false);

  useEffect(() => {
    setRules(currentRules);
  }, [currentRules, isOpen]);

  if (!isOpen) return null;

  const handleApplyPreset = (type: 'smart' | 'fast' | 'care') => {
    setActivePreset(type);
    if (type === 'smart') setRules({ ...PRESET_SMART_DEFAULT });
    if (type === 'fast') setRules({ ...PRESET_FAST_CLOSE });
    if (type === 'care') setRules({ ...PRESET_DEEP_CARE });
  };

  const handleRuleChange = (feedbackType: string, field: keyof TelegramFeedbackRuleItem, value: any) => {
    setActivePreset('custom');
    setRules(prev => ({
      ...prev,
      [feedbackType]: {
        ...prev[feedbackType],
        [field]: value,
      },
    }));
  };

  const handleSave = async () => {
    setIsSaving(true);
    await saveTelegramCompanyRules(rules, orgId);
    setIsSaving(false);
    onSaved(rules);
    onClose();
  };

  const ruleKeys = Object.keys(rules);

  return (
    <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex items-center justify-center p-4 overflow-y-auto">
      <div className="bg-card text-card-foreground rounded-2xl max-w-4xl w-full shadow-2xl border border-border overflow-hidden my-8 animate-in fade-in zoom-in-95 duration-200">
        
        {/* 모달 헤더 */}
        <div className="p-5 border-b border-border flex items-center justify-between bg-muted/30">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-primary/10 text-primary border border-primary/20 flex items-center justify-center shrink-0 shadow-xs">
              <Settings2 size={20} strokeWidth={1.75} />
            </div>
            <div>
              <h2 className="text-lg font-bold text-foreground flex items-center gap-2">
                회사별 텔레그램 피드백 자동화 룰 설정
                <span className="px-2.5 py-0.5 rounded-full text-xs font-semibold bg-primary/10 text-primary border border-primary/20">
                  오토파일럿 엔진
                </span>
              </h2>
              <p className="text-xs text-muted-foreground mt-0.5">
                현장 사무소의 피드백 인입 시 우리 회사의 영업 정책에 맞게 상태 변경 및 후속 조치를 자동 실행합니다.
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-2 text-muted-foreground hover:text-foreground rounded-lg hover:bg-muted transition-colors cursor-pointer"
          >
            <X size={18} strokeWidth={1.75} />
          </button>
        </div>

        {/* 프리셋 바 */}
        <div className="px-6 py-3 bg-muted/20 border-b border-border flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-2 text-xs font-semibold text-foreground">
            <Sparkles size={14} strokeWidth={1.75} className="text-primary" />
            원클릭 추천 프리셋:
          </div>
          <div className="flex flex-wrap gap-2">
            <button
              onClick={() => handleApplyPreset('smart')}
              className={`px-3 py-1.5 rounded-lg text-xs font-semibold flex items-center gap-1.5 transition-colors cursor-pointer ${
                activePreset === 'smart'
                  ? 'bg-primary text-primary-foreground shadow-xs'
                  : 'bg-card text-foreground border border-border hover:bg-muted'
              }`}
            >
              <Sparkles size={13} strokeWidth={1.75} /> 스마트 표준 (권장)
            </button>
            <button
              onClick={() => handleApplyPreset('fast')}
              className={`px-3 py-1.5 rounded-lg text-xs font-semibold flex items-center gap-1.5 transition-colors cursor-pointer ${
                activePreset === 'fast'
                  ? 'bg-primary text-primary-foreground shadow-xs'
                  : 'bg-card text-foreground border border-border hover:bg-muted'
              }`}
              title="부재 및 거절 발생 시 즉시 '종결/완료' 처리하여 빠른 콜 순환"
            >
              <Zap size={13} strokeWidth={1.75} className="text-amber-500" /> 패스트 종결 (회전율 극대화)
            </button>
            <button
              onClick={() => handleApplyPreset('care')}
              className={`px-3 py-1.5 rounded-lg text-xs font-semibold flex items-center gap-1.5 transition-colors cursor-pointer ${
                activePreset === 'care'
                  ? 'bg-primary text-primary-foreground shadow-xs'
                  : 'bg-card text-foreground border border-border hover:bg-muted'
              }`}
              title="모든 부재 및 비용고민 건을 1차 TM 상담원에게 즉시 재배정"
            >
              <Shield size={13} strokeWidth={1.75} className="text-emerald-500" /> 철저 재케어 (TM 긴급재콜)
            </button>
          </div>
        </div>

        {/* 룰 테이블 */}
        <div className="p-6 max-h-[60vh] overflow-y-auto space-y-4">
          <div className="divide-y divide-border">
            {ruleKeys.map(key => {
              const rule = rules[key];
              if (!rule) return null;

              const isAuto = rule.applyMode === 'auto';

              return (
                <div key={key} className="py-4 first:pt-0 last:pb-0 flex flex-col md:flex-row md:items-center justify-between gap-4">
                  {/* 유형 이름 & 설명 */}
                  <div className="w-full md:w-56 shrink-0">
                    <div className="flex items-center gap-2">
                      <span className="font-bold text-sm text-foreground">
                        {rule.label || rule.feedbackType}
                      </span>
                    </div>
                    <span className="text-xs text-muted-foreground font-mono">[{rule.feedbackType}]</span>
                  </div>

                  {/* 설정 컨트롤들 */}
                  <div className="flex-1 flex flex-wrap items-center gap-3">
                    {/* 1. 처리 방식 토글 */}
                    <div className="flex items-center bg-muted p-0.5 rounded-lg text-xs font-medium shrink-0 border border-border">
                      <button
                        onClick={() => handleRuleChange(key, 'applyMode', 'auto')}
                        className={`px-2.5 py-1 rounded-md transition-all cursor-pointer ${
                          isAuto ? 'bg-card text-foreground font-bold shadow-2xs' : 'text-muted-foreground hover:text-foreground'
                        }`}
                      >
                        ⚡ 자동반영
                      </button>
                      <button
                        onClick={() => handleRuleChange(key, 'applyMode', 'pending')}
                        className={`px-2.5 py-1 rounded-md transition-all cursor-pointer ${
                          !isAuto ? 'bg-card text-foreground font-bold shadow-2xs' : 'text-muted-foreground hover:text-foreground'
                        }`}
                      >
                        ⏰ 승인대기
                      </button>
                    </div>

                    {/* 2. 변경할 케이스 상태 드롭다운 */}
                    <div className="flex items-center gap-1.5 shrink-0">
                      <span className="text-xs text-muted-foreground">변경 상태:</span>
                      <select
                        value={rule.targetStatus || ''}
                        onChange={(e) => handleRuleChange(key, 'targetStatus', e.target.value)}
                        className="p-1.5 bg-background border border-input rounded-lg text-xs font-semibold text-foreground outline-none shadow-2xs"
                      >
                        {availableStatuses.map(st => (
                          <option key={st} value={st}>{st}</option>
                        ))}
                      </select>
                    </div>

                    {/* 3. 옵션 체크박스들 */}
                    <div className="flex flex-wrap items-center gap-3 text-xs text-foreground ml-auto">
                      {key.includes('부재') && (
                        <>
                          <label className="flex items-center gap-1.5 cursor-pointer select-none text-muted-foreground hover:text-foreground">
                            <input
                              type="checkbox"
                              checked={rule.incrementMissedCall}
                              onChange={(e) => handleRuleChange(key, 'incrementMissedCall', e.target.checked)}
                              className="rounded border-input text-primary focus:ring-primary"
                            />
                            <span>부재 횟수 누적</span>
                          </label>
                          <label className="flex items-center gap-1.5 cursor-pointer select-none text-muted-foreground hover:text-foreground">
                            <input
                              type="checkbox"
                              checked={rule.queueToLiteDial}
                              onChange={(e) => handleRuleChange(key, 'queueToLiteDial', e.target.checked)}
                              className="rounded border-input text-primary focus:ring-primary"
                            />
                            <span>간편콜 큐 인입</span>
                          </label>
                        </>
                      )}

                      {(key.includes('예약') || key.includes('통화')) && (
                        <label className="flex items-center gap-1.5 cursor-pointer select-none text-muted-foreground hover:text-foreground">
                          <input
                            type="checkbox"
                            checked={rule.autoCalendar}
                            onChange={(e) => handleRuleChange(key, 'autoCalendar', e.target.checked)}
                            className="rounded border-input text-primary focus:ring-primary"
                          />
                          <span>캘린더 일정 생성</span>
                        </label>
                      )}

                      <label className="flex items-center gap-1.5 cursor-pointer select-none">
                        <input
                          type="checkbox"
                          checked={rule.flagCareNeeded}
                          onChange={(e) => handleRuleChange(key, 'flagCareNeeded', e.target.checked)}
                          className="rounded border-input text-destructive focus:ring-destructive"
                        />
                        <span className={rule.flagCareNeeded ? 'text-destructive font-bold' : 'text-muted-foreground hover:text-foreground'}>
                          1차 TM 재케어 알림
                        </span>
                      </label>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* 모달 푸터 */}
        <div className="p-4 border-t border-border bg-muted/30 flex items-center justify-between">
          <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
            <AlertTriangle size={14} strokeWidth={1.75} className="text-amber-500" />
            <span>설정된 룰은 신규 수신되는 피드백부터 실시간으로 즉시 적용됩니다.</span>
          </div>
          <div className="flex gap-2">
            <button
              onClick={() => handleApplyPreset('smart')}
              className="px-3.5 py-2 text-xs font-semibold text-foreground hover:bg-muted bg-card border border-border rounded-lg transition-colors flex items-center gap-1 cursor-pointer shadow-2xs"
            >
              <RotateCcw size={13} strokeWidth={1.75} /> 초기화
            </button>
            <button
              onClick={handleSave}
              disabled={isSaving}
              className="px-5 py-2 text-xs font-bold text-primary-foreground bg-primary hover:bg-primary/90 rounded-lg shadow-xs transition-colors disabled:opacity-50 flex items-center gap-1.5 cursor-pointer"
            >
              {isSaving ? '저장 중...' : (
                <>
                  <Check size={14} strokeWidth={1.75} /> 규칙 저장 및 적용
                </>
              )}
            </button>
          </div>
        </div>

      </div>
    </div>
  );
};
