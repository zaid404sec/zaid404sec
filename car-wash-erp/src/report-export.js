function arrayBufferToBase64(buffer) {
  const bytes = new Uint8Array(buffer);
  let binary = '';
  const block = 0x8000;
  for (let i = 0; i < bytes.length; i += block) {
    binary += String.fromCharCode(...bytes.subarray(i, Math.min(i + block, bytes.length)));
  }
  return btoa(binary);
}

function addSheet(workbook, name, rows, columns, moneyFields = []) {
  const sheet = workbook.addWorksheet(name, { views: [{ state: 'frozen', ySplit: 1 }] });
  sheet.columns = columns.map(col => ({ ...col, key: col.key || col.header }));
  sheet.addRows(rows || []);
  sheet.getRow(1).height = 26;
  sheet.getRow(1).eachCell(cell => {
    cell.font = { bold: true, color: { argb: 'FFFFFFFF' }, size: 10 };
    cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF172B4D' } };
    cell.alignment = { vertical: 'middle', wrapText: true };
    cell.border = { bottom: { style: 'medium', color: { argb: 'FF3678D8' } } };
  });
  const moneySet = new Set(moneyFields);
  columns.forEach((col, index) => {
    if (moneySet.has(col.key || col.header)) {
      for (let r = 2; r <= sheet.rowCount; r++) {
        const cell = sheet.getRow(r).getCell(index + 1);
        cell.numFmt = '₹#,##0.00;[Red]-₹#,##0.00';
        cell.alignment = { horizontal: 'right' };
      }
    }
  });
  sheet.autoFilter = { from: { row: 1, column: 1 }, to: { row: Math.max(1, sheet.rowCount), column: columns.length } };
  sheet.eachRow((row, rowNumber) => {
    if (rowNumber > 1 && rowNumber % 2 === 0) {
      row.eachCell(cell => { cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFF2F6FC' } }; });
    }
    if (rowNumber > 1) row.height = 20;
  });
  return sheet;
}

window.WashDeskExcel = {
  async exportWorkbook({ filename, sales, daily, purchases = [], expenses, personalExpenses = [], accounts = [], staff, advances }) {
    const ExcelJS = window.ExcelJS;
    if (!ExcelJS?.Workbook) throw new Error('The Excel workbook library is not loaded. Reopen WashDesk and retry.');
    const workbook = new ExcelJS.Workbook();
    workbook.creator = 'Prime Auto Care';
    workbook.subject = 'Prime Auto Care sales and operations report';
    workbook.title = filename.replace(/\\.xlsx$/i, '');
    workbook.created = new Date();
    workbook.modified = new Date();
    addSheet(workbook, 'Sales Register', sales, [
      { header: 'Invoice', key: 'Invoice', width: 20 }, { header: 'Date', key: 'Date', width: 14 },
      { header: 'Customer', key: 'Customer', width: 28 }, { header: 'Mobile', key: 'Mobile', width: 16 },
      { header: 'Vehicle', key: 'Vehicle', width: 16 }, { header: 'Vehicle Class', key: 'VehicleClass', width: 18 },
      { header: 'Items', key: 'Items', width: 42 }, { header: 'Subtotal', key: 'Subtotal', width: 16 },
      { header: 'Line Discounts', key: 'Line Discounts', width: 17 }, { header: 'Bill Discount', key: 'Bill Discount', width: 17 },
      { header: 'Taxable Value', key: 'Taxable Value', width: 17 }, { header: 'GST', key: 'GST', width: 15 },
      { header: 'Grand Total', key: 'Grand Total', width: 18 }, { header: 'Paid', key: 'Paid', width: 16 },
      { header: 'Balance Due', key: 'Balance Due', width: 18 }, { header: 'Payment Mode', key: 'Payment Mode', width: 17 },
      { header: 'Staff', key: 'Staff', width: 22 }, { header: 'Notes', key: 'Notes', width: 30 }
    ], ['Subtotal','Line Discounts','Bill Discount','Taxable Value','GST','Grand Total','Paid','Balance Due']);
    addSheet(workbook, 'Daily Summary', daily, [
      { header: 'Date', key: 'Date', width: 16 }, { header: 'Bills Count', key: 'Bills Count', width: 15 },
      { header: 'Sales', key: 'Sales', width: 18 }, { header: 'Payments Received', key: 'Payments Received', width: 21 },
      { header: 'Outstanding', key: 'Outstanding', width: 18 }, { header: 'Purchases', key: 'Purchases', width: 18 }, { header: 'Expenses', key: 'Expenses', width: 18 },
      { header: 'Personal Expenses', key: 'Personal Expenses', width: 21 }, { header: 'Salary Expenses', key: 'Salary Expenses', width: 20 }, { header: 'Staff Advances Issued', key: 'Staff Advances Issued', width: 24 }
    ], ['Sales','Payments Received','Outstanding','Purchases','Expenses','Personal Expenses','Salary Expenses','Staff Advances Issued']);
    addSheet(workbook, 'Purchases', purchases, [
      { header: 'Date', key: 'Date', width: 16 }, { header: 'Supplier', key: 'Supplier', width: 28 },
      { header: 'Item', key: 'Item', width: 28 }, { header: 'Quantity', key: 'Quantity', width: 14 },
      { header: 'Unit Cost', key: 'Unit Cost', width: 16 }, { header: 'Total', key: 'Total', width: 18 },
      { header: 'Payment Mode', key: 'Payment Mode', width: 18 }, { header: 'Reference', key: 'Reference', width: 22 }
    ], ['Unit Cost','Total']);
    addSheet(workbook, 'Expenses', expenses, [
      { header: 'Date', key: 'Date', width: 16 }, { header: 'Category', key: 'Category', width: 23 },
      { header: 'Expense Group', key: 'Expense Group', width: 24 }, { header: 'Account / Person', key: 'Account / Person', width: 24 },
      { header: 'Paid To', key: 'Paid To', width: 24 }, { header: 'Staff', key: 'Staff', width: 22 },
      { header: 'Description', key: 'Description', width: 38 }, { header: 'Mode', key: 'Mode', width: 18 },
      { header: 'Amount', key: 'Amount', width: 18 }, { header: 'Advance Adjustment', key: 'Advance Adjustment', width: 22 }
    ], ['Amount','Advance Adjustment']);
    addSheet(workbook, 'Personal & Household', personalExpenses, [
      { header: 'Date', key: 'Date', width: 16 }, { header: 'Account', key: 'Account', width: 25 },
      { header: 'Expense Head', key: 'Category', width: 30 }, { header: 'Paid To', key: 'Paid To', width: 24 },
      { header: 'Description', key: 'Description', width: 38 }, { header: 'Mode', key: 'Mode', width: 16 },
      { header: 'Amount', key: 'Amount', width: 18 }
    ], ['Amount']);
    addSheet(workbook, 'Personal Account Summary', accounts, [
      { header: 'Account / Person', key: 'Account', width: 32 }, { header: 'Total Personal Expenses', key: 'Amount', width: 24 }
    ], ['Amount']);
    addSheet(workbook, 'Staff Advances', advances, [
      { header: 'Date', key: 'Date', width: 16 }, { header: 'Staff', key: 'Staff', width: 26 },
      { header: 'Reason', key: 'Reason', width: 34 }, { header: 'Amount Issued', key: 'Amount Issued', width: 18 },
      { header: 'Adjusted', key: 'Adjusted', width: 18 }, { header: 'Outstanding', key: 'Outstanding', width: 18 },
      { header: 'Mode', key: 'Mode', width: 16 }, { header: 'Status', key: 'Status', width: 16 }
    ], ['Amount Issued','Adjusted','Outstanding']);
    addSheet(workbook, 'Staff Salaries', staff, [
      { header: 'Staff Name', key: 'Staff Name', width: 28 }, { header: 'Role', key: 'Role', width: 20 },
      { header: 'Phone', key: 'Phone', width: 18 }, { header: 'Monthly Salary', key: 'Monthly Salary', width: 20 },
      { header: 'Salary Paid', key: 'Salary Paid', width: 18 }, { header: 'Salary Balance', key: 'Salary Balance', width: 18 }
    ], ['Monthly Salary','Salary Paid','Salary Balance']);
    const buffer = await workbook.xlsx.writeBuffer();
    const base64Data = arrayBufferToBase64(buffer);
    const contentType = 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet';
    if (window.WashDeskFileSharer?.save) {
      await window.WashDeskFileSharer.save({ filename, contentType, base64Data, android: { saveDirectory: 'downloads', relativePath: 'Download/WashDesk' } });
      return { saved: true, location: 'Downloads/WashDesk' };
    }
    const blob = new Blob([buffer], { type: contentType });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a'); a.href = url; a.download = filename; a.style.display = 'none';
    document.body.appendChild(a); a.click(); a.remove(); setTimeout(() => URL.revokeObjectURL(url), 30000);
    return { saved: true, location: 'browser Downloads' };
  },
  async exportStaffStatement({ filename, summary, attendance, salaryRows, advances }) {
    const ExcelJS = window.ExcelJS;
    if (!ExcelJS?.Workbook) throw new Error('The Excel workbook library is not loaded. Reopen Prime Auto Care and retry.');
    const workbook = new ExcelJS.Workbook();
    workbook.creator = 'Prime Auto Care'; workbook.subject = 'Individual staff payroll statement'; workbook.title = filename.replace(/\\.xlsx$/i, '');
    workbook.created = new Date(); workbook.modified = new Date();
    addSheet(workbook, 'Statement Summary', Object.entries(summary || {}).map(([Metric, Value]) => ({ Metric, Value })), [{ header: 'Metric', key: 'Metric', width: 34 }, { header: 'Value', key: 'Value', width: 24 }], ['Value']);
    addSheet(workbook, 'Attendance & Hours', attendance || [], [{ header: 'Date', key: 'Date', width: 16 }, { header: 'Status', key: 'Status', width: 16 }, { header: 'Hours Worked', key: 'Hours Worked', width: 18 }, { header: 'Shift', key: 'Shift', width: 28 }]);
    addSheet(workbook, 'Salary Payments', salaryRows || [], [{ header: 'Date', key: 'Date', width: 16 }, { header: 'Amount', key: 'Amount', width: 18 }, { header: 'Advance Adjustment', key: 'Advance Adjustment', width: 22 }, { header: 'Mode', key: 'Mode', width: 18 }, { header: 'Note', key: 'Note', width: 36 }], ['Amount','Advance Adjustment']);
    addSheet(workbook, 'Staff Advances', advances || [], [{ header: 'Date', key: 'Date', width: 16 }, { header: 'Reason', key: 'Reason', width: 34 }, { header: 'Amount Issued', key: 'Amount Issued', width: 18 }, { header: 'Adjusted', key: 'Adjusted', width: 18 }, { header: 'Outstanding', key: 'Outstanding', width: 18 }, { header: 'Mode', key: 'Mode', width: 16 }], ['Amount Issued','Adjusted','Outstanding']);
    const buffer = await workbook.xlsx.writeBuffer(),base64Data = arrayBufferToBase64(buffer),contentType = 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet';
    if (window.WashDeskFileSharer?.save) {
      await window.WashDeskFileSharer.save({ filename, contentType, base64Data, android: { saveDirectory: 'downloads', relativePath: 'Download/Prime Auto Care/Staff Statements' } });
      return { saved: true, location: 'Downloads/Prime Auto Care/Staff Statements' };
    }
    const blob = new Blob([buffer], { type: contentType }),url = URL.createObjectURL(blob),a = document.createElement('a');
    a.href = url; a.download = filename; a.style.display = 'none'; document.body.appendChild(a); a.click(); a.remove(); setTimeout(() => URL.revokeObjectURL(url), 30000);
    return { saved: true, location: 'browser Downloads' };
  },
  async exportDailyBusinessReport({ filename, summary, sales, collections, purchases = [], expenses = [], personalExpenses = [], advances = [] }) {
    const ExcelJS = window.ExcelJS;
    if (!ExcelJS?.Workbook) throw new Error('The Excel workbook library is not loaded. Reopen Prime Auto Care and retry.');
    const workbook = new ExcelJS.Workbook();
    workbook.creator = 'Prime Auto Care';
    workbook.subject = 'Date-wise Prime Auto Care business report';
    workbook.title = filename.replace(/\\.xlsx$/i, '');
    workbook.created = new Date();
    workbook.modified = new Date();
    addSheet(workbook, 'Daily Summary', [summary || {}], [
      { header: 'Report Date', key: 'Report Date', width: 18 },
      { header: 'Invoice Count', key: 'Invoice Count', width: 16 },
      { header: 'Sales', key: 'Sales', width: 18 },
      { header: 'Collections', key: 'Collections', width: 18 },
      { header: 'Invoice Outstanding', key: 'Invoice Outstanding', width: 22 },
      { header: 'Purchases', key: 'Purchases', width: 18 },
      { header: 'Operating Expenses', key: 'Operating Expenses', width: 22 },
      { header: 'Personal Expenses', key: 'Personal Expenses', width: 21 },
      { header: 'Staff Payments', key: 'Staff Payments', width: 18 },
      { header: 'Staff Advances Issued', key: 'Staff Advances Issued', width: 24 }
    ], ['Sales','Collections','Invoice Outstanding','Purchases','Operating Expenses','Personal Expenses','Staff Payments','Staff Advances Issued']);
    addSheet(workbook, 'Sales Register', sales || [], [
      { header: 'Invoice', key: 'Invoice', width: 20 }, { header: 'Customer', key: 'Customer', width: 26 },
      { header: 'Mobile', key: 'Mobile', width: 16 }, { header: 'Vehicle', key: 'Vehicle', width: 16 },
      { header: 'Assigned Staff', key: 'Assigned Staff', width: 22 }, { header: 'Grand Total', key: 'Grand Total', width: 18 },
      { header: 'Paid', key: 'Paid', width: 16 }, { header: 'Balance Due', key: 'Balance Due', width: 18 },
      { header: 'Payment Mode', key: 'Payment Mode', width: 18 }, { header: 'Notes', key: 'Notes', width: 30 }
    ], ['Grand Total','Paid','Balance Due']);
    addSheet(workbook, 'Collections', collections || [], [
      { header: 'Date', key: 'Date', width: 16 }, { header: 'Invoice', key: 'Invoice', width: 20 },
      { header: 'Customer', key: 'Customer', width: 26 }, { header: 'Payment Mode', key: 'Payment Mode', width: 18 },
      { header: 'Amount Received', key: 'Amount Received', width: 20 }, { header: 'Reference', key: 'Reference', width: 22 }
    ], ['Amount Received']);
    addSheet(workbook, 'Purchases', purchases || [], [
      { header: 'Date', key: 'Date', width: 16 }, { header: 'Supplier', key: 'Supplier', width: 26 },
      { header: 'Item', key: 'Item', width: 26 }, { header: 'Quantity', key: 'Quantity', width: 14 },
      { header: 'Unit Cost', key: 'Unit Cost', width: 16 }, { header: 'Total', key: 'Total', width: 18 },
      { header: 'Payment Mode', key: 'Payment Mode', width: 18 }, { header: 'Reference', key: 'Reference', width: 22 }
    ], ['Unit Cost','Total']);
    addSheet(workbook, 'Business Expenses', expenses || [], [
      { header: 'Date', key: 'Date', width: 16 }, { header: 'Category', key: 'Category', width: 24 },
      { header: 'Paid To', key: 'Paid To', width: 24 }, { header: 'Staff', key: 'Staff', width: 22 },
      { header: 'Description', key: 'Description', width: 36 }, { header: 'Mode', key: 'Mode', width: 16 },
      { header: 'Amount', key: 'Amount', width: 18 }, { header: 'Advance Adjustment', key: 'Advance Adjustment', width: 22 }
    ], ['Amount','Advance Adjustment']);
    addSheet(workbook, 'Personal & Household', personalExpenses || [], [
      { header: 'Date', key: 'Date', width: 16 }, { header: 'Account', key: 'Account', width: 24 },
      { header: 'Expense Head', key: 'Expense Head', width: 30 }, { header: 'Paid To', key: 'Paid To', width: 24 },
      { header: 'Description', key: 'Description', width: 36 }, { header: 'Mode', key: 'Mode', width: 16 },
      { header: 'Amount', key: 'Amount', width: 18 }
    ], ['Amount']);
    addSheet(workbook, 'Staff Advances', advances || [], [
      { header: 'Date', key: 'Date', width: 16 }, { header: 'Staff', key: 'Staff', width: 26 },
      { header: 'Reason', key: 'Reason', width: 30 }, { header: 'Amount Issued', key: 'Amount Issued', width: 18 },
      { header: 'Adjusted', key: 'Adjusted', width: 18 }, { header: 'Outstanding', key: 'Outstanding', width: 18 },
      { header: 'Mode', key: 'Mode', width: 16 }, { header: 'Status', key: 'Status', width: 16 }
    ], ['Amount Issued','Adjusted','Outstanding']);
    const buffer = await workbook.xlsx.writeBuffer();
    const base64Data = arrayBufferToBase64(buffer);
    const contentType = 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet';
    if (window.WashDeskFileSharer?.save) {
      await window.WashDeskFileSharer.save({ filename, contentType, base64Data, android: { saveDirectory: 'downloads', relativePath: 'Download/Prime Auto Care/Reports' } });
      return { saved: true, location: 'Downloads/Prime Auto Care/Reports' };
    }
    const blob = new Blob([buffer], { type: contentType }), url = URL.createObjectURL(blob), a = document.createElement('a');
    a.href = url; a.download = filename; a.style.display = 'none'; document.body.appendChild(a); a.click(); a.remove(); setTimeout(() => URL.revokeObjectURL(url), 30000);
    return { saved: true, location: 'browser Downloads' };
  }
};
