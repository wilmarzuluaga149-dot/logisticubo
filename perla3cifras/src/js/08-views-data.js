/* =====================================================================
   VISTAS: Inicio · Loterías · Histórico
   ===================================================================== */

/* ------------------------------ INICIO ------------------------------ */
UI.views.inicio = (el) => {
  const L = UI.ctxLoteria;
  const rows = Store.resultadosDe(L);
  const last = rows[rows.length - 1];
  const hs = Hits.summary({ loteriaId: L });
  const totD = [1, 2, 3].reduce((s, a) => s + hs.per[a].D, 0), totC = [1, 2, 3].reduce((s, a) => s + hs.per[a].C, 0);
  const prons = Hits.filter({ loteriaId: L });
  const ultimos = rows.slice(-12).reverse();
  el.innerHTML = `
    ${Store.resultados.length ? '' : `<div class="card"><h2>Bienvenido a PERLA 3 CIFRAS PRO</h2>
      <p>Para comenzar: 1) cree sus loterías, 2) registre o importe resultados, 3) genere pronósticos y evalúe los algoritmos.</p>
      <div class="toolbar"><button class="btn gold" data-go="loterias">Crear lotería</button><button class="btn" onclick="document.getElementById('globalFile').click()">⇪ Elegir archivo (se importa solo)</button><button class="btn" id="btnDemo">Cargar datos de ejemplo (ficticios)</button></div></div>`}
    <div class="card no-print" style="display:flex;gap:12px;align-items:center;flex-wrap:wrap"><div style="flex:1;min-width:220px"><b style="color:var(--gold)">¿Tiene números nuevos?</b> <span class="small muted">Meta un archivo, pegue una lista o un solo resultado y obtenga el análisis al instante.</span></div><button class="btn gold" data-go="importar">⇪ Importar y analizar</button></div>
    <div class="kpis">
      <div class="kpi"><div class="l">Sorteos registrados</div><div class="v">${U.fmt(rows.length)}</div><div class="s">${L ? U.esc(Store.loteriaNombre(L)) : 'todas las loterías'}</div></div>
      <div class="kpi blue"><div class="l">Loterías</div><div class="v">${Store.loterias.length}</div><div class="s">${Store.loterias.filter(l => l.ejemplo).length ? 'incluye datos de ejemplo' : 'configuradas'}</div></div>
      <div class="kpi"><div class="l">Último resultado</div><div class="v">${last ? `<span class="n3" style="font-size:24px">${last.numero}</span>` : '—'}</div><div class="s">${last ? U.esc(Store.loteriaNombre(last.loteriaId)) : 'sin datos'}</div></div>
      <div class="kpi blue"><div class="l">Fecha último sorteo</div><div class="v" style="font-size:20px">${last ? U.fmtDate(last.fecha) : '—'}</div><div class="s">${last ? U.DIAS[U.weekday(last.fecha)] : ''}</div></div>
      <div class="kpi"><div class="l">Pronósticos</div><div class="v">${U.fmt(prons.length)}</div><div class="s">${prons.filter(p => p.origen === 'manual').length} manuales · ${prons.filter(p => p.origen === 'auto').length} automáticos · ${prons.filter(p => p.origen === 'backtest').length} prueba hist.</div></div>
      <div class="kpi green"><div class="l">Aciertos directos</div><div class="v">${totD}</div><div class="s">D-Ganador (3 cifras en orden)</div></div>
      <div class="kpi green"><div class="l">Aciertos combinados</div><div class="v">${totC}</div><div class="s">C-Ganador (cifras en otro orden)</div></div>
    </div>
    <div class="grid g3">
      ${[1, 2, 3].map(a => { const s = hs.per[a]; return `<div class="card"><h2>${UI.algBadge(a)} ${Algo.NOMBRES[a]}</h2>
        <div class="kv"><b>Evaluados</b><span>${s.evaluados} de ${s.pronosticos}</span><b>D / C</b><span>${s.D} / ${s.C}</span>
        <b>% con acierto</b><span>${U.pct(s.conAcierto, s.evaluados, 2)}</span><b>Esperado por azar</b><span>${(s.eD + s.eC).toFixed(2)} aciertos</span>
        <b>Índice vs azar</b><span class="${s.indice > 1 ? 'ok' : ''}">${s.indice === null ? '—' : s.indice.toFixed(2) + '×'}</span><b>Último acierto</b><span>${U.fmtDate(s.ultimo)}</span></div></div>`; }).join('')}
    </div>
    <div class="grid g2">
      <div class="card"><h2>Frecuencia por posición (últimos 100 sorteos)</h2><div class="chart-box"><canvas id="chPos"></canvas></div>
        <div class="small muted">Línea roja: 10% teórico por cifra. Las desviaciones a corto plazo son normales en un proceso aleatorio.</div></div>
      <div class="card"><h2>Actividad reciente (sorteos por mes)</h2><div class="chart-box"><canvas id="chAct"></canvas></div></div>
    </div>
    <div class="card"><h2>Últimos resultados</h2>
      ${UI.table(['Fecha', 'Lotería', 'Número', { t: 'A', c: 'c' }, { t: 'B', c: 'c' }, { t: 'C', c: 'c' }],
        ultimos.map(r => `<tr><td>${U.fmtDate(r.fecha)}</td><td>${U.esc(Store.loteriaNombre(r.loteriaId))}</td><td>${UI.num3(r.numero)}</td><td class="c"><span class="dg">${r.numero[0]}</span></td><td class="c"><span class="dg">${r.numero[1]}</span></td><td class="c"><span class="dg">${r.numero[2]}</span></td></tr>`))}
    </div>`;
  UI.$$('[data-go]', el).forEach(b => b.onclick = () => UI.go(b.dataset.go));
  const bd = document.getElementById('btnDemo'); if (bd) bd.onclick = () => Demo.cargar();
  const st = Stats.compute(rows.slice(-100));
  UI.chart('chPos', {
    type: 'bar', data: {
      labels: [...'0123456789'],
      datasets: [0, 1, 2].map(p => ({ label: 'Posición ' + Stats.POS[p], data: st.pos[p].map(c => st.n ? +(100 * c / st.n).toFixed(1) : 0), backgroundColor: [COLORS.a1, COLORS.a2, COLORS.a3][p], borderColor: '#131f33', borderWidth: 1 }))
        .concat([UI.refLine('Teórico 10%', 10, 10)]),
    }, options: { scales: { y: { title: { display: true, text: '% de sorteos' } }, x: { title: { display: true, text: 'Cifra' } } }, plugins: { tooltip: { callbacks: { label: c => `${c.dataset.label}: ${c.parsed.y}%` } } } },
  });
  const months = [...Stats.compute(rows).months.entries()].slice(-18);
  UI.chart('chAct', { type: 'bar', data: { labels: months.map(([k]) => U.MESES[+k.slice(5) - 1] + ' ' + k.slice(2, 4)), datasets: [{ label: 'Sorteos', data: months.map(m => m[1]), backgroundColor: COLORS.gold }] }, options: { plugins: { legend: { display: false } } } });
};

