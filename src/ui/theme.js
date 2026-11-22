// Тема лаунчера: один параметр — оттенок (--h). Все цвета интерфейса считаются от него в app.css.
// По умолчанию фиолетовая (272). Работает во всех окнах: главное, загрузка, первый запуск.
(() => {
  const DEF = 272, root = document.documentElement;
  // [название, оттенок, насыщенность]: «Серая» — без цвета (насыщенность 0)
  const PRESETS = [['Зелёная', 120, 1], ['Фиолетовая', 272, 1], ['Синяя', 214, 1], ['Розовая', 318, 1], ['Оранжевая', 28, 1], ['Серая', 272, 0], ['Бирюзовая', 176, 1], ['Лаймовая', 80, 1], ['Красная', 355, 1]];
  const clamp = (h) => { h = Math.round(+h); return Number.isFinite(h) ? ((h % 360) + 360) % 360 : DEF; };
  const clampS = (v) => { v = Number(v); return Number.isFinite(v) ? Math.max(0, Math.min(1, v)) : 1; };
  const apply = (h, sat) => { h = clamp(h); const s = sat === undefined ? (window.THEME_S ?? 1) : clampS(sat); root.style.setProperty('--h', h); root.style.setProperty('--s', s); window.THEME_H = h; window.THEME_S = s; return h; };
  const hexToHue = (hex) => {
    const m = /^#?([0-9a-f]{6})$/i.exec(String(hex || '')); if (!m) return DEF;
    const n = parseInt(m[1], 16), r = (n >> 16 & 255) / 255, g = (n >> 8 & 255) / 255, b = (n & 255) / 255, mx = Math.max(r, g, b), mn = Math.min(r, g, b), d = mx - mn;
    if (d < 0.02) return window.THEME_H ?? DEF; // серый цвет оттенка не имеет — оставляем текущий
    const h = mx === r ? ((g - b) / d) % 6 : mx === g ? (b - r) / d + 2 : (r - g) / d + 4;
    return clamp(h * 60);
  };
  const hueToHex = (h) => { // hsl(h,100%,66%) → #rrggbb (для поля выбора цвета)
    h = clamp(h); const s = 1, l = 0.66, c = (1 - Math.abs(2 * l - 1)) * s, x = c * (1 - Math.abs((h / 60) % 2 - 1)), m = l - c / 2;
    const [r, g, b] = h < 60 ? [c, x, 0] : h < 120 ? [x, c, 0] : h < 180 ? [0, c, x] : h < 240 ? [0, x, c] : h < 300 ? [x, 0, c] : [c, 0, x];
    return '#' + [r, g, b].map((v) => Math.round((v + m) * 255).toString(16).padStart(2, '0')).join('');
  };
  window.THEME_H = DEF; window.THEME_S = 1;
  window.Theme = { DEF, PRESETS, apply, clamp, clampS, hexToHue, hueToHex };
  try { if (window.totem?.getSettings) totem.getSettings().then((s) => apply(s && s.themeHue != null ? s.themeHue : DEF, s && s.themeSat != null ? s.themeSat : 1)).catch(() => {}); } catch {}
})();
