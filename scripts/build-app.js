// Собирает приложение лаунчера для Windows и упаковывает в dist/TotemLauncher-<версия>-win-x64.zip (+ .sha256).
// Этот zip скачивают установщик и само обновление. Работает и на Windows, и на Linux/macOS (кросс-сборка).
const fs = require('fs'), path = require('path'), cp = require('child_process'), crypto = require('crypto');
const root = path.join(__dirname, '..'), pkg = JSON.parse(fs.readFileSync(path.join(root, 'package.json'), 'utf8')), ver = pkg.version;
if (!/^\d+\.\d+\.\d+$/.test(ver)) { console.error('version в package.json должна быть вида 1.2.3, сейчас: ' + ver); process.exit(1); }
const dist = path.join(root, 'dist'), unpacked = path.join(dist, 'win-unpacked'); fs.rmSync(dist, { recursive: true, force: true });
const bin = path.join(root, 'node_modules', '.bin', process.platform === 'win32' ? 'electron-builder.cmd' : 'electron-builder');
const args = ['--win', 'dir', '--x64', '-c.directories.output=dist'];
if (process.platform !== 'win32') args.push('-c.win.signAndEditExecutable=false'); // без wine иконку exe не правим; ярлыки берут icon.ico из resources
const r = cp.spawnSync(bin, args, { cwd: root, stdio: 'inherit', shell: process.platform === 'win32' }); if (r.status !== 0) process.exit(r.status || 1);
if (!fs.existsSync(path.join(unpacked, 'TotemLauncher.exe'))) { console.error('Сборка не создала TotemLauncher.exe'); process.exit(1); }
const AdmZip = require('adm-zip'), z = new AdmZip(); z.addLocalFolder(unpacked);
const out = path.join(dist, `TotemLauncher-${ver}-win-x64.zip`); z.writeZip(out);
const sha = crypto.createHash('sha256').update(fs.readFileSync(out)).digest('hex'); fs.writeFileSync(out + '.sha256', `${sha}  ${path.basename(out)}\n`);
console.log(`\nГотово: ${out}\nРазмер: ${(fs.statSync(out).size / 1048576).toFixed(1)} МБ\nSHA-256: ${sha}`);
