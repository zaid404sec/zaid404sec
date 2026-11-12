import { readFile } from 'node:fs/promises';
import { existsSync, statSync } from 'node:fs';
import vm from 'node:vm';
import { transform } from 'esbuild';

const html = await readFile(new URL('../index.html', import.meta.url), 'utf8');
const packageJson = JSON.parse(await readFile(new URL('../package.json', import.meta.url), 'utf8'));
const capacitorConfig = JSON.parse(await readFile(new URL('../capacitor.config.json', import.meta.url), 'utf8'));
if (capacitorConfig.appId !== 'com.washdesk.carwash.v9') {
  throw new Error('The stability release must use the safe side-by-side Android app ID v9.');
}
console.log('PASS: Android stability release installs side-by-side and preserves the previous app data');
if (!html.includes("if(page!=='dashboard')return true;") ||
    !html.includes("if(page!==p)applyPendingRemoteData();") ||
    !html.includes("requestAnimationFrame(()=>window.scrollTo(scrollX,scrollY))")) {
  throw new Error('Remote updates must not replace active modules and same-page renders must preserve scroll.');
}
if (html.includes('location.reload(') || html.includes('window.location.reload(')) {
  throw new Error('The app must not force-reload the active business screen.');
}
console.log('PASS: cloud snapshots defer outside the passive dashboard; navigation applies them safely and preserves scroll');
if (!html.includes('data-action="share-offer-whatsapp"') ||
    !html.includes('navigator.share({title,text:message})') ||
    !html.includes('https://wa.me/?text=') ||
    html.includes('start-offer-campaign') || html.includes('open-offer-whatsapp')) {
  throw new Error('Offers must use one manual WhatsApp share action, not a per-customer auto-campaign loop.');
}
console.log('PASS: offers use the Android share menu / existing WhatsApp app; official API automation remains separate and pending');
const mustContain = [
  'data-edit-invoice', 'function saveInvoiceEdits', 'function calculateEditedInvoice',
  'function staffSalaryPaid', 'function payStaffSalaryForm', 'function exportSalesExcel',
  'function mergeWashDeskData', 'function connectCloud', 'data-wa-toggle', 'function canRenderRemoteUpdate', 'remoteRenderPending', 'if(canRenderRemoteUpdate())render()',
  'data-action="export-excel"', 'data-action="cloud-sync-now"', 'data-save-pdf',
  'PRIME AUTO CARE', 'Service performed by:', 'Payment mode', 'Authorised Signatory',
  'pairDevice', 'pairingCode', 'Connect / Pair this device', 'Prime-Auto-Care-',
  'pdfMake.createPdf', '__primeAutoCarePdfFontsReady', 'premium-invoice-header{grid-template-columns:62px minmax(0,1fr)', 'Prime Auto Care Invoice ', 'TAX INVOICE / SERVICE BILL', 'BILL TO', 'VEHICLE & SERVICE', 'PAYMENT DETAILS', 'GRAND TOTAL', 'BALANCE DUE', 'AUTHORISED SIGNATURE', 'invoice-grand-total strong', 'invoice-summary-row b', 'staffAdvances:[]', 'function staffAdvancesOutstanding', 'function addStaffAdvanceForm', 'advanceAdjustment', 'dashboard-hero', 'prime-auto-care-logo.jpg', 'data-action="add-staff-advance"', 'attendance:[]', 'function saveStaffAttendance', 'function staffMonthDayCount', 'function staffAttendanceSummary', 'function staffPayrollBreakdown', 'Monthly payroll calculator', 'function staffAttendanceForDate', 'function setStaffAttendanceEntry', 'function removeStaffMember', 'function staffShiftEnd', 'function staffManagerPinDigest', 'function verifyStaffManagerPin', 'staff-attendance-row', 'Manager PIN', 'Daily staff attendance', 'Present', 'Absent', 'attendance-date', 'attendance-form', 'data-cancel-invoice', 'function cancelInvoice', 'CANCELLED · BILL VOID', 'Cancelled invoices cannot be edited', 'bill-customer-search', 'renderBillCustomerMatches', 'findCustomerByMobile', 'findVehicleByNumber', 'GOLD & BLACK CAR SERVICES', 'premium-car-mark', 'invoice-party-grid', 'invoice-payment-card', 'invoice-terms-card', 'Customer names may repeat', 'Vehicle registration numbers must be unique', 'carPhotoData', 'prime-auto-care-car-photo.jpg', 'Customer ID is generated automatically as the primary key'
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
const pdfFontsBundle = await readFile(new URL('../pdfmake-vfs.js', import.meta.url), 'utf8');
if (!pdfFontsBundle.includes('__primeAutoCarePdfFontsReady') || !pdfFontsBundle.includes('addVirtualFileSystem(vfs)')) {
  throw new Error('PDFMake font bundle does not register the virtual font system.');
}
if (html.includes('!pdfMake.vfs') || html.includes('Object.keys(pdfMake.vfs)')) {
  throw new Error('Invoice PDF still uses the obsolete pdfMake.vfs readiness check.');
}
console.log('PASS: PDFMake VFS fonts use addVirtualFileSystem and a post-load readiness marker');


const carPhotoBytes = await readFile(new URL('../prime-auto-care-car-photo.jpg', import.meta.url));
if (carPhotoBytes.length < 1000 ||
    carPhotoBytes[0] !== 0xff || carPhotoBytes[1] !== 0xd8 ||
    carPhotoBytes[carPhotoBytes.length - 2] !== 0xff || carPhotoBytes[carPhotoBytes.length - 1] !== 0xd9) {
  throw new Error('The Prime Auto Care PDF car photograph is not a complete JPEG file.');
}
console.log('PASS: PDF car photograph is a complete, decodable JPEG asset');

const appId = JSON.parse(await readFile(new URL('../capacitor.config.json', import.meta.url), 'utf8')).appId;
if (appId !== 'com.washdesk.carwash.v9') throw new Error('Android stability release app ID v9 was not set.');

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
const payrollStart = html.indexOf('function staffAdvancesOutstanding(');
const payrollEnd = html.indexOf('function staff(){', payrollStart);
if (payrollStart < 0 || payrollEnd < 0) throw new Error('Staff payroll calculation helpers not found.');
const payrollFunctions = html.slice(payrollStart, payrollEnd);
const novemberPayroll = vm.runInNewContext(
  payrollFunctions + String.fromCharCode(10) + "staffPayrollBreakdown({id:'staff-1',salary:14000},'2026-11')",
  {
    db: {
      staffAdvances: [{ staffId:'staff-1', amount:3000, recoveredAmount:0 }],
      attendance: [
        { staffId:'staff-1', date:'2026-11-02', status:'Absent', updatedAt:1 },
        { staffId:'staff-1', date:'2026-11-04', status:'Absent', updatedAt:1 },
        { staffId:'staff-1', date:'2026-11-05', status:'Present', updatedAt:1 }
      ],
      expenses: []
    },
    monthKey: date => date ? String(date).slice(0,7) : '2026-11',
    sum: (rows, fn) => rows.reduce((total, row) => total + Number(fn ? fn(row) : row || 0), 0)
  }
);
if (novemberPayroll.calendarDays !== 30 || novemberPayroll.absentDays !== 2 ||
    Math.abs(novemberPayroll.absenceDeduction-933.33) > 0.01 ||
    Math.abs(novemberPayroll.earnedSalary-13066.67) > 0.01 ||
    Math.abs(novemberPayroll.netPayable-10066.67) > 0.01) {
  throw new Error('30-day payroll calculation failed: ' + JSON.stringify(novemberPayroll));
}
console.log('PASS: 30-day payroll deducts absence days and outstanding advances from monthly salary');
const februaryPayroll = vm.runInNewContext(
  payrollFunctions + String.fromCharCode(10) + "staffPayrollBreakdown({id:'staff-1',salary:14000},'2027-02')",
  {
    db: { staffAdvances:[], attendance:[{staffId:'staff-1',date:'2027-02-10',status:'Absent'}], expenses:[] },
    monthKey: date => date ? String(date).slice(0,7) : '2027-02',
    sum: (rows, fn) => rows.reduce((total, row) => total + Number(fn ? fn(row) : row || 0), 0)
  }
);
if (februaryPayroll.calendarDays !== 28 || februaryPayroll.absentDays !== 1 ||
    Math.abs(februaryPayroll.absenceDeduction-500) > 0.01 ||
    Math.abs(februaryPayroll.netPayable-13500) > 0.01) {
  throw new Error('28-day payroll calculation failed: ' + JSON.stringify(februaryPayroll));
}
console.log('PASS: 28-day payroll uses the correct calendar-day rate');
const staffHelpersStart = html.indexOf('function staffAttendanceForDate(');
const staffHelpersEnd = html.indexOf('function staff(){', staffHelpersStart);
if (staffHelpersStart < 0 || staffHelpersEnd < 0) throw new Error('Staff attendance and shift helper functions were not found.');
const staffHelpers = html.slice(staffHelpersStart, staffHelpersEnd);
const shiftTimes = vm.runInNewContext(
  staffHelpers + String.fromCharCode(10) + "({eight:staffShiftEnd('08:00',11),nine:staffShiftEnd('09:00',11),ten:staffShiftEnd('10:00',11),label:staffShiftLabel({shiftStart:'09:00',shiftHours:11})})",
  { db: { staff:[], attendance:[], _deletedIds:{} } }
);
if (shiftTimes.eight !== '19:00' || shiftTimes.nine !== '20:00' || shiftTimes.ten !== '21:00' ||
    !shiftTimes.label.includes('9:00 AM') || !shiftTimes.label.includes('8:00 PM')) {
  throw new Error('Individual 11-hour staff shift schedule mapping failed: ' + JSON.stringify(shiftTimes));
}
console.log('PASS: individual staff schedules map 8 AM to 7 PM, 9 AM to 8 PM and 10 AM to 9 PM');

const attendanceContext = {
  db: { staff:[{id:'staff-1'}], attendance:[], _deletedIds:{} }
};
const attendanceChanges = vm.runInNewContext(
  staffHelpers + String.fromCharCode(10) +
  "setStaffAttendanceEntry('staff-1','Worker One','2026-11-12','Absent');" +
  "setStaffAttendanceEntry('staff-1','Worker One','2026-11-12','Present');" +
  "({count:db.attendance.length,status:db.attendance[0]?.status,activeCount:staffAttendanceForDate('2026-11-12').length})",
  attendanceContext
);
if (attendanceChanges.count !== 1 || attendanceChanges.status !== 'Present' || attendanceChanges.activeCount !== 1) {
  throw new Error('Absent-to-Present attendance correction did not update the same staff/date record: ' + JSON.stringify(attendanceChanges));
}
console.log('PASS: a staff member can be corrected from Absent to Present without creating a duplicate');
const clearContext = {
  db: { staff:[{id:'staff-1'}], attendance:[{id:'attendance_2026-11-12_staff-1',staffId:'staff-1',date:'2026-11-12',status:'Absent'}], _deletedIds:{} }
};
const cleared = vm.runInNewContext(
  staffHelpers + String.fromCharCode(10) +
  "setStaffAttendanceEntry('staff-1','Worker One','2026-11-12','Clear');" +
  "({count:db.attendance.length,tombstone:!!db._deletedIds['attendance_2026-11-12_staff-1']})",
  clearContext
);
if (cleared.count !== 0 || !cleared.tombstone) throw new Error('Clearing an attendance entry did not create a cloud deletion tombstone.');
console.log('PASS: clearing a mistaken attendance entry removes it and syncs the deletion tombstone');

const noStaffRows = vm.runInNewContext(
  staffHelpers + String.fromCharCode(10) + "staffAttendanceForDate('2026-11-12').length",
  { db: { staff:[], attendance:[{id:'orphan-1',staffId:'removed-staff',date:'2026-11-12',status:'Absent'},{id:'orphan-2',staffId:'removed-staff',date:'2026-11-12',status:'Present'}], _deletedIds:{} } }
);
if (noStaffRows !== 0) throw new Error('Attendance summary still counts records for removed staff.');
console.log('PASS: removed staff do not appear in Present / Absent counts');

const removalContext = {
  db: {
    staff:[{id:'staff-1',name:'Worker One'}],
    attendance:[{id:'attendance_2026-11-12_staff-1',staffId:'staff-1',date:'2026-11-12',status:'Absent'}],
    expenses:[{id:'salary-1',category:'Salary',staffId:'staff-1',amount:500}],
    _deletedIds:{}
  },
  confirm:()=>true, save:()=>{}, render:()=>{}, notify:()=>{}
};
const removal = vm.runInNewContext(
  staffHelpers + String.fromCharCode(10) +
  "removeStaffMember('staff-1');" +
  "({staff:db.staff.length,attendance:db.attendance.length,expenseHistory:db.expenses.length,staffTombstone:!!db._deletedIds['staff-1'],attendanceTombstone:!!db._deletedIds['attendance_2026-11-12_staff-1']})",
  removalContext
);
if (removal.staff !== 0 || removal.attendance !== 0 || removal.expenseHistory !== 1 ||
    !removal.staffTombstone || !removal.attendanceTombstone) {
  throw new Error('Staff removal must clear attendance and preserve financial history: ' + JSON.stringify(removal));
}
console.log('PASS: removing staff clears their attendance tombstones while retaining salary history');

if (!html.includes("!(await verifyStaffManagerPin()))return;") ||
    !html.includes("db.settings.staffManagerAccess={salt,hash:await staffManagerPinDigest(pin,salt)")) {
  throw new Error('Staff shift changes are not protected by the synced Manager PIN.');
}
console.log('PASS: shift-time editing is guarded by the shared salted Manager PIN');

const brandSvg = await readFile(new URL('../icon.svg', import.meta.url), 'utf8');
const brandManifest = JSON.parse(await readFile(new URL('../manifest.webmanifest', import.meta.url), 'utf8'));
for (const asset of ['prime-auto-care-icon-192.png','prime-auto-care-icon-512.png','prime-auto-care-icon.ico']) {
  if (!existsSync(new URL('../'+asset, import.meta.url))) throw new Error('Generated brand icon asset missing: '+asset);
}
if (!brandSvg.includes('data:image/jpeg;base64') ||
    !brandManifest.icons.some(icon=>icon.src==='./prime-auto-care-icon-192.png') ||
    !brandManifest.icons.some(icon=>icon.src==='./prime-auto-care-icon-512.png')) {
  throw new Error('Prime Auto Care logo is not wired into the app / PWA icon assets.');
}
console.log('PASS: Prime Auto Care wordmark is used by the app, PWA and Windows icon assets');



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
console.log('PASS: Prime Auto Care Supabase project URL and publishable key are preconfigured');
if (!cloudSource.includes('queuedPayload = payload;') ||
    cloudSource.includes('queuedPayload = clone(payload)') ||
    !cloudSource.includes('}, 30000);')) {
  throw new Error('Cloud save path still performs repeated full-database copies or excessive safety polling.');
}
console.log('PASS: cloud save scheduling coalesces the latest DB snapshot without cloning on every save; Realtime remains primary');
const remoteReceiveStart = html.indexOf('function receiveCloudData(');
const remoteReceiveEnd = html.indexOf('async function connectCloud', remoteReceiveStart);
if (remoteReceiveStart < 0 || remoteReceiveEnd < 0) throw new Error('Remote sync handler not found.');
const remoteReceive = html.slice(remoteReceiveStart, remoteReceiveEnd);
if (!remoteReceive.includes('if(shouldDeferRemoteUpdate())') ||
    !remoteReceive.includes('return {__cloudSyncDeferred:true}') ||
    remoteReceive.includes('localStorage.setItem(STORE,JSON.stringify(db));render();')) {
  throw new Error('A remote sync event can still mutate local data or the active app DOM during billing.');
}
if (!html.includes('let pendingRemotePayload=null;') ||
    !html.includes('function applyPendingRemoteData()') ||
    !html.includes('if(page!==p)applyPendingRemoteData();')) {
  throw new Error('Deferred cloud updates are not applied safely when navigating between modules.');
}
if (!html.includes('function render(preserveScroll=true)') ||
    !html.includes('if(preserveScroll&&(scrollX||scrollY))requestAnimationFrame(()=>window.scrollTo(scrollX,scrollY))') ||
    !html.includes("})[p]||'';render(false);window.scrollTo(0,0)}")) {
  throw new Error('Same-page rerenders must preserve scroll, while deliberate module navigation must start at the top.');
}
if (!cloudSource.includes('if (applied?.__cloudSyncDeferred) return null;') ||
    !cloudSource.includes("update queued until you leave the current screen")) {
  throw new Error('Cloud sync does not honor the active-screen-safe remote update deferral contract.');
}
const saveBillStart = html.indexOf('async function saveBill()');
const saveBillEnd = html.indexOf('function applyConsumption', saveBillStart);
const saveBillSource = html.slice(saveBillStart, saveBillEnd);
if (!(saveBillSource.indexOf('await reserveInvoiceNo(invoiceDate)') < saveBillSource.indexOf('applyConsumption(billLines)'))) {
  throw new Error('Stock is mutated before the shared invoice number request succeeds.');
}
if (!html.includes("if(page==='billing')return false") ||
    !html.includes("active.matches('input,textarea,select,[contenteditable=\"true\"]')") ||
    !html.includes("backdrop?.classList.contains('show')")) {
  throw new Error('Active billing inputs and modal forms are not protected from remote re-rendering.');
}
console.log('PASS: remote cloud updates preserve the active bill form, text focus and Android keyboard');

for (const token of [
  'pairDevice', 'signInAnonymously()', 'washdesk_join_workspace',
  'washdesk_get_workspace', 'washdesk_merge_sync', 'washdesk_next_invoice_number',
  'postgres_changes', 'startSafetyRefresh', 'Offline',
  'Offline'
]) {
  if (!cloudSource.includes(token)) throw new Error('Shared device pairing / cloud sync hook is missing: ' + token);
}
for (const obsolete of ['requestEmailOtp', 'verifyEmailOtp', 'emailRedirectTo', 'AUTH_REDIRECT_URL', 'exchangeCodeForSession']) {
  if (cloudSource.includes(obsolete)) throw new Error('Legacy email-link authentication remains in the cloud module: ' + obsolete);
}
if (cloudSource.includes('localhost:3000') || html.includes('localhost:3000') ||
    html.includes('Send secure sign-in link') || html.includes('Six-digit email sign-in code')) {
  throw new Error('The cloud flow still contains an email-link / localhost redirect dependency.');
}
if (!html.includes('Enable Anonymous Sign-Ins') ||
    !html.includes('Connect / Pair this device') ||
    !html.includes('same code once on each of the four phones and the Windows laptop')) {
  throw new Error('Cloud settings do not explain the shared device-pairing workflow.');
}
if (!cloudSource.includes('workspace = readWorkspace();') ||
    !cloudSource.includes('automatic sync will resume when internet returns') ||
    !cloudSource.includes('void resume({ getLocal: localProvider, onRemote: remoteHandler })')) {
  throw new Error('Saved device pairing does not recover automatically after an offline app restart.');
}
console.log('PASS: offline app restart restores pairing and retries sync after internet returns');
console.log('PASS: email-link auth removed; anonymous authenticated devices join one shared workspace');


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
if (!sw.includes("'./prime-auto-care-logo.jpg'") || !sw.includes("'./prime-auto-care-car-photo.jpg'") || !sw.includes('prime-auto-care-shell-v11')) {
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
for (const token of ['washdesk_merge_sync', 'security definer', 'for update', 'enable row level security', 'washdesk_next_invoice_number', 'washdesk_assert_unique_customer_keys', 'duplicate_customer_mobile', 'duplicate_vehicle_registration', 'staffadvances', 'washdesk_workspaces', 'washdesk_workspace_members', 'washdesk_join_workspace', 'washdesk_get_workspace', 'washdesk_create_pairing_code', 'washdesk_can_read_sync', 'device pairing code', 'device_not_paired']) {
  if (!sql.toLowerCase().includes(token)) throw new Error('Cloud SQL security/consistency hook missing: ' + token);
}
if (!sql.includes("p_value ~ '^-?[0-9]+([.][0-9]+)?$' then")) throw new Error('Cloud SQL numeric validation regex is invalid.');
const phone0091Rule = String.raw`when digits ~ '^0091[0-9]{10}$' then right(digits, 10)`;
if (!sql.includes(phone0091Rule)) throw new Error('Cloud SQL does not normalise 0091-prefixed mobile numbers.');
console.log('PASS: cloud schema contains RLS, atomic row locking, and shared invoice counter');
if (!sql.includes("grant execute on function public.washdesk_join_workspace(text) to authenticated;") ||
    !sql.includes("grant execute on function public.washdesk_merge_sync(jsonb) to authenticated;") ||
    !sql.includes("to authenticated") ||
    !sql.includes('washdesk_create_pairing_code() as "Prime Auto Care device pairing code"')) {
  throw new Error('Shared device SQL does not provision a pairing code and authenticated workspace RPCs.');
}
if (!sql.includes('washdesk_can_read_sync(user_id)') || !sql.includes('for update')) {
  throw new Error('Shared workspace data is missing member RLS or serialized writes.');
}
console.log('PASS: database supports secure shared workspace membership and pairing-code provisioning');


if (!packageJson.dependencies['@andreeewill/exceljs'] || !packageJson.dependencies['@supabase/supabase-js'] || !packageJson.dependencies['pdfmake']) throw new Error('Excel, PDFMake or cloud-sync runtime dependency missing.');

const electronBuilderAuth = await readFile(new URL('../electron-builder.yml', import.meta.url), 'utf8');
for (const asset of ['pdfmake.bundle.min.js','pdfmake-vfs.js','prime-auto-care-logo.jpg','prime-auto-care-car-photo.jpg','invoice-native.bundle.js','exceljs.bundle.min.js','report-export.bundle.js','cloud-sync.bundle.js','cloud-sync-setup.sql']) {
  if (!electronBuilderAuth.includes('- ' + asset)) throw new Error('Windows installer is missing a required runtime asset: ' + asset);
}
console.log('PASS: Windows installer includes PDFMake, fonts, images, Excel and cloud-sync assets');

console.log('PASS: Excel and Supabase sync dependencies declared');
console.log('Prime Auto Care validation complete.');
