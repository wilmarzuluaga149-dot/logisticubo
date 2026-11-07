/* =====================================================================
   LOS TRES ALGORITMOS
   Cada algoritmo recibe ÚNICAMENTE el histórico anterior a la fecha del
   sorteo objetivo (hist: lista cronológica {fecha, numero}) y devuelve
   candidatos ordenados con puntuación (0–100) y explicación.
   Ningún algoritmo usa la salida de otro. Son heurísticas estadísticas:
   NO aumentan la probabilidad real de un sorteo aleatorio (1/1000).
   ===================================================================== */
const Algo = {
  NOMBRES: { 1: 'Frecuencia y tendencia', 2: 'Ciclos y ausencias', 3: 'Modelo combinado' },
  CANTIDADES: [5, 10, 20, 50, 100],
  MIN_HIST: 10,

  /** Rasgos básicos comunes (conteos). Cada algoritmo decide cómo usarlos. */
  base(hist, W) {
    const n = hist.length, w = Math.min(W, n), start = n - w;
    const pos = [0, 1, 2].map(() => new Array(10).fill(0));
    const posR = [0, 1, 2].map(() => new Array(10).fill(0));
    const num = new Array(1000).fill(0), numR = new Array(1000).fill(0), lastNum = new Array(1000).fill(-1);
    const pairs = [new Array(100).fill(0), new Array(100).fill(0), new Array(100).fill(0)]; // AB, BC, AC
    const posIdx = [0, 1, 2].map(() => Array.from({ length: 10 }, () => []));
    for (let i = 0; i < n; i++) {
      const s = hist[i].numero, v = +s, a = +s[0], b = +s[1], c = +s[2];
      num[v]++; lastNum[v] = i;
      pos[0][a]++; pos[1][b]++; pos[2][c]++;
      posIdx[0][a].push(i); posIdx[1][b].push(i); posIdx[2][c].push(i);
      pairs[0][a * 10 + b]++; pairs[1][b * 10 + c]++; pairs[2][a * 10 + c]++;
      if (i >= start) { numR[v]++; posR[0][a]++; posR[1][b]++; posR[2][c]++; }
    }
    return { n, w, pos, posR, num, numR, lastNum, pairs, posIdx };
  },

  /** Ciclo de una cifra en una posición: cercanía del intervalo actual al intervalo típico. */
  cycle(idx, n, ventana) {
    const desde = n - ventana;
    const iv = [];
    for (let j = 1; j < idx.length; j++) if (idx[j] >= desde) iv.push(idx[j] - idx[j - 1]);
    const lastI = idx.length ? idx[idx.length - 1] : -1;
    const g = lastI < 0 ? n + 1 : n - lastI;           // intervalo si saliera en el próximo sorteo
    const mu = iv.length >= 2 ? MathX.mean(iv) : 10;    // 10 = intervalo teórico de una cifra
    let sd = iv.length >= 3 ? MathX.std(iv) : 9.5;      // ≈ desviación teórica (geométrica p=0.1)
    sd = Math.max(sd, 2);
    const z = (g - mu) / sd;
    return { g, mu, sd, score: Math.exp(-0.5 * z * z), nIv: iv.length };
  },

  seedSort(cands, seed) {
    return cands.sort((x, y) => y.score - x.score || (U.hash32(seed + x.n) - U.hash32(seed + y.n)));
  },
  finalize(raw, k, seed, explain, why) {
    const norm = MathX.minmax(raw);
    const cands = U.ALL_NUMS.map((n, i) => ({ n, score: +(norm[i] * 100).toFixed(2), i }));
    this.seedSort(cands, seed);
    return cands.slice(0, k).map(c => ({ n: c.n, score: c.score, razon: explain ? why(c.i, c.n) : undefined }));
  },
  pctTxt(c, t) { return t ? (100 * c / t).toFixed(1) + '%' : '0%'; },

  /* ------------------ ALGORITMO 1 · FRECUENCIA Y TENDENCIA ------------------ */
  a1(hist, { k = 10, cfg = Store.config, seed = '', explain = true } = {}) {
    const W = Math.max(5, +cfg.a1Ventana || 30);
    const B = this.base(hist, W), n = B.n, w = B.w;
    const pH = B.pos.map(a => a.map(c => (c + 1) / (n + 10)));        // suavizado de Laplace
    const pR = B.posR.map(a => a.map(c => (c + 1) / (w + 10)));
    const fPos = [], fTrend = [], fPair = [], fNum = [], fNumR = [];
    for (let i = 0; i < 1000; i++) {
      const a = (i / 100) | 0, b = ((i / 10) | 0) % 10, c = i % 10, d = [a, b, c];
      let lp = 0, tr = 0;
      for (let p = 0; p < 3; p++) { lp += Math.log(0.5 * pH[p][d[p]] + 0.5 * pR[p][d[p]]); tr += pR[p][d[p]] - pH[p][d[p]]; }
      fPos.push(lp); fTrend.push(tr);
      fPair.push(B.pairs[0][a * 10 + b] + B.pairs[1][b * 10 + c] + B.pairs[2][a * 10 + c]);
      fNum.push(B.num[i]); fNumR.push(B.numR[i]);
    }
    const [nPos, nTr, nPair, nNum, nNumR] = [fPos, fTrend, fPair, fNum, fNumR].map(MathX.minmax);
    const raw = nPos.map((_, i) => 0.35 * nPos[i] + 0.15 * nTr[i] + 0.25 * nPair[i] + 0.10 * nNum[i] + 0.15 * nNumR[i]);
    return this.finalize(raw, k, seed + '|a1|', explain, (i, s) => {
      const parts = [];
      for (let p = 0; p < 3; p++) {
        const d = +s[p];
        parts.push(`${Stats.POS[p]}=${d}: ${this.pctTxt(B.pos[p][d], n)} hist., ${this.pctTxt(B.posR[p][d], w)} en últimos ${w}`);
      }
      const pr = [['AB', B.pairs[0][+s[0] * 10 + +s[1]]], ['BC', B.pairs[1][+s[1] * 10 + +s[2]]], ['AC', B.pairs[2][+s[0] * 10 + +s[2]]]]
        .sort((x, y) => y[1] - x[1])[0];
      parts.push(`pareja ${pr[0]} más fuerte: ${pr[1]} veces`);
      parts.push(B.num[i] ? `número salió ${B.num[i]} vez/veces (${B.numR[i]} recientes)` : 'número sin apariciones previas');
      parts.push(`tendencia ${nTr[i] >= 0.5 ? 'al alza' : 'a la baja'}`);
      return parts.join(' · ') + ' (teórico por cifra: 10%)';
    });
  },

  /* ------------------ ALGORITMO 2 · CICLOS Y AUSENCIAS ------------------ */
  a2(hist, { k = 10, cfg = Store.config, seed = '', explain = true, fechaObjetivo = null } = {}) {
    const V = Math.max(20, +cfg.a2Ventana || 120);
    const B = this.base(hist, V), n = B.n, w = B.w;
    const cyc = [0, 1, 2].map(p => Array.from({ length: 10 }, (_, d) => this.cycle(B.posIdx[p][d], n, V)));
    // Distribuciones en la ventana (suavizadas hacia la teoría)
    const par = {}, sum = new Array(28).fill(0), pat = { 3: 0, 2: 0, 1: 0 };
    const wd = fechaObjetivo ? U.weekday(fechaObjetivo) : null;
    const wdPos = [0, 1, 2].map(() => new Array(10).fill(0)); let wdN = 0;
    for (let i = n - w; i < n; i++) {
      const s = hist[i].numero;
      const pk = U.parity(s); par[pk] = (par[pk] || 0) + 1;
      sum[U.digitSum(s)]++; pat[new Set(s).size]++;
    }
    if (wd !== null) for (let i = 0; i < n; i++) if (U.weekday(hist[i].fecha) === wd) { wdN++; for (let p = 0; p < 3; p++) wdPos[p][+hist[i].numero[p]]++; }
    const T = Stats.theory, prior = 10;
    const fC = [], fPar = [], fSum = [], fPat = [], fAbs = [], fWd = [];
    for (let i = 0; i < 1000; i++) {
      const s = U.ALL_NUMS[i];
      fC.push((cyc[0][+s[0]].score + cyc[1][+s[1]].score + cyc[2][+s[2]].score) / 3);
      fPar.push(((par[U.parity(s)] || 0) + prior * T.parity) / (w + prior));
      const sm = U.digitSum(s);
      fSum.push(((sum[sm] || 0) + prior * T.sums[sm]) / (w + prior));
      const ps = new Set(s).size, pt = ps === 3 ? 0.72 : ps === 2 ? 0.27 : 0.01;
      fPat.push((pat[ps] + prior * pt) / (w + prior));
      const gN = B.lastNum[i] < 0 ? Infinity : n - 1 - B.lastNum[i];
      fAbs.push(Math.min(gN, 100) / 100);             // penaliza números que salieron hace muy poco
      fWd.push(wdN ? [0, 1, 2].reduce((acc, p) => acc + (wdPos[p][+s[p]] + 1) / (wdN + 10), 0) : 0.3);
    }
    const [nC, nPar, nSum, nPat, nAbs, nWd] = [fC, fPar, fSum, fPat, fAbs, fWd].map(MathX.minmax);
    const raw = nC.map((_, i) => 0.40 * nC[i] + 0.12 * nPar[i] + 0.12 * nSum[i] + 0.08 * nPat[i] + 0.13 * nAbs[i] + 0.15 * nWd[i]);
    return this.finalize(raw, k, seed + '|a2|', explain, (i, s) => {
      const parts = [];
      for (let p = 0; p < 3; p++) {
        const c = cyc[p][+s[p]];
        parts.push(`${Stats.POS[p]}=${s[p]}: ${c.g - 1} sorteos sin salir, intervalo típico ${c.mu.toFixed(1)}`);
      }
      const gN = B.lastNum[i] < 0 ? null : n - 1 - B.lastNum[i];
      parts.push(gN === null ? 'número nunca visto en el histórico' : `número visto hace ${gN} sorteos`);
      parts.push(`patrón paridad ${U.parity(s)}: ${this.pctTxt(par[U.parity(s)] || 0, w)} (teórico 12.5%)`);
      parts.push(`suma ${U.digitSum(s)}`);
      if (wd !== null) parts.push(`afinidad con ${U.DIAS[wd]}`);
      return parts.join(' · ');
    });
  },

  /* ------------------ ALGORITMO 3 · MODELO COMBINADO PONDERADO ------------------ */
  a3(hist, { k = 10, cfg = Store.config, seed = '', explain = true } = {}) {
    const P = { ...DEFAULT_CONFIG.a3Pesos, ...(cfg.a3Pesos || {}) };
    const W = Math.max(5, +cfg.a3Ventana || 40), H = Math.max(2, +cfg.a3VidaMedia || 25);
    const B = this.base(hist, W), n = B.n;
    // Frecuencia con decaimiento exponencial por posición (tendencia ponderada)
    const lam = Math.log(2) / H;
    const dec = [0, 1, 2].map(() => new Array(10).fill(0)); let decT = 0;
    for (let i = 0; i < n; i++) {
      const wgt = Math.exp(-lam * (n - 1 - i)); decT += wgt;
      const s = hist[i].numero; for (let p = 0; p < 3; p++) dec[p][+s[p]] += wgt;
    }
    const tern = new Map(); for (const h of hist) { const kk = U.sortedKey(h.numero); tern.set(kk, (tern.get(kk) || 0) + 1); }
    const cyc = [0, 1, 2].map(p => Array.from({ length: 10 }, (_, d) => this.cycle(B.posIdx[p][d], n, Math.max(60, W * 3))));
    const F = { frecuencia: [], tendencia: [], posiciones: [], parejas: [], ternas: [], ausencias: [] };
    for (let i = 0; i < 1000; i++) {
      const s = U.ALL_NUMS[i], a = +s[0], b = +s[1], c = +s[2], d = [a, b, c];
      let lt = 0, lp = 0;
      for (let p = 0; p < 3; p++) { lt += Math.log((dec[p][d[p]] + 0.1) / (decT + 1)); lp += Math.log((B.pos[p][d[p]] + 1) / (n + 10)); }
      F.frecuencia.push(B.num[i] + 0.25 * B.numR[i]);
      F.tendencia.push(lt);
      F.posiciones.push(lp);
      F.parejas.push(B.pairs[0][a * 10 + b] + B.pairs[1][b * 10 + c] + B.pairs[2][a * 10 + c]);
      F.ternas.push((tern.get(U.sortedKey(s)) || 0) / U.nPerms(s));
      F.ausencias.push(cyc[0][a].score + cyc[1][b].score + cyc[2][c].score);
    }
    const N = {}; for (const key in F) N[key] = MathX.minmax(F[key]);
    const tot = Object.values(P).reduce((x, y) => x + Math.max(0, +y || 0), 0) || 1;
    const raw = new Array(1000).fill(0);
    for (const key in N) { const wk = Math.max(0, +P[key] || 0) / tot; if (wk) for (let i = 0; i < 1000; i++) raw[i] += wk * N[key][i]; }
    return this.finalize(raw, k, seed + '|a3|', explain, (i, s) => {
      const contrib = Object.keys(N).map(key => ({ key, v: (Math.max(0, +P[key] || 0) / tot) * N[key][i] }))
        .sort((x, y) => y.v - x.v).filter(x => x.v > 0).slice(0, 3)
        .map(x => `${x.key} ${(x.v * 100).toFixed(1)} pts`);
      const t = tern.get(U.sortedKey(s)) || 0;
      return `Aportes principales: ${contrib.join(', ') || 'ninguno'} · terna {${U.sortedKey(s).split('').join(',')}} salió ${t} vez/veces · número salió ${B.num[i]} vez/veces`;
    });
  },

  run(alg, hist, opts) {
    if (alg === 1) return this.a1(hist, opts);
    if (alg === 2) return this.a2(hist, opts);
    if (alg === 3) return this.a3(hist, opts);
    throw new Error('Algoritmo desconocido');
  },

  /** Histórico disponible ANTES de la fecha objetivo (sin información futura). */
  historyBefore(loteriaId, fechaObjetivo, cfg = Store.config) {
    const all = Store.resultados; // ordenado por fecha
    const out = [];
    for (const r of all) {
      if (r.fecha >= fechaObjetivo) break;
      if (cfg.fuenteDatos === 'todas' || r.loteriaId === loteriaId) out.push(r);
    }
    return out;
  },

  paramsSnapshot(alg, cfg = Store.config) {
    if (alg === 1) return { ventana: cfg.a1Ventana, fuente: cfg.fuenteDatos };
    if (alg === 2) return { ventana: cfg.a2Ventana, fuente: cfg.fuenteDatos };
    return { pesos: { ...cfg.a3Pesos }, ventana: cfg.a3Ventana, vidaMedia: cfg.a3VidaMedia, fuente: cfg.fuenteDatos };
  },

  /** Genera un pronóstico completo (objeto listo para guardar). */
  generar({ alg, loteriaId, fechaObjetivo, k, origen = 'manual', explain = true, cfg = Store.config }) {
    const hist = this.historyBefore(loteriaId, fechaObjetivo, cfg);
    const cands = this.run(alg, hist, { k, cfg, seed: `${loteriaId}|${fechaObjetivo}`, explain, fechaObjetivo });
    return {
      algoritmo: alg, loteriaId, fechaObjetivo,
      fechaCorte: hist.length ? hist[hist.length - 1].fecha : null,
      nHist: hist.length, cantidad: k, origen,
      creado: new Date().toISOString(),
      params: this.paramsSnapshot(alg, cfg),
      candidatos: cands.map(c => (explain ? { n: c.n, score: c.score, razon: c.razon } : { n: c.n, score: c.score })),
    };
  },

  /** Prueba histórica cronológica (walk-forward). Cada sorteo se pronostica solo con datos anteriores. */
  async backtest({ loteriaId, desde, hasta, algs = [1, 2, 3], k = 10, minHist = 30, onProgress = () => { }, cancel = { v: false } }) {
    const cfg = Store.config;
    const objetivos = Store.resultadosDe(loteriaId, { desde, hasta });
    const existentes = new Map();
    for (const p of Store.pronosticos) if (p.origen === 'backtest' && p.loteriaId === loteriaId) existentes.set(`${p.algoritmo}|${p.fechaObjetivo}`, p);
    const out = []; let omitidos = 0;
    for (let i = 0; i < objetivos.length; i++) {
      if (cancel.v) break;
      const r = objetivos[i];
      const hist = this.historyBefore(loteriaId, r.fecha, cfg);
      if (hist.length < minHist) { omitidos++; continue; }
      for (const alg of algs) {
        const cands = this.run(alg, hist, { k, cfg, seed: `${loteriaId}|${r.fecha}`, explain: false, fechaObjetivo: r.fecha });
        const prev = existentes.get(`${alg}|${r.fecha}`);
        out.push({
          id: prev ? prev.id : undefined, algoritmo: alg, loteriaId, fechaObjetivo: r.fecha,
          fechaCorte: hist[hist.length - 1].fecha, nHist: hist.length, cantidad: k, origen: 'backtest',
          creado: new Date().toISOString(), params: this.paramsSnapshot(alg, cfg),
          candidatos: cands.map(c => ({ n: c.n, score: c.score })),
        });
      }
      if (i % 5 === 0) { onProgress((i + 1) / objetivos.length, i + 1, objetivos.length); await U.sleep(0); }
    }
    onProgress(1, objetivos.length, objetivos.length);
    if (out.length) await Store.savePronosticos(out);
    return { generados: out.length, sorteos: objetivos.length, omitidos, cancelado: cancel.v };
  },
};
