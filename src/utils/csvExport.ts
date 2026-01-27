/**
 * CSV Export Utilities
 * Handles formal CSV generation with escaping and metadata headers.
 */
import * as XLSX from 'xlsx';

interface CSVOptions {
    filename: string;
    title: string;
    period?: string;
    generatedBy?: string;
}

/**
 * Escapes a cell value for CSV
 */
const escapeCSV = (value: any): string => {
    if (value === null || value === undefined) return '""';
    const stringValue = String(value);
    // If value contains comma, quotes or newlines, wrap in quotes and escape internal quotes
    if (stringValue.includes(',') || stringValue.includes('"') || stringValue.includes('\n') || stringValue.includes('\r')) {
        return `"${stringValue.replace(/"/g, '""')}"`;
    }
    return `"${stringValue}"`;
};

/**
 * Generates and downloads a formal CSV file
 */
export const downloadFormalCSV = (
    headers: string[],
    rows: any[][],
    options: CSVOptions
) => {
    const now = new Date().toLocaleString('id-ID');

    // 1. Meta Header Section (Industry Standard)
    const metaLines = [
        [`REPORT: ${options.title.toUpperCase()}`],
        [`PERIODE: ${options.period?.toUpperCase() || '-'}`],
        [`TANGGAL CETAK: ${now}`],
        [`DICETAK OLEH: ${options.generatedBy || 'System'}`],
        [''], // Spacer
    ];

    // 2. Data Section
    const dataLines = [
        headers,
        ...rows
    ];

    // Combine and format
    const csvContent = [
        ...metaLines,
        ...dataLines
    ].map(line => line.map(escapeCSV).join(',')).join('\r\n');

    // Create and download blob
    // Add 'sep=,' for Excel compatibility if needed, but BOM is usually enough for modern Excel.
    // However, for "industry standard" usually means just standard CSV.
    // We stick with BOM.

    const BOM = '\uFEFF';
    const blob = new Blob([BOM + csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);

    const link = document.createElement('a');
    link.setAttribute('href', url);
    link.setAttribute('download', options.filename.endsWith('.csv') ? options.filename : `${options.filename}.csv`);
    link.style.visibility = 'hidden';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
};

import ExcelJS from 'exceljs';

/**
 * Generates and downloads an Excel (.xlsx) file using ExcelJS for a more professional look.
 */
export const downloadExcel = async (
    headers: string[],
    rows: any[][],
    options: CSVOptions
) => {
    const workbook = new ExcelJS.Workbook();
    const worksheet = workbook.addWorksheet('Laporan');

    // 1. Add Metadata Info
    worksheet.addRow([`REPORT: ${options.title.toUpperCase()}`]);
    worksheet.addRow([`PERIODE: ${options.period?.toUpperCase() || '-'}`]);
    worksheet.addRow([`TANGGAL CETAK: ${new Date().toLocaleString('id-ID')}`]);
    worksheet.addRow([`DICETAK OLEH: ${options.generatedBy || 'System'}`]);
    worksheet.addRow([]); // Spacer row

    // Styling Meta (Compact)
    worksheet.getRow(1).font = { bold: true, size: 12 };
    worksheet.getRow(2).font = { size: 10 };
    worksheet.getRow(3).font = { size: 10 };
    worksheet.getRow(4).font = { size: 10 };

    // Track special rows to ignore for auto-width
    const autoWidthIgnoreRows = new Set<number>();

    // 2. Add Data
    rows.forEach((row, rowIndex) => {
        const isMainHeader = JSON.stringify(row) === JSON.stringify(headers);
        const isDeptHeader = row[0] && String(row[0]).startsWith('>>>');
        const isGrandTotal = row[0] && (String(row[0]).includes('RINGKASAN') || String(row[0]).startsWith('===='));

        const excelRow = worksheet.addRow(row);
        excelRow.font = { size: 10 }; // Default font size

        if (isMainHeader) {
            excelRow.eachCell((cell) => {
                cell.font = { bold: true, color: { argb: 'FFFFFFFF' }, size: 10 };
                cell.fill = {
                    type: 'pattern',
                    pattern: 'solid',
                    fgColor: { argb: 'FF1E40AF' }
                };
                cell.border = {
                    top: { style: 'thin' },
                    left: { style: 'thin' },
                    bottom: { style: 'thin' },
                    right: { style: 'thin' }
                };
            });
        } else if (isDeptHeader) {
            autoWidthIgnoreRows.add(excelRow.number);
            excelRow.getCell(1).font = { bold: true, color: { argb: 'FF1E293B' }, size: 10 };
            excelRow.getCell(1).fill = {
                type: 'pattern',
                pattern: 'solid',
                fgColor: { argb: 'FFF1F5F9' }
            };
            worksheet.mergeCells(excelRow.number, 1, excelRow.number, headers.length || 10);
        } else if (isGrandTotal) {
            autoWidthIgnoreRows.add(excelRow.number);
            excelRow.getCell(1).font = { bold: true, size: 10 };
            if (String(row[0]).includes('RINGKASAN')) {
                excelRow.getCell(1).fill = {
                    type: 'pattern',
                    pattern: 'solid',
                    fgColor: { argb: 'FFF0FDF4' }
                };
            }
        } else if (row.length > 0 && row.some(val => val !== '')) {
            excelRow.eachCell((cell) => {
                cell.border = {
                    top: { style: 'thin', color: { argb: 'FFE2E8F0' } },
                    left: { style: 'thin', color: { argb: 'FFE2E8F0' } },
                    bottom: { style: 'thin', color: { argb: 'FFE2E8F0' } },
                    right: { style: 'thin', color: { argb: 'FFE2E8F0' } }
                };
                if (cell.value === '⚠️ YA') {
                    cell.font = { color: { argb: 'FFEF4444' }, bold: true, size: 10 };
                }
            });
        }
    });

    // 3. Auto-fit columns (Smarter)
    worksheet.columns.forEach((column, i) => {
        let maxLength = 0;
        column.eachCell?.({ includeEmpty: false }, (cell) => {
            // Ignore specialized rows for width calculation
            if (autoWidthIgnoreRows.has(cell.row)) return;

            const columnLength = cell.value ? cell.value.toString().length : 10;
            if (columnLength > maxLength) {
                maxLength = columnLength;
            }
        });
        column.width = maxLength < 8 ? 10 : maxLength + 2;
    });

    // 4. Writing & Downloading
    const buffer = await workbook.xlsx.writeBuffer();
    const blob = new Blob([buffer], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
    const url = window.URL.createObjectURL(blob);
    const anchor = document.createElement('a');
    anchor.href = url;
    anchor.download = options.filename.endsWith('.xlsx') ? options.filename : `${options.filename}.xlsx`;
    anchor.click();
    window.URL.revokeObjectURL(url);
};
