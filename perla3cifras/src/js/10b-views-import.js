/* =====================================================================
   VISTA: IMPORTAR Y ANALIZAR
   Un solo lugar para meter números cuando se necesite —archivo Excel/CSV
   (con o sin fechas, de 1 a miles de filas), texto pegado o un solo
   resultado— y obtener de inmediato un análisis que combina lo que ya
   había en el sistema con lo nuevo:
     · resumen de la importación (nuevos, duplicados, conflictos, errores)
     · cómo habrían acertado los 3 algoritmos con los números nuevos
       (cada uno usando solo los sorteos anteriores a cada fecha)
     · pronóstico de los 3 algoritmos para el próximo sorteo
     · comparación de los números nuevos con el histórico
   También permite evaluar un número concreto sin registrarlo.
   ===================================================================== */
const IA = {
  tab: 'archivo', src: null, opts: null, result: null, running: false,
  k: 10, evalLimit: 300,
  numQuery: { loteriaId: null, numero: '' },
};

/* ---------- Detección de columnas cuando el archivo no tiene encabezados claros ---------- */
function iaDetectar(aoa) {
  const det = XL.detectar((aoa[0] || []).map(String));
  const ncol = Math.max(1, ...aoa.slice(0, 60).map(r => r.length));
  const start = det.hasHeader ? 1 : 0, sample = aoa.slice(start, start + 60);
  const score = (fn) => Array.from({ length: ncol }, (_, c) => sample.filter(r => fn(r[c])).length);
  const isNum = v => v !== '' && v != null && /^\s*\d{1,4}\s*$/.test(String(v));
  const isDate = v => v !== '' && v != null && !!U.parseDate(v) && !/^\s*\d{1,4}\s*$/.test(String(v));
  const isText = v => v !== '' && v != null && /[a-záéíóúñ]/i.test(String(v)) && !U.parseDate(v);
  const best = (arr, excl = []) => { let b = -1, bv = 0; arr.forEach((v, i) => { if (!excl.includes(i) && v > bv) { bv = v; b = i; } }); return bv >= Math.max(1, sample.length * 0.5) ? b : -1; };
  let fecha = det.fecha, numero = det.numero, loteria = det.loteria;
  if (fecha < 0) fecha = best(score(isDate));
  if (numero < 0) numero = best(score(isNum), [fecha]);
  if (loteria < 0) loteria = best(score(isText), [fecha, numero]);
  return { fecha, numero: numero < 0 ? 0 : numero, loteria, hasHeader: det.hasHeader, ncol };
}

/* ---------- Construye los registros {fecha, loteria, numero} según las opciones ---------- */
function iaConstruir(aoa, o) {
  const nombreFijo = o.loteriaNombre.trim();
  if (o.fecha >= 0) {
    const r = XL.mapear(aoa, { fecha: o.fecha, loteria: o.loteria, numero: o.numero },
      { hasHeader: o.hasHeader, loteriaNombreFija: nombreFijo, formatoFecha: o.formatoFecha, ultimas3: o.ultimas3 });
    return { ...r, sinFechas: false };
  }
  // Archivo SIN fechas: los números se toman en orden y se les asigna un sorteo diario.
  const errores = [], grupos = new Map();
  const start = o.hasHeader ? 1 : 0;
  for (let i = start; i < aoa.length; i++) {
    const row = aoa[i];
    const lot = (o.loteria >= 0 ? String(row[o.loteria] ?? '').trim() : '') || nombreFijo;
    const celdas = o.todasCeldas ? row.map((v, c) => ({ v, c })).filter(x => x.c !== o.loteria) : [{ v: row[o.numero], c: o.numero }];
    for (const { v } of celdas) {
      if (v === '' || v == null || String(v).trim() === '') continue;
      const n = U.normNum(v, { ultimas3: o.ultimas3 });
      if (!n) { errores.push({ fila: i + 1, motivo: `Número inválido: "${v}"` }); continue; }
      if (!lot) { errores.push({ fila: i + 1, motivo: 'Sin lotería (elija una abajo)' }); continue; }
      const k = U.normText(lot);
      if (!grupos.has(k)) grupos.set(k, { nombre: lot, nums: [] });
      grupos.get(k).nums.push(n);
    }
  }
  const registros = [], nuevasLot = new Set();
  for (const g of grupos.values()) {
    const nums = o.orden === 'reciente_primero' ? g.nums.slice().reverse() : g.nums;
    const L = nums.length;
    nums.forEach((n, j) => registros.push({ fecha: U.addDays(o.fechaFinal, -(L - 1 - j)), loteria: g.nombre, numero: n }));
    if (!Store.findLoteriaByName(g.nombre)) nuevasLot.add(g.nombre);
  }
  return { registros, errores, nuevasLot: [...nuevasLot], sinFechas: true };
}

/* ---------- Clasifica registros frente a lo que ya existe ---------- */
function iaClasificar(registros) {
  const grupos = new Map();
  for (const r of registros) {
    const k = U.normText(r.loteria);
    if (!grupos.has(k)) grupos.set(k, { nombre: r.loteria, filas: [] });
    grupos.get(k).filas.push(r);
  }
  const out = [];
  for (const g of grupos.values()) {
    const lot = Store.findLoteriaByName(g.nombre);
    const previos = lot ? Store.resultadosDe(lot.id) : [];
    const nuevos = [], duplicados = [], conflictos = [];
    for (const r of g.filas) {
      const ex = lot && Store.resultadoDe(lot.id, r.fecha);
      if (!ex) nuevos.push(r); else if (ex.numero === r.numero) duplicados.push(r); else conflictos.push({ ...r, existente: ex.numero });
    }
    nuevos.sort((a, b) => (a.fecha < b.fecha ? -1 : 1));
    out.push({ nombre: lot ? lot.nombre : g.nombre, lot, previos, nuevos, duplicados, conflictos });
  }
  return out;
}

