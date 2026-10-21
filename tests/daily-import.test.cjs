const assert=require('node:assert/strict');
const fs=require('node:fs');
const vm=require('node:vm');
const {JSDOM}=require('jsdom');
const path=require('node:path');
const base=path.resolve(__dirname,'..');
function boot(seed){
 const html=fs.readFileSync(path.join(base,'index.html'),'utf8').replace(/<script[\s\S]*?<\/script>/g,'');
 const dom=new JSDOM(html,{url:'https://example.com/pelado/',runScripts:'outside-only'}),w=dom.window;
 w.structuredClone=structuredClone;w.scrollTo=()=>{};w.confirm=()=>true;w.alert=()=>{};
 w.URL.createObjectURL=()=> 'blob:backup';w.URL.revokeObjectURL=()=>{};w.HTMLAnchorElement.prototype.click=function(){};
 if(seed)w.localStorage.setItem('pelado_periods_v2',JSON.stringify(seed));
 w.localStorage.setItem('pelado_profile_v1',JSON.stringify({name:'QA',age:25}));
 for(const name of ['core.js','variables.js','app.js','excel-insights.js','excel.js','daily-import.js'])vm.runInContext(fs.readFileSync(path.join(base,name),'utf8'),dom.getInternalVMContext());
 w.document.dispatchEvent(new w.Event('DOMContentLoaded'));
 return {dom,w};
}
const {dom,w}=boot();
const row=(date,category,pounds,pay=1)=>({code:'1',employee:'QA',date,category,pounds,pay});
const rows=[row('2026-08-28','Grande',80),row('2026-08-28','Grande',10.78),row('2026-08-28','Pequeño',39.36),row('2026-09-20','Mediano',10),row('2026-09-21','Grande',20),row('2026-09-01','Grande',null)];
const plan=w.PeladoDailyImport.plan(rows,'1','QA','2026-08');
assert.equal(plan.records.length,2);assert.equal(plan.records[0].grande,18);assert.equal(plan.records[0].pequeno,7);assert.equal(plan.records[0].libras,130.14);
assert.equal(w.PeladoDailyImport.plan([row('2026-09-01','Grande',4)],'1','QA','2026-08').records.length,0);
assert.equal(w.PeladoDailyImport.plan([row('2026-09-01','Desconocida',10)],'1','QA','2026-08').records.length,0);
assert.equal(w.PeladoDailyImport.plan([...rows,{...rows[0],code:'2',pounds:1000}],'1','QA','2026-08').records[0].libras,130.14);
// La clasificación PCC tiene prioridad sobre la talla; 0,11 conserva su talla.
const pccRows=[{...row('2026-07-21','Grande',10,0.8),rate:0.08},{...row('2026-07-21','Grande',10,1.1),rate:0.11}];
const pcc=w.PeladoDailyImport.plan(pccRows,'1','QA','2026-07');
assert.equal(pcc.records[0].adicional,2);assert.equal(pcc.records[0].grande,2);assert.equal(pcc.records[0].libras,20);
assert.equal(w.PeladoCore.calculateDay(pcc.records[0],w.PeladoDaily.snapshot().config).peelingMoney,1.9);
assert.equal(w.PeladoCore.calculateDay(pcc.records[0],{...w.PeladoDaily.snapshot().config,prices:{grande:.11,mediano:.14,pequeno:.22,adicional:.09}}).peelingMoney,2,'PCC usa tarifa local y no precio del Excel');
for(const rate of [.079,.08,.10,.10999])assert.equal(w.PeladoDailyImport.plan([{...pccRows[0],rate}],'1','QA','2026-07').records[0].adicional,2);
for(const rate of [.11,.14,null,undefined])assert.equal(w.PeladoDailyImport.plan([{...pccRows[0],rate}],'1','QA','2026-07').records[0].grande,2);
w.PeladoDaily.importProduction('2026-07',pcc.records);
assert.equal(w.PeladoDaily.snapshot().months['2026-07'].days['2026-07-21'].adicional,2,'PCC se guarda como adicional en calendario');
w.PeladoDailyImport.update(rows);
w.document.querySelector('#dailyReplace').checked=true;
let downloads=0;w.HTMLAnchorElement.prototype.click=function(){downloads++;};
w.document.querySelector('#dailyImport').click();
assert.equal(downloads,0,'no backup download for a new period, even with replace checked');
assert.ok(w.document.querySelector('#view-calendar').classList.contains('active-view'),'import opens calendar');
assert.ok(w.document.querySelector('#periodControls').textContent.includes('ago 2026'),'calendar switches to imported period');
assert.ok(w.document.querySelector('[data-action="open-day"][data-date="2026-08-28"]'),'imported day visible immediately');
let snapshot=w.PeladoDaily.snapshot();assert.equal(Object.keys(snapshot.months['2026-08'].days).length,2);
assert.equal(snapshot.months['2026-08'].days['2026-08-28'].hoursEnabled,false);
assert.equal(snapshot.months['2026-08'].days['2026-08-28'].sourcePay,undefined);
assert.equal(w.PeladoDaily.importProduction('2026-08',plan.records).skipped,2);
assert.equal(w.PeladoDaily.importProduction('2026-08',[{...plan.records[0],libras:140}],true).added,1);
assert.equal(downloads,1,'a real replacement preserves backup');
const before=w.localStorage.getItem('pelado_periods_v2');
assert.throws(()=>w.PeladoDaily.importProduction('2026-08',[plan.records[0],{...plan.records[1],date:'2026-09-21'}],true));
assert.equal(w.localStorage.getItem('pelado_periods_v2'),before,'invalid batch does not partly save');
w.PeladoDaily.openPeriod('2026-08');
const dayButton=w.document.querySelector('[data-action="open-day"][data-date="2026-08-28"]');assert.ok(dayButton);dayButton.click();
w.document.querySelector('#totalLb').value='150';w.document.querySelector('[data-action="save-day"]').click();
assert.equal(w.PeladoDaily.snapshot().months['2026-08'].days['2026-08-28'].libras,150,'imported day editable normally');
const other=w.PeladoDailyImport.plan(rows,'1','QA','2026-09');w.PeladoDaily.importProduction('2026-09',other.records);
w.localStorage.setItem('pelado_period_payments_v2',JSON.stringify({'2026-08':{fortnight:241,monthEnd:0}}));
w.PeladoDaily.deletePeriod('2026-08');snapshot=w.PeladoDaily.snapshot();
assert.equal(Object.keys(snapshot.months['2026-08']?.days||{}).length,0);
assert.equal(snapshot.months['2026-09'].days['2026-09-21'].libras,20);
assert.equal(JSON.parse(w.localStorage.getItem('pelado_period_payments_v2'))['2026-08'].fortnight,241);

