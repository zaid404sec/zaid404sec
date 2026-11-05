function renderDashboard() {
  const month = monthISO();
  const invoices = monthItems(db.invoices).filter(i=>i.status!=='cancelled');
  const expenses = monthItems(db.expenses);
  const revenue = sum(invoices);
  const received = invoices.reduce((a,i)=>a+paidAmount(i),0);
  const expenseTotal = sum(expenses,'amount');
  const outstanding = db.invoices.filter(i=>i.status!=='cancelled').reduce((a,i)=>a+dueAmount(i),0);
  const lowStock = db.products.filter(p=>num(p.stock)<=num(p.minStock));
  const recent = [...db.invoices].sort((a,b)=>(b.createdAt||'').localeCompare(a.createdAt||'')).slice(0,6);
  const invoiceRows = recent.length ? `<div class="table-wrap"><table><thead><tr><th>INVOICE</th><th>CUSTOMER / VEHICLE</th><th>DATE</th><th>AMOUNT</th><th>STATUS</th></tr></thead><tbody>${recent.map(i=>`<tr><td>${rowTitle(i.number)}</td><td>${rowTitle(i.customerName, i.vehicleReg||i.vehicleType||'')}</td><td>${dateFmt(i.date)}</td><td class="amount">${money(i.total)}</td><td>${statusPill(invoiceStatus(i))}</td></tr>`).join('')}</tbody></table></div>` : emptyState('▤','No invoices yet','Create your first bill to start tracking sales.','<button class="btn btn-primary" data-go="new-bill">＋ Create first bill</button>');
  return `${heading('Good ${greeting()}, '+esc((db.settings.businessName||'').split(' ')[0])+' 👋','Here is what is happening in your business this month.','<button class="btn btn-primary" data-go="new-bill">＋ New bill</button>')}
    <div class="stats-grid">${stat('SALES THIS MONTH',money(revenue),'↗',`${invoices.length} invoice(s) created`,'')}${stat('PAYMENTS RECEIVED',money(received),'₹','Cash, UPI and other receipts','green')}${stat('BUSINESS EXPENSES',money(expenseTotal),'↘',`${expenses.length} expense entry/entries`,'')}${stat('CUSTOMER DUES',money(outstanding),'◷','Across all unpaid invoices',outstanding?'amber':'green')}</div>
    <div class="dashboard-grid"><div><section class="panel"><div class="panel-head"><div><div class="panel-title">Recent invoices</div><div class="panel-sub">Latest billing activity</div></div><button class="mini-link" data-go="invoices">View all →</button></div>${invoiceRows}</section>
    <section class="panel"><div class="panel-head"><div><div class="panel-title">Stock attention</div><div class="panel-sub">Items at or below minimum stock level</div></div><button class="mini-link" data-go="inventory">Open inventory →</button></div>${lowStock.length?`<div class="table-wrap"><table><thead><tr><th>ITEM</th><th>AVAILABLE</th><th>MINIMUM</th><th>STATUS</th></tr></thead><tbody>${lowStock.slice(0,5).map(p=>`<tr><td>${rowTitle(p.name,p.sku||'')}</td><td class="amount">${num(p.stock)} ${esc(p.unit)}</td><td>${num(p.minStock)}</td><td><span class="pill pill-low">Low stock</span></td></tr>`).join('')}</tbody></table></div>`:emptyState('▣','Stock looks good','No items are currently below their minimum level.')}</section></div>
    <div><section class="panel"><div class="panel-head"><div><div class="panel-title">Quick actions</div><div class="panel-sub">Common tasks, one tap away</div></div></div><div class="quick-grid"><button class="quick-action" data-go="new-bill"><span>＋</span><b>Create a bill</b><small>Start a customer invoice</small></button><button class="quick-action" data-go="customers"><span>♙</span><b>Add customer</b><small>Save customer details</small></button><button class="quick-action" data-go="inventory"><span>▣</span><b>Update stock</b><small>Record stock received or used</small></button><button class="quick-action" data-go="expenses"><span>↗</span><b>Add expense</b><small>Record business spending</small></button></div></section>
    <section class="panel"><div class="panel-head"><div><div class="panel-title">Monthly snapshot</div><div class="panel-sub">${new Date().toLocaleDateString('en-IN',{month:'long',year:'numeric'})}</div></div><button class="mini-link" data-go="reports">Full report →</button></div><div class="totals-row"><span>Invoices issued</span><strong>${invoices.length}</strong></div><div class="totals-row"><span>Payments received</span><strong class="green">${money(received)}</strong></div><div class="totals-row"><span>Expenses recorded</span><strong>${money(expenseTotal)}</strong></div><div class="totals-row total"><span>Cash after expenses*</span><strong>${money(received-expenseTotal)}</strong></div><div class="notice mt-12">*Cash movement estimate only. It excludes inventory valuation, taxes and other accounting adjustments. Use the Reports page for the detailed view.</div></section>
    <section class="panel"><div class="panel-title">Keep your records safe</div><p class="panel-sub">Your current data is stored in this browser on this device.</p><button class="btn btn-block mt-12" data-action="backup">⇩ Download backup</button></section></div></div>`;
}
function greeting() { const h=new Date().getHours(); return h<12?'morning':h<17?'afternoon':'evening'; }
function renderBill() {
  const active = activeServices();
  const serviceOpts = active.map(s=>`<option value="service:${s.id}">${esc(s.name)} · ${money(s.price)}</option>`).join('');
  const productOpts = db.products.map(p=>`<option value="product:${p.id}">${esc(p.name)} · ${money(p.salePrice)} · ${num(p.stock)} ${esc(p.unit)} in stock</option>`).join('');
  const customerOpts = db.customers.map(c=>`<option value="${esc(c.id)}">${esc(c.name)}${c.phone?' · '+esc(c.phone):''}</option>`).join('');
  return `${heading('Create a new bill','Add the customer, vehicle and services. The bill number is generated automatically.','<button class="btn" data-go="invoices">View invoices</button>')}
    <div class="bill-layout"><div><section class="panel"><div class="panel-head"><div><div class="panel-title">Customer & vehicle</div><div class="panel-sub">Select a saved customer or enter a new one.</div></div><span class="pill pill-ok">${esc(invoiceNo())}</span></div>
      <div class="form-grid"><div class="field"><label>Saved customer</label><select id="billCustomer"><option value="">New customer / walk-in</option>${customerOpts}</select></div><div class="field"><label>Customer name *</label><input id="billName" placeholder="Customer name" autocomplete="name"></div><div class="field"><label>Mobile / WhatsApp number</label><input id="billPhone" placeholder="10-digit mobile number" inputmode="tel"></div><div class="field"><label>Vehicle registration number</label><input id="billVehicle" placeholder="e.g. GJ05AB1234" style="text-transform:uppercase"></div><div class="field"><label>Vehicle type</label><select id="billVehicleType"><option>Hatchback</option><option>Sedan</option><option>SUV</option><option>Premium / Luxury</option><option>Taxi</option><option>Commercial vehicle</option><option>Two-wheeler</option><option>Other</option></select></div><div class="field"><label>Bill date</label><input type="date" id="billDate" value="${todayISO()}"></div></div>
    </section>
    <section class="panel"><div class="panel-head"><div><div class="panel-title">Services & items</div><div class="panel-sub">Add washing services or products used / sold.</div></div></div>
      <div class="line-add-row"><div class="field"><label>Choose service / product</label><select id="billItem"><option value="">Select an item</option><optgroup label="Washing services">${serviceOpts}</optgroup>${productOpts?`<optgroup label="Products">${productOpts}</optgroup>`:''}</select></div><div class="field"><label>Quantity</label><input id="billQty" type="number" min="0.01" step="0.01" value="1"></div><div class="field"><label>Unit price (₹)</label><input id="billPrice" type="number" min="0" step="0.01" placeholder="0.00"></div><button class="btn btn-primary" id="addBillLine">＋ Add</button></div>
      <div id="billLineList" class="mt-12">${billLinesHTML()}</div>
      <div class="field mt-12"><label>Notes (optional)</label><input id="billNotes" placeholder="e.g. Customer requested extra interior cleaning"></div>
    </section></div>
    <aside class="panel bill-summary"><div class="panel-title">Bill summary</div><div class="panel-sub">Check totals before saving.</div>
      <div class="field mt-12"><label>Discount (₹)</label><input id="billDiscount" type="number" min="0" step="0.01" value="0"></div>
      <div class="field mt-12"><label>Payment received (₹)</label><input id="billPaid" type="number" min="0" step="0.01" value="0"></div>
      <div class="field mt-12"><label>Payment method</label><select id="billMethod"><option>Cash</option><option>UPI</option><option>Card</option><option>Bank transfer</option><option>Credit / Due</option></select></div>
      <div id="billTotals" class="mt-12">${billTotalsHTML()}</div>
      <button class="btn btn-primary btn-block mt-12" id="saveBill">Save invoice</button>
      <div class="notice warning mt-12">Tax is ${db.settings.gstEnabled?'enabled in settings':'off by default'}. Confirm your GST registration and applicable tax rates with your accountant before issuing tax invoices.</div>
    </aside></div>`;
}
function calcBill() {
  const subtotal = billDraft.reduce((a,l)=>a+l.qty*l.price,0);
  const discount = Math.min(subtotal,Math.max(0,num(document.getElementById('billDiscount')?.value)));
  const taxable = Math.max(0,subtotal-discount);
  let tax = 0;
  if (db.settings.gstEnabled) {
    const raw = billDraft.reduce((a,l)=>a+(l.qty*l.price)*(num(l.tax)/100),0);
    tax = raw * (subtotal ? taxable/subtotal : 0);
  }
  const cgst=db.settings.taxMode==='intra'?tax/2:0; const sgst=db.settings.taxMode==='intra'?tax/2:0; const igst=db.settings.taxMode==='inter'?tax:0; return {subtotal,discount,tax,cgst,sgst,igst,total:Math.max(0,taxable+tax)};
}
function billLinesHTML() {
  if (!billDraft.length) return `<div class="empty-state" style="padding:22px"><div class="empty-icon">＋</div><strong>No items added</strong><div style="margin-top:5px">Choose a service or product above.</div></div>`;
  return `<div class="bill-line" style="font-size:9px;color:#8a96a9;font-weight:800"><span>ITEM</span><span>QTY</span><span>PRICE</span><span class="right">TOTAL</span><span></span></div>${billDraft.map((l,i)=>`<div class="bill-line"><span>${esc(l.name)}<div class="td-sub">${l.kind==='product'?'Product':'Service'}</div></span><span>${l.qty}</span><span>${money(l.price)}</span><strong class="right">${money(l.qty*l.price)}</strong><button type="button" data-remove-line="${i}" aria-label="Remove item">×</button></div>`).join('')}`;
}
function billTotalsHTML() {
  const t=calcBill(); const taxCaption=db.settings.gstEnabled?'Tax':'Tax (off)';
  return `<div class="totals-row"><span>Subtotal</span><strong>${money(t.subtotal)}</strong></div><div class="totals-row"><span>Discount</span><strong>− ${money(t.discount)}</strong></div>${db.settings.gstEnabled?(db.settings.taxMode==='intra'?`<div class="totals-row"><span>CGST</span><strong>${money(t.cgst)}</strong></div><div class="totals-row"><span>SGST</span><strong>${money(t.sgst)}</strong></div>`:`<div class="totals-row"><span>IGST</span><strong>${money(t.igst)}</strong></div>`):`<div class="totals-row"><span>${taxCaption}</span><strong>${money(t.tax)}</strong></div>`}<div class="totals-row total"><span>Grand total</span><strong>${money(t.total)}</strong></div><div class="totals-row"><span>Balance after payment</span><strong>${money(Math.max(0,t.total-num(document.getElementById('billPaid')?.value)))}</strong></div>`;
}
function refreshBillLines() { const e=document.getElementById('billLineList'); if(e)e.innerHTML=billLinesHTML(); const t=document.getElementById('billTotals'); if(t)t.innerHTML=billTotalsHTML(); }
function addBillLine() {
  const value=document.getElementById('billItem')?.value; if(!value){toast('Select a service or product first.',true);return;}
  const qty=num(document.getElementById('billQty').value); if(qty<=0){toast('Quantity must be greater than zero.',true);return;}
  const [kind,id]=value.split(':'); let item=kind==='service'?serviceById(id):productById(id); if(!item){toast('Selected item was not found.',true);return;}
  const priceInput=document.getElementById('billPrice').value; const price=priceInput===''?num(kind==='service'?item.price:item.salePrice):num(priceInput);
  if(price<0){toast('Price cannot be negative.',true);return;}
  if(kind==='product' && qty>num(item.stock)){toast(`Only ${item.stock} ${item.unit} available for ${item.name}.`,true);return;}
  billDraft.push({id:uid(),refId:id,kind,name:item.name,qty,price,tax:num(item.tax),costUnit:num(item.cost)});
  document.getElementById('billItem').value=''; document.getElementById('billQty').value='1'; document.getElementById('billPrice').value=''; refreshBillLines();
}
function saveBill() {
  if(!billDraft.length){toast('Add at least one service or product.',true);return;}
  const name=document.getElementById('billName').value.trim(); const phone=document.getElementById('billPhone').value.trim();
  if(!name){toast('Enter the customer name.',true);document.getElementById('billName').focus();return;}
  for(const line of billDraft){if(line.kind==='product'){const p=productById(line.refId);if(!p||num(p.stock)<line.qty){toast(`Insufficient stock for ${line.name}. Update stock first.`,true);return;}}}
  const t=calcBill(); const paid=Math.min(t.total,Math.max(0,num(document.getElementById('billPaid').value)));
  const customerId=document.getElementById('billCustomer').value;
  let customer=db.customers.find(c=>c.id===customerId) || db.customers.find(c=>phone && String(c.phone||'').replace(/\D/g,'')===phone.replace(/\D/g,''));
  if(!customer){customer={id:uid(),name,phone,vehicleReg:document.getElementById('billVehicle').value.trim().toUpperCase(),vehicleType:document.getElementById('billVehicleType').value,createdAt:new Date().toISOString()};db.customers.push(customer);}
  else {customer.name=name;customer.phone=phone||customer.phone;customer.vehicleReg=document.getElementById('billVehicle').value.trim().toUpperCase()||customer.vehicleReg;customer.vehicleType=document.getElementById('billVehicleType').value||customer.vehicleType;}
  const date=document.getElementById('billDate').value||todayISO();
  const inv={id:uid(),number:invoiceNo(),date,createdAt:new Date().toISOString(),customerId:customer.id,customerName:name,phone,vehicleReg:document.getElementById('billVehicle').value.trim().toUpperCase(),vehicleType:document.getElementById('billVehicleType').value,lines:billDraft.map(l=>({...l})),subtotal:t.subtotal,discount:t.discount,tax:t.tax,cgst:t.cgst,sgst:t.sgst,igst:t.igst,total:t.total,paidAmount:paid,payments:paid>0?[{id:uid(),date,amount:paid,method:document.getElementById('billMethod').value}]:[],paymentMethod:document.getElementById('billMethod').value,notes:document.getElementById('billNotes').value.trim(),status:'active'};
  db.invoices.push(inv); db.settings.nextInvoice=num(db.settings.nextInvoice)+1;
  for(const l of inv.lines.filter(x=>x.kind==='product')){const p=productById(l.refId);const before=num(p.stock);p.stock=before-l.qty;db.stockMovements.push({id:uid(),date,productId:p.id,productName:p.name,type:'Sale',qty:-l.qty,unitCost:num(p.cost),note:`Invoice ${inv.number}`,reference:inv.id});}
  persist(); billDraft=[]; render(); toast(`Invoice ${inv.number} saved.`); showInvoiceActions(inv.id);
}
function renderInvoices() {
  const rows=[...db.invoices].sort((a,b)=>(b.date||'').localeCompare(a.date||'')).filter(i=>!currentFilter||[i.number,i.customerName,i.phone,i.vehicleReg].join(' ').toLowerCase().includes(currentFilter.toLowerCase()));
  const html=rows.length?`<div class="table-wrap"><table><thead><tr><th>INVOICE</th><th>CUSTOMER</th><th>VEHICLE</th><th>DATE</th><th>TOTAL</th><th>PAID</th><th>BALANCE</th><th>STATUS</th><th>ACTIONS</th></tr></thead><tbody>${rows.map(i=>`<tr><td>${rowTitle(i.number)}</td><td>${rowTitle(i.customerName,i.phone||'')}</td><td>${esc(i.vehicleReg||'—')}<div class="td-sub">${esc(i.vehicleType||'')}</div></td><td>${dateFmt(i.date)}</td><td class="amount">${money(i.total)}</td><td>${money(i.paidAmount)}</td><td class="amount ${dueAmount(i)?'amber':''}">${money(dueAmount(i))}</td><td>${statusPill(invoiceStatus(i))}</td><td><button class="btn btn-small" data-view-invoice="${i.id}">Open</button></td></tr>`).join('')}</tbody></table></div>`:emptyState('▤','No matching invoices','Invoices you create will appear here.','<button class="btn btn-primary" data-go="new-bill">＋ Create a bill</button>');
  return `${heading('Invoices','Search, review, print and share customer bills.','<button class="btn btn-primary" data-go="new-bill">＋ New bill</button>')}<div class="toolbar"><input id="invoiceSearch" class="toolbar-input" placeholder="Search invoice, customer, phone or vehicle..." value="${esc(currentFilter)}"><span class="muted">${rows.length} record(s)</span></div><section class="panel">${html}</section>`;
}
