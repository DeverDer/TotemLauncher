// Проверка папки mods до запуска игры: у каждого мода есть обязательные зависимости? не стоят ли два взаимоисключающих мода?
// подходит ли мод версии Minecraft? Читаются метаданные jar (fabric.mod.json, META-INF/mods.toml, neoforge.mods.toml), включая вложенные jar
// (Fabric «jars», Forge/NeoForge JarJar): то, что поставляется внутри другого мода, считается установленным.
'use strict';
const fs = require('fs'), path = require('path');
const { mcSatisfies } = require('./compat');
const BUILTIN = new Set(['minecraft', 'java', 'forge', 'neoforge', 'fml', 'javafml', 'lowcodefml', 'mclanguage', 'fabricloader', 'fabric-loader', 'fabric_loader', 'quilt_loader', 'quilt-loader']);
const small = (e) => (e.header?.size || 0) <= 4 * 1048576;
const rx = (t, r) => (t.match(r) || [])[1];

function readJar(z, depth, out) { // z — AdmZip; out: { ids:Set, deps:[], breaks:[], mc:[] }
  const AdmZip = require('adm-zip'); let e;
  if ((e = z.getEntry('fabric.mod.json')) && small(e)) {
    let j; try { j = JSON.parse(z.readAsText(e)); } catch { j = null; }
    if (j && j.id) {
      out.ids.add(String(j.id).toLowerCase()); for (const p of [].concat(j.provides || [])) out.ids.add(String(typeof p === 'object' ? p.id : p).toLowerCase());
      if (depth === 0) { out.main = { id: String(j.id).toLowerCase(), title: j.name || j.id, loader: 'fabric' };
        for (const [id, range] of Object.entries(j.depends || {})) { if (String(id).toLowerCase() === 'minecraft') out.mc.push(range); else out.deps.push({ id: String(id).toLowerCase(), range }); }
        for (const [id, range] of Object.entries(j.breaks || {})) if (range === '*' || (Array.isArray(range) && range.includes('*'))) out.breaks.push(String(id).toLowerCase()); }
      if (depth < 2) for (const n of [].concat(j.jars || [])) { const ne = n && z.getEntry(String(n.file || '')); if (ne && ne.header.size < 64 * 1048576) { try { readJar(new AdmZip(ne.getData()), depth + 1, out); } catch {} } }
    }
  }
  for (const ent of ['META-INF/neoforge.mods.toml', 'META-INF/mods.toml']) if ((e = z.getEntry(ent)) && small(e)) {
    const t = z.readAsText(e), neo = ent.includes('neoforge'), own = [];
    for (const blk of t.split(/\[\[mods\]\]/).slice(1)) { const id = rx(blk.split(/\n\s*\[\[/)[0], /modId\s*=\s*"([^"]+)"/); if (id) { out.ids.add(id.toLowerCase()); own.push(id.toLowerCase()); } }
    if (depth === 0 && own.length) {
      out.main = { id: own[0], title: rx(t, /displayName\s*=\s*"([^"]+)"/) || own[0], loader: neo ? 'neoforge' : 'forge' };
      for (const m of t.split(/\[\[dependencies\.([\w.\-]+)\]\]/).slice(1).reduce((a, x, i, all) => (i % 2 === 0 ? a.concat([[x, all[i + 1]]]) : a), [])) {
        const body = m[1].split(/\n\s*\[\[/)[0], id = (rx(body, /modId\s*=\s*"([^"]+)"/) || '').toLowerCase(), type = rx(body, /type\s*=\s*"([^"]+)"/), mand = rx(body, /mandatory\s*=\s*(true|false)/), side = rx(body, /side\s*=\s*"([^"]+)"/);
        if (!id || /^SERVER$/i.test(side || '')) continue;
        if (id === 'minecraft') { const r = rx(body, /versionRange\s*=\s*"([^"]+)"/); if (r && (type ? /required/i.test(type) : mand !== 'false')) out.mc.push(r); continue; }
        if (type ? /required/i.test(type) : mand === 'true') out.deps.push({ id, range: rx(body, /versionRange\s*=\s*"([^"]+)"/) || '' });
        else if (/incompatible|discouraged/i.test(type || '') && /incompatible/i.test(type)) out.breaks.push(id);
      }
    }
    if (depth < 2) for (const n of z.getEntries()) if (/^META-INF\/jarjar\/[^/]+\.jar$/.test(n.entryName) && n.header.size < 64 * 1048576) { try { readJar(new AdmZip(n.getData()), depth + 1, out); } catch {} }
  }
}
function scanMods(modsDir) { // [{ file, main, ids, deps, breaks, mc }] по включённым jar
  const AdmZip = require('adm-zip'), rows = []; let names = []; try { names = fs.readdirSync(modsDir); } catch { return rows; }
  for (const f of names.sort()) {
    if (!/\.jar$/i.test(f)) continue; const p = path.join(modsDir, f); try { if (fs.statSync(p).size > 400 * 1048576) continue; } catch { continue; }
    const out = { file: f, ids: new Set(), deps: [], breaks: [], mc: [], main: null }; try { readJar(new AdmZip(p), 0, out); } catch { continue; }
    if (out.main) rows.push(out);
  }
  return rows;
}
// → { missing: [{ id, by: [названия] }], conflicts: [{ file, title, with }], wrongMc: [{ file, title, mc }], count }
function check(modsDir, { mc = '' } = {}) {
  const rows = scanMods(modsDir), have = new Set(); rows.forEach((r) => r.ids.forEach((i) => have.add(i)));
  const miss = new Map(), conflicts = [], wrongMc = [];
  for (const r of rows) {
    for (const d of r.deps) if (!BUILTIN.has(d.id) && !have.has(d.id)) { const e = miss.get(d.id) || { id: d.id, by: [], files: [] }; if (!e.by.includes(r.main.title)) e.by.push(r.main.title); e.files.push(r.file); miss.set(d.id, e); }
    for (const b of r.breaks) if (have.has(b) && !r.ids.has(b)) conflicts.push({ file: r.file, title: r.main.title, with: b });
    if (mc) for (const rg of r.mc) if (mcSatisfies(rg, mc) === false) { wrongMc.push({ file: r.file, title: r.main.title, mc: String(rg) }); break; }
  }
  return { missing: [...miss.values()], conflicts, wrongMc, count: rows.length };
}
const off = (modsDir, file) => { try { fs.renameSync(path.join(modsDir, file), path.join(modsDir, file + '.disabled')); return true; } catch { return false; } };
// Исправление: недостающие моды ставим с Modrinth (до двух кругов — у найденных свои зависимости), чего не нашли — отключаем вместе с модами, которым они нужны
// Cat.installDeps(ids, {mc, loader}, dir, cb, signal)
async function repair({ dir, mc, loader, Cat, cb = () => {}, signal }) {
  const modsDir = path.join(dir, 'mods'), added = [], disabled = []; let r = check(modsDir, { mc });
  for (let round = 0; round < 2 && r.missing.length; round++) {
    let res; try { res = await Cat.installDeps(r.missing.map((x) => x.id), { mc, loader }, dir, cb, signal); } catch (e) { if (signal?.aborted || e?.message === 'cancelled') throw e; break; }
    added.push(...(res.installed || [])); r = check(modsDir, { mc }); if (!res.installed?.length) break;
  }
  for (const m of r.missing) for (const f of m.files) if (off(modsDir, f)) disabled.push({ title: m.by[0], why: `нужен мод «${m.id}», которого нет в каталоге` });
  r = check(modsDir, { mc });
  for (const w of r.wrongMc) if (off(modsDir, w.file)) disabled.push({ title: w.title, why: `рассчитан на Minecraft ${w.mc}` });
  r = check(modsDir, { mc });
  for (const c of r.conflicts) if (off(modsDir, c.file)) disabled.push({ title: c.title, why: `несовместим с модом «${c.with}»` });
  // отключили мод — могли остаться без хозяина его собственные зависимости, это не страшно; а вот цепочка «нужен отключённому» не возникает: зависимости только добавляют файлы
  const again = check(modsDir, { mc }); for (const m of again.missing) for (const f of m.files) if (off(modsDir, f)) disabled.push({ title: m.by[0], why: `нужен мод «${m.id}»` });
  return { added, disabled };
}
module.exports = { check, repair, scanMods };
