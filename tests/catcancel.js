// Отмена загрузки из каталога: недокачанное и уже скачанное в этом задании удаляется, чужие файлы остаются
const assert = require('assert'), http = require('http'), fs = require('fs'), os = require('os'), path = require('path');
const { _t } = require('../src/catalog.js');
const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'cc-'));
const srv = http.createServer((q, r) => {
  if (q.url === '/fast') { r.end(Buffer.alloc(500)); return; }
  r.write(Buffer.alloc(1000)); const iv = setInterval(() => r.write(Buffer.alloc(1000)), 20); r.on('close', () => clearInterval(iv)); // «вечная» загрузка
}).listen(0, '127.0.0.1', async () => {
  const u = 'http://127.0.0.1:' + srv.address().port, ac = new AbortController();
  const mine = path.join(dir, 'old.jar'); fs.writeFileSync(mine, 'user file');
  const tasks = [{ url: u + '/fast', dest: path.join(dir, 'a.jar'), size: 500, label: 'a' }, { url: u + '/slow', dest: path.join(dir, 'b.jar'), size: 1e9, label: 'b' }, { url: u + '/slow', dest: mine, size: 1e9, label: 'old' }];
  let reports = 0;
  await assert.rejects(_t.runJob(tasks, () => { if (++reports === 6) ac.abort(); }, ac.signal), /cancelled/);
  assert(!fs.existsSync(path.join(dir, 'a.jar')), 'скачанное в этом задании удалено');
  assert(!fs.existsSync(path.join(dir, 'b.jar')) && !fs.existsSync(path.join(dir, 'b.jar.part')), 'недокачанное удалено');
  assert(fs.existsSync(mine), 'файл, который был до загрузки, не тронут');
  assert(_t.isCancel(new Error('cancelled')) && _t.isCancel(Object.assign(new Error('x'), { name: 'AbortError' })) && !_t.isCancel(new Error('HTTP 500')));
  srv.close(); console.log('catcancel-ok');
});
