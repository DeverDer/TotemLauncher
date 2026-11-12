'use strict';
const $ = (id) => document.getElementById(id), esc = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const mb = (n) => (n / 1048576).toFixed(1) + ' МБ', sz2 = (n) => (n > 1048576 ? mb(n) : Math.ceil(n / 1024) + ' КБ');
const ic = (n, c = '') => `<i class="pi ${c}" style="background-image:url(${PIX.url(n)})"></i>`;
const NAME = { vanilla: 'Ванилла', forge: 'Forge', forgeopti: 'ForgeOptiFine', fabric: 'Fabric', neoforge: 'NeoForge' };
const LOAD = [['vanilla', 'grass'], ['forge', 'anvil'], ['forgeopti', 'anvil'], ['fabric', 'fabric'], ['neoforge', 'anvilo']];
const LCOL = { forge: '#b9b6e0', forgeopti: '#b9b6e0', fabric: '#e8d9bd', neoforge: '#ff7a2f' };
let SET = {}, SEL = null, V = [], AV = { forge: [], fabric: [], neoforge: [] }, INST = [], IV = [], GS = { state: 'idle' }, ACC = { accounts: [], current: null };
const isVan = (id) => !/forge|fabric/i.test(id);
// картинки каталога, которые не загрузились, просто скрываем (раньше это делал инлайновый onerror — он несовместим с CSP)
document.addEventListener('error', (e) => { if (e.target?.tagName === 'IMG' && !e.target.closest('#toast')) e.target.style.visibility = 'hidden'; }, true);
let tt = 0; const toast = (t, bad) => { const e = $('toast'); e.innerHTML = `<img src=assets/icons/${bad ? 'skeleton' : 'sword'}.png alt="">` + esc(t); e.className = 'toast show' + (bad ? ' bad' : ''); clearTimeout(tt); tt = setTimeout(() => (e.className = 'toast'), 5000); };

// ---------- эффекты кнопок: подсветка за курсором и волна при нажатии ----------
document.addEventListener('mousemove', (e) => { const t = e.target.closest?.('.btn,.fi,.ib'); if (t) { const r = t.getBoundingClientRect(); t.style.setProperty('--mx', e.clientX - r.left + 'px'); t.style.setProperty('--my', e.clientY - r.top + 'px'); } });
document.addEventListener('pointerdown', (e) => { const t = e.target.closest?.('.btn,.fi,.ib,.chip'); if (!t || t.disabled) return; const r = t.getBoundingClientRect(), d = Math.max(r.width, r.height) * 2.2, s = document.createElement('span'); s.className = 'ripple'; s.style.cssText = `width:${d}px;height:${d}px;left:${e.clientX - r.left - d / 2}px;top:${e.clientY - r.top - d / 2}px`; t.append(s); setTimeout(() => s.remove(), 700); });
// в окне Electron без рамки поле ввода иногда не получает фокус с первого клика — подстраховка
document.addEventListener('pointerdown', (e) => { const t = e.target.closest?.('input:not([type=checkbox]):not([type=range]),textarea'); if (t) setTimeout(() => { if (document.activeElement !== t) t.focus(); }, 0); }, true);
$('wmin').onclick = () => totem.winMin(); $('wclose').onclick = () => totem.close();

// ---------- вкладки с плавающей подсветкой и слайд-переходом ----------
const PAGES = ['home', 'dl', 'bl', 'sk', 'st'];
const moveInd = () => { const t = document.querySelector('.tab.on'); if (t) { $('ind').style.width = t.offsetWidth + 'px'; $('ind').style.transform = `translateX(${t.offsetLeft}px)`; } };
const hooks = { dl: () => renderDL(), bl: () => loadB(), sk: () => loadS(), st: () => { loadSettings(); fload(); } };
const go = (p) => { const i = PAGES.indexOf(p); PAGES.forEach((q, j) => { const el = $('p-' + q); el.classList.toggle('on', q === p); el.classList.toggle('left', j < i); });
  document.querySelectorAll('.tab').forEach((t) => t.classList.toggle('on', t.dataset.p === p)); document.body.classList.toggle('nobar', p === 'sk' || p === 'st'); window.setBg && setBg(p); if (typeof Vh !== 'undefined' && Vh) Vh.on = p === 'home'; if (typeof Vs !== 'undefined' && Vs) Vs.on = p === 'sk'; moveInd(); (hooks[p] || (() => {}))(); };
document.querySelectorAll('.tab').forEach((t) => (t.onclick = () => go(t.dataset.p))); window.addEventListener('resize', moveInd);

// ---------- аккаунты (только локальные) и первый вход ----------
const loadAcc = async () => { ACC = await totem.accList(); SET = await totem.getSettings(); drawAcc(); $('login').classList.toggle('off', ACC.accounts.length > 0); };
const drawAcc = () => { const cur = ACC.accounts.find((a) => a.id === ACC.current); $('accn').textContent = cur ? cur.name : 'Аккаунт';
  $('accm').innerHTML = ACC.accounts.map((a) => `<button class="mi${a.id === ACC.current ? ' on' : ''}" data-a=sw data-i="${esc(a.id)}">${ic('user')}<span>${esc(a.name)}${a.type === 'ely' ? ' <small class=mut>Ely.by</small>' : ''}</span>${a.id === ACC.current ? ic('check') : ''}<span class=x data-a=rm data-i="${esc(a.id)}" title="Удалить">${ic('x')}</span></button>`).join('')
    + `<div class=f style="padding:6px 8px;flex-wrap:nowrap"><input id=nn class=in maxlength=15 placeholder="Новый ник" style="flex:1;min-width:0"><button class="btn sm" id=nadd>${ic('plus')}</button></div><button class=mi data-a=elyadd>${ic('user')}<span>Добавить аккаунт Ely.by</span></button><button class=mi disabled>${ic('lock')}<span>Microsoft — пока недоступно</span></button>`; };
$('accb').onclick = (e) => { e.stopPropagation(); $('acc').classList.toggle('open'); };
const addAcc = async () => { const r = await totem.accAdd($('nn').value); if (!r.ok) return toast(r.error, 1); await loadAcc(); $('acc').classList.remove('open'); };
$('accm').onclick = async (e) => { e.stopPropagation(); if (e.target.closest('#nadd')) return addAcc(); const b = e.target.closest('[data-a]'); if (!b) return;
  if (b.dataset.a === 'elyadd') { $('acc').classList.remove('open'); return elyOpen(); }
  if (b.dataset.a === 'rm') { if (!(await ask('Удалить этот аккаунт? Версии и настройки останутся.', 'Удалить'))) return; await totem.accRemove(b.dataset.i); } else await totem.accSwitch(b.dataset.i); await loadAcc(); };
$('accm').onkeydown = (e) => { if (e.key === 'Enter' && e.target.id === 'nn') addAcc(); };
$('lloc').onclick = () => { $('lc1').hidden = true; $('lc2').hidden = false; $('lnick').focus(); }; $('lbk').onclick = () => { $('lc2').hidden = true; $('lc1').hidden = false; };
const lgo = async () => { const r = await totem.accAdd($('lnick').value); if (!r.ok) { $('lerr').textContent = r.error; return; } $('lerr').textContent = ''; await loadAcc(); go('home'); };
$('lgo').onclick = lgo; $('lnick').onkeydown = (e) => { if (e.key === 'Enter') lgo(); };

// ---------- выбор версии/сборки (свой выпадающий список) ----------
const selInfoOf = (q) => { if (!q) return null; if (q.k === 'i') { const i = INST.find((x) => x.id === q.id); return i && { t: i.name, v: i.mc, b: `${i.name} (${i.loader})` }; } return IV.includes(q.id) ? { t: 'Minecraft — ' + q.id, v: q.id, b: 'Vanilla' } : null; }, selInfo = () => selInfoOf(SEL);
const gIcon = (k) => (k === 'i' ? '<img class=gim src=assets/icons/bookshelf.png alt="">' : ic('grass', 'gim'));
const rowHtml = (k, id, t, s, cur = SEL) => { const on = cur && cur.k === k && cur.id === id; return `<button class="ddi${on ? ' on' : ''}" data-k=${k} data-id="${esc(id)}">${gIcon(k)}<span><b>${esc(t)}</b><small>${esc(s)}</small></span><span class=st>${on ? ic('check') : ic('minus')}</span></button>`; };
const drawDD = () => { $('l-inst').innerHTML = INST.map((i) => rowHtml('i', i.id, i.name, `${i.mc} · ${i.loader}`)).join('') || '<p class=empty>Сборок модов нет. Создайте во вкладке «Сборки».</p>';
  $('l-ver').innerHTML = IV.filter(isVan).sort().reverse().map((v) => rowHtml('v', v, 'Minecraft — ' + v, 'Ванилла')).join('') || '<p class=empty>Нет установленных версий. Откройте «Загрузки».</p>';
  const s = selInfo(); $('ddt').textContent = s ? s.t : 'Выберите версию'; $('ddi').innerHTML = gIcon(SEL ? SEL.k : 'v'); renderBar(); };
$('ddb').onclick = (e) => { e.stopPropagation(); $('dd').classList.toggle('open'); };
document.addEventListener('click', (e) => { if (!e.target.closest('.dd')) $('dd').classList.remove('open'); if (!e.target.closest('.acc')) $('acc').classList.remove('open'); });
$('seg2').onclick = (e) => { const b = e.target.closest('button'); if (!b) return; const s = +b.dataset.s; document.querySelectorAll('#seg2 button').forEach((x) => x.classList.toggle('on', x === b)); $('ind2').style.transform = `translateX(${s * 100}%)`; $('ddr').style.transform = `translateX(${-50 * s}%)`; };
const selectItem = (k, id) => { SEL = { k, id }; totem.setSettings({ selected: k + ':' + id }); drawDD(); };
$('ddm').onclick = (e) => { const b = e.target.closest('.ddi'); if (b) { selectItem(b.dataset.k, b.dataset.id); $('dd').classList.remove('open'); } };

