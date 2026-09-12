import { jsPDF } from 'jspdf';
import autoTable from 'jspdf-autotable';
import { CompanySettings, PaymentTransaction } from '@/types';

export interface ExportPdfParams {
  title: string;
  subtitle?: string;
  headers: string[];
  rows: (string | number)[][];
  filename: string;
  summaryStats?: { label: string; value: string | number }[];
}

export interface ExportCsvParams {
  filename: string;
  headers: string[];
  rows: (string | number)[][];
}

const clean = (val: any) => String(val ?? '').replace(/₹/g, 'Rs. ').trim();

export const exportTableToPdf = ({
  title,
  subtitle = 'Chit Fund Financial Management System',
  headers,
  rows,
  filename,
  summaryStats,
}: ExportPdfParams) => {
  const doc = new jsPDF({
    orientation: headers.length > 6 ? 'landscape' : 'portrait',
    unit: 'mm',
    format: 'a4',
  });

  doc.setFontSize(16);
  doc.setFont('helvetica', 'bold');
  doc.setTextColor(15, 23, 42);
  doc.text(clean(title), 14, 16);

  doc.setFontSize(9);
  doc.setFont('helvetica', 'normal');
  doc.setTextColor(100, 116, 139);
  const stamp = `Generated: ${new Date().toLocaleDateString('en-IN')} ${new Date().toLocaleTimeString('en-IN')} | Chit Fund System | ${clean(subtitle)}`;
  doc.text(stamp, 14, 22);

  let curY = 28;
  if (summaryStats && summaryStats.length > 0) {
    doc.setFontSize(9);
    doc.setTextColor(30, 41, 59);
    const statText = summaryStats.map((s) => `${s.label}: ${clean(s.value)}`).join('   |   ');
    doc.text(statText, 14, curY);
    curY += 8;
  }

  const cleanRows = rows.map((r) => r.map((c) => clean(c)));

  autoTable(doc, {
    startY: curY,
    head: [headers.map((h) => clean(h))],
    body: cleanRows,
    theme: 'grid',
    headStyles: {
      fillColor: [79, 70, 229],
      textColor: [255, 255, 255],
      fontStyle: 'bold',
      fontSize: 9,
    },
    bodyStyles: {
      fontSize: 8.5,
      textColor: [30, 41, 59],
    },
    alternateRowStyles: {
      fillColor: [248, 250, 252],
    },
    margin: { top: 15, left: 14, right: 14, bottom: 15 },
  });

  const finalName = filename.toLowerCase().endsWith('.pdf') ? filename : `${filename}.pdf`;
  doc.save(finalName);
};

export const exportTableToCsv = ({ filename, headers, rows }: ExportCsvParams) => {
  const escapeCsv = (val: any) => {
    let s = String(val ?? '').replace(/"/g, '""');
    if (s.includes(',') || s.includes('\n') || s.includes('"')) {
      s = `"${s}"`;
    }
    return s;
  };

  const csv = [
    headers.map(escapeCsv).join(','),
    ...rows.map((row) => row.map(escapeCsv).join(',')),
  ].join('\n');

  const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.setAttribute('href', url);
  const finalName = filename.toLowerCase().endsWith('.csv') ? filename : `${filename}.csv`;
  link.setAttribute('download', finalName);
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
};

export { downloadReceiptPdf } from '@/shared/components/ui/ReceiptModal';
