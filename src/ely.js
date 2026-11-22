// Ely.by: вход по Yggdrasil-API и authlib-injector (скины Ely.by видны всем на поддерживающих серверах)
'use strict';
const fs = require('fs'), path = require('path'), crypto = require('crypto');
const AUTH = 'https://authserver.ely.by/auth/', INJ = 'https://authserver.ely.by/api/authlib-injector';
const T = () => ({ signal: AbortSignal.timeout(20000) }); // без таймаута зависший сервер вешал вход навсегда
async function post(ep, body) {
  const r = await fetch(AUTH + ep, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body), ...T() }), t = await r.text(); let j = {}; try { j = JSON.parse(t); } catch {}
  if (!r.ok) { const e = new Error(j.errorMessage || 'HTTP ' + r.status); e.twofa = /two.?factor/i.test(j.errorMessage || ''); e.status = r.status; throw e; } return j;
}
async function login(user, pass, totp) { // при двухфакторке пароль передаётся как «пароль:код»
  const j = await post('authenticate', { username: user, password: totp ? `${pass}:${totp}` : pass, clientToken: crypto.randomUUID().replace(/-/g, ''), requestUser: false });
  if (!j.selectedProfile) throw new Error('У аккаунта нет профиля'); return { uuid: j.selectedProfile.id, name: j.selectedProfile.name, token: j.accessToken, clientToken: j.clientToken };
}
async function fresh(acc) { // действующий токен: проверяем, при необходимости обновляем
  try { await post('validate', { accessToken: acc.token }); return acc; } catch (e) { if (!e.status) throw e; }
  try { const j = await post('refresh', { accessToken: acc.token, clientToken: acc.clientToken }); return { ...acc, token: j.accessToken }; } catch { throw new Error('Сессия Ely.by истекла, войдите заново'); }
}
const sha256 = (b) => crypto.createHash('sha256').update(b).digest('hex');
async function ensureAgent(dir) { // authlib-injector исполняется внутри игры вместе с токеном: только https, известные хосты и ОБЯЗАТЕЛЬНАЯ проверка sha256
  const meta = await (await fetch('https://authlib-injector.yushi.moe/artifact/latest.json', { headers: { 'User-Agent': 'TotemLauncher' }, ...T() })).json(), ver = String(meta.version).replace(/[^\w.-]/g, ''), file = path.join(dir, `authlib-injector-${ver}.jar`), sum = String(meta.checksums?.sha256 || '').toLowerCase();
  if (!/^[0-9a-f]{64}$/.test(sum)) throw new Error('У authlib-injector нет контрольной суммы: запуск с аккаунтом Ely.by отменён');
  if (fs.existsSync(file)) { try { if (sha256(fs.readFileSync(file)) === sum) return file; } catch {} try { fs.unlinkSync(file); } catch {} } // кэш проверяем при каждом запуске: подменённый файл перекачивается
  const u = new URL(meta.download_url); if (u.protocol !== 'https:' || !/(^|\.)(yushi\.moe|github\.com|githubusercontent\.com)$/.test(u.hostname)) throw new Error('Небезопасная ссылка authlib-injector');
  const r = await fetch(u.href, { signal: AbortSignal.timeout(60000) }); if (!r.ok) throw new Error('authlib-injector: HTTP ' + r.status);
  const b = Buffer.from(await r.arrayBuffer()); if (b.length > 5 * 1048576) throw new Error('authlib-injector: файл слишком большой');
  if (sha256(b) !== sum) throw new Error('Контрольная сумма authlib-injector не совпала'); if (b.readUInt16BE(0) !== 0x504b) throw new Error('authlib-injector: не jar');
  fs.mkdirSync(dir, { recursive: true }); fs.writeFileSync(file + '.part', b); fs.renameSync(file + '.part', file); return file;
}
// Скин игрока с Ely.by (для главной страницы и редактора скинов): публичная система скинов, без входа
const skinCache = new Map();
async function skin(nick) {
  nick = String(nick || ''); if (!/^[\w.-]{1,32}$/.test(nick)) throw new Error('Неверный ник');
  const c = skinCache.get(nick.toLowerCase()); if (c && Date.now() - c.t < 600000) return c.v;
  const get = async (url) => { for (const base of ['https://', 'http://']) { try { return await fetch(base + url, { signal: AbortSignal.timeout(10000), headers: { 'User-Agent': 'TotemLauncher' }, redirect: 'follow' }); } catch (e) { if (base === 'http://') throw e; } } };
  let v = { none: true };
  const r = await get(`skinsystem.ely.by/textures/${encodeURIComponent(nick)}`);
  if (r && r.status === 200) {
    const j = await r.json().catch(() => ({})), s = j.SKIN;
    if (s && s.url) { const u = new URL(s.url); if (!/(^|\.)ely\.by$/.test(u.hostname)) throw new Error('Неожиданный адрес скина');
      const pr = await get(u.host + u.pathname + u.search); if (pr && pr.ok) { const b = Buffer.from(await pr.arrayBuffer()); if (b.length <= 262144 && b.length > 60 && b.readUInt32BE(0) === 0x89504e47) { const w = b.readUInt32BE(16), h = b.readUInt32BE(20); if (w === 64 && (h === 64 || h === 32)) v = { png: b.toString('base64'), model: s.metadata?.model === 'slim' ? 'slim' : 'classic', legacy: h === 32 }; } } }
  }
  skinCache.set(nick.toLowerCase(), { t: Date.now(), v }); if (skinCache.size > 50) skinCache.delete(skinCache.keys().next().value); return v;
}
async function invalidate(token, clientToken) { try { await post('invalidate', { accessToken: token, clientToken }); } catch {} } // при удалении аккаунта отзываем токен на сервере
module.exports = { login, fresh, ensureAgent, invalidate, skin, INJ };