/* ------------------------------ LOTERÍAS ------------------------------ */
UI.views.loterias = (el) => {
  const cnt = new Map(); const lastD = new Map();
  for (const r of Store.resultados) { cnt.set(r.loteriaId, (cnt.get(r.loteriaId) || 0) + 1); lastD.set(r.loteriaId, r.fecha); }
  const pc = new Map(); for (const p of Store.pronosticos) pc.set(p.loteriaId, (pc.get(p.loteriaId) || 0) + 1);
  el.innerHTML = `
    <div class="card"><h2>Nueva lotería</h2>
      <form id="fLot" class="toolbar">
        <label class="field grow">Nombre *<input id="lNombre" maxlength="60" required placeholder="Ej.: Lotería del Valle – Noche"></label>
        <label class="field">Horario / sorteo<input id="lSorteo" maxlength="40" placeholder="Ej.: 10:30 p. m."></label>
        <label class="field grow">Descripción<input id="lDesc" maxlength="120" placeholder="Opcional"></label>
        <button class="btn gold" type="submit">Guardar lotería</button>
      </form>
      <div class="small muted">Si una lotería tiene varios sorteos al día (día/noche), regístrelos como loterías separadas: solo se permite un resultado por lotería y fecha.</div>
    </div>
    <div class="card"><h2>Loterías registradas (${Store.loterias.length})</h2>
      ${UI.table(['Nombre', 'Horario', 'Descripción', { t: 'Resultados', c: 'r' }, { t: 'Pronósticos', c: 'r' }, 'Último sorteo', ''],
        Store.loterias.map(l => `<tr><td><b>${U.esc(l.nombre)}</b> ${l.ejemplo ? '<span class="badge c">EJEMPLO</span>' : ''}</td><td>${U.esc(l.sorteo || '')}</td><td class="muted">${U.esc(l.descripcion || '')}</td>
          <td class="r">${cnt.get(l.id) || 0}</td><td class="r">${pc.get(l.id) || 0}</td><td>${U.fmtDate(lastD.get(l.id))}</td>
          <td><button class="btn sm" data-edit="${l.id}">Editar</button> <button class="btn sm" data-use="${l.id}">Activar</button> <button class="btn sm danger" data-del="${l.id}">Eliminar</button></td></tr>`))}
    </div>`;
  document.getElementById('fLot').onsubmit = async (e) => {
    e.preventDefault();
    try { const l = await Store.saveLoteria({ nombre: UI.val('lNombre'), sorteo: UI.val('lSorteo'), descripcion: UI.val('lDesc') }); UI.toast(`Lotería "${l.nombre}" creada.`); UI.render(); }
    catch (err) { UI.toast(err.message, 'err'); }
  };
  UI.$$('[data-edit]', el).forEach(b => b.onclick = async () => {
    const l = Store.loteria(+b.dataset.edit);
    await UI.modal({
      title: 'Editar lotería', body: `<div class="grid"><label class="field">Nombre<input id="mN" value="${U.esc(l.nombre)}" maxlength="60"></label><label class="field">Horario<input id="mS" value="${U.esc(l.sorteo || '')}" maxlength="40"></label><label class="field">Descripción<input id="mD" value="${U.esc(l.descripcion || '')}" maxlength="120"></label></div>`,
      buttons: [{ t: 'Cancelar', cls: 'ghost' }, { t: 'Guardar', cls: 'gold', action: async () => { await Store.saveLoteria({ id: l.id, nombre: UI.val('mN'), sorteo: UI.val('mS'), descripcion: UI.val('mD'), ejemplo: l.ejemplo }); UI.toast('Lotería actualizada.'); } }],
    });
    UI.render();
  });
  UI.$$('[data-use]', el).forEach(b => b.onclick = () => { UI.ctxLoteria = +b.dataset.use; try { localStorage.setItem('p3:ctx', b.dataset.use); } catch { } UI.refreshCtx(); UI.toast('Lotería activa: ' + Store.loteriaNombre(UI.ctxLoteria)); });
  UI.$$('[data-del]', el).forEach(b => b.onclick = async () => {
    const id = +b.dataset.del, l = Store.loteria(id), n = cnt.get(id) || 0, np = pc.get(id) || 0;
    if (!await UI.confirm(`¿Eliminar la lotería <b>${U.esc(l.nombre)}</b>?${n || np ? `<br><span class="bad">Se eliminarán también ${n} resultados y ${np} pronósticos.</span> Recomendación: descargue antes una copia de seguridad.` : ''}`, { danger: true, ok: 'Eliminar' })) return;
    await Store.deleteLoteria(id); UI.toast('Lotería eliminada.'); UI.render();
  });
};

