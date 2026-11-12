import React, { useState } from 'react';
import { SettingsCard } from '../SettingsCard';
import { SettingsRow } from '../SettingsRow';
import { TelegramRoomTarget } from '../../../types';
import { MessageCircle, Sparkles, Plus, Trash2, ExternalLink, RefreshCw, Save, Check, Key } from 'lucide-react';
import { AiUsage } from '../../../services/aiProxy';
import { REHABILITATION_DOMAIN_KEYWORDS } from '../../../constants';
import { useToast } from '../../../contexts/ToastContext';

interface IntegrationsSettingsTabProps {
    // 텔레그램 방
    telegramRooms: TelegramRoomTarget[];
    setTelegramRooms: React.Dispatch<React.SetStateAction<TelegramRoomTarget[]>>;
    onSaveTelegramRooms: (rooms: TelegramRoomTarget[]) => void;

    // AI 설정
    aiUsage: AiUsage | null;
    aiKeywords: string;
    setAiKeywords: (keywords: string) => void;
    onSaveAiKeywords: () => void;
    isAdmin: boolean;
}

export const IntegrationsSettingsTab: React.FC<IntegrationsSettingsTabProps> = ({
    telegramRooms,
    setTelegramRooms,
    onSaveTelegramRooms,
    aiUsage,
    aiKeywords,
    setAiKeywords,
    onSaveAiKeywords,
    isAdmin
}) => {
    const { showToast } = useToast();
    const [newRoomName, setNewRoomName] = useState('');
    const [newRoomUrl, setNewRoomUrl] = useState('');

    const handleAddRoom = () => {
        if (!newRoomName.trim() || !newRoomUrl.trim()) {
            showToast('방 이름과 텔레그램 링크를 모두 입력해주세요.', 'error');
            return;
        }
        const updated = [
            ...telegramRooms,
            { id: `room_${Date.now()}`, name: newRoomName.trim(), url: newRoomUrl.trim() }
        ];
        setTelegramRooms(updated);
        onSaveTelegramRooms(updated);
        setNewRoomName('');
        setNewRoomUrl('');
        showToast('텔레그램 방이 등록되었습니다.');
    };

    const handleDeleteRoom = (id: string) => {
        const updated = telegramRooms.filter(r => r.id !== id);
        setTelegramRooms(updated);
        onSaveTelegramRooms(updated);
        showToast('텔레그램 방이 삭제되었습니다.');
    };

    const handleResetKeywords = () => {
        const defaultStr = REHABILITATION_DOMAIN_KEYWORDS.join(', ');
        setAiKeywords(defaultStr);
        localStorage.setItem('lm_aiKeywords', defaultStr);
        showToast('기본 도메인 키워드로 초기화되었습니다.');
    };

    return (
        <div className="space-y-6">
            {/* 1. 텔레그램 연동 센터 */}
            <SettingsCard
                title="텔레그램 상담 접수 및 공지 연동"
                description="상담 요약문 및 정산 알림을 전송할 텔레그램 그룹/채널 방 목록을 관리합니다."
                icon={<MessageCircle size={18} />}
            >
                <div className="space-y-4">
                    {/* 등록된 텔레그램 방 목록 */}
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                        {telegramRooms.map(room => (
                            <div
                                key={room.id}
                                className="flex items-center justify-between p-3.5 bg-gray-50 dark:bg-gray-750 rounded-xl border border-gray-200 dark:border-gray-700"
                            >
                                <div className="min-w-0 flex-1 mr-2">
                                    <div className="flex items-center gap-1.5 font-bold text-xs text-gray-800 dark:text-gray-200">
                                        <MessageCircle size={14} className="text-blue-500 shrink-0" />
                                        <span className="truncate">{room.name}</span>
                                    </div>
                                    <div className="text-[11px] text-gray-400 truncate mt-0.5 font-mono">
                                        {room.url}
                                    </div>
                                </div>
                                <div className="flex items-center gap-1 shrink-0">
                                    <a
                                        href={room.url}
                                        target="_blank"
                                        rel="noopener noreferrer"
                                        className="p-1.5 text-gray-400 hover:text-blue-600 rounded-lg hover:bg-gray-200 dark:hover:bg-gray-600 transition-colors"
                                        title="바로가기"
                                    >
                                        <ExternalLink size={14} />
                                    </a>
                                    <button
                                        type="button"
                                        onClick={() => handleDeleteRoom(room.id)}
                                        className="p-1.5 text-gray-400 hover:text-rose-500 rounded-lg hover:bg-gray-200 dark:hover:bg-gray-600 transition-colors"
                                        title="삭제"
                                    >
                                        <Trash2 size={14} />
                                    </button>
                                </div>
                            </div>
                        ))}
                        {telegramRooms.length === 0 && (
                            <div className="col-span-full text-center py-6 text-xs text-gray-400 bg-gray-50 dark:bg-gray-800/40 rounded-xl border border-dashed border-gray-200 dark:border-gray-700">
                                등록된 텔레그램 방이 없습니다. 아래에서 새 방을 추가하세요.
                            </div>
                        )}
                    </div>

                    {/* 방 추가 폼 */}
                    <div className="p-4 bg-gray-50/70 dark:bg-gray-750/70 rounded-xl border border-gray-200 dark:border-gray-700">
                        <h4 className="text-xs font-bold text-gray-600 dark:text-gray-300 uppercase mb-3">
                            + 신규 텔레그램 방 등록
                        </h4>
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 mb-3">
                            <input
                                type="text"
                                placeholder="방 이름 (예: 안철형 변호사 접수방)"
                                className="p-2 text-xs bg-white dark:bg-gray-700 border border-gray-300 dark:border-gray-600 rounded-xl outline-none"
                                value={newRoomName}
                                onChange={e => setNewRoomName(e.target.value)}
                            />
                            <input
                                type="text"
                                placeholder="초대 링크 또는 t.me 링크"
                                className="p-2 text-xs bg-white dark:bg-gray-700 border border-gray-300 dark:border-gray-600 rounded-xl outline-none"
                                value={newRoomUrl}
                                onChange={e => setNewRoomUrl(e.target.value)}
                            />
                        </div>
                        <div className="flex justify-end">
                            <button
                                type="button"
                                onClick={handleAddRoom}
                                className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white text-xs font-bold rounded-xl shadow-xs transition-colors"
                            >
                                방 추가
                            </button>
                        </div>
                    </div>
                </div>
            </SettingsCard>

            {/* 2. AI 사용량 & 도메인 사전 */}
            <SettingsCard
                title="AI 엔진 및 음성인식(STT) 도메인 사전"
                description="Google Gemini AI 사용량 및 법률/회생/파산 전문 용어 인식 보정 사전을 관리합니다."
                icon={<Sparkles size={18} />}
                headerAction={
                    <button
                        type="button"
                        onClick={onSaveAiKeywords}
                        className="flex items-center gap-1.5 px-4 py-1.5 text-xs font-bold text-white bg-blue-600 hover:bg-blue-700 rounded-xl shadow-xs transition-colors"
                    >
                        <Save size={14} /> 키워드 저장
                    </button>
                }
            >
                {/* AI 사용량 바 */}
                {isAdmin && aiUsage && (
                    <div className="p-4 bg-purple-50/50 dark:bg-purple-950/20 rounded-xl border border-purple-200 dark:border-purple-800/60 mb-6">
                        <div className="flex items-center justify-between mb-2">
                            <div className="flex items-center gap-2">
                                <Sparkles size={15} className="text-purple-600" />
                                <span className="text-xs font-bold text-purple-900 dark:text-purple-200">
                                    오늘의 Gemini AI 토큰 사용 현황
                                </span>
                            </div>
                            <span className="text-xs font-mono font-bold text-purple-700 dark:text-purple-300">
                                {aiUsage.callsCount ?? 0}회 호출됨
                            </span>
                        </div>
                        <p className="text-[11px] text-purple-700/80 dark:text-purple-300/80">
                            통화 녹취 분석 및 사건 요약, AI OCR 판독에 사용된 실시간 집계입니다.
                        </p>
                    </div>
                )}

                {/* 도메인 키워드 */}
                <SettingsRow
                    label="개인회생 · 파산 특화 어휘 보정 사전"
                    description="STT 음성 인식 시 발음이 뭉개지기 쉬운 법률 전문 용어를 쉼표(,)로 구분하여 입력합니다."
                >
                    <div className="space-y-3">
                        <textarea
                            rows={6}
                            className="w-full p-3 text-xs font-mono bg-white dark:bg-gray-700 border border-gray-300 dark:border-gray-600 rounded-xl outline-none"
                            value={aiKeywords}
                            onChange={e => setAiKeywords(e.target.value)}
                        />
                        <div className="flex items-center justify-between">
                            <button
                                type="button"
                                onClick={handleResetKeywords}
                                className="text-xs text-gray-500 hover:text-gray-800 dark:hover:text-gray-200 flex items-center gap-1 transition-colors"
                            >
                                <RefreshCw size={12} /> 기본 어휘집으로 초기화
                            </button>
                            <span className="text-[11px] text-gray-400">
                                총 {aiKeywords.split(',').filter(k => k.trim()).length}개 단어 등록됨
                            </span>
                        </div>
                    </div>
                </SettingsRow>
            </SettingsCard>
        </div>
    );
};
