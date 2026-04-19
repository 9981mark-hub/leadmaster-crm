import React, { useState, useEffect } from 'react';
import { CalendarClock, Check, Edit2, Trash2, X, MessageSquare } from 'lucide-react';
import { Case, MemoItem, ReminderItem, ReminderType } from '../../../types';
import { safeFormat } from '../../../utils';

interface CaseDetailRemindersProps {
    reminders: ReminderItem[];
    memos: MemoItem[];
    onUpdateReminders: (reminders: ReminderItem[]) => void;
    onUpdateMemos: (memos: MemoItem[]) => void;
    showToast: (msg: string, type?: 'success' | 'error') => void;
}

// Status color configurations
const statusColors: Record<string, { bg: string; border: string; text: string; icon: string }> = {
    '완료': { bg: 'bg-green-50', border: 'border-green-200', text: 'text-green-700', icon: '✓' },
    '미연결': { bg: 'bg-red-50', border: 'border-red-200', text: 'text-red-600', icon: '✗' },
    '재예약': { bg: 'bg-blue-50', border: 'border-blue-200', text: 'text-blue-600', icon: '↻' },
    '취소': { bg: 'bg-gray-50', border: 'border-gray-200', text: 'text-gray-600', icon: '−' },
};

export const CaseDetailReminders: React.FC<CaseDetailRemindersProps> = ({
    reminders,
    memos,
    onUpdateReminders,
    onUpdateMemos,
    showToast
}) => {
    // Reminder State
    const [remDate, setRemDate] = useState(() => {
        const now = new Date();
        const kst = new Date(now.getTime() + (9 * 60 * 60000));
        return kst.toISOString().split('T')[0];
    });
    const [remHour, setRemHour] = useState('09');
    const [remMinute, setRemMinute] = useState('00');
    const [newReminderDateTime, setNewReminderDateTime] = useState('');
    const [newReminderType, setNewReminderType] = useState<ReminderType>('통화');
    const [newReminderContent, setNewReminderContent] = useState('');
    const [confirmingDeleteReminderId, setConfirmingDeleteReminderId] = useState<string | null>(null);

    // Memo Edit State
    const [editingMemoId, setEditingMemoId] = useState<string | null>(null);
    const [editMemoContent, setEditMemoContent] = useState('');
    const [confirmingDeleteMemoId, setConfirmingDeleteMemoId] = useState<string | null>(null);
    const [newMemoContent, setNewMemoContent] = useState('');

    // Result Modal State
    const [resultModal, setResultModal] = useState<{
        isOpen: boolean;
        reminderId: string;
        status: string;
        note: string;
    }>({ isOpen: false, reminderId: '', status: '', note: '' });

    useEffect(() => {
        if (remDate && remHour && remMinute) {
            setNewReminderDateTime(`${remDate} ${remHour}:${remMinute}`);
        } else {
            setNewReminderDateTime('');
        }
    }, [remDate, remHour, remMinute]);

    const handleAddReminder = () => {
        if (!newReminderDateTime) {
            showToast('날짜와 시간을 선택해주세요.', 'error');
            return;
        }
        if (reminders.length >= 10) {
            showToast('리마인더는 최대 10개까지 등록할 수 있습니다.', 'error');
            return;
        }
        const newReminder: ReminderItem = {
            id: Date.now().toString(),
            datetime: newReminderDateTime.replace('T', ' '),
            type: newReminderType,
            content: newReminderContent
        };
        onUpdateReminders([...reminders, newReminder]);

        // Reset
        setRemDate('');
        setRemHour('09');
        setRemMinute('00');
        setNewReminderDateTime('');
        setNewReminderContent('');
        setNewReminderType('통화');
        showToast('다음 일정이 추가되었습니다.');
    };

    const handleDeleteReminder = (id: string) => {
        onUpdateReminders(reminders.filter(r => r.id !== id));
        setConfirmingDeleteReminderId(null);
        showToast('일정이 삭제되었습니다.');
    };

    const handleAddMemo = () => {
        if (!newMemoContent.trim()) return;
        const newMemo: MemoItem = {
            id: Date.now().toString(),
            createdAt: new Date().toISOString(),
            content: newMemoContent.trim(),
        };
        onUpdateMemos([newMemo, ...memos]);
        setNewMemoContent('');
        showToast('상담 내용이 추가되었습니다.');
    };

    const handleEditMemoSave = () => {
        if (!editingMemoId) return;
        const updatedMemos = memos.map(m =>
            m.id === editingMemoId ? { ...m, content: editMemoContent } : m
        );
        onUpdateMemos(updatedMemos);
        setEditingMemoId(null);
        setEditMemoContent('');
        showToast('상담 내용이 수정되었습니다.');
    };

    const handleDeleteMemo = (id: string) => {
        onUpdateMemos(memos.filter(m => m.id !== id));
        showToast('상담 내용이 삭제되었습니다.');
        setConfirmingDeleteMemoId(null);
    };

    // Handle result status button click - open modal instead of prompt
    const handleResultStatusClick = (reminderId: string, status: string) => {
        setResultModal({
            isOpen: true,
            reminderId,
            status,
            note: ''
        });
    };

    // Handle result modal confirm
    const handleResultConfirm = () => {
        const newReminders = reminders.map(r =>
            r.id === resultModal.reminderId
                ? { ...r, resultStatus: resultModal.status, resultNote: resultModal.note }
                : r
        );
        onUpdateReminders(newReminders);
        setResultModal({ isOpen: false, reminderId: '', status: '', note: '' });
        showToast(`${resultModal.status} 처리되었습니다.`);
    };

    // Handle result modal cancel
    const handleResultCancel = () => {
        setResultModal({ isOpen: false, reminderId: '', status: '', note: '' });
    };

    const sortedReminders = [...reminders].sort((a, b) => a.datetime.localeCompare(b.datetime));
    const sortedMemos = [...memos].sort((a, b) => b.createdAt.localeCompare(a.createdAt));

    const currentStatusColor = statusColors[resultModal.status] || statusColors['취소'];

    return (
        <>
            {/* Result Status Modal */}
            {resultModal.isOpen && (
                <div
                    className="fixed inset-0 z-[9999] flex items-center justify-center p-4"
                    style={{ backgroundColor: 'rgba(0, 0, 0, 0.5)' }}
                >
                    <div
                        className="bg-white rounded-2xl shadow-2xl w-full max-w-sm overflow-hidden animate-in fade-in zoom-in duration-200"
                        onClick={(e) => e.stopPropagation()}
                    >
                        {/* Header */}
                        <div className={`${currentStatusColor.bg} px-5 py-4 border-b ${currentStatusColor.border}`}>
                            <div className="flex items-center gap-3">
                                <div className={`w-10 h-10 rounded-full ${currentStatusColor.bg} ${currentStatusColor.border} border-2 flex items-center justify-center`}>
                                    <span className={`text-xl font-bold ${currentStatusColor.text}`}>
                                        {currentStatusColor.icon}
                                    </span>
                                </div>
                                <div>
                                    <h3 className={`text-lg font-bold ${currentStatusColor.text}`}>
                                        {resultModal.status} 처리
                                    </h3>
                                    <p className="text-xs text-gray-500">일정 결과를 기록합니다</p>
                                </div>
                            </div>
                        </div>

                        {/* Body */}
                        <div className="p-5">
                            <label className="block text-sm font-medium text-gray-700 mb-2">
                                <MessageSquare size={14} className="inline mr-1.5 text-gray-400" />
                                메모 (선택사항)
                            </label>
                            <textarea
                                className="w-full p-3 border border-gray-200 rounded-xl text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none resize-none transition-all bg-gray-50 focus:bg-white"
                                rows={3}
                                placeholder="처리에 대한 메모를 남겨주세요..."
                                value={resultModal.note}
                                onChange={(e) => setResultModal(prev => ({ ...prev, note: e.target.value }))}
                                autoFocus
                            />
                        </div>

                        {/* Footer */}
                        <div className="px-5 pb-5 flex gap-3">
                            <button
                                onClick={handleResultCancel}
                                className="flex-1 py-3 px-4 rounded-xl border border-gray-200 text-gray-600 font-medium hover:bg-gray-50 transition-colors"
                            >
                                취소
                            </button>
                            <button
                                onClick={handleResultConfirm}
                                className={`flex-1 py-3 px-4 rounded-xl font-bold text-white transition-colors ${resultModal.status === '완료' ? 'bg-green-500 hover:bg-green-600' :
                                        resultModal.status === '미연결' ? 'bg-red-500 hover:bg-red-600' :
                                            resultModal.status === '재예약' ? 'bg-blue-500 hover:bg-blue-600' :
                                                'bg-gray-500 hover:bg-gray-600'
                                    }`}
                            >
                                확인
                            </button>
                        </div>
                    </div>
                </div>
            )}

            <div className="bg-yellow-50 p-4 rounded-lg border border-yellow-100">
                <h3 className="font-bold text-yellow-800 mb-2 flex items-center gap-2">📅 리마인더 및 상담 이력</h3>
                <div className="grid md:grid-cols-2 gap-4">
                    {/* Reminder Settings */}
                    <div className="bg-white p-3 rounded-lg border border-yellow-200 shadow-sm">
                        <label className="block text-xs font-bold text-yellow-800 mb-2">다음 일정 등록 ({sortedReminders.length}/10)</label>
                        <div className="flex flex-col md:flex-row gap-2 mb-3">
                            <div className="flex flex-col gap-2 flex-[2]">
                                <input
                                    type="date"
                                    className="w-full p-2 border border-blue-300 rounded text-sm outline-none focus:ring-1 focus:ring-blue-500"
                                    value={remDate}
                                    onChange={e => setRemDate(e.target.value)}
                                    disabled={(reminders.length || 0) >= 10}
                                />
                                <div className="flex gap-1">
                                    <select
                                        className="flex-1 p-2 border border-blue-300 rounded text-sm outline-none focus:ring-1 focus:ring-blue-500"
                                        value={remHour}
                                        onChange={e => setRemHour(e.target.value)}
                                        disabled={(reminders.length || 0) >= 10}
                                    >
                                        {Array.from({ length: 24 }).map((_, i) => {
                                            const h = i.toString().padStart(2, '0');
                                            return <option key={h} value={h}>{h}시</option>;
                                        })}
                                    </select>
                                    <select
                                        className="flex-1 p-2 border border-blue-300 rounded text-sm outline-none focus:ring-1 focus:ring-blue-500"
                                        value={remMinute}
                                        onChange={e => setRemMinute(e.target.value)}
                                        disabled={(reminders.length || 0) >= 10}
                                    >
                                        {['00', '10', '20', '30', '40', '50'].map(m => (
                                            <option key={m} value={m}>{m}분</option>
                                        ))}
                                    </select>
                                    <select
                                        className="flex-1 p-2 border border-blue-300 rounded text-sm outline-none focus:ring-1 focus:ring-blue-500 min-w-[60px]"
                                        value={newReminderType}
                                        onChange={e => setNewReminderType(e.target.value as any)}
                                    >
                                        <option value="통화">통화</option>
                                        <option value="문자">문자</option>
                                        <option value="출장미팅">출장미팅</option>
                                        <option value="방문미팅">방문미팅</option>
                                        <option value="입금">입금</option>
                                        <option value="기타">기타</option>
                                    </select>
                                </div>
                            </div>
                        </div>
                        <div className="flex gap-2">
                            <input
                                type="text"
                                className="flex-1 p-2 border border-gray-300 rounded text-sm"
                                placeholder={newReminderType === '기타' ? "일정 내용을 입력하세요" : "메모 (선택사항)"}
                                value={newReminderContent}
                                onChange={e => setNewReminderContent(e.target.value)}
                            />
                            <button
                                onClick={handleAddReminder}
                                disabled={(reminders.length || 0) >= 10}
                                className="bg-yellow-500 text-white px-3 py-2 rounded text-sm font-bold hover:bg-yellow-600 whitespace-nowrap disabled:bg-gray-400"
                            >
                                추가
                            </button>
                        </div>

                        <div className="space-y-2 mt-2 max-h-72 overflow-y-auto">
                            {sortedReminders.length === 0 ? (
                                <div className="text-center py-2 text-xs text-gray-400 bg-gray-50 rounded border border-gray-100 border-dashed">
                                    지정된 일정이 없습니다.
                                </div>
                            ) : (
                                sortedReminders.map(reminder => (
                                    <div key={reminder.id} className="bg-blue-50 border border-blue-100 rounded p-2 flex flex-col gap-2">
                                        <div className="flex flex-col md:flex-row md:justify-between md:items-center w-full gap-2">
                                            <div className="flex items-center gap-2 flex-wrap">
                                                <CalendarClock size={16} className="text-blue-600 flex-shrink-0" />
                                                <span className="text-sm font-bold text-gray-800 whitespace-nowrap">{reminder.datetime}</span>
                                                <span className={`text-[10px] px-1.5 py-0.5 rounded font-bold whitespace-nowrap ${reminder.type === '방문미팅' ? 'bg-purple-100 text-purple-700' :
                                                    reminder.type === '출장미팅' ? 'bg-green-100 text-green-700' :
                                                        'bg-blue-100 text-blue-700'
                                                    }`}>
                                                    {reminder.type || '통화'}
                                                </span>
                                            </div>
                                            {reminder.content && (
                                                <span className="text-xs text-gray-600 break-words w-full md:w-auto md:max-w-[200px]">
                                                    {reminder.content}
                                                </span>
                                            )}
                                        </div>

                                        <div className="pt-2 border-t border-blue-100 w-full">
                                            {reminder.resultStatus ? (
                                                <div className="flex justify-between items-center text-xs">
                                                    <span className={`font-bold px-2 py-0.5 rounded ${reminder.resultStatus === '완료' ? 'bg-green-100 text-green-700' :
                                                        reminder.resultStatus === '미연결' ? 'bg-red-100 text-red-700' :
                                                            reminder.resultStatus === '재예약' ? 'bg-blue-100 text-blue-700' :
                                                                'bg-gray-100 text-gray-700'
                                                        }`}>
                                                        {reminder.resultStatus}
                                                    </span>
                                                    <div className="flex items-center gap-2">
                                                        <span className="text-gray-500 truncate max-w-[150px]">{reminder.resultNote}</span>
                                                        <button onClick={() => {
                                                            const newReminders = reminders.map(r => r.id === reminder.id ? { ...r, resultStatus: undefined, resultNote: undefined } : r);
                                                            onUpdateReminders(newReminders);
                                                        }} className="text-gray-400 hover:text-gray-600 underline whitespace-nowrap">수정</button>
                                                    </div>
                                                </div>
                                            ) : (
                                                <div className="flex items-center gap-2 overflow-x-auto no-scrollbar pb-1">
                                                    <span className="text-xs text-blue-400 font-bold flex-shrink-0">결과:</span>
                                                    {['완료', '미연결', '재예약', '취소'].map((status) => (
                                                        <button
                                                            key={status}
                                                            type="button"
                                                            onClick={() => handleResultStatusClick(reminder.id, status)}
                                                            className={`text-[10px] px-2 py-1 rounded border flex-shrink-0 transition-colors ${status === '완료' ? 'border-green-200 text-green-700 hover:bg-green-50' :
                                                                status === '미연결' ? 'border-red-200 text-red-700 hover:bg-red-50' :
                                                                    status === '재예약' ? 'border-blue-200 text-blue-700 hover:bg-blue-50' :
                                                                        'border-gray-200 text-gray-600 hover:bg-gray-50'
                                                                }`}
                                                        >
                                                            {status}
                                                        </button>
                                                    ))}
                                                    {confirmingDeleteReminderId === reminder.id ? (
                                                        <div className="flex gap-2 flex-shrink-0">
                                                            <button onClick={() => handleDeleteReminder(reminder.id)} className="text-green-600 text-xs font-bold">확인</button>
                                                            <button onClick={() => setConfirmingDeleteReminderId(null)} className="text-red-500 text-xs">취소</button>
                                                        </div>
                                                    ) : (
                                                        <button
                                                            onClick={() => setConfirmingDeleteReminderId(reminder.id)}
                                                            className="text-red-500 p-1 hover:bg-red-50 rounded flex-shrink-0"
                                                            title="일정 삭제"
                                                        >
                                                            <Trash2 size={16} />
                                                        </button>
                                                    )}
                                                </div>
                                            )}
                                        </div>
                                    </div>
                                ))
                            )}
                        </div>
                    </div>

                    {/* New Memo Input */}
                    <div>
                        <div>
                            <label className="block text-xs font-medium text-yellow-800 mb-1">상담 특이사항 추가</label>
                            <textarea
                                className="w-full p-2 border border-yellow-300 rounded bg-white h-[60px] text-sm focus:ring-1 focus:ring-yellow-500 outline-none"
                                value={newMemoContent}
                                onChange={e => setNewMemoContent(e.target.value)}
                                placeholder="추가할 상담 내용을 입력하세요..."
                            />
                            <button
                                onClick={handleAddMemo}
                                className="w-full mt-1 bg-yellow-100 text-yellow-800 border border-yellow-300 px-3 py-1.5 rounded text-xs font-bold hover:bg-yellow-200"
                            >
                                상담 내용 추가
                            </button>
                        </div>

                        {/* Memo List */}
                        <div className="mt-4">
                            <label className="block text-xs font-medium text-yellow-800 mb-2">상담 이력 ({memos.length})</label>
                            <div className="max-h-64 overflow-y-auto space-y-2 bg-yellow-100/30 p-2 rounded">
                                {sortedMemos.length === 0 && <p className="text-center text-xs text-gray-500 py-4">저장된 상담 내용이 없습니다.</p>}
                                {sortedMemos.map(memo => (
                                    <div key={memo.id} className="bg-white p-3 rounded text-xs shadow-sm border border-yellow-100">
                                        <div className="flex justify-between items-start mb-1">
                                            <p className="font-bold text-gray-500 text-[10px]">{safeFormat(memo.createdAt, 'yyyy-MM-dd HH:mm')}</p>
                                            <div className="flex gap-1">
                                                {editingMemoId === memo.id ? (
                                                    <>
                                                        <button type="button" onClick={handleEditMemoSave} className="text-green-600 hover:bg-green-50 p-1 rounded" title="저장">
                                                            <Check size={14} />
                                                        </button>
                                                        <button type="button" onClick={() => setEditingMemoId(null)} className="text-gray-400 hover:bg-gray-100 p-1 rounded" title="취소">
                                                            <X size={14} />
                                                        </button>
                                                    </>
                                                ) : confirmingDeleteMemoId === memo.id ? (
                                                    <>
                                                        <button type="button" onClick={() => handleDeleteMemo(memo.id)} className="text-green-600 hover:bg-green-50 p-1 rounded font-bold" title="확인">
                                                            확인
                                                        </button>
                                                        <button type="button" onClick={() => setConfirmingDeleteMemoId(null)} className="text-red-500 hover:bg-red-50 p-1 rounded" title="취소">
                                                            취소
                                                        </button>
                                                    </>
                                                ) : (
                                                    <>
                                                        <button type="button" onClick={() => { setEditingMemoId(memo.id); setEditMemoContent(memo.content); }} className="text-blue-500 hover:bg-blue-50 p-1 rounded" title="수정">
                                                            <Edit2 size={14} />
                                                        </button>
                                                        <button type="button" onClick={() => setConfirmingDeleteMemoId(memo.id)} className="text-red-500 hover:bg-red-50 p-1 rounded" title="삭제">
                                                            <Trash2 size={14} />
                                                        </button>
                                                    </>
                                                )}
                                            </div>
                                        </div>

                                        {editingMemoId === memo.id ? (
                                            <textarea
                                                className="w-full p-1 border rounded text-xs h-20"
                                                value={editMemoContent}
                                                onChange={e => setEditMemoContent(e.target.value)}
                                            />
                                        ) : (
                                            <p className="text-gray-800 whitespace-pre-wrap leading-relaxed">{memo.content}</p>
                                        )}
                                    </div>
                                ))}
                            </div>
                        </div>
                    </div>
                </div>
            </div>
        </>
    );
};