/* ---------- Procesamiento: guarda (opcional) y analiza ---------- */
async function iaProcesar(registros, { guardar, modoDup, k, evalLimit, onProgress }) {
  const grupos = iaClasificar(registros);
  if (modoDup === 'reemplazar') for (const g of grupos) if (g.conflictos.length) {
    // Las fechas que se reemplazan cuentan como números nuevos para el análisis
    g.reemplazados = g.conflictos.length;
    g.nuevos = g.nuevos.concat(g.conflictos.map(({ existente, ...r }) => r)).sort((a, b) => (a.fecha < b.fecha ? -1 : 1));
    g.conflictos = [];
  }
  const res = { guardar, k, creado: new Date().toISOString(), grupos: [] };
  if (guardar) {
    for (const g of grupos) if (!g.lot) g.lot = await Store.saveLoteria({ nombre: g.nombre });
    const filas = [];
    for (const g of grupos) {
      for (const r of g.nuevos) filas.push({ fecha: r.fecha, loteriaId: g.lot.id, numero: r.numero });
    }
    res.import = await Store.bulkResultados(filas, modoDup);
    await Store.setMeta('ultimaImportacion', { fecha: new Date().toISOString(), ...res.import });
  }
  let pasos = grupos.reduce((s, g) => s + Math.min(g.nuevos.length, evalLimit), 0) || 1, hecho = 0;
  for (const g of grupos) {
    // Histórico combinado: lo que ya tenía + lo nuevo (en orden cronológico)
    let hist;
    if (guardar) hist = Store.resultadosDe(g.lot.id).map(r => ({ fecha: r.fecha, numero: r.numero }));
    else {
      const m = new Map(g.previos.map(r => [r.fecha, r.numero])); // los nuevos (y reemplazos) se superponen
      for (const r of g.nuevos) m.set(r.fecha, r.numero);
      hist = [...m.entries()].map(([fecha, numero]) => ({ fecha, numero })).sort((a, b) => (a.fecha < b.fecha ? -1 : 1));
    }
    const seedBase = g.lot ? g.lot.id : g.nombre;
    const nuevasFechas = new Set(g.nuevos.map(r => r.fecha));
    // 1) Evaluación cronológica en memoria de los números nuevos
    const idxs = []; hist.forEach((r, i) => { if (nuevasFechas.has(r.fecha)) idxs.push(i); });
    const evIdx = idxs.slice(-evalLimit);
    const evaluacion = [], omitidosEval = idxs.length - evIdx.length;
    let sinHist = 0;
    for (let j = 0; j < evIdx.length; j++) {
      const i = evIdx[j], r = hist[i];
      if (i < Algo.MIN_HIST) { sinHist++; continue; }
      const prior = hist.slice(0, i), fila = { fecha: r.fecha, numero: r.numero, alg: {} };
      for (const a of [1, 2, 3]) {
        const all = Algo.run(a, prior, { k: 1000, seed: `${seedBase}|${r.fecha}`, explain: false, fechaObjetivo: r.fecha });
        const ev = Hits.evaluateNum({ candidatos: all.slice(0, k) }, r.numero);
        fila.alg[a] = { rank: Algo.rankOf(all, r.numero), D: ev.directo, C: ev.combinado, top: all[0].n, eC: Hits.expected({ candidatos: all.slice(0, k) }).eC };
      }
      evaluacion.push(fila);
      hecho++;
      if (j % 4 === 0) { onProgress && onProgress(hecho / pasos, `Evaluando ${g.nombre}: sorteo ${j + 1} de ${evIdx.length}…`); await U.sleep(0); }
    }
    const resumenEval = {};
    for (const a of [1, 2, 3]) {
      const fs = evaluacion.map(f => f.alg[a]);
      resumenEval[a] = {
        n: fs.length, D: fs.filter(x => x.D).length, C: fs.filter(x => x.C).length,
        rankMedio: fs.length ? MathX.mean(fs.map(x => x.rank)) : null,
        eD: fs.length * k / 1000, eC: fs.reduce((s, x) => s + x.eC, 0),
      };
    }
    // 2) Pronóstico para el próximo sorteo con TODO el histórico (anterior + nuevo)
    const ultimo = hist[hist.length - 1];
    const proxima = ultimo ? U.addDays(ultimo.fecha, 1) : U.todayISO();
    const pron = {};
    for (const a of [1, 2, 3]) pron[a] = { algoritmo: a, loteriaId: guardar ? g.lot.id : null, fechaObjetivo: proxima, candidatos: Algo.run(a, hist, { k, seed: `${seedBase}|${proxima}`, explain: true, fechaObjetivo: proxima }) };
    // 3) Pronósticos guardados antes que ahora tienen resultado con los números nuevos
    const guardados = [];
    if (g.lot) {
      const porFecha = new Map(g.nuevos.map(r => [r.fecha, r.numero]));
      for (const p of Store.pronosticos) if (p.loteriaId === g.lot.id && p.origen !== 'backtest' && porFecha.has(p.fechaObjetivo)) guardados.push({ p, ev: Hits.evaluateNum(p, porFecha.get(p.fechaObjetivo)) });
    }
    res.grupos.push({
      nombre: g.nombre, loteriaId: g.lot ? g.lot.id : null, reemplazados: g.reemplazados || 0,
      antes: g.previos.length, despues: hist.length, nuevos: g.nuevos, duplicados: g.duplicados.length, conflictos: g.conflictos,
      hist, evaluacion, resumenEval, omitidosEval, sinHist, proxima, pron, guardados,
      stNuevos: Stats.compute(g.nuevos), stHist: Stats.compute(hist), stPrev: Stats.compute(g.previos.map(r => ({ fecha: r.fecha, numero: r.numero }))),
    });
  }
  onProgress && onProgress(1, 'Listo');
  return res;
}

/* ---------- Vista ---------- */
UI.views.importar = (el) => {
  const tabs = [['archivo', '📄 Archivo Excel / CSV'], ['pegar', '📋 Pegar números'], ['uno', '✚ Un resultado'], ['numero', '🔍 Evaluar un número']];
  el.innerHTML = `
    <div class="card"><h2>⇪ Importar y analizar</h2>
      <div class="sub">Meta números cada vez que lo necesite: un archivo con cientos o miles de resultados, una lista pegada o un solo resultado. La aplicación los une con lo que ya tiene y le muestra el análisis y el pronóstico de los 3 algoritmos.</div>
      <div class="tabs" role="tablist">${tabs.map(([k, t]) => `<button role="tab" data-iatab="${k}" class="${IA.tab === k ? 'active' : ''}">${t}</button>`).join('')}</div>
      <div id="iaIn"></div>
    </div>
    <div id="iaRev"></div>
    <div id="iaOut"></div>`;
  UI.$$('[data-iatab]', el).forEach(b => b.onclick = () => { IA.tab = b.dataset.iatab; IA.src = null; UI.render(); });
  ({ archivo: iaTabArchivo, pegar: iaTabPegar, uno: iaTabUno, numero: iaTabNumero })[IA.tab]();
  if (IA.src && (IA.tab === 'archivo' || IA.tab === 'pegar')) iaRevision();
  if (IA.result && IA.tab !== 'numero') iaResultado();
};

