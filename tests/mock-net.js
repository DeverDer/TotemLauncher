// Поддельные серверы для тестов и скриншотов: «нейросеть», Modrinth (поиск, версии, файлы) и новости Mojang. Только 127.0.0.1.
'use strict';
const http = require('http'), crypto = require('crypto');
const IMGS = ["data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAOAAAABkCAIAAAAQbqt4AAADKklEQVR4nO3bMWtUQRTF8TcwtbWVhW20VksLA7YBmyBiI36SfAJBEBsJVgqpIoJBLMVa7cTCytoPEC3iLlu4RCZzds958/9Vad7hzssyuXevlv2n3ybAVZ2m023XAKxVp/J72zUAa9Vp4gMKX7UU/sTDFzcorNGDwlotTPEwxg0Ka/SgsMYUD2vcoLBGDwpr7OJhrRZuUBijB4W1OjHFw1gt3KAwxhQPa/SgsMYmCda4QWGNHhTW2CTBGpskWKMHhTU2SbDGJgnWmOJhjSke1pjiYY0pHtaY4mGNKR7WmOJhjR4U1uhBYY0eFNboQWGNTRKssUmCNaZ4WGOKhzWmeFhjioc1pnhY4waFNXpQWGOKhzW+B4U1Nkmwxg0Ka/SgsMYUD2t8DwprbJJgjRsU1uhBYY0pfj4+nzxre/D6ncd9K+mI70ExOX8G5rZJ+vXjeduDl6486ltJEOfPAFP80sjvwffsTPELI78H47Mzxf818ntwPjtT/MLI78H47EzxS5t7D5+ODtsevLH3oG8lC76fgblN8c0i3oOoSOezb+0G/fn1ZduDl3fu961kwfeXtEJUpO/ZA3tQUcER72G8syf2oMPdIiuGO3teDzpgH7Y04NkTN0migiPew3BnD9wkiQr+V+yHF6/bwm4/vHexatbY4NlN5G2SRAX3jY0oUh3bxflT/PePR23RV2/ttT14johJNqJIdWwP0ik+a+TsGxtRpDq2A+EUnzVy9o2NKFId24V0is8aOfvGRhSpju1AOcVnjZx9YyOKVMf2MJMe9M2T47Mfbu72jL2ArGbR+ANaZBOcKDkiNqJIdWwXM7lB/WIjivyv2C/v3raFXtu92/bgKnpQTWxEkQmxwk1S1tqDTZJnrPLfg2atPdgkWcbSg4piI4oMiN30JunVwfuzH5q/D4rYpkQUGRHLJkkUG1FkQCxTvCY2osiEWHpQUWxEkQGxbJIksRFFRsRyg4piI4oMiKUH1cRGFJkQW4tsihclR8RGFBkRyw2qiY0oMiGWHlQUG1FkQCxTvCQ2osiIWG5QUWxEkQGx9KCa2IgiE2L5b8eS2IgiI2L/ACe9V7l6jtzWAAAAAElFTkSuQmCC", "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAOAAAABkCAIAAAAQbqt4AAADJ0lEQVR4nO3bvW7UQBSG4Wzimogf5QKoQJHokHIFcHPcED0FEg0NgooyEhE/WkSLlyJ1jH0y3nnP8ftUKeJvZ+TNJ++cze79m1cnEtUwHg691yDdafD9KbJh7L0CaYINKrRhPPEdKi4bVGiD70+RDaPvUIHZoELzoF5oNqjQ/BQvNCdJQrNBheYkSWg2qNB8BhWaDSo0z0GF5iRJaDao0Pw2k9BsUKH5KV5oTpKEZoMKzUmS0GxQodmgQhsOVqjAPAcVmpMkodmgQrNBhTYcnCQJzHNQoXkOKjQbVGg2qNCcJAnNc1CheQ4qNBtUaDao0JwkCc0GFZrPoEJzkiQ0J0lCc5IkNBtUaD6DCs1P8ULzHFRoTpKEZoMKzWdQodmgIG+//4xd+PrJo7Yr4bBBKyh8E50kVdDlJn7Y/Ypd+PLwcP4vO0mqINdNXLRa3CTp60Xw7/LpzYK/y2L63MRd8LpFq63ToGU2EpBr77kbNKzLRvaXwb4//9Sy73PdxGUNWmaSlGsjbVdbeO91zkFzbaTtagvvvc45aK6NtF1t4b3boH3YoDPZoH3YoDPVmSTl2kjb1Rbeu+egfbRdbeG9ew4a8e7b/vaHqxfBhLarzXUTnSQlYIPOZIP2ccwG/TzuY7HPT89jF05b2qCpbuzdcm2k7WpX2jshNt6gN49/xy68+PEg+JKTbNDmCLEdzkFXesVU788c56CE2A6TpJVecTr277Ng3599WaXvU0ySCLE2aIXYFIuMxQ7j0Z/dVnrFLcf+Jy361XfC3rfSoNF7hGiRI6ehYjucg3b5bBh/gwI+yd437Sj/PLRSbIdJ0kqvOB17uk5sWIpJEiF2Kw1aOzbFImOxHSZJhPlEsdgUi4zFFm/Qj9d/bn+4umwZe3826Ey4Z9DaD4srxaZYZCy2eINuJDbFImOxWzkHrR2bYpGxWCdJFWJTLDIWa4NWiE2xyFhs/NtM4dkM4TsyxWJTLDIWG2/Q2tPtXLEpFhmL9VN8hdgUi4zFxidJZ7HLGPOJYrEpFhmLtUErxKZYZCwWN0kytnsaKtYGrRBb+Cu2noNWiC38Twr/AF8bNstm7hlIAAAAAElFTkSuQmCC", "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAOAAAABkCAIAAAAQbqt4AAACzUlEQVR4nO3dsYoTURQG4CizlQiKCCLptdZGYesFX0DwBSxtBDtfQPAFfAHBF7AXW+3tg4ggCiIWFrGwStRLMjvJ+W/2+5qFhfm5OTPcM7kHds8d33w0g1TDcrmsXgP81zCbeUDJNSw9oAQbPJ8ks4MSzTso0bR4omnxRNPiieagnmjnqxcALVo80XxJIppjJqLZQYnmHZRow8wxE8EGjyfJtHiimSQRzSSJaFo80ZyDEs0kiWh2UKJ5ByWaSRLRTJKIpsUTzSSJaCZJRNPiieYclGiOmYjmmIlo3kGJpsUTTYsnmhZPNJMkopkkEU2LJ5oWTzQ7KNEcMxHNDko0kySiafFE0+KJ5piJaHZQonkHJZpv8UTT4ommxRPNDko0x0xEs4MSbahewGG69WQx7sL3z+bTrqR3WnwWt2ONFp/G7Vgx/THT/MHHcRcuXl6fdiU98niuSZok5aykkCKsimrxOSsppAgrgiZJOSsp9M8iHB1/Gpf26+210ywmgR00zbRF6L6kQcdMOSspNG0RDqCkdtA0rSLcOdky7OTzn59vnl4du55i/jYT0bT4LDsqQr+17abF33j4ZVzohxdXxl1YZEe3I+cub+fwj5lyPuAmFGHNGZgk5XzATSjCqm5afF7sjuyvCJfufR2X9e315dMtZgtB/2luRyvJ+YCb6KII+yzpEHT7bKCzToqwx5LaQbN0UYT97qBB96+L3WPXuijC/kpqkkS0w58ktWNvP/4+Lvbd84vjLmzrYpK0z2dGixdbntZikiS2OK3NJEnsxGnz+z/GpS5eXfj7l1q82PK0VqxzULHFae1Yk6QpY4/u/txF7AR63UDtoGKr09qx3kHFlqe1Yk2SiHbWJ0liy9PasVq82PK0VqwvSWKL09qxjpnEVqc1Y7V4seVprVgtXmxxWjtWixdbndaMtYOKLU5rx3oHFVue1oo1SSLab4tGtPuC7YX7AAAAAElFTkSuQmCC"];
const day = (n) => new Date(Date.UTC(2026, 10, 18) - n * 864e5).toISOString();
const MODN = ['Dread Hollow','Night Stalkers','Cursed Structures','Abandoned Asylum','Whispering Woods','Fog Of Fear','Haunted Mansions','Creeper Overhaul','Lurking Shadows','Blood Moon','Scary Sounds','Ghost Town','Dark Cellars','Eerie Ambience','Skeleton Crypts','Zombie Horde','Phantom Lights','Paranormal Activity','Cursed Dolls','Spooky Villagers','Dungeon Crawl','Gloomy Caves','Hunted Forest','Twisted Mobs','Silent Hill Biome','Rusted Hospital','Watcher In The Dark','Thin Ice Fear','Lost Souls','Mortuary Block','Shadow Wolves','Midnight Chimes','Black Fog','Crimson Graveyard','Nightmare Fuel','Old Manor Loot','Spider Nests','Wailing Wind','Backrooms Lite','Rotten Village','Scarecrow Fields','Grim Reaper Mob','Pale Visitors','Fear Meter','Torchlight Flicker','Ambient Dread','Trapdoor Cellars','Dead Lanterns','Fallen Chapel','Crow Murder','Gravedigger Jobs','Cobweb Corners','Wraith Hunters','Haunted Shipwrecks','Bone Collector','Skull Totems','Embalmed','Lantern Keepers','Night Vision Fix','Smooth Fonts'];
const MODS = MODN.map((t, i) => ({ id: 'mHor' + String(i + 1).padStart(3, '0'), title: t, desc: 'Adds ' + t.toLowerCase() + ' to your world with new atmosphere and challenges.', dl: 900000 - i * 11000 }));
const SHADERS = ['Dark Atmosphere','Soft Gloom','Foggy Nights','Vivid Realism','Cinematic Dusk'].map((t, i) => ({ id: 'sShd' + (i + 1), title: t, desc: t + ' shaders pack', dl: 500000 - i * 40000 }));
const RPACKS = ['Haunted Textures','Pale Pixels','Gothic UI'].map((t, i) => ({ id: 'rPak' + (i + 1), title: t, desc: t + ' resource pack', dl: 300000 - i * 30000 }));
const LIBS = ['lib0', 'lib1', 'lib2'];
const ALL = new Map(); for (const m of MODS) ALL.set(m.id, { ...m, type: 'mod' }); for (const m of SHADERS) ALL.set(m.id, { ...m, type: 'shader' }); for (const m of RPACKS) ALL.set(m.id, { ...m, type: 'resourcepack' });
for (const l of LIBS) ALL.set(l, { id: l, title: 'Library ' + l, desc: 'library', dl: 5, type: 'mod' });
const SUP = new Set(['1.20.1', '1.21.1']);
const bytesOf = (id) => { const n = 90000 + (id.length * 7919 % 5) * 40000, b = Buffer.alloc(n); b.write('PK\x03\x04'); b.write(id, 4); return b; };
const sha1 = (b) => crypto.createHash('sha1').update(b).digest('hex');
const hash = (s) => [...String(s)].reduce((a, c) => (a * 31 + c.charCodeAt(0)) >>> 0, 7);

