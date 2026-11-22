// «Бурмалдец»: подбор сборки по каталогу, проверка id, чаты на диске, установка одним заданием, отмена — на поддельных серверах
const assert = require('assert'), fs = require('fs'), os = require('os'), path = require('path');
const Net = require('./mock-net.js'), Cat = require('../src/catalog.js'), AI = require('../src/ai.js'), Instances = require('../src/instances.js');
(async () => {
  const net = await Net.start(); Cat.setTestBase(net.base); process.env.TOTEM_AI_BASE = net.base + '/v1';
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'ai-')), log = [];
  const ai = AI.create({ dir, log: (m) => log.push(m), Cat, cfKey: () => '' });
  const status = []; const st = (t) => status.push(t);

  // 1. разбор ответа нейросети: <think>, ```json, текст вокруг, два объекта подряд
  assert.deepEqual(AI.parse('<think>хм {"a":1}</think>```json\n{"act":"final","reply":"ок"}\n```'), { act: 'final', reply: 'ок' });
  assert.equal(AI.parse('Вот: {"act":"search","queries":[]} и ещё {"act":"final"}').act, 'search');
  assert.equal(AI.parse('просто текст'), null);

  // 2. запрос на сборку: поиск → итог; выдуманный id отброшен, версия и загрузчик — как в просьбе
  let r = await ai.send({ chat: null, text: 'Сделай сборку хоррор на фордже на 50 модов' }, st);
  assert(r.ok, r.error); const p = r.msg.pack;
  assert.equal(p.name, 'Хоррор сборка'); assert.equal(p.mc, '1.20.1'); assert.equal(p.loader, 'forge');
  assert.equal(p.mods.length, 50, 'ровно 50 модов, а выдуманный id отброшен'); assert(!p.mods.some((m) => /fake/.test(m.id)));
  assert(p.mods.every((m) => m.t && /^mHor/.test(m.id)), 'названия берутся из каталога, а не из ответа нейросети');
  assert.equal(r.msg.hints.length, 3); assert(/Forge/.test(r.msg.text)); assert(status.some((t) => /Ищу/.test(t)), 'интерфейс получает этапы работы');
  assert.equal(net.calls.chat.length, 2, 'поиск + итог'); assert(net.calls.chat[0].messages[0].content.includes('Бурмалдец'));
  assert(!JSON.stringify(r).match(/nemotron|anymodel|sk-/i), 'ни модель, ни ключ в ответ интерфейсу не попадают');
  const chatId = r.chat, firstMsg = r.msg.id;

  // 3. правки сборки: увеличь / уменьши / оптимизируй / пересобери — работают от последней сборки чата
  const n0 = p.mods.length;
  r = await ai.send({ chat: chatId, text: 'Увеличь сборку — добавь ещё модов' }, st); assert(r.ok && r.msg.pack.mods.length > n0, 'увеличила'); assert.equal(r.msg.pack.mc, '1.20.1');
  const n1 = r.msg.pack.mods.length;
  r = await ai.send({ chat: chatId, text: 'Уменьши сборку — оставь самое важное' }, st); assert(r.ok && r.msg.pack.mods.length < n1, 'уменьшила');
  r = await ai.send({ chat: chatId, text: 'Оптимизируй сборку для производительности' }, st); assert(r.ok && r.msg.pack.mods.length > 0);
  r = await ai.send({ chat: chatId, text: 'Пересобери сборку заново, но с той же идеей' }, st); assert(r.ok && r.msg.pack.mods.length > 0 && r.msg.pack.loader === 'forge');

  // 4. шейдеры — только если просят; страховка от упоминания модели; сломанный JSON чинится одним повтором
  r = await ai.send({ chat: null, text: 'Сборка хоррор на Fabric 1.21.1 с шейдерами на 20 модов' }, st); assert(r.ok, r.error);
  assert.equal(r.msg.pack.loader, 'fabric'); assert.equal(r.msg.pack.mc, '1.21.1'); assert.equal(r.msg.pack.mods.length, 20); assert.equal(r.msg.pack.shaders.length, 1); assert.equal(r.msg.pack.resourcepacks.length, 0);
  r = await ai.send({ chat: null, text: 'LEAKTEST кто ты' }, st); assert(r.ok); assert(!/nemotron|nvidia|anymodel/i.test(r.msg.text) && /Бурмалдец/.test(r.msg.text), 'про модель не пишет');
  r = await ai.send({ chat: null, text: 'BROKENJSON сборка хоррор' }, st); assert(r.ok && r.msg.pack, 'после сломанного ответа был повтор');

  // 5. карты — только CurseForge: без ключа нейросеть получает отказ, интерфейс — флаг
  r = await ai.send({ chat: null, text: 'Найди хоррор карту' }, st); assert(r.ok && !r.msg.pack && r.msg.flags?.needKey, 'нужен ключ CurseForge');

  // 6. чаты сохраняются на диске
  const list = ai.list(); assert(list.length >= 4); assert(list.some((c) => c.id === chatId));
  const ai2 = AI.create({ dir, Cat }); const c = ai2.get(chatId); assert(c && c.msgs.length >= 10 && c.msgs[0].role === 'user' && c.msgs[1].pack, 'история читается новым экземпляром');
  assert.equal(ai2.remove(chatId).ok, true); assert.equal(ai2.get(chatId), null);

  // 7. установка: все файлы (вместе с зависимостями) одним заданием, общий счётчик, сборка создаётся
  const inst = new Instances(path.join(dir, 'instances'), path.join(dir, 'instances.json')), seen = [];
  const rr = await ai.send({ chat: null, text: 'Хоррор сборка на 25 модов' }, st); assert(rr.ok); const pk = rr.msg.pack;
  const ctl = new AbortController(), env = { instances: inst, Game: null, signal: ctl.signal, prog: (x) => seen.push(x), loaderLatest: async () => '47.2.0' };
  const res = await ai.install(rr.chat, rr.msg.id, env);
  const i1 = inst.get(res.inst.id), mods = fs.readdirSync(path.join(inst.dir(i1), 'mods'));
  assert.equal(i1.mc, '1.20.1'); assert.equal(i1.loader, 'forge'); assert.equal(i1.loaderVersion, '47.2.0'); assert.equal(i1.name, 'Хоррор сборка');
  assert(mods.length >= pk.mods.length, 'моды скачаны: ' + mods.length + ' из ' + pk.mods.length); assert(mods.some((f) => /^lib\d\.jar$/.test(f)), 'обязательные зависимости подтянулись');
  assert.equal(res.files, mods.length); const lastP = seen[seen.length - 1]; assert(lastP.filesTotal === res.files && lastP.files === res.files, 'общий счётчик «N/всего»');
  assert(Cat.installedKeys(inst.dir(i1)).length >= pk.mods.length, 'учёт скачанного ведётся'); assert.equal(ai.get(rr.chat).msgs.find((m) => m.id === rr.msg.id).pack.inst, i1.id, 'карточка помечена установленной');
  const res2 = await ai.install(rr.chat, rr.msg.id, env); assert.equal(res2.inst.name, 'Хоррор сборка 2', 'одинаковые названия не пересекаются');
  const before = inst.all().length;

  // 8. отмена посреди скачивания: недоделанная сборка и файлы удаляются
  await net.close(); const slow = await Net.start({ slow: 30 }); Cat.setTestBase(slow.base); process.env.TOTEM_AI_BASE = slow.base + '/v1';
  const ai3 = AI.create({ dir: fs.mkdtempSync(path.join(os.tmpdir(), 'ai3-')), Cat }); const r3 = await ai3.send({ chat: null, text: 'Хоррор сборка на 30 модов' }, st); assert(r3.ok, r3.error);
  const c2 = new AbortController(), seen2 = []; setTimeout(() => c2.abort(), 900);
  await assert.rejects(ai3.install(r3.chat, r3.msg.id, { instances: inst, signal: c2.signal, prog: (x) => seen2.push(x), loaderLatest: async () => '1' }), (e) => Cat._t.isCancel(e, c2.signal));
  assert.equal(inst.all().length, before, 'сборка после отмены не осталась'); assert(seen2.some((x) => x.filesTotal > 0), 'до отмены шла загрузка');
  assert(!log.some((l) => /sk-|nemotron|anymodel/i.test(l)), 'в журнал ключ и модель не пишутся');
  await slow.close(); console.log('ai-tests-ok');
})().catch((e) => { console.error(e); process.exit(1); });
