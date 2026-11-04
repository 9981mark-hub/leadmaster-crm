import React, { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { ShieldCheck, X, DollarSign, Building2, AlertTriangle, Zap, Copy, Check, ChevronRight } from 'lucide-react';

export interface BattlecardItem {
  id: string;
  category: string;
  shortLabel: string;
  icon: any;
  color: string;
  badgeColor: string;
  customerObjection: string;
  counterScript: string;
  bulletPoints: string[];
}

export const BATTLECARDS: BattlecardItem[] = [
  {
    id: 'fee',
    category: '수임료',
    shortLabel: '💰 수임료 분납',
    icon: DollarSign,
    color: 'from-amber-500 to-orange-600',
    badgeColor: 'bg-amber-100 text-amber-800 dark:bg-amber-950/60 dark:text-amber-300',
    customerObjection: '"수임료가 너무 비싸요. 지금 당장 낼 돈이 없어요."',
    counterScript: '"고객님, 저희는 초기 착수금 부담 없이 자체 무이자 4~6회 분납이 가능하십니다. 특히 첫 달 수임료를 다 내시기 전에 법원 금지명령부터 먼저 내려서 모든 빚 독촉과 압류를 중단시켜 드립니다. 매달 대출 이자 내시던 돈보다 훨씬 적은 금액으로 해결하실 수 있습니다."',
    bulletPoints: [
      '초기 착수금 0원 가능 · 자체 무이자 4~6회 분납',
      '첫 달 수임료 완납 전 법원 금지명령 우선 접수',
      '매달 나가던 고금리 이자 지출 즉시 중단',
    ],
  },
  {
    id: 'privacy',
    category: '비밀보장',
    shortLabel: '🏢 직장/가족 비밀',
    icon: Building2,
    color: 'from-blue-600 to-indigo-600',
    badgeColor: 'bg-blue-100 text-blue-800 dark:bg-blue-950/60 dark:text-blue-300',
    customerObjection: '"가족이나 회사에서 알게 될까 봐 무서워요. 비밀로 가능한가요?"',
    counterScript: '"네, 100% 철저히 비밀 보장됩니다! 법원에서 오는 모든 우편물과 안내문은 자택이나 직장이 아닌 저희 법무법인 사무실로 송달받도록 송달영수인을 지정하므로 가족이나 회사에서는 절대 알 수 없습니다. 직장에 통보되는 일도 법적으로 일체 없습니다."',
    bulletPoints: [
      '송달장소 법무법인 사무실 지정 (자택/직장 우편물 0건)',
      '회사/직장 통보 의무 전혀 없음 (비공개 진행)',
      '배우자/가족 모르게 비대면 접수 가능',
    ],
  },
  {
    id: 'rejection',
    category: '기각걱정',
    shortLabel: '🚫 기각 우려/보장',
    icon: ShieldCheck,
    color: 'from-emerald-600 to-teal-600',
    badgeColor: 'bg-emerald-100 text-emerald-800 dark:bg-emerald-950/60 dark:text-emerald-300',
    customerObjection: '"진행하다가 기각되면 돈만 날리고 빚만 남는 것 아닌가요?"',
    counterScript: '"저희 제휴 법인은 최근 3년간 기각률이 1% 미만입니다. 자격 요건이 안 되는 분은 무리하게 진행하지 않고, 1차 심사에서 법원 인가 및 탕감 가능성이 확실한 분만 사건을 수임하므로 안심하셔도 됩니다. 지금 상태로는 충분히 원금 대폭 감면 대상에 해당하십니다."',
    bulletPoints: [
      '최근 3년 법원 인가 성공률 99% 이상',
      '1차 자격 검증 완료 건에 한해서만 안전 수임',
      '법원 보정권고 1:1 전담 피드백 대응',
    ],
  },
  {
    id: 'harassment',
    category: '추심독촉',
    shortLabel: '⚡ 사채/압류 독촉',
    icon: Zap,
    color: 'from-rose-600 to-red-600',
    badgeColor: 'bg-rose-100 text-rose-800 dark:bg-rose-950/60 dark:text-rose-300',
    customerObjection: '"오늘도 집으로 찾아오고 통장 압류한다는데 당장 못 막나요?"',
    counterScript: '"고객님, 오늘 바로 접수 준비 들어가면 3~7일 내로 법원에서 [금지명령]이 내려집니다. 금지명령이 발령되면 채권자가 전화, 문자, 자택 방문 추심을 하는 것은 불법이며 형사처벌 대상이 됩니다. 추심 전화가 오면 \'회생 신청 중이니 법무법인으로 연락하라\'고 하시면 즉시 멈춥니다."',
    bulletPoints: [
      '접수 후 3~7일 이내 법원 금지명령 즉시 발령',
      '금지명령 후 모든 전화/방문 추심 법적 전면 금지',
      '급여/통장 압류 즉시 방어 및 해제 신청',
    ],
  },
];

interface Props {
  onCopyScript?: (text: string) => void;
}

export const LiteBattlecards: React.FC<Props> = ({ onCopyScript }) => {
  const [selectedCard, setSelectedCard] = useState<BattlecardItem | null>(null);
  const [copied, setCopied] = useState(false);

  const handleCopy = (text: string) => {
    navigator.clipboard.writeText(text);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
    if (onCopyScript) onCopyScript(text);
  };

  return (
    <div className="space-y-1.5">
      {/* 4개 1-Tap 칩 바 */}
      <div className="flex items-center gap-1.5 overflow-x-auto pb-1 scrollbar-hide">
        <span className="text-[10px] font-bold text-gray-400 shrink-0 uppercase tracking-wider pl-1">
          반론 치트키:
        </span>
        {BATTLECARDS.map(card => {
          const isActive = selectedCard?.id === card.id;
          return (
            <button
              key={card.id}
              onClick={() => setSelectedCard(isActive ? null : card)}
              className={`shrink-0 px-2.5 py-1.5 rounded-xl text-xs font-bold transition-all shadow-2xs flex items-center gap-1 border active:scale-95 ${
                isActive
                  ? 'bg-blue-600 text-white border-blue-600 ring-2 ring-blue-400/40'
                  : 'bg-white dark:bg-gray-800 text-gray-700 dark:text-gray-200 border-gray-200 dark:border-gray-700 hover:border-blue-400 dark:hover:border-blue-500'
              }`}
            >
              <span>{card.shortLabel}</span>
            </button>
          );
        })}
      </div>

      {/* 펼쳐진 반론 극복 대본 카드 */}
      <AnimatePresence>
        {selectedCard && (
          <motion.div
            initial={{ opacity: 0, height: 0, y: -8 }}
            animate={{ opacity: 1, height: 'auto', y: 0 }}
            exit={{ opacity: 0, height: 0, y: -8 }}
            transition={{ duration: 0.18 }}
            className="overflow-hidden"
          >
            <div className="bg-white dark:bg-gray-800 rounded-2xl p-3.5 border-2 border-blue-400/80 dark:border-blue-500 shadow-md space-y-2.5">
              
              {/* 카드 헤더 */}
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <span className={`text-[10px] font-black px-2 py-0.5 rounded-full ${selectedCard.badgeColor}`}>
                    {selectedCard.category} 대응
                  </span>
                  <span className="text-xs font-bold text-gray-500 dark:text-gray-400">
                    고객 반론: {selectedCard.customerObjection}
                  </span>
                </div>
                <button
                  onClick={() => setSelectedCard(null)}
                  className="p-1 rounded-lg text-gray-400 hover:text-gray-600 dark:hover:text-gray-200 hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors"
                >
                  <X size={15} />
                </button>
              </div>

              {/* 실전 모범 대본 (통화 중 즉시 읽을 수 있는 큼직한 폰트) */}
              <div className="bg-blue-50/70 dark:bg-blue-950/40 p-3 rounded-xl border border-blue-100 dark:border-blue-900/60">
                <p className="text-xs font-semibold text-gray-900 dark:text-gray-100 leading-relaxed font-sans">
                  {selectedCard.counterScript}
                </p>
              </div>

              {/* 핵심 체크포인트 3줄 */}
              <div className="space-y-1">
                {selectedCard.bulletPoints.map((pt, idx) => (
                  <div key={idx} className="flex items-center gap-1.5 text-[11px] text-gray-600 dark:text-gray-300">
                    <Check size={12} className="text-blue-500 shrink-0" />
                    <span>{pt}</span>
                  </div>
                ))}
              </div>

              {/* 하단 대본 복사 버튼 */}
              <div className="flex justify-end pt-1 border-t border-gray-100 dark:border-gray-700">
                <button
                  onClick={() => handleCopy(selectedCard.counterScript)}
                  className="flex items-center gap-1 text-[11px] font-bold text-blue-600 dark:text-blue-400 hover:text-blue-700 px-2.5 py-1 rounded-lg bg-blue-50 dark:bg-blue-900/40 transition-colors"
                >
                  {copied ? <Check size={13} className="text-emerald-500" /> : <Copy size={13} />}
                  <span>{copied ? '복사 완료!' : '대본 복사'}</span>
                </button>
              </div>

            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
};
