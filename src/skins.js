const fs = require('fs'), path = require('path'), crypto = require('crypto');
class Skins {
  constructor(dir) { this.dir = dir; this.idx = path.join(dir, 'skins.json'); }
  all() { try { return JSON.parse(fs.readFileSync(this.idx, 'utf8')); } catch { return []; } }
  save(a) { fs.mkdirSync(this.dir, { recursive: true }); fs.writeFileSync(this.idx, JSON.stringify(a)); }
  list() { return this.all().map((s) => { try { return { ...s, png: fs.readFileSync(path.join(this.dir, s.id + '.png')).toString('base64') }; } catch { return null; } }).filter(Boolean); }
  static check(b) { // только настоящий PNG 64x64: повреждённые файлы не сохраняем
    if (b.length < 33 || b.length > 1 << 20 || b.readUInt32BE(0) !== 0x89504e47 || b.toString('ascii', 12, 16) !== 'IHDR') throw new Error('Это не PNG-файл');
    const w = b.readUInt32BE(16), h = b.readUInt32BE(20); if (w !== 64 || h !== 64) throw new Error(`Нужен скин 64×64, а размер файла ${w}×${h} (старый формат 64×32 не поддерживается)`);
  }
  static sniff(b) { // формат определяем по сигнатуре, а не по расширению
    const t = (o, a) => a.every((v, k) => b[o + k] === v);
    if (t(0, [0x89, 0x50, 0x4e, 0x47])) return 'image/png'; if (t(0, [0xff, 0xd8, 0xff])) return 'image/jpeg'; if (t(0, [0x47, 0x49, 0x46, 0x38])) return 'image/gif';
    if (t(0, [0x42, 0x4d])) return 'image/bmp'; if (t(0, [0x52, 0x49, 0x46, 0x46]) && t(8, [0x57, 0x45, 0x42, 0x50])) return 'image/webp';
    throw new Error('Неподдерживаемый формат: нужен PNG, JPG, WebP, GIF или BMP');
  }
  static readImage(p) { if (fs.statSync(p).size > 8 << 20) throw new Error('Файл больше 8 МБ'); const b = fs.readFileSync(p); return { mime: Skins.sniff(b), data: b.toString('base64') }; }
  static read(p) { if (fs.statSync(p).size > 1 << 20) throw new Error('Файл слишком большой'); const b = fs.readFileSync(p); Skins.check(b); return b; }
  put({ id, name, model, data, from }) {
    const b = Buffer.from(String(data), 'base64'); Skins.check(b);
    name = String(name || '').trim().slice(0, 40) || 'Скин'; model = model === 'slim' ? 'slim' : 'classic';
    const all = this.all(); let e = /^[0-9a-f]{12}$/.test(id || '') ? all.find((s) => s.id === id) : null;
    if (!e) { e = { id: crypto.randomBytes(6).toString('hex') }; all.push(e); }
    Object.assign(e, { name, model }); if (/^[A-Za-z0-9_-]{1,40}$/.test(String(from || '')) && !e.from) e.from = String(from); fs.mkdirSync(this.dir, { recursive: true }); fs.writeFileSync(path.join(this.dir, e.id + '.png'), b); this.save(all); return e;
  }
  remove(id) { if (!/^[0-9a-f]{12}$/.test(id)) throw new Error('Неверный id'); try { fs.unlinkSync(path.join(this.dir, id + '.png')); } catch {} this.save(this.all().filter((s) => s.id !== id)); }
}
module.exports = Skins;
