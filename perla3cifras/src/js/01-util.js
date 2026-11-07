'use strict';
/* =====================================================================
   PERLA 3 CIFRAS PRO — utilidades generales
   ===================================================================== */
const APP_VERSION = '1.4.0';
const APP_BUILD = '2026-11-07';
const DB_NAME = 'perla3cifras_pro';
const DB_VERSION = 1;

const U = {
  pad3(n) { return String(n).padStart(3, '0'); },

  /** Normaliza un número ganador a texto de 3 cifras ("7" -> "007").
   *  Devuelve null si no es válido. opts.ultimas3: toma las 3 últimas cifras si hay más. */
  normNum(v, opts = {}) {
    if (v === null || v === undefined) return null;
    let s = String(v).trim();
    if (typeof v === 'number') {
      if (!Number.isInteger(v) || v < 0) return null;
      s = String(v);
    }
    s = s.replace(/[\s'".]/g, '');
    if (!/^\d+$/.test(s)) return null;
    if (s.length > 3) {
      if (opts.ultimas3) s = s.slice(-3);
      else if (/^0+\d{3}$/.test(s)) s = s.slice(-3);
      else return null;
    }
    return s.padStart(3, '0');
  },

  /** Convierte distintas representaciones de fecha a ISO 'YYYY-MM-DD'. formato: 'dmy' | 'mdy' */
  parseDate(v, formato = 'dmy') {
    if (v === null || v === undefined || v === '') return null;
    if (v instanceof Date && !isNaN(v)) {
      return U.isoFromParts(v.getFullYear(), v.getMonth() + 1, v.getDate());
    }
    if (typeof v === 'number' && isFinite(v)) {
      // número de serie de Excel (sistema 1900)
      if (v < 1 || v > 2958465) return null;
      const ms = Math.round((Math.floor(v) - 25569) * 86400000);
      const d = new Date(ms);
      return U.isoFromParts(d.getUTCFullYear(), d.getUTCMonth() + 1, d.getUTCDate());
    }
    const s = String(v).trim().replace(/\s+\d{1,2}:\d{2}(:\d{2})?(\s*[ap]\.?m\.?)?$/i, '');
    let m = s.match(/^(\d{4})[-/.](\d{1,2})[-/.](\d{1,2})$/);
    if (m) return U.isoFromParts(+m[1], +m[2], +m[3]);
    m = s.match(/^(\d{1,2})[-/.](\d{1,2})[-/.](\d{2}|\d{4})$/);
    if (m) {
      let y = +m[3]; if (y < 100) y += 2000;
      return formato === 'mdy' ? U.isoFromParts(y, +m[1], +m[2]) : U.isoFromParts(y, +m[2], +m[1]);
    }
    if (/^\d{5}(\.\d+)?$/.test(s)) return U.parseDate(parseFloat(s));
    m = s.match(/^(\d{4})(\d{2})(\d{2})$/);
    if (m) return U.isoFromParts(+m[1], +m[2], +m[3]);
    return null;
  },
  isoFromParts(y, mo, d) {
    if (!(y >= 1900 && y <= 2200 && mo >= 1 && mo <= 12 && d >= 1 && d <= 31)) return null;
    const dt = new Date(Date.UTC(y, mo - 1, d));
    if (dt.getUTCMonth() !== mo - 1 || dt.getUTCDate() !== d) return null;
    return `${y}-${String(mo).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
  },
  isISO(s) { return typeof s === 'string' && U.parseDate(s) === s; },
  fmtDate(iso) { if (!iso) return '—'; const [y, m, d] = iso.split('-'); return `${d}/${m}/${y}`; },
  fmtDateTime(isoDT) {
    if (!isoDT) return '—';
    const d = new Date(isoDT);
    if (isNaN(d)) return isoDT;
    return d.toLocaleString('es-CO', { year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit' });
  },
  todayISO() { const d = new Date(); return U.isoFromParts(d.getFullYear(), d.getMonth() + 1, d.getDate()); },
  addDays(iso, n) {
    const [y, m, d] = iso.split('-').map(Number);
    const dt = new Date(Date.UTC(y, m - 1, d + n));
    return U.isoFromParts(dt.getUTCFullYear(), dt.getUTCMonth() + 1, dt.getUTCDate());
  },
  _wd: new Map(),
  weekday(iso) {
    let v = U._wd.get(iso);
    if (v === undefined) { const [y, m, d] = iso.split('-').map(Number); v = new Date(Date.UTC(y, m - 1, d)).getUTCDay(); U._wd.set(iso, v); }
    return v;
  },
  DIAS: ['Domingo', 'Lunes', 'Martes', 'Miércoles', 'Jueves', 'Viernes', 'Sábado'],
  MESES: ['Ene', 'Feb', 'Mar', 'Abr', 'May', 'Jun', 'Jul', 'Ago', 'Sep', 'Oct', 'Nov', 'Dic'],

  esc(s) {
    return String(s ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  },
  /** Hash FNV-1a de 32 bits: desempates deterministas sin sesgo hacia números bajos. */
  hash32(str) {
    let h = 0x811c9dc5;
    for (let i = 0; i < str.length; i++) { h ^= str.charCodeAt(i); h = Math.imul(h, 0x01000193); }
    return h >>> 0;
  },
  /** Generador pseudoaleatorio con semilla (mulberry32) — solo para datos de ejemplo. */
  rng(seed) {
    let a = seed >>> 0;
    return () => { a |= 0; a = (a + 0x6D2B79F5) | 0; let t = Math.imul(a ^ (a >>> 15), 1 | a); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
  },
  sortedKey(n) { return n.split('').sort().join(''); },
  isPerm(a, b) { return U.sortedKey(a) === U.sortedKey(b); },
  posMatches(a, b) { let c = 0; for (let i = 0; i < 3; i++) if (a[i] === b[i]) c++; return c; },
  /** Número de ordenaciones distintas de las cifras (6, 3 o 1). */
  nPerms(n) { const s = new Set(n.split('')).size; return s === 3 ? 6 : s === 2 ? 3 : 1; },
  pattern(n) { const s = new Set(n.split('')).size; return s === 3 ? 'Todas distintas' : s === 2 ? 'Un par repetido' : 'Trío (iguales)'; },
  parity(n) { return n.split('').map(c => (+c % 2 ? 'I' : 'P')).join(''); },
  digitSum(n) { return +n[0] + +n[1] + +n[2]; },
  pct(a, b, dec = 1) { return b ? (100 * a / b).toFixed(dec) + '%' : '—'; },
  fmt(n, dec = 0) { return (n ?? 0).toLocaleString('es-CO', { minimumFractionDigits: dec, maximumFractionDigits: dec }); },
  debounce(fn, ms = 250) { let t; return (...a) => { clearTimeout(t); t = setTimeout(() => fn(...a), ms); }; },
  sleep(ms) { return new Promise(r => setTimeout(r, ms)); },
  /** Guarda un archivo. En la app Android lo entrega al sistema (carpeta Descargas); en el navegador y en la app de PC, descarga normal. */
  download(blob, name) {
    if (window.AndroidBridge && window.AndroidBridge.saveFile) {
      const fr = new FileReader();
      fr.onload = () => {
        try { const msg = window.AndroidBridge.saveFile(name, blob.type || 'application/octet-stream', String(fr.result).split(',')[1] || ''); if (msg) UI.toast(msg); }
        catch (err) { UI.toast('No se pudo guardar el archivo: ' + err.message, 'err'); }
      };
      fr.readAsDataURL(blob);
      return;
    }
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob); a.download = name;
    document.body.appendChild(a); a.click();
    setTimeout(() => { URL.revokeObjectURL(a.href); a.remove(); }, 1500);
  },
  stamp() { const d = new Date(); const p = x => String(x).padStart(2, '0'); return `${d.getFullYear()}${p(d.getMonth() + 1)}${p(d.getDate())}_${p(d.getHours())}${p(d.getMinutes())}`; },
  slug(s) { return String(s).normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/[^\w]+/g, '_').replace(/^_|_$/g, '').toUpperCase() || 'X'; },
  normText(s) { return String(s ?? '').normalize('NFD').replace(/[̀-ͯ]/g, '').trim().toLowerCase(); },
  ORIGEN: { manual: 'MANUAL', auto: 'AUTOMATICO', backtest: 'PRUEBA HISTORICA' },
  origenTxt(o, bonito = false) { const t = U.ORIGEN[o] || 'MANUAL'; return bonito ? { MANUAL: 'manual', AUTOMATICO: 'automático', 'PRUEBA HISTORICA': 'prueba histórica' }[t] : t; },
  ALL_NUMS: Array.from({ length: 1000 }, (_, i) => String(i).padStart(3, '0')),
};

/* ----------- Estadística matemática ----------- */
const MathX = {
  lnGamma(z) {
    const g = 7, c = [0.99999999999980993, 676.5203681218851, -1259.1392167224028, 771.32342877765313, -176.61502916214059,
      12.507343278686905, -0.13857109526572012, 9.9843695780195716e-6, 1.5056327351493116e-7];
    if (z < 0.5) return Math.log(Math.PI / Math.sin(Math.PI * z)) - MathX.lnGamma(1 - z);
    z -= 1; let x = c[0];
    for (let i = 1; i < g + 2; i++) x += c[i] / (z + i);
    const t = z + g + 0.5;
    return 0.5 * Math.log(2 * Math.PI) + (z + 0.5) * Math.log(t) - t + Math.log(x);
  },
  /** Función gamma incompleta regularizada superior Q(a,x). */
  gammaQ(a, x) {
    if (x <= 0) return 1;
    if (x < a + 1) { // serie
      let sum = 1 / a, del = sum, ap = a;
      for (let n = 0; n < 500; n++) { ap++; del *= x / ap; sum += del; if (Math.abs(del) < Math.abs(sum) * 1e-12) break; }
      return 1 - sum * Math.exp(-x + a * Math.log(x) - MathX.lnGamma(a));
    }
    let b = x + 1 - a, c = 1e300, d = 1 / b, h = d; // fracción continua
    for (let i = 1; i < 500; i++) {
      const an = -i * (i - a); b += 2; d = an * d + b; if (Math.abs(d) < 1e-300) d = 1e-300;
      c = b + an / c; if (Math.abs(c) < 1e-300) c = 1e-300; d = 1 / d; const del = d * c; h *= del; if (Math.abs(del - 1) < 1e-12) break;
    }
    return Math.exp(-x + a * Math.log(x) - MathX.lnGamma(a)) * h;
  },
  /** Prueba chi-cuadrado de bondad de ajuste a una distribución uniforme. */
  chiUniform(counts) {
    const n = counts.reduce((a, b) => a + b, 0), k = counts.length;
    if (!n) return { chi: 0, df: k - 1, p: 1, n };
    const e = n / k; let chi = 0;
    for (const o of counts) chi += (o - e) ** 2 / e;
    return { chi, df: k - 1, p: MathX.gammaQ((k - 1) / 2, chi / 2), n };
  },
  chiExpected(counts, probs) {
    const n = counts.reduce((a, b) => a + b, 0);
    let chi = 0, df = -1;
    counts.forEach((o, i) => { const e = n * probs[i]; if (e > 0) { chi += (o - e) ** 2 / e; df++; } });
    return { chi, df, p: df > 0 ? MathX.gammaQ(df / 2, chi / 2) : 1, n };
  },
  mean(a) { return a.length ? a.reduce((x, y) => x + y, 0) / a.length : 0; },
  std(a) { if (a.length < 2) return 0; const m = MathX.mean(a); return Math.sqrt(a.reduce((s, x) => s + (x - m) ** 2, 0) / (a.length - 1)); },
  /** Normaliza un arreglo a [0,1] (min-max). Si todos son iguales devuelve 0.5. */
  minmax(arr) {
    let mn = Infinity, mx = -Infinity;
    for (const v of arr) { if (v < mn) mn = v; if (v > mx) mx = v; }
    const r = mx - mn;
    return arr.map(v => (r > 1e-12 ? (v - mn) / r : 0.5));
  },
  /** Probabilidad binomial de obtener al menos k éxitos en n intentos con prob. p (aprox. Poisson para p pequeño). */
  pAtLeast(k, lambda) {
    if (k <= 0) return 1;
    let term = Math.exp(-lambda), cdf = term;
    for (let i = 1; i < k; i++) { term *= lambda / i; cdf += term; }
    return Math.max(0, 1 - cdf);
  },
};
