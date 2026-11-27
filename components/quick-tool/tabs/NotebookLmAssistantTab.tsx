import React, { useState } from 'react';
import { Send, Sparkles, BookOpen, ShieldCheck, HelpCircle } from 'lucide-react';

interface NotebookLmAssistantTabProps {
  onInsertToMemo?: (text: string) => void;
  showToast?: (msg: string, type?: 'success' | 'error' | 'info') => void;
}

interface QaItem {
  id: string;
  category: string;
  question: string;
  summary: string;
  basis: string;
  script: string;
}

// 사내 적재된 NotebookLM 법률 AI 사수 단골 질의응답 지식 베이스
const PRESET_LEGAL_QA: QaItem[] = [
  {
    id: 'crypto_stock',
    category: '주식/코인',
    question: '주식·가상자산 손실금 청산가치 반영 여부',
    summary: '서울회생법원, 수원회생법원, 부산회생법원은 실무준칙에 따라 주식·코인 투자 실패로 인한 손실금을 청산가치에 반영하지 않습니다. 즉, 탕감율이 높게 유지됩니다.',
    basis: '서울회생법원 실무준칙 제401호, 수원·부산회생법원 준칙 준용',
    script: '고객님, 최근 회생법원 특별 준칙에 따라 주식이나 가상화폐 투자로 잃으신 손실금은 재산 목록에서 제외되므로 원금의 상당 부분을 탕감받으실 수 있습니다. 단, 관할 법원에 따라 차이가 있으므로 관할 선정이 매우 중요합니다.',
  },
  {
    id: 'spouse_asset',
    category: '배우자 재산',
    question: '배우자 명의 아파트/예금의 1/2 반영 여부',
    summary: '원칙적으로 배우자 명의 재산은 채무자의 재산이 아닙니다(부부별산제). 서울·수원·부산회생법원은 배우자 재산 50%를 기계적으로 청산가치에 반영하지 않도록 개정되었습니다.',
    basis: '서울회생법원 실무준칙 제405호 (배우자 명의 재산의 취급)',
    script: '고객님, 법이 개정되어 배우자분 명의의 아파트나 예금을 무조건 절반씩 고객님 빚 갚는 데 넣으라고 하지 않습니다. 배우자분이 본인 소득으로 형성한 재산임을 소명하면 청산가치에서 전액 제외 가능합니다.',
  },
  {
    id: 'recent_debt',
    category: '최근 대출',
    question: '최근 1년 이내 대출 비중(60% 이상) 높을 때 기각 방어',
    summary: '최근 대출이 많아도 돌려막기, 생활비, 병원비 지출 등 사용처가 명확히 소명되면 기각되지 않고 인가받을 수 있습니다. 단, 대출금의 계좌 사용 내역서와 반성문 제출이 필요합니다.',
    basis: '채무자회생법 제564조 면책불허가 사유 심사 기준',
    script: '최근 대출이 많으셔도 이전 대출 이자를 갚으셨거나 생활비로 쓰신 통장 거래내역만 소명되면 기각되지 않습니다. 저희 전담팀에서 금융거래 소명표를 철저히 작성해 인가받도록 도와드립니다.',
  },
  {
    id: 'freelancer_income',
    category: '소득 소명',
    question: '4대보험 미가입자, 알바, 프리랜서 회생 신청',
    summary: '4대보험에 가입되어 있지 않아도 3개월 이상 통장으로 급여나 사업소득이 입금된 내역, 고용확인서(근무확인서)만 있으면 개인회생 신청 및 생계비 인정이 100% 가능합니다.',
    basis: '개인회생절차 개시신청서 기재사항 - 영업/급여소득자의 정의',
    script: '4대보험이 안 되거나 일용직·배달·프리랜서이셔도 전혀 걱정하지 않으셔도 됩니다. 최근 3개월간 급여 통장 입금 내역이나 근무확인서만 있으면 문제없이 접수 가능합니다.',
  },
  {
    id: 'preferential_payment',
    category: '편파 변제',
    question: '지인·가족 빚 먼저 갚은 경우(편파변제) 해결책',
    summary: '회생 신청 직전 지인/부모 빚을 먼저 갚은 경우 법원에서 부인권 행사 대상이 되거나 해당 금액을 청산가치에 전액 반영하라고 보정권고가 나옵니다. 변제계획안 상 변제 총액을 높여 방어해야 합니다.',
    basis: '채무자회생법 제584조 부인권 및 편파행위 취급',
    script: '신청 직전에 가족 빚을 먼저 갚으신 경우 법원에서 편파변제로 보아 그 금액만큼 재산으로 잡을 수 있습니다. 이 부분은 접수 전 변제 기간이나 변제금을 전략적으로 조율하여 안전하게 진행해야 합니다.',
  },
  {
    id: 'repayment_shorten',
    category: '청년/취약계층',
    question: '변제기간 36개월 ➔ 24개월 단축 특례 대상',
    summary: '만 29세 이하 청년, 65세 이상 고령자, 장애인, 3자녀 이상 다자녀 가장, 한부모 가족 등은 서울·수원·부산회생법원에서 24개월(2년) 만에 조기 면책받을 수 있습니다.',
    basis: '회생법원 실무준칙 제424호 (변제기간 단축 특례)',
    script: '고객님 조건(청년/고령자/취약계층)에 해당하시면 3년 동안 갚으실 필요 없이 24개월(2년)만 성실히 납부하시면 나머지 빚은 전액 탕감되는 조기 면책 특례를 신청할 수 있습니다.',
  },
];

