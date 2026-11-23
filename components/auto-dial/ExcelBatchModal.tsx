import React, { useState, useRef, useMemo } from 'react';
import * as XLSX from 'xlsx';
import { X, Upload, FileSpreadsheet, CheckSquare, Square, Loader2, Clock, AlertCircle, Phone } from 'lucide-react';
import { useToast } from '../../contexts/ToastContext';
import { createBatch } from '../../services/autoDialService';

interface ExcelBatchModalProps {
  isOpen: boolean;
  onClose: () => void;
  onCreated: () => void;
}

interface ParsedRow {
  id: string;
  originalName: string;
  originalPhone: string;
  formattedPhone: string;
  isValid: boolean;
  selected: boolean;
}

const NAME_KEYWORDS = ['이름', 'name', '고객', '성명'];
const PHONE_KEYWORDS = ['전화', 'phone', '연락', '번호', '핸드폰', '휴대'];

const formatPhoneNumber = (phone: string | number | undefined | null) => {
  if (!phone) return '';
  const str = String(phone);
  const digits = str.replace(/\D/g, '');
  
  if (digits.length === 11) {
    return `${digits.slice(0, 3)}-${digits.slice(3, 7)}-${digits.slice(7)}`;
  } else if (digits.length === 10) {
    if (digits.startsWith('02')) {
      return `${digits.slice(0, 2)}-${digits.slice(2, 6)}-${digits.slice(6)}`;
    }
    return `${digits.slice(0, 3)}-${digits.slice(3, 6)}-${digits.slice(6)}`;
  } else if (digits.length === 9 && digits.startsWith('02')) {
    return `${digits.slice(0, 2)}-${digits.slice(2, 5)}-${digits.slice(5)}`;
  } else if (digits.length === 8) {
    return `${digits.slice(0, 4)}-${digits.slice(4)}`;
  }
  
  return digits;
};

const isValidPhone = (formattedPhone: string) => {
  const digits = formattedPhone.replace(/\D/g, '');
  return digits.length >= 8 && digits.length <= 11;
};