/* ------------------------------ HISTÓRICO ------------------------------ */
const Hist = { page: 1, size: 50, sortDesc: true, filtro: { loteriaId: undefined, desde: '', hasta: '', numero: '' } };
UI.views.historico = (el) => {
  if (Hist.filtro.loteriaId === undefined) Hist.filtro.loteriaId = UI.ctxLoteria;
  const f = Hist.filtro;
  const defLot = f.loteriaId ?? UI.ctxLoteria ?? Store.loterias[0]?.id;
  el.innerHTML = `
    <div class="card"><h2>Registrar resultado</h2>
      ${Store.loterias.length ? '' : '<div class="note warn">Primero cree una lotería en el módulo <a href="#loterias">Loterías</a>.</div>'}
      <form id="fRes" class="toolbar" autocomplete="off">
        <label class="field">Fecha *<input type="date" id="rFecha" value="${U.todayISO()}" max="${U.addDays(U.todayISO(), 1)}" required></label>
        <label class="field grow">Lotería *<select id="rLot" required>${UI.loteriaOptions(defLot, { todas: false })}</select></label>
        <label class="field">Número ganador *<input id="rNum" class="num3" inputmode="numeric" maxlength="3" pattern="\\d{1,3}" placeholder="000" required></label>
        <button class="btn gold" type="submit">Agregar</button>
        <button class="btn" type="button" id="btnPegar">Pegar varios…</button>
      </form>
      <div class="small muted">Los números se guardan siempre con tres cifras: 7 → <b class="n3">007</b>. No se permiten dos resultados para la misma lotería y fecha.</div>
    </div>
    <div class="card"><h2>Histórico de resultados</h2>
      <div class="toolbar">
        <label class="field">Lotería<select id="hLot">${UI.loteriaOptions(f.loteriaId)}</select></label>
        ${UI.periodFields('h', f)}
        <label class="field">Número<input id="hNum" maxlength="3" inputmode="numeric" value="${U.esc(f.numero)}" placeholder="ej. 025" style="width:90px"></label>
        <label class="field">Por página<select id="hSize">${[25, 50, 100, 250].map(s => `<option ${s === Hist.size ? 'selected' : ''}>${s}</option>`).join('')}</select></label>
        <button class="btn ghost" id="hClear">Limpiar filtros</button>
      </div>
      <div id="hTable"></div>
      <div class="legend-row"><span><span class="badge d">D#n</span> acierto directo (posición n en la lista)</span><span><span class="badge c">C#n</span> acierto combinado</span><span><span class="badge p">x/3</span> mejor coincidencia de cifras en su posición</span><span><span class="badge p">—</span> sin pronóstico evaluable</span></div>
    </div>`;
  const draw = () => {
    if (!document.getElementById('hTable')) return; // la vista ya no está en pantalla
    let rows = Store.resultadosDe(f.loteriaId, { desde: f.desde, hasta: f.hasta });
    if (f.numero) { const q = f.numero.trim(); rows = rows.filter(r => q.length === 3 ? r.numero === q : r.numero.includes(q)); }
    rows = Hist.sortDesc ? rows.slice().reverse() : rows;
    const pages = Math.max(1, Math.ceil(rows.length / Hist.size)); Hist.page = Math.min(Hist.page, pages);
    const slice = rows.slice((Hist.page - 1) * Hist.size, Hist.page * Hist.size);
    const idx = Hits.indexByDraw();
    const body = slice.map(r => {
      const h = UI.drawHits(r, idx);
      const b = a => h.txt[a] ? `<span class="badge ${h.cls[a]}">${h.txt[a]}</span>` : '';
      return `<tr><td>${U.fmtDate(r.fecha)}</td><td>${U.esc(Store.loteriaNombre(r.loteriaId))}</td><td>${UI.num3(r.numero)}</td>
        <td class="c"><span class="dg">${r.numero[0]}</span></td><td class="c"><span class="dg">${r.numero[1]}</span></td><td class="c"><span class="dg">${r.numero[2]}</span></td>
        <td class="c">${b(1)}</td><td class="c">${b(2)}</td><td class="c">${b(3)}</td>
        <td class="c">${h.top[1] ? `<span class="n3" style="font-size:12px;color:#e9c869">${h.top[1]}</span>` : ''}</td><td class="c">${h.top[2] ? `<span class="n3" style="font-size:12px;color:#9dbcff">${h.top[2]}</span>` : ''}</td><td class="c">${h.top[3] ? `<span class="n3" style="font-size:12px;color:#6fe0b0">${h.top[3]}</span>` : ''}</td>
        <td class="c">${h.D.map(x => `<span class="badge d">${x}</span>`).join(' ')}</td><td class="c">${h.C.map(x => `<span class="badge c">${x}</span>`).join(' ')}</td>
        <td><button class="btn sm" data-e="${r.id}" title="Editar">✎</button> <button class="btn sm danger" data-d="${r.id}" title="Eliminar">✕</button></td></tr>`;
    });
    document.getElementById('hTable').innerHTML = UI.table([{ t: `Fecha ${Hist.sortDesc ? '▼' : '▲'}`, c: 'sort' }, 'Lotería', 'Número', { t: 'A', c: 'c' }, { t: 'B', c: 'c' }, { t: 'C', c: 'c' },
      { t: 'Aciertos A1', c: 'c' }, { t: 'Aciertos A2', c: 'c' }, { t: 'Aciertos A3', c: 'c' }, { t: 'Algoritmo 1', c: 'c' }, { t: 'Algoritmo 2', c: 'c' }, { t: 'Algoritmo 3', c: 'c' }, { t: 'D-Ganador', c: 'c' }, { t: 'C-Ganador', c: 'c' }, ''], body)
      + `<div class="pager"><span>${U.fmt(rows.length)} registros · página ${Hist.page} de ${pages}</span><button class="btn sm" id="pPrev" ${Hist.page <= 1 ? 'disabled' : ''}>‹ Anterior</button><button class="btn sm" id="pNext" ${Hist.page >= pages ? 'disabled' : ''}>Siguiente ›</button></div>`;
    UI.$('#hTable th.sort').onclick = () => { Hist.sortDesc = !Hist.sortDesc; draw(); };
    document.getElementById('pPrev').onclick = () => { Hist.page--; draw(); };
    document.getElementById('pNext').onclick = () => { Hist.page++; draw(); };
    UI.$$('#hTable [data-e]').forEach(b => b.onclick = () => editarResultado(+b.dataset.e));
    UI.$$('#hTable [data-d]').forEach(b => b.onclick = async () => {
      const r = Store.resultados.find(x => x.id === +b.dataset.d);
      if (!await UI.confirm(`¿Eliminar el resultado <b class="n3">${r.numero}</b> de ${U.esc(Store.loteriaNombre(r.loteriaId))} del ${U.fmtDate(r.fecha)}?`, { danger: true, ok: 'Eliminar' })) return;
      await Store.deleteResultado(r.id); UI.toast('Resultado eliminado.'); draw();
    });
  };
  const upd = () => { if (!document.getElementById('hLot')) return; f.loteriaId = UI.lotVal('hLot'); f.desde = UI.val('hDesde'); f.hasta = UI.val('hHasta'); f.numero = UI.val('hNum').replace(/\D/g, ''); Hist.size = +UI.val('hSize'); Hist.page = 1; draw(); };
  ['hLot', 'hDesde', 'hHasta', 'hSize'].forEach(id => document.getElementById(id).onchange = upd);
  document.getElementById('hNum').oninput = U.debounce(upd, 300);
  document.getElementById('hClear').onclick = () => { Object.assign(f, { loteriaId: null, desde: '', hasta: '', numero: '' }); UI.render(); };
  const numIn = document.getElementById('rNum');
  numIn.oninput = () => { numIn.value = numIn.value.replace(/\D/g, '').slice(0, 3); };
  numIn.onblur = () => { if (numIn.value) numIn.value = numIn.value.padStart(3, '0'); };
  document.getElementById('fRes').onsubmit = async (e) => {
    e.preventDefault();
    try {
      const r = await Store.saveResultado({ fecha: UI.val('rFecha'), loteriaId: +UI.val('rLot'), numero: numIn.value });
      UI.toast(`Resultado ${r.numero} guardado (${Store.loteriaNombre(r.loteriaId)}, ${U.fmtDate(r.fecha)}).`);
      numIn.value = ''; numIn.focus();
      const fe = document.getElementById('rFecha'); fe.value = U.addDays(r.fecha, 1) <= U.todayISO() ? U.addDays(r.fecha, 1) : r.fecha;
      draw();
    } catch (err) { UI.toast(err.message, 'err'); }
  };
  document.getElementById('btnPegar').onclick = () => pegarResultados();
  draw();
};

