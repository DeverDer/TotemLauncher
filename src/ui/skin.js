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
  const newPose = () => ({ root: { x: 0, y: 0, z: 0, s: 1, ox: 0, oy: 0 }, head: Z3(), body: Z3(), rarm: Z3(), larm: Z3(), rleg: Z3(), lleg: Z3() });
  const pivots = (slim) => { const a = slim ? 3 : 4; return { head: [0, 24, 0], body: [0, 18, 0], rarm: [-4 - a / 2, 22, 0], larm: [4 + a / 2, 22, 0], rleg: [-2, 12, 0], lleg: [2, 12, 0] }; };
  const partMat = (pv, r) => mul(mul(TR(pv[0], pv[1], pv[2]), mul(RZ(r.z), mul(RY(r.y), RX(r.x)))), TR(-pv[0], -pv[1], -pv[2]));
  const sm = (a) => a * a * (3 - 2 * a), S = Math.sin, PI = Math.PI;
  // Эмоции: d — длительность в секундах (не больше 4), f(t, e, P): e — плавное включение/выключение
  const EM = {
    wave: { d: 3.2, f: (t, e, P) => { P.rarm.z = -(2.5 + 0.3 * S(t * 10)) * e; P.head.z = 0.12 * e; P.head.y += 0.25 * e; } },
    jacks: { d: 3.6, f: (t, e, P) => { const s = (S(t * 6.5 - PI / 2) + 1) / 2; P.rarm.z = -(0.15 + 2.6 * s) * e; P.larm.z = (0.15 + 2.6 * s) * e; P.rleg.z = -0.4 * s * e; P.lleg.z = 0.4 * s * e; P.root.oy = 1.8 * s * e; } },
    salto: { d: 1.9, f: (t, e, P) => { const p = Math.min(1, t / 1.9), u = S(PI * p); P.root.x = -2 * PI * sm(p); P.root.oy = 9 * u; P.rleg.x = P.lleg.x = -1.1 * u; P.rarm.x = P.larm.x = -1.3 * u; } },
    dance: { d: 4, f: (t, e, P) => { const s = S(t * 6.4); P.root.z = 0.12 * s * e; P.root.oy = 0.9 * Math.abs(s) * e; P.rarm.z = -(1.5 + s) * e; P.larm.z = (1.5 - s) * e; P.rleg.x = 0.5 * s * e; P.lleg.x = -0.5 * s * e; P.head.z = -0.2 * s * e; P.head.y += 0.3 * S(t * 3.2) * e; } },
    spin: { d: 2.2, f: (t, e, P) => { P.root.y += 2 * PI * sm(Math.min(1, t / 2.2)); P.rarm.z = -1.4 * e; P.larm.z = 1.4 * e; P.root.oy = 1.2 * e; } },
    look: { d: 3.6, f: (t, e, P) => { P.head.y += 0.9 * S(t * 2.1) * e; P.head.x += 0.25 * S(t * 4.2) * e; } },
    punch: { d: 2.6, f: (t, e, P) => { const a = Math.abs(S(t * 4.5)), b = Math.abs(Math.cos(t * 4.5)); P.rarm.x = -1.6 * a * e; P.larm.x = -1.6 * b * e; P.root.y += 0.35 * S(t * 4.5) * e; } },
    run: { d: 3.4, f: (t, e, P) => { const s = S(t * 11); P.rarm.x = 0.95 * s * e; P.larm.x = -0.95 * s * e; P.rleg.x = -0.95 * s * e; P.lleg.x = 0.95 * s * e; P.root.x = 0.14 * e; P.root.oy = 0.7 * Math.abs(s) * e; } },
    cheer: { d: 2.4, f: (t, e, P) => { P.rarm.z = -2.9 * e; P.larm.z = 2.9 * e; P.root.oy = 3 * Math.abs(S(t * 5.2)) * e; P.head.x -= 0.3 * e; } },
    bow: { d: 2.6, f: (t, e, P) => { P.root.x = 0.5 * e; P.rleg.x = P.lleg.x = -0.5 * e; P.head.x += 0.15 * e; P.root.oy = -0.5 * e; } },
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
    const st = { ry: 0.5, rx: 0.2, z: 75, slim: false, ov: true, src: null }, B = [gl.createBuffer(), gl.createBuffer()], tex = gl.createTexture();
    const rebuild = () => [false, true].forEach((o, i) => { gl.bindBuffer(gl.ARRAY_BUFFER, B[i]); gl.bufferData(gl.ARRAY_BUFFER, build(st.slim, o), gl.STATIC_DRAW); });
    const upload = () => { gl.bindTexture(gl.TEXTURE_2D, tex); gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, st.src);
      [[gl.TEXTURE_MIN_FILTER, gl.NEAREST], [gl.TEXTURE_MAG_FILTER, gl.NEAREST], [gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE], [gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE]].forEach(([a, b]) => gl.texParameteri(gl.TEXTURE_2D, a, b)); };
    let clock = 0, lastT = performance.now(), nextEm = 3, em = null, lastEm = null, job = null; const fol = { x: 0, y: 0 }, tgt = { x: 0, y: 0 }, fx = { s: 1, ry: 0 };
    const start = (name) => { const ns = Object.keys(EM); let n = name; if (!n) do n = ns[(Math.random() * ns.length) | 0]; while (n === lastEm && ns.length > 1); lastEm = n; em = { def: EM[n], t0: clock }; nextEm = clock + 7; };
    const draw = (P) => {
      gl.viewport(0, 0, cv.width, cv.height); gl.clearColor(0, 0, 0, 0); gl.enable(gl.DEPTH_TEST); gl.clear(gl.COLOR_BUFFER_BIT | gl.DEPTH_BUFFER_BIT); gl.bindTexture(gl.TEXTURE_2D, tex);
      const R = P.root, V = mul(mul(PJ(cv.width / cv.height, 1, 500), TR(0, 0, -st.z)), RX(st.rx)), root = mul(mul(TR(R.ox, R.oy, 0), mul(RZ(R.z), mul(RY(R.y + st.ry + fx.ry), RX(R.x)))), mul(SC(R.s * fx.s), TR(0, -16, 0)));
      const VR = mul(V, root), pv = pivots(st.slim);
      for (let l = 0; l < 2; l++) { if (l && !st.ov) continue; gl.bindBuffer(gl.ARRAY_BUFFER, B[l]); gl.uniform1f(uO, l);
        [[3, 0], [2, 12], [1, 20]].forEach(([c, o], i) => { gl.enableVertexAttribArray(AL[i]); gl.vertexAttribPointer(AL[i], c, gl.FLOAT, false, 24, o); });
        NAMES.forEach((n, i) => { gl.uniformMatrix4fv(uM, false, mul(VR, partMat(pv[n], P[n]))); gl.drawArrays(gl.TRIANGLES, i * 36, 36); }); }
    };
    const frame = (now) => {
      const dt = Math.min(0.05, (now - lastT) / 1000); lastT = now; clock += dt;
      const dpr = Math.min(2, window.devicePixelRatio || 1), w = Math.round(cv.clientWidth * dpr), h = Math.round(cv.clientHeight * dpr); if (!w || !h || !st.src) return;
      if (cv.width !== w || cv.height !== h) { cv.width = w; cv.height = h; }
      const k = Math.min(1, dt * 7); fol.x += (tgt.x - fol.x) * k; fol.y += (tgt.y - fol.y) * k;
      const P = newPose(); P.rarm.z = -0.07 - 0.03 * S(clock * 1.6); P.larm.z = 0.07 + 0.03 * S(clock * 1.6 + 1); P.rarm.x = 0.04 * S(clock * 1.1); P.larm.x = -0.04 * S(clock * 1.1); P.root.oy = 0.12 * S(clock * 2.2);
      if (opts.follow) { P.root.y = fol.x * 0.6; P.head.y = fol.x * 0.5; P.head.x = fol.y * 0.45; } // тело и голова плавно следят за мышью
      if (opts.auto && !em && clock >= nextEm) start();
      if (em) { const t = clock - em.t0, d = em.def.d; if (t >= d) em = null; else em.def.f(t, sm(Math.max(0, Math.min(1, Math.min(t, d - t) / 0.35))), P); }
      if (job) { const t = clock - job.t0;
        if (t < 0.28) { const u = sm(t / 0.28); fx.s = Math.max(0.01, 1 - u); fx.ry = u * PI * job.dir; }
        else { if (!job.done) { job.done = true; set({ src: job.src, slim: job.slim }); } const u = Math.min(1, (t - 0.28) / 0.45); fx.s = Math.max(0.01, sm(u) * (1 + 0.14 * S(PI * u))); fx.ry = (1 - sm(u)) * -PI * job.dir; if (u >= 1) { job = null; fx.s = 1; fx.ry = 0; } } }
      draw(P);
    };
    const set = (o) => { Object.assign(st, o); if ('slim' in o) rebuild(); if (o.src) upload(); };
    rebuild(); let drag = null;
    cv.style.touchAction = 'none'; cv.style.webkitAppRegion = 'no-drag';
    cv.onpointerdown = (e) => { drag = [e.clientX, e.clientY]; cv.setPointerCapture(e.pointerId); };
    cv.onpointermove = (e) => { if (!drag) return; st.ry += (e.clientX - drag[0]) * 0.012; if (!opts.lockPitch) st.rx = Math.max(-0.4, Math.min(1.2, st.rx + (e.clientY - drag[1]) * 0.012)); drag = [e.clientX, e.clientY]; };
    cv.onpointerup = () => { drag = null; };
    cv.onwheel = (e) => { e.preventDefault(); st.z = Math.max(35, Math.min(180, st.z * (e.deltaY > 0 ? 1.1 : 0.9))); };
    const v = { on: true, frame, set, look: (x, y) => { tgt.x = x; tgt.y = y; }, emote: start, change: (src, slim, dir) => { if (!st.src) return set({ src, slim }); job = { t0: clock, src, slim, dir: dir || 1, done: false }; } };
    VIEWERS.push(v); ensureLoop(); return v;
  }
  (typeof window !== 'undefined' ? window : globalThis).Skin = { makeViewer, blank, steve, drawFront, isSlim, convertArms, legacy, photo, _t: { PARTS, faces, build, EM, newPose } };
})();
