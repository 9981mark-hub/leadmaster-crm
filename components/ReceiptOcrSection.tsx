import React, { useState, useRef } from 'react';
// 영수증 글자 읽기는 서버 AI(ai-proxy)가 한다 → 로그인만 돼 있으면 쓸 수 있다 (키 입력 없음)
import { analyzeReceiptImage, imageToBase64, resizeImage } from '../services/visionService';

interface OcrResult {
    success: boolean;
    rawText: string;
    parsed: {
        date: string | null;
        amount: number | null;
        storeName: string | null;
        items: string[];
    };
    error?: string;
}

interface ExpenseFormData {
    date: string;
    amount: number;
    description: string;
    category: '광고비' | '마케팅비' | '사무비용' | '인건비' | '교통비' | '식대' | '기타지출';
}

interface ReceiptOcrSectionProps {
    onExpenseSaved?: () => void;
}

interface ReceiptCameraBridge {
    openReceiptCamera?: () => void;
    isReceiptCameraAvailable?: () => boolean;
}

declare global {
    interface Window {
        Android?: ReceiptCameraBridge;
        onReceiptImageCaptured?: (base64Image: string) => void;
        onReceiptCameraResult?: (dataUrl: string | null) => void;
    }
}

// 앱(LeadMasterApp)은 'AndroidBridge' 이름으로 노출한다. 예전 이름 'Android'도 함께 지원.
const getReceiptCameraBridge = (): ReceiptCameraBridge | undefined => {
    if (typeof window === 'undefined') return undefined;
    const bridge = (window as any).AndroidBridge as ReceiptCameraBridge | undefined;
    if (bridge?.openReceiptCamera) return bridge;
    if (window.Android?.openReceiptCamera) return window.Android;
    return undefined;
};

// 앱이 순수 base64를 보내는 경우에도 이미지로 읽을 수 있게 data URL로 맞춘다.
const toImageDataUrl = (image: string): string =>
    image.startsWith('data:') ? image : `data:image/jpeg;base64,${image}`;