const B62 = '0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz';
const vid = (pid) => { let n = hash(pid) * 7919 + 13, s = ''; for (let i = 0; i < 8; i++) { s = B62[n % 62] + s; n = Math.floor(n / 62) + (i + 1) * 977; } return s; }; // стабильный «id версии» из 8 знаков, как у Modrinth
const verOf = (p, base) => { const buf = bytesOf(p.id); return { id: vid(p.id), project_id: p.id, version_type: 'release', game_versions: ['1.20.1'], loaders: ['fabric', 'forge', 'neoforge'], dependencies: [], name: p.title + ' 1.0', version_number: '1.0', files: [{ primary: true, filename: p.id + (p.type === 'mod' ? '.jar' : '.zip'), url: base + '/files/' + p.id, hashes: { sha1: sha1(buf) }, size: buf.length }] }; };
function start({ slow = 0 } = {}) {
  const calls = { chat: [], search: 0, versions: 0, files: 0 };
  const srv = http.createServer((q, r) => {
    const base = 'http://127.0.0.1:' + srv.address().port, u = new URL(q.url, base);
    const json = (o, c = 200) => { r.writeHead(c, { 'content-type': 'application/json' }); r.end(JSON.stringify(o)); };
    // ---------- «нейросеть» ----------
    if (u.pathname === '/v1/chat/completions' && q.method === 'POST') { let b = ''; q.on('data', (c) => (b += c)); q.on('end', () => { const body = JSON.parse(b); calls.chat.push(body); json({ choices: [{ message: { role: 'assistant', content: model(body.messages) } }] }); }); return; }
    // ---------- Modrinth ----------
    if (u.pathname === '/v2/search') { calls.search++;
      const f = JSON.parse(u.searchParams.get('facets') || '[]').flat(), type = (f.find((x) => x.startsWith('project_type:')) || '').slice(13), mc = (f.find((x) => x.startsWith('versions:')) || '').slice(9), ld = (f.find((x) => x.startsWith('categories:')) || '').slice(11);
      const pool = [...ALL.values()].filter((x) => x.type === type && !LIBS.includes(x.id)), lim = +u.searchParams.get('limit') || 20, off = hash(u.searchParams.get('query')) % Math.max(1, pool.length);
      const rot = pool.slice(off).concat(pool.slice(0, off)).slice(0, lim);
      return json({ total_hits: pool.length, hits: SUP.has(mc) || !mc ? rot.map((x) => ({ author: 'HorrorStudio', follows: 1200, icon_url: '', client_side: 'required', server_side: 'optional', date_modified: day(3), project_id: x.id, slug: x.id, project_type: x.type, title: x.title, description: x.desc, downloads: x.dl, categories: ld ? [ld] : [], versions: [mc] })) : [] }); }
    if (u.pathname === '/v2/version_files' && q.method === 'POST') { let b = ''; q.on('data', (c) => (b += c)); q.on('end', () => { const hs = JSON.parse(b).hashes || [], out = {}; calls.vfiles = (calls.vfiles || 0) + 1; for (const p of ALL.values()) { const v = verOf(p, base), h = v.files[0].hashes.sha1; if (hs.includes(h)) out[h] = v; } json(out); }); return; }
    if (u.pathname === '/v2/versions') { calls.vbyid = (calls.vbyid || 0) + 1; const ids = JSON.parse(u.searchParams.get('ids') || '[]'); return json([...ALL.values()].filter((p) => ids.includes(vid(p.id))).map((p) => verOf(p, base))); }
    if (u.pathname === '/v2/projects') { const ids = JSON.parse(u.searchParams.get('ids') || '[]'); return json(ids.map((id) => ALL.get(id)).filter(Boolean).map((p) => ({ id: p.id, slug: p.id, title: p.title, icon_url: '', project_type: p.type }))); }
    let m = /^\/v2\/project\/([\w.-]+)$/.exec(u.pathname); // карточка проекта (окно «подробности»)
    if (m) { const p = ALL.get(m[1]); if (!p) return json({}, 404); return json({ id: p.id, slug: p.id, project_type: p.type, title: p.title, description: p.desc, body: p.desc + '\n\nFeatures:\n- new mobs and atmosphere\n- configurable difficulty\n- works with other horror mods', icon_url: '', gallery: [], downloads: p.dl, followers: 4200, loaders: ['fabric', 'forge'], game_versions: ['1.20.1', '1.21.1'], license: { name: 'MIT' }, source_url: 'https://example.com/src', issues_url: 'https://example.com/issues', wiki_url: null }); }
    m = /^\/v2\/project\/([\w.-]+)\/members$/.exec(u.pathname); if (m) return json([{ role: 'Owner', user: { username: 'HorrorStudio', avatar_url: '' } }]);
    m = /^\/v2\/project\/([\w.-]+)\/version$/.exec(u.pathname);
    if (m) { calls.versions++; const p = ALL.get(m[1]); if (!p) return json([], 404);
      const gv = JSON.parse(u.searchParams.get('game_versions') || '[]'), lds = JSON.parse(u.searchParams.get('loaders') || '[]'); if (gv.length && !SUP.has(gv[0])) return json([]);
      const buf = bytesOf(p.id), dep = p.type === 'mod' && !LIBS.includes(p.id) && hash(p.id) % 4 === 0 ? [{ project_id: LIBS[hash(p.id) % 3], dependency_type: 'required' }] : [];
      return json([{ id: vid(p.id), project_id: p.id, version_type: 'release', game_versions: gv.length ? gv : ['1.20.1'], loaders: lds, dependencies: dep, name: p.title + ' 1.0', version_number: '1.0', files: [{ primary: true, filename: p.id + (p.type === 'mod' ? '.jar' : '.zip'), url: base + '/files/' + p.id, hashes: { sha1: sha1(buf) }, size: buf.length }] }]); }
    m = /^\/files\/([\w.-]+)$/.exec(u.pathname);
    if (m) { calls.files++; const buf = bytesOf(m[1]); r.writeHead(200, { 'content-type': 'application/octet-stream', 'content-length': buf.length });
      if (!slow) return r.end(buf); let i = 0; const t = setInterval(() => { if (i >= buf.length) { clearInterval(t); return r.end(); } r.write(buf.subarray(i, i += 8192)); }, slow); r.on('close', () => clearInterval(t)); return; }
    // ---------- новости Mojang ----------
    if (u.pathname === '/news.json') return json({ version: 1, entries: [
      { title: 'Майнкрафт 26.4, снимок 10', category: 'Minecraft: Java Edition', date: day(1), text: 'Мы выпустили версию 26.4 Snapshot 10, исправляющую сбой на экране многопользовательской игры.', newsPageImage: { url: IMGS[0] }, readMoreLink: 'https://www.minecraft.net/a' },
      { title: 'Майнкрафт 26.4 Снимок 9', category: 'Minecraft: Java Edition', date: day(2), text: 'Вышла версия 26.4 Snapshot 9, включающая диспенсеры, управляемые данными, Vulkan в качестве...', newsPageImage: { url: IMGS[1] }, readMoreLink: 'https://www.minecraft.net/b' },
      { title: 'Майнкрафт 26.4 Снимок 8', category: 'Minecraft: Java Edition', date: day(3), text: 'Что ж, похоже, наш Эндер Дракон кое-что забыл о полётах! В обновлении 26.4 Snapshot 8 мы исправили несколько...', newsPageImage: { url: IMGS[2] }, readMoreLink: 'https://www.minecraft.net/c' },
      { title: 'Майнкрафт 26.4 Снимок 7', category: 'Minecraft: Java Edition', date: day(5), text: 'Новый снимок уже доступен: изменения в генерации мира и исправления ошибок.', newsPageImage: { url: IMGS[0] }, readMoreLink: 'https://www.minecraft.net/d' },
    ] });
    if (u.pathname === '/v2/javaPatchNotes.json') return json({ version: 1, entries: [] });
    json({}, 404);
  }).listen(0, '127.0.0.1');
  return new Promise((res) => srv.once('listening', () => res({ srv, calls, port: srv.address().port, base: 'http://127.0.0.1:' + srv.address().port, close: () => new Promise((x) => srv.close(x)) })));
}