// ---------- нижняя панель: прогресс, «Играть», «Отмена» ----------
const BUSY = ['preparing', 'downloading', 'installing', 'launching', 'playing'], LBL = { preparing: 'Подготовка', downloading: 'Загрузка', installing: 'Установка', launching: 'Запуск', playing: 'В игре' };
let doneUntil = 0;
const fmtTotal = (s) => (s < 360 ? '0 ч' : (s / 3600).toFixed(1).replace('.', ',') + ' ч');
const fmtSess = (s) => { const h = Math.floor(s / 3600), m = Math.floor((s % 3600) / 60), c = s % 60, p = (n) => String(n).padStart(2, '0'); return h ? `${h} ч ${p(m)} мин ${p(c)} с` : m ? `${m} мин ${p(c)} с` : `${c} с`; };
const tickTime = () => { const e = $('ptime'); if (e && GS.state === 'playing' && GS.since) e.textContent = fmtSess(Math.max(0, Math.floor((Date.now() - GS.since) / 1000))); };
setInterval(tickTime, 1000);
const setHtml = (el, key, html) => { if (el.dataset.k !== key) { el.dataset.k = key; el.innerHTML = html; } }; // не пересоздаём кнопку на каждый килобайт: иначе крутилка дёргается
const renderBar = () => { const s = GS.state, busy = BUSY.includes(s), pl = $('play'), si = selInfo(), stopMode = ['launching', 'playing'].includes(s) || WINS.some((w) => ['launching', 'playing'].includes(w.state)), cancelMode = !stopMode && ['preparing', 'downloading', 'installing'].includes(s);
  $('another').hidden = !WINS.some((w) => w.state === 'playing');
  pl.disabled = busy; pl.classList.toggle('busy', busy); const tot = fmtTotal(SET.playSeconds || 0); setHtml(pl, busy ? s : 'idle:' + tot, busy ? (s === 'playing' ? `${ic('check')}<span class=pt><b>В игре</b><small id=ptime></small></span>` : `<span class=spin></span>${LBL[s]}`) : `${ic('play')}<span class=pt><b>Играть</b><small>Всего в игре: ${tot}</small></span>`); tickTime();
  $('cancel').hidden = !(stopMode || cancelMode); setHtml($('cancel'), stopMode ? 'stop' : 'cancel', stopMode ? `${ic('stop')}Остановить` : `${ic('x')}Отмена`); $('track').classList.toggle('ind', ['preparing', 'installing', 'launching'].includes(s));
  let pct = 0, txt = si ? `Версия: ${si.v}   |   Сборка: ${si.b}` : 'Выберите версию в списке «Выбор сборки»', bad = false;
  if (s === 'downloading') { pct = GS.percent || 0; txt = `${GS.op || 'Загрузка'} · ${mb(GS.speed || 0)}/с · ${mb(GS.done || 0)} из ${mb(GS.total || 0)}`; }
  else if (['preparing', 'installing', 'launching'].includes(s)) txt = GS.op || LBL[s]; else if (s === 'playing') txt = 'Minecraft запущен'; else if (s === 'error') { txt = GS.error || 'Ошибка'; bad = true; } else if (Date.now() < doneUntil) { pct = 100; txt = 'Готово к работе!'; }
  $('pct').textContent = pct + '%'; $('fill').style.width = pct + '%'; $('st-t').textContent = txt; $('st-t').className = bad ? 'err' : ''; };
const refreshLists = async () => { SET = await totem.getSettings(); IV = await totem.installed(); INST = await totem.instList(); drawDD(); if ($('p-dl').classList.contains('on')) renderDL(); if ($('p-bl').classList.contains('on')) drawB(); };
const waiters = [];
totem.onGame((s) => { const was = BUSY.includes(GS.state); GS = s; if (!BUSY.includes(s.state) && was) { if (s.state === 'idle') { doneUntil = Date.now() + 4000; setTimeout(renderBar, 4100); } refreshLists(); }
  if (s.state === 'error' && s.error) toast(s.error, 1); if (s.state === 'idle' || s.state === 'error') waiters.splice(0).forEach((f) => f(s)); renderBar(); });
$('play').onclick = () => { if (!SEL) return toast('Сначала выберите версию или сборку', 1); totem.play(SEL); };
$('cancel').onclick = (e) => { e.stopPropagation(); const L = stopList(), live = L.filter((w) => ['launching', 'playing'].includes(w.state));
  if (live.length) { if (L.length === 1) return totem.winStop(L[0].id); drawStop(); return $('stopm').classList.toggle('on'); } // несколько окон — контекстное меню выбора
  if (['launching', 'playing'].includes(GS.state)) totem.stop(); else totem.cancel(); };
$('folder').onclick = () => totem.fmOpen(SEL?.k === 'i' ? 'instances/' + SEL.id : 'minecraft/game');

// ---------- несколько окон игры: список окон, меню остановки, окно «Ещё одно окно» ----------
let WINS = []; const LIVE_UI = ['preparing', 'downloading', 'installing', 'launching', 'playing'], ERRSEEN = new Set();
const stopList = () => WINS.filter((w) => LIVE_UI.includes(w.state));
const winSub = (w) => { const mins = w.since ? Math.max(0, Math.floor((Date.now() - w.since) / 60000)) : 0;
  return [`Minecraft ${w.ver}`, w.ram ? `${w.ram} МБ` : '', w.primary ? 'основное окно' : '', w.state === 'playing' ? (mins ? `в игре ${mins} мин` : 'только что запущено') : w.state === 'launching' ? 'запускается…' : w.state === 'downloading' ? `загрузка ${w.percent}%` : 'подготовка…'].filter(Boolean).join(' · '); };
const drawStop = () => { const L = stopList(); if (L.length < 2) $('stopm').classList.remove('on');
  $('stopm').innerHTML = '<div class=ctxh>Какое окно закрыть?</div>' + L.map((w) => `<button class=ctxi data-id="${esc(w.id)}">${ic('user')}<span><b>${esc(w.name || 'Игрок')}</b><small>${esc(winSub(w))}</small></span><span class=ctxa>${['playing', 'launching'].includes(w.state) ? 'Закрыть' : 'Отменить'}</span></button>`).join('') + (L.length > 1 ? `<button class="ctxi all" data-id=all>${ic('x')}<span><b>Закрыть все окна</b></span></button>` : ''); };
$('stopm').onclick = (e) => { e.stopPropagation(); const b = e.target.closest('[data-id]'); if (!b) return; if (b.dataset.id === 'all') totem.winStopAll(); else totem.winStop(b.dataset.id); $('stopm').classList.remove('on'); };
document.addEventListener('click', (e) => { if (!e.target.closest('.stopw')) $('stopm').classList.remove('on'); });
const NW = { sel: null, id: null, seen: false, mode: 0, info: null, skins: [] };
const nwErr = (t) => { $('nwerr').textContent = t || ''; };
const nwBusy = (on) => { $('winm').querySelector('.winp').classList.toggle('busy', on); $('nwgo').disabled = on; $('nwx').innerHTML = ic('x') + (on ? 'Отмена' : 'Закрыть'); };
const nwShow = (pct, text, ind) => { $('nwpct').textContent = pct + '%'; $('nwfill').style.width = pct + '%'; $('nwtrack').classList.toggle('ind', !!ind); $('nwst').textContent = text || ''; };
const drawNDD = () => { $('nl-inst').innerHTML = INST.map((i) => rowHtml('i', i.id, i.name, `${i.mc} · ${i.loader}`, NW.sel)).join('') || '<p class=empty>Сборок модов нет. Создайте во вкладке «Сборки».</p>';
  $('nl-ver').innerHTML = IV.filter(isVan).sort().reverse().map((v) => rowHtml('v', v, 'Minecraft — ' + v, 'Ванилла', NW.sel)).join('') || '<p class=empty>Нет установленных версий. Откройте «Загрузки».</p>';
  const q = selInfoOf(NW.sel); $('nddt').textContent = q ? q.t : 'Выберите версию'; $('nddi').innerHTML = gIcon(NW.sel ? NW.sel.k : 'v'); };
const nwAccount = () => (NW.mode === 1 ? ACC.accounts.find((a) => a.id === $('nwa').value) : null);
const drawRam = () => { const r = NW.info; if (!r) return; const few = r.windows < 2;
  let t = few ? `Это окно будет единственным и получит всю память из настроек — <b>${r.share} МБ</b>.` : `Память, выделенная в лаунчере (<b>${r.total} МБ</b>), делится между окнами. Окон будет: <b>${r.windows}</b>, новое окно получит <b>${r.share} МБ</b>. Уже запущенные окна сохраняют свою память — изменить её на лету нельзя.`;
  if (r.low) t += `<span class=bad>Поровну выходит меньше 1024 МБ — выделено минимальное значение. Увеличьте память в Настройках или откройте меньше окон.</span>`;
  if (r.over) t += `<span class=bad>Все окна вместе займут около ${r.used + r.share} МБ, а на компьютере доступно ${r.sys} МБ: возможны лаги и вылеты.</span>`;
  $('nwram').innerHTML = t; };
const nwSkinUi = () => { const ely = nwAccount()?.type === 'ely', off = ely || NW.info?.skinOn === false; $('nwsk').disabled = off;
  $('nwskn').textContent = ely ? 'Скин берётся с Ely.by' : NW.info?.skinOn === false ? 'Показ скинов в игре выключен в настройках' : ''; const sk = NW.skins.find((x) => x.id === $('nwsk').value) || NW.skins[0];
  if (sk) skinSrc(sk).then((src) => Skin.drawFront($('nwsc').getContext('2d'), src, sk.model === 'slim')); $('nwsc').style.opacity = off ? .35 : 1; };
const nwDup = () => { const n = NW.mode === 0 ? $('nwn').value.trim() : nwAccount()?.name || ''; const d = n && WINS.some((w) => (w.name || '').toLowerCase() === n.toLowerCase() && LIVE_UI.includes(w.state));
  $('nwdup').hidden = !d; $('nwdup').textContent = d ? 'Такой ник уже играет в другом окне: на один сервер или в один мир по сети с одинаковыми никами зайти не получится.' : ''; };
const nwMode = (m) => { NW.mode = m; const sg = $('nws'); sg.querySelectorAll('button').forEach((b) => b.classList.toggle('on', +b.dataset.s === m)); sg.querySelector('.ind2').style.transform = `translateX(${m * 100}%)`; $('nwnick').hidden = m !== 0; $('nwacc').hidden = m !== 1; nwSkinUi(); nwDup(); };
$('nws').onclick = (e) => { const b = e.target.closest('button'); if (b) nwMode(+b.dataset.s); };
$('nwn').oninput = nwDup; $('nwa').onchange = () => { nwSkinUi(); nwDup(); }; $('nwsk').onchange = nwSkinUi;
$('nddb').onclick = (e) => { e.stopPropagation(); $('ndd').classList.toggle('open'); };
$('nseg2').onclick = (e) => { const b = e.target.closest('button'); if (!b) return; const k = +b.dataset.s; document.querySelectorAll('#nseg2 button').forEach((x) => x.classList.toggle('on', x === b)); $('nind2').style.transform = `translateX(${k * 100}%)`; $('nddr').style.transform = `translateX(${-50 * k}%)`; };
$('nddm').onclick = (e) => { const b = e.target.closest('.ddi'); if (b) { NW.sel = { k: b.dataset.k, id: b.dataset.id }; drawNDD(); $('ndd').classList.remove('open'); } };
const nwOpen = async () => {
  if (NW.id) return; await refreshLists(); NW.info = await totem.winInfo(); WINS = NW.info.wins; NW.skins = [{ id: 'steve', name: 'Steve (по умолчанию)', model: 'classic' }, ...(await totem.skinsList())];
  NW.sel = SEL && selInfo() ? { ...SEL } : INST[0] ? { k: 'i', id: INST[0].id } : IV[0] ? { k: 'v', id: IV[0] } : null;
  $('nwa').innerHTML = ACC.accounts.map((a) => `<option value="${esc(a.id)}"${a.id === ACC.current ? ' selected' : ''}>${esc(a.name)}${a.type === 'ely' ? ' (Ely.by)' : ''}</option>`).join('');
  $('nwsk').innerHTML = NW.skins.map((x) => `<option value="${esc(x.id)}">${esc(x.name)}</option>`).join(''); $('nwsk').value = NW.skins.some((x) => x.id === SET.currentSkin) ? SET.currentSkin : 'steve';
  const cur = ACC.accounts.find((a) => a.id === ACC.current); $('nwn').value = [...(cur ? cur.name.replace(/_?\d*$/, '') || cur.name : 'Player')].slice(0, 13).join('') + '_2';
  $('ndd').classList.remove('open'); nwMode(0); drawNDD(); drawRam(); nwBusy(false); nwShow(0, '', false); nwErr(''); $('winm').classList.add('on'); };
