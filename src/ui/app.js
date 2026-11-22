'use strict';
const $ = (id) => document.getElementById(id), esc = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const mb = (n) => (n / 1048576).toFixed(1) + ' МБ', sz2 = (n) => (n > 1048576 ? mb(n) : Math.ceil(n / 1024) + ' КБ');
const ic = (n, c = '') => `<i class="pi ${c}${PIX.isImg(n) ? ' im' : ''}" style="background-image:url(${PIX.url(n)})"></i>`;
const NAME = { vanilla: 'Ванилла', forge: 'Forge', forgeopti: 'ForgeOptiFine', fabric: 'Fabric', neoforge: 'NeoForge' };
const LOAD = [['vanilla', 'grass'], ['forge', 'anvil'], ['forgeopti', 'anvil'], ['fabric', 'fabric'], ['neoforge', 'anvilo']];
const LCOL = { forge: '#b9b6e0', forgeopti: '#b9b6e0', fabric: '#e8d9bd', neoforge: '#ff7a2f' };
let SET = {}, SEL = null, V = [], AV = { forge: [], fabric: [], neoforge: [], ok: false }, INST = [], IV = [], GS = { state: 'idle' }, ACC = { accounts: [], current: null };
const isVan = (id) => !/forge|fabric/i.test(id);
// картинки каталога, которые не загрузились, просто скрываем (раньше это делал инлайновый onerror — он несовместим с CSP)
document.addEventListener('error', (e) => { if (e.target?.tagName === 'IMG' && !e.target.closest('#toast')) e.target.style.visibility = 'hidden'; }, true);
let tt = 0; const toast = (t, bad) => { if (!bad && SET.notify === false) return; const e = $('toast'); e.innerHTML = `<img src=assets/icons/${bad ? 'skeleton' : 'sword'}.png alt="">` + esc(t); e.className = 'toast show' + (bad ? ' bad' : ''); clearTimeout(tt); tt = setTimeout(() => (e.className = 'toast'), 5000); };

// ---------- эффекты кнопок: подсветка за курсором и волна при нажатии ----------
document.addEventListener('mousemove', (e) => { const t = e.target.closest?.('.btn,.fi,.ib'); if (t) { const r = t.getBoundingClientRect(); t.style.setProperty('--mx', e.clientX - r.left + 'px'); t.style.setProperty('--my', e.clientY - r.top + 'px'); } });
document.addEventListener('pointerdown', (e) => { const t = e.target.closest?.('.btn,.fi,.ib,.chip'); if (!t || t.disabled) return; const r = t.getBoundingClientRect(), d = Math.max(r.width, r.height) * 2.2, s = document.createElement('span'); s.className = 'ripple'; s.style.cssText = `width:${d}px;height:${d}px;left:${e.clientX - r.left - d / 2}px;top:${e.clientY - r.top - d / 2}px`; t.append(s); setTimeout(() => s.remove(), 700); });
// в окне Electron без рамки поле ввода иногда не получает фокус с первого клика — подстраховка
document.addEventListener('pointerdown', (e) => { const t = e.target.closest?.('input:not([type=checkbox]):not([type=range]),textarea'); if (t) setTimeout(() => { if (document.activeElement !== t) t.focus(); }, 0); }, true);
$('wmin').onclick = () => totem.winMin(); $('wclose').onclick = () => totem.close();
// анимация сворачивания/разворачивания: главный процесс шлёт win:pre-min перед сворачиванием и win:restored после разворачивания
let wOutT = 0; const bcl = document.body.classList;
totem.onWinPreMin(() => { bcl.add('wmin-used'); bcl.remove('wmin-in'); bcl.add('wmin-out'); clearTimeout(wOutT); wOutT = setTimeout(() => bcl.remove('wmin-out'), 3000); });
totem.onWinRestored(() => { clearTimeout(wOutT); bcl.add('wmin-used'); bcl.remove('wmin-out'); bcl.remove('wmin-in'); void document.body.offsetWidth; bcl.add('wmin-in'); setTimeout(() => bcl.remove('wmin-in'), 420); });
// «на весь экран» ⇄ плавающее окно (главный процесс меняет границы окна, сюда приходит состояние)
const setMaxUi = (m) => { document.body.classList.toggle('wmax', !!m); $('wmax').title = m ? 'В окно' : 'На весь экран'; $('wmax').firstElementChild.dataset.i = m ? 'restore' : 'max'; PIX.hydrate(); };
$('wmax').onclick = () => totem.winMax(); totem.onWinState((st) => setMaxUi(st.max)); totem.winState().then((st) => setMaxUi(st.max)).catch(() => {});

// ---------- вкладки с плавающей подсветкой и слайд-переходом ----------
const PAGES = ['home', 'dl', 'bl', 'cat', 'sk', 'st'];
const moveInd = () => {}; // v0.18: подсветка у самой активной вкладки, ползунок не нужен
const hooks = { dl: () => { renderDL(); if (!AV.ok) loadAV(); if (!V.length) loadV(); }, bl: () => loadB(), cat: () => catPage(), sk: () => loadS(), st: () => { loadSettings(); fload(); } };
const go = (p) => { const i = PAGES.indexOf(p); PAGES.forEach((q, j) => { const el = $('p-' + q); el.classList.toggle('on', q === p); el.classList.toggle('left', j < i); });
  document.querySelectorAll('.tab').forEach((t) => t.classList.toggle('on', t.dataset.p === p)); document.body.classList.toggle('nobar', p === 'sk' || p === 'st' || p === 'cat' || p === 'bl'); document.body.dataset.page = p; bOpen(false); window.setBg && setBg(p); if (typeof Vh !== 'undefined' && Vh) Vh.on = p === 'home'; if (typeof Vs !== 'undefined' && Vs) Vs.on = p === 'sk'; moveInd(); (hooks[p] || (() => {}))(); };
document.querySelectorAll('.tab').forEach((t) => (t.onclick = () => go(t.dataset.p))); window.addEventListener('resize', moveInd);

// ---------- аккаунты (только локальные) и первый вход ----------
const loadAcc = async () => { ACC = await totem.accList(); SET = await totem.getSettings(); drawAcc(); $('login').classList.toggle('off', ACC.accounts.length > 0);
  if (window.SKREADY) { loadSkins().catch(() => {}); if ($('p-sk').classList.contains('on')) loadS().catch(() => {}); } }; // SKREADY ставится, когда блок скинов инициализирован (до этого loadSkins недоступна)
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
const gIcon = () => ic('grass', 'gim');
const rowHtml = (k, id, t, s, cur = SEL) => { const on = cur && cur.k === k && cur.id === id; return `<button class="ddi${on ? ' on' : ''}" data-k=${k} data-id="${esc(id)}">${gIcon(k)}<span><b>${esc(t)}</b><small>${esc(s)}</small></span><span class=st>${on ? ic('check') : ic('minus')}</span></button>`; };
const drawDD = () => { $('l-inst').innerHTML = INST.map((i) => rowHtml('i', i.id, i.name, `${i.mc} · ${i.loader}`)).join('') || '<p class=empty>Сборок модов нет. Создайте во вкладке «Сборки».</p>';
  $('l-ver').innerHTML = IV.filter(isVan).sort().reverse().map((v) => rowHtml('v', v, 'Minecraft — ' + v, 'Ванилла')).join('') || '<p class=empty>Нет установленных версий. Откройте «Загрузки».</p>';
  const s = selInfo(); $('ddt').textContent = s ? s.t : 'Выберите версию'; $('ddi').innerHTML = gIcon(SEL ? SEL.k : 'v'); renderBar(); };
// v0.18: выбор сборки не выезжает меню, а заменяет содержимое рамки со скином (всё движется внутри рамки)
const segTo = (s) => { document.querySelectorAll('#seg2 button').forEach((x) => x.classList.toggle('on', +x.dataset.s === s)); $('ind2').style.transform = `translateX(${s * 100}%)`; $('ddr').style.transform = `translateX(${-50 * s}%)`; };
const bOpen = (v) => { const on = v === undefined ? !$('skcard').classList.contains('bsel') : !!v; if (on === $('skcard').classList.contains('bsel')) return; if (on) segTo(SEL && SEL.k === 'v' ? 1 : 0); $('skcard').classList.toggle('bsel', on); $('dd').classList.toggle('open', on); };
$('ddb').onclick = (e) => { e.stopPropagation(); bOpen(); };
document.addEventListener('click', (e) => { if (!e.target.closest('.dd,#skcard')) bOpen(false); if (!e.target.closest('.acc')) $('acc').classList.remove('open'); });
$('seg2').onclick = (e) => { const b = e.target.closest('button'); if (b) segTo(+b.dataset.s); };
const selectItem = (k, id) => { SEL = { k, id }; totem.setSettings({ selected: k + ':' + id }); drawDD(); };
$('ddm').onclick = (e) => { const b = e.target.closest('.ddi'); if (b) { selectItem(b.dataset.k, b.dataset.id); bOpen(false); } };

// ---------- нижняя панель: прогресс, «Играть», «Отмена» ----------
const BUSY = ['preparing', 'downloading', 'installing', 'launching', 'playing'], LBL = { preparing: 'Подготовка', downloading: 'Загрузка', installing: 'Установка', launching: 'Запуск', playing: 'В игре' };
let doneUntil = 0;
const fmtTotal = (s) => (s < 360 ? '0 ч' : (s / 3600).toFixed(1).replace('.', ',') + ' ч');
const fmtSess = (s) => { const h = Math.floor(s / 3600), m = Math.floor((s % 3600) / 60), c = s % 60, p = (n) => String(n).padStart(2, '0'); return h ? `${h} ч ${p(m)} мин ${p(c)} с` : m ? `${m} мин ${p(c)} с` : `${c} с`; };
const tickTime = () => { const e = $('ptime'); if (e && GS.state === 'playing' && GS.since) e.textContent = fmtSess(Math.max(0, Math.floor((Date.now() - GS.since) / 1000))); };
setInterval(tickTime, 1000);
const setHtml = (el, key, html) => { if (el.dataset.k !== key) { el.dataset.k = key; el.innerHTML = html; } }; // не пересоздаём кнопку на каждый килобайт: иначе крутилка дёргается
const renderBar = () => { const s = GS.state, busy = BUSY.includes(s), jobBusy = !busy && dmBusy(), pl = $('play'), si = selInfo(), stopMode = ['launching', 'playing'].includes(s) || WINS.some((w) => ['launching', 'playing'].includes(w.state)), cancelMode = !stopMode && ['preparing', 'downloading', 'installing'].includes(s);
  $('another').hidden = !WINS.some((w) => w.state === 'playing');
  pl.disabled = busy || jobBusy; pl.classList.toggle('busy', busy || jobBusy); const tot = fmtTotal(SET.playSeconds || 0); setHtml(pl, jobBusy ? 'job' : busy ? s : 'idle:' + tot, jobBusy ? `<span class=spin></span>Загрузка` : busy ? (s === 'playing' ? `${ic('check')}<span class=pt><b>В игре</b><small id=ptime></small></span>` : `<span class=spin></span>${LBL[s]}`) : `${ic('play')}<span class=pt><b>Играть</b><small>Всего в игре: ${tot}</small></span>`); tickTime();
  $('cancel').hidden = !(stopMode || cancelMode); setHtml($('cancel'), stopMode ? 'stop' : 'cancel', stopMode ? `${ic('stop')}Остановить` : `${ic('x')}Отмена`); $('track').classList.toggle('ind', ['preparing', 'installing', 'launching'].includes(s) || (jobBusy && !!dmModel()?.ind));
  let pct = 0, txt = si ? `Версия: ${si.v}   |   Сборка: ${si.b}` : 'Выберите версию или сборку — кнопка под скином', bad = false;
  if (s === 'downloading') { pct = GS.percent || 0; txt = `${GS.op || 'Загрузка'} · ${mb(GS.speed || 0)}/с · ${mb(GS.done || 0)} из ${mb(GS.total || 0)}`; }
  else if (['preparing', 'installing', 'launching'].includes(s)) txt = GS.op || LBL[s]; else if (s === 'playing') txt = 'Minecraft запущен'; else if (s === 'error') { txt = GS.error || 'Ошибка'; bad = true; } else if (jobBusy) { const m = dmModel(); pct = m?.pct || 0; txt = `${DML[m?.kind] || 'Загрузка'}${m?.title ? ' · ' + m.title : ''}${m?.of ? ` · ${m.files}/${m.of} файлов` : ''}`; } else if (Date.now() < doneUntil) { pct = 100; txt = 'Готово к работе!'; }
  $('pct').textContent = pct + '%'; $('fill').style.width = pct + '%'; $('st-t').textContent = txt; $('st-t').className = bad ? 'err' : ''; dmRender(); };
