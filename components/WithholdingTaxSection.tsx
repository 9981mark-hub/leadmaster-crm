import React, { useState, useEffect } from 'react';
import * as XLSX from 'xlsx';
import { Plus, Trash2, Download, AlertTriangle, CheckCircle } from 'lucide-react';

// ─── Types ───────────────────────────────────────────────
type IncomeType = '사업소득(3.3%)' | '기타소득(8.8%)' | '근로소득(간이세액)' | '일용근로(2.7%)';

interface WithholdingRecord {
    id: string;
    payDate: string;           // 지급일
    name: string;              // 이름/상호
    payAmount: number;         // 지급액 (원)
    incomeType: IncomeType;    // 소득구분
    withholdingTax: number;    // 원천징수액
    localIncomeTax: number;    // 지방소득세 (원천세의 10%)
    netAmount: number;         // 실지급액
    filingMonth: string;       // 원천세 신고월 (지급월+1)
    isFilingDone: boolean;     // 신고 완료 여부
    memo: string;
}

const INCOME_RATES: Record<IncomeType, number> = {
    '사업소득(3.3%)': 0.033,
    '기타소득(8.8%)': 0.088,
    '근로소득(간이세액)': 0.033,  // 간이세액표 기준, 여기선 3.3% 근사
    '일용근로(2.7%)': 0.027,
};

const STORAGE_KEY = 'leadmaster_withholding_records';

function loadRecords(): WithholdingRecord[] {
    try {
        const raw = localStorage.getItem(STORAGE_KEY);
        return raw ? JSON.parse(raw) : [];
    } catch { return []; }
}
function saveRecords(records: WithholdingRecord[]) {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(records));
}

function calcRecord(
    payDate: string,
    payAmount: number,
    incomeType: IncomeType,
    isSemiAnnual: boolean
): Pick<WithholdingRecord, 'withholdingTax' | 'localIncomeTax' | 'netAmount' | 'filingMonth'> {
    const rate = INCOME_RATES[incomeType];
    const withholdingTax = Math.floor(payAmount * rate);
    const localIncomeTax = Math.floor(withholdingTax * 0.1);
    const netAmount = payAmount - withholdingTax - localIncomeTax;

    let filingMonth = '';
    if (payDate) {
        const d = new Date(payDate);
        if (isSemiAnnual) {
            // 반기납: 1~6월 지급분은 7월 신고, 7~12월 지급분은 다음해 1월 신고
            if (d.getMonth() < 6) {
                filingMonth = `${d.getFullYear()}-07`;
            } else {
                filingMonth = `${d.getFullYear() + 1}-01`;
            }
        } else {
            // 월별납: 지급일의 다음 달 신고
            d.setMonth(d.getMonth() + 1);
            filingMonth = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
        }
    }
    return { withholdingTax, localIncomeTax, netAmount, filingMonth };
}

const EMPTY_FORM = {
    payDate: new Date().toISOString().split('T')[0],
    name: '',
    payAmount: 0,
    incomeType: '사업소득(3.3%)' as IncomeType,
    memo: '',
};

