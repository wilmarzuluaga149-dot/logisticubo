/* =====================================================================
   VISTAS: Estadísticas · Análisis de cifras
   ===================================================================== */
const StatV = { tab: 'frecuencia', desde: '', hasta: '', pairSel: 'AB' };

function heatColor(t) { // secuencial de un solo tono (dorado): oscuro = poco, brillante = mucho
  const a = [22, 35, 58], b = [233, 196, 92];
  const m = Math.max(0, Math.min(1, t));
  return `rgb(${a.map((x, i) => Math.round(x + (b[i] - x) * m)).join(',')})`;
}
function chiTxt(r) {
  if (!r.n) return '';
  const sig = r.p < 0.05;
  return `<div class="small ${sig ? 'warn' : 'muted'}">Prueba χ² de uniformidad: χ²=${r.chi.toFixed(2)}, gl=${r.df}, p=${r.p < 0.0001 ? '<0.0001' : r.p.toFixed(4)} → ${sig ? 'desviación estadísticamente significativa (5%) respecto a un sorteo uniforme.' : 'compatible con un sorteo uniforme (las diferencias se explican por azar).'}</div>`;
}

UI.views.estadisticas = (el) => {
  const L = UI.ctxLoteria;
  const st = Stats.get(L, StatV.desde, StatV.hasta);
  const tabs = [['frecuencia', 'Frecuencia 000–999'], ['posiciones', 'Cifras A · B · C'], ['parejas', 'Parejas'], ['ternas', 'Ternas'], ['repeticiones', 'Repeticiones y cambios'], ['paridad', 'Pares/impares y rangos'], ['periodos', 'Periodos y comparación']];
  el.innerHTML = `
    <div class="card no-print"><div class="toolbar" style="margin:0">
      <div class="field"><span>Lotería</span><b>${L ? U.esc(Store.loteriaNombre(L)) : 'Todas (cambie en "Lotería activa")'}</b></div>
      ${UI.periodFields('s', StatV)}
      <button class="btn ghost" id="sClr">Todo el histórico</button>
      <button class="btn" id="sXls">Exportar estadísticas (Excel)</button>
    </div></div>
    ${UI.needData(1, L)}
    <div class="note"><b>Cómo leer estas cifras.</b> <i>Frecuencia histórica</i> = cuántas veces salió algo en el pasado. <i>Ausencia</i> = sorteos transcurridos desde su última aparición. <i>Probabilidad teórica</i> = la probabilidad real en un sorteo justo: 1/1000 (0,1%) por número y 1/10 por cifra en cada posición, <b>siempre igual</b>. Un número atrasado <b>no</b> tiene más posibilidades de salir.</div>
    <div class="kpis">
      <div class="kpi"><div class="l">Sorteos analizados</div><div class="v">${U.fmt(st.n)}</div><div class="s">${st.n ? U.fmtDate(st.rows[0].fecha) + ' → ' + U.fmtDate(st.rows[st.n - 1].fecha) : ''}</div></div>
      <div class="kpi blue"><div class="l">Números distintos</div><div class="v">${st.freq.filter(x => x).length}</div><div class="s">de 1000 posibles</div></div>
      <div class="kpi"><div class="l">Frecuencia esperada</div><div class="v">${(st.n / 1000).toFixed(2)}</div><div class="s">por número (n/1000)</div></div>
      <div class="kpi green"><div class="l">Probabilidad teórica</div><div class="v">0,1%</div><div class="s">por número y sorteo</div></div>
    </div>
    <div class="tabs" role="tablist">${tabs.map(([k, t]) => `<button role="tab" data-tab="${k}" class="${StatV.tab === k ? 'active' : ''}">${t}</button>`).join('')}</div>
    <div id="sBody"></div>`;
  UI.$$('[data-tab]', el).forEach(b => b.onclick = () => { StatV.tab = b.dataset.tab; UI.render(); });
  ['sDesde', 'sHasta'].forEach(id => document.getElementById(id).onchange = () => { StatV.desde = UI.val('sDesde'); StatV.hasta = UI.val('sHasta'); UI.render(); });
  document.getElementById('sClr').onclick = () => { StatV.desde = StatV.hasta = ''; UI.render(); };
  document.getElementById('sXls').onclick = () => {
    try { const wb = XL.book(); XLSX.utils.book_append_sheet(wb, XL.hojaEstadisticas(st), 'ESTADISTICAS'); XL.save(wb, `PERLA3_ESTADISTICAS_${L ? U.slug(Store.loteriaNombre(L)) : 'TODAS'}_${U.stamp()}.xlsx`); }
    catch (err) { UI.toast(err.message, 'err'); }
  };
  StatTabs[StatV.tab](document.getElementById('sBody'), st);
};