// ---------- окошко загрузок: слева внизу поверх окон, работе с лаунчером не мешает ----------
// Сюда попадает всё, что качается: установка версий и загрузчиков (состояние игры) и скачивание из каталога (очередь заданий).
// Пока что-то качается, кнопка «Играть» заблокирована.
const DM = { q: [], job: null, tmp: null, paused: false, min: false, waitSince: 0, timer: 0, raf: 0, key: '' };
const DML = { dl: 'Скачивание', wait: 'Ожидание', inst: 'Установка', pause: 'Пауза' }, DMI = { dl: 'dl', wait: 'wait', inst: 'gear', pause: 'pause' };
const gameDl = () => ['preparing', 'downloading', 'installing'].includes(GS.state), dmBusy = () => !!(DM.job || DM.q.length || DM.tmp);
const dmSleep = (ms) => new Promise((r) => setTimeout(r, ms));
const dmModel = () => {
  let m = null;
  if (gameDl()) { const s = GS.state; m = { kind: s === 'installing' ? 'inst' : s === 'downloading' ? 'dl' : 'wait', title: GS.op || '', pct: GS.percent || 0, files: GS.files || 0, of: GS.filesTotal || 0, speed: s === 'downloading' ? GS.speed || 0 : 0, ind: s !== 'downloading' || !GS.total }; }
  else if (DM.job?.cancelling) m = { kind: 'wait', title: 'Отмена…', pct: 0, files: 0, of: 0, speed: 0, ind: true, noCancel: true };
  else if (DM.job) { const j = DM.job; m = { kind: j.st === 'wait' ? 'wait' : 'dl', title: j.title, pct: j.p.pct || 0, files: j.p.files || 0, of: j.p.of || 0, speed: j.p.speed || 0, ind: j.st === 'wait' || !j.p.pct }; }
  else if (DM.tmp) m = { kind: 'wait', title: DM.tmp, pct: 0, files: 0, of: 0, speed: 0, ind: true };
  if (m && DM.paused && m.kind !== 'inst') m = { ...m, kind: 'pause', ind: false };
  return m;
};
const dmChanged = () => { renderBar(); if ($('p-dl').classList.contains('on')) renderDL(); };
const dmReset = () => { if (DM.paused) { DM.paused = false; totem.dmPause(false); } DM.min = false; };
let dmUiKey = '';
const dmRender = () => { const m = dmModel(), el = $('dm');
  // обычный запуск уже установленной игры тоже на долю секунды «готовится»: окошко показываем, только если ожидание затянулось
  if (m && m.kind === 'wait' && !DM.job && !DM.tmp && GS.state === 'preparing') { if (!DM.waitSince) DM.waitSince = Date.now(); const left = 900 - (Date.now() - DM.waitSince); if (left > 0) { clearTimeout(DM.timer); DM.timer = setTimeout(dmRender, left + 20); el.hidden = true; document.body.classList.remove('dm-x', 'dm-m'); return; } } else DM.waitSince = 0;
  if (!m) { if (!el.hidden) { el.hidden = true; } document.body.classList.remove('dm-x', 'dm-m'); if (!dmBusy() && !gameDl()) dmReset(); return; }
  el.hidden = false; const k = m.kind, mini = DM.min; document.body.classList.toggle('dm-x', !mini); document.body.classList.toggle('dm-m', mini);
  $('dmp').hidden = mini; $('dmmini').hidden = !mini;
  const key = k + (mini ? 'm' : ''); if (key !== dmUiKey) { dmUiKey = key; const u = `url(${PIX.url(DMI[k])})`; $('dmi').style.backgroundImage = u; $('dmmi').style.backgroundImage = u; $('dmi').className = 'pi dmi k-' + k; $('dmmi').className = 'pi dmi k-' + k;
    $('dmpause').firstChild.style.backgroundImage = `url(${PIX.url(k === 'pause' ? 'play' : 'pause')})`; $('dmpause').dataset.tip = k === 'pause' ? 'Продолжить' : 'Пауза'; }
  $('dmcancel').hidden = !!m.noCancel || (!gameDl() && !DM.job); // отмена: загрузка игры или задание каталога (проверка совместимости — слишком короткая)
  $('dmpause').disabled = k === 'inst'; if (k === 'inst') $('dmpause').dataset.tip = 'Во время установки пауза недоступна';
  $('dmt').textContent = DML[k]; $('dmml').textContent = DML[k]; $('dmsub').textContent = m.title || '';
  $('dmpct').textContent = m.ind ? '' : m.pct + '%'; $('dmfill').style.width = m.pct + '%'; $('dmtrack').classList.toggle('ind', !!m.ind);
  $('dmfiles').textContent = m.of ? `${m.files}/${m.of} файлов` : ''; $('dmspeed').textContent = k === 'dl' && m.speed ? mb(m.speed) + '/с' : DM.q.length ? `в очереди: ${DM.q.length}` : ''; };
$('dmpause').onclick = () => { if (!dmModel() || dmModel().kind === 'inst') return; DM.paused = !DM.paused; totem.dmPause(DM.paused); dmChanged(); };
$('dmcancel').onclick = () => {
  if (gameDl()) return totem.cancel(); // загрузка игры отменяется так же, как кнопкой «Отмена» внизу
  const j = DM.job; if (!j || j.cancelling) return;
  j.cancelling = true; j.cancelled = true; if (DM.paused) { DM.paused = false; } // пауза снимается в главном процессе
  if (j.st === 'go') totem.catCancel(); // иначе задание ещё ждёт своей очереди и просто пропускается
  dmChanged(); };
$('dmmin').onclick = () => { DM.min = true; dmRender(); }; $('dmmini').onclick = () => { DM.min = false; dmRender(); };
// очередь заданий каталога: по одному; пока идёт загрузка/установка игры — «Ожидание»
const dmRun = (title, fn) => new Promise((res) => { DM.q.push({ title, fn, res, st: 'wait', p: { pct: 0, files: 0, of: 0, speed: 0, text: '' } }); dmPump(); dmChanged(); });
const dmPump = async () => { if (DM.job || !DM.q.length) return; const j = (DM.job = DM.q.shift()); dmChanged();
  while (gameDl() && !j.cancelled) await dmSleep(400);
  let r; if (j.cancelled && j.st !== 'go') r = { ok: false, cancelled: true, error: 'cancelled' }; else { j.st = 'go'; dmChanged(); try { r = await j.fn(); } catch (e) { r = { ok: false, error: e.message }; } }
  DM.job = null; if (!DM.q.length && !gameDl()) dmReset(); j.res(r); dmChanged(); dmPump(); };
totem.onCatProgress((p) => { const j = DM.job; if (!j) return; j.p = { text: p.text || '', pct: p.pct || 0, files: p.files || 0, of: p.of || 0, speed: p.speed || 0 }; if (!DM.raf) DM.raf = requestAnimationFrame(() => { DM.raf = 0; renderBar(); }); });
const refreshLists = async () => { SET = await totem.getSettings(); IV = await totem.installed(); INST = await totem.instList(); drawDD(); if ($('p-cat').classList.contains('on')) drawCbs(); if ($('p-dl').classList.contains('on')) renderDL(); if ($('p-bl').classList.contains('on')) drawB(); };
const waiters = [];
totem.onGame((s) => { const was = BUSY.includes(GS.state); GS = s; if (s.deps) setTimeout(() => window.DepsUI?.show(s.deps), 350); if (s.diag) setTimeout(() => window.DiagUI?.show(s.diag), 300); if (!BUSY.includes(s.state) && was) { if (s.state === 'idle') { doneUntil = Date.now() + 4000; setTimeout(renderBar, 4100); } refreshLists(); }
  if (s.state === 'error' && s.error) toast(s.diag ? s.diag.short || s.diag.title : s.error, 1); if (s.state === 'idle' || s.state === 'error') waiters.splice(0).forEach((f) => f(s)); renderBar(); });
$('play').onclick = () => { if (dmBusy()) return toast('Дождитесь окончания загрузки', 1); if (!SEL) return toast('Сначала выберите версию или сборку', 1); totem.play(SEL); };
$('cancel').onclick = (e) => { e.stopPropagation(); const L = stopList(), live = L.filter((w) => ['launching', 'playing'].includes(w.state));
  if (live.length) { if (L.length === 1) return totem.winStop(L[0].id); drawStop(); return $('stopm').classList.toggle('on'); } // несколько окон — контекстное меню выбора
  if (['launching', 'playing'].includes(GS.state)) totem.stop(); else totem.cancel(); };

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
  $('updmsg').textContent = s.error ? s.error : s.available ? 'Доступна новая версия — нажмите «Проверить на обновления», чтобы установить' : s.latest ? 'У вас установлена последняя версия' : s.supported ? '' : 'Обновления работают в установленной версии лаунчера'; $('updmsg').classList.toggle('err', !!s.error); $('updat').textContent = s.checkedAt ? 'Последняя проверка: ' + new Date(s.checkedAt).toLocaleString('ru-RU') : ''; };
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
let VERR = false, vT = 0, vBusy = false; const loadV = () => { if (vBusy) return Promise.resolve(); vBusy = true; clearTimeout(vT); VERR = false; return totem.versions().then((r) => { vBusy = false; V = (r?.versions || []).filter((v) => /^[\w.+ -]{1,60}$/.test(String(v.id))); if (!V.length) vT = setTimeout(loadV, 8000); if ($('p-dl').classList.contains('on')) renderDL(); }).catch(() => { vBusy = false; VERR = true; vT = setTimeout(loadV, 8000); if ($('p-dl').classList.contains('on')) renderDL(); }); };
// список загрузчиков (Forge/Fabric/NeoForge): если интернета не было при запуске, повторяем запрос сами — раньше без перезапуска лаунчера оставалась только Ванилла
let avT = 0, avBusy = false; const loadAV = async () => { if (avBusy) return; avBusy = true; clearTimeout(avT); try { const r = await totem.loadersAvail(); if (r && typeof r === 'object') AV = { forge: r.forge || [], fabric: r.fabric || [], neoforge: r.neoforge || [], ok: !!r.ok }; } catch { AV.ok = false; } avBusy = false; if (!AV.ok) avT = setTimeout(loadAV, 8000); if ($('p-dl').classList.contains('on')) renderDL(); };
window.addEventListener('online', () => { if (!AV.ok) loadAV(); if (!V.length) loadV(); });
const verList = () => V.filter((v) => SNAP || v.type === 'release'), instd = (id) => IV.includes(id) || INST.some((i) => i.mc === id);
const avail = (o, id) => o === 'vanilla' || (o === 'forge' || o === 'forgeopti' ? AV.forge : AV[o]).includes(id);
const isInstalled = (id, o) => (o === 'vanilla' ? IV.includes(id) : INST.some((i) => i.mc === id && i.loader === (o === 'forgeopti' ? 'forge' : o)));
const renderDL = () => { const L = verList(), n = L.filter((v) => instd(v.id)).length; $('c-all').textContent = L.length; $('c-in').textContent = n; $('c-not').textContent = L.length - n;
  if (!V.length) setTimeout(() => { const b = $('vretry'); if (b) b.onclick = () => { b.disabled = true; loadV(); renderDL(); }; }); const q = DQ.trim().toLowerCase(), busy = BUSY.includes(GS.state) || dmBusy(), R = L.filter((v) => (DF === 'all' || (DF === 'inst') === instd(v.id)) && (!q || v.id.toLowerCase().includes(q)));
  $('vl').innerHTML = !V.length ? `<p class=empty>${VERR ? 'Не удалось загрузить каталог Mojang. Проверьте интернет.' : 'Загружаем каталог версий…'}</p>${VERR ? '<p style="text-align:center"><button class="btn" id=vretry>Повторить</button></p>' : ''}` : R.slice(0, 150).map((v, i) => {
    const o = DLopt[v.id] && avail(DLopt[v.id], v.id) ? DLopt[v.id] : 'vanilla', ins = isInstalled(v.id, o);
    const opts = LOAD.filter(([k]) => avail(k, v.id)).map(([k, icn]) => `<button class="o${k === o ? ' on' : ''}" data-o=${k} data-v="${esc(v.id)}">${ic(icn)}${NAME[k]}</button>`).join('');
    return `<div class="vrow glass" style="animation-delay:${Math.min(i, 12) * 30}ms">${ic('grass', 'vi')}<div class=vn><b>${esc(v.id)}</b><small>Вышла: ${new Date(v.releaseTime).toLocaleDateString('ru-RU')}</small></div><div class=opts>${opts}</div>`
      + `<button class="btn${ins ? ' ghost' : ''}" data-i="${esc(v.id)}" ${busy ? 'disabled' : ''}>${ins ? ic('check') + 'Проверить' : ic('dl') + 'Установить'}</button></div>`; }).join('') || '<p class=empty>Ничего не найдено</p>'; };
document.querySelectorAll('.fi').forEach((b) => (b.onclick = () => { DF = b.dataset.f; document.querySelectorAll('.fi').forEach((x) => x.classList.toggle('on', x === b)); renderDL(); }));
$('q').oninput = () => { DQ = $('q').value; renderDL(); }; $('snap').onchange = () => { SNAP = $('snap').checked; renderDL(); };
const installVer = async (id, o) => {
  if (BUSY.includes(GS.state) || dmBusy()) return toast('Дождитесь окончания текущей загрузки', 1);
  if (o === 'vanilla') return totem.install(id);
  const ld = o === 'forgeopti' ? 'forge' : o; let inst = INST.find((i) => i.mc === id && i.loader === ld);
  if (!inst) { const r = await totem.instCreate({ name: `${id} ${NAME[o]}`, mc: id, loader: ld }); if (!r.ok) return toast(r.error, 1); inst = r.inst; INST = await totem.instList(); }
  selectItem('i', inst.id); const r = await totem.instInstall(inst.id); if (!r.ok) toast(r.error, 1);
  if (o === 'forgeopti') { toast('OptiFine скачивается вручную: открою сайт optifine.net. Скачайте .jar и перетащите его в «Сборки → Моды».'); totem.openOptifine(); } };
$('vl').onclick = (e) => { const c = e.target.closest('.o'); if (c) { DLopt[c.dataset.v] = c.dataset.o; return renderDL(); } const b = e.target.closest('[data-i]'); if (b) { const id = b.dataset.i; installVer(id, DLopt[id] && avail(DLopt[id], id) ? DLopt[id] : 'vanilla'); } };

