/**
 * Google Cloud Vision OCR Service
 * 영수증 이미지에서 텍스트를 추출하고 날짜, 금액, 업종을 파싱합니다.
 */

// API 키는 환경변수 또는 로컬스토리지에서 가져옴
const getApiKey = (): string => {
    // 1. 환경변수 확인
    const envKey = import.meta.env.VITE_GOOGLE_API_KEY;
    if (envKey) return envKey;

    // 2. 로컬스토리지 확인
    const storedKey = localStorage.getItem('google_api_key');
    if (storedKey) return storedKey;

    // 3. 없으면 빈 문자열 (호출 시 에러 처리)
    return '';
};

// API 키 저장 (설정 페이지에서 사용)
export const setGoogleApiKey = (key: string): void => {
    localStorage.setItem('google_api_key', key);
};

// API 키 존재 여부 확인
export const hasGoogleApiKey = (): boolean => {
    return !!getApiKey();
};

export interface OcrResult {
    success: boolean;
    rawText: string;
    parsed: {
        date: string | null;        // YYYY-MM-DD 형식
        amount: number | null;      // 총 금액
        storeName: string | null;   // 상호명
        items: string[];            // 품목들
    };
    error?: string;
}

/**
 * Google Cloud Vision API를 사용하여 이미지에서 텍스트 추출
 */
export const analyzeReceiptImage = async (imageBase64: string): Promise<OcrResult> => {
    const apiKey = getApiKey();

    if (!apiKey) {
        return {
            success: false,
            rawText: '',
            parsed: { date: null, amount: null, storeName: null, items: [] },
            error: 'API 키가 설정되지 않았습니다. 설정에서 Google API 키를 입력해주세요.'
        };
    }

    try {
        // Base64 데이터에서 prefix 제거 (data:image/jpeg;base64, 등)
        const base64Data = imageBase64.includes(',')
            ? imageBase64.split(',')[1]
            : imageBase64;

        const response = await fetch(
            `https://vision.googleapis.com/v1/images:annotate?key=${apiKey}`,
            {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({
                    requests: [
                        {
                            image: {
                                content: base64Data
                            },
                            features: [
                                {
                                    type: 'TEXT_DETECTION',
                                    maxResults: 1
                                }
                            ]
                        }
                    ]
                })
            }
        );

        if (!response.ok) {
            const errorData = await response.json();
            throw new Error(errorData.error?.message || 'Vision API 요청 실패');
        }

        const data = await response.json();
        const textAnnotations = data.responses?.[0]?.textAnnotations;

        if (!textAnnotations || textAnnotations.length === 0) {
            return {
                success: false,
                rawText: '',
                parsed: { date: null, amount: null, storeName: null, items: [] },
                error: '이미지에서 텍스트를 찾을 수 없습니다.'
            };
        }

        const rawText = textAnnotations[0].description || '';
        const parsed = parseReceiptText(rawText);

        return {
            success: true,
            rawText,
            parsed
        };

    } catch (error) {
        console.error('Vision API Error:', error);
        return {
            success: false,
            rawText: '',
            parsed: { date: null, amount: null, storeName: null, items: [] },
            error: error instanceof Error ? error.message : 'OCR 처리 중 오류가 발생했습니다.'
        };
    }
};

/**
 * OCR 텍스트에서 날짜, 금액, 상호명 추출
 */
