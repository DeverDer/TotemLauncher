// Forge/NeoForge 1.17+: клиентский jar ванильной версии должен попасть в -DignoreList, иначе «Modules minecraft and _1._20._1 export package …»
const assert = require('assert'), path = require('path'), { _t: t } = require('../src/game.js');
const vj = { type: 'release', mainClass: 'cpw.mods.bootstraplauncher.BootstrapLauncher', assetIndex: { id: '5' }, arguments: { jvm: ['-DignoreList=bootstraplauncher,securejarhandler,asm-commons,forge-,${version_name}.jar', '-p', '${library_directory}/a.jar${classpath_separator}${library_directory}/b.jar', '--add-modules', 'ALL-MODULE-PATH', '-cp', '${classpath}'], game: ['--version', '${version_name}'] } };
const run = (cp, id = '1.20.1-forge-47.2.0') => t.buildArgs({ id, name: 'S', ram: 1024, cp, ndir: 'n', gameDir: 'g', assetsRoot: 'as', libDir: 'L', vj });
const a = run([path.join('l', 'x.jar'), path.join('v', '1.20.1', '1.20.1.jar')]), ig = a.find((x) => x.startsWith('-DignoreList=')).split(',');
assert(ig.includes('1.20.1.jar'), 'клиентский jar игнорируется загрузчиком модулей'); assert(ig.includes('1.20.1-forge-47.2.0.jar'), 'исходный элемент остался'); assert(ig.includes('forge-'));
assert.equal(a[a.indexOf('--version') + 1], '1.20.1-forge-47.2.0', 'версия в игре как раньше');
const b = run(['x.jar', '1.20.1.jar'], '1.20.1'); assert.equal(b.find((x) => x.startsWith('-DignoreList=')).split(',').filter((x) => x === '1.20.1.jar').length, 1, 'дубль имени не размножается');
const c = t.buildArgs({ id: '1.20.1', name: 'S', ram: 1024, cp: ['a.jar'], ndir: 'n', gameDir: 'g', assetsRoot: 'as', vj: { ...vj, arguments: { jvm: ['-Dx=1'], game: [] } } }); assert(!c.some((x) => /ignoreList/.test(x)), 'у остальных загрузчиков аргументов не прибавляется');
console.log('forgeargs-ok');
