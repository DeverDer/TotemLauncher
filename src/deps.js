// Зависимые моды: после выхода из игры читаем последние строки консоли и журнал игры и находим, каких модов не хватило.
// Форматы: Forge/NeoForge («Mod ID: 'x', Requested by: 'y', …, Actual version: '[MISSING]'», «Currently, x is not installed»),
// Fabric/Quilt («… requires … of x, which is missing!», «- Install x, any version.»).
'use strict';
const fs = require('fs'), path = require('path');
const SKIP = new Set(['minecraft', 'java', 'forge', 'neoforge', 'fml', 'javafml', 'lowcodefml', 'mclanguage', 'fabricloader', 'fabric-loader', 'fabric_loader', 'quilt_loader', 'quilt-loader']);
const OK = /^[a-z0-9_.\-]{2,64}$/;
const MARK = /MISSING|is not installed|which is missing|Install [\w.\-]+|Missing or unsupported mandatory dependencies|requires .* (?:or above|or later)/i;

function parseMissing(text) {
  const out = new Map(), add = (id, by, range) => { id = String(id || '').trim().toLowerCase(); if (!OK.test(id) || SKIP.has(id)) return; const e = out.get(id) || { id, by: [], range: '' }; by = String(by || '').trim().slice(0, 60); if (by && !e.by.includes(by) && e.by.length < 6) e.by.push(by); if (range && !e.range) e.range = String(range).slice(0, 40); out.set(id, e); };
  const t = String(text || '');
  let m;
  // Forge / NeoForge: список обязательных зависимостей
  const fml = /Mod ID:\s*'([^']+)',\s*Requested by:\s*'([^']+)',\s*Expected range:\s*'([^']*)',\s*Actual version:\s*'\[?MISSING\]?'/gi;
  while ((m = fml.exec(t))) add(m[1], m[2], m[3]);
  // новые Forge/NeoForge: «Mod X requires Y 1.0 or above / Currently, Y is not installed»
  const nf = /Mod\s+(.+?)\s+requires\s+([^\n]*?)\n\s*Currently,\s+([\w.\-]+)\s+is\s+not\s+installed/gi;
  while ((m = nf.exec(t))) add(m[3], m[1], '');
  const nf2 = /Currently,\s+([\w.\-]+)\s+is\s+not\s+installed/gi;
  while ((m = nf2.exec(t))) add(m[1], '', '');
  // Fabric / Quilt
  for (const line of t.split(/\r?\n/)) {
    if (!/which is missing/i.test(line)) continue;
    const by = /Mod\s+'([^']+)'/i.exec(line)?.[1] || '';
    const id = /\bof\s+(?:mod\s+)?'?([a-z0-9_.\-]+)'?(?:\s*\([^)]*\))?\s*,?\s*which is missing/i.exec(line)?.[1] || /requires\s+(?:any version of\s+)?(?:mod\s+)?'?([a-z0-9_.\-]+)'?\s*,?\s*which is missing/i.exec(line)?.[1];
    if (id) add(id, by, '');
  }
  const ins = /^\s*-\s*Install\s+([a-z0-9_.\-]+)/gim;
  while ((m = ins.exec(t))) add(m[1], '', '');
  return [...out.values()].slice(0, 30);
}
const tailOf = (f, n) => { try { const st = fs.statSync(f), fd = fs.openSync(f, 'r'); try { const len = Math.min(n, st.size), b = Buffer.alloc(len); fs.readSync(fd, b, 0, len, st.size - len); return { text: b.toString('utf8'), mtime: st.mtimeMs }; } finally { fs.closeSync(fd); } } catch { return null; } };
// tail — последние строки вывода процесса; gameDir — папка игры/сборки; since — когда игра запущена (старые журналы не читаем)
function collect({ gameDir, tail = '', since = 0, crashFile = '' } = {}) { // весь текст, где игра могла написать причину: консоль, latest.log, debug.log, свежий crash-report
  let text = String(tail || '');
  const files = [path.join(gameDir || '', 'logs', 'latest.log'), path.join(gameDir || '', 'logs', 'debug.log')];
  if (crashFile) files.push(crashFile);
  try { const cd = path.join(gameDir || '', 'crash-reports'); const n = fs.readdirSync(cd).filter((x) => /^crash-.*\.txt$/.test(x)).map((x) => ({ x, t: fs.statSync(path.join(cd, x)).mtimeMs })).sort((a, b) => b.t - a.t)[0]; if (n && n.t >= since - 2000) files.push(path.join(cd, n.x)); } catch {}
  for (const f of files) { const r = tailOf(f, 400 * 1024); if (r && (!since || r.mtime >= since - 2000)) text += '\n' + r.text; }
  return text;
}
function scan(o = {}) {
  const text = collect(o);
  if (!MARK.test(text)) return [];
  return parseMissing(text);
}
module.exports = { parseMissing, scan, collect, SKIP };