const nwClose = () => { $('winm').classList.remove('on'); NW.id = null; nwBusy(false); };
$('another').onclick = nwOpen;
$('nwx').onclick = () => { if (NW.id) totem.winStop(NW.id); nwClose(); }; // во время загрузки кнопка отменяет запуск этого окна
$('nwgo').onclick = async () => {
  if (NW.id) return; nwErr(''); if (!NW.sel || !selInfoOf(NW.sel)) return nwErr('Выберите версию или сборку');
  const acc = nwAccount(), nick = $('nwn').value.trim(); if (NW.mode === 0 && !nick) return nwErr('Введите ник'); if (NW.mode === 1 && !acc) return nwErr('Выберите аккаунт');
  nwBusy(true); let skin = null;
  try { if (!(acc?.type === 'ely') && NW.info?.skinOn !== false) skin = await skinPair(NW.skins.find((x) => x.id === $('nwsk').value) || NW.skins[0]); } catch {}
  const r = await totem.winOpen({ sel: NW.sel, mode: NW.mode === 1 ? 'acc' : 'nick', nick, acc: acc?.id, skin });
  if (!r.ok) { nwBusy(false); return nwErr(r.error); } NW.id = r.id; NW.seen = false; nwShow(0, 'Подготовка…', true); nwUpdate(); };
const nwUpdate = async () => { // следим за запуском нашего окна: прогресс в меню, закрытие при старте, ошибка
  if (!NW.id) { if ($('winm').classList.contains('on')) { NW.info = await totem.winInfo(); drawRam(); nwDup(); } return; }
  const w = WINS.find((x) => x.id === NW.id);
  if (!w) { if (!NW.seen) return; nwBusy(false); NW.id = null; return nwShow(0, '', false); } // окно ещё не успело появиться в списке — ждём
  NW.seen = true;
  if (w.state === 'launching' || w.state === 'playing') return nwClose();
  if (w.state === 'error') { nwBusy(false); NW.id = null; nwShow(0, '', false); return nwErr(w.error || 'Не удалось запустить'); }
  nwShow(w.state === 'downloading' ? w.percent : 0, w.state === 'downloading' ? `${w.op || 'Загрузка'} · ${w.percent}%` : w.op || 'Подготовка…', w.state !== 'downloading'); };
totem.onWins((l) => { WINS = l; for (const w of l) if (w.state === 'error' && w.error && !ERRSEEN.has(w.id + w.error)) { ERRSEEN.add(w.id + w.error); if (w.id !== NW.id) toast(w.error, 1); }
  renderBar(); nwUpdate(); if ($('stopm').classList.contains('on')) drawStop(); });
totem.winInfo().then((r) => { WINS = r.wins; renderBar(); }).catch(() => {});
// ---------- обновления лаунчера ----------
const UPD = { s: null, manual: false, busy: false }, fmtUMb = (b) => (b / 1048576).toFixed(b >= 10485760 ? 0 : 1).replace('.', ',') + ' МБ';
const updRender = (s) => { UPD.s = s; $('updcur').textContent = s.current; $('updlast').textContent = s.latest ? s.latest : 'не проверялась';
  $('updmsg').textContent = s.error ? s.error : s.available ? 'Доступна новая версия — нажмите «Проверить на обновления», чтобы установить' : s.latest ? 'У вас установлена последняя версия' : s.supported ? '' : 'Обновления работают в установленной версии лаунчера'; $('updmsg').classList.toggle('err', !!s.error); };
const updBusy = (on) => { UPD.busy = on; $('updpr').hidden = !on; $('updgo').disabled = on; $('updlater').textContent = on ? 'Отмена' : $('updlater').dataset.t; $('updlater').hidden = !on && UPD.s?.mandatory; };
const updShow = (s, manual) => { UPD.s = s; UPD.manual = manual; $('upde').textContent = ''; $('updt').textContent = s.mandatory ? 'Требуется обновление' : 'Доступно обновление';
  $('updv').textContent = `Новая версия: ${s.latest} (у вас ${s.current})${s.size ? ' · ' + fmtUMb(s.size) : ''}. После установки лаунчер перезапустится.`;
  $('updn').hidden = !s.notes; $('updn').textContent = s.notes || '';
  const run = stopList().length > 0, w = [s.mandatory ? 'Вы уже откладывали это обновление ' + (3) + ' раза — теперь его нужно установить.' : !manual && s.skipsLeft === 1 ? 'Это последний раз, когда обновление можно отложить.' : '', run ? 'Окна Minecraft останутся открытыми, но лаунчер потеряет к ним доступ — закройте их сами.' : ''].filter(Boolean).join(' ');
  $('updw').hidden = !w; $('updw').textContent = w; $('updlater').dataset.t = s.mandatory ? '' : `Позже${!manual ? ` (осталось ${s.skipsLeft})` : ''}`; $('updgo').innerHTML = ic('dl') + 'Обновить'; updBusy(false); updNum(0, ''); $('updm').classList.add('on'); };
const updNum = (p, t) => { $('updpct').textContent = p + '%'; $('updfill').style.width = p + '%'; $('updst').textContent = t; };
$('updlater').onclick = async () => { if (UPD.busy) { totem.updCancel(); return; } if (!UPD.manual) { const s = await totem.updLater(); updRender(s); } $('updm').classList.remove('on'); };
$('updgo').onclick = async () => { $('upde').textContent = ''; updBusy(true); updNum(0, 'Подготовка…'); const r = await totem.updInstall(); if (r.ok) return updNum(100, 'Перезапуск…'); updBusy(false); if (!r.cancelled) { $('upde').textContent = r.error || 'Не удалось установить обновление'; $('updgo').innerHTML = ic('dl') + 'Повторить'; } };
totem.onUpdProgress((p) => { if (p.stage === 'download') updNum(p.percent, `Скачивание: ${fmtUMb(p.done)} из ${fmtUMb(p.total)}`); else if (p.stage === 'extract') updNum(p.percent, `Распаковка: ${p.percent}%`); else updNum(100, 'Завершение…'); });
totem.onUpdAvailable((s) => { updRender(s); updShow(s, false); });
totem.onUpdDone((d) => toast(`Лаунчер обновлён до версии ${d.version}`));
$('updchk').onclick = async () => { const b = $('updchk'); b.disabled = true; $('updmsg').textContent = 'Проверяем…'; $('updmsg').classList.remove('err'); const s = await totem.updCheck(); b.disabled = false; updRender(s); if (s.available) updShow(s, true); };
totem.updStatus().then(updRender).catch(() => {});
document.addEventListener('keydown', (e) => { if (e.key === 'Escape' && $('updm').classList.contains('on') && !UPD.s?.mandatory && !UPD.busy) $('updlater').click(); });

document.addEventListener('keydown', (e) => { if (e.key !== 'Escape') return; if ($('winm').classList.contains('on')) $('nwx').click(); else $('stopm').classList.remove('on'); });

// ---------- загрузки ----------
let DF = 'all', DQ = '', SNAP = false; const DLopt = {};
let VERR = false; const loadV = () => { VERR = false; return totem.versions().then((r) => { V = (r?.versions || []).filter((v) => /^[\w.+ -]{1,60}$/.test(String(v.id))); if ($('p-dl').classList.contains('on')) renderDL(); }).catch(() => { VERR = true; if ($('p-dl').classList.contains('on')) renderDL(); }); };
const verList = () => V.filter((v) => SNAP || v.type === 'release'), instd = (id) => IV.includes(id) || INST.some((i) => i.mc === id);
const avail = (o, id) => o === 'vanilla' || (o === 'forge' || o === 'forgeopti' ? AV.forge : AV[o]).includes(id);
const isInstalled = (id, o) => (o === 'vanilla' ? IV.includes(id) : INST.some((i) => i.mc === id && i.loader === (o === 'forgeopti' ? 'forge' : o)));
const renderDL = () => { const L = verList(), n = L.filter((v) => instd(v.id)).length; $('c-all').textContent = L.length; $('c-in').textContent = n; $('c-not').textContent = L.length - n;
  if (!V.length) setTimeout(() => { const b = $('vretry'); if (b) b.onclick = () => { b.disabled = true; loadV(); renderDL(); }; }); const q = DQ.trim().toLowerCase(), busy = BUSY.includes(GS.state), R = L.filter((v) => (DF === 'all' || (DF === 'inst') === instd(v.id)) && (!q || v.id.toLowerCase().includes(q)));
  $('vl').innerHTML = !V.length ? `<p class=empty>${VERR ? 'Не удалось загрузить каталог Mojang. Проверьте интернет.' : 'Загружаем каталог версий…'}</p>${VERR ? '<p style="text-align:center"><button class="btn" id=vretry>Повторить</button></p>' : ''}` : R.slice(0, 150).map((v, i) => {
    const o = DLopt[v.id] && avail(DLopt[v.id], v.id) ? DLopt[v.id] : 'vanilla', ins = isInstalled(v.id, o);
    const opts = LOAD.filter(([k]) => avail(k, v.id)).map(([k, icn]) => `<button class="o${k === o ? ' on' : ''}" data-o=${k} data-v="${esc(v.id)}">${ic(icn)}${NAME[k]}</button>`).join('');
    return `<div class="vrow glass" style="animation-delay:${Math.min(i, 12) * 30}ms">${ic('grass', 'vi')}<div class=vn><b>${esc(v.id)}</b><small>Вышла: ${new Date(v.releaseTime).toLocaleDateString('ru-RU')}</small></div><div class=opts>${opts}</div>`
      + `<button class="btn${ins ? ' ghost' : ''}" data-i="${esc(v.id)}" ${busy ? 'disabled' : ''}>${ins ? ic('check') + 'Проверить' : ic('dl') + 'Установить'}</button></div>`; }).join('') || '<p class=empty>Ничего не найдено</p>'; };
