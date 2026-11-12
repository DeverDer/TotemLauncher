'use strict';
// Самообновление лаунчера: проверка релиза на GitHub → скачивание (SHA-256) → распаковка в соседнюю папку app-<версия> →
// переписывание ярлыков → перезапуск. Лимит «Позже»: 3 раза на версию, потом обновление обязательно.
const fs = require('fs'), path = require('path'), { spawn } = require('child_process');
const core = require('./updater-core');

const MAX_SKIPS = 3;
function loadConfig() { try { const j = JSON.parse(fs.readFileSync(path.join(__dirname, 'app-config.json'), 'utf8')); return { repo: String(j.repo || '') }; } catch { return { repo: '' }; } }

function createUpdater({ app, shell, readSettings, writeSettings, send, log, isBusy }) {
  // в обычном режиме источник — только то, что зашито в сборку; переопределения работают лишь в НЕупакованном приложении (для тестов)
  const testMode = !app.isPackaged && process.env.TOTEM_TEST_UPDATE === '1';
  const net = testMode ? { api: process.env.TOTEM_GITHUB_API, local: true } : {};
  const execPath = testMode && process.env.TOTEM_EXEC_PATH ? process.env.TOTEM_EXEC_PATH : process.execPath, env = process.env;
  const execDir = path.dirname(execPath), inLayout = /^app-\d+\.\d+\.\d+$/.test(path.basename(execDir)); // запущены из <папка>/app-X.Y.Z/
  const root = inLayout ? path.dirname(execDir) : null;
  const supported = app.isPackaged || testMode;
  const current = testMode && process.env.TOTEM_TEST_VERSION ? process.env.TOTEM_TEST_VERSION : app.getVersion();
  const st = { latest: null, checkedAt: 0, error: '', installing: false, ac: null };

  const repo = () => { const c = loadConfig().repo; if (core.repoOk(c)) return c; const i = root && readInstallFile(); return i?.repo || core.readInstall(env)?.repo || ''; }; // запасной источник — repo, записанный установщиком
  function readInstallFile() { try { return JSON.parse(fs.readFileSync(path.join(root, 'install.json'), 'utf8')); } catch { return null; } }
  const skips = (v) => { const u = readSettings().updateLater; return u && u.v === v ? Math.max(0, u.n | 0) : 0; };

  function status() {
    const l = st.latest, available = !!l && core.cmp(l.version, current) > 0, n = available ? skips(l.version) : 0;
    return { current, supported, configured: core.repoOk(repo()), latest: l ? l.version : null, available, notes: available ? l.notes : '', page: available ? l.page : '', size: available ? l.size : 0,
      checkedAt: st.checkedAt, error: st.error, installing: st.installing, mandatory: available && n >= MAX_SKIPS, skipsLeft: Math.max(0, MAX_SKIPS - n) };
  }
  async function check() {
    if (!supported) { st.error = 'Обновления работают только в установленной версии лаунчера'; return status(); }
    if (!core.repoOk(repo())) { st.error = 'Источник обновлений не настроен'; return status(); }
    try { st.latest = await core.latest(repo(), net); st.error = ''; st.checkedAt = Date.now(); }
    catch (e) { st.error = e.message; log('update check: ' + e.message); }
    return status();
  }
  function later() { // «Позже» — только для необязательного обновления
    const s = status(); if (!s.available || s.mandatory) return s;
    const w = readSettings(); w.updateLater = { v: s.latest, n: skips(s.latest) + 1 }; writeSettings(w); return status();
  }
  const prog = (stage, done, total, extra = {}) => send('upd:progress', { stage, done, total, percent: total ? Math.min(100, Math.floor((done / total) * 100)) : 0, ...extra });

  async function install() {
    if (st.installing) return { ok: false, error: 'Обновление уже идёт' };
    const l = st.latest; if (!l || core.cmp(l.version, current) <= 0) return { ok: false, error: 'Обновлений нет' };
    if (isBusy()) return { ok: false, error: 'Сейчас идёт загрузка или установка игры — дождитесь завершения и повторите' };
    st.installing = true; st.ac = new AbortController(); const sig = st.ac.signal;
    const target = root || (readInstallFile()?.dir) || core.readInstall(env)?.dir || core.defaultRoot(env); // запущены не из установки (старый portable-exe): ставим в стандартную папку
    const zip = path.join(app.getPath('userData'), 'updates', l.name); const need = (l.size || 120e6) * 3;
    try {
      if (core.freeBytes(target) < need) throw new Error('Недостаточно места на диске: нужно около ' + core.fmtMb(need));
      prog('download', 0, l.size);
      await core.download(l, zip, { ...net, signal: sig, onProgress: (d, t) => prog('download', d, t || l.size) });
      const dir = core.appDirOf(target, l.version); prog('extract', 0, 1);
      await core.extractZip(zip, dir, { signal: sig, onProgress: (d, t) => prog('extract', d, t) });
      const exe = path.join(dir, core.EXE); if (!fs.existsSync(exe)) throw new Error('В архиве обновления нет ' + core.EXE);
      prog('finish', 1, 1); core.writeInstall(target, l.version, repo(), env);
      const had = core.updateShortcuts(app, shell, exe); if (!inLayout && !had) core.makeShortcuts(app, shell, exe);
      const w = readSettings(); w.updatedTo = l.version; delete w.updateLater; writeSettings(w);
      if (w.openAtLogin && app.isPackaged) { try { app.setLoginItemSettings({ openAtLogin: true, path: exe }); } catch {} }
      try { fs.unlinkSync(zip); } catch {}
      log(`update installed: ${current} -> ${l.version} (${dir})`); st.installing = false; relaunch(exe, dir);
      return { ok: true };
    } catch (e) {
      st.installing = false; try { fs.unlinkSync(zip + '.part'); } catch {}
      if (sig.aborted) return { ok: false, cancelled: true }; log('update install failed: ' + e.message); return { ok: false, error: e.message };
    }
  }
  function relaunch(exe, cwd) { // новый процесс ждёт, пока завершится этот (см. --wait-pid в main.js), и только потом занимает блокировку
    try { app.releaseSingleInstanceLock(); } catch {}
    try { spawn(exe, ['--wait-pid=' + process.pid], { cwd, detached: true, stdio: 'ignore', windowsHide: false }).unref(); } catch (e) { log('relaunch failed: ' + e.message); }
    app.quit(); setTimeout(() => app.exit(0), 5000).unref();
  }
  const cancel = () => { st.ac?.abort(); };
  async function startup() { // при каждом запуске: тихая проверка; если есть новая версия — просим показать окно
    if (root) setImmediate(() => { const n = core.cleanupOld(root, execDir); if (n) log('removed old versions: ' + n); });
    const w = readSettings(); if (w.updatedTo) { if (w.updatedTo === current) send('upd:done', { version: current }); delete w.updatedTo; writeSettings(w); }
    const s = await check(); if (s.available) send('upd:available', s); return s;
  }
  return { status, check, later, install, cancel, startup, MAX_SKIPS };
}
module.exports = { createUpdater, MAX_SKIPS, loadConfig };
