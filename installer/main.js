'use strict';
// Установщик TotemLauncher: узнаёт последнюю версию на GitHub, скачивает, распаковывает в <папка>/app-<версия>, создаёт ярлыки.
// Если лаунчер уже установлен — сравнивает версии и предлагает обновить.
const { app, BrowserWindow, ipcMain, dialog, shell, screen } = require('electron');
const path = require('path'), fs = require('fs'), os = require('os'), { spawn } = require('child_process'), { pathToFileURL } = require('url');
const core = require('./lib/updater-core');

const testMode = !app.isPackaged && process.env.TOTEM_TEST_UPDATE === '1';
const net = testMode ? { api: process.env.TOTEM_GITHUB_API, local: true } : {};
const UI = path.join(__dirname, 'ui'), UI_URL = pathToFileURL(UI + path.sep).href;
let win = null, repo = '', latest = null, installed = null, ac = null, busy = false, doneInfo = null, createdRoot = null;

function readRepo() { // 1) встроенный в сборку  2) файл totem-repo.txt рядом с установщиком  3) (только тесты) переменная  4) спросим в окне
  const cands = [];
  if (testMode && process.env.TOTEM_REPO) cands.push(process.env.TOTEM_REPO);
  try { cands.push(JSON.parse(fs.readFileSync(path.join(__dirname, 'app-config.json'), 'utf8')).repo); } catch {}
  try { cands.push(fs.readFileSync(path.join(process.env.PORTABLE_EXECUTABLE_DIR || path.dirname(process.execPath), 'totem-repo.txt'), 'utf8').trim().replace(/^https?:\/\/github\.com\//i, '').replace(/\.git$/i, '').replace(/\/+$/, '')); } catch {}
  return cands.map((c) => String(c || '').trim()).find((c) => core.repoOk(c)) || '';
}
function createWindow() {
  const wa = screen.getPrimaryDisplay().workArea, w = Math.min(680, wa.width), h = Math.min(640, wa.height);
  win = new BrowserWindow({ width: w, height: h, x: Math.round(wa.x + (wa.width - w) / 2), y: Math.round(wa.y + (wa.height - h) / 2), icon: path.join(UI, 'assets', 'app-icon.png'), frame: false, transparent: true, backgroundColor: '#00000000', hasShadow: false, show: false, resizable: false,
    webPreferences: { preload: path.join(__dirname, 'preload.js'), contextIsolation: true, nodeIntegration: false, sandbox: true, webSecurity: true, webviewTag: false, spellcheck: false } });
  win.webContents.setWindowOpenHandler(() => ({ action: 'deny' })); win.webContents.on('will-navigate', (e) => e.preventDefault());
  win.loadFile(path.join(UI, 'index.html')); win.once('ready-to-show', () => win.show()); win.on('closed', () => { win = null; });
}
const trusted = (e) => { try { return String(e.senderFrame?.url || '').startsWith(UI_URL); } catch { return false; } };
const handle = (ch, fn) => ipcMain.handle(ch, (e, ...a) => { if (!trusted(e)) throw new Error('forbidden'); return fn(e, ...a); });
const send = (ch, p) => { try { win?.webContents.send(ch, p); } catch {} };

async function lookup() { // последняя версия на GitHub + что уже установлено
  installed = core.readInstall(); repo = repo || readRepo();
  const out = { repo, configured: core.repoOk(repo), installed: installed ? { version: installed.version, dir: installed.dir } : null, defaultDir: core.pickRoot(core.defaultRoot()), version: app.getVersion() };
  if (!out.configured) return { ...out, error: '' };
  try { latest = await core.latest(repo, net); out.latest = { version: latest.version, size: latest.size, notes: latest.notes }; out.update = installed ? core.cmp(latest.version, installed.version) > 0 : false; }
  catch (e) { out.error = e.message; out.net = !!e.net; }
  return out;
}
handle('i:init', () => lookup());
handle('i:setRepo', (_e, r) => { r = String(r || '').trim().replace(/^https?:\/\/github\.com\//i, '').replace(/\.git$/i, '').replace(/\/+$/, ''); if (!core.repoOk(r)) return { ok: false, error: 'Укажите репозиторий в виде «владелец/название», например Ivan/TotemLauncher' }; repo = r; return { ok: true }; });
handle('i:browse', async (_e, cur) => {
  const r = await dialog.showOpenDialog(win, { title: 'Папка для установки TotemLauncher', defaultPath: String(cur || ''), properties: ['openDirectory', 'createDirectory'] });
  return r.canceled || !r.filePaths[0] ? null : core.pickRoot(r.filePaths[0]);
});
handle('i:pick', (_e, d) => core.pickRoot(String(d || '')));

const stat = (stage, percent, text, size = '') => send('i:progress', { stage, percent: Math.max(0, Math.min(100, Math.floor(percent))), text, size });
handle('i:start', async (_e, o) => {
  if (busy) return { ok: false, error: 'Установка уже идёт' }; if (!latest) return { ok: false, error: 'Сначала нужно узнать последнюю версию' };
  busy = true; ac = new AbortController(); const sig = ac.signal; doneInfo = null; createdRoot = null;
  let root, zip;
  try {
    root = installed ? installed.dir : core.pickRoot(String(o?.dir || core.defaultRoot())); // при обновлении папка не меняется
    if (!path.isAbsolute(root) || root.length > 200 || path.dirname(root) === root) throw new Error('Выберите папку внутри диска, например C:\\Games\\TotemLauncher');
    const existed = fs.existsSync(root); try { fs.mkdirSync(root, { recursive: true }); fs.writeFileSync(path.join(root, '.write-test'), '1'); fs.unlinkSync(path.join(root, '.write-test')); } catch (e) { throw new Error('В эту папку нельзя записывать (' + (e.code || e.message) + '). Выберите другую, например в профиле пользователя.'); }
    if (!existed) createdRoot = root;
    const need = (latest.size || 120e6) * 3; if (core.freeBytes(root) < need) throw new Error('Недостаточно места на диске: нужно около ' + core.fmtMb(need));
    stat('download', 0, 'Скачивание лаунчера…', '0 МБ из ' + core.fmtMb(latest.size));
    zip = path.join(os.tmpdir(), 'TotemLauncher-setup', latest.name);
    await core.download(latest, zip, { ...net, signal: sig, onProgress: (d, t) => stat('download', (d / (t || latest.size || 1)) * 70, 'Скачивание лаунчера…', `${core.fmtMb(d)} из ${core.fmtMb(t || latest.size)}`) });
    const dir = core.appDirOf(root, latest.version); stat('extract', 70, 'Распаковка файлов…', '');
    await core.extractZip(zip, dir, { signal: sig, onProgress: (d, t) => stat('extract', 70 + (t ? (d / t) * 28 : 0), 'Распаковка файлов…', `${core.fmtMb(d)} из ${core.fmtMb(t)}`) });
    const exe = path.join(dir, core.EXE); if (!fs.existsSync(exe)) throw new Error('В архиве нет ' + core.EXE);
    stat('finish', 99, 'Создание ярлыков…', ''); core.writeInstall(root, latest.version, repo);
    const sc = core.makeShortcuts(app, shell, exe, { desktop: true, startMenu: true }); core.cleanupOld(root, dir);
    try { fs.unlinkSync(zip); } catch {} installed = { dir: root, version: latest.version, appDir: dir, repo };
    doneInfo = { exe, dir, root, version: latest.version, shortcut: sc.desktop }; stat('done', 100, 'Установка завершена', ''); busy = false; return { ok: true, ...doneInfo };
  } catch (e) {
    busy = false; try { if (zip) { fs.unlinkSync(zip + '.part'); } } catch {}
    if (sig.aborted) { if (createdRoot) try { fs.rmSync(createdRoot, { recursive: true, force: true }); } catch {} return { ok: false, cancelled: true }; } // прервали: убираем за собой
    return { ok: false, error: e.message };
  }
});
ipcMain.on('i:cancel', (e) => { if (trusted(e)) ac?.abort(); });
ipcMain.on('i:finish', (e, launch) => {
  if (!trusted(e)) return;
  if (launch && doneInfo) { try { spawn(doneInfo.exe, [], { cwd: doneInfo.dir, detached: true, stdio: 'ignore' }).unref(); } catch {} }
  app.quit();
});
ipcMain.on('i:close', (e) => { if (trusted(e)) { ac?.abort(); app.quit(); } });
ipcMain.on('i:logo', (e) => { if (trusted(e)) shell.openExternal('https://github.com/' + repo).catch(() => {}); });

if (!app.requestSingleInstanceLock()) app.quit(); else app.whenReady().then(() => {
  const ses = require('electron').session.defaultSession; ses.setPermissionRequestHandler((_w, _p, cb) => cb(false));
  ses.webRequest.onBeforeRequest((d, cb) => cb(/^(file|data|devtools|chrome-extension):/.test(d.url) ? {} : { cancel: true })); // установщик сам ничего не грузит в странице
  createWindow();
});
app.on('window-all-closed', () => app.quit());
