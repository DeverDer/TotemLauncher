// Установка версий Minecraft, Java (Mojang runtime) и запуск игры. Без UI-зависимостей.
const fs = require('fs'), path = require('path'), os = require('os'), crypto = require('crypto');
const { applySkin } = require('./skinpack');
const { spawn } = require('child_process'), { Readable } = require('stream');
const UA = { 'User-Agent': 'TotemLauncher/0.15' };
const SAFE_ID = /^(?!\.)(?!.*\.\.)[\w.+ -]{1,60}$/; // идентификаторы версий/загрузчиков: без слэшей и «..»
const within = (root, p) => { const r = path.resolve(root), q = path.resolve(p); return q === r || q.startsWith(r + path.sep); }; // проверка вложенности с учётом разделителя (/libraries-evil не внутри /libraries)
const httpsOnly = (u) => { let x; try { x = new URL(u); } catch { throw new Error('Некорректная ссылка для загрузки'); } if (x.protocol !== 'https:' && !(x.protocol === 'http:' && /^(127\.0\.0\.1|localhost)$/.test(x.hostname))) throw new Error('Небезопасная (не HTTPS) ссылка отклонена: ' + x.hostname); return x; };
const MAX_DL = 2 * 1024 ** 3, IDLE_MS = 30000;
const MANIFEST = 'https://piston-meta.mojang.com/mc/game/version_manifest_v2.json';
const RUNTIMES = 'https://launchermeta.mojang.com/v1/products/java-runtime/2ec0cc96c44e5a76b9c8b7c39df7210883d12871/all.json';
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
// Пауза загрузок (кнопка в окошке загрузок): новые файлы не начинаются, а текущие перестают читаться, пока паузу не снимут или не отменят загрузку
const PAUSE = { on: false, ws: new Set() };
const setPaused = (b) => { PAUSE.on = !!b; if (!PAUSE.on) { const w = [...PAUSE.ws]; PAUSE.ws.clear(); w.forEach((f) => f()); } };
const gate = (signal) => new Promise((res) => { if (!PAUSE.on || signal?.aborted) return res(); const f = () => res(); PAUSE.ws.add(f); signal?.addEventListener('abort', () => { PAUSE.ws.delete(f); res(); }, { once: true }); });
const archName = () => (process.arch === 'ia32' ? 'x86' : process.arch);

