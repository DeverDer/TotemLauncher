// Собирает установщик: dist/installer/TotemLauncher-Setup.exe (один файл). Перед этим выполните scripts/prepare.js.
const fs = require('fs'), path = require('path'), cp = require('child_process');
const root = path.join(__dirname, '..'), inst = path.join(root, 'installer');
if (!fs.existsSync(path.join(inst, 'lib', 'updater-core.js'))) { console.error('Сначала: node scripts/prepare.js'); process.exit(1); }
const bin = path.join(root, 'node_modules', '.bin', process.platform === 'win32' ? 'electron-builder.cmd' : 'electron-builder');
const electronVersion = require(path.join(root, 'node_modules', 'electron', 'package.json')).version; // у установщика нет своего node_modules — берём версию Electron из корня
const args = ['--win', 'portable', '--x64', '--projectDir', inst, '-c.electronVersion=' + electronVersion, '-c.directories.output=' + path.join(root, 'dist', 'installer')];
if (process.platform !== 'win32') args.push('-c.win.signAndEditExecutable=false');
const r = cp.spawnSync(bin, args, { cwd: root, stdio: 'inherit', shell: process.platform === 'win32' }); if (r.status !== 0) process.exit(r.status || 1);
const exe = path.join(root, 'dist', 'installer', 'TotemLauncher-Setup.exe'); if (!fs.existsSync(exe)) { console.error('Установщик не создан'); process.exit(1); }
console.log(`\nГотово: ${exe} (${(fs.statSync(exe).size / 1048576).toFixed(1)} МБ)`);