function iaTabArchivo() {
  const box = document.getElementById('iaIn');
  box.innerHTML = `
    <div class="drop" id="iaDrop" tabindex="0" role="button" aria-label="Seleccionar archivo">
      <div style="font-size:30px">⇪</div>
      <div><b>Arrastre aquí su archivo</b> o haga clic para buscarlo</div>
      <div class="small muted">Excel (.xlsx, .xls) o CSV/TXT · con o sin fechas · sin límite práctico de filas</div>
      ${IA.src ? `<div class="small ok" style="margin-top:6px">Archivo cargado: <b>${U.esc(IA.src.name)}</b> (${U.fmt(IA.src.aoa.length)} filas)</div>` : ''}
    </div>
    <label class="small" style="display:block;margin-top:8px"><input type="checkbox" id="iaDirecto" ${Store.config.importarDirecto ? 'checked' : ''}> Importar y analizar directamente al elegir el archivo (sin revisión, cuando trae fecha, lotería y número)</label>
    <input type="file" id="iaFile" accept=".xlsx,.xls,.csv,.txt" hidden>
    <div class="small muted" style="margin-top:8px">Formatos aceptados: columnas FECHA · LOTERÍA · NÚMERO (en cualquier orden), o solo una columna de números. <a href="#" id="iaTpl">Descargar plantilla</a>.</div>`;
  const inp = document.getElementById('iaFile'), drop = document.getElementById('iaDrop');
  const leer = (file) => iaLeerArchivo(file);
  drop.onclick = () => inp.click();
  drop.onkeydown = (e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); inp.click(); } };
  inp.onchange = (e) => { if (e.target.files[0]) leer(e.target.files[0]); };
  drop.ondragover = (e) => { e.preventDefault(); drop.classList.add('over'); };
  drop.ondragleave = () => drop.classList.remove('over');
  drop.ondrop = (e) => { e.preventDefault(); drop.classList.remove('over'); if (e.dataTransfer.files[0]) leer(e.dataTransfer.files[0]); };
  document.getElementById('iaDirecto').onchange = (e) => Store.setConfig('importarDirecto', e.target.checked);
  document.getElementById('iaTpl').onclick = (e) => { e.preventDefault(); try { XL.save(XL.plantilla(), 'PERLA3_PLANTILLA_IMPORTACION.xlsx'); } catch (err) { UI.toast(err.message, 'err'); } };
}

function iaTabPegar() {
  const box = document.getElementById('iaIn');
  box.innerHTML = `
    <p class="small muted">Pegue una lista de números (separados por espacios, comas o en líneas) o filas copiadas de Excel con fecha, lotería y número.</p>
    <textarea id="iaTxt" placeholder="Ejemplos:&#10;123 456 007 089 541&#10;— o —&#10;05/01/2026;Mi Lotería;007&#10;06/01/2026;Mi Lotería;125">${U.esc(IA.pegado || '')}</textarea>
    <div class="toolbar" style="margin-top:8px"><button class="btn gold" id="iaLeerTxt">Revisar números pegados</button><span class="small muted" id="iaTxtInfo"></span></div>`;
  const ta = document.getElementById('iaTxt');
  const info = () => { const t = ta.value.match(/\d+/g); document.getElementById('iaTxtInfo').textContent = t ? `${t.length} valores numéricos detectados` : ''; };
  ta.oninput = U.debounce(info, 200); info();
  document.getElementById('iaLeerTxt').onclick = () => {
    const txt = ta.value; IA.pegado = txt;
    if (!txt.trim()) { UI.toast('Pegue primero los números.', 'warn'); return; }
    const lineas = txt.split(/\r?\n/).filter(l => l.trim());
    const conFecha = lineas.some(l => /\d{1,4}[-/.]\d{1,2}[-/.]\d{1,4}/.test(l));
    let aoa;
    if (conFecha) aoa = XL.parseCSV(txt);
    else aoa = (txt.match(/[^\s,;|\t]+/g) || []).map(t => [t]);
    IA.src = { aoa, name: 'Texto pegado', sheetNames: ['TEXTO'], sheet: 'TEXTO' }; IA.opts = null; IA.result = null;
    UI.render();
  };
}

/** Fecha propuesta para un resultado nuevo: el día siguiente al último registrado (como máximo mañana). */
function iaFechaLibre(loteriaId) {
  if (!loteriaId) return U.todayISO();
  const nd = nextDrawDate(loteriaId), max = U.addDays(U.todayISO(), 1);
  return nd <= max ? nd : max;
}

function iaTabUno() {
  const box = document.getElementById('iaIn');
  const def = UI.ctxLoteria ?? Store.loterias[0]?.id;
  box.innerHTML = `
    <form id="iaUno" class="toolbar" autocomplete="off">
      <label class="field">Fecha del sorteo<input type="date" id="iaUF" value="${iaFechaLibre(def)}" max="${U.addDays(U.todayISO(), 1)}"></label>
      <label class="field grow">Lotería<select id="iaUL">${UI.loteriaOptions(def, { todas: false })}<option value="__nueva">+ Nueva lotería…</option></select></label>
      <label class="field" id="iaULNw" hidden>Nombre nueva lotería<input id="iaULN" maxlength="60"></label>
      <label class="field">Número ganador<input id="iaUN" class="num3" inputmode="numeric" maxlength="3" placeholder="000"></label>
      <label class="field">Candidatos<select id="iaUK">${Algo.CANTIDADES.map(k => `<option ${k === IA.k ? 'selected' : ''}>${k}</option>`).join('')}</select></label>
      <button class="btn gold" type="submit">Registrar y analizar</button>
    </form>
    <div class="small muted">Se guarda el resultado, se revisa si los algoritmos lo tenían en su lista y se calcula el nuevo pronóstico para el sorteo siguiente.</div>`;
  const sel = document.getElementById('iaUL');
  const showNew = () => { document.getElementById('iaULNw').hidden = sel.value !== '__nueva'; };
  sel.onchange = () => { showNew(); if (sel.value !== '__nueva') document.getElementById('iaUF').value = iaFechaLibre(+sel.value); };
  if (!Store.loterias.length) sel.value = '__nueva'; showNew();
  const ni = document.getElementById('iaUN');
  ni.oninput = () => { ni.value = ni.value.replace(/\D/g, '').slice(0, 3); };
  document.getElementById('iaUno').onsubmit = async (e) => {
    e.preventDefault();
    const fecha = UI.val('iaUF'), numero = U.normNum(ni.value);
    const nombre = sel.value === '__nueva' ? UI.val('iaULN').trim() : Store.loteriaNombre(+sel.value);
    if (!U.isISO(fecha)) return UI.toast('Fecha inválida.', 'err');
    if (fecha > U.addDays(U.todayISO(), 1)) return UI.toast('La fecha no puede estar en el futuro.', 'err');
    if (!numero) return UI.toast('Escriba un número de 1 a 3 cifras.', 'err');
    if (!nombre) return UI.toast('Escriba el nombre de la lotería.', 'err');
    const lot = Store.findLoteriaByName(nombre), ex = lot && Store.resultadoDe(lot.id, fecha);
    if (ex) {
      if (ex.numero === numero) return UI.toast(`Ese resultado ya estaba registrado (${numero}).`, 'warn');
      if (!await UI.confirm(`Ya existe el número <b class="n3">${ex.numero}</b> para ${U.esc(nombre)} el ${U.fmtDate(fecha)}. ¿Reemplazarlo por <b class="n3">${numero}</b>?`, { ok: 'Reemplazar' })) return;
    }
    IA.k = +UI.val('iaUK');
    await iaEjecutar([{ fecha, loteria: nombre, numero }], { guardar: true, modoDup: 'reemplazar' });
    ni.value = '';
  };
}

