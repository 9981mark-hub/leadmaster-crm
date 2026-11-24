import React, { useState, useMemo } from 'react';
import { Home, ShieldCheck, AlertCircle, Copy, Check, Info } from 'lucide-react';
import { HOUSING_EXEMPTION_REGIONS, STATUTORY_EXEMPT_ASSETS, checkDepositExemption } from '../data/exemptAssetLimits';

interface ExemptAssetTabProps {
  onInsertToMemo?: (text: string) => void;
  showToast?: (msg: string, type?: 'success' | 'error' | 'info') => void;
}

export const ExemptAssetTab: React.FC<ExemptAssetTabProps> = ({ onInsertToMemo, showToast }) => {
  const [selectedRegionKey, setSelectedRegionKey] = useState('seoul');
  const [depositInput, setDepositInput] = useState('10000'); // 만원 단위 (기본 1억원)
  const [copied, setCopied] = useState(false);

  // 판정 계산
  const result = useMemo(() => {
    const depositAmount = (parseFloat(depositInput) || 0) * 10000;
    return checkDepositExemption(selectedRegionKey, depositAmount);
  }, [selectedRegionKey, depositInput]);

  const formatMoney = (val: number) => {
    if (val <= 0) return '0원';
    const manwon = Math.floor(val / 10000);
    if (manwon >= 10000) {
      const eok = Math.floor(manwon / 10000);
      const rem = manwon % 10000;
      return rem > 0 ? `${eok}억 ${rem.toLocaleString()}만원` : `${eok}억원`;
    }
    return `${manwon.toLocaleString()}만원`;
  };

  // 상담 스크립트
  const scriptText = useMemo(() => {
    return `[면제재산 및 임차보증금 판정]
• 적용 권역: ${result.region.name} (소액임차 한도: ${formatMoney(result.region.maxDeposit)})
• 고객 실제 보증금: ${depositInput}만원
• 소액임차보증금 해당: ${result.isEligibleForSmallDeposit ? '✅ 해당 (보호 대상)' : '❌ 기준 초과 (전액 재산 반영)'}
• 최우선변제 면제액(재산 제외): ${formatMoney(result.protectedAmount)}
• 회생 재산목록(청산가치) 반영액: ${formatMoney(result.liquidationValue)}`;
  }, [result, depositInput]);

  const handleCopy = () => {
    navigator.clipboard.writeText(scriptText);
    setCopied(true);
    if (showToast) showToast('면제재산 판정 결과가 복사되었습니다.', 'success');
    setTimeout(() => setCopied(false), 2000);
  };

  const handleInsert = () => {
    if (onInsertToMemo) {
      onInsertToMemo(scriptText);
      if (showToast) showToast('상담 메모에 반영되었습니다.', 'success');
    } else {
      handleCopy();
    }
  };

  return (
    <div className="space-y-4 text-xs">
      {/* 1. 지역 권역 선택 */}
      <div className="bg-card p-4 rounded-xl border border-border space-y-2">
        <label className="block text-2xs font-semibold text-muted-foreground">
          📍 주택 소재지 권역 선택 (주택임대차보호법 최신 시행령)
        </label>
        <div className="grid grid-cols-2 gap-1.5">
          {HOUSING_EXEMPTION_REGIONS.map((r) => {
            const isSelected = selectedRegionKey === r.key;
            return (
              <button
                key={r.key}
                onClick={() => setSelectedRegionKey(r.key)}
                className={`p-2 rounded-lg text-left transition-all ${
                  isSelected
                    ? 'bg-primary/10 border border-primary/30 text-primary font-bold'
                    : 'bg-background hover:bg-muted text-foreground border border-border'
                }`}
              >
                <div className="text-2xs font-semibold">{r.name}</div>
                <div className="text-3xs text-muted-foreground mt-0.5 font-mono">
                  한도: {formatMoney(r.maxDeposit)} / 면제: {formatMoney(r.exemptAmount)}
                </div>
              </button>
            );
          })}
        </div>
        <p className="text-3xs text-muted-foreground px-1">
          {result.region.description}
        </p>
      </div>

      {/* 2. 임차보증금 입력 및 결과 */}
      <div className="bg-card p-4 rounded-xl border border-border space-y-3">
        <div>
          <label className="block text-2xs font-semibold text-muted-foreground mb-1">
            🏠 고객 주택 임차보증금 (전세/월세 보증금)
          </label>
          <div className="relative">
            <input
              type="number"
              value={depositInput}
              onChange={(e) => setDepositInput(e.target.value)}
              placeholder="10000"
              className="w-full pl-3 pr-8 py-2 text-sm font-mono font-bold bg-background border border-input rounded-lg text-foreground focus:outline-none focus:ring-1 focus:ring-primary"
            />
            <span className="absolute right-2.5 top-2.5 text-2xs text-muted-foreground">만원</span>
          </div>
        </div>

        {/* 판정 카드 */}
        <div className="grid grid-cols-2 gap-3 pt-1">
          <div className="p-3 rounded-lg bg-emerald-500/10 border border-emerald-500/20">
            <span className="block text-2xs text-emerald-400 font-medium">최우선변제 면제액 (재산 제외)</span>
            <span className="text-xl font-bold font-mono text-emerald-400">
              {formatMoney(result.protectedAmount)}
            </span>
          </div>

          <div className="p-3 rounded-lg bg-muted/40 border border-border">
            <span className="block text-2xs text-muted-foreground font-medium">청산가치(재산) 반영액</span>
            <span className="text-xl font-bold font-mono text-foreground">
              {formatMoney(result.liquidationValue)}
            </span>
          </div>
        </div>

        {result.isEligibleForSmallDeposit ? (
          <div className="p-2.5 rounded-lg bg-emerald-500/15 border border-emerald-500/30 text-emerald-400 text-2xs flex items-center gap-1.5">
            <ShieldCheck className="w-4 h-4 shrink-0" />
            <span>소액임차보증금 요건 충족! 최대 {formatMoney(result.protectedAmount)}까지 채권자 변제 재산에서 제외됩니다.</span>
          </div>
        ) : (
          <div className="p-2.5 rounded-lg bg-amber-500/15 border border-amber-500/30 text-amber-400 text-2xs flex items-center gap-1.5">
            <AlertCircle className="w-4 h-4 shrink-0" />
            <span>보증금이 지역 한도({formatMoney(result.region.maxDeposit)})를 초과하여 전액 재산(청산가치)으로 잡힙니다.</span>
          </div>
        )}

        <div className="flex gap-2 pt-1">
          <button
            onClick={handleCopy}
            className="flex-1 flex items-center justify-center gap-1.5 px-3 py-2 bg-card hover:bg-muted text-foreground border border-border rounded-lg text-xs font-semibold shadow-2xs transition-colors"
          >
            {copied ? <Check className="w-3.5 h-3.5 text-primary" /> : <Copy className="w-3.5 h-3.5" />}
            {copied ? '복사 완료' : '결과 복사'}
          </button>
          <button
            onClick={handleInsert}
            className="flex-1 flex items-center justify-center gap-1.5 px-3 py-2 bg-primary hover:bg-primary/90 text-primary-foreground rounded-lg text-xs font-semibold shadow-2xs transition-colors"
          >
            상담 메모에 반영
          </button>
        </div>
      </div>

      {/* 3. 법정 압류금지 재산 기준표 (아코디언/목록) */}
      <div className="bg-card p-4 rounded-xl border border-border space-y-2">
        <div className="flex items-center gap-1 text-2xs font-semibold text-muted-foreground">
          <Info className="w-3 h-3 text-primary" />
          <span>채무자회생법 법정 압류금지 재산 기준</span>
        </div>
        <div className="space-y-1.5">
          {STATUTORY_EXEMPT_ASSETS.map((item, idx) => (
            <div key={idx} className="p-2.5 rounded-lg bg-muted/30 border border-border flex items-start justify-between gap-2">
              <div>
                <span className="font-bold text-2xs text-foreground block">{item.category}</span>
                <span className="text-3xs text-muted-foreground block mt-0.5">{item.note}</span>
              </div>
              <span className="font-mono font-bold text-xs text-primary shrink-0">
                {item.unit}
              </span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};
