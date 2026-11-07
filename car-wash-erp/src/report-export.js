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
  async exportWorkbook({ filename, sales, daily, expenses, staff }) {
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
      { header: 'Outstanding', key: 'Outstanding', width: 18 }, { header: 'Expenses', key: 'Expenses', width: 18 },
      { header: 'Salary Expenses', key: 'Salary Expenses', width: 20 }
    ], ['Sales','Payments Received','Outstanding','Expenses','Salary Expenses']);
    addSheet(workbook, 'Expenses', expenses, [
      { header: 'Date', key: 'Date', width: 16 }, { header: 'Category', key: 'Category', width: 23 },
      { header: 'Paid To', key: 'Paid To', width: 24 }, { header: 'Staff', key: 'Staff', width: 22 },
      { header: 'Description', key: 'Description', width: 38 }, { header: 'Mode', key: 'Mode', width: 18 },
      { header: 'Amount', key: 'Amount', width: 18 }
    ], ['Amount']);
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
  }
};
