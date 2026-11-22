// Полный сброс: удаляет всё внутри папки данных, саму папку оставляет; ссылки не разворачивает; чужие папки не трогает
const assert = require('assert'), fs = require('fs'), os = require('os'), path = require('path'), R = require('../src/reset.js');
(async () => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'rst-')), data = path.join(root, 'totem-launcher'), outside = path.join(root, 'outside');
  for (const d of ['minecraft/versions/1.20.1', 'minecraft/instances/a/mods', 'skins', 'Cache']) fs.mkdirSync(path.join(data, d), { recursive: true });
  fs.mkdirSync(outside); fs.writeFileSync(path.join(outside, 'keep.txt'), 'не трогать');
  for (let i = 0; i < 120; i++) fs.writeFileSync(path.join(data, 'minecraft', 'instances', 'a', 'mods', i + '.jar'), 'x'); fs.writeFileSync(path.join(data, 'settings.json'), '{}'); fs.writeFileSync(path.join(data, 'minecraft', 'versions', '1.20.1', 'ro.jar'), 'x'); fs.chmodSync(path.join(data, 'minecraft', 'versions', '1.20.1', 'ro.jar'), 0o444);
  try { fs.symlinkSync(outside, path.join(data, 'link'), 'dir'); } catch {}
  const seen = []; const r = await R.wipe(data, (x) => seen.push(x));
  assert(r.ok && r.failed === 0, JSON.stringify(r)); assert.deepEqual(fs.readdirSync(data), [], 'папка данных пуста'); assert(fs.existsSync(path.join(outside, 'keep.txt')), 'содержимое по ссылке не удалено');
  assert(seen.at(-1).done === seen.at(-1).total && seen.at(-1).total >= 120, 'прогресс дошёл до конца'); assert(seen.some((x) => x.done > 0 && x.done < x.total), 'были промежуточные значения');
  assert(!R.validTarget(root) && !R.validTarget(path.join(root, 'outside')) && !R.validTarget('/') && !R.validTarget(''), 'чужие папки отклоняются'); assert(R.validTarget(data));
  await assert.rejects(R.wipe(outside), /Неожиданная/); assert(fs.existsSync(path.join(outside, 'keep.txt')));
  console.log('reset-ok');
})().catch((e) => { console.error(e); process.exit(1); });
