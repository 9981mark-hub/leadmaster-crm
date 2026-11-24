import React, { useState, useMemo } from 'react';
import { Search, MapPin, Phone, AlertTriangle, Check, Copy, ShieldCheck, ExternalLink } from 'lucide-react';
import { COURT_JURISDICTION_LIST, CourtJurisdiction, findCompetentCourt } from '../data/courtJurisdictionData';

interface CourtFinderTabProps {
  onInsertToMemo?: (text: string) => void;
  showToast?: (msg: string, type?: 'success' | 'error' | 'info') => void;
}

export const CourtFinderTab: React.FC<CourtFinderTabProps> = ({ onInsertToMemo, showToast }) => {
  const [keyword, setKeyword] = useState('');
  const [selectedCourt, setSelectedCourt] = useState<CourtJurisdiction | null>(() => COURT_JURISDICTION_LIST[0]);
  const [copied, setCopied] = useState(false);

  // 검색 결과
  const searchResults = useMemo(() => {
    return findCompetentCourt(keyword);
  }, [keyword]);

  const handleCopyCourtInfo = (court: CourtJurisdiction) => {
    const text = `[관할법원 안내]
• 거주/직장 지역: ${court.regionName}
• 접수 관할법원: ${court.competentCourt}
• 법원 주소: ${court.courtAddress}
• 대표 전화: ${court.courtPhone}
${court.branchWarning ? `• ⚠️ 주의: ${court.branchWarning}\n` : ''}• 실무 팁: ${court.tips}`;

    navigator.clipboard.writeText(text);
    setCopied(true);
    if (showToast) showToast('관할법원 안내 정보가 복사되었습니다.', 'success');
    setTimeout(() => setCopied(false), 2000);
  };

  const handleInsertToMemo = (court: CourtJurisdiction) => {
    const text = `[관할법원] ${court.competentCourt} (${court.courtAddress} / ☎ ${court.courtPhone})${court.branchWarning ? ` - 주의: ${court.branchWarning}` : ''}`;
    if (onInsertToMemo) {
      onInsertToMemo(text);
      if (showToast) showToast('상담 메모에 법원 정보가 추가되었습니다.', 'success');
    } else {
      handleCopyCourtInfo(court);
    }
  };

  return (
    <div className="space-y-4 text-xs">
      {/* 1. 검색 바 및 퀵 필터 */}
      <div className="bg-card p-4 rounded-xl border border-border space-y-3">
        <label className="block text-2xs font-semibold text-muted-foreground">
          🔍 고객 거주지 또는 직장 소재지 (시·군·구 검색)
        </label>
        <div className="relative">
          <Search className="w-4 h-4 absolute left-3 top-2.5 text-muted-foreground" />
          <input
            type="text"
            value={keyword}
            onChange={(e) => setKeyword(e.target.value)}
            placeholder="예: 부천, 화성, 강남구, 순천, 고양시, 천안..."
            className="w-full pl-9 pr-3 py-2 text-xs bg-background border border-input rounded-lg text-foreground focus:outline-none focus:ring-1 focus:ring-primary"
          />
        </div>

        {/* 퀵 칩스 */}
        <div className="flex flex-wrap gap-1.5 pt-1">
          <span className="text-2xs text-muted-foreground self-center mr-1">주요 회생법원:</span>
          {['서울회생법원', '수원회생법원', '부산회생법원', '인천', '대전', '대구'].map((chip) => (
            <button
              key={chip}
              onClick={() => setKeyword(chip === '서울회생법원' ? '서울' : chip === '수원회생법원' ? '수원' : chip === '부산회생법원' ? '부산' : chip)}
              className="px-2 py-0.5 rounded-md text-2xs bg-muted/40 hover:bg-muted text-foreground border border-border transition-colors"
            >
              {chip}
            </button>
          ))}
          {keyword && (
            <button
              onClick={() => setKeyword('')}
              className="px-2 py-0.5 rounded-md text-2xs text-destructive hover:bg-destructive/10"
            >
              초기화
            </button>
          )}
        </div>
      </div>

      {/* 2. 검색 결과 목록 */}
      <div className="space-y-2 max-h-[300px] overflow-y-auto pr-1">
        <div className="flex items-center justify-between text-2xs text-muted-foreground px-1">
          <span>검색 결과 {searchResults.length}건</span>
          <span>클릭하여 상세 정보 확인</span>
        </div>

        {searchResults.length === 0 ? (
          <div className="bg-card p-6 rounded-xl border border-border text-center text-muted-foreground">
            '{keyword}'에 해당하는 관할 법원을 찾지 못했습니다. 시/군 명칭으로 다시 검색해보세요.
          </div>
        ) : (
          searchResults.map((court, idx) => {
            const isSelected = selectedCourt?.regionName === court.regionName;
            return (
              <div
                key={idx}
                onClick={() => setSelectedCourt(court)}
                className={`p-3.5 rounded-xl border transition-all cursor-pointer ${
                  isSelected
                    ? 'bg-primary/5 border-primary/40 shadow-xs'
                    : 'bg-card hover:bg-muted/30 border-border'
                }`}
              >
                <div className="flex items-start justify-between gap-2">
                  <div className="space-y-1">
                    <div className="flex items-center gap-1.5 flex-wrap">
                      <span className="font-bold text-xs text-foreground">
                        {court.competentCourt}
                      </span>
                      {court.isSpecializedCourt && (
                        <span className="px-1.5 py-0.5 rounded text-3xs font-semibold bg-emerald-500/15 text-emerald-400 border border-emerald-500/25 flex items-center gap-0.5">
                          <ShieldCheck className="w-2.5 h-2.5" /> 회생전담
                        </span>
                      )}
                      <span className="px-1.5 py-0.5 rounded text-3xs bg-muted text-muted-foreground">
                        {court.province}
                      </span>
                    </div>
                    <p className="text-2xs text-muted-foreground line-clamp-1">
                      {court.regionName}
                    </p>
                  </div>
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      handleCopyCourtInfo(court);
                    }}
                    className="p-1.5 text-muted-foreground hover:text-foreground hover:bg-muted rounded-md shrink-0"
                    title="안내 복사"
                  >
                    <Copy className="w-3.5 h-3.5" />
                  </button>
                </div>

                {/* 지원 신청 불가 경고 */}
                {court.branchWarning && (
                  <div className="mt-2 p-2 rounded-lg bg-amber-500/15 border border-amber-500/30 text-amber-400 text-2xs flex items-start gap-1.5">
                    <AlertTriangle className="w-3.5 h-3.5 shrink-0 mt-0.5" />
                    <span>{court.branchWarning}</span>
                  </div>
                )}
              </div>
            );
          })
        )}
      </div>

      {/* 3. 선택 법원 상세 액션 바 */}
      {selectedCourt && (
        <div className="bg-card p-4 rounded-xl border border-border space-y-3">
          <div className="flex items-center justify-between border-b border-border pb-2">
            <span className="font-bold text-xs text-primary flex items-center gap-1">
              <MapPin className="w-3.5 h-3.5" /> {selectedCourt.competentCourt}
            </span>
            <span className="text-2xs font-mono text-muted-foreground flex items-center gap-1">
              <Phone className="w-3 h-3" /> {selectedCourt.courtPhone}
            </span>
          </div>

          <div className="space-y-1 text-2xs text-foreground/90">
            <p><span className="text-muted-foreground">소재지:</span> {selectedCourt.courtAddress}</p>
            <p><span className="text-muted-foreground">실무 팁:</span> {selectedCourt.tips}</p>
          </div>

          <div className="flex gap-2 pt-1">
            <button
              onClick={() => handleCopyCourtInfo(selectedCourt)}
              className="flex-1 flex items-center justify-center gap-1.5 px-3 py-2 bg-card hover:bg-muted text-foreground border border-border rounded-lg text-xs font-semibold shadow-2xs transition-colors"
            >
              {copied ? <Check className="w-3.5 h-3.5 text-primary" /> : <Copy className="w-3.5 h-3.5" />}
              {copied ? '복사 완료' : '고객 안내 복사'}
            </button>
            <button
              onClick={() => handleInsertToMemo(selectedCourt)}
              className="flex-1 flex items-center justify-center gap-1.5 px-3 py-2 bg-primary hover:bg-primary/90 text-primary-foreground rounded-lg text-xs font-semibold shadow-2xs transition-colors"
            >
              상담 메모에 반영
            </button>
          </div>
        </div>
      )}
    </div>
  );
};
