/* Importación de producción al control diario; no cambia las reglas de cálculo. */
(function(root){
'use strict';
const categoryKey={'Grande':'grande','Mediano':'mediano','Pequeño':'pequeno'};
const round=v=>Math.round((v+Number.EPSILON)*100)/100;
function plan(rows,code,employee,period){
 const days=new Map(),warnings=[];
 for(const row of rows){
  if(row.code!==code||row.employee!==employee||!row.date||row.pounds==null)continue;
  if(root.PeladoCore.periodOf(row.date)!==period)continue;
  if(!days.has(row.date))days.set(row.date,{date:row.date,lb:{grande:0,mediano:0,pequeno:0,adicional:0},pay:0,missingPay:false,invalid:false});
  // La tarifa original identifica PCC; el importe se calcula con la tarifa local.
  const day=days.get(row.date),key=Number.isFinite(row.rate)&&row.rate>0&&row.rate<0.11?'adicional':categoryKey[row.category];
  if(!key||!Number.isFinite(row.pounds)||row.pounds<0){day.invalid=true;continue;}
  day.lb[key]+=row.pounds;
  if(Number.isFinite(row.pay))day.pay=round(day.pay+row.pay);else day.missingPay=true;
 }
 const records=[];
 for(const day of [...days.values()].sort((a,b)=>a.date.localeCompare(b.date))){
  if(day.invalid){warnings.push(day.date+': categoría o libras no válidas; día pendiente de ingreso manual.');continue;}
  const trays=Object.fromEntries(Object.entries(day.lb).map(([k,v])=>[k,Math.floor((round(v)+1e-9)/5)]));
  const libras=round(Object.values(day.lb).reduce((a,b)=>a+b,0));
  if(!libras)continue;
  if(Object.entries(day.lb).some(([k,v])=>v>0&&!trays[k])){warnings.push(day.date+': una categoría tiene menos de 5 lb; día pendiente de ingreso manual.');continue;}
  const count=Object.values(trays).reduce((a,b)=>a+b,0);
  if(libras/count>6)warnings.push(day.date+': el reparto supera 6 lb por bandeja; revisa las cantidades.');
  records.push({date:day.date,type:'trabajado',shift:'manana',holiday:false,...trays,libras,hoursEnabled:false,startTime:'',endTime:'',nextDay:false,sourcePay:day.missingPay?null:day.pay});
 }
 return {records,warnings};
}
root.PeladoDailyImport={plan};
if(typeof module!=='undefined')module.exports=root.PeladoDailyImport;
if(typeof document==='undefined')return;
const $=s=>document.querySelector(s),esc=s=>String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const num=v=>Number(v).toLocaleString('es-EC',{maximumFractionDigits:2}),money=v=>'$'+Number(v).toLocaleString('es-EC',{minimumFractionDigits:2,maximumFractionDigits:2});
let allRows=[],selected={records:[],warnings:[]};
function label(p){const [y,m]=p.split('-').map(Number);return p+'-21 → '+root.PeladoCore.dateKey(new Date(y,m,20,12));}
function selection(){const who=JSON.parse($('#dailyEmployee').value||'null'),period=$('#dailyPeriod').value;return who&&period?plan(allRows,who[0],who[1],period):{records:[],warnings:[]};}
function render(){
 if(!$('#dailyImportPanel'))return;
 selected=selection();const api=root.PeladoDaily,period=$('#dailyPeriod').value,snapshot=api.snapshot(),existing=snapshot.months[period]?.days||{},replace=$('#dailyReplace').checked;
 let estimate=0,actual=0,missing=0,conflicts=0;
 const body=selected.records.map(r=>{
  const saved=existing[r.date];if(saved)conflicts++;
  const chosen=saved&&!replace?saved:r,calc=chosen.type==='trabajado'?root.PeladoCore.calculateDay(chosen,snapshot.config).peelingMoney:0;
  estimate=round(estimate+calc);if(r.sourcePay==null)missing++;else actual=round(actual+r.sourcePay);
  return `<tr><td>${esc(r.date)}</td><td>${r.grande}</td><td>${r.mediano}</td><td>${r.pequeno}</td><td>${r.adicional}</td><td>${num(r.libras)}</td><td>${money(calc)}</td><td>${r.sourcePay==null?'Sin pago':money(r.sourcePay)}</td><td>${saved?(replace?'Se reemplazará':'Se conserva'):'Nuevo'}</td></tr>`;
 }).join('');
 const delta=round(estimate-actual),pct=actual?num(delta/actual*100)+' %':'sin referencia';
 $('#dailyPreview').innerHTML=`<p>${selected.records.length} días de producción · ${conflicts} fechas ya registradas. ${replace?'Se reemplazarán las fechas coincidentes.':'Las fechas existentes se conservan.'}</p><p class="notice">Los días nuevos usan turno mañana, sin feriado y sin horas. Revisa después los turnos nocturnos y feriados en el calendario. Los libres, faltas, horas y avances se completan manualmente.</p>${selected.warnings.map(w=>`<p class="notice">${esc(w)}</p>`).join('')}<div class="stats-grid"><div class="card stat-card">Cálculo de producción<strong class="stat-value">${money(estimate)}</strong></div><div class="card stat-card">Producción del Excel<strong class="stat-value">${missing?'Referencia incompleta':money(actual)}</strong></div><div class="card stat-card">Diferencia: página − Excel<strong class="stat-value">${missing?'No disponible':money(delta)}</strong><span>${missing?'Faltan pagos en el Excel':pct}</span></div></div><p class="tiny">Se compara solo pelado en las fechas de esta vista, con tus tarifas actuales. Excluye horas, libres, bono, multas, avances y pagos recibidos. Al conservar un día existente se usa su producción actual.</p><details><summary>Ver días y bandejas que se importarán</summary><div class="table-wrap"><table><thead><tr><th>Fecha</th><th>Grandes</th><th>Medianas</th><th>Pequeñas</th><th>PCC / tijera</th><th>Lb totales</th><th>Página</th><th>Excel</th><th>Registro</th></tr></thead><tbody>${body}</tbody></table></div></details>`;
 $('#dailyImport').disabled=!selected.records.length;$('#dailyOpen').disabled=!period;
 const periods=Object.keys(snapshot.months).filter(p=>Object.keys(snapshot.months[p].days||{}).length).sort();
 const previous=$('#dailyDeletePeriod').value;
 $('#dailyDeletePeriod').innerHTML=periods.map(p=>`<option value="${esc(p)}">${esc(label(p))}</option>`).join('');
 if(periods.includes(previous))$('#dailyDeletePeriod').value=previous;else if(periods.includes(period))$('#dailyDeletePeriod').value=period;
 $('#dailyDelete').disabled=!periods.length;
}
function update(rows){
 allRows=rows;
 const oldWho=$('#dailyEmployee').value,oldPeriod=$('#dailyPeriod').value;
 const identities=[...new Map(rows.map(r=>[JSON.stringify([r.code,r.employee]),[r.code,r.employee]])).values()];
 $('#dailyEmployee').innerHTML=identities.map(w=>`<option value="${esc(JSON.stringify(w))}">${esc(w[1]||'Sin nombre')} · ${esc(w[0])}</option>`).join('');
 if(identities.some(w=>JSON.stringify(w)===oldWho))$('#dailyEmployee').value=oldWho;
 periods(oldPeriod);$('#dailyImportPanel').hidden=false;
}
function periods(previous){
 const who=JSON.parse($('#dailyEmployee').value||'null');
 const list=[...new Set(allRows.filter(r=>who&&r.code===who[0]&&r.employee===who[1]&&r.date&&r.pounds!=null).map(r=>root.PeladoCore.periodOf(r.date)))].sort();
 $('#dailyPeriod').innerHTML=list.map(p=>`<option value="${p}">${label(p)}</option>`).join('');if(list.includes(previous))$('#dailyPeriod').value=previous;render();
}
document.addEventListener('DOMContentLoaded',()=>{
 $('#view-excel').insertAdjacentHTML('beforeend',`<section id="dailyImportPanel" class="card card-pad excel-panel" hidden><h3>Pasar producción al registro diario</h3><p>Selecciona empleado y período. Se suman los cortes de cada día y categoría; bandejas = libras ÷ 5, redondeadas hacia abajo. Se conservan las libras totales. Las filas con tarifa mayor que cero y menor a $0,11/lb se asignan a PCC / tijera (categoría adicional).</p><p class="tiny">Esta selección usa el archivo completo, independientemente de los filtros del informe superior.</p><div class="filter-grid"><label>Empleado<select id="dailyEmployee" class="select"></select></label><label>Período del 21 al 20<select id="dailyPeriod" class="select"></select></label></div><label><input type="checkbox" id="dailyReplace"> Reemplazar los días que ya estén registrados en estas fechas</label><div id="dailyPreview"></div><div class="actions"><button id="dailyImport" class="btn btn-primary">Guardar días y abrir calendario</button><button id="dailyOpen" class="btn btn-secondary">Abrir período en el calendario</button></div><p id="dailyStatus" role="status"></p><hr><h3>Borrar los registros de un período</h3><p class="tiny">Borra todos los días del período elegido, incluidos los editados o ingresados manualmente. Conserva otros períodos, ajustes, pagos recibidos y el análisis del Excel. Antes se descarga un respaldo.</p><label>Período que quieres borrar<select id="dailyDeletePeriod" class="select"></select></label><button id="dailyDelete" class="btn btn-secondary">Borrar registros de este período</button></section>`);
 $('#dailyEmployee').onchange=()=>periods();$('#dailyPeriod').onchange=render;$('#dailyReplace').onchange=render;
 $('#dailyImport').onclick=()=>{try{
  const period=$('#dailyPeriod').value,records=selection().records,replace=$('#dailyReplace').checked;
  if(!records.length)return;
  if(!confirm(`¿Importar producción de ${records.length} días del período ${label(period)}? ${replace?'Se reemplazarán las fechas coincidentes.':'Se conservarán los días existentes.'}`))return;
  const result=root.PeladoDaily.importProduction(period,records,replace);$('#dailyReplace').checked=false;render();$('#dailyStatus').textContent=`${result.added} días guardados; ${result.skipped} días existentes conservados. El calendario se abrió en el período importado.`;
 }catch(e){$('#dailyStatus').textContent='No se importó: '+e.message;}};
 $('#dailyOpen').onclick=()=>root.PeladoDaily.openPeriod($('#dailyPeriod').value);
 $('#dailyDelete').onclick=()=>{try{const p=$('#dailyDeletePeriod').value;if(!p||!confirm(`¿Borrar TODOS los registros diarios del período ${label(p)}? Se solicitará descargar un respaldo antes de borrar.`))return;root.PeladoDaily.deletePeriod(p);render();$('#dailyStatus').textContent='Registros del período borrados. Los demás períodos y pagos se conservan.';}catch(e){$('#dailyStatus').textContent='No se pudo borrar: '+e.message;}};
 root.PeladoDailyImport.update=update;
 if(root.PeladoExcel.getRows)update(root.PeladoExcel.getRows());
 document.addEventListener('pelado-daily-changed',render);
});
})(typeof window!=='undefined'?window:globalThis);
