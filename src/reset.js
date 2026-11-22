// Полный сброс данных лаунчера: удаляет всё содержимое папки данных (%APPDATA%\totem-launcher): сборки, версии, карты, аккаунты, скины, настройки.
// Выполняется отдельным процессом с маленьким окном — основной лаунчер к этому моменту уже закрыт и не держит файлы. Сам лаунчер (папка установки) не затрагивается.
const fs = require('fs'), path = require('path');
const NAME = 'totem-launcher';
const validTarget = (dir) => { try { const d = path.resolve(String(dir)); return path.isAbsolute(d) && path.basename(d).toLowerCase() === NAME && path.dirname(d) !== d && fs.statSync(d).isDirectory(); } catch { return false; } };
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
function list(dir) { // файлы и папки; ссылки и junction не разворачиваем (удаляется сама ссылка, а не то, на что она указывает)
  const files = [], dirs = [], st = [dir];
  while (st.length) { const d = st.pop(); let es = []; try { es = fs.readdirSync(d, { withFileTypes: true }); } catch { continue; }
    for (const e of es) { const p = path.join(d, e.name); if (e.isDirectory()) { dirs.push(p); st.push(p); } else files.push(p); } }
  return { files, dirs: dirs.sort((a, b) => b.length - a.length) };
}
// cb({ done, total, stage }); возвращает { ok, failed, first }
async function wipe(dir, cb = () => {}) {
  if (!validTarget(dir)) throw new Error('Неожиданная папка данных: ' + dir);
  cb({ done: 0, total: 0, stage: 'Подсчёт файлов…' }); const { files, dirs } = list(dir), total = files.length + dirs.length; let done = 0, last = 0, failed = [];
  const tick = async (force) => { const n = Date.now(); if (force || n - last > 90) { last = n; cb({ done, total, stage: 'Удаление файлов' }); await sleep(0); } };
  const rm = async (p, isDir) => { for (let a = 0; a < 6; a++) { try { if (isDir) fs.rmdirSync(p); else { try { fs.unlinkSync(p); } catch (e) { if (e.code === 'EPERM' || e.code === 'EACCES') { fs.chmodSync(p, 0o666); fs.unlinkSync(p); } else throw e; } } return true; } catch (e) { if (e.code === 'ENOENT') return true; if (a < 5) await sleep(250 * (a + 1)); } } return false; };
  for (const f of files) { if (!(await rm(f, false))) failed.push(f); done++; await tick(); }
  for (const d of dirs) { if (!(await rm(d, true))) failed.push(d); done++; await tick(); }
  await tick(true); return { ok: !failed.length, failed: failed.length, first: failed[0] || '' };
}
module.exports = { wipe, validTarget, list, NAME };
