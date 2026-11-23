import React, { useState } from 'react';
import { 
  Check, X, ChevronDown, ChevronUp, Layers, 
  HelpCircle, Sparkles, Shield, Cpu, Headphones, Users, FileText
} from 'lucide-react';

interface FeatureCategory {
  categoryName: string;
  icon: React.ReactNode;
  features: {
    name: string;
    description: string;
    starter: boolean | string;
    business: boolean | string;
    pro: boolean | string;
    enterprise: boolean | string;
  }[];
}

const COMPARISON_DATA: FeatureCategory[] = [
  {
    categoryName: 'CTI & 모바일 다이얼러',
    icon: <Headphones size={16} className="text-primary" />,
    features: [
      {
        name: '안드로이드 1초 1콜 초고속 자동 다이얼러',
        description: '앱과 PC 실시간 연동으로 클릭 한 번에 1초 내 즉시 발신',
        starter: true,
        business: true,
        pro: true,
        enterprise: true,
      },
      {
        name: '단말 H/W 32kbps 고음질 모노 초고속 압축',
        description: '녹음 용량을 1/10으로 압축하여 데이터 비용 절감 및 즉각 전송',
        starter: true,
        business: true,
        pro: true,
        enterprise: true,
      },
      {
        name: '스마트 오디오 플레이어 & 구간 점프',
        description: '상담 음성 파형 시각화, 배속 재생 및 핵심 대화록 즉시 점프',
        starter: true,
        business: true,
        pro: true,
        enterprise: true,
      },
      {
        name: '통화 녹음 파일 무제한 보관 기간',
        description: '모든 통화 녹음 파일의 클라우드 안전 보관 기간',
        starter: '1년 보관',
        business: '1년 보관',
        pro: '2년 보관',
        enterprise: '영구 보관',
      },
      {
        name: '녹음 파일 D-30 일괄 백업 센터',
        description: '삭제 예정 녹음 파일 원클릭 대량 다운로드 보장',
        starter: true,
        business: true,
        pro: true,
        enterprise: true,
      },
    ],
  },
  {
    categoryName: 'AI 채무진단 & 트레이닝',
    icon: <Cpu size={16} className="text-primary" />,
    features: [
      {
        name: 'Gemini AI 실시간 통화 대화록 & 채무진단',
        description: '상담 통화 종료 즉시 고객의 총 채무, 연체 기간, 탕감 가능성 자동 추출',
        starter: true,
        business: true,
        pro: true,
        enterprise: true,
      },
      {
        name: '12,000명 AI 가상고객 롤플레잉 트레이닝',
        description: '상담원 채용 및 교육을 위한 실제 악성/진성 고객 시뮬레이션',
        starter: true,
        business: true,
        pro: true,
        enterprise: true,
      },
      {
        name: '상담 품질 AI 스코어링 & 코칭 피드백',
        description: '금지어 발화 감지, 응대 태도 및 성약 성공률 자동 분석',
        starter: false,
        business: true,
        pro: true,
        enterprise: true,
      },
    ],
  },
  {
    categoryName: '조직 관리 & 보안 & 배분',
    icon: <Users size={16} className="text-primary" />,
    features: [
      {
        name: '팀별 실적 대시보드 & 팀장 권한 분리',
        description: '조직별 팀장에게 소속 팀원 리드 및 실적만 열람 권한 부여',
        starter: false,
        business: true,
        pro: true,
        enterprise: true,
      },
      {
        name: '사내 텔레그램 신규 리드 실시간 전송 봇',
        description: '새로운 DB 유입 시 팀장/상담원 방으로 1초 내 즉시 알림',
        starter: false,
        business: true,
        pro: true,
        enterprise: true,
      },
      {
        name: '화면 유출 방지 워터마크 & 대량 마스킹',
        description: '열람자 이름/사번 워터마크 및 상담원용 가운데 4자리 마스킹 통제',
        starter: false,
        business: true,
        pro: true,
        enterprise: true,
      },
      {
        name: '관리자 4대 권한(Tier 1~3, Owner) 정밀 제어',
        description: '정산, 고객 DB, 마케팅, 관리자 권한을 직급별로 세분화 제어',
        starter: false,
        business: false,
        pro: true,
        enterprise: true,
      },
      {
        name: '대량 엑셀 원클릭 분배 엔진',
        description: '10,000건 이상의 대량 DB를 조건별로 팀/상담원에게 즉시 균등 분배',
        starter: false,
        business: false,
        pro: true,
        enterprise: true,
      },
    ],
  },
  {
    categoryName: '인프라 & 전담 고객 지원',
    icon: <Shield size={16} className="text-primary" />,
    features: [
      {
        name: '기본 기술 지원 (이메일 & 채널톡)',
        description: '영업일 기준 상시 Q&A 기술 문의 지원',
        starter: true,
        business: true,
        pro: true,
        enterprise: true,
      },
      {
        name: '전담 온보딩 & 우선 기술 지원',
        description: '도입 초기 단말기 연동 및 세팅 1:1 우선 서포트',
        starter: false,
        business: true,
        pro: true,
        enterprise: true,
      },
      {
        name: 'VIP 전용 초고속 서버 CDN 대역폭 배정',
        description: '대용량 녹음 재생 및 피크 시간대 지연 없는 인프라 보장',
        starter: false,
        business: false,
        pro: true,
        enterprise: true,
      },
      {
        name: '전담 매니저 배정 & 직통 핫라인 긴급 지원',
        description: '장애 발생 시 10분 내 대응 가능한 전담 엔지니어 핫라인',
        starter: false,
        business: false,
        pro: false,
        enterprise: true,
      },
      {
        name: '맞춤형 전용 DB 인프라 격리 & 커스텀 SLA',
        description: '고객사 전용 독립 데이터베이스 인프라 구축 및 99.9% 가동률 보장',
        starter: false,
        business: false,
        pro: false,
        enterprise: true,
      },
    ],
  },
];

