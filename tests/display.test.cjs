const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const { JSDOM } = require('jsdom');
const base = path.resolve(__dirname, '..');
const html = fs.readFileSync(path.join(base, 'index.html'), 'utf8').replace(/<script[\s\S]*?<\/script>/g, '');
const source = fs.readFileSync(path.join(base, 'display.js'), 'utf8');
const wait = () => new Promise(resolve => setTimeout(resolve, 30));
async function boot(native) {
  const dom = new JSDOM(html, {url:'https://appassets.androidplatform.net/assets/index.html',runScripts:'outside-only'});
  const w = dom.window;
  if (native) w.PeladoAndroid = native;
  vm.runInContext(source, dom.getInternalVMContext());
  await wait();
  return dom;
}
(async () => {
  const dom = await boot(); const w = dom.window;
  const button = w.document.getElementById('fullscreenBtn');
  let requested = 0, exited = 0;
  w.document.documentElement.requestFullscreen = async options => {
    assert.equal(options.navigationUI, 'hide'); requested++;
    Object.defineProperty(w.document, 'fullscreenElement', {value:w.document.documentElement, configurable:true});
    w.document.dispatchEvent(new w.Event('fullscreenchange'));
  };
  w.document.exitFullscreen = async () => {
    exited++;
    Object.defineProperty(w.document, 'fullscreenElement', {value:null, configurable:true});
    w.document.dispatchEvent(new w.Event('fullscreenchange'));
  };
  button.click(); await wait();
  assert.equal(requested,1); assert.equal(button.getAttribute('aria-pressed'),'true');
  button.click(); await wait(); assert.equal(exited,1);
  w.document.documentElement.requestFullscreen = async () => { throw new Error('denied'); };
  button.click(); await wait(); assert.match(w.document.getElementById('toast').textContent,/no permitió/);
  assert.equal(w.localStorage.length,0);
  dom.window.close();
  const exports = [];
  const nativeDom = await boot({saveFile:(...args) => exports.push(args)});
  const n = nativeDom.window;
  assert(n.document.getElementById('fullscreenBtn').hidden);
  const blobs = new Map();
  n.URL.createObjectURL = blob => { const id = 'blob:test-'+blobs.size; blobs.set(id,blob); return id; };
  n.URL.revokeObjectURL = () => {};
  n.fetch = async url => ({blob:async()=>blobs.get(url)});
  const anchor=n.document.createElement('a');
  anchor.href=n.URL.createObjectURL(new n.Blob(['{"values":{}}'],{type:'application/json'}));
  anchor.download='pelado-respaldo.json'; anchor.click(); await wait();
  assert.equal(exports[0][1],'pelado-respaldo.json');
  assert.equal(Buffer.from(exports[0][0],'base64').toString(),'{"values":{}}');
  // jsPDF usa un clic sintético sobre un enlace no insertado en document.
  n.HTMLCanvasElement.prototype.getContext = () => null;
  for(const file of ['jspdf.umd.min.js','jspdf.plugin.autotable.min.js']) vm.runInContext(fs.readFileSync(path.join(base,file),'utf8'),nativeDom.getInternalVMContext());
  const pdf=new n.jspdf.jsPDF(); pdf.text('Pelado: comprobacion PDF',10,10); pdf.save('informe-pelado.pdf');
  await wait(); await wait();
  const saved=exports.find(args=>args[1]==='informe-pelado.pdf');
  assert(saved,'PDF save must reach the native bridge');
  assert.equal(Buffer.from(saved[0],'base64').subarray(0,5).toString(),'%PDF-');
  assert.equal(n.localStorage.length,0);
  nativeDom.window.close();
  console.log('PASS full-screen enter/exit/error, native JSON backup and actual jsPDF export, no storage changes');
})().catch(error=>{console.error(error);process.exit(1)});
