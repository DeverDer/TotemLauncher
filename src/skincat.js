// Каталог скинов: список, предпросмотр (PNG) и скачивание в «Мои скины».
// Источник — сервер каталога (`skinsApi` в app-config.json, см. skin-server/README.md):
//   GET  {api}/skins                → { skins: [{ id, name, author, created, downloads, model, desc }] }
//   GET  {api}/skins/{id}.png       → PNG 64×64
//   POST {api}/skins/{id}/download  → { downloads } (счётчик скачиваний на сервере)
// Если свой сервер не задан, каталог берётся с сайта craftdex.net (открытый JSON без ключей): список — /skins/trending.json и /skins/tag/{тег}.json,
// сам скин (PNG в base64) — /skins/{id}.json. Информация (автор, дата создания, сколько игроков носят, просмотры) — с сайта; встроенных скинов больше нет.
// Всё, что приходит с сервера, — недоверенные данные: id по маске, строки обрезаются, PNG проверяется как у обычных скинов.
const fs = require('fs'), path = require('path');
const Skins = require('./skins');

const ID = /^[A-Za-z0-9_-]{1,40}$/;
const SITE = 'https://craftdex.net', LIST_TTL = 15 * 60 * 1000; // сайт просит кэшировать ответы — свежий список держим 15 минут
// категории сайта: [тег, как показываем]; тег, которого на сайте нет, просто пропускается
const TAGS = [['trending', 'Популярный'], ['girl', 'Девушка'], ['boy', 'Парень'], ['anime', 'Аниме'], ['hoodie', 'Худи'], ['knight', 'Рыцарь'], ['ninja', 'Ниндзя'], ['robot', 'Робот'], ['zombie', 'Зомби'], ['creeper', 'Крипер'], ['dragon', 'Дракон'], ['cat', 'Кот'], ['fox', 'Лис'], ['panda', 'Панда'], ['pirate', 'Пират'], ['demon', 'Демон'], ['angel', 'Ангел'], ['wizard', 'Маг'], ['military', 'Военный']];
const siteBase = () => { const b = process.env.TOTEM_CRAFTDEX_BASE; return b && !process.env.TOTEM_PACKAGED && /^http:\/\/127\.0\.0\.1:\d{2,5}$/.test(b) ? b : SITE; };
const MAX_LIST = 3000, MAX_JSON = 4 << 20, MAX_PNG = 1 << 20;
const UA = { 'User-Agent': 'TotemLauncher', Accept: 'application/json,image/png,*/*' };
const cut = (s, n) => String(s ?? '').replace(/<[^>]*>/g, ' ').replace(/[\u0000-\u001f\u007f<>]/g, ' ').replace(/\s+/g, ' ').trim().slice(0, n);

// для автотестов и скриншотов: свой сервер каталога (только из исходников, только 127.0.0.1)
const testBase = () => { const b = process.env.TOTEM_SKINS_BASE; return b && !process.env.TOTEM_PACKAGED && /^http:\/\/127\.0\.0\.1:\d{2,5}$/.test(b) ? b : ''; };
// адрес сервера из конфига: только https, без логина, пароля и параметров
const cleanApi = (u) => { try { u = String(u || '').trim(); if (!u) return ''; const x = new URL(u); if (x.protocol !== 'https:' || x.username || x.password || x.search || x.hash) return ''; return x.href.replace(/\/+$/, ''); } catch { return ''; } };

function normalize(raw) {
  const arr = Array.isArray(raw) ? raw : Array.isArray(raw?.skins) ? raw.skins : null;
  if (!arr) throw new Error('Сервер каталога вернул неожиданный ответ');
  const out = [], seen = new Set();
  for (const r of arr.slice(0, MAX_LIST)) {
    if (!r || typeof r !== 'object' || !ID.test(String(r.id)) || seen.has(String(r.id))) continue;
    const t = Date.parse(r.created ?? r.createdAt ?? ''); const name = cut(r.name, 40); if (!name) continue;
    seen.add(String(r.id));
    out.push({ id: String(r.id), name, author: cut(r.author, 32) || 'Неизвестный', created: Number.isFinite(t) ? t : 0, downloads: Math.max(0, Math.min(1e9, Math.floor(+r.downloads) || 0)), model: r.model === 'slim' ? 'slim' : 'classic', desc: cut(r.desc ?? r.description, 300), views: Math.max(0, Math.min(1e9, Math.floor(+r.views) || 0)), site: r.site === true });
  }
  return out;
}

