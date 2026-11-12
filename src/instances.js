// Сборки (instances): у каждой своя папка игры с mods/resourcepacks/shaderpacks, изолированная от остальных.
const fs = require('fs'), path = require('path'), crypto = require('crypto');
const KINDS = ['mods', 'resourcepacks', 'shaderpacks', 'saves'];
const SNAPK = KINDS.filter((k) => k !== 'saves').concat(['config', 'options.txt']); // миры в точки восстановления не копируем
const { mcSatisfies, packProblem, worldVersion, cmp } = require('./compat');
const dirSize = (d) => { let n = 0; try { for (const e of fs.readdirSync(d, { withFileTypes: true })) { const p = path.join(d, e.name); n += e.isDirectory() ? dirSize(p) : fs.statSync(p).size; } } catch {} return n; };
const rx = (t, r) => (t.match(r) || [])[1];
const RES = /^(con|prn|aux|nul|com\d|lpt\d)(\..*)?$/i; // имена устройств Windows
function jarInfo(f) {
  try {
    if (fs.statSync(f).size > 400 * 1048576) return {}; // огромные архивы не разбираем
    const z = new (require('adm-zip'))(f); let e; const big = (x) => (x.header?.size || 0) > 4 * 1048576; // метаданные мода не бывают мегабайтными: так отсекаем zip-бомбы
    for (const n of ['fabric.mod.json', 'quilt.mod.json', 'META-INF/neoforge.mods.toml', 'META-INF/mods.toml', 'mcmod.info']) { const x = z.getEntry(n); if (x && big(x)) return {}; }
    if ((e = z.getEntry('fabric.mod.json'))) { const j = JSON.parse(z.readAsText(e)); return { loader: 'fabric', id: j.id, title: j.name || j.id, version: j.version, mc: j.depends?.minecraft }; }
    if ((e = z.getEntry('quilt.mod.json'))) { const j = JSON.parse(z.readAsText(e)).quilt_loader || {}, d = [].concat(j.depends || []).find((x) => x && x.id === 'minecraft'); return { loader: 'quilt', id: j.id, title: j.metadata?.name || j.id, version: j.version, mc: d?.versions }; }
    for (const [ent, loader] of [['META-INF/neoforge.mods.toml', 'neoforge'], ['META-INF/mods.toml', 'forge']]) if ((e = z.getEntry(ent))) { const t = z.readAsText(e), blk = t.split(/\[\[dependencies\./).slice(1).find((x) => /modId\s*=\s*"minecraft"/.test(x));
      return { loader, id: rx(t, /modId\s*=\s*"([^"]+)"/), title: rx(t, /displayName\s*=\s*"([^"]+)"/), version: rx(t, /^version\s*=\s*"([^"]+)"/m), mc: blk ? rx(blk, /versionRange\s*=\s*"([^"]+)"/) : undefined }; }
    if ((e = z.getEntry('mcmod.info'))) { let j = {}; try { j = JSON.parse(z.readAsText(e)); } catch {} const m = (Array.isArray(j) ? j[0] : j.modList?.[0]) || {}; return { loader: 'forge', id: m.modid, title: m.name || m.modid, version: m.version, mc: m.mcversion }; }
  } catch {}
  return {};
}
class Instances {
  constructor(root, file) { this.root = root; this.file = file; }
  all() { try { return JSON.parse(fs.readFileSync(this.file, 'utf8')); } catch { return []; } }
  save(a) { fs.mkdirSync(path.dirname(this.file), { recursive: true }); const t = this.file + '.tmp'; fs.writeFileSync(t, JSON.stringify(a, null, 1)); fs.renameSync(t, this.file); }
  get(id) { return this.all().find((i) => i.id === id); }
  need(id) { const i = this.get(id); if (!i) throw new Error('Сборка не найдена'); return i; }
  dir(i) { if (!/^[0-9a-f]{12}$/.test(String(i?.id))) throw new Error('Повреждённая запись сборки'); return path.join(this.root, i.id); }
  folder(i, kind) {
    if (kind === 'archive') { const a = path.join(this.dir(i), 'mods-archive'); fs.mkdirSync(a, { recursive: true }); return a; } // вне mods: игра эти файлы не загружает
    if (!KINDS.includes(kind)) throw new Error('Неизвестный раздел'); return path.join(this.dir(i), kind);
  }
  create({ name, mc, loader, loaderVersion }) {
    name = String(name || '').replace(/[\u0000-\u001f\u202a-\u202e]/g, '').trim().slice(0, 40); if (!name) throw new Error('Введите название сборки'); // управляющие и bidi-символы в названии не нужны
    if (!/^(?!\.)(?!.*\.\.)[\w. +-]{1,40}$/.test(String(mc))) throw new Error('Неверная версия Minecraft');
    if (!['vanilla', 'fabric', 'forge', 'neoforge'].includes(loader)) throw new Error('Загрузчик не поддерживается');
    const i = { id: crypto.randomBytes(6).toString('hex'), name, mc: String(mc), loader, loaderVersion: loaderVersion || '' };
    for (const k of KINDS) fs.mkdirSync(path.join(this.dir(i), k), { recursive: true });
    this.save([...this.all(), i]); return i;
  }
  copy(id) {
    const s = this.need(id), i = { ...s, id: crypto.randomBytes(6).toString('hex'), name: (s.name + ' (копия)').slice(0, 40) };
    fs.cpSync(this.dir(s), this.dir(i), { recursive: true }); this.save([...this.all(), i]); return i;
  }
  remove(id) { const i = this.need(id); fs.rmSync(this.dir(i), { recursive: true, force: true }); fs.rmSync(this.snapDir(i), { recursive: true, force: true }); this.save(this.all().filter((x) => x.id !== id)); }
  list(id, kind) {
    const i = this.need(id), d = this.folder(i, kind), rows = [];
    for (const e of fs.readdirSync(d, { withFileTypes: true })) {
      const p = path.join(d, e.name), row = { name: e.name, enabled: !e.name.endsWith('.disabled'), isDir: e.isDirectory(), size: e.isDirectory() ? dirSize(p) : fs.statSync(p).size };
      if ((kind === 'mods' || kind === 'archive') && /\.jar(\.disabled)?$/.test(e.name)) {
        const m = jarInfo(p); Object.assign(row, { title: m.title, version: m.version, modId: m.id, loader: m.loader });
        if (kind === 'archive') { rows.push(row); continue; }
        const mcw = () => { if (!row.warn && m.mc && mcSatisfies(m.mc, i.mc) === false) row.warn = 'Мод рассчитан на Minecraft ' + [].concat(m.mc).join(' или ') + ', а сборка на ' + i.mc; };
        if (i.loader === 'vanilla') row.warn = 'Vanilla не загружает моды';
        else if (m.loader && m.loader !== i.loader && !(m.loader === 'quilt' && i.loader === 'fabric')) row.warn = `Мод для ${m.loader}, а в сборке ${i.loader}`;
        mcw();
      }
      rows.push(row);
    }
    const cnt = {}; rows.forEach((r) => r.enabled && r.modId && (cnt[r.modId] = (cnt[r.modId] || 0) + 1));
    rows.forEach((r) => { if (r.enabled && cnt[r.modId] > 1) r.warn = (r.warn ? r.warn + '; ' : '') + 'Дубликат мода (конфликт)'; });
    return rows.sort((a, b) => a.name.localeCompare(b.name));
  }
  // Что не подходит сборке: версия Minecraft у мода/ресурс-пака/мира, загрузчик мода. Пустой список — всё в порядке.
  checkCompat(id, kind, paths) {
    const inst = this.need(id), out = [], mc = inst.mc, expected = require('./skinpack').packFormat(mc);
    for (const p of paths) { const name = path.basename(String(p)); let msg = null;
      if (kind === 'mods' && /\.jar$/i.test(name)) { const m = jarInfo(p), t = m.title || name;
        if (inst.loader !== 'vanilla' && m.loader && m.loader !== inst.loader && !(m.loader === 'quilt' && inst.loader === 'fabric')) msg = `Мод «${t}» сделан для ${m.loader}, а в сборке ${inst.loader}.`;
        else if (m.mc != null && mcSatisfies(m.mc, mc) === false) msg = `Мод «${t}» рассчитан на Minecraft ${[].concat(m.mc).join(' или ')}, а сборка на ${mc}.`; }
      else if (kind === 'resourcepacks') msg = packProblem(p, mc, expected);
      else if (kind === 'saves') { const v = worldVersion(p); if (v && cmp(v, mc) > 0) msg = `Мир «${name}» создан в Minecraft ${v}, а сборка на ${mc}: более новый мир старая версия не откроет.`; }
      if (msg) out.push({ name, msg }); }
    return out;
  }
  add(id, kind, paths) {
    if (kind === 'archive') throw new Error('В архив моды переносятся кнопкой «В архив»');
    const d = this.folder(this.need(id), kind), bad = []; let n = 0;
    for (const p of paths) {
      const name = path.basename(String(p)); let st; try { st = fs.statSync(p); } catch { bad.push(name + ' (нет доступа)'); continue; }
      if (name.startsWith('.') || RES.test(name) || /[:*?"<>|\u0000]/.test(name)) { bad.push(name + ' (недопустимое имя)'); continue; }
      if (kind === 'saves' && st.isFile() && /\.zip$/i.test(name)) { try { require('./catalog').extractWorld(p, d, name); n++; } catch (e) { bad.push(name + ' (' + e.message + ')'); } continue; } // zip с картой распаковываем
      const ok = kind === 'mods' ? st.isFile() && /\.jar$/i.test(name) : st.isDirectory() || /\.zip$/i.test(name);
      if (!ok) { bad.push(name + (kind === 'mods' ? ' (нужен .jar)' : ' (нужен .zip или папка)')); continue; }
      const dest = path.join(d, name); if (fs.existsSync(dest)) { bad.push(name + ' (уже есть)'); continue; }
      fs.cpSync(p, dest, { recursive: true }); n++;
    }
    if (bad.length) throw new Error(`Добавлено: ${n}. Пропущено: ${bad.join('; ')}`);
    return n;
  }
  neededLoader(paths) { for (const p of paths) if (/\.jar$/i.test(p)) { const l = jarInfo(p).loader; if (['fabric', 'forge', 'neoforge'].includes(l)) return l; } return null; }
  setLoader(id, loader, lv) {
    if (!['fabric', 'forge', 'neoforge'].includes(loader) || !/^[\w.+-]+$/.test(lv)) throw new Error('Неверный загрузчик');
    const all = this.all(), i = all.find((x) => x.id === id); if (!i || i.loader !== 'vanilla') throw new Error('Загрузчик можно добавить только в сборку Vanilla');
    i.loader = loader; i.loaderVersion = lv; this.save(all);
  }
  archive(id, name) { const s = this.safe(id, 'mods', name), t = path.join(this.folder(this.need(id), 'archive'), name); if (fs.existsSync(t)) throw new Error('В архиве уже есть такой файл'); fs.renameSync(s, t); }
  unarchive(id, name) { const s = this.safe(id, 'archive', name), t = path.join(this.folder(this.need(id), 'mods'), name); if (fs.existsSync(t)) throw new Error('В сборке уже есть такой мод'); fs.renameSync(s, t); }
  // Точки восстановления: mods/resourcepacks/shaderpacks/config/options.txt (миры не копируем — они большие)
  snapDir(i) { return path.join(path.dirname(this.root), 'snapshots', i.id); }
  snapshot(id, label) {
    const i = this.need(id), sid = String(Date.now()), dest = path.join(this.snapDir(i), sid); fs.mkdirSync(dest, { recursive: true });
    for (const k of SNAPK) { const s = path.join(this.dir(i), k); if (fs.existsSync(s)) fs.cpSync(s, path.join(dest, k), { recursive: true }); }
    let mods = 0; try { mods = fs.readdirSync(path.join(dest, 'mods')).length; } catch {}
    fs.writeFileSync(path.join(dest, '.meta.json'), JSON.stringify({ label: String(label || 'Точка восстановления').slice(0, 60), time: Date.now(), mods }));
    for (const old of this.snapshots(id).slice(8)) fs.rmSync(path.join(this.snapDir(i), old.id), { recursive: true, force: true }); // храним 8 последних
    return sid;
  }
  snapshots(id) {
    const i = this.need(id), d = this.snapDir(i); let out = [];
    try { out = fs.readdirSync(d).filter((n) => /^\d{13}$/.test(n)).map((n) => { try { return { id: n, ...JSON.parse(fs.readFileSync(path.join(d, n, '.meta.json'), 'utf8')) }; } catch { return { id: n, label: '?', time: +n, mods: 0 }; } }); } catch {}
    return out.sort((a, b) => b.time - a.time);
  }
  restore(id, sid) {
    const i = this.need(id), src = path.join(this.snapDir(i), String(sid)); if (!/^\d{13}$/.test(String(sid)) || !fs.existsSync(src)) throw new Error('Точка восстановления не найдена');
    this.snapshot(id, 'Перед восстановлением'); // откат сам обратим
    const tmp = path.join(this.snapDir(i), '.restore-' + Date.now()); fs.mkdirSync(tmp, { recursive: true });
    try { for (const k of SNAPK) { const s = path.join(src, k); if (fs.existsSync(s)) fs.cpSync(s, path.join(tmp, k), { recursive: true }); } } catch (e) { fs.rmSync(tmp, { recursive: true, force: true }); throw new Error('Не удалось прочитать точку восстановления: ' + e.message); } // сбой (например, нет места) — текущие файлы не тронуты
    for (const k of SNAPK) { const t = path.join(this.dir(i), k); fs.rmSync(t, { recursive: true, force: true }); const s = path.join(tmp, k); if (fs.existsSync(s)) fs.renameSync(s, t); else if (KINDS.includes(k)) fs.mkdirSync(t, { recursive: true }); }
    fs.rmSync(tmp, { recursive: true, force: true });
  }
  delSnapshot(id, sid) { const i = this.need(id); if (!/^\d{13}$/.test(String(sid))) throw new Error('Неверный id'); fs.rmSync(path.join(this.snapDir(i), String(sid)), { recursive: true, force: true }); }
  safe(id, kind, name) { const d = this.folder(this.need(id), kind); if (typeof name !== 'string' || path.basename(name) !== name || name.startsWith('.') || /[\\/:*?"<>|\u0000]/.test(name) || RES.test(name)) throw new Error('Недопустимое имя'); return path.join(d, name); }
  removeFile(id, kind, name) { fs.rmSync(this.safe(id, kind, name), { recursive: true, force: true }); }
  toggle(id, name) {
    if (!/\.jar(\.disabled)?$/.test(name)) throw new Error('Это не мод');
    const p = this.safe(id, 'mods', name); fs.renameSync(p, name.endsWith('.disabled') ? p.slice(0, -9) : p + '.disabled');
  }
}
module.exports = Instances;
