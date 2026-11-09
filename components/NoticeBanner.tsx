import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { AlertCircle, Bell, ChevronRight, X, ShieldAlert } from 'lucide-react';
import { fetchActiveBanners, markNoticeRead, Notice } from '../services/noticeService';
import { supabase } from '../services/supabase';

export const NoticeBanner: React.FC = () => {
  const [banners, setBanners] = useState<Notice[]>([]);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [closedIds, setClosedIds] = useState<Set<string>>(new Set());
  const navigate = useNavigate();

  const loadBanners = async () => {
    try {
      const list = await fetchActiveBanners();
      const unread = list.filter(n => !n.is_read && !closedIds.has(n.id));
      setBanners(unread);
    } catch (e) {
      console.warn('Failed to load notice banners:', e);
    }
  };

  useEffect(() => {
    loadBanners();

    if (supabase) {
      const channel = supabase
        .channel('realtime_notices')
        .on('postgres_changes', { event: '*', schema: 'public', table: 'notices' }, () => {
          loadBanners();
        })
        .subscribe();

      return () => {
        supabase.removeChannel(channel);
      };
    }
  }, [closedIds]);

  if (banners.length === 0) return null;

  const current = banners[currentIndex % banners.length];
  if (!current) return null;

  const handleDismiss = async (e: React.MouseEvent) => {
    e.stopPropagation();
    try {
      await markNoticeRead(current.id);
      setClosedIds(prev => new Set(prev).add(current.id));
      setBanners(prev => prev.filter(b => b.id !== current.id));
    } catch (err) {
      console.error(err);
    }
  };

  const isUrgent = current.notice_type === 'urgent' || current.notice_type === 'policy';

  return (
    <div
      onClick={() => navigate('/notices')}
      className={`relative z-40 w-full px-4 py-2.5 transition-all duration-300 cursor-pointer shadow-sm ${
        isUrgent
          ? 'bg-gradient-to-r from-red-600 via-rose-600 to-amber-600 text-white'
          : 'bg-gradient-to-r from-blue-600 via-indigo-600 to-blue-700 text-white'
      }`}
    >
      <div className="max-w-7xl mx-auto flex items-center justify-between gap-3 text-sm">
        <div className="flex items-center gap-2.5 overflow-hidden">
          <span className="flex items-center justify-center p-1 rounded-full bg-white/20 shrink-0">
            {isUrgent ? <ShieldAlert size={16} className="text-white animate-pulse" /> : <Bell size={16} className="text-white" />}
          </span>
          <span className="px-2 py-0.5 rounded text-xs font-bold bg-white/25 shrink-0">
            {current.notice_type === 'urgent' ? '🚨 긴급필독' : current.notice_type === 'policy' ? '📋 지침변경' : current.notice_type === 'promotion' ? '🎉 프로모션' : '📢 중요공지'}
          </span>
          <span className="font-semibold truncate">{current.title}</span>
          <span className="hidden md:inline text-white/80 truncate text-xs">— {current.content.replace(/\n/g, ' ')}</span>
        </div>

        <div className="flex items-center gap-2 shrink-0">
          {banners.length > 1 && (
            <span className="text-[11px] bg-black/20 px-2 py-0.5 rounded-full text-white/90">
              {(currentIndex % banners.length) + 1} / {banners.length}
            </span>
          )}
          <span className="hidden sm:inline-flex items-center gap-0.5 text-xs font-medium text-white/90 hover:text-white underline underline-offset-2">
            상세보기 <ChevronRight size={14} />
          </span>
          <button
            onClick={handleDismiss}
            title="확인 완료 (닫기)"
            className="p-1 rounded-md hover:bg-white/20 transition-colors ml-1"
          >
            <X size={16} className="text-white" />
          </button>
        </div>
      </div>
    </div>
  );
};

export default NoticeBanner;
