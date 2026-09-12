import React from 'react';
import { useChit } from '@/shared/context/ChitContext';
import { Modal } from './Modal';
import { StatusBadge } from './StatusBadge';
import { jsPDF } from 'jspdf';
import autoTable from 'jspdf-autotable';
import { Printer, Download, Share2 } from 'lucide-react';
import { CompanySettings, PaymentTransaction } from '@/types';

const safeStr = (val: any) => String(val ?? '').replace(/₹/g, 'Rs. ').trim();

export const downloadReceiptPdf = (txn: PaymentTransaction, company?: CompanySettings) => {
  const doc = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' });
  const compName = safeStr(company?.companyName || 'Chit Fund Management');
  const compAddress = company?.address ? safeStr(company.address) : '';
  const compPhone = company?.phone ? safeStr(company.phone) : '';
  const compGst = company?.gstNumber ? safeStr(company.gstNumber) : '';

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(15);
  doc.setTextColor(15, 23, 42);
  doc.text(compName, 15, 18, { maxWidth: 105 });

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(8.5);
  doc.setTextColor(71, 85, 105);
  if (compAddress) doc.text(compAddress, 15, 25, { maxWidth: 105 });

  const contactList = [];
  if (compPhone) contactList.push(`Phone: ${compPhone}`);
  if (compGst) contactList.push(`GST: ${compGst}`);
  if (contactList.length > 0) doc.text(contactList.join(' | '), 15, compAddress ? 33 : 26, { maxWidth: 105 });

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(13);
  doc.setTextColor(79, 70, 229);
  doc.text('OFFICIAL PAYMENT RECEIPT', 195, 18, { align: 'right' });

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(9.5);
  doc.setTextColor(15, 23, 42);
  doc.text(`Receipt #: ${safeStr(txn.receiptNo)}`, 195, 25, { align: 'right' });

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(9);
  doc.setTextColor(71, 85, 105);
  doc.text(`Date: ${safeStr(txn.date)}`, 195, 31, { align: 'right' });

  doc.setDrawColor(203, 213, 225);
  doc.setLineWidth(0.5);
  doc.line(15, 39, 195, 39);

  let curY = 47;
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(8);
  doc.setTextColor(100, 116, 139);
  doc.text('MEMBER DETAILS', 15, curY);

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(10.5);
  doc.setTextColor(15, 23, 42);
  doc.text(safeStr(txn.memberName), 15, curY + 6);

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(9);
  doc.setTextColor(71, 85, 105);
  doc.text(`Member ID: ${safeStr(txn.memberId)}`, 15, curY + 12);

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(8);
  doc.setTextColor(100, 116, 139);
  doc.text('SCHEME DETAILS', 115, curY);

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(10.5);
  doc.setTextColor(79, 70, 229);
  doc.text(safeStr(txn.chitName), 115, curY + 6);

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(9);
  doc.setTextColor(71, 85, 105);
  doc.text(`Chit ID: ${safeStr(txn.chitId || '-')}`, 115, curY + 12);
  if (txn.paidTo && txn.paidTo !== '-') {
    doc.text(`Paid To: ${safeStr(txn.paidTo)}`, 115, curY + 17);
    curY += 24;
  } else {
    curY += 20;
  }

  const due = txn.monthlyDue ?? txn.amount ?? 0;
  const paid = txn.amount ?? 0;
  const remaining = txn.remainingBalance ?? 0;

  const dueStr = `Rs. ${due.toLocaleString('en-IN')}`;
  const paidStr = `Rs. ${paid.toLocaleString('en-IN')}`;
  const remStr = `Rs. ${remaining.toLocaleString('en-IN')}`;

  autoTable(doc, {
    startY: curY,
    head: [['Description', 'Payment Details', 'Amount']],
    body: [
      ['Monthly Installment Due', `Installment Date: ${safeStr(txn.date)}`, dueStr],
      ['Amount Received', `Mode: ${safeStr(txn.paymentMode)} | Status: ${safeStr(txn.status)}`, paidStr],
      ['Remaining Balance Pending', remaining > 0 ? 'Pending Dues Balance' : 'Fully Cleared', remStr],
    ],
    theme: 'grid',
    headStyles: { fillColor: [79, 70, 229], textColor: [255, 255, 255], fontStyle: 'bold', fontSize: 9.5 },
    bodyStyles: { fontSize: 9, textColor: [30, 41, 59] },
    alternateRowStyles: { fillColor: [248, 250, 252] },
    columnStyles: {
      0: { cellWidth: 70 },
      1: { cellWidth: 70 },
      2: { cellWidth: 40, halign: 'right', fontStyle: 'bold' },
    },
    margin: { left: 15, right: 15 },
  });

  const lastTable = (doc as any).lastAutoTable;
  const tableY = (lastTable ? lastTable.finalY : curY + 40) + 8;

  doc.setFillColor(241, 245, 249);
  doc.rect(15, tableY, 180, 14, 'F');
  doc.setDrawColor(203, 213, 225);
  doc.rect(15, tableY, 180, 14, 'D');

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(10);
  doc.setTextColor(15, 23, 42);
  doc.text('TOTAL AMOUNT PAID', 20, tableY + 9);

  doc.setFontSize(12);
  doc.setTextColor(5, 150, 105);
  doc.text(paidStr, 190, tableY + 9, { align: 'right' });

  const footerY = tableY + 24;
  if (txn.notes) {
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(8.5);
    doc.setTextColor(100, 116, 139);
    doc.text(`Note / Reference: ${safeStr(txn.notes)}`, 15, footerY - 5, { maxWidth: 180 });
  }

  doc.setFont('helvetica', 'italic');
  doc.setFontSize(9);
  doc.setTextColor(71, 85, 105);
  doc.text('Thank you for your payment.', 15, footerY + 5);

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(8.5);
  doc.setTextColor(100, 116, 139);
  doc.text(`Collected by: ${safeStr(txn.collectedBy || 'Super Admin')}`, 15, footerY + 11);

  doc.setDrawColor(148, 163, 184);
  doc.line(140, footerY + 5, 195, footerY + 5);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(8.5);
  doc.setTextColor(30, 41, 59);
  doc.text(safeStr(company?.signatureText || 'Authorized Signatory'), 167.5, footerY + 11, { align: 'center' });

  doc.save(`receipt-${safeStr(txn.receiptNo)}.pdf`);
};

