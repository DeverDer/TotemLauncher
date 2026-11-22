const { app, BrowserWindow, ipcMain: rawIpc, shell, screen, dialog, nativeImage, clipboard, session } = require('electron');
const path = require('path'), fs = require('fs'), crypto = require('crypto');
const { pathToFileURL } = require('url');

// ---------- безопасность окон ----------
const UI_URL = pathToFileURL(path.join(__dirname, 'ui') + path.sep).href;
const trusted = (e) => { try { return String(e.senderFrame?.url || e.sender?.getURL() || '').startsWith(UI_URL); } catch { return false; } }; // команды принимаем только от наших страниц
const ipcMain = { // обёртка: чужие страницы/фреймы не могут вызывать ни один обработчик
  handle: (ch, fn) => rawIpc.handle(ch, (e, ...a) => { if (!trusted(e)) throw new Error('forbidden'); return fn(e, ...a); }),
  on: (ch, fn) => rawIpc.on(ch, (e, ...a) => { if (trusted(e)) fn(e, ...a); }),
};
// страницы грузят только свои файлы и картинки с известных CDN каталога; всё остальное блокируется
const IMG_HOSTS = /^(cdn\.modrinth\.com|media\.forgecdn\.net|[\w-]+\.forgecdn\.net|avatars\.githubusercontent\.com|launchercontent\.mojang\.com|(www\.)?minecraft\.net|[\w-]+\.minecraft\.net)$/; // + картинки новостей Minecraft
function hardenSession() {
  const ses = session.defaultSession;
  ses.setPermissionRequestHandler((_wc, _perm, cb) => cb(false)); ses.setPermissionCheckHandler(() => false);
  ses.webRequest.onBeforeRequest((d, cb) => {
    try { const u = new URL(d.url); if (['file:', 'data:', 'blob:', 'devtools:', 'chrome-extension:'].includes(u.protocol) || (u.protocol === 'https:' && d.resourceType === 'image' && IMG_HOSTS.test(u.hostname))) return cb({}); } catch {}
    cb({ cancel: true });
  });
}
const lockWeb = (wc) => { // нельзя уйти со страницы лаунчера, открыть новое окно или встроить webview
  wc.setWindowOpenHandler(() => ({ action: 'deny' }));
  wc.on('will-navigate', (e, url) => { if (!String(url).startsWith(UI_URL)) e.preventDefault(); });
  wc.on('will-redirect', (e, url) => { if (!String(url).startsWith(UI_URL)) e.preventDefault(); });
  wc.on('will-attach-webview', (e) => e.preventDefault());
};

const dataDir = () => app.getPath('userData');
const settingsFile = () => path.join(dataDir(), 'settings.json');
const logFile = () => path.join(dataDir(), 'logs', 'launcher.log');
const readSettings = () => {
  let t; try { t = fs.readFileSync(settingsFile(), 'utf8'); } catch { return {}; }
  try { const j = JSON.parse(t); return j && typeof j === 'object' && !Array.isArray(j) ? j : {}; }
  catch { try { fs.copyFileSync(settingsFile(), settingsFile() + '.broken'); } catch {} return {}; } // файл повреждён: сохраняем копию, чтобы аккаунты не пропали бесследно
};
const writeSettings = (s) => { fs.mkdirSync(dataDir(), { recursive: true }); const t = settingsFile() + '.tmp'; fs.writeFileSync(t, JSON.stringify(s, null, 2)); fs.renameSync(t, settingsFile()); };
const log = (m) => { try { fs.mkdirSync(path.dirname(logFile()), { recursive: true }); fs.appendFileSync(logFile(), `[${new Date().toISOString()}] ${m}\n`); } catch {} };

process.on('uncaughtException', (e) => log('uncaughtException: ' + (e.stack || e)));
process.on('unhandledRejection', (e) => log('unhandledRejection: ' + (e?.stack || e)));
let setupWin = null, loadWin = null, mainWin = null, run = 0, quitting = false;
let uiReadyFlag = false, uiReadyRes = null; // главное окно сообщает ui:ready, когда нарисован 3D-персонаж и загружены данные
ipcMain.on('ui:ready', (e) => { if (mainWin && !mainWin.isDestroyed() && e.sender === mainWin.webContents) { uiReadyFlag = true; uiReadyRes?.(); } });

function makeWin(w, h, file, opts = {}) {
  const wa = screen.getDisplayNearestPoint(screen.getCursorScreenPoint()).workArea;
  w = Math.min(w, wa.width); h = Math.min(h, wa.height);
  const win = new BrowserWindow({ width: w, height: h, x: Math.round(wa.x + (wa.width - w) / 2), y: Math.round(wa.y + (wa.height - h) / 2),
    icon: path.join(__dirname, 'ui', 'assets', 'app-icon.png'), frame: false, transparent: true, backgroundColor: '#00000000', hasShadow: false, show: false, resizable: false,
    webPreferences: { backgroundThrottling: !opts.main, preload: path.join(__dirname, 'preload.js'), contextIsolation: true, nodeIntegration: false, sandbox: true, webSecurity: true, allowRunningInsecureContent: false, webviewTag: false, spellcheck: false } });
  lockWeb(win.webContents); win.loadFile(path.join(__dirname, 'ui', file));
  return win;
}

function showSetup() {
  setupWin = makeWin(440, 380, 'setup.html');
  setupWin.once('ready-to-show', () => setupWin.show());
  // Closing the setup window = user declined to launch
  setupWin.on('closed', () => { if (setupWin) { setupWin = null; if (!loadWin) app.quit(); } });
}

function createShortcut() {
  const target = process.env.PORTABLE_EXECUTABLE_FILE || process.execPath;
  const lnk = path.join(app.getPath('desktop'), 'TotemLauncher.lnk');
  if (fs.existsSync(lnk)) {
    try { if (shell.readShortcutLink(lnk).target === target) return; } catch {}
  }
  if (!shell.writeShortcutLink(lnk, fs.existsSync(lnk) ? 'replace' : 'create',
      { target, cwd: path.dirname(target), description: 'TotemLauncher', icon: target, iconIndex: 0 }))
    throw new Error('Не удалось создать ярлык: ' + lnk);
}

ipcMain.handle('setup:run', (_e, { shortcut }) => {
  try { if (shortcut) createShortcut(); } catch (err) { log('shortcut: ' + err.message); return { ok: false, error: err.message }; }
  writeSettings({ ...readSettings(), setupDone: true });
  const old = setupWin; setupWin = null; if (old) old.close();
  startLoading();
  return { ok: true };
});

// Real startup stages; progress = completed stages / total
const stages = [
  ['Инициализация ресурсов интерфейса', async () => { for (const f of ['main.html', 'app.css', 'app.js', 'preload.js']) fs.accessSync(path.join(f === 'preload.js' ? __dirname : path.join(__dirname, 'ui'), f)); }],
  ['Загрузка настроек', async () => { const s = readSettings(); if (s.setupDone !== true) throw new Error('Первоначальная настройка не завершена'); }],
  ['Проверка папок лаунчера', async () => { for (const d of ['minecraft', 'logs', 'skins']) fs.mkdirSync(path.join(dataDir(), d), { recursive: true }); }],
  ['Проверка доступа к данным', async () => { const t = path.join(dataDir(), '.rw'); fs.writeFileSync(t, '1'); fs.unlinkSync(t); }],
  ['Подготовка основного окна', () => new Promise((res, rej) => {
      uiReadyFlag = false; uiReadyRes = null; mainWin = makeWin(1240, 780, 'main.html', { main: true });
      const guard = setTimeout(() => rej(new Error('Главное окно не отобразилось за 25 секунд (проблема с видеодрайвером?). Журнал: logs/launcher.log')), 25000); // раньше загрузка могла висеть вечно
      mainWin.once('ready-to-show', () => { clearTimeout(guard); res(); });
      mainWin.webContents.once('did-fail-load', (_e, c, d) => rej(new Error('UI: ' + d)));
      mainWin.on('closed', () => { mainWin = null; if (!quitting) app.quit(); });
      mainWin.on('restore', () => { try { mainWin.webContents.send('win:restored'); } catch {} });
  })],
  // экран загрузки остаётся, пока в главном окне не появится 3D-персонаж и не загрузятся списки (раньше окно показывалось пустым, и всё догружалось на глазах)
  ['Загрузка персонажа и интерфейса', () => new Promise((res) => {
      if (uiReadyFlag) return res();
      const t = setTimeout(() => { log('ui:ready не пришёл за 25 с — показываем окно как есть'); uiReadyRes = null; res(); }, 25000);
      uiReadyRes = () => { clearTimeout(t); uiReadyRes = null; res(); };
  })],
];

