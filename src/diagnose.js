'use strict';
// Диагностика сборок: что мешает запуску. Два источника:
//  1) статический разбор модов сборки (зависимости, дубликаты, загрузчик, версия Minecraft, взаимные запреты);
//  2) разбор лога/краш-репорта после неудачного запуска (Fabric/Quilt/Forge/NeoForge, Mixin, память, Java, аргументы JVM).
// Результат — список находок {level, code, title, detail, files, ids, fix, search}; интерфейс показывает их и даёт кнопки «выключить/найти в каталоге».
const fs = require('fs'), path = require('path');
const { mcSatisfies } = require('./compat');
const { zipIndex } = require('./updater-core');

const BUILTIN = /^(minecraft|java|fabricloader|fabric-loader|quilt_loader|quilt-loader|quilted_fabric_api|forge|neoforge|fml|javafml|lowcodefml|mclanguage|mcp|fabric-api-base)$/i;
const VANILLA_PKG = /^(java|javax|jdk|sun|com\.sun|net\.minecraft|net\.minecraftforge|net\.neoforged|cpw\.mods|net\.fabricmc|org\.quiltmc|org\.spongepowered|com\.mojang|org\.lwjgl|io\.netty|com\.google|org\.apache|it\.unimi|org\.objectweb|org\.slf4j|org\.joml|com\.electronwill|joptsimple|oshi|org\.lz4|com\.ibm|org\.openjdk|kotlin|kotlinx|scala)\b/;
// частые библиотеки: по пути класса понятно, какого мода-библиотеки не хватает
const LIBS = [['dev/architectury', 'Architectury API'], ['me/shedaniel/clothconfig2', 'Cloth Config API'], ['net/fabricmc/fabric/api', 'Fabric API'], ['software/bernie/geckolib', 'GeckoLib'], ['team/creative', 'CreativeCore'],
  ['com/teamresourceful/resourcefullib', 'Resourceful Lib'], ['top/theillusivec4/curios', 'Curios API'], ['vazkii/patchouli', 'Patchouli'], ['mezz/jei', 'Just Enough Items'], ['net/darkhax/bookshelf', 'Bookshelf'],
  ['io/github/prospector/modmenu', 'Mod Menu'], ['com/terraformersmc/modmenu', 'Mod Menu'], ['blue/endless/jankson', 'Jankson'], ['net/caffeinemc/mods/sodium', 'Sodium'], ['me/jellysquid/mods/sodium', 'Sodium'],
  ['org/embeddedt/embeddium', 'Embeddium'], ['net/irisshaders', 'Iris Shaders'], ['dev/emi/emi', 'EMI'], ['com/mrcrayfish/framework', 'Framework'], ['net/creeperhost/polylib', 'PolyLib'], ['com/github/alexthe666/citadel', 'Citadel'],
  ['mods/flammpfeil/slashblade', 'SlashBlade'], ['org/jetbrains/kotlin', 'Kotlin (Fabric Language Kotlin / Kotlin for Forge)'], ['kotlin', 'Kotlin (Fabric Language Kotlin / Kotlin for Forge)']];
const JAVA_OF = { 52: 8, 53: 9, 54: 10, 55: 11, 56: 12, 57: 13, 58: 14, 59: 15, 60: 16, 61: 17, 62: 18, 63: 19, 64: 20, 65: 21, 66: 22, 67: 23 };
const fnd = (level, code, title, detail = '', extra = {}) => ({ level, code, title, detail, files: [], ids: [], fix: '', ...extra });
const verOf = (v) => String(v || '').split(/[+\-_]/)[0];
const rowName = (r) => r.title || r.modId || r.name;

