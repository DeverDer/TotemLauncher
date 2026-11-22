// Общие настройки игры между сборками
const assert = require('assert'), fs = require('fs'), os = require('os'), path = require('path'), O = require('../src/optsync.js');
const root = fs.mkdtempSync(path.join(os.tmpdir(), 'opt-')), data = path.join(root, 'data'), A = path.join(root, 'a'), B = path.join(root, 'b'), C = path.join(root, 'c'), L = path.join(root, 'legacy');
for (const d of [A, B, C, L]) fs.mkdirSync(d, { recursive: true });
assert.equal(O.pull(B, '1.20.1', data), false, 'пока общих настроек нет — ничего не трогаем');
fs.writeFileSync(path.join(A, 'options.txt'), 'version:3465\nrenderDistance:24\nmaxFps:260\nfancyGraphics:false\nlang:ru_ru\nkey_key.attack:key.mouse.left\nresourcePacks:["vanilla","file/A.zip"]\nlastServer:play.example.com\nfullscreen:true\noverrideWidth:1000\n');
assert.equal(O.push(A, '1.20.1', data), true);
const shared = JSON.parse(fs.readFileSync(path.join(data, 'shared-options-modern.json'), 'utf8')); assert.equal(shared.keys.renderDistance, '24'); for (const k of ['resourcePacks', 'lastServer', 'fullscreen', 'overrideWidth', 'version']) assert(!(k in shared.keys), k + ' не общий');
// новая сборка получает те же настройки (и версию данных — записано той же версией игры)
assert.equal(O.pull(B, '1.20.1', data), true); const b = fs.readFileSync(path.join(B, 'options.txt'), 'utf8'); assert(b.startsWith('version:3465\n')); assert(/renderDistance:24/.test(b) && /maxFps:260/.test(b) && /lang:ru_ru/.test(b)); assert(!/lastServer|A\.zip/.test(b));
// у существующей сборки меняются только общие значения, остальное остаётся
fs.writeFileSync(path.join(C, 'options.txt'), 'version:3120\nrenderDistance:8\nresourcePacks:["vanilla","file/TotemSkin.zip"]\nlastServer:my.server\nsomeModKey:1\n');
O.pull(C, '1.19.2', data); const c = fs.readFileSync(path.join(C, 'options.txt'), 'utf8'); assert(/renderDistance:24/.test(c) && /version:3120/.test(c) && /file\/TotemSkin\.zip/.test(c) && /lastServer:my\.server/.test(c) && /someModKey:1/.test(c) && /maxFps:260/.test(c));
// настройки, поменянные в другой сборке, становятся общими
fs.writeFileSync(path.join(B, 'options.txt'), b.replace('renderDistance:24', 'renderDistance:12').replace('maxFps:260', 'maxFps:120')); O.push(B, '1.20.4', data);
O.pull(A, '1.20.1', data); assert(/renderDistance:12/.test(fs.readFileSync(path.join(A, 'options.txt'), 'utf8')));
// старые версии (до 1.13) — отдельный набор, не смешивается
assert.equal(O.pull(L, '1.12.2', data), false); fs.writeFileSync(path.join(L, 'options.txt'), 'key_key.attack:-100\nrenderDistance:6\n'); O.push(L, '1.12.2', data);
assert.equal(JSON.parse(fs.readFileSync(path.join(data, 'shared-options-legacy.json'), 'utf8')).keys['key_key.attack'], '-100'); assert.equal(JSON.parse(fs.readFileSync(path.join(data, 'shared-options-modern.json'), 'utf8')).keys['key_key.attack'], 'key.mouse.left');
// версия данных не ставится сборке старее, чем игра, которой записаны настройки
const D = path.join(root, 'd'); fs.mkdirSync(D); O.pull(D, '1.16.5', data); assert(!/^version:/m.test(fs.readFileSync(path.join(D, 'options.txt'), 'utf8')), 'без чужой версии данных');
// мусор в общем файле не ломает запуск и не пускает опасные ключи
fs.writeFileSync(path.join(data, 'shared-options-modern.json'), JSON.stringify({ mc: '1.20.1', keys: { __proto__x: 'a', 'bad key': 'x', ok_key: 'v\nresourcePacks:["evil"]', good: 'yes', resourcePacks: '["x"]' } }));
const E = path.join(root, 'e'); fs.mkdirSync(E); O.pull(E, '1.20.1', data); const e = fs.readFileSync(path.join(E, 'options.txt'), 'utf8'); assert(/^good:yes$/m.test(e) && !/evil|bad key|resourcePacks/.test(e), e);
fs.writeFileSync(path.join(data, 'shared-options-modern.json'), '{сломан'); assert.equal(O.pull(E, '1.20.1', data), false);
assert.equal(O.mcOf(null, 'fabric-loader-0.16.9-1.20.1'), '1.20.1'); assert.equal(O.mcOf(null, '1.20.1-forge-47.2.0'), '1.20.1'); assert.equal(O.mcOf({ mc: '1.21' }, 'x'), '1.21');
console.log('optsync-ok');