// ---------- сборки (v0.16): боковая панель, карточка, таблица файлов, точки восстановления, проверка и ошибки ----------
let cur = null, kind = 'mods', BF = 'all', ROWS = [], SELF = new Set(), BQ = '', BFL = 'all', ERRS = [], drawSeq = 0;
const LN = { fabric: 'Fabric', forge: 'Forge', neoforge: 'NeoForge', quilt: 'Quilt', vanilla: 'Vanilla' }, PREV = ['cabin', 'cave', 'fireplace', 'sunset', 'village'];
const VK = ['resourcepacks', 'saves', 'snaps']; // в Vanilla нет модов и шейдеров
const prevOf = (id) => `assets/bg/${PREV[parseInt(String(id).slice(0, 4), 16) % PREV.length] || PREV[0]}.jpg`;
const BTABS = [['mods', 'Моды', 'puzzle'], ['resourcepacks', 'Ресурс-паки', 'image'], ['shaderpacks', 'Шейдеры', 'sun'], ['archive', 'Архив', 'chest'], ['saves', 'Карты', 'mapi'], ['-'], ['snaps', 'Точки восстановления', 'history']];
// анимированная панель переключателей: «пилюля» плавно переезжает к выбранной кнопке (используется и в каталоге)
const segSet = (el, key, anim = true) => { el.querySelectorAll('button').forEach((b) => b.classList.toggle('on', b.dataset.k === key)); const b = el.querySelector(`button[data-k="${key}"]`), p = el.querySelector('.spl'); if (!b || !p) return; const place = () => { p.style.width = b.offsetWidth + 'px'; p.style.transform = `translateX(${b.offsetLeft - el.clientLeft}px)`; p.style.top = b.offsetTop + 'px'; p.style.bottom = 'auto'; p.style.height = b.offsetHeight + 'px'; };
  if (!anim) { p.style.transition = 'none'; place(); void p.offsetWidth; p.style.transition = ''; } else place(); };
const segBuild = (el, items, active, onPick) => { el.innerHTML = '<i class=spl></i>' + items.map((x) => (x[0] === '-' ? '<i class=asep></i>' : `<button data-k="${x[0]}">${ic(x[2])}<span>${esc(x[1])}</span></button>`)).join(''); el.onclick = (e) => { const b = e.target.closest('button'); if (b && b.dataset.k !== el.dataset.cur) { el.dataset.cur = b.dataset.k; onPick(b.dataset.k); segSet(el, b.dataset.k, true); } }; el.dataset.cur = active; segSet(el, active, false); };
const segFix = () => { for (const id of ['btabs', 'ctabs']) { const el = $(id); if (el && el.dataset.cur) segSet(el, el.dataset.cur, false); } };
window.addEventListener('resize', segFix); document.fonts?.ready.then(segFix);
// плавающее меню «⋯»
const showMenu = (anchor, items) => { const m = $('fmenu'), w0 = $('win').getBoundingClientRect(), r = anchor.getBoundingClientRect();
  m.innerHTML = items.map((x, k) => `<button class="${x.d ? 'd' : ''}" data-k="${k}">${ic(x.i || 'dots')}${esc(x.t)}</button>`).join(''); m.classList.add('on'); const w = m.offsetWidth, h = m.offsetHeight;
  m.style.left = Math.min(w0.width - w - 16, Math.max(16, r.right - w0.left - w)) + 'px'; m.style.top = (r.bottom - w0.top + h + 18 > w0.height ? r.top - w0.top - h - 10 : r.bottom - w0.top + 8) + 'px';
  m.onclick = (e) => { const b = e.target.closest('button'); if (b) { m.classList.remove('on'); items[+b.dataset.k].f(); } }; };
document.addEventListener('mousedown', (e) => { if (!e.target.closest('#fmenu') && !e.target.closest('[data-a=more],[data-a=sm]')) $('fmenu').classList.remove('on'); });
// ввод текста (название точки восстановления)
const askText = (title, def = '') => new Promise((res) => { $('txtt').textContent = title; $('txti').value = def; $('txtm').classList.add('on'); setTimeout(() => { $('txti').focus(); $('txti').select(); }, 60); const fin = (v) => { $('txtm').classList.remove('on'); res(v); }; $('txtok').onclick = () => fin($('txti').value.trim() || null); $('txtno').onclick = () => fin(null); $('txti').onkeydown = (e) => { if (e.key === 'Enter') fin($('txti').value.trim() || null); if (e.key === 'Escape') fin(null); }; });
const busyOn = (t) => { $('busyt').textContent = t; $('busym').classList.add('on'); }, busyOff = () => $('busym').classList.remove('on');
const fmtWhen = (t) => { if (!t) return '—'; const d = new Date(t), n = new Date(), hm = d.toLocaleTimeString('ru-RU', { hour: '2-digit', minute: '2-digit' }), day = (x) => new Date(x.getFullYear(), x.getMonth(), x.getDate()).getTime(), diff = Math.round((day(n) - day(d)) / 864e5); return diff === 0 ? 'Сегодня, ' + hm : diff === 1 ? 'Вчера, ' + hm : d.toLocaleDateString('ru-RU') + ', ' + hm; };
const curInst = () => INST.find((x) => x.id === cur);
const isVanI = (i) => i?.loader === 'vanilla';

const bFilter = () => INST.filter((i) => (BF === 'fav' ? i.fav : BF === 'mine' ? i.origin !== 'modpack' : true));
const drawB = () => {
  document.querySelectorAll('#bnav button').forEach((b) => b.classList.toggle('on', b.dataset.f === BF));
  const L = bFilter(); if (!cur || !curInst()) cur = (L[0] || INST[0])?.id || null; if (BF !== 'snaps' && L.length && !L.find((x) => x.id === cur)) cur = L[0].id;
  $('bsl').innerHTML = L.map((i) => `<button class="bli${i.id === cur ? ' on' : ''}" data-i="${esc(i.id)}">${gIcon('i')}<span><b>${esc(i.name)}</b><small>${esc(i.mc)} · ${esc(LN[i.loader] || i.loader)}</small></span>${i.fav ? ic('star') : ''}</button>`).join('') || `<p class=empty style="padding:10px;font-size:13px">${BF === 'fav' ? 'Нет избранных сборок. Нажмите звезду в карточке сборки.' : 'Сборок нет.'}</p>`;
  if (!INST.length) { $('bview').hidden = true; $('ball').hidden = false; $('ball').innerHTML = '<p class=empty>Сборок пока нет. Нажмите «Создать сборку» справа внизу: выберите версию Minecraft и загрузчик или введите код от друга.</p>'; return; }
  if (BF === 'snaps') { $('bview').hidden = true; $('ball').hidden = false; return drawAllSnaps(); }
  $('ball').hidden = true; $('bview').hidden = !cur; if (cur) { drawCard(); drawM(); }
};
const loadB = async () => { INST = await totem.instList(); ERRS = await totem.errList().catch(() => ERRS); $('bv').innerHTML = V.filter((v) => v.type === 'release').map((v) => `<option>${esc(v.id)}</option>`).join(''); drawDD(); drawB(); };
const drawCard = async () => {
  const i = curInst(); if (!i) return; const van = isVanI(i), st = await totem.instStats(i.id).catch(() => ({})); if (cur !== i.id) return; const ne = ERRS.filter((e) => e.build?.id === i.id).length;
  $('bcard').innerHTML = `<div class=bprev style="background-image:url(${prevOf(i.id)})"></div>
<div class=binfo><div class=bxn><span id=bnm>${esc(i.name)}</span><button class=ib data-a=ren title="Переименовать">${ic('pen')}</button><button class=ib data-a=fav title="${i.fav ? 'Убрать из избранного' : 'В избранное'}">${ic(i.fav ? 'star' : 'starO')}</button><button class=ib data-a=more title="Ещё">${ic('dots')}</button></div>
<div class=bmeta>${gIcon('i')}<span>Версия: <b>${esc(i.mc)}</b> &nbsp;•&nbsp; ${esc(LN[i.loader] || i.loader)}${i.loaderVersion ? ' ' + esc(i.loaderVersion) : ''}</span></div>
<div class=bmeta>${ic('puzzle')}<span>${van ? 'Vanilla: без модов' : `Модов: <b>${st.mods ?? '—'}</b>${st.off ? ` <span class=mut>(выключено: ${st.off})</span>` : ''}`}</span></div>
<div class=bmeta>${ic('history')}<span>Изменено: ${esc(fmtWhen(st.last))}</span></div></div>
<div class=bact><button class="btn bpri" data-a=play>${ic('play')}Запустить</button>${van ? '' : `<button class="btn ghost" id=boostb data-a=boost>${ic('bolt')}Буст FPS</button>`}<button class="btn ghost" data-a=cat>${ic('catalog')}Каталог</button><button class="btn ghost" data-a=errs>${ic('warn')}Ошибки${ne ? ` (${ne})` : ''}</button>
<button class="btn ghost" data-a=snap>${ic('history')}Создать точку</button><button class="btn ghost" data-a=open>${ic('folder')}Открыть папку</button><button class="btn ghost" data-a=share title="Код, по которому друг получит эту сборку из каталога">${ic('send')}Поделиться</button>${van ? '' : `<button class="btn ghost" data-a=check title="Проверить зависимости и конфликты модов до запуска">${ic('check')}Проверить сборку</button>`}</div>`;
};
const startRename = () => { const el = $('bnm'), i = curInst(); if (!el || !i) return; const inp = document.createElement('input'); inp.className = 'in'; inp.value = i.name; inp.maxLength = 40; el.replaceWith(inp); inp.focus(); inp.select(); let done = false;
  const fin = async (save) => { if (done) return; done = true; if (save && inp.value.trim() && inp.value.trim() !== i.name) { const r = await totem.instRename(i.id, inp.value); if (!r.ok) $('be').textContent = r.error; INST = await totem.instList(); drawDD(); } drawB(); };
  inp.onkeydown = (e) => { if (e.key === 'Enter') fin(true); if (e.key === 'Escape') fin(false); }; inp.onblur = () => fin(true); };
const doBoost = async () => { if (!cur) return; const i = curInst(); if (!(await ask(`Установить моды для оптимизации в «${i.name}» (${i.loader})? Лаунчер скачает подходящие моды с Modrinth.`, 'Установить'))) return;
  const bid = cur, r = await dmRun('Моды оптимизации', () => totem.catBoost(bid)); if (r.cancelled) return toast('Загрузка отменена'); if (!r.ok) return toast(r.error, 1);
  await ask(`Установлено: ${r.installed.join(', ') || 'ничего'}.${r.warnings.length ? '\n\nВнимание:\n• ' + r.warnings.join('\n• ') : ''}`, 'Понятно', null); drawM(); drawCard(); };
const makeSnap = async (id) => { const i = INST.find((x) => x.id === id), n = await askText('Название точки восстановления', 'Вручную'); if (!n) return; const r = await totem.instSnap(id, n); $('be').textContent = r.ok ? '' : r.error; if (r.ok) toast(`Точка «${n}» создана в «${i.name}»`); if (BF === 'snaps') drawAllSnaps(); else if (kind === 'snaps') drawSnapsMain(); };
$('bcard').onclick = async (e) => { const b = e.target.closest('[data-a]'); if (!b || !cur) return; const a = b.dataset.a, i = curInst();
  if (a === 'play') { selectItem('i', cur); totem.play(SEL); } else if (a === 'boost') doBoost(); else if (a === 'cat') openCatalog({ inst: cur }); else if (a === 'snap') makeSnap(cur);
  else if (a === 'open') totem.instOpen(cur, ['mods', 'resourcepacks', 'shaderpacks', 'saves'].includes(kind) ? kind : 'mods'); else if (a === 'check') runCheck(); else if (a === 'errs') openErrs(cur); else if (a === 'share') shareOpen(cur); else if (a === 'ren') startRename();
  else if (a === 'fav') { await totem.instFav(cur, !i.fav); INST = await totem.instList(); drawB(); }
  else if (a === 'more') showMenu(b, [{ t: 'Выбрать для запуска', i: 'check', f: () => { selectItem('i', cur); toast('Сборка выбрана для запуска'); } }, { t: 'Создать копию', i: 'copy', f: async () => { const r = await totem.instCopy(cur); $('be').textContent = r.ok ? '' : r.error; await loadB(); } },
    { t: 'Удалить сборку', i: 'trash', d: 1, f: async () => { if (!(await ask('Удалить сборку вместе со всеми её файлами (моды, миры, настройки)?', 'Удалить'))) return; const r = await totem.instRemove(cur); $('be').textContent = r.ok ? '' : r.error; cur = null; await loadB(); } }]); };
$('bnav').onclick = (e) => { const b = e.target.closest('button'); if (!b) return; BF = b.dataset.f; SELF.clear(); drawB(); };
$('bsl').onclick = (e) => { const b = e.target.closest('.bli'); if (!b) return; cur = b.dataset.i; SELF.clear(); BQ = ''; $('bq').value = ''; if (BF === 'snaps') BF = 'all'; drawB(); };

