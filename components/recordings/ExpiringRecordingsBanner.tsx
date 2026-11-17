import React, { useState, useEffect } from 'react';
import { AlertTriangle, Download, X, ArrowRight, ShieldAlert } from 'lucide-react';
import { fetchExpiringRecordings, fmtBytes } from '../../services/recordings';

interface Props {
  orgId: string;
  isOwnerOrAdmin: boolean;
  onOpenBackupCenter: () => void;
}

export default function ExpiringRecordingsBanner({
  orgId,
  isOwnerOrAdmin,
  onOpenBackupCenter
}: Props) {
  const [urgentCount, setUrgentCount] = useState(0);
  const [urgentBytes, setUrgentBytes] = useState(0);
  const [dismissed, setDismissed] = useState(false);

  useEffect(() => {
    if (!orgId || !isOwnerOrAdmin) return;
    fetchExpiringRecordings(orgId, 30).then((items) => {
      const urgent = items.filter(it => it.daysLeft <= 30);
      setUrgentCount(urgent.length);
      setUrgentBytes(urgent.reduce((acc, cur) => acc + cur.sizeBytes, 0));
    }).catch(() => {});
  }, [orgId, isOwnerOrAdmin]);

  if (!isOwnerOrAdmin || urgentCount === 0 || dismissed) {
    return null;
  }

  return (
    <div className="bg-gradient-to-r from-amber-500 via-amber-600 to-orange-600 text-white px-4 py-2.5 shadow-md flex items-center justify-between gap-3 text-xs sm:text-sm animate-in slide-in-from-top duration-300">
      <div className="flex items-center gap-2.5 min-w-0">
        <div className="w-7 h-7 rounded-lg bg-white/20 flex items-center justify-center shrink-0">
          <ShieldAlert size={17} className="text-white" />
        </div>
        <div className="truncate">
          <span className="font-bold mr-1.5">[통화 녹음 1년 만료 예고]</span>
          <span>
            30일 이내에 영구 삭제될 녹음 <span className="font-extrabold underline">{urgentCount}건</span> ({fmtBytes(urgentBytes)})이 있습니다. PC나 외장하드로 백업하세요.
          </span>
        </div>
      </div>

      <div className="flex items-center gap-2 shrink-0">
        <button
          type="button"
          onClick={onOpenBackupCenter}
          className="bg-white text-amber-900 hover:bg-amber-50 active:scale-95 px-3 py-1.5 rounded-xl font-bold text-xs flex items-center gap-1 shadow-sm transition-all"
        >
          <Download size={13} />
          <span>백업 센터 열기</span>
          <ArrowRight size={12} />
        </button>

        <button
          type="button"
          onClick={() => setDismissed(true)}
          className="p-1 rounded-lg text-white/80 hover:text-white hover:bg-white/10 transition-colors"
          title="오늘 하루 닫기"
        >
          <X size={15} />
        </button>
      </div>
    </div>
  );
}
