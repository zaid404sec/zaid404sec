'use strict';

const STORE_KEY = 'washledger-data-v1';
const PAGE_TITLES = {
  dashboard: 'Overview', 'new-bill': 'New bill', invoices: 'Invoices', customers: 'Customers & vehicles',
  services: 'Services & products', inventory: 'Inventory', purchases: 'Purchases', expenses: 'Expenses',
  reports: 'Reports', staff: 'Staff & payroll', settings: 'Business settings'
};
const todayISO = () => new Date().toISOString().slice(0, 10);
const monthISO = () => todayISO().slice(0, 7);
const uid = () => 'id-' + Date.now().toString(36) + '-' + Math.random().toString(36).slice(2, 7);
const defaultState = () => ({
  version: 1,
  settings: {
    businessName: 'My Car Wash Centre', phone: '', address: '', gstin: '', state: 'Gujarat',
    invoicePrefix: 'CW-', nextInvoice: 1, gstEnabled: false, defaultTax: 0, taxMode: 'intra',
    currency: 'INR', paymentNote: 'Thank you for choosing us!'
  },
  customers: [], suppliers: [],
  services: [
    {id:uid(), name:'Exterior Wash', category:'Exterior', price:0, tax:0, active:true},
    {id:uid(), name:'Interior Cleaning', category:'Interior', price:0, tax:0, active:true},
    {id:uid(), name:'Full Car Wash', category:'Combo', price:0, tax:0, active:true},
    {id:uid(), name:'Foam Wash', category:'Exterior', price:0, tax:0, active:true},
    {id:uid(), name:'Vacuum Cleaning', category:'Interior', price:0, tax:0, active:true},
    {id:uid(), name:'Polishing', category:'Premium', price:0, tax:0, active:true}
  ],
  products: [], invoices: [], purchases: [], expenses: [], otherIncome: [], stockMovements: [], staff: [], salaryPayments: []
});
let db = loadDB();
let currentPage = 'dashboard';
let billDraft = [];
let reportMonth = monthISO();
let currentFilter = '';

function loadDB() {
  try {
    const raw = localStorage.getItem(STORE_KEY);
    if (!raw) return defaultState();
    const parsed = JSON.parse(raw);
    const base = defaultState();
    return {...base, ...parsed, settings:{...base.settings, ...(parsed.settings || {})}, customers:parsed.customers||[], suppliers:parsed.suppliers||[], staff:parsed.staff||[], salaryPayments:parsed.salaryPayments||[], services:parsed.services||base.services, products:parsed.products||[], invoices:parsed.invoices||[], purchases:parsed.purchases||[], expenses:parsed.expenses||[], otherIncome:parsed.otherIncome||[], stockMovements:parsed.stockMovements||[]};
  } catch (error) {
    console.error('Could not load saved data', error);
    return defaultState();
  }
}
function persist() {
  try { localStorage.setItem(STORE_KEY, JSON.stringify(db)); return true; }
  catch (error) { toast('Storage is full. Export a backup and remove old data.', true); console.error(error); return false; }
}
function money(value) {
  const n = Number(value || 0);
  return new Intl.NumberFormat('en-IN', {style:'currency', currency:db.settings.currency || 'INR', maximumFractionDigits:2}).format(Number.isFinite(n)?n:0);
}
function num(value) { const n = Number(value); return Number.isFinite(n) ? n : 0; }
function esc(value) { return String(value ?? '').replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c])); }
function dateFmt(value) { if (!value) return '—'; const d = new Date(value + 'T00:00:00'); return Number.isNaN(d.getTime()) ? value : d.toLocaleDateString('en-IN',{day:'2-digit',month:'short',year:'numeric'}); }
function invoiceNo() { return `${db.settings.invoicePrefix || 'CW-'}${String(db.settings.nextInvoice || 1).padStart(4,'0')}`; }
function toast(message, error=false) {
  const host = document.getElementById('toastHost'); if (!host) return;
  const node = document.createElement('div'); node.className = 'toast' + (error?' error':''); node.textContent = message; host.appendChild(node);
  setTimeout(()=>node.remove(), 3400);
}
function monthItems(items, field='date', month=monthISO()) { return items.filter(x => String(x[field]||'').slice(0,7) === month); }
function sum(items, field='total') { return items.reduce((a,x)=>a+num(x[field]),0); }
function paidAmount(inv) { return num(inv.paidAmount); }
function dueAmount(inv) { return Math.max(0, num(inv.total)-paidAmount(inv)); }
function invoiceStatus(inv) { if (inv.status==='cancelled') return 'Cancelled'; return dueAmount(inv) < .01 ? 'Paid' : paidAmount(inv) > 0 ? 'Partial' : 'Unpaid'; }
function statusPill(status) { const cls = status==='Paid'?'pill-paid':status==='Cancelled'?'pill-cancel':'pill-due'; return `<span class="pill ${cls}">${esc(status)}</span>`; }
function productById(id) { return db.products.find(p=>p.id===id); }
function serviceById(id) { return db.services.find(p=>p.id===id); }
function activeServices() { return db.services.filter(s=>s.active!==false); }
function render() {
  document.getElementById('sideBusinessName').textContent = db.settings.businessName || 'My Car Wash Centre';
  document.getElementById('pageCrumb').textContent = PAGE_TITLES[currentPage] || 'Overview';
  document.querySelectorAll('.nav-item').forEach(b=>b.classList.toggle('active',b.dataset.page===currentPage));
  const root = document.getElementById('pageContent');
  const views = {dashboard:renderDashboard,'new-bill':renderBill,invoices:renderInvoices,customers:renderCustomers,services:renderServices,inventory:renderInventory,purchases:renderPurchases,expenses:renderExpenses,reports:renderReports,staff:renderStaff,settings:renderSettings};
  root.innerHTML = (views[currentPage] || renderDashboard)();
  bindPageEvents();
}
function go(page) { currentPage=page; currentFilter=''; billDraft=[]; render(); document.getElementById('sidebar').classList.remove('open'); window.scrollTo({top:0,behavior:'smooth'}); }
function heading(title, subtitle, action='') { return `<div class="page-heading"><div><div class="eyebrow">WASHLEDGER WORKSPACE</div><h1>${title}</h1><p>${subtitle}</p></div><div class="heading-actions">${action}</div></div>`; }
function emptyState(icon,title,description,button='') { return `<div class="empty-state"><div class="empty-icon">${icon}</div><strong>${esc(title)}</strong><div style="margin-top:5px">${esc(description)}</div>${button?`<div class="mt-12">${button}</div>`:''}</div>`; }
function stat(label,value,icon,foot='',tone='') { return `<div class="stat-card"><div class="stat-top"><span>${label}</span><span class="stat-icon">${icon}</span></div><div class="stat-value ${tone}">${value}</div><div class="stat-foot">${foot}</div></div>`; }
function rowTitle(main,sub='') { return `<div class="td-main">${esc(main)}</div>${sub?`<div class="td-sub">${esc(sub)}</div>`:''}`; }