// ----- таблица файлов -----
const mfPass2 = (f) => (BFL === 'on' ? f.enabled : BFL === 'off' ? !f.enabled : BFL === 'warn' ? !!f.warn : ['fabric', 'forge', 'neoforge'].includes(BFL) ? f.loader === BFL : true);
const KICO = { resourcepacks: 'image', shaderpacks: 'sun', saves: 'mapi' };
const frowHtml = (f) => { const mod = kind === 'mods', arc = kind === 'archive', isJar = mod || arc, ico = f.icon ? `<img src="${esc(f.icon)}" alt="" loading=lazy>` : ic(KICO[kind] || 'java');
  const sub = f.warn ? `<small class="${/Дубликат|а в сборке|не загружает/.test(f.warn) ? 'e' : 'w'}">⚠ ${esc(f.warn)}</small>` : `<small>${esc([f.version && 'v' + f.version, f.modId, !f.enabled && 'выключен', f.cat && 'из каталога'].filter(Boolean).join(' · '))}</small>`;
  const acts = mod ? `<button class="btn ghost" data-a=ar>${ic('chest')}В архив</button><button class="btn red" data-a=rm>${ic('trash')}Удалить</button>` : arc ? `<button class="btn ghost" data-a=un>${ic('refresh')}Вернуть</button><button class="btn red" data-a=rm>${ic('trash')}Удалить</button>` : `<button class="btn red" data-a=rm>${ic('trash')}Удалить</button>`;
  return `<div class="btr${f.enabled ? '' : ' off'}${SELF.has(f.name) ? ' sel' : ''}" data-n="${esc(f.name)}"><input type=checkbox data-a=sel ${SELF.has(f.name) ? 'checked' : ''}><div class=bnm><span class=fic>${ico}</span><span><b>${esc(f.title || f.name)}</b>${sub}</span></div><span class=mut>${f.size != null ? sz2(f.size) : ''}</span><span>${mod ? `<label class=sw><input type=checkbox data-a=tg ${f.enabled ? 'checked' : ''}><i></i></label>` : ''}</span><div class=acts>${acts}</div></div>`; };
const visRows = () => { const q = BQ.trim().toLowerCase(); return ROWS.filter((f) => mfPass2(f) && (!q || (f.title || '').toLowerCase().includes(q) || f.name.toLowerCase().includes(q) || (f.modId || '').toLowerCase().includes(q))); };
const HINT = { mods: 'Перетащите файлы в это окно или нажмите «Добавить».', archive: 'Моды в архиве игра не загружает. «Вернуть» возвращает мод в сборку.', saves: 'Здесь миры сборки (папка saves). Перетащите .zip или папку с картой сюда или скачайте карту в «Каталог → Карты».', shaderpacks: 'Шейдеры работают только с Iris или OptiFine.', resourcepacks: 'Перетащите .zip с ресурс-паком в это окно.' };
const renderRows = () => { const L = visRows(); $('btrows').innerHTML = L.map(frowHtml).join('') || `<p class=empty>${ROWS.length ? 'Ничего не найдено.' : 'Пусто. ' + (HINT[kind] || '')}</p>`; const all = $('bth').querySelector('input'); if (all) all.checked = L.length > 0 && L.every((f) => SELF.has(f.name)); $('addb').title = $('addd').title = (isVanI(curInst()) && kind === 'resourcepacks' ? 'Сборка Vanilla: здесь только ресурс-паки, датапаки и карты. ' : '') + (HINT[kind] || ''); $('bq').placeholder = ROWS.length ? `Поиск по названию… (${L.length} из ${ROWS.length})` : 'Поиск по названию…'; updateBulk(); };
const updateBulk = () => { const n = SELF.size, bb = $('bbulk'); bb.hidden = !n; if (!n) return; const mod = kind === 'mods', arc = kind === 'archive';
  bb.innerHTML = `<b>Выбрано: ${n}</b><span class=grow></span>${mod ? `<button class="btn ghost sm" data-b=off>Выключить</button><button class="btn ghost sm" data-b=on>Включить</button><button class="btn ghost sm" data-b=ar>${ic('chest')}В архив</button>` : ''}${arc ? `<button class="btn ghost sm" data-b=un>${ic('refresh')}Вернуть</button>` : ''}<button class="btn red sm" data-b=rm>${ic('trash')}Удалить</button><button class="btn ghost sm" data-b=clr>Снять выделение</button>`; };
const drawM = async () => {
  if (!cur || BF === 'snaps' || !curInst()) return; const seq = ++drawSeq, van = isVanI(curInst());
  if (van && !VK.includes(kind)) kind = 'resourcepacks';
  $('btabs').querySelectorAll('button').forEach((b) => { b.hidden = van && !VK.includes(b.dataset.k); }); segSet($('btabs'), kind, true);
  const snaps = kind === 'snaps'; $('btable').hidden = snaps; $('bsm').hidden = !snaps;
  if (snaps) return drawSnapsMain();
  const mod = kind === 'mods'; $('bfl').hidden = !(mod || kind === 'archive'); $('addd').hidden = !['resourcepacks', 'shaderpacks', 'saves'].includes(kind); $('addb').hidden = kind === 'archive';
  $('bth').innerHTML = `<input type=checkbox><span>Название</span><span>Размер</span><span>${mod ? 'Статус' : ''}</span><span style="text-align:right">Действия</span>`; $('btrows').innerHTML = '<p class=empty>Загрузка…</p>';
  const L = await totem.filesList(cur, kind === 'archive' ? 'archive' : kind); if (seq !== drawSeq) return; ROWS = L; const names = new Set(L.map((f) => f.name)); for (const n of [...SELF]) if (!names.has(n)) SELF.delete(n); renderRows();
};
$('btrows').onchange = async (e) => { const t = e.target, r = t.closest('.btr'); if (!r) return; const n = r.dataset.n;
  if (t.dataset.a === 'sel') { t.checked ? SELF.add(n) : SELF.delete(n); r.classList.toggle('sel', t.checked); updateBulk(); const all = $('bth').querySelector('input'); if (all) all.checked = visRows().every((f) => SELF.has(f.name)); }
  else if (t.dataset.a === 'tg') { const x = await totem.filesToggle(cur, n); if (!x.ok) $('be').textContent = x.error; SELF.delete(n); drawM(); drawCard(); } };
$('btrows').onclick = async (e) => { const b = e.target.closest('button[data-a]'); if (!b) return; const n = b.closest('.btr').dataset.n, a = b.dataset.a; let r;
  if (a === 'ar') r = await totem.filesArchive(cur, n); else if (a === 'un') r = await totem.filesUnarchive(cur, n); else if (a === 'rm') { if (!(await ask('Удалить «' + n + '»?', 'Удалить'))) return; r = await totem.filesRemove(cur, kind === 'archive' ? 'archive' : kind, n); } else return;
  $('be').textContent = r.ok ? '' : r.error; SELF.delete(n); drawM(); drawCard(); };
$('bth').onchange = (e) => { if (e.target.type !== 'checkbox') return; const L = visRows(); if (e.target.checked) L.forEach((f) => SELF.add(f.name)); else L.forEach((f) => SELF.delete(f.name)); renderRows(); };
$('bbulk').onclick = async (e) => { const b = e.target.closest('[data-b]'); if (!b) return; const a = b.dataset.b, names = [...SELF]; if (a === 'clr') { SELF.clear(); return renderRows(); }
  if (a === 'rm' && !(await ask(`Удалить выбранное (${names.length})?`, 'Удалить'))) return; let bad = '';
  for (const n of names) { const f = ROWS.find((x) => x.name === n); if (!f) continue; let r = { ok: true };
    if (a === 'off' && f.enabled) r = await totem.filesToggle(cur, n); else if (a === 'on' && !f.enabled) r = await totem.filesToggle(cur, n); else if (a === 'ar') r = await totem.filesArchive(cur, n); else if (a === 'un') r = await totem.filesUnarchive(cur, n); else if (a === 'rm') r = await totem.filesRemove(cur, kind, n);
    if (!r.ok) bad = r.error; }
  $('be').textContent = bad; SELF.clear(); drawM(); drawCard(); };
$('bq').oninput = () => { BQ = $('bq').value; renderRows(); }; $('bfl').onchange = () => { BFL = $('bfl').value; renderRows(); };
const installAndWait = async (id) => { const w = new Promise((res) => waiters.push((s) => res(s.state === 'idle'))); const r = await totem.instInstall(id); if (!r.ok) { $('be').textContent = r.error; waiters.length = 0; return false; } return w; };
const addF = async (p, force = false, dirMode = false) => { let r = await totem.filesAdd(cur, kind === 'archive' ? 'mods' : kind, p, { force, dirMode });
  if (r.needLoader) { const N = { fabric: 'Fabric', forge: 'Forge', neoforge: 'NeoForge' }[r.needLoader];
    if (!(await ask(`Эти моды для ${N}, а в сборке загрузчик не установлен. Установить ${N}? Лаунчер не закроется, ход установки виден внизу.`, 'Установить'))) { $('be').textContent = 'Установка отклонена: моды не добавлены.'; return; }
    const s = await totem.instSetLoader(cur, r.needLoader); if (!s.ok) { $('be').textContent = s.error; return; }
    const id = cur, paths = r.paths; INST = await totem.instList(); selectItem('i', id); go('home'); const ok = await installAndWait(id); go('bl'); cur = id; kind = 'mods';
    if (!ok) { $('be').textContent = `Не удалось установить ${N}: моды не добавлены.`; drawM(); return; } return addF(paths, force); }
  if (r.incompat) { const go_ = await ask('Ошибка: версия не подходит этой сборке.\n• ' + r.incompat.map((x) => x.msg).join('\n• ') + '\n\nДобавить всё равно?', 'Всё равно добавить', 'Отмена');
    if (!go_) { $('be').textContent = 'Добавление отменено: версия не подходит сборке.'; return; } return addF(r.paths, true, dirMode); }
  $('be').textContent = r.ok ? '' : r.error; drawM(); drawCard(); };
$('addb').onclick = () => addF(); $('addd').onclick = () => addF(undefined, false, true);
$('bmain').ondragover = (e) => e.preventDefault(); $('bmain').ondrop = (e) => { e.preventDefault(); if (BF !== 'snaps' && cur) addF([...e.dataTransfer.files].map((f) => totem.pathFor(f))); };
segBuild($('btabs'), BTABS, 'mods', (k) => { kind = k; SELF.clear(); drawM(); });

// ----- точки восстановления -----
const snapRow = (s, i) => `<div class=bsr data-s="${esc(s.id)}">${ic(['history', 'puzzle', 'star'][i % 3])}<span><b>${esc(s.label)}</b><small>${esc(fmtWhen(s.time))} · модов: ${s.mods}</small></span><button class=ib data-a=sm title="Действия">${ic('dots')}</button></div>`;
const snapMenu = (btn, id, sid, after) => showMenu(btn, [{ t: 'Восстановить', i: 'refresh', f: async () => { if (!(await ask('Вернуть сборку (моды, ресурс-паки, шейдеры, конфиги) к этой точке? Текущее состояние сохранится в новую точку.', 'Вернуть'))) return; const r = await totem.instRestore(id, sid); $('be').textContent = r.ok ? '' : r.error; if (r.ok) toast('Сборка восстановлена'); after(); } },
  { t: 'Удалить точку', i: 'trash', d: 1, f: async () => { const r = await totem.instSnapDel(id, sid); $('be').textContent = r.ok ? '' : r.error; after(); } }]);
const drawSnapsMain = async () => { const id = cur, L = await totem.instSnaps(id); if (cur !== id) return;
  $('bsm').innerHTML = `<div class=btool><b>Точки восстановления: ${esc(curInst()?.name || '')}</b><span class=grow></span><button class="btn sm" data-a=snap>${ic('plus')}Создать точку</button></div><div class=btrows style="padding:10px;display:flex;flex-direction:column;gap:8px">${L.map(snapRow).join('') || '<p class=empty>Точек пока нет.</p>'}</div>`; };
$('bsm').onclick = (e) => { const b = e.target.closest('[data-a]'); if (!b) return; if (b.dataset.a === 'snap') makeSnap(cur); else if (b.dataset.a === 'sm') snapMenu(b, cur, b.closest('.bsr').dataset.s, () => { drawSnapsMain(); drawCard(); }); };
const drawAllSnaps = async () => { const parts = []; for (const i of INST) { const L = await totem.instSnaps(i.id); parts.push(`<div class=glass data-i="${esc(i.id)}"><h3>${gIcon('i')}${esc(i.name)} <span class=mut style="font-size:13px;font-weight:400">${esc(i.mc)} · ${esc(LN[i.loader] || i.loader)}</span><span class=grow></span><button class="btn ghost sm" data-a=snap>${ic('plus')}Создать точку</button></h3><div class=bsl2 style="gap:6px">${L.map(snapRow).join('') || '<p class=mut style="margin:0;font-size:13px">Точек нет.</p>'}</div></div>`); }
  if (BF === 'snaps') $('ball').innerHTML = parts.join('') || '<p class=empty>Сборок пока нет.</p>'; };
$('ball').onclick = (e) => { const b = e.target.closest('[data-a]'); if (!b) return; const id = b.closest('[data-i]')?.dataset.i; if (!id) return; if (b.dataset.a === 'snap') makeSnap(id); else if (b.dataset.a === 'sm') snapMenu(b, id, b.closest('.bsr').dataset.s, drawAllSnaps); };

// ----- проверка сборки и журнал ошибок -----
const findHtml = (L, bid) => L.map((f) => `<div class="fd ${esc(f.level)}" data-b="${esc(bid || '')}">${ic(f.level === 'info' ? 'info' : 'warn')}<div><b>${esc(f.title)}</b>${f.detail ? `<p>${esc(f.detail)}</p>` : ''}${f.files?.length ? `<div class=chips>${f.files.map((x) => `<span class=chip title="${esc(x)}">${esc(x)}</span>`).join('')}</div>` : ''}
<div class=fa>${(f.files || []).length && ['disable', 'update'].includes(f.fix) ? f.files.slice(0, 6).map((x) => `<button class="btn ghost" data-fa=off data-f="${esc(x)}">Выключить ${esc(x.length > 26 ? x.slice(0, 24) + '…' : x)}</button>`).join('') : ''}${f.search ? `<button class="btn ghost" data-fa=cat data-q="${esc(f.search)}">${ic('catalog')}Найти в каталоге</button>` : ''}${['ram', 'jvm', 'java'].includes(f.fix) ? `<button class="btn ghost" data-fa=set>${ic('gear')}Открыть настройки</button>` : ''}</div></div></div>`).join('');
const findClick = async (e) => { const b = e.target.closest('[data-fa]'); if (!b) return; const fd = b.closest('.fd'), bid = fd.dataset.b || cur, a = b.dataset.fa;
  if (a === 'off') { const r = await totem.filesToggle(bid, b.dataset.f); if (r.ok) { b.disabled = true; b.textContent = 'Выключено ✓'; toast('Мод выключен. Запустите сборку снова'); if (bid === cur) { drawM(); drawCard(); } } else toast(r.error, 1); }
  else if (a === 'cat') { $('chkm').classList.remove('on'); $('errm').classList.remove('on'); openCatalog({ inst: bid, q: b.dataset.q }); } else if (a === 'set') { $('chkm').classList.remove('on'); $('errm').classList.remove('on'); go('st'); } };
