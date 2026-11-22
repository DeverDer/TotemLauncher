'use strict';
// Общее ядро для лаунчера (самообновление) и установщика: релизы GitHub, скачивание с проверкой SHA-256,
// безопасная распаковка zip (без зависимостей и без блокировки интерфейса), запись install.json.
// Схема установки: <папка>/app-<версия>/TotemLauncher.exe — каждая версия в своей папке, поэтому обновление
// не перезаписывает запущенные файлы (Windows их блокирует), а старые версии удаляются при следующем запуске.
const fs = require('fs'), path = require('path'), os = require('os'), crypto = require('crypto'), zlib = require('zlib'), { promisify } = require('util');
const inflateRaw = promisify(zlib.inflateRaw);

const EXE = 'TotemLauncher.exe';
const REPO_RE = /^[A-Za-z0-9_.-]{1,100}\/[A-Za-z0-9_.-]{1,100}$/;
const ASSET_RE = /^TotemLauncher-(\d+\.\d+\.\d+)-win-x64\.zip$/;
const UA = 'TotemLauncher-Updater';
const MAX_FILE = 1.5 * 1024 ** 3, MAX_TOTAL = 3 * 1024 ** 3, MAX_ENTRIES = 30000, IDLE_MS = 30000;
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

// ---------- версии ----------
const parseVer = (s) => { const m = /^v?(\d+)\.(\d+)\.(\d+)$/.exec(String(s || '').trim()); return m ? [+m[1], +m[2], +m[3]] : null; };
const cmp = (a, b) => { const x = parseVer(a), y = parseVer(b); if (!x || !y) return 0; for (let i = 0; i < 3; i++) if (x[i] !== y[i]) return x[i] > y[i] ? 1 : -1; return 0; };
const repoOk = (r) => REPO_RE.test(String(r || '')) && String(r).toUpperCase() !== 'OWNER/REPO';

// ---------- безопасные пути ----------
const badRel = (r) => { const p = String(r); return !p || p.includes('\0') || /^[\\/]|^[A-Za-z]:|:/.test(p) || p.split(/[\\/]/).some((x) => x === '..' || /^(con|prn|aux|nul|com\d|lpt\d)(\..*)?$/i.test(x) || /[. ]$/.test(x) && x !== '.'); };
const within = (root, p) => { const r = path.resolve(root), q = path.resolve(p); return q === r || q.startsWith(r + path.sep); };

