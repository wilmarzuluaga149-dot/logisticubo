// Pruebas de la actualización automática.  Ejecutar: node tests/auto.js [ruta_html_con_datos_incluidos]
const { chromium } = require('playwright');
const path = require('path'), fs = require('fs'), os = require('os');
const APP = 'file://' + path.resolve(__dirname, '../PERLA3CIFRAS_PRO.html');
const CON_DATOS = process.argv[2] ? 'file://' + path.resolve(process.argv[2]) : null;
const TMP = fs.mkdtempSync(path.join(os.tmpdir(), 'p3auto-'));
let ok = 0, fail = 0;
const check = (c, m) => { c ? ok++ : fail++; console.log((c ? '  ✔ ' : '  ✘ ') + m); };
const proxy = process.env.HTTPS_PROXY ? { server: process.env.HTTPS_PROXY } : undefined;
const esperarAuto = (p, ms = 900000) => p.waitForFunction(() => window.P3 && !P3.Auto.running && !P3.Auto.cola.size, null, { timeout: ms, polling: 500 });
const idle = async (p) => { await p.waitForTimeout(700); await esperarAuto(p); };

(async () => {
  const browser = await chromium.launch({ proxy });
  const errors = [];
  if (CON_DATOS) {
    console.log('1. Archivo con el histórico incluido: se carga y se analiza solo');
    const ctx = await browser.newContext({ ignoreHTTPSErrors: true }); const p = await ctx.newPage();
    p.on('pageerror', e => errors.push(e.message));
    const t = Date.now();
    await p.goto(CON_DATOS); await p.waitForFunction(() => window.P3 && P3.Store.resultados.length > 7000, null, { timeout: 120000 });
    const n1 = await p.evaluate(() => P3.Store.resultados.length);
    check(true, 'al abrir, el histórico incluido se cargó solo: ' + await p.evaluate(() => P3.Store.resultados.length) + ' resultados');
    await idle(p);
    const s = await p.evaluate(() => {
      const L = P3.Store.loterias.filter(l => P3.Store.resultadosDe(l.id).length >= 10);
      const sinAuto = L.filter(l => !P3.Store.pronosticos.some(x => x.origen === 'auto' && x.loteriaId === l.id && x.fechaObjetivo === nextDrawDate(l.id)));
      const bt = P3.Store.pronosticos.filter(x => x.origen === 'backtest').length;
      const med = P3.Store.findLoteriaByName('Lotería de Medellín').id;
      const ev = P3.Hits.summary({ loteriaId: med }).per[1].evaluados;
      return { L: L.length, sinAuto: sinAuto.map(l => l.nombre), bt, ev };
    });
    check(s.sinAuto.length === 0, `pronóstico automático del próximo sorteo listo en las ${s.L} loterías con datos suficientes (${((Date.now() - t) / 1000).toFixed(0)} s)`);
    check(s.bt > 1000 && s.ev >= 90, `prueba histórica automática: ${s.bt} pronósticos; Medellín con ${s.ev} evaluados por algoritmo`);
    await p.evaluate(() => { P3.UI.ctxLoteria = P3.Store.findLoteriaByName('Lotería de Medellín').id; P3.UI.refreshCtx(); Hist.filtro.loteriaId = P3.UI.ctxLoteria; P3.UI.go('historico'); });
    check(/D#|C#|\d\/3/.test(await p.textContent('#hTable')), 'Histórico: columnas de aciertos y algoritmos llenas sin hacer nada');
    await p.evaluate(() => P3.UI.go('comparador'));
    check(!(await p.textContent('#view')).includes('Aún no hay pronósticos evaluados'), 'Comparador con datos sin hacer nada');
    await p.reload(); await p.waitForFunction(() => window.P3); await p.waitForTimeout(800);
    const n2 = await p.evaluate(() => P3.Store.resultados.length);
    check(n2 >= n1 && n2 < n1 + 50, 'al volver a abrir no se duplica el histórico (' + n2 + ')');
    await ctx.close();
  }

  console.log('2. Botón «Importar archivo» desde cualquier pantalla: se guarda y analiza solo');
  const ctx = await browser.newContext({ acceptDownloads: true, ignoreHTTPSErrors: true }); const page = await ctx.newPage();
  page.on('pageerror', e => errors.push(e.message + ' @ ' + (e.stack || '').split('\n')[1]));
  await page.goto(APP); await page.waitForFunction(() => window.P3);
  const ev = (fn, a) => page.evaluate(fn, a);
  let csv = 'FECHA;LOTERIA;NUMERO\n'; const d0 = new Date(Date.UTC(2026, 0, 1));
  for (let i = 0; i < 200; i++) { const d = new Date(d0); d.setUTCDate(d.getUTCDate() + i); csv += `${d.toISOString().slice(0, 10)};Chance Prueba;${String((i * 7919) % 10000).padStart(4, '0')}\n`; }
  const f1 = path.join(TMP, 'chance.csv'); fs.writeFileSync(f1, csv);
  await ev(() => P3.UI.go('estadisticas'));
  check(await page.isVisible('#btnImportar'), 'botón «⇪ Importar archivo» visible en la barra superior');
  await page.setInputFiles('#globalFile', f1);
  await page.waitForSelector('#iaOut .card h2', { timeout: 120000 });
  const r1 = await ev(() => { const l = P3.Store.findLoteriaByName('Chance Prueba'); const rs = P3.Store.resultadosDe(l.id); return { n: rs.length, n0: rs[0].numero, vista: P3.UI.current }; });
  check(r1.n === 200 && r1.vista === 'importar', 'se importaron los 200 resultados sin pulsar ningún botón y se muestra el análisis');
  check(r1.n0 === '000' && await ev(() => P3.Store.resultadosDe(P3.Store.findLoteriaByName('Chance Prueba').id)[1].numero) === '919', 'números de 4 cifras detectados: se guardan las 3 últimas (7919 → 919)');
  await idle(page);
  const a1 = await ev(() => { const l = P3.Store.findLoteriaByName('Chance Prueba').id; return { auto: P3.Store.pronosticos.filter(p => p.loteriaId === l && p.origen === 'auto').length, bt: P3.Store.pronosticos.filter(p => p.loteriaId === l && p.origen === 'backtest').length, f: P3.Store.pronosticos.find(p => p.loteriaId === l && p.origen === 'auto')?.fechaObjetivo }; });
  check(a1.auto === 3 && a1.f === '2026-07-20', 'pronóstico automático de los 3 algoritmos para el próximo sorteo (20/07/2026)');
  check(a1.bt === 300, 'prueba histórica automática de los últimos 100 sorteos × 3 algoritmos');

  console.log('3. Soltar un archivo sobre cualquier pantalla');
  await ev(() => P3.UI.go('inicio'));
  let csv2 = 'FECHA;LOTERIA;NUMERO\n'; for (let i = 200; i < 205; i++) { const d = new Date(d0); d.setUTCDate(d.getUTCDate() + i); csv2 += `${d.toISOString().slice(0, 10)};Chance Prueba;${String(i).padStart(3, '0')}\n`; }
  await page.evaluate(async (txt) => {
    const dt = new DataTransfer(); dt.items.add(new File([txt], 'nuevos.csv', { type: 'text/csv' }));
    document.getElementById('view').dispatchEvent(new DragEvent('dragover', { dataTransfer: dt, bubbles: true }));
    document.getElementById('view').dispatchEvent(new DragEvent('drop', { dataTransfer: dt, bubbles: true }));
  }, csv2);
  await page.waitForFunction(() => P3.Store.resultadosDe(P3.Store.findLoteriaByName('Chance Prueba').id).length === 205, null, { timeout: 60000 });
  check(true, 'archivo soltado sobre el Inicio: 5 resultados nuevos guardados (200 → 205)');
  await idle(page);
  check(await ev(() => P3.Store.pronosticos.some(p => p.origen === 'auto' && p.fechaObjetivo === '2026-07-25')), 'el pronóstico automático se movió solo al nuevo próximo sorteo (25/07/2026)');
  const ev20 = await ev(() => { const l = P3.Store.findLoteriaByName('Chance Prueba').id; const ps = P3.Store.pronosticos.filter(p => p.loteriaId === l && p.origen === 'auto' && p.fechaObjetivo === '2026-07-20'); return ps.map(p => P3.Hits.evaluate(p).estado); });
  check(ev20.length === 3 && ev20.every(e => e === 'evaluado'), 'los pronósticos automáticos anteriores quedaron evaluados con el resultado real');

  console.log('4. Un resultado escrito a mano también actualiza todo');
  await ev(() => P3.Store.saveResultado({ fecha: '2026-07-25', loteriaId: P3.Store.findLoteriaByName('Chance Prueba').id, numero: '123' }));
  await idle(page);
  check(await ev(() => P3.Store.pronosticos.some(p => p.origen === 'auto' && p.fechaObjetivo === '2026-07-26')), 'nuevo pronóstico automático para 26/07/2026');

  console.log('5. Archivo sin columna de lotería: pide revisión en vez de adivinar');
  const f3 = path.join(TMP, 'sinlot.csv'); fs.writeFileSync(f3, 'FECHA;NUMERO\n2026-01-01;123\n2026-01-02;456\n');
  const antes = await ev(() => P3.Store.resultados.length);
  await page.setInputFiles('#globalFile', f3); await page.waitForSelector('#iaGo');
  check(await ev(() => P3.Store.resultados.length) === antes, 'no se importó nada sin saber la lotería; se muestra la revisión');

  console.log('6. Actualización en línea desde datos.gov.co');
  await ev(async () => {
    const m = await P3.Store.saveLoteria({ nombre: 'Lotería de Medellín' }); const s = await P3.Store.saveLoteria({ nombre: 'Lotería de Santander' });
    await P3.Store.bulkResultados([{ fecha: '2026-09-18', loteriaId: m.id, numero: '001' }, { fecha: '2026-10-30', loteriaId: s.id, numero: '037' }]);
  });
  const rl = await ev(() => P3.EnLinea.actualizar({ silencioso: false }));
  const rr = await ev(() => ({ med: P3.Store.resultadosDe(P3.Store.findLoteriaByName('Lotería de Medellín').id).map(r => r.fecha + '=' + r.numero), san: P3.Store.resultadosDe(P3.Store.findLoteriaByName('Lotería de Santander').id).map(r => r.fecha + '=' + r.numero) }));
  check(rr.med.includes('2026-10-09=169') && rr.med.length >= 4, 'Medellín descargada de internet: ' + rr.med.slice(1).join(', '));
  check(rr.san.includes('2026-11-06=151'), 'Santander descargada de internet: ' + rr.san.slice(1).join(', '));
  await ev(() => P3.UI.go('config'));
  check((await page.textContent('#view')).includes('Actualización automática'), 'Configuración muestra las opciones de actualización automática');
  check(errors.length === 0, 'sin errores de JavaScript' + (errors.length ? ': ' + errors.join(' | ') : ''));
  console.log(`\nRESULTADO: ${ok} correctas, ${fail} fallidas`);
  await browser.close(); process.exit(fail ? 1 : 0);
})().catch(e => { console.error(e); process.exit(2); });