async function getJson(url, signal) {
  httpsOnly(url); const r = await fetch(url, { signal: signal ? AbortSignal.any([signal, AbortSignal.timeout(30000)]) : AbortSignal.timeout(30000), headers: UA });
  if (!r.ok) throw new Error(`HTTP ${r.status}: ${url}`);
  return r.json();
}
const sha1File = (f) => new Promise((res, rej) => { const h = crypto.createHash('sha1'); fs.createReadStream(f).on('data', (d) => h.update(d)).on('end', () => res(h.digest('hex'))).on('error', rej); });
async function fileOk(t) {
  try { const st = fs.statSync(t.dest); if (t.size != null && st.size !== t.size) return false; return !t.sha1 || (await sha1File(t.dest)) === t.sha1; } catch { return false; }
}
// Скачивание в .part + проверка sha1 + атомарное переименование; 3 попытки
async function download(t, signal, onBytes) {
  httpsOnly(t.url); fs.mkdirSync(path.dirname(t.dest), { recursive: true });
  let last;
  for (let a = 1; a <= 5; a++) {
    const part = t.dest + '.part'; let got = 0, out, tm; const idle = new AbortController();
    const kick = () => { clearTimeout(tm); tm = setTimeout(() => idle.abort(new Error('нет данных 30 с')), IDLE_MS); }; // зависшее соединение не должно вешать загрузку навсегда
    try {
      kick(); const r = await fetch(t.url, { signal: signal ? AbortSignal.any([signal, idle.signal]) : idle.signal, headers: UA }); if (!r.ok) throw new Error('HTTP ' + r.status);
      if (r.url && !/^https:|^http:\/\/(127\.0\.0\.1|localhost)/.test(r.url)) throw new Error('Перенаправление на небезопасный адрес'); // редирект на http отклоняем
      const cap = t.size != null ? t.size + 1024 : MAX_DL, h = crypto.createHash('sha1'); out = fs.createWriteStream(part); let werr = null; out.on('error', (e) => { werr = e; }); // без обработчика отмена роняла процесс (запись в уничтоженный поток)
      for await (const c of Readable.fromWeb(r.body)) { if (PAUSE.on) { clearTimeout(tm); await gate(signal); if (signal?.aborted) throw new Error('cancelled'); } kick(); if (werr) throw werr; got += c.length; if (got > cap) throw new Error('файл больше ожидаемого размера'); h.update(c); onBytes(c.length); if (!out.write(c)) await new Promise((x) => out.once('drain', x)); }
      await new Promise((res, rej) => out.end((e) => (e || werr ? rej(e || werr) : res())));
      if (t.sha1 && h.digest('hex') !== t.sha1) throw new Error('sha1 не совпал');
      clearTimeout(tm); fs.renameSync(part, t.dest); return;
    } catch (e) {
      clearTimeout(tm); onBytes(-got); if (out) { const closed = new Promise((r) => out.once('close', r)); out.destroy(); await Promise.race([closed, sleep(500)]); } try { fs.unlinkSync(part); } catch {} // ждём закрытия файла: иначе .part мог появиться уже после удаления
      if (signal?.aborted) throw new Error('cancelled'); last = e; await sleep(/HTTP (429|5\d\d)/.test(e.message) ? 1500 * a : 500 * a);
    }
  }
  const code = last.cause?.code || '', net = !!code || last.name === 'TypeError' || last.name === 'TimeoutError' || /нет данных/.test(last.message), e = new Error(`Не удалось скачать ${t.label || t.url}: ${net ? 'сеть не отвечает' + (code ? ` (${code})` : '') : last.message}`); e.net = net; throw e;
}
const isCancelErr = (e) => e?.message === 'cancelled' || e?.name === 'AbortError';
async function runTasks(tasks, signal, report) {
  const total = tasks.reduce((s, t) => s + (t.size || 0), 0), q = [...tasks], t0 = Date.now(), ac = new AbortController();
  if (signal.aborted) ac.abort(); else signal.addEventListener('abort', () => ac.abort());
  let done = 0, net = 0, files = 0, firstErr = null; const filesTotal = tasks.length; // files / filesTotal — «5/87 файлов» в окошке загрузок
  const emit = (op) => { if (!ac.signal.aborted) report({ done, total, speed: net / Math.max((Date.now() - t0) / 1000, 0.5), op, files, filesTotal }); };
  const worker = async () => {
    try {
      for (let t; (t = q.shift());) {
        if (PAUSE.on) { await gate(ac.signal); }
        if (ac.signal.aborted) throw new Error('cancelled');
        if (await fileOk(t)) done += t.size || 0; else await download(t, ac.signal, (n) => { done += n; net += n; emit(t.label); });
        if (t.exec) try { fs.chmodSync(t.dest, 0o755); } catch {}
        files++; emit(t.label);
      }
    } catch (e) { if (!firstErr && !isCancelErr(e)) firstErr = e; ac.abort(); throw e; } // соседние потоки после ac.abort() кидают «cancelled» — запоминаем настоящую причину
  };
  const res = await Promise.allSettled(Array.from({ length: 12 }, worker)); // ждём все потоки, чтобы после отмены ничего не писало в интерфейс
  if (signal.aborted) throw new Error('cancelled'); // отменил игрок
  if (firstErr) throw firstErr; // настоящая ошибка (сеть, sha1 …), а не «cancelled» соседнего потока
  const bad = res.find((r) => r.status === 'rejected'); if (bad) throw bad.reason;
}
// Правила Mojang (os/arch/features). features не поддерживаем -> такие правила не срабатывают.
function allowed(rules) {
  if (!rules) return true; let ok = false;
  for (const r of rules) {
    const o = r.os, m = (!o || ((!o.name || o.name === 'windows') && (!o.arch || o.arch === archName()) && (!o.version || new RegExp(o.version).test(os.release())))) && !r.features;
    if (m) ok = r.action === 'allow';
  }
  return ok;
}
async function getVJ(id, dirs, signal, fast) {
  if (fast) return JSON.parse(fs.readFileSync(path.join(dirs.versions, id, id + '.json'), 'utf8')); // версия уже установлена: сеть не нужна
  const man = await getJson(MANIFEST, signal), e = man.versions.find((v) => v.id === id);
  if (!e) throw new Error('Версия не найдена: ' + id);
  const vjp = path.join(dirs.versions, id, id + '.json');
  if (!(await fileOk({ dest: vjp, sha1: e.sha1 }))) await download({ url: e.url, dest: vjp, sha1: e.sha1 }, signal, () => {});
  return JSON.parse(fs.readFileSync(vjp, 'utf8'));
}
// профиль загрузчика (inheritsFrom) + родительская версия Mojang
function merge(p, c) {
  const a = (k) => [...(p.arguments?.[k] || []), ...(c.arguments?.[k] || [])];
  return { ...p, ...c, libraries: [...(c.libraries || []), ...p.libraries], arguments: p.arguments || c.arguments ? { jvm: a('jvm'), game: a('game') } : undefined,
    assetIndex: p.assetIndex, assets: p.assets, downloads: p.downloads, javaVersion: p.javaVersion, logging: p.logging, minecraftArguments: c.minecraftArguments || p.minecraftArguments, type: p.type };
}
const enc = encodeURIComponent;
async function fabricLatest(mc, signal) {
  const l = await getJson(`https://meta.fabricmc.net/v2/versions/loader/${enc(mc)}`, signal), s = l.find((x) => x.loader.stable) || l[0];
  if (!s) throw new Error('Fabric не поддерживает Minecraft ' + mc); return s.loader.version;
}
async function fabricProfile(mc, lv, dirs, signal) {
  lv = lv || (await fabricLatest(mc, signal)); if (!SAFE_ID.test(String(mc)) || !SAFE_ID.test(String(lv))) throw new Error('Неверная версия загрузчика');
  const known = `fabric-loader-${lv}-${mc}`, f0 = path.join(dirs.versions, known, known + '.json');
  if (fs.existsSync(f0)) return known;
  const prof = await getJson(`https://meta.fabricmc.net/v2/versions/loader/${enc(mc)}/${enc(lv)}/profile/json`, signal);
  if (prof.id !== known || !/^[\w.+-]+$/.test(prof.id)) throw new Error('Неожиданный профиль Fabric');
  fs.mkdirSync(path.dirname(f0), { recursive: true }); fs.writeFileSync(f0, JSON.stringify(prof)); return known;
}
async function loaderLatest(loader, mc, signal) {
  if (loader === 'fabric') return fabricLatest(mc, signal);
  if (loader === 'forge') {
    const pr = (await getJson('https://files.minecraftforge.net/net/minecraftforge/forge/promotions_slim.json', signal)).promos, v = pr[mc + '-recommended'] || pr[mc + '-latest'];
    if (!v) throw new Error('Forge не поддерживает Minecraft ' + mc); return v;
  }
  if (loader === 'neoforge') {
    const y = /^(2\d)\.(\d+)(?:\.\d+)?$/.exec(mc), m = y || /^1\.(\d+)(?:\.(\d+))?$/.exec(mc); if (!m || (!y && (+m[1] < 20 || (+m[1] === 20 && +(m[2] || 0) < 2)))) throw new Error('NeoForge поддерживает Minecraft от 1.20.2');
    const pre = `${m[1]}.${m[2] || 0}.`, num = (s) => s.split('.').map(Number);
    const v = (await getJson('https://maven.neoforged.net/api/maven/versions/releases/net/neoforged/neoforge', signal)).versions.filter((x) => x.startsWith(pre) && !/alpha|beta/.test(x))
      .sort((a, b) => { const x = num(a), y = num(b); for (let i = 0; i < 3; i++) if (x[i] !== y[i]) return x[i] - y[i]; return 0; });
    if (!v.length) throw new Error('NeoForge не найден для Minecraft ' + mc); return v[v.length - 1];
  }
  throw new Error('Неизвестный загрузчик');
}
const probeSha = async (url, signal) => { try { const r = await fetch(url + '.sha1', { signal, headers: UA }); const s = r.ok ? (await r.text()).trim().slice(0, 40) : ''; return /^[0-9a-f]{40}$/.test(s) ? s : null; } catch (e) { if (signal?.aborted) throw e; return null; } };
// У старых Forge (≤1.12.2) имя артефакта иногда с суффиксом версии MC, поэтому пробуем оба варианта
async function forgeInstaller(mc, lv, signal) {
  if (!SAFE_ID.test(String(mc)) || !SAFE_ID.test(String(lv))) throw new Error('Неверная версия загрузчика');
  for (const sfx of ['', '-' + mc]) { const v = `${mc}-${lv}${sfx}`, url = `https://maven.minecraftforge.net/net/minecraftforge/forge/${v}/forge-${v}-installer.jar`, sha1 = await probeSha(url, signal); if (sha1) return { url, sha1 }; }
  throw new Error(`Установщик Forge ${lv} для Minecraft ${mc} не найден`);
}
async function neoInstaller(lv, signal) {
  const url = `https://maven.neoforged.net/releases/net/neoforged/neoforge/${lv}/neoforge-${lv}-installer.jar`, sha1 = await probeSha(url, signal);
  if (!sha1) throw new Error('Установщик NeoForge ' + lv + ' не найден'); return { url, sha1 };
}
// id версии, которую создал установщик (у старых Forge имена вида 1.12.2-forge1.12.2-14.23.5.2860)
function findLoaderVersion(dirs, loader, mc, lv) {
  try { return fs.readdirSync(dirs.versions).find((n) => fs.existsSync(path.join(dirs.versions, n, n + '.json')) && (loader === 'forge' ? n.toLowerCase().includes('forge') && n.includes(lv) && n.includes(mc) : n === 'neoforge-' + lv)) || null; } catch { return null; }
}
// ---- Повторное использование уже скачанных Forge/Fabric ----
// Если для этой версии Minecraft загрузчик такого типа уже стоит (на любой сборке) — второй раз не качаем.
// Исключение — вышла новая версия загрузчика: сборка, созданная с ней, получает её.
const vnum = (s) => String(s).split(/[.+_-]/).map((x) => parseInt(x, 10)).map((n) => (Number.isFinite(n) ? n : 0));
const vcmp = (a, b) => { const x = vnum(a), y = vnum(b); for (let i = 0; i < Math.max(x.length, y.length); i++) { const d = (x[i] || 0) - (y[i] || 0); if (d) return d < 0 ? -1 : 1; } return 0; };
const neoPrefix = (mc) => { const y = /^(2\d)\.(\d+)(?:\.\d+)?$/.exec(mc), m = y || /^1\.(\d+)(?:\.(\d+))?$/.exec(mc); return m ? `${m[1]}.${m[2] || 0}.` : null; };
function localLoaders(dirs, loader, mc) { // версии загрузчика этого типа, уже установленные для mc
  let names; try { names = fs.readdirSync(dirs.versions).filter((n) => fs.existsSync(path.join(dirs.versions, n, n + '.json'))); } catch { return []; }
  const out = [], low = (n) => n.toLowerCase();
  for (const n of names) {
    if (loader === 'fabric') { if (n.startsWith('fabric-loader-') && n.endsWith('-' + mc) && n.length > 14 + mc.length + 1) out.push(n.slice(14, -(mc.length + 1))); }
    else if (loader === 'forge') { if (low(n).includes('forge') && !low(n).includes('neoforge') && n.startsWith(mc + '-')) { const m = /(\d+(?:\.\d+)+)$/.exec(n); if (m) out.push(m[1]); } }
    else if (loader === 'neoforge') { const p = neoPrefix(mc); if (p && n.startsWith('neoforge-' + p)) out.push(n.slice(9)); }
  }
  return [...new Set(out)];
}
async function pickLoader(loader, mc, pinned, dirs, signal) { // → { lv, installed }
  const loc = localLoaders(dirs, loader, mc).sort(vcmp), best = loc[loc.length - 1];
  if (pinned && loc.includes(pinned)) return { lv: pinned, installed: true };
  let want = pinned || '';
  if (!want) { try { want = await Promise.race([loaderLatest(loader, mc, signal), new Promise((_, rej) => setTimeout(() => rej(new Error('timeout')), 7000))]); } catch (e) { if (signal?.aborted) throw e; if (!best) throw e; want = ''; } }
  if (best && (!want || vcmp(want, best) <= 0)) return { lv: best, installed: true }; // такая (или более новая) версия уже скачана
  if (want) return { lv: want, installed: false }; // новая версия загрузчика — ставим
  throw new Error(`Не удалось узнать версию ${loader} для Minecraft ${mc}: проверьте интернет`);
}
async function plan(id, dirs, S, signal, fast = false) {
  if (!SAFE_ID.test(String(id))) throw new Error('Недопустимый идентификатор версии');
  const vdir = path.join(dirs.versions, id), vjp = path.join(vdir, id + '.json');
  let own = null; try { own = JSON.parse(fs.readFileSync(vjp, 'utf8')); } catch {}
  const base = own?.inheritsFrom || id;
  const vj = own?.inheritsFrom ? merge(await getVJ(base, dirs, signal, fast), own) : await getVJ(id, dirs, signal, fast), tasks = [], cp = [], natives = [];
  const add = (url, dest, sha1, size, label, exec) => tasks.push({ url, dest, sha1, size, label, exec });
  const jar = path.join(dirs.versions, base, base + '.jar'), c = vj.downloads.client;
  add(c.url, jar, c.sha1, c.size, 'Клиент ' + id);
  const seenLib = new Set(), natSeen = new Set();
  for (const l of vj.libraries) {
    if (!allowed(l.rules)) continue;
    const q = l.name.split(':'), key = [q[0], q[1], q[3]].join(':');
    const dup = seenLib.has(key); seenLib.add(key); // дубли отбрасываем только у основных jar (побеждает загрузчик); natives берём всегда: в 1.16 они идут отдельной записью с тем же именем
    let a = l.downloads?.artifact;
    if (!a && !l.downloads && !l.natives) { // старый формат (Forge ≤1.12.2 и др.): путь по имени, репозиторий по умолчанию — Mojang
      const rel = `${q[0].replace(/\./g, '/')}/${q[1]}/${q[2]}/${q[1]}-${q[2]}${q[3] ? '-' + q[3] : ''}.jar`;
      a = { path: rel, url: (l.url || 'https://libraries.minecraft.net/').replace(/^http:/, 'https:').replace(/\/?$/, '/') + rel, sha1: l.sha1, size: l.size };
    }
    if (a && !within(dirs.libraries, path.resolve(dirs.libraries, a.path))) a = null;
    if (a && !dup) { const d = path.join(dirs.libraries, a.path); add(a.url, d, a.sha1, a.size, l.name); cp.push(d); }
    const nk = l.natives?.windows;
    if (nk) { const n = l.downloads.classifiers?.[nk.replace('${arch}', process.arch === 'ia32' ? '32' : '64')];
      if (n && within(dirs.libraries, path.resolve(dirs.libraries, n.path))) { const d = path.join(dirs.libraries, n.path); add(n.url, d, n.sha1, n.size, l.name); if (!natSeen.has(d)) { natSeen.add(d); natives.push({ jar: d, exclude: l.extract?.exclude || [] }); } } }
  }
  cp.push(jar);
  const ai = vj.assetIndex, aip = path.join(dirs.assets, 'indexes', ai.id + '.json');
  if (fast) { if (!fs.existsSync(aip)) throw new Error('нет индекса ресурсов'); } else if (!(await fileOk({ dest: aip, sha1: ai.sha1, size: ai.size }))) await download({ url: ai.url, dest: aip, sha1: ai.sha1 }, signal, () => {});
  const idx = JSON.parse(fs.readFileSync(aip, 'utf8'));
  for (const o of Object.values(idx.objects)) { if (!/^[0-9a-f]{40}$/.test(String(o.hash))) throw new Error('Повреждённый индекс ресурсов'); const p = o.hash.slice(0, 2); add(`https://resources.download.minecraft.net/${p}/${o.hash}`, path.join(dirs.assets, 'objects', p, o.hash), o.hash, o.size, 'Ресурсы'); }
  // log4j-конфиг (защита от Log4Shell для 1.7–1.18.1)
  let logArg = null; const lc = vj.logging?.client;
  if (lc?.file) { const d = path.join(dirs.assets, 'log_configs', lc.file.id); add(lc.file.url, d, lc.file.sha1, lc.file.size, 'Конфиг логов'); logArg = lc.argument.replace('${path}', d); }
  // Java: ручной выбор или официальная среда Mojang
  const jv = vj.javaVersion || { component: 'jre-legacy', majorVersion: 8 };
  let javaBin = S.javaPath && fs.existsSync(S.javaPath) ? S.javaPath : null;
  if (!javaBin && fast) { javaBin = path.join(dirs.runtime, jv.component, 'bin', 'java.exe'); if (!fs.existsSync(javaBin)) throw new Error('Java не установлена'); }
  if (!javaBin) {
    const plat = { x64: 'windows-x64', arm64: 'windows-arm64', ia32: 'windows-x86' }[process.arch];
    const comp = (await getJson(RUNTIMES, signal))[plat]?.[jv.component]?.[0];
    if (!comp) throw new Error(`Java ${jv.majorVersion} (${jv.component}) недоступна для ${plat}`);
    const jdir = path.join(dirs.runtime, jv.component), jm = await getJson(comp.manifest.url, signal);
    for (const [rel, f] of Object.entries(jm.files)) {
      const dest = path.join(jdir, rel); if (!within(jdir, dest)) continue;
      if (f.type === 'directory') fs.mkdirSync(dest, { recursive: true }); else if (f.type === 'file') add(f.downloads.raw.url, dest, f.downloads.raw.sha1, f.downloads.raw.size, 'Java ' + jv.majorVersion, f.executable);
    }
    javaBin = path.join(jdir, 'bin', 'java.exe');
  }
  const seen = new Set(), list = tasks.filter((t) => !seen.has(t.dest) && seen.add(t.dest));
  if (fast && list.some((t) => !fs.existsSync(t.dest))) throw new Error('не хватает файлов'); // тогда обычный путь с проверкой и докачкой
  return { vj, idx, cp, natives, javaBin, jv, logArg, vdir, tasks: fast ? [] : list };
}
function crashSummary(p) { // причина краша из отчёта: описание и первая строка исключения
  try { const t = fs.readFileSync(p, 'utf8').split(/\r?\n/), d = t.find((l) => l.startsWith('Description:')) || '', i = t.findIndex((l) => /^[\w.$]+(Exception|Error)\b/.test(l)); return [d, i >= 0 ? t[i] : ''].filter(Boolean).join(' | ').slice(0, 300); } catch { return ''; }
}
function extractNatives(natives, ndir) {
  const AdmZip = require('adm-zip'); fs.mkdirSync(ndir, { recursive: true });
  for (const n of natives) { const z = new AdmZip(n.jar); for (const e of z.getEntries()) if (!e.isDirectory && !n.exclude.some((x) => e.entryName.startsWith(x))) z.extractEntryTo(e, ndir, false, true); }
}
function mapAssets(idx, dirs, gameDir) {
  const base = idx.map_to_resources ? path.join(gameDir, 'resources') : path.join(dirs.assets, 'virtual', 'legacy');
  for (const [n, o] of Object.entries(idx.objects)) {
    const d = path.join(base, n); if (!within(base, d) || fs.existsSync(d) || !/^[0-9a-f]{40}$/.test(String(o.hash))) continue;
    fs.mkdirSync(path.dirname(d), { recursive: true }); fs.copyFileSync(path.join(dirs.assets, 'objects', o.hash.slice(0, 2), o.hash), d);
  }
  return base;
}
const offlineUuid = (n) => { const h = crypto.createHash('md5').update('OfflinePlayer:' + n).digest(); h[6] = (h[6] & 15) | 48; h[8] = (h[8] & 63) | 128; const x = h.toString('hex'); return [x.slice(0, 8), x.slice(8, 12), x.slice(12, 16), x.slice(16, 20), x.slice(20)].join('-'); };
// Флаги, через которые настройки могли бы подключить чужой код к игре или подменить classpath/natives
const BAD_JVM = /^(-javaagent|-agentpath|-agentlib|-Xbootclasspath|-Xrun|-Xdebug|-XX:OnError|-XX:OnOutOfMemoryError|-XX:Flags|-XX:VMOptionsFile|-XX:\+?UnlockDiagnostic|-cp$|-classpath|--class-path|-jar$|--module-path|-p$|--upgrade-module-path|--patch-module|-Djava\.library\.path|-Djava\.class\.path|@)/i;
const badJvm = (str) => (String(str || '').trim().split(/\s+/).filter(Boolean).find((t) => BAD_JVM.test(t)) || '');
function buildArgs(c) {
  const v = { auth_player_name: c.auth?.name || c.name, version_name: c.id, game_directory: c.gameDir, assets_root: c.assetsRoot, game_assets: c.assetsRoot, assets_index_name: c.vj.assetIndex.id,
    auth_uuid: c.auth?.uuid || offlineUuid(c.name), auth_access_token: c.auth?.token || '0', auth_session: '0', clientid: '', auth_xuid: '', user_type: c.auth ? (c.auth.agent ? 'mojang' : 'msa') : 'legacy', version_type: c.vj.type, user_properties: '{}',
    natives_directory: c.ndir, library_directory: c.libDir, classpath_separator: path.delimiter, launcher_name: 'TotemLauncher', launcher_version: '0.14', classpath: c.cp.join(path.delimiter) };
  const sub = (s) => s.replace(/\$\{(\w+)\}/g, (m, k) => (k in v ? v[k] : m));
  const flat = (l) => l.flatMap((a) => (typeof a === 'string' ? [a] : allowed(a.rules) ? [].concat(a.value) : []));
  let jvm, game;
  if (c.vj.arguments) { jvm = flat(c.vj.arguments.jvm || []); game = flat(c.vj.arguments.game || []); }
  else { jvm = ['-Djava.library.path=${natives_directory}', '-cp', '${classpath}']; game = c.vj.minecraftArguments.split(' '); }
  jvm = jvm.map(sub); game = game.map(sub);
  // Forge/NeoForge 1.17+: BootstrapLauncher делает модули из ВСЕХ jar в classpath, кроме перечисленных в -DignoreList. Там стоит «${version_name}.jar» (id Forge), а в classpath лежит ванильный клиент <версия>.jar —
  // без этой добавки он становится вторым модулем «_1._20._1» рядом с «minecraft» и игра падает с ResolutionException. Добавляем имя клиентского jar в список игнорируемых.
  const cj = c.cp?.length ? path.basename(String(c.cp[c.cp.length - 1])) : ''; if (/\.jar$/i.test(cj)) jvm = jvm.map((a) => (/^-DignoreList=/.test(a) && !a.split(',').includes(cj) ? a + ',' + cj : a));
  if (c.logArg) jvm.push(c.logArg);
  if (c.auth?.agent) jvm.unshift(`-javaagent:${c.auth.agent.jar}=${c.auth.agent.url}`); // Ely.by: authlib-injector
  const sp = (s) => (s || '').trim().split(/\s+/).filter(Boolean);
  if (!badJvm(c.jvmArgs)) jvm.push(...sp(c.jvmArgs)); // при опасном флаге (например, -cp с путём) не применяем ВСЕ пользовательские аргументы: остаток строки мог бы стать именем главного класса game.push(...sp(c.gameArgs));
  if (c.fullscreen) game.push('--fullscreen'); else if (c.width && c.height) game.push('--width', String(c.width), '--height', String(c.height));
  jvm.unshift('-Xmx' + c.ram + 'M');
  return [...jvm, c.vj.mainClass, ...game];
}

