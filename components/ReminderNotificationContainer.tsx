import React from 'react';
import { useReminder } from '../contexts/ReminderContext';
import { useNavigate } from 'react-router-dom';
import { Bell, X, ArrowRight } from 'lucide-react';

const ReminderNotificationContainer: React.FC = () => {
    const { notifications, dismissNotification } = useReminder();
    const navigate = useNavigate();

    if (notifications.length === 0) return null;

    return (
        <div className="fixed bottom-4 right-4 z-[9999] flex flex-col gap-2 max-w-[90vw] md:max-w-sm w-full">
            {notifications.map((n) => (
                <div
                    key={n.id}
                    className="bg-white dark:bg-gray-800 border-l-4 border-yellow-500 shadow-xl rounded-lg p-4 animate-slide-in-right relative"
                >
                    <div className="flex justify-between items-start mb-2">
                        <div className="flex items-center gap-2 text-yellow-600 dark:text-yellow-500 font-bold">
                            <Bell size={18} className="animate-bounce" />
                            <span>10분 전 알림</span>
                        </div>
                        <button
                            onClick={() => dismissNotification(n.id)}
                            className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-200"
                        >
                            <X size={18} />
                        </button>
                    </div>

                    <h4 className="font-bold text-lg text-gray-800 dark:text-white mb-1">
                        {n.customerName}
                    </h4>

                    <div className="text-sm text-gray-600 dark:text-gray-300 mb-3 bg-gray-50 dark:bg-gray-700 p-2 rounded">
                        <p className="font-mono font-bold">{n.reminder.datetime.split(' ')[1]}</p>
                        <p>{n.reminder.type || '일정'} - {n.reminder.content || '내용 없음'}</p>
                    </div>

                    <div className="flex gap-2">
                        <button
                            onClick={() => {
                                navigate(`/case/${n.caseId}`);
                                dismissNotification(n.id);
                            }}
                            className="flex-1 bg-yellow-500 hover:bg-yellow-600 text-white py-2 px-3 rounded font-bold text-sm flex items-center justify-center gap-1 transition-colors"
                        >
                            확인 (상세이동) <ArrowRight size={14} />
                        </button>
                        <button
                            onClick={() => dismissNotification(n.id)}
                            className="flex-1 bg-gray-100 hover:bg-gray-200 dark:bg-gray-700 dark:hover:bg-gray-600 text-gray-700 dark:text-gray-200 py-2 px-3 rounded font-medium text-sm transition-colors"
                        >
                            닫기
                        </button>
                    </div>
                </div>
            ))}
        </div>
    );
};

export default ReminderNotificationContainer;
