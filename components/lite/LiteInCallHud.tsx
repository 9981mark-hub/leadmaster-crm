import React, { useState } from 'react';
import { Phone, PhoneOff, CheckCircle2, Circle, Clock, AlertCircle, ChevronDown, ChevronUp, User, MapPin, Loader2 } from 'lucide-react';
import { Case, Partner } from '../../types';

interface Props {
  c: Case;
  partner?: Partner;
  elapsedSec: number;
  isCalling?: boolean;
  onOpenPostCall: () => void;
  onQuickMissedCall: () => void;
  onClose: () => void;
}

export const LiteInCallHud: React.FC<Props> = ({
  c,
  partner,
  elapsedSec,
  isCalling = false,
  onOpenPostCall,
  onQuickMissedCall,
  onClose,
}) => {
  // 간단한 체크 상태 (상담원이 탭으로 확인용)
  const [checkedItems, setCheckedItems] = useState<Record<string, boolean>>({});
  const [showPreInfo, setShowPreInfo] = useState(true);

  const toggleCheck = (key: string) => {
    setCheckedItems(prev => ({ ...prev, [key]: !prev[key] }));
  };

  const formatElapsed = (sec: number) => {
    const m = Math.floor(sec / 60);
    const s = sec % 60;
    return `${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`;
  };

  const cleanPhone = String(c.phone || '').replace(/[^0-9]/g, '');
  const formattedPhone = cleanPhone.length === 11
    ? `${cleanPhone.slice(0, 3)}-${cleanPhone.slice(3, 7)}-${cleanPhone.slice(7)}`
    : cleanPhone.length === 10
      ? `${cleanPhone.slice(0, 3)}-${cleanPhone.slice(3, 6)}-${cleanPhone.slice(6)}`
      : c.phone;

  return (
    <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm flex flex-col justify-end md:justify-center md:items-center p-0 md:p-4 animate-in fade-in duration-200">
      <div className="bg-white dark:bg-gray-900 w-full md:max-w-xl max-h-[92vh] rounded-t-3xl md:rounded-2xl shadow-2xl flex flex-col overflow-hidden border border-gray-100 dark:border-gray-800">
        
        {/* 상단 통화 상태 바 */}
        <div className="bg-gradient-to-r from-blue-600 to-indigo-600 text-white p-4 shrink-0 flex items-center justify-between shadow-md">
          <div className="flex items-center gap-3">
            <div className="relative">
              <div className={`w-10 h-10 rounded-full flex items-center justify-center ${isCalling ? 'bg-white/20 animate-pulse' : 'bg-amber-400/30'}`}>
                <Phone size={20} className="text-white" />
              </div>
              <span className={`absolute -top-1 -right-1 w-3.5 h-3.5 border-2 border-white rounded-full ${
                isCalling ? 'bg-green-400' : 'bg-amber-400 animate-ping'
              }`}></span>
            </div>
            <div>
              <div className="flex items-center gap-2">
                <span className="font-bold text-lg">{c.customerName}</span>
                <span className="text-xs bg-white/20 px-2 py-0.5 rounded-full font-medium">
                  {c.caseType || '개인회생'}
                </span>
              </div>
              <p className="text-xs text-blue-100 font-mono mt-0.5">
                {isCalling ? `통화 중 · ${formattedPhone}` : `핸드폰 연결 대기 중... (${formattedPhone})`}
              </p>
            </div>
          </div>

          <div className="flex flex-col items-end">
            {isCalling ? (
              <div className="flex items-center gap-1.5 bg-black/20 px-2.5 py-1 rounded-full text-xs font-mono font-bold tracking-wider">
                <Clock size={13} className="text-emerald-300" />
                <span>{formatElapsed(elapsedSec)}</span>
              </div>
            ) : (
              <div className="flex items-center gap-1.5 bg-amber-400/20 text-amber-200 border border-amber-300/30 px-2.5 py-1 rounded-full text-[11px] font-bold tracking-tight">
                <Loader2 size={12} className="animate-spin text-amber-300" />
                <span>전화 대기 중</span>
              </div>
            )}
            <button
              onClick={onClose}
              className="text-[11px] text-blue-200 hover:text-white mt-1 underline"
            >
              화면 닫기
            </button>
          </div>
        </div>

        {/* 바디: 사전 정보 및 필수 질문 가이드 */}
        <div className="flex-1 overflow-y-auto p-4 space-y-3.5 custom-scrollbar">
          
          {/* 고객 기본 프로필 & 사전 정보 카드 */}
          <div className="bg-blue-50/80 dark:bg-blue-950/40 rounded-xl p-3 border border-blue-100 dark:border-blue-900/50">
            <div 
              className="flex items-center justify-between cursor-pointer"
              onClick={() => setShowPreInfo(!showPreInfo)}
            >
              <div className="flex items-center gap-2 text-xs font-bold text-blue-900 dark:text-blue-200">
                <User size={14} className="text-blue-600 dark:text-blue-400" />
                <span>기본 정보 및 유입 사전 메모</span>
                {c.region && (
                  <span className="flex items-center gap-1 text-[11px] text-gray-500 font-normal">
                    <MapPin size={11} /> {c.region}
                  </span>
                )}
              </div>
              <button className="text-blue-700 dark:text-blue-300 p-0.5">
                {showPreInfo ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
              </button>
            </div>

            {showPreInfo && (
              <div className="mt-2 text-xs text-gray-700 dark:text-gray-300 space-y-1 pt-2 border-t border-blue-200/50 dark:border-blue-900/40">
                {c.preInfo ? (
                  <p className="whitespace-pre-wrap leading-relaxed font-sans bg-white/70 dark:bg-gray-800/70 p-2.5 rounded-lg border border-blue-100 dark:border-gray-700">
                    {c.preInfo}
                  </p>
                ) : (
                  <p className="text-gray-400 italic">사전 메모가 없습니다.</p>
                )}
                <div className="flex flex-wrap gap-2 pt-1 text-[11px] text-gray-500">
                  <span>유입경로: <strong className="text-gray-700 dark:text-gray-300">{c.inboundPath || '기타'}</strong></span>
                  {partner && <span>담당로펌: <strong className="text-gray-700 dark:text-gray-300">{partner.name}</strong></span>}
                </div>
              </div>
            )}
          </div>

          {/* 💡 핵심 질문 가이드 (Cheat-Sheet HUD) */}
          <div className="space-y-2">
            <div className="flex items-center justify-between px-1">
              <h4 className="text-xs font-bold text-gray-700 dark:text-gray-300 flex items-center gap-1.5">
                <span className="w-2 h-2 rounded-full bg-amber-500"></span>
                통화 중 확인 필수 질문 (터치하여 체크)
              </h4>
              <span className="text-[10px] text-gray-400">
                {Object.values(checkedItems).filter(Boolean).length} / 5 확인 완료
              </span>
            </div>

            {/* 질문 1: 직업 & 소득 */}
            <div 
              onClick={() => toggleCheck('q1')}
              className={`p-3 rounded-xl border transition-all cursor-pointer flex items-start gap-3 ${
                checkedItems['q1'] 
                  ? 'bg-emerald-50/70 dark:bg-emerald-950/30 border-emerald-300 dark:border-emerald-800' 
                  : 'bg-white dark:bg-gray-800 border-gray-200 dark:border-gray-700 hover:border-blue-300'
              }`}
            >
              <div className="mt-0.5 text-emerald-600 dark:text-emerald-400 shrink-0">
                {checkedItems['q1'] ? <CheckCircle2 size={18} /> : <Circle size={18} className="text-gray-300 dark:text-gray-600" />}
              </div>
              <div className="flex-1 min-w-0">
                <p className={`text-xs font-bold ${checkedItems['q1'] ? 'text-emerald-900 dark:text-emerald-200 line-through' : 'text-gray-800 dark:text-gray-200'}`}>
                  1. 직업 & 4대보험 가입 여부
                </p>
                <p className="text-[11px] text-gray-500 dark:text-gray-400 mt-0.5">
                  직장인(4대 유/무) / 사업자 / 프리랜서 / 일용직 / 무직
                </p>
              </div>
            </div>

            {/* 질문 2: 실수령 월 소득 */}
            <div 
              onClick={() => toggleCheck('q2')}
              className={`p-3 rounded-xl border transition-all cursor-pointer flex items-start gap-3 ${
                checkedItems['q2'] 
                  ? 'bg-emerald-50/70 dark:bg-emerald-950/30 border-emerald-300 dark:border-emerald-800' 
                  : 'bg-white dark:bg-gray-800 border-gray-200 dark:border-gray-700 hover:border-blue-300'
              }`}
            >
              <div className="mt-0.5 text-emerald-600 dark:text-emerald-400 shrink-0">
                {checkedItems['q2'] ? <CheckCircle2 size={18} /> : <Circle size={18} className="text-gray-300 dark:text-gray-600" />}
              </div>
              <div className="flex-1 min-w-0">
                <p className={`text-xs font-bold ${checkedItems['q2'] ? 'text-emerald-900 dark:text-emerald-200 line-through' : 'text-gray-800 dark:text-gray-200'}`}>
                  2. 월 평균 소득 (세후 실수령액)
                </p>
                <p className="text-[11px] text-gray-500 dark:text-gray-400 mt-0.5">
                  통장에 실제로 찍히는 월 평균 금액 확인 (1인가구 최저생계비 133만원 초과 여부)
                </p>
              </div>
            </div>

            {/* 질문 3: 총 채무액 & 채권사 */}
            <div 
              onClick={() => toggleCheck('q3')}
              className={`p-3 rounded-xl border transition-all cursor-pointer flex items-start gap-3 ${
                checkedItems['q3'] 
                  ? 'bg-emerald-50/70 dark:bg-emerald-950/30 border-emerald-300 dark:border-emerald-800' 
                  : 'bg-white dark:bg-gray-800 border-gray-200 dark:border-gray-700 hover:border-blue-300'
              }`}
            >
              <div className="mt-0.5 text-emerald-600 dark:text-emerald-400 shrink-0">
                {checkedItems['q3'] ? <CheckCircle2 size={18} /> : <Circle size={18} className="text-gray-300 dark:text-gray-600" />}
              </div>
              <div className="flex-1 min-w-0">
                <p className={`text-xs font-bold ${checkedItems['q3'] ? 'text-emerald-900 dark:text-emerald-200 line-through' : 'text-gray-800 dark:text-gray-200'}`}>
                  3. 총 채무액 (원금 합계) 및 채권기관 수
                </p>
                <p className="text-[11px] text-gray-500 dark:text-gray-400 mt-0.5">
                  신용대출 + 카드론 + 현금서비스 + 대부업체 (최소 1,000만원 이상 여부)
                </p>
              </div>
            </div>

            {/* 질문 4: 연체 여부 & 독촉 상태 */}
            <div 
              onClick={() => toggleCheck('q4')}
              className={`p-3 rounded-xl border transition-all cursor-pointer flex items-start gap-3 ${
                checkedItems['q4'] 
                  ? 'bg-emerald-50/70 dark:bg-emerald-950/30 border-emerald-300 dark:border-emerald-800' 
                  : 'bg-white dark:bg-gray-800 border-gray-200 dark:border-gray-700 hover:border-blue-300'
              }`}
            >
              <div className="mt-0.5 text-emerald-600 dark:text-emerald-400 shrink-0">
                {checkedItems['q4'] ? <CheckCircle2 size={18} /> : <Circle size={18} className="text-gray-300 dark:text-gray-600" />}
              </div>
              <div className="flex-1 min-w-0">
                <p className={`text-xs font-bold ${checkedItems['q4'] ? 'text-emerald-900 dark:text-emerald-200 line-through' : 'text-gray-800 dark:text-gray-200'}`}>
                  4. 연체 일수 및 독촉/압류 단계
                </p>
                <p className="text-[11px] text-gray-500 dark:text-gray-400 mt-0.5">
                  연체 전 / 연체 30일 이내 / 90일 이상 연체 / 통장·급여 가압류 진행 중
                </p>
              </div>
            </div>

            {/* 질문 5: 재산 & 부양가족 */}
            <div 
              onClick={() => toggleCheck('q5')}
              className={`p-3 rounded-xl border transition-all cursor-pointer flex items-start gap-3 ${
                checkedItems['q5'] 
                  ? 'bg-emerald-50/70 dark:bg-emerald-950/30 border-emerald-300 dark:border-emerald-800' 
                  : 'bg-white dark:bg-gray-800 border-gray-200 dark:border-gray-700 hover:border-blue-300'
              }`}
            >
              <div className="mt-0.5 text-emerald-600 dark:text-emerald-400 shrink-0">
                {checkedItems['q5'] ? <CheckCircle2 size={18} /> : <Circle size={18} className="text-gray-300 dark:text-gray-600" />}
              </div>
              <div className="flex-1 min-w-0">
                <p className={`text-xs font-bold ${checkedItems['q5'] ? 'text-emerald-900 dark:text-emerald-200 line-through' : 'text-gray-800 dark:text-gray-200'}`}>
                  5. 본인 및 배우자 재산 / 부양가족
                </p>
                <p className="text-[11px] text-gray-500 dark:text-gray-400 mt-0.5">
                  임차보증금 / 부동산 / 차량 / 미성년 자녀 수 (재산 총액이 채무보다 적어야 함)
                </p>
              </div>
            </div>

          </div>
        </div>

        {/* 하단 고정 액션 버튼 바 (엄지 터치 최적화) */}
        <div className="p-3 bg-gray-50 dark:bg-gray-800/90 border-t border-gray-200 dark:border-gray-700 shrink-0 grid grid-cols-2 gap-2.5">
          <button
            onClick={onQuickMissedCall}
            className="flex items-center justify-center gap-1.5 py-3.5 px-3 rounded-xl bg-amber-500 hover:bg-amber-600 text-white font-bold text-sm shadow-md active:scale-95 transition-all"
          >
            <PhoneOff size={16} />
            <span>📵 부재 (카운트+1)</span>
          </button>

          <button
            onClick={onOpenPostCall}
            className="flex items-center justify-center gap-1.5 py-3.5 px-3 rounded-xl bg-blue-600 hover:bg-blue-700 text-white font-bold text-sm shadow-md active:scale-95 transition-all"
          >
            <CheckCircle2 size={16} />
            <span>상담 완료 및 결과 입력</span>
          </button>
        </div>

      </div>
    </div>
  );
};
