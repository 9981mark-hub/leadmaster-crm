/**
 * AutoDialDashboard.tsx — 자동 통화 관리 메인 대시보드
 * 
 * 화면 구성:
 * 1. dashboard: 배치 목록 + 생성 카드 + 통계
 * 2. runner: 자동 통화 실행 화면
 * 3. report: 완료 리포트
 * 
 * NOTE: 완전 독립 컴포넌트 — 기존 시스템 영향 없음
 */
import React, { useState, useEffect, useCallback } from 'react';
import { Phone, FileSpreadsheet, Camera, Play, Pause, Square, Trash2, BarChart3, CheckSquare, RefreshCw, Clock, PhoneCall, PhoneOff, PhoneMissed, Loader2, Plus, Eye } from 'lucide-react';
import { useToast } from '../../contexts/ToastContext';
import { fetchBatches, deleteBatch, updateBatchStatus, AutoDialBatch } from '../../services/autoDialService';
import MissedCallBatchModal from './MissedCallBatchModal';
import ExcelBatchModal from './ExcelBatchModal';
import OcrBatchModal from './OcrBatchModal';
import AutoDialRunner from './AutoDialRunner';
import AutoDialReport from './AutoDialReport';

// Lazy import cases for MissedCallBatchModal
import { fetchCases } from '../../services/api';
import { Case } from '../../types';

type ViewMode = 'dashboard' | 'runner' | 'report';

