// Новости: разбор источников, очистка HTML, перевод, ошибки сети — на поддельном сервере Mojang
const assert = require('assert'), http = require('http'), fs = require('fs'), os = require('os'), path = require('path');
const News = require('../src/news.js');
const IMG = 'data:image/png;base64,iVBORw0KGgo=';
let mode = 'ok';
const day = (n) => new Date(Date.UTC(2026, 10, 18) - n * 864e5).toISOString();
const NEWS = { version: 1, entries: [
  { title: 'Wolf <b>Avenger</b> arrives', category: 'Minecraft: Java Edition', date: day(8), text: 'Meet the new &amp; loyal companion.', newsPageImage: { url: IMG }, readMoreLink: 'https://www.minecraft.net/en-us/article/wolf-avenger' },
  { title: 'Dungeons news', category: 'Minecraft Dungeons', date: day(1), text: 'x', newsPageImage: { url: IMG } },
  { title: 'Bad date', category: 'Java', date: 'вчера', text: 'x' },
  { title: 'Evil image', category: 'Java', date: day(9), text: 'hi', newsPageImage: { url: 'https://evil.example/a.png' }, readMoreLink: 'https://evil.example/x' },
] };
const PATCH = { version: 1, entries: [
  { title: 'Minecraft: Java Edition 1.21.10', type: 'release', version: '1.21.10', date: day(4), shortText: 'A small update fixing bugs.', image: { url: IMG }, contentPath: '/v2/content/r.json', id: 'r1' },
  { title: 'Minecraft: Java Edition 1.21.9', type: 'release', version: '1.21.9', date: day(40), shortText: 'Older release.', id: 'r0', contentPath: 'content/r0.json' },
  { title: 'Snapshot 26w01a', type: 'snapshot', version: '26w01a', date: day(2), shortText: 'Newer snapshot.', id: 's1', body: '<p>inline body</p>' },
  { title: 'Snapshot 25w01a', type: 'snapshot', version: '25w01a', date: day(100), shortText: 'Old snapshot.', id: 's0' },
] };
const BODY = '<h1>Fixes</h1><script>alert(1)</script><p onclick="x()">Fixed <strong>crash</strong> &lt;when&gt; loading<img src="' + IMG + '"><img src="https://evil.example/p.png"></p><ul><li>Item one</li><li>Item two</li></ul><a href="javascript:alert(1)">link</a><style>p{}</style>';
const srv = http.createServer((q, r) => {
  const send = (o, c = 200) => { r.writeHead(c, { 'content-type': 'application/json' }); r.end(typeof o === 'string' ? o : JSON.stringify(o)); };
  if (mode === 'down') return send('x', 503);
  if (q.url === '/news.json') return send(NEWS);
  if (q.url === '/v2/javaPatchNotes.json') return send(PATCH);
  if (q.url === '/v2/content/r.json') return send({ title: 'x', body: BODY });
  if (q.url === '/v2/content/r0.json') return send('<p>plain html body</p>');
  if (q.url.startsWith('/tr')) { let b = ''; q.on('data', (c) => (b += c)); q.on('end', () => { const t = decodeURIComponent(b.slice(2).replace(/\+/g, ' ')), L = t.split('\n'); if (mode === 'trbad') return send([[['всё одной строкой', t]]]); send([L.map((l) => ['RU:' + l + '\n', l])]); }); return; }
  send({}, 404);
}).listen(0, '127.0.0.1', async () => {
  const base = 'http://127.0.0.1:' + srv.address().port, dir = fs.mkdtempSync(path.join(os.tmpdir(), 'news-'));
  const mk = (o = {}) => News.create({ dir, base, trUrl: base + '/tr', online: async () => true, translateOn: () => true, ...o });
  let n = mk(), r = await n.list(true);
  assert(r.ok); const ids = r.items.map((x) => x.title);
  assert(!ids.some((t) => /Dungeons|Bad date|Old snapshot|Older/.test(t.replace(/^RU:/, ''))) || ids.some((t) => /Older/.test(t)), 'отфильтрованы чужие игры, плохие даты, старые снапшоты');
  assert(!r.items.some((x) => /Dungeons/.test(x.title)) && !r.items.some((x) => /25w01a/.test(x.title)), 'фильтры');
  assert(r.items.some((x) => /26w01a/.test(x.title)), 'свежий снапшот есть');
  assert(r.items.every((x, i, a) => !i || a[i - 1].date >= x.date), 'новые сверху');
  assert(r.items[0].title.startsWith('RU:'), 'перевод применён: ' + r.items[0].title);
  const wolf = r.items.find((x) => /Wolf/.test(x.title)); assert(!/</.test(wolf.title) && /Wolf Avenger/.test(wolf.title), 'теги в заголовке убраны'); assert(/& loyal/.test(wolf.desc), 'сущности раскодированы'); assert(wolf.url.startsWith('https://www.minecraft.net/'));
  const evil = r.items.find((x) => /Evil/.test(x.title)); assert.deepEqual(evil.images, []); assert.equal(evil.url, '', 'чужая ссылка и картинка отброшены');
  // подробности: очистка HTML, картинки, перевод текста
  const rel = r.items.find((x) => /1\.21\.10/.test(x.title)), d = await n.item(rel.id);
  assert(d.ok); assert(!/script|onclick|style|href|javascript|evil/i.test(d.html), 'опасное вырезано: ' + d.html); assert(/<h3>/.test(d.html) && /<ul><li>/.test(d.html) && /<b>/.test(d.html));
  assert(/&lt;when&gt;/.test(d.html), 'угловые скобки в тексте экранированы'); assert(d.images.length === 1 && d.images[0] === IMG, 'только разрешённые картинки'); assert(/RU:/.test(d.html), 'текст переведён');
  const d0 = await n.item(r.items.find((x) => /1\.21\.9/.test(x.title)).id); assert(d0.ok && /plain html body/.test(d0.html), 'contentPath без слэша и сырой HTML');
  const d1 = await n.item(r.items.find((x) => /26w01a/.test(x.title)).id); assert(/inline body/.test(d1.html), 'встроенный body');
  assert.equal((await n.item('nffffffffffff')).ok, false);
  // перевод вернул не то число строк — остаётся оригинал
  mode = 'trbad'; const n2 = mk({ dir: fs.mkdtempSync(path.join(os.tmpdir(), 'news2-')) }); const r2 = await n2.list(true); assert(r2.ok && !r2.items[0].title.startsWith('RU:') && !/всё одной/.test(r2.items[0].title), 'сбой перевода → оригинал');
  // перевод выключен
  mode = 'ok'; const n3 = mk({ translateOn: () => false }); const r3 = await n3.list(true); assert(!r3.items.some((x) => x.title.startsWith('RU:')), 'без перевода');
  // кэш перевода живёт на диске
  await new Promise((q) => setTimeout(q, 1800)); assert(fs.existsSync(path.join(dir, 'news-translate.json')), 'кэш перевода записан');
  // сервер лежит
  mode = 'down'; const r4 = await mk({ dir: fs.mkdtempSync(path.join(os.tmpdir(), 'news3-')) }).list(true); assert.equal(r4.ok, false); assert.equal(r4.offline, false, 'есть интернет, но сервер недоступен');
  const r5 = await mk({ online: async () => false }).list(true); assert.equal(r5.offline, true, 'нет интернета');
  srv.close(); console.log('news-ok');
});
