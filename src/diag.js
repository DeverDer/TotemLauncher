// Разбор причины, по которой игра не запустилась или упала, и автоисправления.
// После выхода игры с ошибкой главный процесс читает консоль и журналы (Deps.collect) и находит знакомую проблему:
// видеодрайвер/OpenGL, нехватка памяти, неверные параметры Java, дубликаты и конфликты модов, mixin-сбой,
// повреждённые файлы, сбой запуска Forge. Для каждой — понятное объяснение и кнопки исправления (если оно возможно).
// Фиксы применяются только из последнего найденного разбора (main.js хранит его), из окна приходит лишь id фикса.
'use strict';
const fs = require('fs'), path = require('path'), os = require('os');
const Deps = require('./deps');
const { jarInfo } = require('./instances');

// Моды, которые меняют отрисовку и чаще всего упираются в версию OpenGL / драйвер видеокарты
const GFX = new Set(['sodium', 'embeddium', 'rubidium', 'magnesium', 'xenon', 'iris', 'oculus', 'canvas', 'nvidium', 'vulkanmod', 'distanthorizons', 'immediatelyfast',
  'indium', 'reeses_sodium_options', 'reeses-sodium-options', 'sodium_extra', 'sodiumextra', 'sodium-extra', 'embeddiumplus', 'embeddium_extras', 'rubidium_extra', 'optifine', 'optifabric',
  'continuity', 'sodiumdynamiclights', 'sodium_dynamic_lights', 'entity_model_features', 'entity_texture_features', 'moreculling', 'bobby', 'flywheel', 'oculus_flywheel_compat']);
const clip = (s, n) => String(s || '').replace(/\s+/g, ' ').trim().slice(0, n);
const norm = (s) => String(s || '').toLowerCase().replace(/[^a-z0-9]/g, '');
const mb = () => Math.floor(os.totalmem() / 1048576);

function modsIndex(gameDir) { // enabled: только включённые jar; у каждого — id и название из метаданных
  const dir = path.join(gameDir || '', 'mods'), out = [];
  let names = []; try { names = fs.readdirSync(dir); } catch { return out; }
  for (const f of names) {
    if (!/\.jar(\.disabled)?$/i.test(f)) continue;
    const p = path.join(dir, f); let st; try { st = fs.statSync(p); if (!st.isFile()) continue; } catch { continue; }
    const m = /\.jar$/i.test(f) ? jarInfo(p) : {};
    out.push({ file: f, enabled: /\.jar$/i.test(f), id: String(m.id || '').toLowerCase(), title: m.title || m.id || f.replace(/\.jar$/i, ''), version: String(m.version || ''), mtime: st.mtimeMs });
  }
  return out;
}
const byIds = (idx, ids) => { const want = new Set(ids.map(norm).filter(Boolean)), out = [];
  for (const r of idx) { if (!r.enabled) continue; if ((r.id && want.has(norm(r.id))) || [...want].some((w) => w.length >= 4 && norm(r.file).startsWith(w))) out.push(r); } return out; };
const pub = (r) => ({ file: r.file, id: r.id, title: r.title });

// самая показательная строка ошибки: последнее исключение в тексте
function keyLine(text) {
  const t = String(text || ''), re = /^(?:Caused by: |Exception in thread "[^"]+" )?([\w.$]+(?:Exception|Error)(?::[^\n]*)?)$/gm; let m, last = '';
  while ((m = re.exec(t))) last = m[1];
  if (last) return clip(last, 300);
  const g = /GLFW error[^\n]*/i.exec(t); if (g) return clip(g[0], 300);
  const lines = t.split(/\r?\n/).map((x) => x.trim()).filter(Boolean); return clip(lines[lines.length - 1] || '', 300);
}

