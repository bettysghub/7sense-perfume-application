import { jsPDF } from 'jspdf';
import type { CurrencyCode, RegionalConfig } from '../types';

export const CURRENCY_META: Record<CurrencyCode, { symbol: string; decimals: number; label: string }> = {
  USD: { symbol: '$', decimals: 2, label: 'US Dollar' },
  AED: { symbol: 'AED ', decimals: 2, label: 'UAE Dirham' },
  NGN: { symbol: '₦', decimals: 0, label: 'Nigerian Naira' },
  GHS: { symbol: 'GH₵', decimals: 2, label: 'Ghanaian Cedi' },
  KES: { symbol: 'KSh ', decimals: 0, label: 'Kenyan Shilling' },
  TZS: { symbol: 'TSh ', decimals: 0, label: 'Tanzanian Shilling' },
  UGX: { symbol: 'USh ', decimals: 0, label: 'Ugandan Shilling' },
};

export function formatCurrency(amount: number, currency: CurrencyCode = 'USD'): string {
  const meta = CURRENCY_META[currency] || CURRENCY_META.USD;
  const safe = Number.isFinite(amount) ? amount : 0;
  return `${meta.symbol}${safe.toLocaleString('en-US', {
    minimumFractionDigits: meta.decimals,
    maximumFractionDigits: meta.decimals,
  })}`;
}

export function convertUsdToLocal(
  amountUsd: number,
  currency: CurrencyCode,
  regionalConfigs: RegionalConfig[]
): number {
  if (currency === 'USD') return amountUsd;
  const match = regionalConfigs.find((r) => r.currency === currency);
  const rate = match?.exchangeRatePerUsd || DEFAULT_RATES[currency] || 1;
  return amountUsd * rate;
}

export const DEFAULT_RATES: Record<CurrencyCode, number> = {
  USD: 1,
  AED: 3.67,
  NGN: 1620,
  GHS: 15.8,
  KES: 129,
  TZS: 2680,
  UGX: 3720,
};

export function exportToCsv(filename: string, rows: Record<string, unknown>[]): void {
  if (!rows.length) return;
  const headers = Object.keys(rows[0]);
  const csvLines = [
    headers.join(','),
    ...rows.map((row) =>
      headers
        .map((h) => {
          const val = row[h] ?? '';
          const escaped = String(val).replace(/"/g, '""');
          return `"${escaped}"`;
        })
        .join(',')
    ),
  ];
  const blob = new Blob([csvLines.join('\n')], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}

export function exportFinancialPdfReport(params: {
  title: string;
  subtitle: string;
  metrics: { label: string; value: string }[];
  tableHeaders: string[];
  tableRows: string[][];
  footerNote: string;
}): void {
  const doc = new jsPDF({ orientation: 'portrait', unit: 'pt', format: 'a4' });
  doc.setFillColor(10, 10, 12);
  doc.rect(0, 0, 595, 86, 'F');

  doc.setTextColor(197, 160, 89);
  doc.setFont('times', 'bold');
  doc.setFontSize(20);
  doc.text('7SENSE PERFUMES', 40, 38);

  doc.setTextColor(245, 242, 235);
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(10);
  doc.text(params.title, 40, 56);
  doc.text(params.subtitle, 40, 72);

  let y = 114;
  doc.setTextColor(20, 20, 22);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(12);
  doc.text('Calculated Financial Summary', 40, y);
  y += 18;

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(10);
  params.metrics.forEach((m, idx) => {
    const col = idx % 2 === 0 ? 40 : 310;
    if (idx % 2 === 0 && idx > 0) y += 22;
    doc.setTextColor(100, 100, 110);
    doc.text(m.label, col, y);
    doc.setTextColor(20, 20, 22);
    doc.setFont('helvetica', 'bold');
    doc.text(m.value, col + 140, y);
    doc.setFont('helvetica', 'normal');
  });

  y += 38;
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(11);
  doc.text('Breakdown', 40, y);
  y += 16;

  const colWidth = Math.floor(515 / Math.max(1, params.tableHeaders.length));
  doc.setFillColor(243, 239, 230);
  doc.rect(40, y - 12, 515, 20, 'F');
  doc.setFontSize(9);
  params.tableHeaders.forEach((h, i) => {
    doc.text(h, 46 + i * colWidth, y + 2);
  });
  y += 20;

  doc.setFont('helvetica', 'normal');
  params.tableRows.slice(0, 22).forEach((row) => {
    if (y > 760) {
      doc.addPage();
      y = 50;
    }
    row.forEach((cell, i) => {
      doc.text(String(cell).slice(0, 26), 46 + i * colWidth, y);
    });
    y += 18;
  });

  doc.setFontSize(8);
  doc.setTextColor(120, 120, 130);
  doc.text(params.footerNote, 40, 810);
  doc.save(`7sense-report-${new Date().toISOString().slice(0, 10)}.pdf`);
}