export default function ExcelBatchModal({ isOpen, onClose, onCreated }: ExcelBatchModalProps) {
  const [isUploading, setIsUploading] = useState(false);
  const [fileName, setFileName] = useState<string | null>(null);
  const [parsedData, setParsedData] = useState<ParsedRow[]>([]);
  const [batchName, setBatchName] = useState('');
  const [ringTimeout, setRingTimeout] = useState(30);
  const [gapSeconds, setGapSeconds] = useState(5);
  const [isSubmitting, setIsSubmitting] = useState(false);
  
  const fileInputRef = useRef<HTMLInputElement>(null);
  const { showToast } = useToast();

  const handleClose = () => {
    setFileName(null);
    setParsedData([]);
    setBatchName('');
    setRingTimeout(30);
    setGapSeconds(5);
    onClose();
  };

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setIsUploading(true);
    setFileName(file.name);
    setBatchName(file.name.replace(/\.[^/.]+$/, ""));

    const reader = new FileReader();
    reader.onload = (evt) => {
      try {
        const bstr = evt.target?.result;
        const wb = XLSX.read(bstr, { type: 'binary' });
        const wsname = wb.SheetNames[0];
        const ws = wb.Sheets[wsname];
        
        // Get raw data array of arrays
        const rawData: any[][] = XLSX.utils.sheet_to_json(ws, { header: 1 });
        
        if (rawData.length === 0) {
          showToast('error', '파일이 비어있습니다.');
          setIsUploading(false);
          return;
        }

        // Find headers
        const headers = rawData[0].map((h: any) => String(h || '').toLowerCase().trim());
        
        let nameColIdx = -1;
        let phoneColIdx = -1;

        headers.forEach((header, idx) => {
          if (nameColIdx === -1 && NAME_KEYWORDS.some(kw => header.includes(kw))) {
            nameColIdx = idx;
          }
          if (phoneColIdx === -1 && PHONE_KEYWORDS.some(kw => header.includes(kw))) {
            phoneColIdx = idx;
          }
        });

        // Fallback: if keywords not found in headers, check first row data types
        if (nameColIdx === -1 || phoneColIdx === -1) {
          const firstRow = rawData.length > 1 ? rawData[1] : rawData[0];
          firstRow.forEach((val, idx) => {
            const strVal = String(val || '');
            if (phoneColIdx === -1 && /^[0-9-]{9,13}$/.test(strVal)) {
              phoneColIdx = idx;
            } else if (nameColIdx === -1 && typeof val === 'string' && val.length > 0 && val.length < 20) {
              nameColIdx = idx;
            }
          });
        }
        
        if (phoneColIdx === -1) {
          showToast('error', '전화번호 열을 찾을 수 없습니다.');
          setIsUploading(false);
          return;
        }

        const rows: ParsedRow[] = [];
        // Start from index 1 if row 0 was headers
        const startIdx = (headers.some(h => PHONE_KEYWORDS.some(kw => h.includes(kw)))) ? 1 : 0;

        for (let i = startIdx; i < rawData.length; i++) {
          const row = rawData[i];
          if (!row || row.length === 0) continue;
          
          const rawName = nameColIdx !== -1 ? String(row[nameColIdx] || '') : `고객 ${i}`;
          const rawPhone = String(row[phoneColIdx] || '');
          
          if (!rawPhone.trim()) continue;
          
          const formattedPhone = formatPhoneNumber(rawPhone);
          const valid = isValidPhone(formattedPhone);
          
          rows.push({
            id: crypto.randomUUID(),
            originalName: rawName.trim(),
            originalPhone: rawPhone.trim(),
            formattedPhone,
            isValid: valid,
            selected: valid
          });
        }

        setParsedData(rows);
        showToast('success', `${rows.length}개의 연락처를 불러왔습니다.`);
      } catch (error) {
        console.error('Error parsing excel:', error);
        showToast('error', '엑셀 파일을 파싱하는 중 오류가 발생했습니다.');
      } finally {
        setIsUploading(false);
      }
    };
    reader.onerror = () => {
      showToast('error', '파일을 읽는 중 오류가 발생했습니다.');
      setIsUploading(false);
    };
    
    reader.readAsBinaryString(file);
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  };

  const toggleRow = (id: string) => {
    setParsedData(prev => prev.map(row => 
      row.id === id ? { ...row, selected: !row.selected } : row
    ));
  };

  const toggleAll = () => {
    const allSelected = parsedData.filter(r => r.isValid).every(r => r.selected);
    setParsedData(prev => prev.map(row => 
      row.isValid ? { ...row, selected: !allSelected } : row
    ));
  };

  const handleSubmit = async () => {
    const selectedRows = parsedData.filter(r => r.selected && r.isValid);
    
    if (selectedRows.length === 0) {
      showToast('error', '선택된 유효한 연락처가 없습니다.');
      return;
    }
    
    if (!batchName.trim()) {
      showToast('error', '배치 이름을 입력해주세요.');
      return;
    }
    
    setIsSubmitting(true);
    
    try {
      const items = selectedRows.map(row => ({
        caseId: row.id,
        customerName: row.originalName,
        phone: row.formattedPhone.replace(/\D/g, ''),
        memo: 'Excel Upload'
      }));
      
      await createBatch({
        name: batchName,
        source: 'excel_upload',
        ringTimeoutSeconds: ringTimeout,
        gapSeconds: gapSeconds,
        items
      });
      
      showToast('success', `성공적으로 ${items.length}개의 연락처가 추가되었습니다.`);
      onCreated();
      handleClose();
    } catch (error) {
      console.error('Error creating batch:', error);
      showToast('error', '배치 생성 중 오류가 발생했습니다.');
    } finally {
      setIsSubmitting(false);
    }
  };

  const selectedCount = parsedData.filter(r => r.selected).length;
  const validCount = parsedData.filter(r => r.isValid).length;
  const invalidCount = parsedData.length - validCount;
  const allValidSelected = validCount > 0 && selectedCount === validCount;

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/75 backdrop-blur-sm animate-in fade-in duration-200">
      <div className="w-full max-w-2xl bg-card text-card-foreground border border-border rounded-2xl shadow-2xl overflow-hidden flex flex-col max-h-[90vh]">
        
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-border bg-muted/40">
          <h2 className="text-base font-bold text-foreground flex items-center gap-2">
            <FileSpreadsheet className="w-5 h-5 text-primary" strokeWidth={1.75} />
            <span>엑셀/CSV 일괄 업로드</span>
          </h2>
          <button
            type="button"
            onClick={handleClose}
            className="p-1.5 rounded-lg text-muted-foreground hover:text-foreground hover:bg-muted transition-colors cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto p-6 space-y-6">
          {!fileName ? (
            <div className="flex flex-col items-center justify-center py-12 px-4 border-2 border-dashed border-border rounded-xl bg-muted/20">
              <Upload className="w-12 h-12 text-muted-foreground mb-4" strokeWidth={1.5} />
              <p className="text-xs text-muted-foreground mb-4 text-center leading-relaxed">
                엑셀 또는 CSV 파일을 선택해주세요.<br />
                <span className="text-2xs text-muted-foreground/80">(이름, 전화번호 열 자동 인식)</span>
              </p>
              <input
                type="file"
                ref={fileInputRef}
                onChange={handleFileUpload}
                accept=".xlsx, .xls, .csv"
                className="hidden"
              />
              <button
                type="button"
                onClick={() => fileInputRef.current?.click()}
                disabled={isUploading}
                className="px-5 py-2.5 bg-card border border-border text-foreground rounded-lg hover:bg-muted transition-colors shadow-2xs disabled:opacity-50 flex items-center text-xs font-semibold cursor-pointer"
              >
                {isUploading ? (
                  <>
                    <Loader2 className="w-4 h-4 mr-2 animate-spin text-primary" />
                    파일 분석 중…
                  </>
                ) : (
                  '파일 선택하기'
                )}
              </button>
            </div>
          ) : (
            <>
              {/* Settings */}
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div className="md:col-span-3">
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                    배치 이름
                  </label>
                  <input
                    type="text"
                    value={batchName}
                    onChange={(e) => setBatchName(e.target.value)}
                    className="w-full px-3 py-2 bg-background border border-input rounded-lg focus:ring-1 focus:ring-primary text-foreground text-xs outline-none"
                    placeholder="예: 2026년 11월 프로모션"
                  />
                </div>
                <div>
                  <label className="block text-2xs font-mono font-semibold text-muted-foreground uppercase mb-1.5 flex items-center gap-1">
                    <Phone className="w-3.5 h-3.5 text-primary" /> 발신 대기 (초)
                  </label>
                  <input
                    type="number"
                    min="10"
                    max="120"
                    value={ringTimeout}
                    onChange={(e) => setRingTimeout(Number(e.target.value))}
                    className="w-full px-3 py-2 bg-background border border-input rounded-lg focus:ring-1 focus:ring-primary text-foreground text-xs font-mono outline-none"
                  />
                </div>
                <div>
                  <label className="block text-2xs font-mono font-semibold text-muted-foreground uppercase mb-1.5 flex items-center gap-1">
                    <Clock className="w-3.5 h-3.5 text-primary" /> 통화 간격 (초)
                  </label>
                  <input
                    type="number"
                    min="0"
                    max="60"
                    value={gapSeconds}
                    onChange={(e) => setGapSeconds(Number(e.target.value))}
                    className="w-full px-3 py-2 bg-background border border-input rounded-lg focus:ring-1 focus:ring-primary text-foreground text-xs font-mono outline-none"
                  />
                </div>
              </div>

              {/* Data Preview */}
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <h3 className="text-xs font-bold text-foreground">
                    데이터 미리보기 <span className="text-muted-foreground font-normal">({fileName})</span>
                  </h3>
                  <div className="flex space-x-3 text-2xs font-mono">
                    <span className="text-primary font-semibold">유효: {validCount}</span>
                    <span className="text-destructive font-semibold">형식 오류: {invalidCount}</span>
                    <span className="text-muted-foreground">선택됨: {selectedCount}</span>
                  </div>
                </div>

                <div className="border border-border rounded-xl overflow-hidden bg-card shadow-2xs">
                  <div className="overflow-x-auto max-h-60">
                    <table className="w-full text-xs text-left">
                      <thead className="text-2xs text-muted-foreground bg-muted/40 sticky top-0 z-10 border-b border-border font-mono uppercase">
                        <tr>
                          <th className="p-3 w-12 text-center">
                            <button type="button" onClick={toggleAll} className="text-muted-foreground hover:text-foreground cursor-pointer">
                              {allValidSelected ? <CheckSquare className="w-4 h-4 text-primary" /> : <Square className="w-4 h-4" />}
                            </button>
                          </th>
                          <th className="p-3 font-semibold">이름</th>
                          <th className="p-3 font-semibold">전화번호</th>
                          <th className="p-3 font-semibold">상태</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-border">
                        {parsedData.map((row) => (
                          <tr key={row.id} className={`${row.selected ? 'bg-primary/5' : ''} ${!row.isValid ? 'opacity-60' : ''} hover:bg-muted/30 transition-colors`}>
                            <td className="p-3 text-center">
                              <button 
                                type="button"
                                onClick={() => row.isValid && toggleRow(row.id)}
                                disabled={!row.isValid}
                                className={`${row.selected ? 'text-primary' : 'text-muted-foreground'} disabled:opacity-40 cursor-pointer`}
                              >
                                {row.selected ? <CheckSquare className="w-4 h-4" /> : <Square className="w-4 h-4" />}
                              </button>
                            </td>
                            <td className="p-3 text-foreground font-medium">{row.originalName}</td>
                            <td className="p-3 text-foreground font-mono">{row.formattedPhone || row.originalPhone}</td>
                            <td className="p-3">
                              {row.isValid ? (
                                <span className="inline-flex items-center px-2 py-0.5 rounded text-2xs font-semibold bg-primary/10 text-primary border border-primary/20">
                                  정상
                                </span>
                              ) : (
                                <span className="inline-flex items-center px-2 py-0.5 rounded text-2xs font-semibold bg-destructive/10 text-destructive border border-destructive/20" title="올바른 전화번호 형식이 아닙니다">
                                  <AlertCircle className="w-3 h-3 mr-1" />
                                  오류
                                </span>
                              )}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              </div>
            </>
          )}
        </div>

        {/* Footer */}
        <div className="px-6 py-4 border-t border-border bg-muted/40 flex justify-end space-x-2.5">
          <button
            type="button"
            onClick={handleClose}
            className="px-4 py-2 text-xs font-semibold text-foreground bg-card border border-border rounded-lg hover:bg-muted transition-colors shadow-2xs cursor-pointer"
          >
            취소
          </button>
          <button
            type="button"
            onClick={handleSubmit}
            disabled={!fileName || isSubmitting || selectedCount === 0}
            className="px-5 py-2 text-xs font-bold text-primary-foreground bg-primary rounded-lg hover:bg-primary/90 transition-all shadow-2xs disabled:opacity-40 disabled:cursor-not-allowed flex items-center cursor-pointer"
          >
            {isSubmitting ? (
              <>
                <Loader2 className="w-3.5 h-3.5 mr-1.5 animate-spin" />
                생성 중…
              </>
            ) : (
              `오토다이얼 배치 생성 (${selectedCount}건)`
            )}
          </button>
        </div>

      </div>
    </div>
  );
}
