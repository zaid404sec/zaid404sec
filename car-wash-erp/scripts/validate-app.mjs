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
  'PRIME AUTO CARE', 'Service performed by:', 'Payment mode', 'Authorised Signatory',
  'cloud-otp-form', 'requestEmailOtp', 'verifyEmailOtp', 'Prime-Auto-Care-',
  'pdfMake.createPdf', 'pdfMake.vfs', 'Prime Auto Care Invoice ', 'TAX INVOICE / SERVICE BILL', 'BILL TO', 'VEHICLE & SERVICE', 'PAYMENT DETAILS', 'GRAND TOTAL', 'BALANCE DUE', 'AUTHORISED SIGNATURE', 'invoice-grand-total strong', 'invoice-summary-row b', 'staffAdvances:[]', 'function staffAdvancesOutstanding', 'function addStaffAdvanceForm', 'advanceAdjustment', 'dashboard-hero', 'prime-auto-care-logo.jpg', 'data-action="add-staff-advance"', 'bill-customer-search', 'renderBillCustomerMatches', 'findCustomerByMobile', 'findVehicleByNumber', 'GOLD & BLACK CAR SERVICES', 'premium-car-mark', 'invoice-party-grid', 'invoice-payment-card', 'invoice-terms-card', 'Customer names may repeat', 'Vehicle registration numbers must be unique', 'carPhotoData', 'prime-auto-care-car-photo.jpg', 'Customer ID is generated automatically as the primary key'
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
for (const asset of ['pdfmake.bundle.min.js','pdfmake-vfs.js','invoice-native.bundle.js','exceljs.bundle.min.js','report-export.bundle.js','cloud-sync.bundle.js','prime-auto-care-logo.jpg','prime-auto-care-car-photo.jpg']) {
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
    { category:'Salary', staffId:'staff-1', salaryMonth:'2026-11', date:'2026-11-05', amount:4500, advanceAdjustment:600 },
    { category:'Electricity', staffId:'staff-1', salaryMonth:'2026-11', date:'2026-11-06', amount:900 },
    { category:'Salary', staffId:'staff-2', salaryMonth:'2026-11', date:'2026-11-06', amount:3000 }
  ] },
  monthKey: date => date ? String(date).slice(0,7) : '2026-11',
  sum: (rows, fn) => rows.reduce((total, row) => total + Number(fn ? fn(row) : row || 0), 0)
});
if (paid !== 5100) throw new Error('Staff salary plus advance adjustment aggregation test failed: ' + paid);
console.log('PASS: staff salary payments and non-cash advance adjustments are included in salary settlement');
const advancesStart = html.indexOf('function staffAdvancesOutstanding(');
const advancesEnd = html.indexOf('function staffSalaryPaid(', advancesStart);
if (advancesStart < 0 || advancesEnd < 0) throw new Error('Staff advance balance function not found.');
const advancesFunction = html.slice(advancesStart, advancesEnd);
const advancesOpen = vm.runInNewContext(advancesFunction + String.fromCharCode(10) + "staffAdvancesOutstanding('staff-1')", {
  db: { staffAdvances: [
    { staffId:'staff-1', amount:1200, recoveredAmount:300 },
    { staffId:'staff-1', amount:500, recoveredAmount:500 },
    { staffId:'staff-2', amount:900, recoveredAmount:100 }
  ] },
  sum: (rows, fn) => rows.reduce((total, row) => total + Number(fn ? fn(row) : row || 0), 0)
});
if (advancesOpen !== 900) throw new Error('Staff advance outstanding calculation failed: ' + advancesOpen);
console.log('PASS: staff advance register calculates adjusted and open balances by staff member');

