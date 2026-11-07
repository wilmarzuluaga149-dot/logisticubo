/* =====================================================================
   Sistema de aciertos: D-GANADOR (directo) y C-GANADOR (combinado)
   Reglas por defecto (configurables en Configuración):
   · D-Ganador: el resultado coincide exactamente (3 cifras y su orden)
     con alguno de los candidatos del pronóstico.
   · C-Ganador: el resultado es una permutación (mismas 3 cifras en otro
     orden) de algún candidato. Por defecto es excluyente: si hubo directo
     no se cuenta además como combinado (configurable).
   · Opcional: excluir del combinado los resultados con cifras repetidas.
   Solo se evalúan pronósticos cuyo histórico termina ANTES del sorteo.
   ===================================================================== */
const Hits = {
  evaluate(p, cfg = Store.config) {
    const r = Store.resultadoDe(p.loteriaId, p.fechaObjetivo);
    if (!r) return { estado: 'pendiente' };
    if (p.fechaCorte && p.fechaCorte >= p.fechaObjetivo) return { estado: 'invalido', resultado: r.numero };
    return Hits.evaluateNum(p, r.numero, cfg);
  },

  /** Compara una lista de candidatos con un número ganador concreto (sin consultar la base). */
  evaluateNum(p, res, cfg = Store.config) {
    let directo = false, combinado = false, rank = null, rankC = null, mejorPos = 0, mejorN = null;
    p.candidatos.forEach((c, i) => {
      const pm = U.posMatches(c.n, res);
      if (pm > mejorPos) { mejorPos = pm; mejorN = c.n; }
      if (c.n === res) { if (!directo) rank = i + 1; directo = true; }
      else if (U.isPerm(c.n, res)) { if (rankC === null) rankC = i + 1; combinado = true; }
    });
    if (!cfg.combinadoConRepetidas && U.nPerms(res) < 6) combinado = false;
    if (directo && !cfg.combinadoIncluyeDirecto) combinado = false;
    if (directo && cfg.combinadoIncluyeDirecto && (cfg.combinadoConRepetidas || U.nPerms(res) === 6)) combinado = true;
    return { estado: 'evaluado', resultado: res, directo, combinado, acierto: directo || combinado, rank, rankC, mejorPos, mejorN };
  },

  /** Probabilidad teórica (azar) de que un pronóstico logre D o C. */
  expected(p) {
    const k = p.candidatos.length;
    const eD = k / 1000;
    const perms = new Set();
    for (const c of p.candidatos) for (const q of Hits.permutations(c.n)) perms.add(q);
    const nums = new Set(p.candidatos.map(c => c.n));
    let eC = 0; for (const q of perms) if (!nums.has(q)) eC++;
    return { eD, eC: eC / 1000 };
  },
  permutations(n) {
    const a = n.split(''), out = new Set();
    const idx = [[0, 1, 2], [0, 2, 1], [1, 0, 2], [1, 2, 0], [2, 0, 1], [2, 1, 0]];
    for (const [x, y, z] of idx) out.add(a[x] + a[y] + a[z]);
    return [...out];
  },

  /** Filtra pronósticos. f: {loteriaId, desde, hasta, algoritmo, origen} */
  filter(f = {}) {
    return Store.pronosticos.filter(p =>
      (f.loteriaId == null || p.loteriaId === f.loteriaId) &&
      (!f.desde || p.fechaObjetivo >= f.desde) && (!f.hasta || p.fechaObjetivo <= f.hasta) &&
      (!f.algoritmo || p.algoritmo === f.algoritmo) &&
      (!f.origen || f.origen === 'todos' || p.origen === f.origen));
  },

  /** Resumen por algoritmo. */
  summary(f = {}) {
    const key = 'hits|' + JSON.stringify(f) + '|' + Store.config.combinadoIncluyeDirecto + Store.config.combinadoConRepetidas;
    return Cache.get(key, () => {
      const prons = Hits.filter(f).slice().sort((a, b) => (a.fechaObjetivo < b.fechaObjetivo ? -1 : a.fechaObjetivo > b.fechaObjetivo ? 1 : a.id - b.id));
      const per = {};
      for (const a of [1, 2, 3]) per[a] = { algoritmo: a, pronosticos: 0, evaluados: 0, pendientes: 0, candidatos: 0, D: 0, C: 0, conAcierto: 0, eD: 0, eC: 0, ultimo: null, ultimoTipo: null, maxSin: 0, actualSin: 0, maxCon: 0, _con: 0, serie: [], porLoteria: {}, porMes: {}, mejorPos: [0, 0, 0, 0] };
      const lista = [];
      for (const p of prons) {
        const s = per[p.algoritmo]; if (!s) continue;
        s.pronosticos++; s.candidatos += p.candidatos.length;
        const ev = Hits.evaluate(p);
        if (ev.estado === 'pendiente') { s.pendientes++; continue; }
        if (ev.estado !== 'evaluado') continue;
        s.evaluados++;
        const ex = Hits.expected(p); s.eD += ex.eD; s.eC += ex.eC;
        s.mejorPos[ev.mejorPos]++;
        const lt = s.porLoteria[p.loteriaId] || (s.porLoteria[p.loteriaId] = { ev: 0, D: 0, C: 0 });
        const mk = p.fechaObjetivo.slice(0, 7); const mm = s.porMes[mk] || (s.porMes[mk] = { ev: 0, D: 0, C: 0 });
        lt.ev++; mm.ev++;
        if (ev.directo) { s.D++; lt.D++; mm.D++; }
        if (ev.combinado) { s.C++; lt.C++; mm.C++; }
        if (ev.acierto) {
          s.conAcierto++; s.ultimo = p.fechaObjetivo; s.ultimoTipo = ev.directo ? 'D' : 'C';
          s.actualSin = 0; s._con++; s.maxCon = Math.max(s.maxCon, s._con);
          lista.push({ p, ev });
        } else { s.actualSin++; s._con = 0; s.maxSin = Math.max(s.maxSin, s.actualSin); }
        s.serie.push({ fecha: p.fechaObjetivo, D: s.D, C: s.C, eD: s.eD, eC: s.eC });
      }
      for (const a of [1, 2, 3]) {
        const s = per[a];
        s.pctAcierto = s.evaluados ? s.conAcierto / s.evaluados : 0;
        s.pctD = s.evaluados ? s.D / s.evaluados : 0;
        s.pctC = s.evaluados ? s.C / s.evaluados : 0;
        // Rendimiento relativo al azar: 1.00 = igual que el azar
        s.indice = (s.eD + s.eC) > 0 ? (s.D + s.C) / (s.eD + s.eC) : null;
        s.pAzar = MathX.pAtLeast(s.D + s.C, s.eD + s.eC);
      }
      lista.sort((x, y) => (x.p.fechaObjetivo < y.p.fechaObjetivo ? 1 : -1));
      return { per, lista, total: prons.length };
    });
  },

  /** Último pronóstico (preferencia: manual sobre prueba histórica) por lotería/fecha/algoritmo. */
  indexByDraw() {
    return Cache.get('hitIndex', () => {
      const m = new Map();
      for (const p of Store.pronosticos) {
        const key = `${p.loteriaId}|${p.fechaObjetivo}|${p.algoritmo}`;
        const prev = m.get(key);
        if (!prev || (prev.origen === 'backtest' && p.origen === 'manual') || (prev.origen === p.origen && p.creado > prev.creado)) m.set(key, p);
      }
      return m;
    });
  },
};
