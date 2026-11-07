/* =====================================================================
   VISTAS: Generar pronósticos · Algoritmo 1/2/3 · Control de aciertos · Comparador
   ===================================================================== */
const GenV = { loteriaId: null, fecha: '', k: null, alg: 'todos', last: null, saved: false };

function nextDrawDate(loteriaId) {
  const rows = Store.resultadosDe(loteriaId);
  const last = rows[rows.length - 1];
  return last ? U.addDays(last.fecha, 1) : U.todayISO();
}

function renderCands(p, { showWhy = true } = {}) {
  const ev = Hits.evaluate(p);
  const maxS = Math.max(1, ...p.candidatos.map(c => c.score));
  return `<div class="cand-list">${p.candidatos.map((c, i) => {
    const hit = ev.estado === 'evaluado' ? (c.n === ev.resultado ? 'hitd' : (ev.combinado && U.isPerm(c.n, ev.resultado) ? 'hitc' : '')) : '';
    return `<div class="cand ${hit}"><span class="rk">#${String(i + 1).padStart(2, '0')}</span><span class="n3">${c.n}</span>
      <span><span class="small">${c.score.toFixed(1)} pts</span><div class="bar"><i style="width:${(100 * c.score / maxS).toFixed(0)}%"></i></div></span>
      <span class="why">${hit === 'hitd' ? '<span class="badge d">D-GANADOR</span> ' : hit === 'hitc' ? '<span class="badge c">C-GANADOR</span> ' : ''}${showWhy ? U.esc(c.razon || 'Generado en prueba histórica (sin explicación detallada).') : ''}</span></div>`;
  }).join('')}</div>`;
}
function evalLine(p) {
  const ev = Hits.evaluate(p);
  if (ev.estado === 'pendiente') return '<span class="badge p">PENDIENTE</span> <span class="muted small">aún no hay resultado para esa fecha</span>';
  if (ev.estado === 'invalido') return '<span class="badge p">NO EVALUABLE</span>';
  return `Resultado: ${UI.num3(ev.resultado)} → ${ev.directo ? `<span class="badge d">D-GANADOR #${ev.rank}</span>` : ''} ${ev.combinado ? `<span class="badge c">C-GANADOR</span>` : ''} ${!ev.acierto ? `<span class="badge p">sin acierto · mejor ${ev.mejorPos}/3 en posición</span>` : ''}`;
}

function exportPronosticosPDF(prons, titulo = 'Pronósticos') {
  const secs = [{ titulo: 'Aviso', texto: 'Los candidatos son resultado de modelos estadísticos sobre datos históricos. La probabilidad real de cada número en un sorteo justo es 1/1000. No constituyen garantía de premio.' }];
  for (const p of prons) {
    const ev = Hits.evaluate(p);
    secs.push({
      titulo: `Algoritmo ${p.algoritmo} – ${Algo.NOMBRES[p.algoritmo]}`,
      texto: `Lotería: ${Store.loteriaNombre(p.loteriaId)} · Sorteo objetivo: ${U.fmtDate(p.fechaObjetivo)} · Datos usados hasta: ${U.fmtDate(p.fechaCorte)} (${p.nHist} sorteos) · Generado: ${U.fmtDateTime(p.creado)}${ev.estado === 'evaluado' ? ` · Resultado real: ${ev.resultado} (${ev.directo ? 'D-GANADOR' : ev.combinado ? 'C-GANADOR' : 'sin acierto'})` : ''}`,
      tabla: { head: ['#', 'Número', 'Puntos', 'Explicación'], body: p.candidatos.map((c, i) => [i + 1, c.n, c.score.toFixed(1), c.razon || '']), colStyles: { 0: { cellWidth: 22 }, 1: { cellWidth: 46, fontStyle: 'bold' }, 2: { cellWidth: 40 } } },
    });
  }
  PDF.build(titulo, secs, `PERLA3_PRONOSTICOS_${U.stamp()}.pdf`);
}
function exportPronosticosXLS(prons) {
  const wb = XL.book();
  XLSX.utils.book_append_sheet(wb, XL.hojaPronosticos(prons), 'PRONOSTICOS');
  XL.save(wb, `PERLA3_PRONOSTICOS_${U.stamp()}.xlsx`);
}