// текст релиза для пользователя: без ссылок и служебных строк («Full Changelog», «by @user in https://…»)
const cleanNotes = (t) => String(t || '').split(/\r?\n/).filter((l) => !/https?:\/\/|github|full changelog|what's changed/i.test(l)).map((l) => l.replace(/\s+by @\S+.*$/i, '').trimEnd()).join('\n').replace(/\n{3,}/g, '\n\n').trim().slice(0, 1500);
// ---------- GitHub: последний релиз ----------
const anySignal = (...s) => AbortSignal.any(s.filter(Boolean));
async function latest(repo, o = {}) {
  if (!repoOk(repo)) throw new Error('Источник обновлений не настроен');
  const f = o.fetch || fetch, api = o.api || 'https://api.github.com';
  let r; try { r = await f(`${api}/repos/${repo}/releases/latest`, { headers: { 'User-Agent': UA, Accept: 'application/vnd.github+json' }, signal: anySignal(o.signal, AbortSignal.timeout(15000)) }); }
  catch (e) { const err = new Error('Нет связи с GitHub'); err.net = true; throw err; }
  if (r.status === 404) throw new Error('В репозитории нет опубликованных релизов (или репозиторий закрытый)');
  if (r.status === 403 || r.status === 429) throw new Error('GitHub временно ограничил запросы — повторите через несколько минут');
  if (!r.ok) throw new Error('GitHub ответил HTTP ' + r.status);
  const j = await r.json(), v = parseVer(j.tag_name);
  if (!v) throw new Error('Тег релиза должен иметь вид v1.2.3, а не «' + String(j.tag_name).slice(0, 30) + '»');
  const version = v.join('.'), a = (j.assets || []).find((x) => { const m = ASSET_RE.exec(String(x.name)); return m && m[1] === version; });
  if (!a) throw new Error(`В релизе v${version} нет файла TotemLauncher-${version}-win-x64.zip`);
  const url = String(a.browser_download_url || ''), base = `https://github.com/${repo}/releases/download/`.toLowerCase();
  if (!(url.toLowerCase().startsWith(base) || (o.local && url.startsWith('http://127.0.0.1')))) throw new Error('Недопустимая ссылка на файл обновления');
  let sha = /^sha256:([0-9a-f]{64})$/i.exec(String(a.digest || ''))?.[1]?.toLowerCase() || null; // GitHub сам считает digest для загруженных файлов
  if (!sha) { const s = (j.assets || []).find((x) => x.name === a.name + '.sha256'); if (s) { try { const t = await (await f(s.browser_download_url, { headers: { 'User-Agent': UA }, signal: AbortSignal.timeout(15000) })).text(); sha = /^[0-9a-f]{64}/i.exec(t.trim())?.[0]?.toLowerCase() || null; } catch {} } }
  return { version, tag: j.tag_name, name: a.name, url, size: a.size | 0, sha256: sha, notes: cleanNotes(j.body), page: String(j.html_url || '') };
}

// ---------- скачивание ----------
async function download(info, dest, o = {}) {
  if (!info.sha256) throw new Error('Для файла обновления нет контрольной суммы — установка отменена ради безопасности');
  const f = o.fetch || fetch, part = dest + '.part'; fs.mkdirSync(path.dirname(dest), { recursive: true }); let last;
  for (let a = 1; a <= 3; a++) {
    const idle = new AbortController(); let tm, out;
    const kick = () => { clearTimeout(tm); tm = setTimeout(() => idle.abort(new Error('нет данных 30 с')), IDLE_MS); };
    try {
      kick(); const r = await f(info.url, { headers: { 'User-Agent': UA }, signal: anySignal(o.signal, idle.signal), redirect: 'follow' });
      if (!r.ok) throw Object.assign(new Error('HTTP ' + r.status), { http: true });
      let host = ''; try { host = new URL(r.url || info.url).hostname; } catch {}
      if (r.url && !(r.url.startsWith('https://') && /(^|\.)(github\.com|githubusercontent\.com)$/.test(host)) && !(o.local && r.url.startsWith('http://127.0.0.1'))) throw Object.assign(new Error('Небезопасное перенаправление: ' + host), { http: true });
      const total = +r.headers.get('content-length') || info.size || 0, h = crypto.createHash('sha256'); let got = 0; out = fs.createWriteStream(part); let werr = null; out.on('error', (e) => { werr = e; });
      for await (const c of require('stream').Readable.fromWeb(r.body)) { kick(); if (werr) throw werr; got += c.length; if (got > (info.size ? info.size + 1024 : 2 * 1024 ** 3)) throw Object.assign(new Error('файл больше ожидаемого размера'), { http: true }); h.update(c); if (!out.write(c)) await new Promise((x) => out.once('drain', x)); o.onProgress?.(got, total); }
      await new Promise((res, rej) => out.end((e) => (e || werr ? rej(e || werr) : res()))); clearTimeout(tm);
      if (info.size && got !== info.size) throw Object.assign(new Error('размер файла не совпал'), { http: true });
      if (h.digest('hex') !== info.sha256) throw Object.assign(new Error('контрольная сумма SHA-256 не совпала — файл повреждён или подменён'), { http: true });
      fs.renameSync(part, dest); return dest;
    } catch (e) {
      clearTimeout(tm); if (out && !out.closed) await new Promise((res) => { out.once('close', res); out.destroy(); setTimeout(res, 800); });
      try { fs.unlinkSync(part); } catch {}
      if (o.signal?.aborted) throw new Error('cancelled'); last = e; if (e.http && !/HTTP 5\d\d/.test(e.message)) break; await sleep(700 * a);
    }
  }
  const e = new Error(last.http ? 'Не удалось скачать обновление: ' + last.message : 'Не удалось скачать обновление: сеть не отвечает' + (last.cause?.code ? ` (${last.cause.code})` : '')); e.net = !last.http; throw e;
}

// ---------- распаковка zip (свой разбор: без зависимостей, асинхронно, с лимитами) ----------
const readAt = async (fh, pos, len) => { const b = Buffer.alloc(len); const { bytesRead } = await fh.read(b, 0, len, pos); if (bytesRead !== len) throw new Error('Повреждённый zip (обрыв)'); return b; };
async function zipIndex(fh, size, maxEntries = MAX_ENTRIES) {
  const tail = Math.min(size, 65557), tb = await readAt(fh, size - tail, tail), i = tb.lastIndexOf(Buffer.from([0x50, 0x4b, 0x05, 0x06]));
  if (i < 0) throw new Error('Это не zip-архив');
  let total = tb.readUInt16LE(i + 10), cdSize = tb.readUInt32LE(i + 12), cdOff = tb.readUInt32LE(i + 16);
  if (total === 0xffff || cdSize === 0xffffffff || cdOff === 0xffffffff) { // zip64
    const loc = size - tail + i - 20, lb = await readAt(fh, loc, 20); if (lb.readUInt32LE(0) !== 0x07064b50) throw new Error('Повреждённый zip64');
    const z = await readAt(fh, Number(lb.readBigUInt64LE(8)), 56); if (z.readUInt32LE(0) !== 0x06064b50) throw new Error('Повреждённый zip64');
    total = Number(z.readBigUInt64LE(32)); cdSize = Number(z.readBigUInt64LE(40)); cdOff = Number(z.readBigUInt64LE(48));
  }
  if (total > maxEntries) throw new Error('В архиве слишком много файлов');
  const cd = await readAt(fh, cdOff, cdSize), ents = []; let p = 0;
  for (let k = 0; k < total; k++) {
    if (cd.readUInt32LE(p) !== 0x02014b50) throw new Error('Повреждённый каталог zip');
    const flags = cd.readUInt16LE(p + 8), method = cd.readUInt16LE(p + 10), nl = cd.readUInt16LE(p + 28), el = cd.readUInt16LE(p + 30), cl = cd.readUInt16LE(p + 32), attr = cd.readUInt32LE(p + 38);
    let csize = cd.readUInt32LE(p + 20), usize = cd.readUInt32LE(p + 24), lho = cd.readUInt32LE(p + 42);
    const name = cd.toString('utf8', p + 46, p + 46 + nl); let q = p + 46 + nl; const end = q + el;
    while (q + 4 <= end) { const id = cd.readUInt16LE(q), len = cd.readUInt16LE(q + 2); if (id === 1) { let r = q + 4; if (usize === 0xffffffff) { usize = Number(cd.readBigUInt64LE(r)); r += 8; } if (csize === 0xffffffff) { csize = Number(cd.readBigUInt64LE(r)); r += 8; } if (lho === 0xffffffff) lho = Number(cd.readBigUInt64LE(r)); } q += 4 + len; }
    ents.push({ name, method, csize, usize, lho, enc: !!(flags & 1), symlink: ((attr >>> 16) & 0xf000) === 0xa000, mode: (attr >>> 16) & 0o777 }); p += 46 + nl + el + cl;
  }
  return ents;
}
async function renameRetry(a, b) { for (let i = 0; ; i++) { try { fs.renameSync(a, b); return; } catch (e) { if (i >= 20 || !/EPERM|EBUSY|EACCES/.test(e.code)) throw e; await sleep(500); } } } // антивирус может секунду держать только что созданные файлы
async function extractZip(zipPath, destDir, o = {}) {
  const tmp = destDir + '.tmp'; fs.rmSync(tmp, { recursive: true, force: true }); fs.mkdirSync(tmp, { recursive: true });
  const fh = await fs.promises.open(zipPath, 'r');
  try {
    const ents = await zipIndex(fh, (await fh.stat()).size, o.maxEntries); let sum = 0;
    for (const e of ents) { if (e.usize > MAX_FILE) throw new Error('В архиве слишком большой файл'); sum += e.usize; }
    if (sum > MAX_TOTAL) throw new Error('Архив слишком большой после распаковки');
    let done = 0; o.onProgress?.(0, sum);
    for (const e of ents) {
      if (o.signal?.aborted) throw new Error('cancelled');
      const name = e.name.replace(/\\/g, '/'), isDir = name.endsWith('/'), rel = isDir ? name.slice(0, -1) : name;
      if (!rel) continue; if (badRel(rel)) throw new Error('Небезопасный путь в архиве: ' + rel.slice(0, 80));
      const t = path.join(tmp, rel); if (!within(tmp, t)) throw new Error('Небезопасный путь в архиве');
      if (e.enc) throw new Error('Архив зашифрован'); if (e.symlink) throw new Error('Символические ссылки в архиве не поддерживаются');
      if (isDir) { fs.mkdirSync(t, { recursive: true }); continue; }
      fs.mkdirSync(path.dirname(t), { recursive: true });
      const lh = await readAt(fh, e.lho, 30); if (lh.readUInt32LE(0) !== 0x04034b50) throw new Error('Повреждённый zip (заголовок файла)');
      const data = await readAt(fh, e.lho + 30 + lh.readUInt16LE(26) + lh.readUInt16LE(28), e.csize);
      const buf = e.method === 0 ? data : e.method === 8 ? await inflateRaw(data, { maxOutputLength: Math.max(e.usize, 1) + 16 }) : (() => { throw new Error('Неподдерживаемый метод сжатия'); })();
      if (buf.length !== e.usize) throw new Error('Размер файла в архиве не совпал: ' + rel.slice(0, 80));
      await fs.promises.writeFile(t, buf); if (process.platform !== 'win32' && (e.mode & 0o111)) fs.chmodSync(t, e.mode); done += e.usize; /* права на запуск сохраняем (нужно только вне Windows) */ o.onProgress?.(done, sum);
    }
  } catch (e) { await fh.close().catch(() => {}); fs.rmSync(tmp, { recursive: true, force: true }); throw e; }
  await fh.close(); fs.rmSync(destDir, { recursive: true, force: true }); await renameRetry(tmp, destDir);
}

// ---------- установка: папки и install.json ----------
const localDataDir = (env = process.env) => env.TOTEM_LOCALDATA || path.join(env.LOCALAPPDATA || path.join(os.homedir(), '.local', 'share'), 'TotemLauncher');
const defaultRoot = (env = process.env) => (env.TOTEM_DEFAULT_ROOT || path.join(env.LOCALAPPDATA || path.join(os.homedir(), '.local', 'share'), 'Programs', 'TotemLauncher'));
const appDirOf = (root, ver) => path.join(root, 'app-' + ver);
function readInstall(env = process.env) { // запись об установленном лаунчере; если файлов уже нет — считаем, что не установлен
  try {
    const j = JSON.parse(fs.readFileSync(path.join(localDataDir(env), 'install.json'), 'utf8'));
    if (typeof j.dir !== 'string' || !path.isAbsolute(j.dir) || !parseVer(j.version)) return null;
    const appDir = appDirOf(j.dir, j.version); if (!fs.existsSync(path.join(appDir, EXE))) return null;
    return { dir: j.dir, version: j.version, appDir, repo: repoOk(j.repo) ? j.repo : '' };
  } catch { return null; }
}
function writeJsonAtomic(file, obj) { fs.mkdirSync(path.dirname(file), { recursive: true }); const t = file + '.tmp'; fs.writeFileSync(t, JSON.stringify(obj, null, 1)); fs.renameSync(t, file); }
function writeInstall(root, version, repo, env = process.env) {
  const rec = { dir: root, version, repo: repoOk(repo) ? repo : '', updated: new Date().toISOString() };
  writeJsonAtomic(path.join(root, 'install.json'), rec); writeJsonAtomic(path.join(localDataDir(env), 'install.json'), rec); return rec;
}
// выбранная пользователем папка → итоговая: если там уже что-то лежит и это не наш лаунчер, ставим в подпапку TotemLauncher
function pickRoot(chosen) {
  const c = path.resolve(String(chosen)); let list = []; try { list = fs.readdirSync(c); } catch { return c; }
  return list.length === 0 || list.includes('install.json') || path.basename(c).toLowerCase() === 'totemlauncher' ? c : path.join(c, 'TotemLauncher');
}
function cleanupOld(root, keepDir) { // удалить старые версии и недоделанные распаковки (вызывается уже из новой версии)
  let n = 0; try { for (const d of fs.readdirSync(root, { withFileTypes: true })) if (d.isDirectory() && /^(\.?app-\d+\.\d+\.\d+(\.tmp)?|\.app-.*\.tmp)$/.test(d.name) && path.join(root, d.name) !== path.resolve(keepDir)) { try { fs.rmSync(path.join(root, d.name), { recursive: true, force: true }); n++; } catch {} } } catch {}
  return n;
}
function freeBytes(dir) { try { let d = path.resolve(dir); while (!fs.existsSync(d) && path.dirname(d) !== d) d = path.dirname(d); const s = fs.statfsSync(d); return s.bavail * s.bsize; } catch { return Infinity; } }
const fmtMb = (b) => (b / 1048576).toFixed(b >= 10485760 ? 0 : 1).replace('.', ',') + ' МБ';

// ---------- ярлыки (только Windows; shell/app приходят из Electron) ----------
function shortcutPaths(app) { return { desktop: path.join(app.getPath('desktop'), 'TotemLauncher.lnk'), startMenu: path.join(app.getPath('appData'), 'Microsoft', 'Windows', 'Start Menu', 'Programs', 'TotemLauncher.lnk') }; }
function writeShortcut(shell, lnk, target, mode) { // значок берём из resources/icon.ico (exe при кросс-сборке остаётся со значком Electron)
  try { const ico = path.join(path.dirname(target), 'resources', 'icon.ico'); return !!shell.writeShortcutLink(lnk, mode, { target, cwd: path.dirname(target), icon: fs.existsSync(ico) ? ico : target, iconIndex: 0, description: 'TotemLauncher' }); } catch { return false; }
}
function makeShortcuts(app, shell, target, o = { desktop: true, startMenu: true }) { if (process.platform !== 'win32') return { desktop: false, startMenu: false }; const p = shortcutPaths(app); return { desktop: o.desktop ? writeShortcut(shell, p.desktop, target, 'create') : false, startMenu: o.startMenu ? writeShortcut(shell, p.startMenu, target, 'create') : false }; }
function updateShortcuts(app, shell, target) { // после обновления переписываем только те ярлыки, которые у пользователя уже есть
  if (process.platform !== 'win32') return 0; let n = 0; for (const l of Object.values(shortcutPaths(app))) if (fs.existsSync(l) && writeShortcut(shell, l, target, 'replace')) n++; return n;
}

module.exports = { cleanNotes, EXE, parseVer, cmp, repoOk, badRel, within, latest, download, extractZip, zipIndex, localDataDir, defaultRoot, appDirOf, readInstall, writeInstall, pickRoot, cleanupOld, freeBytes, fmtMb, makeShortcuts, updateShortcuts, shortcutPaths };
