// Регресс: когда один файл не скачался, пользователь видит НАСТОЯЩУЮ причину, а не «cancelled» от соседних потоков
const assert = require('assert'), http = require('http'), fs = require('fs'), os = require('os'), path = require('path');
const { _t: t } = require('../src/game.js');
const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'cr-'));
const srv = http.createServer((q, r) => {
  if (q.url === '/bad') { r.writeHead(404); return r.end('no'); }
  r.write(Buffer.alloc(1000)); const iv = setInterval(() => r.write(Buffer.alloc(1000)), 20); r.on('close', () => clearInterval(iv)); // «медленные» файлы: к моменту сбоя ещё качаются
}).listen(0, async () => {
  const u = 'http://127.0.0.1:' + srv.address().port, ac = new AbortController();
  const tasks = [{ url: u + '/s1', dest: path.join(tmp, 's1'), size: 1e9 }, { url: u + '/s2', dest: path.join(tmp, 's2'), size: 1e9 }, { url: u + '/bad', dest: path.join(tmp, 'bad'), size: 10, label: 'bad.jar' }];
  try {
    await assert.rejects(t.runTasks(tasks, ac.signal, () => {}), (e) => { assert(!/cancelled/.test(e.message), 'вместо причины показано «cancelled»: ' + e.message); assert(/bad\.jar/.test(e.message) && /404/.test(e.message), e.message); return true; });
    assert(!ac.signal.aborted, 'пользователь ничего не отменял');
    console.log('cancelreal ok');
  } catch (e) { console.error(e); process.exitCode = 1; } finally { srv.close(); }
});
