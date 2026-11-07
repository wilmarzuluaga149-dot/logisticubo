/* =====================================================================
   VISTAS: Informes · Excel · Configuración · Ayuda  + arranque
   ===================================================================== */
const InfV = { loteriaId: undefined, desde: '', hasta: '' };
function informeData(loteriaId, desde, hasta) {
  const rows = Store.resultadosDe(loteriaId, { desde, hasta });
  const st = Stats.compute(rows);
  const f = { loteriaId, desde, hasta };
  const hs = Hits.summary(f);
  return { rows, st, hs, f };
}
UI.views.informes = (el) => {
  if (InfV.loteriaId === undefined) InfV.loteriaId = UI.ctxLoteria;
  const { rows, st, hs } = informeData(InfV.loteriaId, InfV.desde, InfV.hasta);
  const nombre = InfV.loteriaId ? Store.loteriaNombre(InfV.loteriaId) : 'Todas las loterías';
  const topF = Stats.topN(st.freq, 10, true, o => o.v > 0);
  el.innerHTML = `
    <div class="card no-print"><div class="toolbar" style="margin:0">
      <label class="field">Lotería<select id="iL">${UI.loteriaOptions(InfV.loteriaId)}</select></label>${UI.periodFields('i', InfV)}
      <button class="btn gold" id="iPdf">Descargar informe PDF</button><button class="btn" id="iXls">Informe Excel (8 hojas)</button><button class="btn" id="iPrint">Imprimir</button></div></div>
    ${UI.needData(1, InfV.loteriaId)}
    <div class="card"><h2>Informe estadístico · ${U.esc(nombre)}</h2>
      <div class="kv"><b>Periodo</b><span>${st.n ? U.fmtDate(st.rows[0].fecha) + ' – ' + U.fmtDate(st.rows[st.n - 1].fecha) : '—'}</span><b>Sorteos</b><span>${st.n}</span>
      <b>Último resultado</b><span>${st.n ? UI.num3(rows[rows.length - 1].numero) + ' · ' + U.fmtDate(rows[rows.length - 1].fecha) : '—'}</span>
      <b>Números distintos</b><span>${st.freq.filter(x => x).length} de 1000</span><b>Patrones</b><span>${Object.entries(st.patterns).map(([k, v]) => `${k}: ${U.pct(v, st.n)}`).join(' · ')}</span></div>
      <div class="grid g2" style="margin-top:12px">
        <div><h3>Frecuencia por posición</h3>${UI.table(['Cifra', 'A', 'B', 'C'], [...Array(10).keys()].map(d => `<tr><td><span class="dg">${d}</span></td>${[0, 1, 2].map(p => `<td>${st.pos[p][d]} <span class="muted small">(${U.pct(st.pos[p][d], st.n)})</span></td>`).join('')}</tr>`))}</div>
        <div><h3>Números más frecuentes</h3>${UI.table(['Número', { t: 'Veces', c: 'r' }, { t: 'Sin salir', c: 'r' }], topF.map(o => `<tr><td>${UI.num3(U.pad3(o.i))}</td><td class="r">${o.v}</td><td class="r">${st.gap[o.i]}</td></tr>`))}</div>
      </div>
      <h3>Rendimiento de los algoritmos</h3>${UI.table(['Algoritmo', { t: 'Evaluados', c: 'r' }, { t: 'D', c: 'r' }, { t: 'C', c: 'r' }, { t: '% acierto', c: 'r' }, { t: 'Esperado azar', c: 'r' }, { t: 'Índice', c: 'r' }], [1, 2, 3].map(a => { const s = hs.per[a]; return `<tr><td>A${a} ${Algo.NOMBRES[a]}</td><td class="r">${s.evaluados}</td><td class="r">${s.D}</td><td class="r">${s.C}</td><td class="r">${U.pct(s.conAcierto, s.evaluados, 2)}</td><td class="r">${(s.eD + s.eC).toFixed(2)}</td><td class="r">${s.indice === null ? '—' : s.indice.toFixed(2)}</td></tr>`; }))}
      <div class="grid g2"><div class="chart-box"><canvas id="iCh1"></canvas></div><div class="chart-box"><canvas id="iCh2"></canvas></div></div>
    </div>`;
  ['iL', 'iDesde', 'iHasta'].forEach(id => document.getElementById(id).onchange = () => { InfV.loteriaId = UI.lotVal('iL'); InfV.desde = UI.val('iDesde'); InfV.hasta = UI.val('iHasta'); UI.render(); });
  document.getElementById('iPrint').onclick = () => window.print();
  document.getElementById('iXls').onclick = () => { try { XL.save(XL.libroCompleto({ loteriaId: InfV.loteriaId, desde: InfV.desde, hasta: InfV.hasta }), `PERLA3_INFORME_${U.slug(nombre)}_${U.stamp()}.xlsx`); } catch (err) { UI.toast(err.message, 'err'); } };
  document.getElementById('iPdf').onclick = () => {
    const recientes = rows.slice(-30).reverse();
    PDF.build('Informe · ' + nombre, [
      { titulo: 'Resumen', texto: `Lotería: ${nombre}. Periodo: ${st.n ? U.fmtDate(st.rows[0].fecha) + ' a ' + U.fmtDate(st.rows[st.n - 1].fecha) : 'sin datos'}. Sorteos analizados: ${st.n}. Números distintos: ${st.freq.filter(x => x).length} de 1000. Probabilidad teórica por número: 0,1% en cada sorteo.` },
      { titulo: 'Frecuencia por posición (A, B, C)', tabla: { head: ['Cifra', 'A', '% A', 'B', '% B', 'C', '% C'], body: [...Array(10).keys()].map(d => [d, ...[0, 1, 2].flatMap(p => [st.pos[p][d], U.pct(st.pos[p][d], st.n)])]) } },
      { titulo: 'Números más frecuentes', tabla: { head: ['Número', 'Veces', '%', 'Sorteos sin salir'], body: topF.map(o => [U.pad3(o.i), o.v, U.pct(o.v, st.n, 2), st.gap[o.i]]) } },
      { titulo: 'Patrones de repetición', tabla: { head: ['Patrón', 'Veces', '% observado', '% teórico'], body: Object.keys(st.patterns).map(k => [k, st.patterns[k], U.pct(st.patterns[k], st.n), (Stats.theory.patterns[k] * 100).toFixed(0) + '%']) } },
      { titulo: 'Rendimiento de los algoritmos', tabla: { head: ['Algoritmo', 'Evaluados', 'Directos', 'Combinados', '% acierto', 'Esperado azar', 'Índice'], body: [1, 2, 3].map(a => { const s = hs.per[a]; return ['A' + a + ' ' + Algo.NOMBRES[a], s.evaluados, s.D, s.C, U.pct(s.conAcierto, s.evaluados, 2), (s.eD + s.eC).toFixed(2), s.indice === null ? '-' : s.indice.toFixed(2)]; }) } },
      { titulo: 'Últimos 30 resultados', tabla: { head: ['Fecha', 'Lotería', 'Número', 'A', 'B', 'C'], body: recientes.map(r => [U.fmtDate(r.fecha), Store.loteriaNombre(r.loteriaId), r.numero, r.numero[0], r.numero[1], r.numero[2]]) } },
    ], `PERLA3_INFORME_${U.slug(nombre)}_${U.stamp()}.pdf`);
  };
  UI.chart('iCh1', { type: 'bar', data: { labels: [...'0123456789'], datasets: [0, 1, 2].map(p => ({ label: Stats.POS[p], data: st.pos[p], backgroundColor: [COLORS.a1, COLORS.a2, COLORS.a3][p], borderColor: COLORS.surface, borderWidth: 1 })) }, options: { plugins: { title: { display: true, text: 'Frecuencia por posición' } } } });
  UI.chart('iCh2', { type: 'bar', data: { labels: ['A1', 'A2', 'A3'], datasets: [{ label: 'Directos', data: [1, 2, 3].map(a => hs.per[a].D), backgroundColor: COLORS.green }, { label: 'Combinados', data: [1, 2, 3].map(a => hs.per[a].C), backgroundColor: COLORS.gold }] }, options: { plugins: { title: { display: true, text: 'Aciertos por algoritmo' } }, scales: { y: { ticks: { precision: 0 } } } } });
};

