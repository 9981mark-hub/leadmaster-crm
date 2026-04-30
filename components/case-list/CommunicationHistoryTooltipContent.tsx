import React from 'react';
import { useCommunicationLogs } from '../../services/queries';
import { Phone, MessageSquare, PhoneIncoming, PhoneOutgoing, PhoneMissed } from 'lucide-react';
import { format } from 'date-fns';
import { ko } from 'date-fns/locale';

interface Props {
    phone: string;
}

export default function CommunicationHistoryTooltipContent({ phone }: Props) {
    const { data: logs, isLoading, error } = useCommunicationLogs(phone);

    if (isLoading) {
        return <div className="flex justify-center items-center h-20"><div className="animate-spin rounded-full h-5 w-5 border-b-2 border-white"></div></div>;
    }

    if (error || !logs) {
        return <div className="text-center text-gray-400 py-4">기록을 불러올 수 없습니다.</div>;
    }

    if (logs.length === 0) {
        return <div className="text-center text-gray-400 py-4">통화 및 문자 기록이 없습니다.</div>;
    }

    const getIcon = (type: string) => {
        switch (type) {
            case 'incoming_call': return <PhoneIncoming size={14} className="text-blue-400" />;
            case 'outgoing_call': return <PhoneOutgoing size={14} className="text-green-400" />;
            case 'missed_call': return <PhoneMissed size={14} className="text-red-400" />;
            case 'incoming_sms': return <MessageSquare size={14} className="text-blue-400" />;
            case 'outgoing_sms': return <MessageSquare size={14} className="text-green-400" />;
            default: return <Phone size={14} />;
        }
    };

    const getLabel = (type: string) => {
        switch (type) {
            case 'incoming_call': return '수신 통화';
            case 'outgoing_call': return '발신 통화';
            case 'missed_call': return '부재중 통화';
            case 'incoming_sms': return '수신 문자';
            case 'outgoing_sms': return '발신 문자';
            default: return '알 수 없음';
        }
    };

    const formatDuration = (seconds?: number) => {
        if (!seconds) return '';
        const m = Math.floor(seconds / 60);
        const s = seconds % 60;
        return `(${m}분 ${s}초)`;
    };

    return (
        <div className="max-h-64 overflow-y-auto pr-2 custom-scrollbar flex flex-col gap-3">
            {logs.map((log) => (
                <div key={log.id} className="bg-gray-800/50 rounded p-2 text-xs border border-gray-700/50">
                    <div className="flex justify-between items-start mb-1">
                        <div className="flex items-center gap-1.5 font-semibold">
                            {getIcon(log.type)}
                            <span>{getLabel(log.type)}</span>
                        </div>
                        <span className="text-gray-400 text-[10px]">
                            {format(new Date(log.timestamp), 'MM.dd HH:mm')}
                        </span>
                    </div>
                    
                    {log.duration !== undefined && log.duration > 0 && log.type.includes('call') && (
                        <div className="text-gray-300 mt-1">
                            통화 시간: {formatDuration(log.duration)}
                        </div>
                    )}
                    
                    {log.content && (
                        <div className="text-gray-300 mt-1 whitespace-pre-wrap break-words">
                            {log.content}
                        </div>
                    )}
                    
                    {log.lineInfo && log.lineInfo !== '기본' && (
                        <div className="mt-1.5 inline-block px-1.5 py-0.5 bg-gray-700 text-gray-300 rounded text-[9px]">
                            {log.lineInfo}
                        </div>
                    )}
                </div>
            ))}
        </div>
    );
}
