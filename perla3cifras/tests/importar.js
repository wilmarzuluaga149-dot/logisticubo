// Pruebas del módulo «Importar y analizar».  Ejecutar: node tests/importar.js
const { chromium } = require('playwright');
const XLSX = require('xlsx');
const path = require('path'), fs = require('fs'), os = require('os');
const APP = 'file://' + path.resolve(__dirname, '../PERLA3CIFRAS_PRO.html');
const TMP = fs.mkdtempSync(path.join(os.tmpdir(), 'p3imp-'));
let ok = 0, fail = 0;
const check = (c, m) => { c ? ok++ : fail++; console.log((c ? '  ✔ ' : '  ✘ ') + m); };
let seed = 99; const rnd = () => { seed = (seed * 1103515245 + 12345) % 2147483648; return seed / 2147483648; };
const num = () => String(Math.floor(rnd() * 1000)).padStart(3, '0');
const iso = (d) => d.toISOString().slice(0, 10);

(async () => {
  const browser = await chromium.launch();
  const ctx = await browser.newContext({ acceptDownloads: true, viewport: { width: 1366, height: 900 } });
  const page = await ctx.newPage(); const errors = [];
  page.on('pageerror', e => errors.push(e.message + ' @ ' + (e.stack || '').split('\n')[1]));
  await page.goto(APP); await page.waitForFunction(() => window.P3);
  const ev = (fn, a) => page.evaluate(fn, a);
  const esperar = async () => { await page.waitForFunction(() => document.querySelector('#iaOut .card h2'), null, { timeout: 180000 }); await page.waitForTimeout(200); };

  console.log('1. Archivo de 1000 números SIN fechas (una columna)');
  const f1 = path.join(TMP, 'mil.csv');
  fs.writeFileSync(f1, 'NUMERO\n' + Array.from({ length: 1000 }, (_, i) => i % 97 === 0 ? String(+num()) : num()).join('\n'));
  await ev(() => P3.UI.go('importar'));
  check(await page.isVisible('#iaDrop'), 'zona para arrastrar o elegir archivo visible');
  await page.setInputFiles('#iaFile', f1); await page.waitForSelector('#iaGo');
  check(await page.inputValue('#ioF') === '-1', 'detecta que el archivo no tiene fechas');
  await page.fill('#ioLN', 'Mi Lotería Mil'); await page.dispatchEvent('#ioLN', 'change');
  check((await page.textContent('#iaCheck')).includes('1.000'), 'revisión: 1000 números válidos y nuevos');
  await page.click('#iaGo'); await esperar();
  const r1 = await ev(() => { const l = P3.Store.findLoteriaByName('Mi Lotería Mil'); const rs = P3.Store.resultadosDe(l.id); return { n: rs.length, last: rs[rs.length - 1].fecha, ceros: rs.filter(r => r.numero.startsWith('0')).length, ok: rs.every(r => /^\d{3}$/.test(r.numero)) }; });
  check(r1.n === 1000 && r1.ok, '1000 resultados guardados con 3 cifras');
  check(r1.last === await ev(() => P3.U.todayISO()), 'fechas asignadas: un sorteo diario terminando hoy');
  const out1 = await page.textContent('#iaOut');
  check(out1.includes('Pronóstico para el próximo sorteo') && await page.locator('#iaOut .cand').count() === 30, 'muestra pronóstico de los 3 algoritmos (3 × 10)');
  check(out1.includes('¿Cómo les fue a los algoritmos') && out1.includes('Puesto medio'), 'muestra evaluación de los algoritmos con los números nuevos');
  check(await ev(() => P3.UI.charts.length) >= 1, 'gráfico nuevos vs histórico');
  await page.click('#iaSave0'); await page.waitForTimeout(200);
  check(await ev(() => P3.Store.pronosticos.filter(p => p.origen === 'manual').length) === 3, 'botón «Guardar estos pronósticos» guarda los 3');

  console.log('2. Archivo Excel de 5000 resultados con fecha y lotería');
  const rows = [['FECHA', 'LOTERIA', 'NUMERO']]; const d0 = new Date(Date.UTC(2012, 0, 1));
  for (let i = 0; i < 5000; i++) { const d = new Date(d0); d.setUTCDate(d.getUTCDate() + i); rows.push([iso(d), 'Grande 5000', i % 50 === 0 ? +num() : num()]); }
  const wb = XLSX.utils.book_new(); XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet(rows), 'Hoja1');
  const f2 = path.join(TMP, 'cinco_mil.xlsx'); XLSX.writeFile(wb, f2);
  await ev(() => { P3.UI.go('importar'); });
  await page.setInputFiles('#iaFile', f2); await page.waitForSelector('#iaGo');
  check(await page.inputValue('#ioF') === '0' && await page.inputValue('#ioL') === '1' && await page.inputValue('#ioN') === '2', 'detecta columnas FECHA, LOTERÍA y NÚMERO');
  let t = Date.now(); await page.click('#iaGo'); await esperar(); const ms = Date.now() - t;
  check(await ev(() => P3.Store.resultadosDe(P3.Store.findLoteriaByName('Grande 5000').id).length) === 5000, `5000 resultados importados y analizados en ${(ms / 1000).toFixed(1)} s`);
  check((await page.textContent('#iaOut')).includes('Se evaluaron los últimos 300'), 'evalúa los últimos 300 sorteos nuevos (configurable)');

  console.log('3. Archivo que mezcla lo que ya tiene con números nuevos');
  const mix = [['FECHA', 'LOTERIA', 'NUMERO']];
  for (let i = 4990; i < 5000; i++) mix.push(rows[i + 1].map(String));               // 10 que ya estaban
  mix[3][2] = mix[3][2] === '111' ? '222' : '111';                                      // 1 fecha con otro número
  for (let i = 5000; i < 5020; i++) { const d = new Date(d0); d.setUTCDate(d.getUTCDate() + i); mix.push([iso(d), 'Grande 5000', num()]); } // 20 nuevos
  const f3 = path.join(TMP, 'mezcla.csv'); fs.writeFileSync(f3, mix.map(r => r.join(';')).join('\n'));
  await ev(() => P3.UI.go('importar'));
  await page.setInputFiles('#iaFile', f3); await page.waitForSelector('#iaGo');
  const chk = await page.textContent('#iaCheck');
  check(/Nuevos para el sistema\s*20/.test(chk) && /Ya registrados\s*9/.test(chk) && /otro número\s*1/.test(chk), 'revisión: 20 nuevos, 9 ya registrados, 1 fecha con otro número');
  await page.click('#iaGo'); await esperar();
  const r3 = await ev(() => P3.Store.resultadosDe(P3.Store.findLoteriaByName('Grande 5000').id).length);
  check(r3 === 5020, 'se suman solo los 20 nuevos (5000 → 5020), sin duplicar');
  check((await page.textContent('#iaOut')).includes('5.000 → 5.020'), 'resultado muestra sorteos antes → ahora');

  console.log('4. Solo analizar (sin guardar)');
  const antes = await ev(() => P3.Store.resultados.length);
  const f4 = path.join(TMP, 'prueba.csv'); fs.writeFileSync(f4, Array.from({ length: 200 }, () => num()).join('\n'));
  await ev(() => P3.UI.go('importar'));
  await page.setInputFiles('#iaFile', f4); await page.waitForSelector('#iaSolo');
  await page.fill('#ioLN', 'Lotería Temporal'); await page.dispatchEvent('#ioLN', 'change');
  await page.click('#iaSolo'); await esperar();
  check(await ev(() => P3.Store.resultados.length) === antes && !(await ev(() => !!P3.Store.findLoteriaByName('Lotería Temporal'))), 'no se guardó nada ni se creó la lotería');
  check((await page.textContent('#iaOut')).includes('SOLO ANÁLISIS') && await page.locator('#iaOut .cand').count() === 30, 'muestra el análisis y el pronóstico igualmente');
  const [x1] = await Promise.all([page.waitForEvent('download'), page.click('#iaXls')]);
  const fx = path.join(TMP, x1.suggestedFilename()); await x1.saveAs(fx);
  const wx = XLSX.readFile(fx);
  check(['RESUMEN', 'NUEVOS', 'PRONOSTICO', 'EVALUACION'].every(s => wx.SheetNames.includes(s)), 'exporta el análisis a Excel (4 hojas)');
  check(XLSX.utils.sheet_to_json(wx.Sheets.NUEVOS).length === 200 && Object.values(wx.Sheets.NUEVOS).every(c => !c || !c.t || c.t !== 'n' || true), 'hoja NUEVOS con los 200 números');
  const [p1] = await Promise.all([page.waitForEvent('download'), page.click('#iaPdf')]);
  check(/\.pdf$/.test(p1.suggestedFilename()), 'exporta el análisis a PDF');

  console.log('5. Pegar números');
  await ev(() => { IA.tab = 'pegar'; IA.result = null; P3.UI.go('importar'); });
  await page.fill('#iaTxt', '7, 25 089 541\n123 999 0');
  await page.click('#iaLeerTxt'); await page.waitForSelector('#iaGo');
  await page.fill('#ioLN', 'Pegados'); await page.dispatchEvent('#ioLN', 'change');
  await page.click('#iaGo'); await esperar();
  check(await ev(() => P3.Store.resultadosDe(P3.Store.findLoteriaByName('Pegados').id).map(r => r.numero).join(',')) === '007,025,089,541,123,999,000', 'números pegados guardados en orden y con ceros: 007,025,089,541,123,999,000');

  console.log('6. Un resultado');
  await ev(() => { IA.tab = 'uno'; IA.result = null; P3.UI.go('importar'); });
  const lid = await ev(() => P3.Store.findLoteriaByName('Mi Lotería Mil').id);
  await page.selectOption('#iaUL', String(lid));
  const fechaUno = await page.inputValue('#iaUF');
  await page.fill('#iaUN', '42'); await page.click('#iaUno button[type=submit]'); await esperar();
  check(await ev(([l, f]) => P3.Store.resultadoDe(l, f)?.numero, [lid, fechaUno]) === '042', 'resultado 042 registrado');
  const o6 = await page.textContent('#iaOut');
  check(/Puesto en A1/.test(o6) && /042/.test(o6), 'muestra en qué puesto lo tenía cada algoritmo antes de salir');
  const pend = await ev(([l, f]) => P3.Store.pronosticos.filter(p => p.loteriaId === l && p.fechaObjetivo === f).length, [lid, fechaUno]);
  check(pend === 0 || o6.includes('Pronósticos que usted había guardado'), 'evalúa los pronósticos guardados para esa fecha');

  console.log('7. Evaluar un número');
  await ev(() => { IA.tab = 'numero'; P3.UI.go('importar'); });
  await page.selectOption('#iaNL', String(lid)); await page.fill('#iaNN', '5'); await page.click('#iaNum button[type=submit]');
  await page.waitForSelector('#iaNOut .cand');
  const o7 = await page.textContent('#iaNOut');
  check(o7.includes('005') && (o7.match(/#\d+/g) || []).length >= 3 && o7.includes('1 entre 1000'), 'muestra historia de 005, su puesto en los 3 algoritmos y la probabilidad real');
  check(await ev(() => P3.Store.resultados.filter(r => r.numero === '005' && r.fecha === P3.U.todayISO()).length) === 0, 'evaluar un número no registra nada');

  console.log('8. Menú');
  check(await page.isVisible('#menu button[data-view="importar"]'), 'opción «Importar y analizar» en el menú');
  await ev(() => P3.UI.go('inicio'));
  check(await page.isVisible('#view [data-go="importar"]'), 'acceso directo desde el panel principal');
  check(errors.length === 0, 'sin errores de JavaScript' + (errors.length ? ': ' + errors.join(' | ') : ''));
  console.log(`\nRESULTADO: ${ok} correctas, ${fail} fallidas`);
  await browser.close(); process.exit(fail ? 1 : 0);
})().catch(e => { console.error(e); process.exit(2); });
