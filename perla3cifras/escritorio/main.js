// PERLA 3 CIFRAS PRO para Windows (Electron). La aplicación web va en la carpeta app/.
const { app, BrowserWindow, shell, Menu, session } = require('electron');
const path = require('path'), fs = require('fs');

if (!app.requestSingleInstanceLock()) { app.quit(); }
let win = null;

function crearVentana() {
  win = new BrowserWindow({
    width: 1366, height: 860, minWidth: 360, minHeight: 500,
    backgroundColor: '#0b1424', title: 'PERLA 3 CIFRAS PRO',
    icon: path.join(__dirname, 'icon.png'), autoHideMenuBar: true, show: false,
    webPreferences: { contextIsolation: true, sandbox: true, spellcheck: false },
  });
  Menu.setApplicationMenu(null);
  win.once('ready-to-show', () => { win.maximize(); win.show(); });
  win.loadFile(path.join(__dirname, 'app', 'PERLA3CIFRAS_PRO.html'));
  // Enlaces externos: se abren en el navegador del sistema
  win.webContents.setWindowOpenHandler(({ url }) => { shell.openExternal(url); return { action: 'deny' }; });
  win.webContents.on('will-navigate', (e, url) => { if (!url.startsWith('file:')) { e.preventDefault(); shell.openExternal(url); } });
  // F11 pantalla completa, F5 recargar, Ctrl+P imprimir
  win.webContents.on('before-input-event', (e, input) => {
    if (input.type !== 'keyDown') return;
    if (input.key === 'F11') { win.setFullScreen(!win.isFullScreen()); e.preventDefault(); }
    if (input.key === 'F5') { win.reload(); e.preventDefault(); }
    if (input.control && input.key.toLowerCase() === 'p') { win.webContents.print(); e.preventDefault(); }
  });
}

app.whenReady().then(() => {
  // Los archivos exportados (Excel, PDF, copias de seguridad) se guardan en Descargas\PERLA3
  session.defaultSession.on('will-download', (e, item) => {
    const dir = path.join(app.getPath('downloads'), 'PERLA3');
    fs.mkdirSync(dir, { recursive: true });
    const destino = path.join(dir, item.getFilename());
    item.setSavePath(destino);
    item.once('done', (ev, state) => {
      if (state === 'completed' && win) win.webContents.executeJavaScript(`window.UI && UI.toast(${JSON.stringify('Guardado en ' + destino)}, 'ok', 7000)`).catch(() => { });
    });
  });
  crearVentana();
});
app.on('second-instance', () => { if (win) { if (win.isMinimized()) win.restore(); win.focus(); } });
app.on('window-all-closed', () => app.quit());
