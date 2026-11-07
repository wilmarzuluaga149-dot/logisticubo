#!/usr/bin/env node
/* Construye PERLA3CIFRAS_PRO.html: un único archivo autocontenido (funciona sin conexión).
   Uso: node build.js */
const fs = require('fs'), path = require('path');
const R = (...p) => fs.readFileSync(path.join(__dirname, ...p), 'utf8');
const safe = s => s.replace(/<\/script/gi, '<\\/script').replace(/<!--/g, '<\\!--');
const libs = ['chart.umd.min.js', 'xlsx.core.min.js', 'jspdf.umd.min.js', 'jspdf.plugin.autotable.min.js'];
const libTags = libs.map(f => `<script>/* ${f} */\n${safe(R('lib', f))}\n</script>`).join('\n');
const jsFiles = fs.readdirSync(path.join(__dirname, 'src/js')).filter(f => f.endsWith('.js')).sort();
const app = jsFiles.map(f => `/* ---- ${f} ---- */\n` + R('src/js', f)).join('\n');
let html = R('src/index.html');
html = html.replace('/*@@CSS@@*/', () => R('src/styles.css'))
           .replace('<!--@@LIBS@@-->', () => libTags)
           .replace('/*@@APP@@*/', () => safe(app));
fs.writeFileSync(path.join(__dirname, 'PERLA3CIFRAS_PRO.html'), html);
console.log('OK PERLA3CIFRAS_PRO.html', (html.length / 1024).toFixed(0), 'KB;', jsFiles.length, 'módulos');
