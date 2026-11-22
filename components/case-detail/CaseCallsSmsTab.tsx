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
    <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 h-full text-foreground">
      {/* 왼쪽: 통화 및 문자 타임라인 */}
      <div className="flex flex-col bg-card rounded-xl p-5 border border-border shadow-2xs" style={{ maxHeight: '600px' }}>
        <h3 className="font-semibold text-foreground mb-4 flex items-center gap-2 shrink-0">
          <MessageSquare className="w-5 h-5 text-primary" />
          통화 및 문자 기록
        </h3>
        
        <div className="flex-1 overflow-y-auto pr-3 space-y-5 custom-scrollbar" style={{ minHeight: 0 }}>
          {logsLoading ? (
            <div className="flex flex-col items-center justify-center h-40 text-muted-foreground">
              <div className="w-6 h-6 border-2 border-primary border-t-transparent rounded-full animate-spin mb-3"></div>
              기록을 불러오는 중...
            </div>
          ) : logs.length === 0 ? (
            <div className="flex flex-col items-center justify-center h-40 text-muted-foreground bg-muted/20 rounded-xl border border-dashed border-border">
              <MessageSquare className="w-8 h-8 text-muted-foreground/60 mb-2" />
              해당 고객과의 통화 및 문자 기록이 없습니다.
              <span className="text-xs mt-1 text-muted-foreground/80">(스마트폰 앱에서 자동으로 동기화됩니다)</span>
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
                    <div className="flex justify-center my-4">
                      <div className="bg-muted text-muted-foreground border border-border text-xs font-mono px-3.5 py-1 rounded-full shadow-2xs">
                        {dateStr}
                      </div>
                    </div>
                  )}
                  
                  <div className={`flex w-full ${isInbound ? 'justify-start' : 'justify-end'}`}>
                    {isCall ? (
                      /* 통화 기록 UI */
                      <div className="flex flex-col mb-1 w-full max-w-[85%]">
                        <div className={`flex items-center gap-3 p-3.5 rounded-xl shadow-2xs border ${
                          isMissed 
                            ? 'bg-destructive/10 border-destructive/20 text-destructive' 
                            : 'bg-muted/40 border-border text-foreground'
                        }`}>
                          <div className={`flex items-center justify-center w-10 h-10 rounded-full shrink-0 ${
                            isMissed ? 'bg-destructive/20 text-destructive' :
                            isInbound ? 'bg-primary/15 text-primary' : 'bg-muted text-foreground border border-border'
                          }`}>
                            {isMissed ? <PhoneMissed className="w-5 h-5" /> : 
                             isInbound ? <PhoneIncoming className="w-5 h-5" /> : <PhoneOutgoing className="w-5 h-5" />}
                          </div>
                          
                          <div className={`flex flex-col flex-1 ${!isInbound && !isMissed ? 'items-end' : 'items-start'}`}>
                            <div className="flex items-center gap-2">
                              <span className="font-semibold text-sm">
                                {isMissed ? '부재중 전화' : isInbound ? '수신 통화' : '발신 통화'}
                              </span>
                              {log.lineInfo === '투넘버' ? (
                                <span className="text-[11px] bg-primary/10 text-primary border border-primary/20 px-1.5 py-0.5 rounded font-mono">투넘버</span>
                              ) : (
                                <span className="text-[11px] bg-muted text-muted-foreground border border-border px-1.5 py-0.5 rounded font-mono">기본</span>
                              )}
                              {!isMissed && log.duration > 0 && (
                                <span className="text-[11px] bg-muted px-2 py-0.5 rounded-md text-foreground font-mono">
                                  {formatDuration(log.duration)}
                                </span>
                              )}
                            </div>
                            <span className="text-[11px] text-muted-foreground font-mono mt-0.5">
                              {format(date, 'a h:mm', { locale: ko })}
                            </span>
                            {log.content && (
                              <div className="mt-2 text-sm text-foreground bg-card p-2.5 rounded-lg border border-border w-full text-left leading-relaxed">
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
                            <span className="text-[11px] bg-primary/10 text-primary border border-primary/20 px-1 py-0.5 rounded mb-0.5 whitespace-nowrap font-mono">투넘버</span>
                          ) : (
                            <span className="text-[11px] bg-muted text-muted-foreground border border-border px-1 py-0.5 rounded mb-0.5 whitespace-nowrap font-mono">기본</span>
                          )}
                          <span className="text-[11px] text-muted-foreground font-mono whitespace-nowrap">
                            {format(date, 'a h:mm', { locale: ko })}
                          </span>
                        </div>
                        
                        <div className={`px-4 py-3 rounded-2xl shadow-2xs text-sm break-words whitespace-pre-wrap leading-relaxed ${
                          isInbound 
                            ? 'bg-muted/40 border border-border text-foreground rounded-bl-xs' 
                            : 'bg-primary text-primary-foreground rounded-br-xs font-medium'
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
      <div className="flex flex-col h-full bg-card rounded-xl p-5 border border-border shadow-2xs text-foreground">
        <div className="flex justify-between items-center mb-4">
          <h3 className="font-semibold text-foreground flex items-center gap-2">
            <Send className="w-5 h-5 text-primary shrink-0" />
            <span>문자 템플릿 및 발송</span>
          </h3>
          <span className="text-xs text-muted-foreground bg-muted border border-border px-2.5 py-1 rounded-md font-mono">
            스마트폰 연동 발송
          </span>
        </div>

        {templatesLoading ? (
          <div className="text-center text-muted-foreground py-10">템플릿을 불러오는 중...</div>
        ) : (
          <div className="space-y-4">
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2">
              <button
                onClick={() => {
                  setActiveTemplateId('custom');
                  setEditingTemplate(null);
                }}
                className={`p-2.5 text-xs rounded-lg border text-center transition-colors flex items-center justify-center gap-1.5 shadow-2xs ${
                  activeTemplateId === 'custom' 
                    ? 'border-primary bg-primary/10 text-primary font-semibold' 
                    : 'border-border bg-card hover:bg-muted text-foreground'
                }`}
              >
                <MessageSquare className="w-3.5 h-3.5" /> 직접 입력
              </button>
              {templates.map(template => (
                <button
                  key={template.id}
                  onClick={() => setActiveTemplateId(template.id)}
                  className={`p-2.5 text-xs rounded-lg border text-left truncate transition-colors shadow-2xs ${
                    activeTemplateId === template.id 
                      ? 'border-primary bg-primary/10 text-primary font-semibold' 
                      : 'border-border bg-card hover:bg-muted text-foreground'
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
                  className="p-2.5 text-xs rounded-lg border border-dashed border-border text-muted-foreground hover:text-foreground hover:bg-muted flex items-center justify-center gap-1.5 transition-colors"
                >
                  <Plus className="w-3.5 h-3.5" /> 템플릿 추가
                </button>
              )}
            </div>

            {editingTemplate !== null && (
              <div className="border border-border rounded-xl p-3 bg-muted/20">
                <input
                  type="text"
                  placeholder="템플릿 제목 (예: 방문 안내)"
                  className="w-full p-2.5 text-sm border border-border rounded-lg mb-2 bg-card text-foreground placeholder:text-muted-foreground focus:ring-1 focus:ring-primary focus:border-primary outline-none"
                  value={editingTemplate.title}
                  onChange={e => setEditingTemplate({...editingTemplate, title: e.target.value})}
                />
                <textarea
                  placeholder="문자 내용"
                  className="w-full p-2.5 text-sm border border-border rounded-lg resize-none h-32 bg-card text-foreground placeholder:text-muted-foreground focus:ring-1 focus:ring-primary focus:border-primary outline-none"
                  value={editingTemplate.content}
                  onChange={e => setEditingTemplate({...editingTemplate, content: e.target.value})}
                />
                <div className="flex justify-end gap-2 mt-2">
                  <button
                    onClick={() => setEditingTemplate(null)}
                    className="px-3 py-1.5 text-xs bg-muted text-muted-foreground hover:text-foreground rounded-lg transition-colors border border-border"
                  >
                    취소
                  </button>
                  <button
                    onClick={handleSaveTemplate}
                    disabled={saveTemplateMutation.isPending}
                    className="px-3.5 py-1.5 text-xs bg-primary hover:bg-primary/90 text-primary-foreground font-semibold rounded-lg shadow-2xs flex items-center gap-1 transition-colors"
                  >
                    <Save className="w-3.5 h-3.5" /> 저장
                  </button>
                </div>
              </div>
            )}

            {activeTemplateId === 'custom' && !editingTemplate && (
              <div className="border border-border rounded-xl p-4 bg-muted/20 flex flex-col h-full min-h-[300px]">
                <div className="flex justify-between items-center mb-2">
                  <span className="font-semibold text-foreground text-sm">
                    직접 입력하여 발송
                  </span>
                </div>
                <textarea
                  className="flex-1 bg-card p-3 rounded-lg border border-border whitespace-pre-wrap text-sm text-foreground overflow-y-auto resize-none focus:ring-1 focus:ring-primary focus:border-primary outline-none placeholder:text-muted-foreground leading-relaxed"
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
                  className="mt-4 w-full py-2.5 bg-primary hover:bg-primary/90 text-primary-foreground rounded-lg font-semibold transition-colors flex items-center justify-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed shadow-2xs text-sm"
                >
                  <Send className="w-4 h-4" />
                  스마트폰으로 발송 요청
                </button>
              </div>
            )}

            {activeTemplateId && activeTemplateId !== 'custom' && !editingTemplate && (
              <div className="border border-border rounded-xl p-4 bg-muted/20 flex flex-col h-full min-h-[300px]">
                <div className="flex justify-between items-center mb-2">
                  <span className="font-semibold text-foreground text-sm">
                    {templates.find(t => t.id === activeTemplateId)?.title}
                  </span>
                  <button
                    onClick={() => setEditingTemplate(templates.find(t => t.id === activeTemplateId)!)}
                    className="text-xs text-primary hover:underline"
                  >
                    수정
                  </button>
                </div>
                <div className="flex-1 bg-card p-3 rounded-lg border border-border whitespace-pre-wrap text-sm text-foreground h-48 overflow-y-auto leading-relaxed">
                  {templates.find(t => t.id === activeTemplateId)?.content}
                </div>
                <button
                  onClick={() => handleSendSms(templates.find(t => t.id === activeTemplateId)?.content || '')}
                  disabled={enqueueSmsMutation.isPending}
                  className="mt-4 w-full py-2.5 bg-primary hover:bg-primary/90 text-primary-foreground rounded-lg font-semibold transition-colors flex items-center justify-center gap-2 shadow-2xs text-sm"
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
