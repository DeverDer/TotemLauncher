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
const IMG_HOSTS = /^(cdn\.modrinth\.com|media\.forgecdn\.net|[\w-]+\.forgecdn\.net|avatars\.githubusercontent\.com)$/;
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

function makeWin(w, h, file, opts = {}) {
  const wa = screen.getDisplayNearestPoint(screen.getCursorScreenPoint()).workArea;
  w = Math.min(w, wa.width); h = Math.min(h, wa.height);
  const win = new BrowserWindow({ width: w, height: h, x: Math.round(wa.x + (wa.width - w) / 2), y: Math.round(wa.y + (wa.height - h) / 2),
    icon: path.join(__dirname, 'ui', 'assets', 'app-icon.png'), frame: false, transparent: true, backgroundColor: '#00000000', hasShadow: false, show: false, resizable: false,
    webPreferences: { preload: path.join(__dirname, 'preload.js'), contextIsolation: true, nodeIntegration: false, sandbox: true, webSecurity: true, allowRunningInsecureContent: false, webviewTag: false, spellcheck: false } });
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
      mainWin = makeWin(1240, 780, 'main.html', { main: true });
      const guard = setTimeout(() => rej(new Error('Главное окно не отобразилось за 25 секунд (проблема с видеодрайвером?). Журнал: logs/launcher.log')), 25000); // раньше загрузка могла висеть вечно
      mainWin.once('ready-to-show', () => { clearTimeout(guard); res(); });
      mainWin.webContents.once('did-fail-load', (_e, c, d) => rej(new Error('UI: ' + d)));
      mainWin.on('closed', () => { mainWin = null; if (!quitting) app.quit(); });
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
ipcMain.on('win:min', (e) => BrowserWindow.fromWebContents(e.sender)?.minimize());
ipcMain.on('win:close', (e) => BrowserWindow.fromWebContents(e.sender)?.close());
ipcMain.handle('versions:list', async () => {
  const r = await fetch('https://piston-meta.mojang.com/mc/game/version_manifest_v2.json', { signal: AbortSignal.timeout(20000) });
  if (!r.ok) throw new Error('Mojang: HTTP ' + r.status);
  return (await r.json());
});

const Game = require('./game');
const MS_LOCKED = true; // вход через Microsoft временно закрыт (код в auth.js сохранён)
const maxRamMb = () => Math.max(2048, Math.floor(require('os').totalmem() / 1048576) - 1024); // ОЗУ компьютера минус 1 ГБ системе
const curAcc = (s) => (s.accounts || []).find((a) => a.id === s.account) || null;
const defaults = () => { const s = readSettings(); return { ram: Math.min(4096, maxRamMb()), javaPath: '', anim: true, fullscreen: false, openAtLogin: false, minimizeOnPlay: false, jvmArgs: '', gameArgs: '', width: 0, height: 0, skinInGame: true, bgHome: 'village', ...s, playerName: curAcc(s)?.name || 'Player', maxRam: maxRamMb(), skinInGame: s.skinInGame !== false && curAcc(s)?.type !== 'ely', curseforgeKey: s.curseforgeKey || '' }; };
let wasPlaying = false, sessionStart = 0, lastTick = 0, playTimer = null;
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
  if (s.state === 'playing' && defaults().minimizeOnPlay) mainWin?.minimize();
  if (wasPlaying && (s.state === 'idle' || s.state === 'error') && !game.running) { mainWin?.restore(); mainWin?.focus(); }
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
ipcMain.on('game:play', (_e, sel) => {
  if (sel?.k === 'i') { const i = instances.get(String(sel.id)); if (i) game.start(i.mc, true, { ...i, dir: instances.dir(i) }); }
  else if (sel?.k === 'v' && VID.test(String(sel.id))) game.start(String(sel.id), true);
});
ipcMain.handle('inst:list', () => instances.all());
ipcMain.handle('inst:create', async (_e, o) => { try { o = { name: String(o?.name ?? ''), mc: String(o?.mc ?? ''), loader: String(o?.loader ?? '') }; if (!VID.test(o.mc)) throw new Error('Неверная версия Minecraft'); if (o.loader !== 'vanilla') o.loaderVersion = await Game.loaderLatest(String(o.loader), String(o.mc)); return { ok: true, inst: instances.create(o) }; } catch (e) { return { ok: false, error: e.message }; } });
ipcMain.handle('inst:copy', (_e, id) => (game.active ? { ok: false, error: 'Идёт игра' } : wrap(() => instances.copy(String(id)))));
ipcMain.handle('inst:remove', (_e, id) => (game.active ? { ok: false, error: 'Идёт загрузка или игра' } : wrap(() => instances.remove(String(id)))));
ipcMain.on('inst:open', (_e, id, kind) => wrap(() => shell.openPath(instances.folder(instances.need(String(id)), kind))));
ipcMain.handle('files:list', (_e, id, kind) => { try { return instances.list(String(id), kind); } catch { return []; } });
ipcMain.handle('files:add', async (_e, id, kind, paths, o = {}) => {
  if (!Array.isArray(paths) || !paths.length) { // диалог выбора: для ресурс-паков и шейдеров — .zip (папку выбирают отдельной кнопкой)
    const flt = kind === 'mods' ? [{ name: 'Моды (.jar)', extensions: ['jar'] }] : [{ name: 'Архивы (.zip)', extensions: ['zip'] }];
    const r = await dialog.showOpenDialog(mainWin, o.dirMode ? { properties: ['openDirectory', 'multiSelections'] } : { properties: ['openFile', 'multiSelections'], filters: flt }); if (r.canceled) return { ok: true }; paths = r.filePaths; }
  paths = paths.map(String);
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
ipcMain.on('game:cancel', () => game.cancel());
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
ipcMain.handle('settings:get', () => defaults());
ipcMain.handle('settings:set', (_e, p) => {
  if (!p || typeof p !== 'object' || Array.isArray(p)) return { ok: false, error: 'Неверные настройки' };
  const c = {}, maxRam = maxRamMb();
  if ('ram' in p) { const r = Math.round(+p.ram); if (!(r >= 1024 && r <= maxRam)) return { ok: false, error: `Память: от 1024 до ${maxRam} МБ` }; c.ram = r; }
  if ('javaPath' in p) { const jp = p.javaPath; if (jp) { if (typeof jp !== 'string' || jp.length > 400 || !path.isAbsolute(jp) || !/^javaw?(\.exe)?$/i.test(path.basename(jp))) return { ok: false, error: 'Укажите файл java.exe или javaw.exe' }; let st; try { st = fs.statSync(jp); } catch {} if (!st?.isFile()) return { ok: false, error: 'Файл Java не найден' }; } c.javaPath = jp || ''; } // запуск произвольных программ через «путь к Java» запрещён
  for (const k of ['jvmArgs', 'gameArgs']) if (k in p) { if (typeof p[k] !== 'string' || p[k].length > 500 || /[\r\n]/.test(p[k])) return { ok: false, error: k + ': одна строка, до 500 символов' }; const bad = k === 'jvmArgs' ? Game.badJvm(p[k]) : ''; if (bad) return { ok: false, error: `Аргумент ${bad} запрещён: он позволяет подключать чужой код к игре` }; c[k] = p[k].trim(); }
  for (const k of ['width', 'height']) if (k in p) { const v = Math.round(+p[k] || 0); if (v && (v < 320 || v > 7680)) return { ok: false, error: 'Размер окна: 320–7680 или пусто' }; c[k] = v; }
  if ('curseforgeKey' in p) { const k = typeof p.curseforgeKey === 'string' ? require('./catalog').cleanKey(p.curseforgeKey) : null; if (k === null || !/^[\w$./+=-]{0,128}$/.test(k)) return { ok: false, error: 'Ключ CurseForge выглядит неверно: в нём лишние символы' }; c.curseforgeKey = k; }
  if ('bgHome' in p) { if (!['village', 'cave', 'cabin', 'fireplace', 'sunset'].includes(p.bgHome)) return { ok: false, error: 'Неизвестный фон' }; c.bgHome = p.bgHome; }
  for (const k of ['fullscreen', 'anim', 'openAtLogin', 'minimizeOnPlay', 'skinInGame']) if (k in p) c[k] = !!p[k];
  if ('msClientId' in p) { if (p.msClientId && !/^[0-9a-f]{8}(-[0-9a-f]{4}){3}-[0-9a-f]{12}$/i.test(p.msClientId)) return { ok: false, error: 'Client ID должен быть GUID' }; c.msClientId = p.msClientId; }
  if ('currentSkin' in p) { if (p.currentSkin && p.currentSkin !== 'steve' && !/^[0-9a-f]{12}$/.test(p.currentSkin)) return { ok: false, error: 'Неверный скин' }; c.currentSkin = p.currentSkin; }
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
const dirSize = (d) => { let n = 0; try { for (const e of fs.readdirSync(d, { withFileTypes: true })) { const p = path.join(d, e.name); n += e.isDirectory() ? dirSize(p) : fs.statSync(p).size; } } catch {} return n; };
const sweep = (d) => { let n = 0; try { for (const e of fs.readdirSync(d, { withFileTypes: true })) { const p = path.join(d, e.name); if (e.isDirectory()) n += sweep(p); else if (e.name.endsWith('.part')) { n += fs.statSync(p).size; fs.unlinkSync(p); } } } catch {} return n; };
ipcMain.handle('storage:info', () => ({ path: dataDir(), bytes: dirSize(dataDir()) }));
ipcMain.on('storage:open', () => shell.openPath(dataDir()));
ipcMain.handle('storage:clean', () => {
  if (game.active) return { ok: false, error: 'Идёт загрузка или игра' };
  let n = sweep(path.join(dataDir(), 'minecraft'));
  try { const g = path.join(dataDir(), 'logs', 'game.log'); n += fs.statSync(g).size; fs.unlinkSync(g); } catch {}
  return { ok: true, freed: n };
});
ipcMain.handle('inst:setLoader', async (_e, id, loader) => {
  try { const i = instances.need(String(id)); if (game.active) throw new Error('Идёт загрузка или игра'); instances.setLoader(i.id, String(loader), await Game.loaderLatest(String(loader), i.mc)); return { ok: true }; } catch (e) { return { ok: false, error: e.message }; }
});
ipcMain.handle('inst:install', (_e, id) => { const i = instances.get(String(id)); if (!i) return { ok: false, error: 'Сборка не найдена' }; if (game.active) return { ok: false, error: 'Лаунчер занят' }; game.start(i.mc, false, { ...i, dir: instances.dir(i) }); return { ok: true }; });
const Skins = require('./skins'), skins = new Skins(path.join(dataDir(), 'skins'));
const tryo = (f) => { try { return { ok: true, ...f() }; } catch (e) { return { ok: false, error: e.message }; } };
ipcMain.handle('skins:list', () => skins.list());
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
  const j = async (u) => { try { const r = await fetch(u, { headers: { 'User-Agent': 'TotemLauncher' } }); return r.ok ? await r.json() : null; } catch { return null; } };
  const [fo, fa, ne] = await Promise.all([j('https://files.minecraftforge.net/net/minecraftforge/forge/promotions_slim.json'), j('https://meta.fabricmc.net/v2/versions/game'), j('https://maven.neoforged.net/api/maven/versions/releases/net/neoforged/neoforge')]);
  const neo = (ne?.versions || []).filter((v) => !/alpha|beta/.test(v)).map((v) => { const m = /^(\d+)\.(\d+)\./.exec(v); return !m ? null : +m[1] >= 26 ? `${m[1]}.${m[2]}` : m[2] === '0' ? `1.${m[1]}` : `1.${m[1]}.${m[2]}`; }).filter(Boolean);
  const r = { forge: [...new Set(Object.keys(fo?.promos || {}).map((k) => k.replace(/-(latest|recommended)$/, '')))], fabric: (fa || []).map((x) => x.version), neoforge: [...new Set(neo)] };
  if (fo && fa && ne) availCache = r; return r;
});
ipcMain.on('ext:optifine', () => shell.openExternal('https://optifine.net/downloads')); // OptiFine скачивается вручную с сайта автора
app.on('before-quit', addPlay);
// ---------- аккаунты Ely.by, каталог ----------
const Ely = require('./ely'), Cat = require('./catalog');
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
const WEB_OK = /(^|\.)(curseforge\.com|modrinth\.com|optifine\.net|ely\.by)$/;
const safeWeb = (u) => { try { const x = new URL(String(u)); if (x.protocol !== 'https:' || x.username || x.password || x.port || !WEB_OK.test(x.hostname) || x.href.length > 600) return null; return x.href; } catch { return null; } }; // только https и наши сайты
ipcMain.on('ext:url', (_e, u) => { const h = safeWeb(u); if (h) openWeb(h); });
// «Нет интернета» только если сеть действительно недоступна (проверяем двумя серверами); иначе показываем настоящую причину
const catErr = async (e) => ({ ok: false, error: e.message, offline: !!e.net && !(await Cat.online()), needKey: !!e.needKey, cfAuth: !!e.cfAuth, manual: e.manual || null });
const CAT_TYPES = ['mod', 'resourcepack', 'shader', 'datapack', 'modpack', 'map'], CAT_LOADERS = ['', 'forge', 'fabric', 'neoforge', 'quilt'];
const catIn = (o) => { // всё, что приходит из интерфейса в каталог, приводим к безопасному виду
  if (!o || typeof o !== 'object') throw new Error('Неверный запрос');
  const id = o.id == null ? '' : String(o.id), mc = String(o.mc || ''), type = String(o.type || 'mod'), loader = String(o.loader || '');
  if (id && !/^[\w.-]{1,64}$/.test(id)) throw new Error('Неверный идентификатор проекта');
  if (!CAT_TYPES.includes(type)) throw new Error('Неизвестный тип');
  if (mc && !VID.test(mc)) throw new Error('Неверная версия Minecraft');
  if (!CAT_LOADERS.includes(loader)) throw new Error('Неизвестный загрузчик');
  return { src: o.src === 'cf' ? 'cf' : 'mr', id, type, mc, loader, q: String(o.q || '').slice(0, 100), sort: o.sort === 'new' ? 'new' : 'pop', mapCat: String(o.mapCat || '').slice(0, 20), offset: Math.max(0, Math.min(10000, Math.floor(+o.offset) || 0)), deps: !!o.deps, world: String(o.world || '').slice(0, 120), inst: o.inst == null ? '' : String(o.inst), title: String(o.title || '').slice(0, 80) };
};
const instInfo = (id) => { const i = instances.get(String(id)); if (!i) throw new Error('Сборка не найдена'); return { ...i, dir: instances.dir(i) }; };
const prog = (r) => mainWin?.webContents.send('cat:progress', { text: r.op, pct: r.total ? Math.floor((r.done / r.total) * 100) : 0 });
const idleOnly = () => { if (game.active) throw new Error('Игра запущена: закройте её перед установкой'); };
ipcMain.handle('cat:search', async (_e, o) => { try { return { ok: true, ...(await Cat.search({ ...catIn(o), cfKey: defaults().curseforgeKey })) }; } catch (e) { return await catErr(e); } });
ipcMain.handle('cat:project', async (_e, o) => { try { return { ok: true, p: await Cat.project({ ...catIn(o), cfKey: defaults().curseforgeKey }) }; } catch (e) { return await catErr(e); } });
ipcMain.handle('cat:plan', async (_e, o) => { try { o = catIn(o); const i = instInfo(o.inst); return { ok: true, ...(await Cat.plan({ ...o, mc: i.mc, loader: i.loader, cfKey: defaults().curseforgeKey })) }; } catch (e) { return await catErr(e); } });
ipcMain.handle('cat:install', async (_e, o) => { try { idleOnly(); o = catIn(o); const i = instInfo(o.inst); if (o.type !== 'modpack' && Cat.installedKeys(i.dir).includes(`${o.src === 'cf' ? 'cf' : 'mr'}:${o.id}${o.type === 'datapack' ? '@' + o.world : ''}`)) return { ok: false, error: 'Уже скачано в сборку «' + i.name + '»' }; const r = await Cat.install({ ...o, mc: i.mc, loader: i.loader, cfKey: defaults().curseforgeKey }, i.dir, prog); return { ok: true, ...r, note: o.type === 'shader' ? (await Cat.shaderSupport(i, prog)).note : '' }; } catch (e) { return await catErr(e); } });
ipcMain.handle('cat:pack', async (_e, o) => { try { o = catIn(o); return { ok: true, inst: await Cat.installPack({ id: o.id, title: o.title, mc: o.mc, loader: o.loader }, instances, prog) }; } catch (e) { return await catErr(e); } });
ipcMain.handle('cat:boost', async (_e, id) => { try { idleOnly(); return { ok: true, ...(await Cat.boost(instInfo(id), prog)) }; } catch (e) { return await catErr(e); } });
ipcMain.handle('cat:installed', () => { const r = {}; for (const i of instances.all()) { try { r[i.id] = Cat.installedKeys(instances.dir(i)); } catch { r[i.id] = []; } } return { ok: true, r }; });
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

// после самообновления новый процесс ждёт завершения старого (до 10 с), иначе блокировка единственного экземпляра его закрыла бы
{ const m = process.argv.map((a) => /^--wait-pid=(\d+)$/.exec(a)).find(Boolean); if (m) { const pid = +m[1], t0 = Date.now(), sl = new Int32Array(new SharedArrayBuffer(4)); const alive = () => { try { process.kill(pid, 0); return true; } catch (e) { return e.code === 'EPERM'; } }; while (alive() && Date.now() - t0 < 10000) Atomics.wait(sl, 0, 0, 100); } }
if (!app.requestSingleInstanceLock()) app.quit();
else {
  app.on('second-instance', () => { const w = mainWin?.isVisible() ? mainWin : (loadWin || setupWin); if (w) { if (w.isMinimized()) w.restore(); w.focus(); } });
  app.whenReady().then(() => { hardenSession(); return readSettings().setupDone === true ? startLoading() : showSetup(); });
  app.on('window-all-closed', () => app.quit());
}
