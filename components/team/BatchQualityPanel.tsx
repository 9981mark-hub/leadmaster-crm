import React, { useEffect, useState, useCallback } from 'react';
import { Layers, RefreshCw, TrendingUp, PhoneCall, Send, Award, DollarSign, AlertTriangle, FileSpreadsheet } from 'lucide-react';
import { fetchBatchQualityStats, BatchQualityMetric } from '../../services/batchQuality';

export default function BatchQualityPanel() {
  const [batches, setBatches] = useState<BatchQualityMetric[]>([]);
  const [loading, setLoading] = useState(true);

  const loadData = useCallback(async () => {
    setLoading(true);
    try {
      const data = await fetchBatchQualityStats(30);
      setBatches(data);
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadData();
  }, [loadData]);

  // 전체 통계 집계
  const totals = React.useMemo(() => {
    const totalRows = batches.reduce((acc, b) => acc + b.totalRows, 0);
    const totalInserted = batches.reduce((acc, b) => acc + b.inserted, 0);
    const totalContacted = batches.reduce((acc, b) => acc + b.contactCount, 0);
    const totalTransferred = batches.reduce((acc, b) => acc + b.transferredCount, 0);
    const totalContracted = batches.reduce((acc, b) => acc + b.contractedCount, 0);
    const totalRevenue = batches.reduce((acc, b) => acc + b.totalRevenue, 0);

    const overallContactRate = totalInserted > 0 ? Number(((totalContacted / totalInserted) * 100).toFixed(1)) : 0;
    const overallTransferRate = totalInserted > 0 ? Number(((totalTransferred / totalInserted) * 100).toFixed(1)) : 0;
    const overallContractRate = totalInserted > 0 ? Number(((totalContracted / totalInserted) * 100).toFixed(2)) : 0;

    return {
      totalRows,
      totalInserted,
      totalContacted,
      overallContactRate,
      totalTransferred,
      overallTransferRate,
      totalContracted,
      overallContractRate,
      totalRevenue,
      overallRevenuePerLead: totalInserted > 0 ? Math.round(totalRevenue / totalInserted) : 0,
    };
  }, [batches]);

  return (
    <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 shadow-sm overflow-hidden">
      {/* Header */}
      <div className="p-5 border-b border-gray-100 dark:border-gray-700 flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-2.5">
          <div className="p-2 rounded-lg bg-emerald-600 text-white shadow-sm">
            <Layers size={20} />
          </div>
          <div>
            <h2 className="text-lg font-bold text-gray-800 dark:text-white flex items-center gap-2">
              등록 회차별 DB 품질 및 전환율 분석
              <span className="text-xs px-2 py-0.5 rounded-full bg-emerald-100 text-emerald-800 dark:bg-emerald-900/40 dark:text-emerald-300 font-semibold">
                ROI 추적
              </span>
            </h2>
            <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">
              엑셀 업로드 회차(1차, 2차...)별 통화 연결률, 사무장 전달률, 최종 계약 체결률 및 수임료 매출을 비교 분석합니다.
            </p>
          </div>
        </div>

        <button
          onClick={loadData}
          disabled={loading}
          className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold rounded-lg border border-gray-300 dark:border-gray-600 text-gray-700 dark:text-gray-200 hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors"
        >
          <RefreshCw size={14} className={loading ? 'animate-spin' : ''} />
          새로고침
        </button>
      </div>

      {/* Aggregate Overview Banner */}
      <div className="p-5 bg-gradient-to-r from-gray-50 to-emerald-50/30 dark:from-gray-800 dark:to-gray-800 border-b border-gray-200/60 dark:border-gray-700">
        <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-6 gap-3">
          <div className="bg-white dark:bg-gray-700/60 p-3 rounded-lg border border-gray-100 dark:border-gray-600 shadow-xs">
            <span className="text-xs text-gray-500 dark:text-gray-400">총 인입 DB</span>
            <div className="text-lg font-bold text-gray-800 dark:text-white mt-0.5">
              {totals.totalInserted.toLocaleString()} <span className="text-xs font-normal text-gray-500">건</span>
            </div>
            <span className="text-[10px] text-gray-400">총 {batches.length}개 회차</span>
          </div>

          <div className="bg-white dark:bg-gray-700/60 p-3 rounded-lg border border-gray-100 dark:border-gray-600 shadow-xs">
            <span className="text-xs text-gray-500 dark:text-gray-400 flex items-center gap-1">
              <PhoneCall size={12} className="text-blue-500" /> 통화 연결률
            </span>
            <div className="text-lg font-bold text-blue-600 dark:text-blue-400 mt-0.5">
              {totals.overallContactRate}%
            </div>
            <span className="text-[10px] text-gray-400">{totals.totalContacted.toLocaleString()}건 연결</span>
          </div>

          <div className="bg-white dark:bg-gray-700/60 p-3 rounded-lg border border-gray-100 dark:border-gray-600 shadow-xs">
            <span className="text-xs text-gray-500 dark:text-gray-400 flex items-center gap-1">
              <Send size={12} className="text-purple-500" /> 사무장 전달률
            </span>
            <div className="text-lg font-bold text-purple-600 dark:text-purple-400 mt-0.5">
              {totals.overallTransferRate}%
            </div>
            <span className="text-[10px] text-gray-400">{totals.totalTransferred.toLocaleString()}건 전달</span>
          </div>

          <div className="bg-white dark:bg-gray-700/60 p-3 rounded-lg border border-gray-100 dark:border-gray-600 shadow-xs">
            <span className="text-xs text-gray-500 dark:text-gray-400 flex items-center gap-1">
              <Award size={12} className="text-emerald-500" /> 계약 전환율
            </span>
            <div className="text-lg font-bold text-emerald-600 dark:text-emerald-400 mt-0.5">
              {totals.overallContractRate}%
            </div>
            <span className="text-[10px] text-gray-400">{totals.totalContracted.toLocaleString()}건 계약</span>
          </div>

          <div className="bg-white dark:bg-gray-700/60 p-3 rounded-lg border border-gray-100 dark:border-gray-600 shadow-xs">
            <span className="text-xs text-gray-500 dark:text-gray-400 flex items-center gap-1">
              <DollarSign size={12} className="text-amber-500" /> 총 수임료 매출
            </span>
            <div className="text-lg font-bold text-amber-600 dark:text-amber-400 mt-0.5 truncate">
              ₩{totals.totalRevenue.toLocaleString()}
            </div>
            <span className="text-[10px] text-gray-400">계약 건 합산</span>
          </div>

          <div className="bg-white dark:bg-gray-700/60 p-3 rounded-lg border border-gray-100 dark:border-gray-600 shadow-xs">
            <span className="text-xs text-gray-500 dark:text-gray-400">DB 건당 가치</span>
            <div className="text-lg font-bold text-indigo-600 dark:text-indigo-400 mt-0.5">
              ₩{totals.overallRevenuePerLead.toLocaleString()}
            </div>
            <span className="text-[10px] text-gray-400">유효 1건당 매출 기여</span>
          </div>
        </div>
      </div>

      {/* Batch Table */}
      <div className="overflow-x-auto">
        <table className="w-full text-sm text-left">
          <thead className="bg-gray-50 dark:bg-gray-700/50 text-gray-500 dark:text-gray-300 text-xs uppercase tracking-wider">
            <tr>
              <th className="px-5 py-3">회차명 / 출처</th>
              <th className="px-3 py-3 text-right">인입 / 유효</th>
              <th className="px-3 py-3 text-right">중복 / 제외</th>
              <th className="px-3 py-3 text-right">통화 연결률</th>
              <th className="px-3 py-3 text-right">사무장 전달률</th>
              <th className="px-3 py-3 text-right">계약 전환율</th>
              <th className="px-3 py-3 text-right">총 수임료 매출</th>
              <th className="px-5 py-3 text-center">품질 평가</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100 dark:divide-gray-700">
            {batches.map(b => {
              // 품질 평가 등급
              let badgeColor = 'bg-gray-100 text-gray-700 dark:bg-gray-700 dark:text-gray-300';
              let badgeText = '보통';

              if (b.contactRate >= 60 || b.contractRate >= 3) {
                badgeColor = 'bg-emerald-100 text-emerald-800 dark:bg-emerald-900/40 dark:text-emerald-300 font-bold';
                badgeText = '최우수';
              } else if (b.contactRate >= 45 || b.contractRate >= 1.5) {
                badgeColor = 'bg-blue-100 text-blue-800 dark:bg-blue-900/40 dark:text-blue-300';
                badgeText = '우수';
              } else if (b.contactRate < 25 && b.inserted > 50) {
                badgeColor = 'bg-red-100 text-red-800 dark:bg-red-900/40 dark:text-red-300 font-bold';
                badgeText = '품질점검 필요';
              }

              return (
                <tr key={b.batchId} className="hover:bg-gray-50/80 dark:hover:bg-gray-700/40 transition-colors">
                  <td className="px-5 py-3.5">
                    <div className="font-semibold text-gray-800 dark:text-white flex items-center gap-1.5">
                      <FileSpreadsheet size={15} className="text-gray-400 shrink-0" />
                      <span className="truncate max-w-[200px]" title={b.batchName}>{b.batchName}</span>
                    </div>
                    <div className="text-xs text-gray-400 mt-0.5">
                      {b.source} · {new Date(b.createdAt).toLocaleDateString()}
                    </div>
                  </td>

                  <td className="px-3 py-3.5 text-right tabular-nums">
                    <div className="font-bold text-gray-800 dark:text-gray-100">
                      {b.inserted.toLocaleString()}건
                    </div>
                    <div className="text-[11px] text-gray-400">
                      총 {b.totalRows.toLocaleString()}건 중
                    </div>
                  </td>

                  <td className="px-3 py-3.5 text-right tabular-nums text-xs">
                    <div className="text-gray-600 dark:text-gray-300">
                      중복 {b.duplicates}건
                    </div>
                    {b.invalid > 0 && <div className="text-orange-500">결번/오류 {b.invalid}건</div>}
                  </td>

                  <td className="px-3 py-3.5 text-right tabular-nums">
                    <div className="font-bold text-blue-600 dark:text-blue-400">
                      {b.contactRate}%
                    </div>
                    <div className="text-[11px] text-gray-400">
                      {b.contactCount}건 통화
                    </div>
                  </td>

                  <td className="px-3 py-3.5 text-right tabular-nums">
                    <div className="font-bold text-purple-600 dark:text-purple-400">
                      {b.transferRate}%
                    </div>
                    <div className="text-[11px] text-gray-400">
                      {b.transferredCount}건 연계
                    </div>
                  </td>

                  <td className="px-3 py-3.5 text-right tabular-nums">
                    <div className="font-bold text-emerald-600 dark:text-emerald-400">
                      {b.contractRate}%
                    </div>
                    <div className="text-[11px] text-gray-400">
                      {b.contractedCount}건 체결
                    </div>
                  </td>

                  <td className="px-3 py-3.5 text-right tabular-nums">
                    <div className="font-bold text-gray-800 dark:text-gray-100">
                      ₩{b.totalRevenue.toLocaleString()}
                    </div>
                    <div className="text-[11px] text-indigo-500">
                      건당 ₩{b.revenuePerLead.toLocaleString()}
                    </div>
                  </td>

                  <td className="px-5 py-3.5 text-center">
                    <span className={`inline-block px-2 py-0.5 rounded text-xs ${badgeColor}`}>
                      {badgeText}
                    </span>
                  </td>
                </tr>
              );
            })}

            {!loading && batches.length === 0 && (
              <tr>
                <td colSpan={8} className="px-5 py-12 text-center text-gray-400">
                  등록된 엑셀 업로드 회차 기록이 없습니다.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
