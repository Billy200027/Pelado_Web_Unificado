/* Parser del segundo proyecto ampliado: encabezados por nombre, sin tarifas inferidas. */
(function(root){'use strict';
// Valores iniciales para todos. La casilla selecciona el archivo, no autoriza una subida automática.
const EXCEL_SHARING_DEFAULTS = Object.freeze({
  includeOriginal: true, // true = casilla marcada al abrir la página; false = desmarcada.
  expanded: false       // false = recuadro compacto; true = mostrar todas las opciones.
});
const norm=s=>String(s??'').normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLowerCase().replace(/[^a-z0-9]/g,'');
const aliases={code:['codempleado','codigoempleado','codigo','cod'],employee:['empleado','nombreempleado','trabajador'],date:['fecha','fechaproduccion','dia'],product:['producto','descripcionproducto'],size:['tallavta','talla','tallaventa'],sourceCategory:['categoriadetalla','categoria','categoriatalla'],entry:['entradasonga','entrada','horainicio','inicio'],exit:['salidasonga','salida','horafin','fin'],pounds:['libraspeladas','libras','lb','peso'],monthlyYield:['rendmensual','rendimientomensual'],rate:['valortarifa','tarifa','preciolibra'],pay:['valorpago','pago','importe','totalpago']};
function numeric(v){if(v===null||v===undefined||String(v).trim()==='')return null;if(typeof v==='number')return Number.isFinite(v)?v:null;let s=String(v).replace(/[\s$]/g,'');if(s.includes(',')&&s.includes('.')){const decimal=s.lastIndexOf(',')>s.lastIndexOf('.')?',':'.';s=s.replace(decimal===','?/\./g:/,/g,'').replace(',','.');}else if(s.includes(','))s=s.replace(',','.');if(!/^-?\d+(\.\d+)?$/.test(s))return null;const n=Number(s);return Number.isFinite(n)?n:null;}
function excelDate(v,date1904=false){if(v instanceof Date)return PeladoCore.dateKey(v);if(typeof v==='number'){const d=root.XLSX.SSF.parse_date_code(v,{date1904});if(d&&d.y>=1900){const key=`${d.y}-${String(d.m).padStart(2,'0')}-${String(d.d).padStart(2,'0')}`;try{PeladoCore.parseDate(key);return key;}catch{}}return null;}
 const s=String(v??'').trim();let m=s.match(/^(\d{4})[/-](\d{1,2})[/-](\d{1,2})(?:[ T].*)?$/);let out;if(m)out=`${m[1]}-${m[2].padStart(2,'0')}-${m[3].padStart(2,'0')}`;else{m=s.match(/^(\d{1,2})[/-](\d{1,2})[/-](\d{4})(?:\s.*)?$/);if(m)out=`${m[3]}-${m[2].padStart(2,'0')}-${m[1].padStart(2,'0')}`;}try{PeladoCore.parseDate(out||'');return out;}catch{return null;}}
function time(v){if(v===''||v==null)return '';if(typeof v==='string'&&/^\d+(\.\d+)?$/.test(v.trim()))v=Number(v);if(typeof v==='number'){const minutes=Math.round((v-Math.floor(v))*1440)%1440;return `${String(Math.floor(minutes/60)).padStart(2,'0')}:${String(minutes%60).padStart(2,'0')}`;}const m=String(v).match(/(?:^|[ T])(\d{1,2}):(\d{2})(?::\d{2})?(?:\s*(AM|PM))?$/i);if(!m)return '';let h=Number(m[1]);if(m[3])h=h%12+(/pm/i.test(m[3])?12:0);return h<24&&Number(m[2])<60?`${String(h).padStart(2,'0')}:${m[2]}`:'';}
// Las tallas de venta suelen ser rangos (31/40). No son tallas nuevas.
function excelCategory(size, sourceCategory) {
 const value=String(size??'').trim().replace(/\.$/,'');
 const range=value.match(/^(\d+)\s*\/\s*\d+$/);
 const known=PeladoCore.category(range ? range[1] : value);
 if(!['Sin talla','Sin clasificar'].includes(known))return known;
 const declared={grande:'Grande',mediano:'Mediano',pequeno:'Pequeño'}[norm(sourceCategory)];
 return declared || known;
}
function timestamp(value,date1904=false) {
 if(typeof value==='number'&&value>=1){
   const d=root.XLSX.SSF.parse_date_code(value,{date1904});
   if(!d)return null;
   const key=`${d.y}-${String(d.m).padStart(2,'0')}-${String(d.d).padStart(2,'0')}`;
   try{PeladoCore.parseDate(key);}catch{return null;}
   return new Date(d.y,d.m-1,d.d,d.H,d.M,d.S).getTime();
 }
 const date=excelDate(value,date1904),clock=String(value??'').match(/[ T](\d{1,2}):(\d{2})(?::(\d{2}))?$/);
 if(!date||!clock||Number(clock[1])>23||Number(clock[2])>59||Number(clock[3]||0)>59)return null;
 const d=PeladoCore.parseDate(date);d.setHours(Number(clock[1]),Number(clock[2]),Number(clock[3]||0),0);return d.getTime();
}
function parseRows(grid,{date1904=false}={}) {
 let mapping={},header=-1;
 for(let i=0;i<Math.min(grid.length,100);i++){
   const row=grid[i].map(norm),map={};
   for(const [key,names]of Object.entries(aliases)){const n=row.findIndex(x=>names.includes(x));if(n>=0)map[key]=n;}
   if(map.date!==undefined&&map.pounds!==undefined){mapping=map;header=i;break;}
 }
 if(header<0)throw Error('No se reconocieron encabezados Fecha y Libras Peladas. Revisa la hoja o los nombres de columnas.');
 const warnings=[],rows=[],declaredTotals=[];
 const missing=Object.keys(aliases).filter(k=>mapping[k]===undefined);
 if(missing.length)warnings.push('Columnas ausentes (se muestran como —): '+missing.join(', '));
 const declaredPeriod=grid.slice(0,header).flat().filter(v=>/^per[ií]odo\s*:/i.test(String(v))).map(v=>String(v).replace(/^per[ií]odo\s*:\s*/i,'')).join(' / ');
 grid.slice(header+1).forEach((r,i)=>{
   if(r.every(v=>v===''||v==null))return;
   const get=k=>mapping[k]===undefined?'':r[mapping[k]]??'';
   const sourceRow=header+i+2;
   if(r.some(v=>/^total(?:\s*==>|\s*:|\s*$)/i.test(String(v).trim()))){
     const value=numeric(get('pay'));if(value!==null)declaredTotals.push(value);return;
   }
   const date=excelDate(get('date'),date1904),pounds=numeric(get('pounds'));
   const code=String(get('code')),employee=String(get('employee')),product=String(get('product'));
   if(get('pounds')!==''&&pounds===null){warnings.push(`Fila ${sourceRow} omitida: libras no numéricas.`);return;}
   if(!date&&!code.trim()&&!employee.trim()&&!product.trim()){warnings.push(`Fila ${sourceRow} omitida: sin fecha ni identificación de movimiento.`);return;}
   if(get('date')!==''&&!date)warnings.push(`Fila ${sourceRow}: fecha no reconocida; se conserva como Sin fecha.`);
   const rate=numeric(get('rate')),pay=numeric(get('pay')),size=String(get('size')).trim(),sourceCategory=String(get('sourceCategory'));
   if(get('pay')!==''&&pay===null)warnings.push(`Fila ${sourceRow}: pago no numérico; no se calcula uno.`);
   rows.push({code,employee,date:date||'',product,size,sourceCategory,
     category:pounds===null?'Concepto sin libras':excelCategory(size,sourceCategory),
     entry:time(get('entry')),exit:time(get('exit')),rawEntry:String(get('entry')),rawExit:String(get('exit')),
     entryDate:excelDate(get('entry'),date1904),exitDate:excelDate(get('exit'),date1904),
     entryTimestamp:timestamp(get('entry'),date1904),exitTimestamp:timestamp(get('exit'),date1904),
     pounds,monthlyYield:numeric(get('monthlyYield')),rate,pay,sourceRow});
 });
 if(!rows.length)throw Error('No encontré movimientos válidos en esta hoja. Revisa los encabezados, fechas y cantidades; no se generaron datos.');
 return {rows,warnings,header:header+1,declaredTotals,declaredPeriod};
}
function interval(r) {
 let start=r.entryTimestamp,end=r.exitTimestamp;
 if(!Number.isFinite(start))start=timestamp(r.rawEntry);
 if(!Number.isFinite(end))end=timestamp(r.rawExit);
 if(Number.isFinite(start)&&Number.isFinite(end))return end>start?[start,end]:null;
 if(!r.date||!r.entry||!r.exit)return null;
 try{
   const date=PeladoCore.parseDate(r.date),a=r.entry.split(':').map(Number),b=r.exit.split(':').map(Number);
   const x=new Date(date);x.setHours(a[0],a[1],0,0);const y=new Date(date);y.setHours(b[0],b[1],0,0);
   if(y<x)y.setDate(y.getDate()+1);return y>x?[x.getTime(),y.getTime()]:null;
 }catch{return null;}
}
function totals(rows) {
 const cats={},employees=new Map();let lb=0,payCents=0,missingPay=0,hours=0;
 const cents=v=>Math.round((v+Number.EPSILON)*100);
 for(const r of rows){
   lb+=r.pounds??0;payCents+=r.pay==null?0:cents(r.pay);if(r.pay==null)missingPay++;
   const category=r.pounds===null?r.product||'Concepto sin libras':r.category;
   cats[category]??={lb:0,pay:0,payCents:0,productionRows:0};
   cats[category].lb+=r.pounds??0;cats[category].payCents+=r.pay==null?0:cents(r.pay);cats[category].pay=cats[category].payCents/100;
   if(r.pounds!==null)cats[category].productionRows++;
   const range=interval(r);if(range){const key=JSON.stringify([r.code,r.employee]);if(!employees.has(key))employees.set(key,[]);employees.get(key).push(range);}
 }
 // Igual que el lector anterior: unión de intervalos por empleado, sin duplicar solapamientos.
 for(const ranges of employees.values()){
   ranges.sort((a,b)=>a[0]-b[0]);let start=null,end=null;
   for(const [a,b]of ranges){if(start===null){start=a;end=b;}else if(a<=end)end=Math.max(end,b);else{hours+=(end-start)/3600000;start=a;end=b;}}
   if(start!==null)hours+=(end-start)/3600000;
 }
 return {lb,pay:payCents/100,payCents,missingPay,hours,cats};
}
function reconciliation(rows,meta,totalRows) {
 if(rows.length!==totalRows||meta.declaredTotals?.length!==1||new Set(rows.map(r=>JSON.stringify([r.code,r.employee]))).size!==1)return null;
 const sum=totals(rows).payCents,declared=Math.round((meta.declaredTotals[0]+Number.EPSILON)*100);
 return {calculated:sum/100,declared:declared/100,difference:(sum-declared)/100};
}
root.PeladoExcel={parseRows,numeric,excelDate,time,totals,excelCategory,timestamp,reconciliation};if(typeof module!=='undefined')module.exports=root.PeladoExcel;
if(typeof document==='undefined')return;
const $=s=>document.querySelector(s),esc=s=>String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c])),num=n=>n==null?'—':Number(n).toLocaleString('es-EC',{maximumFractionDigits:2}),money=n=>n==null?'—':'$'+Number(n).toLocaleString('es-EC',{minimumFractionDigits:2,maximumFractionDigits:2});
let data=[],filtered=[],workbook=null,original=null,warnings=[],reportMeta={};
document.addEventListener('DOMContentLoaded',()=>{
 $('#view-excel').innerHTML=`<div class="section-head"><div><div class="eyebrow">Pelado · análisis local</div><h2>Tu reporte, explicado</h2><p class="muted">Importa Excel o CSV y descarga un informe PDF real. No modifica el control diario.</p></div><button id="clearExcel" class="btn btn-secondary">Limpiar análisis</button></div>
 <div class="card card-pad"><label id="dropzone" class="dropzone"><strong>Selecciona o arrastra tu reporte</strong><input id="excelFile" type="file" accept=".xlsx,.xls,.csv"><span class="tiny">XLSX · XLS · CSV — máximo 10 MB · procesamiento sin conexión</span></label><div id="excelError" class="error" role="alert" hidden></div><div class="field" id="sheetField" hidden><label for="sheetSelect">Hoja del archivo</label><select id="sheetSelect" class="select"></select></div><p class="tiny">No se inventan tarifas ni pagos ausentes. Las horas unen los intervalos de cada empleado, sin contar dos veces los que se superponen. No representan una regla salarial.</p></div>
 <div id="excelReport" hidden><div class="filter-grid"><input id="excelSearch" class="input" aria-label="Buscar jornadas" placeholder="Buscar fecha, empleado, producto o talla…"><select id="employeeFilter" class="select" aria-label="Filtrar empleado"></select><select id="periodFilter" class="select" aria-label="Filtrar período"></select></div><div id="excelWarnings" class="notice"></div><div id="excelKpis" class="stats-grid"></div><div class="dashboard-grid"><div class="card card-pad"><h3>Producción por categoría · lb</h3><div id="excelLbBars"></div></div><div class="card card-pad"><h3>Pago por categoría · USD</h3><div id="excelPayBars"></div></div></div><div class="actions"><button id="pdfExcel" class="btn btn-primary">Descargar informe PDF</button></div><div class="card card-pad excel-panel"><h3>Detalle de jornadas</h3><p id="excelCount" class="tiny"></p><div class="table-wrap"><table><thead><tr><th>Fecha</th><th>Empleado</th><th>Horario</th><th>Producto</th><th>Talla</th><th>Categoría</th><th>Lb</th><th>Tarifa USD/lb</th><th>Pago USD</th><th>Detalle</th></tr></thead><tbody id="excelBody"></tbody></table></div><div id="excelDetail"></div></div></div>
 <details id="excelSharingPanel" class="card card-pad excel-panel excel-sharing" ${EXCEL_SHARING_DEFAULTS.expanded ? 'open' : ''}>
   <summary>
     <strong>Compartir Excel con el administrador</strong>
     <span class="tiny">Opcional · solo se envía al pulsar «Autorizar y enviar».</span>
   </summary>
   <div class="excel-sharing-body">
     <p class="muted">Puedes enviar una copia del Excel original al almacenamiento privado del administrador. Puede contener nombres y datos de producción. Analizar el archivo no lo envía.</p>
     <p id="remoteStatus" class="notice"></p>
     <label>
       <input id="excelConsent" type="checkbox" ${EXCEL_SHARING_DEFAULTS.includeOriginal ? 'checked' : ''}>
       Incluir el Excel original en el envío.
     </label>
     <p class="tiny">Puedes desmarcar esta opción. Al pulsar «Autorizar y enviar Excel» autorizas el envío de la copia seleccionada.</p>
     <details class="sharing-privacy">
       <summary>Privacidad y conservación</summary>
       <p class="tiny">Retención propuesta: <span id="retention"></span> días; el administrador debe habilitar la eliminación programada. Para retirar un documento conserva su identificador de recepción y contacta al administrador.</p>
     </details>
     <div id="captchaSlot"></div>
     <button id="uploadExcel" class="btn btn-soft">Autorizar y enviar Excel</button>
     <p id="uploadStatus" role="status"></p>
   </div>
 </details>`;
 const cfg=root.PELADO_REMOTE||{};$('#retention').textContent=cfg.retentionDays||90;$('#remoteStatus').textContent=cfg.uploadEndpoint?'Integración configurada. El envío requiere internet y validación antiabuso.':'Modo local: envío desactivado. Falta configurar y desplegar el endpoint protegido.';
 $('#excelFile').addEventListener('change',e=>readFile(e.target.files[0]));
 ['dragenter','dragover'].forEach(ev=>$('#dropzone').addEventListener(ev,e=>{e.preventDefault();$('#dropzone').classList.add('drag');}));
 ['dragleave','drop'].forEach(ev=>$('#dropzone').addEventListener(ev,e=>{e.preventDefault();$('#dropzone').classList.remove('drag');}));$('#dropzone').addEventListener('drop',e=>readFile(e.dataTransfer.files[0]));
 $('#sheetSelect').addEventListener('change',parseSheet);['excelSearch','employeeFilter','periodFilter'].forEach(id=>$('#'+id).addEventListener(id==='excelSearch'?'input':'change',filter));
 $('#clearExcel').addEventListener('click',()=>{data=[];filtered=[];workbook=null;original=null;warnings=[];reportMeta={};localStorage.removeItem('peladoClaroData');$('#excelReport').hidden=true;$('#sheetField').hidden=true;$('#excelFile').value='';$('#uploadStatus').textContent='';});
 $('#pdfExcel').addEventListener('click',()=>{try{createPDF(filtered).save('informe-pelado.pdf');}catch(e){error(e.message);}});$('#uploadExcel').addEventListener('click',upload);
 $('#excelBody').addEventListener('click',e=>{const b=e.target.closest('[data-row]');if(!b)return;const r=filtered[Number(b.dataset.row)];$('#excelDetail').innerHTML=`<div class="notice"><h3>Fila ${r.sourceRow||'importada'}</h3>${Object.entries(r).map(([k,v])=>`<p><strong>${esc(k)}</strong>: ${esc(v??'—')}</p>`).join('')}</div>`;});
 try{
   const saved=JSON.parse(localStorage.getItem('peladoClaroData')||'[]'),stored=Array.isArray(saved)?saved:saved.rows;
   if(Array.isArray(stored)&&stored.length){
     reportMeta=Array.isArray(saved)?{}:saved.reportMeta||{};
     data=stored.map(r=>({...r,pounds:numeric(r.pounds),rate:numeric(r.rate),pay:numeric(r.pay),
       date:excelDate(typeof r.date==='string'&&/^\d{5}(\.\d+)?$/.test(r.date)?Number(r.date):r.date)||'',
       sourceCategory:r.sourceCategory||r.category,
       category:numeric(r.pounds)===null?'Concepto sin libras':excelCategory(r.size,r.sourceCategory||r.category),
       entry:time(r.entry),exit:time(r.exit)}));
     warnings=['Análisis restaurado. Para enviar el Excel original debes volver a seleccionarlo.'];setupFilters();
   }
 }catch{error('No se pudo restaurar el análisis guardado. Selecciona el archivo de nuevo.');}
});
function error(msg){$('#excelError').hidden=false;$('#excelError').textContent=msg;}
async function readFile(file){if(!file)return;$('#excelError').hidden=true;try{if(!/\.(xlsx|xls|csv)$/i.test(file.name))throw Error('Selecciona un archivo XLSX, XLS o CSV.');if(file.size>10*1024*1024)throw Error('El archivo supera 10 MB.');if(!root.XLSX)throw Error('Falta vendor/xlsx.full.min.js en esta copia.');const wb=root.XLSX.read(await file.arrayBuffer(),{type:'array',cellDates:false});workbook=wb;original=file;$('#sheetSelect').innerHTML=wb.SheetNames.map(n=>`<option>${esc(n)}</option>`).join('');$('#sheetField').hidden=wb.SheetNames.length<2;let selected=0;for(let i=0;i<wb.SheetNames.length;i++){try{parseRows(root.XLSX.utils.sheet_to_json(wb.Sheets[wb.SheetNames[i]],{header:1,defval:''}));selected=i;break;}catch{}}$('#sheetSelect').selectedIndex=selected;parseSheet();}catch(e){original=null;error(e.message);}}
function parseSheet(){
 try{
   const grid=root.XLSX.utils.sheet_to_json(workbook.Sheets[$('#sheetSelect').value],{header:1,defval:''});
   const parsed=parseRows(grid,{date1904:!!workbook.Workbook?.WBProps?.date1904});
   data=parsed.rows.sort((a,b)=>(a.date||'9999').localeCompare(b.date||'9999')||(a.sourceRow-b.sourceRow));warnings=parsed.warnings;
   reportMeta={declaredPeriod:parsed.declaredPeriod,declaredTotals:parsed.declaredTotals};
   try{localStorage.setItem('peladoClaroData',JSON.stringify({version:2,rows:data,reportMeta}));}catch{warnings.push('No se pudo guardar el análisis: almacenamiento lleno. Puedes descargar el PDF.');}
   $('#excelError').hidden=true;setupFilters();
 }catch(e){data=[];filtered=[];reportMeta={};$('#excelReport').hidden=true;error(e.message);}
}
function setupFilters(){
 const employees=[...new Set(data.map(r=>r.employee))].sort(),periods=[...new Set(data.filter(r=>r.date).map(r=>PeladoCore.periodOf(r.date)))].sort();
 $('#employeeFilter').innerHTML='<option value="">Todos los empleados</option>'+employees.map(e=>`<option value="${esc(e)}">${esc(e||'Sin nombre')}</option>`).join('');
 $('#periodFilter').innerHTML='<option value="">Todos los movimientos (incluye sin fecha)</option>'+periods.map(p=>`<option value="${p}">${p}-21 → ${nextPeriodEnd(p)}</option>`).join('')+(data.some(r=>!r.date)?'<option value="__undated__">Solo conceptos sin fecha</option>':'');
 $('#excelSearch').value='';$('#excelReport').hidden=false;filter();
}
function nextPeriodEnd(p){const [y,m]=p.split('-').map(Number);return PeladoCore.dateKey(new Date(y,m,20,12));}
function filter(){const q=$('#excelSearch').value.toLowerCase(),employee=$('#employeeFilter').value,period=$('#periodFilter').value;filtered=data.filter(r=>(!employee||r.employee===employee)&&(!period||(period==='__undated__'?!r.date:!!r.date&&PeladoCore.periodOf(r.date)===period))&&[r.date,r.code,r.employee,r.product,r.size,r.category,r.sourceCategory].join(' ').toLowerCase().includes(q));render();}
function render(){
 const t=totals(filtered),check=reconciliation(filtered,reportMeta,data.length);
 const noDate=filtered.filter(r=>!r.date).length,concepts=filtered.filter(r=>r.pounds===null).length;
 const notes=[...warnings];
 if(reportMeta.declaredPeriod)notes.push('Período indicado en el Excel: '+reportMeta.declaredPeriod+'.');
 notes.push(`${concepts} conceptos sin libras y ${noDate} movimientos sin fecha incluidos en esta selección.`);
 if(check)notes.push(check.difference===0?'El total declarado coincide con la suma de los movimientos.':`Total declarado ${money(check.declared)}; suma de movimientos ${money(check.calculated)}; diferencia ${money(check.difference)}. Se conservan ambos valores para revisión.`);
 if(t.missingPay)notes.push(`${t.missingPay} filas sin pago numérico; no se estiman sus importes.`);
 notes.push('Las tallas pueden aparecer como rangos (31/40, 51/60). Se conserva la categoría de origen y los conceptos LIBRES, HORAS y AVANCE, sin reinterpretarlos como descuentos.');
 $('#excelWarnings').textContent=notes.join(' ');
 $('#excelKpis').innerHTML=[['Libras',num(t.lb)+' lb'],['Pago registrado',money(t.pay)],['Tiempo registrado',num(t.hours)+' h'],['Filas / días con fecha',`${filtered.length} / ${new Set(filtered.filter(r=>r.date).map(r=>JSON.stringify([r.date,r.employee,r.code]))).size}`]].map(([k,v])=>`<div class="card stat-card"><div class="stat-label">${k}</div><div class="stat-value">${v}</div></div>`).join('');
 bars('#excelLbBars',Object.fromEntries(Object.entries(t.cats).filter(([,v])=>v.productionRows>0)),'lb');bars('#excelPayBars',t.cats,'pay');
 $('#excelCount').textContent=`${filtered.length} de ${data.length} movimientos. El PDF usa estos mismos filtros. Los filtros por período excluyen los conceptos sin fecha.`;
 $('#excelBody').innerHTML=filtered.map((r,i)=>`<tr><td>${esc(r.date||'Sin fecha')}</td><td>${esc(r.employee||'—')}</td><td>${esc(r.entry||'—')} → ${esc(r.exit||'—')}</td><td>${esc(r.product)}</td><td>${esc(r.size)}</td><td>${esc(r.category)}</td><td>${num(r.pounds)}</td><td>${money(r.rate)}</td><td>${money(r.pay)}</td><td><button class="btn btn-soft" data-row="${i}">Ver</button></td></tr>`).join('');
 $('#excelDetail').innerHTML='';$('#pdfExcel').disabled=!filtered.length;
}
function bars(selector,cats,key){const max=Math.max(1,...Object.values(cats).map(c=>Math.abs(c[key])));$(selector).innerHTML=Object.entries(cats).map(([k,v])=>`<div class="bar-row"><span>${esc(k)}</span><div class="progress"><span style="width:${Math.abs(v[key])/max*100}%"></span></div><b>${key==='pay'?money(v[key]):num(v[key])+' lb'}</b></div>`).join('');}
function createPDF(rows){if(!rows.length)throw Error('No hay filas para exportar.');if(!root.jspdf?.jsPDF)throw Error('Falta la dependencia PDF local.');const doc=new root.jspdf.jsPDF(),t=totals(rows);doc.setFillColor(122,31,61);doc.rect(0,0,210,38,'F');doc.setTextColor(255);doc.setFontSize(22);doc.text('Pelado | Informe de producción',14,18);doc.setFontSize(10);doc.text('Análisis local de las filas filtradas · USD / lb / horas',14,28);doc.setTextColor(30);doc.setFontSize(11);const dates=rows.map(r=>r.date).filter(Boolean).sort();doc.text(`${dates[0]||'Sin fecha'} a ${dates.at(-1)||'Sin fecha'} | ${rows.length} movimientos`,14,48);doc.text(`Producción: ${num(t.lb)} lb | Pago registrado: ${money(t.pay)} | Horas: ${num(t.hours)}`,14,56);doc.text(`Filas sin pago: ${t.missingPay}. No se inventan importes. Intervalos solapados unidos.`,14,64);doc.autoTable({startY:72,head:[['Categoría','Libras (lb)','Pago (USD)']],body:Object.entries(t.cats).map(([k,v])=>[k,v.productionRows?num(v.lb):'—',money(v.pay)]),headStyles:{fillColor:[122,31,61]},styles:{fontSize:10}});let y=doc.lastAutoTable.finalY+12;const max=Math.max(1,...Object.values(t.cats).filter(c=>c.productionRows>0).map(c=>c.lb));doc.setFontSize(10);doc.text('Producción por categoría (lb)',14,y);y+=8;for(const [k,v]of Object.entries(t.cats).filter(([,v])=>v.productionRows>0)){doc.text(k,14,y+4);doc.setFillColor(122,31,61);doc.rect(47,y,100*v.lb/max,5,'F');doc.text(num(v.lb)+' lb',152,y+4);y+=10;}
 doc.autoTable({startY:y+8,head:[['Fecha','Empleado','Horario','Producto / talla','Lb','USD/lb','Pago USD']],body:rows.map(r=>[r.date||'Sin fecha',r.employee||'—',`${r.entry||'—'} - ${r.exit||'—'}`,`${r.product}\nTalla ${r.size||'—'} · ${r.category}`,num(r.pounds),money(r.rate),money(r.pay)]),headStyles:{fillColor:[122,31,61]},styles:{fontSize:7,overflow:'linebreak',cellPadding:2},columnStyles:{0:{cellWidth:21},1:{cellWidth:27},2:{cellWidth:24},3:{cellWidth:51}},margin:{top:18,bottom:18},rowPageBreak:'avoid'});
 const pages=doc.getNumberOfPages();for(let p=1;p<=pages;p++){doc.setPage(p);doc.setFontSize(8);doc.setTextColor(100);doc.text(`Pelado · ${p} / ${pages} · Datos de origen, sin validación salarial`,14,289);}return doc;}
