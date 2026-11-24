import React, { useState, useRef, useMemo } from 'react';
import { X, Camera, Image as ImageIcon, CheckSquare, Square, Loader2, Clock, Sparkles, Phone } from 'lucide-react';
import { useToast } from '../../contexts/ToastContext';
import { createBatch } from '../../services/autoDialService';
import { callAi, checkAiFileSize } from '../../services/aiProxy';

// AI 응답 형식: [{ name, phone }]
const CONTACTS_SCHEMA = {
  type: 'ARRAY',
  items: {
    type: 'OBJECT',
    properties: { name: { type: 'STRING' }, phone: { type: 'STRING' } },
    required: ['name', 'phone'],
  },
};

interface OcrBatchModalProps {
  isOpen: boolean;
  onClose: () => void;
  onCreated: () => void;
}

interface ExtractedContact {
  id: string;
  name: string;
  phone: string;
  selected: boolean;
}

const fileToBase64 = async (file: File): Promise<string> => {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve((reader.result as string).split(',')[1]);
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
};

export default function OcrBatchModal({ isOpen, onClose, onCreated }: OcrBatchModalProps) {
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [contacts, setContacts] = useState<ExtractedContact[]>([]);
  
  const [batchName, setBatchName] = useState('');
  const [timeoutSec, setTimeoutSec] = useState(30);
  const [gapSec, setGapSec] = useState(3);
  
  const fileInputRef = useRef<HTMLInputElement>(null);
  const { showToast } = useToast();

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files.length > 0) {
      const file = e.target.files[0];
      setSelectedFile(file);
      setPreviewUrl(URL.createObjectURL(file));
      setContacts([]);
    }
  };

  const handleExtract = async () => {
    if (!selectedFile) return;
    const sizeError = checkAiFileSize('image_extract', selectedFile.size);
    if (sizeError) {
      showToast(sizeError, 'error');
      return;
    }

    setIsLoading(true);
    try {
      const base64 = await fileToBase64(selectedFile);
      const promptText = "이 이미지에서 사람 이름과 전화번호를 모두 추출해주세요. JSON 배열로 반환해주세요. 형식: [{\"name\": \"이름\", \"phone\": \"전화번호\"}]. 전화번호가 없는 항목은 제외하세요. 마크다운 기호 없이 순수 JSON 배열만 출력해주세요.";

      // 서버(ai-proxy)가 Gemini를 부른다 (브라우저에는 AI 키가 없다)
      const { text } = await callAi({
        task: 'image_extract',
        prompt: promptText,
        files: [{ mimeType: selectedFile.type || 'image/jpeg', data: base64 }],
        responseMimeType: 'application/json',
        responseSchema: CONTACTS_SCHEMA,
      });
      const cleanText = text.replace(/```json/g, '').replace(/```/g, '').trim();
      
      try {
        const parsed = JSON.parse(cleanText);
        if (Array.isArray(parsed)) {
          const formattedContacts = parsed
            .filter((item: any) => item.name && item.phone)
            .map((item: any) => {
              const cleanPhone = String(item.phone).replace(/[^\d]/g, '');
              return {
                id: crypto.randomUUID(),
                name: item.name,
                phone: cleanPhone,
                selected: true
              };
            });
            
          setContacts(formattedContacts);
          
          if (formattedContacts.length === 0) {
            showToast('연락처를 찾을 수 없습니다.', 'warning');
          } else {
            showToast(`${formattedContacts.length}개의 연락처를 추출했습니다.`, 'success');
          }
        } else {
          throw new Error('응답이 배열 형식이 아닙니다.');
        }
      } catch (e) {
        console.error('JSON 파싱 에러:', e, text);
        showToast('데이터 형식을 해석할 수 없습니다.', 'error');
      }
    } catch (error: any) {
      console.error('OCR 에러:', error);
      showToast(error.message || '이미지 분석 중 오류가 발생했습니다.', 'error');
    } finally {
      setIsLoading(false);
    }
  };

  const toggleSelectAll = () => {
    const allSelected = contacts.every(c => c.selected);
    setContacts(contacts.map(c => ({ ...c, selected: !allSelected })));
  };

  const toggleSelect = (id: string) => {
    setContacts(contacts.map(c => c.id === id ? { ...c, selected: !c.selected } : c));
  };

  const selectedCount = contacts.filter(c => c.selected).length;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (selectedCount === 0) {
      showToast('선택된 연락처가 없습니다.', 'warning');
      return;
    }
    if (!batchName.trim()) {
      showToast('배치 이름을 입력해주세요.', 'warning');
      return;
    }

    setIsSubmitting(true);
    try {
      const itemsToDial = contacts
        .filter(c => c.selected)
        .map(c => ({
          name: c.name,
          phone: c.phone,
          caseId: crypto.randomUUID()
        }));

      await createBatch({
        name: batchName,
        source: 'image_ocr',
        ringTimeoutSeconds: timeoutSec,
        gapSeconds: gapSec,
        items: itemsToDial.map(i => ({
          caseId: i.caseId,
          customerName: i.name,
          phone: i.phone,
        }))
      });
      
      showToast('오토콜 배치가 생성되었습니다.', 'success');
      onCreated();
      onClose();
    } catch (error: any) {
      console.error('배치 생성 에러:', error);
      showToast(error.message || '배치 생성에 실패했습니다.', 'error');
    } finally {
      setIsSubmitting(false);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-5 bg-background/80 backdrop-blur-xs animate-in fade-in duration-200 overflow-y-auto">
      <div className="relative w-full max-w-2xl max-h-[88vh] my-auto flex flex-col rounded-2xl bg-card border border-border shadow-2xl overflow-hidden text-card-foreground">
        {/* Header */}
        <div className="flex items-center justify-between p-4 sm:p-5 border-b border-border bg-card shrink-0">
          <div className="flex items-center space-x-2.5">
            <div className="p-2 bg-primary/10 text-primary border border-primary/20 rounded-xl shrink-0">
              <Camera className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-base font-bold text-foreground">이미지 OCR 연락처 일괄 추출</h2>
              <p className="text-xs text-muted-foreground">명함, 서류, 캡처 이미지에서 이름과 번호를 자동 추출합니다.</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 text-muted-foreground hover:text-foreground hover:bg-muted rounded-lg transition-colors cursor-pointer"
            title="창 닫기"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto p-5 sm:p-6 space-y-5 custom-scrollbar text-xs">
          <div className="space-y-4">
            <div className="flex items-center justify-center w-full">
              <label className="flex flex-col items-center justify-center w-full h-64 border-2 border-dashed rounded-lg cursor-pointer bg-gray-50 dark:hover:bg-gray-800 dark:bg-gray-900 border-gray-300 dark:border-gray-700 hover:bg-gray-100 transition-colors">
                {previewUrl ? (
                  <img src={previewUrl} alt="Preview" className="h-full object-contain p-2" />
                ) : (
                  <div className="flex flex-col items-center justify-center pt-5 pb-6">
                    <ImageIcon className="w-10 h-10 mb-3 text-gray-500 dark:text-gray-400" />
                    <p className="mb-2 text-sm text-gray-500 dark:text-gray-400">
                      <span className="font-semibold">클릭하여 업로드</span> 하거나 드래그앤드롭
                    </p>
                    <p className="text-xs text-gray-500 dark:text-gray-400">PNG, JPG or WEBP</p>
                  </div>
                )}
                <input
                  ref={fileInputRef}
                  type="file"
                  className="hidden"
                  accept="image/png, image/jpeg, image/webp"
                  onChange={handleFileChange}
                />
              </label>
            </div>
            
            {previewUrl && contacts.length === 0 && (
              <button
                type="button"
                onClick={handleExtract}
                disabled={isLoading}
                className="w-full py-3 bg-primary hover:bg-primary/90 disabled:opacity-50 text-primary-foreground rounded-xl font-bold transition-colors flex items-center justify-center space-x-2 cursor-pointer shadow-2xs"
              >
                {isLoading ? (
                  <>
                    <Loader2 className="w-5 h-5 animate-spin" />
                    <Sparkles className="w-4 h-4 animate-pulse" />
                    <span>AI 인식 중...</span>
                  </>
                ) : (
                  <>
                    <Sparkles className="w-5 h-5" />
                    <span>이미지에서 연락처 추출</span>
                  </>
                )}
              </button>
            )}
          </div>

          {contacts.length > 0 && (
            <div className="space-y-5">
              <div className="border border-border rounded-xl overflow-hidden bg-card">
                <div className="bg-muted/40 p-3 border-b border-border flex justify-between items-center text-xs">
                  <button
                    type="button"
                    onClick={toggleSelectAll}
                    className="flex items-center space-x-2 text-foreground font-semibold hover:text-primary cursor-pointer"
                  >
                    {contacts.every(c => c.selected) ? (
                      <CheckSquare className="w-4 h-4 text-primary" />
                    ) : (
                      <Square className="w-4 h-4 text-muted-foreground" />
                    )}
                    <span>전체 선택</span>
                  </button>
                  <span className="font-bold text-primary">
                    {selectedCount}명 선택됨
                  </span>
                </div>
                <div className="max-h-60 overflow-y-auto custom-scrollbar">
                  <table className="min-w-full divide-y divide-border/60">
                    <tbody className="divide-y divide-border/60">
                      {contacts.map((contact) => (
                        <tr key={contact.id} className="hover:bg-muted/30 cursor-pointer transition-colors" onClick={() => toggleSelect(contact.id)}>
                          <td className="px-4 py-2.5 whitespace-nowrap w-12">
                            {contact.selected ? (
                              <CheckSquare className="w-4 h-4 text-primary" />
                            ) : (
                              <Square className="w-4 h-4 text-muted-foreground" />
                            )}
                          </td>
                          <td className="px-4 py-2.5 whitespace-nowrap">
                            <div className="font-semibold text-foreground text-xs">{contact.name}</div>
                          </td>
                          <td className="px-4 py-2.5 whitespace-nowrap text-right font-mono">
                            <div className="text-muted-foreground flex items-center justify-end space-x-1 text-xs">
                              <Phone className="w-3.5 h-3.5" />
                              <span>{contact.phone}</span>
                            </div>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>

              <div className="space-y-4 pt-2 border-t border-border">
                <div>
                  <label className="block text-xs font-semibold text-foreground mb-1">
                    배치 이름 <span className="text-primary">*</span>
                  </label>
                  <input
                    type="text"
                    required
                    value={batchName}
                    onChange={(e) => setBatchName(e.target.value)}
                    className="w-full px-3 py-2 bg-background border border-input rounded-xl focus:ring-1 focus:ring-primary text-foreground text-xs"
                    placeholder="예: 2026년 11월 박람회 명함 리스트"
                  />
                </div>
                
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-xs font-semibold text-foreground mb-1 flex items-center">
                      <Clock className="w-3.5 h-3.5 mr-1 text-muted-foreground" />
                      연결 대기 시간 (초)
                    </label>
                    <input
                      type="number"
                      min="10"
                      max="60"
                      value={timeoutSec}
                      onChange={(e) => setTimeoutSec(parseInt(e.target.value) || 30)}
                      className="w-full px-3 py-2 bg-background border border-input rounded-xl focus:ring-1 focus:ring-primary text-foreground font-mono text-xs"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-semibold text-foreground mb-1 flex items-center">
                      <Clock className="w-3.5 h-3.5 mr-1 text-muted-foreground" />
                      다음 발신 대기 (초)
                    </label>
                    <input
                      type="number"
                      min="0"
                      max="30"
                      value={gapSec}
                      onChange={(e) => setGapSec(parseInt(e.target.value) || 3)}
                      className="w-full px-3 py-2 bg-background border border-input rounded-xl focus:ring-1 focus:ring-primary text-foreground font-mono text-xs"
                    />
                  </div>
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="p-4 border-t border-border bg-card flex justify-end gap-2 shrink-0">
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2.5 text-xs font-bold text-foreground bg-secondary hover:bg-muted border border-border rounded-xl transition-colors cursor-pointer shadow-2xs"
          >
            취소 / 닫기
          </button>
          {contacts.length > 0 && (
            <button
              type="button"
              onClick={handleSubmit}
              disabled={isSubmitting || selectedCount === 0 || !batchName.trim()}
              className="px-5 py-2.5 bg-primary hover:bg-primary/90 disabled:opacity-50 text-primary-foreground text-xs font-bold rounded-xl transition-colors flex items-center space-x-2 cursor-pointer shadow-2xs"
            >
              {isSubmitting ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" />
                  <span>생성 중...</span>
                </>
              ) : (
                <span>배치 생성하기 ({selectedCount}건)</span>
              )}
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