document.querySelectorAll('.fi').forEach((b) => (b.onclick = () => { DF = b.dataset.f; document.querySelectorAll('.fi').forEach((x) => x.classList.toggle('on', x === b)); renderDL(); }));
$('q').oninput = () => { DQ = $('q').value; renderDL(); }; $('snap').onchange = () => { SNAP = $('snap').checked; renderDL(); };
const installVer = async (id, o) => {
  if (BUSY.includes(GS.state)) return;
  if (o === 'vanilla') return totem.install(id);
  const ld = o === 'forgeopti' ? 'forge' : o; let inst = INST.find((i) => i.mc === id && i.loader === ld);
  if (!inst) { const r = await totem.instCreate({ name: `${id} ${NAME[o]}`, mc: id, loader: ld }); if (!r.ok) return toast(r.error, 1); inst = r.inst; INST = await totem.instList(); }
  selectItem('i', inst.id); const r = await totem.instInstall(inst.id); if (!r.ok) toast(r.error, 1);
  if (o === 'forgeopti') { toast('OptiFine скачивается вручную: открою сайт optifine.net. Скачайте .jar и перетащите его в «Сборки → Моды».'); totem.openOptifine(); } };
$('vl').onclick = (e) => { const c = e.target.closest('.o'); if (c) { DLopt[c.dataset.v] = c.dataset.o; return renderDL(); } const b = e.target.closest('[data-i]'); if (b) { const id = b.dataset.i; installVer(id, DLopt[id] && avail(DLopt[id], id) ? DLopt[id] : 'vanilla'); } };

// ---------- сборки: список, моды, архив, точки восстановления ----------
let cur = null, kind = 'mods';
const drawB = () => { $('bi').innerHTML = '<div class=lbl>' + ic('layers') + 'Мои сборки</div>' + (INST.map((i) => `<div class=row><span><b>${esc(i.name)}</b> <span class=mut>${esc(i.mc)} · ${esc(i.loader)}</span></span><span><button class="btn ghost sm" data-a=sel data-i="${esc(i.id)}">${ic('check')}Выбрать</button> <button class="btn ghost sm" data-a=files data-i="${esc(i.id)}">${ic('folder')}Файлы</button> <button class="btn ghost sm" data-a=copy data-i="${esc(i.id)}">${ic('copy')}Копия</button> <button class="btn red sm" data-a=del data-i="${esc(i.id)}">${ic('trash')}Удалить</button></span></div>`).join('') || '<p class=empty>Сборок пока нет. Моды ставятся в сборки: создайте сборку выше.</p>'); };
const loadB = async () => { INST = await totem.instList(); $('bv').innerHTML = V.filter((v) => v.type === 'release').map((v) => `<option>${esc(v.id)}</option>`).join(''); drawB(); drawDD(); if (cur && !INST.find((i) => i.id === cur)) cur = null; drawM(); };
const mfPass = (f) => { const v = $('mf').value; if (v === 'all' || (kind !== 'mods' && kind !== 'archive')) return true; if (v === 'on') return f.enabled; if (v === 'off') return !f.enabled; if (v === 'warn') return !!f.warn; return f.loader === v; };
const drawM = async () => { $('bm').hidden = !cur; if (!cur) return; const i = INST.find((x) => x.id === cur); $('bt2').textContent = i.name; document.querySelectorAll('.seg[data-kind]').forEach((s) => s.classList.toggle('on', s.dataset.kind === kind));
  $('mf').hidden = !(kind === 'mods' || kind === 'archive'); $('addd').hidden = !['resourcepacks', 'shaderpacks', 'saves'].includes(kind); $('bh').textContent = kind === 'archive' ? 'Моды в архиве не загружаются игрой. «Вернуть» возвращает мод в сборку.' : kind === 'saves' ? 'Здесь миры сборки (папка saves). Перетащите .zip или папку с картой сюда или скачайте карту в «Каталог → Карты».' : kind === 'shaderpacks' ? 'Шейдеры работают только с Iris или OptiFine.' : 'Перетащите файлы в это окно или нажмите «Добавить».';
  const L = (await totem.filesList(cur, kind)).filter(mfPass);
  $('bf2').innerHTML = L.map((f) => `<div class=row><span>${esc(f.title || f.name)} <span class=mut>${esc(f.version || '')}${f.enabled ? '' : ' (выключен)'}</span>${f.warn ? `<br><span class=err>Внимание: ${esc(f.warn)}</span>` : ''}</span><span class=mut>${sz2(f.size)} ${kind === 'mods' ? `<button class="btn ghost sm" data-a=tg data-n="${esc(f.name)}">${f.enabled ? 'Выкл' : 'Вкл'}</button> <button class="btn ghost sm" data-a=ar data-n="${esc(f.name)}">${ic('chest')}В архив</button>` : kind === 'archive' ? `<button class="btn ghost sm" data-a=un data-n="${esc(f.name)}">${ic('refresh')}Вернуть</button>` : ''} <button class="btn red sm" data-a=rm data-n="${esc(f.name)}">${ic('trash')}Удалить</button></span></div>`).join('') || '<p class=empty>Пусто.</p>'; drawS(); };
const drawS = async () => { if (!cur) { $('bs').innerHTML = ''; return; } const L = await totem.instSnaps(cur); $('bs').innerHTML = L.length ? '<h3>Точки восстановления</h3>' + L.map((s) => `<div class=row><span>${esc(s.label)} <span class=mut>${new Date(s.time).toLocaleString()} · модов: ${s.mods}</span></span><span><button class="btn ghost sm" data-a=rs data-s="${esc(s.id)}">${ic('refresh')}Восстановить</button> <button class="btn red sm" data-a=sd data-s="${esc(s.id)}">${ic('trash')}Удалить</button></span></div>`).join('') : ''; };
const installAndWait = async (id) => { const w = new Promise((res) => waiters.push((s) => res(s.state === 'idle'))); const r = await totem.instInstall(id); if (!r.ok) { $('be').textContent = r.error; waiters.length = 0; return false; } return w; };
const addF = async (p, force = false, dirMode = false) => { let r = await totem.filesAdd(cur, kind, p, { force, dirMode });
  if (r.needLoader) { const N = { fabric: 'Fabric', forge: 'Forge', neoforge: 'NeoForge' }[r.needLoader];
    if (!(await ask(`Эти моды для ${N}, а в сборке загрузчик не установлен. Установить ${N}? Лаунчер не закроется, ход установки виден внизу.`, 'Установить'))) { $('be').textContent = 'Установка отклонена: моды не добавлены.'; return; }
    const s = await totem.instSetLoader(cur, r.needLoader); if (!s.ok) { $('be').textContent = s.error; return; }
    const id = cur, paths = r.paths; INST = await totem.instList(); selectItem('i', id); go('home'); const ok = await installAndWait(id); go('bl'); cur = id; kind = 'mods';
    if (!ok) { $('be').textContent = `Не удалось установить ${N}: моды не добавлены.`; drawM(); return; } return addF(paths, force); }
  if (r.incompat) { const go_ = await ask('Ошибка: версия не подходит этой сборке.\n• ' + r.incompat.map((x) => x.msg).join('\n• ') + '\n\nДобавить всё равно?', 'Всё равно добавить', 'Отмена');
    if (!go_) { $('be').textContent = 'Добавление отменено: версия не подходит сборке.'; return; } return addF(r.paths, true, dirMode); }
  $('be').textContent = r.ok ? '' : r.error; drawM(); };
$('bi').onclick = async (e) => { const b = e.target.closest('button'); if (!b) return; const id = b.dataset.i, a = b.dataset.a, done = (x) => { $('be').textContent = x.ok ? '' : x.error; loadB(); };
  if (a === 'sel') { selectItem('i', id); go('home'); } if (a === 'files') { cur = id; drawM(); } if (a === 'copy') done(await totem.instCopy(id));
  if (a === 'del' && (await ask('Удалить сборку вместе со всеми её файлами (моды, миры, настройки)?', 'Удалить'))) done(await totem.instRemove(id)); };
$('bf2').onclick = async (e) => { const b = e.target.closest('button'); if (!b) return; const n = b.dataset.n, a = b.dataset.a; let r;
  if (a === 'tg') r = await totem.filesToggle(cur, n); else if (a === 'ar') r = await totem.filesArchive(cur, n); else if (a === 'un') r = await totem.filesUnarchive(cur, n); else if (await ask('Удалить «' + n + '»?', 'Удалить')) r = await totem.filesRemove(cur, kind, n); else return; $('be').textContent = r.ok ? '' : r.error; drawM(); };
$('bs').onclick = async (e) => { const b = e.target.closest('button'); if (!b) return; let r;
  if (b.dataset.a === 'rs') { if (!(await ask('Вернуть сборку (моды, ресурс-паки, шейдеры, конфиги) к этой точке? Текущее состояние сохранится в новую точку.', 'Вернуть'))) return; r = await totem.instRestore(cur, b.dataset.s); } else r = await totem.instSnapDel(cur, b.dataset.s); $('be').textContent = r.ok ? '' : r.error; drawM(); };
document.querySelectorAll('.seg[data-kind]').forEach((s) => (s.onclick = () => { kind = s.dataset.kind; drawM(); })); $('mf').onchange = drawM; $('addb').onclick = () => addF(); $('addd').onclick = () => addF(undefined, false, true); $('opnb').onclick = () => totem.instOpen(cur, kind);
$('snb').onclick = async () => { const r = await totem.instSnap(cur, 'Вручную'); $('be').textContent = r.ok ? '' : r.error; drawS(); };
$('bm').ondragover = (e) => e.preventDefault(); $('bm').ondrop = (e) => { e.preventDefault(); addF([...e.dataTransfer.files].map((f) => totem.pathFor(f))); };
$('bc').onclick = async () => { $('be').textContent = ''; if (!$('bv').value) { $('be').textContent = 'Список версий Minecraft не загружен: проверьте интернет и откройте вкладку «Загрузки».'; return; } $('bc').disabled = true; const r = await totem.instCreate({ name: $('bn').value, mc: $('bv').value, loader: $('bk').value }); $('bc').disabled = false;
  if (!r.ok) { $('be').textContent = r.error; return; } $('bn').value = ''; await loadB(); selectItem('i', r.inst.id); go('home'); installAndWait(r.inst.id); };

// ---------- скины: карточка на главной, 3D-персонаж и редактор ----------
const Vh = Skin.makeViewer($('hv'), { follow: true, auto: true, lockPitch: true }), Vs = Skin.makeViewer($('sv'), { auto: true }), tc = $('ed').getContext('2d', { willReadFrequently: true });
if (Vh) Vh.set({ rx: 0.32, z: 80, ry: 0 }); if (Vs) Vs.set({ rx: 0.22, z: 72 }); if (Vs) Vs.on = false;
let SKL = [], skIdx = 0, tool = 'pen', curSkin = null, Us = [], Rs = [], down = false, last = null, zoom = 8;
const steveCv = (slim) => { const c = document.createElement('canvas'); c.width = c.height = 64; Skin.steve(c.getContext('2d'), slim); return c; };
const skinSrc = (s) => new Promise((ok) => { if (s.id === 'steve') return ok(steveCv(false)); const im = new Image(); im.onload = () => ok(im); im.src = 'data:image/png;base64,' + s.png; });
const skinPair = async (s) => { const src = await skinSrc(s), c = document.createElement('canvas'); c.width = c.height = 64; const x = c.getContext('2d', { willReadFrequently: true }); x.drawImage(src, 0, 0);
  const d = x.getImageData(0, 0, 64, 64).data, sl = s.model === 'slim', mk = (toSlim) => { const o = Skin.convertArms(d, sl, toSlim), cc = document.createElement('canvas'); cc.width = cc.height = 64; cc.getContext('2d').putImageData(new ImageData(o, 64, 64), 0, 0); return cc.toDataURL('image/png').split(',')[1]; };
  return { wide: mk(false), slim: mk(true) }; };
