'use strict';
// Окно «Игра закрылась с ошибкой»: главный процесс (src/diag.js) прочитал консоль и журналы игры, узнал причину и предложил исправления.
// Здесь — объяснение простыми словами и кнопки. Параметры исправлений в окне не передаются: уходит только id (главный процесс берёт их из своего разбора).
(() => {
  const m = $('diagm'); let cur = null, busy = false, seen = '';
  const FIC = { driver: 'info', ram: 'ram', verify: 'refresh', 'reinstall-loader': 'refresh', 'jvm-reset': 'gear', 'java-auto': 'gear' };
  const draw = (note, err) => {
    const d = cur; $('diagt').textContent = d.title; $('diagd').textContent = d.text;
    $('diagx').innerHTML = d.detail ? `<span class=mut>Что написала игра:</span><code>${esc(d.detail)}</code>` : ''; $('diagx').hidden = !d.detail;
    $('diagl').innerHTML = (d.mods || []).slice(0, 8).map((x) => `<li><i class=pi data-i=layers></i><span><b>${esc(x.title)}</b><small class=mut>${esc(x.file)}</small></span></li>`).join(''); $('diagl').hidden = !(d.mods || []).length;
    const n = $('diagn'); n.hidden = !note; n.textContent = note || ''; const e = $('diage'); e.hidden = !err; e.textContent = err || '';
    const fixes = note ? [] : d.fixes || [];
    $('diagb').innerHTML = (note ? `<button class=btn id=diagplay>${ic('play')}Запустить игру</button>` : fixes.map((f, i) => `<button class="btn${i ? ' ghost' : ''}" data-f="${esc(f.id)}" title="${esc(f.hint || '')}" ${busy ? 'disabled' : ''}>${ic(FIC[f.id] || (i ? 'gear' : 'bolt'))}${esc(f.label)}</button>`).join(''))
      + (note ? '' : `<button class="btn ghost" id=diagall title="Подробный разбор: какие моды мешают запуску">${ic('warn')}Все проблемы</button>`) + `<button class="btn ghost" id=diaglog>${ic('folder')}Журналы</button><button class="btn ghost" id=diagno>${note ? 'Готово' : 'Закрыть'}</button>`;
    PIX.hydrate();
  };
  const show = (d) => { if (!d || !d.title || !d.inst) return; const key = d.inst + d.id + (d.detail || ''); if (busy || (m.classList.contains('on') && key === seen)) return; seen = key; cur = d; draw(''); m.classList.add('on'); };
  const close = () => { if (busy) return; m.classList.remove('on'); cur = null; };
  m.addEventListener('pointerdown', (e) => { if (e.target === m) close(); });
  $('diagb').onclick = async (e) => {
    const b = e.target.closest('button'); if (!b || !cur || busy) return;
    if (b.id === 'diagno') return close(); if (b.id === 'diagall') { const id = cur.inst; close(); return openErrs(INST.some((i) => i.id === id) ? id : ''); } if (b.id === 'diaglog') return totem.diagLog(cur.inst);
    if (b.id === 'diagplay') { const id = cur.inst; close(); if (INST.some((i) => i.id === id)) selectItem('i', id); return $('play').click(); }
    const f = (cur.fixes || []).find((x) => x.id === b.dataset.f); if (!f) return;
    if (f.url) return totem.openUrl(f.url);
    busy = true; draw('', ''); const r = await totem.diagFix({ inst: cur.inst, fix: f.id }); busy = false;
    if (!r.ok) return draw('', r.error || 'Не удалось применить исправление');
    SET = await totem.getSettings(); if (typeof refreshLists === 'function') await refreshLists(); if ($('p-bl').classList.contains('on')) drawM();
    draw(r.note || 'Готово.', '');
  };
  document.addEventListener('keydown', (e) => { if (e.key === 'Escape' && m.classList.contains('on') && !$('askm').classList.contains('on')) close(); });
  window.DiagUI = { show };
})();