export default function WithholdingTaxSection({ year }: { year: number }) {
    const [records, setRecords] = useState<WithholdingRecord[]>([]);
    const [form, setForm] = useState({ ...EMPTY_FORM });
    const [showForm, setShowForm] = useState(false);
    const [isSemiAnnual, setIsSemiAnnual] = useState(false);

    useEffect(() => {
        setRecords(loadRecords().filter(r => r.payDate.startsWith(String(year))));
        const semiAnnualSetting = localStorage.getItem('leadmaster_withholding_semi_annual') === 'true';
        setIsSemiAnnual(semiAnnualSetting);
    }, [year]);

    const refreshFromStorage = () => {
        setRecords(loadRecords().filter(r => r.payDate.startsWith(String(year))));
    };

    const toggleSemiAnnual = () => {
        const newVal = !isSemiAnnual;
        setIsSemiAnnual(newVal);
        localStorage.setItem('leadmaster_withholding_semi_annual', String(newVal));
        
        // 기존 레코드들의 신고월 재계산
        const all = loadRecords().map(r => ({
            ...r,
            ...calcRecord(r.payDate, r.payAmount, r.incomeType, newVal)
        }));
        saveRecords(all);
        refreshFromStorage();
    };

    const handleAdd = () => {
        if (!form.name || !form.payDate || form.payAmount <= 0) {
            alert('이름, 지급일, 지급액을 모두 입력해주세요.');
            return;
        }
        const calc = calcRecord(form.payDate, form.payAmount, form.incomeType, isSemiAnnual);
        const newRecord: WithholdingRecord = {
            id: Date.now().toString(),
            ...form,
            ...calc,
            isFilingDone: false,
        };
        const all = loadRecords();
        saveRecords([...all, newRecord]);
        setForm({ ...EMPTY_FORM });
        setShowForm(false);
        refreshFromStorage();
    };

    const handleDelete = (id: string) => {
        if (!confirm('삭제하시겠습니까?')) return;
        const all = loadRecords().filter(r => r.id !== id);
        saveRecords(all);
        refreshFromStorage();
    };

    const toggleFiling = (id: string) => {
        const all = loadRecords().map(r =>
            r.id === id ? { ...r, isFilingDone: !r.isFilingDone } : r
        );
        saveRecords(all);
        refreshFromStorage();
    };

    const handleExport = () => {
        const data = [
            ['지급일', '이름/상호', '소득구분', '지급액(원)', '원천징수액', '지방소득세', '실지급액', '신고월', '신고여부', '메모'],
            ...records.map(r => [
                r.payDate, r.name, r.incomeType,
                r.payAmount, r.withholdingTax, r.localIncomeTax, r.netAmount,
                r.filingMonth, r.isFilingDone ? '완료' : '미완료', r.memo
            ])
        ];
        const wb = XLSX.utils.book_new();
        XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet(data), '원천세관리');
        XLSX.writeFile(wb, `원천세관리_${year}년.xlsx`);
    };

    // 통계
    const totalPay = records.reduce((s, r) => s + r.payAmount, 0);
    const totalWithholding = records.reduce((s, r) => s + r.withholdingTax, 0);
    const totalLocal = records.reduce((s, r) => s + r.localIncomeTax, 0);
    const pendingCount = records.filter(r => !r.isFilingDone).length;

    // 미신고 월 추출 (이번달 10일 이전이면 신고 미완료가 정상)
    const todayStr = new Date().toISOString().slice(0, 7);
    const overdueRecords = records.filter(r => !r.isFilingDone && r.filingMonth < todayStr);

    return (
        <div className="bg-white rounded-xl shadow-sm border border-purple-100 overflow-hidden">
            {/* Header */}
            <div className="p-4 border-b border-purple-100 bg-gradient-to-r from-purple-50 to-indigo-50">
                <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-2">
                    <div>
                        <h3 className="font-bold text-purple-800 flex items-center gap-2 text-base">
                            💸 원천세·외주비 관리표
                        </h3>
                        <p className="text-xs text-purple-500 mt-0.5">{year}년 · 프리랜서/외주 지급 시 원천징수 자동 계산</p>
                    </div>
                    <div className="flex gap-2">
                        <div className="flex items-center gap-2 mr-4 bg-white/50 px-3 py-1.5 rounded-lg border border-purple-200">
                            <input 
                                type="checkbox" 
                                id="semi-annual-toggle"
                                checked={isSemiAnnual}
                                onChange={toggleSemiAnnual}
                                className="w-4 h-4 text-purple-600 rounded cursor-pointer"
                            />
                            <label htmlFor="semi-annual-toggle" className="text-xs font-bold text-purple-800 cursor-pointer">
                                반기납 대상자 (7월/1월 신고)
                            </label>
                        </div>
                        <button onClick={handleExport} className="px-3 py-1.5 bg-white border border-purple-300 text-purple-700 text-xs rounded-lg hover:bg-purple-50 flex items-center gap-1">
                            <Download size={13} /> Excel
                        </button>
                        <button onClick={() => setShowForm(v => !v)} className="px-3 py-1.5 bg-purple-600 text-white text-xs rounded-lg hover:bg-purple-700 flex items-center gap-1">
                            <Plus size={13} /> 지급 등록
                        </button>
                    </div>
                </div>
            </div>

            {/* KPI */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3 p-4 border-b border-gray-100">
                <div className="bg-purple-50 rounded-lg p-3 text-center">
                    <p className="text-xs text-purple-500">총 지급액</p>
                    <p className="text-lg font-bold text-purple-800">{totalPay.toLocaleString()}원</p>
                </div>
                <div className="bg-orange-50 rounded-lg p-3 text-center">
                    <p className="text-xs text-orange-500">원천징수 합계</p>
                    <p className="text-lg font-bold text-orange-700">{totalWithholding.toLocaleString()}원</p>
                </div>
                <div className="bg-yellow-50 rounded-lg p-3 text-center">
                    <p className="text-xs text-yellow-600">지방소득세 합계</p>
                    <p className="text-lg font-bold text-yellow-700">{totalLocal.toLocaleString()}원</p>
                </div>
                <div className={`rounded-lg p-3 text-center ${overdueRecords.length > 0 ? 'bg-red-50' : 'bg-green-50'}`}>
                    <p className={`text-xs ${overdueRecords.length > 0 ? 'text-red-500' : 'text-green-500'}`}>미신고 건수</p>
                    <p className={`text-lg font-bold ${overdueRecords.length > 0 ? 'text-red-700' : 'text-green-700'}`}>
                        {pendingCount}건
                    </p>
                </div>
            </div>

            {/* Overdue Warning */}
            {overdueRecords.length > 0 && (
                <div className="mx-4 mt-3 p-3 bg-red-50 border border-red-200 rounded-lg flex items-start gap-2">
                    <AlertTriangle size={16} className="text-red-500 mt-0.5 shrink-0" />
                    <div>
                        <p className="text-sm font-bold text-red-700">원천세 신고 기한 초과 {overdueRecords.length}건</p>
                        <p className="text-xs text-red-600 mt-0.5">
                            {overdueRecords.map(r => `${r.name}(${r.filingMonth}월 신고)`).join(', ')}
                        </p>
                    </div>
                </div>
            )}

            {/* Add Form */}
            {showForm && (
                <div className="m-4 p-4 bg-purple-50 border border-purple-200 rounded-xl">
                    <h4 className="text-sm font-bold text-purple-800 mb-3">외주비 지급 등록</h4>
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                        <div>
                            <label className="text-xs text-gray-600 block mb-1">지급일 *</label>
                            <input type="date" value={form.payDate}
                                onChange={e => setForm(f => ({ ...f, payDate: e.target.value }))}
                                className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm" />
                        </div>
                        <div>
                            <label className="text-xs text-gray-600 block mb-1">이름/상호 *</label>
                            <input type="text" value={form.name} placeholder="홍길동"
                                onChange={e => setForm(f => ({ ...f, name: e.target.value }))}
                                className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm" />
                        </div>
                        <div>
                            <label className="text-xs text-gray-600 block mb-1">지급액 (원) *</label>
                            <input type="number" value={form.payAmount || ''}
                                onChange={e => setForm(f => ({ ...f, payAmount: parseInt(e.target.value) || 0 }))}
                                className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm" placeholder="1000000" />
                        </div>
                        <div>
                            <label className="text-xs text-gray-600 block mb-1">소득 구분 *</label>
                            <select value={form.incomeType}
                                onChange={e => setForm(f => ({ ...f, incomeType: e.target.value as IncomeType }))}
                                className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm">
                                {Object.keys(INCOME_RATES).map(t => (
                                    <option key={t} value={t}>{t}</option>
                                ))}
                            </select>
                        </div>
                        <div>
                            <label className="text-xs text-gray-600 block mb-1">메모</label>
                            <input type="text" value={form.memo} placeholder="작업 내용"
                                onChange={e => setForm(f => ({ ...f, memo: e.target.value }))}
                                className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm" />
                        </div>
                        <div className="flex items-end">
                            {form.payAmount > 0 && (() => {
                                const c = calcRecord(form.payDate, form.payAmount, form.incomeType, isSemiAnnual);
                                return (
                                    <div className="text-xs text-purple-700 bg-white border border-purple-200 rounded-lg p-2 w-full">
                                        <p>원천세: <strong>{c.withholdingTax.toLocaleString()}원</strong></p>
                                        <p>지방소득세: <strong>{c.localIncomeTax.toLocaleString()}원</strong></p>
                                        <p>실지급액: <strong>{c.netAmount.toLocaleString()}원</strong></p>
                                        <p className="text-gray-500">신고월: {c.filingMonth} {isSemiAnnual ? '(반기납)' : ''}</p>
                                    </div>
                                );
                            })()}
                        </div>
                    </div>
                    <div className="flex gap-2 mt-3">
                        <button onClick={handleAdd} className="px-4 py-2 bg-purple-600 text-white text-sm rounded-lg hover:bg-purple-700">등록</button>
                        <button onClick={() => setShowForm(false)} className="px-4 py-2 bg-white border border-gray-300 text-gray-700 text-sm rounded-lg hover:bg-gray-50">취소</button>
                    </div>
                </div>
            )}

            {/* Table */}
            <div className="p-4 overflow-x-auto" style={{ overscrollBehavior: 'auto' }}>
                {records.length === 0 ? (
                    <div className="text-center py-8 text-gray-400">
                        <p className="text-sm">등록된 외주비 지급 내역이 없습니다.</p>
                        <p className="text-xs mt-1">프리랜서/외주 지급 시 위 "지급 등록" 버튼으로 추가하세요.</p>
                    </div>
                ) : (
                    <table className="w-full text-xs min-w-[700px]">
                        <thead className="bg-purple-50 text-purple-700">
                            <tr>
                                <th className="py-2 px-3 text-left">지급일</th>
                                <th className="py-2 px-3 text-left">이름/상호</th>
                                <th className="py-2 px-3 text-left">소득구분</th>
                                <th className="py-2 px-3 text-right">지급액</th>
                                <th className="py-2 px-3 text-right">원천세</th>
                                <th className="py-2 px-3 text-right">지방소득세</th>
                                <th className="py-2 px-3 text-right">실지급액</th>
                                <th className="py-2 px-3 text-center">신고월</th>
                                <th className="py-2 px-3 text-center">신고</th>
                                <th className="py-2 px-3 text-center">삭제</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-gray-100">
                            {records.map(r => (
                                <tr key={r.id} className={`hover:bg-gray-50 ${r.isFilingDone ? 'opacity-60' : ''}`}>
                                    <td className="py-2 px-3 text-gray-700">{r.payDate}</td>
                                    <td className="py-2 px-3 font-medium text-gray-800">{r.name}</td>
                                    <td className="py-2 px-3 text-gray-600">{r.incomeType}</td>
                                    <td className="py-2 px-3 text-right text-gray-800">{r.payAmount.toLocaleString()}</td>
                                    <td className="py-2 px-3 text-right text-orange-600 font-medium">{r.withholdingTax.toLocaleString()}</td>
                                    <td className="py-2 px-3 text-right text-yellow-600">{r.localIncomeTax.toLocaleString()}</td>
                                    <td className="py-2 px-3 text-right text-purple-700 font-bold">{r.netAmount.toLocaleString()}</td>
                                    <td className="py-2 px-3 text-center">
                                        <span className={`px-2 py-0.5 rounded-full ${
                                            r.filingMonth < todayStr && !r.isFilingDone
                                                ? 'bg-red-100 text-red-700'
                                                : 'bg-gray-100 text-gray-600'
                                        }`}>
                                            {r.filingMonth}
                                        </span>
                                    </td>
                                    <td className="py-2 px-3 text-center">
                                        <button
                                            onClick={() => toggleFiling(r.id)}
                                            title={r.isFilingDone ? '신고 취소' : '신고 완료 처리'}
                                        >
                                            {r.isFilingDone
                                                ? <CheckCircle size={16} className="text-green-500 mx-auto" />
                                                : <div className="w-4 h-4 rounded-full border-2 border-gray-300 mx-auto" />
                                            }
                                        </button>
                                    </td>
                                    <td className="py-2 px-3 text-center">
                                        <button onClick={() => handleDelete(r.id)}>
                                            <Trash2 size={14} className="text-red-400 hover:text-red-600 mx-auto" />
                                        </button>
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                        <tfoot className="bg-purple-50 font-bold text-purple-700">
                            <tr>
                                <td colSpan={3} className="py-2 px-3">합계 ({records.length}건)</td>
                                <td className="py-2 px-3 text-right">{totalPay.toLocaleString()}</td>
                                <td className="py-2 px-3 text-right text-orange-600">{totalWithholding.toLocaleString()}</td>
                                <td className="py-2 px-3 text-right text-yellow-600">{totalLocal.toLocaleString()}</td>
                                <td className="py-2 px-3 text-right">{(totalPay - totalWithholding - totalLocal).toLocaleString()}</td>
                                <td colSpan={3} />
                            </tr>
                        </tfoot>
                    </table>
                )}
            </div>

            <div className="px-4 pb-3">
                <p className="text-xs text-gray-400">※ 사업소득 3.3% = 소득세 3% + 지방소득세 0.3%. 매월 10일까지 홈택스에서 신고·납부 필요.</p>
            </div>
        </div>
    );
}