async function editarResultado(id) {
  const r = Store.resultados.find(x => x.id === id);
  await UI.modal({
    title: 'Editar resultado',
    body: `<div class="grid"><label class="field">Fecha<input type="date" id="eF" value="${r.fecha}"></label><label class="field">Lotería<select id="eL">${UI.loteriaOptions(r.loteriaId, { todas: false })}</select></label><label class="field">Número<input id="eN" class="num3" maxlength="3" value="${r.numero}"></label></div>`,
    buttons: [{ t: 'Cancelar', cls: 'ghost' }, { t: 'Guardar cambios', cls: 'gold', action: async () => { await Store.saveResultado({ id, fecha: UI.val('eF'), loteriaId: +UI.val('eL'), numero: UI.val('eN') }); UI.toast('Resultado actualizado.'); } }],
  });
  UI.render();
}

async function pegarResultados() {
  await UI.modal({
    title: 'Importación rápida (pegar desde Excel o texto)', wide: true,
    body: `<p class="small muted">Una línea por sorteo con <b>fecha; lotería; número</b> (separados por punto y coma, coma o tabulación — se puede copiar directamente desde Excel). Si omite la lotería se usará la seleccionada.</p>
      <div class="toolbar"><label class="field">Lotería por defecto<select id="pLot">${UI.loteriaOptions(UI.ctxLoteria ?? Store.loterias[0]?.id, { todas: false })}</select></label>
      <label class="field">Formato de fecha<select id="pFmt"><option value="dmy">DD/MM/AAAA</option><option value="mdy">MM/DD/AAAA</option></select></label>
      <label class="field">Duplicados<select id="pMode"><option value="omitir">Omitir existentes</option><option value="reemplazar">Reemplazar existentes</option></select></label></div>
      <textarea id="pTxt" placeholder="2026-01-05;Mi Lotería;007&#10;06/01/2026;Mi Lotería;125&#10;07/01/2026;;089"></textarea><div id="pMsg" class="small"></div>`,
    buttons: [{ t: 'Cancelar', cls: 'ghost' }, {
      t: 'Importar', cls: 'gold', action: async () => {
        const txt = UI.val('pTxt'); if (!txt.trim()) throw new Error('No hay datos para importar.');
        let aoa = XL.parseCSV(txt);
        if (aoa.length && aoa[0].length === 2) aoa = aoa.map(r => [r[0], '', r[1]]);
        const hasHeader = !U.parseDate(aoa[0]?.[0], UI.val('pFmt'));
        const res = await Importer.ejecutar(aoa, { fecha: 0, loteria: 1, numero: 2 }, { hasHeader, loteriaFija: +UI.val('pLot') || null, formatoFecha: UI.val('pFmt'), ultimas3: Store.config.ultimas3, modo: UI.val('pMode'), crearLoterias: true });
        if (!res) return false;
      },
    }],
  });
  UI.render();
}

