import React, { useState, useEffect, useRef } from 'react';
import { Phone, PhoneIncoming, PhoneOutgoing, PhoneMissed, MessageSquare, Plus, Save, Send } from 'lucide-react';
import { Case } from '../../types';
import { useCommunicationLogs, useSmsTemplates, useSaveSmsTemplateMutation, useEnqueueSmsMutation } from '../../services/queries';
import { format } from 'date-fns';
import { ko } from 'date-fns/locale';

interface CaseCallsSmsTabProps {
  c: Case;
}

export function CaseCallsSmsTab({ c }: CaseCallsSmsTabProps) {
  const { data: logs = [], isLoading: logsLoading } = useCommunicationLogs(c.phone);
  const { data: templates = [], isLoading: templatesLoading } = useSmsTemplates();
  const saveTemplateMutation = useSaveSmsTemplateMutation();
  const enqueueSmsMutation = useEnqueueSmsMutation();

  const [activeTemplateId, setActiveTemplateId] = useState<string | null>('custom');
  const [editingTemplate, setEditingTemplate] = useState<{ id?: string, title: string, content: string } | null>(null);
  const [customMessage, setCustomMessage] = useState('');

  const messagesEndRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [logs]);

  const handleSendSms = (content: string) => {
    if (!content.trim()) return;
    if (window.confirm(`스마트폰을 통해 문자를 발송하시겠습니까?\n\n내용:\n${content}`)) {
      enqueueSmsMutation.mutate({ phone: c.phone, content });
    }
  };

  const handleSaveTemplate = () => {
    if (!editingTemplate) return;
    if (!editingTemplate.title.trim() || !editingTemplate.content.trim()) {
      alert('제목과 내용을 모두 입력해주세요.');
      return;
    }
    
    // Max 5 templates rule
    if (!editingTemplate.id && templates.length >= 5) {
      alert('템플릿은 최대 5개까지만 저장할 수 있습니다.');
      return;
    }

    saveTemplateMutation.mutate(editingTemplate, {
      onSuccess: () => {
        setEditingTemplate(null);
      }
    });
  };

  return (
    <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 h-full">
      {/* 왼쪽: 통화 및 문자 타임라인 */}
      <div className="flex flex-col bg-gray-50/50 rounded-xl p-5 border border-gray-200/60 shadow-sm" style={{ maxHeight: '600px' }}>
        <h3 className="font-bold text-gray-800 mb-6 flex items-center gap-2 shrink-0">
          <MessageSquare className="w-5 h-5 text-blue-500" />
          통화 및 문자 기록
        </h3>
        
        <div className="flex-1 overflow-y-auto pr-3 space-y-6 custom-scrollbar" style={{ minHeight: 0 }}>
          {logsLoading ? (
            <div className="flex flex-col items-center justify-center h-40 text-gray-400">
              <div className="w-6 h-6 border-2 border-blue-500 border-t-transparent rounded-full animate-spin mb-3"></div>
              기록을 불러오는 중...
            </div>
          ) : logs.length === 0 ? (
            <div className="flex flex-col items-center justify-center h-40 text-gray-400 bg-white rounded-xl border border-dashed border-gray-200">
              <MessageSquare className="w-8 h-8 text-gray-300 mb-2" />
              해당 고객과의 통화 및 문자 기록이 없습니다.
              <span className="text-xs mt-1 text-gray-400">(스마트폰 앱에서 자동으로 동기화됩니다)</span>
            </div>
          ) : (
            <>
              {[...logs].reverse().map((log, index, arr) => {
                const date = new Date(log.timestamp);
                const dateStr = format(date, 'yyyy년 M월 d일 eeee', { locale: ko });
                const prevLogInArray = index > 0 ? arr[index - 1] : null;
                const prevDateStrInArray = prevLogInArray ? format(new Date(prevLogInArray.timestamp), 'yyyy년 M월 d일 eeee', { locale: ko }) : null;
                const showDateSeparator = dateStr !== prevDateStrInArray;

              const isCall = log.type.includes('CALL');
              const isMissed = log.type === 'CALL_MISSED';
              const isInbound = log.type.includes('IN') || isMissed;
              
              const formatDuration = (seconds: number) => {
                if (!seconds) return '';
                const m = Math.floor(seconds / 60);
                const s = seconds % 60;
                if (m === 0) return `${s}초`;
                return `${m}분 ${s}초`;
              };

              return (
                <React.Fragment key={log.id}>
                  {showDateSeparator && (
                    <div className="flex justify-center my-6">
                      <div className="bg-gray-200/70 text-gray-600 text-[11px] font-semibold px-4 py-1.5 rounded-full shadow-sm backdrop-blur-sm">
                        {dateStr}
                      </div>
                    </div>
                  )}
                  
                  <div className={`flex w-full ${isInbound ? 'justify-start' : 'justify-end'}`}>
                    {isCall ? (
                      /* 통화 기록 UI */
                      <div className="flex flex-col mb-1 w-full max-w-[85%]">
                        <div className={`flex items-center gap-3 p-3.5 rounded-2xl shadow-sm border ${
                          isMissed 
                            ? 'bg-red-50/80 border-red-100 text-red-900' 
                            : isInbound
                              ? 'bg-white border-gray-200 text-gray-800'
                              : 'bg-white border-gray-200 text-gray-800 flex-row-reverse'
                        }`}>
                          <div className={`flex items-center justify-center w-10 h-10 rounded-full shrink-0 ${
                            isMissed ? 'bg-red-100 text-red-600' :
                            isInbound ? 'bg-emerald-100 text-emerald-600' : 'bg-blue-100 text-blue-600'
                          }`}>
                            {isMissed ? <PhoneMissed className="w-5 h-5" /> : 
                             isInbound ? <PhoneIncoming className="w-5 h-5" /> : <PhoneOutgoing className="w-5 h-5" />}
                          </div>
                          
                          <div className={`flex flex-col flex-1 ${!isInbound && !isMissed ? 'items-end' : 'items-start'}`}>
                            <div className="flex items-center gap-2">
                              <span className="font-bold text-sm">
                                {isMissed ? '부재중 전화' : isInbound ? '수신 통화' : '발신 통화'}
                              </span>
                              {log.lineInfo === '투넘버' ? (
                                <span className="text-[10px] bg-purple-100 text-purple-700 px-1.5 py-0.5 rounded font-medium">투넘버</span>
                              ) : (
                                <span className="text-[10px] bg-gray-100 text-gray-500 px-1.5 py-0.5 rounded font-medium">기본</span>
                              )}
                              {!isMissed && log.duration > 0 && (
                                <span className="text-xs bg-gray-100 px-2 py-0.5 rounded-md text-gray-600 font-medium">
                                  {formatDuration(log.duration)}
                                </span>
                              )}
                            </div>
                            <span className="text-[11px] opacity-60 mt-0.5">
                              {format(date, 'a h:mm', { locale: ko })}
                            </span>
                            {log.content && (
                              <div className="mt-2 text-sm text-gray-700 bg-gray-50 p-2 rounded-lg border border-gray-100 w-full text-left">
                                {log.content}
                              </div>
                            )}
                          </div>
                        </div>
                      </div>
                    ) : (
                      /* 문자 기록 UI */
                      <div className={`flex items-end gap-2 max-w-[80%] ${isInbound ? 'flex-row' : 'flex-row-reverse'}`}>
                        {/* 라인 정보 및 시간 (말풍선 바깥쪽 아래) */}
                        <div className={`flex flex-col mb-1 ${isInbound ? 'items-start' : 'items-end'}`}>
                          {log.lineInfo === '투넘버' ? (
                            <span className="text-[9px] bg-purple-100 text-purple-700 px-1 py-0.5 rounded mb-0.5 whitespace-nowrap font-medium">투넘버</span>
                          ) : (
                            <span className="text-[9px] bg-gray-100 text-gray-500 px-1 py-0.5 rounded mb-0.5 whitespace-nowrap font-medium">기본</span>
                          )}
                          <span className="text-[10px] text-gray-400 whitespace-nowrap">
                            {format(date, 'a h:mm', { locale: ko })}
                          </span>
                        </div>
                        
                        <div className={`px-4 py-3 rounded-2xl shadow-sm text-sm break-words whitespace-pre-wrap ${
                          isInbound 
                            ? 'bg-white border border-gray-200 text-gray-800 rounded-bl-sm' 
                            : 'bg-blue-500 text-white rounded-br-sm'
                        }`}>
                          {log.content === '(사진/첨부파일)' ? (
                            <div className="flex items-center gap-2 italic opacity-80">
                              <MessageSquare className="w-4 h-4" /> 사진/첨부파일
                            </div>
                          ) : (
                            log.content
                          )}
                        </div>
                      </div>
                    )}
                  </div>
                </React.Fragment>
              );
            })}
            </>
          )}
          <div ref={messagesEndRef} />
        </div>
      </div>

      {/* 오른쪽: 문자 발송 및 템플릿 관리 */}
      <div className="flex flex-col h-full bg-white rounded-lg p-4 border border-gray-100">
        <div className="flex justify-between items-center mb-4">
          <h3 className="font-bold text-gray-800 flex items-center gap-2">
            <Send className="w-5 h-5 text-blue-500 shrink-0" />
            <span>
              문자 템플릿 <span className="block sm:inline">및 발송</span>
            </span>
          </h3>
          <span className="text-xs text-gray-500 bg-gray-100 px-2 py-1 rounded">
            스마트폰 연동 발송
          </span>
        </div>

        {templatesLoading ? (
          <div className="text-center text-gray-500 py-10">템플릿을 불러오는 중...</div>
        ) : (
          <div className="space-y-4">
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2">
              <button
                onClick={() => {
                  setActiveTemplateId('custom');
                  setEditingTemplate(null);
                }}
                className={`p-2 text-sm rounded border text-center transition-colors flex items-center justify-center gap-1 ${
                  activeTemplateId === 'custom' 
                    ? 'border-blue-500 bg-blue-50 text-blue-700 font-bold' 
                    : 'border-gray-200 hover:bg-gray-50 text-gray-700'
                }`}
              >
                <MessageSquare className="w-4 h-4" /> 직접 입력
              </button>
              {templates.map(template => (
                <button
                  key={template.id}
                  onClick={() => setActiveTemplateId(template.id)}
                  className={`p-2 text-sm rounded border text-left truncate transition-colors ${
                    activeTemplateId === template.id 
                      ? 'border-blue-500 bg-blue-50 text-blue-700 font-bold' 
                      : 'border-gray-200 hover:bg-gray-50 text-gray-700'
                  }`}
                >
                  {template.title}
                </button>
              ))}
              {templates.length < 5 && (
                <button
                  onClick={() => {
                    setEditingTemplate({ title: '', content: '' });
                    setActiveTemplateId(null);
                  }}
                  className="p-2 text-sm rounded border border-dashed border-gray-300 text-gray-500 hover:bg-gray-50 flex items-center justify-center gap-1"
                >
                  <Plus className="w-4 h-4" /> 템플릿 추가
                </button>
              )}
            </div>

            {editingTemplate !== null && (
              <div className="border rounded-lg p-3 bg-gray-50">
                <input
                  type="text"
                  placeholder="템플릿 제목 (예: 방문 안내)"
                  className="w-full p-2 text-sm border rounded mb-2 focus:ring-2 focus:ring-blue-500 outline-none"
                  value={editingTemplate.title}
                  onChange={e => setEditingTemplate({...editingTemplate, title: e.target.value})}
                />
                <textarea
                  placeholder="문자 내용"
                  className="w-full p-2 text-sm border rounded resize-none h-32 focus:ring-2 focus:ring-blue-500 outline-none"
                  value={editingTemplate.content}
                  onChange={e => setEditingTemplate({...editingTemplate, content: e.target.value})}
                />
                <div className="flex justify-end gap-2 mt-2">
                  <button
                    onClick={() => setEditingTemplate(null)}
                    className="px-3 py-1.5 text-sm bg-gray-200 rounded hover:bg-gray-300"
                  >
                    취소
                  </button>
                  <button
                    onClick={handleSaveTemplate}
                    disabled={saveTemplateMutation.isPending}
                    className="px-3 py-1.5 text-sm bg-blue-600 text-white rounded hover:bg-blue-700 flex items-center gap-1"
                  >
                    <Save className="w-4 h-4" /> 저장
                  </button>
                </div>
              </div>
            )}

            {activeTemplateId === 'custom' && !editingTemplate && (
              <div className="border border-blue-100 rounded-lg p-4 bg-blue-50 flex flex-col h-full min-h-[300px]">
                <div className="flex justify-between items-center mb-2">
                  <span className="font-bold text-blue-900">
                    직접 입력하여 발송
                  </span>
                </div>
                <textarea
                  className="flex-1 bg-white p-3 rounded border border-blue-100 whitespace-pre-wrap text-sm text-gray-700 overflow-y-auto resize-none focus:ring-2 focus:ring-blue-500 outline-none"
                  placeholder="발송할 문자 내용을 입력하세요."
                  value={customMessage}
                  onChange={(e) => setCustomMessage(e.target.value)}
                />
                <button
                  onClick={() => {
                    handleSendSms(customMessage);
                    setCustomMessage('');
                  }}
                  disabled={enqueueSmsMutation.isPending || !customMessage.trim()}
                  className="mt-4 w-full py-3 bg-blue-600 text-white rounded-lg font-bold hover:bg-blue-700 transition-colors flex items-center justify-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  <Send className="w-4 h-4" />
                  스마트폰으로 발송 요청
                </button>
              </div>
            )}

            {activeTemplateId && activeTemplateId !== 'custom' && !editingTemplate && (
              <div className="border border-blue-100 rounded-lg p-4 bg-blue-50 flex flex-col h-full min-h-[300px]">
                <div className="flex justify-between items-center mb-2">
                  <span className="font-bold text-blue-900">
                    {templates.find(t => t.id === activeTemplateId)?.title}
                  </span>
                  <button
                    onClick={() => setEditingTemplate(templates.find(t => t.id === activeTemplateId)!)}
                    className="text-xs text-blue-600 underline"
                  >
                    수정
                  </button>
                </div>
                <div className="flex-1 bg-white p-3 rounded border border-blue-100 whitespace-pre-wrap text-sm text-gray-700 h-48 overflow-y-auto">
                  {templates.find(t => t.id === activeTemplateId)?.content}
                </div>
                <button
                  onClick={() => handleSendSms(templates.find(t => t.id === activeTemplateId)?.content || '')}
                  disabled={enqueueSmsMutation.isPending}
                  className="mt-4 w-full py-3 bg-blue-600 text-white rounded-lg font-bold hover:bg-blue-700 transition-colors flex items-center justify-center gap-2"
                >
                  <Send className="w-4 h-4" />
                  스마트폰으로 발송 요청
                </button>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