// конфликты и несовпадение версий: какой мод стоит отключить
function parseConflicts(text) {
  const out = new Map(), add = (id, why) => { id = String(id || '').toLowerCase(); if (id && !out.has(id)) out.set(id, why); }; let m;
  const fab = /Mod '([^'\n]+)' \(([\w.\-]+)\)[^\n]*?(conflicts with|is incompatible with|breaks|requires version[^\n]*?but only the wrong version is present)/g;
  while ((m = fab.exec(text))) add(m[2], /wrong version/.test(m[3]) ? 'нужна другая версия связанного мода или игры' : 'конфликтует с другим модом');
  const fml = /Mod ID:\s*'([\w.\-]+)',\s*Requested by:\s*'([\w.\-]+)',\s*Expected range:\s*'([^']*)',\s*Actual version:\s*'(?!\[?MISSING)([^']*)'/g;
  while ((m = fml.exec(text))) add(m[2], `нужна версия ${m[1]} ${m[3]}, а стоит ${m[4]}`);
  return [...out].map(([id, why]) => ({ id, why }));
}
const mixinIds = (text) => { const s = new Set(); let m;
  for (const re of [/Mixin apply for mod ([\w.\-]+) failed/g, /from mod ([\w.\-]+)/g, /\[([\w.\-]+?)\.mixins?\.json[:\]]/g, /Mixin config ([\w.\-]+?)\.mixins?\.json/g, /([\w\-]+)\.mixins?\.json:[^\n]*(?:failed|Error|Exception)/g])
    while ((m = re.exec(text))) { const id = m[1].toLowerCase(); if (!['minecraft', 'fabric', 'mixin', 'forge', 'neoforge', 'mixinextras'].includes(id)) s.add(id); }
  return [...s].slice(0, 8); };
const duplicates = (idx) => { const g = new Map(); for (const r of idx) if (r.enabled && r.id) (g.get(r.id) || g.set(r.id, []).get(r.id)).push(r); return [...g.values()].filter((l) => l.length > 1); };
const newer = (a, b) => { const x = String(a.version).split(/[.+_-]/).map((n) => parseInt(n, 10) || 0), y = String(b.version).split(/[.+_-]/).map((n) => parseInt(n, 10) || 0);
  for (let i = 0; i < Math.max(x.length, y.length); i++) { const d = (x[i] || 0) - (y[i] || 0); if (d) return d > 0; } return a.mtime > b.mtime; };

const FIX = {
  disable: (mods, label) => ({ id: 'disable', label: label || `Отключить: ${mods.slice(0, 3).map((x) => x.title).join(', ')}${mods.length > 3 ? ` и ещё ${mods.length - 3}` : ''}`, hint: 'Файлы не удаляются — мод можно включить обратно во вкладке «Сборки».', files: mods.map((x) => x.file) }),
  all: (n) => ({ id: 'disable-all', label: `Отключить все моды (${n})`, hint: 'Игра запустится без модов. Включить их обратно можно во вкладке «Сборки».' }),
  verify: () => ({ id: 'verify', label: 'Проверить и докачать файлы игры', hint: 'При следующем запуске лаунчер сверит файлы игры и заново скачает повреждённые.' }),
  loader: (name) => ({ id: 'reinstall-loader', label: `Переустановить ${name}`, hint: 'Установленная версия загрузчика будет удалена и поставлена заново при запуске.' }),
};

// text — вся доступная диагностика; inst — сборка ({ mc, loader, dir }); S — настройки (ram, javaPath, jvmArgs)
function classify(text, { inst = {}, S = {}, gameDir = '', idx = null, code = 1 } = {}) {
  idx = idx || modsIndex(gameDir || inst.dir); const enabled = idx.filter((r) => r.enabled), detail = keyLine(text), loaderName = { fabric: 'Fabric', forge: 'Forge', neoforge: 'NeoForge' }[inst.loader] || '';
  const issue = (o) => ({ detail, mods: [], fixes: [], ...o });
  let m;

  // 1. видеодрайвер / OpenGL
  if ((m = /GLFW error (6554\d)|Driver does not support OpenGL|failed to create (?:the )?GLFW window|The driver does not appear to support OpenGL|WGL: [^\n]*(?:pixel format|OpenGL)|GLX: [^\n]*(?:OpenGL|visual)|OpenGL \d\.\d[^\n]*(?:not supported|unsupported)/i.exec(text))) {
    const ver = /OpenGL version (\d\.\d)/i.exec(text)?.[1], gfx = enabled.filter((r) => GFX.has(r.id) || GFX.has(r.id.replace(/_/g, '-')));
    const fixes = []; if (gfx.length) fixes.push(FIX.disable(gfx, `Отключить моды графики (${gfx.length})`)); if (enabled.length > gfx.length) fixes.push(FIX.all(enabled.length));
    fixes.push({ id: 'driver', label: 'Как обновить драйвер видеокарты', hint: 'Откроется страница Microsoft с инструкцией.', url: 'https://aka.ms/mcdriver' });
    return issue({ id: 'gl', title: ver ? `Видеокарта не поддерживает OpenGL ${ver}` : 'Видеокарта или драйвер не подходят игре', short: 'Ошибка видеодрайвера (OpenGL)',
      text: `Игре${gfx.length ? ' (или моду графики)' : ''} нужна${ver ? ' OpenGL ' + ver : ' более новая версия OpenGL'}, а видеокарта или её драйвер этого не умеют. Обычно помогает одно из двух: отключить моды, меняющие графику (Sodium, Iris и подобные), либо обновить драйвер видеокарты.${/^(2\d|1\.2[2-9])/.test(inst.mc || '') ? ' Новые версии Minecraft требовательнее к видеокарте — на старом ноутбуке надёжнее версия 1.20.1 или ниже.' : ''}`, mods: gfx.map(pub), fixes });
  }
  // 2. память
  if (/java\.lang\.OutOfMemoryError|GC overhead limit exceeded|Could not reserve enough space|There is insufficient memory|Too small (?:initial|maximum) heap|Invalid maximum heap size|Out of memory/i.test(text)) {
    const reserve = /Could not reserve|Invalid maximum heap|insufficient memory/i.test(text), cur = S.ram | 0, total = mb(), fixes = [];
    const cap = Math.floor((total * 0.6) / 512) * 512; let target;
    if (reserve) { target = Math.max(1024, Math.min(cur || cap, cap)); if (cur && target >= cur) target = Math.max(1024, cur - 1024); }
    else target = Math.min(8192, Math.floor((total - 1536) / 512) * 512, Math.max((cur || 2048) + 1024, 4096));
    if (target >= 1024 && target !== cur && (reserve ? target < cur || !cur : target > cur)) fixes.push({ id: 'ram', label: `Выделить игре ${(target / 1024).toFixed(target % 1024 ? 1 : 0).replace('.', ',')} ГБ памяти`, hint: 'Объём ОЗУ для игры можно поменять в Настройках → Игра.', mb: target });
    if (!reserve && enabled.length > 40) fixes.push(FIX.all(enabled.length));
    return issue({ id: 'oom', title: reserve ? 'Игре не хватило свободной памяти' : 'Игре не хватает оперативной памяти', short: 'Не хватает памяти',
      text: reserve ? `Выбранный объём памяти (${cur ? Math.round(cur / 1024 * 10) / 10 + ' ГБ' : 'по умолчанию'}) больше, чем сейчас может выделить система (всего в компьютере ${(total / 1024).toFixed(1).replace('.', ',')} ГБ). Уменьшите объём или закройте другие программы.` : `Игра упёрлась в лимит памяти (${cur ? Math.round(cur / 1024 * 10) / 10 + ' ГБ' : 'по умолчанию'}). С большим числом модов нужно больше: выделите игре больше ОЗУ или уберите часть модов.${target <= cur ? ' Свободной ОЗУ в компьютере больше не осталось — поможет только уменьшение числа модов.' : ''}`, fixes });
  }
  // 3. параметры Java
  if (/Unrecognized (?:VM )?option|Unrecognized option|Could not create the Java Virtual Machine|Unknown (?:VM )?option|Improperly specified VM option/i.test(text) && String(S.jvmArgs || '').trim())
    return issue({ id: 'jvm', title: 'Неверные параметры запуска Java', short: 'Неверные параметры Java', text: 'Java не приняла дополнительные параметры запуска из настроек (скорее всего, они не подходят этой версии Java). Сбросьте их — игра запустится с параметрами по умолчанию.', fixes: [{ id: 'jvm-reset', label: 'Сбросить параметры JVM', hint: 'Поле «Параметры JVM» в настройках будет очищено.' }] });
  if (/UnsupportedClassVersionError|compiled by a more recent version of the Java Runtime|class file version (\d+)/i.test(text)) {
    const cv = +(/class file version (\d+)/i.exec(text)?.[1] || 0), need = cv ? cv - 44 : 0, fixes = [];
    if (String(S.javaPath || '').trim()) fixes.push({ id: 'java-auto', label: 'Использовать Java из лаунчера', hint: 'Путь к своей Java в настройках будет сброшен — лаунчер возьмёт нужную сам.' });
    else if (enabled.length) fixes.push(FIX.all(enabled.length));
    return issue({ id: 'java', title: 'Версия Java не подходит', short: 'Не подходит версия Java', text: String(S.javaPath || '').trim() ? `Выбрана своя Java, которая слишком старая${need ? ' (нужна Java ' + need + ' или новее)' : ''}. Лаунчер сам скачивает правильную Java — достаточно убрать свой путь.` : `Один из модов собран для более новой Java${need ? ' (' + need + ')' : ''}, чем нужна этой версии Minecraft — вероятно, мод сделан для другой версии игры. Найдите его по названию в журнале или временно отключите все моды.`, fixes });
  }
  // 4. дубликаты модов и конфликты модулей (Forge: ResolutionException)
  const dup = duplicates(idx);
  if (dup.length && /Duplicate|duplicate|ResolutionException|export package|Found \d+ mods? with|ModFileResolution|already (?:loaded|registered)|is provided by/i.test(text))
    return issue({ id: 'dupes', title: 'В сборке лежат дубликаты модов', short: 'Дубликаты модов', text: `Один и тот же мод лежит в папке mods несколько раз (в разных версиях): ${dup.slice(0, 4).map((l) => l[0].title).join(', ')}${dup.length > 4 ? '…' : ''}. Игра не запускается, пока остаётся только одна копия. Лаунчер оставит самую новую.`, mods: dup.flat().map(pub), fixes: [{ id: 'dedupe', label: 'Убрать дубликаты (оставить новые версии)', hint: 'Старые копии отключатся, а не удалятся.' }] });
  if ((m = /ResolutionException: Modules? ([\w.$\-]+) and ([\w.$\-]+) export package|FindException: Module ([\w.$\-]+) not found(?:, required by ([\w.$\-]+))?/.exec(text))) {
    const names = [m[1], m[2], m[3], m[4]].filter(Boolean), hit = byIds(enabled, names), fixes = [];
    if (hit.length) fixes.push(FIX.disable(hit)); if (enabled.length) fixes.push(FIX.all(enabled.length)); if (loaderName) fixes.push(FIX.loader(loaderName));
    return issue({ id: 'modules', title: 'Моды конфликтуют при запуске', short: 'Конфликт модов при запуске', text: `Forge не смог собрать моды в одну сборку: ${m[3] ? `не хватает модуля «${m[3]}»${m[4] ? ` (он нужен для «${m[4]}»)` : ''}` : `модули «${m[1]}» и «${m[2]}» мешают друг другу`}. Обычно так бывает, когда мод лежит в двух версиях или не подходит этой версии игры.`, mods: hit.map(pub), fixes });
  }
  // 5. конфликты и несовпадение версий (Fabric / Forge)
  const conf = parseConflicts(text);
  if (conf.length) { const hit = byIds(enabled, conf.map((x) => x.id)), fixes = [];
    if (hit.length) fixes.push(FIX.disable(hit)); if (enabled.length) fixes.push(FIX.all(enabled.length));
    return issue({ id: 'incompat', title: 'Моды несовместимы друг с другом', short: 'Несовместимые моды', text: `${conf.slice(0, 3).map((x) => `«${(idx.find((r) => r.id === x.id) || {}).title || x.id}»: ${x.why}`).join('; ')}. Отключите проблемный мод — остальные продолжат работать.`, mods: hit.map(pub), fixes }); }
  // 6. mixin-сбой
  if (/Mixin (?:apply|transformation|prepare)[^\n]*(?:failed|error)|MixinApplyError|InvalidMixinException|MixinTransformerError|Critical injection failure|MixinTargetAlreadyLoadedException|InjectionError/i.test(text)) {
    const ids = mixinIds(text), hit = byIds(enabled, ids), fixes = []; if (hit.length) fixes.push(FIX.disable(hit)); if (enabled.length) fixes.push(FIX.all(enabled.length));
    return issue({ id: 'mixin', title: 'Мод не смог встроиться в игру', short: 'Сбой mixin у мода', text: `${hit.length ? `Мод «${hit[0].title}»${hit.length > 1 ? ' (и ещё ' + (hit.length - 1) + ')' : ''}` : 'Один из модов'} не смог изменить код игры — он несовместим с этой версией Minecraft, загрузчиком или другим модом.`, mods: hit.map(pub), fixes });
  }
  // 7. повреждённые файлы
  if (/ZipException|zip END header not found|Invalid or corrupt jarfile|SecurityException: (?:SHA|signer)|Could not find or load main class|NoClassDefFoundError: (?:net\/minecraft|com\/mojang|org\/lwjgl)|ClassNotFoundException: (?:net\.minecraft|com\.mojang|org\.lwjgl)/i.test(text))
    return issue({ id: 'files', title: 'Файлы игры повреждены', short: 'Повреждены файлы игры', text: 'Часть файлов игры скачалась не полностью или повредилась. Лаунчер перепроверит их по контрольным суммам и скачает заново только испорченные.', fixes: [FIX.verify(), ...(loaderName ? [FIX.loader(loaderName)] : [])] });
  // 8. сбой запуска Forge/NeoForge/Fabric без понятной причины
  if (/BootstrapLaunchConsumer|BootstrapLauncher|cpw\.mods\.modlauncher|KnotClient|net\.fabricmc\.loader|Exception in thread "main"/i.test(text) || code !== 0) {
    const fixes = []; if (enabled.length) fixes.push(FIX.all(enabled.length)); fixes.push(FIX.verify()); if (loaderName) fixes.push(FIX.loader(loaderName));
    const boot = /BootstrapLaunch|modlauncher|KnotClient|fabricmc\.loader/i.test(text);
    return issue({ id: boot ? 'boot' : 'unknown', title: boot ? `${loaderName || 'Загрузчик'} не смог запустить сборку` : 'Игра закрылась с ошибкой', short: boot ? 'Сбой запуска сборки' : 'Игра закрылась с ошибкой',
      text: boot ? `Игра не дошла даже до главного меню: ${loaderName || 'загрузчик'} остановился при подготовке модов. Чаще всего виноват один из модов (не та версия или конфликт). Самое быстрое — отключить все моды и проверить, что игра запускается, затем включать их обратно по частям.` : `Игра закрылась с кодом ${code}. Точную причину лаунчер определить не смог — попробуйте варианты ниже; подробности в журнале игры.`, fixes });
  }
  return null;
}

// Итог по завершившейся игре: null — всё в порядке или причина не найдена
function analyze({ gameDir, tail = '', since = 0, code = 1, inst = {}, S = {} } = {}) {
  if (!code) return null;
  const text = Deps.collect({ gameDir, tail, since });
  const r = classify(text, { inst: { ...inst, dir: inst.dir || gameDir }, S, gameDir, code }); if (r) r.code = code; return r;
}

// ---------- применение исправлений ----------
const loaderNames = (versionsDir, loader, mc) => { let all = []; try { all = fs.readdirSync(versionsDir); } catch { return []; }
  const y = /^(2\d)\.(\d+)/.exec(mc) || /^1\.(\d+)(?:\.(\d+))?$/.exec(mc), pre = y ? `${y[1]}.${y[2] || 0}.` : '';
  return all.filter((n) => loader === 'fabric' ? n.startsWith('fabric-loader-') && n.endsWith('-' + mc) : loader === 'forge' ? /forge/i.test(n) && !/neoforge/i.test(n) && n.startsWith(mc + '-') : loader === 'neoforge' ? !!pre && n.startsWith('neoforge-' + pre) : false); };
function setDisabled(modsDir, names) { let n = 0; for (const f of names) { if (typeof f !== 'string' || path.basename(f) !== f || !/\.jar$/i.test(f)) continue; const p = path.join(modsDir, f); try { if (fs.existsSync(p)) { fs.renameSync(p, p + '.disabled'); n++; } } catch {} } return n; }

// env: { instDir, versionsDir, inst, getSettings(), setSettings(patch), snapshot(label) }
function apply(fix, env) {
  const modsDir = path.join(env.instDir, 'mods'), snap = () => { try { env.snapshot?.('Перед автоисправлением'); } catch {} };
  switch (fix.id) {
    case 'disable': { snap(); const n = setDisabled(modsDir, fix.files || []); return { ok: true, note: n ? `Отключено модов: ${n}. Включить их обратно можно во вкладке «Сборки».` : 'Эти моды уже отключены.' }; }
    case 'disable-all': { snap(); const files = modsIndex(env.instDir).filter((r) => r.enabled).map((r) => r.file), n = setDisabled(modsDir, files); return { ok: true, note: `Отключено модов: ${n}. Если игра запустится — включайте моды обратно по частям во вкладке «Сборки».` }; }
    case 'dedupe': { snap(); const off = []; for (const g of duplicates(modsIndex(env.instDir))) { const keep = g.reduce((a, b) => (newer(b, a) ? b : a)); for (const r of g) if (r !== keep) off.push(r.file); } const n = setDisabled(modsDir, off); return { ok: true, note: n ? `Убрано дубликатов: ${n}.` : 'Дубликатов не найдено.' }; }
    case 'ram': { const v = fix.mb | 0; if (v < 1024 || v > 65536) return { ok: false, error: 'Неверный объём памяти' }; env.setSettings({ ram: v }); return { ok: true, note: `Игре выделено ${(v / 1024).toFixed(v % 1024 ? 1 : 0).replace('.', ',')} ГБ памяти.` }; }
    case 'jvm-reset': env.setSettings({ jvmArgs: '' }); return { ok: true, note: 'Параметры JVM сброшены.' };
    case 'java-auto': env.setSettings({ javaPath: '' }); return { ok: true, note: 'Теперь используется Java лаунчера.' };
    case 'verify': { let n = 0; try { for (const v of fs.readdirSync(env.versionsDir)) { const mk = path.join(env.versionsDir, v, '.installed'); if (v.includes(env.inst.mc) && fs.existsSync(mk)) { fs.unlinkSync(mk); n++; } } } catch {} return { ok: true, note: 'Файлы игры будут проверены при следующем запуске.' }; }
    case 'reinstall-loader': { const names = loaderNames(env.versionsDir, env.inst.loader, env.inst.mc); for (const n of names) { try { fs.rmSync(path.join(env.versionsDir, n), { recursive: true, force: true }); } catch {} } return { ok: true, note: names.length ? 'Загрузчик будет установлен заново при запуске.' : 'Загрузчик установится при запуске.' }; }
    default: return { ok: false, error: 'Неизвестное исправление' };
  }
}
module.exports = { analyze, classify, apply, modsIndex, parseConflicts, keyLine, GFX, loaderNames };
