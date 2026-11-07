// Prueba rápida: abre la app, carga datos de ejemplo y recorre todas las vistas buscando errores.
const { chromium } = require('playwright');
const path = require('path');
(async () => {
  const browser = await chromium.launch();
  const page = await browser.newPage({ viewport: { width: 1400, height: 900 } });
  const errors = [];
  page.on('pageerror', e => errors.push('pageerror: ' + e.message));
  page.on('console', m => { if (m.type() === 'error') errors.push('console: ' + m.text()); });
  await page.goto('file://' + path.resolve(__dirname, '../PERLA3CIFRAS_PRO.html'));
  await page.waitForFunction(() => window.P3);
  await page.click('#btnDemo');
  await page.click('.modal footer .btn.gold');
  await page.waitForFunction(() => P3.Store.resultados.length === 840);
  const views = ['inicio','loterias','historico','estadisticas','cifras','generar','alg1','alg2','alg3','aciertos','comparador','informes','excel','config','ayuda'];
  for (const v of views) {
    await page.evaluate(v => P3.UI.go(v), v);
    await page.waitForTimeout(250);
    const txt = await page.textContent('#view');
    if (/^Error/.test(txt.trim())) errors.push(v + ': ' + txt.slice(0, 200));
  }
  for (const t of ['frecuencia','posiciones','parejas','ternas','repeticiones','paridad','periodos']) {
    await page.evaluate(t => { StatV.tab = t; P3.UI.go('estadisticas'); }, t);
    await page.waitForTimeout(200);
  }
  console.log(errors.length ? errors.join('\n') : 'SIN ERRORES');
  await browser.close();
})();
