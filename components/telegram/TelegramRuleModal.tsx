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
    <div className="fixed inset-0 z-50 bg-black/50 backdrop-blur-xs flex items-center justify-center p-4 overflow-y-auto">
      <div className="bg-white dark:bg-gray-800 rounded-2xl max-w-4xl w-full shadow-2xl border border-gray-100 dark:border-gray-700 overflow-hidden my-8 animate-in fade-in zoom-in-95 duration-200">
        
        {/* 모달 헤더 */}
        <div className="p-6 border-b border-gray-100 dark:border-gray-700 flex items-center justify-between bg-gray-50/70 dark:bg-gray-800/80">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-purple-50 dark:bg-purple-900/30 flex items-center justify-center text-purple-600 dark:text-purple-400">
              <Settings2 size={22} />
            </div>
            <div>
              <h2 className="text-lg font-bold text-gray-900 dark:text-white flex items-center gap-2">
                회사별 텔레그램 피드백 자동화 룰 설정
                <span className="px-2 py-0.5 rounded-full text-xs font-semibold bg-purple-100 text-purple-700 dark:bg-purple-900/50 dark:text-purple-300">
                  오토파일럿 엔진
                </span>
              </h2>
              <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">
                현장 사무소의 피드백 인입 시 우리 회사의 영업 정책에 맞게 상태 변경 및 후속 조치를 자동 실행합니다.
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-2 text-gray-400 hover:text-gray-600 dark:hover:text-gray-200 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-700 transition"
          >
            <X size={20} />
          </button>
        </div>

        {/* 프리셋 바 */}
        <div className="px-6 py-3.5 bg-purple-50/50 dark:bg-purple-950/20 border-b border-purple-100 dark:border-purple-900/30 flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-2 text-xs font-bold text-gray-700 dark:text-gray-300">
            <Sparkles size={14} className="text-purple-600" />
            원클릭 추천 프리셋:
          </div>
          <div className="flex flex-wrap gap-2">
            <button
              onClick={() => handleApplyPreset('smart')}
              className={`px-3 py-1.5 rounded-lg text-xs font-semibold flex items-center gap-1.5 transition ${
                activePreset === 'smart'
                  ? 'bg-purple-600 text-white shadow-xs'
                  : 'bg-white dark:bg-gray-700 text-gray-700 dark:text-gray-200 border border-gray-200 dark:border-gray-600 hover:bg-gray-50'
              }`}
            >
              <Sparkles size={13} /> 스마트 표준 (권장)
            </button>
            <button
              onClick={() => handleApplyPreset('fast')}
              className={`px-3 py-1.5 rounded-lg text-xs font-semibold flex items-center gap-1.5 transition ${
                activePreset === 'fast'
                  ? 'bg-purple-600 text-white shadow-xs'
                  : 'bg-white dark:bg-gray-700 text-gray-700 dark:text-gray-200 border border-gray-200 dark:border-gray-600 hover:bg-gray-50'
              }`}
              title="부재 및 거절 발생 시 즉시 '종결/완료' 처리하여 빠른 콜 순환"
            >
              <Zap size={13} className="text-amber-500" /> 패스트 종결 (회전율 극대화)
            </button>
            <button
              onClick={() => handleApplyPreset('care')}
              className={`px-3 py-1.5 rounded-lg text-xs font-semibold flex items-center gap-1.5 transition ${
                activePreset === 'care'
                  ? 'bg-purple-600 text-white shadow-xs'
                  : 'bg-white dark:bg-gray-700 text-gray-700 dark:text-gray-200 border border-gray-200 dark:border-gray-600 hover:bg-gray-50'
              }`}
              title="모든 부재 및 비용고민 건을 1차 TM 상담원에게 즉시 재배정"
            >
              <Shield size={13} className="text-emerald-500" /> 철저 재케어 (TM 긴급재콜)
            </button>
          </div>
        </div>

        {/* 룰 테이블 */}
        <div className="p-6 max-h-[60vh] overflow-y-auto space-y-4">
          <div className="divide-y divide-gray-100 dark:divide-gray-700">
            {ruleKeys.map(key => {
              const rule = rules[key];
              if (!rule) return null;

              const isAuto = rule.applyMode === 'auto';

              return (
                <div key={key} className="py-4 first:pt-0 last:pb-0 flex flex-col md:flex-row md:items-center justify-between gap-4">
                  {/* 유형 이름 & 설명 */}
                  <div className="w-full md:w-56 shrink-0">
                    <div className="flex items-center gap-2">
                      <span className="font-bold text-sm text-gray-900 dark:text-white">
                        {rule.label || rule.feedbackType}
                      </span>
                    </div>
                    <span className="text-xs text-gray-400 font-mono">[{rule.feedbackType}]</span>
                  </div>

                  {/* 설정 컨트롤들 */}
                  <div className="flex-1 flex flex-wrap items-center gap-3">
                    {/* 1. 처리 방식 토글 */}
                    <div className="flex items-center bg-gray-100 dark:bg-gray-700 p-0.5 rounded-lg text-xs font-medium shrink-0">
                      <button
                        onClick={() => handleRuleChange(key, 'applyMode', 'auto')}
                        className={`px-2.5 py-1 rounded-md transition ${
                          isAuto ? 'bg-white dark:bg-gray-800 text-purple-600 dark:text-purple-400 font-bold shadow-2xs' : 'text-gray-500 hover:text-gray-900'
                        }`}
                      >
                        ⚡ 자동반영
                      </button>
                      <button
                        onClick={() => handleRuleChange(key, 'applyMode', 'pending')}
                        className={`px-2.5 py-1 rounded-md transition ${
                          !isAuto ? 'bg-white dark:bg-gray-800 text-blue-600 dark:text-blue-400 font-bold shadow-2xs' : 'text-gray-500 hover:text-gray-900'
                        }`}
                      >
                        ⏰ 승인대기
                      </button>
                    </div>

                    {/* 2. 변경할 케이스 상태 드롭다운 */}
                    <div className="flex items-center gap-1.5 shrink-0">
                      <span className="text-xs text-gray-400">변경 상태:</span>
                      <select
                        value={rule.targetStatus || ''}
                        onChange={(e) => handleRuleChange(key, 'targetStatus', e.target.value)}
                        className="p-1.5 bg-gray-50 dark:bg-gray-700 border border-gray-200 dark:border-gray-600 rounded-lg text-xs font-bold text-gray-800 dark:text-gray-200 outline-none"
                      >
                        {availableStatuses.map(st => (
                          <option key={st} value={st}>{st}</option>
                        ))}
                      </select>
                    </div>

                    {/* 3. 옵션 체크박스들 */}
                    <div className="flex flex-wrap items-center gap-3 text-xs text-gray-600 dark:text-gray-300 ml-auto">
                      {key.includes('부재') && (
                        <>
                          <label className="flex items-center gap-1 cursor-pointer select-none">
                            <input
                              type="checkbox"
                              checked={rule.incrementMissedCall}
                              onChange={(e) => handleRuleChange(key, 'incrementMissedCall', e.target.checked)}
                              className="rounded border-gray-300 text-purple-600 focus:ring-purple-500"
                            />
                            <span>부재 횟수 누적</span>
                          </label>
                          <label className="flex items-center gap-1 cursor-pointer select-none">
                            <input
                              type="checkbox"
                              checked={rule.queueToLiteDial}
                              onChange={(e) => handleRuleChange(key, 'queueToLiteDial', e.target.checked)}
                              className="rounded border-gray-300 text-purple-600 focus:ring-purple-500"
                            />
                            <span>간편콜 큐 인입</span>
                          </label>
                        </>
                      )}

                      {(key.includes('예약') || key.includes('통화')) && (
                        <label className="flex items-center gap-1 cursor-pointer select-none">
                          <input
                            type="checkbox"
                            checked={rule.autoCalendar}
                            onChange={(e) => handleRuleChange(key, 'autoCalendar', e.target.checked)}
                            className="rounded border-gray-300 text-purple-600 focus:ring-purple-500"
                          />
                          <span>캘린더 일정 생성</span>
                        </label>
                      )}

                      <label className="flex items-center gap-1 cursor-pointer select-none">
                        <input
                          type="checkbox"
                          checked={rule.flagCareNeeded}
                          onChange={(e) => handleRuleChange(key, 'flagCareNeeded', e.target.checked)}
                          className="rounded border-gray-300 text-rose-600 focus:ring-rose-500"
                        />
                        <span className={rule.flagCareNeeded ? 'text-rose-600 dark:text-rose-400 font-bold' : ''}>
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
        <div className="p-4 border-t border-gray-100 dark:border-gray-700 bg-gray-50/50 dark:bg-gray-800/80 flex items-center justify-between">
          <div className="flex items-center gap-1.5 text-xs text-gray-500 dark:text-gray-400">
            <AlertTriangle size={14} className="text-amber-500" />
            <span>설정된 룰은 신규 수신되는 피드백부터 실시간으로 즉시 적용됩니다.</span>
          </div>
          <div className="flex gap-2">
            <button
              onClick={() => handleApplyPreset('smart')}
              className="px-3.5 py-2 text-xs font-semibold text-gray-600 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-xl transition flex items-center gap-1"
            >
              <RotateCcw size={13} /> 초기화
            </button>
            <button
              onClick={handleSave}
              disabled={isSaving}
              className="px-5 py-2 text-xs font-bold text-white bg-purple-600 hover:bg-purple-700 rounded-xl shadow-xs transition disabled:opacity-50 flex items-center gap-1.5"
            >
              {isSaving ? '저장 중...' : (
                <>
                  <Check size={14} /> 규칙 저장 및 적용
                </>
              )}
            </button>
          </div>
        </div>

      </div>
    </div>
  );
};
