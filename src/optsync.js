// Общие настройки игры: графику, управление, звук и т. п. (options.txt) настраиваешь один раз — они применяются во всех сборках и версиях.
// После выхода из игры настройки запоминаются в общем файле, перед запуском любой сборки — подставляются в её options.txt.
// Не общие (у каждой сборки свои): ресурс-паки, последний сервер, размер окна и служебные отметки. Старые версии (до 1.13) и новые хранят клавиши по-разному — для них два отдельных набора.
const fs = require('fs'), path = require('path');
const SKIP = new Set(['version', 'resourcePacks', 'incompatibleResourcePacks', 'lastServer', 'fullscreen', 'fullscreenResolution', 'overrideWidth', 'overrideHeight', 'tutorialStep', 'joinedFirstServer', 'onboardAccessibility', 'skipMultiplayerWarning', 'hideServerAddress']);
const KEY_RX = /^[A-Za-z0-9_.\-]{1,100}$/, MAX_KEYS = 1500, MAX_VAL = 1000;
const family = (mc) => { const m = /^1\.(\d+)/.exec(String(mc)); return m && +m[1] < 13 ? 'legacy' : 'modern'; };
const num = (s) => String(s).split('.').map((x) => parseInt(x, 10) || 0);
const cmp = (a, b) => { const x = num(a), y = num(b); for (let i = 0; i < Math.max(x.length, y.length); i++) { const d = (x[i] || 0) - (y[i] || 0); if (d) return d < 0 ? -1 : 1; } return 0; };
const file = (dataDir, mc) => path.join(dataDir, `shared-options-${family(mc)}.json`);
const parse = (text) => { const r = new Map(); for (const l of String(text || '').split(/\r?\n/)) { const i = l.indexOf(':'); if (i > 0) r.set(l.slice(0, i), l.slice(i + 1)); } return r; };
function load(dataDir, mc) {
  try { const j = JSON.parse(fs.readFileSync(file(dataDir, mc), 'utf8')), keys = new Map();
    if (!j || typeof j.keys !== 'object' || !j.keys) return null;
    for (const [k, v] of Object.entries(j.keys)) { if (keys.size >= MAX_KEYS) break; if (KEY_RX.test(k) && !SKIP.has(k) && typeof v === 'string' && v.length <= MAX_VAL && !/[\u0000-\u001f]/.test(v)) keys.set(k, v); }
    return keys.size ? { mc: String(j.mc || ''), version: /^\d{1,9}$/.test(String(j.version || '')) ? String(j.version) : '', keys } : null; } catch { return null; }
}
// перед запуском: подставить общие значения в options.txt сборки (свои служебные строки не трогаем)
function pull(gameDir, mc, dataDir) {
  const m = load(dataDir, mc); if (!m) return false;
  const op = path.join(gameDir, 'options.txt'); let cur = ''; try { cur = fs.readFileSync(op, 'utf8'); } catch {}
  const lines = cur ? cur.split(/\r?\n/) : []; while (lines.length && lines[lines.length - 1] === '') lines.pop();
  const seen = new Set(), out = lines.map((l) => { const i = l.indexOf(':'); if (i <= 0) return l; const k = l.slice(0, i); seen.add(k); return !SKIP.has(k) && m.keys.has(k) && m.keys.get(k) !== l.slice(i + 1) ? k + ':' + m.keys.get(k) : l; });
  for (const [k, v] of m.keys) if (!seen.has(k)) out.push(k + ':' + v);
  if (!cur && m.version && m.mc && cmp(m.mc, mc) <= 0) out.unshift('version:' + m.version); // у новой сборки версия данных — только если настройки записаны не более новой игрой
  const next = out.join('\n') + '\n'; if (next === cur) return false;
  fs.mkdirSync(gameDir, { recursive: true }); fs.writeFileSync(op, next); return true;
}
// после выхода из игры: запомнить настройки этой сборки как общие
function push(gameDir, mc, dataDir) {
  let txt; try { txt = fs.readFileSync(path.join(gameDir, 'options.txt'), 'utf8'); } catch { return false; }
  const f = parse(txt); if (!f.size) return false; const old = load(dataDir, mc), keys = old ? new Map(old.keys) : new Map();
  for (const [k, v] of f) if (KEY_RX.test(k) && !SKIP.has(k) && v.length <= MAX_VAL && !/[\u0000-\u001f]/.test(v) && (keys.has(k) || keys.size < MAX_KEYS)) keys.set(k, v);
  const ver = f.get('version'), rec = { mc: String(mc), version: /^\d{1,9}$/.test(String(ver || '')) ? ver : '', keys: Object.fromEntries(keys) };
  const p = file(dataDir, mc), tmp = p + '.tmp'; fs.mkdirSync(dataDir, { recursive: true }); fs.writeFileSync(tmp, JSON.stringify(rec)); fs.renameSync(tmp, p); return true;
}
const mcOf = (inst, id) => inst?.mc || (/\b1\.\d+(?:\.\d+)?\b/.exec(String(id)) || [])[0] || String(id || '');
module.exports = { pull, push, family, mcOf, SKIP };
