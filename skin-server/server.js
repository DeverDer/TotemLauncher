// Сервер каталога скинов TotemLauncher (без зависимостей): node skin-server/server.js
//   PORT=8787 DATA=./data node skin-server/server.js   (за nginx/Caddy с https)
// Данные: <DATA>/skins.json + <DATA>/<id>.png. Добавить скин: node skin-server/add.js файл.png "Название" "Автор" [classic|slim] ["описание"]
const http = require('http'), fs = require('fs'), path = require('path');
const DATA = path.resolve(process.env.DATA || path.join(__dirname, 'data')), PORT = +process.env.PORT || 8787, HOST = process.env.HOST || '127.0.0.1';
const ID = /^[A-Za-z0-9_-]{1,40}$/, IDX = path.join(DATA, 'skins.json');
fs.mkdirSync(DATA, { recursive: true });
const read = () => { try { const j = JSON.parse(fs.readFileSync(IDX, 'utf8')); return Array.isArray(j.skins) ? j : { skins: [] }; } catch { return { skins: [] }; } };
const write = (j) => { const t = IDX + '.tmp'; fs.writeFileSync(t, JSON.stringify(j, null, 1)); fs.renameSync(t, IDX); };
const seen = new Map(); // «ip|id» → время: один человек увеличивает счётчик скина не чаще раза в час
const send = (res, code, body, type = 'application/json; charset=utf-8') => { res.writeHead(code, { 'Content-Type': type, 'Cache-Control': 'no-cache', 'X-Content-Type-Options': 'nosniff' }); res.end(body); };
http.createServer((req, res) => {
  try {
    const u = new URL(req.url, 'http://x'), p = u.pathname;
    if (req.method === 'GET' && p === '/skins') return send(res, 200, JSON.stringify(read()));
    let m;
    if (req.method === 'GET' && (m = /^\/skins\/([A-Za-z0-9_-]{1,40})\.png$/.exec(p))) { const f = path.join(DATA, m[1] + '.png'); if (!fs.existsSync(f)) return send(res, 404, '{"error":"not found"}'); return send(res, 200, fs.readFileSync(f), 'image/png'); }
    if (req.method === 'POST' && (m = /^\/skins\/([A-Za-z0-9_-]{1,40})\/download$/.exec(p))) {
      const j = read(), s = j.skins.find((x) => x.id === m[1]); if (!s) return send(res, 404, '{"error":"not found"}');
      const k = (req.headers['x-forwarded-for'] || req.socket.remoteAddress) + '|' + s.id, now = Date.now();
      if (!(seen.get(k) > now - 36e5)) { seen.set(k, now); s.downloads = (+s.downloads || 0) + 1; write(j); if (seen.size > 5e4) seen.clear(); }
      return send(res, 200, JSON.stringify({ downloads: s.downloads }));
    }
    send(res, 404, '{"error":"not found"}');
  } catch (e) { send(res, 500, '{"error":"server"}'); }
}).listen(PORT, HOST, () => console.log(`Каталог скинов: http://${HOST}:${PORT}/skins (данные: ${DATA})`));