/* Importador común (pegar, CSV, XLSX) */
const Importer = {
  async ejecutar(aoa, map, opts) {
    const { registros, errores, nuevasLot } = XL.mapear(aoa, map, opts);
    if (!registros.length) { UI.toast(`No se encontraron filas válidas. ${errores.length} errores${errores[0] ? ': fila ' + errores[0].fila + ' – ' + errores[0].motivo : ''}.`, 'err', 7000); return null; }
    if (nuevasLot.length) {
      if (!opts.crearLoterias) { UI.toast('Hay loterías que no existen: ' + nuevasLot.join(', '), 'err', 7000); return null; }
      for (const n of nuevasLot) await Store.saveLoteria({ nombre: n });
    }
    const rows = registros.map(r => ({ fecha: r.fecha, numero: r.numero, loteriaId: Store.findLoteriaByName(r.loteria).id }));
    const res = await Store.bulkResultados(rows, opts.modo || 'omitir');
    const msg = `Importación terminada: ${res.nuevos} nuevos, ${res.reemplazados} reemplazados, ${res.omitidos} duplicados omitidos, ${errores.length} filas con error.${nuevasLot.length ? ' Loterías creadas: ' + nuevasLot.join(', ') + '.' : ''}`;
    UI.toast(msg, errores.length ? 'warn' : 'ok', 8000);
    Store.setMeta('ultimaImportacion', { fecha: new Date().toISOString(), ...res, errores: errores.length });
    return { ...res, errores, nuevasLot, msg };
  },
};

