// Вход через Microsoft (device code flow) -> Xbox Live -> XSTS -> Minecraft. Пароли не запрашиваются и не хранятся.
const fs = require('fs');
const TENANT = 'https://login.microsoftonline.com/consumers/oauth2/v2.0/', SCOPE = 'XboxLive.signin offline_access';
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const J = (url, body) => fetch(url, { method: 'POST', headers: { 'Content-Type': 'application/json', Accept: 'application/json' }, body: JSON.stringify(body) });
const F = async (url, p) => (await fetch(url, { method: 'POST', headers: { 'Content-Type': 'application/x-www-form-urlencoded' }, body: new URLSearchParams(p) })).json();
const XERR = { 2148916233: 'У аккаунта нет профиля Xbox. Создайте его на xbox.com.', 2148916235: 'Xbox Live недоступен в вашей стране.', 2148916238: 'Детский аккаунт: добавьте его в семью Microsoft.' };

async function mcLogin(msToken) {
  let r = await J('https://user.auth.xboxlive.com/user/authenticate', { Properties: { AuthMethod: 'RPS', SiteName: 'user.auth.xboxlive.com', RpsTicket: 'd=' + msToken }, RelyingParty: 'http://auth.xboxlive.com', TokenType: 'JWT' });
  if (!r.ok) throw new Error('Xbox Live: HTTP ' + r.status);
  const x = await r.json();
  r = await J('https://xsts.auth.xboxlive.com/xsts/authorize', { Properties: { SandboxId: 'RETAIL', UserTokens: [x.Token] }, RelyingParty: 'rp://api.minecraftservices.com/', TokenType: 'JWT' });
  if (!r.ok) { const e = await r.json().catch(() => ({})); throw new Error(XERR[e.XErr] || 'XSTS: HTTP ' + r.status); }
  const s = await r.json();
  r = await J('https://api.minecraftservices.com/authentication/login_with_xbox', { identityToken: `XBL3.0 x=${x.DisplayClaims.xui[0].uhs};${s.Token}` });
  if (!r.ok) throw new Error('Minecraft services: HTTP ' + r.status + (r.status === 403 ? ' (приложению Azure не выдан доступ к Minecraft API)' : ''));
  const m = await r.json();
  r = await fetch('https://api.minecraftservices.com/minecraft/profile', { headers: { Authorization: 'Bearer ' + m.access_token } });
  if (r.status === 404) throw new Error('На этом аккаунте нет Minecraft Java Edition.');
  if (!r.ok) throw new Error('Профиль Minecraft: HTTP ' + r.status);
  const p = await r.json();
  return { name: p.name, uuid: p.id, token: m.access_token, expires: Date.now() + m.expires_in * 1000 };
}

class Auth {
  constructor(file, safeStorage) { this.file = file; this.ss = safeStorage; this.acc = undefined; this.mem = false; }
  _load() {
    if (this.acc !== undefined) return;
    try { this.acc = JSON.parse(this.ss.decryptString(fs.readFileSync(this.file))); } catch { this.acc = null; }
  }
  _set(a) {
    this.acc = a;
    if (this.ss.isEncryptionAvailable()) { fs.writeFileSync(this.file, this.ss.encryptString(JSON.stringify(a))); this.mem = false; } else this.mem = true; // без шифрования на диск не пишем
  }
  status() { this._load(); return { loggedIn: !!this.acc, name: this.acc?.name, memoryOnly: this.mem }; }
  logout() { this.acc = null; try { fs.unlinkSync(this.file); } catch {} }
  async login(cid, onCode, signal) {
    const dc = await F(TENANT + 'devicecode', { client_id: cid, scope: SCOPE });
    if (dc.error) throw new Error(dc.error_description || dc.error);
    onCode({ user_code: dc.user_code, verification_uri: dc.verification_uri });
    let wait = (dc.interval || 5) * 1000; const end = Date.now() + dc.expires_in * 1000;
    while (Date.now() < end) {
      await sleep(wait); if (signal.aborted) throw new Error('cancelled');
      const t = await F(TENANT + 'token', { grant_type: 'urn:ietf:params:oauth:grant-type:device_code', client_id: cid, device_code: dc.device_code });
      if (t.access_token) { this._set({ ...(await mcLogin(t.access_token)), refresh: t.refresh_token }); return this.status(); }
      if (t.error === 'authorization_pending') continue;
      if (t.error === 'slow_down') { wait += 5000; continue; }
      throw new Error(t.error_description || t.error);
    }
    throw new Error('Время ввода кода истекло');
  }
  // Актуальный аккаунт для запуска (обновляет токены при необходимости); null = не выполнен вход
  async token(cid) {
    this._load(); const a = this.acc; if (!a) return null;
    if (a.expires - Date.now() > 300000) return a;
    const t = await F(TENANT + 'token', { grant_type: 'refresh_token', client_id: cid, refresh_token: a.refresh, scope: SCOPE });
    if (!t.access_token) throw new Error('Сессия Microsoft истекла, войдите заново');
    this._set({ ...(await mcLogin(t.access_token)), refresh: t.refresh_token || a.refresh }); return this.acc;
  }
}
module.exports = Auth; module.exports.mcLogin = mcLogin;