/* ------------------------------ GENERAR ------------------------------ */
UI.views.generar = (el) => {
  if (!Store.loterias.length) { el.innerHTML = UI.needData(1, null); return; }
  if (GenV.loteriaId === null || !Store.loteria(GenV.loteriaId)) GenV.loteriaId = UI.ctxLoteria ?? Store.loterias[0].id;
  if (!GenV.fecha) GenV.fecha = nextDrawDate(GenV.loteriaId);
  if (!GenV.k) GenV.k = Store.config.cantidadDefecto;
  el.innerHTML = `
    <div class="card"><h2>✦ Generador de pronósticos</h2>
      <form id="gForm" class="toolbar">
        <label class="field grow">Lotería<select id="gLot">${UI.loteriaOptions(GenV.loteriaId, { todas: false })}</select></label>
        <label class="field">Fecha del sorteo a analizar<input type="date" id="gFecha" value="${GenV.fecha}"></label>
        <label class="field">Cantidad de candidatos<select id="gK">${Algo.CANTIDADES.map(k => `<option ${k === +GenV.k ? 'selected' : ''}>${k}</option>`).join('')}</select></label>
        <label class="field">Algoritmo<select id="gAlg"><option value="todos">Los tres algoritmos</option>${[1, 2, 3].map(a => `<option value="${a}" ${String(a) === String(GenV.alg) ? 'selected' : ''}>Algoritmo ${a} – ${Algo.NOMBRES[a]}</option>`).join('')}</select></label>
        <button class="btn gold big" type="submit">GENERAR PRONÓSTICOS</button>
      </form>
      <div class="small muted" id="gInfo"></div>
    </div>
    <div id="gOut"></div>`;
  const info = () => {
    const h = Algo.historyBefore(+UI.val('gLot'), UI.val('gFecha'));
    const r = Store.resultadoDe(+UI.val('gLot'), UI.val('gFecha'));
    document.getElementById('gInfo').innerHTML = `Se usarán <b>${h.length}</b> sorteos anteriores al ${U.fmtDate(UI.val('gFecha'))} (${Store.config.fuenteDatos === 'todas' ? 'de todas las loterías' : 'solo de esta lotería'}). Nunca se usan resultados de esa fecha ni posteriores.${r ? ` <span class="warn">Ese sorteo ya tiene resultado (${r.numero}): el pronóstico se evaluará como prueba retrospectiva.</span>` : ''}${h.length < Algo.MIN_HIST ? ' <span class="bad">Histórico insuficiente: se recomiendan al menos 30 sorteos.</span>' : ''}`;
  };
  document.getElementById('gLot').onchange = () => { GenV.loteriaId = +UI.val('gLot'); document.getElementById('gFecha').value = GenV.fecha = nextDrawDate(GenV.loteriaId); info(); };
  document.getElementById('gFecha').onchange = info;
  info();
  document.getElementById('gForm').onsubmit = (e) => {
    e.preventDefault();
    const f = UI.val('gFecha'); if (!U.isISO(f)) { UI.toast('Fecha inválida.', 'err'); return; }
    Object.assign(GenV, { loteriaId: +UI.val('gLot'), fecha: f, k: +UI.val('gK'), alg: UI.val('gAlg'), saved: false });
    const algs = GenV.alg === 'todos' ? [1, 2, 3] : [+GenV.alg];
    GenV.last = algs.map(a => Algo.generar({ alg: a, loteriaId: GenV.loteriaId, fechaObjetivo: f, k: GenV.k }));
    drawOut();
  };
  const drawOut = () => {
    const out = document.getElementById('gOut');
    if (!GenV.last) { out.innerHTML = ''; return; }
    const common = GenV.last.length > 1 ? GenV.last.map(p => new Set(p.candidatos.map(c => c.n))).reduce((a, b) => new Set([...a].filter(x => b.has(x)))) : new Set();
    out.innerHTML = `<div class="card no-print"><div class="toolbar" style="margin:0">
        <button class="btn green" id="gSave" ${GenV.saved ? 'disabled' : ''}>${GenV.saved ? '✔ Guardado' : 'Guardar pronóstico'}</button>
        <button class="btn" id="gXls">Exportar a Excel</button><button class="btn" id="gPdf">Exportar a PDF</button>
        <span class="small muted">Generado ${U.fmtDateTime(GenV.last[0].creado)} · ${GenV.last[0].nHist} sorteos analizados${common.size ? ` · <b>${common.size}</b> candidatos coinciden en los tres algoritmos: ${[...common].map(UI.num3).join(' ')}` : ''}</span></div></div>
      <div class="grid ${GenV.last.length > 1 ? 'g3' : ''}">${GenV.last.map(p => `<div class="card"><h2>${UI.algBadge(p.algoritmo)} ${Algo.NOMBRES[p.algoritmo]}</h2>
        <div class="small" style="margin-bottom:8px">${evalLine(p)}</div>${renderCands(p, { showWhy: true })}</div>`).join('')}</div>`;
    document.getElementById('gSave').onclick = async () => {
      await Store.savePronosticos(GenV.last.map(p => ({ ...p }))); GenV.saved = true;
      UI.toast(`${GenV.last.length} pronóstico(s) guardado(s) con fecha y hora.`); drawOut();
    };
    document.getElementById('gXls').onclick = () => { try { exportPronosticosXLS(GenV.last); } catch (err) { UI.toast(err.message, 'err'); } };
    document.getElementById('gPdf').onclick = () => exportPronosticosPDF(GenV.last);
  };
  drawOut();
};

