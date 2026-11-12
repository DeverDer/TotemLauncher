// Запуск всех тестов: node tests/run-all.js (Linux/macOS: тесты пишут во временную папку /tmp)
const { execFileSync } = require('child_process'), fs = require('fs'), path = require('path');
let bad = 0;
for (const f of fs.readdirSync(__dirname).filter((x) => x.endsWith('.js') && x !== 'run-all.js').sort()) {
  try { const o = execFileSync(process.execPath, [path.join(__dirname, f)], { encoding: 'utf8' }); console.log('ok  ', f, '-', o.trim().split('\n').pop()); } catch (e) { bad++; console.log('FAIL', f, '\n', String(e.stderr || e.message).slice(0, 600)); }
}
process.exit(bad ? 1 : 0);
