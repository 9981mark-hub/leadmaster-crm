import React, { useState, useRef } from 'react';
import * as XLSX from 'xlsx';
import { Download, Upload, FileText, Image as ImageIcon, X, Plus, AlertCircle, Check, Loader2, List, Sparkles, Grid, Trash2, Building2, DollarSign, Layers } from 'lucide-react';
import { LeadVendor, fetchLeadVendors } from '../services/vendor';
import { createImportBatch, updateImportBatch } from '../services/distribution';
import { VendorManageModal } from './team/VendorManageModal';
import { batchCreateCases, fetchPartners, fetchInboundPaths, createCase, fetchCases } from '../services/api';
import { Partner, Case } from '../types';
import { useToast } from '../contexts/ToastContext';
import { ASSET_TYPES, JOB_TYPES, CASE_TYPES, formatPhone } from '../constants';
import { fileToBase64, checkIsDuplicate } from '../utils';
import { callAi, checkAiFileSize, AiProxyError } from '../services/aiProxy';

// 유입경로 약어 매핑 (엑셀 업로드 / 시트 입력 공용)
const INBOUND_PATH_ALIASES: Record<string, string> = {
    'fb': '페이스북',
    'ig': '인스타그램',
};

interface ImportModalProps {
    isOpen: boolean;
    onClose: () => void;
    onSuccess: () => void;
    partners: Partner[];
    inboundPaths: string[];
}

type ImportTab = 'excel' | 'ocr' | 'sheet' | 'manual';

interface SheetRow {
    customerName: string;
    phone: string;
    caseType: string;
    inboundPath: string;
    preInfo: string;
}