export const parseReceiptText = (text: string): OcrResult['parsed'] => {
    const lines = text.split('\n').map(line => line.trim()).filter(Boolean);

    let date: string | null = null;
    let amount: number | null = null;
    let storeName: string | null = null;
    const items: string[] = [];

    // 날짜 패턴들 (한국 영수증 기준)
    const datePatterns = [
        /(\d{4})[.\-/년](\d{1,2})[.\-/월](\d{1,2})일?/,  // 2024.01.15, 2024-01-15, 2024년01월15일
        /(\d{2})[.\-/](\d{1,2})[.\-/](\d{1,2})/,         // 24.01.15
    ];

    // 금액 패턴들
    const amountPatterns = [
        /(?:합\s*계|총\s*액|결제\s*금액|판매\s*금액|총\s*금액|TOTAL|Total)\s*[:\s]?\s*([\d,]+)\s*원?/i,
        /(?:카드|신용|체크|현금)\s*결제\s*[:\s]?\s*([\d,]+)\s*원?/i,
        /([\d,]+)\s*원\s*$/m,  // 줄 끝에 있는 금액
    ];

    for (const line of lines) {
        // 날짜 추출
        if (!date) {
            for (const pattern of datePatterns) {
                const match = line.match(pattern);
                if (match) {
                    let year = match[1];
                    const month = match[2].padStart(2, '0');
                    const day = match[3].padStart(2, '0');

                    // 2자리 연도 처리
                    if (year.length === 2) {
                        year = '20' + year;
                    }

                    date = `${year}-${month}-${day}`;
                    break;
                }
            }
        }

        // 금액 추출 (합계, 총액 등 키워드가 있는 줄 우선)
        for (const pattern of amountPatterns) {
            const match = line.match(pattern);
            if (match) {
                const extracted = parseInt(match[1].replace(/,/g, ''));
                // 가장 큰 금액을 총액으로 추정
                if (!amount || extracted > amount) {
                    amount = extracted;
                }
            }
        }
    }

    // 상호명 추출 (첫 번째 줄 또는 사업자등록번호 위의 줄)
    if (lines.length > 0) {
        // 첫 3줄 중에서 상호명 찾기
        for (let i = 0; i < Math.min(5, lines.length); i++) {
            const line = lines[i];
            // 숫자/특수문자가 주가 아닌 줄을 상호명으로 추정
            if (line.length >= 2 && !/^\d+$/.test(line) && !/^[=\-*]+$/.test(line)) {
                // 전화번호나 주소가 아닌 경우
                if (!/^\d{2,3}[-)]?\d{3,4}[-]?\d{4}$/.test(line) && !/^서울|부산|대구|인천|광주|대전|울산|세종|경기|강원|충북|충남|전북|전남|경북|경남|제주/.test(line)) {
                    storeName = line;
                    break;
                }
            }
        }
    }

    // 품목 추출 (금액이 포함된 줄들)
    const itemPattern = /^(.+?)\s+([\d,]+)\s*원?$/;
    for (const line of lines) {
        const match = line.match(itemPattern);
        if (match && match[1].length < 30) {
            items.push(match[1].trim());
        }
    }

    return { date, amount, storeName, items };
};

/**
 * 이미지 파일을 Base64로 변환
 */
export const imageToBase64 = (file: File): Promise<string> => {
    return new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = () => {
            if (typeof reader.result === 'string') {
                resolve(reader.result);
            } else {
                reject(new Error('파일 읽기 실패'));
            }
        };
        reader.onerror = () => reject(reader.error);
        reader.readAsDataURL(file);
    });
};

/**
 * 이미지 리사이즈 (API 제한 및 성능 최적화)
 */
export const resizeImage = (base64: string, maxWidth = 1024, maxHeight = 1024): Promise<string> => {
    return new Promise((resolve, reject) => {
        const img = new Image();
        img.onload = () => {
            let { width, height } = img;

            // 리사이즈 비율 계산
            if (width > maxWidth || height > maxHeight) {
                const ratio = Math.min(maxWidth / width, maxHeight / height);
                width = Math.floor(width * ratio);
                height = Math.floor(height * ratio);
            }

            const canvas = document.createElement('canvas');
            canvas.width = width;
            canvas.height = height;

            const ctx = canvas.getContext('2d');
            if (!ctx) {
                reject(new Error('Canvas context 생성 실패'));
                return;
            }

            ctx.drawImage(img, 0, 0, width, height);
            resolve(canvas.toDataURL('image/jpeg', 0.85));
        };
        img.onerror = () => reject(new Error('이미지 로드 실패'));
        img.src = base64;
    });
};
