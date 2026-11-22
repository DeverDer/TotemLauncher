// Подготовка к сборке: записывает репозиторий обновлений в конфиги и копирует общие файлы в установщик.
//   TOTEM_REPO=владелец/название node scripts/prepare.js
const fs = require('fs'), path = require('path');
const root = path.join(__dirname, '..'), inst = path.join(root, 'installer'), cfgPath = path.join(root, 'src', 'app-config.json');
const norm = (r) => String(r || '').trim().replace(/^https?:\/\/github\.com\//i, '').replace(/\.git$/i, '').replace(/\/+$/, '');
let cfg = {}; try { cfg = JSON.parse(fs.readFileSync(cfgPath, 'utf8')); } catch {}
if (process.env.TOTEM_REPO) cfg.repo = norm(process.env.TOTEM_REPO);
if (process.env.TOTEM_SKINS_API !== undefined) cfg.skinsApi = String(process.env.TOTEM_SKINS_API).trim().replace(/\/+$/, '');
if (cfg.skinsApi && !/^https:\/\/[^\s?#@]+$/.test(cfg.skinsApi)) { console.error('Адрес сервера каталога скинов должен начинаться с https://: ' + cfg.skinsApi); process.exit(1); }
if (cfg.repo && !/^[A-Za-z0-9_.-]{1,100}\/[A-Za-z0-9_.-]{1,100}$/.test(cfg.repo)) { console.error('Неверный репозиторий: ' + cfg.repo); process.exit(1); }
fs.writeFileSync(cfgPath, JSON.stringify({ repo: cfg.repo || '', skinsApi: cfg.skinsApi || '' }, null, 1) + '\n');
const cp = (a, b) => { fs.mkdirSync(path.dirname(b), { recursive: true }); fs.cpSync(a, b, { recursive: true }); };
for (const f of ['app.css', 'icons.js', 'bg.js']) cp(path.join(root, 'src', 'ui', f), path.join(inst, 'ui', f));
cp(path.join(root, 'src', 'ui', 'assets'), path.join(inst, 'ui', 'assets'));
cp(path.join(root, 'src', 'updater-core.js'), path.join(inst, 'lib', 'updater-core.js'));
cp(path.join(root, 'build', 'installer-icon.png'), path.join(inst, 'icon.png')); // значок установщика — с синим символом
fs.cpSync(path.join(root, 'build', 'installer-icon.png'), path.join(inst, 'ui', 'assets', 'app-icon.png')); // и логотип в окне установщика
fs.writeFileSync(path.join(inst, 'app-config.json'), JSON.stringify({ repo: cfg.repo || '' }, null, 1) + '\n');
console.log('Репозиторий обновлений:', cfg.repo || '(не задан)');