const applyActive = async () => { try { const s = SKL[skIdx]; if (!s) return; const p = await skinPair(s); totem.skinApply(p.wide, p.slim); } catch {} };
const showSkin = async (dir) => { const s = SKL[skIdx] || SKL[0]; $('skname').textContent = s.name; applyActive(); if (!Vh) return; const src = await skinSrc(s); if (dir) Vh.change(src, s.model === 'slim', dir); else Vh.set({ src, slim: s.model === 'slim' }); };
const loadSkins = async () => { SKL = [{ id: 'steve', name: 'Steve (по умолчанию)', model: 'classic' }, ...(await totem.skinsList())]; SET = await totem.getSettings(); skIdx = Math.max(0, SKL.findIndex((s) => s.id === SET.currentSkin)); await showSkin(); };
const stepSkin = (d) => { if (SKL.length < 2) return; skIdx = (skIdx + d + SKL.length) % SKL.length; totem.setSettings({ currentSkin: SKL[skIdx].id }); showSkin(d); };
$('skp').onclick = () => stepSkin(-1); $('skn').onclick = () => stepSkin(1); $('skrf').onclick = loadSkins;
window.addEventListener('mousemove', (e) => { if (!Vh || !$('p-home').classList.contains('on')) return; const r = $('hv').getBoundingClientRect(), cl = (v) => Math.max(-1, Math.min(1, v));
  Vh.look(cl((e.clientX - (r.left + r.width / 2)) / (innerWidth * 0.45)), cl((e.clientY - (r.top + r.height * 0.25)) / (innerHeight * 0.45))); });
const snap = () => tc.getImageData(0, 0, 64, 64), sync = () => Vs && Vs.set({ src: $('ed') }), slim = () => $('sm').value === 'slim';
const px = (e) => { const r = $('ed').getBoundingClientRect(), c = (v) => Math.min(63, Math.max(0, v)); return [c(Math.floor((e.clientX - r.left) / r.width * 64)), c(Math.floor((e.clientY - r.top) / r.height * 64))]; };
const dot = (x, y) => { if (tool === 'er') tc.clearRect(x, y, 1, 1); else { tc.fillStyle = $('col').value; tc.fillRect(x, y, 1, 1); } };
const line = (a, b) => { let [x0, y0] = a; const [x1, y1] = b, dx = Math.abs(x1 - x0), dy = -Math.abs(y1 - y0), sx = x0 < x1 ? 1 : -1, sy = y0 < y1 ? 1 : -1; let e = dx + dy; for (;;) { dot(x0, y0); if (x0 === x1 && y0 === y1) break; const e2 = 2 * e; if (e2 >= dy) { e += dy; x0 += sx; } if (e2 <= dx) { e += dx; y0 += sy; } } };
const flood = (x, y) => { const im = snap(), d = im.data, i0 = (y * 64 + x) * 4, t = [d[i0], d[i0 + 1], d[i0 + 2], d[i0 + 3]], c = $('col').value, n = tool === 'er' ? [0, 0, 0, 0] : [parseInt(c.slice(1, 3), 16), parseInt(c.slice(3, 5), 16), parseInt(c.slice(5, 7), 16), 255];
  if (t.every((v, k) => v === n[k])) return; const st = [[x, y]], eq = (i) => d[i] === t[0] && d[i + 1] === t[1] && d[i + 2] === t[2] && d[i + 3] === t[3];
  while (st.length) { const [a, b] = st.pop(); if (a < 0 || b < 0 || a > 63 || b > 63) continue; const i = (b * 64 + a) * 4; if (!eq(i)) continue; d.set(n, i); st.push([a + 1, b], [a - 1, b], [a, b + 1], [a, b - 1]); } tc.putImageData(im, 0, 0); };
const push = () => { Us.push(snap()); if (Us.length > 50) Us.shift(); Rs = []; };
$('ed').onpointerdown = (e) => { $('ed').setPointerCapture(e.pointerId); push(); const p = px(e); if (tool === 'fill') flood(...p); else { down = true; line(p, p); last = p; } sync(); };
$('ed').onpointermove = (e) => { if (!down) return; const p = px(e); line(last, p); last = p; sync(); }; $('ed').onpointerup = () => { down = false; };
$('undo').onclick = () => { if (!Us.length) return; Rs.push(snap()); tc.putImageData(Us.pop(), 0, 0); sync(); }; $('redo').onclick = () => { if (!Rs.length) return; Us.push(snap()); tc.putImageData(Rs.pop(), 0, 0); sync(); };
document.querySelectorAll('[data-tool]').forEach((b) => (b.onclick = () => { tool = b.dataset.tool; document.querySelectorAll('[data-tool]').forEach((x) => x.classList.toggle('on', x === b)); }));
$('wrapEd').onwheel = (e) => { e.preventDefault(); zoom = Math.min(16, Math.max(3, zoom + (e.deltaY < 0 ? 1 : -1))); $('ed').style.width = $('ed').style.height = 64 * zoom + 'px'; };
$('ov').onchange = () => Vs && Vs.set({ ov: $('ov').checked }); $('sm').onchange = () => Vs && Vs.set({ slim: slim() });
const baseSkin = () => { const b = $('sb').value; if (b === 'steve') Skin.steve(tc, slim()); else if (b === 'mannequin') Skin.blank(tc, slim()); else tc.clearRect(0, 0, 64, 64); };
const loadImg = (src) => new Promise((r) => { const im = new Image(); im.onload = () => { push(); tc.clearRect(0, 0, 64, 64); tc.drawImage(im, 0, 0); sync(); r(); }; im.src = src; });
const skTab = (i) => { document.querySelectorAll('#skt button').forEach((b, j) => b.classList.toggle('on', j === i)); $('skt').querySelector('.ind2').style.transform = `translateX(${i * 100}%)`; $('skr').style.transform = `translateX(${-50 * i}%)`; };
$('skt').onclick = (e) => { const b = e.target.closest('button'); if (b) skTab(+b.dataset.s); };
$('newb').onclick = () => { push(); baseSkin(); curSkin = null; $('sn2').value = 'Новый скин'; sync(); };
$('imp').onclick = async () => { try { const r = await totem.skinImport(); if (!r.ok) { if (r.error) toast(r.error, 1); return; }
  const im = await new Promise((ok) => { const i = new Image(); i.onload = () => ok(i); i.onerror = () => ok(null); i.src = 'data:' + r.mime + ';base64,' + r.data; }); if (!im) return toast('Не удалось прочитать изображение', 1);
  const w = im.naturalWidth, hh = im.naturalHeight, cv = (W, H, f) => { const c = document.createElement('canvas'); c.width = W; c.height = H; const x = c.getContext('2d', { willReadFrequently: true }); x.imageSmoothingQuality = 'high'; f(x); return x.getImageData(0, 0, W, H).data; };
  let out = null, note = ''; if (w === 64 && hh === 64) out = cv(64, 64, (x) => x.drawImage(im, 0, 0)); else if (w === 64 && hh === 32) { out = Skin.legacy(cv(64, 32, (x) => x.drawImage(im, 0, 0))); note = 'Формат 64×32 преобразован в 64×64'; }
  else if (await ask(`Размер ${w}×${hh} не похож на скин. Преобразовать как фото? Оно будет «надето» на лицевую сторону модели, потом его можно дорисовать.`, 'Преобразовать')) { const k = Math.max(16 / w, 32 / hh); out = Skin.photo(cv(16, 32, (x) => x.drawImage(im, (16 - w * k) / 2, (32 - hh * k) / 2, w * k, hh * k))); note = 'Фото преобразовано в скин'; }
  if (!out) return; push(); tc.putImageData(new ImageData(out, 64, 64), 0, 0); const sl = Skin.isSlim(out); $('sm').value = sl ? 'slim' : 'classic'; if (Vs) Vs.set({ slim: sl }); sync(); curSkin = null; $('sn2').value = r.name;
  $('sw').textContent = note; toast(sl ? 'Скин импортирован: тонкие руки (Slim)' : 'Скин импортирован'); } catch (e) { toast('Ошибка импорта: ' + e.message, 1); } };
const b64 = () => $('ed').toDataURL('image/png').split(',')[1];
$('sav').onclick = async () => { const r = await totem.skinPut({ id: curSkin, name: $('sn2').value, model: $('sm').value, data: b64() }); if (!r.ok) return toast(r.error, 1); curSkin = r.entry.id; toast('Скин сохранён'); loadS(); skTab(0); };
$('exp').onclick = async () => { const r = await totem.skinExport($('sn2').value, b64()); if (!r.ok) toast(r.error, 1); };
$('tpl').onclick = () => { const c = document.createElement('canvas'); c.width = c.height = 64; Skin.blank(c.getContext('2d'), slim()); totem.skinExport('шаблон', c.toDataURL('image/png').split(',')[1]); };
const loadS = async () => { await loadSkins(); const cid = SET.currentSkin || 'steve';
  $('sl').innerHTML = `<div class="skc add" data-s=new><div class=skf>${ic('plus', 'big')}</div><div class=skn>Новый скин</div></div>` + SKL.map((s, i) => `<div class="skc${s.id === cid ? ' cur' : ''}" style="animation-delay:${i * 40}ms"><div class=skf><canvas width=80 height=160 data-i="${esc(s.id)}"></canvas></div><div class=skn title="${esc(s.name)}">${esc(s.name)}</div><div class=ska><button class="btn sm" data-s=use data-i="${esc(s.id)}">${ic('check')}${s.id === cid ? 'Применён' : 'Применить'}</button><button class="btn ghost sm" data-s=ed data-i="${esc(s.id)}">${ic('pen')}Править</button>${s.id === 'steve' ? '' : `<button class="btn red sm" data-s=del data-i="${esc(s.id)}">${ic('trash')}</button>`}</div></div>`).join('');
  for (const c of $('sl').querySelectorAll('canvas[data-i]')) { const s = SKL.find((x) => x.id === c.dataset.i); skinSrc(s).then((src) => Skin.drawFront(c.getContext('2d'), src, s.model === 'slim')); } };
$('sl').onclick = async (e) => { const b = e.target.closest('[data-s]'); if (!b) return; const id = b.dataset.i, act = b.dataset.s, s = SKL.find((x) => x.id === id);
  if (act === 'new') { push(); baseSkin(); curSkin = null; $('sn2').value = 'Новый скин'; sync(); skTab(1); }
  if (act === 'ed') { if (id === 'steve') { push(); Skin.steve(tc, false); sync(); curSkin = null; $('sn2').value = 'Steve (копия)'; $('sm').value = 'classic'; } else { await loadImg('data:image/png;base64,' + s.png); curSkin = id; $('sn2').value = s.name; $('sm').value = s.model; }
    if (Vs) Vs.set({ slim: slim() }); skTab(1); }
  if (act === 'use') { await totem.setSettings({ currentSkin: id }); loadS(); }
  if (act === 'del' && (await ask('Удалить скин «' + s.name + '»?', 'Удалить'))) { await totem.skinRemove(id); if (curSkin === id) curSkin = null; if (SET.currentSkin === id) await totem.setSettings({ currentSkin: '' }); loadS(); } };