async function startLoading() {
  const id = ++run;
  if (loadWin) { loadWin.removeAllListeners('closed'); loadWin.destroy(); }
  loadWin = makeWin(520, 330, 'loading.html');
  loadWin.once('ready-to-show', () => loadWin.show());
  // User closes loading screen = abort launch; main window must never appear
  loadWin.on('closed', () => { loadWin = null; if (run === id && !mainWin?.isVisible()) { run++; quitting = true; mainWin?.destroy(); app.quit(); } });
  await new Promise((r) => loadWin.webContents.once('did-finish-load', r));
  const send = (c, p) => { if (run === id && loadWin) loadWin.webContents.send(c, p); };
  try {
    for (let i = 0; i < stages.length; i++) {
      if (run !== id) return;
      send('load:progress', { percent: Math.round((i / stages.length) * 100), stage: stages[i][0] });
      await stages[i][1]();
      if (run !== id) return;
    }
    send('load:progress', { percent: 100, stage: 'Готово' });
    await new Promise((r) => setTimeout(r, 350)); // let the bar visibly finish
    if (run !== id || !mainWin) return;
    mainWin.show(); const l = loadWin; loadWin = null; run++; l?.destroy();
    setTimeout(() => updater.startup().catch((e) => log('update startup: ' + e.message)), 3000); // проверка обновлений при каждом запуске (не блокирует интерфейс)
    if (app.isPackaged && readSettings().openAtLogin) { try { app.setLoginItemSettings({ openAtLogin: true, path: process.env.PORTABLE_EXECUTABLE_FILE || process.execPath }); } catch {} } // после обновления путь к exe меняется
  } catch (err) {
    log('startup error: ' + (err.stack || err)); mainWin?.destroy(); mainWin = null;
    send('load:error', err.message);
  }
}

ipcMain.on('load:retry', () => startLoading());
ipcMain.on('load:log', () => shell.openPath(logFile()));
// Сворачивание с анимацией: окно прозрачное и без рамки, системной анимации у него нет — интерфейс сам «уезжает» вниз (win:pre-min),
// затем окно сворачивается; при разворачивании (win:restored) появляется обратно.
function minimizeAnimated(w) {
  if (!w || w.isDestroyed() || w.isMinimized()) return;
  if (readSettings().anim === false) return w.minimize();
  try { w.webContents.send('win:pre-min'); } catch {}
  setTimeout(() => { if (!w.isDestroyed() && !w.isMinimized()) w.minimize(); }, 240);
}
ipcMain.on('win:min', (e) => minimizeAnimated(BrowserWindow.fromWebContents(e.sender)));
ipcMain.on('win:close', (e) => BrowserWindow.fromWebContents(e.sender)?.close());
// Режим «на весь экран»: окно занимает всю рабочую область экрана, повторное нажатие возвращает плавающее окно на прежнее место.
// Окно прозрачное и без рамки, поэтому системное maximize() не используем — меняем границы сами.
const winBack = new WeakMap(); // окно → границы до разворачивания
const winState = (w) => { try { w.webContents.send('win:state', { max: winBack.has(w) }); } catch {} };
function setWinMax(w, on) {
  if (!w || w.isDestroyed() || on === winBack.has(w)) return;
  const unlock = process.platform !== 'win32'; // на Windows resizable у прозрачного окна не трогаем (может сломать прозрачность)
  if (unlock) w.setResizable(true);
  try {
    if (on) { const b = w.getBounds(); winBack.set(w, b); w.setBounds(screen.getDisplayMatching(b).workArea); }
    else { const b = winBack.get(w); winBack.delete(w); w.setBounds(b); }
  } finally { if (unlock) w.setResizable(false); }
  winState(w);
}
ipcMain.on('win:max', (e) => { const w = BrowserWindow.fromWebContents(e.sender); if (w && w === mainWin) setWinMax(w, !winBack.has(w)); });
ipcMain.handle('win:state', (e) => ({ max: winBack.has(BrowserWindow.fromWebContents(e.sender)) }));
ipcMain.handle('versions:list', async () => {
  const r = await fetch('https://piston-meta.mojang.com/mc/game/version_manifest_v2.json', { signal: AbortSignal.timeout(20000) });
  if (!r.ok) throw new Error('Mojang: HTTP ' + r.status);
  return (await r.json());
});