$('chkl').onclick = findClick; $('errl').onclick = findClick; $('chkx').onclick = () => $('chkm').classList.remove('on');
const runCheck = async () => { if (!cur) return; const i = curInst(); busyOn('Проверяем моды сборки…'); const r = await totem.instCheck(cur); busyOff(); if (!r.ok) return toast(r.error, 1);
  const er = r.findings.filter((f) => f.level === 'error').length, wr = r.findings.filter((f) => f.level === 'warn').length;
  $('chkt').textContent = `Проверка сборки «${i.name}»`; $('chksub').textContent = `Проверено модов: ${r.count}. Ошибок: ${er}, предупреждений: ${wr}.`;
  $('chkl').innerHTML = r.findings.length ? findHtml(r.findings, cur) : '<div class="fd info"><div><b>Проблем не найдено</b><p>Зависимости на месте, дубликатов и несовместимых пар не видно. Если игра всё равно не запускается — после попытки запуска лаунчер разберёт лог и покажет причину в «Ошибки».</p></div></div>'; $('chkm').classList.add('on'); };
const errHtml = (L) => L.map((e, k) => `<details class=eri ${k === 0 ? 'open' : ''} data-id="${esc(e.id)}"><summary>${ic('warn')}<span style="flex:1;min-width:0"><b>${esc(e.title)}</b><small>${esc(fmtWhen(e.time))}${e.build?.name ? ' · ' + esc(e.build.name) + ' (' + esc(e.build.mc) + ', ' + esc(LN[e.build.loader] || e.build.loader) + ')' : ''}</small></span><button class=ib data-a=edel title="Удалить запись">${ic('trash')}</button></summary>
<div class=eb>${e.message ? `<p class=mut style="margin:0">${esc(e.message)}</p>` : ''}${findHtml(e.findings || [], e.build?.id)}${e.raw ? `<details><summary class=mut style="cursor:pointer">Показать полный лог</summary><pre class=raw>${esc(e.raw)}</pre><div class=fa style="margin-top:6px;display:flex"><button class="btn ghost sm" data-a=ecopy>${ic('copy')}Копировать лог</button></div></details>` : ''}</div></details>`).join('');
const openErrs = async (bid) => { ERRS = await totem.errList(); const L = bid ? ERRS.filter((e) => e.build?.id === bid) : ERRS; $('errsub').textContent = bid ? `Последние ошибки сборки «${INST.find((x) => x.id === bid)?.name || ''}». Лаунчер разбирает лог и указывает, какие моды мешают запуску.` : 'Лаунчер разбирает лог неудачного запуска и указывает, какие моды мешают.';
  $('errl').innerHTML = L.length ? errHtml(L) : '<p class=empty>Ошибок нет. Если сборка не запустится, причина появится здесь.</p>'; $('errl').dataset.b = bid || ''; $('errm').classList.add('on'); };
$('errl').addEventListener('click', async (e) => { const b = e.target.closest('[data-a]'); if (!b) return; const id = b.closest('.eri')?.dataset.id; if (b.dataset.a === 'edel') { e.preventDefault(); ERRS = await totem.errRemove(id); openErrs($('errl').dataset.b || ''); drawCard(); } else if (b.dataset.a === 'ecopy') { const x = ERRS.find((y) => y.id === id); if (x) { await totem.copyText(x.raw); toast('Лог скопирован'); } } });
$('errclr').onclick = async () => { if (!(await ask('Удалить все записи об ошибках?', 'Удалить'))) return; ERRS = await totem.errClear(); openErrs($('errl').dataset.b || ''); drawCard(); }; $('errx').onclick = () => $('errm').classList.remove('on');
// игра завершилась с ошибкой: окно с быстрыми исправлениями показывает диагностика запуска, а подробный разбор «кто с кем конфликтует» ложится в журнал
totem.onErrNew((r) => { ERRS.unshift(r); if ($('p-bl').classList.contains('on')) drawCard(); });
totem.errList().then((l) => { ERRS = l; }).catch(() => {});

// ----- окно «Создать сборку» (поверх всего): новая сборка или получение сборки друга по коду -----
let CBM = 0, cbInfo = null, cbSeq = 0, cbNameTouched = false;
const fillBv = () => { const cv = $('bv').value; $('bv').innerHTML = V.filter((v) => v.type === 'release').map((v) => `<option>${esc(v.id)}</option>`).join(''); if (cv) $('bv').value = cv; };
const cbMode = (m) => { CBM = m; const sg = $('cbseg'); sg.querySelectorAll('button').forEach((b) => b.classList.toggle('on', +b.dataset.s === m)); sg.querySelector('.ind2').style.transform = `translateX(${m * 100}%)`;
  $('cbnew').hidden = m !== 0; $('cbcode').hidden = m !== 1; $('bc').innerHTML = ic(m ? 'dl' : 'plus') + (m ? 'Получить сборку' : 'Создать'); $('bc').disabled = m === 1 && !cbInfo; $('cbe').textContent = ''; };
const openCreate = (mode = 0) => { if (!$('bv').options.length) { fillBv(); if (!V.length) loadV().then(fillBv); } cbMode(mode); $('cbm').classList.add('on'); setTimeout(() => (mode ? $('bcode') : $('bn')).focus(), 80); };
const closeCreate = () => $('cbm').classList.remove('on');
$('cbseg').onclick = (e) => { const b = e.target.closest('button'); if (b) { cbMode(+b.dataset.s); setTimeout(() => (CBM ? $('bcode') : $('bn')).focus(), 60); } };
$('cbx').onclick = $('cbno').onclick = closeCreate; $('cbm').onmousedown = (e) => { if (e.target === $('cbm')) closeCreate(); };
const LNAME = { fabric: 'Fabric', forge: 'Forge', neoforge: 'NeoForge', vanilla: 'Vanilla' };
const infoChips = (s) => `<span class=chip>${ic('puzzle')}Модов: <b>${s.mods}</b>${s.off ? ` (выключено: ${s.off})` : ''}</span>${s.resourcepacks ? `<span class=chip>${ic('image')}Ресурс-паков: <b>${s.resourcepacks}</b></span>` : ''}${s.shaders ? `<span class=chip>${ic('sun')}Шейдеров: <b>${s.shaders}</b></span>` : ''}`;
let cbT = 0; $('bcode').oninput = () => { clearTimeout(cbT); const seq = ++cbSeq, v = $('bcode').value; cbInfo = null; $('bc').disabled = true; $('bcinfo').hidden = true; $('bcnl').hidden = true; $('cbe').textContent = '';
  if (!v.trim()) return; cbT = setTimeout(async () => { const r = await totem.sharePeek(v); if (seq !== cbSeq) return;
    if (!r.ok) { $('cbe').textContent = r.error; return; } cbInfo = r.info; $('bcinfo').innerHTML = `<span class=chip>${ic('grid')}Minecraft <b>${esc(r.info.mc)}</b></span><span class=chip>${ic('anvil')}${esc(LNAME[r.info.loader] || r.info.loader)}</span>` + infoChips(r.info);
    $('bcinfo').hidden = false; $('bcnl').hidden = false; if (!cbNameTouched || !$('bcn').value) { $('bcn').value = r.info.name || 'Сборка друга'; cbNameTouched = false; } $('bc').disabled = false; }, 160); };
$('bcn').oninput = () => { cbNameTouched = true; };
const importCode = async () => { const code = $('bcode').value, name = $('bcn').value.trim() || cbInfo?.name || 'Сборка друга'; if (!cbInfo) return;
  if (BUSY.includes(GS.state)) { $('cbe').textContent = 'Дождитесь окончания текущей загрузки или остановите игру.'; return; }
  closeCreate(); const r = await dmRun(`Сборка «${name}» по коду`, () => totem.shareImport({ code, name }));
  if (r.cancelled) return toast('Загрузка отменена'); if (!r.ok) return toast(r.error || 'Не удалось получить сборку', 1);
  $('bcode').value = ''; cbInfo = null; INST = await totem.instList(); cur = r.inst.id; BF = 'all'; selectItem('i', r.inst.id); if ($('p-bl').classList.contains('on')) drawB();
  toast(`Сборка «${r.inst.name}» скачана${r.missing ? `, но ${r.missing} файл(ов) не нашлось на Modrinth` : ''}. Дальше установится игра`); installAndWait(r.inst.id); };
$('bc').onclick = async () => { $('cbe').textContent = ''; if (CBM === 1) return importCode();
  if (!$('bv').value) { $('cbe').textContent = 'Список версий Minecraft не загружен: проверьте интернет и откройте вкладку «Загрузки».'; return; } $('bc').disabled = true; const r = await totem.instCreate({ name: $('bn').value, mc: $('bv').value, loader: $('bk').value }); $('bc').disabled = false;
  if (!r.ok) { $('cbe').textContent = r.error; return; } $('bn').value = ''; closeCreate(); await loadB(); cur = r.inst.id; selectItem('i', r.inst.id); go('home'); installAndWait(r.inst.id); };
$('bcreate').onclick = () => openCreate(0);
$('bn').onkeydown = (e) => { if (e.key === 'Enter') $('bc').click(); }; $('bcn').onkeydown = (e) => { if (e.key === 'Enter' && !$('bc').disabled) $('bc').click(); };

// ----- полный сброс данных лаунчера (Настройки → Игра, внизу) -----
$('rstall').onclick = async () => { if (!(await ask('ВНИМАНИЕ! Лаунчер будет ПОЛНОСТЬЮ очищен: удалятся все сборки, карты, миры, версии Minecraft, моды, аккаунты, скины и настройки. Запущенная игра закроется. Это нельзя отменить.\n\nЛаунчер закроется, останется маленькое окно с прогрессом, а после очистки лаунчер откроется заново, как будто вы его только что установили.', 'Да, удалить всё', 'Отмена'))) return;
  const r = await totem.resetAll(); if (!r.ok) toast(r.error || 'Не удалось начать сброс', 1); };

// ----- «Поделиться»: код сборки (только файлы из каталога) -----
let shrSeq = 0;
const shareOpen = async (id) => { const i = INST.find((x) => x.id === id); if (!i) return; const seq = ++shrSeq;
  $('shrt').textContent = `Поделиться сборкой «${i.name}»`; $('shrc').value = ''; $('shrc').placeholder = 'Готовлю код…'; $('shri').innerHTML = ''; $('shrw').hidden = true; $('shre').textContent = ''; $('shrcp').disabled = true; $('shrs').hidden = false; $('shrm').classList.add('on');
  const r = await totem.shareMake(id); if (seq !== shrSeq || !$('shrm').classList.contains('on')) return;
  if (!r.ok) { $('shrc').placeholder = ''; $('shrs').hidden = true; $('shre').textContent = r.offline ? 'Нет связи с Modrinth: код делается по данным каталога. Проверьте интернет и попробуйте ещё раз.' : r.error; return; }
  $('shrc').value = r.code; $('shrcp').disabled = false; $('shri').innerHTML = infoChips(r.stats) + `<span class=chip>${ic('scroll')}Длина кода: <b>${r.code.length}</b> симв.</span>`;
  if (r.manualCount) { $('shrw').hidden = false; $('shrw').textContent = `Не вошло в код (${r.manualCount}): ${r.manual.join(', ')}${r.manualCount > r.manual.length ? ' и др.' : ''}.\nЭто файлы, добавленные вручную: без сервера через код передаются только файлы из каталога, поэтому у друга их не будет.`; } };
$('shrcp').onclick = async () => { const t = $('shrc').value; if (!t) return; try { await navigator.clipboard.writeText(t); } catch { $('shrc').select(); document.execCommand('copy'); } toast('Код скопирован. Отправьте его другу'); };
const closeShare = () => { shrSeq++; $('shrm').classList.remove('on'); }; $('shrx').onclick = $('shrno').onclick = closeShare; $('shrm').onmousedown = (e) => { if (e.target === $('shrm')) closeShare(); };
document.addEventListener('keydown', (e) => { if (e.key !== 'Escape') return; if ($('cbm').classList.contains('on') && !$('askm').classList.contains('on')) closeCreate(); else if ($('shrm').classList.contains('on')) closeShare(); });

// ---------- скины: карточка на главной, 3D-персонаж и редактор ----------
const Vh = Skin.makeViewer($('hv'), { follow: true, auto: true, lockPitch: true }), Vs = Skin.makeViewer($('sv'), { auto: true }), tc = $('ed').getContext('2d', { willReadFrequently: true });
if (Vh) Vh.set({ rx: 0.32, z: +(80 * 0.9 ** 3).toFixed(2), ry: 0 }); // по умолчанию приближено на 3 «крутки» колёсика if (Vs) Vs.set({ rx: 0.22, z: 72 }); if (Vs) Vs.on = false;
let SKL = [], skIdx = 0, tool = 'pen', curSkin = null, Us = [], Rs = [], down = false, last = null, zoom = 8;
const steveCv = (slim) => { const c = document.createElement('canvas'); c.width = c.height = 64; Skin.steve(c.getContext('2d'), slim); return c; };
const skinSrc = (s) => new Promise((ok) => { if (s.id === 'steve') return ok(steveCv(false)); const im = new Image(); im.onload = () => ok(im); im.src = 'data:image/png;base64,' + s.png; });
const skinPair = async (s) => { const src = await skinSrc(s), c = document.createElement('canvas'); c.width = c.height = 64; const x = c.getContext('2d', { willReadFrequently: true }); x.drawImage(src, 0, 0);
  const d = x.getImageData(0, 0, 64, 64).data, sl = s.model === 'slim', mk = (toSlim) => { const o = Skin.convertArms(d, sl, toSlim), cc = document.createElement('canvas'); cc.width = cc.height = 64; cc.getContext('2d').putImageData(new ImageData(o, 64, 64), 0, 0); return cc.toDataURL('image/png').split(',')[1]; };
  return { wide: mk(false), slim: mk(true) }; };
