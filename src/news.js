// Новости Minecraft для главной страницы.
// Источник — официальные данные лаунчера Mojang (те же, что показывает оригинальный лаунчер):
//   /news.json            — новости с сайта minecraft.net (картинка, заголовок, текст, дата, ссылка)
//   /v2/javaPatchNotes.json — списки изменений Java Edition (релизы и свежие снапшоты), подробный текст по contentPath
// Все данные приводятся к одному виду, HTML очищается (оставляем только безопасные теги), картинки — только с известных хостов.
// Перевод на русский (необязательный, настройка newsRu): заголовки/описания и текст новости отправляются в Google Translate;
// если перевод не получился — остаётся оригинал. Переведённое кэшируется на диске.
const crypto = require('crypto'), fs = require('fs'), path = require('path');

const BASE = 'https://launchercontent.mojang.com';
const UA = { 'User-Agent': 'TotemLauncher', Accept: 'application/json,text/html,*/*' };
const IMG_RE = /^(launchercontent\.mojang\.com|(www\.)?minecraft\.net|[\w-]+\.minecraft\.net)$/;
const NID = /^n[0-9a-f]{12}$/;
const MAX_ITEMS = 400, FIRST_PAGE = 15;

// для автотестов и скриншотов: свой сервер вместо Mojang (только из исходников, только 127.0.0.1)
const testBase = () => { const b = process.env.TOTEM_NEWS_BASE; return b && !process.env.TOTEM_PACKAGED && /^http:\/\/127\.0\.0\.1:\d{2,5}$/.test(b) ? b : ''; };

const ENT = { amp: '&', lt: '<', gt: '>', quot: '"', apos: "'", nbsp: ' ', laquo: '«', raquo: '»', ndash: '–', mdash: '—', hellip: '…', rsquo: '’', lsquo: '‘', ldquo: '“', rdquo: '”' };
const decode = (s) => String(s).replace(/&(#x[0-9a-f]+|#\d+|[a-z]+);/gi, (m, e) => {
  if (e[0] === '#') { const n = e[1].toLowerCase() === 'x' ? parseInt(e.slice(2), 16) : parseInt(e.slice(1), 10); return n > 0 && n < 0x110000 ? String.fromCodePoint(n) : ''; }
  return ENT[e.toLowerCase()] ?? m;
});
const escH = (s) => String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
const plain = (s) => decode(String(s ?? '').replace(/<[^>]*>/g, ' ')).replace(/\s+/g, ' ').trim();
const sha = (s) => crypto.createHash('sha1').update(String(s)).digest('hex');
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

