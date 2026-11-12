// Файловый менеджер: все операции строго внутри папки данных лаунчера (проверка путей и симлинков)
const fs = require('fs'), path = require('path');
const BAD = /[<>:"/\\|?*\x00-\x1f]/, RES = /^(con|prn|aux|nul|com\d|lpt\d)(\..*)?$/i;
class FM {
  constructor(root) { this.root = path.resolve(root); }
  abs(rel) {
    const p = path.resolve(this.root, String(rel || '')), out = () => new Error('Путь вне папки лаунчера');
    if (p !== this.root && !p.startsWith(this.root + path.sep)) throw out();
    let q = p; while (!fs.existsSync(q) && q !== this.root) q = path.dirname(q);
    const rr = fs.realpathSync(this.root), rq = fs.realpathSync(q); if (rq !== rr && !rq.startsWith(rr + path.sep)) throw out(); // симлинк наружу
    return p;
  }
  name(n) { n = String(n || '').trim(); if (!n || n === '.' || n === '..' || n.length > 120 || BAD.test(n) || RES.test(n) || /[. ]$/.test(n)) throw new Error('Недопустимое имя'); return n; }
  // Сам элемент (в т.ч. симлинк) менять можно, но папка, в которой он лежит, обязана быть внутри лаунчера
  item(rel) {
    const p = path.resolve(this.root, String(rel || '')); if (p === this.root) throw new Error('Корневую папку лаунчера менять нельзя');
    if (!p.startsWith(this.root + path.sep)) throw new Error('Путь вне папки лаунчера');
    this.abs(path.relative(this.root, path.dirname(p))); return p;
  }
  unique(dir, name) { let t = path.join(dir, name); const e = path.extname(name), b = path.basename(name, e); for (let i = 2; fs.existsSync(t); i++) t = path.join(dir, `${b} (${i})${e}`); return t; }
  list(rel) {
    const d = this.abs(rel), out = [];
    for (const e of fs.readdirSync(d, { withFileTypes: true })) { let st; try { st = fs.lstatSync(path.join(d, e.name)); } catch { continue; }
      out.push({ name: e.name, dir: e.isDirectory(), size: e.isDirectory() ? null : st.size, mtime: st.mtimeMs, type: e.isDirectory() ? 'Папка' : (path.extname(e.name).slice(1).toUpperCase() || 'Файл') }); }
    return out.sort((a, b) => b.dir - a.dir || a.name.localeCompare(b.name));
  }
  mkdir(rel, name) { fs.mkdirSync(path.join(this.abs(rel), this.name(name))); }
  rename(rel, nn) { const p = this.item(rel), d = path.join(path.dirname(p), this.name(nn)); if (fs.existsSync(d)) throw new Error('Такое имя уже занято'); fs.renameSync(p, d); }
  dest(rel, to) { const s = this.item(rel), d = this.abs(to); if (!fs.statSync(d).isDirectory()) throw new Error('Назначение не папка'); if (d === s || d.startsWith(s + path.sep)) throw new Error('Нельзя поместить папку в саму себя'); return [s, d]; }
  copy(rel, to) { const [s, d] = this.dest(rel, to); fs.cpSync(s, this.unique(d, path.basename(s)), { recursive: true }); }
  move(rel, to) { const [s, d] = this.dest(rel, to), t = this.unique(d, path.basename(s)); try { fs.renameSync(s, t); } catch (e) { if (e.code !== 'EXDEV') throw e; fs.cpSync(s, t, { recursive: true }); fs.rmSync(s, { recursive: true, force: true }); } }
  remove(rel) { fs.rmSync(this.item(rel), { recursive: true, force: true }); }
  add(to, paths) { const d = this.abs(to); let n = 0; for (const p of paths) { if (!fs.existsSync(p)) continue; fs.cpSync(p, this.unique(d, path.basename(p)), { recursive: true }); n++; } return n; }
}
module.exports = FM;
