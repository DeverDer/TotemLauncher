// Фоны лаунчера: по умолчанию портал во всех окнах и вкладках; фон главной меняется в настройках.
// Свой фон — файл из папки данных (его выбирает пользователь в «Настройки → Кастомизация»).
// Яркость и размытие фона (настройки) — через переменные --bgb / --bgbl на #bg.
(() => {
  const root = document.getElementById('bg'); if (!root) return;
  const FILE = { portal: 'portal.jpg', village: 'village.jpg', cave: 'cave.jpg', cabin: 'cabin.jpg', fireplace: 'fireplace.jpg', sunset: 'sunset.jpg' };
  const MAP = { home: 'portal', dl: 'portal', bl: 'portal', sk: 'portal', st: 'portal' }, L = {};
  let custom = '', page = 'home';
  const urlOf = (k) => (k === 'custom' ? custom : `assets/bg/${FILE[k]}`);
  const layer = (k) => L[k] || (L[k] = (() => { const d = document.createElement('div'); d.className = 'bgl'; d.style.backgroundImage = `url("${urlOf(k)}")`; root.append(d); return d; })());
  const show = (k) => { layer(k); requestAnimationFrame(() => { for (const n in L) L[n].classList.toggle('on', n === k); }); };
  const pick = (p) => { const k = MAP[p] || MAP.home; return k === 'custom' && !custom ? 'portal' : k; };
  window.BG_FILES = FILE;
  window.setBg = (p) => { page = p; show(pick(p)); };
  window.setHomeBg = (k) => { if (FILE[k] || (k === 'custom' && custom)) MAP.home = k; else if (k === 'custom') MAP.home = 'portal'; if (page === 'home') show(pick('home')); };
  // свой фон: url из настроек (пусто — файла нет); при смене файла слой пересоздаётся
  window.setCustomBg = (url) => { url = String(url || ''); if (url === custom) return; custom = url; if (L.custom) { L.custom.remove(); delete L.custom; } if (!custom && MAP.home === 'custom') MAP.home = 'portal'; show(pick(page)); };
  // яркость (30–130 %) и размытие: применяются ко всем вкладкам сразу
  window.setBgLook = (bright, blur) => { const b = Math.max(30, Math.min(130, Math.round(+bright) || 100)); root.style.setProperty('--bgb', (b / 100).toString()); root.style.setProperty('--bgbl', blur ? '5px' : '0px'); document.body.classList.toggle('bgblur', !!blur); };
  show('portal'); // окна загрузки и первой настройки тоже с порталом
})();
