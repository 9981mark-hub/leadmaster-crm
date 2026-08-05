/**
 * AutoDialRunner.tsx
 * 자동 통화 실행 화면 — 순차 발신, 타이머, 큐 관리
 * 
 * NOTE: 이 파일은 완전히 신규 파일이며 기존 시스템에 영향을 주지 않습니다.
 */
import React, { useState, useEffect, useCallback, useRef } from 'react';
import {
  Phone, PhoneOff, PhoneMissed, PhoneCall,
  SkipForward, Pause, Square, Play,
  Clock, User, FileText, ChevronDown, ChevronUp,
  Loader2, CheckCircle2, XCircle, AlertCircle, ArrowLeft
} from 'lucide-react';
import { useToast } from '../../contexts/ToastContext';
import {
  AutoDialBatch, AutoDialItem,
  fetchBatch, fetchBatchItems,
  updateBatchStatus, updateBatchCounts,
  updateItemStatus, skipItem,
  getNextPendingItem, enqueuePendingCall,
  subscribeToAutoDialItems
} from '../../services/autoDialService';

interface AutoDialRunnerProps {
  batchId: string;
  onClose: () => void;
  onComplete: () => void;
}

type RunnerState = 'idle' | 'dialing' | 'ringing' | 'connected' | 'gap_wait' | 'paused' | 'completed';