/* ------------------------------ ALGORITMOS 1, 2, 3 ------------------------------ */
const ALG_DESC = {
  1: `<p><b>Frecuencia y tendencia.</b> Puntúa cada número 000–999 combinando: frecuencia de cada cifra en su posición (histórica y reciente, con suavizado de Laplace) 35%, parejas AB/BC/AC frecuentes 25%, tendencia reciente de las cifras (reciente − histórico) 15%, apariciones recientes del número 15% y apariciones históricas del número 10%.</p>`,
  2: `<p><b>Ciclos y ausencias.</b> Para cada cifra en cada posición calcula los intervalos entre apariciones dentro de la ventana y compara el tiempo actual sin salir con su intervalo típico (puntuación gaussiana: ni demasiado reciente ni excesivamente atrasado) 40%. Añade la distribución de paridad 12%, la suma de cifras 12%, el patrón de repetición 8%, la ausencia del número completo 13% (penaliza números muy recientes) y la afinidad con el día de la semana del sorteo 15%.</p>`,
  3: `<p><b>Modelo combinado ponderado.</b> Normaliza seis variables a una escala 0–1 y las combina con los pesos que usted defina: frecuencia del número, tendencia (frecuencia por posición con decaimiento exponencial), comportamiento de posiciones, parejas, ternas (frecuencia de la combinación sin orden) y ausencias (ciclos por posición).</p>`,
};
function algParamsForm(a) {
  const c = Store.config;
  if (a === 1) return `<label class="field">Ventana reciente (sorteos)<input type="number" id="pA1W" min="5" max="1000" value="${c.a1Ventana}"></label>`;
  if (a === 2) return `<label class="field">Ventana de ciclos (sorteos)<input type="number" id="pA2W" min="20" max="5000" value="${c.a2Ventana}"></label>`;
  const P = c.a3Pesos;
  return `<div class="grid g3" style="width:100%">${Object.keys(DEFAULT_CONFIG.a3Pesos).map(k => `<label class="field">${k[0].toUpperCase() + k.slice(1)}: <b id="w_${k}_v">${P[k]}</b><input type="range" min="0" max="100" step="5" id="w_${k}" value="${P[k]}"></label>`).join('')}</div>
    <label class="field">Ventana reciente<input type="number" id="pA3W" min="5" max="1000" value="${c.a3Ventana}"></label>
    <label class="field">Vida media tendencia (sorteos)<input type="number" id="pA3H" min="2" max="500" value="${c.a3VidaMedia}"></label>`;
}
async function saveAlgParams(a) {
  const clamp = (v, mn, mx, d) => { v = Math.round(+v); return isFinite(v) ? Math.min(mx, Math.max(mn, v)) : d; };
  if (a === 1) await Store.setConfig('a1Ventana', clamp(UI.val('pA1W'), 5, 1000, 30));
  if (a === 2) await Store.setConfig('a2Ventana', clamp(UI.val('pA2W'), 20, 5000, 120));
  if (a === 3) {
    const P = {}; for (const k of Object.keys(DEFAULT_CONFIG.a3Pesos)) P[k] = clamp(UI.val('w_' + k), 0, 100, 0);
    if (!Object.values(P).some(v => v > 0)) throw new Error('Al menos un peso debe ser mayor que cero.');
    await Store.setConfig('a3Pesos', P);
    await Store.setConfig('a3Ventana', clamp(UI.val('pA3W'), 5, 1000, 40));
    await Store.setConfig('a3VidaMedia', clamp(UI.val('pA3H'), 2, 500, 25));
  }
}
function algView(a) {
  return (el) => {
    const L = UI.ctxLoteria ?? Store.loterias[0]?.id ?? null;
    const s = Hits.summary({ algoritmo: a, loteriaId: UI.ctxLoteria }).per[a];
    const prons = Hits.filter({ algoritmo: a, loteriaId: UI.ctxLoteria }).sort((x, y) => (x.fechaObjetivo < y.fechaObjetivo ? 1 : x.fechaObjetivo > y.fechaObjetivo ? -1 : y.id - x.id));
    const manual = prons.filter(p => p.origen === 'manual');
    el.innerHTML = `
      <div class="card"><h2>${UI.algBadge(a)} Algoritmo ${a} – ${Algo.NOMBRES[a]}</h2>${ALG_DESC[a]}
        <div class="note">Trabaja de forma independiente: solo usa resultados anteriores a la fecha del sorteo y no consulta la salida de los otros algoritmos. La puntuación (0–100) es relativa entre los 1000 números; no es una probabilidad.</div></div>
      <div class="card"><h2>Parámetros</h2><div class="toolbar">${algParamsForm(a)}</div>
        <button class="btn gold" id="pSave">Guardar parámetros</button> <button class="btn ghost" id="pReset">Valores por defecto</button></div>
      <div class="kpis">
        <div class="kpi"><div class="l">Pronósticos</div><div class="v">${s.pronosticos}</div><div class="s">${manual.length} manuales</div></div>
        <div class="kpi blue"><div class="l">Evaluados</div><div class="v">${s.evaluados}</div><div class="s">${s.pendientes} pendientes</div></div>
        <div class="kpi green"><div class="l">D / C</div><div class="v">${s.D} / ${s.C}</div><div class="s">${U.pct(s.conAcierto, s.evaluados, 2)} con acierto</div></div>
        <div class="kpi"><div class="l">Índice vs azar</div><div class="v">${s.indice === null ? '—' : s.indice.toFixed(2) + '×'}</div><div class="s">esperado ${(s.eD + s.eC).toFixed(2)} aciertos</div></div>
      </div>
      <div class="card"><h2>Pronóstico rápido</h2>
        ${L ? `<div class="toolbar"><span class="small">Lotería: <b>${U.esc(Store.loteriaNombre(L))}</b> · Sorteo: <b>${U.fmtDate(nextDrawDate(L))}</b></span>
          <label class="field">Candidatos<select id="qK">${Algo.CANTIDADES.map(k => `<option ${k === Store.config.cantidadDefecto ? 'selected' : ''}>${k}</option>`).join('')}</select></label>
          <button class="btn gold" id="qGo">Generar con Algoritmo ${a}</button></div><div id="qOut"></div>` : UI.needData(1, null)}
      </div>
      <div class="card"><h2>Pronósticos guardados (${prons.length})</h2>
        ${UI.table(['Sorteo', 'Lotería', 'Origen', 'Generado', { t: 'Cand.', c: 'r' }, 'Top 5', 'Evaluación', ''], prons.slice(0, 60).map(p => `<tr><td>${U.fmtDate(p.fechaObjetivo)}</td><td>${U.esc(Store.loteriaNombre(p.loteriaId))}</td><td>${(p.origen === 'manual' ? 'manual' : `<span class="muted">${U.origenTxt(p.origen, true)}</span>`)}</td><td class="small">${U.fmtDateTime(p.creado)}</td><td class="r">${p.candidatos.length}</td>
          <td>${p.candidatos.slice(0, 5).map(c => `<span class="n3" style="font-size:12px">${c.n}</span>`).join(' ')}</td><td class="small">${evalLine(p)}</td>
          <td><button class="btn sm" data-ver="${p.id}">Ver</button> <button class="btn sm danger" data-del="${p.id}">✕</button></td></tr>`))}
        ${prons.length > 60 ? `<div class="small muted">Se muestran 60 de ${prons.length}. Exporte a Excel para ver todos.</div>` : ''}
      </div>`;
    document.getElementById('pSave').onclick = async () => { try { await saveAlgParams(a); UI.toast('Parámetros guardados.'); UI.render(); } catch (err) { UI.toast(err.message, 'err'); } };
    document.getElementById('pReset').onclick = async () => {
      if (a === 1) await Store.setConfig('a1Ventana', DEFAULT_CONFIG.a1Ventana);
      if (a === 2) await Store.setConfig('a2Ventana', DEFAULT_CONFIG.a2Ventana);
      if (a === 3) { await Store.setConfig('a3Pesos', { ...DEFAULT_CONFIG.a3Pesos }); await Store.setConfig('a3Ventana', DEFAULT_CONFIG.a3Ventana); await Store.setConfig('a3VidaMedia', DEFAULT_CONFIG.a3VidaMedia); }
      UI.toast('Parámetros restablecidos.'); UI.render();
    };
    if (a === 3) Object.keys(DEFAULT_CONFIG.a3Pesos).forEach(k => { const r = document.getElementById('w_' + k); r.oninput = () => document.getElementById('w_' + k + '_v').textContent = r.value; });
    const q = document.getElementById('qGo');
    if (q) q.onclick = async () => {
      const p = Algo.generar({ alg: a, loteriaId: L, fechaObjetivo: nextDrawDate(L), k: +UI.val('qK') });
      const box = document.getElementById('qOut');
      box.innerHTML = `<div class="toolbar"><button class="btn green" id="qSave">Guardar</button><button class="btn" id="qX">Excel</button><button class="btn" id="qP">PDF</button><span class="small muted">${p.nHist} sorteos analizados</span></div>${renderCands(p)}`;
      document.getElementById('qSave').onclick = async (e) => { await Store.savePronosticos([p]); e.target.disabled = true; e.target.textContent = '✔ Guardado'; UI.toast('Pronóstico guardado.'); };
      document.getElementById('qX').onclick = () => { try { exportPronosticosXLS([p]); } catch (err) { UI.toast(err.message, 'err'); } };
      document.getElementById('qP').onclick = () => exportPronosticosPDF([p]);
    };
    UI.$$('[data-ver]', el).forEach(b => b.onclick = () => { const p = Store.pronosticos.find(x => x.id === +b.dataset.ver); UI.modal({ title: `Algoritmo ${p.algoritmo} · ${Store.loteriaNombre(p.loteriaId)} · ${U.fmtDate(p.fechaObjetivo)}`, wide: true, body: `<p class="small">${evalLine(p)}<br>Datos hasta ${U.fmtDate(p.fechaCorte)} (${p.nHist} sorteos) · parámetros: ${U.esc(JSON.stringify(p.params))}</p>${renderCands(p)}`, buttons: [{ t: 'PDF', action: () => exportPronosticosPDF([p]) }, { t: 'Cerrar', cls: 'gold' }] }); });
    UI.$$('[data-del]', el).forEach(b => b.onclick = async () => { if (await UI.confirm('¿Eliminar este pronóstico?', { danger: true, ok: 'Eliminar' })) { await Store.deletePronosticos([+b.dataset.del]); UI.toast('Pronóstico eliminado.'); UI.render(); } });
  };
}
UI.views.alg1 = algView(1); UI.views.alg2 = algView(2); UI.views.alg3 = algView(3);

