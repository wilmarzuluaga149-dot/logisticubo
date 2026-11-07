// Pruebas funcionales de PERLA 3 CIFRAS PRO (control de calidad, fase 8).
// Ejecutar: node tests/funcional.js   (requiere Playwright y el paquete xlsx)
const { chromium, devices } = require('playwright');
const XLSX = require('xlsx');
const path = require('path'), fs = require('fs'), os = require('os');
const APP = 'file://' + path.resolve(__dirname, '../PERLA3CIFRAS_PRO.html');
const TMP = fs.mkdtempSync(path.join(os.tmpdir(), 'p3test-'));
let ok = 0, fail = 0;
const check = (cond, msg) => { if (cond) { ok++; console.log('  ✔ ' + msg); } else { fail++; console.log('  ✘ ' + msg); } };

(async () => {
  const browser = await chromium.launch();
  const ctx = await browser.newContext({ acceptDownloads: true, viewport: { width: 1366, height: 900 } });
  const page = await ctx.newPage();
  const errors = [];
  page.on('pageerror', e => errors.push(e.message + ' @ ' + (e.stack || '').split('\n').slice(1, 3).join(' ')));
  page.on('dialog', d => d.accept());
  await page.goto(APP); await page.waitForFunction(() => window.P3);
  const ev = (fn, arg) => page.evaluate(fn, arg);
  const confirmModal = async () => { await page.click('.modal footer .btn.gold, .modal footer .btn.danger'); await page.waitForTimeout(150); };

  console.log('1. Loterías y registro de resultados');
  await ev(() => P3.UI.go('loterias'));
  await page.fill('#lNombre', 'Prueba Uno'); await page.click('#fLot button[type=submit]'); await page.waitForTimeout(200);
  check(await ev(() => P3.Store.loterias.length) === 1, 'lotería creada desde el formulario');
  await page.fill('#lNombre', 'prueba uno'); await page.click('#fLot button[type=submit]'); await page.waitForTimeout(200);
  check(await ev(() => P3.Store.loterias.length) === 1, 'nombre de lotería duplicado rechazado');
  await ev(() => P3.UI.go('historico'));
  await page.fill('#rFecha', '2026-01-10'); await page.fill('#rNum', '7'); await page.click('#fRes button[type=submit]'); await page.waitForTimeout(200);
  check(await ev(() => P3.Store.resultados[0]?.numero) === '007', 'número 7 guardado como "007"');
  await page.fill('#rFecha', '2026-01-10'); await page.fill('#rNum', '25'); await page.click('#fRes button[type=submit]'); await page.waitForTimeout(200);
  check(await ev(() => P3.Store.resultados.length) === 1, 'duplicado misma lotería/fecha rechazado');
  await page.fill('#rFecha', '2026-01-11'); await page.fill('#rNum', '089'); await page.click('#fRes button[type=submit]'); await page.waitForTimeout(200);
  check(await ev(() => P3.Store.resultados.map(r => r.numero).join(',')) === '007,089', 'segundo resultado 089 guardado');
  const bad = await ev(async () => { try { await P3.Store.saveResultado({ fecha: '2026-02-30', loteriaId: 1, numero: '5' }); return 'aceptado'; } catch (e) { return e.message; } });
  check(/Fecha inválida/.test(bad), 'fecha inválida (30/02) rechazada');
  const bad2 = await ev(async () => { try { await P3.Store.saveResultado({ fecha: '2026-01-12', loteriaId: 1, numero: '1234' }); return 'aceptado'; } catch (e) { return e.message; } });
  check(/número/.test(bad2), 'número de 4 cifras rechazado');
  const tbl = await page.textContent('#hTable');
  check(tbl.includes('007') && tbl.includes('089'), 'tabla del histórico muestra 007 y 089 con ceros');

  console.log('2. Persistencia (recarga de página)');
  await page.reload(); await page.waitForFunction(() => window.P3);
  check(await ev(() => P3.Store.resultados.map(r => r.numero).join(',')) === '007,089', 'datos recuperados tras recargar');
  // Editar
  await ev(() => P3.Store.saveResultado({ id: 2, fecha: '2026-01-11', loteriaId: 1, numero: '90' }));
  check(await ev(() => P3.Store.resultadoDe(1, '2026-01-11').numero) === '090', 'edición de registro (90 → 090)');
  await ev(() => P3.UI.go('historico'));
  await page.click('#hTable [data-d="2"]'); await confirmModal();
  check(await ev(() => P3.Store.resultados.length) === 1, 'eliminación con confirmación');

  console.log('3. Datos de ejemplo y algoritmos');
  await ev(() => P3.UI.go('inicio'));
  await ev(() => { P3.Demo.cargar(); }); await page.waitForSelector('.modal'); await confirmModal();
  await page.waitForFunction(() => P3.Store.resultados.length === 841);
  const demo = await ev(() => { const l = P3.Store.loterias.find(x => x.ejemplo); return { id: l.id, n: P3.Store.resultadosDe(l.id).length, last: P3.Store.resultadosDe(l.id).slice(-1)[0].fecha }; });
  check(demo.n === 420, 'datos de ejemplo: 420 sorteos por lotería, marcados como EJEMPLO');
  const gen = await ev(({ id, last }) => {
    const out = {};
    for (const a of [1, 2, 3]) { const p = P3.Algo.generar({ alg: a, loteriaId: id, fechaObjetivo: last, k: 20 }); out[a] = { nums: p.candidatos.map(c => c.n), corte: p.fechaCorte, nHist: p.nHist, razon: p.candidatos[0].razon, scores: p.candidatos.map(c => c.score) }; }
    out.again = P3.Algo.generar({ alg: 1, loteriaId: id, fechaObjetivo: last, k: 20 }).candidatos.map(c => c.n);
    out.k = [5, 10, 20, 50, 100].map(k => P3.Algo.generar({ alg: 3, loteriaId: id, fechaObjetivo: last, k }).candidatos.length);
    return out;
  }, demo);
  check(gen[1].nums.length === 20 && gen[1].nums.every(n => /^\d{3}$/.test(n)), 'A1 genera 20 candidatos de 3 cifras');
  check(gen[1].corte < demo.last && gen[1].nHist === 419, 'sin información futura: usa 419 sorteos anteriores a la fecha objetivo');
  check(JSON.stringify(gen[1].nums) !== JSON.stringify(gen[2].nums) && JSON.stringify(gen[2].nums) !== JSON.stringify(gen[3].nums) && JSON.stringify(gen[1].nums) !== JSON.stringify(gen[3].nums), 'los tres algoritmos generan listas distintas');
  check(JSON.stringify(gen.again) === JSON.stringify(gen[1].nums), 'resultado determinista (mismos datos → mismos candidatos)');
  check(gen.k.join(',') === '5,10,20,50,100', 'cantidades 5/10/20/50/100 respetadas');
  check(gen[1].razon && gen[2].razon && gen[3].razon, 'cada candidato incluye explicación');
  check(gen[1].scores.every((s, i, a) => i === 0 || a[i - 1] >= s), 'candidatos ordenados por puntuación');
  // Pesos del algoritmo 3 cambian el resultado
  const w = await ev(async ({ id, last }) => {
    const a = P3.Algo.generar({ alg: 3, loteriaId: id, fechaObjetivo: last, k: 10 }).candidatos.map(c => c.n).join();
    await P3.Store.setConfig('a3Pesos', { frecuencia: 0, tendencia: 0, posiciones: 0, parejas: 0, ternas: 0, ausencias: 100 });
    const b = P3.Algo.generar({ alg: 3, loteriaId: id, fechaObjetivo: last, k: 10 }).candidatos.map(c => c.n).join();
    await P3.Store.setConfig('a3Pesos', { frecuencia: 20, tendencia: 20, posiciones: 20, parejas: 15, ternas: 10, ausencias: 15 });
    return a !== b;
  }, demo);
  check(w, 'modificar los pesos del Algoritmo 3 cambia los candidatos');

  console.log('4. Sistema de aciertos');
  const hits = await ev(async () => {
    const S = P3.Store, H = P3.Hits;
    const l = await S.saveLoteria({ nombre: 'Aciertos Test' });
    await S.bulkResultados([{ fecha: '2026-03-01', loteriaId: l.id, numero: '123' }, { fecha: '2026-03-02', loteriaId: l.id, numero: '337' }, { fecha: '2026-03-03', loteriaId: l.id, numero: '450' }]);
    const mk = (fecha, nums) => ({ algoritmo: 1, loteriaId: l.id, fechaObjetivo: fecha, fechaCorte: '2026-02-28', nHist: 0, cantidad: nums.length, origen: 'manual', creado: new Date().toISOString(), candidatos: nums.map(n => ({ n, score: 1 })) });
    const pD = mk('2026-03-01', ['999', '123', '321']), pC = mk('2026-03-01', ['231', '555']), pN = mk('2026-03-01', ['124', '000']);
    const pRep = mk('2026-03-02', ['373']), pPend = mk('2026-03-09', ['111']), pLeak = { ...mk('2026-03-03', ['450']), fechaCorte: '2026-03-03' };
    const r = {};
    r.D = H.evaluate(pD); r.C = H.evaluate(pC); r.N = H.evaluate(pN); r.Rep = H.evaluate(pRep); r.Pend = H.evaluate(pPend); r.Leak = H.evaluate(pLeak);
    await S.setConfig('combinadoIncluyeDirecto', true); r.D2 = H.evaluate(pD);
    await S.setConfig('combinadoIncluyeDirecto', false); await S.setConfig('combinadoConRepetidas', false); r.Rep2 = H.evaluate(pRep);
    await S.setConfig('combinadoConRepetidas', true);
    await S.savePronosticos([pD, pC, pN]);
    const sum = H.summary({ loteriaId: l.id }).per[1];
    r.sum = { D: sum.D, C: sum.C, ev: sum.evaluados, eD: +sum.eD.toFixed(4) };
    await S.deleteLoteria(l.id);
    return r;
  });
  check(hits.D.directo && hits.D.rank === 2 && !hits.D.combinado, 'D-Ganador: 123 vs 123 (posición 2); no se duplica como combinado');
  check(!hits.C.directo && hits.C.combinado, 'C-Ganador: 231 vs 123 (mismas cifras, otro orden)');
  check(!hits.N.acierto && hits.N.mejorPos === 2, '124 vs 123 no es acierto (mejor coincidencia 2/3)');
  check(hits.Rep.combinado, 'combinado con cifras repetidas: 373 vs 337');
  check(!hits.Rep2.combinado, 'regla configurable: combinado sin repetidas desactivado → no cuenta');
  check(hits.D2.directo && hits.D2.combinado, 'regla configurable: directo también cuenta como combinado');
  check(hits.Pend.estado === 'pendiente', 'sin resultado → pendiente (no se cuenta)');
  check(hits.Leak.estado === 'invalido', 'pronóstico con datos del mismo día → no evaluable');
  check(hits.sum.D === 1 && hits.sum.C === 1 && hits.sum.ev === 3 && hits.sum.eD === 0.007, 'resumen: 1 D, 1 C, 3 evaluados, esperado azar D = 0,007');

  console.log('5. Prueba histórica cronológica');
  await ev(() => P3.UI.go('aciertos'));
  await page.selectOption('#btL', String(demo.id));
  await page.fill('#btDesde', await ev(id => P3.Store.resultadosDe(id)[300].fecha, demo.id));
  await page.click('#btGo');
  await page.waitForFunction(() => document.querySelector('#btGo')?.textContent.includes('Cancelar'));
  await page.waitForFunction(() => document.querySelector('#btGo')?.textContent.includes('Ejecutar'), null, { timeout: 120000 });
  const bt = await ev(id => {
    const ps = P3.Store.pronosticos.filter(p => p.origen === 'backtest' && p.loteriaId === id);
    const leak = ps.filter(p => !(p.fechaCorte < p.fechaObjetivo) || p.nHist !== P3.Store.resultadosDe(id).filter(r => r.fecha < p.fechaObjetivo).length);
    const s = P3.Hits.summary({ loteriaId: id, origen: 'backtest' }).per;
    return { n: ps.length, leak: leak.length, ev: [1, 2, 3].map(a => s[a].evaluados) };
  }, demo.id);
  check(bt.n === 120 * 3, 'prueba histórica: 120 sorteos × 3 algoritmos = 360 pronósticos');
  check(bt.leak === 0, 'cada pronóstico usa solo los sorteos anteriores (sin fuga de información)');
  check(bt.ev.every(x => x === 120), 'todos los pronósticos de prueba evaluados');
  const histTxt = await (async () => { await ev(() => { Hist.filtro.loteriaId = P3.Store.loterias.find(x => x.ejemplo).id; P3.UI.go('historico'); }); return page.textContent('#hTable'); })();
  check(/\d\/3|D#|C#/.test(histTxt), 'columnas Aciertos A1–A3 / Algoritmo 1–3 llenas en el histórico');
  await page.click('#btnMenu').catch(() => { });
  await ev(() => P3.UI.go('comparador'));
  check((await page.textContent('#view')).includes('Rendimiento vs azar'), 'comparador muestra tabla de rendimiento');
  check(await ev(() => P3.UI.charts.length) >= 3, 'comparador dibuja gráficos con datos');

  console.log('6. Filtros');
  const filt = await ev(id => {
    Hist.filtro = { loteriaId: id, desde: '', hasta: '', numero: '' }; P3.UI.go('historico');
    const n1 = document.querySelector('#hTable .pager span').textContent;
    document.getElementById('hNum').value = P3.Store.resultadosDe(id)[0].numero; document.getElementById('hNum').dispatchEvent(new Event('input'));
    return n1;
  }, demo.id);
  check(filt.startsWith('420'), 'filtro por lotería: 420 registros');
  await page.waitForTimeout(500);
  const n2 = await page.textContent('#hTable .pager span');
  check(parseInt(n2) >= 1 && parseInt(n2) < 420, 'filtro por número reduce los registros (' + n2.split(' ')[0] + ')');
  await page.fill('#hNum', ''); await page.fill('#hDesde', '2099-01-01'); await page.dispatchEvent('#hDesde', 'change');
  check((await page.textContent('#hTable .pager span')).startsWith('0'), 'filtro por fecha');

  console.log('7. Excel: exportación');
  await ev(() => P3.UI.go('excel'));
  const [dl] = await Promise.all([page.waitForEvent('download'), page.click('#xAll')]);
  const f1 = path.join(TMP, dl.suggestedFilename()); await dl.saveAs(f1);
  const wb = XLSX.readFile(f1);
  const need = ['RESULTADOS', 'ESTADISTICAS', 'ALGORITMO_1', 'ALGORITMO_2', 'ALGORITMO_3', 'PRONOSTICOS', 'ACIERTOS', 'COMPARATIVO'];
  check(need.every(s => wb.SheetNames.includes(s)), 'libro completo con las 8 hojas: ' + wb.SheetNames.join(', '));
  const rs = XLSX.utils.sheet_to_json(wb.Sheets.RESULTADOS, { raw: true });
  const c007 = Object.values(wb.Sheets.RESULTADOS).find(c => c && c.v === '007');
  check(c007 && c007.t === 's', 'número 007 exportado como texto');
  const totalRes = await ev(() => P3.Store.resultados.length);
  check(rs.length === totalRes, 'hoja RESULTADOS con todos los sorteos (' + rs.length + ')');
  const cmp = XLSX.utils.sheet_to_json(wb.Sheets.COMPARATIVO);
  check(cmp.length === 3 && cmp[0].EVALUADOS >= 120, 'hoja COMPARATIVO con los 3 algoritmos');
  for (const b of ['res', 'est', 'pro', 'aci', 'cmp']) {
    const [d] = await Promise.all([page.waitForEvent('download'), page.click(`[data-x="${b}"]`)]);
    check(/\.xlsx$/.test(d.suggestedFilename()), 'exportación individual: ' + d.suggestedFilename().split('_')[1]);
  }
  const [dt] = await Promise.all([page.waitForEvent('download'), page.click('#xTpl')]);
  check(dt.suggestedFilename().includes('PLANTILLA'), 'plantilla de importación descargada');

  console.log('8. Excel: importación CSV y XLSX');
  const csv = path.join(TMP, 'imp.csv');
  fs.writeFileSync(csv, 'Fecha;Lotería;Número\n05/02/2026;Importada CSV;007\n06/02/2026;Importada CSV;25\n2026-02-07;Importada CSV;089\n31/02/2026;Importada CSV;100\n08/02/2026;Importada CSV;abc\n');
  await page.setInputFiles('#xFile', csv); await page.waitForSelector('#xImp');
  check((await page.textContent('#xCheck')).includes('3'), 'validación previa: 3 filas válidas, 2 con error');
  await page.click('#xImp'); await page.waitForTimeout(400);
  const imp = await ev(() => { const l = P3.Store.findLoteriaByName('Importada CSV'); return l ? P3.Store.resultadosDe(l.id).map(r => r.fecha + '=' + r.numero).join(',') : 'sin lotería'; });
  check(imp === '2026-02-05=007,2026-02-06=025,2026-02-07=089', 'CSV importado con ceros iniciales y fechas DD/MM: ' + imp);
  // XLSX con números como número y fechas nativas de Excel
  const wbx = XLSX.utils.book_new();
  const ws = XLSX.utils.aoa_to_sheet([['FECHA', 'LOTERIA', 'NUMERO'], [new Date(Date.UTC(2026, 1, 9)), 'Importada XLSX', 7], ['10/02/2026', 'Importada XLSX', '045'], [46064, 'Importada XLSX', 999]], { cellDates: true });
  XLSX.utils.book_append_sheet(wbx, ws, 'RESULTADOS');
  const xf = path.join(TMP, 'imp.xlsx'); XLSX.writeFile(wbx, xf);
  await ev(() => P3.UI.go('excel'));
  await page.setInputFiles('#xFile', xf); await page.waitForSelector('#xImp'); await page.click('#xImp'); await page.waitForTimeout(400);
  const impx = await ev(() => { const l = P3.Store.findLoteriaByName('Importada XLSX'); return l ? P3.Store.resultadosDe(l.id).map(r => r.fecha + '=' + r.numero).join(',') : 'sin lotería'; });
  check(impx === '2026-02-09=007,2026-02-10=045,2026-02-11=999', 'XLSX importado (número 7 → 007, fecha nativa y serial): ' + impx);
  // Archivo de ejemplo incluido en datos_ejemplo/
  await ev(() => P3.UI.go('excel'));
  await page.setInputFiles('#xFile', path.resolve(__dirname, '../datos_ejemplo/EJEMPLO_resultados_ficticios.xlsx')); await page.waitForSelector('#xImp'); await page.click('#xImp'); await page.waitForTimeout(600);
  check(await ev(() => P3.Store.resultadosDe(P3.Store.findLoteriaByName('EJEMPLO Archivo Tarde')?.id).length) === 365, 'archivo de ejemplo XLSX importado: 365 sorteos por lotería');
  // Reimportar el libro exportado: todo duplicado
  await ev(() => P3.UI.go('excel'));
  await page.setInputFiles('#xFile', f1); await page.waitForSelector('#xImp'); await page.click('#xImp'); await page.waitForTimeout(600);
  check((await page.textContent('#xPrev')).includes(totalRes + ' duplicados omitidos'), 'reimportar el libro exportado: ' + totalRes + ' duplicados omitidos');

  console.log('9. Copia de seguridad y restauración');
  const before = await ev(() => [P3.Store.loterias.length, P3.Store.resultados.length, P3.Store.pronosticos.length].join('/'));
  const [bk] = await Promise.all([page.waitForEvent('download'), page.click('#bkDown')]);
  const bkf = path.join(TMP, bk.suggestedFilename()); await bk.saveAs(bkf);
  await ev(() => P3.Store.borrarTodo());
  check(await ev(() => P3.Store.resultados.length) === 0, 'datos borrados');
  await ev(() => P3.UI.go('config'));
  await page.setInputFiles('#bkFile', bkf); await page.waitForSelector('.modal'); await confirmModal(); await page.waitForTimeout(500);
  const after = await ev(() => [P3.Store.loterias.length, P3.Store.resultados.length, P3.Store.pronosticos.length].join('/'));
  check(before === after, `restauración completa (${after})`);
  await page.reload(); await page.waitForFunction(() => window.P3);
  check(await ev(() => [P3.Store.loterias.length, P3.Store.resultados.length, P3.Store.pronosticos.length].join('/')) === before, 'restauración persistida tras recargar');
  const badFile = path.join(TMP, 'malo.json'); fs.writeFileSync(badFile, '{"hola":1}');
  await page.setInputFiles('#bkFile', badFile); await page.waitForTimeout(300);
  check((await page.textContent('#toasts')).includes('No se pudo restaurar'), 'archivo de copia inválido rechazado sin perder datos');

  console.log('10. PDF y generador');
  await ev(() => P3.UI.go('generar'));
  await page.selectOption('#gLot', String(demo.id)); await page.click('#gForm button[type=submit]');
  check(await page.locator('#gOut .grid .cand').count() === 30, 'GENERAR PRONÓSTICOS: 3 × 10 candidatos');
  await page.click('#gSave'); await page.waitForTimeout(200);
  check(await ev(() => P3.Store.pronosticos.filter(p => p.origen === 'manual').length) === 3, 'pronósticos guardados con fecha y hora');
  const [pdf] = await Promise.all([page.waitForEvent('download'), page.click('#gPdf')]);
  const pf = path.join(TMP, 'p.pdf'); await pdf.saveAs(pf);
  check(fs.readFileSync(pf).slice(0, 4).toString() === '%PDF', 'PDF de pronósticos generado');
  await ev(() => P3.UI.go('informes'));
  const [pdf2] = await Promise.all([page.waitForEvent('download'), page.click('#iPdf')]);
  check(/\.pdf$/.test(pdf2.suggestedFilename()), 'informe PDF por lotería generado');

  console.log('11. Botones sin función');
  const views = ['inicio', 'loterias', 'historico', 'importar', 'estadisticas', 'cifras', 'generar', 'alg1', 'alg2', 'alg3', 'aciertos', 'comparador', 'informes', 'excel', 'config', 'ayuda'];
  const dead = [];
  for (const v of views) {
    await ev(v => P3.UI.go(v), v); await page.waitForTimeout(150);
    dead.push(...await ev(v => [...document.querySelectorAll('#view button, #view label.btn')].filter(b => !(b.onclick || b.type === 'submit' || b.htmlFor || b.closest('.tabs') || b.matches('th'))).map(b => v + ':' + (b.id || b.textContent.trim())), v));
  }
  check(dead.length === 0, 'todos los botones tienen una acción' + (dead.length ? ': ' + dead.join(', ') : ''));

  console.log('12. Dispositivos móviles (Android)');
  const mctx = await browser.newContext({ ...devices['Pixel 7'] });
  const m = await mctx.newPage(); const merr = []; m.on('pageerror', e => merr.push(e.message));
  await m.goto(APP); await m.waitForFunction(() => window.P3);
  await m.click('#btnMenu'); await m.waitForTimeout(300);
  check(await m.evaluate(() => document.getElementById('sidebar').classList.contains('open')), 'menú lateral abre en celular');
  await m.click('#menu button[data-view="historico"]'); await m.waitForTimeout(300);
  const ow = await m.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth + 1);
  check(ow, 'sin desplazamiento horizontal de página en celular');
  check(merr.length === 0, 'sin errores en emulación Android');
  await mctx.close();

  check(errors.length === 0, 'sin errores de JavaScript durante las pruebas' + (errors.length ? ': ' + errors.join(' | ') : ''));
  console.log(`\nRESULTADO: ${ok} correctas, ${fail} fallidas`);
  await browser.close();
  process.exit(fail ? 1 : 0);
})().catch(e => { console.error(e); process.exit(2); });