export const ReceiptModal: React.FC = () => {
  const { activeReceiptModal, closeReceipt, companySettings, addToast } = useChit();

  if (!activeReceiptModal) return null;
  const txn = activeReceiptModal;

  const handlePrint = () => {
    window.print();
  };

  const handleDownloadPdf = () => {
    try {
      downloadReceiptPdf(txn, companySettings);
      addToast('Downloaded', 'PDF Receipt has been downloaded', 'success');
    } catch (e: any) {
      addToast('Error', e?.message || 'Failed to generate PDF', 'error');
    }
  };

  const handleShare = () => {
    if (navigator.share) {
      navigator
        .share({
          title: `Receipt ${txn.receiptNo}`,
          text: `Payment Receipt for ${txn.memberName}: Amount Rs. ${txn.amount}`,
        })
        .catch(() => {});
    } else {
      navigator.clipboard.writeText(`Receipt No: ${txn.receiptNo}\nMember: ${txn.memberName}\nAmount: Rs. ${txn.amount}\nDate: ${txn.date}`);
      addToast('Copied', 'Receipt details copied to clipboard', 'info');
    }
  };

  return (
    <Modal
      isOpen={!!activeReceiptModal}
      onClose={closeReceipt}
      title="Payment Receipt"
      subtitle={`Receipt No: ${txn.receiptNo}`}
      maxWidth="lg"
    >
      <div className="space-y-6">
        <div id="printable-receipt" className="bg-[#0B0F17] border border-[#1F293D] rounded-xl p-6 text-slate-200 relative overflow-hidden">
          <div className="flex items-start justify-between border-b border-[#1F293D] pb-5">
            <div>
              <div className="flex items-center gap-2">
                <div className="w-8 h-8 rounded-lg bg-blue-600 flex items-center justify-center text-white font-bold text-lg">
                  C
                </div>
                <h2 className="text-xl font-bold text-slate-100 tracking-tight">{companySettings.companyName}</h2>
              </div>
              {companySettings.address && <p className="text-xs text-slate-400 mt-1 max-w-sm">{companySettings.address}</p>}
              <p className="text-xs text-slate-400">
                Phone: {companySettings.phone} {companySettings.gstNumber && `| GST: ${companySettings.gstNumber}`}
              </p>
            </div>
            <div className="text-right">
              <span className="text-xs font-semibold text-blue-400 uppercase tracking-wider block">Official Receipt</span>
              <p className="text-sm font-mono font-bold text-slate-100 mt-1">{txn.receiptNo}</p>
              <p className="text-xs text-slate-400 mt-1">Date: {txn.date}</p>
              <div className="mt-2">
                <StatusBadge status={txn.status || 'Paid'} />
              </div>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4 py-4 border-b border-[#1F293D] text-sm">
            <div>
              <p className="text-xs text-slate-400 font-medium">MEMBER DETAILS</p>
              <p className="font-semibold text-slate-100 mt-1">{txn.memberName}</p>
              <p className="text-xs text-slate-400 font-mono">Member ID: {txn.memberId}</p>
              {txn.memberPhone && <p className="text-xs text-slate-400">Phone: {txn.memberPhone}</p>}
            </div>
            <div className="text-right">
              <p className="text-xs text-slate-400 font-medium">SCHEME DETAILS</p>
              <p className="font-semibold text-blue-400 mt-1">{txn.chitName}</p>
              {txn.chitId && <p className="text-xs text-slate-400 font-mono">Chit ID: {txn.chitId}</p>}
              {txn.monthNumber && <p className="text-xs text-slate-400">Month: {txn.monthNumber}</p>}
            </div>
          </div>

          <div className="py-4 border-b border-[#1F293D] space-y-2">
            <div className="flex justify-between text-xs text-slate-400">
              <span>Payment Mode</span>
              <span className="font-medium text-slate-200">{txn.paymentMode}</span>
            </div>
            {txn.referenceNo && (
              <div className="flex justify-between text-xs text-slate-400">
                <span>Reference / Txn ID</span>
                <span className="font-mono text-slate-200">{txn.referenceNo}</span>
              </div>
            )}
            {txn.paidTo && (
              <div className="flex justify-between text-xs text-slate-400">
                <span>Paid To</span>
                <span className="font-medium text-slate-200">{txn.paidTo}</span>
              </div>
            )}
            <div className="flex justify-between text-xs text-slate-400">
              <span>Monthly Due</span>
              <span className="font-medium text-slate-200">₹{(txn.monthlyDue || txn.amount).toLocaleString('en-IN')}</span>
            </div>
          </div>

          <div className="pt-4 flex items-center justify-between">
            <span className="text-sm font-bold text-slate-100">Amount Received</span>
            <span className="text-xl font-bold font-mono text-emerald-400">₹{txn.amount.toLocaleString('en-IN')}</span>
          </div>

          {txn.notes && (
            <p className="text-xs text-slate-400 italic mt-3 pt-3 border-t border-[#1F293D]/50">
              Note: {txn.notes}
            </p>
          )}

          <div className="mt-8 pt-6 border-t border-[#1F293D] flex items-center justify-between text-[11px] text-slate-500">
            <div>
              <p>Collected by: {txn.collectedBy || 'Super Admin'}</p>
              <p className="mt-0.5">{companySettings.receiptFooter}</p>
            </div>
            <div className="text-center">
              <div className="w-32 border-b border-slate-600 mb-1" />
              <p className="font-medium text-slate-400">{companySettings.signatureText}</p>
            </div>
          </div>
        </div>

        <div className="flex flex-wrap items-center justify-end gap-3 pt-2">
          <button
            onClick={handleShare}
            className="flex items-center gap-2 px-4 py-2 rounded-xl bg-[#1F293D] text-slate-300 hover:bg-[#2A3752] text-xs font-semibold transition-colors cursor-pointer"
          >
            <Share2 className="w-4 h-4" />
            <span>Share</span>
          </button>
          <button
            onClick={handlePrint}
            className="flex items-center gap-2 px-4 py-2 rounded-xl bg-[#1F293D] text-slate-300 hover:bg-[#2A3752] text-xs font-semibold transition-colors cursor-pointer"
          >
            <Printer className="w-4 h-4" />
            <span>Print</span>
          </button>
          <button
            onClick={handleDownloadPdf}
            className="flex items-center gap-2 px-5 py-2 rounded-xl bg-blue-600 hover:bg-blue-500 text-white text-xs font-semibold shadow-lg shadow-blue-600/30 transition-all cursor-pointer"
          >
            <Download className="w-4 h-4" />
            <span>Download PDF</span>
          </button>
        </div>
      </div>
    </Modal>
  );
};