/* ------------------------------ EXCEL ------------------------------ */
const XlV = { data: null, file: null };
UI.views.excel = (el) => {
  el.innerHTML = `
    ${XL.ok() ? '' : '<div class="note warn">La librería de Excel no se cargó. La importación de CSV sigue disponible.</div>'}
    <div class="card"><h2>⊞ Importar resultados (XLSX / CSV)</h2>
      <div class="sub">Columnas esperadas: <b>FECHA</b>, <b>LOTERIA</b>, <b>NUMERO</b>. Se detectan automáticamente y puede ajustarlas. Los números se conservan con 3 cifras (7 → 007).</div>
      <div class="toolbar"><label class="field grow">Archivo<input type="file" id="xFile" accept=".xlsx,.xls,.csv,.txt"></label><button class="btn" id="xTpl">Descargar plantilla</button></div>
      <div id="xPrev"></div>
    </div>
    <div class="card"><h2>Exportar a Excel 365</h2>
      <div class="toolbar"><label class="field">Lotería<select id="xL">${UI.loteriaOptions(UI.ctxLoteria)}</select></label>${UI.periodFields('x')}</div>
      <div class="toolbar">
        <button class="btn gold" id="xAll">Libro completo (8 hojas)</button>
        <button class="btn" data-x="res">Históricos</button><button class="btn" data-x="est">Estadísticas</button>
        <button class="btn" data-x="pro">Pronósticos</button><button class="btn" data-x="aci">Aciertos</button><button class="btn" data-x="cmp">Comparativo</button>
      </div>
      <div class="small muted">Hojas del libro completo: RESULTADOS, ESTADISTICAS, ALGORITMO_1, ALGORITMO_2, ALGORITMO_3, PRONOSTICOS, ACIERTOS, COMPARATIVO (+ INFO). Los números de tres cifras se guardan como texto.</div>
    </div>
    <div class="card"><h2>Copias de seguridad</h2>
      <div class="sub">La copia (.json) contiene toda la base: loterías, resultados, pronósticos y configuración. Guárdela fuera del navegador (USB, nube, correo).</div>
      <div class="toolbar"><button class="btn green" id="bkDown">Descargar copia de seguridad</button>
        <label class="btn" for="bkFile">Restaurar copia…</label><input type="file" id="bkFile" accept=".json,application/json" hidden></div>
      <div class="small muted">Última copia descargada: ${Store.meta.ultimaCopia ? U.fmtDateTime(Store.meta.ultimaCopia) : 'nunca'}.</div>
    </div>`;
  document.getElementById('xTpl').onclick = () => { try { XL.save(XL.plantilla(), 'PERLA3_PLANTILLA_IMPORTACION.xlsx'); } catch (err) { UI.toast(err.message, 'err'); } };
  document.getElementById('xFile').onchange = async (e) => {
    const file = e.target.files[0]; if (!file) return;
    try { XlV.data = await XL.leer(file); XlV.file = file; drawPrev(); } catch (err) { UI.toast('No se pudo leer el archivo: ' + err.message, 'err'); }
  };
  const drawPrev = () => {
    const box = document.getElementById('xPrev'); const d = XlV.data;
    if (!d || !d.aoa.length) { box.innerHTML = '<div class="note warn">El archivo está vacío.</div>'; return; }
    const det = XL.detectar(d.aoa[0].map(String));
    const ncol = Math.max(...d.aoa.slice(0, 50).map(r => r.length));
    const colOpts = (sel, allowNone) => (allowNone ? `<option value="-1">(no hay columna)</option>` : '') + Array.from({ length: ncol }, (_, i) => `<option value="${i}" ${i === sel ? 'selected' : ''}>${String.fromCharCode(65 + i)}${det.hasHeader ? ' – ' + U.esc(d.aoa[0][i] ?? '') : ''}</option>`).join('');
    const def = { fecha: det.fecha >= 0 ? det.fecha : 0, loteria: det.loteria, numero: det.numero >= 0 ? det.numero : (ncol > 2 ? 2 : 1) };
    box.innerHTML = `
      ${d.sheetNames.length > 1 ? `<div class="toolbar"><label class="field">Hoja<select id="xSheet">${d.sheetNames.map(s => `<option ${s === d.sheet ? 'selected' : ''}>${U.esc(s)}</option>`).join('')}</select></label></div>` : ''}
      <div class="toolbar">
        <label class="field">Columna FECHA<select id="mF">${colOpts(def.fecha)}</select></label>
        <label class="field">Columna LOTERÍA<select id="mL">${colOpts(def.loteria, true)}</select></label>
        <label class="field">Columna NÚMERO<select id="mN">${colOpts(def.numero)}</select></label>
        <label class="field">Lotería si no hay columna<select id="mLF">${UI.loteriaOptions(UI.ctxLoteria, { todas: true, labelTodas: '(ninguna)' })}</select></label>
        <label class="field">Formato fecha<select id="mFmt"><option value="dmy" ${Store.config.formatoFecha === 'dmy' ? 'selected' : ''}>DD/MM/AAAA</option><option value="mdy" ${Store.config.formatoFecha === 'mdy' ? 'selected' : ''}>MM/DD/AAAA</option></select></label>
        <label class="field">Duplicados<select id="mMode"><option value="omitir">Omitir existentes</option><option value="reemplazar">Reemplazar existentes</option></select></label>
        <label class="field"><span><input type="checkbox" id="mHdr" ${det.hasHeader ? 'checked' : ''}> Primera fila es encabezado</span><span><input type="checkbox" id="mU3" ${Store.config.ultimas3 ? 'checked' : ''}> Números de 4+ cifras: usar las 3 últimas</span><span><input type="checkbox" id="mNew" checked> Crear loterías que no existan</span></label>
      </div>
      <div id="xCheck" class="small"></div>
      ${UI.table(Array.from({ length: ncol }, (_, i) => String.fromCharCode(65 + i)), d.aoa.slice(0, 8).map(r => `<tr>${Array.from({ length: ncol }, (_, i) => `<td>${U.esc(r[i] ?? '')}</td>`).join('')}</tr>`))}
      <div class="small muted">Vista previa: primeras 8 de ${d.aoa.length} filas de "${U.esc(XlV.file.name)}".</div>
      <div class="toolbar" style="margin-top:10px"><button class="btn gold" id="xImp">Importar resultados</button></div>`;
    const opts = () => ({ map: { fecha: +UI.val('mF'), loteria: +UI.val('mL'), numero: +UI.val('mN') }, o: { hasHeader: document.getElementById('mHdr').checked, loteriaFija: UI.lotVal('mLF'), formatoFecha: UI.val('mFmt'), ultimas3: document.getElementById('mU3').checked, modo: UI.val('mMode'), crearLoterias: document.getElementById('mNew').checked } });
    const check = () => {
      const { map, o } = opts(); const r = XL.mapear(d.aoa, map, o);
      const dups = r.registros.filter(x => { const l = Store.findLoteriaByName(x.loteria); return l && Store.resultadoDe(l.id, x.fecha); }).length;
      document.getElementById('xCheck').innerHTML = `Validación: <b class="ok">${r.registros.length}</b> filas válidas · <b class="${r.errores.length ? 'bad' : ''}">${r.errores.length}</b> con error · ${dups} ya existen en la base${r.nuevasLot.length ? ` · loterías nuevas: <b>${r.nuevasLot.map(U.esc).join(', ')}</b>` : ''}
        ${r.errores.length ? `<details><summary>Ver errores</summary><ul>${r.errores.slice(0, 30).map(e => `<li>Fila ${e.fila}: ${U.esc(e.motivo)}</li>`).join('')}</ul></details>` : ''}
        ${r.registros.length ? `<div class="muted">Ejemplo: ${r.registros.slice(0, 3).map(x => `${U.fmtDate(x.fecha)} · ${U.esc(x.loteria)} · <b class="n3">${x.numero}</b>`).join(' | ')}</div>` : ''}`;
    };
    UI.$$('#xPrev select, #xPrev input').forEach(i => i.onchange = check);
    const sh = document.getElementById('xSheet'); if (sh) sh.onchange = async () => { XlV.data = await XL.leer(XlV.file, sh.value); drawPrev(); };
    check();
    document.getElementById('xImp').onclick = async () => {
      const { map, o } = opts();
      await Store.setConfig('formatoFecha', o.formatoFecha); await Store.setConfig('ultimas3', o.ultimas3);
      const r = await Importer.ejecutar(d.aoa, map, o);
      if (r) { box.innerHTML = `<div class="note">${U.esc(r.msg)}</div>`; document.getElementById('xFile').value = ''; XlV.data = null; }
    };
  };
  const filt = () => ({ loteriaId: UI.lotVal('xL'), desde: UI.val('xDesde'), hasta: UI.val('xHasta') });
  const nm = (t) => `PERLA3_${t}_${filt().loteriaId ? U.slug(Store.loteriaNombre(filt().loteriaId)) : 'TODAS'}_${U.stamp()}.xlsx`;
  document.getElementById('xAll').onclick = () => { try { XL.save(XL.libroCompleto(filt()), nm('LIBRO_COMPLETO')); } catch (err) { UI.toast(err.message, 'err'); } };
  UI.$$('[data-x]', el).forEach(b => b.onclick = () => {
    try {
      const f = filt(), wb = XL.book(), t = b.dataset.x;
      const rows = Store.resultadosDe(f.loteriaId, f);
      if (t === 'res') XLSX.utils.book_append_sheet(wb, XL.hojaResultados(rows), 'RESULTADOS');
      if (t === 'est') XLSX.utils.book_append_sheet(wb, XL.hojaEstadisticas(Stats.compute(rows)), 'ESTADISTICAS');
      if (t === 'pro') XLSX.utils.book_append_sheet(wb, XL.hojaPronosticos(Hits.filter(f)), 'PRONOSTICOS');
      if (t === 'aci') XLSX.utils.book_append_sheet(wb, XL.hojaAciertos(f), 'ACIERTOS');
      if (t === 'cmp') XLSX.utils.book_append_sheet(wb, XL.hojaComparativo(f), 'COMPARATIVO');
      XL.save(wb, nm({ res: 'RESULTADOS', est: 'ESTADISTICAS', pro: 'PRONOSTICOS', aci: 'ACIERTOS', cmp: 'COMPARATIVO' }[t]));
    } catch (err) { UI.toast(err.message, 'err'); }
  });
  Backup.bind();
};

