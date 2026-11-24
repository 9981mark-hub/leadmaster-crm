import React, { useState, useMemo } from 'react';
import { BookOpen, Search, Command, Phone, ShieldCheck, CheckSquare, MessageSquare } from 'lucide-react';

interface GuideSection {
  id: string;
  category: string;
  title: string;
  icon: any;
  items: { label: string; desc: string; keyTag?: string }[];
}

const CRM_GUIDE_SECTIONS: GuideSection[] = [
  {
    id: 'shortcuts',
    category: '단축키',
    title: '⌨️ 필수 키보드 단축키 모음',
    icon: Command,
    items: [
      { label: '통합 검색 & 고객 빠른 탐색', desc: '어디서든 고객 이름, 전화번호, 메뉴를 검색', keyTag: 'Ctrl + K' },
      { label: '상담 퀵툴 열기 / 숨기기', desc: '현재 플로팅 상담 퀵툴을 즉시 토글', keyTag: 'Alt + Q' },
      { label: '통화 녹음 재생 / 일시정지', desc: '스마트 오디오 플레이어 즉각 제어', keyTag: 'Space' },
      { label: '오디오 5초 앞뒤 이동', desc: '대화 중요 구간 앞뒤로 탐색', keyTag: 'Shift + ← / →' },
      { label: '신규 케이스 빠른 접수', desc: '퀵 접수 팝업 열기', keyTag: 'Alt + N' },
    ],
  },
  {
    id: 'status_rules',
    category: '리드 상태 규정',
    title: '📋 리드 라이프사이클 처리 기준',
    icon: CheckSquare,
    items: [
      { label: '1. 신규접수', desc: 'DB 유입 즉시 5분 골든타임 내 첫 통화 시도' },
      { label: '2. 부재중(1차~3차)', desc: '통화 실패 시 자동 재통화 알림 등록 및 재통화 예약 주기 준수' },
      { label: '3. 상담진행', desc: '채무/소득/재산/가족관계 파악 및 변제 가능성 1차 검토 완료' },
      { label: '4. 서류안내', desc: '필요 서류(인감, 등초본, 부채증명서 등) 텔레그램/문자 발송 상태' },
      { label: '5. 수임체결', desc: '전자계약 또는 위임계약서 작성 및 착수금/수임료 입금 완료' },
    ],
  },
  {
    id: 'recording_tips',
    category: '통화 녹음',
    title: '🎙️ 통화 녹음 & AI 채무 정리 팁',
    icon: Phone,
    items: [
      { label: 'AI 요약 30초 정리', desc: '통화 종료 후 [AI 요약] 탭에서 채무총액, 부양가족, 소득이 자동 정리됨' },
      { label: '대화록 타임스탬프 클릭', desc: 'AI 대화록의 특정 문장을 클릭하면 해당 통화 구간으로 오디오가 즉시 점프' },
      { label: '1년 만료 & 백업 센터', desc: '녹음은 비공개 암호화 저장소에 1년 보관되며, 만료 전 ZIP 일괄 다운로드 가능' },
    ],
  },
  {
    id: 'telegram_sync',
    category: '텔레그램 연동',
    title: '✈️ 텔레그램 관제 및 고객 소통',
    icon: MessageSquare,
    items: [
      { label: '피드백 승인 대기열', desc: '외부 변호사/사무장이 텔레그램으로 보낸 피드백을 검토 후 원클릭 승인' },
      { label: '자동화 룰 매칭', desc: '특정 키워드 감지 시 케이스 상태가 자동으로 서류완료/보류 등으로 전환' },
      { label: '텔레그램으로 전달', desc: '케이스 상세 상단 [텔레그램 전달] 버튼으로 요약본을 채널에 원클릭 발송' },
    ],
  },
];

export const CrmGuideTab: React.FC = () => {
  const [searchKeyword, setSearchKeyword] = useState('');

  const filteredSections = useMemo(() => {
    if (!searchKeyword.trim()) return CRM_GUIDE_SECTIONS;
    const lower = searchKeyword.toLowerCase();

    return CRM_GUIDE_SECTIONS.map(section => ({
      ...section,
      items: section.items.filter(
        item => item.label.toLowerCase().includes(lower) || item.desc.toLowerCase().includes(lower)
      ),
    })).filter(section => section.items.length > 0);
  }, [searchKeyword]);

  return (
    <div className="space-y-4 text-xs">
      {/* 1. 매뉴얼 검색창 */}
      <div className="bg-card p-3.5 rounded-xl border border-border space-y-2">
        <label className="block text-2xs font-semibold text-muted-foreground">
          📖 리드마스터 사용 가이드 & 단축키 검색
        </label>
        <div className="relative">
          <Search className="w-4 h-4 absolute left-3 top-2.5 text-muted-foreground" />
          <input
            type="text"
            value={searchKeyword}
            onChange={(e) => setSearchKeyword(e.target.value)}
            placeholder="예: 단축키, 녹음, 텔레그램, 상태, 서류..."
            className="w-full pl-9 pr-3 py-2 text-xs bg-background border border-input rounded-lg text-foreground focus:outline-none focus:ring-1 focus:ring-primary"
          />
        </div>
      </div>

      {/* 2. 가이드 섹션 목록 */}
      <div className="space-y-3 max-h-[380px] overflow-y-auto pr-1">
        {filteredSections.map((sec) => (
          <div key={sec.id} className="bg-card p-4 rounded-xl border border-border space-y-2.5">
            <h4 className="font-bold text-xs text-foreground flex items-center gap-1.5 border-b border-border pb-2">
              <sec.icon className="w-3.5 h-3.5 text-primary" />
              {sec.title}
            </h4>

            <div className="space-y-2">
              {sec.items.map((item, idx) => (
                <div key={idx} className="p-2.5 rounded-lg bg-muted/30 border border-border flex items-start justify-between gap-3">
                  <div>
                    <span className="font-semibold text-2xs text-foreground block">
                      {item.label}
                    </span>
                    <span className="text-3xs text-muted-foreground block mt-0.5 leading-relaxed">
                      {item.desc}
                    </span>
                  </div>
                  {item.keyTag && (
                    <kbd className="px-2 py-1 text-3xs font-mono font-bold bg-muted text-primary border border-border rounded-md shrink-0 shadow-2xs">
                      {item.keyTag}
                    </kbd>
                  )}
                </div>
              ))}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};
