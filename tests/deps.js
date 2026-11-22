// Зависимые моды: разбор журналов Forge / NeoForge / Fabric и поиск в папке игры
const assert = require('assert'), fs = require('fs'), os = require('os'), path = require('path');
const D = require('../src/deps.js');
const ids = (a) => a.map((x) => x.id).sort();
// Forge 1.20.1
const forge = `net.minecraftforge.fml.ModLoadingException: Fantasy Armor (fantasyarmor) has failed to load correctly
Missing or unsupported mandatory dependencies:
\tMod ID: 'geckolib', Requested by: 'fantasyarmor', Expected range: '[4.2.1,)', Actual version: '[MISSING]'
\tMod ID: 'cloth_config', Requested by: 'knights', Expected range: '[11.0,)', Actual version: '[MISSING]'
\tMod ID: 'forge', Requested by: 'knights', Expected range: '[47.1,)', Actual version: '[MISSING]'
\tMod ID: 'architectury', Requested by: 'knights', Expected range: '[9,)', Actual version: '9.0.1'`;
let r = D.parseMissing(forge); assert.deepEqual(ids(r), ['cloth_config', 'geckolib'], 'forge/minecraft исключаются, найденные с версией — не «потеряны»');
assert.deepEqual(r.find((x) => x.id === 'geckolib').by, ['fantasyarmor']); assert.equal(r.find((x) => x.id === 'geckolib').range, '[4.2.1,)');
// NeoForge (новый формат)
r = D.parseMissing('Mod Dungeons Mod requires Terrablender 4.0.0.1 or above\nCurrently, terrablender is not installed'); assert.deepEqual(ids(r), ['terrablender']); assert.equal(r[0].by[0], 'Dungeons Mod');
// Fabric
const fabric = `net.fabricmc.loader.impl.FormattedException: Some of your mods are incompatible with the game or each other!
A potential solution has been determined, this may resolve your problem:
\t - Install fabric-api, any version.
\t - Install cloth-config, version 11.0.0 or later.
Unmet dependency listing:
\t - Mod 'Conquest' (conquest) 1.0 requires any version of fabric-api, which is missing!
\t - Mod 'Medieval Armors' (medarmor) 2.1 requires version 11.0.0 or later of cloth-config, which is missing!
\t - Mod 'X' (x) 1 requires any version of minecraft, which is missing!`;
r = D.parseMissing(fabric); assert.deepEqual(ids(r), ['cloth-config', 'fabric-api']); assert.deepEqual(r.find((x) => x.id === 'fabric-api').by, ['Conquest']);
// мусор и вредные id не проходят
assert.deepEqual(D.parseMissing("Mod ID: '../../evil', Requested by: 'a', Expected range: '[1,)', Actual version: '[MISSING]'\nCurrently, x y is not installed"), []);
assert.deepEqual(D.parseMissing('всё хорошо, игра закрыта'), []);
// сканирование папки игры: свежий latest.log читается, старый — нет
const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'deps-')); fs.mkdirSync(path.join(dir, 'logs'));
const lf = path.join(dir, 'logs', 'latest.log'); fs.writeFileSync(lf, forge);
assert.deepEqual(ids(D.scan({ gameDir: dir, since: Date.now() - 5000 })), ['cloth_config', 'geckolib']);
const old = new Date(Date.now() - 3600e3); fs.utimesSync(lf, old, old); assert.deepEqual(D.scan({ gameDir: dir, since: Date.now() - 5000 }), [], 'журнал от прошлого запуска игнорируется');
assert.deepEqual(ids(D.scan({ gameDir: dir, tail: fabric, since: Date.now() - 5000 })), ['cloth-config', 'fabric-api'], 'последние строки консоли тоже читаются');
console.log('deps ok');