// Verify normalized unique identifiers. Customer names are intentionally repeatable.
const uniqueStart = html.indexOf('function normalizeMobile(');
const uniqueEnd = html.indexOf('function renderBillCustomerMatches(', uniqueStart);
if (uniqueStart < 0 || uniqueEnd < 0) throw new Error('Customer / vehicle uniqueness helpers are missing.');
const uniqueSource = html.slice(uniqueStart, uniqueEnd);
const uniqueResult = vm.runInNewContext(
  uniqueSource + String.fromCharCode(10) + `({
    mobile: normalizeMobile('+91 98248 23200'),
    mobile0091: normalizeMobile('0091 98248 23200'),
    duplicateCustomer: findCustomerByMobile('9824823200')?.id || '',
    duplicateVehicle: findVehicleByNumber('gj 05-ab 1234')?.id || ''
  })`,
  { db: {
      customers: [{ id:'customer-1', name:'Zaid', phone:'98248 23200' }],
      vehicles: [{ id:'vehicle-1', customerId:'customer-1', number:'GJ05AB1234' }]
    }
  }
);
if (uniqueResult.mobile !== '9824823200' || uniqueResult.mobile0091 !== '9824823200' || uniqueResult.duplicateCustomer !== 'customer-1' || uniqueResult.duplicateVehicle !== 'vehicle-1') {
  throw new Error('Customer mobile / vehicle registration normalization and duplicate lookup test failed: ' + JSON.stringify(uniqueResult));
}
console.log('PASS: mobile numbers normalize across +91 formatting and vehicle registrations ignore spaces / punctuation');

const cloudSource = await readFile(new URL('../src/cloud-sync.js', import.meta.url), 'utf8');
if (!cloudSource.includes('https://jkjudmkqaebrgllemris.supabase.co') ||
    !cloudSource.includes('sb_publishable_VibeDJoJTLelcmlQl8QvhA_kr6h0BQw')) {
  throw new Error('Prime Auto Care Supabase URL / publishable key are not prefilled.');
}
for (const conflictToken of ['DUPLICATE_CUSTOMER_MOBILE','DUPLICATE_VEHICLE_REGISTRATION']) {
  if (!cloudSource.includes(conflictToken)) throw new Error('Cloud sync does not explain duplicate-key conflicts: ' + conflictToken);
}
if (!cloudSource.includes('BMUMZ3909@GMAIL.COM')) {
  throw new Error('The shared business email is not prefilled.');
}
console.log('PASS: Prime Auto Care Supabase project defaults are configured');

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

// Verify the rendered invoice markup includes all money fields that were being
// clipped from the right edge of customer PDFs.
const invoiceHtmlStart = html.indexOf('function invoiceHTML(i){');
const invoiceHtmlEnd = html.indexOf('function invoicePdfName(i)', invoiceHtmlStart);
if (invoiceHtmlStart < 0 || invoiceHtmlEnd < 0) throw new Error('Invoice PDF HTML builder was not found.');
const invoiceHtmlSource = html.slice(invoiceHtmlStart, invoiceHtmlEnd);
const sampleInvoice = {
  id:'pdf-test', number:'TEST-001', date:'2026-11-07', financialYear:'26-27',
  customerId:null, customerNameSnapshot:'PDF Test Customer', customerAddress:'Surat',
  customerCity:'Surat', customerState:'Gujarat', vehicleNumber:'GJ05AB1234',
  vehicleType:'Private Car', staffId:null, staffNameSnapshot:'Test Washer',
  businessSnapshot:{name:'Prime Auto Care',address:'Surat',city:'Surat',state:'Gujarat',stateCode:'24',registered:false},
  gstRegistered:false, lines:[{name:'Premium Wash',kind:'service',sac:'',qty:1,unit:'service',rate:100,discount:0}],
  subtotal:100,lineDiscount:0,discount:0,taxable:100,tax:0,grandTotal:100,
  paymentMode:'Cash',notes:''
};
const invoiceMarkup = vm.runInNewContext(
  invoiceHtmlSource + String.fromCharCode(10) + 'invoiceHTML(sampleInvoice)',
  {
    sampleInvoice,
    db:{business:sampleInvoice.businessSnapshot,staff:[],customers:[],payments:[]},
    sum:(rows,fn)=>rows.reduce((total,row)=>total+Number(fn?fn(row):row||0),0),
    esc:value=>String(value??''),
    INR:value=>'₹'+Number(value||0).toFixed(2),
    invoiceTaxLines:()=>[{taxable:100,rate:0,tax:0,cgst:0,sgst:0,igst:0}],
    invoiceCustomerName:()=> 'PDF Test Customer',
    paid:()=>25,
    invoiceDue:()=>75,
    fy:()=> '26-27'
  }
);
for (const field of ['GRAND TOTAL','₹100.00','Paid','₹25.00','Balance due','₹75.00','Service performed by:']) {
  if (!invoiceMarkup.includes(field)) throw new Error('Invoice PDF is missing required field: ' + field);
}
console.log('PASS: invoice PDF HTML includes Grand Total, Paid, Balance Due and assigned staff');