// Regresión exacta de las capturas: 148,08 lb, 60 lb a 0,08 mal asignadas a grande.
const previous={date:'2026-08-27',type:'trabajado',grande:20,mediano:9,pequeno:0,adicional:0,libras:148.08,shift:'noche',holiday:true,hoursEnabled:true,startTime:'18:00',endTime:'20:00',nextDay:false};
const repairBoot=boot({'2026-08':{days:{'2026-08-27':previous}}});const rw=repairBoot.w;
const grid=[['Cod. Empleado','Empleado','Fecha','Producto','Talla Vta','Categoría de Talla','Entrada Songa','Salida Songa','Libras Peladas','Rend. Mensual','Valor Tarifa','Valor Pago'],
 ['36546','QA','2026/08/27','MEDIANO A','31/35','MEDIANO','','',25.2,'',.14,3.53],
 ['36546','QA','2026/08/27','PORTICO EZ PEEL','16/20','GRANDE','','',60,'',.08,4.8],
 ['36546','QA','2026/08/27','GRANDE B','16/20','GRANDE','','',42.72,'',.11,4.70],
 ['36546','QA','2026/08/27','MEDIANO B','41/50','MEDIANO','','',20.16,'',.14,2.82]];
const parsed=rw.PeladoExcel.parseRows(grid).rows;assert.equal(parsed[1].category,'PCC / tijera','el informe reconoce la tarifa de la captura');
rw.PeladoDailyImport.update(parsed);assert.equal(rw.document.querySelector('#dailyRepair').disabled,false);
rw.document.querySelector('#dailyRepair').click();
let repaired=rw.PeladoDaily.snapshot().months['2026-08'].days['2026-08-27'];
assert.equal(repaired.grande,8);assert.equal(repaired.mediano,9);assert.equal(repaired.adicional,12);assert.equal(repaired.libras,148.08);
for(const k of ['shift','holiday','hoursEnabled','startTime','endTime','nextDay'])assert.equal(repaired[k],previous[k],'se conserva '+k);
const repairPlan=rw.PeladoDailyImport.plan(parsed,'36546','QA','2026-08');assert.equal(rw.PeladoDaily.repairPCC('2026-08',repairPlan.records).updated,0,'repetir no duplica');
assert.equal(rw.PeladoDaily.repairPCC('2026-08',[{...repairPlan.records[0],libras:149}]).skipped,1,'no modifica días con libras distintas');
repairBoot.dom.window.close();
console.log('Importación, redondeo, cortes por fecha, edición, conflictos, guardado atómico y borrado por período: OK');
dom.window.close();
