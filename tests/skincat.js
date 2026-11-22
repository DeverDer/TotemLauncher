// Каталог скинов: список, картинки, скачивание, защита от плохих ответов — на поддельном сервере
const assert = require('assert'), http = require('http'), fs = require('fs'), os = require('os'), path = require('path');
const Skins = require('../src/skins.js'), SC = require('../src/skincat.js');
const png = (w, h) => { const b = Buffer.alloc(60); b.writeUInt32BE(0x89504e47, 0); b.write('IHDR', 12, 'ascii'); b.writeUInt32BE(w, 16); b.writeUInt32BE(h, 20); return b; };
const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'skc-'));
let mode = 'ok', posts = 0, dl = 41;
const LIST = { skins: [
  { id: 'aaa111', name: 'Первый <b>скин</b>', author: 'Автор', created: '2026-11-01T10:00:00Z', downloads: 41, model: 'slim', desc: 'описание' },
  { id: 'bbb222', name: 'Битый', author: 'X', created: 'вчера', downloads: -5, model: 'zzz' },
  { id: '../evil', name: 'Плохой id', author: 'X' }, { id: 'aaa111', name: 'Дубликат' }, { id: 'ccc333', name: '', author: 'Z' }, null, 7,
] };
const srv = http.createServer((req, res) => {
  if (mode === 'down') { res.writeHead(503); return res.end('no'); }
  if (req.url === '/skins') { res.writeHead(200, { 'Content-Type': 'application/json' }); return res.end(JSON.stringify(LIST)); }
  if (req.url === '/skins/aaa111.png') { res.writeHead(200); return res.end(png(64, 64)); }
  if (req.url === '/skins/bbb222.png') { res.writeHead(200); return res.end(png(64, 32)); }
  if (req.url === '/skins/aaa111/download' && req.method === 'POST') { posts++; res.writeHead(200, { 'Content-Type': 'application/json' }); return res.end(JSON.stringify({ downloads: ++dl })); }
  res.writeHead(404); res.end();
}).listen(0, '127.0.0.1', async () => {
  try {
    process.env.TOTEM_SKINS_BASE = 'http://127.0.0.1:' + srv.address().port;
    const skins = new Skins(path.join(tmp, 'skins')), C = SC.create({ dir: tmp, skins });
    assert(C.remote);
    let r = await C.list(true); assert(r.ok && r.skins.length === 2, 'нормализация: только корректные записи');
    const a = r.skins.find((s) => s.id === 'aaa111'); assert.equal(a.name, 'Первый скин'); assert(!/[<>]/.test(a.name)); assert.equal(a.model, 'slim');
    const b = r.skins.find((s) => s.id === 'bbb222'); assert.equal(b.downloads, 0); assert.equal(b.model, 'classic'); assert.equal(b.created, 0);
    // картинки: хорошая приходит, не 64×64 и чужой id — null
    const p = await C.pngs(['aaa111', 'bbb222', '../evil', 'nope']); assert(p.aaa111 && p.bbb222 === null && p.nope === null && !('../evil' in p));
    // скачивание: новый скин в «Моих скинах», счётчик с сервера
    const d = await C.download('aaa111'); assert.equal(d.downloads, 42); assert.equal(posts, 1); assert.equal(skins.all().length, 1); assert.equal(skins.all()[0].from, 'aaa111'); assert.equal(skins.all()[0].model, 'slim');
    r = await C.list(false); assert.deepEqual(r.got, { aaa111: skins.all()[0].id }); assert.equal(r.skins.find((s) => s.id === 'aaa111').downloads, 42);
    // повторно — отказ без нового скина и без счётчика
    const d2 = await C.download('aaa111'); assert(d2.already && posts === 1 && skins.all().length === 1);
    // скин удалили — можно скачать снова
    skins.remove(skins.all()[0].id); const d3 = await C.download('aaa111'); assert(!d3.already && skins.all().length === 1 && posts === 2);
    await assert.rejects(C.download('bbb222'), /64/); await assert.rejects(C.download('zzz'), /не найден/); await assert.rejects(C.download('../x'), /Неверный/);
    // сервер упал: показываем последний удачный список; без кэша — ошибка
    mode = 'down'; r = await C.list(true); assert(r.ok && r.stale && r.skins.length === 2);
    const C2 = SC.create({ dir: fs.mkdtempSync(path.join(os.tmpdir(), 'skc2-')), skins }); r = await C2.list(true); assert(!r.ok && /подключ/.test(r.error));
    // адрес из конфига: только https без секретов; в тестовом режиме для упакованной программы подмена игнорируется
    assert.equal(SC.cleanApi('https://skins.example.com/'), 'https://skins.example.com'); for (const x of ['http://a.com', 'https://u:p@a.com', 'https://a.com/?k=1', 'ftp://a', '', 'x']) assert.equal(SC.cleanApi(x), '');
    assert(!SC.create({ dir: tmp, skins, test: false }).remote);
    // без своего сервера — сайт craftdex.net (здесь поддельный): список из «популярных» и тегов, без бана/удалённых/старого формата, повторы склеиваются
    delete process.env.TOTEM_SKINS_BASE;
    const U1 = '11111111-1111-4111-8111-111111111111', U2 = '22222222-2222-4222-8222-222222222222', U3 = '33333333-3333-4333-8333-333333333333', U4 = '44444444-4444-4444-8444-444444444444', U5 = '55555555-5555-4555-8555-555555555555';
    const sk = (id, o = {}) => ({ id, slim: false, legacy: false, banned: false, deleted_at: null, players_count: 7, views_lifetime: 30, created_at: '2026-06-08T12:16:08.670+02:00', first_player: { username: 'Игрок1' }, ...o });
    let siteDown = false, hits = 0;
    const site = http.createServer((req, res) => {
      hits++; if (siteDown) { res.writeHead(503); return res.end('no'); }
      const j = (o) => { res.writeHead(200, { 'Content-Type': 'application/json' }); res.end(JSON.stringify(o)); };
      if (req.url === '/skins/trending.json') return j([sk(U1), sk(U2, { slim: true, first_player: null }), sk(U4, { banned: true }), sk(U5, { legacy: true }), { id: '../x' }]);
      if (req.url === '/skins/tag/girl.json') return j([sk(U2, { slim: true }), sk(U3, { players_count: 100 })]);
      if (req.url === `/skins/${U1}.json`) return j({ id: U1, texture: png(64, 64).toString('base64') });
      if (req.url === `/skins/${U3}.json`) return j({ id: U3, texture: png(64, 32).toString('base64') });
      res.writeHead(404); res.end();
    }).listen(0, '127.0.0.1', async () => {
      try {
        process.env.TOTEM_CRAFTDEX_BASE = 'http://127.0.0.1:' + site.address().port;
        const sdir = fs.mkdtempSync(path.join(os.tmpdir(), 'skc3-')), L = SC.create({ dir: sdir, skins: new Skins(path.join(tmp, 'sk3')) });
        assert(!L.remote); r = await L.list(true); assert(r.ok && r.source === 'site', JSON.stringify(r));
        assert.deepEqual(r.skins.map((s) => s.id).sort(), [U1, U2, U3].sort(), 'бан, удалённые и старый формат не попадают в каталог');
        const s2 = r.skins.find((s) => s.id === U2); assert.equal(s2.model, 'slim'); assert.equal(s2.author, 'Неизвестный игрок'); assert(/Популярный/.test(s2.name) && /Девушка/.test(s2.desc), 'повтор из двух категорий — одна карточка');
        const s3 = r.skins.find((s) => s.id === U3); assert.equal(s3.downloads, 100); assert.equal(s3.site, true); assert(s3.created > 0 && s3.views === 30);
        const n0 = hits; r = await L.list(false); assert.equal(hits, n0, 'свежий список повторно с сайта не качаем');
        const pp = await L.pngs([U1, U3]); assert(pp[U1] && pp[U3] === null, 'скин 64×32 отклоняется');
        const dd = await L.download(U1); assert.equal(dd.downloads, 8); assert.equal((await L.list(false)).skins.find((s) => s.id === U1).downloads, 8, 'счётчик не удваивается');
        siteDown = true; r = await L.list(true); assert(r.ok && r.stale && r.skins.length === 3, 'сайт недоступен — показываем сохранённый список');
        r = await SC.create({ dir: fs.mkdtempSync(path.join(os.tmpdir(), 'skc4-')), skins: new Skins(path.join(tmp, 'sk4')) }).list(true); assert(!r.ok && /craftdex/.test(r.error));
        console.log('skincat ok');
      } catch (e) { console.error(e); process.exitCode = 1; } finally { site.close(); }
    });
    return;
  } catch (e) { console.error(e); process.exitCode = 1; } finally { srv.close(); }
});