const Backup = {
  async download() {
    const blob = new Blob([JSON.stringify(Store.exportJSON())], { type: 'application/json' });
    U.download(blob, `PERLA3_COPIA_SEGURIDAD_${U.stamp()}.json`);
    await Store.setMeta('ultimaCopia', new Date().toISOString());
    UI.toast('Copia de seguridad descargada.');
  },
  async restore(file) {
    try {
      const obj = JSON.parse(await file.text());
      Store.validarBackup(obj);
      if (!await UI.confirm(`La copia del <b>${U.fmtDateTime(obj.fecha)}</b> contiene ${obj.loterias.length} loterías, ${obj.resultados.length} resultados y ${obj.pronosticos.length} pronósticos.<br><span class="warn">Reemplazará TODOS los datos actuales.</span> ¿Continuar?`, { danger: true, ok: 'Restaurar' })) return;
      await Store.restoreJSON(obj);
      UI.toast('Copia restaurada correctamente.'); UI.render();
    } catch (err) { UI.toast('No se pudo restaurar: ' + err.message, 'err', 7000); }
  },
  bind() {
    const d = document.getElementById('bkDown'); if (d) d.onclick = () => Backup.download();
    const f = document.getElementById('bkFile'); if (f) f.onchange = (e) => { if (e.target.files[0]) Backup.restore(e.target.files[0]); e.target.value = ''; };
  },
};