/* Datos de ejemplo (ficticios, generados con números pseudoaleatorios) */
const Demo = {
  async cargar(dias = 420) {
    if (Store.loterias.some(l => l.ejemplo)) { UI.toast('Los datos de ejemplo ya están cargados.', 'warn'); return; }
    if (!await UI.confirm('Se crearán dos loterías <b>"EJEMPLO"</b> con resultados <b>ficticios</b> generados al azar, para practicar con la aplicación. Puede eliminarlas después desde Loterías. ¿Continuar?')) return;
    const defs = [{ nombre: 'EJEMPLO Ficticia Día', seed: 20260101 }, { nombre: 'EJEMPLO Ficticia Noche', seed: 20260202 }];
    const rows = [];
    for (const d of defs) {
      const l = await Store.saveLoteria({ nombre: d.nombre, descripcion: 'DATOS DE EJEMPLO – resultados ficticios generados al azar', sorteo: 'demo', ejemplo: true });
      const rnd = U.rng(d.seed);
      let f = U.addDays(U.todayISO(), -dias);
      for (let i = 0; i < dias; i++) { rows.push({ fecha: f, loteriaId: l.id, numero: U.pad3(Math.floor(rnd() * 1000)) }); f = U.addDays(f, 1); }
    }
    await Store.bulkResultados(rows);
    UI.toast(`Datos de ejemplo cargados: ${rows.length} sorteos ficticios.`);
    UI.render();
  },
};
