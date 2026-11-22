'use strict';
// Чат с помощником «Бурмалдец» (вкладки «Каталог» и «Сборки»): панель выезжает справа, закрывается или сворачивается
// в язычок у края окна. Переписка и подбор сборок — в главном процессе (src/ai.js); здесь только отображение.
(() => {
  const C = { open: false, min: false, chat: null, msgs: [], busy: false, status: '', err: null, loaded: false, hist: false, hl: [], inst: new Set(), open8: new Set(), off: new Map() }; // off: id сообщения → Set id пунктов, отключённых галочкой
  const aip = $('aip'), box = $('aimsgs'), ta = $('aiin');
  const QUICK = [['Увеличь', 'Увеличь сборку — добавь ещё модов'], ['Уменьши', 'Уменьши сборку — оставь самое важное'], ['Оптимизируй', 'Оптимизируй сборку для производительности'], ['Пересобери', 'Пересобери сборку заново, но с той же идеей']];
  const EXAMPLES = ['Хоррор сборка на игру с друзьями', 'Лёгкая сборка для слабого ПК', 'Выживание с магией и технологиями', 'Уютная фермерская сборка на 30 модов'];
  const LCAP = { forge: 'Forge', fabric: 'Fabric', neoforge: 'NeoForge' };
  const KINDS = [['mods', 'Список модов', 'Моды'], ['shaders', 'Список шейдеров', 'Шейдеры'], ['resourcepacks', 'Ресурс-паки', 'Ресурс-паки'], ['datapacks', 'Датапаки', 'Датапаки']];
  const MODS_SHOWN = 8;
  document.body.dataset.page ||= 'home';
  const pageOk = () => ['home', 'cat', 'bl'].includes(document.body.dataset.page || 'home');
  const offOf = (mid) => { let x = C.off.get(mid); if (!x) C.off.set(mid, (x = new Set())); return x; };
  const total = (p) => KINDS.reduce((n, [k]) => n + (p[k]?.length || 0), 0);
  const lastPackId = () => { for (let i = C.msgs.length - 1; i >= 0; i--) if (C.msgs[i].pack) return C.msgs[i].id; return ''; };

  // ---------- текст ответа: немного разметки (жирный, курсив, списки, абзацы) ----------
  const fmt = (t) => {
    const e = esc(t).replace(/\*\*(.+?)\*\*/g, '<b>$1</b>').replace(/(^|[\s(«])\*(?!\s)([^*]+?)\*(?=[\s).,!?:;»]|$)/g, '$1<i>$2</i>').replace(/`([^`]+)`/g, '<code>$1</code>');
    return e.split(/\n{2,}/).map((par) => { const L = par.split('\n'); return L.every((l) => /^\s*[-•*]\s+/.test(l)) ? '<ul>' + L.map((l) => '<li>' + l.replace(/^\s*[-•*]\s+/, '') + '</li>').join('') + '</ul>' : '<p>' + L.join('<br>') + '</p>'; }).join('');
  };

  // ---------- карточка сборки ----------
  const iconHtml = (x) => `<span class=pki>${x.ic ? `<img src="${esc(x.ic)}" alt="" loading=lazy decoding=async>` : ''}<i>${esc(String(x.t || '?').trim().charAt(0).toUpperCase())}</i></span>`;
  const packHtml = (m) => {
    const p = m.pack, isLast = m.id === lastPackId(), done = p.inst && INST.some((i) => i.id === p.inst), busy = C.inst.has(m.id);
    const off = offOf(m.id), counts = KINDS.filter(([k]) => p[k]?.length).map(([k, , n]) => `<span class=pkn data-k="${k}">${n}: <b>${p[k].filter((x) => !off.has(x.id)).length}</b>${p[k].some((x) => off.has(x.id)) ? `<small class=mut>/${p[k].length}</small>` : ''}</span>`).join(''), left = total(p) - [...off].filter((id) => KINDS.some(([k]) => p[k]?.some((x) => x.id === id))).length;
    const lists = KINDS.filter(([k]) => p[k]?.length).map(([k, head]) => {
      const L = p[k], more = k === 'mods' && L.length > MODS_SHOWN, open = C.open8.has(m.id + k);
      return `<div class=pks>${head}:</div><ul class="pkl pkis${more && !open ? ' cut' : ''}">${L.map((x, i) => `<li class="pkr${off.has(x.id) ? ' dis' : ''}" data-id="${esc(x.id)}"${more && !open && i >= MODS_SHOWN ? ' hidden' : ''}>${iconHtml(x)}<span class=pkx><b>${esc(x.t)}</b>${x.d ? `<small class=mut>${esc(x.d)}</small>` : ''}</span>${done ? '' : `<button type=button class="pxc${off.has(x.id) ? '' : ' on'}" role=checkbox aria-checked="${!off.has(x.id)}" aria-label="Включить в сборку: ${esc(x.t)}" data-a=tick data-m="${m.id}" data-id="${esc(x.id)}"></button>`}</li>`).join('')}</ul>${more ? `<button class="pkm" data-a=more data-m="${m.id}" data-k="${k}">${open ? 'Свернуть список' : `Показать все (${L.length})`}</button>` : ''}`;
    }).join('');
    const btn = done ? `<div class=pkb><button class="btn ghost" disabled>${ic('check')}Сборка установлена</button><button class="btn ghost" data-a=goto>${ic('layers')}Открыть в «Сборках»</button></div>`
      : `<div class=pkb><button class=btn data-a=install data-m="${m.id}" ${busy || !left ? 'disabled' : ''}>${ic('dl')}<span class=pkbt>${busy ? 'Устанавливается…' : 'Установить сборку'}</span><span class=pkbn${left === total(p) || busy ? ' hidden' : ''}>${left}</span></button></div>`;
    const quick = isLast && !C.busy ? `<div class=pkq>${QUICK.map(([t, q]) => `<button class=chip data-a=say data-t="${esc(q)}">${t}</button>`).join('')}</div>` : '';
    return `<div class=aipk><div class=pkh><b class=pkt>«${esc(p.name)}»</b><span class=pkv>Minecraft ${esc(p.mc)} · ${esc(LCAP[p.loader] || p.loader)}</span></div><div class=pkc>${counts}</div>${lists}${btn}${quick}</div>`;
  };
  const mapsHtml = (m) => `<div class=aimaps>${m.maps.map((x, i) => `<div class=aimap><div class=mpt><b>${esc(x.title)}</b><span class=mut>${esc(x.author || 'CurseForge')} · ${fmtNum(x.downloads)} скачиваний</span></div><p class=mut>${esc(x.desc)}</p><button class="btn ghost sm" data-a=map data-m="${m.id}" data-i="${i}">${ic('dl')}Скачать</button></div>`).join('')}</div>`;

  const refreshPack = (m) => { // счётчики и кнопка «Установить» после смены галочек
    const card = box.querySelector(`.aia[data-m="${m.id}"] .aipk`); if (!card || !m.pack) return; const off = offOf(m.id);
    card.querySelectorAll('.pkn').forEach((el) => { const k = el.dataset.k, L = m.pack[k] || [], n = L.filter((x) => !off.has(x.id)).length; el.innerHTML = `${esc(KINDS.find((q) => q[0] === k)?.[2] || '')}: <b>${n}</b>${n < L.length ? `<small class=mut>/${L.length}</small>` : ''}`; });
    const left = KINDS.reduce((n, [k]) => n + (m.pack[k] || []).filter((x) => !off.has(x.id)).length, 0), all = total(m.pack), btn = card.querySelector('[data-a=install]');
    if (btn) { btn.disabled = !left || C.inst.has(m.id); const bn = btn.querySelector('.pkbn'); if (bn) { bn.textContent = left; bn.classList.toggle('hidden', left === all); } }
  };

  // ---------- сообщения ----------
  const msgHtml = (m, last) => {
    if (m.role === 'user') return `<div class="aiu"><div class=aub>${esc(m.text).replace(/\n/g, '<br>')}</div></div>`;
    const key = m.flags?.needKey ? `<div class=ainote>${ic('key')}<span>Для поиска карт нужен бесплатный ключ CurseForge.</span><button class="btn ghost sm" data-a=key>Указать ключ</button></div>` : '';
    return `<div class=aia data-m="${m.id}"><div class=aiwho><span class=aiav2><img src=assets/totem.png alt=""></span><b>Бурмалдец</b><button class=aicp data-a=copy data-m="${m.id}" data-tip="Скопировать">${ic('copy')}</button></div>
<div class=aitx>${m._anim ? '' : fmt(m.text)}</div><div class=aiextra ${m._anim ? 'hidden' : ''}>${m.pack ? packHtml(m) : ''}${m.maps ? mapsHtml(m) : ''}${key}${last && m.hints?.length && !C.busy ? `<div class=aihs>${m.hints.map((h) => `<button class=chip data-a=say data-t="${esc(h)}">${esc(h)}</button>`).join('')}</div>` : ''}</div></div>`;
  };
  const welcome = () => `<div class=aiw><span class=aiwav><img src=assets/totem.png alt=""></span><h2>Привет, я Бурмалдец</h2><p>Расскажите, во что хотите играть, — подберу моды, версию и загрузчик и соберу сборку, которую останется только установить.</p><div class=aihs>${EXAMPLES.map((h) => `<button class=chip data-a=say data-t="${esc(h)}">${esc(h)}</button>`).join('')}</div></div>`;
  const typing = () => `<div class="aia aity"><div class=aiwho><span class=aiav2><img src=assets/totem.png alt=""></span><b>Бурмалдец</b></div><div class=aitx><span class=dots><i></i><i></i><i></i></span><em id=aist>${esc(C.status || 'Думаю…')}</em></div></div>`;
  const errHtml = () => C.err ? `<div class="aierr${C.err.soft ? ' soft' : ''}"><span>${esc(C.err.text)}</span><button class=chip data-a=retry>Повторить</button></div>` : '';

  const nearEnd = () => box.scrollHeight - box.scrollTop - box.clientHeight < 90;
  let anim = 0;
  const render = (stick) => {
    const keep = box.scrollTop, end = stick || nearEnd(), lastAi = (() => { for (let i = C.msgs.length - 1; i >= 0; i--) if (C.msgs[i].role === 'ai') return C.msgs[i].id; return ''; })();
    box.innerHTML = (C.msgs.length || C.busy ? C.msgs.map((m) => msgHtml(m, m.id === lastAi && m === C.msgs[C.msgs.length - 1])).join('') : welcome()) + (C.busy ? typing() : '') + errHtml();
    box.scrollTop = end ? box.scrollHeight : keep;
    const am = C.msgs.find((m) => m._anim); if (am) typewrite(am);
    $('aisend').classList.toggle('stop', C.busy); $('aisend').firstElementChild.dataset.i = C.busy ? 'stop' : 'send'; $('aisend').dataset.tip = C.busy ? 'Остановить' : 'Отправить'; PIX.hydrate();
  };
  const typewrite = (m) => { // ответ «печатается», затем появляются карточка сборки и подсказки
    const el = box.querySelector(`.aia[data-m="${m.id}"] .aitx`), ex = box.querySelector(`.aia[data-m="${m.id}"] .aiextra`); if (!el) return; m._anim = false;
    const fin = () => { el.innerHTML = fmt(m.text); if (ex) { ex.hidden = false; ex.classList.add('rise'); } const w = el.closest('.aia'); box.scrollTop = w && w.offsetHeight > box.clientHeight - 30 ? Math.max(0, w.offsetTop - 14) : box.scrollHeight; }; // длинный ответ с карточкой показываем с начала
    if (document.body.classList.contains('noanim') || !m.text) return fin();
    const n = m.text.length, step = Math.max(2, Math.ceil(n / 70)); let i = 0; cancelAnimationFrame(anim);
    const tick = () => { i = Math.min(n, i + step); el.textContent = m.text.slice(0, i); box.scrollTop = box.scrollHeight; if (i < n) anim = requestAnimationFrame(tick); else fin(); }; tick();
  };

  // ---------- отправка ----------
  const send = async (text, retry = false) => {
    text = String(text || '').trim(); if (!text || C.busy) return;
    if (!retry) C.msgs.push({ id: 'tmp' + Date.now(), role: 'user', text }); C.err = null; C.busy = true; C.status = 'Думаю…'; ta.value = ''; fit(); render(true);
    const r = await totem.aiSend({ chat: C.chat, text, retry }).catch((e) => ({ ok: false, error: 'Не удалось отправить сообщение' }));
    C.busy = false; if (r.chat) C.chat = r.chat;
    const ti = C.msgs.findIndex((m) => m.id.startsWith('tmp')); if (r.user && ti >= 0) C.msgs[ti] = r.user;
    if (r.ok) { r.msg._anim = true; C.msgs.push(r.msg); C.err = null; } else C.err = { text: r.error || 'Не получилось', soft: !!r.cancelled, retry: text };
    render(true); if (!C.busy && !$('aihist').classList.contains('on')) ta.focus();
  };
  $('aisend').onclick = () => { if (C.busy) { totem.aiCancel(); return; } send(ta.value); };
  const fit = () => { ta.style.height = 'auto'; ta.style.height = Math.min(ta.scrollHeight, 132) + 'px'; };
  ta.addEventListener('input', fit);
  ta.addEventListener('keydown', (e) => { if (e.key === 'Enter' && !e.shiftKey && !e.isComposing) { e.preventDefault(); if (!C.busy) send(ta.value); } });
  totem.onAiStatus((t) => { C.status = t; const el = $('aist'); if (el) el.textContent = t; });

  // ---------- действия в сообщениях ----------
  const install = async (m) => {
    if (C.inst.has(m.id) || !m.pack) return; C.inst.add(m.id); render();
    const chat = C.chat, skip = [...offOf(m.id)].filter((id) => KINDS.some(([k]) => m.pack[k]?.some((x) => x.id === id))), r = await dmRun(`Сборка «${m.pack.name}»`, () => totem.aiInstall({ chat, msg: m.id, skip })); C.inst.delete(m.id);
    if (r.cancelled) toast('Загрузка отменена'); else if (!r.ok) toast(r.offline ? 'Нет подключения к интернету' : r.error || 'Не удалось установить сборку', 1);
    else { m.pack.inst = r.inst.id; await refreshLists(); toast(`Сборка «${r.inst.name}» установлена` + (r.skipped?.length ? `. Без подходящей версии пропущено: ${r.skipped.length}` : '') + (r.note ? '. ' + r.note : '')); }
    render();
  };
  box.addEventListener('click', async (e) => {
    const row = e.target.closest('.pkr'), mapc = e.target.closest('.aimap');
    if (row && !e.target.closest('[data-a=tick]')) { const m0 = C.msgs.find((x) => x.id === row.closest('.aia')?.dataset.m), k0 = m0 && KINDS.find(([k]) => m0.pack?.[k]?.some((x) => x.id === row.dataset.id)); if (k0) openDetail({ src: 'mr', id: row.dataset.id, type: { mods: 'mod', shaders: 'shader', resourcepacks: 'resourcepack', datapacks: 'datapack' }[k0[0]] }, { noDl: true }); return; } // клик по пункту (кроме галочки) — подробности, как в каталоге, но без кнопки «Скачать»
    if (mapc && !e.target.closest('[data-a]')) { const m0 = C.msgs.find((x) => x.id === mapc.closest('.aia')?.dataset.m), x = m0?.maps?.[[...mapc.parentNode.children].indexOf(mapc)]; if (x) openDetail({ src: 'cf', id: x.id, type: 'map' }, { noDl: true }); return; }
    let b = e.target.closest('[data-a]'); if (!b) return; const a = b.dataset.a, m = C.msgs.find((x) => x.id === b.dataset.m);
    if (a === 'say') return send(b.dataset.t);
    if (a === 'retry') return C.err && send(C.err.retry, true);
    if (a === 'tick' && m) { // галочка: меняем на месте (без перерисовки), чтобы сработала анимация нажатия и отжатия
      const id = b.dataset.id, off = offOf(m.id), on = off.has(id); on ? off.delete(id) : off.add(id);
      b.classList.toggle('on', on); b.classList.remove('pop', 'unpop'); void b.offsetWidth; b.classList.add(on ? 'pop' : 'unpop'); b.setAttribute('aria-checked', String(on));
      b.closest('.pkr')?.classList.toggle('dis', !on); refreshPack(m); return;
    }
    if (a === 'install' && m) return install(m);
    if (a === 'goto') { go('bl'); return; }
    if (a === 'more' && m) { const k = m.id + b.dataset.k; C.open8.has(k) ? C.open8.delete(k) : C.open8.add(k); const y = box.scrollTop; render(); box.scrollTop = y; return; }
    if (a === 'copy' && m) { try { await navigator.clipboard.writeText(m.text); toast('Скопировано'); } catch { toast('Не удалось скопировать', 1); } return; }
    if (a === 'key') { go('st'); document.querySelector('.sti[data-s=keys]')?.click(); return; }
    if (a === 'map' && m) { const x = m.maps[+b.dataset.i]; if (x) catDownload({ src: 'cf', id: x.id, type: 'map', title: x.title, loaders: [] }); }
  });

  // ---------- история чатов ----------
  const ago = (t) => { const d = new Date(t), now = new Date(), same = d.toDateString() === now.toDateString(); return same ? d.toLocaleTimeString('ru-RU', { hour: '2-digit', minute: '2-digit' }) : d.toLocaleDateString('ru-RU', { day: 'numeric', month: 'short' }); };
  const drawHist = async () => {
    C.hl = await totem.aiList().catch(() => []);
    $('aihl').innerHTML = C.hl.length ? C.hl.map((c) => `<div class="aih${c.id === C.chat ? ' on' : ''}" data-c="${c.id}"><button class=aiho data-a=open><b>${esc(c.title)}</b><small class=mut>${ago(c.updated)} · сообщений: ${c.n}</small></button><button class="ib aidel" data-a=del data-tip="Удалить чат">${ic('trash')}</button></div>`).join('') : '<p class=empty>Пока нет сохранённых чатов</p>';
    $('aihclr').hidden = !C.hl.length;
  };
  const showHist = async (on) => { C.hist = on; $('aihist').classList.toggle('on', on); $('aihis').classList.toggle('act', on); if (on) await drawHist(); };
  const openChat = async (id) => { const c = id ? await totem.aiGet(id) : null; C.chat = c ? c.id : null; C.msgs = c ? c.msgs : []; C.err = null; C.status = ''; render(true); };
  $('aihis').onclick = () => showHist(!C.hist);
  $('ainew').onclick = async () => { if (C.busy) return; await openChat(null); await showHist(false); ta.focus(); };
  $('aihl').onclick = async (e) => {
    const row = e.target.closest('[data-c]'), b = e.target.closest('[data-a]'); if (!row || !b) return;
    if (b.dataset.a === 'open') { if (C.busy) return; await openChat(row.dataset.c); await showHist(false); }
    else if (b.dataset.a === 'del') { if (C.busy && row.dataset.c === C.chat) return; if (!(await ask('Удалить этот чат? Переписку не вернуть.', 'Удалить'))) return; await totem.aiDel(row.dataset.c); if (row.dataset.c === C.chat) await openChat(null); await drawHist(); }
  };
  $('aihclr').onclick = async () => { if (C.busy || !(await ask('Удалить всю историю чатов с Бурмалдецем?', 'Удалить всё'))) return; await totem.aiClear(); await openChat(null); await drawHist(); };

  // ---------- открыть / закрыть / свернуть ----------
  const sync = () => { const ok = pageOk(); aip.classList.toggle('on', ok && C.open && !C.min); $('aitab').classList.toggle('on', ok && C.open && C.min); $('aifab').classList.toggle('on', ok && !C.open && (document.body.dataset.page || 'home') !== 'home'); $('qai').classList.toggle('act', ok && C.open && !C.min); document.body.classList.toggle('ai-on', ok && C.open && !C.min); };
  const openPanel = async () => { C.open = true; C.min = false; sync();
    if (!C.loaded) { C.loaded = true; const l = await totem.aiList().catch(() => []); if (l.length) await openChat(l[0].id); else render(); }
    setTimeout(() => ta.focus(), 420); };
  $('aifab').onclick = openPanel; $('qai').onclick = () => { if (C.open && !C.min) return ta.focus(); openPanel(); };
  $('aix').onclick = () => { C.open = false; C.min = false; showHist(false); sync(); };
  $('aimin').onclick = () => { C.min = true; sync(); }; $('aitab').onclick = () => { C.min = false; sync(); setTimeout(() => ta.focus(), 420); };
  new MutationObserver(sync).observe(document.body, { attributes: true, attributeFilter: ['data-page'] }); sync(); render();
  document.addEventListener('keydown', (e) => { if (e.key === 'Escape' && C.hist && aip.classList.contains('on') && !$('askm').classList.contains('on')) showHist(false); });
  window.__ai = { C, send, openPanel };
})();