/* ------------------------------ CONFIGURACIÓN ------------------------------ */
UI.views.config = async (el) => {
  const c = Store.config;
  el.innerHTML = `
    <div class="grid g2">
      <div class="card"><h2>Reglas de aciertos</h2>
        <label class="field"><span><input type="checkbox" id="cfInc" ${c.combinadoIncluyeDirecto ? 'checked' : ''}> Un acierto directo también cuenta como combinado</span></label>
        <label class="field" style="margin-top:8px"><span><input type="checkbox" id="cfRep" ${c.combinadoConRepetidas ? 'checked' : ''}> Permitir combinado cuando el resultado tiene cifras repetidas (ej. 337)</span></label>
        <div class="small muted" style="margin-top:8px">D-Ganador: coincidencia exacta en orden. C-Ganador: mismas tres cifras en otro orden. Ajuste estas opciones para que coincidan con las reglas de su lotería o del programa que usa como referencia.</div>
      </div>
      <div class="card"><h2>Datos para los algoritmos</h2>
        <label class="field">Fuente del histórico<select id="cfSrc"><option value="loteria" ${c.fuenteDatos === 'loteria' ? 'selected' : ''}>Solo la lotería seleccionada (recomendado)</option><option value="todas" ${c.fuenteDatos === 'todas' ? 'selected' : ''}>Todas las loterías registradas</option></select></label>
        <label class="field" style="margin-top:8px">Cantidad de candidatos por defecto<select id="cfK">${Algo.CANTIDADES.map(k => `<option ${k === c.cantidadDefecto ? 'selected' : ''}>${k}</option>`).join('')}</select></label>
        <div class="small muted" style="margin-top:8px">Los parámetros propios de cada algoritmo se ajustan en sus módulos (Algoritmo 1, 2 y 3).</div>
      </div>
    </div>
    <div class="card" id="cfTema"><h2>Apariencia · colores</h2>${Tema.html()}</div>
    <div class="card"><h2>Actualización automática</h2>
      <div class="grid g2">
        <div>
          <label class="field"><span><input type="checkbox" id="cfAuto" ${c.autoActualizar ? 'checked' : ''}> Recalcular todo automáticamente cuando entran resultados nuevos</span></label>
          <div class="small muted" style="margin:4px 0 10px 24px">Ejecuta la prueba histórica de los sorteos nuevos y genera el pronóstico de los 3 algoritmos para el próximo sorteo. Se actualizan Inicio, Histórico, Estadísticas, Algoritmos, Control de aciertos, Comparador e Informes.</div>
          <label class="field">Sorteos recientes que se evalúan por lotería<select id="cfAutoN">${[50, 100, 200, 500].map(v => `<option ${v === +c.autoSorteos ? 'selected' : ''}>${v}</option>`).join('')}</select></label>
          <label class="field" style="margin-top:8px"><span><input type="checkbox" id="cfDirecto" ${c.importarDirecto ? 'checked' : ''}> Importar directamente al elegir o soltar un archivo (sin revisión cuando trae fecha, lotería y número)</span></label>
        </div>
        <div>
          <label class="field"><span><input type="checkbox" id="cfLinea" ${c.actualizarEnLinea ? 'checked' : ''}> Al abrir, descargar resultados nuevos de fuentes oficiales (datos.gov.co)</span></label>
          <div class="small muted" style="margin:4px 0 10px 24px">Disponible hoy para <b>Lotería de Medellín</b> y <b>Lotería de Santander</b> (si existen en el sistema). Requiere internet. Los chances no tienen fuente oficial abierta: se actualizan importando un archivo.</div>
          <div class="toolbar"><button class="btn" id="cfLineaYa">Actualizar ahora desde internet</button></div>
          <div class="small muted">Última actualización en línea: ${Store.meta.ultimaActualizacionEnLinea ? U.fmtDateTime(Store.meta.ultimaActualizacionEnLinea.fecha) + ' (' + Store.meta.ultimaActualizacionEnLinea.nuevos + ' nuevos)' : 'nunca'} · último recálculo automático: ${U.fmtDateTime(Store.meta.ultimaActualizacionAuto)}</div>
        </div>
      </div>
    </div>
    <div class="grid g2">
      <div class="card"><h2>Copias de seguridad y restauración</h2>
        <div class="toolbar"><button class="btn green" id="bkDown">Descargar copia de seguridad</button><label class="btn" for="bkFile">Restaurar copia…</label><input type="file" id="bkFile" accept=".json,application/json" hidden></div>
        <div class="small muted">Recomendación: descargue una copia cada semana y antes de actualizar la aplicación. Las actualizaciones nunca borran los datos guardados.</div>
      </div>
      <div class="card"><h2>Datos de ejemplo</h2>
        <p class="small">Crea dos loterías llamadas <b>"EJEMPLO Ficticia…"</b> con 420 sorteos cada una, generados al azar. <b>No son resultados reales</b>; sirven para practicar.</p>
        <div class="toolbar"><button class="btn" id="cfDemo">Cargar datos de ejemplo</button><button class="btn danger" id="cfDemoDel">Eliminar datos de ejemplo</button></div>
      </div>
    </div>
    <div class="grid g2">
      <div class="card"><h2>Información del sistema</h2><div class="kv" id="cfInfo">
        <b>Aplicación</b><span>PERLA 3 CIFRAS PRO ${APP_VERSION} (${APP_BUILD})</span>
        <b>Almacenamiento</b><span>${DB.mode === 'idb' ? 'IndexedDB (navegador)' : 'localStorage (modo de respaldo)'}</span>
        <b>Base creada</b><span>${U.fmtDateTime(Store.meta.creado)}</span>
        <b>Registros</b><span>${Store.loterias.length} loterías · ${Store.resultados.length} resultados · ${Store.pronosticos.length} pronósticos</span>
        <b>Librerías</b><span>Chart.js ${typeof Chart !== 'undefined' ? '✔' : '✘'} · SheetJS ${XL.ok() ? '✔' : '✘'} · jsPDF ${PDF.ok() ? '✔' : '✘'}</span>
        <b>Espacio usado</b><span id="cfSpace">calculando…</span><b>Almacenamiento persistente</b><span id="cfPersist">—</span></div></div>
      <div class="card"><h2>Zona de peligro</h2>
        <p class="small">Borra todas las loterías, resultados, pronósticos y la configuración. Esta acción no se puede deshacer.</p>
        <button class="btn danger" id="cfWipe">Borrar todos los datos…</button></div>
    </div>`;
  const save = async (k, v) => { await Store.setConfig(k, v); UI.toast('Configuración guardada.'); };
  document.getElementById('cfInc').onchange = e => save('combinadoIncluyeDirecto', e.target.checked);
  document.getElementById('cfRep').onchange = e => save('combinadoConRepetidas', e.target.checked);
  document.getElementById('cfSrc').onchange = e => save('fuenteDatos', e.target.value);
  document.getElementById('cfK').onchange = e => save('cantidadDefecto', +e.target.value);
  document.getElementById('cfAuto').onchange = e => save('autoActualizar', e.target.checked);
  document.getElementById('cfAutoN').onchange = e => save('autoSorteos', +e.target.value);
  document.getElementById('cfDirecto').onchange = e => save('importarDirecto', e.target.checked);
  document.getElementById('cfLinea').onchange = e => save('actualizarEnLinea', e.target.checked);
  document.getElementById('cfLineaYa').onclick = async (e) => { e.target.disabled = true; e.target.textContent = 'Consultando…'; await EnLinea.actualizar({ silencioso: false, crear: true }); if (UI.current === 'config') UI.render(); };
  document.getElementById('cfDemo').onclick = () => Demo.cargar();
  document.getElementById('cfDemoDel').onclick = async () => {
    const ej = Store.loterias.filter(l => l.ejemplo);
    if (!ej.length) { UI.toast('No hay datos de ejemplo cargados.', 'warn'); return; }
    if (!await UI.confirm(`¿Eliminar ${ej.length} loterías de ejemplo con todos sus resultados y pronósticos?`, { danger: true, ok: 'Eliminar' })) return;
    for (const l of ej) await Store.deleteLoteria(l.id);
    UI.toast('Datos de ejemplo eliminados.'); UI.render();
  };
  document.getElementById('cfWipe').onclick = async () => {
    const v = await UI.modal({ title: 'Borrar todos los datos', body: `<p>Para confirmar escriba <b>BORRAR</b>. Se recomienda descargar antes una copia de seguridad.</p><input id="wConf" autocomplete="off">`, buttons: [{ t: 'Cancelar', cls: 'ghost' }, { t: 'Borrar todo', cls: 'danger', action: () => { if (UI.val('wConf').trim().toUpperCase() !== 'BORRAR') throw new Error('Escriba BORRAR para confirmar.'); return 'ok'; } }] });
    if (v === 'ok') { await Store.borrarTodo(); UI.toast('Todos los datos fueron borrados.'); UI.render(); }
  };
  Backup.bind();
  Tema.bind(document.getElementById('cfTema'));
  try {
    const sp = document.getElementById('cfSpace'), pe = document.getElementById('cfPersist');
    if (navigator.storage?.estimate) { const e = await navigator.storage.estimate(); if (!sp.isConnected) return; sp.textContent = `${(e.usage / 1048576).toFixed(2)} MB de ${(e.quota / 1048576).toFixed(0)} MB disponibles`; }
    else sp.textContent = 'no disponible';
    if (navigator.storage?.persisted) pe.textContent = (await navigator.storage.persisted()) ? 'Sí (el navegador no borrará los datos automáticamente)' : 'No concedido (haga copias de seguridad periódicas)';
  } catch { }
};

