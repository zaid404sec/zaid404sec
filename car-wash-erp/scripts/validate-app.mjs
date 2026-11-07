import { readFile } from 'node:fs/promises';
import { existsSync, statSync } from 'node:fs';
import vm from 'node:vm';
import { transform } from 'esbuild';

const html = await readFile(new URL('../index.html', import.meta.url), 'utf8');
const packageJson = JSON.parse(await readFile(new URL('../package.json', import.meta.url), 'utf8'));
const mustContain = [
  'data-edit-invoice', 'function saveInvoiceEdits', 'function calculateEditedInvoice',
  'function staffSalaryPaid', 'function payStaffSalaryForm', 'function exportSalesExcel',
  'function mergeWashDeskData', 'function connectCloud', 'data-wa-toggle',
  'data-action="export-excel"', 'data-action="cloud-sync-now"', 'data-save-pdf',
  'PRIME AUTO CARE', 'Service performed by:', 'Payment mode', 'Authorized Signatory',
  'cloud-otp-form', 'requestEmailOtp', 'verifyEmailOtp', 'Prime-Auto-Care-'
];
for (const token of mustContain) {
  if (!html.includes(token)) throw new Error('Missing feature hook: ' + token);
}
if (html.includes('cdnjs.cloudflare.com') || html.includes('unpkg.com/html2pdf') || html.includes('unpkg.com/jspdf')) {
  throw new Error('Invoice PDF dependencies must be local/offline bundled assets.');
}
const inlineStart = html.indexOf('<script>');
const inlineEnd = inlineStart >= 0 ? html.indexOf('</script>', inlineStart) : -1;
if (inlineStart < 0 || inlineEnd < 0) throw new Error('No inline application script was found.');
const inlineSource = html.slice(inlineStart + '<script>'.length, inlineEnd);
await transform(inlineSource, { loader: 'js', target: 'es2020', logLevel: 'silent' });
console.log('PASS: inline application JavaScript syntax');
for (const asset of ['html2pdf.bundle.min.js','invoice-native.bundle.js','exceljs.bundle.min.js','report-export.bundle.js','cloud-sync.bundle.js']) {
  const path = new URL('../' + asset, import.meta.url);
  if (!existsSync(path) || statSync(path).size < 500) throw new Error('Missing or empty bundled asset: ' + asset);
  console.log('PASS: bundled asset ' + asset);
}
const appId = JSON.parse(await readFile(new URL('../capacitor.config.json', import.meta.url), 'utf8')).appId;
if (appId !== 'com.washdesk.carwash.v2') throw new Error('Android migration-safe app ID was not set.');

// Test the actual daily counter and invoice total functions extracted from the app.
const nextStart = html.indexOf('function nextInvoiceNo(');
const nextEnd = html.indexOf(' async function reserveInvoiceNo', nextStart);
if (nextStart < 0 || nextEnd < 0) throw new Error('Daily invoice counter function not found.');
const nextFunction = html.slice(nextStart, nextEnd);
const nextResult = vm.runInNewContext(nextFunction + String.fromCharCode(10) + "nextInvoiceNo('2026-11-07')", {
  db: { business: { invoicePrefix: 'CW' }, invoices: [
    { date: '2026-11-07', number: 'CW-261107-001' },
    { date: '2026-11-07', number: 'CW-261107-005' },
    { date: '2026-11-06', number: 'CW-261106-019' }
  ] }
});
if (nextResult !== 'CW-261107-006') throw new Error('Daily invoice sequence test failed: ' + nextResult);
console.log('PASS: invoice numbering resets daily and advances past saved bills');