function iaTabNumero() {
  const box = document.getElementById('iaIn');
  const q = IA.numQuery; if (q.loteriaId === null || !Store.loteria(q.loteriaId)) q.loteriaId = UI.ctxLoteria ?? Store.loterias[0]?.id ?? null;
  if (!q.loteriaId) { box.innerHTML = UI.needData(1, null); return; }
  box.innerHTML = `
    <form id="iaNum" class="toolbar" autocomplete="off">
      <label class="field grow">Lotería<select id="iaNL">${UI.loteriaOptions(q.loteriaId, { todas: false })}</select></label>
      <label class="field">Número a evaluar<input id="iaNN" class="num3" inputmode="numeric" maxlength="3" placeholder="000" value="${U.esc(q.numero)}"></label>
      <button class="btn gold" type="submit">Evaluar número</button>
    </form>
    <div class="small muted">No se registra nada: muestra la historia del número y en qué puesto lo ubica cada algoritmo para el próximo sorteo.</div>
    <div id="iaNOut"></div>`;
  const ni = document.getElementById('iaNN');
  ni.oninput = () => { ni.value = ni.value.replace(/\D/g, '').slice(0, 3); };
  const run = () => {
    const n = U.normNum(ni.value); if (!n) { UI.toast('Escriba un número de 1 a 3 cifras.', 'err'); return; }
    q.loteriaId = +UI.val('iaNL'); q.numero = n; ni.value = n;
    const rows = Store.resultadosDe(q.loteriaId), hist = rows.map(r => ({ fecha: r.fecha, numero: r.numero }));
    const st = Stats.compute(hist), prox = nextDrawDate(q.loteriaId);
    const perms = Hits.permutations(n).filter(x => x !== n);
    const apD = rows.filter(r => r.numero === n), apC = rows.filter(r => perms.includes(r.numero));
    const gap = st.gap[+n];
    const algs = [1, 2, 3].map(a => ({ a, f: Algo.run(a, hist, { k: IA.k, seed: `${q.loteriaId}|${prox}`, explain: false, fechaObjetivo: prox, focus: n }).focus }));
    const out = document.getElementById('iaNOut');
    out.innerHTML = `
      <div class="grid g2" style="margin-top:12px">
        <div class="card" style="margin:0"><h2>Historia de <span class="n3" style="font-size:18px">${n}</span> en ${U.esc(Store.loteriaNombre(q.loteriaId))}</h2>
          <div class="kv">
            <b>Sorteos analizados</b><span>${st.n}</span>
            <b>Veces que salió (directo)</b><span>${apD.length} · ${U.pct(apD.length, st.n, 2)} <span class="muted">(esperado ${(st.n / 1000).toFixed(2)})</span></span>
            <b>Última vez</b><span>${gap === null ? 'nunca ha salido' : `${U.fmtDate(rows[st.last[+n]].fecha)} · hace ${gap} sorteos`}</span>
            <b>Combinado (${perms.join(', ') || '—'})</b><span>${apC.length} veces</span>
            <b>Cifras por posición</b><span>${[0, 1, 2].map(p => `${Stats.POS[p]}=${n[p]}: ${U.pct(st.pos[p][+n[p]], st.n)}`).join(' · ')} <span class="muted">(teórico 10%)</span></span>
            <b>Patrón</b><span>${U.pattern(n)} · paridad ${U.parity(n)} · suma ${U.digitSum(n)}</span>
            <b>Probabilidad real</b><span>1 entre 1000 (0,1%) en cada sorteo, igual que cualquier otro número</span>
          </div></div>
        <div class="card" style="margin:0"><h2>Puesto en cada algoritmo · sorteo ${U.fmtDate(prox)}</h2>
          ${algs.map(({ a, f }) => `<div class="cand ${f.rank <= IA.k ? 'hitd' : ''}" style="margin-bottom:6px"><span class="rk">${UI.algBadge(a)}</span><span class="n3">#${f.rank}</span>
            <span><span class="small">${f.score.toFixed(1)} pts · de 1000</span><div class="bar"><i style="width:${(100 - (f.rank - 1) / 10).toFixed(0)}%"></i></div></span>
            <span class="why">${f.rank <= IA.k ? `<span class="badge d">ENTRA EN EL TOP ${IA.k}</span> ` : ''}${U.esc(f.razon)}</span></div>`).join('')}
          <div class="small muted">Puesto 1 = el número que el algoritmo puntúa más alto. Se usan los ${st.n} sorteos registrados.</div></div>
      </div>
      ${apD.length + apC.length ? `<div class="card" style="margin-top:12px"><h2>Apariciones</h2>${UI.table(['Fecha', 'Número', 'Tipo'], apD.concat(apC).sort((a, b) => (a.fecha < b.fecha ? 1 : -1)).slice(0, 40).map(r => `<tr><td>${U.fmtDate(r.fecha)}</td><td>${UI.num3(r.numero)}</td><td>${r.numero === n ? '<span class="badge d">Directo</span>' : '<span class="badge c">Combinado</span>'}</td></tr>`))}</div>` : ''}`;
  };
  document.getElementById('iaNum').onsubmit = (e) => { e.preventDefault(); run(); };
  if (q.numero) run();
}

/* ---------- Opciones detectadas automáticamente ---------- */
function iaOpcionesPorDefecto(d) {
  const det = iaDetectar(d.aoa);
  const lotDef = det.loteria >= 0 ? '' : (UI.ctxLoteria ? Store.loteriaNombre(UI.ctxLoteria) : (Store.loterias[0]?.nombre || ''));
  // ¿Los números vienen con 4 cifras (chance)? Entonces se toman las 3 últimas.
  const muestra = d.aoa.slice(det.hasHeader ? 1 : 0, 200).map(r => String(r[det.numero] ?? '').replace(/\D/g, '')).filter(Boolean);
  const largos = muestra.filter(x => x.length >= 4 && !/^0+\d{3}$/.test(x)).length;
  return { fecha: det.fecha, numero: det.numero, loteria: det.loteria, hasHeader: det.hasHeader, ncol: det.ncol,
    loteriaNombre: lotDef, formatoFecha: Store.config.formatoFecha, ultimas3: Store.config.ultimas3 || (muestra.length > 0 && largos / muestra.length > 0.5), modoDup: 'omitir',
    orden: 'antiguo_primero', fechaFinal: U.todayISO(), todasCeldas: det.ncol > 1 && det.fecha < 0 && det.loteria < 0 && !det.hasHeader };
}