function create({ dir, log = () => {}, online = async () => true, translateOn = () => true, base, trUrl } = {}) {
  const TB = base === undefined ? testBase() : base;          // тестовый сервер (если задан)
  const ROOT = TB || BASE;
  const TR_URL = trUrl || 'https://translate.googleapis.com/translate_a/single?client=gtx&sl=auto&tl=ru&dt=t';
  const imgOk = (u) => { try { const x = new URL(u); if (TB && x.origin === new URL(TB).origin) return true; return x.protocol === 'https:' && !x.username && !x.password && !x.port && IMG_RE.test(x.hostname) && x.href.length < 800; } catch { return false; } };
  const absUrl = (u, from = ROOT) => { try { u = String(u || '').trim(); if (!u) return ''; if (TB && /^data:image\/(png|jpe?g|webp|gif);base64,[A-Za-z0-9+/=]+$/.test(u) && u.length < 400000) return u; const x = new URL(u, from.endsWith('/') ? from : from + '/'); return imgOk(x.href) ? x.href : ''; } catch { return ''; } };
  const webOk = (u) => { try { const x = new URL(String(u)); if (TB && x.origin === new URL(TB).origin) return x.href; return x.protocol === 'https:' && /(^|\.)(minecraft\.net|mojang\.com)$/.test(x.hostname) && !x.username && !x.port ? x.href : ''; } catch { return ''; } };

  // ---------- сеть ----------
  async function get(url, signal) {
    let last;
    for (let a = 1; a <= 2; a++) {
      try {
        const r = await fetch(url, { headers: UA, signal: signal ? AbortSignal.any([signal, AbortSignal.timeout(15000)]) : AbortSignal.timeout(15000) });
        if (!r.ok) throw Object.assign(new Error('HTTP ' + r.status), { http: r.status });
        const t = await r.text(); if (t.length > 6e6) throw new Error('слишком большой ответ'); return t;
      } catch (e) { last = e; if (signal?.aborted) throw e; if (e.http && e.http < 500 && e.http !== 429) break; await sleep(400 * a); }
    }
    throw last;
  }
  const getJson = async (url) => JSON.parse(await get(url));

  // ---------- перевод ----------
  const trFile = dir ? path.join(dir, 'news-translate.json') : null;
  let trMem = null, trTimer = 0;
  const trLoad = () => { if (trMem) return trMem; trMem = {}; try { const j = JSON.parse(fs.readFileSync(trFile, 'utf8')); if (j && typeof j === 'object') trMem = j; } catch {} return trMem; };
  const trSave = () => { if (!trFile) return; clearTimeout(trTimer); trTimer = setTimeout(() => { try { const m = trLoad(), k = Object.keys(m); if (k.length > 4000) for (const x of k.slice(0, k.length - 3000)) delete m[x]; fs.mkdirSync(dir, { recursive: true }); fs.writeFileSync(trFile + '.tmp', JSON.stringify(m)); fs.renameSync(trFile + '.tmp', trFile); } catch {} }, 1500); };
  const latin = (s) => /[A-Za-z]{3}/.test(s) && !/[А-Яа-яЁё]{3}/.test(s);
  async function gtx(text) {
    const r = await fetch(TR_URL, { method: 'POST', headers: { 'Content-Type': 'application/x-www-form-urlencoded', 'User-Agent': UA['User-Agent'] }, body: 'q=' + encodeURIComponent(text), signal: AbortSignal.timeout(12000) });
    if (!r.ok) throw new Error('translate HTTP ' + r.status);
    const j = await r.json(); if (!Array.isArray(j) || !Array.isArray(j[0])) throw new Error('translate: неожиданный ответ');
    return j[0].map((p) => (Array.isArray(p) ? p[0] || '' : '')).join('');
  }
  // перевод списка строк (по одной на строку); не получилось — null на месте строки
  async function trLines(lines, maxChars = 24000) {
    const mem = trLoad(), out = new Array(lines.length).fill(null), todo = [];
    let chars = 0;
    lines.forEach((s, i) => { if (!latin(s)) { out[i] = s; return; } const k = sha(s); if (mem[k]) { out[i] = mem[k]; return; } if ((chars += s.length) <= maxChars) todo.push(i); });
    for (let p = 0; p < todo.length;) {
      let q = p, len = 0; const idx = [];
      while (q < todo.length && idx.length < 60 && len + lines[todo[q]].length < 4200) { idx.push(todo[q]); len += lines[todo[q]].length + 1; q++; }
      if (!idx.length) { idx.push(todo[q]); q++; }
      p = q;
      try {
        const res = (await gtx(idx.map((i) => lines[i]).join('\n'))).replace(/\n+$/, '').split('\n');
        if (res.length === idx.length) idx.forEach((i, n) => { const v = res[n].trim(); if (v) { out[i] = v; mem[sha(lines[i])] = v; } });
        else log('news translate: число строк не совпало (' + res.length + '/' + idx.length + ')');
      } catch (e) { log('news translate: ' + e.message); break; }
    }
    trSave(); return out;
  }

  // ---------- очистка HTML ----------
  const TAGMAP = { h1: 'h3', h2: 'h3', h3: 'h4', h4: 'h4', h5: 'h4', h6: 'h4', p: 'p', div: 'p', section: 'p', article: 'p', ul: 'ul', ol: 'ol', li: 'li', strong: 'b', b: 'b', em: 'i', i: 'i', code: 'code', blockquote: 'blockquote', pre: 'pre' };
  function sanitize(html) {
    html = String(html || '').slice(0, 500000).replace(/<!--[\s\S]*?-->/g, '').replace(/<(script|style|iframe|object|svg|noscript|template)\b[\s\S]*?<\/\1\s*>/gi, '');
    const toks = [], imgs = [], stack = [], re = /<(\/?)([a-zA-Z][a-zA-Z0-9]*)\b([^>]*)>|([^<]+)|</g;
    let m;
    while ((m = re.exec(html))) {
      if (m[4] !== undefined) { const t = decode(m[4]).replace(/\s+/g, ' '); if (t.trim()) toks.push({ x: t }); continue; }
      if (!m[2]) continue;
      const name = m[2].toLowerCase(), close = m[1] === '/';
      if (name === 'img' && !close) { const s = /\bsrc\s*=\s*(?:"([^"]*)"|'([^']*)'|([^\s>]+))/i.exec(m[3]), u = absUrl(decode(s ? s[1] ?? s[2] ?? s[3] ?? '' : '')); if (u && !imgs.includes(u)) imgs.push(u); continue; }
      if (name === 'br' || name === 'hr') { if (!close) toks.push({ v: name }); continue; }
      const tag = TAGMAP[name]; if (!tag) continue;
      if (!close) { stack.push(tag); toks.push({ o: tag }); }
      else { const k = stack.lastIndexOf(tag); if (k < 0) continue; while (stack.length > k) toks.push({ c: stack.pop() }); }
    }
    while (stack.length) toks.push({ c: stack.pop() });
    return { toks, imgs };
  }
  const serialize = (toks) => toks.map((t) => (t.x !== undefined ? escH(t.x) : t.o ? `<${t.o}>` : t.c ? `</${t.c}>` : `<${t.v}>`)).join('')
    .replace(/<(p|li|h3|h4|b|i|blockquote)>\s*<\/\1>/g, '').replace(/<(p|li|h3|h4|b|i|blockquote)>\s*<\/\1>/g, '');

  // ---------- список ----------
  let items = [], byId = new Map(), listAt = 0, inflight = null;
  const bodyCache = new Map();
  const mk = (key, o) => ({ id: 'n' + sha(key).slice(0, 12), images: [], url: '', desc: '', ...o });
  const slug = (u) => { try { return new URL(u).pathname.replace(/\/+$/, '').split('/').pop().toLowerCase(); } catch { return ''; } };

  function fromNews(j) {
    const out = [];
    for (const e of Array.isArray(j?.entries) ? j.entries : []) {
      try {
        const title = plain(e.title), date = Date.parse(e.date);
        if (!title || !Number.isFinite(date)) continue;
        if (/dungeons|legends|bedrock|education|marketplace|launcher/i.test(String(e.category || '') + ' ' + [].concat(e.tag || []).join(' '))) continue;
        const imgs = [e.newsPageImage?.url, e.playPageImage?.url].map((u) => absUrl(u)).filter(Boolean).filter((u, i, a) => a.indexOf(u) === i);
        out.push(mk('news:' + (e.id || title + date), { title, desc: plain(e.text).slice(0, 500), date, tag: 'news', src: 'news', images: imgs.slice(0, 1), url: webOk(e.readMoreLink), _text: plain(e.text) }));
      } catch {}
    }
    return out;
  }
  function fromPatch(j) {
    const rel = [], snap = [];
    for (const e of Array.isArray(j?.entries) ? j.entries : []) {
      try {
        const date = Date.parse(e.date), ver = plain(e.version), type = e.type === 'snapshot' ? 'snapshot' : e.type === 'release' ? 'release' : '';
        if (!type || !Number.isFinite(date)) continue;
        const title = plain(e.title) || `Minecraft: Java Edition ${ver}`;
        const img = absUrl(e.image?.url);
        const it = mk('patch:' + (e.id || ver || title), { title, desc: plain(e.shortText).slice(0, 500) || (type === 'release' ? `Список изменений Minecraft ${ver}.` : `Снапшот ${ver}: что нового и что исправлено.`), date, tag: type, src: 'patch', images: img ? [img] : [], _path: String(e.contentPath || ''), _body: typeof e.body === 'string' ? e.body : '', _ver: ver });
        (type === 'release' ? rel : snap).push(it);
      } catch {}
    }
    const last = rel.reduce((m, x) => Math.max(m, x.date), 0); // снапшоты показываем только новее последнего релиза: старые — шум
    return [...rel, ...snap.filter((x) => x.date > last)];
  }
  async function build() {
    const [a, b] = await Promise.allSettled([getJson(ROOT + '/news.json'), getJson(ROOT + '/v2/javaPatchNotes.json')]);
    if (a.status === 'rejected') log('news.json: ' + a.reason?.message);
    if (b.status === 'rejected') log('javaPatchNotes: ' + b.reason?.message);
    if (a.status === 'rejected' && b.status === 'rejected') throw a.reason;
    let all = [...(a.status === 'fulfilled' ? fromNews(a.value) : []), ...(b.status === 'fulfilled' ? fromPatch(b.value) : [])];
    // одна и та же статья может быть и новостью, и списком изменений: оставляем запись с подробным текстом
    const seen = new Map(); all = all.sort((x, y) => y.date - x.date).filter((x) => { const k = x.src === 'news' && x.url ? slug(x.url) : ''; if (k && seen.has(k)) return false; if (k) seen.set(k, 1); return true; });
    return all.slice(0, MAX_ITEMS);
  }
  const pub = (x) => ({ id: x.id, title: x.title, desc: x.desc, date: x.date, tag: x.tag, images: x.images, url: x.url });

  async function list(force) {
    if (!force && items.length && Date.now() - listAt < 60000) return { ok: true, items: items.map(pub), at: listAt };
    if (inflight) return inflight;
    inflight = (async () => {
      try {
        const next = await build();
        if (!next.length) throw new Error('Новостей не найдено');
        const old = byId, keep = translateOn(); items = next.map((x) => { const o = old.get(x.id); if (o?._imgsDone) Object.assign(x, { images: o.images, _imgsDone: 1, _bp: o._bp }); return keep && o && o._tr ? Object.assign(x, { title: o.title, desc: o.desc, _tr: 1 }) : x; });
        byId = new Map(items.map((x) => [x.id, x])); listAt = Date.now();
        if (translateOn()) await Promise.race([tr(items.slice(0, FIRST_PAGE).map((x) => x.id)), sleep(6000)]).catch(() => {});
        return { ok: true, items: items.map(pub), at: listAt };
      } catch (e) {
        log('news list: ' + e.message);
        return { ok: false, offline: !(await online().catch(() => false)), error: e.message };
      } finally { inflight = null; }
    })();
    return inflight;
  }
  // перевод заголовков и описаний нужных новостей; возвращает {id: {title, desc}} для всех переведённых
  async function tr(ids) {
    if (!translateOn()) return {};
    const need = ids.map((id) => byId.get(id)).filter((x) => x && !x._tr);
    if (need.length) {
      const lines = need.flatMap((x) => [x.title, x.desc || '']), res = await trLines(lines.map((s) => s.replace(/\s+/g, ' ')), 12000);
      need.forEach((x, i) => { const t = res[i * 2], d = res[i * 2 + 1]; if (t) { x.title = t; if (d || !x.desc) x.desc = d || x.desc; x._tr = 1; } });
    }
    const out = {}; for (const id of ids) { const x = byId.get(id); if (x?._tr) out[id] = { title: x.title, desc: x.desc }; } return out;
  }

  // ---------- подробности ----------
  // текст списка изменений: загружается один раз, дальше берётся из памяти (и для картинок ленты, и для окна подробностей)
  const bodyOf = (x) => x._bp || (x._bp = (async () => {
    let html = x._body;
    if (!html && x._path) {
      const p = x._path.replace(/^\/+/, ''), cand = [...new Set([ROOT + '/' + p, ROOT + '/v2/' + p])];
      for (const u of cand) { try { const t = await get(u); let j = null; try { j = JSON.parse(t); } catch {} html = j && typeof j === 'object' ? j.body || j.content || j.html || j.text || '' : t; if (html) break; } catch (e) { log('patch body: ' + e.message); } }
    }
    if (!html) throw new Error('Не удалось загрузить подробности');
    return sanitize(html);
  })().catch((e) => { x._bp = null; throw e; }));
  // фото из текста списков изменений для карусели в ленте (до 5 фото на новость), по 3 запроса одновременно
  async function imgs(ids) {
    const need = ids.map((id) => byId.get(id)).filter((x) => x && x.src === 'patch' && !x._imgsDone); let k = 0;
    await Promise.all(Array.from({ length: Math.min(3, need.length) }, async () => { while (k < need.length) { const x = need[k++]; try { const { imgs: im } = await bodyOf(x); x.images = [...x.images, ...im.filter((u) => !x.images.includes(u))].slice(0, 5); x._imgsDone = 1; } catch {} } }));
    const out = {}; for (const id of ids) { const x = byId.get(id); if (x && x.images.length > 1) out[id] = x.images; } return out;
  }
  async function item(id) {
    const x = byId.get(id); if (!x) return { ok: false, error: 'Новость не найдена: обновите список' };
    const key = id + (translateOn() ? ':ru' : ':en'); if (bodyCache.has(key)) return bodyCache.get(key);
    try {
      let toks = [], imgs = [];
      if (x.src === 'patch') {
        const b = await bodyOf(x); toks = JSON.parse(JSON.stringify(b.toks)); imgs = b.imgs; // копия: перевод меняет текст
      } else {
        toks = plain(x._text) ? [{ o: 'p' }, { x: plain(x._text) }, { c: 'p' }] : [];
      }
      if (translateOn()) {
        const at = []; toks.forEach((t, i) => { if (t.x !== undefined && latin(t.x)) at.push(i); });
        const res = await trLines(at.map((i) => toks[i].x), 24000); at.forEach((i, n) => { if (res[n]) toks[i].x = res[n]; });
      }
      const r = { ok: true, html: serialize(toks), images: [...x.images, ...imgs.filter((u) => !x.images.includes(u))].slice(0, 12), url: x.url };
      bodyCache.set(key, r); if (bodyCache.size > 40) bodyCache.delete(bodyCache.keys().next().value);
      return r;
    } catch (e) { return { ok: false, error: e.message, offline: !(await online().catch(() => false)) }; }
  }

  return { list, tr, item, imgs };
}
module.exports = { create, testBase, sanitizeHost: (h) => IMG_RE.test(h), NID, _t: { decode, plain, IMG_RE } };
