import React, { useState, useRef } from 'react';
import * as XLSX from 'xlsx';
import { Download, Upload, FileText, Image as ImageIcon, X, Plus, AlertCircle, Check, Loader2, List, Sparkles, Grid, Trash2, Building2, DollarSign, Layers } from 'lucide-react';
import { LeadVendor, fetchLeadVendors } from '../services/vendor';
import { createImportBatch, updateImportBatch } from '../services/distribution';
import { VendorManageModal } from './team/VendorManageModal';
import { batchCreateCases, fetchPartners, fetchInboundPaths, createCase, fetchCases } from '../services/api';
import { Partner, Case } from '../types';
import { useToast } from '../contexts/ToastContext';
import { useAuth } from '../contexts/AuthContext';
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
    const { isAdmin } = useAuth();
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

    // [보안 가드 & 닫힘 상태 방어] 모든 Hooks 선언 완료 후 조건부 렌더링 (Rules of Hooks 준수)
    if (!isAdmin || !isOpen) return null;

    // Safety check for critical resources
    if (!partners || !Array.isArray(partners) || !inboundPaths || !Array.isArray(inboundPaths)) {
        return (
            <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4 backdrop-blur-sm">
                <div className="bg-white rounded-xl shadow-2xl p-8 flex flex-col items-center gap-4">
                    <Loader2 className="animate-spin text-blue-600" size={32} />
                    <p className="text-gray-600 font-medium">기초 데이터를 불러오는 중입니다...</p>
                    <button onClick={onClose} className="text-sm text-gray-500 dark:text-gray-400 hover:text-gray-600 underline">
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
            // [KIRO 2026-11-13] 파일에 적힌 유입경로를 우선 (예전엔 공급처 이름으로 전부 덮어씀)
            inboundPath: c.inboundPath || selectedVendor.trim() || 'DB',
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
        <div className="fixed inset-0 bg-background/80 flex items-center justify-center z-50 p-3 sm:p-5 backdrop-blur-xs animate-in fade-in duration-200 overflow-y-auto">
            <div className={`relative bg-card text-card-foreground rounded-2xl shadow-2xl border border-border w-full ${activeTab === 'sheet' ? 'max-w-5xl' : 'max-w-3xl'} max-h-[88vh] my-auto overflow-hidden flex flex-col transition-all duration-300`}>
                {/* Header (고정) */}
                <div className="px-5 sm:px-6 py-4 border-b border-border flex justify-between items-center bg-card shrink-0">
                    <h2 className="text-base font-bold text-foreground flex items-center gap-2.5">
                        <div className="w-8 h-8 rounded-lg bg-primary/10 border border-primary/20 text-primary flex items-center justify-center shrink-0">
                            <Upload size={17} strokeWidth={1.75} />
                        </div>
                        <span>케이스 일괄/간편 등록</span>
                    </h2>
                    <button onClick={onClose} className="p-1.5 text-muted-foreground hover:text-foreground hover:bg-muted rounded-lg transition-colors cursor-pointer">
                        <X size={20} />
                    </button>
                </div>

                {/* [030] DB 거래처(공급사) & 회차 매입 비용 관제 헤더 바 */}
                <div className="bg-muted/30 border-b border-border p-4 sm:p-5 space-y-3 shrink-0">
                    {/* 1행: 거래처 타이틀 & 빠른 거래처 관리 버튼 */}
                    <div className="flex flex-wrap items-center justify-between gap-2">
                        <div className="flex items-center gap-2">
                            <div className="w-6 h-6 rounded-md bg-primary/10 text-primary border border-primary/20 flex items-center justify-center text-xs font-bold shadow-2xs">
                                <Building2 size={13} strokeWidth={1.75} />
                            </div>
                            <span className="text-xs font-bold text-foreground">
                                DB 거래처(공급사) 선택
                            </span>
                            <span className="text-2xs text-muted-foreground font-medium">
                                * 회차 품질·전환율 및 ROI 관제 집계의 기준이 됩니다.
                            </span>
                        </div>
                        <button
                            type="button"
                            onClick={() => setIsVendorManageOpen(true)}
                            className="inline-flex items-center gap-1 text-xs font-semibold text-foreground hover:text-primary bg-card hover:bg-muted px-2.5 py-1 rounded-md border border-border shadow-2xs transition-colors cursor-pointer"
                        >
                            <Plus size={12} /> 거래처 추가/관리
                        </button>
                    </div>

                    {/* 2행: 거래처 선택 드롭다운 + 인기/최근 거래처 칩 */}
                    <div className="flex flex-wrap items-center gap-2">
                        <select
                            value={selectedVendor}
                            onChange={(e) => handleSelectVendor(e.target.value)}
                            className="px-3 py-1.5 text-xs font-medium rounded-lg border border-input bg-background text-foreground focus:ring-1 focus:ring-primary focus:border-primary min-w-[200px]"
                        >
                            {vendors.map((v) => (
                                <option key={v.id} value={v.name}>
                                    {v.name} (단가: ₩ {v.defaultUnitCost.toLocaleString()}원)
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
                                    className={`text-xs px-2.5 py-1 rounded-md font-medium transition-all cursor-pointer ${
                                        selectedVendor === v.name
                                            ? 'bg-primary text-primary-foreground font-bold shadow-2xs'
                                            : 'bg-card text-muted-foreground border border-border hover:bg-muted hover:text-foreground'
                                    }`}
                                >
                                    {v.name}
                                </button>
                            ))}
                        </div>
                    </div>

                    {/* 3행: 회차명 & 매입 정산 방식(CPL vs 3000건에 50만원 패키지) 스마트 계산기 */}
                    <div className="pt-2 border-t border-border/60">
                        <div className="grid grid-cols-1 sm:grid-cols-12 gap-2.5 items-end">
                            <div className="sm:col-span-5">
                                <label className="block text-2xs font-semibold text-muted-foreground mb-1">
                                    회차명 (Batch Name)
                                </label>
                                <input
                                    type="text"
                                    value={batchName}
                                    onChange={(e) => setBatchName(e.target.value)}
                                    placeholder="예: 2026. 11. 23. 1차 (메타)"
                                    className="w-full px-2.5 py-1.5 text-xs rounded-lg border border-input bg-background text-foreground font-medium focus:ring-1 focus:ring-primary focus:border-primary"
                                />
                            </div>

                            {/* 정산 방식 토글 (건당 CPL vs 대량 패키지) */}
                            <div className="sm:col-span-3">
                                <label className="block text-2xs font-semibold text-muted-foreground mb-1">
                                    정산 방식
                                </label>
                                <div className="grid grid-cols-2 gap-1 p-0.5 bg-muted rounded-lg border border-border text-xs">
                                    <button
                                        type="button"
                                        onClick={() => {
                                            setPricingMode('cpl');
                                            const match = vendors.find(v => v.name === selectedVendor);
                                            setUnitCost(match?.defaultUnitCost || 25000);
                                            setTotalCost(0);
                                        }}
                                        className={`py-1 text-2xs rounded-md font-semibold transition-all cursor-pointer ${
                                            pricingMode === 'cpl'
                                                ? 'bg-background text-primary font-bold shadow-2xs'
                                                : 'text-muted-foreground hover:text-foreground'
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
                                        className={`py-1 text-2xs rounded-md font-semibold transition-all cursor-pointer ${
                                            pricingMode === 'package'
                                                ? 'bg-background text-primary font-bold shadow-2xs'
                                                : 'text-muted-foreground hover:text-foreground'
                                        }`}
                                    >
                                        📦 패키지
                                    </button>
                                </div>
                            </div>

                            {pricingMode === 'cpl' ? (
                                <>
                                    <div className="sm:col-span-2">
                                        <label className="block text-2xs font-semibold text-muted-foreground mb-1">
                                            건당 단가 (CPL)
                                        </label>
                                        <div className="relative">
                                            <input
                                                type="number"
                                                min="0"
                                                step="1"
                                                value={unitCost}
                                                onChange={(e) => {
                                                    const val = Number(e.target.value);
                                                    setUnitCost(val);
                                                    setTotalCost(0);
                                                }}
                                                className="w-full pl-5 pr-1.5 py-1.5 text-xs rounded-lg border border-input bg-background text-foreground font-semibold tabular-nums"
                                            />
                                            <span className="absolute left-1.5 top-1.5 text-xs text-muted-foreground">₩</span>
                                        </div>
                                    </div>

                                    <div className="sm:col-span-2">
                                        <label className="block text-2xs font-semibold text-muted-foreground mb-1">
                                            총 매입 결제액
                                        </label>
                                        <div className="relative">
                                            <input
                                                type="number"
                                                min="0"
                                                step="1"
                                                value={totalCost > 0 ? totalCost : (unitCost > 0 && (
                                                    activeTab === 'excel' ? excelPreview.filter(c => !c.duplicateInfo).length :
                                                    activeTab === 'sheet' ? getSheetFilledRows().length :
                                                    activeTab === 'ocr' ? (ocrPreview ? 1 : 0) : 1
                                                ) * unitCost || 0)}
                                                onChange={(e) => setTotalCost(Number(e.target.value))}
                                                placeholder="자동 계산"
                                                className="w-full pl-5 pr-1.5 py-1.5 text-xs rounded-lg border border-input bg-background text-foreground font-semibold tabular-nums"
                                            />
                                            <span className="absolute left-1.5 top-1.5 text-xs text-muted-foreground">₩</span>
                                        </div>
                                    </div>
                                </>
                            ) : (
                                <>
                                    <div className="sm:col-span-2">
                                        <label className="block text-2xs font-semibold text-muted-foreground mb-1">
                                            공급 수량 (건)
                                        </label>
                                        <input
                                            type="number"
                                            min="1"
                                            step="1"
                                            value={pkgLeads}
                                            onChange={(e) => {
                                                const l = Math.max(1, Number(e.target.value));
                                                setPkgLeads(l);
                                                const u = Math.round(pkgPrice / l);
                                                setUnitCost(u);
                                                setTotalCost(pkgPrice);
                                            }}
                                            className="w-full px-2 py-1.5 text-xs rounded-lg border border-input bg-background text-foreground font-bold tabular-nums"
                                        />
                                    </div>

                                    <div className="sm:col-span-2">
                                        <label className="block text-2xs font-semibold text-muted-foreground mb-1">
                                            패키지 총액 (원)
                                        </label>
                                        <div className="relative">
                                            <input
                                                type="number"
                                                min="0"
                                                step="1"
                                                value={pkgPrice}
                                                onChange={(e) => {
                                                    const p = Math.max(0, Number(e.target.value));
                                                    setPkgPrice(p);
                                                    const u = pkgLeads > 0 ? Math.round(p / pkgLeads) : 0;
                                                    setUnitCost(u);
                                                    setTotalCost(p);
                                                }}
                                                className="w-full pl-5 pr-1.5 py-1.5 text-xs rounded-lg border border-input bg-background text-foreground font-bold tabular-nums"
                                            />
                                            <span className="absolute left-1.5 top-1.5 text-xs text-muted-foreground">₩</span>
                                        </div>
                                    </div>
                                </>
                            )}
                        </div>

                        {/* 패키지 모드 환산 안내 배너 */}
                        {pricingMode === 'package' && (
                            <div className="mt-2 flex items-center justify-between text-2xs px-3 py-1.5 rounded-md bg-primary/5 border border-primary/20 text-foreground font-medium">
                                <span>
                                    📦 대량 패키지 적용: <strong>{pkgLeads.toLocaleString()}건</strong>에 <strong>₩ {pkgPrice.toLocaleString()}원</strong>
                                </span>
                                <span className="font-bold text-primary tabular-nums">
                                    👉 1건당 환산 단가: ₩ {(pkgLeads > 0 ? Math.round(pkgPrice / pkgLeads) : 0).toLocaleString()}원
                                </span>
                            </div>
                        )}
                    </div>
                </div>

                {/* Tabs (고정) */}
                <div className="flex border-b border-border bg-card shrink-0">
                    <button
                        onClick={() => setActiveTab('excel')}
                        className={`flex-1 py-3 text-xs sm:text-sm font-semibold border-b-2 transition-colors cursor-pointer ${
                            activeTab === 'excel'
                                ? 'border-primary text-primary bg-primary/5'
                                : 'border-transparent text-muted-foreground hover:text-foreground hover:bg-muted/50'
                        }`}
                    >
                        <div className="flex items-center justify-center gap-2">
                            <FileText size={15} /> 엑셀 대량 업로드
                        </div>
                    </button>
                    <button
                        onClick={() => setActiveTab('ocr')}
                        className={`flex-1 py-3 text-xs sm:text-sm font-semibold border-b-2 transition-colors cursor-pointer ${
                            activeTab === 'ocr'
                                ? 'border-primary text-primary bg-primary/5'
                                : 'border-transparent text-muted-foreground hover:text-foreground hover:bg-muted/50'
                        }`}
                    >
                        <div className="flex items-center justify-center gap-2">
                            <ImageIcon size={15} /> 이미지/PDF 인식 (AI)
                        </div>
                    </button>
                    <button
                        onClick={() => setActiveTab('sheet')}
                        className={`flex-1 py-3 text-xs sm:text-sm font-semibold border-b-2 transition-colors cursor-pointer ${
                            activeTab === 'sheet'
                                ? 'border-primary text-primary bg-primary/5'
                                : 'border-transparent text-muted-foreground hover:text-foreground hover:bg-muted/50'
                        }`}
                    >
                        <div className="flex items-center justify-center gap-2">
                            <Grid size={15} /> 시트 입력
                        </div>
                    </button>
                    <button
                        onClick={() => setActiveTab('manual')}
                        className={`flex-1 py-3 text-xs sm:text-sm font-semibold border-b-2 transition-colors cursor-pointer ${
                            activeTab === 'manual'
                                ? 'border-primary text-primary bg-primary/5'
                                : 'border-transparent text-muted-foreground hover:text-foreground hover:bg-muted/50'
                        }`}
                    >
                        <div className="flex items-center justify-center gap-2">
                            <List size={15} /> 간편 수기 등록
                        </div>
                    </button>
                </div>

                {/* Content (스크롤) */}
                <div className="p-5 sm:p-6 overflow-y-auto flex-1 text-xs custom-scrollbar">
                    {activeTab === 'excel' && (
                        <div className="space-y-5">
                            {/* 고대비 사용 가이드 박스 */}
                            <div className="bg-muted/30 p-4 rounded-xl text-xs text-foreground border border-border space-y-2 break-keep">
                                <h4 className="font-bold flex items-center gap-2 text-primary">
                                    <AlertCircle size={15} /> 사용 가이드
                                </h4>
                                <ol className="list-decimal list-inside space-y-1 text-muted-foreground font-medium leading-relaxed">
                                    <li>템플릿 양식을 다운로드합니다.</li>
                                    <li>양식에 맞춰 고객 정보를 입력합니다. (헤더 수정 금지)</li>
                                    <li>작성된 엑셀 파일을 업로드하면 자동으로 목록이 미리보기에 나타납니다.</li>
                                    <li>[일괄 등록하기] 버튼을 눌러 저장을 완료합니다.</li>
                                </ol>
                            </div>

                            <div className="flex gap-3">
                                <button
                                    onClick={handleDownloadTemplate}
                                    className="flex-1 py-2.5 border border-border bg-card hover:bg-muted rounded-xl flex items-center justify-center gap-2 text-foreground font-semibold transition-colors cursor-pointer text-xs"
                                >
                                    <Download size={15} /> 양식 다운로드
                                </button>
                                <div className="flex-1 relative">
                                    <input
                                        type="file"
                                        accept=".xlsx, .xls"
                                        onChange={handleExcelUpload}
                                        className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
                                    />
                                    <button className="w-full h-full py-2.5 bg-primary text-primary-foreground rounded-xl flex items-center justify-center gap-2 hover:bg-primary/90 font-semibold shadow-2xs transition-colors cursor-pointer text-xs">
                                        <Upload size={15} /> 엑셀 파일 업로드
                                    </button>
                                </div>
                            </div>

                            {excelPreview.length > 0 && (
                                <div className="border border-border rounded-xl overflow-hidden bg-card">
                                    <div className="bg-muted/50 px-4 py-2 text-xs font-bold text-foreground border-b border-border flex justify-between items-center">
                                        <span>미리보기 ({excelPreview.length}건)</span>
                                        <button onClick={() => setExcelPreview([])} className="text-destructive text-xs hover:underline cursor-pointer">초기화</button>
                                    </div>
                                    <div className="max-h-48 overflow-y-auto">
                                        <table className="w-full text-xs text-left">
                                            <thead className="bg-muted sticky top-0 z-10 border-b border-border text-muted-foreground">
                                                <tr>
                                                    <th className="p-2 font-semibold">고객명</th>
                                                    <th className="p-2 font-semibold">연락처</th>
                                                    <th className="p-2 font-semibold">유형</th>
                                                </tr>
                                            </thead>
                                            <tbody className="divide-y divide-border">
                                                {excelPreview.map((item, idx) => (
                                                    <tr key={idx} className={item.duplicateInfo ? 'bg-destructive/10' : 'hover:bg-muted/30'}>
                                                        <td className="p-2 text-foreground font-medium">
                                                            {item.customerName}
                                                            {item.duplicateInfo && <span className="text-destructive text-2xs ml-1 font-bold">(중복)</span>}
                                                        </td>
                                                        <td className="p-2 text-muted-foreground font-mono">
                                                            <div className="flex flex-col">
                                                                <span>{item.phone}</span>
                                                                {item.duplicateInfo && (
                                                                    <span className="text-2xs text-destructive">
                                                                        기존: {item.duplicateInfo.managerName} ({item.duplicateInfo.status})
                                                                    </span>
                                                                )}
                                                            </div>
                                                        </td>
                                                        <td className="p-2 text-xs text-muted-foreground">{item.caseType}</td>
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
                                    className="w-full py-2.5 bg-primary hover:bg-primary/90 text-primary-foreground rounded-xl font-bold text-sm shadow-2xs flex items-center justify-center gap-2 disabled:opacity-50 transition-colors cursor-pointer"
                                >
                                    {isLoading ? <Loader2 className="animate-spin" size={16} /> : <Check size={16} />}
                                    {excelPreview.length}건 일괄 등록하기
                                </button>
                            )}
                        </div>
                    )}

                    {activeTab === 'ocr' && (
                        <div className="space-y-5">
                            <div className="bg-muted/40 p-4 rounded-xl text-xs text-foreground border border-border space-y-1.5">
                                <h4 className="font-bold flex items-center gap-2 text-primary">
                                    <Sparkles size={15} /> AI 자동 인식
                                </h4>
                                <p className="text-muted-foreground font-medium leading-relaxed">
                                    상담 신청서 이미지나 PDF 파일을 업로드하면, Gemini AI가 내용을 분석하여 자동으로 입력해줍니다.
                                </p>
                            </div>

                            <div>
                                <label className="block text-xs font-semibold text-foreground mb-1.5">적용할 거래처 (OCR 설정)</label>
                                <select
                                    className="w-full px-3 py-2 border border-input rounded-lg text-xs bg-background text-foreground"
                                    value={ocrPartnerId}
                                    onChange={e => setOcrPartnerId(e.target.value)}
                                >
                                    {partners.map(p => <option key={p.partnerId} value={p.partnerId}>{p.name}</option>)}
                                </select>
                            </div>

                            <div className="border-2 border-dashed border-border hover:border-primary/50 hover:bg-muted/20 rounded-xl p-8 text-center transition-colors group cursor-pointer relative">
                                <input
                                    type="file"
                                    accept="image/*, application/pdf"
                                    onChange={handleOcrFileChange}
                                    className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
                                />
                                <div className="flex flex-col items-center gap-2.5 text-muted-foreground group-hover:text-primary transition-colors">
                                    <div className="w-12 h-12 rounded-xl bg-primary/10 border border-primary/20 text-primary flex items-center justify-center transition-colors">
                                        <ImageIcon size={22} />
                                    </div>
                                    <p className="font-semibold text-sm text-foreground">파일을 드래그하거나 클릭하여 업로드</p>
                                    <p className="text-2xs text-muted-foreground">지원 형식: JPG, PNG, PDF</p>
                                </div>
                            </div>

                            {ocrFile && (
                                <div className="flex items-center justify-between bg-card border border-border p-3 rounded-xl shadow-2xs">
                                    <span className="text-xs font-medium text-foreground truncate max-w-[200px]">{ocrFile.name}</span>
                                    <div className="flex gap-2">
                                        <button
                                            onClick={processOcr}
                                            disabled={isLoading}
                                            className="px-3.5 py-1.5 bg-primary hover:bg-primary/90 text-primary-foreground rounded-lg text-xs font-bold disabled:opacity-50 flex items-center gap-1.5 transition-colors cursor-pointer"
                                        >
                                            {isLoading ? <Loader2 size={13} className="animate-spin" /> : <Sparkles size={13} />}
                                            분석 시작
                                        </button>
                                        <button onClick={() => { setOcrFile(null); setOcrPreview(null); }} className="p-1.5 text-muted-foreground hover:text-foreground hover:bg-muted rounded-lg transition-colors cursor-pointer">
                                            <X size={15} />
                                        </button>
                                    </div>
                                </div>
                            )}

                            {ocrPreview && (
                                <div className="bg-card border border-border rounded-xl p-4 space-y-3 shadow-2xs animate-in slide-in-from-bottom-2">
                                    <h4 className="font-bold text-foreground border-b border-border pb-2 text-xs">분석 결과 확인</h4>
                                    <div className="grid grid-cols-2 gap-3">
                                        <div>
                                            <label className="text-2xs text-muted-foreground font-semibold">고객명</label>
                                            <input
                                                className="w-full px-2.5 py-1.5 border border-input rounded-lg text-xs font-bold text-foreground bg-background"
                                                value={ocrPreview.customerName}
                                                onChange={e => setOcrPreview({ ...ocrPreview, customerName: e.target.value })}
                                            />
                                        </div>
                                        <div>
                                            <label className="text-2xs text-muted-foreground font-semibold">연락처</label>
                                            <input
                                                className="w-full px-2.5 py-1.5 border border-input rounded-lg text-xs font-bold text-foreground bg-background font-mono"
                                                value={ocrPreview.phone}
                                                onChange={e => setOcrPreview({ ...ocrPreview, phone: e.target.value })}
                                            />
                                        </div>
                                        <div className="col-span-2">
                                            <label className="text-2xs text-muted-foreground font-semibold">추출 정보 (사전정보)</label>
                                            <textarea
                                                className="w-full px-2.5 py-1.5 border border-input rounded-lg text-xs bg-background text-foreground h-20 resize-none"
                                                value={ocrPreview.preInfo}
                                                onChange={e => setOcrPreview({ ...ocrPreview, preInfo: e.target.value })}
                                            />
                                        </div>
                                    </div>
                                    <button
                                        onClick={submitOcr}
                                        disabled={isLoading}
                                        className="w-full py-2.5 bg-primary hover:bg-primary/90 text-primary-foreground rounded-xl font-bold text-xs shadow-2xs flex items-center justify-center gap-1.5 transition-colors cursor-pointer"
                                    >
                                        <Check size={16} /> 이 정보로 등록하기
                                    </button>
                                </div>
                            )}
                        </div>
                    )}

                    {activeTab === 'sheet' && (
                        <div className="space-y-4">
                            <div className="bg-muted/40 p-3.5 rounded-xl text-xs text-foreground border border-border space-y-1">
                                <h4 className="font-bold flex items-center gap-2 text-primary">
                                    <Grid size={14} /> 시트 빠른 입력
                                </h4>
                                <p className="text-muted-foreground font-medium text-2xs">표에 직접 입력하거나, 엑셀에서 복사(Ctrl+C)한 데이터를 셀에 붙여넣기(Ctrl+V) 하세요.</p>
                            </div>

                            <div className="border border-border rounded-xl overflow-hidden bg-card">
                                <div className="overflow-x-auto">
                                    <table ref={sheetRef} className="w-full text-xs border-collapse">
                                        <thead>
                                            <tr className="bg-muted/50 text-muted-foreground border-b border-border">
                                                <th className="p-2 text-left font-semibold border-r border-border w-8">#</th>
                                                <th className="p-2 text-left font-semibold border-r border-border min-w-[100px]">고객명 <span className="text-destructive">*</span></th>
                                                <th className="p-2 text-left font-semibold border-r border-border min-w-[130px]">연락처 <span className="text-destructive">*</span></th>
                                                <th className="p-2 text-left font-semibold border-r border-border min-w-[100px]">유형</th>
                                                <th className="p-2 text-left font-semibold border-r border-border min-w-[100px]">유입경로</th>
                                                <th className="p-2 text-left font-semibold border-r border-border min-w-[140px]">사전정보</th>
                                                <th className="p-2 w-8"></th>
                                            </tr>
                                        </thead>
                                        <tbody className="divide-y divide-border">
                                            {sheetRows.map((row, rowIdx) => {
                                                const isDup = row.phone.trim() && checkIsDuplicate(formatPhone(row.phone), existingCases);
                                                return (
                                                    <tr key={rowIdx} className={`border-t border-border ${isDup ? 'bg-destructive/10' : 'hover:bg-muted/30'} transition-colors`}>
                                                        <td className="p-1 text-center text-2xs text-muted-foreground border-r border-border">{rowIdx + 1}</td>
                                                        <td className="p-0.5 border-r border-border">
                                                            <input
                                                                className="w-full px-2 py-1 text-xs border-0 outline-none bg-transparent focus:bg-background focus:ring-1 focus:ring-primary rounded text-foreground font-medium"
                                                                placeholder="이름"
                                                                value={row.customerName}
                                                                onChange={e => handleSheetCellChange(rowIdx, 'customerName', e.target.value)}
                                                                onPaste={e => handleSheetPaste(e, rowIdx, 0)}
                                                            />
                                                        </td>
                                                        <td className="p-0.5 border-r border-border">
                                                            <input
                                                                className={`w-full px-2 py-1 text-xs border-0 outline-none bg-transparent focus:bg-background focus:ring-1 focus:ring-primary rounded font-mono ${isDup ? 'text-destructive font-bold' : 'text-foreground'}`}
                                                                placeholder="010-0000-0000"
                                                                value={row.phone}
                                                                onChange={e => handleSheetCellChange(rowIdx, 'phone', e.target.value)}
                                                                onPaste={e => handleSheetPaste(e, rowIdx, 1)}
                                                            />
                                                        </td>
                                                        <td className="p-0.5 border-r border-border">
                                                            <select
                                                                className="w-full px-1 py-1 text-xs border-0 outline-none bg-transparent focus:bg-background focus:ring-1 focus:ring-primary rounded cursor-pointer text-foreground"
                                                                value={row.caseType}
                                                                onChange={e => handleSheetCellChange(rowIdx, 'caseType', e.target.value)}
                                                            >
                                                                {CASE_TYPES.map(t => <option key={t} value={t}>{t}</option>)}
                                                            </select>
                                                        </td>
                                                        <td className="p-0.5 border-r border-border">
                                                            <select
                                                                className="w-full px-1 py-1 text-xs border-0 outline-none bg-transparent focus:bg-background focus:ring-1 focus:ring-primary rounded cursor-pointer text-foreground"
                                                                value={row.inboundPath}
                                                                onChange={e => handleSheetCellChange(rowIdx, 'inboundPath', e.target.value)}
                                                            >
                                                                <option value="">선택</option>
                                                                {inboundPaths.map(p => <option key={p} value={p}>{p}</option>)}
                                                            </select>
                                                        </td>
                                                        <td className="p-0.5 border-r border-border">
                                                            <input
                                                                className="w-full px-2 py-1 text-xs border-0 outline-none bg-transparent focus:bg-background focus:ring-1 focus:ring-primary rounded text-foreground"
                                                                placeholder="메모"
                                                                value={row.preInfo}
                                                                onChange={e => handleSheetCellChange(rowIdx, 'preInfo', e.target.value)}
                                                                onPaste={e => handleSheetPaste(e, rowIdx, 4)}
                                                            />
                                                        </td>
                                                        <td className="p-0.5 text-center">
                                                            <button
                                                                onClick={() => removeSheetRow(rowIdx)}
                                                                className="p-1 text-muted-foreground hover:text-destructive transition-colors rounded hover:bg-muted cursor-pointer"
                                                                title="행 삭제"
                                                            >
                                                                <Trash2 size={13} />
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
                                    className="text-xs text-foreground hover:text-primary font-semibold flex items-center gap-1 bg-card hover:bg-muted px-3 py-1.5 rounded-lg border border-border shadow-2xs transition-colors cursor-pointer"
                                >
                                    <Plus size={13} /> 행 추가
                                </button>
                                <div className="text-2xs text-muted-foreground font-medium">
                                    {getSheetFilledRows().length}건 입력됨
                                    {getSheetDuplicates().length > 0 && (
                                        <span className="text-destructive ml-2 font-bold">⚠️ 중복 {getSheetDuplicates().length}건</span>
                                    )}
                                </div>
                            </div>

                            {getSheetFilledRows().length > 0 && (
                                <button
                                    onClick={submitSheet}
                                    disabled={isLoading}
                                    className="w-full py-2.5 bg-primary hover:bg-primary/90 text-primary-foreground rounded-xl font-bold text-xs shadow-2xs flex items-center justify-center gap-2 disabled:opacity-50 transition-colors cursor-pointer"
                                >
                                    {isLoading ? <Loader2 className="animate-spin" size={16} /> : <Check size={16} />}
                                    {getSheetFilledRows().length - getSheetDuplicates().length}건 일괄 등록하기
                                </button>
                            )}
                        </div>
                    )}

                    {activeTab === 'manual' && (
                        <div className="space-y-4">
                            <div className="grid grid-cols-2 gap-3">
                                <div>
                                    <label className="block text-2xs font-semibold text-muted-foreground mb-1">거래처</label>
                                    <select
                                        className="w-full px-3 py-2 border border-input rounded-lg text-xs bg-background text-foreground"
                                        value={manualForm.partnerId}
                                        onChange={e => handleManualChange('partnerId', e.target.value)}
                                    >
                                        {partners.map(p => <option key={p.partnerId} value={p.partnerId}>{p.name}</option>)}
                                    </select>
                                </div>
                                <div>
                                    <label className="block text-2xs font-semibold text-muted-foreground mb-1">유입경로</label>
                                    <select
                                        className="w-full px-3 py-2 border border-input rounded-lg text-xs bg-background text-foreground"
                                        value={manualForm.inboundPath}
                                        onChange={e => handleManualChange('inboundPath', e.target.value)}
                                    >
                                        {inboundPaths.map(p => <option key={p} value={p}>{p}</option>)}
                                    </select>
                                </div>
                            </div>

                            <div className="grid grid-cols-2 gap-3">
                                <div>
                                    <label className="block text-2xs font-semibold text-muted-foreground mb-1">고객명 <span className="text-destructive">*</span></label>
                                    <input
                                        className="w-full px-3 py-2 border border-input rounded-lg text-xs bg-background text-foreground focus:ring-1 focus:ring-primary focus:border-primary outline-none font-medium"
                                        placeholder="이름 입력"
                                        value={manualForm.customerName}
                                        onChange={e => handleManualChange('customerName', e.target.value)}
                                    />
                                </div>
                                <div>
                                    <label className="block text-2xs font-semibold text-muted-foreground mb-1">연락처 <span className="text-destructive">*</span></label>
                                    <input
                                        className="w-full px-3 py-2 border border-input rounded-lg text-xs bg-background text-foreground focus:ring-1 focus:ring-primary focus:border-primary outline-none font-mono"
                                        placeholder="010-0000-0000"
                                        value={manualForm.phone}
                                        onChange={e => handleManualChange('phone', e.target.value)}
                                    />
                                </div>
                            </div>

                            {/* [Enhanced] Duplicate Warning */}
                            {manualDuplicate && (
                                <div className="animate-pulse">
                                    <div className="bg-destructive/10 border border-destructive/30 rounded-xl p-3 text-xs flex flex-col gap-1 text-destructive">
                                        <div className="flex items-center gap-1.5 font-bold">
                                            <span>⚠️</span> 이미 등록된 연락처입니다!
                                        </div>
                                        <div className="text-muted-foreground pl-5 text-2xs space-y-0.5">
                                            <p>등록된 고객명: <strong className="text-foreground">{manualDuplicate.customerName}</strong></p>
                                            <p>담당자: <strong className="text-foreground">{manualDuplicate.managerName}</strong></p>
                                            <p>현재 상태: <span className="font-semibold text-destructive">{manualDuplicate.status}</span></p>
                                        </div>
                                    </div>
                                </div>
                            )}

                            <div>
                                <label className="block text-2xs font-semibold text-muted-foreground mb-1">사전 정보 (메모)</label>
                                <textarea
                                    className="w-full px-3 py-2 border border-input rounded-lg text-xs bg-background text-foreground h-20 focus:ring-1 focus:ring-primary focus:border-primary outline-none resize-none"
                                    placeholder="상담 전 참고할 내용 입력..."
                                    value={manualForm.preInfo}
                                    onChange={e => handleManualChange('preInfo', e.target.value)}
                                />
                            </div>

                            <button
                                onClick={submitManual}
                                disabled={isLoading}
                                className="w-full py-2.5 bg-primary hover:bg-primary/90 text-primary-foreground rounded-xl font-bold text-xs shadow-2xs flex items-center justify-center gap-2 mt-2 transition-colors cursor-pointer"
                            >
                                {isLoading ? <Loader2 className="animate-spin" size={16} /> : <Plus size={16} />}
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