/** Lee un archivo y, si trae FECHA, LOTERÍA y NÚMERO, lo importa y analiza directamente (sin revisión). */
async function iaLeerArchivo(file) {
  let d;
  try { d = await XL.leer(file); } catch (err) { UI.toast('No se pudo leer el archivo: ' + err.message, 'err'); return; }
  IA.src = { ...d, name: file.name, file }; IA.result = null;
  IA.opts = iaOpcionesPorDefecto(IA.src);
  const o = IA.opts;
  if (Store.config.importarDirecto && o.fecha >= 0 && o.loteria >= 0) {
    const r = iaConstruir(d.aoa, o);
    if (r.registros.length) {
      if (UI.current === 'importar') UI.render();
      UI.toast(`Importando ${U.fmt(r.registros.length)} resultados de "${file.name}"…`, 'ok', 4000);
      await iaEjecutar(r.registros, { guardar: true, modoDup: 'omitir', errores: r.errores.length, directo: true });
      return;
    }
  }
  // Falta información (lotería o fechas): se muestra la revisión para completarla
  if (UI.current === 'importar') UI.render();
  if (Store.config.importarDirecto) UI.toast('Revise las opciones: el archivo no indica ' + (o.fecha < 0 ? 'las fechas' : 'la lotería') + '.', 'warn', 6000);
}

/* ---------- Revisión del archivo / texto ---------- */
function iaRevision() {
  const d = IA.src, box = document.getElementById('iaRev');
  if (!d.aoa.length) { box.innerHTML = '<div class="card"><div class="note warn">No se encontraron datos.</div></div>'; return; }
  if (!IA.opts) IA.opts = iaOpcionesPorDefecto(d);
  const o = IA.opts, ncol = Math.max(o.ncol, 1);
  const colOpts = (sel, none) => (none ? `<option value="-1" ${sel < 0 ? 'selected' : ''}>${none}</option>` : '') + Array.from({ length: ncol }, (_, i) => `<option value="${i}" ${i === sel ? 'selected' : ''}>Columna ${String.fromCharCode(65 + i)}${o.hasHeader && d.aoa[0][i] !== undefined ? ' – ' + U.esc(d.aoa[0][i]) : ''}</option>`).join('');
  const lotNames = Store.loterias.map(l => l.nombre);
  box.innerHTML = `<div class="card"><h2>Revisión · ${U.esc(d.name)}</h2>
    ${d.sheetNames && d.sheetNames.length > 1 ? `<div class="toolbar"><label class="field">Hoja<select id="iaSheet">${d.sheetNames.map(s => `<option ${s === d.sheet ? 'selected' : ''}>${U.esc(s)}</option>`).join('')}</select></label></div>` : ''}
    <div class="toolbar">
      <label class="field">Columna NÚMERO<select id="ioN">${colOpts(o.numero)}</select></label>
      <label class="field">Columna FECHA<select id="ioF">${colOpts(o.fecha, '(el archivo no tiene fechas)')}</select></label>
      <label class="field">Columna LOTERÍA<select id="ioL">${colOpts(o.loteria, '(todas son de una misma lotería)')}</select></label>
      <label class="field grow">${o.loteria >= 0 ? 'Lotería si la celda está vacía' : 'Lotería de estos números'}<input id="ioLN" list="ioLNl" value="${U.esc(o.loteriaNombre)}" placeholder="Elija o escriba una lotería nueva"><datalist id="ioLNl">${lotNames.map(n => `<option value="${U.esc(n)}">`).join('')}</datalist></label>
    </div>
    <div class="toolbar">
      ${o.fecha >= 0 ? `<label class="field">Formato de fecha<select id="ioFmt"><option value="dmy" ${o.formatoFecha === 'dmy' ? 'selected' : ''}>DD/MM/AAAA</option><option value="mdy" ${o.formatoFecha === 'mdy' ? 'selected' : ''}>MM/DD/AAAA</option></select></label>`
      : `<label class="field">Orden de la lista<select id="ioOrd"><option value="antiguo_primero" ${o.orden === 'antiguo_primero' ? 'selected' : ''}>El primero es el más antiguo</option><option value="reciente_primero" ${o.orden === 'reciente_primero' ? 'selected' : ''}>El primero es el más reciente</option></select></label>
         <label class="field">Fecha del número más reciente<input type="date" id="ioFF" value="${o.fechaFinal}" max="${U.addDays(U.todayISO(), 1)}"></label>`}
      <label class="field">Si la fecha ya existe<select id="ioDup"><option value="omitir" ${o.modoDup === 'omitir' ? 'selected' : ''}>Conservar lo que ya tengo</option><option value="reemplazar" ${o.modoDup === 'reemplazar' ? 'selected' : ''}>Reemplazar por lo nuevo</option></select></label>
      <label class="field"><span><input type="checkbox" id="ioH" ${o.hasHeader ? 'checked' : ''}> La primera fila son títulos</span><span><input type="checkbox" id="ioU3" ${o.ultimas3 ? 'checked' : ''}> Números de 4+ cifras: usar las 3 últimas</span>${o.fecha < 0 ? `<span><input type="checkbox" id="ioAll" ${o.todasCeldas ? 'checked' : ''}> Leer todas las celdas (fila por fila)</span>` : ''}</label>
    </div>
    <div id="iaCheck" class="small"></div>
    ${UI.table(Array.from({ length: ncol }, (_, i) => String.fromCharCode(65 + i)), d.aoa.slice(0, 6).map(r => `<tr>${Array.from({ length: ncol }, (_, i) => `<td>${U.esc(r[i] ?? '')}</td>`).join('')}</tr>`))}
    <div class="small muted">Vista previa: primeras 6 de ${U.fmt(d.aoa.length)} filas.</div>
    <div class="toolbar" style="margin-top:12px">
      <label class="field">Candidatos por algoritmo<select id="ioK">${Algo.CANTIDADES.map(k => `<option ${k === IA.k ? 'selected' : ''}>${k}</option>`).join('')}</select></label>
      <label class="field">Evaluar algoritmos en los últimos<select id="ioEv">${[50, 100, 300, 1000, 5000].map(v => `<option value="${v}" ${v === IA.evalLimit ? 'selected' : ''}>${v} sorteos nuevos</option>`).join('')}</select></label>
      <button class="btn gold big" id="iaGo">IMPORTAR Y ANALIZAR</button>
      <button class="btn" id="iaSolo">Solo analizar (sin guardar)</button>
    </div>
    <div class="progress" id="iaBar" hidden><i></i></div><div class="small muted" id="iaMsg"></div>
  </div>`;
  const leer = () => {
    o.numero = +UI.val('ioN'); o.fecha = +UI.val('ioF'); o.loteria = +UI.val('ioL'); o.loteriaNombre = UI.val('ioLN');
    o.hasHeader = document.getElementById('ioH').checked; o.ultimas3 = document.getElementById('ioU3').checked; o.modoDup = UI.val('ioDup');
    if (document.getElementById('ioFmt')) o.formatoFecha = UI.val('ioFmt');
    if (document.getElementById('ioOrd')) { o.orden = UI.val('ioOrd'); o.fechaFinal = UI.val('ioFF') || U.todayISO(); }
    if (document.getElementById('ioAll')) o.todasCeldas = document.getElementById('ioAll').checked;
    IA.k = +UI.val('ioK'); IA.evalLimit = +UI.val('ioEv');
  };
  const check = () => {
    const r = iaConstruir(d.aoa, o), cl = iaClasificar(r.registros);
    const tot = (f) => cl.reduce((s, g) => s + f(g), 0);
    const rango = r.registros.length ? (() => { const fs = r.registros.map(x => x.fecha).sort(); return `${U.fmtDate(fs[0])} → ${U.fmtDate(fs[fs.length - 1])}`; })() : '—';
    document.getElementById('iaCheck').innerHTML = `
      <div class="kpis" style="margin:4px 0 10px">
        <div class="kpi green"><div class="l">Números válidos</div><div class="v">${U.fmt(r.registros.length)}</div><div class="s">${rango}</div></div>
        <div class="kpi"><div class="l">Nuevos para el sistema</div><div class="v">${U.fmt(tot(g => g.nuevos.length))}</div><div class="s">${cl.map(g => U.esc(g.nombre) + ': ' + g.nuevos.length).join(' · ')}</div></div>
        <div class="kpi blue"><div class="l">Ya registrados</div><div class="v">${U.fmt(tot(g => g.duplicados.length))}</div><div class="s">mismo número y fecha</div></div>
        <div class="kpi"><div class="l">Fecha ocupada con otro número</div><div class="v">${U.fmt(tot(g => g.conflictos.length))}</div><div class="s">${o.modoDup === 'reemplazar' ? 'se reemplazarán' : 'se conservará lo existente'}</div></div>
        <div class="kpi ${r.errores.length ? '' : 'green'}"><div class="l">Con error</div><div class="v">${U.fmt(r.errores.length)}</div><div class="s">${r.errores.length ? 'no se importan' : 'ninguno'}</div></div>
      </div>
      ${r.sinFechas ? `<div class="note">Sin fechas en el archivo: a cada número se le asigna un sorteo diario consecutivo terminando el <b>${U.fmtDate(o.fechaFinal)}</b>. ${tot(g => g.duplicados.length + g.conflictos.length) ? '<span class="warn">Algunas fechas ya tienen resultado en esa lotería; si son números distintos, cambie la fecha o use una lotería nueva.</span>' : ''}</div>` : ''}
      ${r.nuevasLot.length ? `<div class="note">Se creará la lotería: <b>${r.nuevasLot.map(U.esc).join(', ')}</b>.</div>` : ''}
      ${r.errores.length ? `<details><summary>Ver errores (${r.errores.length})</summary><ul>${r.errores.slice(0, 40).map(e => `<li>Fila ${e.fila}: ${U.esc(e.motivo)}</li>`).join('')}</ul></details>` : ''}`;
    return r;
  };
  UI.$$('#iaRev select, #iaRev input').forEach(i => i.onchange = () => {
    const prevF = o.fecha, prevL = o.loteria; leer();
    if (i.id === 'iaSheet') return;
    if (o.fecha !== prevF || o.loteria !== prevL) iaRevision(); else check();
  });
  const sh = document.getElementById('iaSheet');
  if (sh) sh.onchange = async () => { const nd = await XL.leer(d.file, sh.value); IA.src = { ...nd, name: d.name, file: d.file }; IA.opts = null; iaRevision(); };
  check();
  const go = async (guardar) => {
    leer();
    const r = check();
    if (!r.registros.length) { UI.toast('No hay números válidos para procesar.', 'err'); return; }
    if (guardar) { await Store.setConfig('formatoFecha', o.formatoFecha); await Store.setConfig('ultimas3', o.ultimas3); }
    await iaEjecutar(r.registros, { guardar, modoDup: o.modoDup, errores: r.errores.length });
  };
  document.getElementById('iaGo').onclick = () => go(true);
  document.getElementById('iaSolo').onclick = () => go(false);
}