// Память на новое окно: заданная в лаунчере ОЗУ делится на число окон (но не меньше 1 ГБ — иначе Minecraft не запустится)
const splitRam = (total, n) => Math.max(1024, Math.floor(total / Math.max(1, n)));
const LIVE = ['preparing', 'downloading', 'installing', 'launching', 'playing'];

const Deps = require('./deps'), Diag = require('./diag'), OptSync = require('./optsync');
class Game {
  constructor(root, getSettings, emit, log, getAuth, emitWins) {
    this.getAuth = getAuth || (async () => null);
    this.root = root; this.S = getSettings; this.emit = emit; this.log = log; this.busy = false; this.proc = null; this.ac = null;
    this.emitWins = emitWins || (() => {}); this.wins = new Map(); this.winSeq = 1; this.tail = Promise.resolve(); this.holders = 0; this.lp = 0; this.meta = null; this.percent = 0; this.op = '';
    this.dirs = Object.fromEntries(['versions', 'libraries', 'assets', 'runtime', 'game'].map((k) => [k, path.join(root, k)]));
  }
  set(state, extra = {}) { const ch = state !== this.state; this.state = state; if ('percent' in extra) this.percent = extra.percent; if (extra.op) this.op = extra.op; this.emit({ state, ...extra }); this.push(ch); }
  installed() { try { return fs.readdirSync(this.dirs.versions).filter((v) => fs.existsSync(path.join(this.dirs.versions, v, '.installed'))); } catch { return []; } }
  cancel() { this.ac?.abort(); this.child?.kill(); }
  stop() { if (this.proc) { this.stopping = true; this.proc.kill(); } }
  setMeta(m) { this.meta = { ...this.meta, ...m }; }
  // ---------- несколько окон ----------
  get running() { return !!this.proc || [...this.wins.values()].some((w) => w.proc); } // запущен ли хоть один Minecraft
  get active() { return this.busy || this.running || [...this.wins.values()].some((w) => w.state !== 'error'); } // идёт загрузка или игра в любом окне
  activeCount() { return (this.busy || this.proc ? 1 : 0) + [...this.wins.values()].filter((w) => w.state !== 'error').length; }
  ramInfo() { // что показать в предупреждении про память и сколько получит новое окно
    const S = this.S(), n = this.activeCount() + 1, share = splitRam(S.ram, n);
    const used = (this.proc ? this.meta?.ram || 0 : 0) + [...this.wins.values()].reduce((a, w) => a + (w.proc ? w.ram : 0), 0), sys = S.maxRam || 0;
    return { total: S.ram, windows: n, share, low: Math.floor(S.ram / n) < 1024, used, sys, over: !!sys && used + share > sys };
  }
  list() { // все окна для интерфейса
    const out = [];
    if ((this.busy || this.proc) && LIVE.includes(this.state)) out.push({ id: 'main', primary: true, state: this.state, label: this.meta?.label || 'Основное окно', name: this.meta?.name || '', ver: this.meta?.ver || '', ram: this.meta?.ram || 0, percent: this.percent || 0, op: this.op || '', since: this.meta?.since || 0 });
    for (const w of this.wins.values()) out.push({ id: w.id, primary: false, state: w.state, label: w.label, name: w.name, ver: w.ver, ram: w.ram, percent: w.percent || 0, op: w.op || '', error: w.error || '', since: w.since || 0 });
    return out;
  }
  push(force = true) { const t = Date.now(); if (!force && t - this.lp < 120) return; this.lp = t; try { this.emitWins(this.list()); } catch {} }
  stopWin(id) { // закрыть окно (или отменить его загрузку)
    if (id === 'main') { if (this.proc) this.stop(); else this.cancel(); return true; }
    const w = this.wins.get(id); if (!w) return false;
    if (w.proc) { w.stopping = true; w.proc.kill(); } else { w.ac.abort(); w.child?.kill(); } return true;
  }
  stopAll() { for (const w of this.list()) this.stopWin(w.id); }
  cancelAll() { this.cancel(); for (const w of this.wins.values()) if (!w.proc) { w.ac.abort(); w.child?.kill(); } } // при выходе из лаунчера: прерываем загрузки, запущенные игры не трогаем
  // spec: { id: версия Mojang, inst: сборка|undefined, title, name: ник, getAuth: () => auth|null, skin: {wide,slim}|null }
  openWindow(spec) {
    const S = this.S(), ram = this.ramInfo().share, n = ++this.winSeq, id = 'w' + n;
    const w = { id, n, state: 'preparing', ac: new AbortController(), child: null, proc: null, stopping: false, percent: 0, op: 'Подготовка', error: '', since: 0, ram, name: spec.name, ver: spec.inst?.mc || spec.id, label: `${spec.name} · ${spec.title || spec.id}` };
    w.set = (state, extra = {}) => { const ch = state !== w.state; w.state = state; if ('percent' in extra) w.percent = extra.percent; if (extra.op) w.op = extra.op; if (extra.error) w.error = extra.error; this.push(ch); };
    w.setMeta = (m) => { Object.assign(w, m); if (m.name) w.label = `${m.name} · ${spec.title || spec.id}`; };
    this.wins.set(id, w); this.push(true);
    const done = () => { this.push(true); this.wins.delete(id); if (spec.skin) { try { fs.unlinkSync(path.join(spec.inst?.dir || this.dirs.game, 'resourcepacks', `TotemSkin-${n}.zip`)); } catch {} try { fs.rmSync(path.join(this.root, '..', 'skin-win-' + n), { recursive: true, force: true }); } catch {} } this.push(true); };
    this._run(w, spec.id, true, spec.inst, { S: { ...S, playerName: spec.name, ram, skinInGame: spec.skinOn !== false }, getAuth: spec.getAuth, skin: spec.skin || null, hasSkin: true, packId: 'TotemSkin-' + n, logName: `game-${n}.log`, done });
    return { id, ram };
  }
  // очередь: загрузки/установки разных окон идут по одной, иначе они пишут в одни и те же файлы (.part)
  async _lock(ctx) {
    let rel; const prev = this.tail; this.tail = new Promise((r) => (rel = r)); if (this.holders > 0) ctx.set('preparing', { op: 'Ждём, пока закончится другая загрузка' });
    this.holders++; await prev; const release = () => { this.holders--; rel(); };
    if (ctx.ac.signal.aborted) { release(); throw new Error('cancelled'); } return release;
  }
  // Forge/NeoForge: официальный установщик (--installClient) после установки ванильной версии
  async installLoader(inst, S, ctx = this) {
    const d = this.dirs, sig = ctx.ac.signal, f = inst.loader === 'forge';
    const lv = (await pickLoader(inst.loader, inst.mc, inst.loaderVersion, d, sig)).lv;
    if (!/^[\w.+-]+$/.test(lv || '')) throw new Error('Неверная версия загрузчика');
    const name = f ? 'Forge' : 'NeoForge'; let vid = findLoaderVersion(d, inst.loader, inst.mc, lv); if (vid) return vid;
    ctx.set('preparing', { op: 'Подготовка Minecraft ' + inst.mc });
    const p = await plan(inst.mc, d, S, sig);
    ctx.set('downloading', { percent: 0 });
    await runTasks(p.tasks, sig, (r) => ctx.set('downloading', { ...r, percent: r.total ? Math.floor((r.done / r.total) * 100) : 0 }));
    const { url, sha1 } = f ? await forgeInstaller(inst.mc, lv, sig) : await neoInstaller(lv, sig);
    const jar = path.join(this.root, 'installers', path.basename(url));
    await runTasks([{ url, dest: jar, sha1, label: 'Установщик ' + name }], sig, () => {});
    const lp = path.join(this.root, 'launcher_profiles.json'); if (!fs.existsSync(lp)) fs.writeFileSync(lp, '{"profiles":{}}');
    ctx.set('installing', { op: 'Установка ' + name });
    await new Promise((res, rej) => {
      const c = (ctx.child = spawn(p.javaBin, ['-jar', jar, '--installClient', this.root], { cwd: this.root, windowsHide: true })); let tail = '';
      const on = (b) => { tail = (tail + b).slice(-2000); const l = String(b).trim().split(/\r?\n/).pop(); if (l) ctx.set('installing', { op: l.slice(0, 90) }); };
      c.stdout.on('data', on); c.stderr.on('data', on); c.once('error', rej);
      c.once('exit', (code) => { ctx.child = null; sig.aborted ? rej(new Error('cancelled')) : code === 0 ? res() : rej(new Error(`Установщик ${name} завершился с кодом ${code}: ${tail.slice(-300)}`)); });
    });
    vid = findLoaderVersion(d, inst.loader, inst.mc, lv); if (!vid) throw new Error('Установщик не создал версию ' + name);
    try { fs.unlinkSync(jar); } catch {}
    return vid;
  }
  async start(id, launch, inst) {
    if (this.busy || this.proc) return; // защита от повторного запуска
    this.busy = true; this.ac = new AbortController();
    const others = [...this.wins.values()].filter((w) => w.state !== 'error').length, S = this.S(); // запуск основного окна при работающих дополнительных: память тоже делится
    try { await this._run(this, id, launch, inst, others ? { S: { ...S, ram: splitRam(S.ram, others + 1) } } : {}); } finally { this.busy = false; this.push(true); }
  }
  // Общий конвейер для любого окна: ctx — this (основное окно) или объект окна из openWindow
  async _run(ctx, id, launch, inst, opt = {}) {
    const S = opt.S || this.S(), d = this.dirs, getAuth = opt.getAuth || this.getAuth, primary = ctx === this;
    try {
      ctx.set('preparing', { op: 'Получение манифестов' });
      if (primary) this.meta = { name: S.playerName, ver: inst?.mc || id, label: `${S.playerName} · ${inst?.name || id}`, ram: S.ram, since: 0 };
      const gameDir = inst?.dir || d.game, rel = await this._lock(ctx); let vid, p, fast, ndir, assetsRoot;
      try {
        vid = inst?.loader === 'fabric' ? await fabricProfile(inst.mc, (await pickLoader('fabric', inst.mc, inst.loaderVersion, d, ctx.ac.signal)).lv, d, ctx.ac.signal) : inst?.loader === 'forge' || inst?.loader === 'neoforge' ? await this.installLoader(inst, S, ctx) : id;
        p = null; const marker = path.join(d.versions, vid, '.installed');
        if (launch && fs.existsSync(marker)) { try { p = await plan(vid, d, S, ctx.ac.signal, true); } catch (e) { this.log('быстрый запуск недоступен: ' + e.message); } } // установлено один раз — дальше сразу запуск
        fast = !!p;
        if (!p) {
          p = await plan(vid, d, S, ctx.ac.signal);
          ctx.set('downloading', { percent: 0, op: 'Загрузка' });
          await runTasks(p.tasks, ctx.ac.signal, (r) => ctx.set('downloading', { ...r, percent: r.total ? Math.floor((r.done / r.total) * 100) : 0 }));
        }
        ndir = path.join(p.vdir, 'natives'); const haveNat = fs.existsSync(ndir) && fs.readdirSync(ndir).length > 0;
        if (!haveNat || (!fast && !this.running)) extractNatives(p.natives, ndir); // чужое окно уже держит эти DLL открытыми (Windows не даст их перезаписать)
        fs.mkdirSync(gameDir, { recursive: true });
        assetsRoot = p.idx.virtual || p.idx.map_to_resources ? mapAssets(p.idx, d, gameDir) : d.assets;
        fs.writeFileSync(path.join(p.vdir, '.installed'), '1');
      } finally { rel(); }
      if (!launch) return ctx.set('idle');
      ctx.set('launching', { op: 'Запуск Minecraft' });
      const auth = await getAuth(); // null = локальный профиль; ошибка = не запускаем с чужим профилем
      ctx.setMeta({ name: auth?.name || S.playerName }); if (primary) this.setMeta({ label: `${auth?.name || S.playerName} · ${inst?.name || id}` });
      const args = buildArgs({ auth, id: vid, vj: p.vj, cp: p.cp, ndir, gameDir, libDir: d.libraries, assetsRoot, name: S.playerName, ram: S.ram, logArg: p.logArg, jvmArgs: S.jvmArgs, gameArgs: S.gameArgs, fullscreen: S.fullscreen, width: S.width, height: S.height });
      this.log(`launch ${id}${primary ? '' : ' [' + ctx.id + ']'}: ${p.javaBin} ${args.join(' ').replace(/\s-{1,2}accessToken\s\S+/, '')}`);
      fs.mkdirSync(path.join(this.root, '..', 'logs'), { recursive: true });
      const lf = fs.createWriteStream(path.join(this.root, '..', 'logs', opt.logName || 'game.log')); let tail = '';
      const jw = path.join(path.dirname(p.javaBin), 'javaw.exe'), exe = fs.existsSync(jw) ? jw : p.javaBin; // javaw: без консоли; windowsHide не ставим — иначе окно игры может создаться скрытым
      const skinDir = path.join(this.root, '..', 'skin-active'), dataDir = path.join(this.root, '..'), omc = OptSync.mcOf(inst, id), shareOpt = S.sharedOptions !== false;
      if (shareOpt) { try { OptSync.pull(gameDir, omc, dataDir); } catch (e) { this.log('options: ' + e.message); } } // общие настройки игры из других сборок (до скина: он дописывает свою строку ресурс-паков)
      if (opt.hasSkin) { // дополнительное окно: свой скин в отдельном ресурс-паке (TotemSkin-N.zip), чтобы не трогать файлы первого окна
        try { if (opt.skin && S.skinInGame !== false && !auth?.agent) { const dir = path.join(this.root, '..', 'skin-win-' + ctx.n); fs.mkdirSync(dir, { recursive: true }); fs.writeFileSync(path.join(dir, 'wide.png'), opt.skin.wide); fs.writeFileSync(path.join(dir, 'slim.png'), opt.skin.slim); applySkin(gameDir, id, dir, true, opt.packId); } else applySkin(gameDir, id, '', false, opt.packId); } catch (e) { this.log('skin: ' + e.message); }
      } else if (S.skinInGame !== false) { try { applySkin(gameDir, id, skinDir, true); } catch (e) { this.log('skin: ' + e.message); } } else { try { applySkin(gameDir, id, '', false); } catch {} }
      ctx.stopping = false; const startedAt = Date.now(), proc = (ctx.proc = spawn(exe, args, { cwd: gameDir }));
      const on = (b) => { lf.write(b); tail = (tail + b).slice(-40000); }; proc.stdout.on('data', on); proc.stderr.on('data', on);
      proc.once('spawn', () => { ctx.setMeta({ since: Date.now() }); ctx.set('playing'); });
      proc.once('error', (e) => { ctx.proc = null; ctx.set('error', { error: 'Не удалось запустить Java: ' + e.message }); opt.done?.(); });
      proc.once('exit', (c) => { ctx.proc = null; lf.end(); if (shareOpt) { try { OptSync.push(gameDir, omc, dataDir); } catch (e) { this.log('options: ' + e.message); } } // что настроили в игре, становится общим для всех сборок
        const code = c == null ? 0 : c | 0, stopped = ctx.stopping; ctx.stopping = false;
        // игра закрылась (в том числе окном ошибки загрузки модов): читаем консоль и журнал — не хватило ли каких-то модов-зависимостей
        let dep = []; if (primary && inst?.id && !stopped) { try { dep = Deps.scan({ gameDir, tail, since: startedAt }); } catch (e) { this.log('deps: ' + e.message); } }
        const depInfo = dep.length ? { inst: inst.id, mc: inst.mc, loader: inst.loader, list: dep } : null; if (depInfo) this.log('не хватает модов: ' + dep.map((x) => x.id).join(', '));
        if (code === 0 || stopped) { ctx.set('idle', depInfo ? { deps: depInfo } : {}); return opt.done?.(); }
        let lines = tail.trim().split(/\r?\n/).slice(-5).join(' | '); if (!lines) { try { lines = fs.readFileSync(path.join(gameDir, 'logs', 'latest.log'), 'utf8').trim().split(/\r?\n/).slice(-5).join(' | '); } catch {} }
        let diag = null; if (primary && inst?.id && !stopped && !depInfo) { try { diag = Diag.analyze({ gameDir, tail, since: startedAt, code, inst: { ...inst, dir: gameDir }, S }); if (diag) { diag.inst = inst.id; this.log(`диагностика: ${diag.id} — ${diag.title}`); } } catch (e) { this.log('diag: ' + e.message); } }
        const cm = /Crash report saved to:\s*(?:#@!@#\s*)?(.+?\.txt)/.exec(tail), why = cm ? crashSummary(cm[1].trim()) : '';
        this.log(`game exit ${code}: ${why || lines}`); ctx.set('error', { ...(diag ? { diag } : {}), error: diag ? `${diag.short || diag.title}. ${diag.text}`.slice(0, 400) : depInfo ? 'Игре не хватает модов: ' + dep.map((x) => x.id).slice(0, 6).join(', ') + (dep.length > 6 ? '…' : '') : `Игра завершилась с кодом ${code}. ${why || lines.slice(-350)}`, ...(depInfo ? { deps: depInfo } : {}) });
        if (primary) try { this.onFail?.({ code, gameDir, inst, id: vid, tail, why, ram: S.ram, label: ctx.label || ctx.meta?.label || '', logFile: path.join(this.root, '..', 'logs', opt.logName || 'game.log') }); } catch (e) { this.log('onFail: ' + e.message); } // журнал ошибок: подробный разбор причины — отдельно и асинхронно
        opt.done?.(); });
    } catch (e) {
      this.log('game error: ' + (e.stack || e));
      ctx.ac.signal.aborted ? ctx.set('idle') : ctx.set('error', { error: e.message === 'cancelled' ? 'Загрузка прервана из-за сбоя сети. Нажмите «Играть» ещё раз — уже скачанное повторно качаться не будет.' : e.message }); opt.done?.(); // «cancelled» без нажатия отмены больше не показываем
    }
  }
}
Game.setPaused = setPaused; Game.fabricLatest = fabricLatest; Game.loaderLatest = loaderLatest; Game.pickLoader = pickLoader; Game.localLoaders = localLoaders; Game.badJvm = badJvm;
module.exports = Game;
module.exports._t = { pickLoader, localLoaders, vcmp, within, SAFE_ID, badJvm, httpsOnly, splitRam, crashSummary, extractNatives, findLoaderVersion, forgeInstaller, loaderLatest, plan, merge, allowed, buildArgs, offlineUuid, download, runTasks, sha1File, setPaused, PAUSE };
