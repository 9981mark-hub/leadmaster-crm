import React, { useState, useRef, useMemo } from 'react';
import { GoogleGenerativeAI } from '@google/generative-ai';
import { X, Camera, Image as ImageIcon, CheckSquare, Square, Loader2, Clock, Sparkles, Phone, AlertCircle } from 'lucide-react';
import { useToast } from '../../contexts/ToastContext';
import { createBatch } from '../../services/autoDialService';

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

  const apiKey = import.meta.env.VITE_GEMINI_API_KEY;
  const isApiKeyMissing = !apiKey;

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
    if (isApiKeyMissing) {
      showToast('Gemini API 키가 설정되지 않았습니다.', 'error');
      return;
    }

    setIsLoading(true);
    try {
      const genAI = new GoogleGenerativeAI(apiKey);
      const model = genAI.getGenerativeModel({ model: 'gemini-2.0-flash' });
      
      const base64 = await fileToBase64(selectedFile);
      const promptText = "이 이미지에서 사람 이름과 전화번호를 모두 추출해주세요. JSON 배열로 반환해주세요. 형식: [{\"name\": \"이름\", \"phone\": \"전화번호\"}]. 전화번호가 없는 항목은 제외하세요. 마크다운 기호 없이 순수 JSON 배열만 출력해주세요.";
      
      const result = await model.generateContent([
        { inlineData: { data: base64, mimeType: selectedFile.type } },
        promptText
      ]);
      
      const text = result.response.text();
      const cleanText = text.replace(/```json/g, '').replace(/```/g, '').trim();
      
      try {
        const parsed = JSON.parse(cleanText);
        if (Array.isArray(parsed)) {
          const formattedContacts = parsed
            .filter((item: any) => item.name && item.phone)
            .map((item: any) => {
              const cleanPhone = item.phone.replace(/[^\d]/g, '');
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
    <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
      <div className="bg-white dark:bg-gray-800 rounded-xl shadow-xl w-full max-w-2xl flex flex-col max-h-[90vh]">
        {/* Header */}
        <div className="flex items-center justify-between p-6 border-b border-gray-100 dark:border-gray-700">
          <div className="flex items-center space-x-2">
            <div className="p-2 bg-blue-100 dark:bg-blue-900/30 rounded-lg">
              <Camera className="w-5 h-5 text-blue-600 dark:text-blue-400" />
            </div>
            <h2 className="text-xl font-bold text-gray-900 dark:text-white">이미지로 연락처 추가</h2>
          </div>
          <button
            onClick={onClose}
            className="p-2 text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 rounded-full hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto p-6 space-y-6">
          {isApiKeyMissing && (
            <div className="p-4 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg flex items-start space-x-3">
              <AlertCircle className="w-5 h-5 text-red-600 dark:text-red-400 mt-0.5" />
              <div>
                <h4 className="text-sm font-medium text-red-800 dark:text-red-300">Gemini API 키 누락</h4>
                <p className="text-sm text-red-600 dark:text-red-400 mt-1">
                  환경 변수 <code className="bg-red-100 dark:bg-red-900/40 px-1 rounded">VITE_GEMINI_API_KEY</code>가 설정되지 않아 이미지 인식 기능을 사용할 수 없습니다.
                </p>
              </div>
            </div>
          )}

          <div className="space-y-4">
            <div className="flex items-center justify-center w-full">
              <label className="flex flex-col items-center justify-center w-full h-64 border-2 border-dashed rounded-lg cursor-pointer bg-gray-50 dark:hover:bg-gray-800 dark:bg-gray-900 border-gray-300 dark:border-gray-700 hover:bg-gray-100 transition-colors">
                {previewUrl ? (
                  <img src={previewUrl} alt="Preview" className="h-full object-contain p-2" />
                ) : (
                  <div className="flex flex-col items-center justify-center pt-5 pb-6">
                    <ImageIcon className="w-10 h-10 mb-3 text-gray-400" />
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
                disabled={isLoading || isApiKeyMissing}
                className="w-full py-3 bg-indigo-600 hover:bg-indigo-700 disabled:bg-indigo-400 text-white rounded-lg font-medium transition-colors flex items-center justify-center space-x-2"
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
            <div className="space-y-6">
              <div className="border border-gray-200 dark:border-gray-700 rounded-lg overflow-hidden">
                <div className="bg-gray-50 dark:bg-gray-800/50 p-3 border-b border-gray-200 dark:border-gray-700 flex justify-between items-center">
                  <button
                    type="button"
                    onClick={toggleSelectAll}
                    className="flex items-center space-x-2 text-sm text-gray-700 dark:text-gray-300 hover:text-blue-600 dark:hover:text-blue-400"
                  >
                    {contacts.every(c => c.selected) ? (
                      <CheckSquare className="w-4 h-4" />
                    ) : (
                      <Square className="w-4 h-4" />
                    )}
                    <span>전체 선택</span>
                  </button>
                  <span className="text-sm font-medium text-blue-600 dark:text-blue-400">
                    {selectedCount}명 선택됨
                  </span>
                </div>
                <div className="max-h-60 overflow-y-auto">
                  <table className="min-w-full divide-y divide-gray-200 dark:divide-gray-700">
                    <tbody className="divide-y divide-gray-200 dark:divide-gray-700 bg-white dark:bg-gray-800">
                      {contacts.map((contact) => (
                        <tr key={contact.id} className="hover:bg-gray-50 dark:hover:bg-gray-700/50 cursor-pointer" onClick={() => toggleSelect(contact.id)}>
                          <td className="px-4 py-3 whitespace-nowrap w-12">
                            {contact.selected ? (
                              <CheckSquare className="w-4 h-4 text-blue-600 dark:text-blue-500" />
                            ) : (
                              <Square className="w-4 h-4 text-gray-400" />
                            )}
                          </td>
                          <td className="px-4 py-3 whitespace-nowrap">
                            <div className="text-sm font-medium text-gray-900 dark:text-white">{contact.name}</div>
                          </td>
                          <td className="px-4 py-3 whitespace-nowrap text-right">
                            <div className="text-sm text-gray-500 dark:text-gray-400 flex items-center justify-end space-x-1">
                              <Phone className="w-3 h-3" />
                              <span>{contact.phone}</span>
                            </div>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>

              <div className="space-y-4 pt-4 border-t border-gray-100 dark:border-gray-700">
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                    배치 이름 <span className="text-red-500">*</span>
                  </label>
                  <input
                    type="text"
                    required
                    value={batchName}
                    onChange={(e) => setBatchName(e.target.value)}
                    className="w-full px-3 py-2 bg-white dark:bg-gray-900 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 text-gray-900 dark:text-white"
                    placeholder="예: 2024년 5월 박람회 명함"
                  />
                </div>
                
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1 flex items-center">
                      <Clock className="w-4 h-4 mr-1 text-gray-400" />
                      연결 대기 시간 (초)
                    </label>
                    <input
                      type="number"
                      min="10"
                      max="60"
                      value={timeoutSec}
                      onChange={(e) => setTimeoutSec(parseInt(e.target.value) || 30)}
                      className="w-full px-3 py-2 bg-white dark:bg-gray-900 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 text-gray-900 dark:text-white"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1 flex items-center">
                      <Clock className="w-4 h-4 mr-1 text-gray-400" />
                      다음 발신 대기 (초)
                    </label>
                    <input
                      type="number"
                      min="0"
                      max="30"
                      value={gapSec}
                      onChange={(e) => setGapSec(parseInt(e.target.value) || 3)}
                      className="w-full px-3 py-2 bg-white dark:bg-gray-900 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 text-gray-900 dark:text-white"
                    />
                  </div>
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Footer */}
        {contacts.length > 0 && (
          <div className="p-6 border-t border-gray-100 dark:border-gray-700 bg-gray-50 dark:bg-gray-800/50 rounded-b-xl flex justify-end space-x-3">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 text-sm font-medium text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg transition-colors"
            >
              취소
            </button>
            <button
              type="button"
              onClick={handleSubmit}
              disabled={isSubmitting || selectedCount === 0 || !batchName.trim()}
              className="px-6 py-2 bg-blue-600 hover:bg-blue-700 disabled:bg-blue-400 text-white text-sm font-medium rounded-lg transition-colors flex items-center space-x-2"
            >
              {isSubmitting ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" />
                  <span>생성 중...</span>
                </>
              ) : (
                <span>배치 생성하기</span>
              )}
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
