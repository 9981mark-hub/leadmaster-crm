import React, { useState, useRef } from 'react';
import * as XLSX from 'xlsx';
import { GoogleGenerativeAI } from "@google/generative-ai";
import { Download, Upload, FileText, Image as ImageIcon, X, Plus, AlertCircle, Check, Loader2, List, Sparkles } from 'lucide-react';
import { batchCreateCases, fetchPartners, fetchInboundPaths, createCase, fetchCases } from '../services/api';
import { Partner, Case } from '../types';
import { useToast } from '../contexts/ToastContext';
import { ASSET_TYPES, JOB_TYPES } from '../constants';
import { fileToBase64, formatPhoneNumber, checkIsDuplicate } from '../utils';

interface ImportModalProps {
    isOpen: boolean;
    onClose: () => void;
    onSuccess: () => void;
    partners: Partner[];
    inboundPaths: string[];
}

type ImportTab = 'excel' | 'ocr' | 'manual';

export default function ImportModal({ isOpen, onClose, onSuccess, partners, inboundPaths }: ImportModalProps) {
    const { showToast } = useToast();
    const [activeTab, setActiveTab] = useState<ImportTab>('excel');
    const [isLoading, setIsLoading] = useState(false);

    // [Added] Load all cases for global duplicate check
    const [existingCases, setExistingCases] = useState<Case[]>([]);

    React.useEffect(() => {
        if (isOpen) {
            fetchCases().then(setExistingCases);
        }
    }, [isOpen]);

    // [Fix] Sync defaults when partners/inboundPaths load
    React.useEffect(() => {
        if (partners && partners.length > 0 && !ocrPartnerId) {
            setOcrPartnerId(partners[0].partnerId);
            setManualForm(prev => ({ ...prev, partnerId: partners[0].partnerId }));
        }
        if (inboundPaths && inboundPaths.length > 0 && !manualForm.inboundPath) {
            setManualForm(prev => ({ ...prev, inboundPath: inboundPaths[0] }));
        }
    }, [partners, inboundPaths]);

    if (!isOpen) return null;

    // Safety check for critical resources
    if (!partners || !inboundPaths) {
        return null; // or loading spinner
    }

    // Excel State
    const [excelPreview, setExcelPreview] = useState<(Partial<Case> & { duplicateInfo?: Case })[]>([]);
    const excelInputRef = useRef<HTMLInputElement>(null);

    // OCR State
    const [ocrFile, setOcrFile] = useState<File | null>(null);
    const [ocrPreview, setOcrPreview] = useState<Partial<Case> | null>(null);
    const [ocrPartnerId, setOcrPartnerId] = useState(partners[0]?.partnerId || '');
    const ocrInputRef = useRef<HTMLInputElement>(null);

    // Manual State
    const [manualForm, setManualForm] = useState<Partial<Case>>({
        customerName: '',
        phone: '',
        partnerId: partners[0]?.partnerId || '',
        inboundPath: inboundPaths[0] || '',
        caseType: '개인회생',
        preInfo: ''
    });

    if (!isOpen) return null;

    // --- Excel Logic ---
    const handleDownloadTemplate = () => {
        const ws = XLSX.utils.json_to_sheet([
            {
                customerName: '홍길동',
                phone: '010-1234-5678',
                caseType: '개인회생',
                inboundPath: '블로그',
                preInfo: '채무 5천, 직장인'
            },
            {
                customerName: '김철수',
                phone: '010-9876-5432',
                caseType: '파산',
                inboundPath: '지인소개',
                preInfo: '자영업, 부채 1억'
            }
        ]);
        const wb = XLSX.utils.book_new();
        XLSX.utils.book_append_sheet(wb, ws, "CaseTemplate");
        XLSX.writeFile(wb, "케이스_업로드_템플릿.xlsx");
    };

    const handleExcelUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (!file) return;

        const reader = new FileReader();
        reader.onload = (evt) => {
            try {
                const bstr = evt.target?.result;
                const wb = XLSX.read(bstr, { type: 'binary' });
                const wsname = wb.SheetNames[0];
                const ws = wb.Sheets[wsname];
                const data = XLSX.utils.sheet_to_json(ws);

                const parsedCases = data.map((row: any) => {
                    const phone = formatPhoneNumber(row['phone'] || row['연락처'] || '');
                    const duplicate = checkIsDuplicate(phone, existingCases);

                    return {
                        customerName: row['customerName'] || row['고객명'],
                        phone: phone,
                        caseType: row['caseType'] || row['유형'] || '개인회생',
                        inboundPath: row['inboundPath'] || row['유입경로'] || '', // Fixed mapping
                        preInfo: row['preInfo'] || row['사전정보'] || '',
                        isNew: true,
                        isViewed: false, // Ensure it is explicitly unviewed
                        duplicateInfo: duplicate
                    };
                });

                setExcelPreview(parsedCases);
            } catch (err) {
                console.error(err);
                showToast('엑셀 파일 읽기에 실패했습니다.', 'error');
            }
        };
        reader.readAsBinaryString(file);
    };

    const submitExcel = async () => {
        if (excelPreview.length === 0) return;
        setIsLoading(true);
        try {
            await batchCreateCases(excelPreview);
            showToast(`${excelPreview.length}건의 케이스가 등록되었습니다.`);
            onSuccess();
            onClose();
        } catch (e) {
            showToast('일괄 등록 중 오류가 발생했습니다.', 'error');
        } finally {
            setIsLoading(false);
        }
    };

    // --- OCR Logic ---
    const handleOcrFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (!file) return;
        setOcrFile(file);
        setOcrPreview(null);
    };

    const processOcr = async () => {
        if (!ocrFile) return;
        setIsLoading(true);
        try {
            const base64Content = await fileToBase64(ocrFile); // utils already removes the header
            const mimeType = ocrFile.type || 'image/png';

            // Note: You need a valid API key in environment variables or hardcoded constants for demo
            // Assuming GOOGLE_API_KEY is available via import.meta.env or similar, or prompt user.
            // For this demo, I will assume the key is available or throw a clear error.
            const apiKey = import.meta.env.VITE_GEMINI_API_KEY || (window as any).GEMINI_API_KEY;
            if (!apiKey) {
                throw new Error("Google API Key Missing");
            }

            const client = new GoogleGenerativeAI(apiKey);
            const model = client.getGenerativeModel({ model: "gemini-flash-latest" });

            const selectedPartner = partners.find(p => p.partnerId === ocrPartnerId);
            const prompt = selectedPartner?.ocrPromptTemplate || `
        Extract the following information from the provided document image/pdf.
        Return ONLY a raw JSON object (no markdown, no backticks).
        Fields:
        - customerName: (string) Name of the client
        - phone: (string) Phone number
        - summary: (string) specific details found in the doc (debt amount, job, etc)

        If a field is not found, use empty string.
      `;

            // Retry Logic with Exponential Backoff
            let attempt = 0;
            const maxRetries = 3;
            let responseText = "";

            while (attempt < maxRetries) {
                try {
                    const result = await model.generateContent([
                        { inlineData: { mimeType, data: base64Content } },
                        prompt
                    ]);
                    responseText = result.response.text();
                    break; // Success
                } catch (err: any) {
                    attempt++;
                    console.warn(`OCR Attempt ${attempt} failed:`, err);

                    if ((err.message?.includes('429') || err.message?.includes('503')) && attempt < maxRetries) {
                        const waitTime = Math.pow(2, attempt) * 1000 + Math.random() * 500;
                        await new Promise(resolve => setTimeout(resolve, waitTime));
                        continue;
                    }
                    throw err;
                }
            }
            // Clean up markdown if present
            const jsonStr = responseText.replace(/```json/g, '').replace(/```/g, '').trim();
            const parsed = JSON.parse(jsonStr);

            setOcrPreview({
                customerName: parsed.customerName,
                phone: parsed.phone,
                preInfo: parsed.summary,
                isNew: true,
                isViewed: false,
                caseType: '개인회생', // Default
                inboundPath: 'OCR업로드',
                partnerId: ocrPartnerId
            });

        } catch (e: any) {
            console.error(e);
            if (e.message?.includes("API Key")) {
                showToast("Google API Key가 설정되지 않았습니다.", 'error');
            } else {
                showToast('문서 분석에 실패했습니다. 이미지가 선명한지 확인해주세요.', 'error');
            }
        } finally {
            setIsLoading(false);
        }
    };

    const submitOcr = async () => {
        if (!ocrPreview) return;
        setIsLoading(true);
        try {
            await createCase(ocrPreview);
            showToast('케이스가 등록되었습니다.');
            onSuccess();
            onClose();
        } catch (e) {
            showToast('등록 실패', 'error');
        } finally {
            setIsLoading(false);
        }
    };


    // --- Manual Logic ---
    const [manualDuplicate, setManualDuplicate] = useState<Case | undefined>(undefined);

    const handleManualChange = (field: string, value: string) => {
        if (field === 'phone') {
            value = formatPhoneNumber(value);
            const dup = checkIsDuplicate(value, existingCases);
            setManualDuplicate(dup);
        }
        setManualForm(prev => ({ ...prev, [field]: value }));
    };

    const submitManual = async () => {
        if (!manualForm.customerName || !manualForm.phone) {
            showToast('이름과 연락처는 필수입니다.', 'error');
            return;
        }
        setIsLoading(true);
        try {
            await createCase({ ...manualForm, isNew: true, isViewed: false });
            showToast('케이스가 등록되었습니다.');
            onSuccess();
            onClose();
        } catch (e) {
            showToast('등록 실패', 'error');
        } finally {
            setIsLoading(false);
        }
    };


    return (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4 backdrop-blur-sm">
            <div className="bg-white rounded-xl shadow-2xl w-full max-w-2xl max-h-[90vh] overflow-hidden flex flex-col">
                {/* Header */}
                <div className="p-4 border-b flex justify-between items-center bg-gray-50">
                    <h2 className="text-lg font-bold text-gray-800 flex items-center gap-2">
                        <Upload size={20} className="text-blue-600" />
                        케이스 일괄/간편 등록
                    </h2>
                    <button onClick={onClose} className="text-gray-400 hover:text-gray-600 transition-colors">
                        <X size={24} />
                    </button>
                </div>

                {/* Tabs */}
                <div className="flex border-b">
                    <button
                        onClick={() => setActiveTab('excel')}
                        className={`flex-1 py-3 text-sm font-medium border-b-2 transition-colors ${activeTab === 'excel' ? 'border-blue-600 text-blue-600 bg-blue-50/50' : 'border-transparent text-gray-500 hover:bg-gray-50'}`}
                    >
                        <div className="flex items-center justify-center gap-2">
                            <FileText size={16} /> 엑셀 대량 업로드
                        </div>
                    </button>
                    <button
                        onClick={() => setActiveTab('ocr')}
                        className={`flex-1 py-3 text-sm font-medium border-b-2 transition-colors ${activeTab === 'ocr' ? 'border-pink-600 text-pink-600 bg-pink-50/50' : 'border-transparent text-gray-500 hover:bg-gray-50'}`}
                    >
                        <div className="flex items-center justify-center gap-2">
                            <ImageIcon size={16} /> 이미지/PDF 인식 (AI)
                        </div>
                    </button>
                    <button
                        onClick={() => setActiveTab('manual')}
                        className={`flex-1 py-3 text-sm font-medium border-b-2 transition-colors ${activeTab === 'manual' ? 'border-green-600 text-green-600 bg-green-50/50' : 'border-transparent text-gray-500 hover:bg-gray-50'}`}
                    >
                        <div className="flex items-center justify-center gap-2">
                            <List size={16} /> 간편 수기 등록
                        </div>
                    </button>
                </div>

                {/* Content */}
                <div className="p-6 overflow-y-auto flex-1">
                    {activeTab === 'excel' && (
                        <div className="space-y-6">
                            <div className="bg-blue-50 p-4 rounded-lg text-sm text-blue-800 border border-blue-100 dark:bg-blue-900/20 dark:text-blue-200 dark:border-blue-800">
                                <h4 className="font-bold mb-2 flex items-center gap-2"><AlertCircle size={16} /> 사용 가이드</h4>
                                <ol className="list-decimal list-inside space-y-1 ml-1 opacity-90">
                                    <li>템플릿 양식을 다운로드합니다.</li>
                                    <li>양식에 맞춰 고객 정보를 입력합니다. (헤더 수정 금지)</li>
                                    <li>작성된 엑셀 파일을 업로드하면 자동으로 목록이 미리보기에 나타납니다.</li>
                                    <li>[일괄 등록하기] 버튼을 눌러 저장을 완료합니다.</li>
                                </ol>
                            </div>

                            <div className="flex gap-4">
                                <button
                                    onClick={handleDownloadTemplate}
                                    className="flex-1 py-3 border border-gray-300 rounded-lg flex items-center justify-center gap-2 text-gray-700 hover:bg-gray-50 font-medium transition-colors"
                                >
                                    <Download size={18} /> 양식 다운로드
                                </button>
                                <div className="flex-1 relative">
                                    <input
                                        type="file"
                                        accept=".xlsx, .xls"
                                        onChange={handleExcelUpload}
                                        className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
                                    />
                                    <button className="w-full h-full py-3 bg-blue-600 text-white rounded-lg flex items-center justify-center gap-2 hover:bg-blue-700 font-bold shadow-md transition-colors">
                                        <Upload size={18} /> 엑셀 파일 업로드
                                    </button>
                                </div>
                            </div>

                            {excelPreview.length > 0 && (
                                <div className="border rounded-lg overflow-hidden">
                                    <div className="bg-gray-100 px-4 py-2 text-sm font-bold text-gray-600 border-b flex justify-between">
                                        <span>미리보기 ({excelPreview.length}건)</span>
                                        <button onClick={() => setExcelPreview([])} className="text-red-500 text-xs hover:underline">초기화</button>
                                    </div>
                                    <div className="max-h-48 overflow-y-auto">
                                        <table className="w-full text-sm text-left">
                                            <thead className="bg-gray-50 sticky top-0">
                                                <tr>
                                                    <th className="p-2">고객명</th>
                                                    <th className="p-2">연락처</th>
                                                    <th className="p-2">유형</th>
                                                </tr>
                                            </thead>
                                            <tbody className="divide-y">
                                                {excelPreview.map((item, idx) => (
                                                    <tr key={idx} className={item.duplicateInfo ? 'bg-red-50' : ''}>
                                                        <td className="p-2">
                                                            {item.customerName}
                                                            {item.duplicateInfo && <span className="text-red-600 text-xs ml-1 font-bold">(중복)</span>}
                                                        </td>
                                                        <td className="p-2 text-gray-500">
                                                            <div className="flex flex-col">
                                                                <span>{item.phone}</span>
                                                                {item.duplicateInfo && (
                                                                    <span className="text-[10px] text-red-500">
                                                                        기존: {item.duplicateInfo.managerName} ({item.duplicateInfo.status})
                                                                    </span>
                                                                )}
                                                            </div>
                                                        </td>
                                                        <td className="p-2 text-xs">{item.caseType}</td>
                                                    </tr>
                                                ))}
                                            </tbody>
                                        </table>
                                    </div>
                                </div>
                            )}

                            {excelPreview.length > 0 && (
                                <button
                                    onClick={submitExcel}
                                    disabled={isLoading}
                                    className="w-full py-3 bg-green-600 text-white rounded-lg font-bold text-lg hover:bg-green-700 shadow-md flex items-center justify-center gap-2 disabled:opacity-50"
                                >
                                    {isLoading ? <Loader2 className="animate-spin" /> : <Check size={20} />}
                                    {excelPreview.length}건 일괄 등록하기
                                </button>
                            )}
                        </div>
                    )}

                    {activeTab === 'ocr' && (
                        <div className="space-y-6">
                            <div className="bg-pink-50 p-4 rounded-lg text-sm text-pink-800 border border-pink-100">
                                <h4 className="font-bold mb-2 flex items-center gap-2"><Sparkles size={16} /> AI 자동 인식</h4>
                                <p className="opacity-90">
                                    상담 신청서 이미지나 PDF 파일을 업로드하면, Gemini AI가 내용을 분석하여 자동으로 입력해줍니다.
                                </p>
                            </div>

                            <div>
                                <label className="block text-xs font-bold text-gray-500 mb-1">적용할 거래처 (OCR 설정)</label>
                                <select
                                    className="w-full p-2 border rounded-md text-sm"
                                    value={ocrPartnerId}
                                    onChange={e => setOcrPartnerId(e.target.value)}
                                >
                                    {partners.map(p => <option key={p.partnerId} value={p.partnerId}>{p.name}</option>)}
                                </select>
                            </div>

                            <div className="border-2 border-dashed border-gray-300 rounded-xl p-8 text-center transition-colors hover:border-pink-400 hover:bg-pink-50 group cursor-pointer relative">
                                <input
                                    type="file"
                                    accept="image/*, application/pdf"
                                    onChange={handleOcrFileChange}
                                    className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
                                />
                                <div className="flex flex-col items-center gap-3 text-gray-500 group-hover:text-pink-600">
                                    <div className="w-12 h-12 rounded-full bg-gray-100 flex items-center justify-center group-hover:bg-pink-100 transition-colors">
                                        <ImageIcon size={24} />
                                    </div>
                                    <p className="font-medium text-lg">파일을 드래그하거나 클릭하여 업로드</p>
                                    <p className="text-xs text-gray-400">지원 형식: JPG, PNG, PDF</p>
                                </div>
                            </div>

                            {ocrFile && (
                                <div className="flex items-center justify-between bg-white border p-3 rounded-lg shadow-sm">
                                    <span className="text-sm font-medium truncat max-w-[200px]">{ocrFile.name}</span>
                                    <div className="flex gap-2">
                                        <button
                                            onClick={processOcr}
                                            disabled={isLoading}
                                            className="px-4 py-1.5 bg-pink-600 text-white rounded text-sm font-bold hover:bg-pink-700 disabled:opacity-50 flex items-center gap-2"
                                        >
                                            {isLoading ? <Loader2 size={14} className="animate-spin" /> : <Sparkles size={14} />}
                                            분석 시작
                                        </button>
                                        <button onClick={() => { setOcrFile(null); setOcrPreview(null); }} className="p-1.5 text-gray-400 hover:bg-gray-100 rounded">
                                            <X size={16} />
                                        </button>
                                    </div>
                                </div>
                            )}

                            {ocrPreview && (
                                <div className="bg-white border rounded-lg p-4 space-y-3 shadow-sm animate-in slide-in-from-bottom-2">
                                    <h4 className="font-bold text-gray-800 border-b pb-2">분석 결과 확인</h4>
                                    <div className="grid grid-cols-2 gap-4">
                                        <div>
                                            <label className="text-xs text-gray-500">고객명</label>
                                            <input
                                                className="w-full p-2 border rounded text-sm font-bold text-gray-800 bg-gray-50"
                                                value={ocrPreview.customerName}
                                                onChange={e => setOcrPreview({ ...ocrPreview, customerName: e.target.value })}
                                            />
                                        </div>
                                        <div>
                                            <label className="text-xs text-gray-500">연락처</label>
                                            <input
                                                className="w-full p-2 border rounded text-sm font-bold text-gray-800 bg-gray-50"
                                                value={ocrPreview.phone}
                                                onChange={e => setOcrPreview({ ...ocrPreview, phone: e.target.value })}
                                            />
                                        </div>
                                        <div className="col-span-2">
                                            <label className="text-xs text-gray-500">추출 정보 (사전정보)</label>
                                            <textarea
                                                className="w-full p-2 border rounded text-sm bg-gray-50 h-20"
                                                value={ocrPreview.preInfo}
                                                onChange={e => setOcrPreview({ ...ocrPreview, preInfo: e.target.value })}
                                            />
                                        </div>
                                    </div>
                                    <button
                                        onClick={submitOcr}
                                        disabled={isLoading}
                                        className="w-full py-3 bg-pink-600 text-white rounded-lg font-bold hover:bg-pink-700 shadow-md flex items-center justify-center gap-2"
                                    >
                                        <Check size={18} /> 이 정보로 등록하기
                                    </button>
                                </div>
                            )}
                        </div>
                    )}

                    {activeTab === 'manual' && (
                        <div className="space-y-5">
                            <div className="grid grid-cols-2 gap-4">
                                <div>
                                    <label className="block text-xs font-bold text-gray-500 mb-1">거래처</label>
                                    <select
                                        className="w-full p-2 border rounded-md text-sm"
                                        value={manualForm.partnerId}
                                        onChange={e => handleManualChange('partnerId', e.target.value)}
                                    >
                                        {partners.map(p => <option key={p.partnerId} value={p.partnerId}>{p.name}</option>)}
                                    </select>
                                </div>
                                <div>
                                    <label className="block text-xs font-bold text-gray-500 mb-1">유입경로</label>
                                    <select
                                        className="w-full p-2 border rounded-md text-sm"
                                        value={manualForm.inboundPath}
                                        onChange={e => handleManualChange('inboundPath', e.target.value)}
                                    >
                                        {inboundPaths.map(p => <option key={p} value={p}>{p}</option>)}
                                    </select>
                                </div>
                            </div>

                            <div className="grid grid-cols-2 gap-4">
                                <div>
                                    <label className="block text-xs font-bold text-gray-500 mb-1">고객명 <span className="text-red-500">*</span></label>
                                    <input
                                        className="w-full p-2 border rounded-md text-sm focus:ring-2 focus:ring-green-500 outline-none"
                                        placeholder="이름 입력"
                                        value={manualForm.customerName}
                                        onChange={e => handleManualChange('customerName', e.target.value)}
                                    />
                                </div>
                                <div>
                                    <label className="block text-xs font-bold text-gray-500 mb-1">연락처 <span className="text-red-500">*</span></label>
                                    <input
                                        className="w-full p-2 border rounded-md text-sm focus:ring-2 focus:ring-green-500 outline-none"
                                        placeholder="010-0000-0000"
                                        value={manualForm.phone}
                                        onChange={e => handleManualChange('phone', e.target.value)}
                                    />
                                    {manualDuplicate && (
                                        <div className="text-xs text-red-600 mt-1 bg-red-50 p-1 rounded font-medium">
                                            ⚠️ 중복: {manualDuplicate.customerName} ({manualDuplicate.managerName}/{manualDuplicate.status})
                                        </div>
                                    )}
                                </div>
                            </div>

                            <div>
                                <label className="block text-xs font-bold text-gray-500 mb-1">사전 정보 (메모)</label>
                                <textarea
                                    className="w-full p-2 border rounded-md text-sm h-24 focus:ring-2 focus:ring-green-500 outline-none"
                                    placeholder="상담 전 참고할 내용 입력..."
                                    value={manualForm.preInfo}
                                    onChange={e => handleManualChange('preInfo', e.target.value)}
                                />
                            </div>

                            <button
                                onClick={submitManual}
                                disabled={isLoading}
                                className="w-full py-3 bg-green-600 text-white rounded-lg font-bold text-lg hover:bg-green-700 shadow-md flex items-center justify-center gap-2 mt-4"
                            >
                                {isLoading ? <Loader2 className="animate-spin" /> : <Plus size={20} />}
                                바로 등록하기
                            </button>
                        </div>
                    )}

                </div>
            </div>
        </div>
    );
}