// ---------- 1. статический разбор ----------
function analyzeStatic(rows, inst, opts = {}) {
  const out = [], on = rows.filter((r) => r.enabled && /\.jar$/.test(r.name)), ids = new Map();
  for (const r of on) { if (r.modId) ids.set(r.modId, r); for (const p of r.provides || []) if (p && !ids.has(p)) ids.set(p, r); }
  const has = (id) => ids.has(id) || BUILTIN.test(id) || (/^fabric-.*-v\d+$|^fabric-[\w-]+$/.test(id) && (ids.has('fabric-api') || ids.has('fabric')));
  if (inst.loader === 'vanilla' && on.length) out.push(fnd('error', 'no-loader', 'В сборке нет загрузчика модов', `В папке mods ${on.length} модов, но сборка создана без Fabric/Forge/NeoForge — игра их не загрузит.`, { fix: 'loader' }));
  // дубликаты одного мода
  const by = new Map(); for (const r of on) if (r.modId) by.set(r.modId, [...(by.get(r.modId) || []), r]);
  for (const [id, L] of by) if (L.length > 1) out.push(fnd('error', 'duplicate', `Мод «${rowName(L[0])}» лежит в сборке дважды`, `Файлы: ${L.map((x) => x.name).join(', ')}. Оставьте одну версию — две копии одного мода не запускаются.`, { files: L.map((x) => x.name), ids: [id], fix: 'disable' }));
  // не тот загрузчик / не та версия Minecraft
  for (const r of on) {
    if (r.warn && /^Мод для /.test(r.warn)) out.push(fnd('error', 'wrong-loader', `«${rowName(r)}» — не для ${inst.loader}`, r.warn + '. Такой мод игра не загрузит и может упасть при запуске.', { files: [r.name], ids: [r.modId].filter(Boolean), fix: 'disable' }));
    else if (r.warn && /^Мод рассчитан на/.test(r.warn)) out.push(fnd('warn', 'wrong-mc', `«${rowName(r)}» может не подходить по версии игры`, r.warn + '.', { files: [r.name], ids: [r.modId].filter(Boolean), fix: 'disable' }));
    if (r.env === 'server') out.push(fnd('warn', 'server-only', `«${rowName(r)}» — серверный мод`, 'Автор отметил мод как серверный: на клиенте он обычно не нужен и может вызывать вылет.', { files: [r.name], ids: [r.modId].filter(Boolean), fix: 'disable' }));
  }
  // зависимости
  for (const r of on) for (const d of r.deps || []) {
    if (!d.id || BUILTIN.test(d.id) || !d.req) continue; const p = ids.get(d.id);
    if (!p && !has(d.id)) out.push(fnd(r.loose ? 'warn' : 'error', 'missing-dep', `«${rowName(r)}» требует мод «${d.id}», которого нет`, `Установите «${d.id}»${d.range ? ` (версия ${[].concat(d.range).join(' или ')})` : ''} — без него «${rowName(r)}» не запустится.`, { files: [r.name], ids: [d.id], fix: 'install', search: d.id }));
    else if (p && d.range && p.version && /^[\[(]|^[<>=~^]/.test(String([].concat(d.range)[0]))) { const ok = mcSatisfies(d.range, verOf(p.version)); if (ok === false) out.push(fnd('warn', 'dep-version', `«${rowName(r)}» ждёт другую версию «${rowName(p)}»`, `Нужна версия ${[].concat(d.range).join(' или ')}, установлена ${p.version}. Обновите или замените мод.`, { files: [r.name, p.name], ids: [d.id], fix: 'update', search: d.id })); }
  }
  // явные запреты (breaks/conflicts/incompatible)
  for (const r of on) for (const b of r.breaks || []) { const p = ids.get(b); if (p && p !== r) out.push(fnd('error', 'conflict', `«${rowName(r)}» несовместим с «${rowName(p)}»`, `Автор мода «${rowName(r)}» указал, что он ломается вместе с «${rowName(p)}». Уберите один из них.`, { files: [r.name, p.name], ids: [r.modId, b].filter(Boolean), fix: 'disable' })); }
  // известные пары
  const fn = (re) => on.filter((r) => re.test(r.name) || re.test(r.modId || ''));
  const opti = fn(/optifine/i), rival = fn(/^(sodium|iris|embeddium|rubidium|oculus|canvas|vulkanmod)|sodium|embeddium|rubidium|oculus/i).filter((r) => !opti.includes(r));
  if (opti.length && rival.length) out.push(fnd('error', 'optifine-clash', 'OptiFine конфликтует с Sodium/Iris/Embeddium', `OptiFine нельзя ставить вместе с ${[...new Set(rival.map(rowName))].slice(0, 4).join(', ')}: выберите что-то одно (Sodium + Iris заменяют OptiFine).`, { files: [...opti, ...rival].map((r) => r.name), fix: 'disable' }));
  if (on.length >= 250 && (opts.ram || 0) && opts.ram < 6144) out.push(fnd('warn', 'ram', `Много модов (${on.length}) при ${opts.ram} МБ памяти`, 'Для больших сборок обычно нужно 6–8 ГБ ОЗУ. Увеличьте память в Настройках, иначе игра может вылетать при загрузке.', { fix: 'ram' }));
  const rank = { error: 0, warn: 1, info: 2 }; return out.sort((a, b) => rank[a.level] - rank[b.level]);
}

// ---------- индекс классов: пакет → файл мода (нужен, чтобы по стеку вызовов найти виновника) ----------
async function classIndex(rows, modsDir) {
  const map = new Map();
  for (const r of rows.filter((x) => x.enabled && /\.jar$/.test(x.name))) {
    let fh; try { fh = await fs.promises.open(path.join(modsDir, r.name), 'r'); const ents = await zipIndex(fh, (await fh.stat()).size, 100000); const seen = new Set();
      for (const e of ents) { if (!e.name.endsWith('.class')) continue; const seg = e.name.split('/').slice(0, -1); for (const d of [4, 3]) if (seg.length >= d) { const k = seg.slice(0, d).join('/'); if (!seen.has(k)) { seen.add(k); if (!map.has(k)) map.set(k, r.name); } } } }
    catch {} finally { await fh?.close().catch(() => {}); } await new Promise((x) => setImmediate(x));
  }
  return map;
}
const fileOfClass = (cls, idx) => { const seg = String(cls).replace(/\./g, '/').split('/'); for (const d of [4, 3]) { const f = idx?.get(seg.slice(0, d).join('/')); if (f) return f; } return null; };

// ---------- 2. разбор лога ----------
function analyzeLog(text, ctx = {}) {
  const t = String(text || ''), out = [], rows = ctx.rows || [], idx = ctx.idx; const seen = new Set();
  const add = (f) => { const k = f.code + '|' + f.title + '|' + f.files.join(','); if (!seen.has(k)) { seen.add(k); out.push(f); } };
  const rowById = (id) => rows.find((r) => r.modId === id || (r.provides || []).includes(id)) || rows.find((r) => (r.title || '').toLowerCase() === String(id).toLowerCase());
  const filesOfIds = (L) => [...new Set(L.map(rowById).filter(Boolean).map((r) => r.name))];
  // память
  if (/java\.lang\.OutOfMemoryError|GC overhead limit exceeded|Java heap space/i.test(t)) add(fnd('error', 'oom', 'Не хватило оперативной памяти', `Игре выделено ${ctx.ram || '?'} МБ — этого мало для текущей сборки. Увеличьте ОЗУ в Настройках (для сборок с сотнями модов — 6–8 ГБ).`, { fix: 'ram' }));
  if (/Could not reserve enough space for (?:\d+KB )?object heap|Could not reserve enough space for object heap/i.test(t)) add(fnd('error', 'heap-reserve', 'Не удалось выделить память под игру', 'Выбрано больше ОЗУ, чем свободно сейчас, или установлена 32-битная Java. Уменьшите память в Настройках или закройте другие программы.', { fix: 'ram' }));
  if (/Initial heap size set to a larger value than the maximum heap size/i.test(t)) add(fnd('error', 'heap-args', 'Конфликт аргументов памяти', 'В «аргументах JVM» в Настройках задан -Xms больше, чем выделенная память. Удалите -Xms/-Xmx из аргументов.', { fix: 'jvm' }));
  for (const m of t.matchAll(/Unrecognized (?:VM )?option '?([^'\n]+?)'?(?:\n|$)/g)) add(fnd('error', 'jvm-arg', `Неверный аргумент JVM: ${m[1].trim()}`, 'Java не знает такой параметр. Откройте Настройки → Запуск игры и удалите или исправьте аргумент.', { fix: 'jvm' }));
  if (/Could not create the Java Virtual Machine|Error: Could not find or load main class|Invalid maximum heap size/i.test(t) && !seen.size) add(fnd('error', 'jvm', 'Java не смогла запустить игру', 'Проверьте «аргументы JVM» и путь к Java в Настройках; если менять нечего — переустановите версию игры.', { fix: 'jvm' }));
  // версия Java
  for (const m of t.matchAll(/([\w.$/]+) has been compiled by a more recent version of the Java Runtime \(class file version (\d+)\.\d+\), this version of the Java Runtime only recognizes class file versions up to (\d+)\.\d+/g)) {
    const need = JAVA_OF[+m[2]] || '?', have = JAVA_OF[+m[3]] || '?', f = fileOfClass(m[1], idx); add(fnd('error', 'java-version', `Нужна Java ${need}, а запущена Java ${have}`, `${f ? `Мод «${f}»` : `Класс ${m[1]}`} собран под Java ${need}. Укажите в Настройках путь к Java ${need}+ или уберите этот мод.`, { files: f ? [f] : [], fix: f ? 'disable' : 'java' })); }
  for (const m of t.matchAll(/Unsupported major\.minor version (\d+)\.\d+/g)) add(fnd('error', 'java-version', `Нужна Java ${JAVA_OF[+m[1]] || '?'} или новее`, 'Один из модов собран под более новую Java. Укажите подходящую Java в Настройках.', { fix: 'java' }));
  // Fabric / Quilt
  const fab = /Some of your mods are incompatible|Incompatible mods found|Mod resolution failed|Mod resolution encountered an incompatible mod set/i.test(t);
  if (fab) {
    const blocks = [...t.matchAll(/(?:Unmet dependency listing|More details|A potential solution has been determined[^\n]*|Mod resolution encountered an incompatible mod set!?)[:\s]*\n((?:[ \t]*(?:-|•|\*)[^\n]*\n?)+)/gi)].map((m) => m[1]);
    const lines = [...new Set(blocks.flatMap((b) => b.split('\n').map((l) => l.replace(/^[ \t]*[-•*]\s*/, '').trim()).filter(Boolean)))];
    for (const l of lines) {
      const req0 = /^(?:Mod )?'([^']+)' \(([\w.\-]+)\)\s+(\S+)?\s*(?:requires|depends on)\s+(.+)$/i.exec(l), req = req0 && [req0[0], req0[1], req0[2], req0[3], req0[4].replace(/,\s*which is.*$/i, '').replace(/\.$/, '').trim()], inst_ = /^Install ([\w.\-]+)(?:, (.+?))?\.?$/i.exec(l), rep = /^Replace mod '([^']+)' \(([\w.\-]+)\) (\S+) with (.+?)\.?$/i.exec(l), rem = /^Remove mod '([^']+)' \(([\w.\-]+)\)/i.exec(l);
      if (req) add(fnd('error', 'missing-dep', `«${req[1]}» не может запуститься`, `${req[1]} требует ${req[4]}.`, { files: filesOfIds([req[2]]), ids: [req[2]], fix: 'install', search: (/mod '[^']+' \(([\w.\-]+)\)/.exec(req[4]) || [])[1] || (/^(?:any version of |version [^ ]+ or later of )?(?:mod )?'?([\w.\-]+)/i.exec(req[4]) || [])[1] }));
      else if (inst_) add(fnd('error', 'missing-dep', `Нужно установить: ${inst_[1]}`, `Загрузчик подсказывает: «${l}».`, { ids: [inst_[1]], fix: 'install', search: inst_[1] }));
      else if (rep) add(fnd('error', 'replace-mod', `Замените «${rep[1]}»`, l, { files: filesOfIds([rep[2]]), ids: [rep[2]], fix: 'update', search: rep[2] }));
      else if (rem) add(fnd('error', 'remove-mod', `Уберите «${rem[1]}»`, `Загрузчик предлагает убрать мод «${rem[1]}» (${rem[2]}): он мешает остальным.`, { files: filesOfIds([rem[2]]), ids: [rem[2]], fix: 'disable' }));
    }
    if (![...out].some((x) => x.code === 'missing-dep' || x.code === 'replace-mod' || x.code === 'remove-mod')) add(fnd('error', 'incompatible-set', 'Загрузчик нашёл несовместимые моды', 'Fabric сообщает, что часть модов несовместима с игрой или друг с другом, но не назвал точно. Смотрите полный лог ниже.'));
  }
  for (const m of t.matchAll(/Duplicate mod(?:s)?[^\n]*?\b(?:ID|id)?\s*'?([\w.\-]+)'?[^\n]*\[([^\]]+)\]/g)) { const fl = m[2].split(/,\s*/).map((x) => path.basename(x.replace(/['"]/g, '')).trim()).filter(Boolean); add(fnd('error', 'duplicate', `Мод «${m[1]}» подключён дважды`, `Файлы: ${fl.join(', ')}. Оставьте одну копию.`, { files: fl.filter((f) => rows.some((r) => r.name === f)), ids: [m[1]], fix: 'disable' })); }
  for (const m of t.matchAll(/DuplicateModsFoundException: Found a duplicate mod (\S+) at \[([^\]]+)\]/g)) { const fl = m[2].split(/,\s*/).map((x) => path.basename(x.replace(/['"]/g, '')).trim()); add(fnd('error', 'duplicate', `Мод «${m[1]}» лежит в сборке дважды`, `Файлы: ${fl.join(', ')}.`, { files: fl, ids: [m[1]], fix: 'disable' })); }
  for (const m of t.matchAll(/Mod ID: '([^']+)', Requested by: '([^']+)', Expected range: '([^']*)', Actual version: '([^']*)'/g)) add(fnd('error', 'missing-dep', `«${m[2]}» требует мод «${m[1]}»`, `Нужна версия ${m[3]}, ${/^(unknown|missing)?$/i.test(m[4]) ? 'мод не установлен' : 'установлена ' + m[4]}.`, { files: filesOfIds([m[2]]), ids: [m[1], m[2]], fix: /^(unknown|missing)?$/i.test(m[4]) ? 'install' : 'update', search: m[1] }));
  for (const m of t.matchAll(/-- Mod loading issue for: ([\w.\-]+) --\s*\n(?:Details:\s*\n)?((?:[ \t]+[^\n]*\n)+)/g)) { const msg = (/Failure message: ([^\n]+)/.exec(m[2]) || [])[1] || m[2].trim().split('\n')[0]; add(fnd('error', 'mod-load', `Мод «${m[1]}» не загрузился`, msg.trim(), { files: filesOfIds([m[1]]), ids: [m[1]], fix: 'disable' })); }
  for (const m of t.matchAll(/Mod ([^()\n]+?) \((\w+)\) (?:requires|needs) \[?([^\]\n]+)/g)) add(fnd('error', 'missing-dep', `«${m[1].trim()}» требует ${m[3].trim()}`, '', { files: filesOfIds([m[2]]), ids: [m[2]], fix: 'install' }));
  // Mixin и точки входа
  const mix = new Set(); for (const re of [/Mixin apply for mod ([\w.\-]+) failed/g, /Mixin config ([\w.\-/]+?)\.mixins?\.json[^\n]*?from mod ([\w.\-]+)/g, /\[([\w.\-/]+)\.mixins?\.json:[\w.$]+ from mod ([\w.\-]+)\]/g, /from mod ([\w.\-]+)\]?/g]) for (const m of t.matchAll(re)) mix.add(m[m.length - 1]);
  for (const id of mix) { const f = filesOfIds([id]); add(fnd('error', 'mixin', `Ошибка Mixin в моде «${(rowById(id) && rowName(rowById(id))) || id}»`, 'Этот мод не смог внести изменения в код игры — чаще всего из-за конфликта с другим модом или неподходящей версии Minecraft/мода.', { files: f, ids: [id], fix: 'disable' })); }
  for (const m of t.matchAll(/Could not execute entrypoint stage '(\w+)' due to errors, provided by '([\w.\-]+)'/g)) add(fnd('error', 'entrypoint', `Мод «${m[2]}» упал при запуске (${m[1]})`, 'Ошибка внутри самого мода. Обновите его или отключите.', { files: filesOfIds([m[2]]), ids: [m[2]], fix: 'disable' }));
  for (const m of t.matchAll(/Caught exception from (?:mod )?([^\n(]+?)(?: \(([\w.\-]+)\))?\s*\n/g)) { const id = m[2] || m[1].trim(); add(fnd('error', 'mod-exception', `Мод «${m[1].trim()}» вызвал ошибку`, 'Forge перехватил исключение из этого мода.', { files: filesOfIds([id, m[1].trim()]), ids: [id], fix: 'disable' })); }
  const sus = /Suspected Mods?:\s*\n?((?:[ \t]+[^\n]+\n?)+)/i.exec(t); if (sus) for (const l of sus[1].split('\n')) { const m = /^\s*(.+?) \(([\w.\-]+)\)(?:, Version: (\S+))?/.exec(l); if (m && !/^none$/i.test(m[1].trim())) add(fnd('warn', 'suspect', `Подозреваемый мод: «${m[1].trim()}»`, 'Так указано в краш-репорте игры.', { files: filesOfIds([m[2], m[1].trim()]), ids: [m[2]], fix: 'disable' })); }
  // отсутствующие классы / методы
  for (const m of t.matchAll(/(?:NoClassDefFoundError|ClassNotFoundException)[:\s]+([\w./$]+)/g)) { const cls = m[1]; if (/^(java|javax|sun|jdk)[./]/.test(cls)) continue; const lib = LIBS.find(([p]) => cls.replace(/\./g, '/').startsWith(p)), own = fileOfClass(cls, idx);
    add(fnd('error', 'missing-class', `Не найден класс ${cls.split(/[./]/).slice(-1)[0]}`, lib ? `Не хватает библиотеки «${lib[1]}» (или её версия не подходит модам).` : own ? `Класс должен быть в «${own}», но не загрузился: мод сломан или не совпадает по версии.` : 'Какой-то мод ссылается на класс, которого нет: не хватает другого мода или версия не подходит.', { files: own ? [own] : [], fix: lib ? 'install' : 'update', search: lib ? lib[1] : undefined })); }
  for (const m of t.matchAll(/(?:NoSuchMethodError|NoSuchFieldError|AbstractMethodError|IncompatibleClassChangeError)[:\s]+([^\n]{3,120})/g)) { const cl = (/([\w$]+(?:\.[\w$]+){2,})/.exec(m[1]) || [])[1], f = cl && !VANILLA_PKG.test(cl) ? fileOfClass(cl, idx) : null; add(fnd('warn', 'api-mismatch', 'Несовпадение версий модов', `Один мод вызывает метод, которого нет в установленной версии другого: ${m[1].trim().slice(0, 100)}. Обычно помогает обновить мод и его библиотеки.`, { files: f ? [f] : [], fix: 'update' })); }
  // стек: кто чаще всего встречается среди первых строк
  if (idx && idx.size) { const cnt = new Map(); for (const m of t.matchAll(/^\s+at ([\w$.]+)\.[\w$<>]+\(/gm)) { const cls = m[1]; if (VANILLA_PKG.test(cls)) continue; const f = fileOfClass(cls, idx); if (f) cnt.set(f, (cnt.get(f) || 0) + 1); }
    for (const [f, n] of [...cnt].sort((a, b) => b[1] - a[1]).slice(0, 3)) if (n >= 2 && !out.some((x) => x.files.includes(f))) add(fnd('warn', 'stack', `Подозрение: «${(rows.find((r) => r.name === f) && rowName(rows.find((r) => r.name === f))) || f}»`, `Этот мод встречается в стеке ошибки (${n} раз).`, { files: [f], fix: 'disable' })); }
  // «Установите X» без привязки к моду не нужно, если ту же зависимость уже назвал конкретный мод
  return out.filter((f) => !(f.code === 'missing-dep' && !f.files.length && f.search && out.some((g) => g !== f && g.code === 'missing-dep' && g.files.length && g.search === f.search)));
}

// ---------- сводка ----------
async function analyzeFailure({ text, rows, inst, ram, modsDir, code }) {
  const idx = modsDir && /(?:^\s+at |NoClassDef|ClassNotFound|compiled by a more recent)/m.test(text || '') ? await classIndex(rows, modsDir) : null;
  const fromLog = analyzeLog(text, { rows, idx, ram }), fromStatic = analyzeStatic(rows, inst, { ram }), all = [...fromLog];
  for (const s of fromStatic) if (!all.some((x) => x.code === s.code && x.files.join() === s.files.join())) all.push(s); // находки из лога и из анализа сборки без повторов
  const rank = { error: 0, warn: 1, info: 2 }; all.sort((a, b) => rank[a.level] - rank[b.level]);
  if (!all.length) all.push(fnd('info', 'unknown', 'Причина не определена автоматически', `Игра завершилась с кодом ${code}. Откройте полный лог ниже: ищите строки «Caused by» и «ERROR». Если сборка большая — отключайте моды пачками (половину, потом ещё половину), чтобы найти виновника.`));
  return all;
}
module.exports = { analyzeStatic, analyzeLog, analyzeFailure, classIndex, fileOfClass, BUILTIN, JAVA_OF };