// ---------- настройки, хранилище, файловый менеджер ----------
const ramUp = () => { const r = $('ram'); r.style.setProperty('--p', ((r.value - r.min) / (r.max - r.min) * 100) + '%'); $('ramv').textContent = r.value + ' МБ' + (+r.value >= +r.max ? ' (максимум)' : ''); };
const loadSettings = async () => { SET = await totem.getSettings(); document.querySelectorAll('[data-k]').forEach((e) => { const v = SET[e.dataset.k]; e.type === 'checkbox' ? (e.checked = !!v) : (e.value = v || ''); });
  const r = $('ram'); r.min = 1024; r.max = SET.maxRam; r.step = 256; r.value = Math.min(SET.ram, SET.maxRam); $('ramh').textContent = `Доступно на этом компьютере до ${SET.maxRam} МБ (1 ГБ остаётся системе)`; ramUp(); document.body.classList.toggle('noanim', SET.anim === false);
  drawBgp(); const i = await totem.storageInfo(); $('pth').textContent = i.path; $('sz').textContent = mb(i.bytes); };
$('ram').oninput = ramUp; $('ram').onchange = async () => { const x = await totem.setSettings({ ram: +$('ram').value }); $('se').textContent = x.ok ? '' : x.error; };
document.querySelectorAll('[data-k]').forEach((e) => (e.onchange = async () => { const v = e.type === 'checkbox' ? e.checked : e.type === 'number' ? (+e.value || 0) : e.value; const r = await totem.setSettings({ [e.dataset.k]: v }); $('se').textContent = r.ok ? '' : r.error; if (r.ok) loadSettings(); }));
$('opn').onclick = () => totem.storageOpen(); $('cln').onclick = async () => { const r = await totem.storageClean(); $('se').textContent = r.ok ? 'Освобождено ' + mb(r.freed) : r.error; loadSettings(); };
let fcur = '', fsel = null, clip = null; const J = (a, b) => (a ? a + '/' + b : b);
const fload = async () => { fsel = null; const r = await totem.fmList(fcur); if (!r.ok) { $('fe').textContent = r.error; return; } $('fp').textContent = '…/' + fcur;
  $('fl').innerHTML = r.r.map((f) => `<div class=row data-n="${esc(f.name)}" data-d=${f.dir ? 1 : 0}><span>${ic(f.dir ? 'folder' : 'info')} ${esc(f.name)}</span><span class=mut>${esc(f.type)}${f.size == null ? '' : ' · ' + sz2(f.size)} · ${new Date(f.mtime).toLocaleString()}</span></div>`).join('') || '<p class=empty>Папка пуста</p>'; };
const fdo = async (p) => { const r = await p; $('fe').textContent = r.ok ? '' : r.error; fload(); };
$('fl').onclick = (e) => { const r = e.target.closest('.row'); if (!r) return; $('fl').querySelectorAll('.row').forEach((x) => x.classList.remove('sel')); r.classList.add('sel'); fsel = r.dataset.n; $('fn').value = fsel; };
$('fl').ondblclick = (e) => { const r = e.target.closest('.row'); if (r && r.dataset.d === '1') { fcur = J(fcur, r.dataset.n); fload(); } };
document.querySelectorAll('[data-go]').forEach((c) => (c.onclick = () => { fcur = c.dataset.go; fload(); }));
$('fup').onclick = () => { fcur = fcur.split('/').slice(0, -1).join('/'); fload(); }; $('frf').onclick = fload;
const need = () => { if (!fsel) { $('fe').textContent = 'Выберите файл или папку'; return false; } return true; };
$('fmk').onclick = () => fdo(totem.fmMkdir(fcur, $('fn').value)); $('frn').onclick = () => need() && fdo(totem.fmRename(J(fcur, fsel), $('fn').value));
$('fcp').onclick = () => { if (need()) { clip = { m: 'cp', p: J(fcur, fsel) }; $('fcb').textContent = 'Буфер (копия): ' + fsel; } }; $('fct').onclick = () => { if (need()) { clip = { m: 'mv', p: J(fcur, fsel) }; $('fcb').textContent = 'Буфер (перенос): ' + fsel; } };
$('fps').onclick = () => { if (!clip) { $('fe').textContent = 'Буфер пуст'; return; } const c = clip; if (c.m === 'mv') { clip = null; $('fcb').textContent = ''; } fdo(c.m === 'cp' ? totem.fmCopy(c.p, fcur) : totem.fmMove(c.p, fcur)); };
$('fdl').onclick = async () => { if (need() && (await ask('Удалить «' + fsel + '» без возможности восстановления?', 'Удалить'))) fdo(totem.fmRemove(J(fcur, fsel))); };
$('faf').onclick = () => fdo(totem.fmAdd(fcur, null, false)); $('fad').onclick = () => fdo(totem.fmAdd(fcur, null, true)); $('fox').onclick = () => totem.fmOpen(fcur);
$('fmp').ondragover = (e) => e.preventDefault(); $('fmp').ondrop = (e) => { e.preventDefault(); fdo(totem.fmAdd(fcur, [...e.dataTransfer.files].map((f) => totem.pathFor(f)))); };

// ---------- подтверждение, Telegram, ярлык, фон главной, скриншоты ----------
const ask = (text, ok = 'Да', no = 'Отмена') => new Promise((res) => { $('askt').textContent = text; $('askok').innerHTML = ic('check') + ok; $('askno').innerHTML = ic('x') + (no || ''); $('askno').hidden = no === null; $('askm').classList.add('on');
  const done = (v) => { $('askm').classList.remove('on'); $('askok').onclick = $('askno').onclick = null; res(v); }; $('askok').onclick = () => done(true); $('askno').onclick = () => done(false); });