async function iaEjecutar(registros, { guardar, modoDup = 'omitir', errores = 0, directo = false }) {
  if (IA.running) return;
  IA.running = true;
  const bar = document.getElementById('iaBar'), msg = document.getElementById('iaMsg');
  UI.$$('#iaGo, #iaSolo, #iaUno button[type=submit]').forEach(b => b.disabled = true);
  if (bar) bar.hidden = false;
  try {
    IA.result = await iaProcesar(registros, {
      guardar, modoDup, k: IA.k, evalLimit: IA.evalLimit,
      onProgress: (x, t) => { if (bar && bar.isConnected) { bar.firstElementChild.style.width = (x * 100).toFixed(0) + '%'; msg.textContent = t; } },
    });
    IA.result.errores = errores;
    const nuevos = IA.result.grupos.reduce((s, g) => s + g.nuevos.length, 0);
    UI.toast(guardar ? `Listo: ${nuevos} resultados nuevos guardados y analizados.` : `Análisis listo (${nuevos} números nuevos, no se guardó nada).`);
  } catch (err) { console.error(err); UI.toast('Error al procesar: ' + err.message, 'err', 7000); }
  IA.running = false;
  if (UI.current === 'importar') { if (IA.tab !== 'uno') IA.src = guardar ? null : IA.src; UI.render(); const out = document.getElementById('iaOut'); if (out) out.scrollIntoView({ behavior: 'smooth', block: 'start' }); }
}

/* ---------- Resultado ---------- */
function iaResultado() {
  const R = IA.result, out = document.getElementById('iaOut');
  out.innerHTML = `<div class="card no-print"><div class="toolbar" style="margin:0">
      <span><b>Resultado del análisis</b> · ${U.fmtDateTime(R.creado)} · ${R.guardar ? '<span class="badge d">GUARDADO EN EL SISTEMA</span>' : '<span class="badge c">SOLO ANÁLISIS · NO SE GUARDÓ</span>'}</span>
      <button class="btn" id="iaXls">Exportar análisis (Excel)</button><button class="btn" id="iaPdf">Exportar análisis (PDF)</button>
      ${!R.guardar ? '<span class="small muted">Si le sirve, vuelva a la revisión y pulse «Importar y analizar» para guardarlo.</span>' : ''}
      <button class="btn ghost" id="iaClr">Cerrar resultado</button></div></div>
    ${R.grupos.map((g, gi) => iaGrupoHTML(g, gi, R)).join('')}`;
  document.getElementById('iaClr').onclick = () => { IA.result = null; UI.render(); };
  document.getElementById('iaXls').onclick = () => { try { iaExcel(R); } catch (err) { UI.toast(err.message, 'err'); } };
  document.getElementById('iaPdf').onclick = () => iaPDF(R);
  R.grupos.forEach((g, gi) => {
    UI.chart('iaCh' + gi, { type: 'bar', data: { labels: ['A0', 'A1', 'A2', 'A3', 'A4', 'A5', 'A6', 'A7', 'A8', 'A9', 'B0', 'B1', 'B2', 'B3', 'B4', 'B5', 'B6', 'B7', 'B8', 'B9', 'C0', 'C1', 'C2', 'C3', 'C4', 'C5', 'C6', 'C7', 'C8', 'C9'],
      datasets: [
        { label: `Números nuevos (${g.stNuevos.n})`, data: [0, 1, 2].flatMap(p => g.stNuevos.pos[p].map(c => g.stNuevos.n ? +(100 * c / g.stNuevos.n).toFixed(1) : 0)), backgroundColor: COLORS.gold, borderColor: '#131f33', borderWidth: 1 },
        { label: `Histórico completo (${g.stHist.n})`, data: [0, 1, 2].flatMap(p => g.stHist.pos[p].map(c => g.stHist.n ? +(100 * c / g.stHist.n).toFixed(1) : 0)), backgroundColor: COLORS.a2, borderColor: '#131f33', borderWidth: 1 },
        UI.refLine('Teórico 10%', 10, 30)] },
      options: { scales: { y: { title: { display: true, text: '% de sorteos' } } } } });
    const b = document.getElementById('iaSave' + gi);
    if (b) b.onclick = async () => {
      const ps = [1, 2, 3].map(a => Algo.generar({ alg: a, loteriaId: g.loteriaId, fechaObjetivo: g.proxima, k: R.k }));
      await Store.savePronosticos(ps); b.disabled = true; b.textContent = '✔ Pronósticos guardados';
      UI.toast('Pronósticos guardados: se evaluarán solos cuando registre el resultado de ese sorteo.');
    };
  });
}

