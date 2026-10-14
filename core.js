/* Funciones puras compartidas por interfaz y pruebas. Fechas siempre locales. */
(function(root){
'use strict';
const keys=['grande','mediano','pequeno','adicional'];
const trunc=v=>Math.floor((Number(v)+Number.EPSILON)*100)/100;
const dateKey=d=>`${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`;
function parseDate(s){if(!/^\d{4}-\d{2}-\d{2}$/.test(s))throw Error('Fecha inválida');const [y,m,d]=s.split('-').map(Number),v=new Date(y,m-1,d,12);if(dateKey(v)!==s)throw Error('Fecha inválida');return v;}
function periodOf(s){const d=typeof s==='string'?parseDate(s):new Date(s);if(d.getDate()<21)d.setMonth(d.getMonth()-1,21);else d.setDate(21);return dateKey(d).slice(0,7);}
function dates(y,m){const end=new Date(y,m+1,20,12),out=[];for(let d=new Date(y,m,21,12);d<=end;d.setDate(d.getDate()+1))out.push(dateKey(d));return out;}
function duration(start,end,next){if(!/^([01]\d|2[0-3]):[0-5]\d$/.test(start||'')||!/^([01]\d|2[0-3]):[0-5]\d$/.test(end||''))throw Error('Completa horas y minutos válidos.');const n=s=>Number(s.slice(0,2))*60+Number(s.slice(3));const minutes=n(end)-n(start)+(next?1440:0);if(minutes<=0||minutes>1440)throw Error('La duración debe ser mayor que cero y como máximo 24 horas. Revisa si termina al día siguiente.');return minutes;}
function calculateDay(r,c){const trays=Object.fromEntries(keys.map(k=>[k,Number(r[k]||0)])),totalTrays=keys.reduce((s,k)=>s+trays[k],0),lbPerTray=totalTrays>0&&r.libras>0?r.libras/totalTrays:0;
const lb={},money={},prices={};for(const k of keys){lb[k]=trays[k]*lbPerTray;prices[k]=(Number(c.prices[k]||0)+(r.shift==='noche'?Number(c.nightSurcharge):0))*(r.holiday?Number(c.holidayMultiplier):1);money[k]=trunc(lb[k]*prices[k]);}
const peelingMoney=trunc(keys.reduce((s,k)=>s+money[k],0));let minutes=0,hourError='';if(r.hoursEnabled){try{minutes=duration(r.startTime,r.endTime,r.nextDay);}catch(e){hourError=e.message;}}
const hoursMoney=trunc(minutes/60*Number(c.hourlyRate)*(r.holiday?Number(c.hourHolidayMultiplier):1));return {totalTrays,lbPerTray,lb,money,prices,peelingMoney,hoursMoney,minutes,hourError,totalMoney:hoursMoney===0?peelingMoney:(peelingMoney===0?hoursMoney:trunc(peelingMoney+hoursMoney))};}
function migrate(old){const periods={},conflicts=[];for(const bucket of Object.values(old||{}))for(const [date,record]of Object.entries(bucket.days||{})){try{parseDate(date);const k=periodOf(date);periods[k]??={days:{}};if(periods[k].days[date]&&JSON.stringify(periods[k].days[date])!==JSON.stringify(record))conflicts.push({date,record});else periods[k].days[date]={...record,date};}catch{conflicts.push({date,record});}}return {periods,conflicts};}
function remaining(y,m,records,today=new Date()){const now=dateKey(today);return dates(y,m).filter(d=>d>now&&!['libre','falta'].includes(records[d]?.type)).length;}
// Un precio unitario expresado en centavos por cada día libre registrado.
function freeDayPay(count,rate){const cents=Math.floor((Number(rate)+Number.EPSILON)*100);return cents*Math.max(0,Math.floor(Number(count)||0))/100;}
function category(size){const s=String(size).trim().toUpperCase();if(!s)return 'Sin talla';if(s==='51')return 'Pequeño';if(['31','36','41'].includes(s))return 'Mediano';if(['15','16','21','26'].includes(s))return 'Grande';return 'Sin clasificar';}
root.PeladoCore={keys,trunc,dateKey,parseDate,periodOf,dates,duration,calculateDay,migrate,remaining,category,freeDayPay};
if(typeof module!=='undefined')module.exports=root.PeladoCore;
})(typeof window!=='undefined'?window:globalThis);