export const FeatureComparisonAccordion: React.FC = () => {
  const [isOpen, setIsOpen] = useState(false);

  return (
    <div className="bg-card text-card-foreground rounded-xl border border-border shadow-xs overflow-hidden transition-colors">
      {/* Accordion Trigger Header */}
      <button
        type="button"
        onClick={() => setIsOpen(!isOpen)}
        className="w-full p-5 sm:p-6 flex items-center justify-between text-left hover:bg-muted/40 transition-colors cursor-pointer"
      >
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-primary/10 text-primary border border-primary/20 flex items-center justify-center shrink-0 shadow-2xs">
            <Layers size={20} strokeWidth={1.75} />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <span className="text-xs font-semibold text-primary">
                1:1 스펙 대조
              </span>
              <span className="text-xs text-muted-foreground">•</span>
              <span className="text-xs text-muted-foreground">
                전체 기능 상세 매트릭스
              </span>
            </div>
            <h3 className="text-base sm:text-lg font-bold text-foreground mt-0.5">
              모든 플랜별 전체 기능 상세 비교 매트릭스
            </h3>
          </div>
        </div>

        <div className="flex items-center gap-2 text-xs font-semibold text-muted-foreground hover:text-foreground">
          <span>{isOpen ? '비교표 접기' : '모든 기능 자세히 비교하기'}</span>
          {isOpen ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
        </div>
      </button>

      {/* Accordion Content Table */}
      {isOpen && (
        <div className="border-t border-border overflow-x-auto animate-fadeIn">
          <table className="w-full text-left text-xs">
            <thead>
              <tr className="bg-muted/40 border-b border-border">
                <th className="p-4 font-bold text-foreground w-2/5">기능 명세</th>
                <th className="p-4 font-bold text-center text-muted-foreground w-[15%]">스타터</th>
                <th className="p-4 font-bold text-center text-primary bg-primary/10 border-x border-primary/20 w-[15%]">
                  비즈니스 ★
                </th>
                <th className="p-4 font-bold text-center text-muted-foreground w-[15%]">프로</th>
                <th className="p-4 font-bold text-center text-muted-foreground w-[15%]">엔터프라이즈</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border/60">
              {COMPARISON_DATA.map((cat, catIdx) => (
                <React.Fragment key={catIdx}>
                  {/* Category Header Row */}
                  <tr className="bg-muted/60 font-bold text-foreground border-y border-border">
                    <td colSpan={5} className="py-2.5 px-4 flex items-center gap-2 text-xs font-extrabold text-foreground">
                      {cat.icon}
                      <span>{cat.categoryName}</span>
                    </td>
                  </tr>

                  {/* Feature Rows */}
                  {cat.features.map((item, fIdx) => (
                    <tr key={fIdx} className="hover:bg-muted/30 transition-colors">
                      <td className="p-4">
                        <div className="font-semibold text-foreground">
                          {item.name}
                        </div>
                        <div className="text-[11px] text-muted-foreground mt-0.5">
                          {item.description}
                        </div>
                      </td>

                      {/* Starter */}
                      <td className="p-4 text-center">
                        {typeof item.starter === 'string' ? (
                          <span className="font-bold text-foreground font-mono">{item.starter}</span>
                        ) : item.starter ? (
                          <Check size={16} className="text-primary mx-auto" strokeWidth={2.5} />
                        ) : (
                          <X size={16} className="text-muted-foreground/30 mx-auto" />
                        )}
                      </td>

                      {/* Business (추천 열 강조) */}
                      <td className="p-4 text-center bg-primary/5 border-x border-primary/20">
                        {typeof item.business === 'string' ? (
                          <span className="font-bold text-primary font-mono">{item.business}</span>
                        ) : item.business ? (
                          <Check size={16} className="text-primary mx-auto" strokeWidth={2.5} />
                        ) : (
                          <X size={16} className="text-muted-foreground/30 mx-auto" />
                        )}
                      </td>

                      {/* Pro */}
                      <td className="p-4 text-center">
                        {typeof item.pro === 'string' ? (
                          <span className="font-bold text-foreground font-mono">{item.pro}</span>
                        ) : item.pro ? (
                          <Check size={16} className="text-primary mx-auto" strokeWidth={2.5} />
                        ) : (
                          <X size={16} className="text-muted-foreground/30 mx-auto" />
                        )}
                      </td>

                      {/* Enterprise */}
                      <td className="p-4 text-center">
                        {typeof item.enterprise === 'string' ? (
                          <span className="font-bold text-foreground font-mono">{item.enterprise}</span>
                        ) : item.enterprise ? (
                          <Check size={16} className="text-primary mx-auto" strokeWidth={2.5} />
                        ) : (
                          <X size={16} className="text-muted-foreground/30 mx-auto" />
                        )}
                      </td>
                    </tr>
                  ))}
                </React.Fragment>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
};