/* ------------------------------ AYUDA ------------------------------ */
UI.views.ayuda = (el) => {
  el.innerHTML = `<div class="card help">
    <h2>Ayuda · Manual de uso</h2>
    <div class="note warn"><b>Aviso importante.</b> PERLA 3 CIFRAS PRO es una herramienta de análisis estadístico. En un sorteo justo cada número de 000 a 999 tiene siempre la misma probabilidad: 1 entre 1000. Ningún algoritmo puede predecir resultados aleatorios ni garantizar premios. Juegue con responsabilidad.</div>
    <h3>1. Primeros pasos</h3><ol>
      <li><b>Loterías:</b> cree cada lotería (y cada horario, por ejemplo Día y Noche, como lotería separada).</li>
      <li><b>Histórico:</b> registre resultados con fecha, lotería y número. Use «Pegar varios…» para copiar bloques desde Excel, o importe un archivo en el módulo <b>Excel</b>.</li>
      <li>Seleccione la <b>Lotería activa</b> en la barra superior: las estadísticas, el análisis de cifras y los algoritmos usarán esa lotería.</li>
      <li>Para practicar puede cargar <b>datos de ejemplo ficticios</b> en Configuración.</li></ol>
    <h3>Reemplazos</h3>
    <p>En <b>Reemplazos</b> escriba números de 2, 3 o 4 cifras y se convierten cifra por cifra con su tabla (0=5, 1=6, 2=7, 3=8, 4=9 y al revés). Ejemplo: 142 → 697. La tabla se puede cambiar y también hay una tabla de números completos.</p>
    <h3>Colores</h3>
    <p>Con el botón <b>🎨</b> de la barra superior puede elegir el tema (Blanco, Negro, Blanco y negro, Azul industrial y otros) o sus propios colores. Se guarda solo.</p>
    <h3>Todo se actualiza solo</h3>
    <p>Use el botón <b>⇪ Importar archivo</b> de la barra superior o suelte el archivo sobre cualquier pantalla: se guarda y se analiza al instante. Después de cada dato nuevo la aplicación recalcula sola la prueba histórica y el pronóstico de los 3 algoritmos para el próximo sorteo, y actualiza todas las pantallas. Con internet, al abrir descarga sola los resultados nuevos de Medellín y Santander (datos.gov.co). Se configura en <b>Configuración → Actualización automática</b>.</p>
    <h3>Importar y analizar (lo más rápido)</h3>
    <p>En <b>Importar y analizar</b> puede, cada vez que lo necesite, arrastrar un archivo Excel o CSV (con o sin fechas, de pocos o miles de números), pegar una lista de números, registrar un solo resultado o evaluar un número. Tras una revisión previa, la aplicación une lo nuevo con lo que ya tenía (sin duplicar) y muestra: el pronóstico de los 3 algoritmos para el próximo sorteo, cómo habrían acertado con los números nuevos (usando solo los sorteos anteriores a cada uno) y la comparación con el histórico. Con «Solo analizar» no se guarda nada.</p>
    <h3>2. Columnas del histórico</h3><ul>
      <li><b>A, B, C:</b> primera (centenas), segunda (decenas) y tercera cifra (unidades).</li>
      <li><b>Aciertos A1/A2/A3:</b> evaluación del pronóstico de cada algoritmo para ese sorteo: <code>D#n</code> acierto directo con el candidato n.º n, <code>C#n</code> acierto combinado, <code>x/3</code> mejor cantidad de cifras en su posición.</li>
      <li><b>Algoritmo 1/2/3:</b> primer candidato (el de mayor puntuación) de cada algoritmo para ese sorteo.</li>
      <li><b>D-Ganador / C-Ganador:</b> algoritmos que lograron acierto directo o combinado.</li></ul>
    <p>Estas columnas se llenan cuando existe un pronóstico guardado o una prueba histórica para ese sorteo.</p>
    <h3>3. Los tres algoritmos</h3><ul>
      <li><b>Algoritmo 1 – Frecuencia y tendencia:</b> favorece las cifras y parejas que más han salido, en el histórico completo y en la ventana reciente.</li>
      <li><b>Algoritmo 2 – Ciclos y ausencias:</b> compara el tiempo que cada cifra lleva sin salir con su intervalo típico y considera paridad, sumas, repeticiones y el día de la semana.</li>
      <li><b>Algoritmo 3 – Modelo combinado:</b> suma seis variables normalizadas con pesos que usted elige.</li></ul>
    <p>Cada candidato muestra su puntuación (0–100, relativa entre los 1000 números) y una explicación. Los tres algoritmos son independientes y nunca usan resultados de la fecha analizada ni posteriores.</p>
    <h3>4. Aciertos y comparación</h3>
    <p><b>D-GANADOR:</b> las tres cifras coinciden en el mismo orden. <b>C-GANADOR:</b> las mismas tres cifras en otro orden. Las reglas se configuran en Configuración. En <b>Control de aciertos</b> puede ejecutar la <b>prueba histórica cronológica</b>: para cada sorteo pasado, se generan pronósticos usando solo los datos anteriores y luego se comparan con el resultado real. El <b>Comparador</b> muestra cuántos aciertos se habrían esperado por puro azar; un «rendimiento vs azar» cercano a 1,00× significa que el algoritmo no supera a la suerte.</p>
    <h3>5. Excel</h3><ul>
      <li>Importe archivos <code>.xlsx</code> o <code>.csv</code> con columnas FECHA, LOTERIA, NUMERO. Descargue la plantilla para ver el formato.</li>
      <li>Fechas admitidas: <code>AAAA-MM-DD</code>, <code>DD/MM/AAAA</code> (o MM/DD/AAAA si lo elige), y fechas nativas de Excel.</li>
      <li>Para no perder ceros, formatee la columna NUMERO como Texto. Si llega como 7, la aplicación lo completa a 007.</li>
      <li>El libro completo exportado contiene las hojas RESULTADOS, ESTADISTICAS, ALGORITMO_1, ALGORITMO_2, ALGORITMO_3, PRONOSTICOS, ACIERTOS y COMPARATIVO.</li></ul>
    <h3>6. Guardado y copias de seguridad</h3>
    <p>Todo se guarda automáticamente en el navegador (IndexedDB) en este equipo. Descargue copias de seguridad (.json) con frecuencia desde Excel o Configuración y guárdelas fuera del navegador. Si borra los datos del navegador o cambia de equipo, restaure la copia.</p>
    <h3>7. Glosario</h3><ul>
      <li><b>Frecuencia histórica:</b> veces que algo salió en el periodo analizado.</li>
      <li><b>Ausencia:</b> sorteos transcurridos desde su última aparición. No cambia la probabilidad del próximo sorteo.</li>
      <li><b>Probabilidad teórica:</b> 0,1% por número, 10% por cifra en cada posición, 1% por pareja.</li>
      <li><b>Prueba χ²:</b> indica si las diferencias observadas son compatibles con el azar (p ≥ 0,05) o no.</li></ul>
    <p class="muted small">PERLA 3 CIFRAS PRO ${APP_VERSION} · desarrollo independiente con funcionalidades inspiradas en programas de análisis de loterías de tres cifras. No contiene código de terceros salvo las librerías libres Chart.js (MIT), SheetJS Community Edition (Apache 2.0) y jsPDF (MIT).</p>
  </div>`;
};