const ReceiptOcrSection: React.FC<ReceiptOcrSectionProps> = ({ onExpenseSaved }) => {
    const [ocrLoading, setOcrLoading] = useState(false);
    const [ocrResult, setOcrResult] = useState<OcrResult | null>(null);
    const [ocrFormData, setOcrFormData] = useState<ExpenseFormData>({
        date: '',
        amount: 0,
        description: '',
        category: '기타지출'
    });
    const fileInputRef = useRef<HTMLInputElement>(null);

    // 모바일 카메라 사용 가능 여부
    const isMobileCamera = (() => {
        try {
            return !!getReceiptCameraBridge()?.isReceiptCameraAvailable?.();
        } catch {
            return false;
        }
    })();

    // Android 카메라에서 이미지 수신
    // 앱은 window.onReceiptCameraResult(dataUrl | null)를 호출한다 (취소·실패 시 null).
    React.useEffect(() => {
        const handleCaptured = async (image: string | null) => {
            if (!image) {
                setOcrLoading(false);
                return;
            }
            await processImage(toImageDataUrl(image));
        };
        window.onReceiptCameraResult = handleCaptured;
        window.onReceiptImageCaptured = handleCaptured; // 예전 이름 호환
        return () => {
            window.onReceiptCameraResult = undefined;
            window.onReceiptImageCaptured = undefined;
        };
    }, []);

    // 이미지 처리 함수
    const processImage = async (base64: string) => {
        setOcrLoading(true);
        setOcrResult(null);

        try {
            // 이미지 리사이즈 및 OCR 분석
            const resized = await resizeImage(base64);
            const result = await analyzeReceiptImage(resized);
            setOcrResult(result);

            if (result.success && result.parsed) {
                setOcrFormData({
                    date: result.parsed.date || new Date().toISOString().split('T')[0],
                    amount: result.parsed.amount || 0,
                    description: result.parsed.storeName || '',
                    category: '기타지출'
                });
            }
        } catch (error) {
            console.error('OCR Error:', error);
            setOcrResult({
                success: false,
                rawText: '',
                parsed: { date: null, amount: null, storeName: null, items: [] },
                error: 'OCR 처리 중 오류가 발생했습니다.'
            });
        } finally {
            setOcrLoading(false);
        }
    };

    // 파일 업로드 핸들러
    const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (!file) return;

        try {
            const base64 = await imageToBase64(file);
            await processImage(base64);
        } catch (error) {
            console.error('File read error:', error);
        } finally {
            if (fileInputRef.current) {
                fileInputRef.current.value = '';
            }
        }
    };

    // 모바일 카메라 실행
    const handleOpenCamera = () => {
        const bridge = getReceiptCameraBridge();
        try {
            if (bridge?.openReceiptCamera) {
                bridge.openReceiptCamera();
                return;
            }
        } catch (error) {
            console.error('Receipt camera bridge error:', error);
        }
        // 브릿지가 없거나 실패하면 일반 파일 선택(카메라 촬영 가능)으로 대체
        fileInputRef.current?.click();
    };

    // 지출 저장
    const handleSaveExpense = async () => {
        if (!ocrFormData.amount || !ocrFormData.date) {
            alert('날짜와 금액을 입력해주세요.');
            return;
        }

        try {
            const { createExpense } = await import('../services/api');
            await createExpense({
                date: ocrFormData.date,
                amount: ocrFormData.amount,
                category: ocrFormData.category,
                description: ocrFormData.description,
                ocrText: ocrResult?.rawText || ''
            });

            alert('지출이 등록되었습니다!');
            setOcrResult(null);
            setOcrFormData({ date: '', amount: 0, description: '', category: '기타지출' });
            onExpenseSaved?.();
        } catch (error) {
            console.error('Save expense error:', error);
            alert('지출 등록 중 오류가 발생했습니다.');
        }
    };

    // 초기화
    const handleReset = () => {
        setOcrResult(null);
        setOcrFormData({ date: '', amount: 0, description: '', category: '기타지출' });
    };

    return (
        <div className="bg-white rounded-xl shadow-sm border border-cyan-100 overflow-hidden">
            <div className="p-4 border-b border-cyan-100 bg-gradient-to-r from-cyan-50 to-teal-50">
                <div className="flex items-center justify-between">
                    <div>
                        <h3 className="font-bold text-cyan-700 flex items-center gap-2">
                            📷 영수증 스캔 (OCR)
                        </h3>
                        <p className="text-xs text-cyan-500 mt-1">
                            영수증 사진을 업로드하면 자동으로 날짜, 금액을 추출합니다
                        </p>
                    </div>
                    <div className="flex gap-2">
                        {/* 파일 업로드 버튼 (PC/모바일 공용) */}
                        <input
                            ref={fileInputRef}
                            type="file"
                            accept="image/*"
                            capture="environment"
                            onChange={handleFileUpload}
                            className="hidden"
                            id="receipt-upload"
                        />
                        <label
                            htmlFor="receipt-upload"
                            className={`px-4 py-2 rounded-lg cursor-pointer flex items-center gap-2 text-sm ${ocrLoading
                                    ? 'bg-gray-300 cursor-not-allowed'
                                    : 'bg-cyan-600 hover:bg-cyan-700 text-white'
                                }`}
                        >
                            {ocrLoading ? (
                                <>
                                    <span className="animate-spin">⏳</span>
                                    분석 중...
                                </>
                            ) : (
                                <>📷 {isMobileCamera ? '갤러리' : '파일 선택'}</>
                            )}
                        </label>

                        {/* 모바일 카메라 버튼 */}
                        {isMobileCamera && (
                            <button
                                onClick={handleOpenCamera}
                                disabled={ocrLoading}
                                className={`px-4 py-2 rounded-lg flex items-center gap-2 text-sm ${ocrLoading
                                        ? 'bg-gray-300 cursor-not-allowed'
                                        : 'bg-teal-600 hover:bg-teal-700 text-white'
                                    }`}
                            >
                                📸 카메라
                            </button>
                        )}
                    </div>
                </div>
            </div>

            <div className="p-4">
                {/* OCR 에러 */}
                {ocrResult && !ocrResult.success && (
                    <div className="bg-red-50 border border-red-200 rounded-lg p-4 mb-4">
                        <p className="text-red-700">❌ {ocrResult.error}</p>
                    </div>
                )}

                {/* OCR 결과 및 폼 */}
                {ocrResult && ocrResult.success && (
                    <div className="space-y-4">
                        <div className="bg-green-50 border border-green-200 rounded-lg p-3">
                            <p className="text-green-700 text-sm">
                                ✅ 영수증 분석 완료! 아래 정보를 확인 후 저장해주세요.
                            </p>
                        </div>

                        <div className="grid grid-cols-2 gap-4">
                            <div>
                                <label className="block text-sm font-medium text-gray-700 mb-1">
                                    날짜
                                </label>
                                <input
                                    type="date"
                                    value={ocrFormData.date}
                                    onChange={e => setOcrFormData(prev => ({ ...prev, date: e.target.value }))}
                                    className="w-full border border-gray-300 rounded-lg px-3 py-2"
                                />
                            </div>
                            <div>
                                <label className="block text-sm font-medium text-gray-700 mb-1">
                                    금액 (원)
                                </label>
                                <input
                                    type="number"
                                    value={ocrFormData.amount}
                                    onChange={e => setOcrFormData(prev => ({ ...prev, amount: parseInt(e.target.value) || 0 }))}
                                    className="w-full border border-gray-300 rounded-lg px-3 py-2"
                                />
                            </div>
                            <div>
                                <label className="block text-sm font-medium text-gray-700 mb-1">
                                    상호/내용
                                </label>
                                <input
                                    type="text"
                                    value={ocrFormData.description}
                                    onChange={e => setOcrFormData(prev => ({ ...prev, description: e.target.value }))}
                                    className="w-full border border-gray-300 rounded-lg px-3 py-2"
                                    placeholder="상호명 또는 내용"
                                />
                            </div>
                            <div>
                                <label className="block text-sm font-medium text-gray-700 mb-1">
                                    카테고리
                                </label>
                                <select
                                    value={ocrFormData.category}
                                    onChange={e => setOcrFormData(prev => ({ ...prev, category: e.target.value as ExpenseFormData['category'] }))}
                                    className="w-full border border-gray-300 rounded-lg px-3 py-2"
                                >
                                    <option value="광고비">광고비</option>
                                    <option value="마케팅비">마케팅비</option>
                                    <option value="사무비용">사무비용</option>
                                    <option value="인건비">인건비</option>
                                    <option value="교통비">교통비</option>
                                    <option value="식대">식대</option>
                                    <option value="기타지출">기타지출</option>
                                </select>
                            </div>
                        </div>

                        {/* 원본 텍스트 */}
                        <details className="bg-gray-50 rounded-lg p-3">
                            <summary className="text-sm text-gray-600 cursor-pointer">
                                📄 인식된 원본 텍스트 보기
                            </summary>
                            <pre className="mt-2 text-xs text-gray-500 whitespace-pre-wrap max-h-40 overflow-y-auto">
                                {ocrResult.rawText}
                            </pre>
                        </details>

                        <div className="flex gap-2">
                            <button
                                onClick={handleSaveExpense}
                                className="flex-1 bg-green-600 text-white py-2 rounded-lg hover:bg-green-700"
                            >
                                💾 지출 저장
                            </button>
                            <button
                                onClick={handleReset}
                                className="px-4 bg-gray-200 text-gray-700 py-2 rounded-lg hover:bg-gray-300"
                            >
                                취소
                            </button>
                        </div>
                    </div>
                )}

                {/* 초기 상태 */}
                {!ocrResult && !ocrLoading && (
                    <div className="text-center py-8 text-gray-400">
                        <span className="text-4xl block mb-2">📷</span>
                        <p>영수증 사진을 업로드하면 AI가 자동으로 분석합니다</p>
                        <p className="text-xs mt-1">지원 형식: JPG, PNG (최대 4MB)</p>
                    </div>
                )}

                {/* 로딩 상태 */}
                {ocrLoading && (
                    <div className="text-center py-8">
                        <span className="text-4xl block mb-2 animate-pulse">🔍</span>
                        <p className="text-cyan-600">영수증을 분석하고 있습니다...</p>
                        <p className="text-xs text-gray-400 mt-1">잠시만 기다려주세요</p>
                    </div>
                )}
            </div>
        </div>
    );
};

export default ReceiptOcrSection;