root.PeladoExcel.createPDF=createPDF;
let token='',captchaId=null;
async function upload(){const cfg=root.PELADO_REMOTE||{};$('#uploadStatus').textContent='';if(!cfg.uploadEndpoint)return $('#uploadStatus').textContent='Modo local. Falta desplegar y configurar Supabase; no se ha enviado ningún archivo.';if(!original)return $('#uploadStatus').textContent='Selecciona el Excel original para enviarlo.';if(!$('#excelConsent').checked)return $('#uploadStatus').textContent='La opción de incluir el Excel está desmarcada. No se enviará ningún archivo.';if(!navigator.onLine)return $('#uploadStatus').textContent='Sin conexión. Puedes continuar con el análisis local.';
 if(!token){if(!cfg.turnstileSiteKey)return $('#uploadStatus').textContent='Falta la clave pública de verificación antiabuso.';if(!root.turnstile){const script=document.createElement('script');script.src='https://challenges.cloudflare.com/turnstile/v0/api.js?render=explicit';script.onload=()=>{captchaId=root.turnstile.render('#captchaSlot',{sitekey:cfg.turnstileSiteKey,callback:t=>{token=t;$('#uploadStatus').textContent='Verificación completada. Pulsa Enviar de nuevo.';}});};script.onerror=()=>$('#uploadStatus').textContent='No se pudo cargar la verificación.';document.head.appendChild(script);}else if(captchaId!==null)root.turnstile.reset(captchaId);return $('#uploadStatus').textContent='Completa la verificación antiabuso.';}
 $('#uploadExcel').disabled=true;try{const form=new FormData();form.append('file',original);form.append('consent','yes');form.append('captcha',token);const res=await fetch(cfg.uploadEndpoint,{method:'POST',body:form});const body=await res.json();if(!res.ok)throw Error(body.error||'No se aceptó el archivo.');$('#uploadStatus').textContent='Archivo recibido. Identificador: '+body.id;}catch(e){$('#uploadStatus').textContent='No se confirmó el envío: '+e.message;}finally{token='';$('#uploadExcel').disabled=false;if(captchaId!==null)root.turnstile.reset(captchaId);}}
})(typeof window!=='undefined'?window:globalThis);
