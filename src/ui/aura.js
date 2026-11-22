// Фиолетовая аура вокруг кнопки «Играть»: две «орбиты» светящихся лент и искры, всегда крутятся.
// Рисуется на маленьком холсте (174×76) и растягивается без сглаживания — получается пиксельный вид.
// Нижняя половина орбит рисуется поверх кнопки, верхняя — под ней (эффект вращения вокруг кнопки).
(() => {
  const cb = document.getElementById('aura-b'), cf = document.getElementById('aura-f'); if (!cb || !cf) return;
  const W = cb.width, H = cb.height, CX = W / 2, CY = H / 2, bx = cb.getContext('2d'), fx = cf.getContext('2d');
  const orbits = [
    { rx: 60, ry: 20, tilt: -0.2, sp: 0.85, ph: 0.0, w: 6, len: 4.6 },
    { rx: 54, ry: 22, tilt: 0.17, sp: -0.7, ph: 2.2, w: 5, len: 4.0 },
    { rx: 64, ry: 15, tilt: 0.06, sp: 1.25, ph: 4.1, w: 4, len: 3.0 },
  ];
  const sparks = Array.from({ length: 18 }, () => ({ x: 0, y: 0, t: 0, d: 0, s: 2 }));
  const respawn = (p, first) => { const a = Math.random() * 6.283, k = 0.75 + Math.random() * 0.45; p.x = CX + Math.cos(a) * 62 * k; p.y = CY + Math.sin(a) * 26 * k; p.d = 0.8 + Math.random() * 1.6; p.t = first ? Math.random() * p.d : 0; p.s = Math.random() < 0.3 ? 3 : 2; };
  sparks.forEach((p) => respawn(p, true));
  let col = { a: '#b347ff', a2: '#7a2bd6', a3: '#e3b8ff' }, last = 0, ccount = 0;
  // цвета темы читаем через пробный элемент: браузер сам превращает hsl(… calc(…)) в обычный rgb(), который понимает холст
  const probe = document.createElement('i'); probe.style.cssText = 'position:absolute;width:0;height:0;visibility:hidden'; document.body.append(probe);
  const rd = (v, d) => { probe.style.color = ''; probe.style.color = `var(${v})`; return getComputedStyle(probe).color || d; };
  const readCol = () => { col = { a: rd('--a', col.a), a2: rd('--a2', col.a2), a3: rd('--a3', col.a3) }; };
  const dot = (ctx, x, y, s, c, al) => { ctx.globalAlpha = al; ctx.fillStyle = c; ctx.fillRect(Math.round(x - s / 2), Math.round(y - s / 2), s, s); };
  const frame = (t, dt) => {
    bx.clearRect(0, 0, W, H); fx.clearRect(0, 0, W, H);
    for (const o of orbits) {
      const head = o.ph + t * o.sp, dir = Math.sign(o.sp), step = 0.02, n = Math.ceil(o.len / step), ct = Math.cos(o.tilt), st = Math.sin(o.tilt);
      for (let k = 0; k < n; k++) {
        const f = 1 - k / n, ak = head - dir * k * step, ex = o.rx * Math.cos(ak), ey = o.ry * Math.sin(ak);
        const x = CX + ex * ct - ey * st, y = CY + ex * st + ey * ct, s = Math.max(2, Math.round(o.w * Math.sqrt(f))), c = f > 0.82 ? col.a3 : f > 0.4 ? col.a : col.a2;
        dot(Math.sin(ak) > 0 ? fx : bx, x, y, s, c, Math.min(1, 0.35 + f));
      }
    }
    for (const p of sparks) { p.t += dt; if (p.t >= p.d) respawn(p, false); const f = Math.sin(Math.PI * p.t / p.d); dot(p.y > CY + 10 ? fx : bx, p.x, p.y - p.t * 2, p.s, f > 0.6 ? col.a3 : col.a, Math.max(0, f)); }
    bx.globalAlpha = fx.globalAlpha = 1;
  };
  const loop = (ts) => {
    requestAnimationFrame(loop);
    if (document.hidden || ts - last < 33) return; // ~30 кадров в секунду — этого хватает для пиксельной анимации
    const dt = Math.min(0.1, (ts - (last || ts)) / 1000); last = ts; if (++ccount % 20 === 1) readCol();
    if (document.body.classList.contains('noaura')) return; // «Аура у кнопки Играть» выключена в настройках — не рисуем
    if (document.body.classList.contains('noanim')) { frame(1.2, 0); return; } // «Анимации интерфейса» выключены — ауру не двигаем
    frame(ts / 1000, dt);
  };
  readCol(); frame(1.2, 0); requestAnimationFrame(loop);
})();
