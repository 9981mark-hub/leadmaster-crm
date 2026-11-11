import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { AlertCircle, Bell, ChevronRight, X, ShieldAlert, Globe, Crown, CheckCircle2 } from 'lucide-react';
import { fetchActiveBanners, markNoticeRead, Notice } from '../services/noticeService';
import { supabase } from '../services/supabase';

export const NoticeBanner: React.FC = () => {
  const [banners, setBanners] = useState<Notice[]>([]);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [closedIds, setClosedIds] = useState<Set<string>>(new Set());
  const [lockedNotice, setLockedNotice] = useState<Notice | null>(null);
  const navigate = useNavigate();

  const loadBanners = async () => {
    try {
      const list = await fetchActiveBanners();
      const unread = list.filter(n => !n.is_read && !closedIds.has(n.id));
      setBanners(unread);

      // 긴급 필독 잠금 팝업 대상이 있으면 첫 번째 것을 팝업으로 띄움
      const urgentLocked = unread.find(n => n.require_popup_lock && !closedIds.has(n.id));
      if (urgentLocked) {
        setLockedNotice(urgentLocked);
      }
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

  const handleDismiss = async (e: React.MouseEvent, noticeId: string) => {
    e.stopPropagation();
    try {
      await markNoticeRead(noticeId);
      setClosedIds(prev => new Set(prev).add(noticeId));
      setBanners(prev => prev.filter(b => b.id !== noticeId));
      if (lockedNotice?.id === noticeId) {
        setLockedNotice(null);
      }
    } catch (err) {
      console.error(err);
    }
  };

  const current = banners[currentIndex % banners.length];

  return (
    <>
      {/* 1. 긴급 필독 팝업 (require_popup_lock) */}
      {lockedNotice && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/75 backdrop-blur-md">
          <div className="bg-white dark:bg-gray-800 rounded-2xl max-w-lg w-full p-6 shadow-2xl border-2 border-indigo-500/50 space-y-4 animate-in fade-in zoom-in-95 duration-200">
            <div className="flex items-center gap-3">
              <span className="p-2.5 rounded-xl bg-purple-100 dark:bg-purple-950/60 text-purple-600 dark:text-purple-300">
                <Crown size={24} />
              </span>
              <div>
                <span className="inline-flex items-center gap-1 text-[11px] font-bold px-2 py-0.5 rounded-full bg-purple-100 dark:bg-purple-900/60 text-purple-700 dark:text-purple-300">
                  {lockedNotice.is_platform_notice ? '🌐 LeadMaster 본사 공식 공지' : '🚨 중요 필독 공지'}
                  {lockedNotice.platform_target_role === 'admins_only' && ' (대표/관리자 전용)'}
                </span>
                <h3 className="text-lg font-bold text-gray-900 dark:text-white mt-0.5">
                  {lockedNotice.title}
                </h3>
              </div>
            </div>

            <div className="p-4 rounded-xl bg-gray-50 dark:bg-gray-900/50 border border-gray-200 dark:border-gray-700 text-sm leading-relaxed text-gray-800 dark:text-gray-200 max-h-60 overflow-y-auto whitespace-pre-wrap">
              {lockedNotice.content}
            </div>

            <div className="flex items-center justify-between pt-2">
              <span className="text-xs text-gray-500">
                {lockedNotice.is_platform_notice ? '플랫폼 총괄 운영자 송출' : '사내 관리자 송출'}
              </span>
              <button
                type="button"
                onClick={(e) => handleDismiss(e, lockedNotice.id)}
                className="px-5 py-2.5 rounded-xl bg-gradient-to-r from-purple-600 to-indigo-600 hover:from-purple-700 hover:to-indigo-700 text-white font-bold text-sm shadow-md transition-all flex items-center gap-2"
              >
                <CheckCircle2 size={16} /> 공지 내용을 확인했습니다
              </button>
            </div>
          </div>
        </div>
      )}

      {/* 2. 상단 띠배너 */}
      {current && (
        <div
          onClick={() => navigate('/notices')}
          className={`relative z-40 w-full px-4 py-2.5 transition-all duration-300 cursor-pointer shadow-sm ${
            current.is_platform_notice
              ? 'bg-gradient-to-r from-purple-800 via-indigo-700 to-blue-800 text-white'
              : current.notice_type === 'urgent' || current.notice_type === 'policy'
              ? 'bg-gradient-to-r from-red-600 via-rose-600 to-amber-600 text-white'
              : 'bg-gradient-to-r from-blue-600 via-indigo-600 to-blue-700 text-white'
          }`}
        >
          <div className="max-w-7xl mx-auto flex items-center justify-between gap-3 text-sm">
            <div className="flex items-center gap-2.5 overflow-hidden">
              <span className="flex items-center justify-center p-1 rounded-full bg-white/20 shrink-0">
                {current.is_platform_notice ? (
                  <Crown size={16} className="text-amber-300 animate-pulse" />
                ) : current.notice_type === 'urgent' || current.notice_type === 'policy' ? (
                  <ShieldAlert size={16} className="text-white animate-pulse" />
                ) : (
                  <Bell size={16} className="text-white" />
                )}
              </span>

              {/* 배지 구분 */}
              {current.is_platform_notice ? (
                <span className="px-2 py-0.5 rounded text-xs font-bold bg-amber-400/30 text-amber-100 border border-amber-300/40 shrink-0 flex items-center gap-1">
                  <Globe size={12} />
                  {current.platform_target_role === 'admins_only' ? '👑 본사 (대표/관리자 전용)' : '🌐 LeadMaster 공식'}
                </span>
              ) : (
                <span className="px-2 py-0.5 rounded text-xs font-bold bg-white/25 shrink-0">
                  {current.notice_type === 'urgent' ? '🚨 긴급필독' : current.notice_type === 'policy' ? '📋 지침변경' : current.notice_type === 'promotion' ? '🎉 프로모션' : '📢 중요공지'}
                </span>
              )}

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
                onClick={(e) => handleDismiss(e, current.id)}
                title="확인 완료 (닫기)"
                className="p-1 rounded-md hover:bg-white/20 transition-colors ml-1"
              >
                <X size={16} className="text-white" />
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
};

export default NoticeBanner;
