// Скриншоты Minecraft: список по всем папкам игры лаунчера, безопасные операции только внутри них
const fs = require('fs'), path = require('path');
const EXT = /\.(png|jpe?g)$/i, BAD = /[<>:"/\\|?*\x00-\x1f]/, RES = /^(con|prn|aux|nul|com\d|lpt\d)(\..*)?$/i;
class Shots {
  constructor(root, instances) { this.root = path.resolve(root); this.inst = instances; }
  dirs() { return [{ rel: 'minecraft/game/screenshots', label: 'Ванилла' }, ...this.inst.all().map((i) => ({ rel: `instances/${i.id}/screenshots`, label: i.name }))]; }
  list() {
    const out = [];
    for (const d of this.dirs()) { let es = []; try { es = fs.readdirSync(path.join(this.root, d.rel), { withFileTypes: true }); } catch { continue; }
      for (const e of es) { if (!e.isFile() || !EXT.test(e.name)) continue; let st; try { st = fs.statSync(path.join(this.root, d.rel, e.name)); } catch { continue; } out.push({ rel: `${d.rel}/${e.name}`, name: e.name, src: d.label, mtime: st.mtimeMs, size: st.size }); } }
    return out.sort((a, b) => b.mtime - a.mtime);
  }
  abs(rel) {
    rel = String(rel); const ok = this.dirs().some((d) => rel.startsWith(d.rel + '/') && !rel.slice(d.rel.length + 1).includes('/') && !rel.includes('..') && EXT.test(rel));
    const p = path.resolve(this.root, rel); if (!ok || !p.startsWith(this.root + path.sep)) throw new Error('Недопустимый файл'); return p;
  }
  rename(rel, nn) {
    const p = this.abs(rel); nn = String(nn || '').trim(); if (!nn || nn === '.' || nn === '..' || nn.length > 120 || BAD.test(nn) || RES.test(nn) || /[. ]$/.test(nn)) throw new Error('Недопустимое имя');
    if (!EXT.test(nn)) nn += path.extname(p); const d = path.join(path.dirname(p), nn); if (fs.existsSync(d)) throw new Error('Такое имя уже занято'); fs.renameSync(p, d);
  }
}
module.exports = Shots;