const StatTabs = {
  frecuencia(box, st) {
    const max = Math.max(1, ...st.freq);
    const top = Stats.topN(st.freq, 20, true, o => o.v > 0);
    const low = Stats.topN(st.freq, 20, false);
    const aus = st.gap.map((g, i) => ({ i, v: g === null ? Infinity : g })).sort((a, b) => b.v - a.v || a.i - b.i);
    const nunca = aus.filter(x => x.v === Infinity).length;
    const fr = (o) => `<tr><td>${UI.num3(U.pad3(o.i))}</td><td class="r">${st.freq[o.i]}</td><td class="r">${U.pct(st.freq[o.i], st.n, 2)}</td><td class="r muted">0,10%</td><td class="r">${st.gap[o.i] === null ? 'nunca' : st.gap[o.i]}</td></tr>`;
    const head = ['Número', { t: 'Frecuencia', c: 'r' }, { t: '% hist.', c: 'r' }, { t: 'Teórico', c: 'r' }, { t: 'Sin salir', c: 'r' }];
    box.innerHTML = `
      <div class="card"><h2>Mapa de calor 000–999</h2><div class="sub">Cada celda es un número (filas de 40). Más brillante = más frecuente. Pase el cursor para ver el detalle.</div>
        <div class="heat" id="heat">${st.freq.map((f, i) => `<div style="background:${f ? heatColor(f / max) : '#101a2b'}" title="${U.pad3(i)}: ${f} veces${st.gap[i] === null ? ' · nunca' : ' · hace ' + st.gap[i] + ' sorteos'}"></div>`).join('')}</div>
        <div class="legend-row"><span><span class="sw" style="background:#101a2b"></span>0</span><span><span class="sw" style="background:${heatColor(0.33)}"></span>bajo</span><span><span class="sw" style="background:${heatColor(0.66)}"></span>medio</span><span><span class="sw" style="background:${heatColor(1)}"></span>máximo (${max})</span></div>
      </div>
      <div class="grid g3">
        <div class="card"><h2>Más frecuentes</h2>${UI.table(head, top.map(fr))}</div>
        <div class="card"><h2>Menos frecuentes</h2>${UI.table(head, low.map(fr))}</div>
        <div class="card"><h2>Más tiempo sin aparecer</h2><div class="sub">${nunca} números nunca han salido en este periodo.</div>${UI.table(head, aus.filter(x => x.v !== Infinity).slice(0, 20).map(fr))}</div>
      </div>
      <div class="card"><h2>Distribución de frecuencias</h2><div class="chart-box"><canvas id="chFD"></canvas></div><div class="small muted">Cuántos números salieron 0, 1, 2… veces, comparado con lo esperado por azar (distribución de Poisson con media n/1000).</div></div>`;
    const maxF = Math.max(...st.freq), lam = st.n / 1000;
    const obs = new Array(maxF + 1).fill(0); st.freq.forEach(f => obs[f]++);
    let t = Math.exp(-lam); const exp = obs.map((_, k) => { if (k > 0) t *= lam / k; return +(1000 * t).toFixed(1); });
    UI.chart('chFD', { type: 'bar', data: { labels: obs.map((_, i) => i), datasets: [{ label: 'Números observados', data: obs, backgroundColor: COLORS.gold }, { type: 'line', label: 'Esperado por azar', data: exp, borderColor: COLORS.ref, borderDash: [5, 4], pointRadius: 3 }] }, options: { scales: { x: { title: { display: true, text: 'Veces que salió' } }, y: { title: { display: true, text: 'Cantidad de números' } } } } });
  },
  posiciones(box, st) {
    box.innerHTML = `<div class="grid g3">${[0, 1, 2].map(p => `<div class="card"><h2>Posición ${Stats.POS[p]} ${p === 0 ? '(centenas)' : p === 1 ? '(decenas)' : '(unidades)'}</h2>
      <div class="chart-box"><canvas id="chP${p}"></canvas></div>${chiTxt(MathX.chiUniform(st.pos[p]))}
      ${UI.table(['Cifra', { t: 'Veces', c: 'r' }, { t: '%', c: 'r' }, { t: 'Desv.', c: 'r' }, { t: 'Sin salir', c: 'r' }], st.pos[p].map((c, d) => { const dv = st.n ? 100 * c / st.n - 10 : 0; return `<tr><td><span class="dg">${d}</span></td><td class="r">${c}</td><td class="r">${U.pct(c, st.n)}</td><td class="r ${dv > 0 ? 'ok' : 'bad'}">${dv > 0 ? '+' : ''}${dv.toFixed(1)}</td><td class="r">${st.posGap[p][d] ?? 'nunca'}</td></tr>`; }))}</div>`).join('')}</div>`;
    [0, 1, 2].forEach(p => UI.chart('chP' + p, { type: 'bar', data: { labels: [...'0123456789'], datasets: [{ label: '% posición ' + Stats.POS[p], data: st.pos[p].map(c => st.n ? +(100 * c / st.n).toFixed(2) : 0), backgroundColor: [COLORS.a1, COLORS.a2, COLORS.a3][p] }, UI.refLine('Teórico 10%', 10, 10)] }, options: { plugins: { legend: { display: false } } } }));
  },
  parejas(box, st) {
    const sel = StatV.pairSel, arr = st.pairs[sel], max = Math.max(1, ...arr);
    const lab = { AB: ['A', 'B'], BC: ['B', 'C'], AC: ['A', 'C'] }[sel];
    box.innerHTML = `<div class="card"><h2>Parejas de cifras</h2>
      <div class="toolbar"><label class="field">Pareja<select id="pairSel">${['AB', 'BC', 'AC'].map(k => `<option ${k === sel ? 'selected' : ''} value="${k}">${k} (${k === 'AB' ? 'centenas-decenas' : k === 'BC' ? 'decenas-unidades' : 'centenas-unidades'})</option>`).join('')}</select></label></div>
      <div class="grid g2"><div><div class="sub">Filas: cifra ${lab[0]} · Columnas: cifra ${lab[1]} · Valor teórico por pareja: 1% (${(st.n / 100).toFixed(1)} veces)</div>
      <div class="heat10"><div class="h"></div>${[...'0123456789'].map(d => `<div class="h">${d}</div>`).join('')}
      ${Array.from({ length: 10 }, (_, a) => `<div class="h">${a}</div>` + Array.from({ length: 10 }, (_, b) => { const v = arr[a * 10 + b]; const t = v / max; return `<div style="background:${heatColor(t)};color:${t > 0.55 ? '#1d1600' : '#e6ecf5'}" title="${lab[0]}=${a}, ${lab[1]}=${b}: ${v} veces">${v}</div>`; }).join('')).join('')}</div>
      ${chiTxt(MathX.chiUniform(arr))}</div>
      <div>${UI.table(['Pareja', { t: 'Veces', c: 'r' }, { t: '%', c: 'r' }, { t: 'Teórico', c: 'r' }], Stats.topN(arr, 15).map(o => `<tr><td><span class="n3">${String(o.i).padStart(2, '0')}</span></td><td class="r">${o.v}</td><td class="r">${U.pct(o.v, st.n, 2)}</td><td class="r muted">1,00%</td></tr>`))}</div></div></div>`;
    document.getElementById('pairSel').onchange = (e) => { StatV.pairSel = e.target.value; StatTabs.parejas(box, st); };
  },
  ternas(box, st) {
    const list = [...st.ternas.entries()].map(([k, v]) => ({ k, v, teo: U.nPerms(k) / 1000 })).sort((a, b) => b.v - a.v || a.k.localeCompare(b.k));
    box.innerHTML = `<div class="card"><h2>Ternas (combinaciones sin importar el orden)</h2><div class="sub">Agrupa los números con las mismas tres cifras (ej. 123, 132, 213, 231, 312, 321). Una terna con 3 cifras distintas tiene 6 órdenes (0,6% teórico), con un par 3 órdenes (0,3%) y un trío 1 (0,1%).</div>
      ${UI.table(['Terna', 'Tipo', { t: 'Veces', c: 'r' }, { t: '% hist.', c: 'r' }, { t: 'Teórico', c: 'r' }, 'Números que salieron'], list.slice(0, 60).map(o => {
        const nums = U.ALL_NUMS.filter(n => U.sortedKey(n) === o.k && st.freq[+n]).map(n => `${n}×${st.freq[+n]}`).join(' ');
        return `<tr><td><span class="n3">${o.k.split('').join('-')}</span></td><td class="muted">${U.pattern(o.k)}</td><td class="r">${o.v}</td><td class="r">${U.pct(o.v, st.n, 2)}</td><td class="r muted">${(o.teo * 100).toFixed(1)}%</td><td class="small">${nums}</td></tr>`;
      }))}<div class="small muted">Se muestran las 60 ternas más frecuentes de ${list.length} observadas (220 posibles).</div></div>`;
  },
  repeticiones(box, st) {
    const T = Stats.theory, n1 = Math.max(0, st.n - 1);
    const rep = st.freq.map((f, i) => ({ i, f })).filter(o => o.f > 1).sort((a, b) => b.f - a.f || a.i - b.i);
    box.innerHTML = `<div class="grid g2">
      <div class="card"><h2>Cifras repetidas dentro del número</h2>${UI.table(['Patrón', { t: 'Veces', c: 'r' }, { t: '% hist.', c: 'r' }, { t: 'Teórico', c: 'r' }], Object.keys(st.patterns).map(k => `<tr><td>${k}</td><td class="r">${st.patterns[k]}</td><td class="r">${U.pct(st.patterns[k], st.n)}</td><td class="r muted">${(T.patterns[k] * 100).toFixed(0)}%</td></tr>`))}
        ${chiTxt(MathX.chiExpected(Object.values(st.patterns), Object.values(T.patterns)))}</div>
      <div class="card"><h2>Repetición entre sorteos consecutivos</h2>${UI.table(['Indicador', { t: 'Veces', c: 'r' }, { t: '% hist.', c: 'r' }, { t: 'Teórico', c: 'r' }], [
        `<tr><td>Mismo número que el sorteo anterior</td><td class="r">${st.repeatNumConsec}</td><td class="r">${U.pct(st.repeatNumConsec, n1, 2)}</td><td class="r muted">0,10%</td></tr>`,
        ...[0, 1, 2].map(p => `<tr><td>Se repite la cifra en posición ${Stats.POS[p]}</td><td class="r">${st.carry[p]}</td><td class="r">${U.pct(st.carry[p], n1)}</td><td class="r muted">10%</td></tr>`),
        ...[0, 1, 2, 3].map(k => `<tr><td>${k} cifra(s) compartidas con el anterior (sin orden)</td><td class="r">${st.sharedDigits[k]}</td><td class="r">${U.pct(st.sharedDigits[k], n1)}</td><td class="r muted">${(T.sharedDigits[k] * 100).toFixed(1)}%</td></tr>`)])}</div>
      <div class="card"><h2>Cambios entre sorteos por posición</h2><div class="sub">Diferencia (cifra actual − cifra anterior) mod 10. Teórico: 10% cada valor.</div><div class="chart-box"><canvas id="chChg"></canvas></div></div>
      <div class="card"><h2>Números repetidos en el periodo (${rep.length})</h2>${UI.table(['Número', { t: 'Veces', c: 'r' }, 'Primera', 'Última'], rep.slice(0, 40).map(o => `<tr><td>${UI.num3(U.pad3(o.i))}</td><td class="r">${o.f}</td><td>${U.fmtDate(st.rows[st.first[o.i]].fecha)}</td><td>${U.fmtDate(st.rows[st.last[o.i]].fecha)}</td></tr>`))}</div>
    </div>`;
    UI.chart('chChg', { type: 'bar', data: { labels: [...'0123456789'].map(d => '+' + d), datasets: [0, 1, 2].map(p => ({ label: 'Posición ' + Stats.POS[p], data: st.changes[p].map(c => n1 ? +(100 * c / n1).toFixed(1) : 0), backgroundColor: [COLORS.a1, COLORS.a2, COLORS.a3][p], borderColor: '#131f33', borderWidth: 1 })).concat([UI.refLine('Teórico 10%', 10, 10)]) } });
  },
  paridad(box, st) {
    const T = Stats.theory;
    box.innerHTML = `<div class="grid g2">
      <div class="card"><h2>Patrón par (P) / impar (I) por posición</h2><div class="chart-box"><canvas id="chPar"></canvas></div>${chiTxt(MathX.chiUniform(Object.values(st.parity)))}</div>
      <div class="card"><h2>Cantidad de cifras pares en el número</h2>${UI.table(['Cifras pares', { t: 'Veces', c: 'r' }, { t: '%', c: 'r' }, { t: 'Teórico', c: 'r' }], st.evenCount.map((c, k) => `<tr><td>${k} par(es) / ${3 - k} impar(es)</td><td class="r">${c}</td><td class="r">${U.pct(c, st.n)}</td><td class="r muted">${(T.evenCount[k] * 100).toFixed(1)}%</td></tr>`))}</div>
      <div class="card"><h2>Distribución por rangos</h2><div class="chart-box"><canvas id="chRng"></canvas></div></div>
      <div class="card"><h2>Suma de las tres cifras</h2><div class="chart-box"><canvas id="chSum"></canvas></div><div class="small muted">La forma de campana es esperable: hay más combinaciones que suman 13–14 que 0 o 27.</div></div>
    </div>`;
    const pk = Object.keys(st.parity);
    UI.chart('chPar', { type: 'bar', data: { labels: pk, datasets: [{ label: '% sorteos', data: pk.map(k => st.n ? +(100 * st.parity[k] / st.n).toFixed(1) : 0), backgroundColor: COLORS.gold }, UI.refLine('Teórico 12,5%', 12.5, 8)] } });
    UI.chart('chRng', { type: 'bar', data: { labels: Array.from({ length: 10 }, (_, i) => `${i}00–${i}99`), datasets: [{ label: 'Sorteos', data: st.pos[0], backgroundColor: COLORS.a2 }, UI.refLine('Esperado', st.n / 10, 10)] } });
    UI.chart('chSum', { type: 'bar', data: { labels: st.sums.map((_, i) => i), datasets: [{ label: '% observado', data: st.sums.map(c => st.n ? +(100 * c / st.n).toFixed(2) : 0), backgroundColor: COLORS.a3 }, { type: 'line', label: '% teórico', data: T.sums.map(x => +(x * 100).toFixed(2)), borderColor: COLORS.ref, borderDash: [5, 4], pointRadius: 0, borderWidth: 1.5 }] } });
  },
  periodos(box, st) {
    const half = Math.floor(st.n / 2);
    const s1 = Stats.compute(st.rows.slice(0, half)), s2 = Stats.compute(st.rows.slice(half));
    const months = [...st.months.entries()];
    box.innerHTML = `<div class="grid g2">
      <div class="card"><h2>Sorteos por mes</h2><div class="chart-box"><canvas id="chMes"></canvas></div></div>
      <div class="card"><h2>Sorteos por día de la semana</h2>${UI.table(['Día', { t: 'Sorteos', c: 'r' }, 'Cifra A más frecuente', 'Cifra B más frecuente', 'Cifra C más frecuente'], st.weekdayCount.map((c, d) => c ? `<tr><td>${U.DIAS[d]}</td><td class="r">${c}</td>${[0, 1, 2].map(p => { const a = st.weekday[p][d]; const m = Math.max(...a); const i = a.indexOf(m); return `<td><span class="dg">${i}</span> <span class="muted small">${U.pct(m, c)}</span></td>`; }).join('')}</tr>` : ''))}<div class="small muted">Con pocos sorteos por día, estas diferencias suelen ser azar.</div></div>
    </div>
    <div class="card"><h2>Comparación de resultados históricos: primera mitad vs segunda mitad</h2><div class="sub">${s1.n ? `${U.fmtDate(s1.rows[0].fecha)} – ${U.fmtDate(s1.rows[s1.n - 1].fecha)} (${s1.n} sorteos) vs ${U.fmtDate(s2.rows[0].fecha)} – ${U.fmtDate(s2.rows[s2.n - 1].fecha)} (${s2.n} sorteos)` : 'Se necesitan al menos 2 sorteos.'}</div>
      <div class="grid g3">${[0, 1, 2].map(p => `<div><h3>Posición ${Stats.POS[p]}</h3><div class="chart-box"><canvas id="chH${p}"></canvas></div></div>`).join('')}</div></div>`;
    UI.chart('chMes', { type: 'line', data: { labels: months.map(([k]) => U.MESES[+k.slice(5) - 1] + ' ' + k.slice(0, 4)), datasets: [{ label: 'Sorteos', data: months.map(m => m[1]), borderColor: COLORS.gold, backgroundColor: 'rgba(217,181,74,.12)', fill: true, pointRadius: 3 }] }, options: { plugins: { legend: { display: false } } } });
    [0, 1, 2].forEach(p => UI.chart('chH' + p, { type: 'bar', data: { labels: [...'0123456789'], datasets: [{ label: '1.ª mitad', data: s1.pos[p].map(c => s1.n ? +(100 * c / s1.n).toFixed(1) : 0), backgroundColor: COLORS.a2, borderColor: '#131f33', borderWidth: 1 }, { label: '2.ª mitad', data: s2.pos[p].map(c => s2.n ? +(100 * c / s2.n).toFixed(1) : 0), backgroundColor: COLORS.a1, borderColor: '#131f33', borderWidth: 1 }] } }));
  },
};