const Game = require('./game');
const MS_LOCKED = true; // вход через Microsoft временно закрыт (код в auth.js сохранён)
const maxRamMb = () => Math.max(2048, Math.floor(require('os').totalmem() / 1048576) - 1024); // ОЗУ компьютера минус 1 ГБ системе
const curAcc = (s) => (s.accounts || []).find((a) => a.id === s.account) || null;
const defaults = () => { const s = readSettings(); return { ram: Math.min(4096, maxRamMb()), javaPath: '', anim: true, fullscreen: false, openAtLogin: false, minimizeOnPlay: false, jvmArgs: '', gameArgs: '', width: 0, height: 0, skinInGame: true, sharedOptions: true, bgHome: 'portal', themeHue: 272, themeSat: 1, bgBlur: false, bgBright: 100, notify: true, hoverFx: true, transFx: true, showAfterExit: true, playAura: true, skinCols: 4, newsRu: true, newsHide: false, newsW: 0, newsH: 0, ...s, playerName: curAcc(s)?.name || 'Player', maxRam: maxRamMb(), skinInGame: s.skinInGame !== false && curAcc(s)?.type !== 'ely', curseforgeKey: s.curseforgeKey || '' }; };
let lastDiag = null, wasPlaying = false, sessionStart = 0, lastTick = 0, playTimer = null;
const addPlay = () => { if (!lastTick) return; const now = Date.now(), sec = Math.round((now - lastTick) / 1000); lastTick = now; if (sec > 0) { const s = readSettings(); writeSettings({ ...s, playSeconds: (s.playSeconds || 0) + sec }); } }; // время в игре копится, пока открыт Minecraft
const Auth = require('./auth'), { safeStorage } = require('electron');
const auth = new Auth(path.join(dataDir(), 'auth.bin'), safeStorage);
const syncPlay = () => { // время в игре копится, пока открыто хотя бы одно окно Minecraft
  const on = game.running;
  if (on && !sessionStart) { sessionStart = lastTick = Date.now(); playTimer = setInterval(addPlay, 30000); }
  if (!on && sessionStart) { clearInterval(playTimer); addPlay(); sessionStart = lastTick = 0; }
};
const game = new Game(path.join(dataDir(), 'minecraft'), defaults, (s) => {
  syncPlay();
  mainWin?.webContents.send('game:state', sessionStart ? { ...s, since: sessionStart } : s);
  if (s.state === 'playing' && defaults().minimizeOnPlay) minimizeAnimated(mainWin);
  if (s.diag) { lastDiag = s.diag; if (mainWin && !mainWin.isDestroyed()) { if (mainWin.isMinimized()) mainWin.restore(); mainWin.show(); mainWin.focus(); } } // игра упала с понятной причиной: лаунчер открывается и объясняет, что случилось
  if (wasPlaying && (s.state === 'idle' || s.state === 'error') && !game.running && defaults().showAfterExit !== false) { mainWin?.restore(); mainWin?.focus(); } // «Открывать после выхода из игры» (по умолчанию включено)
  wasPlaying = s.state === 'playing';
}, log, () => getAuthFor(), (list) => { syncPlay(); mainWin?.webContents.send('wins:state', list); });
const { createUpdater } = require('./updater');
const updater = createUpdater({ app, shell, readSettings, writeSettings, log, send: (ch, p) => { try { mainWin?.webContents.send(ch, p); } catch {} }, isBusy: () => game.busy });
ipcMain.handle('upd:status', () => updater.status());
ipcMain.handle('upd:check', () => updater.check());
ipcMain.handle('upd:later', () => updater.later());
ipcMain.handle('upd:install', () => updater.install());
ipcMain.on('upd:cancel', () => updater.cancel());
const Instances = require('./instances');
const instances = new Instances(path.join(dataDir(), 'instances'), path.join(dataDir(), 'instances.json'));
const wrap = (f) => { try { return { ok: true, r: f() }; } catch (e) { return { ok: false, error: e.message }; } };
const VID = /^(?!\.)(?!.*\.\.)[\w.+ -]{1,60}$/; // id версии Minecraft: без слэшей и «..»
let catJobs = 0; // идущие сейчас загрузки из каталога: пока они не закончатся, игру запускать нельзя
const CAT_ACS = new Set(); // сигналы отмены идущих загрузок каталога
const catJob = async (f) => { catJobs++; const ac = new AbortController(); CAT_ACS.add(ac); try { return await f(ac.signal); } finally { CAT_ACS.delete(ac); catJobs = Math.max(0, catJobs - 1); } };
ipcMain.on('cat:cancel', () => { Game.setPaused(false); for (const ac of CAT_ACS) ac.abort(); }); // кнопка «Отмена» в окошке загрузок
ipcMain.on('dm:pause', (_e, on) => { Game.setPaused(!!on); }); // пауза всех загрузок (кнопка в окошке загрузок)
ipcMain.on('game:play', (_e, sel) => {
  if (catJobs > 0) return;
  if (sel?.k === 'i') { const i = instances.get(String(sel.id)); if (i) game.start(i.mc, true, { ...i, dir: instances.dir(i) }); }
  else if (sel?.k === 'v' && VID.test(String(sel.id))) game.start(String(sel.id), true);
});
ipcMain.handle('inst:list', () => instances.all());
ipcMain.handle('inst:create', async (_e, o) => { try { o = { name: String(o?.name ?? ''), mc: String(o?.mc ?? ''), loader: String(o?.loader ?? '') }; if (!VID.test(o.mc)) throw new Error('Неверная версия Minecraft'); if (o.loader !== 'vanilla') o.loaderVersion = await Game.loaderLatest(String(o.loader), String(o.mc)); return { ok: true, inst: instances.create(o) }; } catch (e) { return { ok: false, error: e.message }; } });
ipcMain.handle('inst:copy', (_e, id) => (game.active ? { ok: false, error: 'Идёт игра' } : wrap(() => instances.copy(String(id)))));
ipcMain.handle('inst:remove', (_e, id) => (game.active ? { ok: false, error: 'Идёт загрузка или игра' } : wrap(() => instances.remove(String(id)))));
ipcMain.on('inst:open', (_e, id, kind) => wrap(() => shell.openPath(instances.folder(instances.need(String(id)), kind))));
ipcMain.handle('files:list', async (_e, id, kind) => { try { return await instances.listAsync(String(id), kind); } catch { return []; } }); // без блокировки интерфейса: в сборке может быть 300+ модов
ipcMain.handle('inst:stats', (_e, id) => { try { return { ok: true, ...instances.stats(String(id)) }; } catch (e) { return { ok: false, error: e.message }; } });
ipcMain.handle('inst:rename', (_e, id, name) => wrap(() => instances.rename(String(id), name)));
ipcMain.handle('inst:fav', (_e, id, v) => wrap(() => instances.setFav(String(id), !!v)));
// ---------- диагностика и журнал ошибок ----------
const Diagnose = require('./diagnose'), ErrLog = require('./errlog'), errlog = new ErrLog(path.join(dataDir(), 'errors.json'));
ipcMain.handle('inst:check', async (_e, id) => { try { const i = instInfo(id), rows = await instances.listAsync(i.id, 'mods'); return { ok: true, count: rows.filter((r) => r.enabled).length, findings: Diagnose.analyzeStatic(rows, i, { ram: defaults().ram }) }; } catch (e) { return { ok: false, error: e.message }; } });
ipcMain.handle('clip:write', (_e, t) => { clipboard.writeText(String(t || '').slice(0, 200000)); return true; });
ipcMain.handle('err:list', () => errlog.list());
ipcMain.handle('err:remove', (_e, id) => { errlog.remove(String(id)); return errlog.list(); });
ipcMain.handle('err:clear', () => { errlog.clear(); return []; });
const readTail = (f, max = 300000) => { try { const st = fs.statSync(f), fd = fs.openSync(f, 'r'), len = Math.min(st.size, max), b = Buffer.alloc(len); fs.readSync(fd, b, 0, len, st.size - len); fs.closeSync(fd); return b.toString('utf8'); } catch { return ''; } };
game.onFail = async (info) => { // игра завершилась с ошибкой: собираем логи, ищем виновные моды, пишем в журнал и сообщаем окну
  const inst = info.inst ? instances.get(info.inst.id) : null; let crash = '';
  try { const cd = path.join(info.gameDir, 'crash-reports'), fresh = fs.readdirSync(cd).map((f) => ({ f, t: fs.statSync(path.join(cd, f)).mtimeMs })).filter((x) => Date.now() - x.t < 5 * 60000).sort((a, b) => b.t - a.t)[0]; if (fresh) crash = readTail(path.join(cd, fresh.f)); } catch {}
  const text = [crash, readTail(path.join(info.gameDir, 'logs', 'latest.log'), 200000), readTail(info.logFile, 200000), info.tail || ''].filter(Boolean).join('\n');
  let rows = []; if (inst) { try { rows = await instances.listAsync(inst.id, 'mods'); } catch {} }
  const findings = await Diagnose.analyzeFailure({ text, rows, inst: inst || { loader: 'vanilla', mc: info.id }, ram: info.ram, modsDir: inst ? path.join(instances.dir(inst), 'mods') : null, code: info.code });
  const top = findings.find((f) => f.level === 'error') || findings[0], rec = errlog.add({ kind: 'launch', title: top ? top.title : 'Игра завершилась с ошибкой', message: `Код завершения ${info.code}. ${info.why || ''}`.trim(), build: inst ? { id: inst.id, name: inst.name, mc: inst.mc, loader: inst.loader } : { id: '', name: info.label || info.id, mc: info.id, loader: 'vanilla' }, findings, raw: text });
  mainWin?.webContents.send('err:new', rec);
};
ipcMain.handle('files:add', async (_e, id, kind, paths, o = {}) => {
  if (!Array.isArray(paths) || !paths.length) { // диалог выбора: для ресурс-паков и шейдеров — .zip (папку выбирают отдельной кнопкой)
    const flt = kind === 'mods' ? [{ name: 'Моды (.jar)', extensions: ['jar'] }] : [{ name: 'Архивы (.zip)', extensions: ['zip'] }];
    const r = await dialog.showOpenDialog(mainWin, o.dirMode ? { properties: ['openDirectory', 'multiSelections'] } : { properties: ['openFile', 'multiSelections'], filters: flt }); if (r.canceled) return { ok: true }; paths = r.filePaths; }
  paths = paths.map(String);
  if (kind === 'shaderpacks' && instances.get(String(id))?.loader === 'vanilla') return { ok: false, error: 'В сборке Vanilla шейдеры не работают: нужен Iris или OptiFine.' };
  if (kind === 'mods' && instances.get(String(id))?.loader === 'vanilla') { const need = instances.neededLoader(paths); if (need) return { ok: true, needLoader: need, paths }; }
  if (!o.force) { try { const bad = instances.checkCompat(String(id), kind, paths); if (bad.length) return { ok: true, incompat: bad, paths }; } catch {} } // версия не подходит — сначала ошибка
  return wrap(() => instances.add(String(id), kind, paths));
});
ipcMain.handle('files:remove', (_e, id, kind, name) => wrap(() => { if (kind === 'mods') { try { instances.snapshot(String(id), 'Перед удалением ' + String(name).slice(0, 30)); } catch {} } instances.removeFile(String(id), kind, String(name)); }));
ipcMain.handle('files:archive', (_e, id, n) => wrap(() => instances.archive(String(id), String(n))));
ipcMain.handle('files:unarchive', (_e, id, n) => wrap(() => instances.unarchive(String(id), String(n))));
ipcMain.handle('inst:snap', (_e, id, label) => wrap(() => instances.snapshot(String(id), String(label))));
ipcMain.handle('inst:snaps', (_e, id) => { try { return instances.snapshots(String(id)); } catch { return []; } });
ipcMain.handle('inst:restore', (_e, id, sid) => (game.active ? { ok: false, error: 'Идёт загрузка или игра' } : wrap(() => instances.restore(String(id), String(sid)))));
ipcMain.handle('inst:snapdel', (_e, id, sid) => wrap(() => instances.delSnapshot(String(id), String(sid))));
ipcMain.handle('files:toggle', (_e, id, name) => wrap(() => instances.toggle(String(id), String(name))));
ipcMain.on('game:install', (_e, id) => { if (VID.test(String(id))) game.start(String(id), false); });
ipcMain.on('game:cancel', () => { Game.setPaused(false); game.cancel(); });
ipcMain.on('game:stop', () => game.stop());
// ---------- дополнительные окна игры ----------
ipcMain.handle('win:info', () => ({ ...game.ramInfo(), wins: game.list(), skinOn: readSettings().skinInGame !== false }));
ipcMain.on('win:stop', (_e, id) => { game.stopWin(String(id)); });
ipcMain.on('win:stopall', () => game.stopAll());
ipcMain.handle('win:open', (_e, o) => {
  try {
    const sel = o?.sel; let inst = null, vid = '';
    if (sel?.k === 'i') { inst = instances.get(String(sel.id)); if (!inst) throw new Error('Сборка не найдена'); } else if (sel?.k === 'v') { vid = String(sel.id); if (!VID.test(vid) || !game.installed().includes(vid)) throw new Error('Версия не установлена: откройте «Загрузки»'); } else throw new Error('Выберите версию или сборку');
    const s = readSettings(); let name, getAuth, isEly = false;
    if (o.mode === 'acc') { const a = (s.accounts || []).find((x) => x.id === o.acc); if (!a) throw new Error('Аккаунт не найден'); name = a.name; isEly = a.type === 'ely'; getAuth = isEly ? () => elyAuth(a) : async () => null; }
    else { if (!nickOk(o.nick)) throw new Error('Ник: от 1 до 15 символов'); name = o.nick.trim(); getAuth = async () => null; } // одноразовый ник: в список аккаунтов не попадает
    let skin = null;
    if (o.skin && !isEly) { skin = { wide: Buffer.from(String(o.skin.wide), 'base64'), slim: Buffer.from(String(o.skin.slim), 'base64') }; Skins.check(skin.wide); Skins.check(skin.slim); }
    const r = game.openWindow({ id: inst ? inst.mc : vid, inst: inst && { ...inst, dir: instances.dir(inst) }, title: inst ? inst.name : vid, name, getAuth, skin, skinOn: s.skinInGame !== false });
    return { ok: true, ...r };
  } catch (e) { return { ok: false, error: e.message }; }
});
ipcMain.handle('game:installed', () => game.installed());
// свой фон: один файл в <данные>/backgrounds (png/jpg/webp), копия выбранного пользователем изображения
const bgDir = () => path.join(dataDir(), 'backgrounds');
const bgFile = () => { try { const f = fs.readdirSync(bgDir()).find((n) => /^custom\.(png|jpg)$/.test(n)); return f ? path.join(bgDir(), f) : null; } catch { return null; } };
const bgUrl = () => { const f = bgFile(); if (!f) return ''; try { return pathToFileURL(f).href + '?v=' + Math.round(fs.statSync(f).mtimeMs); } catch { return ''; } };
ipcMain.handle('settings:get', () => ({ ...defaults(), bgCustomUrl: bgUrl() }));
ipcMain.handle('bg:pick', async () => {
  try {
    const r = await dialog.showOpenDialog(mainWin, { title: 'Свой фон', filters: [{ name: 'Изображения', extensions: ['png', 'jpg', 'jpeg', 'webp'] }], properties: ['openFile'] }); if (r.canceled || !r.filePaths[0]) return { ok: false, cancelled: true };
    const src = r.filePaths[0], st = fs.statSync(src); if (!st.isFile() || st.size > 30 * 1048576) throw new Error('Файл слишком большой (до 30 МБ)');
    const head = Buffer.alloc(12); const fd = fs.openSync(src, 'r'); try { fs.readSync(fd, head, 0, 12, 0); } finally { fs.closeSync(fd); }
    const png = head.subarray(0, 4).equals(Buffer.from([0x89, 0x50, 0x4e, 0x47])), jpg = head[0] === 0xff && head[1] === 0xd8 && head[2] === 0xff, webp = head.subarray(0, 4).toString('latin1') === 'RIFF' && head.subarray(8, 12).toString('latin1') === 'WEBP';
    if (!png && !jpg && !webp) throw new Error('Это не изображение PNG, JPG или WEBP');
    let img = nativeImage.createFromPath(src); if (img.isEmpty()) throw new Error('Не удалось открыть изображение');
    const sz = img.getSize(); if (sz.width < 320 || sz.height < 180) throw new Error('Изображение слишком маленькое (от 320×180)');
    if (sz.width > 2560) img = img.resize({ width: 2560, quality: 'best' }); // огромные картинки уменьшаем: меньше памяти и быстрее
    fs.mkdirSync(bgDir(), { recursive: true }); for (const n of fs.readdirSync(bgDir())) if (/^custom\./.test(n)) try { fs.unlinkSync(path.join(bgDir(), n)); } catch {}
    const ext = png ? 'png' : 'jpg', out = path.join(bgDir(), 'custom.' + ext); fs.writeFileSync(out, png ? img.toPNG() : img.toJPEG(92));
    writeSettings({ ...readSettings(), bgHome: 'custom' }); return { ok: true, url: bgUrl() };
  } catch (e) { return { ok: false, error: e.message }; }
});
ipcMain.handle('bg:clear', () => { try { if (fs.existsSync(bgDir())) for (const n of fs.readdirSync(bgDir())) if (/^custom\./.test(n)) fs.unlinkSync(path.join(bgDir(), n)); const w = readSettings(); if (w.bgHome === 'custom') writeSettings({ ...w, bgHome: 'portal' }); return { ok: true }; } catch (e) { return { ok: false, error: e.message }; } });
ipcMain.handle('settings:set', (_e, p) => {
  if (!p || typeof p !== 'object' || Array.isArray(p)) return { ok: false, error: 'Неверные настройки' };
  const c = {}, maxRam = maxRamMb();
  if ('ram' in p) { const r = Math.round(+p.ram); if (!(r >= 1024 && r <= maxRam)) return { ok: false, error: `Память: от 1024 до ${maxRam} МБ` }; c.ram = r; }
  if ('javaPath' in p) { const jp = p.javaPath; if (jp) { if (typeof jp !== 'string' || jp.length > 400 || !path.isAbsolute(jp) || !/^javaw?(\.exe)?$/i.test(path.basename(jp))) return { ok: false, error: 'Укажите файл java.exe или javaw.exe' }; let st; try { st = fs.statSync(jp); } catch {} if (!st?.isFile()) return { ok: false, error: 'Файл Java не найден' }; } c.javaPath = jp || ''; } // запуск произвольных программ через «путь к Java» запрещён
  for (const k of ['jvmArgs', 'gameArgs']) if (k in p) { if (typeof p[k] !== 'string' || p[k].length > 500 || /[\r\n]/.test(p[k])) return { ok: false, error: k + ': одна строка, до 500 символов' }; const bad = k === 'jvmArgs' ? Game.badJvm(p[k]) : ''; if (bad) return { ok: false, error: `Аргумент ${bad} запрещён: он позволяет подключать чужой код к игре` }; c[k] = p[k].trim(); }
  for (const k of ['width', 'height']) if (k in p) { const v = Math.round(+p[k] || 0); if (v && (v < 320 || v > 7680)) return { ok: false, error: 'Размер окна: 320–7680 или пусто' }; c[k] = v; }
  if ('curseforgeKey' in p) { const k = typeof p.curseforgeKey === 'string' ? require('./catalog').cleanKey(p.curseforgeKey) : null; if (k === null || !/^[\w$./+=-]{0,128}$/.test(k)) return { ok: false, error: 'Ключ CurseForge выглядит неверно: в нём лишние символы' }; c.curseforgeKey = k; }
  if ('bgHome' in p) { if (!['portal', 'village', 'cave', 'cabin', 'fireplace', 'sunset'].includes(p.bgHome) && !(p.bgHome === 'custom' && bgFile())) return { ok: false, error: 'Неизвестный фон' }; c.bgHome = p.bgHome; }
  if ('skinCols' in p) { const n = Math.round(+p.skinCols); if (!(n >= 2 && n <= 8)) return { ok: false, error: 'Скинов в ряд: от 2 до 8' }; c.skinCols = n; }
  if ('bgBright' in p) { const b = Math.round(+p.bgBright); if (!(b >= 30 && b <= 130)) return { ok: false, error: 'Яркость фона: 30–130 %' }; c.bgBright = b; }
  if ('themeSat' in p) { const v = Number(p.themeSat); if (!Number.isFinite(v) || v < 0 || v > 1) return { ok: false, error: 'Неверный цвет темы' }; c.themeSat = Math.round(v * 100) / 100; }
  if ('themeHue' in p) { const h = Number(p.themeHue); if (!Number.isFinite(h) || h < 0 || h > 360) return { ok: false, error: 'Неверный цвет темы' }; c.themeHue = Math.round(h) % 360; }
  for (const k of ['fullscreen', 'anim', 'openAtLogin', 'minimizeOnPlay', 'showAfterExit', 'skinInGame', 'sharedOptions', 'bgBlur', 'notify', 'hoverFx', 'transFx', 'playAura', 'newsRu', 'newsHide']) if (k in p) c[k] = !!p[k];
  for (const [k, lo, hi] of [['newsW', 300, 3000], ['newsH', 200, 3000]]) if (k in p) { const v = Math.round(+p[k] || 0); if (v && (v < lo || v > hi)) return { ok: false, error: 'Неверный размер окна новостей' }; c[k] = v; } // 0 = размер по умолчанию
  if ('msClientId' in p) { if (p.msClientId && !/^[0-9a-f]{8}(-[0-9a-f]{4}){3}-[0-9a-f]{12}$/i.test(p.msClientId)) return { ok: false, error: 'Client ID должен быть GUID' }; c.msClientId = p.msClientId; }
  if ('currentSkin' in p) { if (p.currentSkin && p.currentSkin !== 'steve' && !/^[0-9a-f]{12}$/.test(p.currentSkin)) return { ok: false, error: 'Неверный скин' }; c.currentSkin = p.currentSkin; }
  if ('catPrefs' in p) { const q = p.catPrefs || {}; // последний выбор в каталоге: тип, версия, загрузчик, сортировка, сборка
    const ok = (!q.type || CAT_TYPES.includes(q.type)) && (!q.mc || VID.test(String(q.mc))) && (!q.loader || CAT_LOADERS.includes(q.loader)) && (!q.sort || ['pop', 'new'].includes(q.sort)) && (!q.inst || /^[0-9a-f]{12}$/.test(String(q.inst)));
    if (!ok) return { ok: false, error: 'Неверные настройки каталога' }; c.catPrefs = { type: q.type || 'mod', mc: q.mc || '', loader: q.loader || '', sort: q.sort || 'pop', inst: q.inst || '' }; }
  if ('selected' in p) { const v = String(p.selected); if (v.length > 80) return { ok: false, error: 'Неверный выбор' }; c.selected = v; }
  writeSettings({ ...readSettings(), ...c });
  if ('openAtLogin' in c) app.setLoginItemSettings({ openAtLogin: c.openAtLogin, path: process.env.PORTABLE_EXECUTABLE_FILE || process.execPath });
  return { ok: true };
});
let loginAc = null;
ipcMain.handle('auth:status', () => (MS_LOCKED ? { loggedIn: false, locked: true } : auth.status()));
ipcMain.handle('auth:login', async () => {
  if (MS_LOCKED) return { ok: false, error: 'Вход через Microsoft временно закрыт' };
  const cid = defaults().msClientId;
  if (!cid) return { ok: false, error: 'Укажите Application (client) ID вашего приложения Azure' };
  if (loginAc) return { ok: false, error: 'Вход уже выполняется' };
  loginAc = new AbortController();
  try {
    return { ok: true, ...(await auth.login(cid, (c) => { mainWin?.webContents.send('auth:code', c); try { const vu = new URL(c.verification_uri); if (vu.protocol === 'https:' && /(^|\.)microsoft\.com$/.test(vu.hostname)) shell.openExternal(vu.href); } catch {} }, loginAc.signal)) };
  } catch (e) { log('auth: ' + e.message); return { ok: false, error: e.message === 'cancelled' ? 'Вход отменён' : e.message }; } finally { loginAc = null; }
});
ipcMain.on('auth:cancel', () => loginAc?.abort());
ipcMain.handle('auth:logout', () => { auth.logout(); return auth.status(); });
// Размер папки данных считаем АСИНХРОННО и небольшими пачками: синхронный обход тысяч файлов (ассеты, библиотеки, Java) замораживал лаунчер при открытии «Настроек»
async function dirSizeAsync(root) {
  let n = 0, level = [root];
  while (level.length) {
    const next = [];
    for (let i = 0; i < level.length; i += 16) await Promise.all(level.slice(i, i + 16).map(async (d) => {
      let ents; try { ents = await fs.promises.readdir(d, { withFileTypes: true }); } catch { return; }
      const files = []; for (const e of ents) { const p = path.join(d, e.name); if (e.isDirectory()) next.push(p); else if (e.isFile()) files.push(p); }
      for (let k = 0; k < files.length; k += 64) { const part = (await Promise.all(files.slice(k, k + 64).map((p) => fs.promises.stat(p).then((st) => st.size, () => 0)))).reduce((x, y) => x + y, 0); n += part; } // сначала дожидаемся суммы, потом прибавляем: «n += await …» теряет вклад параллельных задач
    }));
    level = next; await new Promise((r) => setImmediate(r)); // между уровнями папок отдаём управление интерфейсу
  }
  return n;
}
async function sweepAsync(root) { // удаляет недокачанные .part
  let n = 0; const walk = async (d) => { let ents; try { ents = await fs.promises.readdir(d, { withFileTypes: true }); } catch { return; }
    for (const e of ents) { const p = path.join(d, e.name); if (e.isDirectory()) await walk(p); else if (e.name.endsWith('.part')) { try { n += (await fs.promises.stat(p)).size; await fs.promises.unlink(p); } catch {} } } };
  await walk(root); return n;
}
let storageCache = null, storageJob = null;
ipcMain.handle('storage:info', async () => {
  if (storageCache && Date.now() - storageCache.t < 30000) return { path: dataDir(), bytes: storageCache.bytes };
  storageJob = storageJob || dirSizeAsync(dataDir()).then((b) => { storageCache = { bytes: b, t: Date.now() }; return b; }).finally(() => { storageJob = null; });
  return { path: dataDir(), bytes: await storageJob };
});
ipcMain.on('storage:open', () => shell.openPath(dataDir()));
ipcMain.handle('storage:clean', async () => {
  if (game.active) return { ok: false, error: 'Идёт загрузка или игра' };
  let n = await sweepAsync(path.join(dataDir(), 'minecraft'));
  try { const g = path.join(dataDir(), 'logs', 'game.log'); n += fs.statSync(g).size; fs.unlinkSync(g); } catch {}
  storageCache = null; return { ok: true, freed: n };
});
ipcMain.handle('inst:setLoader', async (_e, id, loader) => {
  try { const i = instances.need(String(id)); if (game.active) throw new Error('Идёт загрузка или игра'); instances.setLoader(i.id, String(loader), await Game.loaderLatest(String(loader), i.mc)); return { ok: true }; } catch (e) { return { ok: false, error: e.message }; }
});
ipcMain.handle('inst:install', (_e, id) => { const i = instances.get(String(id)); if (!i) return { ok: false, error: 'Сборка не найдена' }; if (game.active) return { ok: false, error: 'Лаунчер занят' }; game.start(i.mc, false, { ...i, dir: instances.dir(i) }); return { ok: true }; });
const Skins = require('./skins'), skins = new Skins(path.join(dataDir(), 'skins'));
const tryo = (f) => { try { return { ok: true, ...f() }; } catch (e) { return { ok: false, error: e.message }; } };
// Каталог скинов (v0.22): список/картинки/скачивание; сервер задаётся skinsApi в app-config.json
let APPCFG = {}; try { APPCFG = JSON.parse(fs.readFileSync(path.join(__dirname, 'app-config.json'), 'utf8')); } catch {}
const skincat = require('./skincat').create({ dir: dataDir(), skins, api: APPCFG.skinsApi, test: !app.isPackaged, log });
ipcMain.handle('skcat:list', async (_e, force) => { try { return await skincat.list(!!force); } catch (e) { return { ok: false, error: e.message }; } });
ipcMain.handle('skcat:png', async (_e, ids) => { try { return { ok: true, r: await skincat.pngs(Array.isArray(ids) ? ids.slice(0, 40).map(String) : []) }; } catch (e) { return { ok: false, error: e.message }; } });
ipcMain.handle('skcat:download', async (_e, id) => { try { return { ok: true, ...(await skincat.download(String(id))) }; } catch (e) { return { ok: false, error: e.message }; } });
ipcMain.handle('skins:list', () => skins.list());
ipcMain.handle('skin:ely', async (_e, nick) => { try { return { ok: true, ...(await require('./ely').skin(nick)) }; } catch (e) { return { ok: false, error: e.message }; } });
ipcMain.handle('skins:put', (_e, o) => tryo(() => ({ entry: skins.put(o) })));
ipcMain.handle('skins:remove', (_e, id) => tryo(() => { skins.remove(String(id)); return {}; }));
ipcMain.handle('skins:import', async () => {
  const r = await dialog.showOpenDialog(mainWin, { filters: [{ name: 'Изображения', extensions: ['png', 'jpg', 'jpeg', 'webp', 'gif', 'bmp'] }], properties: ['openFile'] }); if (r.canceled) return { ok: false };
  return tryo(() => ({ name: path.parse(r.filePaths[0]).name.slice(0, 40), ...Skins.readImage(r.filePaths[0]) }));
});
ipcMain.handle('skins:export', async (_e, name, data) => {
  try { const b = Buffer.from(String(data), 'base64'); Skins.check(b); const r = await dialog.showSaveDialog(mainWin, { defaultPath: String(name || 'skin').replace(/[\\/:*?"<>|]/g, '_') + '.png', filters: [{ name: 'PNG', extensions: ['png'] }] });
    if (!r.canceled) fs.writeFileSync(r.filePath, b); return { ok: true }; } catch (e) { return { ok: false, error: e.message }; }
});
const FM = require('./fm'), fm = new FM(dataDir());
const idle = () => { if (game.active) throw new Error('Идёт загрузка или игра: файлы заняты'); };
ipcMain.handle('fm:list', (_e, rel) => tryo(() => ({ r: fm.list(rel) })));
ipcMain.handle('fm:mkdir', (_e, rel, n) => tryo(() => { fm.mkdir(rel, n); return {}; }));
ipcMain.handle('fm:rename', (_e, rel, n) => tryo(() => { idle(); fm.rename(rel, n); return {}; }));
ipcMain.handle('fm:copy', (_e, rel, to) => tryo(() => { fm.copy(rel, to); return {}; }));
ipcMain.handle('fm:move', (_e, rel, to) => tryo(() => { idle(); fm.move(rel, to); return {}; }));
ipcMain.handle('fm:remove', (_e, rel) => tryo(() => { idle(); fm.remove(rel); return {}; }));
ipcMain.handle('fm:add', async (_e, to, paths, dirMode) => {
  try { if (!Array.isArray(paths) || !paths.length) { const r = await dialog.showOpenDialog(mainWin, { properties: dirMode ? ['openDirectory', 'multiSelections'] : ['openFile', 'multiSelections'] }); if (r.canceled) return { ok: true }; paths = r.filePaths; }
    return { ok: true, n: fm.add(to, paths.map(String)) }; } catch (e) { return { ok: false, error: e.message }; }
});
const OPEN_OK = /\.(txt|log|json|md|toml|cfg|conf|properties|ini|yml|yaml|png|jpe?g|gif|webp|bmp|nbt|dat)$/i; // остальное (exe, jar, bat, lnk…) не запускаем, а показываем в папке
ipcMain.on('fm:open', (_e, rel) => { try { const p = fm.abs(rel), st = fs.statSync(p); if (st.isDirectory() || OPEN_OK.test(p)) shell.openPath(p); else shell.showItemInFolder(p); } catch {} });
// Аккаунты (пока только локальные): смена аккаунта меняет только ник, версии и настройки общие
const nickOk = (n) => typeof n === 'string' && n.trim().length >= 1 && [...n.trim()].length <= 15;
ipcMain.handle('acc:list', () => { const s = readSettings(); return { accounts: (s.accounts || []).map((a) => ({ id: a.id, name: a.name, type: a.type })), current: s.account || null }; });
ipcMain.handle('acc:add', (_e, name) => {
  if (!nickOk(name)) return { ok: false, error: 'Ник: от 1 до 15 символов' };
  const s = readSettings(), a = { id: crypto.randomBytes(6).toString('hex'), name: name.trim(), type: 'local' };
  writeSettings({ ...s, accounts: [...(s.accounts || []), a], account: a.id }); return { ok: true };
});
ipcMain.handle('acc:switch', (_e, id) => { const s = readSettings(); if (!(s.accounts || []).some((a) => a.id === id)) return { ok: false, error: 'Аккаунт не найден' }; writeSettings({ ...s, account: id }); return { ok: true }; });
ipcMain.handle('acc:remove', (_e, id) => {
  const s = readSettings(), left = (s.accounts || []).filter((a) => a.id !== id), gone = (s.accounts || []).find((a) => a.id === id);
  if (gone?.type === 'ely' && gone.tok) { try { require('./ely').invalidate(safeStorage.decryptString(Buffer.from(gone.tok, 'base64')), gone.clientToken); } catch {} }
  writeSettings({ ...s, accounts: left, account: s.account === id ? left[0]?.id || null : s.account }); return { ok: true };
});
let availCache = null;
ipcMain.handle('loaders:avail', async () => { // какие загрузчики есть для каких версий Minecraft
  if (availCache) return availCache;
  const j = async (u) => { try { const r = await fetch(u, { headers: { 'User-Agent': 'TotemLauncher' }, signal: AbortSignal.timeout(15000) }); return r.ok ? await r.json() : null; } catch { return null; } };
  const [fo, fa, ne] = await Promise.all([j('https://files.minecraftforge.net/net/minecraftforge/forge/promotions_slim.json'), j('https://meta.fabricmc.net/v2/versions/game'), j('https://maven.neoforged.net/api/maven/versions/releases/net/neoforged/neoforge')]);
  const neo = (ne?.versions || []).filter((v) => !/alpha|beta/.test(v)).map((v) => { const m = /^(\d+)\.(\d+)\./.exec(v); return !m ? null : +m[1] >= 26 ? `${m[1]}.${m[2]}` : m[2] === '0' ? `1.${m[1]}` : `1.${m[1]}.${m[2]}`; }).filter(Boolean);
  // ok = ответили все три сервера. Если нет интернета, список неполный и ok=false: интерфейс сам запросит его снова, когда сеть появится (раньше загрузчики возвращались только после перезапуска лаунчера)
  const r = { forge: [...new Set(Object.keys(fo?.promos || {}).map((k) => k.replace(/-(latest|recommended)$/, '')))], fabric: (fa || []).map((x) => x.version), neoforge: [...new Set(neo)], ok: !!(fo && fa && ne) };
  if (r.ok) availCache = r; return r;
});
ipcMain.on('ext:optifine', () => shell.openExternal('https://optifine.net/downloads')); // OptiFine скачивается вручную с сайта автора
app.on('before-quit', addPlay);
// ---------- аккаунты Ely.by, каталог ----------
const Ely = require('./ely'), Cat = require('./catalog'), Diag = require('./diag');
async function elyAuth(a) { // свежий токен + authlib-injector
  const tok = safeStorage.decryptString(Buffer.from(a.tok, 'base64')), f = await Ely.fresh({ uuid: a.uuid, name: a.name, token: tok, clientToken: a.clientToken });
  if (f.token !== tok) { const s = readSettings(); writeSettings({ ...s, accounts: s.accounts.map((x) => (x.id === a.id ? { ...x, tok: safeStorage.encryptString(f.token).toString('base64') } : x)) }); }
  return { name: a.name, uuid: a.uuid, token: f.token, agent: { jar: await Ely.ensureAgent(path.join(dataDir(), 'authlib')), url: Ely.INJ } };
}
async function getAuthFor() { const a = curAcc(readSettings()); if (a?.type === 'ely') return elyAuth(a); return MS_LOCKED ? null : auth.token(defaults().msClientId); }
ipcMain.handle('ely:login', async (_e, u, p, t) => {
  try { if (!safeStorage.isEncryptionAvailable()) return { ok: false, error: 'Шифрование Windows недоступно: токен Ely.by нельзя безопасно сохранить' };
    const a = await Ely.login(String(u), String(p), t ? String(t) : ''), s = readSettings(), acc = { id: crypto.randomBytes(6).toString('hex'), name: a.name, type: 'ely', uuid: a.uuid, clientToken: a.clientToken, tok: safeStorage.encryptString(a.token).toString('base64') };
    writeSettings({ ...s, accounts: [...(s.accounts || []).filter((x) => !(x.type === 'ely' && x.uuid === a.uuid)), acc], account: acc.id }); return { ok: true };
  } catch (e) { return { ok: false, error: e.message, need2fa: !!e.twofa }; }
});
const WEB_OK = /(^|\.)(aka\.ms|curseforge\.com|modrinth\.com|optifine\.net|ely\.by|minecraft\.net|mojang\.com)$/;
const safeWeb = (u) => { try { const x = new URL(String(u)); if (x.protocol !== 'https:' || x.username || x.password || x.port || !WEB_OK.test(x.hostname) || x.href.length > 600) return null; return x.href; } catch { return null; } }; // только https и наши сайты
ipcMain.on('ext:url', (_e, u) => { const h = safeWeb(u); if (h) openWeb(h); });
// «Нет интернета» только если сеть действительно недоступна (проверяем двумя серверами); иначе показываем настоящую причину
const isCancel = (e) => e?.message === 'cancelled' || e?.name === 'AbortError';
const catErr = async (e) => isCancel(e) ? { ok: false, cancelled: true, error: 'cancelled' } : ({ ok: false, error: e.message, offline: !!e.net && !(await Cat.online()), needKey: !!e.needKey, cfAuth: !!e.cfAuth, manual: e.manual || null });
const iconOk = (u) => { try { const x = new URL(String(u || '')); return x.protocol === 'https:' && IMG_HOSTS.test(x.hostname) ? x.href : ''; } catch { return ''; } };
const CAT_TYPES = ['mod', 'resourcepack', 'shader', 'datapack', 'modpack', 'map'], CAT_LOADERS = ['', 'forge', 'fabric', 'neoforge', 'quilt'];
const catIn = (o) => { // всё, что приходит из интерфейса в каталог, приводим к безопасному виду
  if (!o || typeof o !== 'object') throw new Error('Неверный запрос');
  const id = o.id == null ? '' : String(o.id), mc = String(o.mc || ''), type = String(o.type || 'mod'), loader = String(o.loader || '');
  if (id && !/^[\w.-]{1,64}$/.test(id)) throw new Error('Неверный идентификатор проекта');
  if (!CAT_TYPES.includes(type)) throw new Error('Неизвестный тип');
  if (mc && !VID.test(mc)) throw new Error('Неверная версия Minecraft');
  if (!CAT_LOADERS.includes(loader)) throw new Error('Неизвестный загрузчик');
  return { src: o.src === 'cf' ? 'cf' : 'mr', id, type, mc, loader, q: String(o.q || '').slice(0, 100), sort: o.sort === 'new' ? 'new' : 'pop', mapCat: String(o.mapCat || '').slice(0, 20), offset: Math.max(0, Math.min(10000, Math.floor(+o.offset) || 0)), icon: iconOk(o.icon), deps: !!o.deps, world: String(o.world || '').slice(0, 120), inst: o.inst == null ? '' : String(o.inst), title: String(o.title || '').slice(0, 80) };
};
const instInfo = (id) => { const i = instances.get(String(id)); if (!i) throw new Error('Сборка не найдена'); return { ...i, dir: instances.dir(i) }; };
const prog = (r) => mainWin?.webContents.send('cat:progress', { text: r.op, pct: r.total ? Math.floor((r.done / r.total) * 100) : 0, files: r.files || 0, of: r.filesTotal || 0, speed: r.speed || 0 });
const idleOnly = () => { if (game.active) throw new Error('Игра запущена: закройте её перед установкой'); };
ipcMain.handle('cat:search', async (_e, o) => { try { return { ok: true, ...(await Cat.search({ ...catIn(o), cfKey: defaults().curseforgeKey })) }; } catch (e) { return await catErr(e); } });
ipcMain.handle('cat:project', async (_e, o) => { try { return { ok: true, p: await Cat.project({ ...catIn(o), cfKey: defaults().curseforgeKey }) }; } catch (e) { return await catErr(e); } });
const VANILLA_OK = ['resourcepack', 'datapack', 'map'];
const vanillaGuard = (i, type) => { if (i.loader === 'vanilla' && !VANILLA_OK.includes(type)) throw new Error('В сборке Vanilla можно ставить только ресурс-паки, датапаки и карты. Для модов и шейдеров создайте сборку с Fabric, Forge или NeoForge.'); };
ipcMain.handle('cat:plan', async (_e, o) => { try { o = catIn(o); const i = instInfo(o.inst); vanillaGuard(i, o.type); return { ok: true, ...(await Cat.plan({ ...o, mc: i.mc, loader: i.loader, cfKey: defaults().curseforgeKey })) }; } catch (e) { return await catErr(e); } });
ipcMain.handle('cat:install', async (_e, o) => { try { idleOnly(); o = catIn(o); const i = instInfo(o.inst); vanillaGuard(i, o.type); if (o.type !== 'modpack' && Cat.installedKeys(i.dir).includes(`${o.src === 'cf' ? 'cf' : 'mr'}:${o.id}${o.type === 'datapack' ? '@' + o.world : ''}`)) return { ok: false, error: 'Уже скачано в сборку «' + i.name + '»' }; const r = await catJob((sg) => Cat.install({ ...o, mc: i.mc, loader: i.loader, cfKey: defaults().curseforgeKey }, i.dir, prog, sg)); return { ok: true, ...r, note: o.type === 'shader' ? (await catJob((sg) => Cat.shaderSupport(i, prog, sg))).note : '' }; } catch (e) { return await catErr(e); } });
ipcMain.handle('cat:pack', async (_e, o) => { try { o = catIn(o); return { ok: true, inst: await catJob((sg) => Cat.installPack({ id: o.id, title: o.title, mc: o.mc, loader: o.loader }, instances, prog, sg)) }; } catch (e) { return await catErr(e); } });
// ---- обмен сборкой по коду (src/share.js): код делает только сборка из каталога; по коду друг получает те же версии файлов ----
const Share = require('./share');
const shareLoader = (p) => (p.loader === 'vanilla' ? '' : !app.isPackaged && process.env.TOTEM_MR_BASE ? 'test' : Game.loaderLatest(p.loader, p.mc));
ipcMain.handle('share:make', async (_e, id) => { try {
  const i = instInfo(id), r = await Cat.shareCollect(i), p = r.payload, n = Share.count(p);
  if (!n) return { ok: false, error: i.loader === 'vanilla' && !r.manual.length ? 'В этой сборке нет файлов из каталога.' : 'В этой сборке нет файлов из каталога. Поделиться можно только сборкой, собранной из каталога: добавьте моды, ресурс-паки или шейдеры через вкладку «Каталог».' };
  return { ok: true, code: Share.encode(p), stats: { mods: p.mods.length + p.modsOff.length, off: p.modsOff.length, resourcepacks: p.resourcepacks.length, shaders: p.shaders.length }, manual: r.manual.slice(0, 8), manualCount: r.manual.length };
} catch (e) { return await catErr(e); } });
ipcMain.handle('share:peek', (_e, code) => { try { const p = Share.decode(String(code ?? '')); return { ok: true, info: { name: p.name, mc: p.mc, loader: p.loader, mods: p.mods.length + p.modsOff.length, off: p.modsOff.length, resourcepacks: p.resourcepacks.length, shaders: p.shaders.length } }; } catch (e) { return { ok: false, error: e.message }; } });
ipcMain.handle('share:import', async (_e, o) => { try { idleOnly(); const p = Share.decode(String(o?.code ?? '')); if (!VID.test(p.mc)) throw new Error('Неверная версия Minecraft'); const name = String(o?.name ?? '').replace(/[\u0000-\u001f\u202a-\u202e]/g, '').trim().slice(0, 40); const loaderVersion = await shareLoader(p);
  return { ok: true, ...(await catJob((sg) => Cat.shareInstall(p, { name, loaderVersion }, instances, prog, sg))) }; } catch (e) { return await catErr(e); } });
ipcMain.handle('cat:boost', async (_e, id) => { try { idleOnly(); const bi = instInfo(id); vanillaGuard(bi, 'mod'); return { ok: true, ...(await catJob((sg) => Cat.boost(bi, prog, sg))) }; } catch (e) { return await catErr(e); } });
ipcMain.handle('cat:installed', () => { const r = {}; for (const i of instances.all()) { try { r[i.id] = Cat.installedKeys(instances.dir(i)); } catch { r[i.id] = []; } } return { ok: true, r }; });
// ---------- новости Minecraft (главная) ----------
const News = require('./news'), NID = News.NID;
const news = News.create({ dir: dataDir(), log, online: () => Cat.online(), translateOn: () => defaults().newsRu !== false, base: app.isPackaged ? '' : undefined });
ipcMain.handle('news:list', (_e, force) => news.list(!!force));
ipcMain.handle('news:tr', async (_e, ids) => { try { return { ok: true, r: await news.tr(Array.isArray(ids) ? ids.slice(0, 60).map(String).filter((x) => NID.test(x)) : []) }; } catch (e) { return { ok: false, error: e.message }; } });
ipcMain.handle('news:imgs', async (_e, ids) => { try { return { ok: true, r: await news.imgs(Array.isArray(ids) ? ids.slice(0, 40).map(String).filter((x) => NID.test(x)) : []) }; } catch (e) { return { ok: false, error: e.message }; } });
ipcMain.handle('news:item', (_e, id) => (NID.test(String(id)) ? news.item(String(id)) : { ok: false, error: 'Неверная новость' }));
// ---------- «Бурмалдец»: ИИ-помощник по сборкам (вкладки «Каталог» и «Сборки») ----------
if (!app.isPackaged) Cat.setTestBase(process.env.TOTEM_MR_BASE); // тестовый «Modrinth» — только из исходников
const ai = require('./ai').create({ dir: dataDir(), log, Cat, cfKey: () => defaults().curseforgeKey, base: app.isPackaged ? '' : undefined });
const AID = /^c[0-9a-f]{10}$/, AMID = /^m[0-9a-f]{10}$/;
ipcMain.handle('ai:list', () => ai.list());
ipcMain.handle('ai:get', (_e, id) => (AID.test(String(id)) ? ai.get(String(id)) : null));
ipcMain.handle('ai:del', (_e, id) => (AID.test(String(id)) ? ai.remove(String(id)) : { ok: false }));
ipcMain.handle('ai:clear', () => ai.clearAll());
ipcMain.handle('ai:send', (_e, o) => ai.send({ chat: o?.chat && AID.test(String(o.chat)) ? String(o.chat) : null, text: typeof o?.text === 'string' ? o.text : '', retry: !!o?.retry }, (t) => { try { mainWin?.webContents.send('ai:status', String(t).slice(0, 80)); } catch {} }));
ipcMain.on('ai:cancel', () => ai.cancel());
ipcMain.handle('ai:install', async (_e, o) => { // установка предложенной сборки: одно задание в окошке загрузок (пауза/отмена работают как у каталога)
  try { idleOnly(); if (!AID.test(String(o?.chat)) || !AMID.test(String(o?.msg))) throw new Error('Неверный запрос'); return { ok: true, ...(await catJob((sg) => ai.install(String(o.chat), String(o.msg), { instances, Game, prog, signal: sg, loaderLatest: !app.isPackaged && process.env.TOTEM_AI_BASE ? async () => 'test' : undefined }, Array.isArray(o.skip) ? o.skip.slice(0, 600).map(String).filter((x) => /^[\w.-]{1,64}$/.test(x)) : []))) }; }
  catch (e) { return await catErr(e); }
});
ipcMain.handle('deps:install', async (_e, o) => { // установить моды-зависимости, которых не хватило игре (id берутся из журнала игры)
  try { idleOnly(); const i = instInfo(String(o?.inst ?? '')), ids = (Array.isArray(o?.ids) ? o.ids : []).slice(0, 30).map((x) => String(x).toLowerCase()).filter((x) => /^[a-z0-9_.\-]{2,64}$/.test(x)); if (!ids.length) throw new Error('Нет модов для установки');
    vanillaGuard(i, 'mod'); return { ok: true, ...(await catJob((sg) => Cat.installDeps([...new Set(ids)], { mc: i.mc, loader: i.loader }, i.dir, prog, sg))) }; }
  catch (e) { return await catErr(e); }
});
// Окно «Игра закрылась с ошибкой»: применяется только исправление из последнего разбора (id приходит из окна, параметры — нет)
ipcMain.handle('diag:fix', (_e, o) => {
  try {
    if (game.active) throw new Error('Идёт загрузка или игра — закройте её и повторите');
    const d = lastDiag, id = String(o?.fix ?? ''); if (!d || d.inst !== String(o?.inst)) throw new Error('Разбор ошибки устарел — запустите игру ещё раз');
    const fix = (d.fixes || []).find((f) => f.id === id); if (!fix || fix.url) throw new Error('Такого исправления нет');
    const i = instInfo(d.inst);
    return { ok: true, ...Diag.apply(fix, { instDir: i.dir, versionsDir: game.dirs.versions, inst: i, setSettings: (p) => writeSettings({ ...readSettings(), ...p }), snapshot: (l) => instances.snapshot(i.id, l) }) };
  } catch (e) { return { ok: false, error: e.message }; }
});
ipcMain.on('diag:log', (_e, id) => wrap(() => { const d = instances.dir(instances.need(String(id))), l = path.join(d, 'logs'); shell.openPath(fs.existsSync(l) ? l : d); }));
// Карты, которые автор разрешил скачивать только с сайта CurseForge: лаунчер открывает страницу, ждёт .zip в «Загрузках» и сам ставит мир в сборку
ipcMain.handle('cat:manual', async (_e, o) => {
  try {
    idleOnly(); const i = instInfo(String(o?.inst ?? '')); vanillaGuard(i, 'map'); const url = safeWeb(o?.url), id = String(o?.id ?? ''); if (!url || !/^\d{1,12}$/.test(id)) throw new Error('Неверная ссылка на карту');
    const title = String(o?.title || 'Карта').slice(0, 80), dl = app.getPath('downloads'), since = Date.now() - 4000, tried = new Set(), sizes = new Map(); openWeb(url);
    return { ok: true, ...(await catJob(async (sg) => {
      prog({ op: 'Скачайте файл карты на сайте — лаунчер подхватит его из «Загрузок»', done: 0, total: 0, files: 0, filesTotal: 0, speed: 0 });
      for (let t = 0; t < 450; t++) { // до 15 минут, проверка раз в 2 секунды
        await new Promise((r) => setTimeout(r, 2000)); if (sg.aborted) throw new Error('cancelled');
        let names = []; try { names = fs.readdirSync(dl); } catch {}
        for (const n of names) {
          if (!/\.zip$/i.test(n) || tried.has(n)) continue; const p = path.join(dl, n); let st; try { st = fs.statSync(p); } catch { continue; }
          if (!st.isFile() || st.mtimeMs < since || st.size < 1024) continue;
          if (sizes.get(n) !== st.size) { sizes.set(n, st.size); continue; } // размер ещё меняется — браузер дописывает файл
          tried.add(n);
          try { const w = path.basename(Cat.extractWorld(p, path.join(i.dir, 'saves'), n)); Cat.record(i.dir, [{ key: 'cf:' + id, folder: 'saves', file: w, title }]); return { installed: [w] }; } catch { /* это не карта — ждём дальше */ }
        }
      }
      throw new Error('Файл карты не появился в папке «Загрузки» за 15 минут');
    })) };
  } catch (e) { return await catErr(e); }
});
ipcMain.handle('cf:check', async (_e, key) => { try { await Cat.cfCheck(key); return { ok: true }; } catch (e) { return await catErr(e); } });
ipcMain.handle('shortcut:create', () => tryo(() => { createShortcut(); return {}; }));
ipcMain.handle('skins:apply', (_e, wide, slim) => tryo(() => { const w = Buffer.from(String(wide), 'base64'), s = Buffer.from(String(slim), 'base64'); Skins.check(w); Skins.check(s);
  const dir = path.join(dataDir(), 'skin-active'); fs.mkdirSync(dir, { recursive: true }); fs.writeFileSync(path.join(dir, 'wide.png'), w); fs.writeFileSync(path.join(dir, 'slim.png'), s); return {}; }));
const ShotsM = require('./shots'), shots = new ShotsM(dataDir(), instances);
ipcMain.handle('shots:list', () => tryo(() => ({ r: shots.list() })));
ipcMain.handle('shots:thumb', (_e, rel) => { try { const p = shots.abs(rel), st = fs.statSync(p), tf = path.join(dataDir(), 'thumbs', crypto.createHash('sha1').update(p + st.mtimeMs).digest('hex') + '.jpg');
  if (!fs.existsSync(tf)) { const img = nativeImage.createFromPath(p); if (img.isEmpty()) return null; fs.mkdirSync(path.dirname(tf), { recursive: true }); fs.writeFileSync(tf, img.resize({ width: 360, quality: 'good' }).toJPEG(80)); } return pathToFileURL(tf).href; } catch { return null; } });
ipcMain.handle('shots:full', (_e, rel) => { try { return pathToFileURL(shots.abs(rel)).href; } catch { return null; } });
ipcMain.handle('shots:rename', (_e, rel, n) => tryo(() => { shots.rename(rel, n); return {}; }));
ipcMain.handle('shots:remove', async (_e, rel) => { try { const p = shots.abs(rel); try { await shell.trashItem(p); } catch { fs.unlinkSync(p); } return { ok: true }; } catch (e) { return { ok: false, error: e.message }; } });
ipcMain.handle('shots:save', async (_e, rel) => { try { const p = shots.abs(rel), r = await dialog.showSaveDialog(mainWin, { defaultPath: path.basename(p) }); if (!r.canceled) fs.copyFileSync(p, r.filePath); return { ok: true }; } catch (e) { return { ok: false, error: e.message }; } });
ipcMain.on('shots:reveal', (_e, rel) => { try { shell.showItemInFolder(shots.abs(rel)); } catch {} });
// Открытие ссылок: сначала браузер по умолчанию, затем системные запасные способы, в крайнем случае — копирование в буфер
async function openWeb(url) {
  try { await shell.openExternal(url); return true; } catch {}
  try { require('child_process').execFile('explorer.exe', [url], () => {}); return true; } catch {} return false; // запасной путь без cmd: символы вроде & не могут стать командой
}
const tgInstalled = () => new Promise((res) => require('child_process').execFile('reg', ['query', 'HKEY_CLASSES_ROOT\\tg\\shell\\open\\command', '/ve'], { windowsHide: true, timeout: 3000 }, (e, out) => {
  if (e) return res(false); const m = /"([^"]+\.exe)"/i.exec(String(out)) || /REG_SZ\s+(\S+\.exe)/i.exec(String(out)); res(!!m && fs.existsSync(m[1])); })); // ключ есть и программа реально установлена
ipcMain.handle('tg:open', async () => {
  const URL_ = 'https://t.me/TotemLauncher';
  if (await tgInstalled()) { try { await shell.openExternal('tg://resolve?domain=TotemLauncher'); return { ok: true, app: true }; } catch {} }
  if (await openWeb(URL_)) return { ok: true, app: false };
  clipboard.writeText(URL_); return { ok: false, error: 'Не удалось открыть браузер. Ссылка скопирована в буфер обмена: ' + URL_ };
});
app.on('before-quit', () => game.cancelAll());

// ---- полный сброс данных лаунчера: основной лаунчер закрывается, отдельный процесс с маленьким окном удаляет папку данных и запускает лаунчер заново ----
const Reset = require('./reset');
ipcMain.handle('app:reset', async () => { try {
  const dir = app.getPath('userData'); if (!Reset.validTarget(dir)) return { ok: false, error: 'Папка данных лаунчера выглядит неожиданно, сброс отменён' };
  try { game.stopAll(); } catch {} try { game.cancelAll(); } catch {}
  try { app.setLoginItemSettings({ openAtLogin: false, path: process.env.PORTABLE_EXECUTABLE_FILE || process.execPath }); } catch {} // автозапуск тоже сбрасывается
  const tmp = fs.mkdtempSync(path.join(require('os').tmpdir(), 'totem-reset-')); // у помощника свои временные данные Chromium: он не держит файлы, которые удаляет
  const args = ['--user-data-dir=' + tmp, ...(app.isPackaged ? [] : [app.getAppPath()]), '--totem-reset=' + dir, '--wait-pid=' + process.pid];
  require('child_process').spawn(process.execPath, args, { detached: true, stdio: 'ignore', windowsHide: false }).unref();
  quitting = true; setTimeout(() => app.quit(), 250); setTimeout(() => app.exit(0), 6000).unref(); return { ok: true };
} catch (e) { return { ok: false, error: 'Не удалось начать сброс: ' + e.message }; } });
async function runReset(target) {
  hardenSession(); const win = makeWin(480, 250, 'reset.html'); win.once('ready-to-show', () => win.show());
  await new Promise((r) => win.webContents.once('did-finish-load', r)); const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
  const send = (percent, stage, extra = {}) => { try { win.webContents.send('load:progress', { percent, stage, ...extra }); } catch {} };
  const m = process.argv.map((a) => /^--wait-pid=(\d+)$/.exec(a)).find(Boolean), alive = (pid) => { try { process.kill(pid, 0); return true; } catch (e) { return e.code === 'EPERM'; } };
  try {
    if (m) { send(0, 'Жду закрытия лаунчера…'); const t0 = Date.now(); while (alive(+m[1]) && Date.now() - t0 < 30000) await sleep(150); await sleep(500); }
    const r = await Reset.wipe(target, ({ done, total, stage }) => send(total ? Math.min(99, Math.floor((done / total) * 100)) : 0, total ? `${stage}: ${done} из ${total}` : stage));
    if (r.ok) { send(100, 'Готово. Запускаю лаунчер…'); await sleep(900); }
    else { send(100, 'Готово не полностью', { error: `Не удалось удалить файлов: ${r.failed}. Их держит другая программа. Лаунчер откроется сейчас, повторите сброс позже.` }); await sleep(8000); }
  } catch (e) { send(0, 'Ошибка', { error: e.message }); await sleep(8000); }
  try { require('child_process').spawn(process.execPath, app.isPackaged ? [] : [app.getAppPath()], { detached: true, stdio: 'ignore' }).unref(); } catch {}
  app.exit(0);
}

// после самообновления новый процесс ждёт завершения старого (до 10 с), иначе блокировка единственного экземпляра его закрыла бы
{ const m = process.argv.map((a) => /^--wait-pid=(\d+)$/.exec(a)).find(Boolean); if (m) { const pid = +m[1], t0 = Date.now(), sl = new Int32Array(new SharedArrayBuffer(4)); const alive = () => { try { process.kill(pid, 0); return true; } catch (e) { return e.code === 'EPERM'; } }; while (alive() && Date.now() - t0 < 10000) Atomics.wait(sl, 0, 0, 100); } }
const RST = process.argv.map((a) => /^--totem-reset=(.+)$/.exec(a)).find(Boolean);
if (RST) app.whenReady().then(() => runReset(RST[1]));
else if (!app.requestSingleInstanceLock()) app.quit();
else {
  app.on('second-instance', () => { const w = mainWin?.isVisible() ? mainWin : (loadWin || setupWin); if (w) { if (w.isMinimized()) w.restore(); w.focus(); } });
  app.whenReady().then(() => { hardenSession(); return readSettings().setupDone === true ? startLoading() : showSetup(); });
  app.on('window-all-closed', () => app.quit());
}