export default function ImportModal({ isOpen, onClose, onSuccess, partners, inboundPaths }: ImportModalProps) {
    const { showToast } = useToast();
    const [activeTab, setActiveTab] = useState<ImportTab>('excel');
    const [isLoading, setIsLoading] = useState(false);

    // [Added] Load all cases for global duplicate check
    const [existingCases, setExistingCases] = useState<Case[]>([]);

    // [030/031] DB 거래처 & 회차 매입 비용 관제 State (CPL 및 3000건/50만원 패키지 지원)
    const [vendors, setVendors] = useState<LeadVendor[]>([]);
    const [selectedVendor, setSelectedVendor] = useState<string>('');
    const [pricingMode, setPricingMode] = useState<'cpl' | 'package'>('cpl');
    const [pkgLeads, setPkgLeads] = useState<number>(3000);
    const [pkgPrice, setPkgPrice] = useState<number>(500000);
    const [unitCost, setUnitCost] = useState<number>(25000);
    const [totalCost, setTotalCost] = useState<number>(0);
    const [batchName, setBatchName] = useState<string>('');
    const [isVendorManageOpen, setIsVendorManageOpen] = useState(false);
    const [uploadedFileName, setUploadedFileName] = useState<string>('');

    const loadVendorList = async () => {
        try {
            const vList = await fetchLeadVendors();
            setVendors(vList);
            if (vList.length > 0 && !selectedVendor) {
                const first = vList[0];
                setSelectedVendor(first.name);
                if (first.pricingType === 'package') {
                    setPricingMode('package');
                    setPkgLeads(first.packageLeads || 3000);
                    setPkgPrice(first.packagePrice || 500000);
                    setUnitCost(first.defaultUnitCost || 167);
                    setTotalCost(first.packagePrice || 500000);
                } else {
                    setPricingMode('cpl');
                    setUnitCost(first.defaultUnitCost || 25000);
                    setTotalCost(0);
                }
                const today = new Date().toLocaleDateString('ko-KR');
                setBatchName(`${today} 1차 (${first.name})`);
            }
        } catch (e) {
            console.warn('[ImportModal] fetchLeadVendors failed:', e);
        }
    };

    const handleSelectVendor = (vendorName: string) => {
        setSelectedVendor(vendorName);
        const match = vendors.find(v => v.name === vendorName);
        const today = new Date().toLocaleDateString('ko-KR');
        if (match) {
            if (match.pricingType === 'package') {
                setPricingMode('package');
                setPkgLeads(match.packageLeads || 3000);
                setPkgPrice(match.packagePrice || 500000);
                setUnitCost(match.defaultUnitCost || 167);
                setTotalCost(match.packagePrice || 500000);
            } else {
                setPricingMode('cpl');
                setUnitCost(match.defaultUnitCost || 25000);
                setTotalCost(0);
            }
            setBatchName(`${today} 1차 (${match.name})`);
        } else {
            setBatchName(`${today} 1차 (${vendorName})`);
        }
    };

    // Excel State
    const [excelPreview, setExcelPreview] = useState<(Partial<Case> & { duplicateInfo?: Case })[]>([]);
    const excelInputRef = useRef<HTMLInputElement>(null);

    // Sheet State
    const [sheetRows, setSheetRows] = useState<SheetRow[]>(() =>
        Array(5).fill(null).map(() => ({
            customerName: '',
            phone: '',
            caseType: '개인회생',
            inboundPath: '',
            preInfo: ''
        }))
    );
    const sheetRef = useRef<HTMLTableElement>(null);

    // OCR State
    const [ocrFile, setOcrFile] = useState<File | null>(null);
    const [ocrPreview, setOcrPreview] = useState<Partial<Case> | null>(null);
    // Initialize with safe check
    const [ocrPartnerId, setOcrPartnerId] = useState(partners?.[0]?.partnerId || '');
    const ocrInputRef = useRef<HTMLInputElement>(null);

    // Manual State
    const [manualForm, setManualForm] = useState<Partial<Case>>(() => {
        // [Persistence] Restore draft if exists
        const saved = sessionStorage.getItem('lm_manual_draft');
        const initial = {
            customerName: '',
            phone: '',
            partnerId: partners?.[0]?.partnerId || '',
            inboundPath: inboundPaths?.[0] || '',
            caseType: '개인회생',
            preInfo: ''
        };
        if (saved) {
            try {
                return { ...initial, ...JSON.parse(saved) };
            } catch (e) {
                return initial;
            }
        }
        return initial;
    });

    // Manual Duplicate Check State (Moved from line 269)
    const [manualDuplicate, setManualDuplicate] = useState<Case | undefined>(undefined);

    // [Persistence] Save draft on change
    React.useEffect(() => {
        // Debounce or just save on every change (it's small text data, harmless)
        if (manualForm.customerName || manualForm.phone || manualForm.preInfo) {
            sessionStorage.setItem('lm_manual_draft', JSON.stringify(manualForm));
        }
    }, [manualForm]);

    // Effects must be after state declarations
    React.useEffect(() => {
        if (isOpen) {
            fetchCases().then(setExistingCases);
            loadVendorList();
        }
    }, [isOpen]);

    // [Fix] Sync defaults when partners/inboundPaths load
    React.useEffect(() => {
        if (partners && partners.length > 0 && !ocrPartnerId) {
            setOcrPartnerId(partners[0].partnerId);
            setManualForm(prev => ({ ...prev, partnerId: partners[0].partnerId })); // Only sets if empty? No, this overrides.
            // Wait, previous logic was: setManualForm(prev => ({ ...prev, partnerId: partners[0].partnerId }));
            // It didn't check for existence? 
            // In the original file line 64: setManualForm(prev => ({ ...prev, partnerId: partners[0].partnerId }));
            // This runs whenever partners changes. 
            // Better to only set if PREV is empty.
        }
        // Fix for Manual Form default Sync (Respect Draft)
        if (partners && partners.length > 0 && !manualForm.partnerId) {
            setManualForm(prev => ({ ...prev, partnerId: partners[0].partnerId }));
        }

        if (inboundPaths && inboundPaths.length > 0 && !manualForm.inboundPath) {
            setManualForm(prev => ({ ...prev, inboundPath: inboundPaths[0] }));
        }
    }, [partners, inboundPaths]);

    // Conditional Returns must be AFTER all Hooks
    if (!isOpen) return null;

    // Safety check for critical resources
    if (!partners || !Array.isArray(partners) || !inboundPaths || !Array.isArray(inboundPaths)) {
        return (
            <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4 backdrop-blur-sm">
                <div className="bg-white rounded-xl shadow-2xl p-8 flex flex-col items-center gap-4">
                    <Loader2 className="animate-spin text-blue-600" size={32} />
                    <p className="text-gray-600 font-medium">기초 데이터를 불러오는 중입니다...</p>
                    <button onClick={onClose} className="text-sm text-gray-400 hover:text-gray-600 underline">
                        닫기
                    </button>
                </div>
            </div>
        );
    }

    // --- Excel Logic ---
    const handleDownloadTemplate = () => {
        const ws = XLSX.utils.json_to_sheet([
            {
                caseType: '개인회생',
                inboundPath: '블로그',
                phone: '010-1234-5678',
                customerName: '홍길동',
                '성별': '남',
                '희망시간': '9시 30분',
                '직업': '직장인'
            },
            {
                caseType: '파산',
                inboundPath: '지인소개',
                phone: '010-9876-5432',
                customerName: '김철수',
                '성별': '여',
                '희망시간': '오후 2시',
                '직업': '자영업'
            }
        ]);
        const wb = XLSX.utils.book_new();
        XLSX.utils.book_append_sheet(wb, ws, "CaseTemplate");
        XLSX.writeFile(wb, "케이스_업로드_템플릿.xlsx");
    };

    const handleExcelUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (!file) return;
        setUploadedFileName(file.name);

        const reader = new FileReader();
        reader.onload = (evt) => {
            try {
                const arrayBuffer = evt.target?.result;
                const wb = XLSX.read(arrayBuffer, { type: 'array' });
                const wsname = wb.SheetNames[0];
                const ws = wb.Sheets[wsname];
                const data = XLSX.utils.sheet_to_json(ws);

                // Known system column names (these are NOT preInfo)
                const SYSTEM_COLUMNS = new Set([
                    'caseType', '유형', 'inboundPath', '유입경로',
                    'phone', '연락처', 'customerName', '고객명',
                    'preInfo', '사전정보', 'partnerId', '거래처'
                ]);
                // Also exclude legacy preInfoN columns from dynamic detection
                for (let i = 1; i <= 20; i++) {
                    SYSTEM_COLUMNS.add(`preInfo${i}`);
                    SYSTEM_COLUMNS.add(`사전정보${i}`);
                }

                const parsedCases = data.map((row: any) => {
                    // Safe String conversion for inputs that might be numbers in Excel
                    const rawPhone = String(row['phone'] || row['연락처'] || '');
                    const rawName = String(row['customerName'] || row['고객명'] || '');
                    const rawType = String(row['caseType'] || row['유형'] || '개인회생');
                    const rawPath = String(row['inboundPath'] || row['유입경로'] || '');

                    // 유입경로 약어 자동 변환 (대소문자 무관)
                    const normalizedPath = INBOUND_PATH_ALIASES[rawPath.trim().toLowerCase()] || rawPath;

                    // [Feature] Dynamic preInfo: detect non-system columns and use header name as label
                    const preInfoParts: string[] = [];

                    // 1. Check legacy preInfo column (backward compat)
                    const legacyPre = row['preInfo'] || row['사전정보'];
                    if (legacyPre && String(legacyPre).trim()) {
                        preInfoParts.push(String(legacyPre).trim());
                    }

                    // 2. Check legacy preInfo1~10 columns (backward compat, value only)
                    for (let i = 1; i <= 10; i++) {
                        const val = row[`preInfo${i}`] || row[`사전정보${i}`];
                        if (val && String(val).trim()) {
                            preInfoParts.push(String(val).trim());
                        }
                    }

                    // 3. Detect any non-system columns → use "headerName: value" format
                    Object.keys(row).forEach(colName => {
                        if (!SYSTEM_COLUMNS.has(colName) && row[colName] != null) {
                            const val = String(row[colName]).trim();
                            if (val) {
                                preInfoParts.push(`${colName}: ${val}`);
                            }
                        }
                    });

                    const rawPre = preInfoParts.join('\n');

                    const phone = formatPhone(rawPhone);
                    const duplicate = checkIsDuplicate(phone, existingCases);

                    return {
                        customerName: rawName,
                        phone: phone,
                        caseType: rawType,
                        inboundPath: normalizedPath,
                        preInfo: rawPre,
                        isNew: true,

                        isViewed: false, // [Restore] Keep as false so "New UI" (Badge) appears
                        managerName: localStorage.getItem('managerName') || '미지정', // [Fix] Assign to self to prevent Popup notification
                        duplicateInfo: duplicate
                    };
                });

                setExcelPreview(parsedCases);
            } catch (err: any) {
                console.error(err);
                if (e.target) e.target.value = ''; // Reset input to allow re-upload
                showToast(`엑셀 파일 읽기 실패: ${err.message}`, 'error');
            }
        };
        reader.readAsArrayBuffer(file);
    };

    // [030] 4대 등록 방식(엑셀/AI/시트/수기) 공통 회차 생성 & DB 거래처/비용 자동 각인 엔진
    const executeBatchImport = async (
        rawCases: Partial<Case>[],
        sourceMethod: string,
        fileName?: string
    ): Promise<{ inserted: number; skipped: number; batchId?: string }> => {
        const validCases = rawCases.filter(c => !c.phone || !checkIsDuplicate(c.phone, existingCases));
        const skippedCount = rawCases.length - validCases.length;

        if (validCases.length === 0) {
            throw new Error('등록 가능한 신규 연락처가 없습니다 (전원 기존 등록 중복).');
        }

        const vendorName = selectedVendor.trim() || '직접 등록/미지정';
        const finalBatchName = batchName.trim() || `${new Date().toLocaleDateString('ko-KR')} ${vendorName} (${validCases.length}건)`;
        const finalTotalCost = totalCost > 0 ? totalCost : (unitCost > 0 ? unitCost * validCases.length : 0);

        let batchId: string | undefined;
        try {
            batchId = await createImportBatch({
                name: finalBatchName,
                source: vendorName,
                vendorName: vendorName,
                unitCost: unitCost,
                totalCost: finalTotalCost,
                fileName: fileName || uploadedFileName || `${sourceMethod}_등록`,
                totalRows: rawCases.length,
                distribution: {},
            });
        } catch (err) {
            console.warn('[ImportModal] createImportBatch failed, fallback without batch:', err);
        }

        const casesWithBatch = validCases.map(c => ({
            ...c,
            importBatchId: batchId || c.importBatchId,
            inboundPath: vendorName || c.inboundPath || 'DB',
            isNew: true,
            isViewed: false,
            managerName: c.managerName || localStorage.getItem('managerName') || '미지정',
        }));

        await batchCreateCases(casesWithBatch);

        if (batchId) {
            try {
                await updateImportBatch(batchId, {
                    inserted: validCases.length,
                    duplicates: skippedCount,
                    invalid: 0,
                    totalCost: finalTotalCost,
                    unitCost: unitCost,
                });
            } catch (e) {
                console.warn('[ImportModal] updateImportBatch failed:', e);
            }
        }

        return { inserted: validCases.length, skipped: skippedCount, batchId };
    };

    const submitExcel = async () => {
        if (excelPreview.length === 0) return;
        setIsLoading(true);
        try {
            const validSubset = excelPreview.filter(c => !c.duplicateInfo);
            const { inserted, skipped } = await executeBatchImport(
                validSubset,
                '엑셀대량',
                uploadedFileName || 'excel_import.xlsx'
            );

            let message = `${inserted}건이 등록되었습니다.`;
            if (skipped > 0) message += ` (중복 ${skipped}건 제외)`;

            showToast(message, 'success');
            onSuccess();
            onClose();
        } catch (e: any) {
            showToast(e.message || '일괄 등록 중 오류가 발생했습니다.', 'error');
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
        const sizeError = checkAiFileSize('import_ocr', ocrFile.size);
        if (sizeError) {
            showToast(sizeError, 'error');
            return;
        }
        setIsLoading(true);
        try {
            const base64Content = await fileToBase64(ocrFile); // utils already removes the header
            const mimeType = ocrFile.type || 'image/png';

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

            // 서버(ai-proxy)가 Gemini를 부른다. 모델 과부하 시 다른 모델로 바꾸는 것도 서버가 한다
            // (여기서 다시 시도하면 회사 하루 AI 사용 횟수만 줄어서 재시도하지 않는다)
            const { text: responseText } = await callAi({
                task: 'import_ocr',
                prompt,
                files: [{ mimeType, data: base64Content }],
                responseMimeType: 'application/json',
            });
            // Clean up markdown if present
            const jsonStr = responseText.replace(/```json/g, '').replace(/```/g, '').trim();
            const parsedRaw = JSON.parse(jsonStr);
            const parsed = Array.isArray(parsedRaw) ? (parsedRaw[0] || {}) : parsedRaw;

            setOcrPreview({
                customerName: parsed.customerName,
                phone: parsed.phone,
                preInfo: parsed.summary,
                isNew: true,
                isViewed: false, // [Restore] Keep as false so "New UI" (Badge) appears
                caseType: '개인회생', // Default
                inboundPath: 'OCR업로드',
                partnerId: ocrPartnerId,
                managerName: localStorage.getItem('managerName') || '미지정' // [Fix] Assign to self to prevent Popup notification
            });

        } catch (e: any) {
            console.error(e);
            if (e instanceof AiProxyError) {
                showToast(e.message, 'error');
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
            const { inserted } = await executeBatchImport(
                [ocrPreview],
                'AI_OCR',
                ocrFile?.name
            );
            showToast(`AI 인식 케이스가 등록되었습니다 (${inserted}건).`, 'success');
            onSuccess();
            onClose();
        } catch (e: any) {
            showToast(e.message || '등록 실패', 'error');
        } finally {
            setIsLoading(false);
        }
    };


    // --- Manual Logic ---


    const handleManualChange = (field: string, value: string) => {
        if (field === 'phone') {
            value = formatPhone(value);
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
            const { inserted } = await executeBatchImport(
                [manualForm],
                '간편수기'
            );
            showToast(`케이스가 등록되었습니다 (${inserted}건).`, 'success');

            // Clear Draft on Success
            sessionStorage.removeItem('lm_manual_draft');
            setManualForm({
                customerName: '',
                phone: '',
                partnerId: partners?.[0]?.partnerId || '',
                inboundPath: selectedVendor || inboundPaths?.[0] || '',
                caseType: '개인회생',
                preInfo: ''
            });

            onSuccess();
            onClose();
        } catch (e: any) {
            showToast(e.message || '등록 실패', 'error');
        } finally {
            setIsLoading(false);
        }
    };

    // --- Sheet Logic ---
    const SHEET_COLUMNS: (keyof SheetRow)[] = ['customerName', 'phone', 'caseType', 'inboundPath', 'preInfo'];

    const handleSheetCellChange = (rowIdx: number, field: keyof SheetRow, value: string) => {
        if (field === 'phone') value = formatPhone(value);
        if (field === 'inboundPath') {
            const alias = INBOUND_PATH_ALIASES[value.trim().toLowerCase()];
            if (alias) value = alias;
        }
        setSheetRows(prev => {
            const next = [...prev];
            next[rowIdx] = { ...next[rowIdx], [field]: value };
            return next;
        });
    };

    const handleSheetPaste = (e: React.ClipboardEvent, startRowIdx: number, startColIdx: number) => {
        const paste = e.clipboardData.getData('text');
        if (!paste.includes('\t') && !paste.includes('\n')) return; // 단일 셀은 기본 동작
        e.preventDefault();
        const lines = paste.split('\n').filter(l => l.trim());

        setSheetRows(prev => {
            const next = [...prev];
            lines.forEach((line, ri) => {
                const cells = line.split('\t');
                const targetRow = startRowIdx + ri;
                while (next.length <= targetRow) next.push({
                    customerName: '', phone: '', caseType: '개인회생',
                    inboundPath: inboundPaths?.[0] || '', preInfo: ''
                });
                cells.forEach((cell, ci) => {
                    const targetCol = SHEET_COLUMNS[startColIdx + ci];
                    if (!targetCol) return;
                    let value = cell.trim();
                    if (targetCol === 'phone') value = formatPhone(value);
                    if (targetCol === 'inboundPath') {
                        value = INBOUND_PATH_ALIASES[value.toLowerCase()] || value;
                    }
                    next[targetRow] = { ...next[targetRow], [targetCol]: value };
                });
            });
            return next;
        });
    };

    const addSheetRow = () => {
        setSheetRows(prev => [...prev, {
            customerName: '', phone: '', caseType: '개인회생',
            inboundPath: inboundPaths?.[0] || '', preInfo: ''
        }]);
    };

    const removeSheetRow = (idx: number) => {
        setSheetRows(prev => prev.length <= 1 ? prev : prev.filter((_, i) => i !== idx));
    };

    const getSheetFilledRows = () => sheetRows.filter(r => r.customerName.trim() || r.phone.trim());
    const getSheetDuplicates = () => {
        const filled = getSheetFilledRows();
        return filled.filter(r => r.phone && checkIsDuplicate(formatPhone(r.phone), existingCases));
    };

    const submitSheet = async () => {
        const filledRows = getSheetFilledRows();
        if (filledRows.length === 0) {
            showToast('입력된 데이터가 없습니다.', 'error');
            return;
        }
        const casesToCreate = filledRows.map(r => ({
            ...r,
            phone: formatPhone(r.phone),
        }));
        setIsLoading(true);
        try {
            const { inserted, skipped } = await executeBatchImport(
                casesToCreate,
                '시트입력'
            );
            let message = `${inserted}건이 등록되었습니다.`;
            if (skipped > 0) message += ` (중복 ${skipped}건 제외)`;
            showToast(message, 'success');
            onSuccess();
            onClose();
        } catch (e: any) {
            showToast(e.message || '일괄 등록 중 오류가 발생했습니다.', 'error');
        } finally {
            setIsLoading(false);
        }
    };

    return (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4 backdrop-blur-sm">
            <div className={`bg-white rounded-xl shadow-2xl w-full ${activeTab === 'sheet' ? 'max-w-5xl' : 'max-w-3xl'} max-h-[90vh] overflow-hidden flex flex-col transition-all duration-300`}>
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

                {/* [030] DB 거래처(공급사) & 회차 매입 비용 관제 헤더 바 */}
                <div className="bg-gradient-to-r from-indigo-50/80 via-blue-50/50 to-indigo-50/80 dark:from-indigo-950/40 dark:via-gray-850 dark:to-indigo-950/40 border-b border-indigo-100 dark:border-indigo-900/50 p-4">
                    <div className="space-y-3">
                        {/* 1행: 거래처 타이틀 & 빠른 거래처 관리 버튼 */}
                        <div className="flex flex-wrap items-center justify-between gap-2">
                            <div className="flex items-center gap-2">
                                <div className="w-6 h-6 rounded-md bg-indigo-600 text-white flex items-center justify-center text-xs font-bold shadow-2xs">
                                    <Building2 size={14} />
                                </div>
                                <span className="text-xs font-bold text-gray-900 dark:text-white">
                                    DB 거래처(공급사) 선택
                                </span>
                                <span className="text-[11px] text-indigo-600 dark:text-indigo-400 font-medium">
                                    * 회차 품질·전환율 및 ROI 관제 집계의 기준이 됩니다.
                                </span>
                            </div>
                            <button
                                type="button"
                                onClick={() => setIsVendorManageOpen(true)}
                                className="inline-flex items-center gap-1 text-[11px] font-semibold text-indigo-600 dark:text-indigo-400 hover:text-indigo-700 bg-white dark:bg-gray-800 px-2.5 py-1 rounded-md border border-indigo-200 dark:border-indigo-800 shadow-2xs hover:bg-indigo-50 transition-colors"
                            >
                                <Plus size={12} /> 거래처 추가/관리
                            </button>
                        </div>

                        {/* 2행: 거래처 선택 드롭다운 + 인기/최근 거래처 칩 */}
                        <div className="flex flex-wrap items-center gap-2">
                            <select
                                value={selectedVendor}
                                onChange={(e) => handleSelectVendor(e.target.value)}
                                className="px-3 py-1.5 text-xs font-medium rounded-lg border border-indigo-200 dark:border-indigo-800 bg-white dark:bg-gray-800 text-gray-900 dark:text-white focus:ring-2 focus:ring-indigo-500 min-w-[200px]"
                            >
                                {vendors.map((v) => (
                                    <option key={v.id} value={v.name}>
                                        {v.name} (단가: ₩{v.defaultUnitCost.toLocaleString()})
                                    </option>
                                ))}
                                <option value="직접 등록/미지정">직접 등록/미지정</option>
                            </select>

                            {/* 빠른 선택 칩 */}
                            <div className="flex flex-wrap items-center gap-1.5">
                                {vendors.slice(0, 4).map((v) => (
                                    <button
                                        key={v.id}
                                        type="button"
                                        onClick={() => handleSelectVendor(v.name)}
                                        className={`text-[11px] px-2.5 py-1 rounded-full font-medium transition-all ${
                                            selectedVendor === v.name
                                                ? 'bg-indigo-600 text-white shadow-2xs font-bold'
                                                : 'bg-white dark:bg-gray-800 text-indigo-700 dark:text-indigo-300 border border-indigo-200 dark:border-indigo-800 hover:bg-indigo-100/60'
                                        }`}
                                    >
                                        {v.name}
                                    </button>
                                ))}
                            </div>
                        </div>

                        {/* 3행: 회차명 & 매입 정산 방식(CPL vs 3000건에 50만원 패키지) 스마트 계산기 */}
                        <div className="space-y-2 pt-1 border-t border-indigo-100/60 dark:border-indigo-900/30">
                            <div className="grid grid-cols-1 sm:grid-cols-12 gap-2.5 items-end">
                                <div className="sm:col-span-5">
                                    <label className="block text-[11px] font-semibold text-gray-700 dark:text-gray-300 mb-0.5">
                                        회차명 (Batch Name)
                                    </label>
                                    <input
                                        type="text"
                                        value={batchName}
                                        onChange={(e) => setBatchName(e.target.value)}
                                        placeholder="예: 2026.11.11 1차 (패스트애드)"
                                        className="w-full px-2.5 py-1.5 text-xs rounded-lg border border-indigo-200 dark:border-indigo-800 bg-white dark:bg-gray-800 text-gray-900 dark:text-white focus:ring-2 focus:ring-indigo-500"
                                    />
                                </div>

                                {/* 정산 방식 토글 (건당 CPL vs 대량 패키지) */}
                                <div className="sm:col-span-3">
                                    <label className="block text-[11px] font-semibold text-gray-700 dark:text-gray-300 mb-0.5">
                                        정산 방식
                                    </label>
                                    <div className="grid grid-cols-2 gap-1 p-0.5 bg-gray-200 dark:bg-gray-700 rounded-lg text-[11px]">
                                        <button
                                            type="button"
                                            onClick={() => setPricingMode('cpl')}
                                            className={`py-1 rounded-md font-semibold transition-all ${
                                                pricingMode === 'cpl'
                                                    ? 'bg-white dark:bg-gray-800 text-indigo-600 dark:text-indigo-400 shadow-2xs'
                                                    : 'text-gray-600 dark:text-gray-300'
                                            }`}
                                        >
                                            건당 CPL
                                        </button>
                                        <button
                                            type="button"
                                            onClick={() => {
                                                setPricingMode('package');
                                                const u = pkgLeads > 0 && pkgPrice > 0 ? Math.round(pkgPrice / pkgLeads) : 0;
                                                setUnitCost(u);
                                                setTotalCost(pkgPrice);
                                            }}
                                            className={`py-1 rounded-md font-semibold transition-all ${
                                                pricingMode === 'package'
                                                    ? 'bg-white dark:bg-gray-800 text-indigo-600 dark:text-indigo-400 shadow-2xs'
                                                    : 'text-gray-600 dark:text-gray-300'
                                            }`}
                                        >
                                            📦 패키지
                                        </button>
                                    </div>
                                </div>

                                {pricingMode === 'cpl' ? (
                                    <>
                                        <div className="sm:col-span-2">
                                            <label className="block text-[11px] font-semibold text-gray-700 dark:text-gray-300 mb-0.5">
                                                건당 단가 (CPL)
                                            </label>
                                            <div className="relative">
                                                <input
                                                    type="number"
                                                    min="0"
                                                    step="1000"
                                                    value={unitCost}
                                                    onChange={(e) => {
                                                        const val = Number(e.target.value);
                                                        setUnitCost(val);
                                                        setTotalCost(0);
                                                    }}
                                                    className="w-full pl-5 pr-1.5 py-1.5 text-xs rounded-lg border border-indigo-200 dark:border-indigo-800 bg-white dark:bg-gray-800 text-gray-900 dark:text-white font-semibold"
                                                />
                                                <span className="absolute left-1.5 top-1.5 text-xs text-gray-400">₩</span>
                                            </div>
                                        </div>

                                        <div className="sm:col-span-2">
                                            <label className="block text-[11px] font-semibold text-gray-700 dark:text-gray-300 mb-0.5">
                                                총 매입 결제액
                                            </label>
                                            <div className="relative">
                                                <input
                                                    type="number"
                                                    min="0"
                                                    step="10000"
                                                    value={totalCost > 0 ? totalCost : (unitCost > 0 && (
                                                        activeTab === 'excel' ? excelPreview.filter(c => !c.duplicateInfo).length :
                                                        activeTab === 'sheet' ? getSheetFilledRows().length :
                                                        activeTab === 'ocr' ? (ocrPreview ? 1 : 0) : 1
                                                    ) * unitCost || 0)}
                                                    onChange={(e) => setTotalCost(Number(e.target.value))}
                                                    placeholder="자동 계산"
                                                    className="w-full pl-5 pr-1.5 py-1.5 text-xs rounded-lg border border-indigo-200 dark:border-indigo-800 bg-white dark:bg-gray-800 text-gray-900 dark:text-white font-semibold"
                                                />
                                                <span className="absolute left-1.5 top-1.5 text-xs text-gray-400">₩</span>
                                            </div>
                                        </div>
                                    </>
                                ) : (
                                    <>
                                        <div className="sm:col-span-2">
                                            <label className="block text-[11px] font-semibold text-gray-700 dark:text-gray-300 mb-0.5">
                                                공급 수량 (건)
                                            </label>
                                            <input
                                                type="number"
                                                min="1"
                                                step="100"
                                                value={pkgLeads}
                                                onChange={(e) => {
                                                    const l = Math.max(1, Number(e.target.value));
                                                    setPkgLeads(l);
                                                    const u = Math.round(pkgPrice / l);
                                                    setUnitCost(u);
                                                    setTotalCost(pkgPrice);
                                                }}
                                                className="w-full px-2 py-1.5 text-xs rounded-lg border border-indigo-200 dark:border-indigo-800 bg-white dark:bg-gray-800 text-gray-900 dark:text-white font-bold"
                                            />
                                        </div>

                                        <div className="sm:col-span-2">
                                            <label className="block text-[11px] font-semibold text-gray-700 dark:text-gray-300 mb-0.5">
                                                패키지 총액 (원)
                                            </label>
                                            <div className="relative">
                                                <input
                                                    type="number"
                                                    min="0"
                                                    step="10000"
                                                    value={pkgPrice}
                                                    onChange={(e) => {
                                                        const p = Math.max(0, Number(e.target.value));
                                                        setPkgPrice(p);
                                                        const u = pkgLeads > 0 ? Math.round(p / pkgLeads) : 0;
                                                        setUnitCost(u);
                                                        setTotalCost(p);
                                                    }}
                                                    className="w-full pl-5 pr-1.5 py-1.5 text-xs rounded-lg border border-indigo-200 dark:border-indigo-800 bg-white dark:bg-gray-800 text-gray-900 dark:text-white font-bold"
                                                />
                                                <span className="absolute left-1.5 top-1.5 text-xs text-gray-400">₩</span>
                                            </div>
                                        </div>
                                    </>
                                )}
                            </div>

                            {/* 패키지 모드 환산 안내 배너 */}
                            {pricingMode === 'package' && (
                                <div className="flex items-center justify-between text-[11px] px-2.5 py-1 rounded-md bg-indigo-100/70 dark:bg-indigo-900/40 text-indigo-900 dark:text-indigo-200 font-medium">
                                    <span>
                                        📦 대량 패키지 적용: <strong>{pkgLeads.toLocaleString()}건</strong>에 <strong>₩{pkgPrice.toLocaleString()}원</strong>
                                    </span>
                                    <span className="font-bold text-indigo-700 dark:text-indigo-300">
                                        👉 1건당 환산 단가: ₩{(pkgLeads > 0 ? Math.round(pkgPrice / pkgLeads) : 0).toLocaleString()}원
                                    </span>
                                </div>
                            )}
                        </div>
                    </div>
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
                        onClick={() => setActiveTab('sheet')}
                        className={`flex-1 py-3 text-sm font-medium border-b-2 transition-colors ${activeTab === 'sheet' ? 'border-purple-600 text-purple-600 bg-purple-50/50' : 'border-transparent text-gray-500 hover:bg-gray-50'}`}
                    >
                        <div className="flex items-center justify-center gap-2">
                            <Grid size={16} /> 시트 입력
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

                    {activeTab === 'sheet' && (
                        <div className="space-y-4">
                            <div className="bg-purple-50 p-3 rounded-lg text-sm text-purple-800 border border-purple-100">
                                <h4 className="font-bold mb-1 flex items-center gap-2"><Grid size={14} /> 시트 빠른 입력</h4>
                                <p className="opacity-80 text-xs">표에 직접 입력하거나, 엑셀에서 복사(Ctrl+C)한 데이터를 셀에 붙여넣기(Ctrl+V) 하세요.</p>
                            </div>

                            <div className="border rounded-lg overflow-hidden">
                                <div className="overflow-x-auto">
                                    <table ref={sheetRef} className="w-full text-sm border-collapse">
                                        <thead>
                                            <tr className="bg-gray-100">
                                                <th className="p-2 text-left text-xs font-bold text-gray-600 border-r w-8">#</th>
                                                <th className="p-2 text-left text-xs font-bold text-gray-600 border-r min-w-[100px]">고객명 <span className="text-red-500">*</span></th>
                                                <th className="p-2 text-left text-xs font-bold text-gray-600 border-r min-w-[130px]">연락처 <span className="text-red-500">*</span></th>
                                                <th className="p-2 text-left text-xs font-bold text-gray-600 border-r min-w-[100px]">유형</th>
                                                <th className="p-2 text-left text-xs font-bold text-gray-600 border-r min-w-[100px]">유입경로</th>
                                                <th className="p-2 text-left text-xs font-bold text-gray-600 border-r min-w-[140px]">사전정보</th>
                                                <th className="p-2 w-8"></th>
                                            </tr>
                                        </thead>
                                        <tbody>
                                            {sheetRows.map((row, rowIdx) => {
                                                const isDup = row.phone.trim() && checkIsDuplicate(formatPhone(row.phone), existingCases);
                                                return (
                                                    <tr key={rowIdx} className={`border-t ${isDup ? 'bg-red-50' : 'hover:bg-gray-50'} transition-colors`}>
                                                        <td className="p-1 text-center text-xs text-gray-400 border-r">{rowIdx + 1}</td>
                                                        <td className="p-0.5 border-r">
                                                            <input
                                                                className="w-full px-2 py-1.5 text-sm border-0 outline-none bg-transparent focus:bg-white focus:ring-1 focus:ring-purple-400 rounded"
                                                                placeholder="이름"
                                                                value={row.customerName}
                                                                onChange={e => handleSheetCellChange(rowIdx, 'customerName', e.target.value)}
                                                                onPaste={e => handleSheetPaste(e, rowIdx, 0)}
                                                            />
                                                        </td>
                                                        <td className="p-0.5 border-r">
                                                            <input
                                                                className={`w-full px-2 py-1.5 text-sm border-0 outline-none bg-transparent focus:bg-white focus:ring-1 focus:ring-purple-400 rounded ${isDup ? 'text-red-600 font-bold' : ''}`}
                                                                placeholder="010-0000-0000"
                                                                value={row.phone}
                                                                onChange={e => handleSheetCellChange(rowIdx, 'phone', e.target.value)}
                                                                onPaste={e => handleSheetPaste(e, rowIdx, 1)}
                                                            />
                                                        </td>
                                                        <td className="p-0.5 border-r">
                                                            <select
                                                                className="w-full px-1 py-1.5 text-sm border-0 outline-none bg-transparent focus:bg-white focus:ring-1 focus:ring-purple-400 rounded cursor-pointer"
                                                                value={row.caseType}
                                                                onChange={e => handleSheetCellChange(rowIdx, 'caseType', e.target.value)}
                                                            >
                                                                {CASE_TYPES.map(t => <option key={t} value={t}>{t}</option>)}
                                                            </select>
                                                        </td>
                                                        <td className="p-0.5 border-r">
                                                            <select
                                                                className="w-full px-1 py-1.5 text-sm border-0 outline-none bg-transparent focus:bg-white focus:ring-1 focus:ring-purple-400 rounded cursor-pointer"
                                                                value={row.inboundPath}
                                                                onChange={e => handleSheetCellChange(rowIdx, 'inboundPath', e.target.value)}
                                                            >
                                                                <option value="">선택</option>
                                                                {inboundPaths.map(p => <option key={p} value={p}>{p}</option>)}
                                                            </select>
                                                        </td>
                                                        <td className="p-0.5 border-r">
                                                            <input
                                                                className="w-full px-2 py-1.5 text-sm border-0 outline-none bg-transparent focus:bg-white focus:ring-1 focus:ring-purple-400 rounded"
                                                                placeholder="메모"
                                                                value={row.preInfo}
                                                                onChange={e => handleSheetCellChange(rowIdx, 'preInfo', e.target.value)}
                                                                onPaste={e => handleSheetPaste(e, rowIdx, 4)}
                                                            />
                                                        </td>
                                                        <td className="p-0.5 text-center">
                                                            <button
                                                                onClick={() => removeSheetRow(rowIdx)}
                                                                className="p-1 text-gray-300 hover:text-red-500 transition-colors rounded hover:bg-red-50"
                                                                title="행 삭제"
                                                            >
                                                                <Trash2 size={14} />
                                                            </button>
                                                        </td>
                                                    </tr>
                                                );
                                            })}
                                        </tbody>
                                    </table>
                                </div>
                            </div>

                            <div className="flex items-center justify-between">
                                <button
                                    onClick={addSheetRow}
                                    className="text-sm text-purple-600 hover:text-purple-800 font-medium flex items-center gap-1 hover:bg-purple-50 px-3 py-1.5 rounded-lg transition-colors"
                                >
                                    <Plus size={14} /> 행 추가
                                </button>
                                <div className="text-xs text-gray-500">
                                    {getSheetFilledRows().length}건 입력됨
                                    {getSheetDuplicates().length > 0 && (
                                        <span className="text-red-500 ml-2 font-bold">⚠️ 중복 {getSheetDuplicates().length}건</span>
                                    )}
                                </div>
                            </div>

                            {getSheetFilledRows().length > 0 && (
                                <button
                                    onClick={submitSheet}
                                    disabled={isLoading}
                                    className="w-full py-3 bg-purple-600 text-white rounded-lg font-bold text-lg hover:bg-purple-700 shadow-md flex items-center justify-center gap-2 disabled:opacity-50 transition-colors"
                                >
                                    {isLoading ? <Loader2 className="animate-spin" /> : <Check size={20} />}
                                    {getSheetFilledRows().length - getSheetDuplicates().length}건 일괄 등록하기
                                </button>
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
                                </div>
                            </div>

                            {/* [Enhanced] Duplicate Warning - Matches NewCase.tsx style */}
                            {manualDuplicate && (
                                <div className="mb-2 animate-pulse">
                                    <div className="bg-red-50 border border-red-200 rounded-lg p-3 text-sm flex flex-col gap-1">
                                        <div className="flex items-center gap-2 text-red-700 font-bold">
                                            <span className="text-lg">⚠️</span> 이미 등록된 연락처입니다!
                                        </div>
                                        <div className="text-gray-600 pl-7 text-xs">
                                            <p>등록된 고객명: <b>{manualDuplicate.customerName}</b></p>
                                            <p>담당자: <b>{manualDuplicate.managerName}</b></p>
                                            <p>현재 상태: <span className="font-medium text-red-600">{manualDuplicate.status}</span></p>
                                        </div>
                                    </div>
                                </div>
                            )}

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
            {/* 거래처 추가/관리 모달 */}
            <VendorManageModal
                isOpen={isVendorManageOpen}
                onClose={() => setIsVendorManageOpen(false)}
                onUpdated={loadVendorList}
            />
        </div>
    );
}
