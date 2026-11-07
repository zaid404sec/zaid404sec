import * as XLSX from 'xlsx';

const currencyFormat = '₹#,##0.00';
function jsonSheet(rows, widths, moneyFields = []) {
  const ws = XLSX.utils.json_to_sheet(rows || []);
  ws['!cols'] = (widths || []).map(w => ({ wch: w }));
  const range = XLSX.utils.decode_range(ws['!ref'] || 'A1:A1');
  const headers = (rows?.length ? Object.keys(rows[0]) : []);
  moneyFields.forEach(field => {
    const col = headers.indexOf(field);
    if (col < 0) return;
    for (let row = 1; row <= range.e.r; row++) {
      const cell = ws[XLSX.utils.encode_cell({ r: row, c: col })];
      if (cell && typeof cell.v === 'number') cell.z = currencyFormat;
    }
  });
  if (range.e.r > 0) ws['!autofilter'] = { ref: XLSX.utils.encode_range(range) };
  return ws;
}

window.WashDeskExcel = {
  async exportWorkbook({ filename, sales, daily, expenses, staff }) {
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, jsonSheet(sales, [18,14,28,18,18,34,12,14,14,14,14,14,14,14,16,18,32], ['Subtotal','Line Discounts','Bill Discount','Taxable Value','GST','Grand Total','Paid','Balance Due']), 'Sales Register');
    XLSX.utils.book_append_sheet(wb, jsonSheet(daily, [14,14,16,16,16,16,18,18], ['Sales','Payments Received','Outstanding','Expenses','Salary Expenses']), 'Daily Summary');
    XLSX.utils.book_append_sheet(wb, jsonSheet(expenses, [14,22,28,18,18,18,14,32], ['Amount']), 'Expenses');
    XLSX.utils.book_append_sheet(wb, jsonSheet(staff, [28,18,18,18,18,18], ['Monthly Salary','Salary Paid','Salary Balance']), 'Staff Salaries');
    const raw = XLSX.write(wb, { bookType: 'xlsx', type: 'base64', compression: true });
    const contentType = 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet';
    if (window.WashDeskFileSharer?.save) {
      await window.WashDeskFileSharer.save({ filename, contentType, base64Data: raw, android: { saveDirectory: 'downloads', relativePath: 'Download/WashDesk' } });
      return { saved: true, location: 'Downloads/WashDesk' };
    }
    const binary = Uint8Array.from(atob(raw), c => c.charCodeAt(0));
    const blob = new Blob([binary], { type: contentType });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a'); a.href = url; a.download = filename; a.style.display = 'none';
    document.body.appendChild(a); a.click(); a.remove(); setTimeout(() => URL.revokeObjectURL(url), 30000);
    return { saved: true, location: 'browser Downloads' };
  }
};