function iaGrupoHTML(g, gi, R) {
  const k = R.k, ult = g.hist[g.hist.length - 1];
  const sets = [1, 2, 3].map(a => new Set(g.pron[a].candidatos.map(c => c.n)));
  const en3 = [...sets[0]].filter(n => sets[1].has(n) && sets[2].has(n));
  const en2 = [...new Set([...sets[0], ...sets[1], ...sets[2]])].filter(n => sets.filter(s => s.has(n)).length === 2);
  const E = g.resumenEval, nEval = E[1].n;
  const repetidos = g.nuevos.filter(r => g.stPrev.freq[+r.numero] > 0).length;
  const topNuevos = Stats.topN(g.stNuevos.freq, 10, true, o => o.v > 0);
  const ultimosEval = g.evaluacion.slice(-25).reverse();
  return `
  <div class="card"><h2>${U.esc(g.nombre)}</h2>
    <div class="kpis">
      <div class="kpi"><div class="l">Sorteos antes → ahora</div><div class="v">${U.fmt(g.antes)} → ${U.fmt(g.despues)}</div><div class="s">${g.antes ? 'se sumaron a lo que ya tenía' : 'lotería sin datos previos'}</div></div>
      <div class="kpi green"><div class="l">Números nuevos</div><div class="v">${U.fmt(g.nuevos.length)}</div><div class="s">${g.nuevos.length ? U.fmtDate(g.nuevos[0].fecha) + ' → ' + U.fmtDate(g.nuevos[g.nuevos.length - 1].fecha) : 'ninguno'}</div></div>
      <div class="kpi blue"><div class="l">Ya estaban</div><div class="v">${U.fmt(g.duplicados)}</div><div class="s">${g.reemplazados ? g.reemplazados + ' fechas reemplazadas' : g.conflictos.length + ' fechas con otro número (se conservó lo existente)'}</div></div>
      <div class="kpi"><div class="l">Último resultado</div><div class="v">${ult ? `<span class="n3" style="font-size:24px">${ult.numero}</span>` : '—'}</div><div class="s">${ult ? U.fmtDate(ult.fecha) : ''}</div></div>
      <div class="kpi"><div class="l">Nuevos que ya habían salido</div><div class="v">${repetidos}</div><div class="s">de ${g.nuevos.length} (el número ya existía en el histórico)</div></div>
    </div>
    ${g.conflictos.length ? `<details class="small"><summary>Ver ${g.conflictos.length} fechas que ya tenían otro número</summary>${UI.table(['Fecha', 'En el sistema', 'En lo importado'], g.conflictos.slice(0, 50).map(c => `<tr><td>${U.fmtDate(c.fecha)}</td><td>${UI.num3(c.existente)}</td><td>${UI.num3(c.numero)}</td></tr>`))}</details>` : ''}

    <h3>★ Pronóstico para el próximo sorteo (${U.fmtDate(g.proxima)}) con ${U.fmt(g.despues)} sorteos</h3>
    ${g.despues < 30 ? '<div class="note warn">Hay pocos sorteos: con menos de 30 los algoritmos tienen muy poca información.</div>' : ''}
    ${en3.length ? `<div class="note">Coinciden en los <b>3 algoritmos</b>: ${en3.map(UI.num3).join(' ')}</div>` : ''}
    ${en2.length ? `<div class="small muted" style="margin-bottom:8px">Aparecen en 2 de los 3: ${en2.map(n => `<span class="n3" style="font-size:12px">${n}</span>`).join(' ')}</div>` : ''}
    <div class="grid g3">${[1, 2, 3].map(a => `<div><h3>${UI.algBadge(a)} ${Algo.NOMBRES[a]}</h3>${renderCands(g.pron[a])}</div>`).join('')}</div>
    <div class="toolbar" style="margin-top:10px">${R.guardar ? `<button class="btn green" id="iaSave${gi}">Guardar estos pronósticos</button>` : ''}<span class="small muted">La puntuación es relativa entre los 1000 números; no es una probabilidad. La probabilidad real sigue siendo 1/1000 por número.</span></div>

    <h3>¿Cómo les fue a los algoritmos con los números nuevos?</h3>
    ${nEval ? `<div class="sub">Para cada número nuevo se calculó el pronóstico usando <b>solo los sorteos anteriores</b> a su fecha (top ${k}) y se comparó con lo que salió. ${g.omitidosEval ? `Se evaluaron los últimos ${nEval} (de ${g.nuevos.length}).` : ''} ${g.sinHist ? `${g.sinHist} quedaron sin evaluar por falta de histórico previo.` : ''}</div>
      ${UI.table(['Algoritmo', { t: 'Sorteos evaluados', c: 'r' }, { t: 'Directos (D)', c: 'r' }, { t: 'Combinados (C)', c: 'r' }, { t: 'Esperado por azar', c: 'r' }, { t: 'Puesto medio del número real', c: 'r' }],
        [1, 2, 3].map(a => `<tr><td>${UI.algBadge(a)} ${Algo.NOMBRES[a]}</td><td class="r">${E[a].n}</td><td class="r"><b>${E[a].D}</b></td><td class="r"><b>${E[a].C}</b></td><td class="r muted">${(E[a].eD + E[a].eC).toFixed(2)}</td><td class="r">${E[a].rankMedio.toFixed(0)} <span class="muted small">(azar: 500)</span></td></tr>`))}
      <div class="small muted" style="margin:6px 0 10px">Si los aciertos se parecen a lo «esperado por azar» y el puesto medio ronda 500, el algoritmo no está superando a la suerte con estos datos.</div>
      ${UI.table(['Fecha', 'Salió', { t: 'Puesto en A1', c: 'r' }, { t: 'Puesto en A2', c: 'r' }, { t: 'Puesto en A3', c: 'r' }, 'Aciertos'], ultimosEval.map(f => `<tr><td>${U.fmtDate(f.fecha)}</td><td>${UI.num3(f.numero)}</td>${[1, 2, 3].map(a => `<td class="r">${f.alg[a].rank}</td>`).join('')}<td>${[1, 2, 3].map(a => f.alg[a].D ? `<span class="badge d">A${a} D</span>` : f.alg[a].C ? `<span class="badge c">A${a} C</span>` : '').join(' ')}</td></tr>`))}
      ${g.evaluacion.length > 25 ? `<div class="small muted">Se muestran los 25 más recientes de ${g.evaluacion.length}. Exporte a Excel para verlos todos.</div>` : ''}`
      : `<div class="note">No hay números nuevos con suficiente histórico previo para evaluar (se necesitan al menos ${Algo.MIN_HIST} sorteos anteriores).</div>`}

    ${g.guardados.length ? `<h3>Pronósticos que usted había guardado y ya tienen resultado</h3>${UI.table(['Sorteo', 'Algoritmo', 'Salió', 'Resultado'], g.guardados.map(({ p, ev }) => `<tr><td>${U.fmtDate(p.fechaObjetivo)}</td><td>${UI.algBadge(p.algoritmo)}</td><td>${UI.num3(ev.resultado || '')}</td><td>${ev.directo ? `<span class="badge d">D-GANADOR #${ev.rank}</span>` : ev.combinado ? '<span class="badge c">C-GANADOR</span>' : `<span class="badge p">sin acierto · ${ev.mejorPos}/3</span>`}</td></tr>`))}` : ''}

    <h3>Números nuevos frente al histórico</h3>
    <div class="grid g2">
      <div><div class="chart-box"><canvas id="iaCh${gi}"></canvas></div></div>
      <div>${UI.table(['Más repetidos entre los nuevos', { t: 'Veces (nuevos)', c: 'r' }, { t: 'Veces (total)', c: 'r' }], topNuevos.map(o => `<tr><td>${UI.num3(U.pad3(o.i))}</td><td class="r">${o.v}</td><td class="r">${g.stHist.freq[o.i]}</td></tr>`))}
        <div class="small muted">Patrones de los nuevos: ${Object.entries(g.stNuevos.patterns).map(([kk, v]) => `${kk} ${U.pct(v, g.stNuevos.n)}`).join(' · ')}</div></div>
    </div>
  </div>`;
}

function iaExcel(R) {
  const wb = XL.book();
  const res = [['LOTERIA', 'SORTEOS_ANTES', 'SORTEOS_AHORA', 'NUEVOS', 'YA_ESTABAN', 'FECHAS_CON_OTRO_NUMERO', 'PROXIMO_SORTEO', 'GUARDADO']];
  const nuevos = [['FECHA', 'LOTERIA', 'NUMERO', 'A', 'B', 'C']], pron = [['LOTERIA', 'SORTEO', 'ALGORITMO', 'POSICION', 'NUMERO', 'PUNTUACION', 'EXPLICACION']];
  const ev = [['LOTERIA', 'FECHA', 'SALIO', 'PUESTO_A1', 'PUESTO_A2', 'PUESTO_A3', 'A1', 'A2', 'A3']];
  for (const g of R.grupos) {
    res.push([g.nombre, g.antes, g.despues, g.nuevos.length, g.duplicados, g.conflictos.length, g.proxima, R.guardar ? 'SI' : 'NO']);
    for (const r of g.nuevos) nuevos.push([r.fecha, g.nombre, r.numero, r.numero[0], r.numero[1], r.numero[2]]);
    for (const a of [1, 2, 3]) g.pron[a].candidatos.forEach((c, i) => pron.push([g.nombre, g.proxima, 'A' + a, i + 1, c.n, c.score, c.razon || '']));
    for (const f of g.evaluacion) ev.push([g.nombre, f.fecha, f.numero, f.alg[1].rank, f.alg[2].rank, f.alg[3].rank, ...[1, 2, 3].map(a => f.alg[a].D ? 'D' : f.alg[a].C ? 'C' : '')]);
  }
  XLSX.utils.book_append_sheet(wb, XL.sheet(res, [], [26, 14, 14, 10, 12, 22, 15, 10]), 'RESUMEN');
  XLSX.utils.book_append_sheet(wb, XL.sheet(nuevos, [2, 3, 4, 5], [12, 26, 9, 4, 4, 4]), 'NUEVOS');
  XLSX.utils.book_append_sheet(wb, XL.sheet(pron, [4], [26, 12, 10, 9, 9, 11, 90]), 'PRONOSTICO');
  XLSX.utils.book_append_sheet(wb, XL.sheet(ev, [2], [26, 12, 8, 10, 10, 10, 5, 5, 5]), 'EVALUACION');
  XL.save(wb, `PERLA3_ANALISIS_IMPORTACION_${U.stamp()}.xlsx`);
}

function iaPDF(R) {
  const secs = [{ titulo: 'Análisis de importación', texto: `${R.guardar ? 'Los datos se guardaron en el sistema.' : 'Solo análisis: no se guardó nada.'} Los pronósticos son modelos estadísticos; la probabilidad real de cada número es 1/1000 y no se garantizan premios.` }];
  for (const g of R.grupos) {
    secs.push({ titulo: g.nombre, texto: `Sorteos antes: ${g.antes} · ahora: ${g.despues} · nuevos: ${g.nuevos.length} · ya estaban: ${g.duplicados} · fechas con otro número: ${g.conflictos.length}. Próximo sorteo: ${U.fmtDate(g.proxima)}.` });
    secs.push({ titulo: `Pronóstico ${g.nombre} · ${U.fmtDate(g.proxima)}`, tabla: { head: ['#', 'A1', 'Pts', 'A2', 'Pts', 'A3', 'Pts'], body: g.pron[1].candidatos.map((c, i) => [i + 1, c.n, c.score.toFixed(1), g.pron[2].candidatos[i].n, g.pron[2].candidatos[i].score.toFixed(1), g.pron[3].candidatos[i].n, g.pron[3].candidatos[i].score.toFixed(1)]) } });
    if (g.evaluacion.length) secs.push({ titulo: `Rendimiento con los números nuevos (${g.nombre})`, tabla: { head: ['Algoritmo', 'Evaluados', 'Directos', 'Combinados', 'Esperado azar', 'Puesto medio (azar 500)'], body: [1, 2, 3].map(a => { const e = g.resumenEval[a]; return ['A' + a + ' ' + Algo.NOMBRES[a], e.n, e.D, e.C, (e.eD + e.eC).toFixed(2), e.rankMedio.toFixed(0)]; }) } });
  }
  PDF.build('Importar y analizar', secs, `PERLA3_ANALISIS_IMPORTACION_${U.stamp()}.pdf`);
}