function create({ dir, skins, api, test = true, log = () => {} } = {}) {
  const ROOT = (test && testBase()) || cleanApi(api) || '';
  const cacheDir = path.join(dir, 'skincat'), listFile = path.join(cacheDir, 'list.json'), cntFile = path.join(cacheDir, 'counts.json');
  let mem = null, memT = 0; // последний полученный список и время его получения
  const remote = !!ROOT; // true — свой сервер каталога (skinsApi), false — сайт craftdex.net
  const SB = siteBase();

  async function http(url, { method = 'GET', max, timeout = 15000, signal, follow = false } = {}) {
    const r = await fetch(url, { method, headers: UA, redirect: follow ? 'follow' : 'error', signal: signal ? AbortSignal.any([signal, AbortSignal.timeout(timeout)]) : AbortSignal.timeout(timeout) });
    if (follow && r.url && !r.url.startsWith(SB + '/')) throw new Error('Сайт перенаправил на другой адрес'); // с сайта принимаем ответы только с его же адреса
    if (!r.ok) throw Object.assign(new Error('HTTP ' + r.status), { http: r.status });
    const len = +r.headers.get('content-length'); if (len > max) throw new Error('слишком большой ответ');
    const b = Buffer.from(await r.arrayBuffer()); if (b.length > max) throw new Error('слишком большой ответ'); return b;
  }
  async function retry(f) { let last; for (let a = 1; a <= 2; a++) { try { return await f(); } catch (e) { last = e; if (e.http && e.http < 500 && e.http !== 429) break; await new Promise((r) => setTimeout(r, 400 * a)); } } throw last; }

  const readJson = (f, d) => { try { const j = JSON.parse(fs.readFileSync(f, 'utf8')); return j && typeof j === 'object' ? j : d; } catch { return d; } };
  const writeAtomic = (f, data) => { fs.mkdirSync(path.dirname(f), { recursive: true }); const t = f + '.part'; fs.writeFileSync(t, data); fs.renameSync(t, f); };
  const counts = () => readJson(cntFile, {});
  const gotMap = () => { const m = {}; for (const s of skins.all()) if (s.from && ID.test(String(s.from))) m[s.from] = s.id; return m; };

  // ---------- сайт craftdex.net ----------
  const siteJson = async (p) => JSON.parse((await retry(() => http(SB + p, { max: MAX_JSON, timeout: 12000, follow: true }))).toString('utf8'));
  async function siteList() {
    const got = new Map(); let ok = 0, i = 0;
    await Promise.all(Array.from({ length: 5 }, async () => { while (i < TAGS.length) { const [tag, ru] = TAGS[i++];
      try { const arr = await siteJson(tag === 'trending' ? '/skins/trending.json' : `/skins/tag/${tag}.json`); if (!Array.isArray(arr)) continue; ok++;
        for (const x of arr) { if (!x || typeof x !== 'object' || !ID.test(String(x.id)) || x.banned || x.deleted_at || x.legacy) continue; // старый формат 64×32 не берём
          const id = String(x.id), prev = got.get(id); if (prev) { prev.tags.add(ru); continue; }
          got.set(id, { x, tags: new Set([ru]), first: ru }); } }
      catch (e) { if (e.http !== 404) log(`skincat: тег ${tag}: ${e.message}`); } } }));
    if (!ok) throw new Error('сайт не ответил');
    const raw = [...got.values()].map(({ x, tags, first }) => { const who = x.first_player?.username; return { id: x.id, site: true, name: `${first} #${String(x.id).slice(0, 4).toUpperCase()}`, author: who || 'Неизвестный игрок', created: x.created_at, downloads: Math.max(0, +x.players_count || 0), views: Math.max(0, +x.views_lifetime || 0), model: x.slim ? 'slim' : 'classic',
      desc: `Категории: ${[...tags].join(', ')}. Источник — craftdex.net.` }; });
    return normalize(raw);
  }
  const withCounts = (arr) => { const c = counts(); return arr.map((s) => ({ ...s, downloads: s.downloads + (c[s.id] | 0) })); };
  async function list(force) {
    if (!remote) {
      const fresh = (t) => Date.now() - t < LIST_TTL;
      if (mem && !force && fresh(memT)) return { ok: true, skins: withCounts(mem), got: gotMap(), source: 'site' };
      const disk = readJson(listFile, null);
      if (!force && disk && Array.isArray(disk.skins) && disk.site && fresh(disk.t | 0)) { mem = normalize(disk.skins); memT = disk.t | 0; return { ok: true, skins: withCounts(mem), got: gotMap(), source: 'site' }; }
      try { mem = await siteList(); memT = Date.now(); try { writeAtomic(listFile, JSON.stringify({ site: true, t: memT, skins: mem })); } catch {} return { ok: true, skins: withCounts(mem), got: gotMap(), source: 'site' }; }
      catch (e) { log('skincat: список с сайта не получен: ' + e.message);
        if (disk && disk.site && Array.isArray(disk.skins) && disk.skins.length) { mem = normalize(disk.skins); return { ok: true, skins: withCounts(mem), got: gotMap(), source: 'site', stale: true }; }
        return { ok: false, error: 'Не удалось загрузить каталог с сайта craftdex.net. Проверьте подключение к интернету.' }; }
    }
    if (mem && !force) return { ok: true, skins: mem, got: gotMap(), source: 'remote' };
    try {
      const b = await retry(() => http(ROOT + '/skins', { max: MAX_JSON }));
      mem = normalize(JSON.parse(b.toString('utf8')));
      try { writeAtomic(listFile, JSON.stringify(mem)); } catch {}
      return { ok: true, skins: mem, got: gotMap(), source: 'remote' };
    } catch (e) {
      log('skincat: список не получен: ' + e.message);
      const old = readJson(listFile, null);
      if (Array.isArray(old) && old.length) { mem = normalize(old); return { ok: true, skins: mem, got: gotMap(), source: 'remote', stale: true }; }
      return { ok: false, error: 'Не удалось загрузить каталог. Проверьте подключение к интернету.' };
    }
  }

  async function pngBuf(id) {
    if (!ID.test(String(id))) throw new Error('Неверный скин');
    const f = path.join(cacheDir, remote ? 'png' : 'site-png', id + '.png');
    try { const b = fs.readFileSync(f); Skins.check(b); return b; } catch {}
    let b;
    if (remote) b = await retry(() => http(`${ROOT}/skins/${id}.png`, { max: MAX_PNG }));
    else { const j = await siteJson(`/skins/${id}.json`); if (typeof j?.texture !== 'string' || j.texture.length > 1.4e6) throw new Error('У скина нет картинки'); b = Buffer.from(j.texture, 'base64'); } // сайт отдаёт PNG в поле texture (base64)
    Skins.check(b); try { writeAtomic(f, b); } catch {} return b;
  }
  // картинки пачкой для карточек: что не получилось — null
  async function pngs(ids) {
    const out = {}, q = ids.filter((x) => ID.test(String(x))).slice(0, 40); let i = 0;
    await Promise.all(Array.from({ length: Math.min(5, q.length) }, async () => { while (i < q.length) { const id = q[i++]; try { out[id] = (await pngBuf(id)).toString('base64'); } catch (e) { out[id] = null; log(`skincat: ${id}: ${e.message}`); } } }));
    return out;
  }

  async function download(id) {
    id = String(id); if (!ID.test(id)) throw new Error('Неверный скин');
    if (!mem) await list(false);
    const e = (mem || []).find((s) => s.id === id); if (!e) throw new Error('Скин не найден в каталоге');
    const have = gotMap()[id]; if (have && skins.all().some((s) => s.id === have)) return { already: true, localId: have, downloads: e.downloads };
    const b = await pngBuf(id);
    const entry = skins.put({ name: e.name, model: e.model, data: b.toString('base64'), from: id });
    let n = e.downloads + 1;
    if (remote) { try { const j = JSON.parse((await http(`${ROOT}/skins/${id}/download`, { method: 'POST', max: 4096, timeout: 8000 })).toString('utf8')); if (Number.isFinite(+j.downloads) && +j.downloads >= 0) n = Math.floor(+j.downloads); } catch (er) { log('skincat: счётчик не обновлён: ' + er.message); } }
    else { const c = counts(); c[id] = (c[id] | 0) + 1; try { writeAtomic(cntFile, JSON.stringify(c)); } catch {} n = e.downloads + c[id]; } // на сайте счётчика скачиваний нет — к «носят игроков» добавляем скачивания из этого лаунчера
    if (remote) e.downloads = n;
    return { entry, localId: entry.id, downloads: n };
  }
  return { list, pngs, download, remote };
}
module.exports = { create, normalize, cleanApi, ID };