/* ------------------------------ CONTROL DE ACIERTOS ------------------------------ */
const AcV = { desde: '', hasta: '', origen: 'todos', btDesde: '', btHasta: '', running: null };
UI.views.aciertos = (el) => {
  const L = UI.ctxLoteria;
  const f = { loteriaId: L, desde: AcV.desde, hasta: AcV.hasta, origen: AcV.origen };
  const { per, lista } = Hits.summary(f);
  const tot = k => [1, 2, 3].reduce((s, a) => s + per[a][k], 0);
  const lotId = L ?? Store.loterias[0]?.id;
  const meses = [...new Set([1, 2, 3].flatMap(a => Object.keys(per[a].porMes)))].sort();
  el.innerHTML = `
    <div class="card"><h2>Reglas vigentes</h2><div class="small">
      <b>D-GANADOR</b> (directo): el resultado coincide con un candidato en las tres cifras y su orden.
      <b>C-GANADOR</b> (combinado): el resultado tiene las mismas tres cifras que un candidato en otro orden${Store.config.combinadoIncluyeDirecto ? '; un acierto directo también se cuenta como combinado' : '; si hubo acierto directo no se cuenta además como combinado'}${Store.config.combinadoConRepetidas ? '' : '; los resultados con cifras repetidas no participan en el combinado'}.
      Solo se evalúan pronósticos generados con datos anteriores al sorteo. <a href="#config">Cambiar reglas</a>.</div></div>
    <div class="card no-print"><div class="toolbar" style="margin:0">
      <div class="field"><span>Lotería</span><b>${L ? U.esc(Store.loteriaNombre(L)) : 'Todas'}</b></div>${UI.periodFields('ac', AcV)}
      <label class="field">Origen<select id="acO"><option value="todos">Todos</option><option value="manual" ${AcV.origen === 'manual' ? 'selected' : ''}>Manuales</option><option value="auto" ${AcV.origen === 'auto' ? 'selected' : ''}>Automáticos</option><option value="backtest" ${AcV.origen === 'backtest' ? 'selected' : ''}>Prueba histórica</option></select></label>
      <button class="btn" id="acX">Exportar aciertos (Excel)</button></div></div>
    <div class="kpis">
      <div class="kpi"><div class="l">Pronósticos</div><div class="v">${tot('pronosticos')}</div><div class="s">${tot('evaluados')} evaluados · ${tot('pendientes')} pendientes</div></div>
      <div class="kpi blue"><div class="l">Candidatos generados</div><div class="v">${U.fmt(tot('candidatos'))}</div></div>
      <div class="kpi green"><div class="l">Aciertos directos</div><div class="v">${tot('D')}</div><div class="s">esperado por azar ${tot('eD').toFixed(2)}</div></div>
      <div class="kpi green"><div class="l">Aciertos combinados</div><div class="v">${tot('C')}</div><div class="s">esperado por azar ${tot('eC').toFixed(2)}</div></div>
      <div class="kpi"><div class="l">% con acierto</div><div class="v">${U.pct(tot('conAcierto'), tot('evaluados'), 2)}</div></div>
    </div>
    <div class="card"><h2>Prueba histórica cronológica</h2>
      <div class="sub">Recorre los sorteos registrados en orden y, para cada uno, ejecuta los algoritmos usando <b>solo</b> los resultados anteriores a esa fecha. Así se mide el rendimiento sin información futura.</div>
      ${lotId ? `<div class="toolbar"><label class="field">Lotería<select id="btL">${UI.loteriaOptions(lotId, { todas: false })}</select></label>${UI.periodFields('bt', { desde: AcV.btDesde, hasta: AcV.btHasta })}
        <label class="field">Candidatos por sorteo<select id="btK">${Algo.CANTIDADES.map(k => `<option ${k === Store.config.btCantidad ? 'selected' : ''}>${k}</option>`).join('')}</select></label>
        <label class="field">Mín. sorteos previos<input type="number" id="btM" min="${Algo.MIN_HIST}" max="2000" value="${Store.config.btMinHist}" style="width:90px"></label>
        <label class="field"><span><input type="checkbox" id="bt1" checked> A1 <input type="checkbox" id="bt2" checked> A2 <input type="checkbox" id="bt3" checked> A3</span></label>
        <button class="btn gold" id="btGo">Ejecutar prueba histórica</button><button class="btn danger" id="btDel">Borrar pruebas de esta lotería</button></div>
        <div class="progress" id="btBar" hidden><i></i></div><div class="small muted" id="btMsg"></div>` : UI.needData(1, null)}
    </div>
    <div class="card"><h2>Aciertos por algoritmo</h2>
      ${UI.table(['Algoritmo', { t: 'Pronósticos', c: 'r' }, { t: 'Evaluados', c: 'r' }, { t: 'D', c: 'r' }, { t: 'C', c: 'r' }, { t: '% acierto', c: 'r' }, { t: 'Esperado azar', c: 'r' }, { t: 'Racha máx. sin acierto', c: 'r' }, { t: 'Racha actual sin acierto', c: 'r' }, { t: 'Racha máx. con acierto', c: 'r' }, 'Último acierto'],
        [1, 2, 3].map(a => { const s = per[a]; return `<tr><td>${UI.algBadge(a)} ${Algo.NOMBRES[a]}</td><td class="r">${s.pronosticos}</td><td class="r">${s.evaluados}</td><td class="r"><b>${s.D}</b></td><td class="r"><b>${s.C}</b></td><td class="r">${U.pct(s.conAcierto, s.evaluados, 2)}</td><td class="r muted">${(s.eD + s.eC).toFixed(2)}</td><td class="r">${s.maxSin}</td><td class="r">${s.actualSin}</td><td class="r">${s.maxCon}</td><td>${s.ultimo ? U.fmtDate(s.ultimo) + ' (' + s.ultimoTipo + ')' : '—'}</td></tr>`; }))}
    </div>
    <div class="grid g2">
      <div class="card"><h2>Resultados por lotería</h2>${UI.table(['Lotería', 'Algoritmo', { t: 'Evaluados', c: 'r' }, { t: 'D', c: 'r' }, { t: 'C', c: 'r' }, { t: '%', c: 'r' }],
        [1, 2, 3].flatMap(a => Object.entries(per[a].porLoteria).map(([lid, v]) => `<tr><td>${U.esc(Store.loteriaNombre(+lid))}</td><td>${UI.algBadge(a)}</td><td class="r">${v.ev}</td><td class="r">${v.D}</td><td class="r">${v.C}</td><td class="r">${U.pct(v.D + v.C, v.ev, 2)}</td></tr>`)))}</div>
      <div class="card"><h2>Aciertos por periodo (mensual)</h2><div class="chart-box"><canvas id="chMesAc"></canvas></div></div>
    </div>
    <div class="card"><h2>Historial de aciertos (${lista.length})</h2>
      ${UI.table(['Fecha', 'Lotería', 'Algoritmo', 'Tipo', 'Resultado', 'Candidato', { t: 'Posición en lista', c: 'r' }, 'Origen'], lista.slice(0, 200).map(({ p, ev }) => `<tr><td>${U.fmtDate(p.fechaObjetivo)}</td><td>${U.esc(Store.loteriaNombre(p.loteriaId))}</td><td>${UI.algBadge(p.algoritmo)}</td><td>${ev.directo ? '<span class="badge d">D-GANADOR</span>' : '<span class="badge c">C-GANADOR</span>'}</td><td>${UI.num3(ev.resultado)}</td><td>${UI.num3(ev.directo ? ev.resultado : p.candidatos[ev.rankC - 1].n)}</td><td class="r">${ev.directo ? ev.rank : ev.rankC} de ${p.candidatos.length}</td><td class="small">${U.origenTxt(p.origen, true)}</td></tr>`))}
    </div>`;
  ['acDesde', 'acHasta', 'acO'].forEach(id => document.getElementById(id).onchange = () => { AcV.desde = UI.val('acDesde'); AcV.hasta = UI.val('acHasta'); AcV.origen = UI.val('acO'); UI.render(); });
  document.getElementById('acX').onclick = () => { try { const wb = XL.book(); XLSX.utils.book_append_sheet(wb, XL.hojaAciertos(f), 'ACIERTOS'); XLSX.utils.book_append_sheet(wb, XL.hojaComparativo(f), 'COMPARATIVO'); XL.save(wb, `PERLA3_ACIERTOS_${U.stamp()}.xlsx`); } catch (err) { UI.toast(err.message, 'err'); } };
  UI.chart('chMesAc', { type: 'bar', data: { labels: meses.map(k => U.MESES[+k.slice(5) - 1] + ' ' + k.slice(2, 4)), datasets: [1, 2, 3].map(a => ({ label: 'A' + a + ' (D+C)', data: meses.map(m => (per[a].porMes[m]?.D || 0) + (per[a].porMes[m]?.C || 0)), backgroundColor: ALG_COLOR[a], borderColor: '#131f33', borderWidth: 1 })) }, options: { scales: { y: { ticks: { precision: 0 } } } } });
  const go = document.getElementById('btGo');
  if (go) {
    go.onclick = async () => {
      if (AcV.running) { AcV.running.v = true; return; }
      const algs = [1, 2, 3].filter(a => document.getElementById('bt' + a).checked);
      if (!algs.length) { UI.toast('Seleccione al menos un algoritmo.', 'err'); return; }
      const k = +UI.val('btK'), minHist = Math.max(Algo.MIN_HIST, +UI.val('btM') || 30), lid = +UI.val('btL');
      AcV.btDesde = UI.val('btDesde'); AcV.btHasta = UI.val('btHasta');
      const bar = document.getElementById('btBar'), msg = document.getElementById('btMsg');
      bar.hidden = false; go.textContent = 'Cancelar'; AcV.running = { v: false };
      try {
        await Store.setConfig('btCantidad', k); await Store.setConfig('btMinHist', minHist);
        // Los elementos pueden desaparecer si el usuario cambia de pantalla: la prueba continúa igualmente.
        const r = await Algo.backtest({ loteriaId: lid, desde: AcV.btDesde, hasta: AcV.btHasta, algs, k, minHist, cancel: AcV.running, onProgress: (x, i, n) => { if (bar.isConnected) { bar.firstElementChild.style.width = (x * 100).toFixed(1) + '%'; msg.textContent = `Procesando sorteo ${i} de ${n}…`; } } });
        UI.toast(`Prueba histórica ${r.cancelado ? 'cancelada' : 'terminada'}: ${r.generados} pronósticos generados (${r.omitidos} sorteos sin histórico suficiente).`, r.cancelado ? 'warn' : 'ok', 7000);
      } catch (err) { UI.toast(err.message, 'err'); }
      AcV.running = null; if (UI.current === 'aciertos') UI.render();
    };
    document.getElementById('btDel').onclick = async () => {
      const lid = +UI.val('btL'); const ids = Store.pronosticos.filter(p => p.origen === 'backtest' && p.loteriaId === lid).map(p => p.id);
      if (!ids.length) { UI.toast('No hay pruebas históricas para esta lotería.', 'warn'); return; }
      if (!await UI.confirm(`¿Borrar ${ids.length} pronósticos de prueba histórica de ${U.esc(Store.loteriaNombre(lid))}? Los pronósticos manuales no se tocan.`, { danger: true, ok: 'Borrar' })) return;
      await Store.deletePronosticos(ids); UI.toast('Pruebas históricas borradas.'); UI.render();
    };
  }
};

