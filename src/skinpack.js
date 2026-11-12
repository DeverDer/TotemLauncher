// Скин локального аккаунта в игре: подменяем стандартные скины (Steve/Alex и др.) ресурс-паком TotemSkin.zip
const fs = require('fs'), path = require('path');
const NEW = ['alex', 'ari', 'efe', 'kai', 'makena', 'noor', 'steve', 'sunny', 'zuri'];
function packFormat(mc) {
  const m = /^1\.(\d+)(?:\.(\d+))?/.exec(String(mc)); if (!m) return 64; const a = +m[1], b = +(m[2] || 0);
  if (a <= 8) return 1; if (a <= 10) return 2; if (a <= 12) return 3; if (a <= 14) return 4; if (a === 15) return 5; if (a === 16) return b >= 2 ? 6 : 5; if (a === 17) return 7; if (a === 18) return 8;
  if (a === 19) return b >= 4 ? 13 : b >= 3 ? 12 : 9; if (a === 20) return b >= 5 ? 32 : b >= 3 ? 22 : b >= 2 ? 18 : 15; if (a === 21) return b >= 7 ? 64 : b >= 6 ? 63 : b >= 5 ? 55 : b >= 4 ? 46 : b >= 2 ? 42 : 34; return 64;
}
// wide — текстура для широких рук (Steve), slim — для тонких (Alex): какую модель выберет игра, зависит от UUID
const files = (wide, slim) => { const f = { 'assets/minecraft/textures/entity/steve.png': wide, 'assets/minecraft/textures/entity/alex.png': slim };
  for (const n of NEW) { f[`assets/minecraft/textures/entity/player/wide/${n}.png`] = wide; f[`assets/minecraft/textures/entity/player/slim/${n}.png`] = slim; } return f; };
const legacyFmt = (mc) => { const m = /^1\.(\d+)/.exec(String(mc)); return !!m && +m[1] < 13; };
const ownPack = /^(file\/)?TotemSkin(-\d+)?\.zip$/; // наши паки: основной и по одному на дополнительное окно
function optionsText(text, mc, enable, base = 'TotemSkin') {
  const id = (legacyFmt(mc) ? '' : 'file/') + base + '.zip', re = /^resourcePacks:(.*)$/m, m = re.exec(text || '');
  let list; if (m) { try { list = JSON.parse(m[1].trim()); } catch { return text; } if (!Array.isArray(list)) return text; } else list = legacyFmt(mc) ? [] : ['vanilla'];
  list = list.filter((x) => !ownPack.test(String(x))); if (enable) list.push(id); // позже в списке = выше приоритет
  const line = 'resourcePacks:' + JSON.stringify(list);
  return m ? text.replace(re, () => line) : (text ? text.replace(/\n?$/, '\n') : '') + line + '\n';
}
function applySkin(gameDir, mc, activeDir, enable, base = 'TotemSkin') {
  const op = path.join(gameDir, 'options.txt'); let cur = ''; try { cur = fs.readFileSync(op, 'utf8'); } catch {}
  let wide, slim; try { wide = fs.readFileSync(path.join(activeDir, 'wide.png')); slim = fs.readFileSync(path.join(activeDir, 'slim.png')); } catch { enable = false; }
  if (enable) {
    const AdmZip = require('adm-zip'), z = new AdmZip();
    z.addFile('pack.mcmeta', Buffer.from(JSON.stringify({ pack: { pack_format: packFormat(mc), supported_formats: { min_inclusive: 1, max_inclusive: 999 }, description: 'Скин TotemLauncher' } })));
    for (const [p, b] of Object.entries(files(wide, slim))) z.addFile(p, b);
    fs.mkdirSync(path.join(gameDir, 'resourcepacks'), { recursive: true }); z.writeZip(path.join(gameDir, 'resourcepacks', base + '.zip'));
  } else if (!cur) return;
  const next = optionsText(cur, mc, enable, base); if (next !== cur) { fs.mkdirSync(gameDir, { recursive: true }); fs.writeFileSync(op, next); }
}
module.exports = { applySkin, optionsText, packFormat, files };
