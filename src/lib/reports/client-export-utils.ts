"use client";

export function downloadCsvFile(filename: string, content: string): void {
  // Use UTF-8 BOM (\uFEFF) for Excel compatibility with Arabic text
  const blob = new Blob(["\uFEFF" + content], { type: "text/csv;charset=utf-8;" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.setAttribute("href", url);
  link.setAttribute("download", filename);
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}

export function escapeCsvCell(val: unknown): string {
  if (val === null || val === undefined) return '""';
  const str = String(val).replace(/"/g, '""');
  return `"${str}"`;
}

export function printOfflineHtmlReport(title: string, contentHtml: string, cachedAtStr?: string): void {
  const printWindow = window.open("", "_blank");
  if (!printWindow) {
    alert("الرجاء السماح بالناوافذ المنبثقة لطباعة التقرير.");
    return;
  }

  const headerNotice = cachedAtStr
    ? `<div style="background:#fef3c7; border:1px solid #f59e0b; color:#92400e; padding:10px; border-radius:8px; margin-bottom:15px; font-weight:bold; text-align:center; font-size:12px;">
        ⚠️ هذه نسخة أوفلاين مبنية على آخر تحديث محفوظ بتاريخ: ${cachedAtStr}
       </div>`
    : "";

  printWindow.document.write(`
    <!DOCTYPE html>
    <html lang="ar" dir="rtl">
    <head>
      <meta charset="UTF-8">
      <title>${title}</title>
      <style>
        body { font-family: system-ui, -apple-system, sans-serif; padding: 20px; direction: rtl; color: #0f172a; }
        @media print {
          body { padding: 0; }
        }
      </style>
    </head>
    <body>
      ${headerNotice}
      ${contentHtml}
      <script>
        window.onload = function() {
          window.print();
        };
      </script>
    </body>
    </html>
  `);
  printWindow.document.close();
}