const reportSource = await readFile(new URL('../src/report-export.js', import.meta.url), 'utf8');
for (const token of ["addSheet(workbook, 'Staff Advances'", "'Staff Advances Issued'", "'Advance Adjustment'", "advances })"]) {
  if (!reportSource.includes(token)) throw new Error('Excel report is missing staff advance support: ' + token);
}
if (!html.includes("exportWorkbook({filename,sales,daily,expenses,staff,advances})")) {
  throw new Error('The app is not passing the Staff Advances register to the Excel exporter.');
}
const sw = await readFile(new URL('../sw.js', import.meta.url), 'utf8');
if (!sw.includes("'./prime-auto-care-logo.jpg'") || !sw.includes("'./prime-auto-care-car-photo.jpg'") || !sw.includes('washdesk-shell-v6')) {
  throw new Error('The offline app cache does not include the original Prime Auto Care logo.');
}
console.log('PASS: staff advances are included in Excel exports and the offline logo cache');

if (!html.includes("Files → Downloads → Prime Auto Care") ||
    !html.includes("relativePath:'Download/Prime Auto Care'") ||
    !html.includes('Downloads / Prime Auto Care folder')) {
  throw new Error('Prime Auto Care backup and invoice PDF save locations are inconsistent.');
}
if (html.includes('Files → Downloads → WashDesk') ||
    html.includes("relativePath:'Download/WashDesk'") ||
    html.includes('Downloads / WashDesk folder')) {
  throw new Error('A legacy WashDesk download location is still exposed to customers.');
}
console.log('PASS: invoice PDFs and full backups use the Prime Auto Care Downloads folder');

const sql = await readFile(new URL('../cloud-sync-setup.sql', import.meta.url), 'utf8');
for (const token of ['washdesk_merge_sync', 'security definer', 'for update', 'enable row level security', 'washdesk_next_invoice_number', 'washdesk_assert_unique_customer_keys', 'duplicate_customer_mobile', 'duplicate_vehicle_registration', 'staffadvances']) {
  if (!sql.toLowerCase().includes(token)) throw new Error('Cloud SQL security/consistency hook missing: ' + token);
}
if (!sql.includes("p_value ~ '^-?[0-9]+([.][0-9]+)?$' then")) throw new Error('Cloud SQL numeric validation regex is invalid.');
const phone0091Rule = String.raw`when digits ~ '^0091[0-9]{10}$' then right(digits, 10)`;
if (!sql.includes(phone0091Rule)) throw new Error('Cloud SQL does not normalise 0091-prefixed mobile numbers.');
console.log('PASS: cloud schema contains RLS, atomic row locking, and shared invoice counter');

if (!packageJson.dependencies['@andreeewill/exceljs'] || !packageJson.dependencies['@supabase/supabase-js'] || !packageJson.dependencies['pdfmake']) throw new Error('Excel, PDFMake or cloud-sync runtime dependency missing.');
console.log('PASS: Excel and Supabase sync dependencies declared');
console.log('Prime Auto Care validation complete.');
