'use strict';
// Окно «Игре не хватает модов»: после выхода из игры главный процесс прочитал журнал и нашёл моды-зависимости, которых не было в сборке.
// Здесь показываем их список и по кнопке ставим с Modrinth в ту же сборку (общее окно загрузок: пауза и отмена работают).
(() => {
  const m = $('depm'); let cur = null, busy = false, seen = '';
  const row = (x) => `<li><i class=pi data-i=layers></i><span><b>${esc(x.id)}</b>${x.by?.length ? `<small class=mut>нужен для: ${esc(x.by.join(', '))}</small>` : ''}</span><button class="btn ghost sm" data-s="${esc(x.id)}" title="Найти на Modrinth">${ic('search')}</button></li>`;
  const draw = (note) => { const n = cur.list.length, inst = INST.find((i) => i.id === cur.inst);
    $('depd').textContent = `Игра закрылась с ошибкой: для сборки «${inst ? inst.name : 'без имени'}» нужны ещё ${n === 1 ? 'этот мод' : 'эти моды'}. Лаунчер найдёт ${n === 1 ? 'его' : 'их'} на Modrinth и установит для Minecraft ${cur.mc} (${cur.loader}).`;
    $('depl').innerHTML = cur.list.map(row).join(''); const e = $('depe'); e.hidden = !note; e.textContent = note || '';
    $('depok').innerHTML = ic('dl') + (n === 1 ? 'Установить мод' : `Установить все (${n})`); $('depok').disabled = busy; PIX.hydrate(); };
  const show = (d) => { if (!d?.list?.length || !d.inst) return; const key = d.inst + d.list.map((x) => x.id).join(','); if (busy || (m.classList.contains('on') && key === seen)) return; seen = key; cur = d; draw(''); m.classList.add('on'); };
  const close = () => { if (busy) return; m.classList.remove('on'); cur = null; };
  $('depno').onclick = close; m.addEventListener('pointerdown', (e) => { if (e.target === m) close(); });
  $('depl').onclick = (e) => { const b = e.target.closest('[data-s]'); if (b) totem.openUrl('https://modrinth.com/mods?q=' + encodeURIComponent(b.dataset.s)); };
  $('depok').onclick = async () => { if (!cur || busy) return; busy = true; $('depok').disabled = true; const d = cur, inst = d.inst;
    m.classList.remove('on'); // окно скрываем на время загрузки — дальше работает общее окно загрузок
    let r; try { r = await dmRun('Недостающие моды', () => totem.depsInstall({ inst, ids: d.list.map((x) => x.id) })); } catch (e) { r = { ok: false, error: e.message }; } busy = false;
    if (r.cancelled) return toast('Загрузка отменена'); if (!r.ok) { toast(r.offline ? 'Нет подключения к интернету' : r.error || 'Не удалось установить моды', 1); cur = d; draw(r.error || ''); m.classList.add('on'); return; }
    if (typeof refreshLists === 'function') await refreshLists();
    const left = d.list.filter((x) => r.missing?.includes(x.id));
    if (r.installed?.length) toast(`Установлено: ${r.installed.join(', ')}. Запустите игру ещё раз.`);
    if (left.length) { cur = { ...d, list: left }; draw(`Не нашлись на Modrinth: ${left.map((x) => x.id).join(', ')}. Найдите их кнопкой поиска справа или поставьте вручную.`); m.classList.add('on'); }
    else { cur = null; seen = ''; if (!r.installed?.length) toast('Все эти моды уже установлены'); } };
  window.DepsUI = { show };
})();