// ---------- сценарии «нейросети» ----------
function model(msgs) {
  const last = msgs[msgs.length - 1], text = String(last.content), hist = msgs.slice(1);
  const out = (o) => JSON.stringify(o);
  const prevPack = (() => { for (let i = hist.length - 1; i >= 0; i--) { if (hist[i].role !== 'assistant') continue; try { const j = JSON.parse(hist[i].content); if (j.pack && j.pack.mods) return j.pack; } catch {} } return null; })();
  const userAsk = [...hist].reverse().find((x) => x.role === 'user' && !x.content.startsWith('РЕЗУЛЬТАТЫ') && !x.content.startsWith('Поиск') && !x.content.startsWith('Ответ не')).content;
  const mc = /1\.21\.1/.test(userAsk) ? '1.21.1' : prevPack?.mc || '1.20.1', ld = /fabric|фабрик/i.test(userAsk) ? 'fabric' : /neoforge|нео/i.test(userAsk) ? 'neoforge' : prevPack?.loader || 'forge';
  if (/LEAKTEST/.test(text)) return out({ act: 'final', reply: 'Я Nemotron от NVIDIA, работаю через anymodel.', pack: null, hints: ['Хоррор сборка'] });
  if (/BROKENJSON/.test(text) && !msgs.some((x) => x.content.startsWith('Ответ не распознан'))) return 'Конечно! Вот сборка (без JSON) {oops';
  if (/карт/i.test(userAsk) && !text.startsWith('РЕЗУЛЬТАТЫ')) return out({ act: 'search', mc, loader: ld, queries: [{ type: 'map', q: 'horror adventure map' }] });
  if (text.startsWith('РЕЗУЛЬТАТЫ')) {
    const lines = text.split('\n'); let sec = '', mods = [], shaders = [], rp = [], maps = [];
    for (const l of lines) { const h = /^\[(\w+):/.exec(l); if (h) { sec = h[1]; continue; } const p = l.split('|'); if (p.length < 4 || !/^[\w.-]+$/.test(p[0])) continue; (sec === 'mod' ? mods : sec === 'shader' ? shaders : sec === 'resourcepack' ? rp : sec === 'map' ? maps : []).push(p[0]); }
    if (maps.length || /ПОИСК КАРТ НЕДОСТУПЕН/.test(text)) return out({ act: 'final', reply: maps.length ? 'Нашёл подходящие карты на CurseForge.' : 'Для поиска карт нужен ключ CurseForge — укажите его в настройках.', pack: null, maps: maps.slice(0, 3), hints: ['Подбери ещё карты', 'Хоррор сборка'] });
    const want = +(/на (\d+) мод/.exec(userAsk) || [])[1] || (/много/i.test(userAsk) && !/не много/i.test(userAsk) ? 60 : 30);
    let list = [...new Set(mods)]; let chosen;
    if (/Увеличь/.test(userAsk) && prevPack) chosen = [...new Set([...prevPack.mods.map((x) => x.id), ...list])].slice(0, Math.ceil(prevPack.mods.length * 1.4));
    else if (/Уменьши/.test(userAsk) && prevPack) chosen = prevPack.mods.map((x) => x.id).slice(0, Math.ceil(prevPack.mods.length * 0.65));
    else if (/Оптимизируй/.test(userAsk) && prevPack) chosen = prevPack.mods.map((x) => x.id).filter((_, i) => i % 5 !== 0);
    else if (/Пересобери/.test(userAsk) && prevPack) chosen = list.slice().reverse().slice(0, prevPack.mods.length);
    else chosen = list.slice(0, want);
    const withShader = /шейдер/i.test(userAsk) || (prevPack?.shaders?.length > 0);
    return out({ act: 'final', reply: 'Хорошо! Собрал хоррор-сборку на ' + (ld === 'forge' ? 'Forge' : ld === 'fabric' ? 'Fabric' : 'NeoForge') + ' на версии ' + mc + '. Ниже — сборка, которую вам остаётся только установить.', pack: { name: /хоррор/i.test(userAsk) ? 'Хоррор сборка' : 'Новая сборка', mc, loader: ld, mods: [...chosen, 'fakeIdNotInCatalog'], resourcepacks: [], shaders: withShader ? shaders.slice(0, 1) : [], datapacks: [] }, hints: ['Добавь шейдеры', 'Сделай на Fabric', 'Нужны ресурс-паки'] });
  }
  if (/привет|кто ты|модель/i.test(text)) return out({ act: 'final', reply: 'Привет! Я Бурмалдец — собираю сборки для Minecraft. Расскажите, какую хотите.', pack: null, hints: ['Хоррор сборка на игру с друзьями', 'Лёгкая сборка'] });
  const qs = [0, 1, 2, 3].map((i) => ({ type: 'mod', q: 'horror ' + ['monsters', 'structures', 'atmosphere', 'sounds'][i] }));
  if (/шейдер/i.test(userAsk)) qs.push({ type: 'shader', q: 'dark atmospheric' });
  return out({ act: 'search', mc, loader: ld, queries: qs });
}
module.exports = { start, MODS, SHADERS, model };
