// Установка набора модов: конфликты, моды только для сервера, объявленные несовместимости и неподходящие зависимости отсеиваются до скачивания
const assert = require('assert'), http = require('http'), fs = require('fs'), os = require('os'), path = require('path'), crypto = require('crypto');
const Cat = require('../src/catalog.js');
const P = { pSod: { slug: 'sodium' }, pVk: { slug: 'vulkanmod' }, pOk: { slug: 'okmod' }, pSrv: { slug: 'srvonly', client: 'unsupported' }, pInc: { slug: 'incmod', deps: [{ project_id: 'pOk', dependency_type: 'incompatible' }] }, pBad: { slug: 'baddep', deps: [{ project_id: 'pOld', dependency_type: 'required' }] }, pOld: { slug: 'oldlib', gv: ['1.19.2'] }, pIris: { slug: 'iris', deps: [{ project_id: 'pSod', dependency_type: 'required' }] } };
const buf = (id) => { const b = Buffer.alloc(50000); b.write('PK\x03\x04'); b.write(id, 4); return b; };
(async () => {
  const srv = http.createServer((q, r) => {
    const base = 'http://127.0.0.1:' + srv.address().port, u = new URL(q.url, base), json = (o, c = 200) => { r.writeHead(c, { 'content-type': 'application/json' }); r.end(JSON.stringify(o)); };
    if (u.pathname === '/v2/projects') return json(JSON.parse(u.searchParams.get('ids')).map((id) => ({ id, slug: P[id].slug, client_side: P[id].client || 'required' })));
    let m = /^\/v2\/project\/(\w+)\/version$/.exec(u.pathname);
    if (m) { const p = P[m[1]]; if (!p) return json([], 404); const want = JSON.parse(u.searchParams.get('game_versions') || '[]')[0], gv = p.gv || ['1.20.1']; if (want && !gv.includes(want) && !u.searchParams.has('x')) { /* ниже вернём не подходящую версию без фильтра */ }
      const list = want && !gv.includes(want) ? [] : [{ version_type: 'release', game_versions: gv, loaders: ['fabric'], dependencies: p.deps || [], name: p.slug, version_number: '1', files: [{ primary: true, filename: p.slug + '.jar', url: base + '/files/' + m[1], hashes: { sha1: crypto.createHash('sha1').update(buf(m[1])).digest('hex') }, size: 50000 }] }];
      return json(list.length || want ? list : []); }
    m = /^\/files\/(\w+)$/.exec(u.pathname); if (m) { const b = buf(m[1]); r.writeHead(200, { 'content-length': b.length }); return r.end(b); }
    json({}, 404);
  });
  await new Promise((res) => srv.listen(0, '127.0.0.1', res)); Cat.setTestBase('http://127.0.0.1:' + srv.address().port);
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'conf-'));
  // pOld: версия «1.19.2» отдаётся только без фильтра игры (как у Modrinth, когда для нужной версии файла нет)
  const items = ['pSod', 'pVk', 'pOk', 'pSrv', 'pInc', 'pBad'].map((id) => ({ id, type: 'mod', title: P[id].slug }));
  const res = await Cat.installBatch(items, { mc: '1.20.1', loader: 'fabric' }, dir, () => {});
  const files = fs.readdirSync(path.join(dir, 'mods')).sort();
  assert.deepEqual(files, ['okmod.jar', 'sodium.jar'], 'остались только совместимые: ' + files);
  const why = Object.fromEntries(res.dropped.map((d) => [d.title, d.why]));
  assert(/заменяет/.test(why.vulkanmod), 'vulkanmod и sodium — взаимоисключающие'); assert(/сервера/.test(why.srvonly)); assert(/несовместим/.test(why.incmod)); assert.equal(res.dropped.length + files.length, items.length - (res.skipped.length), 'всё учтено');
  // Iris тянет Sodium как зависимость, VulkanMod с ним конфликтует
  const dir2 = fs.mkdtempSync(path.join(os.tmpdir(), 'conf-')); const r2 = await Cat.installBatch(['pIris', 'pVk'].map((id) => ({ id, type: 'mod', title: P[id].slug })), { mc: '1.20.1', loader: 'fabric' }, dir2, () => {});
  assert.deepEqual(fs.readdirSync(path.join(dir2, 'mods')).sort(), ['iris.jar', 'sodium.jar']); assert.equal(r2.dropped[0].title, 'vulkanmod');
  srv.close(); console.log('conflicts-ok');
})().catch((e) => { console.error(e); process.exit(1); });