const calcStart = html.indexOf('function calculateEditedInvoice(');
const calcEnd = html.indexOf('  function saveInvoiceEdits', calcStart);
if (calcStart < 0 || calcEnd < 0) throw new Error('Invoice total calculation function not found.');
const calcFunction = html.slice(calcStart, calcEnd);
const calc = vm.runInNewContext(calcFunction + String.fromCharCode(10) + "calculateEditedInvoice([{qty:2,rate:100,discount:10,taxRate:18},{qty:1,rate:50,discount:0,taxRate:0}],5,true)", {
  sum: (rows, fn) => rows.reduce((total, row) => total + Number(fn ? fn(row) : row || 0), 0)
});
if (Math.abs(calc.gross-250) > .001 || Math.abs(calc.lineDisc-10) > .001 || Math.abs(calc.taxable-235) > .001 || Math.abs(calc.grand-268.4875) > .02) {
  throw new Error('Edited invoice recalculation test failed: ' + JSON.stringify(calc));
}
console.log('PASS: invoice edit recalculates subtotal, discounts, taxable value, tax and total');

const salaryStart = html.indexOf('function staffSalaryPaid(');
const salaryEnd = html.indexOf('  function staffSalaryDue', salaryStart);
if (salaryStart < 0 || salaryEnd < 0) throw new Error('Staff salary aggregation function not found.');
const salaryFunction = html.slice(salaryStart, salaryEnd);
const paid = vm.runInNewContext(salaryFunction + String.fromCharCode(10) + "staffSalaryPaid('staff-1','2026-11')", {
  db: { expenses: [
    { category:'Salary', staffId:'staff-1', salaryMonth:'2026-11', date:'2026-11-05', amount:4500 },
    { category:'Electricity', staffId:'staff-1', salaryMonth:'2026-11', date:'2026-11-06', amount:900 },
    { category:'Salary', staffId:'staff-2', salaryMonth:'2026-11', date:'2026-11-06', amount:3000 }
  ] },
  monthKey: date => date ? String(date).slice(0,7) : '2026-11',
  sum: (rows, fn) => rows.reduce((total, row) => total + Number(fn ? fn(row) : row || 0), 0)
});
if (paid !== 4500) throw new Error('Staff salary expense aggregation test failed: ' + paid);
console.log('PASS: staff salary payments are isolated and can be included in expense reports');

// Invoice totals are computed from item quantities, rates, line discounts and tax rates.
const billCalcStart = html.indexOf('function calcLines(');
const billCalcEnd = html.indexOf('function billSummary()', billCalcStart);
if (billCalcStart < 0 || billCalcEnd < 0) throw new Error('Bill calculation function is missing.');
const billCalcSource = html.slice(billCalcStart, billCalcEnd);
const billCalc = vm.runInNewContext(billCalcSource + String.fromCharCode(10) +
  "calcLines([{qty:2,rate:100,discount:10,taxRate:18},{qty:1,rate:50,discount:0,taxRate:0}],5)", {
    db: { business: { registered: true } },
    sum: (rows, fn) => rows.reduce((total, row) => total + Number(fn ? fn(row) : row || 0), 0)
  });
if (billCalc.gross !== 250 || billCalc.lineDisc !== 10 || billCalc.taxable !== 235 ||
    Math.abs(billCalc.tax - 33.4875) > 0.001 || Math.abs(billCalc.grand - 268.4875) > 0.001) {
  throw new Error('Invoice total calculation test failed: ' + JSON.stringify(billCalc));
}
console.log('PASS: invoice PDF source totals reconcile from subtotal through GST to grand total');

const sql = await readFile(new URL('../cloud-sync-setup.sql', import.meta.url), 'utf8');
for (const token of ['washdesk_merge_sync', 'security definer', 'for update', 'enable row level security', 'washdesk_next_invoice_number']) {
  if (!sql.toLowerCase().includes(token)) throw new Error('Cloud SQL security/consistency hook missing: ' + token);
}
if (!sql.includes("p_value ~ '^-?[0-9]+([.][0-9]+)?$' then")) throw new Error('Cloud SQL numeric validation regex is invalid.');
console.log('PASS: cloud schema contains RLS, atomic row locking, and shared invoice counter');

if (!packageJson.dependencies['@andreeewill/exceljs'] || !packageJson.dependencies['@supabase/supabase-js']) throw new Error('Excel or cloud-sync runtime dependency missing.');
console.log('PASS: Excel and Supabase sync dependencies declared');
console.log('Prime Auto Care validation complete.');
