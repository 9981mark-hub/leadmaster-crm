import React, { useState, useMemo } from 'react';
import { Calendar, Copy, Check, Sparkles, AlertCircle, UserCheck } from 'lucide-react';

interface AgeCalculatorTabProps {
  onInsertToMemo?: (text: string) => void;
  showToast?: (msg: string, type?: 'success' | 'error' | 'info') => void;
}

export const AgeCalculatorTab: React.FC<AgeCalculatorTabProps> = ({ onInsertToMemo, showToast }) => {
  const [birthInput, setBirthInput] = useState('960515');
  const [targetDateInput, setTargetDateInput] = useState(() => {
    return new Date().toISOString().slice(0, 10);
  });
  const [copied, setCopied] = useState(false);

  // 생년월일 파싱 및 계산 (2자리 출생연도·4자리·6자리·8자리 지원, 1900년대 생은 100세 이하만 계산)
  const calculationState = useMemo(() => {
    const raw = birthInput.replace(/\D/g, '');
    if (![2, 4, 6, 8].includes(raw.length)) {
      return { result: null, errorMsg: null };
    }

    const targetDate = new Date(targetDateInput);
    if (isNaN(targetDate.getTime())) {
      return { result: null, errorMsg: null };
    }

    const targetYear = targetDate.getFullYear();
    const min1900Year = targetYear - 100; // 1900년대 생은 100세까지만 허용
    const currentTwoDigit = targetYear % 100;

    let year = 0;
    let month = 0;
    let day = 0;
    let isYearOnly = false;

    const resolveTwoDigitYear = (yy: number) => {
      // 00~현재연도 뒤 2자리(예: 00, 10, 20, 26) -> 2000년대, 그 이후(27~99, 예: 77) -> 1900년대
      return yy <= currentTwoDigit ? 2000 + yy : 1900 + yy;
    };

    if (raw.length === 2) {
      year = resolveTwoDigitYear(parseInt(raw, 10));
      isYearOnly = true;
    } else if (raw.length === 4) {
      year = parseInt(raw, 10);
      isYearOnly = true;
    } else if (raw.length === 6) {
      year = resolveTwoDigitYear(parseInt(raw.slice(0, 2), 10));
      month = parseInt(raw.slice(2, 4), 10);
      day = parseInt(raw.slice(4, 6), 10);
    } else {
      year = parseInt(raw.slice(0, 4), 10);
      month = parseInt(raw.slice(4, 6), 10);
      day = parseInt(raw.slice(6, 8), 10);
    }

    if (year > targetYear) {
      return { result: null, errorMsg: `${targetYear}년 이후 출생자는 계산할 수 없습니다.` };
    }

    if (year < 2000 && year < min1900Year) {
      return {
        result: null,
        errorMsg: `1900년대 생은 100세(${min1900Year}년생)까지만 계산합니다.`,
      };
    }

    if (!isYearOnly && (month < 1 || month > 12 || day < 1 || day > 31)) {
      return { result: null, errorMsg: null };
    }

    // 연 나이 = 기준연도 - 출생연도
    const yearAge = targetYear - year;

    let internationalAge = yearAge;
    let hasPassedBirthday = true;
    let dDay = 0;

    if (!isYearOnly) {
      const birthDate = new Date(year, month - 1, day);
      if (isNaN(birthDate.getTime())) {
        return { result: null, errorMsg: null };
      }

      hasPassedBirthday =
        targetDate.getMonth() > birthDate.getMonth() ||
        (targetDate.getMonth() === birthDate.getMonth() && targetDate.getDate() >= birthDate.getDate());

      if (!hasPassedBirthday) {
        internationalAge -= 1;
      }

      const nextBirthday = new Date(targetYear, month - 1, day);
      if (nextBirthday < targetDate) {
        nextBirthday.setFullYear(targetYear + 1);
      }
      const diffTime = nextBirthday.getTime() - targetDate.getTime();
      dDay = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
    }

    // 법률 및 실무 특례 판정
    const isYouthSpecial = internationalAge >= 19 && internationalAge <= 29;
    const isSenior = internationalAge >= 65;
    const isMinorDependent = internationalAge < 19;

    return {
      errorMsg: null,
      result: {
        isYearOnly,
        formattedBirth: isYearOnly ? `${year}년생 (월·일 미입력)` : `${year}년 ${month}월 ${day}일`,
        internationalAge,
        yearAge,
        hasPassedBirthday,
        dDay,
        isYouthSpecial,
        isSenior,
        isMinorDependent,
      },
    };
  }, [birthInput, targetDateInput]);

  const calculationResult = calculationState.result;

  // 상담 스크립트 생성
  const consultationScript = useMemo(() => {
    if (!calculationResult) return '';
    const { internationalAge, isYouthSpecial, isSenior } = calculationResult;

    if (calculationResult.isYearOnly) {
      const minIntAge = Math.max(0, calculationResult.yearAge - 1);
      return `고객님(${calculationResult.formattedBirth})은 올해 연 나이 ${calculationResult.yearAge}세, 만 나이는 생일 전후에 따라 만 ${minIntAge}~${calculationResult.yearAge}세입니다.`;
    }
    if (isYouthSpecial) {
      return `고객님께서는 현재 만 ${internationalAge}세로 [청년 특례 대상자]에 해당하십니다. 서울·수원·부산회생법원 실무준칙에 따라 일반 36개월이 아닌 24개월(2년) 만에 조기 면책받으실 수 있는 혜택이 적용될 수 있습니다.`;
    }
    if (isSenior) {
      return `고객님께서는 현재 만 ${internationalAge}세 고령자로 분류되어, 생계비 산정 시 특례 검토 또는 상황에 따라 파산·면책 절차를 신속하게 진행하기에 매우 유리합니다.`;
    }
    return `고객님의 현재 만 나이는 만 ${internationalAge}세(연 나이 ${calculationResult.yearAge}세)입니다.`;
  }, [calculationResult]);

  const handleCopy = () => {
    if (!consultationScript) return;
    navigator.clipboard.writeText(consultationScript);
    setCopied(true);
    if (showToast) showToast('상담 스크립트가 클립보드에 복사되었습니다.', 'success');
    setTimeout(() => setCopied(false), 2000);
  };

  const handleInsert = () => {
    if (!consultationScript) return;
    if (onInsertToMemo) {
      onInsertToMemo(`[나이 확인] 만 ${calculationResult?.internationalAge}세 / ${consultationScript}`);
      if (showToast) showToast('상담 메모에 반영되었습니다.', 'success');
    } else {
      handleCopy();
    }
  };

  return (
    <div className="space-y-4 text-xs">
      {/* 1. 입력 영역 */}
      <div className="bg-card p-4 rounded-xl border border-border space-y-3">
        <div>
          <label className="block text-2xs font-semibold text-muted-foreground mb-1">
            🎂 출생연도 2자리 또는 생년월일 (2·4·6·8자리)
          </label>
          <div className="flex gap-2">
            <input
              type="text"
              value={birthInput}
              onChange={(e) => setBirthInput(e.target.value)}
              placeholder="예: 77, 00, 10, 20 또는 960515"
              maxLength={8}
              className="flex-1 px-3 py-2 text-sm font-mono font-bold bg-background border border-input rounded-lg text-foreground focus:outline-none focus:ring-1 focus:ring-primary"
            />
            <button
              onClick={() => setBirthInput('')}
              className="px-2.5 py-1 text-xs text-muted-foreground hover:text-foreground bg-muted/40 rounded-lg"
            >
              지우기
            </button>
          </div>
        </div>

        <div>
          <label className="block text-2xs font-semibold text-muted-foreground mb-1">
            📅 기준일 (기본값: 오늘)
          </label>
          <div className="relative">
            <input
              type="date"
              value={targetDateInput}
              onChange={(e) => setTargetDateInput(e.target.value)}
              className="w-full px-3 py-1.5 text-xs font-mono bg-background border border-input rounded-lg text-foreground focus:outline-none focus:ring-1 focus:ring-primary"
            />
          </div>
        </div>
      </div>

      {/* 2. 계산 결과 카드 */}
      {calculationResult ? (
        <div className="bg-card p-4 rounded-xl border border-border space-y-3">
          <div className="flex items-center justify-between border-b border-border pb-2">
            <span className="text-2xs text-muted-foreground">출생: {calculationResult.formattedBirth}</span>
            {!calculationResult.isYearOnly && (
              <span className="text-2xs font-mono text-muted-foreground">
                다음 생일까지 D-{calculationResult.dDay === 0 ? 'Day' : calculationResult.dDay}
              </span>
            )}
          </div>

          <div className="grid grid-cols-2 gap-3 py-1">
            <div className="p-3 rounded-lg bg-primary/10 border border-primary/20 text-center">
              <span className="block text-2xs text-primary font-medium">법적 만 나이</span>
              <span className="text-2xl font-bold font-mono text-primary">
                {calculationResult.isYearOnly
                  ? `만 ${Math.max(0, calculationResult.yearAge - 1)}~${calculationResult.yearAge}세`
                  : `만 ${calculationResult.internationalAge}세`}
              </span>
            </div>
            <div className="p-3 rounded-lg bg-muted/30 border border-border text-center">
              <span className="block text-2xs text-muted-foreground font-medium">연 나이 (올해 생일 기준)</span>
              <span className="text-xl font-bold font-mono text-foreground">
                {calculationResult.yearAge}세
              </span>
            </div>
          </div>

          {/* 특례 판정 배지 */}
          <div className="space-y-1.5 pt-1">
            {calculationResult.isYouthSpecial && (
              <div className="p-2.5 rounded-lg bg-emerald-500/15 border border-emerald-500/30 text-emerald-400 flex items-start gap-2">
                <Sparkles className="w-4 h-4 shrink-0 mt-0.5" />
                <div>
                  <strong className="block text-xs font-bold">✨ [청년 특례] 24개월 변제 단축 검토 대상</strong>
                  <p className="text-2xs opacity-90 mt-0.5">
                    만 19세~29세 이하: 서울·수원·부산회생법원 실무준칙에 따라 변제기간 3년 ➔ 2년 단축 적극 신청 가능.
                  </p>
                </div>
              </div>
            )}

            {calculationResult.isSenior && (
              <div className="p-2.5 rounded-lg bg-amber-500/15 border border-amber-500/30 text-amber-400 flex items-start gap-2">
                <UserCheck className="w-4 h-4 shrink-0 mt-0.5" />
                <div>
                  <strong className="block text-xs font-bold">🧓 [고령자 특례] 파산 신속 면책 검토 대상</strong>
                  <p className="text-2xs opacity-90 mt-0.5">
                    만 65세 이상: 최저생계비 추가 인정 또는 생계형 채무의 경우 파산·면책 신속 심사 고려.
                  </p>
                </div>
              </div>
            )}

            {calculationResult.isMinorDependent && (
              <div className="p-2.5 rounded-lg bg-blue-500/15 border border-blue-500/30 text-blue-400 flex items-start gap-2">
                <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
                <div>
                  <strong className="block text-xs font-bold">👶 [미성년자] 부양가족 산정 대상</strong>
                  <p className="text-2xs opacity-90 mt-0.5">
                    만 19세 미만 자녀는 개인회생 최저생계비 산정 시 1인 부양가족으로 100% 인정 가능.
                  </p>
                </div>
              </div>
            )}
          </div>

          {/* 상담 추천 멘트 */}
          <div className="mt-2 p-3 rounded-lg bg-muted/40 border border-border">
            <span className="block text-2xs font-semibold text-muted-foreground mb-1">
              💬 상담원 추천 스크립트
            </span>
            <p className="text-xs text-foreground leading-relaxed break-keep">
              {consultationScript}
            </p>
          </div>

          {/* 하단 액션 버튼 */}
          <div className="flex gap-2 pt-1">
            <button
              onClick={handleCopy}
              className="flex-1 flex items-center justify-center gap-1.5 px-3 py-2 bg-card hover:bg-muted text-foreground border border-border rounded-lg text-xs font-semibold shadow-2xs transition-colors"
            >
              {copied ? <Check className="w-3.5 h-3.5 text-primary" /> : <Copy className="w-3.5 h-3.5" />}
              {copied ? '복사 완료!' : '스크립트 복사'}
            </button>
            <button
              onClick={handleInsert}
              className="flex-1 flex items-center justify-center gap-1.5 px-3 py-2 bg-primary hover:bg-primary/90 text-primary-foreground rounded-lg text-xs font-semibold shadow-2xs transition-colors"
            >
              상담 메모에 반영
            </button>
          </div>
        </div>
      ) : (
        <div className="bg-card p-6 rounded-xl border border-border text-center text-muted-foreground">
          {calculationState.errorMsg || '출생연도 2자리(예: 77, 00, 10, 20) 또는 생년월일 6자리(예: 960515)를 입력해주세요.'}
        </div>
      )}
    </div>
  );
};
