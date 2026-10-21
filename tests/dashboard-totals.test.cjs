const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const path = require('node:path');
const root = path.resolve(__dirname, '..');
function boot(source) {
  const element = { innerHTML: '' };
  const context = vm.createContext({
    console, structuredClone,
    document: { addEventListener() {}, querySelector() { return element; } },
    localStorage: { getItem() { return null; } }
  });
  context.window = context;
  for (const name of ['core.js', 'variables.js']) vm.runInContext(fs.readFileSync(path.join(root, name), 'utf8'), context);
  vm.runInContext(source.replace(/\}\)\(\);\s*$/, 'globalThis.testApi = { state, renderDashboard, money, calculateMonthStats };})();'), context);
  return { api: context.testApi, element };
}
const current = boot(fs.readFileSync(path.join(root, 'app.js'), 'utf8'));
function amount(html, className) {
  return html.match(new RegExp('<div class="' + className + '">([^<]*)</div>'))[1];
}
for (const pounds of [0, 1000, 1900, 2000, 2123.28]) for (const absent of [false, true]) {
  for (const instance of [current]) {
    const state = instance.api.state;
    state.currentYear = 2099; state.currentMonth = 0;
    state.months = { '2099-01': { days: {
      ...(pounds ? { '2099-01-21': { date: '2099-01-21', type: 'trabajado', grande: 10, libras: pounds, shift: 'manana' } } : {}),
      '2099-01-22': { date: '2099-01-22', type: 'libre' },
      ...(absent ? { '2099-01-23': { date: '2099-01-23', type: 'falta' } } : {})
    } } };
    instance.api.renderDashboard();
  }
  const html = current.element.innerHTML;
  const stats = current.api.calculateMonthStats(Object.values(current.api.state.months['2099-01'].days));
  const extra = Math.round(pounds * 0.02 * 100) / 100;
  const total = Math.floor((stats.productionAdjusted + stats.freeMoney + (absent ? 0 : current.api.state.config.attendanceBonus) + extra + Number.EPSILON) * 100) / 100;
  assert.equal(amount(html, 'projection-value'), current.api.money(total));
  const truncate = value => Math.floor((value + Number.EPSILON) * 100) / 100;
  const expectedProjection = truncate(truncate(stats.productionAdjusted + truncate(stats.average * stats.remainingWorkableDays)) + stats.freeMoney + (absent ? 0 : current.api.state.config.attendanceBonus) + extra);
  assert.equal(amount(html, 'hero-amount'), current.api.money(expectedProjection), 'Upper projection must retain future production');
  assert.ok(html.includes('Producción futura estimada (no incluida)'));
  assert.ok(html.includes('<span>Extra conjunto estimado</span><strong>' + current.api.money(pounds * 0.02) + '</strong>'));
  assert.ok(html.includes('Estimación conjunta incluida en los totales'));
  assert.ok(html.includes('<span>Avance 25 y avance 50 (estimación conjunta)</span><strong>' + current.api.money(extra) + '</strong>'));
  assert.ok(html.includes('<span>Saldo estimado por cobrar</span><strong>' + current.api.money(expectedProjection) + '</strong>'));
  assert.equal(current.api.state.realPayments['2099-01'], undefined, 'estimate does not create a received payment');
  if (pounds) assert.notEqual(amount(html, 'projection-value'), amount(html, 'hero-amount'));
}
console.log('10 escenarios: avances sumados una vez a ambos totales y al saldo, producción futura excluida del acumulado, pagos reales intactos.');
