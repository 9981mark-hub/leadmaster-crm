import React, { useState } from 'react';
import { SettingsCard } from '../SettingsCard';
import { SettingsRow } from '../SettingsRow';
import { TelegramRoomTarget } from '../../../types';
import { MessageCircle, Sparkles, Plus, Trash2, ExternalLink, RefreshCw, Save, Activity } from 'lucide-react';
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

    const keywordCount = aiKeywords
        .split(',')
        .map(k => k.trim())
        .filter(Boolean).length;

    return (
        <div className="space-y-6">
            {/* 1. 텔레그램 연동 센터 */}
            <SettingsCard
                title="텔레그램 상담 접수 및 공지 연동"
                description="상담 요약문 및 정산 알림을 전송할 텔레그램 그룹/채널 방 목록을 관리합니다."
                icon={<MessageCircle size={18} strokeWidth={1.75} />}
            >
                <div className="space-y-4">
                    {/* 등록된 텔레그램 방 목록 */}
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                        {telegramRooms.map(room => (
                            <div
                                key={room.id}
                                className="flex items-center justify-between p-3.5 bg-muted/30 rounded-xl border border-border hover:border-primary/40 transition-colors"
                            >
                                <div className="min-w-0 flex-1 mr-2">
                                    <div className="flex items-center gap-1.5 font-medium text-xs text-foreground">
                                        <MessageCircle size={13} strokeWidth={1.75} className="text-primary shrink-0" />
                                        <span className="truncate">{room.name}</span>
                                    </div>
                                    <div className="text-2xs text-muted-foreground truncate mt-0.5 font-mono">
                                        {room.url}
                                    </div>
                                </div>
                                <div className="flex items-center gap-1 shrink-0">
                                    <a
                                        href={room.url}
                                        target="_blank"
                                        rel="noopener noreferrer"
                                        className="p-1.5 text-muted-foreground hover:text-foreground rounded-md hover:bg-muted transition-colors"
                                        title="바로가기"
                                    >
                                        <ExternalLink size={13} strokeWidth={1.75} />
                                    </a>
                                    <button
                                        type="button"
                                        onClick={() => handleDeleteRoom(room.id)}
                                        className="p-1.5 text-muted-foreground hover:text-destructive rounded-md hover:bg-destructive/10 transition-colors"
                                        title="삭제"
                                    >
                                        <Trash2 size={13} strokeWidth={1.75} />
                                    </button>
                                </div>
                            </div>
                        ))}
                        {telegramRooms.length === 0 && (
                            <div className="col-span-full text-center py-6 text-xs text-muted-foreground bg-muted/20 rounded-xl border border-dashed border-border">
                                등록된 텔레그램 방이 없습니다. 아래에서 새 방을 추가하세요.
                            </div>
                        )}
                    </div>

                    {/* 방 추가 폼 */}
                    <div className="p-4 bg-muted/40 rounded-xl border border-border space-y-3">
                        <div className="flex items-center gap-1.5 text-xs font-semibold text-foreground uppercase tracking-wider">
                            <Plus size={13} strokeWidth={1.75} className="text-primary" />
                            <span>신규 텔레그램 방 등록</span>
                        </div>
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                            <input
                                type="text"
                                placeholder="방 이름 (예: 법률사무소 상담 접수방)"
                                className="h-9 px-3 text-xs bg-background text-foreground border border-input rounded-lg outline-none focus:ring-1 focus:ring-ring focus:border-ring placeholder:text-muted-foreground"
                                value={newRoomName}
                                onChange={e => setNewRoomName(e.target.value)}
                            />
                            <input
                                type="text"
                                placeholder="초대 링크 또는 t.me 링크"
                                className="h-9 px-3 text-xs bg-background text-foreground border border-input rounded-lg outline-none focus:ring-1 focus:ring-ring focus:border-ring placeholder:text-muted-foreground"
                                value={newRoomUrl}
                                onChange={e => setNewRoomUrl(e.target.value)}
                            />
                        </div>
                        <div className="flex justify-end pt-1">
                            <button
                                type="button"
                                onClick={handleAddRoom}
                                className="inline-flex items-center gap-1.5 h-8 px-3.5 bg-primary hover:bg-primary/90 text-primary-foreground text-xs font-medium rounded-lg shadow-2xs transition-colors"
                            >
                                <Plus size={13} strokeWidth={1.75} />
                                <span>방 추가</span>
                            </button>
                        </div>
                    </div>
                </div>
            </SettingsCard>

            {/* 2. AI 사용량 & 도메인 사전 */}
            <SettingsCard
                title="AI 엔진 및 음성인식(STT) 도메인 사전"
                description="Google Gemini AI 사용량 및 법률/회생/파산 전문 용어 인식 보정 사전을 관리합니다."
                icon={<Sparkles size={18} strokeWidth={1.75} />}
                headerAction={
                    <button
                        type="button"
                        onClick={onSaveAiKeywords}
                        className="inline-flex items-center gap-1.5 h-8 px-3.5 text-xs font-medium text-primary-foreground bg-primary hover:bg-primary/90 rounded-lg shadow-2xs transition-colors"
                    >
                        <Save size={13} strokeWidth={1.75} />
                        <span>키워드 저장</span>
                    </button>
                }
            >
                {/* AI 사용량 바 */}
                {isAdmin && aiUsage && (
                    <div className="p-4 bg-primary/5 rounded-xl border border-primary/20 mb-6">
                        <div className="flex items-center justify-between mb-1.5">
                            <div className="flex items-center gap-2">
                                <Activity size={14} strokeWidth={1.75} className="text-primary" />
                                <span className="text-xs font-semibold text-foreground">
                                    오늘의 Gemini AI 토큰 사용 현황
                                </span>
                            </div>
                            <span className="text-xs font-mono font-medium text-primary bg-primary/10 border border-primary/20 px-2.5 py-0.5 rounded tabular-nums">
                                {aiUsage.callsCount ?? 0}회 호출됨
                            </span>
                        </div>
                        <p className="text-2xs text-muted-foreground leading-relaxed">
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
                            className="w-full p-3 text-xs font-mono bg-background text-foreground border border-input rounded-xl outline-none focus:ring-1 focus:ring-ring focus:border-ring leading-relaxed transition-colors resize-y"
                            value={aiKeywords}
                            onChange={e => setAiKeywords(e.target.value)}
                            placeholder="개인회생, 파산면책, 금지명령, 중지명령, 개시결정, 변제계획안..."
                        />
                        <div className="flex items-center justify-between text-xs">
                            <button
                                type="button"
                                onClick={handleResetKeywords}
                                className="text-2xs text-muted-foreground hover:text-foreground flex items-center gap-1 transition-colors px-1 py-0.5 rounded hover:bg-muted"
                            >
                                <RefreshCw size={12} strokeWidth={1.75} />
                                <span>기본 어휘집으로 초기화</span>
                            </button>
                            <span className="text-2xs font-mono text-muted-foreground tabular-nums">
                                총 {keywordCount}개 단어 등록됨
                            </span>
                        </div>
                    </div>
                </SettingsRow>
            </SettingsCard>
        </div>
    );
};
