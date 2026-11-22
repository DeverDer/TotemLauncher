'use strict';
// Каталог скинов (вкладка «Скин» → «Каталог»): поиск, фильтры, карточки с 3D-вращением, подробности, скачивание.
// Карточки рисует ОДИН общий WebGL-контекст (Skin.makeSheet): кадр копируется в 2D-холст карточки. Крутятся только карточки на экране.
// Вращение у всех карточек синхронно — угол считается от общих часов; при наведении скин поворачивается за мышью, после ухода плавно возвращается в общий ритм.
(() => {
  const PAGE = 24, OM = 0.9, MON = ['янв.', 'фев.', 'мар.', 'апр.', 'мая', 'июн.', 'июл.', 'авг.', 'сен.', 'окт.', 'ноя.', 'дек.'];
  const MONF = ['января', 'февраля', 'марта', 'апреля', 'мая', 'июня', 'июля', 'августа', 'сентября', 'октября', 'ноября', 'декабря'];
  const fmtD = (ms) => { if (!ms) return '—'; const d = new Date(ms); return `${d.getDate()} ${MON[d.getMonth()]} ${d.getFullYear()}`; };
  const fmtF = (ms) => { if (!ms) return 'неизвестно'; const d = new Date(ms); return `${d.getDate()} ${MONF[d.getMonth()]} ${d.getFullYear()}`; };
  const fmtN = (n) => (+n || 0).toLocaleString('ru-RU');
  const wrap = (a) => { a %= Math.PI * 2; return a > Math.PI ? a - Math.PI * 2 : a < -Math.PI ? a + Math.PI * 2 : a; };
  const cl = (v) => Math.max(-1, Math.min(1, v));
  const DAY = 864e5, PER = { w: 7 * DAY, m: 30 * DAY, y: 365 * DAY };
  const S = { all: [], got: {}, loaded: false, loading: false, err: '', source: '', stale: false, view: [], shown: 0, tab: 0, f: { q: '', sort: 'pop', model: '', period: '', author: '', hide: false } };
  const CARDS = new Map(), IMGS = new Map(), PEND = new Set(), FAIL = new Set();
  let sheet = null, sheetTried = false, raf = 0, last = 0, hovId = '', qT = 0, flushT = 0, curId = '', Vm = null, busy = false;
  const ro = new ResizeObserver((es) => { const d = Math.min(2, window.devicePixelRatio || 1); for (const e of es) { const st = CARDS.get(e.target.closest('.kcc')?.dataset.id); if (st) { st.w = Math.min(720, Math.round(e.contentRect.width * d)); st.h = Math.min(720, Math.round(e.contentRect.height * d)); st.cv.width = st.w; st.cv.height = st.h; st.dirty = true; } } });
  const io = new IntersectionObserver((es) => { for (const e of es) { const st = CARDS.get(e.target.dataset.id); if (!st) continue; st.vis = e.isIntersecting; if (st.vis) need(st.id); } }, { root: $('kcb'), rootMargin: '240px 0px' });

  // ---------- загрузка картинок пачками ----------
  const loadImg = (id, b64) => new Promise((ok) => { const im = new Image(); im.onload = () => ok(im); im.onerror = () => ok(null); im.src = 'data:image/png;base64,' + b64; });
  const need = (id) => { if (IMGS.has(id)) { shown(id); return; } if (FAIL.has(id) || PEND.has(id)) return; PEND.add(id); clearTimeout(flushT); flushT = setTimeout(flush, 40); };
  const flush = async () => {
    const ids = [...PEND].slice(0, 24); if (!ids.length) return; ids.forEach((i) => PEND.delete(i));
    let r; try { r = await totem.skcatPng(ids); } catch { r = { ok: false }; }
    for (const id of ids) { const b = r.ok ? r.r?.[id] : null; const im = b ? await loadImg(id, b) : null; if (im) IMGS.set(id, im); else FAIL.add(id); shown(id); }
    if (PEND.size) flush();
  };
  const shown = (id) => { const st = CARDS.get(id); if (!st) return; const im = IMGS.get(id); st.el.querySelector('.kcf').classList.remove('ld'); if (!im) { st.el.classList.add('bad'); return; } st.ready = true;
    if (!sheetTried) { sheetTried = true; try { sheet = Skin.makeSheet(); } catch { sheet = null; } }
    if (sheet) sheet.setTex(id, im); else { st.static = true; st.dirty = true; } kick(); };

  // ---------- фильтры и список ----------
  const view = () => { const f = S.f, q = f.q.trim().toLowerCase(), now = Date.now(); let a = S.all.filter((s) => (!q || s.name.toLowerCase().includes(q) || s.author.toLowerCase().includes(q)) && (!f.model || s.model === f.model) && (!f.author || s.author === f.author) && (!f.period || s.created >= now - PER[f.period]) && !(f.hide && S.got[s.id]));
    const cmp = { pop: (x, y) => y.downloads - x.downloads || y.created - x.created, new: (x, y) => y.created - x.created, old: (x, y) => x.created - y.created, name: (x, y) => x.name.localeCompare(y.name, 'ru') }[f.sort];
    return a.sort(cmp); };
  const dirty = () => { const f = S.f; return !!(f.q || f.model || f.period || f.author || f.hide || f.sort !== 'pop'); };
  const msg = (html) => { $('kcmsg').innerHTML = html; $('kcmsg').hidden = !html; };
  const info = () => { $('kcn').innerHTML = S.loaded ? `Найдено: <b>${S.view.length}</b> из ${S.all.length}` + (S.stale ? ' · <span class=warn>нет связи, показан сохранённый список</span>' : '') + (S.source === 'site' ? ' · <span class=tag title="Скины и информация о них берутся с сайта craftdex.net">craftdex.net</span>' : '') : ''; $('kz').hidden = !dirty(); };
  const authors = () => { const sel = $('ka'), cur = S.f.author, list = [...new Set(S.all.map((s) => s.author))].sort((a, b) => a.localeCompare(b, 'ru')); if (cur && !list.includes(cur)) S.f.author = '';
    sel.innerHTML = '<option value="">Все авторы</option>' + list.map((a) => `<option value="${esc(a)}"${a === S.f.author ? ' selected' : ''}>${esc(a)}</option>`).join(''); };
  const cardHtml = (s, i) => `<div class="kcc${S.got[s.id] ? ' got' : ''}" data-id="${esc(s.id)}" tabindex=0 style="animation-delay:${(i % 12) * 35}ms"><div class="kcf ld"><canvas class=kcv></canvas>${s.model === 'slim' ? '<span class=kcl>Slim</span>' : ''}<span class=kcg2 title="Уже в «Моих скинах»">${ic('check')}</span><span class=kcsk></span></div>`
    + `<div class=kci><div class=kcn2 title="${esc(s.name)}">${esc(s.name)}</div><div class=kca>${ic('user')}<span>${esc(s.author)}</span></div><div class=kcm><span>${ic('cal')}${fmtD(s.created)}</span><span class=kcd>${ic('dl')}<b data-d>${fmtN(s.downloads)}</b></span></div></div></div>`;
  const more = () => { if (S.shown >= S.view.length) return; const part = S.view.slice(S.shown, S.shown + PAGE), g = $('kcg'), t = document.createElement('div'); t.innerHTML = part.map((s, i) => cardHtml(s, i)).join(''); S.shown += part.length;
    for (const el of [...t.children]) { g.appendChild(el); const st = { id: el.dataset.id, el, cv: el.querySelector('canvas'), ctx: el.querySelector('canvas').getContext('2d'), w: 0, h: 0, vis: false, ready: false, hov: false, hw: 0, fx: 0, fy: 0, tx: 0, ty: 0, cur: 0, o: 0, last: 0, dirty: true, static: false };
      CARDS.set(st.id, st); io.observe(el); ro.observe(el.querySelector('.kcf')); } };
  const clearGrid = () => { for (const st of CARDS.values()) { io.unobserve(st.el); ro.unobserve(st.el.querySelector('.kcf')); } CARDS.clear(); $('kcg').innerHTML = ''; hovId = ''; };
  const apply = (keepScroll) => { const sc = $('kcb').scrollTop; clearGrid(); S.view = view(); S.shown = 0; more(); info(); if (keepScroll) $('kcb').scrollTop = sc; else $('kcb').scrollTop = 0;
    msg(!S.view.length && S.loaded ? `<b>Ничего не найдено</b><span>Измените запрос или фильтры.</span>${dirty() ? '<button class="btn ghost sm" data-a=reset>Сбросить фильтры</button>' : ''}` : ''); };
  const load = async (force) => {
    if (S.loading) return; S.loading = true; $('kref').classList.add('busy'); if (!S.loaded) { clearGrid(); msg('<i class=kspin></i><b>Загружаем каталог…</b>'); }
    let r; try { r = await totem.skcatList(!!force); } catch (e) { r = { ok: false, error: e.message }; }
    S.loading = false; $('kref').classList.remove('busy');
    if (!r.ok) { if (!S.loaded) { msg(`<b>Каталог недоступен</b><span>${esc(r.error || 'Не удалось загрузить')}</span><button class=btn data-a=retry>${ic('refresh')}Обновить</button>`); } else toast(r.error || 'Не удалось обновить каталог', 1); return; }
    S.all = r.skins; S.got = r.got || {}; S.stale = !!r.stale; S.source = r.source; S.loaded = true; authors(); apply(false);
  };
  const syncGot = async () => { if (!S.loaded) return; let r; try { r = await totem.skcatList(false); } catch { return; } if (!r?.ok) return; S.got = r.got || {}; for (const s of r.skins) { const e = S.all.find((x) => x.id === s.id); if (e) e.downloads = s.downloads; }
    for (const st of CARDS.values()) { st.el.classList.toggle('got', !!S.got[st.id]); const e = S.all.find((x) => x.id === st.id); if (e) st.el.querySelector('[data-d]').textContent = fmtN(e.downloads); } if (S.f.hide) apply(true); };

  // ---------- вращение карточек ----------
  const active = () => !document.hidden && $('p-sk').classList.contains('on') && S.tab === 2 && !$('skm').classList.contains('on');
  const kick = () => { if (!raf && active()) { last = 0; raf = requestAnimationFrame(loop); } };
  const loop = (now) => { raf = 0; if (!active()) return; const dt = last ? Math.min(0.1, (now - last) / 1000) : 0.016; last = now; const T = now / 1000, A = T * OM;
    for (const st of CARDS.values()) {
      if (!st.vis || !st.ready || !st.w || !st.h) continue;
      if (st.static) { if (st.dirty) { st.dirty = false; const im = IMGS.get(st.id), e = S.all.find((x) => x.id === st.id); st.ctx.clearRect(0, 0, st.w, st.h); if (im && e) { const k = Math.floor(Math.min(st.w / 16, st.h / 32)), c = document.createElement('canvas'); c.width = 16 * k; c.height = 32 * k; Skin.drawFront(c.getContext('2d'), im, e.model === 'slim', k); st.ctx.drawImage(c, (st.w - c.width) / 2, (st.h - c.height) / 2); } } continue; }
      if (now - st.last > 250) { st.o = 0; st.cur = A; st.hw = 0; st.fx = st.tx; st.fy = st.ty; } st.last = now;
      st.hw += ((st.hov ? 1 : 0) - st.hw) * Math.min(1, dt * 6); st.fx += (st.tx - st.fx) * Math.min(1, dt * 8); st.fy += (st.ty - st.fy) * Math.min(1, dt * 8);
      // вне наведения угол = общий угол A + смещение o; смещение плавно сходит к нулю, так что все свободные скины всегда синхронны
      if (st.hov) { st.cur += wrap(st.fx * 0.65 - st.cur) * Math.min(1, dt * 9); st.o = wrap(st.cur - A); }
      else { st.o *= Math.exp(-dt * 5); if (Math.abs(st.o) < 0.002) st.o = 0; st.cur = A + st.o; }
      const e = S.all.find((x) => x.id === st.id); if (!e) continue;
      sheet.draw(st.ctx, st.w, st.h, st.id, e.model === 'slim', { yaw: st.cur, headYaw: st.fx * 0.55 * st.hw, headPitch: st.fy * 0.4 * st.hw, t: T, z: 47, rx: 0.12 });
    }
    raf = requestAnimationFrame(loop); };
  const hover = (id, ev) => { if (hovId && hovId !== id) { const o = CARDS.get(hovId); if (o) { o.hov = false; o.tx = o.ty = 0; } } hovId = id;
    const st = id && CARDS.get(id); if (!st) return; st.hov = true; if (ev) { const r = st.el.querySelector('.kcf').getBoundingClientRect(); st.tx = cl((ev.clientX - (r.left + r.width / 2)) / (r.width * 0.5)); st.ty = cl((ev.clientY - (r.top + r.height * 0.3)) / (r.height * 0.5)); } };
  $('kcg').addEventListener('pointermove', (e) => { const c = e.target.closest('.kcc'); hover(c ? c.dataset.id : '', e); });
  $('kcg').addEventListener('pointerleave', () => hover('', null));
  $('kcb').addEventListener('scroll', () => { if ($('kcb').scrollTop + $('kcb').clientHeight > $('kcb').scrollHeight - 500) more(); }, { passive: true });
  setInterval(() => { if (!raf) kick(); }, 400); document.addEventListener('visibilitychange', kick);

  // ---------- подробности ----------
  const row = (k, v) => `<div class=kdr><span>${k}</span><b>${v}</b></div>`;
  const fillInfo = (s) => { $('skmn').textContent = s.name; $('skma').innerHTML = ic('user') + esc(s.author);
    $('skmg').innerHTML = row(s.site ? 'Носят игроков' : 'Скачиваний', `<span class=kdbig>${ic('dl')}${fmtN(s.downloads)}</span>`) + (s.site ? row('Просмотров', fmtN(s.views)) : '') + row('Автор', esc(s.author)) + row('Создан', fmtF(s.created)) + row('Руки', s.model === 'slim' ? 'Slim (тонкие, 3 px)' : 'Classic (4 px)') + row('Формат', 'PNG 64×64') + row('Номер', `<code>${esc(s.id)}</code>`);
    $('skmd').textContent = (s.desc || 'Автор не добавил описание.') + (s.site ? ' Число у скина — сколько игроков носят его на сайте плюс скачивания из этого лаунчера.' : ''); const got = S.got[s.id]; $('skmdl').disabled = busy; $('skmdl').innerHTML = got ? ic('check') + 'Уже в «Моих скинах»' : ic('dl') + 'Скачать'; $('skmdl').classList.toggle('done', !!got); $('skmuse').hidden = !got; };
  const open = async (id) => { const s = S.all.find((x) => x.id === id); if (!s) return; curId = id; fillInfo(s); $('skm').classList.add('on'); hover('', null);
    if (!Vm) Vm = Skin.makeViewer($('skmc'), {}); if (Vm) { Vm.on = true; Vm.set({ ry: 0.5, rx: 0.2, z: 54, ov: $('skmov').checked }); }
    $('skmc').parentElement.classList.add('ld'); need(id); let n = 0; while (!IMGS.has(id) && !FAIL.has(id) && n++ < 100) await new Promise((r) => setTimeout(r, 60));
    if (curId !== id) return; $('skmc').parentElement.classList.remove('ld'); const im = IMGS.get(id); if (!im) return toast('Не удалось загрузить скин', 1); if (Vm) Vm.set({ src: im, slim: s.model === 'slim' }); };
  const close = () => { $('skm').classList.remove('on'); curId = ''; if (Vm) Vm.on = false; kick(); };
  $('skmx').onclick = close; $('skm').addEventListener('pointerdown', (e) => { if (e.target === $('skm')) close(); }); document.addEventListener('keydown', (e) => { if (e.key === 'Escape' && $('skm').classList.contains('on')) close(); });
  $('skmov').onchange = () => Vm && Vm.set({ ov: $('skmov').checked });
  const download = async () => { const id = curId, s = S.all.find((x) => x.id === id); if (!s || busy || S.got[id]) return; busy = true; $('skmdl').disabled = true; $('skmdl').innerHTML = '<i class=kspin></i>Скачиваем…';
    let r; try { r = await totem.skcatGet(id); } catch (e) { r = { ok: false, error: e.message }; } busy = false;
    if (!r.ok) { toast(r.error || 'Не удалось скачать скин', 1); if (curId === id) fillInfo(s); return; }
    S.got[id] = r.localId; s.downloads = r.downloads; const st = CARDS.get(id); if (st) { st.el.classList.add('got'); st.el.querySelector('[data-d]').textContent = fmtN(s.downloads); }
    toast(r.already ? 'Этот скин уже есть в «Моих скинах»' : `Скин «${s.name}» добавлен в «Мои скины»`); if (curId === id) fillInfo(s); if (typeof loadS === 'function') loadS(); if (S.f.hide) apply(true); };
  $('skmdl').onclick = download;
  $('skmuse').onclick = async () => { const lid = S.got[curId]; if (!lid) return; await totem.setSettings({ currentSkin: lid }); if (typeof loadS === 'function') await loadS(); toast('Скин применён'); };
  $('kcg').addEventListener('click', (e) => { const c = e.target.closest('.kcc'); if (c) open(c.dataset.id); });
  $('kcg').addEventListener('keydown', (e) => { if ((e.key === 'Enter' || e.key === ' ') && e.target.classList?.contains('kcc')) { e.preventDefault(); open(e.target.dataset.id); } });

  // ---------- управление ----------
  const setF = (k, v) => { S.f[k] = v; apply(false); };
  $('kq').oninput = () => { clearTimeout(qT); qT = setTimeout(() => setF('q', $('kq').value), 120); };
  $('ks').onchange = () => setF('sort', $('ks').value); $('km').onchange = () => setF('model', $('km').value); $('kp').onchange = () => setF('period', $('kp').value); $('ka').onchange = () => setF('author', $('ka').value);
  $('kh').onchange = () => setF('hide', $('kh').checked);
  const reset = () => { S.f = { q: '', sort: 'pop', model: '', period: '', author: '', hide: false }; $('kq').value = ''; $('ks').value = 'pop'; $('km').value = ''; $('kp').value = ''; $('ka').value = ''; $('kh').checked = false; apply(false); };
  $('kz').onclick = reset; $('kref').onclick = () => load(true);
  $('kcmsg').onclick = (e) => { const b = e.target.closest('[data-a]'); if (!b) return; if (b.dataset.a === 'reset') reset(); else load(true); };
  window.addEventListener('sktab', (e) => { S.tab = e.detail; if (S.tab === 2) { if (!S.loaded) load(false); else syncGot(); kick(); } else if ($('skm').classList.contains('on')) close(); });
  const setCols = (n) => { n = Math.max(2, Math.min(8, Math.round(+n) || 4)); $('kcg').style.setProperty('--kc', n); $('kcg').dataset.kc = String(n); kick(); };
  totem.getSettings().then((s) => setCols(s?.skinCols)).catch(() => setCols(4));
  window.SkinCat = { _s: S, _c: CARDS, open, load, setCols };
})();