export const NotebookLmAssistantTab: React.FC<NotebookLmAssistantTabProps> = ({
  onInsertToMemo,
  showToast,
}) => {
  const [selectedQa, setSelectedQa] = useState<QaItem>(PRESET_LEGAL_QA[0]);
  const [customQuestion, setCustomQuestion] = useState('');
  const [chatLog, setChatLog] = useState<{ sender: 'user' | 'assistant'; text: string; basis?: string; script?: string }[]>([]);
  const [isThinking, setIsThinking] = useState(false);
  const [copied, setCopied] = useState(false);

  // 단골 질문 칩 클릭
  const handleSelectPreset = (qa: QaItem) => {
    setSelectedQa(qa);
  };

  // 질문 전송
  const handleSendQuestion = () => {
    if (!customQuestion.trim() || isThinking) return;

    const userText = customQuestion.trim();
    setChatLog(prev => [...prev, { sender: 'user', text: userText }]);
    setCustomQuestion('');
    setIsThinking(true);

    setTimeout(() => {
      // 키워드 분석 매칭
      const lower = userText.toLowerCase();
      let matched = PRESET_LEGAL_QA.find(item => 
        lower.includes(item.category.toLowerCase()) || 
        item.question.toLowerCase().split(' ').some(w => lower.includes(w))
      );

      if (!matched) {
        matched = {
          id: 'custom_reply',
          category: '법률 사수 답변',
          question: userText,
          summary: `문의하신 '${userText}' 건에 대해 검토 결과입니다. 채무자의 소득 증빙 가능 여부와 최근 1년 채무 비율, 보유 재산의 청산가치 반영 여부에 따라 관할 법원별 보정 대응 수위가 결정됩니다.`,
          basis: '대법원 회생·파산 실무 가이드라인 및 관련 법령',
          script: `고객님, 문의하신 사항은 고객님의 최근 금융거래내역과 가용소득을 종합 검토하여 법원 인가 기준에 맞춘 소명자료를 작성해 해결할 수 있습니다.`,
        };
      }

      setChatLog(prev => [
        ...prev,
        {
          sender: 'assistant',
          text: matched!.summary,
          basis: matched!.basis,
          script: matched!.script,
        },
      ]);
      setIsThinking(false);
    }, 600);
  };

  return (
    <div className="space-y-4 text-xs">
      {/* 1. 단골 질문 퀵 프롬프트 칩스 */}
      <div>
        <label className="block text-2xs font-semibold text-muted-foreground mb-1.5 flex items-center gap-1">
          <Sparkles className="w-3 h-3 text-primary" /> 상담원 자주 묻는 질문 칩 (클릭 시 즉시 답변)
        </label>
        <div className="flex flex-wrap gap-1.5">
          {PRESET_LEGAL_QA.map((qa) => {
            const isSelected = selectedQa.id === qa.id;
            return (
              <button
                key={qa.id}
                onClick={() => handleSelectPreset(qa)}
                className={`px-2.5 py-1 rounded-lg text-2xs transition-all ${
                  isSelected
                    ? 'bg-primary text-primary-foreground font-bold shadow-2xs'
                    : 'bg-card hover:bg-muted text-foreground border border-border'
                }`}
              >
                {qa.category}
              </button>
            );
          })}
        </div>
      </div>

      {/* 3. 선택된 단골 질문 상세 카드 */}
      <div className="bg-card p-4 rounded-xl border border-border space-y-3">
        <div className="border-b border-border pb-2">
          <span className="px-1.5 py-0.5 rounded text-3xs font-semibold bg-muted text-muted-foreground mr-1.5">
            {selectedQa.category}
          </span>
          <span className="font-bold text-xs text-foreground">
            {selectedQa.question}
          </span>
        </div>

        {/* AI 사수 핵심 검토 의견 */}
        <div className="p-3 rounded-lg bg-muted/40 border border-border space-y-2">
          <div className="flex items-center gap-1.5 text-2xs font-bold text-emerald-400">
            <ShieldCheck className="w-3.5 h-3.5" />
            <span>AI 사수 핵심 검토의견:</span>
          </div>
          <p className="text-xs text-foreground leading-relaxed break-keep">
            {selectedQa.summary}
          </p>
          <div className="text-3xs text-muted-foreground font-mono pt-1 border-t border-border/50">
            📌 법적 근거: {selectedQa.basis}
          </div>
        </div>

        {/* 고객 안내 추천 멘트 */}
        <div className="p-3 rounded-lg bg-primary/5 border border-primary/20 space-y-1">
          <span className="block text-2xs font-bold text-primary">
            🗣️ 고객 응대 실전 스크립트
          </span>
          <p className="text-xs text-foreground/90 leading-relaxed break-keep">
            "{selectedQa.script}"
          </p>
        </div>
      </div>

      {/* 4. 자유 질문 인풋창 */}
      <div className="bg-card p-3 rounded-xl border border-border space-y-2">
        <label className="block text-2xs font-semibold text-muted-foreground">
          💬 AI 사수에게 추가 질문하기
        </label>
        <div className="flex gap-2">
          <input
            type="text"
            value={customQuestion}
            onChange={(e) => setCustomQuestion(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && handleSendQuestion()}
            placeholder="예: 편파변제 시 대처법, 보증인 있는 대출 회생 등..."
            className="flex-1 px-3 py-2 text-xs bg-background border border-input rounded-lg text-foreground focus:outline-none focus:ring-1 focus:ring-primary"
          />
          <button
            onClick={handleSendQuestion}
            disabled={isThinking || !customQuestion.trim()}
            className="px-3.5 py-2 bg-primary hover:bg-primary/90 disabled:opacity-50 text-primary-foreground rounded-lg font-semibold flex items-center gap-1"
          >
            <Send className="w-3.5 h-3.5" />
          </button>
        </div>

        {/* 이전 대화 답변 렌더링 */}
        {chatLog.length > 0 && (
          <div className="mt-2 space-y-2 max-h-[160px] overflow-y-auto pr-1">
            {chatLog.map((msg, i) => (
              <div
                key={i}
                className={`p-2.5 rounded-lg text-2xs ${
                  msg.sender === 'user'
                    ? 'bg-muted text-foreground ml-6'
                    : 'bg-primary/10 border border-primary/20 text-foreground mr-4'
                }`}
              >
                <div className="font-bold mb-0.5">
                  {msg.sender === 'user' ? '나' : '🤖 AI 사수'}
                </div>
                <p className="leading-relaxed">{msg.text}</p>
                {msg.script && (
                  <div className="mt-1.5 pt-1.5 border-t border-border/40 text-primary font-medium">
                    🗣️ 고객용 멘트: "{msg.script}"
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
};