const AutoDialRunner: React.FC<AutoDialRunnerProps> = ({ batchId, onClose, onComplete }) => {
  const { showToast } = useToast();

  // Core state
  const [batch, setBatch] = useState<AutoDialBatch | null>(null);
  const [items, setItems] = useState<AutoDialItem[]>([]);
  const [currentItem, setCurrentItem] = useState<AutoDialItem | null>(null);
  const [runnerState, setRunnerState] = useState<RunnerState>('idle');
  const [loading, setLoading] = useState(true);

  // Timer state
  const [ringTimer, setRingTimer] = useState(0);
  const [gapTimer, setGapTimer] = useState(0);
  const ringTimerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const gapTimerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const callStartTimeRef = useRef<number>(0);

  // Queue visibility
  const [showQueue, setShowQueue] = useState(false);
  const [showHistory, setShowHistory] = useState(true);

  // Connected state controls
  const [resultMemo, setResultMemo] = useState('');
  const [selectedStatus, setSelectedStatus] = useState('상담중');

  // 발신번호 선택 (투넘버)
  const CARRIER_PREFIXES: Record<string, string> = { skt: '*28#', kt: '*77#', 'lgu+': '*77' };
  const [callerMode, setCallerMode] = useState<'default' | 'two_number'>(
    () => (localStorage.getItem('autodial_caller_mode') as any) || 'default'
  );
  const [selectedCarrier, setSelectedCarrier] = useState<string>(
    () => localStorage.getItem('autodial_carrier') || 'skt'
  );
  const callerPrefixRef = useRef('');

  // Stats
  const stats = {
    total: batch?.totalCount || 0,
    completed: batch?.completedCount || 0,
    connected: batch?.connectedCount || 0,
    noAnswer: batch?.noAnswerCount || 0,
    busy: batch?.busyCount || 0,
    skipped: batch?.skippedCount || 0,
  };

  const progressPercent = stats.total > 0 ? Math.round((stats.completed / stats.total) * 100) : 0;

  // Load batch and items
  const loadData = useCallback(async () => {
    try {
      const [batchData, itemsData] = await Promise.all([
        fetchBatch(batchId),
        fetchBatchItems(batchId)
      ]);
      if (batchData) setBatch(batchData);
      if (itemsData) setItems(itemsData);
    } catch (err) {
      console.error('[AutoDialRunner] Load error:', err);
    } finally {
      setLoading(false);
    }
  }, [batchId]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  // Realtime subscription to items
  useEffect(() => {
    const unsub = subscribeToAutoDialItems(
      batchId,
      (newItem) => {
        setItems(prev => [...prev, newItem]);
      },
      (updatedItem) => {
        setItems(prev => prev.map(i => i.id === updatedItem.id ? updatedItem : i));
        // If this is the current item being updated externally (e.g., by Android)
        if (currentItem && updatedItem.id === currentItem.id) {
          setCurrentItem(updatedItem);
          if (updatedItem.status === 'connected') {
            handleCallConnected();
          } else if (updatedItem.status === 'completed' && updatedItem.result === 'no_answer') {
            handleCallNoAnswer();
          } else if (updatedItem.status === 'completed' && updatedItem.result === 'busy') {
            handleCallBusy();
          }
        }
      }
    );
    return unsub;
  }, [batchId, currentItem]);

  // Ring timer
  useEffect(() => {
    if (runnerState === 'ringing' || runnerState === 'dialing') {
      ringTimerRef.current = setInterval(() => {
        setRingTimer(prev => prev + 1);
      }, 1000);
    } else {
      if (ringTimerRef.current) {
        clearInterval(ringTimerRef.current);
        ringTimerRef.current = null;
      }
    }
    return () => {
      if (ringTimerRef.current) clearInterval(ringTimerRef.current);
    };
  }, [runnerState]);

  // Ring timeout check
  useEffect(() => {
    if ((runnerState === 'ringing' || runnerState === 'dialing') && batch) {
      if (ringTimer >= batch.ringTimeoutSeconds) {
        handleRingTimeout();
      }
    }
  }, [ringTimer, runnerState, batch]);

  // 앱 복귀 감지 (통화 종료 후 자동 진행)
  useEffect(() => {
    const handleVisibilityChange = () => {
      if (document.visibilityState === 'visible') {
        // 앱으로 돌아왔을 때 통화 중이었으면 자동 처리
        if ((runnerState === 'ringing' || runnerState === 'dialing') && currentItem) {
          const elapsed = callStartTimeRef.current > 0 
            ? Math.round((Date.now() - callStartTimeRef.current) / 1000) 
            : 0;
          console.log(`[AutoDial] App resumed after ${elapsed}s - auto-processing call result`);
          
          // 짧은 딜레이 후 처리 (앱이 완전히 복귀할 시간)
          setTimeout(async () => {
            if (elapsed >= 15) {
              // 15초 이상이면 통화 연결된 것으로 추정
              await updateItemStatus(currentItem.id, 'completed', 'connected', {
                callDurationSeconds: elapsed
              });
              await incrementCount('connectedCount');
              showToast(`${currentItem.customerName} 통화 완료 (${elapsed}초)`, 'success');
            } else {
              // 15초 미만이면 미응답/거절
              await updateItemStatus(currentItem.id, 'completed', 'no_answer', {
                ringDurationSeconds: elapsed
              });
              await incrementCount('noAnswerCount');
              showToast(`${currentItem.customerName} 미응답 (${elapsed}초)`, 'warning');
            }
            callStartTimeRef.current = 0;
            startGapWait();
          }, 1000);
        }
      }
    };

    document.addEventListener('visibilitychange', handleVisibilityChange);
    return () => document.removeEventListener('visibilitychange', handleVisibilityChange);
  }, [runnerState, currentItem]);

  // Gap timer
  useEffect(() => {
    if (runnerState === 'gap_wait') {
      gapTimerRef.current = setInterval(() => {
        setGapTimer(prev => {
          if (prev <= 1) {
            // Gap done, dial next
            dialNext();
            return 0;
          }
          return prev - 1;
        });
      }, 1000);
    } else {
      if (gapTimerRef.current) {
        clearInterval(gapTimerRef.current);
        gapTimerRef.current = null;
      }
    }
    return () => {
      if (gapTimerRef.current) clearInterval(gapTimerRef.current);
    };
  }, [runnerState]);

  // === Core Actions ===

  const startAutoDial = async () => {
    if (!batch) return;
    await updateBatchStatus(batchId, 'running');
    setBatch(prev => prev ? { ...prev, status: 'running' } : null);
    setRunnerState('idle');
    dialNext();
  };

  const dialNext = async () => {
    const nextItem = await getNextPendingItem(batchId);
    if (!nextItem) {
      // All done
      await updateBatchStatus(batchId, 'completed');
      setBatch(prev => prev ? { ...prev, status: 'completed' } : null);
      setRunnerState('completed');
      showToast('모든 통화가 완료되었습니다', 'success');
      return;
    }

    setCurrentItem(nextItem);
    setRingTimer(0);
    setRunnerState('dialing');
    setResultMemo('');

    // Update item status to dialing
    await updateItemStatus(nextItem.id, 'dialing');

    const cleanPhone = nextItem.phone.replace(/[^0-9]/g, '');
    
    // Android WebView에서 직접 전화 걸기 (3단계 폴백)
    const androidBridge = (window as any).AndroidBridge;
    
    if (androidBridge?.makeCall) {
      // 방법 1: AndroidBridge.makeCall() — ACTION_CALL (가장 확실)
      // pending_calls 삽입하지 않음 (PendingCallWorker의 ACTION_DIAL 중복 방지)
      console.log('[AutoDial] Using AndroidBridge.makeCall:', callerPrefixRef.current + cleanPhone);
      callStartTimeRef.current = Date.now();
      androidBridge.makeCall(callerPrefixRef.current + cleanPhone);
    } else {
      // 방법 2: pending_calls + tel: 링크 (PC 브라우저 또는 구버전 앱)
      await enqueuePendingCall(nextItem.phone, nextItem.customerName, nextItem.id);
      console.log('[AutoDial] Using tel: link fallback:', cleanPhone);
      callStartTimeRef.current = Date.now();
      window.location.href = `tel:${cleanPhone}`;
    }
    
    setRunnerState('ringing');
  };

  const handleRingTimeout = async () => {
    if (!currentItem) return;
    console.log('[AutoDialRunner] Ring timeout for:', currentItem.customerName);
    await updateItemStatus(currentItem.id, 'completed', 'no_answer', {
      ringDurationSeconds: ringTimer
    });
    await incrementCount('noAnswerCount');
    showToast(`${currentItem.customerName} 미응답 (${ringTimer}초)`, 'warning');
    startGapWait();
  };

  const handleCallConnected = () => {
    console.log('[AutoDialRunner] Call connected!');
    setRunnerState('connected');
    // Pause auto-dialing
  };

  const handleCallNoAnswer = async () => {
    if (!currentItem) return;
    await incrementCount('noAnswerCount');
    startGapWait();
  };

  const handleCallBusy = async () => {
    if (!currentItem) return;
    await incrementCount('busyCount');
    showToast(`${currentItem.customerName} 통화중`, 'warning');
    startGapWait();
  };

  const handleNextAfterConnected = async () => {
    if (!currentItem) return;
    // Mark as connected+completed
    await updateItemStatus(currentItem.id, 'completed', 'connected', {
      resultMemo: resultMemo || undefined,
      callDurationSeconds: ringTimer
    });
    await incrementCount('connectedCount');
    showToast(`${currentItem.customerName} 통화 완료`, 'success');
    dialNext();
  };

  const handleSkipCurrent = async () => {
    if (!currentItem) return;
    await skipItem(currentItem.id);
    await incrementCount('skippedCount');
    showToast(`${currentItem.customerName} 건너뜀`, 'info');
    startGapWait();
  };

  const handleSkipQueued = async (itemId: string) => {
    await skipItem(itemId);
    setItems(prev => prev.map(i => i.id === itemId ? { ...i, status: 'skipped' as const } : i));
    await incrementCount('skippedCount');
  };

  const handlePause = async () => {
    setRunnerState('paused');
    await updateBatchStatus(batchId, 'paused');
    setBatch(prev => prev ? { ...prev, status: 'paused' } : null);
  };

  const handleResume = () => {
    setRunnerState('idle');
    dialNext();
  };

  const handleStop = async () => {
    if (ringTimerRef.current) clearInterval(ringTimerRef.current);
    if (gapTimerRef.current) clearInterval(gapTimerRef.current);
    await updateBatchStatus(batchId, 'cancelled');
    setBatch(prev => prev ? { ...prev, status: 'cancelled' } : null);
    setRunnerState('completed');
    showToast('자동 통화가 중단되었습니다', 'info');
  };

  const startGapWait = () => {
    if (!batch) {
      dialNext();
      return;
    }
    setGapTimer(batch.gapSeconds);
    setRunnerState('gap_wait');
  };

  const incrementCount = async (field: string) => {
    const counts: any = { completedCount: (batch?.completedCount || 0) + 1 };
    if (field !== 'completedCount') {
      counts[field] = ((batch as any)?.[field] || 0) + 1;
    }
    await updateBatchCounts(batchId, counts);
    setBatch(prev => prev ? { ...prev, ...counts } : null);
  };

  // === Derived data ===
  const pendingItems = items.filter(i => i.status === 'pending');
  const completedItems = items.filter(i => i.status === 'completed' || i.status === 'skipped');

  const getResultIcon = (result?: string | null) => {
    switch (result) {
      case 'connected': return <CheckCircle2 size={16} className="text-green-500" />;
      case 'no_answer': return <PhoneMissed size={16} className="text-orange-500" />;
      case 'busy': return <PhoneOff size={16} className="text-red-500" />;
      case 'error': return <AlertCircle size={16} className="text-red-500" />;
      default: return <SkipForward size={16} className="text-gray-400" />;
    }
  };

  const getResultLabel = (result?: string | null) => {
    switch (result) {
      case 'connected': return '연결';
      case 'no_answer': return '미응답';
      case 'busy': return '통화중';
      case 'rejected': return '거절';
      case 'error': return '오류';
      default: return '건너뜀';
    }
  };

  // === Loading state ===
  if (loading) {
    return (
      <div className="flex items-center justify-center h-96">
        <Loader2 className="w-10 h-10 animate-spin text-blue-500" />
      </div>
    );
  }

  if (!batch) {
    return (
      <div className="text-center py-12 text-gray-500">
        <p>배치를 찾을 수 없습니다</p>
        <button onClick={onClose} className="mt-4 text-blue-500 hover:underline">돌아가기</button>
      </div>
    );
  }

  return (
    <div className="max-w-3xl mx-auto space-y-4">
      {/* Back button */}
      <button
        onClick={onClose}
        className="flex items-center gap-1 text-sm text-gray-500 dark:text-gray-400 hover:text-blue-600 dark:hover:text-blue-400 transition-colors -mb-2"
      >
        <ArrowLeft size={16} />
        자동통화 관리
      </button>

      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-xl font-bold text-gray-900 dark:text-white flex items-center gap-2">
            <Phone className="text-blue-500" size={24} />
            자동 통화 {runnerState === 'completed' ? '완료' : '진행 중'}
          </h2>
          <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">배치: {batch.name}</p>
        </div>
        {runnerState === 'completed' && (
          <button
            onClick={onComplete}
            className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
          >
            리포트 보기
          </button>
        )}
      </div>

      {/* Current Call Card */}
      {runnerState !== 'idle' && runnerState !== 'completed' && currentItem && (
        <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-lg border border-gray-200 dark:border-gray-700 overflow-hidden">
          <div className="p-6">
            <div className="text-center mb-4">
              <p className="text-sm text-gray-500 dark:text-gray-400">
                현재 통화 #{stats.completed + 1}/{stats.total}
              </p>
            </div>

            <div className="text-center space-y-2 mb-6">
              <div className="w-16 h-16 mx-auto bg-blue-100 dark:bg-blue-900/30 rounded-full flex items-center justify-center">
                <User size={32} className="text-blue-600 dark:text-blue-400" />
              </div>
              <h3 className="text-2xl font-bold text-gray-900 dark:text-white">
                {currentItem.customerName || '알 수 없음'}
              </h3>
              <p className="text-lg text-gray-600 dark:text-gray-300">{currentItem.phone}</p>
              {currentItem.memo && (
                <p className="text-sm text-gray-500 dark:text-gray-400 flex items-center justify-center gap-1">
                  <FileText size={14} />
                  {currentItem.memo}
                </p>
              )}
            </div>

            {/* Ring Timer / Status */}
            {(runnerState === 'dialing' || runnerState === 'ringing') && (
              <div className="text-center mb-6">
                <p className="text-sm font-medium text-orange-600 dark:text-orange-400 mb-2 animate-pulse">
                  🔔 벨 울리는 중... ({ringTimer}초/{batch.ringTimeoutSeconds}초)
                </p>
                <div className="w-full bg-gray-200 dark:bg-gray-700 rounded-full h-3">
                  <div
                    className="bg-gradient-to-r from-orange-400 to-red-500 h-3 rounded-full transition-all duration-1000"
                    style={{ width: `${Math.min((ringTimer / batch.ringTimeoutSeconds) * 100, 100)}%` }}
                  />
                </div>
              </div>
            )}

            {runnerState === 'gap_wait' && (
              <div className="text-center mb-6">
                <p className="text-sm text-gray-500 dark:text-gray-400">
                  다음 건 발신까지 <span className="font-bold text-blue-600">{gapTimer}초</span>
                </p>
              </div>
            )}

            {/* Connected State */}
            {runnerState === 'connected' && (
              <div className="bg-green-50 dark:bg-green-900/20 rounded-xl p-4 mb-4 border border-green-200 dark:border-green-800">
                <p className="text-green-700 dark:text-green-400 font-medium flex items-center gap-2 mb-3">
                  <CheckCircle2 size={18} />
                  통화 연결됨 — 자동 다이얼링 일시정지
                </p>
                <div className="space-y-3">
                  <div>
                    <label className="text-sm text-gray-600 dark:text-gray-400 block mb-1">통화 결과 메모</label>
                    <input
                      type="text"
                      value={resultMemo}
                      onChange={(e) => setResultMemo(e.target.value)}
                      placeholder="통화 결과를 입력하세요..."
                      className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:ring-2 focus:ring-blue-500 outline-none"
                    />
                  </div>
                  <div>
                    <label className="text-sm text-gray-600 dark:text-gray-400 block mb-1">상태 변경</label>
                    <select
                      value={selectedStatus}
                      onChange={(e) => setSelectedStatus(e.target.value)}
                      className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:ring-2 focus:ring-blue-500 outline-none"
                    >
                      <option value="상담중">상담중</option>
                      <option value="계약완료">계약완료</option>
                      <option value="진행불가">진행불가</option>
                      <option value="재통화">재통화</option>
                    </select>
                  </div>
                </div>
              </div>
            )}

            {/* Action Buttons */}
            <div className="flex gap-3 justify-center">
              {(runnerState === 'dialing' || runnerState === 'ringing') && (
                <>
                  <button
                    onClick={handleSkipCurrent}
                    className="px-4 py-2.5 bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300 rounded-xl hover:bg-gray-200 dark:hover:bg-gray-600 transition-colors flex items-center gap-2"
                  >
                    <SkipForward size={18} />
                    건너뛰기
                  </button>
                  <button
                    onClick={handlePause}
                    className="px-4 py-2.5 bg-yellow-100 dark:bg-yellow-900/30 text-yellow-700 dark:text-yellow-400 rounded-xl hover:bg-yellow-200 transition-colors flex items-center gap-2"
                  >
                    <Pause size={18} />
                    일시정지
                  </button>
                  <button
                    onClick={handleStop}
                    className="px-4 py-2.5 bg-red-100 dark:bg-red-900/30 text-red-700 dark:text-red-400 rounded-xl hover:bg-red-200 transition-colors flex items-center gap-2"
                  >
                    <Square size={18} />
                    전체 중단
                  </button>
                </>
              )}
              {runnerState === 'connected' && (
                <>
                  <button
                    onClick={handleNextAfterConnected}
                    className="px-6 py-2.5 bg-blue-600 text-white rounded-xl hover:bg-blue-700 transition-colors flex items-center gap-2 font-medium"
                  >
                    <Play size={18} />
                    다음 건 진행
                  </button>
                  <button
                    onClick={handleStop}
                    className="px-4 py-2.5 bg-red-100 dark:bg-red-900/30 text-red-700 dark:text-red-400 rounded-xl hover:bg-red-200 transition-colors flex items-center gap-2"
                  >
                    <Square size={18} />
                    전체 중단
                  </button>
                </>
              )}
              {runnerState === 'paused' && (
                <>
                  <button
                    onClick={handleResume}
                    className="px-6 py-2.5 bg-green-600 text-white rounded-xl hover:bg-green-700 transition-colors flex items-center gap-2 font-medium"
                  >
                    <Play size={18} />
                    재개
                  </button>
                  <button
                    onClick={handleStop}
                    className="px-4 py-2.5 bg-red-100 dark:bg-red-900/30 text-red-700 dark:text-red-400 rounded-xl hover:bg-red-200 transition-colors flex items-center gap-2"
                  >
                    <Square size={18} />
                    전체 중단
                  </button>
                </>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Start button (idle state) */}
      {runnerState === 'idle' && batch.status === 'ready' && (
        <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-lg p-8 text-center border border-gray-200 dark:border-gray-700">
          <div className="w-20 h-20 mx-auto mb-4 bg-gradient-to-br from-blue-500 to-indigo-600 rounded-full flex items-center justify-center shadow-lg">
            <PhoneCall size={36} className="text-white" />
          </div>
          <h3 className="text-lg font-bold text-gray-900 dark:text-white mb-2">자동 통화 시작</h3>
          <p className="text-gray-500 dark:text-gray-400 mb-4">
            {stats.total}건의 연락처에 순차적으로 전화합니다
          </p>

          {/* 발신번호 선택 */}
          <div className="bg-gray-50 dark:bg-gray-750 rounded-xl p-4 mb-6 text-left space-y-3">
            <p className="text-sm font-semibold text-gray-700 dark:text-gray-300">📞 발신 번호 선택</p>
            <label className="flex items-center gap-3 cursor-pointer p-2 rounded-lg hover:bg-white dark:hover:bg-gray-700 transition-colors">
              <input
                type="radio"
                name="callerMode"
                value="default"
                checked={callerMode === 'default'}
                onChange={() => { setCallerMode('default'); localStorage.setItem('autodial_caller_mode', 'default'); }}
                className="w-4 h-4 text-blue-600"
              />
              <div>
                <span className="text-sm font-medium text-gray-900 dark:text-white">기본 번호</span>
                <span className="text-xs text-gray-500 dark:text-gray-400 ml-2">투넘버 선택 팝업 표시</span>
              </div>
            </label>
            <label className="flex items-center gap-3 cursor-pointer p-2 rounded-lg hover:bg-white dark:hover:bg-gray-700 transition-colors">
              <input
                type="radio"
                name="callerMode"
                value="two_number"
                checked={callerMode === 'two_number'}
                onChange={() => { setCallerMode('two_number'); localStorage.setItem('autodial_caller_mode', 'two_number'); }}
                className="w-4 h-4 text-blue-600"
              />
              <div className="flex-1">
                <span className="text-sm font-medium text-gray-900 dark:text-white">투넘버로 발신</span>
                <span className="text-xs text-green-600 dark:text-green-400 ml-2">팝업 없이 자동 진행</span>
              </div>
            </label>
            {callerMode === 'two_number' && (
              <div className="ml-9 flex items-center gap-2">
                <span className="text-xs text-gray-500">통신사:</span>
                <select
                  value={selectedCarrier}
                  onChange={(e) => { setSelectedCarrier(e.target.value); localStorage.setItem('autodial_carrier', e.target.value); }}
                  className="text-sm px-3 py-1.5 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                >
                  <option value="skt">SKT (넘버플러스)</option>
                  <option value="kt">KT (투넘버플러스)</option>
                  <option value="lgu+">LGU+ (듀얼번호)</option>
                </select>
                <span className="text-xs text-gray-400">접두사: {CARRIER_PREFIXES[selectedCarrier]}</span>
              </div>
            )}
          </div>

          <button
            onClick={() => {
              callerPrefixRef.current = callerMode === 'two_number' ? CARRIER_PREFIXES[selectedCarrier] || '' : '';
              console.log('[AutoDial] Caller prefix:', callerPrefixRef.current || '(none)');
              startAutoDial();
            }}
            className="px-8 py-3 bg-gradient-to-r from-blue-600 to-indigo-600 text-white rounded-xl hover:from-blue-700 hover:to-indigo-700 transition-all shadow-lg hover:shadow-xl font-medium text-lg"
          >
            ▶️ 자동 전화 시작
          </button>
        </div>
      )}

      {/* Progress */}
      <div className="bg-white dark:bg-gray-800 rounded-xl p-4 border border-gray-200 dark:border-gray-700">
        <div className="flex items-center justify-between mb-2">
          <span className="text-sm font-medium text-gray-700 dark:text-gray-300">진행률</span>
          <span className="text-sm font-bold text-blue-600">{progressPercent}% ({stats.completed}/{stats.total})</span>
        </div>
        <div className="w-full bg-gray-200 dark:bg-gray-700 rounded-full h-2.5">
          <div
            className="bg-gradient-to-r from-blue-500 to-indigo-500 h-2.5 rounded-full transition-all duration-500"
            style={{ width: `${progressPercent}%` }}
          />
        </div>
        <div className="flex gap-4 mt-3 text-sm">
          <span className="flex items-center gap-1 text-green-600">
            <CheckCircle2 size={14} /> 연결 {stats.connected}
          </span>
          <span className="flex items-center gap-1 text-orange-500">
            <PhoneMissed size={14} /> 미응답 {stats.noAnswer}
          </span>
          <span className="flex items-center gap-1 text-red-500">
            <PhoneOff size={14} /> 통화중 {stats.busy}
          </span>
          <span className="flex items-center gap-1 text-gray-400">
            <SkipForward size={14} /> 건너뜀 {stats.skipped}
          </span>
        </div>
      </div>

      {/* Pending Queue */}
      {pendingItems.length > 0 && (
        <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 overflow-hidden">
          <button
            onClick={() => setShowQueue(!showQueue)}
            className="w-full px-4 py-3 flex items-center justify-between hover:bg-gray-50 dark:hover:bg-gray-750 transition-colors"
          >
            <span className="text-sm font-medium text-gray-700 dark:text-gray-300">
              대기 큐 ({pendingItems.length}건 남음)
            </span>
            {showQueue ? <ChevronUp size={18} /> : <ChevronDown size={18} />}
          </button>
          {showQueue && (
            <div className="border-t border-gray-100 dark:border-gray-700 max-h-60 overflow-y-auto">
              {pendingItems.map((item, idx) => (
                <div
                  key={item.id}
                  className="flex items-center justify-between px-4 py-2.5 hover:bg-gray-50 dark:hover:bg-gray-750 border-b border-gray-50 dark:border-gray-700 last:border-0"
                >
                  <div className="flex items-center gap-3">
                    <span className="text-xs text-gray-400 w-6 text-right">{item.sortOrder + 1}</span>
                    <span className="text-sm font-medium text-gray-900 dark:text-white">{item.customerName}</span>
                    <span className="text-xs text-gray-500">{item.phone}</span>
                  </div>
                  <button
                    onClick={() => handleSkipQueued(item.id)}
                    className="text-xs px-2 py-1 text-gray-500 hover:text-red-500 hover:bg-red-50 dark:hover:bg-red-900/20 rounded transition-colors"
                  >
                    건너뛰기
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Completed History */}
      {completedItems.length > 0 && (
        <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 overflow-hidden">
          <button
            onClick={() => setShowHistory(!showHistory)}
            className="w-full px-4 py-3 flex items-center justify-between hover:bg-gray-50 dark:hover:bg-gray-750 transition-colors"
          >
            <span className="text-sm font-medium text-gray-700 dark:text-gray-300">
              처리 내역 ({completedItems.length}건)
            </span>
            {showHistory ? <ChevronUp size={18} /> : <ChevronDown size={18} />}
          </button>
          {showHistory && (
            <div className="border-t border-gray-100 dark:border-gray-700 max-h-60 overflow-y-auto">
              {[...completedItems].reverse().map((item) => (
                <div
                  key={item.id}
                  className="flex items-center justify-between px-4 py-2.5 border-b border-gray-50 dark:border-gray-700 last:border-0"
                >
                  <div className="flex items-center gap-3">
                    {getResultIcon(item.result)}
                    <span className="text-sm font-medium text-gray-900 dark:text-white">{item.customerName}</span>
                    <span className="text-xs text-gray-500">{item.phone}</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className={`text-xs px-2 py-0.5 rounded-full ${
                      item.result === 'connected' ? 'bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-400' :
                      item.result === 'no_answer' ? 'bg-orange-100 dark:bg-orange-900/30 text-orange-700 dark:text-orange-400' :
                      item.result === 'busy' ? 'bg-red-100 dark:bg-red-900/30 text-red-700 dark:text-red-400' :
                      'bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-400'
                    }`}>
                      {getResultLabel(item.result)}
                    </span>
                    {item.ringDurationSeconds !== undefined && (
                      <span className="text-xs text-gray-400">{item.ringDurationSeconds}초</span>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
};

export default AutoDialRunner;
