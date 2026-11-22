// Этап 14: повторное использование Forge/Fabric, разбор ошибок запуска и автоисправления, проверка зависимостей модов
const assert = require('assert'), fs = require('fs'), os = require('os'), path = require('path'), AdmZip = require('adm-zip');
const Game = require('../src/game.js'), Diag = require('../src/diag.js'), Pre = require('../src/preflight.js'), T = Game._t;
const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'diag-'));
const mkJar = (dir, name, files) => { fs.mkdirSync(dir, { recursive: true }); const z = new AdmZip(); for (const [k, v] of Object.entries(files)) z.addFile(k, Buffer.isBuffer(v) ? v : Buffer.from(typeof v === 'string' ? v : JSON.stringify(v))); z.writeZip(path.join(dir, name)); };
const fab = (id, o = {}) => ({ 'fabric.mod.json': { schemaVersion: 1, id, version: o.v || '1.0.0', name: o.name || id, depends: o.depends || {}, breaks: o.breaks || {}, provides: o.provides } });

(async () => {
  // 1. Fabric/Forge: уже установленная версия не качается заново, новая — ставится
  const versions = path.join(tmp, 'versions'), dirs = { versions };
  const mkv = (n) => { fs.mkdirSync(path.join(versions, n), { recursive: true }); fs.writeFileSync(path.join(versions, n, n + '.json'), '{}'); };
  mkv('fabric-loader-0.15.11-1.20.1'); mkv('fabric-loader-0.16.10-1.20.1'); mkv('fabric-loader-0.16.10-1.21.1'); mkv('1.20.1-forge-47.2.0'); mkv('1.20.1-forge-47.4.0'); mkv('1.12.2-forge1.12.2-14.23.5.2860'); mkv('neoforge-21.1.172');
  assert.deepEqual(T.localLoaders(dirs, 'fabric', '1.20.1').sort(), ['0.15.11', '0.16.10']);
  assert.deepEqual(T.localLoaders(dirs, 'forge', '1.20.1').sort(), ['47.2.0', '47.4.0']);
  assert.deepEqual(T.localLoaders(dirs, 'forge', '1.12.2'), ['14.23.5.2860']);
  assert.deepEqual(T.localLoaders(dirs, 'neoforge', '1.21.1'), ['21.1.172']); assert.deepEqual(T.localLoaders(dirs, 'neoforge', '1.20.4'), []);
  assert.equal((await T.pickLoader('fabric', '1.20.1', '0.15.11', dirs)).installed, true, 'закреплённая и установленная — берём её');
  const old = await T.pickLoader('fabric', '1.20.1', '0.14.0', dirs); assert.deepEqual(old, { lv: '0.16.10', installed: true }, 'старая закреплённая не качается — берём уже стоящую более новую');
  const neu = await T.pickLoader('fabric', '1.20.1', '0.17.0', dirs); assert.deepEqual(neu, { lv: '0.17.0', installed: false }, 'новая версия загрузчика ставится');
  const none = await T.pickLoader('forge', '1.19.2', '43.3.0', dirs); assert.deepEqual(none, { lv: '43.3.0', installed: false }, 'для этой версии ещё ничего не стоит — ставим');
  assert.equal(T.vcmp('47.4.0', '47.10.0'), -1);

  // 2. ошибка видеодрайвера (GLFW 65543, как на фото): находим моды графики и отключаем их
  const gd = path.join(tmp, 'inst-gl'), md = path.join(gd, 'mods');
  mkJar(md, 'sodium.jar', fab('sodium')); mkJar(md, 'iris.jar', fab('iris')); mkJar(md, 'lithium.jar', fab('lithium')); mkJar(md, 'fabric-api.jar', fab('fabric-api'));
  const glText = 'GLFW error 65543: WGL: Driver does not support OpenGL version 4.6\nPlease make sure you have up-to-date drivers (see aka.ms/mcdriver for instructions).';
  let d = Diag.analyze({ gameDir: gd, tail: glText, code: 1, inst: { mc: '1.20.1', loader: 'fabric', dir: gd }, S: { ram: 4096 } });
  assert.equal(d.id, 'gl'); assert(/4\.6/.test(d.title)); assert.deepEqual(d.mods.map((x) => x.id).sort(), ['iris', 'sodium']);
  assert(d.fixes[0].id === 'disable' && d.fixes[0].files.length === 2 && d.fixes.some((f) => f.id === 'disable-all') && d.fixes.some((f) => f.url === 'https://aka.ms/mcdriver'));
  const calls = []; let r = Diag.apply(d.fixes[0], { instDir: gd, versionsDir: versions, inst: { mc: '1.20.1', loader: 'fabric' }, setSettings: () => {}, snapshot: (l) => calls.push(l) });
  assert(r.ok && calls.length === 1); assert.deepEqual(fs.readdirSync(md).sort(), ['fabric-api.jar', 'iris.jar.disabled', 'lithium.jar', 'sodium.jar.disabled']);
  r = Diag.apply({ id: 'disable', files: ['../../etc/passwd', 'x/y.jar'] }, { instDir: gd, inst: {}, snapshot: () => {} }); assert(r.ok, 'посторонние пути игнорируются');

  // 3. Forge: сбой BootstrapLauncher без причины — предлагаем отключить все моды, проверить файлы, переустановить Forge
  const fd = path.join(tmp, 'inst-forge'); mkJar(path.join(fd, 'mods'), 'a.jar', { 'META-INF/mods.toml': 'modLoader="javafml"\n[[mods]]\nmodId="a"\n' });
  d = Diag.analyze({ gameDir: fd, tail: 'at cpw.mods.modlauncher@10.0.9/cpw.mods.modlauncher.BootstrapLaunchConsumer.accept(BootstrapLaunchConsumer.java:26)', code: 1, inst: { mc: '1.20.1', loader: 'forge', dir: fd }, S: {} });
  assert.equal(d.id, 'boot'); assert.deepEqual(d.fixes.map((f) => f.id), ['disable-all', 'verify', 'reinstall-loader']);
  r = Diag.apply(d.fixes[2], { instDir: fd, versionsDir: versions, inst: { mc: '1.20.1', loader: 'forge' } }); assert(r.ok && !fs.existsSync(path.join(versions, '1.20.1-forge-47.2.0')) && fs.existsSync(path.join(versions, '1.12.2-forge1.12.2-14.23.5.2860')), 'удаляется только Forge нужной версии MC');
  // конфликт модулей Forge → находим дубликаты
  const dd = path.join(tmp, 'inst-dup'); const toml = (v) => ({ 'META-INF/mods.toml': `modLoader="javafml"\n[[mods]]\nmodId="coolmod"\nversion="${v}"\n` });
  mkJar(path.join(dd, 'mods'), 'coolmod-1.0.jar', toml('1.0.0')); mkJar(path.join(dd, 'mods'), 'coolmod-1.2.jar', toml('1.2.0'));
  d = Diag.analyze({ gameDir: dd, tail: 'java.lang.module.ResolutionException: Modules coolmod and coolmod export package x to module y', code: 1, inst: { mc: '1.20.1', loader: 'forge', dir: dd }, S: {} });
  assert.equal(d.id, 'dupes'); r = Diag.apply(d.fixes[0], { instDir: dd, inst: {}, snapshot: () => {} }); assert(r.ok); assert.deepEqual(fs.readdirSync(path.join(dd, 'mods')).sort(), ['coolmod-1.0.jar.disabled', 'coolmod-1.2.jar'], 'оставлена новая версия');

  // 4. память, параметры Java, свой путь Java, mixin, повреждённые файлы
  const od = path.join(tmp, 'inst-x'); fs.mkdirSync(od, { recursive: true });
  d = Diag.analyze({ gameDir: od, tail: 'java.lang.OutOfMemoryError: Java heap space', code: 1, inst: { mc: '1.20.1', loader: 'vanilla', dir: od }, S: { ram: 2048 } });
  assert.equal(d.id, 'oom'); assert(d.fixes.length === 0 || d.fixes[0].id === 'ram'); if (d.fixes[0]) { const st = {}; assert(Diag.apply(d.fixes[0], { instDir: od, inst: {}, setSettings: (p) => Object.assign(st, p) }).ok && st.ram > 2048); }
  d = Diag.analyze({ gameDir: od, tail: 'Unrecognized VM option \'Foo\'\nError: Could not create the Java Virtual Machine.', code: 1, inst: { loader: 'vanilla' }, S: { jvmArgs: '-XX:Foo' } }); assert.equal(d.id, 'jvm'); assert.equal(d.fixes[0].id, 'jvm-reset');
  d = Diag.analyze({ gameDir: od, tail: 'java.lang.UnsupportedClassVersionError: x has been compiled by a more recent version of the Java Runtime (class file version 65.0)', code: 1, inst: { loader: 'vanilla' }, S: { javaPath: 'C:\\j8\\bin\\java.exe' } }); assert.equal(d.id, 'java'); assert.equal(d.fixes[0].id, 'java-auto');
  const xd = path.join(tmp, 'inst-mix'); mkJar(path.join(xd, 'mods'), 'badmod.jar', fab('badmod', { name: 'Bad Mod' })); mkJar(path.join(xd, 'mods'), 'ok.jar', fab('okmod'));
  d = Diag.analyze({ gameDir: xd, tail: 'Mixin apply for mod badmod failed badmod.mixins.json:Foo from mod badmod -> net.minecraft.Bar: InvalidInjectionException', code: 1, inst: { mc: '1.20.1', loader: 'fabric', dir: xd }, S: {} });
  assert.equal(d.id, 'mixin'); assert.deepEqual(d.mods.map((x) => x.id), ['badmod']);
  d = Diag.analyze({ gameDir: xd, tail: 'Caused by: java.util.zip.ZipException: zip END header not found', code: 1, inst: { mc: '1.20.1', loader: 'fabric', dir: xd }, S: {} }); assert.equal(d.id, 'files'); assert.equal(d.fixes[0].id, 'verify');
  assert.equal(Diag.analyze({ gameDir: xd, tail: 'GLFW error 65543', code: 0, inst: {}, S: {} }), null, 'успешный выход — без разбора');
  // Fabric: мод требует другую версию игры → предлагаем отключить именно его
  const cd = path.join(tmp, 'inst-conf'); mkJar(path.join(cd, 'mods'), 'oldmod.jar', fab('oldmod', { name: 'Old Mod' }));
  d = Diag.analyze({ gameDir: cd, tail: "Incompatible mod set!\n\t - Mod 'Old Mod' (oldmod) 1.0.0 requires version 1.19.x of minecraft, but only the wrong version is present: 1.20.1!", code: 1, inst: { mc: '1.20.1', loader: 'fabric', dir: cd }, S: {} });
  assert.equal(d.id, 'incompat'); assert.deepEqual(d.mods.map((x) => x.file), ['oldmod.jar']);

  // 5. проверка зависимостей модов (в том числе вложенные jar) и починка
  const pd = path.join(tmp, 'inst-pre'), pm = path.join(pd, 'mods');
  const inner = new AdmZip(); inner.addFile('fabric.mod.json', Buffer.from(JSON.stringify({ schemaVersion: 1, id: 'innerlib', version: '1.0' })));
  mkJar(pm, 'host.jar', { ...fab('host', { depends: { innerlib: '*', fabric: '*' } }), 'META-INF/jars/innerlib.jar': inner.toBuffer() });
  const hz = new AdmZip(path.join(pm, 'host.jar')); const j = JSON.parse(hz.readAsText('fabric.mod.json')); j.jars = [{ file: 'META-INF/jars/innerlib.jar' }]; hz.updateFile('fabric.mod.json', Buffer.from(JSON.stringify(j))); hz.writeZip(path.join(pm, 'host.jar'));
  mkJar(pm, 'needy.jar', fab('needy', { depends: { 'missing-lib': '>=1.0', minecraft: '1.19.x' } })); mkJar(pm, 'fabric-api.jar', fab('fabric-api', { provides: ['fabric'] })); mkJar(pm, 'a.jar', fab('a', { breaks: { b: '*' } })); mkJar(pm, 'b.jar', fab('b'));
  let c = Pre.check(pm, { mc: '1.20.1' });
  assert.deepEqual(c.missing.map((x) => x.id), ['missing-lib'], 'вложенный jar и provides считаются установленными'); assert.deepEqual(c.wrongMc.map((x) => x.file), ['needy.jar']); assert.deepEqual(c.conflicts.map((x) => x.file), ['a.jar']);
  const rep = await Pre.repair({ dir: pd, mc: '1.20.1', loader: 'fabric', Cat: { installDeps: async () => ({ installed: [], missing: ['missing-lib'] }) } });
  assert(rep.disabled.length >= 2); c = Pre.check(pm, { mc: '1.20.1' }); assert(!c.missing.length && !c.wrongMc.length && !c.conflicts.length, 'после починки проблем нет'); assert(fs.existsSync(path.join(pm, 'host.jar')) && fs.existsSync(path.join(pm, 'fabric-api.jar')));
  console.log('diag-tests-ok');
})().catch((e) => { console.error(e); process.exit(1); });
