import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { subscribe, fetchCases } from '../services/api';
import { Case } from '../types';
import { Sparkles, X, ArrowRight, BellRing } from 'lucide-react';

const NewCasePopup: React.FC = () => {
    const [newCases, setNewCases] = useState<Case[]>([]);
    const [visible, setVisible] = useState(false);
    const [lastCount, setLastCount] = useState(0);
    const navigate = useNavigate();

    const checkForNewCases = async () => {
        const cases = await fetchCases();
        const currentNewCases = cases.filter(c => c.isNew);
        const count = currentNewCases.length;

        setNewCases(currentNewCases);

        // Logic: Show if we have new cases and (it's the first check OR count increased OR it's just > 0 and we haven't dismissed it yet?)
        // Simple logic for now: If count > 0 and we haven't manually dismissed (managed by visible state), we show it.
        // However, if we refresh, we want it to show.
        // If we navigate, we want it to stay (global).
        // If user dismisses, we hide it until count CHANGES (e.g. gets more).

        if (count > 0) {
            // If count changed (new one arrived) or first load
            if (count !== lastCount) {
                setVisible(true);
            }
        } else {
            setVisible(false);
        }

        setLastCount(count);
    };

    useEffect(() => {
        // Initial check
        checkForNewCases();

        // Subscribe to updates
        const unsubscribe = subscribe(() => {
            checkForNewCases();
        });

        return () => unsubscribe();
    }, [lastCount]); // Depend on lastCount to detect changes properly

    if (!visible || newCases.length === 0) return null;

    return (
        <div className="fixed bottom-4 left-4 z-[9999] flex flex-col gap-2 max-w-[90vw] md:max-w-sm w-full animate-slide-in-up">
            {/* Positioning: Reminder is usually bottom-right. User asked for this "also like reminder".
                 To avoid overlap if both exist, maybe stack them?
                 ReminderContainer is fixed bottom-right.
                 I'll place this one bottom-right too, but maybe with a margin offset if possible? 
                 Or just let them stack naturally via css?
                 Since they are separate containers, they will overlap.
                 Let's place this one slightly higher or same place (stacking is hard without shared context).
                 Alternative: Place it Top-Right or Bottom-Center?
                 User said "Like reminder popup". 
                 Reminder is bottom-right.
                 Let's put this one TOP-RIGHT to clearly distinguish? 
                 Or Bottom-Left?
                 Common for Chat/Alerts is Bottom-Right.
                 I will put it Bottom-Right but with `bottom-24` (above reminder) or use a shared Layout logic.
                 Wait, checking ReminderNotificationContainer... it uses `fixed bottom-4 right-4`.
                 If I use the same, they overlap.
                 Let's use `bottom-4 left-4` to separate them spatially? Or `top-4 right-4`.
                 "Top-Right" is standard for "New Item" toasts.
             */}
            <div className="bg-red-50 dark:bg-gray-800 border-l-4 border-red-500 shadow-xl rounded-lg p-4 relative">
                <div className="flex justify-between items-start mb-2">
                    <div className="flex items-center gap-2 text-red-600 font-bold">
                        <Sparkles size={18} className="animate-spin-slow" />
                        <span>새로운 접수 알림</span>
                    </div>
                    <button
                        onClick={() => setVisible(false)}
                        className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-200"
                    >
                        <X size={18} />
                    </button>
                </div>

                <div className="mb-3">
                    <h4 className="font-bold text-lg text-gray-800 dark:text-white">
                        {newCases.length}건의 신규 접수!
                    </h4>
                    <p className="text-sm text-gray-600 dark:text-gray-300">
                        확인하지 않은 상담 신청이 있습니다.
                    </p>
                </div>

                {newCases.length === 1 && (
                    <div className="text-sm text-gray-600 dark:text-gray-300 mb-3 bg-white dark:bg-gray-700 p-2 rounded border border-red-100">
                        <p className="font-bold">{newCases[0].customerName}</p>
                        <p className="text-xs">{newCases[0].phone}</p>
                    </div>
                )}

                <div className="flex gap-2">
                    <button
                        onClick={() => {
                            // [Fix] Always go to Case List with "New Only" filter active
                            // This matches the behavior of the top banner in CaseList
                            sessionStorage.setItem('lm_showNewOnly', 'true');

                            // Force a storage event dispatch or just navigate (CaseList reads on mount)
                            // Since we might already be on /cases, we might need to force a re-render if we were already there.
                            // But usually navigation to same route with state change is fine.
                            // Ideally, we just set storage and go.
                            window.dispatchEvent(new Event('storage')); // Optional, if we want to react immediately if on same page
                            navigate('/cases');
                            setVisible(false);
                        }}
                        className="flex-1 bg-red-600 hover:bg-red-700 text-white py-2 px-3 rounded font-bold text-sm flex items-center justify-center gap-1 transition-colors"
                    >
                        확인하기 <ArrowRight size={14} />
                    </button>
                    <button
                        onClick={() => setVisible(false)}
                        className="flex-1 bg-white hover:bg-gray-50 border border-gray-200 text-gray-700 py-2 px-3 rounded font-medium text-sm transition-colors"
                    >
                        닫기
                    </button>
                </div>
            </div>
        </div>
    );
};

export default NewCasePopup;
