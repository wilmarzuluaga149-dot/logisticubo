/* =====================================================================
   Motor de estadísticas descriptivas (000–999, posiciones A/B/C)
   Entrada: lista cronológica (ascendente) de resultados {fecha, numero}.
   ===================================================================== */
const Stats = {
  POS: ['A', 'B', 'C'],
  PAIRS: [['AB', 0, 1], ['BC', 1, 2], ['AC', 0, 2]],

  compute(rows) {
    const n = rows.length;
    const freq = new Array(1000).fill(0), last = new Array(1000).fill(-1), first = new Array(1000).fill(-1);
    const pos = [0, 1, 2].map(() => new Array(10).fill(0));
    const posLast = [0, 1, 2].map(() => new Array(10).fill(-1));
    const posIntervals = [0, 1, 2].map(() => Array.from({ length: 10 }, () => []));
    const pairs = { AB: new Array(100).fill(0), BC: new Array(100).fill(0), AC: new Array(100).fill(0) };
    const ternas = new Map();
    const patterns = { 'Todas distintas': 0, 'Un par repetido': 0, 'Trío (iguales)': 0 };
    const parity = {}; ['PPP', 'PPI', 'PIP', 'PII', 'IPP', 'IPI', 'IIP', 'III'].forEach(k => parity[k] = 0);
    const evenCount = [0, 0, 0, 0]; // cantidad de cifras pares por número: 0..3
    const sums = new Array(28).fill(0);
    const changes = [0, 1, 2].map(() => new Array(10).fill(0)); // diferencia (d_t - d_{t-1}) mod 10
    let carry = [0, 0, 0], repeatNumConsec = 0, sharedDigits = [0, 0, 0, 0];
    const weekday = [0, 1, 2].map(() => Array.from({ length: 7 }, () => new Array(10).fill(0)));
    const weekdayCount = new Array(7).fill(0);
    const months = new Map();

    rows.forEach((r, i) => {
      const s = r.numero, v = +s;
      freq[v]++; if (first[v] < 0) first[v] = i; last[v] = i;
      const wd = U.weekday(r.fecha); weekdayCount[wd]++;
      for (let p = 0; p < 3; p++) {
        const d = +s[p]; pos[p][d]++;
        if (posLast[p][d] >= 0) posIntervals[p][d].push(i - posLast[p][d]);
        posLast[p][d] = i; weekday[p][wd][d]++;
      }
      pairs.AB[+s[0] * 10 + +s[1]]++; pairs.BC[+s[1] * 10 + +s[2]]++; pairs.AC[+s[0] * 10 + +s[2]]++;
      const k = U.sortedKey(s); ternas.set(k, (ternas.get(k) || 0) + 1);
      patterns[U.pattern(s)]++;
      parity[U.parity(s)]++;
      evenCount[s.split('').filter(c => +c % 2 === 0).length]++;
      sums[U.digitSum(s)]++;
      const mk = r.fecha.slice(0, 7); months.set(mk, (months.get(mk) || 0) + 1);
      if (i > 0) {
        const pr = rows[i - 1].numero;
        for (let p = 0; p < 3; p++) { changes[p][(+s[p] - +pr[p] + 10) % 10]++; if (s[p] === pr[p]) carry[p]++; }
        if (pr === s) repeatNumConsec++;
        const a = pr.split(''), b = s.split(''); let sh = 0;
        for (const c of b) { const j = a.indexOf(c); if (j >= 0) { sh++; a.splice(j, 1); } }
        sharedDigits[sh]++;
      }
    });
    const gap = last.map(l => (l < 0 ? null : n - 1 - l));
    const posGap = posLast.map(arr => arr.map(l => (l < 0 ? null : n - 1 - l)));
    return { n, rows, freq, last, first, gap, pos, posLast, posGap, posIntervals, pairs, ternas, patterns, parity, evenCount, sums, changes, carry, repeatNumConsec, sharedDigits, weekday, weekdayCount, months };
  },

  /** Probabilidades teóricas bajo un sorteo uniforme e independiente. */
  theory: {
    numero: 1 / 1000, cifra: 1 / 10, pareja: 1 / 100,
    patterns: { 'Todas distintas': 0.72, 'Un par repetido': 0.27, 'Trío (iguales)': 0.01 },
    parity: 1 / 8,
    evenCount: [0.125, 0.375, 0.375, 0.125],
    sums: (() => { const a = new Array(28).fill(0); for (let i = 0; i < 1000; i++) a[U.digitSum(U.pad3(i))]++; return a.map(x => x / 1000); })(),
    carry: 0.1, repeatNum: 0.001,
    get sharedDigits() { // distribución exacta de cifras compartidas entre dos números independientes (se calcula una vez)
      if (this._sh) return this._sh;
      const out = [0, 0, 0, 0];
      const cs = U.ALL_NUMS.map(s => { const m = new Array(10).fill(0); for (const c of s) m[+c]++; return m; });
      for (let i = 0; i < 1000; i++) for (let j = 0; j < 1000; j++) {
        const a = cs[i], b = cs[j]; let sh = 0; for (let k = 0; k < 10; k++) if (a[k] && b[k]) sh += Math.min(a[k], b[k]); out[sh]++;
      }
      return (this._sh = out.map(x => x / 1e6));
    },
  },

  topN(arr, k, desc = true, filter = () => true) {
    return arr.map((v, i) => ({ i, v })).filter(o => filter(o)).sort((a, b) => (desc ? b.v - a.v : a.v - b.v) || a.i - b.i).slice(0, k);
  },

  /** Estadística de intervalos para una cifra en una posición. */
  intervalInfo(st, p, d) {
    const iv = st.posIntervals[p][d];
    return { media: iv.length ? MathX.mean(iv) : null, max: iv.length ? Math.max(...iv) : null, desv: MathX.std(iv), n: iv.length };
  },

  /** Resultados filtrados por lotería/fechas, con caché. */
  rows(loteriaId, desde, hasta) {
    return Cache.get(`rows|${loteriaId}|${desde}|${hasta}`, () => Store.resultadosDe(loteriaId, { desde, hasta }));
  },
  get(loteriaId, desde, hasta) {
    return Cache.get(`stats|${loteriaId}|${desde}|${hasta}`, () => Stats.compute(Stats.rows(loteriaId, desde, hasta)));
  },
};
