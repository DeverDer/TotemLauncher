'use strict';
// Журнал последних ошибок (запуск игры, установка): хранится в errors.json, не больше 40 записей.
const fs = require('fs'), path = require('path'), crypto = require('crypto');
const MAX = 40, RAW = 24000;
class ErrLog {
  constructor(file) { this.file = file; }
  list() { try { const j = JSON.parse(fs.readFileSync(this.file, 'utf8')); return Array.isArray(j) ? j : []; } catch { return []; } }
  save(a) { fs.mkdirSync(path.dirname(this.file), { recursive: true }); const t = this.file + '.tmp'; fs.writeFileSync(t, JSON.stringify(a)); fs.renameSync(t, this.file); }
  add(e) {
    const rec = { id: crypto.randomBytes(5).toString('hex'), time: Date.now(), kind: String(e.kind || 'launch'), title: String(e.title || 'Ошибка').slice(0, 200), message: String(e.message || '').slice(0, 2000),
      build: e.build ? { id: String(e.build.id || ''), name: String(e.build.name || '').slice(0, 60), mc: String(e.build.mc || ''), loader: String(e.build.loader || '') } : null,
      findings: Array.isArray(e.findings) ? e.findings.slice(0, 40) : [], raw: String(e.raw || '').slice(-RAW) };
    this.save([rec, ...this.list()].slice(0, MAX)); return rec;
  }
  remove(id) { this.save(this.list().filter((x) => x.id !== id)); }
  clear() { this.save([]); }
}
module.exports = ErrLog;
