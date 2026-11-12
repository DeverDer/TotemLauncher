// Фоны лаунчера: у каждой вкладки свой, смена с плавным затуханием; фон главной меняется в настройках
(() => {
  const root = document.getElementById('bg'); if (!root) return;
  const FILE = { village: 'village.jpg', cave: 'cave.jpg', cabin: 'cabin.jpg', fireplace: 'fireplace.jpg', sunset: 'sunset.jpg' };
  const MAP = { home: 'village', dl: 'cave', bl: 'fireplace', sk: 'sunset', st: 'cabin' }, L = {};
  const layer = (k) => L[k] || (L[k] = (() => { const d = document.createElement('div'); d.className = 'bgl'; d.style.backgroundImage = `url("assets/bg/${FILE[k]}")`; root.append(d); return d; })());
  const show = (k) => { layer(k); requestAnimationFrame(() => { for (const n in L) L[n].classList.toggle('on', n === k); }); };
  window.BG_FILES = FILE; window.setBg = (page) => show(MAP[page] || MAP.home); window.setHomeBg = (k) => { if (FILE[k]) MAP.home = k; };
  const ks = Object.keys(FILE); show(document.getElementById('p-home') ? MAP.home : ks[Math.floor(Math.random() * ks.length)]); // окна загрузки/настройки: случайный фон
})();