const applyActive = async () => { try { const s = SKL[skIdx]; if (!s) return; const p = await skinPair(s); totem.skinApply(p.wide, p.slim); } catch {} };
const showSkin = async (dir) => { const s = SKL[skIdx] || SKL[0]; $('skname').textContent = s.name; applyActive(); if (!Vh) return; const src = await skinSrc(s); if (dir) Vh.change(src, s.model === 'slim', dir); else Vh.set({ src, slim: s.model === 'slim' }); };
let ELYSK = null; // скин текущего аккаунта Ely.by (его меняют на сайте ely.by, у нас он только показывается)
const loadSkins = async () => { SET = await totem.getSettings(); const acc = ACC?.accounts?.find((a) => a.id === ACC.current); ELYSK = null;
  if (acc?.type === 'ely') { const r = await totem.elySkin(acc.name).catch(() => null); if (r?.ok && r.png) ELYSK = { id: 'ely', name: 'Скин Ely.by · ' + acc.name, model: r.model, png: r.png, ely: true }; }
  SKL = [...(ELYSK ? [ELYSK] : []), { id: 'steve', name: 'Steve (по умолчанию)', model: 'classic' }, ...(await totem.skinsList())];
  skIdx = ELYSK ? 0 : Math.max(0, SKL.findIndex((s) => s.id === SET.currentSkin)); await showSkin(); };
const stepSkin = (d) => { if (SKL.length < 2) return; skIdx = (skIdx + d + SKL.length) % SKL.length; if (SKL[skIdx].id !== 'ely') totem.setSettings({ currentSkin: SKL[skIdx].id }); showSkin(d); };
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
// тонкие серые границы частей тела на картине редактора: рамка каждой части (голова, тело, руки, ноги, основной и внешний слой) и бледные линии между гранями
const drawGuides = () => { const g = $('edg'); if (!g || !window.Skin?._t) return; const { PARTS, faces } = Skin._t, sl = $('sm').value === 'slim', out = [];
  for (const [, , s, ub, uo] of PARTS(sl)) for (const [u, v] of [ub, uo]) { const [w, h, d] = s; for (const [x, y, fw, fh] of Object.values(faces(u, v, w, h, d))) out.push(`<rect class=fc x="${x}" y="${y}" width="${fw}" height="${fh}"/>`); out.push(`<rect class=pt x="${u}" y="${v}" width="${2 * d + 2 * w}" height="${d + h}"/>`); }
  g.innerHTML = out.join(''); };
const skTab = (i) => { if (i === 1) drawGuides(); document.querySelectorAll('#skt button').forEach((b, j) => b.classList.toggle('on', j === i)); $('skt').querySelector('.ind2').style.transform = `translateX(${i * 100}%)`; $('skr').style.transform = `translateX(${-100 / 3 * i}%)`; document.querySelector('.skg').classList.toggle('cat', i === 2); window.dispatchEvent(new CustomEvent('sktab', { detail: i })); };
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
const loadS = async () => { await loadSkins(); const cid = ELYSK ? 'ely' : (SET.currentSkin || 'steve');
  $('sl').innerHTML = `<div class="skc add" data-s=new><div class=skf>${ic('plus', 'big')}</div><div class=skn>Новый скин</div></div>` + SKL.map((s, i) => `<div class="skc${s.id === cid || (s.id === 'ely' && skIdx === 0 && ELYSK) ? ' cur' : ''}" style="animation-delay:${i * 40}ms"><div class=skf><canvas width=80 height=160 data-i="${esc(s.id)}"></canvas></div><div class=skn title="${esc(s.name)}">${esc(s.name)}</div><div class=ska><button class="btn sm" data-s=use data-i="${esc(s.id)}">${ic('check')}${s.id === 'ely' ? 'Ваш скин' : s.id === cid ? 'Применён' : 'Применить'}</button><button class="btn ghost sm" data-s=ed data-i="${esc(s.id)}">${ic('pen')}Править</button>${s.id === 'steve' || s.id === 'ely' ? '' : `<button class="btn red sm" data-s=del data-i="${esc(s.id)}">${ic('trash')}</button>`}</div></div>`).join('');
  for (const c of $('sl').querySelectorAll('canvas[data-i]')) { const s = SKL.find((x) => x.id === c.dataset.i); skinSrc(s).then((src) => Skin.drawFront(c.getContext('2d'), src, s.model === 'slim')); } };
$('sl').onclick = async (e) => { const b = e.target.closest('[data-s]'); if (!b) return; const id = b.dataset.i, act = b.dataset.s, s = SKL.find((x) => x.id === id);
  if (act === 'new') { push(); baseSkin(); curSkin = null; $('sn2').value = 'Новый скин'; sync(); skTab(1); }
  if (act === 'ed') { if (id === 'steve') { push(); Skin.steve(tc, false); sync(); curSkin = null; $('sn2').value = 'Steve (копия)'; $('sm').value = 'classic'; } else if (id === 'ely') { await loadImg('data:image/png;base64,' + s.png); curSkin = null; $('sn2').value = s.name.replace('Скин Ely.by · ', 'Ely.by ') + ' (копия)'; $('sm').value = s.model; toast('Это копия вашего скина с Ely.by: сохраните её как отдельный скин'); } else { await loadImg('data:image/png;base64,' + s.png); curSkin = id; $('sn2').value = s.name; $('sm').value = s.model; }
    if (Vs) Vs.set({ slim: slim() }); skTab(1); }
  if (act === 'use') { if (id === 'ely') { toast('Скин аккаунта Ely.by меняется на сайте ely.by и подтягивается автоматически'); return; } await totem.setSettings({ currentSkin: id }); loadS(); }
  if (act === 'del' && (await ask('Удалить скин «' + s.name + '»?', 'Удалить'))) { await totem.skinRemove(id); if (curSkin === id) curSkin = null; if (SET.currentSkin === id) await totem.setSettings({ currentSkin: '' }); loadS(); } };
window.SKREADY = true;

// ---------- настройки, хранилище, файловый менеджер ----------
const gbText = (m) => String(+(m / 1024).toFixed(2)).replace('.', ',') + ' ГБ';
const ramUp = () => { const r = $('ram'); r.style.setProperty('--p', ((r.value - r.min) / (r.max - r.min) * 100) + '%'); $('ramv').textContent = gbText(+r.value);
  const v = +r.value, mx = +r.max; $('ramw').textContent = v < 2048 ? 'Для модов лучше от 3 ГБ' : v > mx * 0.8 ? 'Много: системе может не хватить памяти' : ''; };
// внешний вид, зависящий от настроек: классы эффектов, яркость/размытие фона, свой фон
const applyUi = () => { const b = document.body.classList; b.toggle('noanim', SET.anim === false); b.toggle('nohover', SET.hoverFx === false); b.toggle('notrans', SET.transFx === false); b.toggle('noaura', SET.playAura === false);
  if (window.setCustomBg) setCustomBg(SET.bgCustomUrl || ''); if (window.setBgLook) setBgLook(SET.bgBright ?? 100, !!SET.bgBlur); if (window.setHomeBg) setHomeBg(SET.bgHome || 'portal'); };
const cfState = (t, c) => { const e = $('cfst'); e.textContent = t; e.className = 'tag ' + (c || ''); };
const loadSettings = async () => { SET = await totem.getSettings(); document.querySelectorAll('[data-k]').forEach((e) => { const v = SET[e.dataset.k]; e.type === 'checkbox' ? (e.checked = !!v) : (e.value = v || ''); });
  const r = $('ram'); r.min = 1024; r.max = SET.maxRam; r.step = 256; r.value = Math.min(SET.ram, SET.maxRam); $('ramh').textContent = `Доступно для выделения: ${gbText(SET.maxRam)} (1 ГБ остаётся системе)`; ramUp();
  $('bgbr').value = SET.bgBright ?? 100; bgbUp(); $('skcols').value = SET.skinCols ?? 4; skcUp(); applyUi(); cfState(SET.curseforgeKey ? 'ключ сохранён' : 'ключ не задан', SET.curseforgeKey ? 'ok' : '');
  drawBgp(); drawThm(); const i = await totem.storageInfo(); $('pth').textContent = i.path; $('sz').textContent = mb(i.bytes); };
const skcUp = () => { const r = $('skcols'); r.style.setProperty('--p', ((r.value - r.min) / (r.max - r.min) * 100) + '%'); $('skcolsv').textContent = r.value; };
$('skcols').oninput = () => { skcUp(); window.SkinCat?.setCols($('skcols').value); };
$('skcols').onchange = async () => { const v = +$('skcols').value, r = await totem.setSettings({ skinCols: v }); if (r.ok) SET.skinCols = v; else $('se').textContent = r.error; };
const bgbUp = () => { const r = $('bgbr'); r.style.setProperty('--p', ((r.value - r.min) / (r.max - r.min) * 100) + '%'); $('bgbv').textContent = r.value + '%'; };
$('ram').oninput = ramUp; $('ram').onchange = async () => { const x = await totem.setSettings({ ram: +$('ram').value }); $('se').textContent = x.ok ? '' : x.error; };
const ramStep = async (d) => { const r = $('ram'), v = Math.max(+r.min, Math.min(+r.max, +r.value + d)); if (v === +r.value) return; r.value = v; ramUp(); const x = await totem.setSettings({ ram: v }); $('se').textContent = x.ok ? '' : x.error; };
$('ramup').onclick = () => ramStep(512); $('ramdn').onclick = () => ramStep(-512);
$('bgbr').oninput = () => { bgbUp(); if (window.setBgLook) setBgLook($('bgbr').value, SET.bgBlur); };
$('bgbr').onchange = async () => { const v = +$('bgbr').value, r = await totem.setSettings({ bgBright: v }); if (r.ok) SET.bgBright = v; else $('se').textContent = r.error; };
document.querySelectorAll('[data-k]').forEach((e) => (e.onchange = async () => { const v = e.type === 'checkbox' ? e.checked : e.type === 'number' ? (+e.value || 0) : e.value; const r = await totem.setSettings({ [e.dataset.k]: v }); $('se').textContent = r.ok ? '' : r.error; if (r.ok) loadSettings(); }));
// левое меню разделов настроек
document.querySelectorAll('.sti').forEach((b) => (b.onclick = () => { document.querySelectorAll('.sti').forEach((x) => x.classList.toggle('on', x === b)); document.querySelectorAll('.ss').forEach((x) => x.classList.toggle('on', x.id === 'ss-' + b.dataset.s)); $('stmain').scrollTop = 0; if (b.dataset.s === 'files') fload(); }));
// API-ключи
$('cfeye').onclick = () => { const k = $('cfkey'); k.type = k.type === 'password' ? 'text' : 'password'; };
$('cfchk').onclick = async () => { const k = $('cfkey').value; if (!k.trim()) { cfState('ключ пустой', 'bad'); return; } $('cfchk').disabled = true; cfState('проверяем…'); const r = await totem.cfCheck(k); $('cfchk').disabled = false;
  if (r.ok) { cfState('ключ работает', 'ok'); const s = await totem.setSettings({ curseforgeKey: k }); if (s.ok) SET.curseforgeKey = k; } else { cfState(r.offline ? 'нет интернета' : 'ключ не подошёл', 'bad'); toast(r.error || 'Не удалось проверить ключ', 1); } };
$('elyset').onclick = () => elyOpen();
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
const BGN = { portal: 'Портал', village: 'Деревня на рассвете', cave: 'Пещера', cabin: 'Домик ночью', fireplace: 'Камин', sunset: 'Закат со Стивом' };
const drawBgp = () => { const cur = SET.bgHome || 'portal', cu = SET.bgCustomUrl;
  $('bgp').innerHTML = Object.entries(BGN).map(([k, n]) => `<button class="wtl${cur === k ? ' on' : ''}" data-b=${k} style="background-image:url(assets/bg/${BG_FILES[k]})"><span>${n}</span><i class=ck>${ic('check')}</i></button>`).join('')
    + (cu ? `<button class="wtl${cur === 'custom' ? ' on' : ''}" data-b=custom style="background-image:url('${cu}')"><span>Свой фон</span><i class=ck>${ic('check')}</i><i class=wtdel data-del=1 title="Удалить свой фон">${ic('x')}</i></button>` : '')
    + `<button class="wtl add" id=bgadd>${ic('image')}${cu ? 'Заменить фон' : 'Свой фон'}</button>`; };
// ---------- цвет темы: пресеты + свой цвет, применяется сразу, сохраняется с задержкой ----------
const drawThm = () => { const h0 = Theme.clamp(window.THEME_H ?? SET.themeHue ?? Theme.DEF), s0 = window.THEME_S ?? SET.themeSat ?? 1; // только показывает текущий цвет, сам цвет применяют theme.js и setTheme
  const on = Theme.PRESETS.find(([, h, sv]) => (sv === 0 ? s0 < 0.05 : s0 >= 0.05 && h === h0));
  $('thm').innerHTML = Theme.PRESETS.map(([n, h, sv]) => `<button class="chip thp${on && on[0] === n ? ' on' : ''}" data-h=${h} data-s=${sv} style="--sh:${h};--ss:${sv}"><i></i>${n}</button>`).join(''); $('thc').value = Theme.hueToHex(h0); };
