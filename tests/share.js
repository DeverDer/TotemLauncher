// Обмен сборкой по коду: кодек (src/share.js), сбор файлов каталога по хэшам, установка у «друга» — на поддельном Modrinth
const assert = require('assert'), fs = require('fs'), os = require('os'), path = require('path');
const Net = require('./mock-net.js'), Cat = require('../src/catalog.js'), Share = require('../src/share.js'), Instances = require('../src/instances.js');
(async () => {
  // 1. кодек: туда-обратно, пробелы и переносы при вставке, повреждения
  const ids = (n, k) => Array.from({ length: n }, (_, i) => { const A = '0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz'; let s = '', x = i * 7919 + 12345 + k; for (let j = 0; j < 8; j++) { s += A[(x * (j + 3) + j * 31) % 62]; x = (x * 31 + 7) % 100003; } return s; });
  const p = { name: 'Хоррор с друзьями', mc: '1.20.1', loader: 'forge', mods: ids(30, 0), modsOff: ids(2, 1), resourcepacks: ['zzzzzzzz', '00000000'], shaders: ['Ab3dEf9h'] };
  const code = Share.encode(p); assert(code.startsWith('TB1-')); assert(code.length < 400, 'код короткий: ' + code.length);
  assert.deepEqual(Share.decode(' ' + code.slice(0, 25) + '\n  ' + code.slice(25) + '\n'), p);
  for (const bad of [code.slice(0, -4), code.slice(0, 30) + (code[30] === 'A' ? 'B' : 'A') + code.slice(31), 'привет', 'TB2-AAAA', '', 'TB1-' + 'A'.repeat(7000)]) assert.throws(() => Share.decode(bad));
  assert.throws(() => Share.encode({ ...p, mods: [], modsOff: [], resourcepacks: [], shaders: [] }), /Нет файлов/);
  assert.throws(() => Share.encode({ ...p, mods: ['короткий'] }), /id/);
  assert.equal(Share.encode({ ...p, name: 'x'.repeat(100) }).length > 0, true);
  assert.equal(Share.decode(Share.encode({ ...p, name: '  a\u202eb\n  ' })).name, 'ab');
  assert.equal(Share.decode(Share.encode({ mc: '1.12.2', loader: 'vanilla', name: '', mods: [], modsOff: [], resourcepacks: ['AAAAAAAA'], shaders: [] })).loader, 'vanilla');

  // 2. сбор у отправителя: файлы из каталога по sha1 → id версий; вручную добавленное в код не попадает
  const net = await Net.start(); Cat.setTestBase(net.base);
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'share-')), A = new Instances(path.join(root, 'a', 'instances'), path.join(root, 'a', 'instances.json')), B = new Instances(path.join(root, 'b', 'instances'), path.join(root, 'b', 'instances.json'));
  const ia = A.create({ name: 'Моя сборка', mc: '1.20.1', loader: 'forge', loaderVersion: 'x' }), da = A.dir(ia), info = { ...ia, dir: da };
  const done = []; const prog = (x) => done.push(x);
  await Cat.install({ src: 'mr', id: 'mHor001', type: 'mod', mc: '1.20.1', loader: 'forge', deps: true }, da, prog);
  await Cat.install({ src: 'mr', id: 'mHor002', type: 'mod', mc: '1.20.1', loader: 'forge', deps: true }, da, prog);
  await Cat.install({ src: 'mr', id: 'rPak1', type: 'resourcepack', mc: '1.20.1', loader: 'forge' }, da, prog);
  await Cat.install({ src: 'mr', id: 'sShd1', type: 'shader', mc: '1.20.1', loader: 'forge' }, da, prog);
  A.toggle(ia.id, 'mHor002.jar'); // выключенный мод передаётся выключенным
  fs.writeFileSync(path.join(da, 'mods', 'MyOwnMod.jar'), 'ручной мод'); fs.writeFileSync(path.join(da, 'resourcepacks', 'TotemSkin.zip'), 'служебный пак'); fs.mkdirSync(path.join(da, 'resourcepacks', 'МойПак'));
  const got = await Cat.shareCollect(info); const pa = got.payload;
  assert.equal(pa.name, 'Моя сборка'); assert.equal(pa.loader, 'forge'); assert.equal(pa.mc, '1.20.1');
  assert(pa.mods.length >= 1 && pa.modsOff.length === 1 && pa.resourcepacks.length === 1 && pa.shaders.length === 1, JSON.stringify(pa));
  assert(pa.mods.every((x) => /^[0-9A-Za-z]{8}$/.test(x)));
  assert.deepEqual(got.manual.sort(), ['MyOwnMod.jar', 'МойПак'].sort(), 'ручные файлы названы, служебный TotemSkin.zip — нет');
  const code2 = Share.encode(pa); assert(code2.length < 200, 'код: ' + code2.length);

  // 3. установка у друга по коду: те же файлы, выключенный мод выключен, учёт каталога записан, цены нет
  const dec = Share.decode(code2), steps = [];
  const r = await Cat.shareInstall(dec, { name: 'От друга', loaderVersion: 'test' }, B, (x) => steps.push(x));
  assert.equal(r.inst.name, 'От друга'); assert.equal(r.missing, 0); assert.equal(r.files, Share.count(pa));
  const ib = B.get(r.inst.id), db = B.dir(ib); assert.equal(ib.mc, '1.20.1'); assert.equal(ib.loader, 'forge'); assert.equal(ib.loaderVersion, 'test');
  const ls = (d) => fs.readdirSync(path.join(da, d)).filter((n) => !/MyOwnMod|TotemSkin|МойПак|^\./.test(n)).sort(), lb = (d) => fs.readdirSync(path.join(db, d)).filter((n) => !/^\./.test(n)).sort();
  for (const d of ['mods', 'resourcepacks', 'shaderpacks']) assert.deepEqual(lb(d), ls(d), d);
  assert(fs.existsSync(path.join(db, 'mods', 'mHor002.jar.disabled')), 'выключенный остался выключенным');
  assert(Cat.installedKeys(db).includes('mr:mHor001'), 'сборка друга тоже считается «из каталога»: ею можно делиться дальше');
  assert(steps.some((x) => /Создаю/.test(x.op)) && steps.some((x) => x.filesTotal > 0));
  assert.deepEqual(Share.decode(Share.encode((await Cat.shareCollect({ ...ib, dir: db })).payload)).mods, pa.mods, 'повторный обмен даёт те же версии');

  // 4. неполные данные: часть версий исчезла — ставим что есть и сообщаем; ни одной — ошибка, пустой сборки не остаётся
  const half = { ...dec, mods: [...dec.mods, 'ZZZZZZZZ'] }; const r2 = await Cat.shareInstall(half, { name: 'От друга' }, B, () => {});
  assert.equal(r2.missing, 1); assert.equal(r2.inst.name, 'От друга 2', 'одинаковое имя получает номер');
  const before = B.all().length;
  await assert.rejects(Cat.shareInstall({ ...dec, mods: ['ZZZZZZZZ'], modsOff: [], resourcepacks: [], shaders: [] }, { name: 'X' }, B, () => {}), /не нашёлся|Ни один/);
  assert.equal(B.all().length, before, 'сборка при ошибке не создаётся');

  // 5. отмена посреди скачивания не оставляет недоделанную сборку
  await net.close(); const slow = await Net.start({ slow: 40 }); Cat.setTestBase(slow.base);
  const ac = new AbortController(); setTimeout(() => ac.abort(), 250);
  await assert.rejects(Cat.shareInstall(dec, { name: 'Отмена' }, B, () => {}, ac.signal));
  assert.equal(B.all().length, before, 'после отмены сборки нет'); await slow.close();
  console.log('share-tests-ok');
})().catch((e) => { console.error(e); process.exit(1); });
