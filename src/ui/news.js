'use strict';
// Новости Minecraft на главной: список (по 15), «Показать ещё», карусель фото, скрытие рамки влево, подробности, автообновление.
// Данные приходят из главного процесса (src/news.js); здесь только отображение.
(() => {
  const MON = ['янв.', 'фев.', 'мар.', 'апр.', 'мая', 'июн.', 'июл.', 'авг.', 'сен.', 'окт.', 'ноя.', 'дек.'];
  const fmtDate = (ms) => { const d = new Date(ms); return `${d.getDate()} ${MON[d.getMonth()]} ${d.getFullYear()}`; };
  const TAGS = { release: 'Релиз', snapshot: 'Снапшот', news: 'Новость' };
  const PAGE = 15, REFRESH_MS = 10 * 60 * 1000, SLIDE_MS = 5000;
  const N = { items: [], shown: PAGE, state: 'load', offline: false, busy: false, hidden: false, ang: 0, sig: '' };
  const list = $('nlist'), box = $('news');

  const card = (it, i) => {
    const im = it.images, n = im.length;
    return `<article class=ni data-i="${i}" tabindex=0 role=button aria-label="${esc(it.title)}">
<div class=nimg data-n="${n}" data-s=0>${n ? `<div class=nsl>${im.map((u) => `<img src="${esc(u)}" alt="" decoding=async>`).join('')}</div>` : ''}${n > 1 ? `<button class="nv p" data-d=-1 tabindex=-1>${ic('l')}</button><button class="nv n" data-d=1 tabindex=-1>${ic('r')}</button><div class=ndots>${im.map((_, k) => `<i${k ? '' : ' class=on'}></i>`).join('')}</div>` : ''}</div>
<div class=ntx><b class=nt>${esc(it.title)}</b><span class=nd>${esc(it.desc)}</span><div class=nfoot><span class=ndt>${ic('cal')}${fmtDate(it.date)}</span><button class="btn ghost sm nmore" tabindex=-1>Узнать больше</button></div></div>
<span class=nbig>${ic('r')}</span></article>`;
  };

  const draw = () => {
    const top = list.scrollTop; let h;
    if (!N.items.length && N.state === 'load') h = '<div class="nmsg nsp"><div class=bigspin></div></div>';
    else if (!N.items.length && N.state === 'err') h = `<div class="nmsg empty"><b>${N.offline ? 'Нет подключения к интернету' : 'Не удалось загрузить новости'}</b><span>${N.offline ? 'Новости появятся, когда интернет вернётся.' : 'Сервер новостей сейчас не отвечает.'} Проверьте соединение и нажмите «Обновить».</span><button class=btn id=nretry>${ic('refresh')}Обновить</button></div>`;
    else if (!N.items.length) h = '<div class="nmsg empty"><b>Новостей пока нет</b></div>';
    else h = N.items.slice(0, N.shown).map(card).join('') + (N.items.length > N.shown ? '<button class="btn ghost nmoreb" id=nmore>Показать ещё</button>' : '');
    list.innerHTML = h; list.scrollTop = top;
    const now = Date.now(); list.querySelectorAll('.nimg[data-n]').forEach((b, k) => { b.dataset.t = now + k * 700; }); // фото разных новостей листаются не одновременно
  };

  // переводятся только показанные новости: следующая порция — перед показом
  const ensureTr = async (upTo) => {
    if (SET.newsRu === false) return;
    const ids = N.items.slice(0, upTo).filter((x) => !x.t).map((x) => x.id); if (!ids.length) return;
    const r = await totem.newsTr(ids).catch(() => null);
    if (r?.ok) for (const [id, v] of Object.entries(r.r)) { const it = N.items.find((x) => x.id === id); if (it) { it.title = v.title; it.desc = v.desc; it.t = 1; } }
  };

  // у списков изменений фото лежат внутри текста: подгружаем их в фоне для показанных новостей и обновляем карусель
  const ensureImgs = async () => {
    const ids = N.items.slice(0, N.shown).filter((x) => x.tag !== 'news' && !x.im).map((x) => x.id); if (!ids.length) return;
    const r = await totem.newsImgs(ids).catch(() => null); ids.forEach((id) => { const it = N.items.find((x) => x.id === id); if (it) it.im = 1; });
    if (!r?.ok) return;
    for (const [id, im] of Object.entries(r.r)) {
      const k = N.items.findIndex((x) => x.id === id), it = N.items[k]; if (!it || im.length <= it.images.length) continue; it.images = im;
      const el = list.querySelector(`.ni[data-i="${k}"] .nimg`); if (!el) continue;
      const t = document.createElement('div'); t.innerHTML = card(it, k); const nn = t.querySelector('.nimg'); nn.dataset.t = Date.now(); el.replaceWith(nn);
    }
  };
  const load = async (force, manual) => {
    if (N.busy) return; N.busy = true; $('nrf').classList.add('busy');
    if (!N.items.length) { N.state = 'load'; draw(); }
    let r; try { r = await totem.newsList(!!force); } catch (e) { r = { ok: false, error: String(e?.message || e) }; }
    if (r.ok) {
      N.items = r.items; N.state = 'ok';
      await ensureTr(Math.max(N.shown, PAGE));
      const sig = N.items.length + '\n' + N.items.slice(0, N.shown).map((x) => [x.id, x.title, x.desc, x.images.join(',')].join('|')).join('\n');
      if (sig !== N.sig) { N.sig = sig; draw(); }
      ensureImgs();
      if (manual) toast('Новости обновлены');
    } else if (!N.items.length) { N.state = 'err'; N.offline = !!r.offline; N.sig = ''; draw(); }
    else if (manual) toast(r.offline ? 'Нет подключения к интернету' : 'Не удалось обновить новости', 1); // старый список остаётся
    N.busy = false; $('nrf').classList.remove('busy');
  };

  const more = async () => {
    const b = $('nmore'); if (b) { b.disabled = true; b.textContent = 'Загрузка…'; }
    await ensureTr(N.shown + PAGE); const top = list.scrollTop; N.shown += PAGE; N.sig = ''; draw(); list.scrollTop = top; ensureImgs();
  };

  // ---------- карусель фото ----------
  const flip = (b, d) => {
    const n = +b.dataset.n; if (n < 2) return;
    const s = (((+b.dataset.s + d) % n) + n) % n; b.dataset.s = s; b.dataset.t = Date.now();
    b.querySelector('.nsl').style.transform = `translateX(${-100 * s}%)`;
    b.querySelectorAll('.ndots i').forEach((e, k) => e.classList.toggle('on', k === s));
  };
  setInterval(() => {
    if (N.hidden || !$('p-home').classList.contains('on') || document.querySelector('.modal.on')) return;
    const now = Date.now();
    list.querySelectorAll('.nimg[data-n]').forEach((b) => { if (+b.dataset.n > 1 && !b.matches(':hover') && now - (+b.dataset.t || 0) >= SLIDE_MS) flip(b, 1); });
  }, 500);

  list.addEventListener('click', (e) => {
    const nv = e.target.closest('.nv'); if (nv) { e.stopPropagation(); return flip(nv.closest('.nimg'), +nv.dataset.d); }
    if (e.target.closest('#nretry')) return load(true, true);
    if (e.target.closest('#nmore')) return more();
    if (e.target.closest('.nimg')) return; // на фото клик ничего не открывает
    const c = e.target.closest('.ni'); if (c) openDetail(+c.dataset.i);
  });
  list.addEventListener('keydown', (e) => { if (e.key === 'Enter' && e.target.classList?.contains('ni')) openDetail(+e.target.dataset.i); });

  // ---------- скрыть / показать рамку ----------
  const setHidden = (h, anim = true) => {
    N.hidden = h;
    if (!anim) { box.style.transition = list.style.transition = 'none'; }
    box.classList.toggle('c', h);
    if (!anim) { void box.offsetWidth; box.style.transition = list.style.transition = ''; }
    N.ang += anim ? (h ? -360 : 360) : 0; $('nar').firstElementChild.style.transform = `rotate(${N.ang}deg)`; // полный оборот: стрелка всегда смотрит вправо — «выдвинуть»
    $('nar').dataset.tip = h ? 'Показать новости' : 'Скрыть новости';
  };
  $('nar').onclick = () => { setHidden(!N.hidden); totem.setSettings({ newsHide: N.hidden }); };
  box.addEventListener('click', (e) => { if (N.hidden && e.target.closest('.nhead') && !e.target.closest('#nar')) $('nar').click(); });
  $('nrf').onclick = () => load(true, true);

  // ---------- подробности ----------
  let D = null, tok = 0;
  const drawGal = () => {
    const im = D.im, s = D.s;
    $('ngal').innerHTML = !im.length ? '' : `<div class=ngm><img src="${esc(im[s])}" alt="">${im.length > 1 ? `<button class="nv p" data-g=-1>${ic('l')}</button><button class="nv n" data-g=1>${ic('r')}</button><span class=ngc>${s + 1} / ${im.length}</span>` : ''}</div>${im.length > 1 ? `<div class=gal>${im.map((u, k) => `<img src="${esc(u)}" data-k=${k} class="${k === s ? 'on' : ''}" alt="">`).join('')}</div>` : ''}`;
  };
  const closeDetail = () => { tok++; $('newsm').classList.remove('on'); };
  const openDetail = async (i) => {
    const it = N.items[i]; if (!it) return; const my = ++tok; D = { it, im: [...it.images], s: 0 };
    $('newsb').innerHTML = `<div class=nh1>${esc(it.title)}</div><div class=nmeta><span class=ndt>${ic('cal')}${fmtDate(it.date)}</span><span class=tag>${TAGS[it.tag] || 'Новость'}</span></div><div id=ngal></div><p class=ndesc id=ndesc>${esc(it.desc)}</p><div id=ntxt class=ntxt><div class=nmsg><div class=bigspin></div></div></div><div class=nsite id=nsite></div>`;
    drawGal(); $('newsm').classList.add('on'); $('newsb').scrollTop = 0;
    const r = await totem.newsItem(it.id).catch((e) => ({ ok: false, error: String(e?.message || e) }));
    if (my !== tok) return;
    if (r.ok) {
      $('ntxt').innerHTML = r.html || ''; if (r.html && it.tag === 'news') $('ndesc').hidden = true; // у обычной новости подробный текст совпадает с описанием
      if (r.images.length > D.im.length) { D.im = r.images; drawGal(); }
      if (r.url) { $('nsite').innerHTML = `<button class="btn ghost" id=nweb>${ic('catalog')}Читать на сайте</button>`; $('nweb').onclick = () => totem.openUrl(r.url); }
    } else $('ntxt').innerHTML = `<p class=empty>${r.offline ? 'Нет подключения к интернету: подробности недоступны' : esc(r.error || 'Не удалось загрузить подробности')}</p>`;
  };
  $('newsb').addEventListener('click', (e) => {
    if (!D) return; const g = e.target.closest('[data-g]'), t = e.target.closest('.gal img');
    if (g) D.s = (D.s + +g.dataset.g + D.im.length) % D.im.length; else if (t) D.s = +t.dataset.k; else return; drawGal();
  });
  $('newsx').onclick = closeDetail; $('newsm').addEventListener('click', (e) => { if (e.target === $('newsm')) closeDetail(); });
  document.addEventListener('keydown', (e) => { if (e.key === 'Escape' && $('newsm').classList.contains('on') && !$('askm').classList.contains('on')) closeDetail(); });

  // ---------- размер рамки: правый нижний угол + правая и нижняя грань (только в свою сторону) ----------
  // Левая сторона и верх закреплены. Предел по высоте — кнопки скриншотов/телеграма (считает CSS), по ширине — колонка слева (до скина).
  // Размер хранится в настройках (newsW/newsH) и действует при следующих запусках; на маленьком окне CSS его ужимает, сохранённое значение не портится.
  const MINW = 380, MINH = 260;
  const setSize = (w, h) => { if (w) box.style.setProperty('--nw', Math.round(w) + 'px'); else box.style.removeProperty('--nw'); if (h) box.style.setProperty('--nh', Math.round(h) + 'px'); else box.style.removeProperty('--nh'); };
  box.querySelectorAll('.nrs').forEach((el) => {
    el.addEventListener('pointerdown', (e) => {
      if (e.button !== 0 || N.hidden) return; e.preventDefault();
      const dir = el.dataset.r, r0 = box.getBoundingClientRect(), x0 = e.clientX, y0 = e.clientY, w0 = r0.width, h0 = r0.height;
      box.classList.add('rz'); setSize(99999, 99999); const maxW = box.offsetWidth, maxH = box.offsetHeight; setSize(w0, h0); // пределы берём у самого CSS
      document.body.style.cursor = getComputedStyle(el).cursor; try { el.setPointerCapture(e.pointerId); } catch {}
      let w = w0, h = h0;
      const mv = (ev) => { if (dir.includes('e')) w = Math.max(Math.min(MINW, maxW), Math.min(maxW, w0 + ev.clientX - x0)); if (dir.includes('s')) h = Math.max(Math.min(MINH, maxH), Math.min(maxH, h0 + ev.clientY - y0)); setSize(w, h); };
      const up = () => { el.removeEventListener('pointermove', mv); el.removeEventListener('pointerup', up); el.removeEventListener('pointercancel', up); document.body.style.cursor = ''; box.classList.remove('rz');
        totem.setSettings({ newsW: Math.round(w), newsH: Math.round(h) }); };
      el.addEventListener('pointermove', mv); el.addEventListener('pointerup', up); el.addEventListener('pointercancel', up);
    });
  });
  $('news').querySelector('.nrs-se').addEventListener('dblclick', () => { setSize(0, 0); totem.setSettings({ newsW: 0, newsH: 0 }); }); // двойной щелчок по углу — размер по умолчанию

  // ---------- обновление: при запуске, каждые 10 минут, после выхода из игры, при появлении сети ----------
  setInterval(() => load(true), REFRESH_MS);
  window.addEventListener('online', () => load(true));
  let prev = ''; totem.onGame((s) => { if (prev === 'playing' && s.state !== 'playing') setTimeout(() => load(true), 2500); prev = s.state; });
  document.querySelector('[data-k=newsRu]')?.addEventListener('change', () => setTimeout(() => load(true), 400));
  totem.getSettings().then((s) => { setSize(s.newsW, s.newsH); if (s.newsHide) setHidden(true, false); }).catch(() => {});
  load(false);
  window.__news = { N, load, openDetail, setHidden }; // для автотестов интерфейса
})();