/* ------------------------------ COMPARADOR ------------------------------ */
const CmpV = { desde: '', hasta: '', origen: 'todos', loteriaId: undefined };
UI.views.comparador = (el) => {
  if (CmpV.loteriaId === undefined) CmpV.loteriaId = UI.ctxLoteria;
  const f = { loteriaId: CmpV.loteriaId, desde: CmpV.desde, hasta: CmpV.hasta, origen: CmpV.origen };
  const { per } = Hits.summary(f);
  const anyEval = [1, 2, 3].some(a => per[a].evaluados);
  el.innerHTML = `
    <div class="card no-print"><div class="toolbar" style="margin:0">
      <label class="field">Lotería<select id="cmL">${UI.loteriaOptions(CmpV.loteriaId)}</select></label>${UI.periodFields('cm', CmpV)}
      <label class="field">Origen<select id="cmO"><option value="todos">Todos</option><option value="manual" ${CmpV.origen === 'manual' ? 'selected' : ''}>Manuales</option><option value="auto" ${CmpV.origen === 'auto' ? 'selected' : ''}>Automáticos</option><option value="backtest" ${CmpV.origen === 'backtest' ? 'selected' : ''}>Prueba histórica</option></select></label>
      <button class="btn" id="cmX">Exportar comparativo (Excel)</button></div></div>
    ${anyEval ? '' : `<div class="note warn">Aún no hay pronósticos evaluados con estos filtros. Ejecute una <a href="#aciertos">prueba histórica cronológica</a> o guarde pronósticos y registre luego los resultados.</div>`}
    <div class="card"><h2>Comparativo de rendimiento</h2>
      ${UI.table(['Algoritmo', { t: 'Pronósticos evaluados', c: 'r' }, { t: 'Candidatos generados', c: 'r' }, { t: 'Aciertos directos', c: 'r' }, { t: 'Aciertos combinados', c: 'r' }, { t: '% de aciertos', c: 'r' }, { t: 'Esperado por azar (D+C)', c: 'r' }, { t: 'Rendimiento vs azar', c: 'r' }, { t: 'Prob. de lograrlo por azar', c: 'r' }, 'Último acierto'],
        [1, 2, 3].map(a => { const s = per[a]; return `<tr><td>${UI.algBadge(a)} ${Algo.NOMBRES[a]}</td><td class="r">${s.evaluados}</td><td class="r">${U.fmt(s.candidatos)}</td><td class="r"><b>${s.D}</b></td><td class="r"><b>${s.C}</b></td><td class="r">${U.pct(s.conAcierto, s.evaluados, 2)}</td><td class="r muted">${(s.eD + s.eC).toFixed(2)}</td><td class="r ${s.indice > 1 ? 'ok' : s.indice !== null ? 'bad' : ''}">${s.indice === null ? '—' : s.indice.toFixed(2) + '×'}</td><td class="r">${s.evaluados ? (s.pAzar * 100).toFixed(1) + '%' : '—'}</td><td>${s.ultimo ? U.fmtDate(s.ultimo) + ' (' + s.ultimoTipo + ')' : '—'}</td></tr>`; }))}
      <div class="small muted" style="margin-top:6px">«Rendimiento vs azar» = aciertos obtenidos ÷ aciertos esperados si los candidatos se eligieran al azar (1,00× = igual que el azar). «Prob. de lograrlo por azar» = probabilidad de obtener al menos esos aciertos eligiendo al azar; valores altos indican que el resultado es consistente con la suerte.</div>
    </div>
    <div class="grid g2">
      <div class="card"><h2>Aciertos directos y combinados</h2><div class="chart-box"><canvas id="cmBar"></canvas></div></div>
      <div class="card"><h2>Mejor coincidencia posicional por pronóstico</h2><div class="chart-box"><canvas id="cmPos"></canvas></div><div class="small muted">Porcentaje de pronósticos cuya mejor coincidencia de cifras en su posición fue 0, 1, 2 o 3.</div></div>
    </div>
    <div class="card"><h2>Rendimiento histórico acumulado (D + C) frente al azar</h2><div class="chart-box tall"><canvas id="cmLine"></canvas></div><div class="small muted">Líneas continuas: aciertos acumulados de cada algoritmo. Líneas punteadas: aciertos acumulados esperados por azar.</div></div>`;
  ['cmL', 'cmDesde', 'cmHasta', 'cmO'].forEach(id => document.getElementById(id).onchange = () => { CmpV.loteriaId = UI.lotVal('cmL'); CmpV.desde = UI.val('cmDesde'); CmpV.hasta = UI.val('cmHasta'); CmpV.origen = UI.val('cmO'); UI.render(); });
  document.getElementById('cmX').onclick = () => { try { const wb = XL.book(); XLSX.utils.book_append_sheet(wb, XL.hojaComparativo(f), 'COMPARATIVO'); XL.save(wb, `PERLA3_COMPARATIVO_${U.stamp()}.xlsx`); } catch (err) { UI.toast(err.message, 'err'); } };
  const labels = [1, 2, 3].map(a => 'A' + a + ' ' + Algo.NOMBRES[a]);
  UI.chart('cmBar', { type: 'bar', data: { labels, datasets: [
    { label: 'Directos', data: [1, 2, 3].map(a => per[a].D), backgroundColor: COLORS.green, borderColor: '#131f33', borderWidth: 1 },
    { label: 'Combinados', data: [1, 2, 3].map(a => per[a].C), backgroundColor: COLORS.gold, borderColor: '#131f33', borderWidth: 1 },
    { label: 'Esperado azar (D+C)', data: [1, 2, 3].map(a => +(per[a].eD + per[a].eC).toFixed(2)), backgroundColor: 'rgba(229,88,107,.45)', borderColor: COLORS.ref, borderWidth: 1 }] }, options: { scales: { y: { ticks: { precision: 0 } } } } });
  UI.chart('cmPos', { type: 'bar', data: { labels: ['0/3', '1/3', '2/3', '3/3'], datasets: [1, 2, 3].map(a => ({ label: 'A' + a, data: per[a].mejorPos.map(c => per[a].evaluados ? +(100 * c / per[a].evaluados).toFixed(1) : 0), backgroundColor: ALG_COLOR[a], borderColor: '#131f33', borderWidth: 1 })) } });
  const fechas = [...new Set([1, 2, 3].flatMap(a => per[a].serie.map(x => x.fecha)))].sort();
  const serieAt = (a, key) => { let j = 0, v = 0; const s = per[a].serie; return fechas.map(fe => { while (j < s.length && s[j].fecha <= fe) { v = key === 'obs' ? s[j].D + s[j].C : s[j].eD + s[j].eC; j++; } return +v.toFixed(3); }); };
  UI.chart('cmLine', { type: 'line', data: { labels: fechas.map(U.fmtDate), datasets: [1, 2, 3].flatMap(a => [
    { label: 'A' + a + ' real', data: serieAt(a, 'obs'), borderColor: ALG_COLOR[a], stepped: true, tension: 0 },
    { label: 'A' + a + ' azar', data: serieAt(a, 'exp'), borderColor: ALG_COLOR[a], borderDash: [4, 4], borderWidth: 1.2 }]) }, options: { scales: { x: { ticks: { maxTicksLimit: 10 } } } } });
};
