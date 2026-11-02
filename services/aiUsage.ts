import { supabase } from './supabase';
import { fetchAiUsage } from './aiProxy';

export const GEMINI_EXCHANGE_RATE = 1390; // 1 USD = 1,390 KRW 기준

export interface TaskStat {
  task: string;
  label: string;
  icon: string;
  count: number;
  inputTokens: number;
  outputTokens: number;
  costKrw: number;
  costUsd: number;
}

export interface AiLogItem {
  id: string;
  task: string;
  taskLabel: string;
  taskIcon: string;
  model: string;
  inputTokens: number;
  outputTokens: number;
  costKrw: number;
  costUsd: number;
  ok: boolean;
  error?: string;
  createdAt: string;
}

export interface DetailedAiUsage {
  todayCount: number;
  dailyCap: number;
  todayInputTokens: number;
  todayOutputTokens: number;
  todayCostUsd: number;
  todayCostKrw: number;

  monthCount: number;
  monthInputTokens: number;
  monthOutputTokens: number;
  monthCostUsd: number;
  monthCostKrw: number;

  taskStats: TaskStat[];
  recentLogs: AiLogItem[];
  lastUpdated: Date;
}

export const TASK_META: Record<string, { label: string; icon: string }> = {
  case_summary: { label: '통화 녹음 AI 정리', icon: '🎙️' },
  summary_extract: { label: '고객 정보 자동 추출', icon: '📋' },
  import_ocr: { label: '신청서·PDF OCR', icon: '📄' },
  image_extract: { label: '이미지 명단 추출', icon: '🖼️' },
  receipt_text: { label: '영수증 인식', icon: '🧾' },
};

/**
 * 토큰 수 및 모델 기반 단가 계산 (Gemini 공식 가격표 기준)
 * - Flash 모델: 입력 $0.075 / 1M, 출력 $0.30 / 1M
 * - Pro 모델: 입력 $1.25 / 1M, 출력 $5.00 / 1M
 */
export function calculateTokenCost(
  inputTokens: number = 0,
  outputTokens: number = 0,
  model: string = ''
): { costUsd: number; costKrw: number } {
  const isPro = /pro/i.test(model);
  const inRate = isPro ? 1.25 : 0.075;
  const outRate = isPro ? 5.00 : 0.30;

  const costUsd = (inputTokens / 1_000_000) * inRate + (outputTokens / 1_000_000) * outRate;
  const costKrw = Math.round(costUsd * GEMINI_EXCHANGE_RATE);

  return {
    costUsd: Number(costUsd.toFixed(5)),
    costKrw,
  };
}

/**
 * 실시간 상세 AI 사용량 및 비용 조회
 */
export async function fetchDetailedAiUsage(): Promise<DetailedAiUsage> {
  const now = new Date();
  // 한국 시간(KST) 오늘 00:00:00 기준
  const kstNow = new Date(now.getTime() + 9 * 3600 * 1000);
  const kstTodayMidnight = new Date(Date.UTC(kstNow.getUTCFullYear(), kstNow.getUTCMonth(), kstNow.getUTCDate(), -9, 0, 0));

  // 1. 기본 RPC 사용량 (오늘 횟수, 상한, 이번 달 횟수, 이번 달 토큰)
  let todayCount = 0;
  let dailyCap = 300;
  let monthCount = 0;
  let monthInputTokens = 0;
  let monthOutputTokens = 0;

  try {
    const base = await fetchAiUsage();
    todayCount = base.today;
    dailyCap = base.cap;
    monthCount = base.month;
    monthInputTokens = base.inputTokensMonth;
    monthOutputTokens = base.outputTokensMonth;
  } catch (e) {
    console.warn('[AI Usage] RPC get_ai_usage fetch fallback:', e);
  }

  // 2. ai_usage_logs 상세 로그 조회
  let todayInputTokens = 0;
  let todayOutputTokens = 0;
  let todayCostUsd = 0;
  let todayCostKrw = 0;
  const taskMap: Record<string, { count: number; inTokens: number; outTokens: number; costUsd: number; costKrw: number }> = {};
  const recentLogs: AiLogItem[] = [];

  if (supabase) {
    try {
      const { data: logs, error } = await supabase
        .from('ai_usage_logs')
        .select('*')
        .order('created_at', { ascending: false })
        .limit(200);

      if (!error && Array.isArray(logs)) {
        // 오늘 로그 집계
        for (const log of logs) {
          const logDate = new Date(log.created_at);
          const inT = Number(log.input_tokens || 0);
          const outT = Number(log.output_tokens || 0);
          const { costUsd, costKrw } = calculateTokenCost(inT, outT, log.model);

          if (logDate >= kstTodayMidnight) {
            todayInputTokens += inT;
            todayOutputTokens += outT;
            todayCostUsd += costUsd;
            todayCostKrw += costKrw;
          }

          // 작업별 집계
          const taskKey = log.task || '기타';
          if (!taskMap[taskKey]) {
            taskMap[taskKey] = { count: 0, inTokens: 0, outTokens: 0, costUsd: 0, costKrw: 0 };
          }
          taskMap[taskKey].count += 1;
          taskMap[taskKey].inTokens += inT;
          taskMap[taskKey].outTokens += outT;
          taskMap[taskKey].costUsd += costUsd;
          taskMap[taskKey].costKrw += costKrw;

          // 최근 로그 10건 포맷
          if (recentLogs.length < 10) {
            const meta = TASK_META[taskKey] || { label: taskKey, icon: '⚡' };
            recentLogs.push({
              id: log.id,
              task: taskKey,
              taskLabel: meta.label,
              taskIcon: meta.icon,
              model: log.model || 'gemini-1.5-flash',
              inputTokens: inT,
              outputTokens: outT,
              costKrw,
              costUsd,
              ok: log.ok !== false,
              error: log.error,
              createdAt: log.created_at,
            });
          }
        }
      }
    } catch (e) {
      console.warn('[AI Usage] Logs query error:', e);
    }
  }

  // 이번 달 누적 비용 계산 (RPC 기준 또는 로그 집계 기준)
  const monthCost = calculateTokenCost(monthInputTokens, monthOutputTokens);

  // 작업별 통계 배열 생성
  const taskStats: TaskStat[] = Object.entries(taskMap).map(([task, st]) => {
    const meta = TASK_META[task] || { label: task, icon: '⚡' };
    return {
      task,
      label: meta.label,
      icon: meta.icon,
      count: st.count,
      inputTokens: st.inTokens,
      outputTokens: st.outTokens,
      costKrw: st.costKrw,
      costUsd: Number(st.costUsd.toFixed(4)),
    };
  }).sort((a, b) => b.count - a.count);

  return {
    todayCount,
    dailyCap,
    todayInputTokens,
    todayOutputTokens,
    todayCostUsd: Number(todayCostUsd.toFixed(4)),
    todayCostKrw,

    monthCount,
    monthInputTokens,
    monthOutputTokens,
    monthCostUsd: monthCost.costUsd,
    monthCostKrw: monthCost.costKrw,

    taskStats,
    recentLogs,
    lastUpdated: new Date(),
  };
}