const AutoDialDashboard: React.FC = () => {
  const [batches, setBatches] = useState<AutoDialBatch[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [activeModal, setActiveModal] = useState<'missed' | 'excel' | 'ocr' | null>(null);
  const [viewMode, setViewMode] = useState<ViewMode>('dashboard');
  const [activeBatchId, setActiveBatchId] = useState<string | null>(null);
  const [cases, setCases] = useState<Case[]>([]);
  const { showToast } = useToast();

  const loadBatches = useCallback(async () => {
    setLoading(true);
    try {
      const data = await fetchBatches();
      setBatches(data);
    } catch (error) {
      console.error('Failed to load batches:', error);
      showToast('배치 목록을 불러오는데 실패했습니다.', 'error');
    } finally {
      setLoading(false);
    }
  }, [showToast]);

  useEffect(() => {
    loadBatches();
  }, [loadBatches]);

  // Load cases for missed call modal
  const loadCases = useCallback(async () => {
    try {
      const data = await fetchCases();
      setCases(data);
    } catch (e) {
      console.error('[AutoDial] Failed to load cases:', e);
    }
  }, []);

  const handleStatusChange = async (id: string, newStatus: AutoDialBatch['status']) => {
    try {
      await updateBatchStatus(id, newStatus);
      showToast('상태가 변경되었습니다.', 'success');
      loadBatches();
    } catch (error) {
      console.error('Status change error:', error);
      showToast('상태 변경에 실패했습니다.', 'error');
    }
  };

  const handleDelete = async (id: string) => {
    if (!window.confirm('정말 이 배치를 삭제하시겠습니까?')) return;
    try {
      await deleteBatch(id);
      showToast('배치가 삭제되었습니다.', 'success');
      loadBatches();
    } catch (error) {
      console.error('Delete error:', error);
      showToast('배치 삭제에 실패했습니다.', 'error');
    }
  };

  const handleStartRunner = (batchId: string) => {
    setActiveBatchId(batchId);
    setViewMode('runner');
  };

  const handleViewReport = (batchId: string) => {
    setActiveBatchId(batchId);
    setViewMode('report');
  };

  const handleBackToDashboard = () => {
    setViewMode('dashboard');
    setActiveBatchId(null);
    loadBatches();
  };

  const handleOpenMissedModal = async () => {
    await loadCases();
    setActiveModal('missed');
  };

  const getSourceInfo = (source: string) => {
    switch (source) {
      case 'missed_calls': return { label: '부재건', icon: <PhoneMissed className="w-4 h-4" /> };
      case 'excel_upload': return { label: '엑셀', icon: <FileSpreadsheet className="w-4 h-4" /> };
      case 'image_ocr': return { label: 'OCR', icon: <Camera className="w-4 h-4" /> };
      case 'sheet_input': return { label: '시트', icon: <FileSpreadsheet className="w-4 h-4" /> };
      case 'manual': return { label: '수동선택', icon: <CheckSquare className="w-4 h-4" /> };
      default: return { label: '기타', icon: <Phone className="w-4 h-4" /> };
    }
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'ready': 
        return <span className="px-2.5 py-1 text-xs font-medium bg-gray-100 text-gray-800 dark:bg-gray-700 dark:text-gray-300 rounded-full flex items-center gap-1 w-fit"><Clock className="w-3 h-3" /> 준비</span>;
      case 'running': 
        return <span className="px-2.5 py-1 text-xs font-medium bg-emerald-100 text-emerald-800 dark:bg-emerald-900/30 dark:text-emerald-400 rounded-full flex items-center gap-1 w-fit animate-pulse"><Play className="w-3 h-3" /> 진행중</span>;
      case 'paused': 
        return <span className="px-2.5 py-1 text-xs font-medium bg-amber-100 text-amber-800 dark:bg-amber-900/30 dark:text-amber-400 rounded-full flex items-center gap-1 w-fit"><Pause className="w-3 h-3" /> 일시정지</span>;
      case 'completed': 
        return <span className="px-2.5 py-1 text-xs font-medium bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-400 rounded-full flex items-center gap-1 w-fit"><CheckSquare className="w-3 h-3" /> 완료</span>;
      case 'cancelled': 
        return <span className="px-2.5 py-1 text-xs font-medium bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-400 rounded-full flex items-center gap-1 w-fit"><Square className="w-3 h-3" /> 취소</span>;
      default: 
        return <span className="px-2.5 py-1 text-xs font-medium bg-gray-100 text-gray-800 dark:bg-gray-700 dark:text-gray-300 rounded-full flex items-center gap-1 w-fit">알 수 없음</span>;
    }
  };

  // Today stats from batches
  const todayStats = batches.reduce((acc, batch) => ({
    total: acc.total + (batch.totalCount || 0),
    connected: acc.connected + (batch.connectedCount || 0),
    noAnswer: acc.noAnswer + (batch.noAnswerCount || 0),
    busy: acc.busy + (batch.busyCount || 0),
  }), { total: 0, connected: 0, noAnswer: 0, busy: 0 });

  // === Runner View ===
  if (viewMode === 'runner' && activeBatchId) {
    return (
      <div className="p-4 md:p-6 lg:p-8 max-w-7xl mx-auto">
        <AutoDialRunner
          batchId={activeBatchId}
          onClose={handleBackToDashboard}
          onComplete={() => {
            setViewMode('report');
          }}
        />
      </div>
    );
  }

  // === Report View ===
  if (viewMode === 'report' && activeBatchId) {
    return (
      <div className="p-4 md:p-6 lg:p-8 max-w-7xl mx-auto">
        <AutoDialReport
          batchId={activeBatchId}
          onClose={handleBackToDashboard}
        />
      </div>
    );
  }

  // === Dashboard View ===
  return (
    <div className="p-4 md:p-6 lg:p-8 max-w-7xl mx-auto space-y-8 animate-in fade-in duration-500">
      {/* Header */}
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
        <div>
          <h1 className="text-2xl md:text-3xl font-bold text-gray-900 dark:text-white flex items-center gap-3">
            <Phone className="w-8 h-8 text-indigo-500" />
            자동 통화 관리
          </h1>
          <p className="text-gray-500 dark:text-gray-400 mt-2 text-sm md:text-base">
            대량의 연락처에 자동으로 발신하고 통화 결과를 스마트하게 관리하세요.
          </p>
        </div>
        <button 
          onClick={loadBatches}
          disabled={loading}
          className="flex items-center gap-2 px-4 py-2 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg shadow-sm hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors text-sm font-medium text-gray-700 dark:text-gray-200 disabled:opacity-50"
        >
          <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
          새로고침
        </button>
      </div>

      {/* Action Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <button 
          onClick={handleOpenMissedModal}
          className="group relative overflow-hidden rounded-2xl bg-gradient-to-br from-blue-500 to-indigo-600 p-6 text-left shadow-lg transition-all hover:-translate-y-1 hover:shadow-xl focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:ring-offset-2 dark:focus:ring-offset-gray-900"
        >
          <div className="absolute -right-8 -top-8 h-32 w-32 rounded-full bg-white/10 blur-2xl transition-all group-hover:bg-white/20"></div>
          <PhoneMissed className="h-8 w-8 text-white/90 mb-4" />
          <h3 className="text-lg font-bold text-white mb-1">부재건 자동 수집</h3>
          <p className="text-blue-100 text-sm line-clamp-2">
            부재중인 고객을 자동으로 수집하여 재발신 리스트를 생성합니다.
          </p>
          <div className="mt-4 flex items-center text-xs font-medium text-white/80">
            <span>새 배치 만들기</span>
            <Plus className="ml-1 h-3 w-3 transition-transform group-hover:translate-x-1" />
          </div>
        </button>

        <button 
          onClick={() => setActiveModal('excel')}
          className="group relative overflow-hidden rounded-2xl bg-gradient-to-br from-emerald-500 to-teal-600 p-6 text-left shadow-lg transition-all hover:-translate-y-1 hover:shadow-xl focus:outline-none focus:ring-2 focus:ring-teal-500 focus:ring-offset-2 dark:focus:ring-offset-gray-900"
        >
          <div className="absolute -right-8 -top-8 h-32 w-32 rounded-full bg-white/10 blur-2xl transition-all group-hover:bg-white/20"></div>
          <FileSpreadsheet className="h-8 w-8 text-white/90 mb-4" />
          <h3 className="text-lg font-bold text-white mb-1">엑셀 업로드</h3>
          <p className="text-emerald-100 text-sm line-clamp-2">
            대량의 연락처를 포함한 엑셀 파일을 업로드하여 통화 리스트를 구성합니다.
          </p>
          <div className="mt-4 flex items-center text-xs font-medium text-white/80">
            <span>새 배치 만들기</span>
            <Plus className="ml-1 h-3 w-3 transition-transform group-hover:translate-x-1" />
          </div>
        </button>

        <button 
          onClick={() => setActiveModal('ocr')}
          className="group relative overflow-hidden rounded-2xl bg-gradient-to-br from-amber-500 to-orange-600 p-6 text-left shadow-lg transition-all hover:-translate-y-1 hover:shadow-xl focus:outline-none focus:ring-2 focus:ring-orange-500 focus:ring-offset-2 dark:focus:ring-offset-gray-900"
        >
          <div className="absolute -right-8 -top-8 h-32 w-32 rounded-full bg-white/10 blur-2xl transition-all group-hover:bg-white/20"></div>
          <Camera className="h-8 w-8 text-white/90 mb-4" />
          <h3 className="text-lg font-bold text-white mb-1">이미지 OCR</h3>
          <p className="text-amber-100 text-sm line-clamp-2">
            명함 등의 이미지를 AI로 스캔하여 연락처를 자동 추출합니다.
          </p>
          <div className="mt-4 flex items-center text-xs font-medium text-white/80">
            <span>새 배치 만들기</span>
            <Plus className="ml-1 h-3 w-3 transition-transform group-hover:translate-x-1" />
          </div>
        </button>
      </div>

      {/* Summary Stats */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <div className="bg-white dark:bg-gray-800 rounded-xl p-4 md:p-5 border border-gray-100 dark:border-gray-700 shadow-sm flex items-center gap-4">
          <div className="p-3 bg-blue-50 dark:bg-blue-900/30 rounded-lg text-blue-600 dark:text-blue-400">
            <BarChart3 className="w-5 h-5 md:w-6 md:h-6" />
          </div>
          <div>
            <p className="text-xs md:text-sm font-medium text-gray-500 dark:text-gray-400">전체 시도</p>
            <p className="text-xl md:text-2xl font-bold text-gray-900 dark:text-white">{todayStats.total}건</p>
          </div>
        </div>
        <div className="bg-white dark:bg-gray-800 rounded-xl p-4 md:p-5 border border-gray-100 dark:border-gray-700 shadow-sm flex items-center gap-4">
          <div className="p-3 bg-emerald-50 dark:bg-emerald-900/30 rounded-lg text-emerald-600 dark:text-emerald-400">
            <PhoneCall className="w-5 h-5 md:w-6 md:h-6" />
          </div>
          <div>
            <p className="text-xs md:text-sm font-medium text-gray-500 dark:text-gray-400">연결 성공</p>
            <p className="text-xl md:text-2xl font-bold text-gray-900 dark:text-white">{todayStats.connected}건</p>
          </div>
        </div>
        <div className="bg-white dark:bg-gray-800 rounded-xl p-4 md:p-5 border border-gray-100 dark:border-gray-700 shadow-sm flex items-center gap-4">
          <div className="p-3 bg-amber-50 dark:bg-amber-900/30 rounded-lg text-amber-600 dark:text-amber-400">
            <PhoneMissed className="w-5 h-5 md:w-6 md:h-6" />
          </div>
          <div>
            <p className="text-xs md:text-sm font-medium text-gray-500 dark:text-gray-400">부재중</p>
            <p className="text-xl md:text-2xl font-bold text-gray-900 dark:text-white">{todayStats.noAnswer}건</p>
          </div>
        </div>
        <div className="bg-white dark:bg-gray-800 rounded-xl p-4 md:p-5 border border-gray-100 dark:border-gray-700 shadow-sm flex items-center gap-4">
          <div className="p-3 bg-red-50 dark:bg-red-900/30 rounded-lg text-red-600 dark:text-red-400">
            <PhoneOff className="w-5 h-5 md:w-6 md:h-6" />
          </div>
          <div>
            <p className="text-xs md:text-sm font-medium text-gray-500 dark:text-gray-400">통화중/거절</p>
            <p className="text-xl md:text-2xl font-bold text-gray-900 dark:text-white">{todayStats.busy}건</p>
          </div>
        </div>
      </div>

      {/* Batch List Table */}
      <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 shadow-sm overflow-hidden flex flex-col">
        <div className="px-6 py-5 border-b border-gray-200 dark:border-gray-700">
          <h2 className="text-lg font-bold text-gray-900 dark:text-white">최근 배치 목록</h2>
        </div>
        
        <div className="overflow-x-auto">
          {loading && batches.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-16">
              <Loader2 className="w-8 h-8 text-indigo-500 animate-spin mb-4" />
              <p className="text-gray-500 dark:text-gray-400">배치 목록을 불러오는 중입니다...</p>
            </div>
          ) : batches.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-16 text-center px-4">
              <div className="w-16 h-16 bg-gray-50 dark:bg-gray-800/50 rounded-full flex items-center justify-center mb-4">
                <FileSpreadsheet className="w-8 h-8 text-gray-400 dark:text-gray-500" />
              </div>
              <h3 className="text-lg font-medium text-gray-900 dark:text-white mb-1">등록된 배치가 없습니다</h3>
              <p className="text-gray-500 dark:text-gray-400 max-w-sm">
                상단의 카드를 클릭하여 새로운 자동 통화 배치를 생성해보세요.
              </p>
            </div>
          ) : (
            <table className="w-full text-left text-sm text-gray-600 dark:text-gray-300">
              <thead className="bg-gray-50/50 dark:bg-gray-800/50 text-gray-700 dark:text-gray-300 font-medium">
                <tr>
                  <th className="px-6 py-4 whitespace-nowrap">배치명</th>
                  <th className="px-6 py-4 whitespace-nowrap">소스</th>
                  <th className="px-6 py-4 whitespace-nowrap">상태</th>
                  <th className="px-6 py-4 min-w-[200px]">진행률</th>
                  <th className="px-6 py-4 text-right whitespace-nowrap">액션</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100 dark:divide-gray-700/50">
                {batches.map((batch) => {
                  const source = getSourceInfo(batch.source);
                  const progressPercentage = batch.totalCount > 0 
                    ? Math.round((batch.completedCount / batch.totalCount) * 100) 
                    : 0;
                    
                  return (
                    <tr key={batch.id} className="hover:bg-gray-50/50 dark:hover:bg-gray-700/20 transition-colors">
                      <td className="px-6 py-4 font-medium text-gray-900 dark:text-gray-100">
                        {batch.name}
                      </td>
                      <td className="px-6 py-4">
                        <div className="flex items-center gap-2">
                          <span className="p-1.5 bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-300 rounded-md">
                            {source.icon}
                          </span>
                          <span>{source.label}</span>
                        </div>
                      </td>
                      <td className="px-6 py-4">
                        {getStatusBadge(batch.status)}
                      </td>
                      <td className="px-6 py-4">
                        <div className="flex items-center gap-3">
                          <div className="flex-1 h-2 bg-gray-100 dark:bg-gray-700 rounded-full overflow-hidden">
                            <div 
                              className={`h-full rounded-full transition-all duration-500 ${
                                batch.status === 'completed' ? 'bg-blue-500' : 
                                batch.status === 'running' ? 'bg-emerald-500' :
                                'bg-indigo-500'
                              }`}
                              style={{ width: `${progressPercentage}%` }}
                            />
                          </div>
                          <span className="text-xs font-medium w-12 text-right">
                            {batch.completedCount}/{batch.totalCount}
                          </span>
                        </div>
                      </td>
                      <td className="px-6 py-4">
                        <div className="flex items-center justify-end gap-1">
                          {(batch.status === 'ready' || batch.status === 'paused') && (
                            <button
                              onClick={() => handleStartRunner(batch.id)}
                              className="p-1.5 text-gray-500 hover:text-emerald-600 dark:text-gray-400 dark:hover:text-emerald-400 hover:bg-emerald-50 dark:hover:bg-emerald-900/30 rounded-lg transition-colors"
                              title="자동 통화 시작"
                            >
                              <Play className="w-4 h-4" />
                            </button>
                          )}
                          {batch.status === 'running' && (
                            <button
                              onClick={() => handleStatusChange(batch.id, 'paused')}
                              className="p-1.5 text-gray-500 hover:text-amber-600 dark:text-gray-400 dark:hover:text-amber-400 hover:bg-amber-50 dark:hover:bg-amber-900/30 rounded-lg transition-colors"
                              title="일시정지"
                            >
                              <Pause className="w-4 h-4" />
                            </button>
                          )}
                          {(batch.status === 'completed' || batch.status === 'cancelled') && (
                            <button
                              onClick={() => handleViewReport(batch.id)}
                              className="p-1.5 text-gray-500 hover:text-blue-600 dark:text-gray-400 dark:hover:text-blue-400 hover:bg-blue-50 dark:hover:bg-blue-900/30 rounded-lg transition-colors"
                              title="리포트 보기"
                            >
                              <Eye className="w-4 h-4" />
                            </button>
                          )}
                          <button
                            onClick={() => handleDelete(batch.id)}
                            className="p-1.5 text-gray-500 hover:text-red-600 dark:text-gray-400 dark:hover:text-red-400 hover:bg-red-50 dark:hover:bg-red-900/30 rounded-lg transition-colors ml-1"
                            title="삭제"
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          )}
        </div>
      </div>

      {/* Modals */}
      <MissedCallBatchModal
        isOpen={activeModal === 'missed'}
        onClose={() => setActiveModal(null)}
        onCreated={() => { setActiveModal(null); loadBatches(); }}
        cases={cases}
        missedStatus="부재"
      />
      <ExcelBatchModal
        isOpen={activeModal === 'excel'}
        onClose={() => setActiveModal(null)}
        onCreated={() => { setActiveModal(null); loadBatches(); }}
      />
      <OcrBatchModal
        isOpen={activeModal === 'ocr'}
        onClose={() => setActiveModal(null)}
        onCreated={() => { setActiveModal(null); loadBatches(); }}
      />
    </div>
  );
};

export default AutoDialDashboard;
