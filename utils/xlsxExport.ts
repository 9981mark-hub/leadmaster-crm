import * as XLSX from 'xlsx';

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
 * Format date for Excel (YYYY-MM-DD)
 */
export const formatDateForExcel = (dateString?: string) => {
    if (!dateString) return '';
    return dateString.split('T')[0];
};

/**
 * Format currency for Excel
 */
export const formatCurrencyForExcel = (amount?: number) => {
    if (amount === undefined || amount === null) return 0;
    return amount;
};
