// Код сборки: короткая строка, по которой друг получает ту же сборку из каталога (Modrinth) — каждый мод, ресурс-пак и шейдер в точной версии.
// Без сервера: в код входят название, версия игры, загрузчик и id версий файлов Modrinth (по 6 байт на файл ≈ 8 символов кода).
// Формат: «TB1-» + base64url( байты + CRC16 ). Байты: [1][загрузчик][длина mc][mc][длина имени][имя utf-8][4 счётчика varint][id версий по 6 байт].
'use strict';
const PREFIX = 'TB1-', LOADERS = ['vanilla', 'fabric', 'forge', 'neoforge'];
const ABC = '0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz'; // id версии Modrinth — 8 знаков base62 = 48 бит
const ID_RX = /^[0-9A-Za-z]{8}$/, MC_RX = /^(?!\.)(?!.*\.\.)[\w.+-]{1,32}$/;
const MAX_FILES = 600, MAX_CODE = 6000;
const SLOTS = ['mods', 'modsOff', 'resourcepacks', 'shaders'];

const idToBuf = (s) => { let n = 0n; for (const c of s) n = n * 62n + BigInt(ABC.indexOf(c)); const b = Buffer.alloc(6); for (let i = 5; i >= 0; i--) { b[i] = Number(n & 255n); n >>= 8n; } return b; };
const bufToId = (b) => { let n = 0n; for (let i = 0; i < 6; i++) n = (n << 8n) | BigInt(b[i]); let s = ''; for (let i = 0; i < 8; i++) { s = ABC[Number(n % 62n)] + s; n /= 62n; } return n === 0n ? s : null; };
const crc16 = (b) => { let c = 0xffff; for (const x of b) { c ^= x << 8; for (let k = 0; k < 8; k++) c = c & 0x8000 ? ((c << 1) ^ 0x1021) & 0xffff : (c << 1) & 0xffff; } return c; };
const cleanName = (n) => String(n || '').replace(/[\u0000-\u001f\u202a-\u202e]/g, '').trim().slice(0, 40);
const varint = (n) => { const o = []; while (n >= 128) { o.push((n & 127) | 128); n >>>= 7; } o.push(n); return Buffer.from(o); };

// p: { name, mc, loader, mods:[id], modsOff:[id], resourcepacks:[id], shaders:[id] }
function encode(p) {
  const loader = LOADERS.indexOf(p.loader); if (loader < 0) throw new Error('Загрузчик не поддерживается');
  if (!MC_RX.test(String(p.mc))) throw new Error('Неверная версия Minecraft');
  const name = Buffer.from(cleanName(p.name), 'utf8'), mc = Buffer.from(String(p.mc), 'ascii'), lists = SLOTS.map((k) => [...new Set(p[k] || [])]);
  if (lists.some((l) => l.some((x) => !ID_RX.test(x)))) throw new Error('Неподходящий id файла');
  const total = lists.reduce((n, l) => n + l.length, 0); if (!total) throw new Error('Нет файлов из каталога'); if (total > MAX_FILES) throw new Error('Слишком много файлов для кода (максимум ' + MAX_FILES + ')');
  const head = Buffer.concat([Buffer.from([1, loader, mc.length]), mc, Buffer.from([name.length]), name, ...lists.map((l) => varint(l.length))]);
  const body = Buffer.concat([head, ...lists.flatMap((l) => l.map(idToBuf))]), c = crc16(body), out = Buffer.concat([body, Buffer.from([c >> 8, c & 255])]);
  return PREFIX + out.toString('base64url');
}

function decode(text) {
  let s = String(text || '').replace(/[\s\u200b-\u200d\ufeff"'«»“”]/g, ''); if (!s) throw new Error('Вставьте код сборки');
  if (s.length > MAX_CODE) throw new Error('Это не код сборки: он слишком длинный');
  if (!/^TB\d+-/i.test(s)) throw new Error('Это не код сборки TotemLauncher (он начинается с «TB1-»)');
  if (!s.startsWith(PREFIX)) throw new Error('Код создан в более новой версии лаунчера. Обновите лаунчер (Настройки → Проверить на обновления)');
  s = s.slice(PREFIX.length); if (!/^[A-Za-z0-9_-]+$/.test(s)) throw new Error('В коде есть лишние символы. Скопируйте его целиком, без изменений');
  const b = Buffer.from(s, 'base64url'); const bad = () => new Error('Код повреждён или скопирован не полностью');
  if (b.length < 12 || b.toString('base64url') !== s) throw bad();
  const body = b.subarray(0, -2); if (crc16(body) !== ((b[b.length - 2] << 8) | b[b.length - 1])) throw bad();
  let o = 0; const need = (n) => { if (o + n > body.length) throw bad(); };
  if (body[o++] !== 1) throw new Error('Код создан в другой версии формата');
  const loader = LOADERS[body[o++]]; if (!loader) throw bad();
  const ml = body[o++]; need(ml); const mc = body.subarray(o, o + ml).toString('ascii'); o += ml; if (!MC_RX.test(mc)) throw bad();
  const nl = body[o++]; need(nl); const name = cleanName(body.subarray(o, o + nl).toString('utf8')); o += nl;
  const counts = SLOTS.map(() => { let n = 0, sh = 0; for (let i = 0; i < 4; i++) { need(1); const x = body[o++]; n |= (x & 127) << sh; sh += 7; if (x < 128) break; } return n; });
  const total = counts.reduce((a, c) => a + c, 0); if (!total || total > MAX_FILES || o + total * 6 !== body.length) throw bad();
  const r = { name, mc, loader }; SLOTS.forEach((k, i) => { r[k] = []; for (let j = 0; j < counts[i]; j++) { const id = bufToId(body.subarray(o, o + 6)); if (!id) throw bad(); r[k].push(id); o += 6; } });
  return r;
}
const count = (p) => SLOTS.reduce((n, k) => n + (p[k]?.length || 0), 0);
module.exports = { encode, decode, count, PREFIX, SLOTS, ID_RX };
