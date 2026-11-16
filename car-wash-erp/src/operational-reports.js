function reportMoney(value){
  return new Intl.NumberFormat('en-IN',{style:'currency',currency:'INR',minimumFractionDigits:2,maximumFractionDigits:2}).format(Number(value)||0);
}
function reportText(value){
  return String(value??'—').trim()||'—';
}
function reportBlob(pdfMake,definition){
  return new Promise((resolve,reject)=>{
    try{
      pdfMake.createPdf(definition).getBlob(blob=>{
        if(!(blob instanceof Blob)||blob.size<500){reject(new Error('The report PDF could not be generated. Please try again.'));return;}
        resolve(blob);
      });
    }catch(error){reject(error);}
  });
}
function reportDataUrl(blob){
  return new Promise((resolve,reject)=>{
    const reader=new FileReader();
    reader.onload=()=>resolve(String(reader.result||''));
    reader.onerror=()=>reject(reader.error||new Error('Could not prepare the PDF file.'));
    reader.readAsDataURL(blob);
  });
}
function reportTable(section){
  const columns=Array.isArray(section.columns)?section.columns:[];
  const sourceRows=Array.isArray(section.rows)?section.rows:[];
  const widths=columns.map(column=>column.width||'*');
  const header=columns.map(column=>({text:reportText(column.label),style:'tableHeader',alignment:column.align||'left'}));
  const body=sourceRows.length?sourceRows.map(row=>columns.map(column=>{
    const value=row?.[column.key];
    return {text:reportText(value),style:'tableCell',alignment:column.align||'left'};
  })):[[{text:section.emptyText||'No records for this selection.',colSpan:Math.max(1,columns.length),style:'emptyCell'},...columns.slice(1).map(()=>({text:''}))]];
  const table={headerRows:1,keepWithHeaderRows:1,dontBreakRows:true,widths:widths.length?widths:['*'],body:[header,...body]};
  if(section.summary&&columns.length){
    const summary=columns.map(column=>({text:reportText(section.summary[column.key]??''),style:'tableSummary',alignment:column.align||'left'}));
    table.body.push(summary);
  }
  return {
    margin:[0,0,0,13],
    table,
    layout:{
      fillColor:row=>row===0?'#17130c':(row%2===0?'#f6f2e8':'#fffdf8'),
      hLineColor:()=> '#d7c7a4',
      vLineColor:()=> '#e6dcc7',
      hLineWidth:row=>row===0?1:.45,
      vLineWidth:()=>.35,
      paddingLeft:()=>5,
      paddingRight:()=>5,
      paddingTop:row=>row===0?6:4,
      paddingBottom:row=>row===0?6:4
    }
  };
}
function reportDefinition(payload){
  const sections=(payload.sections||[]).filter(Boolean);
  const metrics=(payload.metrics||[]).slice(0,8);
  const metricCells=[];
  for(let i=0;i<metrics.length;i+=2){
    const left=metrics[i],right=metrics[i+1];
    metricCells.push([
      {stack:[{text:reportText(left?.label),style:'metricLabel'},{text:reportText(left?.value),style:'metricValue'}],fillColor:'#fbf5e6',margin:[7,7,7,7],border:[true,true,true,true]},
      right?{stack:[{text:reportText(right.label),style:'metricLabel'},{text:reportText(right.value),style:'metricValue'}],fillColor:'#fbf5e6',margin:[7,7,7,7],border:[true,true,true,true]}:{text:'',border:[false,false,false,false]}
    ]);
  }
  const content=[
    {text:'PRIME AUTO CARE',style:'brand'},
    {text:reportText(payload.title||'Business report'),style:'title'},
    {text:reportText(payload.subtitle||''),style:'subtitle'},
    {text:'Generated: '+new Date().toLocaleString('en-IN',{dateStyle:'medium',timeStyle:'short'}),style:'generated'},
  ];
  if(metricCells.length){
    content.push({table:{widths:['*','*'],body:metricCells},layout:{hLineWidth:()=>0,vLineWidth:()=>8,vLineColor:()=> '#ffffff',paddingLeft:()=>0,paddingRight:()=>0,paddingTop:()=>0,paddingBottom:()=>0},margin:[0,8,0,12]});
  }
  sections.forEach(section=>{
    content.push({text:reportText(section.title),style:'sectionTitle',margin:[0,5,0,6]});
    if(section.description)content.push({text:String(section.description),style:'sectionDescription',margin:[0,0,0,5]});
    if(section.columns?.length)content.push(reportTable(section));
    else if(section.text)content.push({text:String(section.text),style:'tableCell',margin:[0,0,0,10]});
  });
  (payload.notes||[]).forEach(note=>content.push({text:String(note),style:'note',margin:[0,3,0,4]}));
  return {
    info:{title:reportText(payload.title||'Prime Auto Care business report'),author:'Prime Auto Care',subject:reportText(payload.subtitle||'Business accounts and operations')},
    pageSize:'A4',
    pageMargins:[28,62,28,44],
    defaultStyle:{font:'Roboto',fontSize:8,color:'#26221a',lineHeight:1.15},
    styles:{
      brand:{fontSize:9,bold:true,color:'#8b672a',characterSpacing:2,alignment:'center',margin:[0,0,0,3]},
      title:{fontSize:17,bold:true,color:'#17130c',alignment:'center',margin:[0,0,0,3]},
      subtitle:{fontSize:8,color:'#665a43',alignment:'center',margin:[0,0,0,3]},
      generated:{fontSize:6.5,color:'#86785e',alignment:'center',margin:[0,0,0,4]},
      metricLabel:{fontSize:7,bold:true,color:'#786744',margin:[0,0,0,3]},
      metricValue:{fontSize:12,bold:true,color:'#17130c'},
      sectionTitle:{fontSize:9,bold:true,color:'#17130c',characterSpacing:.4},
      sectionDescription:{fontSize:7,color:'#74664d'},
      tableHeader:{fontSize:6.7,bold:true,color:'#f3dfb2'},
      tableCell:{fontSize:6.7,color:'#28231a',lineHeight:1.12},
      tableSummary:{fontSize:7,bold:true,color:'#17130c'},
      emptyCell:{fontSize:7,italic:true,color:'#86785e',margin:[3,3,3,3]},
      note:{fontSize:6.5,color:'#76684d',italics:true}
    },
    header:(pageNumber,pageSize)=>({
      columns:[
        {text:'PRIME AUTO CARE  ·  GOLD & BLACK CAR SERVICES',style:'runningHeader'},
        {text:'A4 BUSINESS REPORT',style:'runningHeaderRight'}
      ],
      margin:[28,22,28,0]
    }),
    footer:(pageNumber,pageCount)=>({
      columns:[
        {text:'Private business record · Verify entries against source invoices and vouchers.',fontSize:6,color:'#86785e'},
        {text:'Page '+pageNumber+' of '+pageCount,fontSize:6,color:'#86785e',alignment:'right'}
      ],
      margin:[28,0,28,18]
    }),
    background:(pageNumber,pageSize)=>({
      canvas:[{type:'rect',x:14,y:14,w:pageSize.width-28,h:pageSize.height-28,lineWidth:.45,lineColor:'#d1b879'}]
    }),
    content
  };
}
async function saveReportPdf(payload){
  const pdfMake=window.pdfMake;
  if(!pdfMake||typeof pdfMake.createPdf!=='function')throw new Error('The offline PDF engine is not ready. Close and reopen Prime Auto Care.');
  if(!window.__primeAutoCarePdfFontsReady)throw new Error('The report fonts are not ready. Reopen Prime Auto Care and retry.');
  const filename=String(payload.filename||'Prime-Auto-Care-Report.pdf').replace(/[^A-Za-z0-9._-]/g,'_');
  const blob=await reportBlob(pdfMake,reportDefinition(payload));
  const dataUrl=await reportDataUrl(blob);
  if(window.WashDeskFileSharer?.save){
    await window.WashDeskFileSharer.save({filename,contentType:'application/pdf',base64Data:dataUrl,android:{saveDirectory:'downloads',relativePath:'Download/Prime Auto Care/Reports'}});
    return {saved:true,location:'Downloads/Prime Auto Care/Reports'};
  }
  const url=URL.createObjectURL(blob),anchor=document.createElement('a');
  anchor.href=url;anchor.download=filename;anchor.style.display='none';document.body.appendChild(anchor);anchor.click();anchor.remove();
  setTimeout(()=>URL.revokeObjectURL(url),30000);
  return {saved:true,location:'Downloads'};
}
window.WashDeskPdfReports={exportPdf:saveReportPdf};
