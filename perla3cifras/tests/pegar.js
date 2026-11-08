// Pruebas de «Pegar resultados de la página».  Ejecutar: node tests/pegar.js
const { chromium } = require('playwright'); const path = require('path');
let ok = 0, fail = 0; const check = (c, m) => { c ? ok++ : fail++; console.log((c ? '  ✔ ' : '  ✘ ') + m); };
// Texto exacto que el usuario copió de la página (08/11/2026)
const USUARIO = `Culona
6752
Paisita día
3711La 5ta: 6
Chontico día
9037La 5ta: 2
Sinuano día
8861La 5ta: 9
Cash three día
499
Play four día
2789
Caribeña día
1184La 5ta: 2
Motilón Tarde
2760La 5ta: 1
Antioqueñita Día
4415La 5ta: 2`;
// Página completa con encabezados de fecha, serie, signo y texto de relleno
const PAGINA = `Resultados de hoy domingo 8 de noviembre de 2026
Los resultados de las loterías de hoy:
Culona
6752
Antioqueñita Tarde
9402
La 5ta: 4
En nuestra página ofrecemos números recomendados, así que te invitamos a ganar con los
Pronósticos
Resultados de ayer sábado 7 de noviembre de 2026:
Boyaca
1552
312
Astro sol
8953
Sagitario
Chontico noche
3385
La 5ta: 0`;
(async () => {
  const b = await chromium.launch(); const p = await b.newPage({ viewport: { width: 1366, height: 900 } }); const err = []; p.on('pageerror', e => err.push(e.message));
  await p.goto('file://' + path.resolve(__dirname, '../PERLA3CIFRAS_PRO.html')); await p.waitForFunction(() => window.P3);
  await p.evaluate(() => P3.Store.setConfig('actualizarEnLinea', false));
  const ev = (f, a) => p.evaluate(f, a);
  console.log('1. Lectura del texto copiado');
  const r1 = await ev(t => Pagina.parsear(t, '2026-11-08').registros.map(r => r.loteria + '=' + r.numero).join(' | '), USUARIO);
  check(r1 === 'Culona Día=752 | Paisita Día=711 | Chontico Día=037 | Sinuano Día=861 | Cash Three Día=499 | Play Four Día=789 | Caribeña Día=184 | Motilón Tarde=760 | Antioqueñita Día=415', 'el texto del usuario: 9 resultados con su lotería y 3 últimas cifras');
  const r2 = await ev(t => Pagina.parsear(t, '2026-01-01'), PAGINA);
  check(r2.registros.map(r => r.loteria + '=' + r.numero + '@' + r.fecha).join(' | ') === 'Culona Día=752@2026-11-08 | Antioqueñita Tarde=402@2026-11-08 | Lotería de Boyacá=552@2026-11-07 | Astro Sol=953@2026-11-07 | Chontico Noche=385@2026-11-07', 'página completa: fechas de «hoy» y «ayer», serie y signo ignorados');
  check(!r2.registros.some(r => /pronostic|resultados|nuestra/i.test(r.loteria)), 'el texto de relleno de la página no se toma como lotería');
  console.log('2. Casilla fija en el Inicio');
  check(await p.isVisible('#pgIniTxt') && await p.isVisible('#pgIniGo'), 'Inicio muestra «Pegar resultados de la página»');
  await p.fill('#pgIniTxt', USUARIO); await p.waitForTimeout(400);
  check((await p.textContent('#pgIniInfo')).includes('Se reconocen 9'), 'vista previa: «Se reconocen 9»');
  await p.fill('#pgIniFecha', '2026-11-08'); await p.click('#pgIniGo'); await p.waitForSelector('#iaOut .card h2', { timeout: 60000 });
  const g = await ev(() => P3.Store.resultados.map(r => P3.Store.loteriaNombre(r.loteriaId) + '=' + r.numero + '@' + r.fecha).sort().join(' | '));
  check(g.split(' | ').length === 9 && g.includes('Culona Día=752@2026-11-08') && g.includes('Antioqueñita Día=415@2026-11-08'), 'INGRESAR RESULTADOS: los 9 quedan guardados con fecha 08/11/2026 y se muestra el análisis');
  console.log('3. Se puede volver a pegar sin duplicar, y corrige un número cambiado');
  await ev(() => P3.UI.go('inicio')); await p.fill('#pgIniTxt', USUARIO.replace('6752', '6753')); await p.fill('#pgIniFecha', '2026-11-08'); await p.click('#pgIniGo'); await p.waitForSelector('#iaOut .card h2');
  check(await ev(() => P3.Store.resultados.length) === 9 && await ev(() => P3.Store.resultadoDe(P3.Store.findLoteriaByName('Culona Día').id, '2026-11-08').numero) === '753', 'sin duplicados y la Culona corregida a 753');
  console.log('4. También funciona en Importar y analizar → Pegar números');
  await ev(() => { IA.tab = 'pegar'; IA.result = null; P3.UI.go('importar'); });
  await p.fill('#iaTxt', PAGINA); await p.click('#iaLeerTxt'); await p.waitForSelector('#iaOut .card h2');
  check(await ev(() => !!P3.Store.findLoteriaByName('Lotería de Boyacá') && P3.Store.resultadoDe(P3.Store.findLoteriaByName('Lotería de Boyacá').id, '2026-11-07')?.numero === '552'), 'pegar la página completa: Boyacá 552 del sábado 07/11 guardado');
  check(err.length === 0, 'sin errores de JavaScript' + (err.length ? ': ' + err.join(' | ') : ''));
  console.log(`\nRESULTADO: ${ok} correctas, ${fail} fallidas`); await b.close(); process.exit(fail ? 1 : 0);
})().catch(e => { console.error(e); process.exit(2); });