/* ------------------------------ ANÁLISIS DE CIFRAS ------------------------------ */
const CifV = { ventana: 30, consulta: '' };
UI.views.cifras = (el) => {
  const L = UI.ctxLoteria;
  const rows = Store.resultadosDe(L);
  const st = Stats.get(L, '', '');
  const W = Math.max(5, CifV.ventana);
  const rec = Stats.compute(rows.slice(-W));
  el.innerHTML = `
    ${UI.needData(1, L)}
    <div class="card no-print"><div class="toolbar" style="margin:0">
      <div class="field"><span>Lotería</span><b>${L ? U.esc(Store.loteriaNombre(L)) : 'Todas'}</b></div>
      <label class="field">Ventana reciente (sorteos)<input type="number" id="cW" min="5" max="1000" value="${W}" style="width:110px"></label>
      <label class="field">Consultar número<input id="cQ" class="num3" maxlength="3" inputmode="numeric" value="${U.esc(CifV.consulta)}" placeholder="000"></label>
      <button class="btn gold" id="cGo">Consultar</button>
    </div></div>
    <div id="cRes"></div>
    <div class="grid g3">${[0, 1, 2].map(p => `<div class="card"><h2>Cifra ${Stats.POS[p]}</h2>
      ${UI.table(['Cifra', { t: 'Total', c: 'r' }, { t: '%', c: 'r' }, { t: `Últ. ${W}`, c: 'r' }, { t: 'Sin salir', c: 'r' }, { t: 'Interv. medio', c: 'r' }, { t: 'Interv. máx.', c: 'r' }],
        [...Array(10).keys()].map(d => { const iv = Stats.intervalInfo(st, p, d); return `<tr><td><span class="dg">${d}</span></td><td class="r">${st.pos[p][d]}</td><td class="r">${U.pct(st.pos[p][d], st.n)}</td><td class="r">${rec.pos[p][d]}</td><td class="r">${st.posGap[p][d] ?? '—'}</td><td class="r">${iv.media ? iv.media.toFixed(1) : '—'}</td><td class="r">${iv.max ?? '—'}</td></tr>`; }))}
      <div class="small muted">Intervalo teórico medio: 10 sorteos.</div></div>`).join('')}</div>
    <div class="card"><h2>Evolución reciente de las cifras (últimos ${Math.min(W, rows.length)} sorteos)</h2>
      <div class="tbl-wrap"><table><thead><tr><th>Fecha</th><th>Número</th>${[...'0123456789'].map(d => `<th class="c">${d}</th>`).join('')}</tr></thead><tbody>
      ${rows.slice(-W).reverse().map(r => `<tr><td>${U.fmtDate(r.fecha)}</td><td>${UI.num3(r.numero)}</td>${[...'0123456789'].map(d => { const ps = [0, 1, 2].filter(p => r.numero[p] === d).map(p => Stats.POS[p]).join(''); return `<td class="c">${ps ? `<span class="badge ${ps.includes('A') ? 'a1' : ps.includes('B') ? 'a2' : 'a3'}">${ps}</span>` : ''}</td>`; }).join('')}</tr>`).join('')}
      </tbody></table></div><div class="small muted">Cada columna es una cifra; la letra indica en qué posición (A, B, C) apareció.</div></div>`;
  document.getElementById('cW').onchange = (e) => { CifV.ventana = Math.max(5, +e.target.value || 30); UI.render(); };
  const consultar = () => {
    const q = U.normNum(UI.val('cQ'));
    const box = document.getElementById('cRes');
    if (!q) { box.innerHTML = ''; return; }
    CifV.consulta = q; document.getElementById('cQ').value = q;
    const ap = rows.filter(r => r.numero === q);
    const perms = Hits.permutations(q).filter(x => x !== q);
    const apP = rows.filter(r => perms.includes(r.numero));
    const ivs = []; let lastI = -1; rows.forEach((r, i) => { if (r.numero === q) { if (lastI >= 0) ivs.push(i - lastI); lastI = i; } });
    box.innerHTML = `<div class="card"><h2>Consulta del número <span class="n3">${q}</span></h2>
      <div class="grid g3"><div class="kv"><b>Apariciones directas</b><span>${ap.length} (${U.pct(ap.length, rows.length, 2)}; teórico 0,10%)</span>
        <b>Última aparición</b><span>${lastI >= 0 ? U.fmtDate(rows[lastI].fecha) + ` (hace ${rows.length - 1 - lastI} sorteos)` : 'nunca'}</span>
        <b>Intervalo medio</b><span>${ivs.length ? MathX.mean(ivs).toFixed(1) + ' sorteos' : '—'} (teórico 1000)</span>
        <b>Combinadas (${perms.join(', ') || '—'})</b><span>${apP.length}</span><b>Patrón</b><span>${U.pattern(q)} · paridad ${U.parity(q)} · suma ${U.digitSum(q)}</span></div>
      <div style="grid-column:span 2">${UI.table(['Fecha', 'Lotería', 'Número', 'Tipo'], ap.concat(apP).sort((a, b) => (a.fecha < b.fecha ? 1 : -1)).slice(0, 50).map(r => `<tr><td>${U.fmtDate(r.fecha)}</td><td>${U.esc(Store.loteriaNombre(r.loteriaId))}</td><td>${UI.num3(r.numero)}</td><td>${r.numero === q ? '<span class="badge d">Directo</span>' : '<span class="badge c">Combinado</span>'}</td></tr>`))}</div></div></div>`;
  };
  document.getElementById('cGo').onclick = consultar;
  document.getElementById('cQ').onkeydown = (e) => { if (e.key === 'Enter') consultar(); };
  if (CifV.consulta) consultar();
};
