import React, { useState, useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { 
    Clock, CheckCircle2, Coffee, AlertCircle, LogOut, 
    ChevronDown, UserCheck, Play, Pause, Power
} from 'lucide-react';
import { AttendanceStatus, recordMyAttendanceStatus, fetchMyTodayAttendance } from '../../services/hr';
import { useToast } from '../../contexts/ToastContext';

interface AttendanceHeaderWidgetProps {
    isDark?: boolean;
}

export const AttendanceHeaderWidget: React.FC<AttendanceHeaderWidgetProps> = ({
    isDark = false
}) => {
    const { showToast } = useToast();
    // [2026-11-13 KIRO] 근태는 서버(agent_attendance_logs)가 원본. 브라우저 값(lm_my_attendance_status)은 쓰지 않는다.
    const [status, setStatus] = useState<AttendanceStatus>('off');
    const [isOpen, setIsOpen] = useState(false);
    const [busy, setBusy] = useState(false);
    const [clockInTime, setClockInTime] = useState<string | null>(null);
    const [elapsedMinutes, setElapsedMinutes] = useState(0);
    const dropdownRef = useRef<HTMLDivElement>(null);
    const lastLoadRef = useRef(0);

    // 서버에서 내 오늘 근태 불러오기 (처음 + 탭 복귀 시 5분에 한 번)
    useEffect(() => {
        let alive = true;
        const load = async () => {
            lastLoadRef.current = Date.now();
            const mine = await fetchMyTodayAttendance();
            if (!alive || !mine) return;
            setStatus(mine.currentStatus);
            setClockInTime(mine.currentStatus !== 'off' ? (mine.clockInAt || null) : null);
        };
        load();
        // 예전 브라우저 근태 값 정리 (서버와 어긋난 값이 다시 쓰이지 않게)
        try {
            localStorage.removeItem('lm_my_attendance_status');
            localStorage.removeItem('lm_my_clock_in_time');
        } catch { /* ignore */ }
        const onVisible = () => {
            if (document.visibilityState === 'visible' && Date.now() - lastLoadRef.current > 5 * 60 * 1000) load();
        };
        document.addEventListener('visibilitychange', onVisible);
        return () => { alive = false; document.removeEventListener('visibilitychange', onVisible); };
    }, []);

    // 경과 시간 계산
    useEffect(() => {
        const updateElapsed = () => {
            if (!clockInTime || status === 'off') {
                setElapsedMinutes(0);
                return;
            }
            const start = new Date(clockInTime).getTime();
            const now = Date.now();
            const mins = Math.max(0, Math.floor((now - start) / 60000));
            setElapsedMinutes(mins);
        };

        updateElapsed();
        const timer = setInterval(updateElapsed, 60000);
        return () => clearInterval(timer);
    }, [clockInTime, status]);

    // 외부 클릭 시 닫기
    useEffect(() => {
        const handleClickOutside = (e: MouseEvent) => {
            if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node)) {
                setIsOpen(false);
            }
        };
        document.addEventListener('mousedown', handleClickOutside);
        return () => document.removeEventListener('mousedown', handleClickOutside);
    }, []);

    // 상태 변경 핸들러
    const handleChangeStatus = async (nextStatus: AttendanceStatus) => {
        setIsOpen(false);
        if (busy) return;
        setBusy(true);
        const wasClockedIn = !!clockInTime;
        try {
            // 서버 기록이 성공했을 때만 화면을 바꾸고 안내한다
            const saved = await recordMyAttendanceStatus(nextStatus);
            setStatus(saved.currentStatus);
            lastLoadRef.current = Date.now();

            if (nextStatus === 'working' && !wasClockedIn) {
                setClockInTime(saved.clockInAt || new Date().toISOString());
                showToast('출근 처리되었습니다. 오늘도 파이팅입니다!', 'success');
            } else if (nextStatus === 'off') {
                setClockInTime(null);
                showToast('퇴근 처리되었습니다. 수고하셨습니다!', 'info');
            } else if (nextStatus === 'away') {
                showToast('자리비움(이석) 상태로 변경되었습니다.', 'warning');
            } else if (nextStatus === 'meal') {
                showToast('식사/휴게 상태로 변경되었습니다.', 'info');
            } else {
                showToast('업무 중 상태로 복귀했습니다.', 'success');
            }
        } catch (err: any) {
            console.error('Failed to change attendance status:', err);
            showToast(err?.message || '근태 상태 변경에 실패했습니다.', 'error');
        } finally {
            setBusy(false);
        }
    };

    // 상태별 배지 스타일
    const getStatusConfig = (st: AttendanceStatus) => {
        switch (st) {
            case 'working':
                return {
                    label: '업무 중',
                    bg: 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border-emerald-500/30',
                    dot: 'bg-emerald-500 animate-pulse',
                    icon: Play
                };
            case 'away':
                return {
                    label: '자리비움',
                    bg: 'bg-amber-500/10 text-amber-600 dark:text-amber-400 border-amber-500/30',
                    dot: 'bg-amber-500',
                    icon: Pause
                };
            case 'meal':
                return {
                    label: '식사/휴게',
                    bg: 'bg-orange-500/10 text-orange-600 dark:text-orange-400 border-orange-500/30',
                    dot: 'bg-orange-500',
                    icon: Coffee
                };
            default:
                return {
                    label: '출근하기',
                    bg: 'bg-gray-100 dark:bg-gray-800 text-gray-500 dark:text-gray-400 border-gray-200 dark:border-gray-700',
                    dot: 'bg-gray-400',
                    icon: Power
                };
        }
    };

    const cur = getStatusConfig(status);
    const hours = Math.floor(elapsedMinutes / 60);
    const mins = elapsedMinutes % 60;
    const timeLabel = status !== 'off' && clockInTime 
        ? `${hours > 0 ? `${hours}시간 ` : ''}${mins}분` 
        : null;

    return (
        <div className="relative inline-block" ref={dropdownRef}>
            <button
                type="button"
                onClick={() => setIsOpen(!isOpen)}
                className={`flex items-center gap-2 px-3 py-1.5 rounded-full border text-xs font-bold transition-all shadow-2xs hover:shadow-sm ${cur.bg}`}
            >
                <span className={`w-2 h-2 rounded-full ${cur.dot}`} />
                <span>{cur.label}</span>
                {timeLabel && (
                    <span className="text-[10px] font-medium opacity-80 pl-1 border-l border-current/20">
                        {timeLabel}
                    </span>
                )}
                <ChevronDown size={13} className={`opacity-60 transition-transform ${isOpen ? 'rotate-180' : ''}`} />
            </button>

            {/* 드롭다운 메뉴 */}
            <AnimatePresence>
                {isOpen && (
                    <motion.div
                        initial={{ opacity: 0, y: 6, scale: 0.96 }}
                        animate={{ opacity: 1, y: 0, scale: 1 }}
                        exit={{ opacity: 0, y: 6, scale: 0.96 }}
                        className="absolute right-0 mt-2 w-48 bg-white dark:bg-gray-800 rounded-2xl shadow-xl border border-gray-100 dark:border-gray-700 p-2 z-50 text-xs"
                    >
                        <div className="px-3 py-2 border-b border-gray-100 dark:border-gray-700 mb-1">
                            <span className="text-[10px] font-bold text-gray-400 uppercase tracking-wider block">
                                근무 상태 선택
                            </span>
                            {timeLabel && (
                                <span className="text-xs font-bold text-gray-700 dark:text-gray-300">
                                    오늘 근무: {timeLabel}
                                </span>
                            )}
                        </div>

                        <div className="space-y-0.5">
                            <button
                                type="button"
                                onClick={() => handleChangeStatus('working')}
                                className={`w-full flex items-center gap-2.5 px-3 py-2 rounded-xl text-left font-semibold transition-colors ${
                                    status === 'working' 
                                        ? 'bg-emerald-50 dark:bg-emerald-950/40 text-emerald-700 dark:text-emerald-300' 
                                        : 'hover:bg-gray-50 dark:hover:bg-gray-750 text-gray-700 dark:text-gray-300'
                                }`}
                            >
                                <span className="w-2 h-2 rounded-full bg-emerald-500" />
                                <span className="flex-1">🟢 업무 중 (정상 콜)</span>
                                {status === 'working' && <CheckCircle2 size={13} className="text-emerald-500" />}
                            </button>

                            <button
                                type="button"
                                onClick={() => handleChangeStatus('away')}
                                className={`w-full flex items-center gap-2.5 px-3 py-2 rounded-xl text-left font-semibold transition-colors ${
                                    status === 'away' 
                                        ? 'bg-amber-50 dark:bg-amber-950/40 text-amber-700 dark:text-amber-300' 
                                        : 'hover:bg-gray-50 dark:hover:bg-gray-750 text-gray-700 dark:text-gray-300'
                                }`}
                            >
                                <span className="w-2 h-2 rounded-full bg-amber-500" />
                                <span className="flex-1">🟡 자리비움 (이석)</span>
                                {status === 'away' && <CheckCircle2 size={13} className="text-amber-500" />}
                            </button>

                            <button
                                type="button"
                                onClick={() => handleChangeStatus('meal')}
                                className={`w-full flex items-center gap-2.5 px-3 py-2 rounded-xl text-left font-semibold transition-colors ${
                                    status === 'meal' 
                                        ? 'bg-orange-50 dark:bg-orange-950/40 text-orange-700 dark:text-orange-300' 
                                        : 'hover:bg-gray-50 dark:hover:bg-gray-750 text-gray-700 dark:text-gray-300'
                                }`}
                            >
                                <span className="w-2 h-2 rounded-full bg-orange-500" />
                                <span className="flex-1">🟠 식사 / 휴게</span>
                                {status === 'meal' && <CheckCircle2 size={13} className="text-orange-500" />}
                            </button>

                            <div className="pt-1 mt-1 border-t border-gray-100 dark:border-gray-700">
                                <button
                                    type="button"
                                    onClick={() => handleChangeStatus('off')}
                                    className="w-full flex items-center gap-2.5 px-3 py-2 rounded-xl text-left font-semibold text-rose-600 dark:text-rose-400 hover:bg-rose-50 dark:hover:bg-rose-950/30 transition-colors"
                                >
                                    <Power size={13} />
                                    <span>퇴근하기</span>
                                </button>
                            </div>
                        </div>
                    </motion.div>
                )}
            </AnimatePresence>
        </div>
    );
};
