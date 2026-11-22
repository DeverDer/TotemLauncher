// UV-раскладка скина Minecraft, WebGL-просмотр (вращение/масштаб) и серый манекен
(() => {
  const PARTS = (slim) => { const a = slim ? 3 : 4; return [['head', [-4, 24, -4], [8, 8, 8], [0, 0], [32, 0]], ['body', [-4, 12, -2], [8, 12, 4], [16, 16], [16, 32]],
    ['rarm', [-4 - a, 12, -2], [a, 12, 4], [40, 16], [40, 32]], ['larm', [4, 12, -2], [a, 12, 4], [32, 48], [48, 48]], ['rleg', [-4, 0, -2], [4, 12, 4], [0, 16], [0, 32]], ['lleg', [0, 0, -2], [4, 12, 4], [16, 48], [0, 48]]]; };
  const faces = (u, v, w, h, d) => ({ front: [u + d, v + d, w, h], back: [u + 2 * d + w, v + d, w, h], right: [u, v + d, d, h], left: [u + d + w, v + d, d, h], top: [u + d, v, w, d], bottom: [u + d + w, v, w, d] });
  const corners = (a, b, c, x, y, z) => ({ front: [[a, b, z], [x, b, z], [x, y, z], [a, y, z]], back: [[x, b, c], [a, b, c], [a, y, c], [x, y, c]], right: [[a, b, c], [a, b, z], [a, y, z], [a, y, c]],
    left: [[x, b, z], [x, b, c], [x, y, c], [x, y, z]], top: [[a, y, z], [x, y, z], [x, y, c], [a, y, c]], bottom: [[a, b, c], [x, b, c], [x, b, z], [a, b, z]] });
  const SH = { front: 0.9, back: 0.8, right: 0.7, left: 0.7, top: 1, bottom: 0.5 };
  const build = (slim, overlay) => { const out = [];
    for (const [, p, s, ub, uo] of PARTS(slim)) { const inf = overlay ? 0.5 : 0, [x0, y0, z0] = p.map((k) => k - inf), [x1, y1, z1] = [p[0] + s[0] + inf, p[1] + s[1] + inf, p[2] + s[2] + inf];
      const [u, v] = overlay ? uo : ub, R = faces(u, v, s[0], s[1], s[2]), C = corners(x0, y0, z0, x1, y1, z1);
      for (const f in R) { const [rx, ry, rw, rh] = R[f], q = C[f], uv = [[rx, ry + rh], [rx + rw, ry + rh], [rx + rw, ry], [rx, ry]];
        for (const i of [0, 1, 2, 0, 2, 3]) out.push(...q[i], uv[i][0] / 64, uv[i][1] / 64, SH[f]); } }
    return new Float32Array(out); };
  const blank = (ctx, slim) => { ctx.clearRect(0, 0, 64, 64); ctx.fillStyle = '#8c8c8c'; for (const [, , s, ub] of PARTS(slim)) { const R = faces(ub[0], ub[1], s[0], s[1], s[2]); for (const f in R) ctx.fillRect(...R[f]); } };
  // Скин по умолчанию в стиле Стива (собственная отрисовка; это не оригинальная текстура Mojang)
  const steve = (ctx, slim) => { ctx.clearRect(0, 0, 64, 64);
    const C = { skin: '#c68f6c', hair: '#3a2716', shirt: '#00a6a6', pants: '#3b3b8f', shoe: '#6e6e6e' };
    const col = (n, f, j) => { if (n === 'head') return f === 'top' ? C.hair : f === 'bottom' ? C.skin : (f === 'back' ? j < 6 : j < 2) ? C.hair : C.skin;
      if (n === 'body') return f === 'bottom' ? C.pants : C.shirt; if (n === 'rarm' || n === 'larm') return f === 'top' || (f !== 'bottom' && j < 4) ? C.shirt : C.skin;
      return f === 'top' ? C.pants : f === 'bottom' || j >= 10 ? C.shoe : C.pants; };
    for (const [n, , s, u] of PARTS(slim)) { const R = faces(u[0], u[1], s[0], s[1], s[2]); for (const f in R) { const [x, y, w, h] = R[f]; for (let j = 0; j < h; j++) { ctx.fillStyle = col(n, f, j); ctx.fillRect(x, y + j, w, 1); } } }
    [[9, 12, '#fff'], [10, 12, '#3a3a9a'], [13, 12, '#3a3a9a'], [14, 12, '#fff'], [11, 13, '#a87656'], [12, 13, '#a87656'], [11, 14, '#7a4234'], [12, 14, '#7a4234']].forEach(([x, y, c]) => { ctx.fillStyle = c; ctx.fillRect(x, y, 1, 1); }); };
  // Старый формат 64x32 -> 64x64 (как в лаунчере Mojang: ноги/руки зеркалятся по граням)
  const legacy = (src) => { const o = new Uint8ClampedArray(64 * 64 * 4); o.set(src); let tr = false;
    for (let y = 0; y < 16 && !tr; y++) for (let x = 32; x < 64; x++) if (o[(y * 64 + x) * 4 + 3] < 128) { tr = true; break; }
    if (!tr) for (let y = 0; y < 16; y++) for (let x = 32; x < 64; x++) o[(y * 64 + x) * 4 + 3] = 0;
    for (const [x, y, ox, oy, w, h] of [[4, 16, 16, 32, 4, 4], [8, 16, 16, 32, 4, 4], [0, 20, 24, 32, 4, 12], [4, 20, 16, 32, 4, 12], [8, 20, 8, 32, 4, 12], [12, 20, 16, 32, 4, 12],
      [44, 16, -8, 32, 4, 4], [48, 16, -8, 32, 4, 4], [40, 20, 0, 32, 4, 12], [44, 20, -8, 32, 4, 12], [48, 20, -16, 32, 4, 12], [52, 20, -8, 32, 4, 12]])
      for (let j = 0; j < h; j++) for (let i = 0; i < w; i++) { const s = ((y + j) * 64 + x + i) * 4; o.set(o.slice(s, s + 4), ((y + oy + j) * 64 + x + ox + (w - 1 - i)) * 4); }
    return o; };
  // Фото 16x32 (RGBA) -> скин: «надето» на лицевую сторону, бока и спина залиты средним цветом
  const photo = (p) => { const o = new Uint8ClampedArray(64 * 64 * 4); let r = 0, g = 0, b = 0; for (let i = 0; i < 512; i++) { r += p[i * 4]; g += p[i * 4 + 1]; b += p[i * 4 + 2]; } r = (r / 512) | 0; g = (g / 512) | 0; b = (b / 512) | 0;
    const src = { head: [4, 0], body: [4, 8], rarm: [0, 8], larm: [12, 8], rleg: [4, 20], lleg: [8, 20] };
    for (const [n, , s, u] of PARTS(false)) { const R = faces(u[0], u[1], s[0], s[1], s[2]);
      for (const f in R) { const [x, y, w, h] = R[f]; for (let j = 0; j < h; j++) for (let i = 0; i < w; i++) o.set([r, g, b, 255], ((y + j) * 64 + x + i) * 4); }
      const [fx, fy] = src[n], [x, y, w, h] = R.front; for (let j = 0; j < h; j++) for (let i = 0; i < w; i++) { const q = ((fy + j) * 16 + fx + i) * 4; o.set(p.slice(q, q + 4), ((y + j) * 64 + x + i) * 4); } }
    return o; };
  const mul = (a, b) => { const o = new Float32Array(16); for (let i = 0; i < 4; i++) for (let j = 0; j < 4; j++) { let s = 0; for (let k = 0; k < 4; k++) s += a[k * 4 + j] * b[i * 4 + k]; o[i * 4 + j] = s; } return o; };
  const RY = (a) => new Float32Array([Math.cos(a), 0, -Math.sin(a), 0, 0, 1, 0, 0, Math.sin(a), 0, Math.cos(a), 0, 0, 0, 0, 1]);
  const RX = (a) => new Float32Array([1, 0, 0, 0, 0, Math.cos(a), Math.sin(a), 0, 0, -Math.sin(a), Math.cos(a), 0, 0, 0, 0, 1]);
  const TR = (x, y, z) => new Float32Array([1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1, 0, x, y, z, 1]);
  const PJ = (a, n, f) => { const t = 1 / Math.tan(0.4); return new Float32Array([t / a, 0, 0, 0, 0, t, 0, 0, 0, 0, (f + n) / (n - f), -1, 0, 0, 2 * f * n / (n - f), 0]); };
  // ---------- анимация персонажа ----------
  const RZ = (a) => new Float32Array([Math.cos(a), Math.sin(a), 0, 0, -Math.sin(a), Math.cos(a), 0, 0, 0, 0, 1, 0, 0, 0, 0, 1]);
  const SC = (s) => new Float32Array([s, 0, 0, 0, 0, s, 0, 0, 0, 0, s, 0, 0, 0, 0, 1]);
  const Z3 = () => ({ x: 0, y: 0, z: 0 }), NAMES = ['head', 'body', 'rarm', 'larm', 'rleg', 'lleg'];
  const newPose = () => ({ root: { x: 0, y: 0, z: 0, s: 1, ox: 0, oy: 0 }, torso: Z3(), head: Z3(), body: Z3(), rarm: Z3(), larm: Z3(), rleg: Z3(), lleg: Z3() });
  const pivots = (slim) => { const a = slim ? 3 : 4; return { head: [0, 24, 0], body: [0, 18, 0], rarm: [-4 - a / 2, 22, 0], larm: [4 + a / 2, 22, 0], rleg: [-2, 12, 0], lleg: [2, 12, 0] }; };
  const partMat = (pv, r) => mul(mul(TR(pv[0], pv[1], pv[2]), mul(RZ(r.z), mul(RY(r.y), RX(r.x)))), TR(-pv[0], -pv[1], -pv[2]));
  const sm = (a) => a * a * (3 - 2 * a), S = Math.sin, PI = Math.PI;
  const ap = (m, p) => [m[0] * p[0] + m[4] * p[1] + m[8] * p[2] + m[12], m[1] * p[0] + m[5] * p[1] + m[9] * p[2] + m[13], m[2] * p[0] + m[6] * p[1] + m[10] * p[2] + m[14]]; // матрица × точка
  // Эмоции: d — длительность в секундах (не больше 4), f(t, e, P): e — плавное включение/выключение
  // P.torso — наклон/поворот верхней части (голова, тело, руки) вокруг бёдер; X — доп. эффекты кадра (X.dg — цифры «6» и «7» над руками)
  const EM = {
    wave: { d: 3.2, f: (t, e, P) => { const s = S(t * 11); P.rarm.z = -(2.55 + 0.32 * s) * e; P.rarm.x = 0.1 * S(t * 5.5) * e; P.larm.z = (0.12 + 0.04 * S(t * 3)) * e; P.torso.z = -0.06 * e + 0.03 * s * e; P.torso.y = 0.18 * e; P.head.z = 0.14 * e; P.head.y += 0.3 * e; P.root.z = 0.04 * S(t * 3) * e; } },
    jacks: { d: 3.6, f: (t, e, P) => { const s = (S(t * 6.5 - PI / 2) + 1) / 2, a = 0.15 + 2.7 * s; P.rarm.z = -a * e; P.larm.z = a * e; P.rarm.x = P.larm.x = -0.15 * s * e; P.rleg.z = -0.42 * s * e; P.lleg.z = 0.42 * s * e; P.root.oy = 2 * s * e - 0.5 * (1 - s) * e; P.torso.x = 0.05 * (1 - s) * e; P.head.x = -0.08 * s * e; } },
    salto: { d: 1.9, f: (t, e, P) => { const p = Math.min(1, t / 1.9), u = S(PI * p), w = p < 0.18 ? sm(p / 0.18) : p > 0.84 ? sm((1 - p) / 0.16) : 0; P.root.x = -2 * PI * sm(Math.max(0, Math.min(1, (p - 0.16) / 0.68))); P.root.oy = 10 * S(PI * Math.max(0, Math.min(1, (p - 0.12) / 0.76))) - 3 * w; P.rleg.x = P.lleg.x = -(1.25 * u + 0.5 * w); P.rarm.x = P.larm.x = -(1.4 * u + 0.6 * w); P.torso.x = 0.55 * u + 0.25 * w; P.head.x = -0.35 * u; } },
    dance: { d: 4, f: (t, e, P) => { const s = S(t * 6.4), c = Math.cos(t * 6.4), b = Math.abs(s); P.root.z = 0.1 * s * e; P.root.oy = (1.3 * b - 0.5) * e; P.root.ox = 0.9 * s * e; P.torso.z = -0.14 * s * e; P.torso.y = 0.3 * s * e; P.rarm.z = -(1.6 + 0.9 * s) * e; P.larm.z = (1.6 - 0.9 * s) * e; P.rarm.x = 0.5 * c * e; P.larm.x = -0.5 * c * e; P.rleg.x = 0.55 * s * e; P.lleg.x = -0.55 * s * e; P.rleg.z = -0.1 * e; P.lleg.z = 0.1 * e; P.head.z = 0.2 * s * e; P.head.y += 0.32 * S(t * 3.2) * e; } },
    spin: { d: 2.2, f: (t, e, P) => { const p = Math.min(1, t / 2.2); P.root.y += 2 * PI * sm(p); P.rarm.z = -1.55 * e; P.larm.z = 1.55 * e; P.root.oy = (1.2 + 1.2 * S(PI * p)) * e; P.rleg.x = -0.35 * S(PI * p) * e; P.lleg.x = 0.2 * S(PI * p) * e; P.torso.z = 0.08 * e; } },
    look: { d: 3.6, f: (t, e, P) => { P.head.y += 0.95 * S(t * 2.1) * e; P.head.x += 0.28 * S(t * 4.2) * e; P.torso.y = 0.3 * S(t * 2.1 - 0.5) * e; P.head.z += 0.1 * S(t * 2.1 + 1) * e; P.larm.x = -0.1 * e; } },
    punch: { d: 2.6, f: (t, e, P) => { const w = t * 4.5, a = Math.max(0, S(w)), b = Math.max(0, -S(w)); P.rarm.x = (-0.5 - 1.15 * a) * e; P.larm.x = (-0.5 - 1.15 * b) * e; P.rarm.z = -0.1 * e; P.larm.z = 0.1 * e; P.torso.y = (-0.45 * a + 0.45 * b) * e; P.torso.x = 0.12 * e; P.root.y += 0.3 * S(w) * e; P.rleg.x = 0.3 * e; P.lleg.x = -0.3 * e; P.root.oy = -0.4 * e; } },
    run: { d: 3.4, f: (t, e, P) => { const s = S(t * 11), c = Math.cos(t * 11); P.rarm.x = 1.05 * s * e; P.larm.x = -1.05 * s * e; P.rarm.z = -0.1 * e; P.larm.z = 0.1 * e; P.rleg.x = -1.05 * s * e; P.lleg.x = 1.05 * s * e; P.torso.x = 0.2 * e; P.torso.y = 0.12 * s * e; P.head.x = -0.12 * e; P.root.oy = (0.4 + 0.9 * Math.abs(c)) * e; } },
    cheer: { d: 2.4, f: (t, e, P) => { const j = Math.abs(S(t * 5.2)); P.rarm.z = -(2.75 + 0.2 * S(t * 10)) * e; P.larm.z = (2.75 + 0.2 * S(t * 10 + 1)) * e; P.root.oy = 3.2 * j * e; P.head.x = -0.32 * e; P.torso.x = -0.1 * e; P.rleg.z = -0.12 * j * e; P.lleg.z = 0.12 * j * e; } },
    // ПРИСЕДАНИЕ: сначала мягко «садимся» (бёдра уходят вниз и назад, колени вперёд), держим, пружиним и встаём
    squat: { d: 3.4, f: (t, e, P) => { const dn = sm(Math.min(1, t / 0.55)), up = sm(Math.max(0, Math.min(1, (t - 2.7) / 0.55))), k = dn * (1 - up), bob = S(t * 7) * 0.04 * (t > 0.7 && t < 2.6 ? 1 : 0); P.root.oy = -5.6 * k + bob * 4; P.root.ox = 0; P.rleg.x = -1.25 * k; P.lleg.x = -1.25 * k; P.rleg.z = -0.12 * k; P.lleg.z = 0.12 * k; P.torso.x = 0.55 * k; P.head.x = -0.4 * k; P.rarm.x = -0.9 * k + bob; P.larm.x = -0.9 * k - bob; P.rarm.z = -0.18 * k; P.larm.z = 0.18 * k; P.root.z = 0; } },
    // ПОКЛОН: наклон идёт от бёдер вместе с головой и руками, ноги прямые
    bow: { d: 2.8, f: (t, e, P) => { const k = sm(Math.max(0, Math.min(1, t / 0.8))) * (1 - sm(Math.max(0, Math.min(1, (t - 2) / 0.8)))); P.torso.x = 0.95 * k; P.head.x = -0.2 * k; P.rarm.x = 0.35 * k; P.larm.x = 0.35 * k; P.rarm.z = -0.1 * k; P.larm.z = 0.1 * k; P.root.oy = -0.3 * k; P.rleg.x = -0.06 * k; P.lleg.x = -0.06 * k; } },
    // 67: ладони поднятых вперёд рук качаются вверх-вниз по очереди, над руками выскакивают цифры 6 и 7; тело пружинит, голова кивает
    s67: { d: 4, f: (t, e, P, X) => { const w = t * 8.2, s = S(w), c = Math.cos(w); P.rarm.x = (-1.45 + 0.5 * s) * e; P.larm.x = (-1.45 - 0.5 * s) * e; P.rarm.z = -0.16 * e; P.larm.z = 0.16 * e; P.torso.x = (0.06 - 0.05 * Math.abs(c)) * e; P.torso.y = 0.22 * s * e; P.torso.z = -0.1 * s * e; P.head.x = (0.18 - 0.22 * Math.abs(c)) * e; P.head.y += 0.28 * -s * e; P.head.z = 0.12 * s * e; P.root.oy = (0.2 + 1.4 * Math.abs(c)) * e; P.root.ox = 0.5 * s * e; P.rleg.x = (0.18 * s) * e; P.lleg.x = (-0.18 * s) * e; P.rleg.z = -0.08 * e; P.lleg.z = 0.08 * e; P.root.s = 1 - 0.13 * e; if (X) { X.dg = e; X.dgT = t; } } }, // чуть отъезжаем, чтобы цифры не выходили за рамку
    // ТАНЦЫ
    disco: { d: 4, f: (t, e, P) => { const w = t * 5.2, ph = Math.floor(w / PI) % 2 ? 1 : -1, s = S(w), a = Math.abs(S(w)); const up = Math.max(0, S(w)), dn = Math.max(0, -S(w)); P.rarm.z = -(0.6 + 2.35 * up) * e; P.larm.z = (0.35 + 0.35 * dn) * e; P.rarm.x = -0.25 * up * e; P.larm.x = 0.1 * e; P.torso.z = (0.2 * S(w - 0.6)) * e; P.torso.y = 0.35 * S(w) * e; P.root.oy = (0.4 + 1.1 * a) * e; P.root.ox = 1.4 * S(w) * e; P.rleg.z = -0.28 * Math.max(0, S(w + PI / 2)) * e; P.lleg.z = 0.28 * Math.max(0, -S(w + PI / 2)) * e; P.head.z = -0.18 * S(w) * e; P.head.y += 0.35 * S(w) * e; } },
    floss: { d: 4, f: (t, e, P) => { const w = t * 9, s = S(w), a = Math.abs(S(w)); P.rarm.z = -(0.55 + 0.28 * s) * e; P.larm.z = (0.55 - 0.28 * s) * e; P.rarm.x = (-1.05 * Math.max(0, s) - 0.15 * Math.max(0, -s)) * e; P.larm.x = (-1.05 * Math.max(0, -s) - 0.15 * Math.max(0, s)) * e; P.root.ox = -2.2 * s * e; P.root.z = 0.18 * s * e; P.torso.z = 0.3 * s * e; P.torso.y = 0.25 * s * e; P.head.z = -0.25 * s * e; P.root.oy = (0.2 + 0.5 * a) * e; P.rleg.z = 0.14 * s * e; P.lleg.z = 0.14 * s * e; P.rleg.x = 0.15 * a * e; P.lleg.x = 0.15 * a * e; } },
    robot: { d: 4, f: (t, e, P) => { const u = t * 3.2, b = Math.floor(u) % 4, k = sm(Math.max(0, Math.min(1, (u - Math.floor(u)) / 0.2))), q = (v, n) => Math.round(v * n) / n,
      R = [-1.57, -0.2, 0.2, -1.57], L = [-0.2, -1.57, -1.57, 0.2], j = (b + 3) % 4, odd = b % 2 ? 1 : -1; // руки «щёлкают» из позы в позу, голова и корпус поворачиваются ступеньками
      P.rarm.x = (R[j] + (R[b] - R[j]) * k) * e; P.larm.x = (L[j] + (L[b] - L[j]) * k) * e; P.rarm.z = -0.45 * e; P.larm.z = 0.45 * e;
      P.head.y += q(0.8 * S(u * PI / 2), 3) * e; P.torso.y = q(0.5 * S(u * PI / 2 + 0.7), 3) * e; P.head.x = 0.08 * odd * e; P.root.oy = 0.5 * (b % 2) * e; P.rleg.x = 0.12 * odd * e; P.lleg.x = -0.12 * odd * e; } },
  };
  // Вид спереди для карточек списка скинов (src — canvas/Image 64x64)
  const drawFront = (ctx, src, slim, k = 5) => {
    ctx.imageSmoothingEnabled = false; ctx.clearRect(0, 0, 16 * k, 32 * k); const a = slim ? 3 : 4, put = (sx, sy, w, h, dx, dy) => ctx.drawImage(src, sx, sy, w, h, dx * k, dy * k, w * k, h * k);
    put(4, 20, 4, 12, 4, 20); put(20, 52, 4, 12, 8, 20); put(20, 20, 8, 12, 4, 8); put(44, 20, a, 12, 4 - a, 8); put(36, 52, a, 12, 12, 8); put(8, 8, 8, 8, 4, 0);
    put(4, 36, 4, 12, 4, 20); put(4, 52, 4, 12, 8, 20); put(20, 36, 8, 12, 4, 8); put(44, 36, a, 12, 4 - a, 8); put(52, 52, a, 12, 12, 8); put(40, 8, 8, 8, 4, 0);
  };
  // Тонкие руки (Alex): последний столбец лицевой грани руки полностью прозрачен
  const isSlim = (d) => { const al = (x, y) => d[(y * 64 + x) * 4 + 3]; if (al(45, 25) < 10 || al(37, 57) < 10) return false; for (const [x, y0] of [[47, 20], [39, 52]]) for (let y = y0; y < y0 + 12; y++) if (al(x, y) > 10) return false; return true; };
  // Перевод рук Classic <-> Slim (игра выбирает модель по UUID, поэтому в пак кладём обе версии скина)
  const convertArms = (d, fromSlim, toSlim) => { const o = Uint8ClampedArray.from(d); if (fromSlim === toSlim) return o;
    for (const [u, v] of [[40, 16], [40, 32], [32, 48], [48, 48]]) {
      for (let y = v; y < v + 16; y++) for (let x = u; x < u + 16; x++) o.fill(0, (y * 64 + x) * 4, (y * 64 + x) * 4 + 4);
      const A = faces(u, v, fromSlim ? 3 : 4, 12, 4), B = faces(u, v, toSlim ? 3 : 4, 12, 4);
      for (const f in A) { const [sx, sy, sw] = A[f], [dx, dy, dw, dh] = B[f]; for (let j = 0; j < dh; j++) for (let i = 0; i < dw; i++) { const s = ((sy + j) * 64 + sx + Math.min(i, sw - 1)) * 4; o.set(d.slice(s, s + 4), ((dy + j) * 64 + dx + i) * 4); } } }
    return o; };
  const VIEWERS = []; let loopOn = false;
  const ensureLoop = () => { if (loopOn) return; loopOn = true; const tick = (now) => { for (const v of VIEWERS) if (v.on) v.frame(now); requestAnimationFrame(tick); }; requestAnimationFrame(tick); };
  function makeViewer(cv, opts = {}) {
    const gl = cv.getContext('webgl', { alpha: true }); if (!gl) return null;
    const sh = (t, s) => { const o = gl.createShader(t); gl.shaderSource(o, s); gl.compileShader(o); return o; }, pr = gl.createProgram();
    gl.attachShader(pr, sh(gl.VERTEX_SHADER, 'attribute vec3 p;attribute vec2 t;attribute float s;uniform mat4 m;varying vec2 vt;varying float vs;void main(){gl_Position=m*vec4(p,1.);vt=t;vs=s;}'));
    gl.attachShader(pr, sh(gl.FRAGMENT_SHADER, 'precision mediump float;varying vec2 vt;varying float vs;uniform sampler2D tx;uniform float ov;void main(){vec4 c=texture2D(tx,vt);if(ov>.5&&c.a<.5)discard;gl_FragColor=vec4(c.rgb*vs,1.);}'));
    gl.linkProgram(pr); gl.useProgram(pr);
    const uM = gl.getUniformLocation(pr, 'm'), uO = gl.getUniformLocation(pr, 'ov'), AL = ['p', 't', 's'].map((k) => gl.getAttribLocation(pr, k));
    const st = { ry: 0.5, rx: 0.2, z: 75, z0: 75, slim: false, ov: true, src: null }, B = [gl.createBuffer(), gl.createBuffer()], tex = gl.createTexture();
    let readyRes = null; const ready = new Promise((r) => { readyRes = r; }); // решается после первой отрисовки персонажа (лаунчер ждёт её перед показом окна)
    // цифры «6» и «7» для эмоции 67: пиксельные глифы на маленькой текстуре, рисуются плоскими квадратами над руками
    const dgTex = gl.createTexture(), dgBuf = gl.createBuffer();
    { const c = document.createElement('canvas'); c.width = 64; c.height = 32; const x = c.getContext('2d'), K = 3, G = { 0: ['..XX.', '.X...', 'X....', 'XXXX.', 'X...X', 'X...X', '.XXX.'], 1: ['XXXXX', '....X', '...X.', '..X..', '.X...', '.X...', '.X...'] };
      for (const g of [0, 1]) { const ox = g * 32 + 6, oy = 3; for (const [dx, dy] of [[-2, 0], [2, 0], [0, -2], [0, 2], [-2, -2], [2, -2], [-2, 2], [2, 2]]) { x.fillStyle = '#3b1472'; G[g].forEach((row, j) => [...row].forEach((ch, i) => { if (ch === 'X') x.fillRect(ox + i * K + dx, oy + j * K + dy, K, K); })); }
        G[g].forEach((row, j) => [...row].forEach((ch, i) => { if (ch === 'X') { x.fillStyle = '#fff'; x.fillRect(ox + i * K, oy + j * K, K, K); x.fillStyle = '#e0c8ff'; x.fillRect(ox + i * K, oy + j * K + K - 1, K, 1); } })); }
      gl.bindTexture(gl.TEXTURE_2D, dgTex); gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, c);
      [[gl.TEXTURE_MIN_FILTER, gl.NEAREST], [gl.TEXTURE_MAG_FILTER, gl.NEAREST], [gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE], [gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE]].forEach(([p, v]) => gl.texParameteri(gl.TEXTURE_2D, p, v));
      const h = 3.9, q = []; for (const g of [0, 1]) { const u0 = g * 0.5, u1 = u0 + 0.5, V = [[-h, -h, u0, 1], [h, -h, u1, 1], [h, h, u1, 0], [-h, h, u0, 0]]; for (const i of [0, 1, 2, 0, 2, 3]) q.push(V[i][0], V[i][1], 0, V[i][2], V[i][3], 1); }
      gl.bindBuffer(gl.ARRAY_BUFFER, dgBuf); gl.bufferData(gl.ARRAY_BUFFER, new Float32Array(q), gl.STATIC_DRAW); }
    const rebuild = () => [false, true].forEach((o, i) => { gl.bindBuffer(gl.ARRAY_BUFFER, B[i]); gl.bufferData(gl.ARRAY_BUFFER, build(st.slim, o), gl.STATIC_DRAW); });
    const upload = () => { gl.bindTexture(gl.TEXTURE_2D, tex); gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, st.src);
      [[gl.TEXTURE_MIN_FILTER, gl.NEAREST], [gl.TEXTURE_MAG_FILTER, gl.NEAREST], [gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE], [gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE]].forEach(([a, b]) => gl.texParameteri(gl.TEXTURE_2D, a, b)); };
    let clock = 0, lastT = performance.now(), nextEm = 3, em = null, lastEm = null, job = null; const fol = { x: 0, y: 0 }, tgt = { x: 0, y: 0 }, fx = { s: 1, ry: 0 }, X = { dg: 0, dgT: 0 };
    const start = (name) => { const ns = Object.keys(EM); let n = name; if (!n) do n = ns[(Math.random() * ns.length) | 0]; while (n === lastEm && ns.length > 1); lastEm = n; em = { def: EM[n], t0: clock }; nextEm = clock + 7; };
    const draw = (P) => {
      gl.viewport(0, 0, cv.width, cv.height); gl.clearColor(0, 0, 0, 0); gl.enable(gl.DEPTH_TEST); gl.clear(gl.COLOR_BUFFER_BIT | gl.DEPTH_BUFFER_BIT); gl.bindTexture(gl.TEXTURE_2D, tex);
      const R = P.root, V = mul(mul(PJ(cv.width / cv.height, 1, 500), TR(0, 0, -st.z)), RX(st.rx)), root = mul(mul(TR(R.ox, R.oy, 0), mul(RZ(R.z), mul(RY(R.y + st.ry + fx.ry), RX(R.x)))), mul(SC(R.s * fx.s), TR(0, -16, 0)));
      const VR = mul(V, root), pv = pivots(st.slim), TM = partMat([0, 12, 0], P.torso), PM = {}; // PM — итоговые матрицы частей; голова, тело и руки сидят на торсе, который наклоняется вокруг бёдер
      NAMES.forEach((n) => { const m = partMat(pv[n], P[n]); PM[n] = n === 'rleg' || n === 'lleg' ? m : mul(TM, m); });
      for (let l = 0; l < 2; l++) { if (l && !st.ov) continue; gl.bindBuffer(gl.ARRAY_BUFFER, B[l]); gl.uniform1f(uO, l);
        [[3, 0], [2, 12], [1, 20]].forEach(([c, o], i) => { gl.enableVertexAttribArray(AL[i]); gl.vertexAttribPointer(AL[i], c, gl.FLOAT, false, 24, o); });
        NAMES.forEach((n, i) => { gl.uniformMatrix4fv(uM, false, mul(VR, PM[n])); gl.drawArrays(gl.TRIANGLES, i * 36, 36); }); }
      if (X.dg > 0.02) { // цифры 6 и 7 над руками: следуют за кистями, «подпрыгивают» в такт
        gl.bindTexture(gl.TEXTURE_2D, dgTex); gl.bindBuffer(gl.ARRAY_BUFFER, dgBuf); gl.uniform1f(uO, 1); [[3, 0], [2, 12], [1, 20]].forEach(([c, o], i) => { gl.enableVertexAttribArray(AL[i]); gl.vertexAttribPointer(AL[i], c, gl.FLOAT, false, 24, o); });
        const a = st.slim ? 3 : 4, w = X.dgT * 8.2;
        [['rarm', -(4 + a / 2), 0, S(w)], ['larm', 4 + a / 2, 1, -S(w)]].forEach(([n, cx, g, ph]) => {
          const h = ap(root, ap(PM[n], [cx, 12, 0])), pop = 0.78 + 0.32 * Math.max(0, ph), sc = Math.max(0.01, X.dg * pop * (1 + 0.12 * S(PI * 0.5 * X.dg)));
          gl.uniformMatrix4fv(uM, false, mul(mul(mul(V, TR(h[0] + (g ? 3.2 : -3.2), h[1] + 6.4 + 1.3 * ph, h[2] + 9)), RZ((g ? -1 : 1) * 0.16 * ph)), SC(sc))); gl.drawArrays(gl.TRIANGLES, g * 6, 6); });
        gl.bindTexture(gl.TEXTURE_2D, tex); }
    };
    const frame = (now) => {
      const dt = Math.min(0.05, (now - lastT) / 1000); lastT = now; clock += dt;
      const dpr = Math.min(2, window.devicePixelRatio || 1), w = Math.round(cv.clientWidth * dpr), h = Math.round(cv.clientHeight * dpr); if (w < 24 || h < 24 || !st.src) return; // панель свёрнута (каталог скинов) или ещё анимируется из нуля — не трогаем размер холста, иначе он «запоминал» крошечный размер
      if (cv.width !== w || cv.height !== h) { cv.width = w; cv.height = h; }
      const k = Math.min(1, dt * 7); fol.x += (tgt.x - fol.x) * k; fol.y += (tgt.y - fol.y) * k;
      X.dg = 0; const P = newPose(); P.rarm.z = -0.07 - 0.03 * S(clock * 1.6); P.larm.z = 0.07 + 0.03 * S(clock * 1.6 + 1); P.rarm.x = 0.04 * S(clock * 1.1); P.larm.x = -0.04 * S(clock * 1.1); P.root.oy = 0.12 * S(clock * 2.2);
      if (opts.follow) { P.root.y = fol.x * 0.6; P.head.y = fol.x * 0.5; P.head.x = fol.y * 0.45; } // тело и голова плавно следят за мышью
      if (opts.auto && !em && clock >= nextEm) start();
      if (em) { const t = clock - em.t0, d = em.def.d; if (t >= d) em = null; else em.def.f(t, sm(Math.max(0, Math.min(1, Math.min(t, d - t) / 0.35))), P, X); }
      if (job) { const t = clock - job.t0;
        if (t < 0.28) { const u = sm(t / 0.28); fx.s = Math.max(0.01, 1 - u); fx.ry = u * PI * job.dir; }
        else { if (!job.done) { job.done = true; set({ src: job.src, slim: job.slim }); } const u = Math.min(1, (t - 0.28) / 0.45); fx.s = Math.max(0.01, sm(u) * (1 + 0.14 * S(PI * u))); fx.ry = (1 - sm(u)) * -PI * job.dir; if (u >= 1) { job = null; fx.s = 1; fx.ry = 0; } } }
      draw(P); if (readyRes) { readyRes(true); readyRes = null; }
    };
    const set = (o) => { Object.assign(st, o); if ('z' in o) st.z0 = o.z; if ('slim' in o) rebuild(); if (o.src) upload(); };
    rebuild(); let drag = null;
    cv.style.touchAction = 'none'; cv.style.webkitAppRegion = 'no-drag';
    let moved = 0; cv.onpointerdown = (e) => { drag = [e.clientX, e.clientY]; moved = 0; cv.setPointerCapture(e.pointerId); };
    cv.onpointermove = (e) => { if (!drag) return; moved += Math.abs(e.clientX - drag[0]) + Math.abs(e.clientY - drag[1]); st.ry += (e.clientX - drag[0]) * 0.012; if (!opts.lockPitch) st.rx = Math.max(-0.4, Math.min(1.2, st.rx + (e.clientY - drag[1]) * 0.012)); drag = [e.clientX, e.clientY]; };
    cv.onpointerup = () => { if (drag && moved < 6 && opts.auto && !em && !job) start(); drag = null; }; // клик по персонажу — случайная эмоция
    cv.onwheel = (e) => { e.preventDefault(); st.z = Math.max(st.z0 * 0.72, Math.min(st.z0 * 1.8, st.z * (e.deltaY > 0 ? 1.08 : 0.93))); }; // колёсико — приближение, но не дальше 0.72 от обычного (раньше можно было влезть внутрь модели)
    cv.ondblclick = () => { st.z = st.z0; st.rx = 0.2; }; // двойной щелчок — вернуть масштаб
    const v = { on: true, ready, frame, set, look: (x, y) => { tgt.x = x; tgt.y = y; }, emote: start, change: (src, slim, dir) => { if (!st.src) return set({ src, slim }); job = { t0: clock, src, slim, dir: dir || 1, done: false }; } };
    VIEWERS.push(v); ensureLoop(); return v;
  }
  // Общий отрисовщик для каталога скинов: ОДИН WebGL-контекст рисует много карточек по очереди и копирует кадр в их 2D-холсты
  // (десятки отдельных WebGL-контекстов браузер не потянет). Поза задаётся снаружи: o = { yaw, headYaw, headPitch, t, z, rx }.
  function makeSheet() {
    const cv = document.createElement('canvas'); cv.width = 240; cv.height = 320;
    const gl = cv.getContext('webgl', { alpha: true }); if (!gl) return null;
    const sh = (t, s) => { const o = gl.createShader(t); gl.shaderSource(o, s); gl.compileShader(o); return o; }, pr = gl.createProgram();
    gl.attachShader(pr, sh(gl.VERTEX_SHADER, 'attribute vec3 p;attribute vec2 t;attribute float s;uniform mat4 m;varying vec2 vt;varying float vs;void main(){gl_Position=m*vec4(p,1.);vt=t;vs=s;}'));
    gl.attachShader(pr, sh(gl.FRAGMENT_SHADER, 'precision mediump float;varying vec2 vt;varying float vs;uniform sampler2D tx;uniform float ov;void main(){vec4 c=texture2D(tx,vt);if(ov>.5&&c.a<.5)discard;gl_FragColor=vec4(c.rgb*vs,1.);}'));
    gl.linkProgram(pr); gl.useProgram(pr);
    const uM = gl.getUniformLocation(pr, 'm'), uO = gl.getUniformLocation(pr, 'ov'), AL = ['p', 't', 's'].map((k) => gl.getAttribLocation(pr, k));
    const B = {}, T = new Map(), buf = (slim, ov) => { const k = (slim ? 's' : 'c') + (ov ? 1 : 0); if (!B[k]) { B[k] = gl.createBuffer(); gl.bindBuffer(gl.ARRAY_BUFFER, B[k]); gl.bufferData(gl.ARRAY_BUFFER, build(slim, ov), gl.STATIC_DRAW); } return B[k]; };
    const PV = { false: pivots(false), true: pivots(true) };
    const setTex = (id, src) => { let t = T.get(id); if (!t) { t = gl.createTexture(); T.set(id, t); } gl.bindTexture(gl.TEXTURE_2D, t); gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, src);
      [[gl.TEXTURE_MIN_FILTER, gl.NEAREST], [gl.TEXTURE_MAG_FILTER, gl.NEAREST], [gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE], [gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE]].forEach(([a, b]) => gl.texParameteri(gl.TEXTURE_2D, a, b)); };
    const draw = (ctx, w, h, id, slim, o = {}) => {
      const t = T.get(id); if (!t || !w || !h) return false;
      if (cv.width !== w || cv.height !== h) { cv.width = w; cv.height = h; }
      gl.viewport(0, 0, w, h); gl.clearColor(0, 0, 0, 0); gl.enable(gl.DEPTH_TEST); gl.clear(gl.COLOR_BUFFER_BIT | gl.DEPTH_BUFFER_BIT); gl.bindTexture(gl.TEXTURE_2D, t);
      const tm = o.t || 0, P = newPose(); P.rarm.z = -0.07 - 0.03 * S(tm * 1.6); P.larm.z = 0.07 + 0.03 * S(tm * 1.6 + 1); P.rarm.x = 0.04 * S(tm * 1.1); P.larm.x = -0.04 * S(tm * 1.1); P.root.oy = 0.12 * S(tm * 2.2);
      P.head.y = o.headYaw || 0; P.head.x = o.headPitch || 0; P.rarm.x += o.armSwing || 0; P.larm.x -= o.armSwing || 0;
      const V = mul(mul(PJ(w / h, 1, 500), TR(0, 0, -(o.z || 54))), RX(o.rx ?? 0.14)), root = mul(mul(TR(0, P.root.oy, 0), RY(o.yaw || 0)), TR(0, -16, 0)), VR = mul(V, root), pv = PV[!!slim];
      for (let l = 0; l < 2; l++) { gl.bindBuffer(gl.ARRAY_BUFFER, buf(!!slim, !!l)); gl.uniform1f(uO, l);
        [[3, 0], [2, 12], [1, 20]].forEach(([c, off], i) => { gl.enableVertexAttribArray(AL[i]); gl.vertexAttribPointer(AL[i], c, gl.FLOAT, false, 24, off); });
        NAMES.forEach((n, i) => { gl.uniformMatrix4fv(uM, false, mul(VR, partMat(pv[n], P[n]))); gl.drawArrays(gl.TRIANGLES, i * 36, 36); }); }
      ctx.clearRect(0, 0, w, h); ctx.drawImage(cv, 0, 0, w, h); return true;
    };
    return { setTex, has: (id) => T.has(id), draw, clear: () => { for (const t of T.values()) gl.deleteTexture(t); T.clear(); } };
  }
  (typeof window !== 'undefined' ? window : globalThis).Skin = { makeViewer, makeSheet, blank, steve, drawFront, isSlim, convertArms, legacy, photo, _t: { PARTS, faces, build, EM, newPose } };
})();
