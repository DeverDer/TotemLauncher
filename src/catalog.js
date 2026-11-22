// Каталог: Modrinth (моды, ресурс-паки, шейдеры, датапаки, сборки) и CurseForge (карты). Установка, зависимости, буст FPS.
'use strict';
const fs = require('fs'), path = require('path'), os = require('os');
const { runTasks } = require('./game')._t;
const UA = { 'User-Agent': 'TotemLauncher/0.15 (https://t.me/TotemLauncher)' };
const MAX_ENTRY = 1.5e9, MAX_FILES = 60000, MAX_PACK_FILES = 10000, MAX_PACK_BYTES = 8e9;
let MR = 'https://api.modrinth.com/v2'; const CF = 'https://api.curseforge.com/v1', LOADERS = ['forge', 'fabric', 'neoforge', 'quilt'];
const FOLDER = { mod: 'mods', resourcepack: 'resourcepacks', shader: 'shaderpacks', datapack: 'datapacks' };
const NICE = { sodium: 'Sodium', lithium: 'Lithium', 'ferrite-core': 'FerriteCore', entityculling: 'EntityCulling', starlight: 'Starlight', optifine: 'OptiFine' };
const sig = () => new AbortController().signal;
const isCancel = (e, signal) => !!signal?.aborted || e?.message === 'cancelled' || e?.name === 'AbortError';
// скачивание набора файлов с возможностью отмены: при отмене удаляем то, что успело скачаться в этом задании (файлы, что были до него, не трогаем)
async function runJob(tasks, cb, signal) {
  const pre = new Set(tasks.filter((t) => fs.existsSync(t.dest)).map((t) => t.dest));
  try { await runTasks(tasks, signal || sig(), cb); }
  catch (e) { if (isCancel(e, signal)) for (const t of tasks) if (!pre.has(t.dest)) { try { fs.unlinkSync(t.dest); } catch {} } throw e; }
}
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const RETRY = new Set([408, 429, 500, 502, 503, 504]);
const cleanKey = (k) => String(k || '').replace(/[\s\u200b-\u200d\ufeff]/g, '').replace(/^x-api-key:/i, '').replace(/^["'«»“”‘’]+|["'«»“”‘’]+$/g, ''); // ключ часто копируют с пробелом, кавычками или переводом строки
function httpError(status, url, body) {
  const cf = url.startsWith(CF), html = /<html|cloudflare|just a moment/i.test(body || '');
  let m = 'Сервер ответил HTTP ' + status;
  if (cf && (status === 401 || status === 403)) m = html ? `CurseForge не пускает запрос (HTTP ${status}): сайт защищён от ботов или недоступен из вашей сети. Попробуйте позже или другую сеть/VPN.`
    : `CurseForge не принял ключ (HTTP ${status}). Скопируйте «API Key» целиком из console.curseforge.com → API Keys (он начинается с $2a$10$) и вставьте без пробелов и кавычек.`;
  else if (status === 429) m = 'Слишком много запросов: подождите минуту и повторите';
  const e = new Error(m); e.status = status; e.cfAuth = cf && (status === 401 || status === 403) && !html; return e;
}
function netError(c) { // сетевой сбой: код причины из undici (ENOTFOUND, ETIMEDOUT, ECONNRESET…) вместо голого «fetch failed»
  const code = c?.cause?.code || c?.code || (c?.name === 'TimeoutError' ? 'ETIMEDOUT' : '');
  const e = new Error('Сеть не отвечает' + (code ? ` (${code})` : '') + '. Повторите попытку.'); e.net = true; e.code = code; return e;
}
async function http(url, headers, parse) { // 3 попытки с паузой; ответы 4xx не повторяются
  let last;
  for (let a = 1; a <= 3; a++) {
    try {
      const r = await fetch(url, { headers: { ...UA, ...headers }, signal: AbortSignal.timeout(25000) });
      if (!r.ok) { if (RETRY.has(r.status) && a < 3) { await sleep((r.status === 429 ? 1500 : 400) * a); continue; } throw httpError(r.status, url, (await r.text().catch(() => '')).slice(0, 400)); }
      return await parse(r);
    } catch (e) { if (e.status) throw e; last = e; if (a < 3) await sleep(400 * a); }
  }
  throw netError(last);
}
const jget = (url, headers = {}) => http(url, headers, (r) => r.json());
const projMeta = async (ids) => { const j = await jget(`${MR}/projects?ids=${encodeURIComponent(JSON.stringify(ids))}`); return Object.fromEntries(j.map((p) => [p.id, { title: p.title, icon: p.icon_url || '' }])); };
const tget = (url) => http(url, {}, (r) => r.text());
// есть ли вообще интернет: пробуем два независимых сервера (если хоть один ответил — сеть есть)
async function online() {
  for (const u of ['https://api.modrinth.com/', 'https://piston-meta.mojang.com/mc/game/version_manifest_v2.json']) { try { await fetch(u, { method: 'HEAD', headers: UA, signal: AbortSignal.timeout(4000) }); return true; } catch {} }
  return false;
}
let TEST_ORIGIN = ''; // для автотестов и скриншотов: свой сервер вместо Modrinth (включает main.js только из исходников)
const setTestBase = (b) => { if (typeof b === 'string' && /^http:\/\/127\.0\.0\.1:\d{2,5}$/.test(b)) { TEST_ORIGIN = b; MR = b + '/v2'; } };
const okHost = (u) => { try { if (TEST_ORIGIN && String(u).startsWith(TEST_ORIGIN + '/')) return true; const h = new URL(u); return h.protocol === 'https:' && /(^|\.)(modrinth\.com|forgecdn\.net|curseforge\.com|github\.com|githubusercontent\.com|gitlab\.com)$/.test(h.hostname); } catch { return false; } };
const fileOf = (v) => v.files.find((f) => f.primary) || v.files[0];
const badRel = (r) => { const p = String(r); return !p || p.includes('\0') || /^[\\/]|^[A-Za-z]:|:/.test(p) || p.split(/[\\/]/).some((x) => x === '..' || /^(con|prn|aux|nul|com\d|lpt\d)(\..*)?$/i.test(x) || /[. ]$/.test(x)) || p.replace(/\\/g, '/') === '.totem-catalog.json'; }; // абсолютные пути, «..», C:, потоки NTFS, имена CON/NUL…
const safeName = (n) => { const b = path.basename(String(n)); if (!/\.(jar|zip|mrpack)$/i.test(b) || b.startsWith('.')) throw new Error('Недопустимое имя файла'); return b; };

// ---------- учёт скачанного: какие проекты каталога уже лежат в сборке ----------
const MANI = '.totem-catalog.json', ARCH = 'mods-archive';
const readMani = (dir) => { try { const m = JSON.parse(fs.readFileSync(path.join(dir, MANI), 'utf8')); return m && typeof m === 'object' ? m : {}; } catch { return {}; } };
function record(dir, list) { // list: [{ key: 'mr:<id>', folder, file, title, icon, mc, loader, src }] — иконка и версия нужны вкладке «Сборки» и проверке совместимости
  const m = readMani(dir); for (const x of list) m[x.key] = { folder: x.folder, files: [x.file], title: x.title || '', icon: x.icon || '', mc: x.mc || '', loader: x.loader || '', src: x.src || '' };
  fs.mkdirSync(dir, { recursive: true }); const t = path.join(dir, MANI + '.tmp'); fs.writeFileSync(t, JSON.stringify(m)); fs.renameSync(t, path.join(dir, MANI));
}
const present = (dir, folder, f) => [path.join(dir, folder, f), path.join(dir, folder, f + '.disabled'), path.join(dir, ARCH, f), path.join(dir, ARCH, f + '.disabled')].some((x) => fs.existsSync(x));
function installedKeys(dir) { // ключи проектов, чьи файлы сейчас реально есть (удалённое вручную не считается)
  const m = readMani(dir); return Object.keys(m).filter((k) => (m[k].files || []).some((f) => present(dir, m[k].folder, f)));
}
// ---------- Modrinth ----------
async function search(o) {
  if (o.type === 'map') return cfSearch(o);
  const f = [[`project_type:${o.type}`]]; if (o.mc) f.push([`versions:${o.mc}`]); if ((o.type === 'mod' || o.type === 'modpack') && o.loader) f.push([`categories:${o.loader}`]);
  const j = await jget(`${MR}/search?query=${encodeURIComponent(o.q || '')}&facets=${encodeURIComponent(JSON.stringify(f))}&index=${o.sort === 'new' ? 'newest' : 'downloads'}&offset=${o.offset | 0}&limit=20`);
  return { total: j.total_hits, hits: j.hits.map((h) => ({ src: 'mr', id: h.project_id, slug: h.slug, type: h.project_type, title: h.title, desc: h.description, author: h.author, icon: h.icon_url, images: (h.gallery || []).slice(0, 3), downloads: h.downloads, loaders: (h.categories || []).filter((c) => LOADERS.includes(c)), mcs: (h.versions || []).slice(-5), updated: h.date_modified })) };
}
async function project(o) {
  if (o.src === 'cf') { const m = (await jget(`${CF}/mods/${encodeURIComponent(o.id)}`, cfh(o.cfKey))).data; return { src: 'cf', id: String(m.id), type: 'map', title: m.name, desc: m.summary, body: m.summary, icon: m.logo?.url, gallery: (m.screenshots || []).map((s) => ({ url: s.url, title: s.title })).slice(0, 8), downloads: m.downloadCount, loaders: [], mcs: [...new Set((m.latestFilesIndexes || []).map((x) => x.gameVersion))].slice(0, 12), links: { site: m.links?.websiteUrl, source: m.links?.sourceUrl, issues: m.links?.issuesUrl }, team: (m.authors || []).map((a) => ({ name: a.name, role: 'Автор' })) }; }
  const [p, m] = await Promise.all([jget(`${MR}/project/${encodeURIComponent(o.id)}`), jget(`${MR}/project/${encodeURIComponent(o.id)}/members`).catch(() => [])]);
  return { src: 'mr', id: p.id, type: p.project_type, title: p.title, desc: p.description, body: String(p.body || '').slice(0, 6000), icon: p.icon_url, gallery: (p.gallery || []).map((g) => ({ url: g.url, title: g.title })).slice(0, 8), downloads: p.downloads, followers: p.followers, loaders: p.loaders || [], mcs: (p.game_versions || []).slice(-14), license: p.license?.name || '',
    links: { site: `https://modrinth.com/${p.project_type}/${p.slug}`, source: p.source_url, issues: p.issues_url, wiki: p.wiki_url }, team: m.map((x) => ({ name: x.user?.username, role: x.role, avatar: x.user?.avatar_url })) };
}
async function pickVersion(id, o) {
  const q = (mc, ld) => { const p = []; if (mc) p.push('game_versions=' + encodeURIComponent(JSON.stringify([mc]))); if (ld) p.push('loaders=' + encodeURIComponent(JSON.stringify([ld]))); return `${MR}/project/${encodeURIComponent(id)}/version${p.length ? '?' + p.join('&') : ''}`; };
  const ld = o.type === 'mod' || o.type === 'modpack' ? o.loader : ''; let vs = await jget(q(o.mc, ld)), exact = true;
  if (!vs.length) { vs = await jget(q('', ld)); exact = false; } if (!vs.length) return null;
  const v = vs.find((x) => x.version_type === 'release') || vs[0]; return { v, exact: exact && (!o.mc || v.game_versions.includes(o.mc)) };
}
async function resolve(id, o, seen = new Set([id]), depth = 0) { // версия + дерево обязательных зависимостей
  const pv = await pickVersion(id, o); if (!pv) return null; const out = { pid: id, ...pv, deps: [] };
  if (depth < 3) for (const d of pv.v.dependencies || []) { if (d.dependency_type !== 'required' || !d.project_id || seen.has(d.project_id)) continue; seen.add(d.project_id); let sub = null;
    if (d.version_id) { try { const vv = await jget(`${MR}/version/${d.version_id}`); sub = { pid: d.project_id, v: vv, exact: !o.mc || vv.game_versions.includes(o.mc), deps: [] }; } catch {} }
    if (!sub) sub = await resolve(d.project_id, { ...o, type: 'mod' }, seen, depth + 1); if (sub) out.deps.push(sub); }
  return out;
}
const flat = (t, seen = new Set()) => { const out = []; for (const d of t.deps || []) { if (seen.has(d.pid)) continue; seen.add(d.pid); out.push(d, ...flat(d, seen)); } return out; };
const titles = async (ids) => { const j = await jget(`${MR}/projects?ids=${encodeURIComponent(JSON.stringify(ids))}`); return Object.fromEntries(j.map((p) => [p.id, p.title])); };
async function plan(o) { // что будет скачано и есть ли расхождения версий
  if (o.src === 'cf') { const f = await cfPick(o); return { title: f.title, version: f.file.fileName, exact: f.exact, warn: f.exact ? '' : `Файл рассчитан на Minecraft ${f.file.gameVersions.filter((g) => /^\d/.test(g)).slice(0, 3).join(', ')}, а сборка на ${o.mc}.`, deps: [] }; }
  const t = await resolve(o.id, o); if (!t) throw new Error(`Для загрузчика «${o.loader}» нет подходящих версий`); const deps = flat(t), names = await titles([t.pid, ...deps.map((d) => d.pid)]).catch(() => ({}));
  return { title: names[t.pid] || o.id, version: t.v.version_number, exact: t.exact, warn: t.exact ? '' : `Версия «${t.v.version_number}» рассчитана на Minecraft ${t.v.game_versions.slice(-3).join(', ')}, а сборка на ${o.mc} (${o.loader}). Может не работать.`, deps: deps.map((d) => ({ pid: d.pid, title: names[d.pid] || d.pid, version: d.v.version_number })) };
}
async function install(o, instDir, cb = () => {}, signal) {
  if (o.src === 'cf') { const f = await cfPick(o), sv = path.join(instDir, 'saves'), tmp = path.join(sv, '.dl-' + f.file.id + '.zip');
    await runJob([{ url: f.file.downloadUrl, dest: tmp, sha1: (f.file.hashes || []).find((h) => h.algo === 1)?.value, size: f.file.fileLength, label: f.file.fileName }], cb, signal);
    try { const w = path.basename(extractWorld(tmp, sv, f.file.fileName)); record(instDir, [{ key: 'cf:' + o.id, folder: 'saves', file: w, title: f.title, icon: o.icon, mc: o.mc, loader: o.loader, src: 'cf' }]); return { installed: [w] }; } finally { try { fs.unlinkSync(tmp); } catch {} } }
  if (!FOLDER[o.type]) throw new Error('Неизвестный тип проекта'); const t = await resolve(o.id, o); if (!t) throw new Error('Нет подходящих версий'); const items = [t, ...(o.deps ? flat(t) : [])];
  let base0 = FOLDER[o.type]; // датапаки игра читает только из saves/<мир>/datapacks
  if (o.type === 'datapack') { const w = String(o.world || ''); if (!w || badRel(w) || /[\\/]/.test(w) || !fs.existsSync(path.join(instDir, 'saves', w))) throw new Error('Выберите мир для датапака'); base0 = path.join('saves', w, 'datapacks'); }
  const tasks = items.map((it, k) => { const f = fileOf(it.v); if (!f || !okHost(f.url)) throw new Error('Недопустимая ссылка на файл'); const name = safeName(f.filename);
    return { url: f.url, dest: path.join(instDir, k === 0 || o.type === 'datapack' ? base0 : 'mods', name), sha1: f.hashes?.sha1, size: f.size, label: it.v.name || name }; });
  await runJob(tasks, cb, signal);
  let meta = {}; try { meta = await projMeta(items.map((it) => it.pid)); } catch {} // иконки и названия проектов (для списка модов); без сети — просто без иконок
  record(instDir, items.map((it, k) => ({ key: 'mr:' + it.pid + (o.type === 'datapack' ? '@' + o.world : ''), folder: path.relative(instDir, path.dirname(tasks[k].dest)), file: path.basename(tasks[k].dest), title: meta[it.pid]?.title || (k === 0 && o.title) || it.v.name || '', icon: (k === 0 && o.icon) || meta[it.pid]?.icon || '', mc: o.mc, loader: o.loader, src: 'mr' })));
  return { installed: tasks.map((x) => path.basename(x.dest)) };
}
// ---------- сборки .mrpack ----------
async function installPack(o, instances, cb = () => {}, signal) {
  const AdmZip = require('adm-zip'), pv = await pickVersion(o.id, { mc: o.mc, loader: o.loader, type: 'modpack' }); if (!pv) throw new Error('У сборки нет файлов для скачивания');
  const f = fileOf(pv.v); if (!okHost(f.url)) throw new Error('Недопустимая ссылка'); const tmp = path.join(os.tmpdir(), 'totem-' + Date.now() + '.mrpack');
  await runTasks([{ url: f.url, dest: tmp, sha1: f.hashes?.sha1, size: f.size, label: 'Сборка ' + (o.title || '') }], signal || sig(), cb);
  try { const z = new AdmZip(tmp), idx = JSON.parse(z.readAsText('modrinth.index.json')), dp = idx.dependencies || {}, mc = dp.minecraft; if (!mc) throw new Error('В сборке не указана версия Minecraft');
    const L = dp['fabric-loader'] ? ['fabric', dp['fabric-loader']] : dp.forge ? ['forge', dp.forge] : dp.neoforge ? ['neoforge', dp.neoforge] : dp['quilt-loader'] ? ['quilt'] : ['vanilla', ''];
    if (L[0] === 'quilt') throw new Error('Сборки на Quilt пока не поддерживаются');
    const inst = instances.create({ name: String(o.title || idx.name || 'Сборка').slice(0, 40), mc, loader: L[0], loaderVersion: L[1] }); try { instances.setMeta?.(inst.id, { origin: 'modpack' }); } catch {} const dir = path.resolve(instances.dir(inst)), inside = (p) => path.resolve(p).startsWith(dir + path.sep);
    const files = (idx.files || []).filter((x) => x.env?.client !== 'unsupported'); if (files.length > MAX_PACK_FILES || files.reduce((n, x) => n + (+x.fileSize || 0), 0) > MAX_PACK_BYTES) throw new Error('Сборка слишком большая');
    const tasks = files.map((x) => { const dest = path.join(dir, String(x.path)), url = (x.downloads || [])[0]; if (!badRel(x.path) && inside(dest) && okHost(url)) { /* ok */ } else throw new Error('Недопустимый файл в сборке: ' + x.path); return { url, dest, sha1: x.hashes?.sha1, size: x.fileSize, label: path.basename(x.path) }; });
    try { await runTasks(tasks, signal || sig(), cb); } catch (e) { if (isCancel(e, signal)) { try { instances.remove(inst.id); } catch {} } throw e; } // отмена: недокачанную сборку не оставляем
    let total = 0, cnt = 0; for (const e of z.getEntries()) { const m = /^(client-)?overrides\/(.+)$/.exec(e.entryName); if (!m || e.isDirectory) continue; if (badRel(m[2])) continue; const t = path.join(dir, m[2]); if (!inside(t)) continue; if (++cnt > MAX_PACK_FILES || (e.header?.size || 0) > MAX_ENTRY) throw new Error('Сборка слишком большая'); const data = e.getData(); if ((total += data.length) > MAX_PACK_BYTES) throw new Error('Сборка слишком большая'); fs.mkdirSync(path.dirname(t), { recursive: true }); fs.writeFileSync(t, data); }
    return inst; } finally { try { fs.unlinkSync(tmp); } catch {} }
}
// ---------- CurseForge: карты ----------
const cfh = (key) => ({ 'x-api-key': cleanKey(key), Accept: 'application/json' });
async function cfCheck(key) { // проверка ключа лёгким запросом
  key = cleanKey(key); if (!key) { const e = new Error('Ключ пустой'); e.needKey = true; throw e; }
  await jget(`${CF}/games/432`, cfh(key)); return true;
}
const MAPCATS = { adventure: /adventure/i, survival: /survival/i, parkour: /parkour/i, puzzle: /puzzle/i, minigame: /mini/i, building: /creat|build/i, horror: /horror/i }; let cfCat = null;
async function cfSearch(o) {
  if (!o.cfKey) { const e = new Error('Для карт нужен бесплатный API-ключ CurseForge'); e.needKey = true; throw e; }
  const qs = ['gameId=432', 'classId=17', 'searchFilter=' + encodeURIComponent(o.q || ''), 'sortField=' + (o.sort === 'new' ? 11 : 2), 'sortOrder=desc', 'pageSize=20', 'index=' + (o.offset | 0)]; if (o.mc) qs.push('gameVersion=' + encodeURIComponent(o.mc));
  if (o.mapCat && MAPCATS[o.mapCat]) { cfCat = cfCat || (await jget(`${CF}/categories?gameId=432&classId=17`, cfh(o.cfKey))).data; const c = cfCat.find((x) => MAPCATS[o.mapCat].test(x.name)); if (c) qs.push('categoryId=' + c.id); }
  const j = await jget(`${CF}/mods/search?${qs.join('&')}`, cfh(o.cfKey));
  return { total: j.pagination?.totalCount, hits: j.data.map((m) => ({ src: 'cf', id: String(m.id), slug: m.slug, type: 'map', title: m.name, desc: m.summary, author: (m.authors || []).map((a) => a.name).join(', '), icon: m.logo?.url, images: (m.screenshots || []).slice(0, 3).map((s) => s.url), downloads: m.downloadCount, loaders: [], mcs: [...new Set((m.latestFilesIndexes || []).map((x) => x.gameVersion))].slice(0, 5), updated: m.dateModified, site: m.links?.websiteUrl })) };
}
async function cfPick(o) {
  if (!o.cfKey) { const e = new Error('Нужен ключ CurseForge'); e.needKey = true; throw e; }
  const m = (await jget(`${CF}/mods/${encodeURIComponent(o.id)}`, cfh(o.cfKey))).data; let fs_ = (await jget(`${CF}/mods/${encodeURIComponent(o.id)}/files?gameVersion=${encodeURIComponent(o.mc)}&pageSize=10`, cfh(o.cfKey))).data, exact = true;
  if (!fs_.length) { fs_ = (await jget(`${CF}/mods/${encodeURIComponent(o.id)}/files?pageSize=10`, cfh(o.cfKey))).data; exact = false; } if (!fs_.length) throw new Error('У карты нет файлов');
  const file = fs_.find((f) => f.downloadUrl && okHost(f.downloadUrl)); if (!file) { const e = new Error('Автор карты запретил скачивание вне CurseForge'); e.manual = m.links?.websiteUrl; throw e; }
  return { title: m.name, file, exact: exact && (file.gameVersions || []).includes(o.mc) };
}
function extractWorld(zipPath, savesDir, hint) { // распаковка мира в saves/<имя> с защитой путей
  const AdmZip = require('adm-zip'), ents = new AdmZip(zipPath).getEntries().filter((e) => !e.entryName.includes('__MACOSX')), lv = ents.find((e) => /(^|\/)level\.dat$/.test(e.entryName) && e.entryName.split('/').length <= 3);
  if (!lv) throw new Error('В архиве нет мира (level.dat)'); if (ents.length > MAX_FILES || ents.reduce((s, e) => s + (e.header?.size || 0), 0) > 2e9) throw new Error('Архив слишком большой');
  const prefix = lv.entryName.slice(0, -'level.dat'.length), name = ((prefix ? prefix.replace(/\/$/, '').split('/').pop() : path.basename(hint, path.extname(hint))).replace(/[<>:"/\\|?*\x00-\x1f]/g, '_').slice(0, 60)) || 'Карта';
  let dest = path.join(savesDir, name); for (let i = 2; fs.existsSync(dest); i++) dest = path.join(savesDir, `${name} (${i})`); const root = path.resolve(dest);
  let wrote = 0; try { for (const e of ents) { if (!e.entryName.startsWith(prefix) || e.isDirectory) continue; const rel = e.entryName.slice(prefix.length); if (badRel(rel)) continue; const t = path.join(dest, rel); if (!path.resolve(t).startsWith(root + path.sep)) continue; const data = e.getData(); if ((wrote += data.length) > 2e9) throw new Error('Архив слишком большой (после распаковки)'); fs.mkdirSync(path.dirname(t), { recursive: true }); fs.writeFileSync(t, data); } }
  catch (e) { fs.rmSync(dest, { recursive: true, force: true }); throw e; } // недоделанный мир не оставляем
  return dest;
}
// ---------- OptiFine (официальный сайт) и поддержка шейдеров ----------
async function optifine(inst, cb = () => {}, signal) {
  const page = await tget('https://optifine.net/downloads'), re = /adloadx\?f=(OptiFine_(\d+(?:\.\d+)+)_HD_U_[A-Za-z0-9_]+\.jar)/g; let m, f = null;
  while ((m = re.exec(page))) if (m[2] === inst.mc) { f = m[1]; break; } if (!f) throw new Error(`нет сборки OptiFine для ${inst.mc}`);
  const ad = await tget('https://optifine.net/adloadx?f=' + f), d = /downloadx\?f=[^'"&\s]+&(?:amp;)?x=[A-Za-z0-9]+/.exec(ad); if (!d) throw new Error('сайт OptiFine изменился');
  const r = await fetch('https://optifine.net/' + d[0].replace(/&amp;/g, '&'), { headers: UA, signal }); if (!r.ok) throw new Error('HTTP ' + r.status); const b = Buffer.from(await r.arrayBuffer());
  if (b.readUInt16BE(0) !== 0x504b) throw new Error('получен не jar-файл'); cb({ op: f, done: b.length, total: b.length, speed: 0 });
  fs.mkdirSync(path.join(inst.dir, 'mods'), { recursive: true }); fs.writeFileSync(path.join(inst.dir, 'mods', f), b); return f;
}
async function shaderSupport(inst, cb, signal) { // шейдеры без OptiFine/Iris не работают
  try { if (fs.readdirSync(path.join(inst.dir, 'mods')).some((x) => /optifine|iris|oculus/i.test(x))) return { note: '' }; } catch {}
  if (inst.loader === 'forge') { try { await optifine(inst, cb, signal); return { note: 'OptiFine для вашей версии добавлен в моды.' }; } catch (e) { if (isCancel(e, signal)) throw e; return { note: `OptiFine автоматически скачать не удалось (${e.message}). Скачайте его на optifine.net и положите в mods.`, manual: 'https://optifine.net/downloads' }; } }
  try { await install({ src: 'mr', id: 'iris', type: 'mod', mc: inst.mc, loader: inst.loader, deps: true }, inst.dir, cb, signal); return { note: 'OptiFine на этом загрузчике не работает, поэтому добавлен Iris (с зависимостями) — он запускает шейдеры.' }; } catch (e) { if (isCancel(e, signal)) throw e; return { note: 'Для запуска шейдеров нужен Iris или OptiFine, но подходящий мод скачать не удалось: ' + e.message }; }
}
// ---------- буст FPS ----------
const BOOST = [['sodium', ['fabric']], ['lithium', ['fabric']], ['ferrite-core', ['fabric', 'forge', 'neoforge']], ['entityculling', ['fabric', 'forge', 'neoforge']], ['starlight', ['fabric']], ['optifine', ['forge']]];
async function boost(inst, cb = () => {}, signal) {
  const rep = { installed: [], warnings: [] };
  for (const [slug, lds] of BOOST) { if (!lds.includes(inst.loader)) continue; if (signal?.aborted) throw new Error('cancelled');
    try { if (slug === 'optifine') { await optifine(inst, cb, signal); rep.installed.push('OptiFine'); continue; }
      const pv = await pickVersion(slug, { mc: inst.mc, loader: inst.loader, type: 'mod' }); if (!pv || !pv.exact) { rep.warnings.push(`${NICE[slug]}: нет версии для Minecraft ${inst.mc} (${inst.loader}), пропущен`); continue; }
      await install({ src: 'mr', id: slug, type: 'mod', mc: inst.mc, loader: inst.loader, deps: true }, inst.dir, cb, signal); rep.installed.push(NICE[slug]);
    } catch (e) { if (isCancel(e, signal)) throw new Error('cancelled'); rep.warnings.push(`${NICE[slug] || slug}: ${e.message}`); } }
  if (!rep.installed.length && !rep.warnings.length) rep.warnings.push('Для этого загрузчика нет подходящих модов оптимизации (нужна сборка Fabric или Forge)');
  return rep;
}

// ---------- «Бурмалдец»: поиск для ИИ и установка готового набора ----------
// Только Modrinth. Моды — только те, что работают на клиенте (серверные отсекаем), нужная версия Minecraft и загрузчик — обязательны.
async function searchLite(o) {
  if (!['mod', 'resourcepack', 'shader', 'datapack'].includes(o.type)) throw new Error('Неизвестный тип');
  const f = [[`project_type:${o.type}`]]; if (o.mc) f.push([`versions:${o.mc}`]);
  if (o.type === 'mod') { if (o.loader) f.push([`categories:${o.loader}`]); f.push(['client_side:required', 'client_side:optional']); }
  const lim = Math.max(1, Math.min(30, o.limit | 0 || 20)), q = String(o.q || '').slice(0, 80);
  const j = await jget(`${MR}/search?query=${encodeURIComponent(q)}&facets=${encodeURIComponent(JSON.stringify(f))}&index=${q ? 'relevance' : 'downloads'}&limit=${lim}`);
  return (j.hits || []).map((h) => ({ id: String(h.project_id), type: h.project_type, title: String(h.title || ''), desc: String(h.description || ''), downloads: h.downloads | 0, icon: String(h.icon_url || ''), slug: String(h.slug || '') }));
}
// ---------- зависимые моды по id (из ошибки игры) ----------
const normId = (x) => String(x || '').toLowerCase().replace(/[^a-z0-9]/g, '');
async function lookupMod(id, o, signal) { // id мода из ошибки игры → проект Modrinth (id мода обычно совпадает с адресом проекта)
  for (const t of [...new Set([id, id.replace(/_/g, '-'), id.replace(/-/g, '_')])]) {
    if (signal?.aborted) throw new Error('cancelled');
    try { const p = await jget(`${MR}/project/${encodeURIComponent(t)}`); if (p && p.project_type === 'mod' && (!o.loader || (p.loaders || []).includes(o.loader))) return { pid: String(p.id), title: String(p.title || id) }; } catch (e) { if (isCancel(e, signal)) throw e; }
  }
  const hits = await searchLite({ type: 'mod', q: id.replace(/[_\-.]+/g, ' '), mc: o.mc, loader: o.loader, limit: 10 });
  const h = hits.find((x) => normId(x.slug) === normId(id)) || hits.find((x) => normId(x.title) === normId(id));
  return h ? { pid: h.id, title: h.title } : null;
}
async function installDeps(ids, o, instDir, cb = () => {}, signal) { // ids: id модов, которых не хватило игре
  const have = new Set(installedKeys(instDir)), found = [], missing = [];
  cb({ op: 'Ищу недостающие моды…', done: 0, total: 0, speed: 0, files: 0, filesTotal: 0 });
  await Promise.all(ids.map(async (id) => { try { const m = await lookupMod(id, o, signal); if (!m) missing.push(id); else if (!have.has('mr:' + m.pid) && !found.some((f) => f.pid === m.pid)) found.push({ ...m, id }); } catch (e) { if (isCancel(e, signal)) throw e; missing.push(id); } }));
  if (signal?.aborted) throw new Error('cancelled');
  if (!found.length) return { installed: [], missing, skipped: [], files: 0 };
  const r = await installBatch(found.map((m) => ({ id: m.pid, type: 'mod', title: m.title })), o, instDir, cb, signal);
  return { installed: found.map((m) => m.title).filter((t) => !r.skipped.includes(t)), missing: [...missing, ...r.skipped.map((t) => found.find((f) => f.title === t)?.id).filter(Boolean)], skipped: r.skipped, files: r.files };
}
// Группы модов, из которых в сборке может быть только один (заменяют друг друга и ломают игру при совместной установке)
const CONFLICT_GROUPS = [['sodium', 'embeddium', 'rubidium', 'magnesium', 'xenon', 'optifabric', 'canvas-renderer', 'vulkanmod'], ['starlight', 'phosphor', 'scalablelux'], ['lithium', 'canary', 'radium'], ['iris', 'oculus']];
async function fixDeps(t, o) { // зависимость должна подходить версии игры: ищем подходящую или отказываемся от мода
  for (const d of t.deps || []) {
    if (!d.exact) { let alt = null; try { alt = await pickVersion(d.pid, { mc: o.mc, loader: o.loader, type: 'mod' }); } catch {} if (alt?.exact) { d.v = alt.v; d.exact = true; } else return false; }
    if (!(await fixDeps(d, o))) return false;
  }
  return true;
}
// Перед скачиванием убираем то, что заведомо ломает запуск: неподходящие зависимости, моды только для сервера, объявленные несовместимости, дубли по смыслу
async function sanitize(found, o, dropped, signal) {
  for (let k = found.length - 1; k >= 0; k--) if (!(await fixDeps(found[k].t, o))) { dropped.push({ title: found[k].it.title || found[k].it.id, why: 'не нашлась подходящая зависимость' }); found.splice(k, 1); }
  if (!found.length) return;
  const pids = [...new Set(found.flatMap(({ t }) => [t.pid, ...flat(t).map((d) => d.pid)]))], info = {};
  for (let i = 0; i < pids.length; i += 80) { try { for (const p of await jget(`${MR}/projects?ids=${encodeURIComponent(JSON.stringify(pids.slice(i, i + 80)))}`)) info[p.id] = { slug: String(p.slug || ''), client: p.client_side }; } catch (e) { if (isCancel(e, signal)) throw e; } }
  const keptPids = new Set(), keptSlugs = new Set(), keptInc = new Set();
  for (let k = 0; k < found.length; k++) {
    const { it, t } = found[k], parts = [t, ...flat(t)], own = parts.map((x) => x.pid), slugs = own.map((p) => info[p]?.slug).filter(Boolean), inc = new Set();
    for (const x of parts) for (const d of x.v.dependencies || []) if (d.dependency_type === 'incompatible' && d.project_id) inc.add(d.project_id);
    let why = '';
    if (it.type === 'mod' && info[t.pid]?.client === 'unsupported') why = 'мод только для сервера';
    else if (own.some((p) => keptInc.has(p)) || [...inc].some((p) => keptPids.has(p))) why = 'несовместим с другим выбранным модом';
    else if (it.type === 'mod') for (const g of CONFLICT_GROUPS) { const mine = slugs.filter((s) => g.includes(s)); if (mine.length && g.some((s) => keptSlugs.has(s) && !mine.includes(s))) { why = 'заменяет другой выбранный мод (вместе они ломают игру)'; break; } }
    if (why) { dropped.push({ title: it.title || it.id, why }); found.splice(k--, 1); continue; }
    own.forEach((p) => keptPids.add(p)); slugs.forEach((s) => keptSlugs.add(s)); inc.forEach((p) => keptInc.add(p));
  }
}
const BATCH_DIR = { mod: 'mods', resourcepack: 'resourcepacks', shader: 'shaderpacks', datapack: 'datapacks' };
// list: [{id, type, title}] → все файлы (вместе с обязательными зависимостями модов) качаются одним заданием: общий счётчик «28/169»
async function installBatch(list, o, instDir, cb = () => {}, signal) {
  const items = (list || []).filter((x) => x && /^[\w.-]{1,64}$/.test(String(x.id)) && BATCH_DIR[x.type]), q = items.slice(), found = [], skipped = [], errs = []; let n = 0;
  const say = () => cb({ op: `Подбираю версии: ${n}/${items.length}`, done: 0, total: 0, speed: 0, files: 0, filesTotal: 0 });
  say(); const say2 = () => cb({ op: 'Проверяю совместимость модов…', done: 0, total: 0, speed: 0, files: 0, filesTotal: 0 });
  const worker = async () => { for (let it; (it = q.shift());) {
    if (signal?.aborted) throw new Error('cancelled');
    try { const t = await resolve(it.id, { mc: o.mc, loader: o.loader, type: it.type }); if (t && t.exact) found.push({ it, t }); else skipped.push(it.title || it.id); }
    catch (e) { if (isCancel(e, signal)) throw e; errs.push(e); skipped.push(it.title || it.id); }
    n++; say(); } };
  await Promise.all(Array.from({ length: 5 }, worker));
  if (signal?.aborted) throw new Error('cancelled');
  const dropped = []; found.sort((a, b) => items.indexOf(a.it) - items.indexOf(b.it));
  if (o.loader && o.loader !== 'vanilla') { say2(); await sanitize(found, o, dropped, signal); }
  if (!found.length) throw errs[0] || new Error(dropped.length ? 'Выбранные моды несовместимы с этой версией игры' : 'Не нашлось подходящих версий файлов для этой сборки');
  const tasks = [], recs = [], seen = new Set();
  const push = (title, pid, v, folder) => { try { const f = fileOf(v); if (!f || !okHost(f.url)) return; const name = safeName(f.filename), dest = path.join(instDir, folder, name); if (seen.has(dest)) return; seen.add(dest);
    tasks.push({ url: f.url, dest, sha1: f.hashes?.sha1, size: f.size, label: v.name || name }); recs.push({ key: 'mr:' + pid, folder, file: name, title: title || v.name || '' }); } catch {} };
  for (const { it, t } of found) { push(it.title, t.pid, t.v, BATCH_DIR[it.type]); for (const d of flat(t)) push('', d.pid, d.v, 'mods'); }
  if (!tasks.length) throw new Error('Нет файлов для скачивания');
  await runJob(tasks, cb, signal); record(instDir, recs);
  return { files: tasks.length, ok: found.length, skipped, dropped };
}
// ---------- обмен сборкой по коду (src/share.js) ----------
// Сбор: что в сборке скачано из каталога (учёт .totem-catalog.json), по sha1 файлов находим версии Modrinth → id версий для кода.
async function jpost(url, body) { // как http(), но POST с JSON
  let last;
  for (let a = 1; a <= 3; a++) {
    try {
      const r = await fetch(url, { method: 'POST', headers: { ...UA, 'Content-Type': 'application/json' }, body: JSON.stringify(body), signal: AbortSignal.timeout(25000) });
      if (!r.ok) { if (RETRY.has(r.status) && a < 3) { await sleep((r.status === 429 ? 1500 : 400) * a); continue; } throw httpError(r.status, url, (await r.text().catch(() => '')).slice(0, 400)); }
      return await r.json();
    } catch (e) { if (e.status) throw e; last = e; if (a < 3) await sleep(400 * a); }
  }
  throw netError(last);
}
const OWN_PACK = /^TotemSkin(-\d+)?\.zip$/; // служебные ресурс-паки лаунчера (скин в игре) в код не входят и ручными не считаются
async function shareCollect(inst, signal) { // inst: { dir, name, mc, loader }
  const dir = inst.dir, mani = readMani(dir), found = [], seen = new Set();
  for (const v of Object.values(mani)) {
    if (v.src !== 'mr' || !['mods', 'resourcepacks', 'shaderpacks'].includes(v.folder)) continue; // датапаки лежат в мирах, карты — с CurseForge: их в код не кладём
    for (const f of v.files || []) { const on = path.join(dir, v.folder, f), off = on + '.disabled'; const p = fs.existsSync(on) ? on : v.folder === 'mods' && fs.existsSync(off) ? off : null; if (!p || seen.has(p)) continue; seen.add(p); found.push({ folder: v.folder, off: p === off, path: p }); }
  }
  const { sha1File } = require('./game')._t, byHash = new Map();
  for (const f of found) { if (signal?.aborted) throw new Error('cancelled'); try { f.sha1 = await sha1File(f.path); byHash.set(f.sha1, null); } catch { f.sha1 = ''; } }
  const hashes = [...byHash.keys()]; let vers = {};
  for (let i = 0; i < hashes.length; i += 100) { if (signal?.aborted) throw new Error('cancelled'); Object.assign(vers, await jpost(`${MR}/version_files`, { hashes: hashes.slice(i, i + 100), algorithm: 'sha1' })); }
  const out = { name: inst.name, mc: inst.mc, loader: inst.loader, mods: [], modsOff: [], resourcepacks: [], shaders: [] }, manual = [], used = new Set(), have = new Set();
  const slot = (f) => (f.folder === 'mods' ? (f.off ? 'modsOff' : 'mods') : f.folder === 'resourcepacks' ? 'resourcepacks' : 'shaders');
  for (const f of found) { const v = f.sha1 && vers[f.sha1], id = v && String(v.id || ''); if (!id || !/^[0-9A-Za-z]{8}$/.test(id)) { manual.push(path.basename(f.path)); continue; } used.add(f.path); if (have.has(slot(f) + id)) continue; have.add(slot(f) + id); out[slot(f)].push(id); }
  const ent = (d, rx) => { try { return fs.readdirSync(d, { withFileTypes: true }).filter((e) => !e.name.startsWith('.') && rx.test(e.name) && !OWN_PACK.test(e.name)).map((e) => path.join(d, e.name)); } catch { return []; } };
  for (const [k, rx] of [['mods', /\.jar(\.disabled)?$/i], ['resourcepacks', /\.zip$|^[^.]/i], ['shaderpacks', /\.zip$|^[^.]/i]]) for (const p of ent(path.join(dir, k), rx)) if (!used.has(p) && !manual.includes(path.basename(p))) manual.push(path.basename(p));
  return { payload: out, manual };
}
// Установка: создаём сборку и скачиваем те же версии файлов (по id версий). Файлы, которых на Modrinth уже нет, пропускаются и перечисляются в ответе.
async function shareInstall(p, o, instances, cb = () => {}, signal) { // p — результат share.decode; o: { name, loaderVersion }
  const say = (op) => cb({ op, done: 0, total: 0, speed: 0, files: 0, filesTotal: 0 });
  const slots = [['mods', 'mods', false], ['modsOff', 'mods', true], ['resourcepacks', 'resourcepacks', false], ['shaders', 'shaderpacks', false]];
  const ids = [...new Set(slots.flatMap(([k]) => p[k]))]; say('Ищу файлы сборки…'); const vers = new Map();
  for (let i = 0; i < ids.length; i += 50) { if (signal?.aborted) throw new Error('cancelled'); for (const v of await jget(`${MR}/versions?ids=${encodeURIComponent(JSON.stringify(ids.slice(i, i + 50)))}`)) vers.set(String(v.id), v); }
  const tasks = [], recs = [], missing = [], seen = new Set();
  for (const [k, folder, off] of slots) for (const id of p[k]) {
    const v = vers.get(id); if (!v) { missing.push(id); continue; }
    const f = fileOf(v); if (!f || !okHost(f.url)) { missing.push(id); continue; } let name; try { name = safeName(f.filename); } catch { missing.push(id); continue; }
    if ((folder === 'mods') !== /\.jar$/i.test(name)) { missing.push(id); continue; } // мод — только .jar, ресурс-пак и шейдер — .zip
    const dest = path.join('', folder, name + (off ? '.disabled' : '')); if (seen.has(dest)) continue; seen.add(dest);
    tasks.push({ url: f.url, dest, sha1: f.hashes?.sha1, size: f.size, label: v.name || name }); recs.push({ pid: String(v.project_id || ''), folder, file: name, vname: v.name || '' });
  }
  if (!tasks.length) throw new Error('Ни один файл из кода не нашёлся на Modrinth: возможно, версии удалены');
  say('Создаю сборку…');
  const used = new Set(instances.all().map((i) => i.name)); let name = String(o.name || p.name || 'Сборка друга').slice(0, 40), n = 2, base = name; while (used.has(name)) name = (base.slice(0, 36) + ' ' + n++).slice(0, 40);
  const inst = instances.create({ name, mc: p.mc, loader: p.loader, loaderVersion: o.loaderVersion || '' }), dir = instances.dir(inst);
  try {
    for (const t of tasks) t.dest = path.join(dir, t.dest);
    await runJob(tasks, cb, signal);
    let meta = {}; const pids = [...new Set(recs.map((r) => r.pid).filter(Boolean))]; for (let i = 0; i < pids.length; i += 80) { try { Object.assign(meta, await projMeta(pids.slice(i, i + 80))); } catch (e) { if (isCancel(e, signal)) throw e; } }
    record(dir, recs.map((r) => ({ key: 'mr:' + (r.pid || r.file), folder: r.folder, file: r.file, title: meta[r.pid]?.title || r.vname, icon: meta[r.pid]?.icon || '', mc: p.mc, loader: p.loader, src: 'mr' })));
    return { inst: { id: inst.id, name: inst.name }, files: tasks.length, missing: missing.length };
  } catch (e) { try { instances.remove(inst.id); } catch {} throw e; } // отмена или сбой: недокачанную сборку не оставляем
}
module.exports = { setTestBase, searchLite, installBatch, installDeps, lookupMod, badRel, cleanKey, cfCheck, online, installedKeys, record, search, project, plan, install, installPack, shaderSupport, boost, optifine, extractWorld, pickVersion, resolve, flat, okHost, shareCollect, shareInstall, FOLDER, _t: { runJob, isCancel } };
