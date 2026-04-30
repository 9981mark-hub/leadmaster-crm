import * as XLSX from 'xlsx';
import { Case } from '../types';

/**
 * Export data to Excel file
 * @param filename Filename without extension
 * @param data Array of objects to export
 * @param sheetName Name of the sheet (default: 'Sheet1')
 */
export const exportToExcel = (filename: string, data: any[], sheetName: string = 'Sheet1') => {
    // Create workbook and worksheet
    const wb = XLSX.utils.book_new();
    const ws = XLSX.utils.json_to_sheet(data);

    // Auto-width columns
    const colWidths = data.length > 0
        ? Object.keys(data[0]).map(key => ({
            wch: Math.max(
                key.length,
                ...data.map(row => row[key] ? row[key].toString().length : 0)
            ) + 2
        }))
        : [];
    ws['!cols'] = colWidths;

    // Add worksheet to workbook
    XLSX.utils.book_append_sheet(wb, ws, sheetName);

    // Save file
    XLSX.writeFile(wb, `${filename}.xlsx`);
};

/**
 * Export cases with status '부재', '진행불가', or '고객취소' to Excel.
 * Includes fields: createdAt, customerName, phone, preInfo.
 */
/**
 * Export cases with status '부재', '진행불가', or '고객취소' to Excel.
 * Includes fields: createdAt, customerName, phone, preInfo.
 */
export const exportSpecialCases = (cases: Case[], filename: string = 'special_cases') => {
    const targetStatuses = ['부재', '진행불가', '고객취소'];
    const filtered = cases.filter(c => targetStatuses.includes(c.status));
    const data = filtered.map(c => ({
        createdAt: c.createdAt,
        customerName: c.customerName,
        phone: c.phone,
        preInfo: c.preInfo ?? ''
    }));
    exportToExcel(filename, data);
};

/**
 * Format date for Excel (YYYY-MM-DD)
 */
export const formatDateForExcel = (dateString?: string) => {
    if (!dateString) return '';
    return dateString.split('T')[0];
};

/**
 * Export custom cases based on modal selection
 */
export const exportCustomCases = (cases: Case[], filename: string = 'cases_export', targetType: 'all' | 'special' | 'current', selectedStatuses: string[], dateType: 'createdAt' | 'contractAt', dateRange: 'all' | 'month' | 'custom', selectedMonth: string, customStartDate: string, customEndDate: string) => {
    
    let filtered = [...cases];

    // 1. Target Scope
    if (targetType === 'special') {
        const specialStatuses = ['부재', '진행불가', '고객취소'];
        filtered = filtered.filter(c => specialStatuses.includes(c.status));
    }

    // 2. Status Filter
    if (selectedStatuses.length > 0) {
        filtered = filtered.filter(c => selectedStatuses.includes(c.status));
    }

    // 3. Date Range
    if (dateRange !== 'all') {
        filtered = filtered.filter(c => {
            const dateStr = dateType === 'contractAt' ? c.contractAt : c.createdAt;
            if (!dateStr) return false;
            
            const caseDate = dateStr.split('T')[0];
            
            if (dateRange === 'month' && selectedMonth) {
                return caseDate.startsWith(selectedMonth);
            }
            
            if (dateRange === 'custom') {
                if (customStartDate && caseDate < customStartDate) return false;
                if (customEndDate && caseDate > customEndDate) return false;
                return true;
            }
            return true;
        });
    }

    // Map to export data format (can be expanded later)
    const data = filtered.map(c => ({
        등록일: formatDateForExcel(c.createdAt),
        계약일: formatDateForExcel(c.contractAt),
        상태: c.status,
        고객명: c.customerName,
        연락처: c.phone,
        유입경로: c.inboundPath ?? '',
        사전정보: c.preInfo ?? '',
        수임료: formatCurrencyForExcel(c.contractFee),
    }));

    exportToExcel(filename, data);
};

export const formatCurrencyForExcel = (amount?: number) => {
    if (amount === undefined || amount === null) return 0;
    return amount;
};