let thmT = 0, thmSeq = 0;
const saveTheme = (h, sv, now) => { clearTimeout(thmT); const seq = ++thmSeq; const go = async () => { const r = await totem.setSettings({ themeHue: h, themeSat: sv }); if (seq !== thmSeq) return; if (!r.ok) { toast(r.error || 'Не удалось сохранить тему', 1); Theme.apply(SET.themeHue ?? Theme.DEF, SET.themeSat ?? 1); drawThm(); return; } SET.themeHue = h; SET.themeSat = sv; }; if (now) go(); else thmT = setTimeout(go, 350); };
const setTheme = (h, sv = 1, now = true) => { h = Theme.clamp(h); Theme.apply(h, sv); drawThm(); saveTheme(h, sv, now); };
$('thm').onclick = (e) => { const b = e.target.closest('.thp'); if (!b) return; setTheme(+b.dataset.h, +b.dataset.s); };
$('thc').oninput = () => { const h = Theme.hexToHue($('thc').value); Theme.apply(h, 1); document.querySelectorAll('#thm .thp').forEach((b) => b.classList.remove('on')); saveTheme(h, 1, false); };
$('thc').onchange = () => setTheme(Theme.hexToHue($('thc').value), 1);
$('thr').onclick = () => { setTheme(Theme.DEF, 1); toast('Тема сброшена на фиолетовую'); };
$('bgp').onclick = async (e) => {
  if (e.target.closest('#bgadd')) { const r = await totem.bgPick(); if (r.cancelled) return; if (!r.ok) return toast(r.error || 'Не удалось выбрать фон', 1); SET.bgCustomUrl = r.url; SET.bgHome = 'custom'; applyUi(); drawBgp(); toast('Свой фон установлен'); return; }
  if (e.target.closest('[data-del]')) { if (!(await ask('Удалить свой фон?', 'Удалить'))) return; const r = await totem.bgClear(); if (!r.ok) return toast(r.error, 1); SET.bgCustomUrl = ''; if (SET.bgHome === 'custom') SET.bgHome = 'portal'; applyUi(); drawBgp(); return; }
  const b = e.target.closest('[data-b]'); if (!b) return; const r = await totem.setSettings({ bgHome: b.dataset.b }); if (!r.ok) return toast(r.error, 1); SET.bgHome = b.dataset.b; applyUi(); drawBgp(); toast('Фон главного меню изменён'); };
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
const CT = { type: 'mod', q: '', mc: '', loader: '', sort: 'pop', mapCat: '', off: 0, items: [], total: 0, busy: false, inst: '' };
const CICON = { mod: 'puzzle', resourcepack: 'image', shader: 'sun', datapack: 'scroll', modpack: 'crate', map: 'mapi' };
const fmtNum = (n) => (n >= 1e6 ? (n / 1e6).toFixed(1).replace('.', ',') + ' млн' : n >= 1e3 ? (n / 1e3).toFixed(1).replace('.', ',') + ' тыс.' : String(n || 0));
const cssUrl = (u) => `url("${encodeURI(String(u)).replace(/["']/g, '%22')}")`;
const mdText = (s) => String(s || '').replace(/!\[[^\]]*\]\([^)]*\)/g, '').replace(/<[^>]+>/g, '').replace(/\[([^\]]+)\]\([^)]*\)/g, '$1').replace(/[#*_`>~]/g, '').replace(/\n{3,}/g, '\n\n').trim();
const catOv = (k, t = '') => { const o = $('catov'); o.classList.toggle('on', !!k); if (!k) return; if (k !== 'load') $('catmore').hidden = true; // кнопка «Показать ещё» просвечивала сквозь окно ошибки/ключа
  o.innerHTML = k === 'load' ? '<div class=bigspin></div><b>Загрузка каталога…</b>' : k === 'off' ? `<div class=empty style="padding:0"></div><b>Нет подключения к интернету</b><span class=mut>Каталог работает только онлайн.</span><button class=btn id=catrf2>${ic('refresh')}Обновить</button>`
    : k === 'key' ? `<b>${t ? 'Ключ CurseForge не подошёл' : 'Нужен API-ключ CurseForge'}</b><span class="${t ? 'err' : 'mut'}" style="max-width:520px">${esc(t || 'Карты скачиваются с CurseForge. Получите бесплатный ключ на console.curseforge.com и вставьте сюда.')}</span><div class=f style="justify-content:center"><input id=catkey type=password class=in placeholder="API-ключ" size=40><button class=btn id=catkeyok>${ic('check')}Сохранить</button></div><button class="btn ghost sm" id=catkeyget>Получить ключ</button>`
    : `<b class=err>Не удалось загрузить каталог</b><span class=mut>${esc(t)}</span><button class=btn id=catrf2>${ic('refresh')}Повторить</button>`;
  const rf = $('catrf2'); if (rf) rf.onclick = () => catLoad(true, true); const ok = $('catkeyok'); if (ok) ok.onclick = async () => { ok.disabled = true; const r = await totem.setSettings({ curseforgeKey: $('catkey').value }); if (!r.ok) { ok.disabled = false; return toast(r.error, 1); } const c = await totem.cfCheck($('catkey').value); ok.disabled = false; if (!c.ok) { if (c.offline) return toast('Нет подключения к интернету', 1); return catOv('key', c.error); } SET.curseforgeKey = (await totem.getSettings()).curseforgeKey; toast('Ключ принят'); catLoad(true); };
  const kg = $('catkeyget'); if (kg) kg.onclick = () => totem.openUrl('https://console.curseforge.com/'); };
const card = (it, i) => `<div class="cc glass" data-i=${i} style="animation-delay:${Math.min(i % 20, 10) * 25}ms"><div class=cbn style='${it.images?.[0] || it.icon ? 'background-image:' + cssUrl(it.images?.[0] || it.icon) : ''}'></div><div class=cbd><div class=ch><img class=cic src="${esc(it.icon || '')}" alt=""><div><b>${esc(it.title)}</b><span class=mut>${esc(it.author || '')}</span></div></div>
  <p class=cds>${esc(it.desc || '')}</p><div class=cm>${(it.loaders || []).map((l) => `<span class=tag>${esc(l)}</span>`).join('')}${it.mcs?.length ? `<span class=tag>${esc(it.mcs.join(', '))}</span>` : ''}</div>
  <div class=cf><span class=mut style="display:flex;gap:6px;align-items:center">${ic('dl')}${fmtNum(it.downloads)}</span>${dlBtn(it, i)}</div></div></div>`;
let HAVE = {}; // id сборки -> ключи проектов, уже лежащих в ней
const keyOf = (it) => `${it.src === 'cf' ? 'cf' : 'mr'}:${it.id}`;
const inWhere = (it) => (it.type === 'modpack' ? [] : INST.filter((i) => (HAVE[i.id] || []).includes(keyOf(it))));
const haveHere = (it) => !!CT.inst && it.type !== 'modpack' && it.type !== 'datapack' && (HAVE[CT.inst] || []).includes(keyOf(it)); // уже лежит в ВЫБРАННОЙ сборке — кнопка блокируется
const dlBtn = (it, i) => (haveHere(it) ? `<button class="btn sm ghost" disabled data-have=1>${ic('check')}Уже скачан</button>` : `<button class="btn sm" data-d=${i}>${ic('dl')}Скачать</button>`);
const refreshHave = async () => { const r = await totem.catInstalled().catch(() => null); if (r?.ok) HAVE = r.r; };
const drawCat = () => { $('catg').innerHTML = CT.items.map(card).join('') || '<p class=empty>Ничего не найдено</p>'; $('catmore').hidden = CT.items.length >= CT.total; };
// ---- запоминание последнего выбора и положения в списке ----
const CACHE = new Map(), ckey = () => [CT.type, CT.q, CT.mc, CT.loader, CT.sort, CT.mapCat].join('|');
const catSave = () => { CACHE.set(ckey(), { items: CT.items, total: CT.total, off: CT.off, scroll: $('catb').scrollTop }); };
let prefT = 0; const savePrefs = () => { clearTimeout(prefT); prefT = setTimeout(() => totem.setSettings({ catPrefs: { type: CT.type, mc: CT.mc, loader: CT.loader, sort: CT.sort, inst: CT.inst || '' } }).catch(() => {}), 400); };
const catLoad = async (reset = true, force = false) => { if (CT.busy) return;
  if (reset) { const c = !force && CACHE.get(ckey()); if (c) { CT.items = c.items; CT.total = c.total; CT.off = c.off; catOv(''); drawCat(); $('catb').scrollTop = c.scroll; return; } CT.off = 0; CT.items = []; $('catg').innerHTML = ''; $('catb').scrollTop = 0; catOv('load'); }
  CT.busy = true; const k = ckey(); const r = await totem.catSearch({ type: CT.type, q: CT.q, mc: CT.mc, loader: CT.loader, sort: CT.sort, mapCat: CT.mapCat, offset: CT.off }); CT.busy = false; if (k !== ckey()) return; // за время загрузки фильтры сменили
  if (!r.ok) { if (r.needKey) catOv('key'); else if (r.cfAuth) catOv('key', r.error); else if (r.offline) catOv('off'); else catOv('err', r.error); return; }
  catOv(''); CT.total = r.total || 0; CT.items.push(...r.hits); CT.off = CT.items.length; drawCat(); catSave(); };
$('catb').addEventListener('scroll', () => { const c = CACHE.get(ckey()); if (c) c.scroll = $('catb').scrollTop; }, { passive: true });
const catUi = () => { $('catl').hidden = !['mod', 'modpack'].includes(CT.type); $('catl').value = CT.loader; $('cats').value = CT.sort; $('catq').value = CT.q;
  $('catmc').hidden = CT.type !== 'map'; $('catmc').innerHTML = MAPCATS.map(([k, n]) => `<span class="chip${CT.mapCat === k ? ' on' : ''}" data-m="${k}">${n}</span>`).join(''); };
const catVers = () => { $('catv').innerHTML = '<option value="">Любая версия</option>' + V.filter((v) => v.type === 'release').slice(0, 120).map((v) => `<option${CT.mc === v.id ? ' selected' : ''}>${esc(v.id)}</option>`).join('') + (CT.mc && !V.some((v) => v.id === CT.mc) ? `<option selected>${esc(CT.mc)}</option>` : ''); $('catv').value = CT.mc; };
// категории внизу: «пилюля» переезжает к выбранной, список появляется с анимацией
segBuild($('ctabs'), CTYPES.map(([k, n]) => [k, n, CICON[k] || 'puzzle']), CT.type, (k) => { CT.type = k; CT.mapCat = ''; catUi(); savePrefs(); $('catg').classList.remove('swapin'); void $('catg').offsetWidth; $('catg').classList.add('swapin'); catLoad(); });
$('catmc').onclick = (e) => { const b = e.target.closest('[data-m]'); if (!b) return; CT.mapCat = b.dataset.m; catUi(); catLoad(); };
let ctt = 0; $('catq').oninput = () => { clearTimeout(ctt); ctt = setTimeout(() => { CT.q = $('catq').value; catLoad(); }, 350); };
$('catv').onchange = () => { CT.mc = $('catv').value; savePrefs(); catLoad(); }; $('catl').onchange = () => { CT.loader = $('catl').value; savePrefs(); catLoad(); }; $('cats').onchange = () => { CT.sort = $('cats').value; savePrefs(); catLoad(); }; $('catmore').onclick = () => catLoad(false);
$('catrf').onclick = async () => { CACHE.clear(); await refreshHave(); catLoad(true, true); }; // «Обновить»: список заново и в самое начало
// ---- выбор сборки сверху ----
const catInst = () => INST.find((x) => x.id === CT.inst);
const drawCbs = () => { const i = catInst(); $('cbsi').innerHTML = i ? gIcon('i') : ic('grid'); $('cbsn').textContent = i ? i.name : (INST.length ? 'Выберите сборку' : 'Сначала создайте сборку');
  $('cbsb').querySelector('small').textContent = i ? `Скачивать в сборку · ${i.mc} · ${LN[i.loader] || i.loader}` : 'Скачивать в сборку';
  $('cbsm').innerHTML = INST.map((x) => `<button class="cbsr${x.id === CT.inst ? ' on' : ''}" data-i="${esc(x.id)}">${gIcon('i')}<span><b>${esc(x.name)}</b><small>Minecraft ${esc(x.mc)} · ${esc(LN[x.loader] || x.loader)}</small></span>${x.fav ? ic('star') : ''}${x.id === CT.inst ? ic('check') : ''}</button>`).join('') + `<button class="cbsr add" data-i="+">${ic('plus')}<span><b>Создать новую сборку</b></span></button>`; };
const catPickInst = (id, applyFilters = true) => { const i = INST.find((x) => x.id === id); if (!i) return; CT.inst = id; if (applyFilters) { CT.mc = i.mc; CT.loader = i.loader === 'vanilla' ? '' : i.loader; } drawCbs(); catVers(); catUi(); savePrefs(); catLoad(); };
$('cbsb').onclick = (e) => { e.stopPropagation(); $('cbs').classList.toggle('open'); };
$('cbsm').onclick = (e) => { const b = e.target.closest('[data-i]'); if (!b) return; $('cbs').classList.remove('open'); if (b.dataset.i === '+') { go('bl'); openCreate(0); return; } catPickInst(b.dataset.i); };
document.addEventListener('click', (e) => { if (!e.target.closest('#cbs')) $('cbs').classList.remove('open'); });
// каталог — отдельная вкладка; openCatalog({ inst, q }) открывает её сразу с нужной сборкой (кнопка «Каталог» в карточке сборки, «Найти в каталоге» в проверке)
let catInit = false, catReq = null;
const openCatalog = (o = {}) => { catReq = o; go('cat'); };
const catPage = async () => { const o = catReq || {}; catReq = null; await refreshHave();
  if (!catInit) { catInit = true; const p = SET.catPrefs || {}; CT.type = CTYPES.some(([k]) => k === p.type) ? p.type : CT.type; CT.mc = p.mc || ''; CT.loader = p.loader || ''; CT.sort = p.sort || 'pop'; CT.inst = INST.some((x) => x.id === p.inst) ? p.inst : ''; $('ctabs').dataset.cur = CT.type; }
  if (o.inst && INST.some((x) => x.id === o.inst)) { const i = INST.find((x) => x.id === o.inst); CT.inst = i.id; CT.mc = i.mc; CT.loader = i.loader === 'vanilla' ? '' : i.loader; } // открыли из «Сборок»: эта сборка и её версия/загрузчик
  else if (!CT.inst || !catInst()) { const s0 = SEL?.k === 'i' && INST.some((x) => x.id === SEL.id) ? SEL.id : INST[0]?.id; CT.inst = s0 || ''; if (s0 && !CT.mc && !CT.loader) { const i = INST.find((x) => x.id === s0); CT.mc = i.mc; CT.loader = i.loader === 'vanilla' ? '' : i.loader; } }
  if (typeof o.q === 'string') { CT.q = o.q; if (o.q && CT.type !== 'mod') { CT.type = 'mod'; $('ctabs').dataset.cur = 'mod'; } }
  savePrefs(); drawCbs(); catVers(); catUi(); requestAnimationFrame(() => segSet($('ctabs'), CT.type, false));
  if (!CT.items.length || typeof o.q === 'string' || o.inst) catLoad(); else { drawCat(); const c = CACHE.get(ckey()); if (c) $('catb').scrollTop = c.scroll; } };
$('catdx').onclick = () => $('catd').classList.remove('on');
const pickWorld = (inst, it, worlds) => new Promise((res) => { const done = (v) => { $('pickm').classList.remove('on'); $('pickt').textContent = 'Выберите сборку'; res(v); };
  $('pickt').textContent = 'В какой мир поставить датапак?';
  $('pickl').innerHTML = worlds.map((w) => { const has = (HAVE[inst.id] || []).includes(keyOf(it) + '@' + w.name); return `<button class=row data-w="${esc(w.name)}" ${has ? 'disabled' : ''} style="width:100%;border:0;background:transparent;color:inherit;font:inherit;cursor:${has ? 'not-allowed' : 'pointer'};text-align:left;opacity:${has ? .5 : 1}">${gIcon('i')}<span style="flex:1"><b>${esc(w.name)}</b><small class=mut style="display:block">${has ? 'уже скачан в этом мире' : 'мир'}</small></span></button>`; }).join('');
  $('pickl').onclick = (e) => { const b = e.target.closest('[data-w]:not([disabled])'); if (b) done(b.dataset.w); }; $('pickx').onclick = () => done(null); $('pickm').classList.add('on'); });
const catManual = async (r, it, inst) => { // автор карты разрешил скачивание только на сайте CurseForge: открываем страницу и ждём файл в «Загрузках»
  if (!inst) { if (await ask('Автор этой карты разрешил скачивать её только на сайте CurseForge. Откройте страницу карты и скачайте файл вручную.', 'Открыть страницу')) totem.openUrl(r.manual); return; }
  if (!(await ask(`Автор карты «${it.title}» разрешил скачивать её только на сайте CurseForge, поэтому лаунчер не может взять файл сам.\n\nЛаунчер откроет страницу карты. Нажмите там «Download» — скачанный .zip лаунчер сам найдёт в папке «Загрузки» и поставит карту в сборку «${inst.name}».`, 'Открыть страницу'))) return;
  const r2 = await dmRun(`Жду файл карты «${it.title}»`, () => totem.catManual({ inst: inst.id, id: it.id, url: r.manual, title: it.title })); if (r2.cancelled) return toast('Ожидание отменено');
  if (!r2.ok) return toast(r2.error || 'Не удалось установить карту', 1); toast(`Карта установлена в «${inst.name}»: ${r2.installed.join(', ')}`); await refreshHave(); drawCat(); if (cur === inst.id) { drawM(); drawCard(); } };
const catFail = async (r, it, inst) => { if (r.cancelled) return toast('Загрузка отменена'); if (r.manual) return catManual(r, it, inst); else if (r.needKey || r.cfAuth) toast(r.cfAuth ? r.error : 'Укажите API-ключ CurseForge в Настройках → Каталог', 1); else if (r.offline) toast('Нет подключения к интернету', 1); else toast(r.error || 'Ошибка', 1); };
const catPack = async (it) => { if (!(await ask(`Установить сборку «${it.title}» как новую сборку? Лаунчер скачает файлы сборки и нужную версию игры с загрузчиком.`, 'Установить'))) return;
  $('catd').classList.remove('on'); const r = await dmRun(`Сборка «${it.title}»`, () => totem.catPack({ id: it.id, title: it.title, mc: CT.mc, loader: CT.loader })); if (!r.ok) return catFail(r, it);
  INST = await totem.instList(); selectItem('i', r.inst.id); toast(`Сборка «${r.inst.name}» скачана, дальше установится игра`); installAndWait(r.inst.id); };
const catDownload = async (it) => { if (it.type === 'modpack') return catPack(it); const inst = catInst(); if (!inst) { toast(INST.length ? 'Сначала выберите сборку вверху каталога' : 'Сначала создайте сборку во вкладке «Сборки»', 1); if (INST.length) $('cbs').classList.add('open'); return; }
  if (inst.loader === 'vanilla' && !['resourcepack', 'datapack', 'map'].includes(it.type)) return toast('В сборку Vanilla можно ставить только ресурс-паки, датапаки и карты. Выберите другую сборку вверху каталога.', 1);
  let world = ''; if (it.type === 'datapack') { const worlds = (await totem.filesList(inst.id, 'saves')).filter((f) => f.isDir); if (!worlds.length) return toast('В сборке «' + inst.name + '» нет миров. Создайте мир в игре и повторите: датапак ставится внутрь мира.', 1); world = await pickWorld(inst, it, worlds); if (!world) return; }
  if (DM.tmp) return; DM.tmp = 'Проверяем совместимость…'; dmChanged(); let pl; try { pl = await totem.catPlan({ src: it.src, id: it.id, type: it.type, inst: inst.id, world }); } finally { DM.tmp = null; dmChanged(); } if (!pl.ok) return catFail(pl, it, inst);
  if (!pl.exact && !(await ask(`${pl.warn}\n\nВсё равно скачать?`, 'Всё равно скачать'))) return;
  let deps = false; if (pl.deps?.length) deps = await ask(`Для «${pl.title}» нужны дополнительные моды:\n• ${pl.deps.map((d) => d.title).join('\n• ')}`, 'Установить все зависимости автоматически', 'Понял');
  const r = await dmRun(pl.title || it.title, () => totem.catInstall({ src: it.src, id: it.id, type: it.type, inst: inst.id, deps, world, icon: it.icon || '', title: it.title || '' })); if (!r.ok) return catFail(r, it, inst);
  toast(`В «${inst.name}» установлено: ${r.installed.join(', ')}.${r.note ? ' ' + r.note : ''}`); await refreshHave(); drawCat(); if ($('catd').classList.contains('on') && CT.open) markDetail(CT.open); if (cur === inst.id) { drawM(); drawCard(); } };
$('catg').onclick = async (e) => { const d = e.target.closest('[data-d]'); if (d) return catDownload(CT.items[+d.dataset.d]); const c = e.target.closest('.cc'); if (c) openDetail(CT.items[+c.dataset.i]); };
const markDetail = (it) => { const b = $('catdd'); if (!b || it.type === 'modpack') return; const h = haveHere(it); b.disabled = h; b.classList.toggle('ghost', h); b.innerHTML = h ? ic('check') + 'Уже скачан' : ic('dl') + 'Скачать'; };
const openDetail = async (it, opt = {}) => { $('catd').classList.add('on'); $('catdb').innerHTML = '<div style="display:grid;place-items:center;height:100%"><div class=bigspin></div></div>';
  const r = await totem.catProject({ src: it.src, id: it.id }); if (!r.ok) { $('catdb').innerHTML = `<p class=empty>${r.offline ? 'Нет подключения к интернету' : esc(r.error)}</p>`; return; } const p = r.p, imgs = p.gallery.length ? p.gallery.map((g) => g.url) : (p.icon ? [p.icon] : []);
  $('catdb').innerHTML = `<div class=ch style="margin:0 0 8px"><img class=cic src="${esc(p.icon || '')}" alt="" style="width:64px;height:64px"><div><b style="font-size:22px">${esc(p.title)}</b><span class=mut>${esc(p.team.map((t) => t.name).join(', '))}</span></div></div>
  ${imgs.length ? `<img class=galm id=galm src="${esc(imgs[0])}" alt=""><div class=gal>${imgs.map((u) => `<img src="${esc(u)}" data-g="${esc(u)}" alt="">`).join('')}</div>` : ''}
  <p style="margin:6px 0">${esc(p.desc || '')}</p><div class=cm style="margin-bottom:8px">${p.loaders.map((l) => `<span class=tag>${esc(l)}</span>`).join('')}<span class=tag>Скачиваний: ${fmtNum(p.downloads)}</span>${p.license ? `<span class=tag>${esc(p.license)}</span>` : ''}</div>
  <div class=mut style="margin-bottom:4px">Версии Minecraft: ${esc(p.mcs.join(', ') || '—')}</div><div class=mut style="margin-bottom:8px">Авторы: ${esc(p.team.map((t) => `${t.name}${t.role ? ' (' + t.role + ')' : ''}`).join(', ') || '—')}</div>
  <div class=cbody>${esc(mdText(p.body))}</div><div class=f style="margin-top:12px">${opt.noDl ? '' : `<button class=btn id=catdd>${ic('dl')}Скачать</button>`}${Object.entries({ site: 'Страница', source: 'Исходный код', issues: 'Баги', wiki: 'Вики' }).filter(([k]) => p.links?.[k]).map(([k, n]) => `<button class="btn ghost sm" data-u="${esc(p.links[k])}">${n}</button>`).join('')}</div>`;
  CT.open = it; if (!opt.noDl) { markDetail(it); $('catdd').onclick = () => catDownload(it); } $('catdb').onclick = (e) => { const g = e.target.closest('[data-g]'); if (g) $('galm').src = g.dataset.g; const u = e.target.closest('[data-u]'); if (u) totem.openUrl(u.dataset.u); }; };
document.addEventListener('keydown', (e) => { if (e.key === 'Escape' && $('skcard').classList.contains('bsel')) bOpen(false); if (e.key === 'Escape' && !$('lb').classList.contains('on') && !$('askm').classList.contains('on')) { if ($('catd').classList.contains('on')) $('catd').classList.remove('on'); else if ($('cbs').classList.contains('open')) $('cbs').classList.remove('open'); } });

// ---------- запуск ----------
(async () => {
  Skin.steve(tc, false); sync(); drawGuides(); $('sm').addEventListener('change', drawGuides);
  Object.entries({ newb: 'plus', imp: 'dl', sav: 'save', exp: 'up', tpl: 'shirt', undo: 'l', redo: 'r', addb: 'plus', addd: 'folder', snb: 'refresh', opnb: 'folder', fup: 'up', frf: 'refresh', fmk: 'plus', frn: 'pen', fcp: 'copy', fct: 'scissors', fps: 'paste', fdl: 'trash', faf: 'plus', fad: 'folder', fox: 'folder', opn: 'folder', cln: 'trash', bc: 'plus', lgo: 'check', lbk: 'l', mklnk: 'plus', cfget: 'catalog', askok: '' })
    .forEach(([id, n]) => { const e = $(id); if (e && n && !e.querySelector('.pi')) e.insertAdjacentHTML('afterbegin', ic(n)); });
  document.querySelectorAll('[data-tool]').forEach((e) => e.insertAdjacentHTML('afterbegin', ic({ pen: 'pen', er: 'er', fill: 'fill' }[e.dataset.tool])));
  const wait = (ms) => new Promise((r) => setTimeout(r, ms)), cap = (p, ms) => Promise.race([Promise.resolve(p).catch(() => {}), wait(ms)]);
  await loadAcc(); applyUi();
  const safe = (p, d) => p.catch(() => d);
  [IV, INST] = await Promise.all([safe(totem.installed(), []), safe(totem.instList(), [])]); loadAV();
  const sel = String(SET.selected || ''), m = /^([iv]):(.+)$/.exec(sel); SEL = m ? { k: m[1], id: m[2] } : INST.find((i) => i.id === sel) ? { k: 'i', id: sel } : null; // выбор последнего сеанса
  if (SEL && !selInfo()) SEL = null; drawDD(); moveInd(); setTimeout(moveInd, 120); setBg('home');
  loadV(); // список версий из сети — не ждём
  // экран загрузки не закрывается, пока не нарисован персонаж на главной, не декодирован фон и не готовы шрифты; потолок ожидания — чтобы лаунчер не завис без сети/видеокарты
  const bgImg = new Image(); bgImg.src = 'assets/bg/portal.jpg';
  await cap(Promise.all([loadSkins(), bgImg.decode?.(), document.fonts?.ready]), 12000);
  if (Vh) { try { Vh.frame(performance.now()); } catch {} await cap(Vh.ready, 4000); }
  totem.uiReady();
})();