/* ------------------------------ ARRANQUE ------------------------------ */
window.addEventListener('error', (e) => { console.error(e.error || e.message); try { UI.toast('Se produjo un error inesperado: ' + (e.message || '') + '. Sus datos están a salvo.', 'err', 6000); } catch { } });
window.addEventListener('unhandledrejection', (e) => { console.error(e.reason); try { UI.toast('Error: ' + (e.reason?.message || e.reason), 'err', 6000); } catch { } });
(async function boot() {
  try {
    await Store.load();
    Tema.aplicar();
    Store.setSaving('ok');
    UI.init();
    ImportRapido.init();
    window.P3 = { U, Store, Stats, Algo, Hits, XL, PDF, UI, Demo, Importer, Backup, MathX, DB, Auto, EnLinea, DatosIncluidos, ImportRapido, version: APP_VERSION };
    await DatosIncluidos.cargar();
    Auto.alAbrir();
    if (Store.config.actualizarEnLinea) setTimeout(() => EnLinea.actualizar({ silencioso: true }), 800);
    if (DB.mode !== 'idb') UI.toast('IndexedDB no está disponible: se usa almacenamiento de respaldo (limitado). Descargue copias de seguridad.', 'warn', 8000);
    if ('serviceWorker' in navigator && location.protocol.startsWith('http') && !window.AndroidBridge && !window.PERLA3_ESCRITORIO) navigator.serviceWorker.register('sw.js').catch(() => { });
  } catch (err) {
    console.error(err);
    document.getElementById('view').innerHTML = `<div class="card"><h2>No se pudo iniciar</h2><p class="bad">${U.esc(err.message)}</p><p>Compruebe que el navegador permite el almacenamiento local (no use modo incógnito) e intente recargar.</p></div>`;
  }
})();