$('qtg').onclick = async () => { if (!(await ask('Вы уверены, что хотите перейти в официальный Telegram-канал лаунчера?', 'Перейти'))) return; const r = await totem.tgOpen(); if (!r.ok) toast('Не удалось открыть Telegram: ' + r.error, 1); };
$('mklnk').onclick = async () => { const r = await totem.shortcutCreate(); toast(r.ok ? 'Ярлык создан на рабочем столе' : 'Не удалось создать ярлык: ' + r.error, !r.ok); };
const BGN = { village: 'Деревня на рассвете', cave: 'Пещера', cabin: 'Домик ночью', fireplace: 'Камин', sunset: 'Закат со Стивом' };
const drawBgp = () => { $('bgp').innerHTML = Object.entries(BGN).map(([k, n]) => `<button class="bgt${(SET.bgHome || 'village') === k ? ' on' : ''}" data-b=${k} style="background-image:url(assets/bg/${BG_FILES[k]})"><span>${n}</span></button>`).join(''); };
$('bgp').onclick = async (e) => { const b = e.target.closest('[data-b]'); if (!b) return; const r = await totem.setSettings({ bgHome: b.dataset.b }); if (!r.ok) return toast(r.error, 1); SET.bgHome = b.dataset.b; setHomeBg(b.dataset.b); drawBgp(); toast('Фон главного меню изменён'); };
let SH = [], SHV = [], shq = '', shd = '', lbi = -1;
const fmtDate = (t) => new Date(t).toLocaleString('ru-RU', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' });
const localDay = (t) => { const d = new Date(t), p = (n) => String(n).padStart(2, '0'); return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}`; };
const io = new IntersectionObserver((es) => es.forEach(async (e) => { if (!e.isIntersecting) return; io.unobserve(e.target); const u = await totem.shotsThumb(e.target.dataset.r); if (u) e.target.src = u; }), { root: $('shbody'), rootMargin: '240px' });
const drawShots = () => { const q = shq.trim().toLowerCase(); SHV = SH.filter((s) => (!q || s.name.toLowerCase().includes(q) || fmtDate(s.mtime).toLowerCase().includes(q) || localDay(s.mtime).includes(q)) && (!shd || localDay(s.mtime) === shd));
  $('sg').innerHTML = SHV.map((s, i) => `<div class=shc style="animation-delay:${Math.min(i, 10) * 30}ms"><div class=sht data-a=view data-i=${i}><img data-r="${esc(s.rel)}" alt=""></div><div class=shn title="${esc(s.name)}">${esc(s.name)}</div><div class=mut style="font-size:12px">${fmtDate(s.mtime)} · ${esc(s.src)}</div>
    <div class=ska><button class="btn ghost sm" data-a=ren data-i=${i} title="Переименовать">${ic('pen')}</button><button class="btn ghost sm" data-a=sv data-i=${i} title="Скачать">${ic('dl')}</button><button class="btn ghost sm" data-a=fl data-i=${i} title="Показать в папке">${ic('folder')}</button><button class="btn red sm" data-a=rm data-i=${i} title="Удалить">${ic('trash')}</button></div></div>`).join('') || '<p class=empty>Скриншотов нет. В игре они делаются клавишей F2.</p>';
  $('sg').querySelectorAll('img[data-r]').forEach((im) => io.observe(im)); };
const loadShots = async () => { const r = await totem.shotsList(); SH = r.ok ? r.r : []; drawShots(); };
$('qshot').onclick = () => { $('shm').classList.add('on'); loadShots(); }; $('shx').onclick = () => $('shm').classList.remove('on');
$('shq').oninput = () => { shq = $('shq').value; drawShots(); }; $('shd').onchange = () => { shd = $('shd').value; drawShots(); };
const openLb = async (i) => { if (!SHV.length) return; lbi = (i + SHV.length) % SHV.length; const s = SHV[lbi], u = await totem.shotsFull(s.rel); if (!u) return toast('Не удалось открыть файл', 1); $('lbi').src = u; $('lbc').textContent = `${s.name} · ${fmtDate(s.mtime)}`; $('lb').classList.add('on'); };
$('lbp').onclick = () => openLb(lbi - 1); $('lbr').onclick = () => openLb(lbi + 1); $('lbx').onclick = () => $('lb').classList.remove('on'); $('lb').onclick = (e) => { if (e.target === $('lb')) $('lb').classList.remove('on'); };
$('sg').onclick = async (e) => { const b = e.target.closest('[data-a]'); if (!b) return; const s = SHV[+b.dataset.i], act = b.dataset.a; if (!s) return;
  if (act === 'view') return openLb(+b.dataset.i); if (act === 'fl') return totem.shotsReveal(s.rel);
  if (act === 'sv') { const r = await totem.shotsSave(s.rel); if (!r.ok) toast(r.error, 1); return; }
  if (act === 'rm') { if (await ask(`Удалить скриншот «${s.name}»? Файл будет перемещён в корзину.`, 'Удалить')) { const r = await totem.shotsRemove(s.rel); if (!r.ok) toast(r.error, 1); loadShots(); } return; }
  if (act === 'ren') { const el = b.closest('.shc').querySelector('.shn'); el.innerHTML = `<input class=in value="${esc(s.name.replace(/\.[^.]+$/, ''))}" style="width:100%">`; const inp = el.firstChild; inp.focus(); inp.select();
    inp.onkeydown = async (ev) => { if (ev.key === 'Enter') { const r = await totem.shotsRename(s.rel, inp.value); if (!r.ok) toast(r.error, 1); loadShots(); } else if (ev.key === 'Escape') drawShots(); }; } };
document.addEventListener('keydown', (e) => { if (e.key === 'Escape') { if ($('lb').classList.contains('on')) $('lb').classList.remove('on'); else if ($('askm').classList.contains('on')) $('askno').click(); else if ($('shm').classList.contains('on')) $('shm').classList.remove('on'); }
  else if ($('lb').classList.contains('on')) { if (e.key === 'ArrowLeft') openLb(lbi - 1); if (e.key === 'ArrowRight') openLb(lbi + 1); } });

// ---------- Ely.by ----------
const elyOpen = () => { $('elym').classList.add('on'); $('elyt').hidden = true; $('elyt').value = ''; $('elye').textContent = ''; $('elyu').focus(); };
$('lely').onclick = elyOpen; $('elyx').onclick = () => $('elym').classList.remove('on');
$('elygo').onclick = async () => { $('elygo').disabled = true; const r = await totem.elyLogin($('elyu').value.trim(), $('elyp').value, $('elyt').hidden ? '' : $('elyt').value.trim()); $('elygo').disabled = false;
  if (r.ok) { $('elym').classList.remove('on'); $('elyp').value = ''; await loadAcc(); go('home'); toast('Аккаунт Ely.by добавлен'); }
  else if (r.need2fa) { $('elyt').hidden = false; $('elyt').focus(); $('elye').textContent = 'Введите код двухфакторной защиты'; } else $('elye').textContent = r.error; };
$('elysk').onclick = () => { totem.openUrl('https://ely.by/skins'); toast('Скин, загруженный на Ely.by, видят все игроки на серверах с поддержкой Ely.by. Войдите в лаунчере аккаунтом Ely.by, чтобы играть с ним.'); };
$('cfget').onclick = () => totem.openUrl('https://console.curseforge.com/');

// ---------- каталог (Modrinth + CurseForge) ----------
const CTYPES = [['mod', 'Моды'], ['resourcepack', 'Ресурс-паки'], ['shader', 'Шейдеры'], ['datapack', 'Датапаки'], ['modpack', 'Сборки'], ['map', 'Карты']];
const MAPCATS = [['', 'Все'], ['adventure', 'Приключения'], ['survival', 'Выживание'], ['parkour', 'Паркур'], ['puzzle', 'Головоломки'], ['minigame', 'Мини-игры'], ['building', 'Постройки'], ['horror', 'Хоррор']];
const CT = { type: 'mod', q: '', mc: '', loader: '', sort: 'pop', mapCat: '', off: 0, items: [], total: 0, busy: false };
const fmtNum = (n) => (n >= 1e6 ? (n / 1e6).toFixed(1).replace('.', ',') + ' млн' : n >= 1e3 ? (n / 1e3).toFixed(1).replace('.', ',') + ' тыс.' : String(n || 0));
const cssUrl = (u) => `url("${encodeURI(String(u)).replace(/["']/g, '%22')}")`;
const mdText = (s) => String(s || '').replace(/!\[[^\]]*\]\([^)]*\)/g, '').replace(/<[^>]+>/g, '').replace(/\[([^\]]+)\]\([^)]*\)/g, '$1').replace(/[#*_`>~]/g, '').replace(/\n{3,}/g, '\n\n').trim();
const catOv = (k, t = '') => { const o = $('catov'); o.classList.toggle('on', !!k); if (!k) return; if (k !== 'load') $('catmore').hidden = true; // кнопка «Показать ещё» просвечивала сквозь окно ошибки/ключа
  o.innerHTML = k === 'load' ? '<div class=bigspin></div><b>Загрузка каталога…</b>' : k === 'off' ? `<div class=empty style="padding:0"></div><b>Нет подключения к интернету</b><span class=mut>Каталог работает только онлайн.</span><button class=btn id=catrf>${ic('refresh')}Обновить</button>`
    : k === 'key' ? `<b>${t ? 'Ключ CurseForge не подошёл' : 'Нужен API-ключ CurseForge'}</b><span class="${t ? 'err' : 'mut'}" style="max-width:520px">${esc(t || 'Карты скачиваются с CurseForge. Получите бесплатный ключ на console.curseforge.com и вставьте сюда.')}</span><div class=f style="justify-content:center"><input id=catkey type=password class=in placeholder="API-ключ" size=40><button class=btn id=catkeyok>${ic('check')}Сохранить</button></div><button class="btn ghost sm" id=catkeyget>Получить ключ</button>`
    : `<b class=err>Не удалось загрузить каталог</b><span class=mut>${esc(t)}</span><button class=btn id=catrf>${ic('refresh')}Повторить</button>`;
  const rf = $('catrf'); if (rf) rf.onclick = () => catLoad(true); const ok = $('catkeyok'); if (ok) ok.onclick = async () => { ok.disabled = true; const r = await totem.setSettings({ curseforgeKey: $('catkey').value }); if (!r.ok) { ok.disabled = false; return toast(r.error, 1); } const c = await totem.cfCheck($('catkey').value); ok.disabled = false; if (!c.ok) { if (c.offline) return toast('Нет подключения к интернету', 1); return catOv('key', c.error); } SET.curseforgeKey = (await totem.getSettings()).curseforgeKey; toast('Ключ принят'); catLoad(true); };
  const kg = $('catkeyget'); if (kg) kg.onclick = () => totem.openUrl('https://console.curseforge.com/'); };
const card = (it, i) => `<div class="cc glass" data-i=${i} style="animation-delay:${Math.min(i % 20, 10) * 25}ms"><div class=cbn style='${it.images?.[0] || it.icon ? 'background-image:' + cssUrl(it.images?.[0] || it.icon) : ''}'></div><div class=cbd><div class=ch><img class=cic src="${esc(it.icon || '')}" alt=""><div><b>${esc(it.title)}</b><span class=mut>${esc(it.author || '')}</span></div></div>
  <p class=cds>${esc(it.desc || '')}</p><div class=cm>${(it.loaders || []).map((l) => `<span class=tag>${esc(l)}</span>`).join('')}${it.mcs?.length ? `<span class=tag>${esc(it.mcs.join(', '))}</span>` : ''}</div>
  <div class=cf><span class=mut style="display:flex;gap:6px;align-items:center">${ic('dl')}${fmtNum(it.downloads)}</span>${dlBtn(it, i)}</div></div></div>`;
let HAVE = {}; // id сборки -> ключи проектов, уже лежащих в ней
const keyOf = (it) => `${it.src === 'cf' ? 'cf' : 'mr'}:${it.id}`;
const inWhere = (it) => (it.type === 'modpack' ? [] : INST.filter((i) => (HAVE[i.id] || []).includes(keyOf(it))));
const haveAll = (it) => it.type !== 'datapack' && INST.length > 0 && inWhere(it).length === INST.length; // скачан во всех сборках — кнопка блокируется
const dlBtn = (it, i) => (haveAll(it) ? `<button class="btn sm ghost" disabled data-have=1>${ic('check')}Уже скачан</button>` : `<button class="btn sm" data-d=${i}>${ic('dl')}Скачать</button>`);
const refreshHave = async () => { const r = await totem.catInstalled().catch(() => null); if (r?.ok) HAVE = r.r; };
const drawCat = () => { $('catg').innerHTML = CT.items.map(card).join('') || '<p class=empty>Ничего не найдено</p>'; $('catmore').hidden = CT.items.length >= CT.total; };
const catLoad = async (reset = true) => { if (CT.busy) return; CT.busy = true; if (reset) { CT.off = 0; CT.items = []; $('catg').innerHTML = ''; catOv('load'); }
  const r = await totem.catSearch({ type: CT.type, q: CT.q, mc: CT.mc, loader: CT.loader, sort: CT.sort, mapCat: CT.mapCat, offset: CT.off }); CT.busy = false;
  if (!r.ok) { if (r.needKey) catOv('key'); else if (r.cfAuth) catOv('key', r.error); else if (r.offline) catOv('off'); else catOv('err', r.error); return; }
  catOv(''); CT.total = r.total || 0; CT.items.push(...r.hits); CT.off = CT.items.length; drawCat(); };
const catUi = () => { $('ctabs').innerHTML = CTYPES.map(([k, n]) => `<span class="seg${CT.type === k ? ' on' : ''}" data-t=${k}>${n}</span>`).join(''); $('catl').hidden = !['mod', 'modpack'].includes(CT.type);
  $('catmc').hidden = CT.type !== 'map'; $('catmc').innerHTML = MAPCATS.map(([k, n]) => `<span class="chip${CT.mapCat === k ? ' on' : ''}" data-m="${k}">${n}</span>`).join(''); };
$('ctabs').onclick = (e) => { const b = e.target.closest('[data-t]'); if (!b) return; CT.type = b.dataset.t; CT.mapCat = ''; catUi(); catLoad(); };
$('catmc').onclick = (e) => { const b = e.target.closest('[data-m]'); if (!b) return; CT.mapCat = b.dataset.m; catUi(); catLoad(); };
let ctt = 0; $('catq').oninput = () => { clearTimeout(ctt); ctt = setTimeout(() => { CT.q = $('catq').value; catLoad(); }, 350); };
$('catv').onchange = () => { CT.mc = $('catv').value; catLoad(); }; $('catl').onchange = () => { CT.loader = $('catl').value; catLoad(); }; $('cats').onchange = () => { CT.sort = $('cats').value; catLoad(); }; $('catmore').onclick = () => catLoad(false);
$('qcat').onclick = async () => { await refreshHave(); $('catv').innerHTML = '<option value="">Любая версия</option>' + V.filter((v) => v.type === 'release').slice(0, 60).map((v) => `<option${CT.mc === v.id ? ' selected' : ''}>${esc(v.id)}</option>`).join(''); catUi(); $('catm').classList.add('on'); if (!CT.items.length) catLoad(); else drawCat(); };
$('catx').onclick = () => $('catm').classList.remove('on'); $('catdx').onclick = () => $('catd').classList.remove('on');
// окно прогресса
const busyOn = (t) => { $('busyt').textContent = t; $('busyf').style.width = '100%'; $('busyf').parentElement.classList.add('ind'); $('busym').classList.add('on'); }; const busyOff = () => $('busym').classList.remove('on');
totem.onCatProgress((p) => { if (!$('busym').classList.contains('on')) return; $('busyt').textContent = p.text || 'Скачивание…'; const tr = $('busyf').parentElement; tr.classList.toggle('ind', !p.pct); $('busyf').style.width = p.pct ? p.pct + '%' : '100%'; });
const pickInstance = (it) => new Promise((res) => { const done = (v) => { $('pickm').classList.remove('on'); res(v); };
  $('pickl').innerHTML = INST.map((i) => { const bad = it.loaders?.length && ['mod'].includes(it.type) && !it.loaders.includes(i.loader), has = (HAVE[i.id] || []).includes(keyOf(it)) && it.type !== 'modpack'; return `<button class=row data-i="${esc(i.id)}" ${has ? 'disabled' : ''} style="width:100%;border:0;background:transparent;color:inherit;font:inherit;cursor:${has ? 'not-allowed' : 'pointer'};text-align:left;opacity:${has ? .5 : 1}">${gIcon('i')}<span style="flex:1"><b>${esc(i.name)}</b><small class=mut style="display:block">Minecraft ${esc(i.mc)} · ${esc(i.loader)}${has ? ' · уже скачан' : bad ? ' · загрузчик может не подойти' : ''}</small></span></button>`; }).join('') || '<p class=empty>Сначала создайте сборку (вкладка «Сборки»).</p>';
  $('pickl').onclick = (e) => { const b = e.target.closest('[data-i]:not([disabled])'); if (b) done(INST.find((x) => x.id === b.dataset.i)); }; $('pickx').onclick = () => done(null); $('pickm').classList.add('on'); });
const pickWorld = (inst, it, worlds) => new Promise((res) => { const done = (v) => { $('pickm').classList.remove('on'); $('pickt').textContent = 'Выберите сборку'; res(v); };
  $('pickt').textContent = 'В какой мир поставить датапак?';
  $('pickl').innerHTML = worlds.map((w) => { const has = (HAVE[inst.id] || []).includes(keyOf(it) + '@' + w.name); return `<button class=row data-w="${esc(w.name)}" ${has ? 'disabled' : ''} style="width:100%;border:0;background:transparent;color:inherit;font:inherit;cursor:${has ? 'not-allowed' : 'pointer'};text-align:left;opacity:${has ? .5 : 1}">${gIcon('i')}<span style="flex:1"><b>${esc(w.name)}</b><small class=mut style="display:block">${has ? 'уже скачан в этом мире' : 'мир'}</small></span></button>`; }).join('');
  $('pickl').onclick = (e) => { const b = e.target.closest('[data-w]:not([disabled])'); if (b) done(b.dataset.w); }; $('pickx').onclick = () => done(null); $('pickm').classList.add('on'); });
const catFail = async (r, it) => { if (r.manual) { if (await ask('Автор запретил скачивание вне CurseForge. Открыть страницу карты в браузере?', 'Открыть')) totem.openUrl(r.manual); } else if (r.needKey || r.cfAuth) toast(r.cfAuth ? r.error : 'Укажите API-ключ CurseForge в Настройках → Каталог', 1); else if (r.offline) toast('Нет подключения к интернету', 1); else toast(r.error || 'Ошибка', 1); };
const catPack = async (it) => { if (!(await ask(`Установить сборку «${it.title}» как новую сборку? Лаунчер скачает файлы сборки и нужную версию игры с загрузчиком.`, 'Установить'))) return;
  busyOn('Скачиваем сборку…'); const r = await totem.catPack({ id: it.id, title: it.title, mc: CT.mc, loader: CT.loader }); busyOff(); if (!r.ok) return catFail(r, it);
  INST = await totem.instList(); selectItem('i', r.inst.id); $('catm').classList.remove('on'); $('catd').classList.remove('on'); go('home'); installAndWait(r.inst.id); };
const catDownload = async (it) => { if (it.type === 'modpack') return catPack(it); const inst = await pickInstance(it); if (!inst) return;
  let world = ''; if (it.type === 'datapack') { const worlds = (await totem.filesList(inst.id, 'saves')).filter((f) => f.isDir); if (!worlds.length) return toast('В сборке «' + inst.name + '» нет миров. Создайте мир в игре и повторите: датапак ставится внутрь мира.', 1); world = await pickWorld(inst, it, worlds); if (!world) return; }
  busyOn('Проверяем совместимость…'); const pl = await totem.catPlan({ src: it.src, id: it.id, type: it.type, inst: inst.id, world }); busyOff(); if (!pl.ok) return catFail(pl, it);
  if (!pl.exact && !(await ask(`${pl.warn}\n\nВсё равно скачать?`, 'Всё равно скачать'))) return;
  let deps = false; if (pl.deps?.length) deps = await ask(`Для «${pl.title}» нужны дополнительные моды:\n• ${pl.deps.map((d) => d.title).join('\n• ')}`, 'Установить все зависимости автоматически', 'Понял');
  busyOn('Скачиваем…'); const r = await totem.catInstall({ src: it.src, id: it.id, type: it.type, inst: inst.id, deps, world }); busyOff(); if (!r.ok) return catFail(r, it);
  toast(`В «${inst.name}» установлено: ${r.installed.join(', ')}.${r.note ? ' ' + r.note : ''}`); await refreshHave(); drawCat(); if ($('catd').classList.contains('on') && CT.open) markDetail(CT.open); if (cur === inst.id) drawM(); };
$('catg').onclick = async (e) => { const d = e.target.closest('[data-d]'); if (d) return catDownload(CT.items[+d.dataset.d]); const c = e.target.closest('.cc'); if (c) openDetail(CT.items[+c.dataset.i]); };
const markDetail = (it) => { const b = $('catdd'); if (!b || it.type === 'modpack') return; const h = haveAll(it); b.disabled = h; b.classList.toggle('ghost', h); b.innerHTML = h ? ic('check') + 'Уже скачан' : ic('dl') + 'Скачать'; };
const openDetail = async (it) => { $('catd').classList.add('on'); $('catdb').innerHTML = '<div style="display:grid;place-items:center;height:100%"><div class=bigspin></div></div>';
  const r = await totem.catProject({ src: it.src, id: it.id }); if (!r.ok) { $('catdb').innerHTML = `<p class=empty>${r.offline ? 'Нет подключения к интернету' : esc(r.error)}</p>`; return; } const p = r.p, imgs = p.gallery.length ? p.gallery.map((g) => g.url) : (p.icon ? [p.icon] : []);
  $('catdb').innerHTML = `<div class=ch style="margin:0 0 8px"><img class=cic src="${esc(p.icon || '')}" alt="" style="width:64px;height:64px"><div><b style="font-size:22px">${esc(p.title)}</b><span class=mut>${esc(p.team.map((t) => t.name).join(', '))}</span></div></div>
  ${imgs.length ? `<img class=galm id=galm src="${esc(imgs[0])}" alt=""><div class=gal>${imgs.map((u) => `<img src="${esc(u)}" data-g="${esc(u)}" alt="">`).join('')}</div>` : ''}
  <p style="margin:6px 0">${esc(p.desc || '')}</p><div class=cm style="margin-bottom:8px">${p.loaders.map((l) => `<span class=tag>${esc(l)}</span>`).join('')}<span class=tag>Скачиваний: ${fmtNum(p.downloads)}</span>${p.license ? `<span class=tag>${esc(p.license)}</span>` : ''}</div>
  <div class=mut style="margin-bottom:4px">Версии Minecraft: ${esc(p.mcs.join(', ') || '—')}</div><div class=mut style="margin-bottom:8px">Авторы: ${esc(p.team.map((t) => `${t.name}${t.role ? ' (' + t.role + ')' : ''}`).join(', ') || '—')}</div>
  <div class=cbody>${esc(mdText(p.body))}</div><div class=f style="margin-top:12px"><button class=btn id=catdd>${ic('dl')}Скачать</button>${Object.entries({ site: 'Страница', source: 'Исходный код', issues: 'Баги', wiki: 'Вики' }).filter(([k]) => p.links?.[k]).map(([k, n]) => `<button class="btn ghost sm" data-u="${esc(p.links[k])}">${n}</button>`).join('')}</div>`;
  CT.open = it; markDetail(it); $('catdd').onclick = () => catDownload(it); $('catdb').onclick = (e) => { const g = e.target.closest('[data-g]'); if (g) $('galm').src = g.dataset.g; const u = e.target.closest('[data-u]'); if (u) totem.openUrl(u.dataset.u); }; };
// буст FPS в сборке
$('boostb').onclick = async () => { if (!cur) return; const i = INST.find((x) => x.id === cur); if (!(await ask(`Установить моды для оптимизации в «${i.name}» (${i.loader})? Лаунчер скачает подходящие моды с Modrinth.`, 'Установить'))) return;
  busyOn('Устанавливаем моды оптимизации…'); const r = await totem.catBoost(cur); busyOff(); if (!r.ok) return toast(r.error, 1);
  await ask(`Установлено: ${r.installed.join(', ') || 'ничего'}.${r.warnings.length ? '\n\nВнимание:\n• ' + r.warnings.join('\n• ') : ''}`, 'Понятно', null); drawM(); };
document.addEventListener('keydown', (e) => { if (e.key === 'Escape' && !$('lb').classList.contains('on') && !$('askm').classList.contains('on')) { if ($('catd').classList.contains('on')) $('catd').classList.remove('on'); else if ($('catm').classList.contains('on')) $('catm').classList.remove('on'); } });

// ---------- запуск ----------
(async () => {
  Skin.steve(tc, false); sync();
  Object.entries({ newb: 'plus', imp: 'dl', sav: 'save', exp: 'up', tpl: 'shirt', undo: 'l', redo: 'r', addb: 'plus', addd: 'folder', snb: 'refresh', opnb: 'folder', fup: 'up', frf: 'refresh', fmk: 'plus', frn: 'pen', fcp: 'copy', fct: 'scissors', fps: 'paste', fdl: 'trash', faf: 'plus', fad: 'folder', fox: 'folder', opn: 'folder', cln: 'trash', bc: 'plus', lgo: 'check', lbk: 'l', mklnk: 'home', cfget: 'catalog', askok: '' })
    .forEach(([id, n]) => { const e = $(id); if (e && n && !e.querySelector('.pi')) e.insertAdjacentHTML('afterbegin', ic(n)); });
  document.querySelectorAll('[data-tool]').forEach((e) => e.insertAdjacentHTML('afterbegin', ic({ pen: 'pen', er: 'er', fill: 'fill' }[e.dataset.tool])));
  await loadAcc(); document.body.classList.toggle('noanim', SET.anim === false); if (window.setHomeBg) setHomeBg(SET.bgHome || 'village');
  const safe = (p, d) => p.catch(() => d);
  [IV, INST, AV] = await Promise.all([safe(totem.installed(), []), safe(totem.instList(), []), safe(totem.loadersAvail(), AV)]);
  const sel = String(SET.selected || ''), m = /^([iv]):(.+)$/.exec(sel); SEL = m ? { k: m[1], id: m[2] } : INST.find((i) => i.id === sel) ? { k: 'i', id: sel } : null; // выбор последнего сеанса
  if (SEL && !selInfo()) SEL = null; drawDD(); moveInd(); setTimeout(moveInd, 120); loadSkins(); setBg('home');
  loadV();
})();
