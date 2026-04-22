import React, { useState } from 'react';
import { Phone, MessageSquare, Plus, Save, Send } from 'lucide-react';
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

  const [activeTemplateId, setActiveTemplateId] = useState<string | null>(null);
  const [editingTemplate, setEditingTemplate] = useState<{ id?: string, title: string, content: string } | null>(null);

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
      <div className="flex flex-col h-full bg-gray-50 rounded-lg p-4 border border-gray-100">
        <h3 className="font-bold text-gray-800 mb-4 flex items-center gap-2">
          <MessageSquare className="w-5 h-5 text-blue-500" />
          통화 및 문자 기록
        </h3>
        
        <div className="flex-1 overflow-y-auto pr-2 space-y-4">
          {logsLoading ? (
            <div className="text-center text-gray-500 py-10">기록을 불러오는 중...</div>
          ) : logs.length === 0 ? (
            <div className="text-center text-gray-500 py-10">
              해당 고객과의 통화 및 문자 기록이 없습니다.
              <br/>
              <span className="text-xs mt-2 block">(스마트폰 앱에서 자동으로 동기화됩니다)</span>
            </div>
          ) : (
            logs.map(log => {
              const isCall = log.type.includes('CALL');
              const isMissed = log.type === 'CALL_MISSED';
              const isInbound = log.type.includes('IN') || isMissed;
              const date = new Date(log.timestamp);
              
              return (
                <div key={log.id} className={`flex ${isInbound ? 'justify-start' : 'justify-end'}`}>
                  <div className={`max-w-[80%] rounded-2xl px-4 py-2 shadow-sm ${
                    isCall 
                      ? isMissed ? 'bg-red-50 text-red-900 border border-red-100' : 'bg-gray-100 text-gray-800'
                      : isInbound ? 'bg-white border border-gray-200' : 'bg-blue-500 text-white'
                  }`}>
                    <div className="flex items-center gap-2 mb-1 opacity-80 text-xs font-medium">
                      {isCall ? <Phone className="w-3 h-3" /> : <MessageSquare className="w-3 h-3" />}
                      <span>
                        {isCall ? (
                          isMissed ? '부재중 통화' : 
                          isInbound ? '수신 통화' : '발신 통화'
                        ) : (
                          isInbound ? '수신 문자' : '발신 문자'
                        )}
                        {isCall && !isMissed && log.duration && ` (${Math.floor(log.duration / 60)}분 ${log.duration % 60}초)`}
                      </span>
                    </div>
                    {log.content && (
                      <div className="text-sm whitespace-pre-wrap break-words mb-1">
                        {log.content}
                      </div>
                    )}
                    <div className={`text-[10px] text-right ${isInbound && !isCall ? 'text-gray-400' : 'opacity-70'}`}>
                      {format(date, 'yyyy년 M월 d일 a h:mm', { locale: ko })}
                    </div>
                  </div>
                </div>
              );
            })
          )}
        </div>
      </div>

      {/* 오른쪽: 문자 발송 및 템플릿 관리 */}
      <div className="flex flex-col h-full bg-white rounded-lg p-4 border border-gray-100">
        <div className="flex justify-between items-center mb-4">
          <h3 className="font-bold text-gray-800 flex items-center gap-2">
            <Send className="w-5 h-5 text-blue-500" />
            문자 템플릿 및 발송
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

            {activeTemplateId && !editingTemplate && (
              <div className="border border-blue-100 rounded-lg p-4 bg-blue-50 flex flex-col h-full">
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
