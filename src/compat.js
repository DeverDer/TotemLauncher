// Совместимость добавляемых файлов со сборкой: диапазоны версий модов, формат ресурс-пака, версия мира
'use strict';
const fs = require('fs'), path = require('path'), zlib = require('zlib');
const num = (v) => { const n = String(v).trim().split('.').map((x) => (/^\d+$/.test(x) ? +x : NaN)); return n.length && !n.some(Number.isNaN) ? n : null; };
const cmp = (a, b) => { const x = num(a), y = num(b); if (!x || !y) return null; for (let i = 0; i < Math.max(x.length, y.length); i++) { const d = (x[i] || 0) - (y[i] || 0); if (d) return d < 0 ? -1 : 1; } return 0; };
const prefix = (v, base) => { const x = num(v), y = num(base); return !!x && !!y && y.every((n, i) => x[i] === n); };
function maven(r, mc) { // [1.20,1.21), (,1.19], [1.20.1]; голая версия = «не ниже»
  const re = /([\[(])\s*([^,\])]*?)\s*(?:(,)\s*([^,\])]*?)\s*)?([\])])/g; let m, any = false, parsed = false;
  while ((m = re.exec(r))) { parsed = true; const [, lo, a, comma, b, hi] = m; let ok = true;
    if (!comma) { const c = cmp(mc, a); if (c === null) return null; ok = c === 0; }
    else { if (a) { const c = cmp(mc, a); if (c === null) return null; ok = ok && (lo === '[' ? c >= 0 : c > 0); } if (b) { const c = cmp(mc, b); if (c === null) return null; ok = ok && (hi === ']' ? c <= 0 : c < 0); } }
    if (ok) any = true; }
  if (parsed) return any; const c = cmp(mc, String(r).trim()); return c === null ? null : c >= 0;
}
function semverTok(t, mc) {
  t = t.trim(); if (!t || t === '*' || /^[xX]$/.test(t)) return true;
  const m = /^(>=|<=|>|<|=|~|\^)?\s*v?(\d+(?:\.\d+)*)(\.[xX*])?$/.exec(t); if (!m) return null; const [, op, v, wild] = m, c = cmp(mc, v); if (c === null) return null;
  if (!op || op === '=') return wild ? prefix(mc, v) : c === 0;
  if (op === '>=') return c >= 0; if (op === '>') return c > 0; if (op === '<=') return c <= 0; if (op === '<') return c < 0;
  const p = num(v), up = op === '~' ? (p.length >= 2 ? [p[0], p[1] + 1] : [p[0] + 1]) : [p[0] + 1]; return c >= 0 && cmp(mc, up.join('.')) < 0;
}
function semver(r, mc) { let unk = false;
  for (const alt of String(r).split('||')) { const toks = alt.trim().replace(/(>=|<=|>|<|=|~|\^)\s+/g, '$1').split(/\s+/).filter(Boolean); let ok = true, u = false;
    for (const t of toks) { const v = semverTok(t, mc); if (v === null) u = true; else if (!v) ok = false; } if (u) unk = true; else if (ok) return true; }
  return unk ? null : false;
}
// true/false, либо null — если формат не распознан (тогда ошибку не показываем)
function mcSatisfies(range, mc) { if (range == null || range === '') return null; if (Array.isArray(range)) { let unk = false; for (const x of range) { const v = mcSatisfies(x, mc); if (v === true) return true; if (v === null) unk = true; } return unk ? null : false; }
  const s = String(range); return /[\[(]/.test(s) ? maven(s, mc) : semver(s, mc); }
// ---------- ресурс-паки ----------
const FMT = { 1: '1.8', 2: '1.9–1.10', 3: '1.11–1.12', 4: '1.13–1.14', 5: '1.15–1.16.1', 6: '1.16.2–1.16.5', 7: '1.17', 8: '1.18', 9: '1.19–1.19.2', 12: '1.19.3', 13: '1.19.4', 15: '1.20–1.20.1', 18: '1.20.2', 22: '1.20.3–1.20.4', 32: '1.20.5–1.20.6', 34: '1.21–1.21.1', 42: '1.21.2–1.21.3', 46: '1.21.4', 55: '1.21.5', 63: '1.21.6', 64: '1.21.7–1.21.8' };
function packMeta(p) { // pack.mcmeta из папки или zip
  try { let t; if (fs.statSync(p).isDirectory()) t = fs.readFileSync(path.join(p, 'pack.mcmeta'), 'utf8'); else { const z = new (require('adm-zip'))(p), e = z.getEntry('pack.mcmeta') || z.getEntries().find((x) => /^[^/]+\/pack\.mcmeta$/.test(x.entryName)); if (!e || (e.header?.size || 0) > 1048576) return null; t = z.readAsText(e); }
    return JSON.parse(t.replace(/^\uFEFF/, '')).pack || null; } catch { return null; }
}
function packProblem(p, mc, expected) {
  const m = packMeta(p); if (!m || m.pack_format == null) return null; let min = m.pack_format, max = m.pack_format; const sf = m.supported_formats;
  if (typeof sf === 'number') min = max = sf; else if (Array.isArray(sf)) { min = sf[0]; max = sf[1]; } else if (sf && typeof sf === 'object') { min = sf.min_inclusive ?? min; max = sf.max_inclusive ?? max; }
  if (expected >= min && expected <= max) return null; const l = (n) => FMT[n] ? `Minecraft ${FMT[n]}` : `формат ${n}`;
  return `Ресурс-пак рассчитан на ${l(min)}${max !== min ? '–' + l(max) : ''}, а сборка на Minecraft ${mc} (формат ${expected}).`;
}
// ---------- миры: Data.Version.Name из level.dat ----------
function nbtFind(buf, want) {
  const b = zlib.gunzipSync(buf, { maxOutputLength: 64 * 1048576 }); let p = 0; /* лимит выхода — защита от gzip-бомбы */ const i4 = () => { const v = b.readInt32BE(p); p += 4; return v; }, str = () => { const l = b.readUInt16BE(p); p += 2; const s = b.toString('utf8', p, p + l); p += l; return s; };
  const skip = (t) => { if (t === 1) p += 1; else if (t === 2) p += 2; else if (t === 3 || t === 5) p += 4; else if (t === 4 || t === 6) p += 8; else if (t === 7) p += 4 + b.readInt32BE(p); else if (t === 8) str(); else if (t === 11) p += 4 + 4 * b.readInt32BE(p); else if (t === 12) p += 4 + 8 * b.readInt32BE(p);
    else if (t === 9) { const tt = b[p++], n = i4(); for (let k = 0; k < n; k++) skip(tt); } else if (t === 10) { for (;;) { const x = b[p++]; if (!x) break; str(); skip(x); } } else throw new Error('nbt'); };
  const comp = (w) => { for (;;) { const t = b[p++]; if (!t) return undefined; const n = str();
    if (n === w[0]) { if (w.length === 1) { if (t === 8) return str(); skip(t); return undefined; } if (t === 10) { const r = comp(w.slice(1)); if (r !== undefined) return r; continue; } }
    skip(t); } };
  p = 1; str(); return comp(want);
}
function worldVersion(p) { try { let buf; if (fs.statSync(p).isDirectory()) buf = fs.readFileSync(path.join(p, 'level.dat')); else { const z = new (require('adm-zip'))(p), e = z.getEntries().find((x) => /(^|\/)level\.dat$/.test(x.entryName) && x.entryName.split('/').length <= 3); if (!e || (e.header?.size || 0) > 64 * 1048576) return null; buf = e.getData(); } return nbtFind(buf, ['Data', 'Version', 'Name']) || null; } catch { return null; } }
module.exports = { mcSatisfies, packProblem, packMeta, worldVersion, nbtFind, cmp, FMT };
