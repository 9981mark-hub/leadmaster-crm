import React, { useEffect, useState } from 'react';
import { RefreshCw, Send } from 'lucide-react';
import { KnownTelegramChat, fetchKnownTelegramChats, sendTelegramTestMessage } from '../services/telegramDelivery';

interface Props {
    value: string;
    onChange: (chatId: string) => void;
}

const statusLabel = (s?: string) =>
    s === 'left' || s === 'kicked' ? ' · 봇 나감' : s === 'administrator' ? ' · 봇 관리자' : '';

/** 거래처 편집: 회사 봇이 들어가 있는 텔레그램 방 고르기 + 직접 입력 + 연결 시험 */
export const TelegramChatPicker: React.FC<Props> = ({ value, onChange }) => {
    const [chats, setChats] = useState<KnownTelegramChat[]>([]);
    const [loading, setLoading] = useState(false);
    const [testing, setTesting] = useState(false);
    const [msg, setMsg] = useState<{ text: string; ok: boolean } | null>(null);

    const load = async () => {
        setLoading(true);
        setChats(await fetchKnownTelegramChats());
        setLoading(false);
    };
    useEffect(() => { load(); }, []);

    const current = chats.find(c => c.chatId === value);
    const handleTest = async () => {
        if (!value.trim()) return;
        setTesting(true);
        setMsg(null);
        try {
            const title = await sendTelegramTestMessage(value.trim());
            setMsg({ ok: true, text: `시험 메시지를 보냈습니다${title ? ` (${title})` : ''}. 텔레그램 방에서 확인하세요.` });
            load();
        } catch (e) {
            setMsg({ ok: false, text: (e as Error).message });
        } finally {
            setTesting(false);
        }
    };

    return (
        <div className="space-y-2">
            <div className="flex gap-2">
                <select
                    className="flex-1 p-2 border rounded focus:ring-2 focus:ring-blue-200 outline-none text-sm"
                    value={current ? value : ''}
                    onChange={e => { if (e.target.value) onChange(e.target.value); }}
                >
                    <option value="">{chats.length > 0 ? '— 봇이 있는 방에서 고르기 —' : (loading ? '방 목록 불러오는 중…' : '— 아직 기록된 방이 없습니다 —')}</option>
                    {chats.map(ch => (
                        <option key={ch.chatId} value={ch.chatId}>
                            {(ch.title || '(이름 없음)')} · {ch.chatId}{statusLabel(ch.botStatus)}{ch.migratedTo ? ' · 슈퍼그룹으로 바뀜' : ''}
                        </option>
                    ))}
                </select>
                <button type="button" onClick={load} className="px-2 border rounded text-gray-500 hover:bg-gray-50" title="방 목록 새로고침">
                    <RefreshCw size={14} className={loading ? 'animate-spin' : ''} />
                </button>
            </div>
            <div className="flex gap-2">
                <input
                    type="text"
                    className="flex-1 p-2 border rounded focus:ring-2 focus:ring-blue-200 outline-none text-sm"
                    placeholder="또는 방 ID 직접 입력 (예: -1001234567890)"
                    value={value}
                    onChange={e => onChange(e.target.value.trim())}
                />
                <button
                    type="button"
                    onClick={handleTest}
                    disabled={!value.trim() || testing}
                    className="px-3 py-2 rounded bg-sky-600 text-white text-xs font-bold disabled:opacity-50 flex items-center gap-1 whitespace-nowrap"
                >
                    <Send size={12} /> {testing ? '보내는 중…' : '연결 시험'}
                </button>
            </div>
            {current?.migratedTo && (
                <p className="text-xs text-amber-700">이 방은 슈퍼그룹으로 바뀌어 새 ID({current.migratedTo})를 써야 합니다.
                    <button type="button" className="underline ml-1" onClick={() => onChange(current.migratedTo!)}>새 ID로 바꾸기</button>
                </p>
            )}
            {msg && <p className={`text-xs ${msg.ok ? 'text-green-600' : 'text-red-600'}`}>{msg.text}</p>}
            <p className="text-xs text-gray-400">
                변호사 사무실 방에 회사 봇을 초대하면 이 목록에 자동으로 나타납니다(방에 메시지가 한 번 오가면 확실히 잡힙니다).
                방을 고른 뒤 아래 저장을 눌러야 적용됩니다.
            </p>
        </div>
    );
};

export default TelegramChatPicker;
