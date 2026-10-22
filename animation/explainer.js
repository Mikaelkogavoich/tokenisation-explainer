// One building, one token: a deterministic SVG animation.
// renderAt(t) draws the frame at time t (seconds). Every time used here comes from
// DATA.timeline (the voiceover) and every word from DATA.script, so the video cannot drift from the script.
(function () {
  const D = window.DATA;
  const W = 1920, H = 1080;
  const C = {
    ink: '#343740', muted: '#5e6270', soft: '#8d94a6', line: '#d8d5cf', line2: '#e2ded7',
    band: '#f3f1ec', white: '#ffffff', mint: '#a2ffc8', mint2: '#54f9a1', mintInk: '#20321f',
    navy: '#323b70', blue: '#c9dbf1', teal: '#009c9c', reject: '#b5523b', rejectBg: '#f6e3dd', grey: '#eff0f2',
  };
  const SANS = 'Montserrat', MONO = 'Plex Mono';
  const params = new URLSearchParams(location.search);
  let SUBS = params.get('subs') !== '0';

  // ---------- maths ----------
  const clamp = (v, a = 0, b = 1) => Math.min(b, Math.max(a, v));
  const lerp = (a, b, k) => a + (b - a) * k;
  const p = (t, a, d) => clamp((t - a) / d);
  const eo = (k) => 1 - Math.pow(1 - k, 3);
  const eio = (k) => (k < 0.5 ? 4 * k * k * k : 1 - Math.pow(-2 * k + 2, 3) / 2);
  const back = (k) => { const c = 1.4; return 1 + (c + 1) * Math.pow(k - 1, 3) + c * Math.pow(k - 1, 2); };
  const P = (t, a, d, e = eo) => e(p(t, a, d));

  // ---------- text ----------
  const esc = (s) => String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
  const ctx = document.createElement('canvas').getContext('2d');
  function tw(s, size, weight = 500, fam = SANS) { ctx.font = `${weight} ${size}px "${fam}"`; return ctx.measureText(s).width; }
  function text(x, y, s, o = {}) {
    const size = o.size || 32, weight = o.weight || 500, fam = o.mono ? MONO : SANS;
    const ls = o.ls != null ? o.ls : (o.mono ? 0.08 * size : -0.01 * size);
    return `<text x="${x}" y="${y}" font-family="${fam}" font-size="${size}" font-weight="${weight}" fill="${o.fill || C.ink}"` +
      ` text-anchor="${o.anchor || 'start'}" letter-spacing="${ls}" opacity="${o.op == null ? 1 : o.op}">${esc(s)}</text>`;
  }
  function wrap(s, size, weight, maxW) {
    const words = s.split(' '); const lines = []; let cur = '';
    for (const w of words) { const n = cur ? cur + ' ' + w : w; if (tw(n, size, weight) > maxW && cur) { lines.push(cur); cur = w; } else cur = n; }
    if (cur) lines.push(cur); return lines;
  }
  // Two line subtitles split near the middle so the lines are balanced.
  function balance(s, size, weight, maxW) {
    if (tw(s, size, weight) <= maxW) return [s];
    const words = s.split(' '); let best = null;
    for (let i = 1; i < words.length; i++) {
      const a = words.slice(0, i).join(' '), b = words.slice(i).join(' ');
      const m = Math.max(tw(a, size, weight), tw(b, size, weight));
      if (!best || m < best.m) best = { m, l: [a, b] };
    }
    return best.l;
  }

  // ---------- shapes ----------
  const g = (inner, o = {}) => {
    const tr = [];
    if (o.x || o.y) tr.push(`translate(${o.x || 0} ${o.y || 0})`);
    if (o.s != null && o.s !== 1) tr.push(`translate(${o.cx || 0} ${o.cy || 0}) scale(${o.s}) translate(${-(o.cx || 0)} ${-(o.cy || 0)})`);
    return `<g${tr.length ? ` transform="${tr.join(' ')}"` : ''}${o.op != null ? ` opacity="${clamp(o.op)}"` : ''}>${inner}</g>`;
  };
  const rect = (x, y, w, h, o = {}) => `<rect x="${x}" y="${y}" width="${Math.max(0, w)}" height="${Math.max(0, h)}" rx="${o.r == null ? 0 : o.r}" fill="${o.fill || 'none'}"` +
    `${o.stroke ? ` stroke="${o.stroke}" stroke-width="${o.sw || 2}"` : ''}${o.filter ? ` filter="url(#${o.filter})"` : ''}${o.op != null ? ` opacity="${o.op}"` : ''}/>`;
  const circle = (cx, cy, r, o = {}) => `<circle cx="${cx}" cy="${cy}" r="${Math.max(0, r)}" fill="${o.fill || 'none'}"` +
    `${o.stroke ? ` stroke="${o.stroke}" stroke-width="${o.sw || 2}"` : ''}${o.op != null ? ` opacity="${o.op}"` : ''}${o.dash ? ` stroke-dasharray="${o.dash}"` : ''}/>`;
  const line = (x1, y1, x2, y2, o = {}) => `<line x1="${x1}" y1="${y1}" x2="${x2}" y2="${y2}" stroke="${o.stroke || C.ink}" stroke-width="${o.sw || 2}" stroke-linecap="round"${o.dash ? ` stroke-dasharray="${o.dash}"` : ''}${o.op != null ? ` opacity="${o.op}"` : ''}/>`;
  // A path revealed by drawing along its length (k from 0 to 1).
  const drawPath = (d, k, o = {}) => `<path d="${d}" pathLength="1" stroke-dasharray="1 1" stroke-dashoffset="${1 - clamp(k)}" fill="${o.fill || 'none'}" stroke="${o.stroke || C.ink}" stroke-width="${o.sw || 3}" stroke-linecap="round" stroke-linejoin="round"${o.op != null ? ` opacity="${o.op}"` : ''}/>`;

  function card(x, y, w, h, o = {}) {
    return rect(x, y, w, h, { r: o.r == null ? 18 : o.r, fill: o.fill || C.white, filter: o.flat ? null : 'shadow' }) +
      rect(x + 0.5, y + 0.5, w - 1, h - 1, { r: o.r == null ? 18 : o.r, stroke: o.stroke || C.line2, sw: 1.5 });
  }
  function chip(x, y, label, o = {}) {
    const size = o.size || 24, weight = o.weight || 600, padX = o.padX || 18, h = o.h || size * 1.9;
    const icon = o.icon ? h * 0.62 : 0;
    const w = tw(label, size, weight, o.mono ? MONO : SANS) + (o.mono ? label.length * 0.08 * size : 0) + padX * 2 + (icon ? icon + 8 : 0);
    let x0 = x; if (o.anchor === 'middle') x0 = x - w / 2; else if (o.anchor === 'end') x0 = x - w;
    let s = rect(x0, y - h / 2, w, h, { r: h / 2, fill: o.bg || C.mint, stroke: o.border, sw: 1.5 });
    if (o.icon === 'tick') s += tickMark(x0 + padX + icon / 2, y, icon * 0.5, 1, o.fg || C.mintInk, 3);
    if (o.icon === 'cross') s += crossMark(x0 + padX + icon / 2, y, icon * 0.42, 1, o.fg || C.reject, 3);
    if (o.icon === 'dot') s += circle(x0 + padX + icon / 2, y, icon * 0.22, { fill: o.fg || C.mintInk });
    s += text(x0 + padX + (icon ? icon + 8 : 0), y + size * 0.36, label, { size, weight, fill: o.fg || C.mintInk, mono: o.mono });
    return { svg: g(s, { op: o.op }), w, x0 };
  }
  function tickMark(cx, cy, s, k, col, sw) {
    return drawPath(`M${cx - s * 0.5} ${cy + s * 0.02} L${cx - s * 0.12} ${cy + s * 0.38} L${cx + s * 0.55} ${cy - s * 0.38}`, k, { stroke: col, sw: sw || 4 });
  }
  function crossMark(cx, cy, s, k, col, sw) {
    return drawPath(`M${cx - s * 0.5} ${cy - s * 0.5} L${cx + s * 0.5} ${cy + s * 0.5}`, clamp(k * 2), { stroke: col, sw: sw || 4 }) +
      drawPath(`M${cx + s * 0.5} ${cy - s * 0.5} L${cx - s * 0.5} ${cy + s * 0.5}`, clamp(k * 2 - 1), { stroke: col, sw: sw || 4 });
  }
  function checkDot(cx, cy, r, k) {
    // empty ring, then a mint disc with a tick drawn in
    const f = P(k, 0, 0.35);
    return circle(cx, cy, r, { fill: C.white, stroke: C.line, sw: 2 }) +
      circle(cx, cy, r * f, { fill: C.mint }) + circle(cx, cy, r, { stroke: f > 0 ? C.mintInk : 'none', sw: 2, op: f }) +
      tickMark(cx, cy, r * 1.0, p(k, 0.3, 0.7), C.mintInk, 3.2);
  }
  // A token: round, mint, with a small building glyph. k scales it in.
  function token(cx, cy, r, o = {}) {
    const k = o.k == null ? 1 : o.k; if (k <= 0) return '';
    const s = r * back(clamp(k));
    const fill = o.fill || C.mint;
    let in_ = circle(cx, cy, s, { fill, stroke: C.ink, sw: Math.max(1.5, r * 0.07) }) +
      circle(cx, cy, s * 0.74, { stroke: C.ink, sw: Math.max(1, r * 0.035), op: 0.5 });
    if (!o.plain) {
      const bw = s * 0.5, bh = s * 0.62, bx = cx - bw / 2, by = cy - bh / 2 + s * 0.04;
      in_ += rect(bx, by, bw, bh, { stroke: C.ink, sw: Math.max(1.2, r * 0.045), r: 1 });
      for (let i = 0; i < 3; i++) for (let j = 0; j < 2; j++)
        in_ += rect(bx + bw * (0.2 + j * 0.38), by + bh * (0.14 + i * 0.27), bw * 0.22, bh * 0.13, { fill: C.ink });
    }
    return g(in_, { op: o.op == null ? clamp(k * 3) : o.op * clamp(k * 3) });
  }
  // The office building, top left at (x, y). draw reveals the outline; mint tints the facade.
  function building(x, y, w, h, o = {}) {
    const k = o.draw == null ? 1 : o.draw, mint = o.mint || 0, sw = o.sw || 3.5;
    const fl = 7, cols = 4, top = h * 0.07, base = h * 0.1;
    const facade = lerp(0, 1, P(k, 0.15, 0.4));
    let s = '';
    s += rect(x, y + top, w, h - top, { fill: mint > 0 ? `rgba(162,255,200,${0.55 * mint})` : C.white, op: facade });
    s += drawPath(`M${x} ${y + h} L${x} ${y + top} L${x + w} ${y + top} L${x + w} ${y + h}`, P(k, 0, 0.35), { sw, stroke: C.ink });
    s += drawPath(`M${x + w * 0.08} ${y + top} L${x + w * 0.08} ${y} L${x + w * 0.92} ${y} L${x + w * 0.92} ${y + top}`, P(k, 0.2, 0.2), { sw, stroke: C.ink });
    const gx = x + w * 0.12, gw = w * 0.76, gy = y + top + h * 0.06, gh = h - top - base - h * 0.08;
    const cw = gw / cols, rh = gh / fl;
    for (let r = 0; r < fl; r++) for (let c = 0; c < cols; c++) {
      const i = r * cols + c, kk = P(k, 0.35 + (i / (fl * cols)) * 0.45, 0.18);
      if (kk <= 0) continue;
      const lit = o.lit && o.lit(r, c);
      s += rect(gx + c * cw + cw * 0.14, gy + r * rh + rh * 0.18, cw * 0.72 * kk, rh * 0.58, { fill: lit ? C.mint2 : (mint > 0.5 ? C.white : C.blue), stroke: C.ink, sw: 1.6, r: 2 });
    }
    const dk = P(k, 0.8, 0.2);
    s += rect(x + w * 0.38, y + h - base - h * 0.02, w * 0.24, (base + h * 0.02) * dk, { fill: C.ink, r: 3 });
    return g(s, { op: o.op });
  }
  function wallet(cx, cy, o = {}) {
    const w = o.w || 210, h = o.h || 120, x = cx - w / 2, y = cy - h / 2, v = o.verified || 0;
    let s = card(x, y, w, h, { r: 16, fill: v > 0.5 ? '#f2fff7' : C.white, stroke: v > 0.5 ? C.mint2 : C.line2 });
    s += rect(x + 22, y + 26, 46, 34, { r: 7, stroke: C.ink, sw: 2.4, fill: C.white });
    s += rect(x + 48, y + 36, 20, 14, { r: 4, stroke: C.ink, sw: 2, fill: v > 0.5 ? C.mint : C.grey });
    s += text(x + 84, y + 50, o.label || 'Wallet', { size: 24, weight: 600 });
    const st = v > 0.5 ? 'Verified' : (o.status || 'Not verified');
    s += chip(x + 22, y + h - 30, st, { size: 17, h: 30, padX: 12, bg: v > 0.5 ? C.mint : C.grey, fg: v > 0.5 ? C.mintInk : C.muted, icon: v > 0.5 ? 'tick' : 'dot' }).svg;
    return g(s, { op: o.op });
  }
  function logo(name, x, y, h, o = {}) {
    const L = D.logos[name]; const vb = L.viewBox.split(/[ ,]+/).map(Number);
    const sc = h / vb[3];
    return `<g transform="translate(${x} ${y}) scale(${sc}) translate(${-vb[0]} ${-vb[1]})"${o.op != null ? ` opacity="${clamp(o.op)}"` : ''}>${L.inner}</g>`;
  }
  const logoW = (name, h) => { const vb = D.logos[name].viewBox.split(/[ ,]+/).map(Number); return vb[2] * h / vb[3]; };
  function heading(t, a, kicker, title, o = {}) {
    const k = P(t, a, 0.6), x = o.x || 120, y = o.y || 190;
    return g(text(x, y - 58, kicker, { mono: true, size: 22, fill: C.teal, weight: 500 }) +
      text(x, y, title, { size: o.size || 58, weight: 700 }), { op: k, x: -24 * (1 - k) });
  }

  // ---------- timeline ----------
  const SC = {}; D.timeline.scenes.forEach((s, i) => { SC[s.id] = Object.assign({ i }, s); });
  const ORDER = D.timeline.scenes.map((s) => s.id);
  const DUR = D.timeline.duration;
  const cue = (id, i) => SC[id].sentences[i].start;
  const cueEnd = (id, i) => SC[id].sentences[i].end;
  const len = (id, i) => cueEnd(id, i) - cue(id, i);
  // a point part way through a sentence, by share of its characters (for split sentences)
  const at = (id, i, phrase) => { const s = SC[id].sentences[i]; const idx = s.text.indexOf(phrase); return s.start + (s.end - s.start) * (idx / s.text.length); };
  const ON = (id) => D.script.scenes.find((s) => s.id === id).on_screen;
  function sceneWindow(id) {
    const k = SC[id].i, next = ORDER[k + 1];
    const enter = k === 0 ? -1 : SC[id].start - 0.35;
    const exit = next ? SC[next].start - 0.5 : 1e9;
    return { enter, exit };
  }
  function sceneAlpha(id, t) { const w = sceneWindow(id); return Math.min(P(t, w.enter, 0.45), 1 - P(t, w.exit, 0.3, eio)); }

  // Key moments, shared by the drawing code and the sound cue list.
  const K = {};
  function keys() {
    K.s01 = { draw: 0.25, label: cue('s01', 0) + 1.7, reg: cue('s01', 1) - 0.25, clock: cue('s01', 1) + 1.2 };
    K.s02 = { morph: SC.s02.start + 0.25, rules: at('s02', 0, 'and lets'), trust: cue('s02', 1) };
    K.s03 = { win: SC.s03.start - 0.1, ticks: [cue('s03', 1) + 0.35, at('s03', 1, 'adds'), at('s03', 1, 'sets')], encode: cue('s03', 2) };
    K.s04 = { cards: SC.s04.start + 0.1, checks: [0, 1, 2].map((i) => cue('s04', 1) + 0.25 + i * (len('s04', 1) - 0.4) / 3), gate: cue('s04', 2) };
    const n5 = 9;
    K.s05 = { split: SC.s05.start + 0.2, send: cue('s05', 1) + 0.1, n: n5, gap: Math.min(0.42, (len('s05', 1) + len('s05', 2) - 1.4) / n5), flight: 1.05, frac: cue('s05', 2) };
    K.s06 = { first: cue('s06', 1), reject: at('s06', 2, 'is rejected') + 0.1, second: at('s06', 2, 'A compliant'), settle: at('s06', 2, 'settles') + 0.2 };
    K.s07 = { pulse: cue('s07', 0) + 0.9, records: cue('s07', 1) - 0.1 };
    K.s08 = { top: SC.s08.start + 0.05, bottom: cue('s08', 1) };
    K.s09 = { build: SC.s09.start - 0.1, logos: cue('s09', 1) - 0.1 };
  }

  // ---------- scenes ----------
  const S = {};
  // 1. The asset
  S.s01 = (t) => {
    const k = K.s01, on = ON('s01');
    let s = '';
    s += line(140, 812, 960, 812, { stroke: C.line, sw: 3, op: P(t, 0, 0.8) });
    s += building(420, 330, 330, 482, { draw: p(t, k.draw, 2.6) });
    const lk = P(t, k.label, 0.6);
    s += g(text(585, 232, on[1].toUpperCase(), { mono: true, size: 20, fill: C.teal, anchor: 'middle' }) +
      chip(585, 278, on[0], { anchor: 'middle', size: 28, bg: C.ink, fg: C.white, h: 56, padX: 26 }).svg, { op: lk, y: 14 * (1 - lk) });
    // register of owners, paper card
    const rk = P(t, k.reg, 0.7);
    let r = card(1060, 300, 640, 470);
    r += text(1104, 368, on[2], { size: 34, weight: 700 });
    r += line(1104, 396, 1656, 396, { stroke: C.line2, sw: 2 });
    for (let i = 0; i < 5; i++) {
      const yy = 440 + i * 56, kk = P(t, k.reg + 0.25 + i * 0.1, 0.4);
      r += g(text(1104, yy + 8, `Owner ${String(i + 1).padStart(2, '0')}`, { size: 24, weight: 500, fill: C.muted }) +
        rect(1290, yy - 9, 220 + ((i * 53) % 130), 16, { r: 8, fill: C.grey }) + line(1104, yy + 30, 1656, yy + 30, { stroke: C.line2, sw: 1, op: 0.8 }), { op: kk });
    }
    // business hours clock
    const ck = P(t, k.clock, 0.5), ang = (t - k.clock) * 40;
    r += g(circle(1124, 724, 20, { stroke: C.ink, sw: 2.5, fill: C.white }) +
      `<line x1="1124" y1="724" x2="${1124 + 12 * Math.sin(ang * Math.PI / 180)}" y2="${724 - 12 * Math.cos(ang * Math.PI / 180)}" stroke="${C.ink}" stroke-width="2.5" stroke-linecap="round"/>` +
      line(1124, 724, 1124, 714, { sw: 2.5 }) + text(1160, 732, on[3], { size: 24, weight: 600, fill: C.ink }), { op: ck });
    s += g(r, { op: rk, x: 60 * (1 - rk) });
    return s;
  };

  // 2. What tokenisation means
  S.s02 = (t) => {
    const k = K.s02, on = ON('s02');
    let s = '';
    // building eases to the left and stays the same
    const mv = P(t, k.morph, 1.2, eio);
    const bx = lerp(420, 170, mv), by = lerp(330, 380, mv), bw = lerp(330, 260, mv), bh = lerp(482, 380, mv);
    s += line(lerp(140, 110, mv), 812 - 52 * mv + 52 * mv, lerp(960, 520, mv), 812 - 52 * mv + 52 * mv, { stroke: C.line, sw: 3, op: 1 - mv * 0.2 });
    s += building(bx, by + (812 - (by + bh)), bw, bh, {});
    const tk = P(t, k.trust, 0.6);
    s += chip(bx + bw / 2, 300 + 20 * (1 - tk), 'Unit trust', { anchor: 'middle', size: 24, bg: C.ink, fg: C.white, op: tk }).svg;
    s += chip(bx + bw / 2, 860, on[2], { anchor: 'middle', size: 22, bg: C.white, fg: C.ink, border: C.line, icon: 'tick', op: tk }).svg;
    // the register card dissolves, its rows become tokens
    const ca = 1 - P(t, k.morph + 0.3, 0.9);
    s += g(card(1060, 300, 640, 470) + text(1104, 368, ON('s01')[2], { size: 34, weight: 700 }) + line(1104, 396, 1656, 396, { stroke: C.line2, sw: 2 }), { op: ca });
    for (let i = 0; i < 5; i++) {
      const m = P(t, k.morph + 0.35 + i * 0.14, 0.9, eio);
      const ry = 440 + i * 56;
      const tx = 760 + i * 210, ty = 560;
      s += g(text(1104, ry + 8, `Owner ${String(i + 1).padStart(2, '0')}`, { size: 24, fill: C.muted }) + rect(1290, ry - 9, 220 + ((i * 53) % 130), 16, { r: 8, fill: C.grey }), { op: 1 - P(m, 0, 0.4) });
      const cx = lerp(1200, tx, m), cy = lerp(ry, ty, m);
      s += token(cx, cy, 70, { k: P(m, 0.2, 0.8) });
      // a rules tag clips onto each token
      const rk = P(t, k.rules + i * 0.12, 0.5);
      if (rk > 0) s += g(rect(tx - 44, ty + 86, 88, 34, { r: 8, fill: C.white, stroke: C.ink, sw: 2 }) +
        text(tx, ty + 109, 'Rules', { size: 18, weight: 600, anchor: 'middle' }) + line(tx, ty + 70, tx, ty + 86, { sw: 2 }), { op: rk, y: -16 * (1 - rk) });
    }
    const h1 = P(t, SC.s02.start + 0.2, 0.6), h2 = P(t, k.rules, 0.6);
    s += g(text(660, 250, on[0], { size: 44, weight: 700 }), { op: h1, x: -20 * (1 - h1) });
    s += g(text(660, 312, on[1], { size: 44, weight: 700, fill: C.teal }), { op: h2, x: -20 * (1 - h2) });
    return s;
  };

  // window chrome in Tokeniser style
  function platform(x, y, w, h, o = {}) {
    let s = card(x, y, w, h, { r: 20 });
    s += rect(x, y, w, 64, { r: 20, fill: C.ink }) + rect(x, y + 40, w, 24, { fill: C.ink });
    s += logo('tokeniser', x + 28, y + 20, 24, {}).replace(/#343740/g, '#ffffff');
    s += rect(x + w - 156, y + 18, 128, 28, { r: 14, fill: C.mint }) + text(x + w - 92, y + 38, o.tab || 'Fund setup', { size: 15, weight: 600, fill: C.mintInk, anchor: 'middle' });
    // sidebar
    s += rect(x, y + 64, 210, h - 64, { fill: C.band }) + rect(x, y + h - 20, 210, 20, { fill: C.band, r: 0 });
    const items = o.nav || ['Overview', 'Fund setup', 'Investors', 'Register', 'Reports'];
    items.forEach((n, i) => {
      const act = i === (o.active == null ? 1 : o.active);
      if (act) s += rect(x + 14, y + 92 + i * 52, 182, 40, { r: 10, fill: C.white, stroke: C.line2, sw: 1 });
      s += text(x + 34, y + 119 + i * 52, n, { size: 18, weight: act ? 700 : 500, fill: act ? C.ink : C.muted });
    });
    return s;
  }

  // 3. Step 1, set up
  S.s03 = (t) => {
    const k = K.s03, on = ON('s03');
    let s = heading(t, SC.s03.start - 0.2, on[0].toUpperCase(), on[1]);
    const wk = P(t, k.win, 0.7);
    let w = platform(120, 270, 1000, 560, { tab: 'Fund setup', active: 1 });
    w += text(370, 370, 'Commercial property fund', { size: 30, weight: 700 });
    w += text(370, 404, 'Illustrative example', { size: 18, weight: 500, fill: C.muted });
    const rows = [on[2], on[3], on[4]], subs = ['Entity checked and confirmed', 'Structure and fund details entered', 'Who can hold: verified, eligible investors'];
    rows.forEach((r, i) => {
      const yy = 460 + i * 112, tk = p(t, k.ticks[i], 0.6), act = t > k.ticks[i] - 0.4;
      w += rect(362, yy - 8, 720, 92, { r: 14, fill: tk > 0 ? '#f2fff7' : C.white, stroke: tk > 0 ? C.mint2 : C.line2, sw: 1.5 });
      w += checkDot(410, yy + 38, 22, tk);
      w += text(452, yy + 30, r, { size: 26, weight: 600, fill: act ? C.ink : C.soft });
      w += text(452, yy + 62, subs[i], { size: 19, fill: C.muted, op: act ? 1 : 0.5 });
    });
    s += g(w, { op: wk, y: 30 * (1 - wk) });
    // the rules fold into the token's smart contract
    const ek = P(t, k.encode, 0.9, eio);
    const cx = 1480, cy = 540;
    let e = '';
    e += circle(cx, cy, 190, { stroke: C.ink, sw: 2, dash: '6 10', op: 0.6 });
    const fly = P(t, k.encode + 0.1, 1.0, eio);
    const rx = lerp(900, cx - 120, fly), ry = lerp(740, cy - 40, fly);
    e += g(rect(rx, ry, 240, 80, { r: 12, fill: C.white, stroke: C.ink, sw: 2 }) + text(rx + 20, ry + 34, 'Eligibility rules', { size: 20, weight: 700 }) +
      rect(rx + 20, ry + 50, 150, 10, { r: 5, fill: C.blue }), { op: 1 - P(t, k.encode + 1.0, 0.4) });
    e += token(cx, cy, 150, { k: P(t, k.encode + 1.0, 0.7) });
    const lab = P(t, k.encode + 1.3, 0.5);
    e += chip(cx, cy + 238, on[5], { anchor: 'middle', size: 24, bg: C.ink, fg: C.white, op: lab }).svg;
    s += g(e, { op: P(t, k.encode - 0.2, 0.5) });
    return s;
  };

  // 4. Step 2, investors
  S.s04 = (t) => {
    const k = K.s04, on = ON('s04');
    let s = heading(t, SC.s04.start - 0.2, on[0].toUpperCase(), on[1]);
    const names = ['Investor A', 'Investor B', 'Investor C', 'Investor D'];
    for (let i = 0; i < 4; i++) {
      const x = 120 + i * 430, y = 300, ck = P(t, k.cards + i * 0.12, 0.6);
      const ver = i < 3;
      const t1 = ver ? k.checks[i] : 1e9, t2 = ver ? k.checks[i] + 0.35 : 1e9;
      let c = card(x, y, 390, 420, { fill: C.white });
      c += circle(x + 58, y + 64, 30, { fill: C.blue }) + circle(x + 58, y + 56, 11, { fill: C.navy }) + `<path d="M${x + 38} ${y + 84} Q${x + 58} ${y + 62} ${x + 78} ${y + 84}" fill="${C.navy}"/>`;
      c += text(x + 104, y + 74, names[i], { size: 28, weight: 700 });
      [on[2], on[3]].forEach((lbl, j) => {
        const yy = y + 140 + j * 72, kk = p(t, j ? t2 : t1, 0.55);
        c += checkDot(x + 52, yy, 18, kk) + text(x + 84, yy + 8, lbl, { size: 21, weight: 500, fill: kk > 0 ? C.ink : C.muted });
      });
      const v = ver ? p(t, t2 + 0.4, 0.3) : 0;
      c += wallet(x + 195, y + 336, { w: 330, h: 112, verified: v, label: 'Wallet', status: 'Not verified' });
      s += g(c, { op: ck, y: 24 * (1 - ck) });
    }
    // closed gate in front of the unverified wallet
    const gk = P(t, k.gate, 0.6);
    const gx = 1405, gy = 300;
    let gs = '';
    const drop = P(t, k.gate + 0.2, 0.9, eio), bounce = P(t, k.gate + 1.1, 0.5, eo);
    gs += token(gx + 195, lerp(150, 230, drop) - 26 * bounce, 34, { k: P(t, k.gate, 0.4) });
    gs += rect(gx + 40, 268, 310, 14, { r: 7, fill: C.ink });
    gs += chip(gx + 195, 805, on[4], { anchor: 'middle', size: 22, bg: C.ink, fg: C.white, icon: 'cross' }).svg;
    s += g(gs, { op: gk });
    return s;
  };

  // 5. Step 3, issue
  S.s05 = (t) => {
    const k = K.s05, on = ON('s05');
    let s = heading(t, SC.s05.start - 0.2, on[0].toUpperCase(), on[1]);
    // building split into units
    const bx = 130, by = 320, bw = 300, bh = 440, sp = P(t, k.split, 1.0, eio);
    const cols = 3, rows = 3, gap = 14 * sp;
    const uw = bw / cols, uh = bh / rows;
    let b = '';
    for (let r = 0; r < rows; r++) for (let c = 0; c < cols; c++) {
      const i = r * cols + c, left = t < k.send + i * k.gap;
      const x = bx + c * (uw + gap) - gap, y = by + r * (uh + gap) - gap;
      const iss = left ? 0 : P(t, k.send + i * k.gap, 0.4);
      b += rect(x, y, uw, uh, { fill: iss > 0 ? `rgba(162,255,200,${0.6 * iss})` : C.white, stroke: C.ink, sw: 2.5, r: 6 * sp });
      for (let a = 0; a < 2; a++) for (let q = 0; q < 2; q++)
        b += rect(x + uw * (0.18 + q * 0.38), y + uh * (0.2 + a * 0.36), uw * 0.26, uh * 0.2, { fill: iss > 0.5 ? C.white : C.blue, stroke: C.ink, sw: 1.4, r: 2 });
    }
    s += g(b, { op: P(t, SC.s05.start - 0.3, 0.5) });
    const fk = P(t, k.frac, 0.6);
    s += chip(bx + bw / 2, 830, on[4], { anchor: 'middle', size: 22, bg: C.ink, fg: C.white, op: fk }).svg;
    // Redbelly Network rail
    const railK = P(t, k.send - 0.6, 0.8);
    const rx0 = 520, rx1 = 1130, ry = 540;
    let r = rect(rx0, ry - 36, rx1 - rx0, 72, { r: 36, fill: C.band, stroke: C.line, sw: 1.5 });
    r += circle(rx0 + 40, ry, 26, { fill: C.white, stroke: C.line, sw: 1.5 }) + logo('redbellyMark', rx0 + 40 - logoW('redbellyMark', 30) / 2, ry - 15, 30);
    r += text(rx0 + 82, ry + 9, on[2], { size: 22, weight: 600, fill: C.ink });
    s += g(r, { op: railK });
    // wallets and register
    const wy = [360, 540, 720], names = ['Investor A', 'Investor B', 'Investor C'];
    const counts = [0, 0, 0];
    for (let i = 0; i < k.n; i++) {
      const t0 = k.send + i * k.gap, f = p(t, t0, k.flight);
      const w = i % 3;
      if (t >= t0 + k.flight) counts[w]++;
      if (f <= 0 || f >= 1) continue;
      const r0 = Math.floor(i / 3), c0 = i % 3;
      const sx = bx + c0 * (uw + 14) + uw / 2 - 14, sy = by + r0 * (uh + 14) + uh / 2 - 14;
      let x, y;
      const e = eio(f);
      if (e < 0.25) { const q = e / 0.25; x = lerp(sx, rx0 + 70, q); y = lerp(sy, ry, q); }
      else if (e < 0.75) { const q = (e - 0.25) / 0.5; x = lerp(rx0 + 70, rx1 - 20, q); y = ry; }
      else { const q = (e - 0.75) / 0.25; x = lerp(rx1 - 20, 1250, q); y = lerp(ry, wy[w], q); }
      s += token(x, y, 30, { k: P(f, 0, 0.12) });
    }
    const wk = P(t, k.send - 0.4, 0.6);
    let wl = '';
    wy.forEach((y, i) => { wl += wallet(1290, y, { w: 250, h: 120, verified: 1, label: names[i] }); });
    s += g(wl, { op: wk, x: 20 * (1 - wk) });
    // live register
    let rg = card(1450, 300, 380, 470);
    rg += text(1480, 356, 'Register', { size: 28, weight: 700 }) + chip(1800, 346, 'Live', { anchor: 'end', size: 16, h: 28, padX: 10, icon: 'dot' }).svg;
    rg += line(1480, 382, 1800, 382, { stroke: C.line2 });
    names.forEach((n, i) => {
      const yy = 432 + i * 92, last = k.send + (i + 6) * k.gap + k.flight;
      const flash = 1 - P(t, Math.max(k.frac, last), 1.2);
      const firstIn = k.send + i * k.gap + k.flight;
      rg += rect(1470, yy - 34, 340, 72, { r: 10, fill: C.mint, op: t > firstIn ? 0.0 + 0.6 * (counts[i] > 0 ? (t > k.frac ? flash : 0.3) : 0) : 0 });
      rg += text(1484, yy + 8, n, { size: 22, weight: 600 });
      for (let j = 0; j < 3; j++) rg += circle(1700 + j * 34, yy, 12, { fill: j < counts[i] ? C.mint2 : C.white, stroke: j < counts[i] ? C.ink : C.line, sw: 2 });
    });
    rg += text(1480, 735, on[5], { size: 18, weight: 600, fill: C.teal, op: P(t, k.frac, 0.5) });
    s += g(rg, { op: wk, x: 30 * (1 - wk) });
    return s;
  };

  // 6. Step 4, transfer
  S.s06 = (t) => {
    const k = K.s06, on = ON('s06');
    let s = heading(t, SC.s06.start - 0.2, on[0].toUpperCase(), on[1]);
    const ap = P(t, SC.s06.start - 0.2, 0.6);
    s += g(wallet(270, 560, { w: 280, h: 130, verified: 1, label: 'Investor A' }), { op: ap });
    // checkpoint
    let cp = card(760, 360, 340, 400, { r: 20 });
    cp += rect(760, 360, 340, 70, { r: 20, fill: C.ink }) + rect(760, 400, 340, 30, { fill: C.ink });
    cp += text(930, 406, 'Rules check', { size: 24, weight: 700, fill: C.white, anchor: 'middle' });
    const checks = ['Wallet verified', 'Investor eligible', 'Within restrictions'];
    checks.forEach((c, i) => { cp += circle(800, 482 + i * 60, 8, { fill: C.blue }) + text(822, 490 + i * 60, c, { size: 20, weight: 500 }); });
    // scan bar
    const scan = (tt) => { const q = p(t, tt, 0.9); return q > 0 && q < 1 ? rect(780, 450 + q * 190, 300, 4, { r: 2, fill: C.teal, op: 0.8 }) : ''; };
    cp += scan(k.first + 0.6) + scan(k.second + 0.3);
    s += g(cp, { op: ap });
    s += g(chip(930, 802, on[2], { anchor: 'middle', size: 22, bg: C.white, fg: C.ink, border: C.line }).svg, { op: P(t, k.first, 0.5) });
    // destinations
    const rej = P(t, k.reject, 0.4), ok = P(t, k.settle, 0.4);
    s += g(wallet(1560, 380, { w: 300, h: 130, verified: 0, label: 'Investor E', status: on[3] }), { op: ap });
    s += g(wallet(1560, 740, { w: 300, h: 130, verified: 1, label: 'Investor B' }), { op: ap });
    // first token: towards E, stopped at the checkpoint
    const f1 = P(t, k.first + 0.2, 1.3, eio);
    if (t < k.second + 0.4) {
      const x = lerp(400, 750, f1), y = 560;
      const fade = 1 - P(t, k.second - 0.1, 0.5);
      s += token(x - 18 * Math.sin(p(t, k.reject - 0.1, 0.4) * Math.PI * 3) * (1 - p(t, k.reject + 0.3, 0.2)), y, 34, { k: P(t, k.first, 0.3), op: fade });
      s += g(line(1100, 560, 1400, 400, { stroke: C.reject, sw: 3, dash: '8 10' }), { op: rej * fade * 0.8 });
    }
    s += chip(1560, 470, on[4], { anchor: 'middle', size: 22, bg: C.rejectBg, fg: C.reject, icon: 'cross', op: rej }).svg;
    // second token: passes through to B and settles
    const f2 = P(t, k.second, 1.6, eio);
    if (t > k.second) {
      let x, y;
      if (f2 < 0.55) { const q = f2 / 0.55; x = lerp(400, 930, q); y = 560; }
      else { const q = (f2 - 0.55) / 0.45; x = lerp(930, 1440, q); y = lerp(560, 740, q); }
      s += token(x, y, 34, { k: P(t, k.second, 0.3) });
      s += g(line(1100, 600, 1400, 740, { stroke: C.mint2, sw: 4 }), { op: P(f2, 0.5, 0.2) * 0.8 });
    }
    s += chip(1560, 836, on[5], { anchor: 'middle', size: 22, bg: C.mint, fg: C.mintInk, icon: 'tick', op: ok }).svg;
    return s;
  };

  // 7. Running the fund
  S.s07 = (t) => {
    const k = K.s07, on = ON('s07');
    let s = heading(t, SC.s07.start - 0.2, 'AFTER ISSUE', 'Running the fund');
    const ap = P(t, SC.s07.start - 0.2, 0.6);
    const fx = 330, fy = 560;
    const ws = [[760, 330], [860, 470], [880, 620], [800, 760], [620, 860]].map(([x, y]) => [x - 40, y - 20]);
    let n = '';
    ws.forEach(([x, y]) => { n += line(fx, fy, x, y, { stroke: C.line, sw: 2 }); });
    const pk = p(t, k.pulse, 1.0);
    if (pk > 0) ws.forEach(([x, y]) => { n += line(fx, fy, lerp(fx, x, eo(pk)), lerp(fy, y, eo(pk)), { stroke: C.mint2, sw: 5, op: 1 - P(t, k.pulse + 1.6, 0.6) * 0.6 }); });
    n += circle(fx, fy, 100, { fill: C.white, stroke: C.ink, sw: 3 });
    n += building(fx - 42, fy - 64, 84, 118, { sw: 2.5 });
    for (let j = 0; j < 2; j++) { const q = p(t, k.pulse + j * 0.35, 1.3); if (q > 0 && q < 1) n += circle(fx, fy, 100 + q * 180, { stroke: C.mint2, sw: 3, op: 1 - q }); }
    ws.forEach(([x, y], i) => {
      const hit = P(t, k.pulse + 0.9, 0.3);
      n += circle(x, y, 34, { fill: hit > 0 ? C.mint : C.white, stroke: C.ink, sw: 2.5 }) + rect(x - 14, y - 10, 28, 20, { r: 4, stroke: C.ink, sw: 2, fill: C.white }) + rect(x + 2, y - 4, 12, 8, { r: 2, fill: C.ink });
    });
    n += chip(fx, 720, on[0], { anchor: 'middle', size: 21, bg: C.ink, fg: C.white, op: P(t, k.pulse + 0.4, 0.5) }).svg;
    s += g(n, { op: ap });
    // records panel
    const rk = P(t, k.records, 0.7);
    let r = card(1060, 280, 740, 470);
    r += text(1100, 342, 'Records', { size: 30, weight: 700 }) + chip(1764, 332, on[1], { anchor: 'end', size: 16, h: 30, padX: 12, icon: 'dot' }).svg;
    r += line(1100, 368, 1760, 368, { stroke: C.line2 });
    ['Investor register', 'Transaction history', 'Distribution records', 'Compliance log'].forEach((lbl, i) => {
      const yy = 418 + i * 62, kk = P(t, k.records + 0.2 + i * 0.15, 0.4);
      const blink = 0.55 + 0.45 * Math.cos((t - k.records) * 4 + i);
      r += g(text(1100, yy + 8, lbl, { size: 23, weight: 500 }) + circle(1740, yy, 8, { fill: C.mint2, op: blink }) + text(1722, yy + 7, 'Current', { size: 17, weight: 600, fill: C.muted, anchor: 'end' }) +
        line(1100, yy + 30, 1760, yy + 30, { stroke: C.line2, sw: 1 }), { op: kk });
    });
    on.slice(2, 5).forEach((b, i) => {
      const bk = P(t, k.records + 1.4 + i * 0.25, 0.4);
      r += chip(1100 + [0, 220, 380][i], 700, b, { size: 20, bg: C.blue, fg: C.navy, op: bk }).svg;
    });
    s += g(r, { op: rk, x: 40 * (1 - rk) });
    return s;
  };

  // 8. What sits underneath
  S.s08 = (t) => {
    const k = K.s08, on = ON('s08');
    let s = '';
    const tk = P(t, k.top, 0.7);
    let top = platform(460, 170, 1000, 330, { tab: 'Register', active: 3, nav: ['Overview', 'Fund setup', 'Investors', 'Register'] });
    top += text(710, 290, on[0], { size: 36, weight: 700 });
    top += chip(710, 350, on[1], { size: 22, bg: C.mint, fg: C.mintInk, icon: 'tick' }).svg;
    top += rect(710, 400, 300, 14, { r: 7, fill: C.grey }) + rect(710, 430, 220, 14, { r: 7, fill: C.grey }) + rect(1060, 396, 360, 60, { r: 10, fill: C.band });
    s += g(top, { op: tk, y: -30 * (1 - tk) });
    const bk = P(t, k.bottom, 0.8);
    const conn = P(t, k.bottom + 0.3, 0.5);
    s += g(line(960, 505, 960, 590, { stroke: C.ink, sw: 2.5, dash: '6 8' }), { op: conn });
    let bot = rect(360, 600, 1200, 220, { r: 24, fill: C.ink });
    bot += circle(446, 686, 46, { fill: C.white }) + logo('redbellyMark', 446 - logoW('redbellyMark', 52) / 2, 660, 52);
    bot += text(520, 690, on[2], { size: 40, weight: 700, fill: C.white });
    bot += text(520, 736, on[3], { size: 25, weight: 500, fill: C.mint });
    for (let i = 0; i < 5; i++) bot += token(1240 + (i % 3) * 84 + (i > 2 ? 42 : 0), 676 + (i > 2 ? 72 : 0), 34, { k: P(t, k.bottom + 0.6 + i * 0.1, 0.5) });
    s += g(bot, { op: bk, y: 40 * (1 - bk) });
    return s;
  };

  // 9. Close
  S.s09 = (t) => {
    const k = K.s09, on = ON('s09');
    let s = '';
    s += line(120, 800, 840, 800, { stroke: C.line, sw: 3, op: P(t, k.build, 0.6) });
    s += building(190, 350, 300, 450, { draw: p(t, k.build, 1.8), mint: P(t, k.build + 1.6, 0.8) });
    s += token(680, 640, 110, { k: P(t, k.build + 1.0, 0.8) });
    s += g(drawPath('M500 640 C 540 640, 540 640, 560 640', P(t, k.build + 0.9, 0.4), { stroke: C.ink, sw: 3 }), {});
    const h1 = P(t, SC.s09.start, 0.7), h2 = P(t, at('s09', 0, 'now') - 0.1, 0.7);
    s += g(text(960, 420, on[0], { size: 72, weight: 700 }), { op: h1, x: 24 * (1 - h1) });
    const l2 = wrap(on[1], 38, 600, 820);
    l2.forEach((ln, i) => { s += g(text(960, 500 + i * 52, ln, { size: 38, weight: 600, fill: C.muted }), { op: h2, x: 24 * (1 - h2) }); });
    const lk = P(t, k.logos, 0.7);
    const ly = 500 + l2.length * 52 + 40;
    let lg = logo('tokeniser', 960, ly, 40);
    lg += line(960 + logoW('tokeniser', 40) + 36, ly + 2, 960 + logoW('tokeniser', 40) + 36, ly + 40, { stroke: C.line, sw: 2 });
    lg += logo('redbelly', 960 + logoW('tokeniser', 40) + 72, ly - 4, 48);
    lg += chip(960, ly + 120, on[2], { size: 26, bg: C.mint, fg: C.mintInk, h: 54, padX: 24 }).svg;
    s += g(lg, { op: lk, y: 16 * (1 - lk) });
    s += text(960, 880, on[3], { size: 20, weight: 500, fill: C.muted, op: P(t, k.logos + 0.4, 0.6) });
    return s;
  };

  // ---------- frame ----------
  function background(t) {
    const off = (t * 6) % 48;
    let s = `<rect width="${W}" height="${H}" fill="url(#bg)"/>`;
    s += `<g opacity="0.55" transform="translate(${-off} 0)"><rect x="0" y="0" width="${W + 48}" height="${H}" fill="url(#dots)"/></g>`;
    return s;
  }
  function header(t) {
    let s = logo('tokeniser', 120, 50, 30, { op: 1 - P(t, SC.s09.start - 0.4, 0.4) });
    // step indicator for the four steps
    const steps = ['s03', 's04', 's05', 's06'];
    const a = Math.min(P(t, SC.s03.start - 0.35, 0.5), 1 - P(t, SC.s07.start - 0.5, 0.4));
    if (a > 0) {
      let cur = 0; steps.forEach((id, i) => { if (t >= SC[id].start - 0.35) cur = i; });
      let st = '';
      const labels = steps.map((id) => ON(id)[1]);
      for (let i = 0; i < 4; i++) {
        const x = 1080 + i * 180, act = i === cur, done = i < cur;
        st += rect(x, 58, 164, 6, { r: 3, fill: act ? C.ink : done ? C.mint2 : C.line });
        st += text(x, 92, `${i + 1}  ${labels[i]}`, { size: 18, weight: act ? 700 : 500, fill: act ? C.ink : C.muted });
      }
      s += g(st, { op: a });
    }
    return s;
  }
  function subtitles(t) {
    if (!SUBS) return '';
    const all = []; D.timeline.scenes.forEach((sc) => sc.sentences.forEach((x) => all.push(x)));
    let s = '';
    all.forEach((x, i) => {
      const nx = all[i + 1];
      const a = x.start - 0.05, b = Math.min(x.end + 0.35, nx ? nx.start - 0.05 : x.end + 0.6);
      if (t < a || t > b) return;
      const op = Math.min(p(t, a, 0.12), 1 - p(t, b - 0.12, 0.12));
      const lines = balance(x.text, 36, 500, 1380);
      const lw = Math.max(...lines.map((l) => tw(l, 36, 500)));
      const bh = 26 + lines.length * 48, by = 1046 - bh;
      let q = rect(960 - lw / 2 - 30, by, lw + 60, bh, { r: 14, fill: C.ink, op: 0.94 });
      lines.forEach((l, j) => { q += text(960, by + 48 + j * 48, l, { size: 36, weight: 500, fill: C.white, anchor: 'middle', ls: 0 }); });
      s += g(q, { op });
    });
    return s;
  }
  const DEFS = `<defs>
    <linearGradient id="bg" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#ffffff"/><stop offset="1" stop-color="${C.band}"/></linearGradient>
    <pattern id="dots" width="48" height="48" patternUnits="userSpaceOnUse"><circle cx="24" cy="24" r="1.6" fill="${C.line}"/></pattern>
    <filter id="shadow" x="-10%" y="-10%" width="120%" height="130%"><feDropShadow dx="0" dy="10" stdDeviation="16" flood-color="#343740" flood-opacity="0.10"/></filter>
  </defs>`;
  const svg = document.getElementById('stage');
  function renderAt(t) {
    let s = DEFS + background(t);
    for (const id of ORDER) {
      const a = sceneAlpha(id, t);
      if (a <= 0.001) continue;
      s += g(S[id](t), { op: a, y: 14 * (1 - a) });
    }
    s += header(t) + subtitles(t);
    svg.innerHTML = s;
  }
  // Sound cues, from the same key moments the drawing uses.
  function sfxCues() {
    const c = [];
    ORDER.forEach((id, i) => { if (i) c.push({ t: SC[id].start - 0.4, s: 'sweep' }); });
    c.push({ t: K.s01.label, s: 'tick' }, { t: K.s01.reg, s: 'paper' });
    for (let i = 0; i < 5; i++) c.push({ t: K.s02.morph + 0.35 + i * 0.14 + 0.5, s: 'pop' });
    K.s03.ticks.forEach((x) => c.push({ t: x + 0.2, s: 'tick' }));
    c.push({ t: K.s03.encode + 1.0, s: 'chime' });
    K.s04.checks.forEach((x) => c.push({ t: x + 0.2, s: 'tick' }, { t: x + 0.55, s: 'tick' }));
    c.push({ t: K.s04.gate + 1.1, s: 'thud' });
    for (let i = 0; i < K.s05.n; i++) c.push({ t: K.s05.send + i * K.s05.gap + K.s05.flight, s: 'pop' });
    c.push({ t: K.s06.reject, s: 'thud' }, { t: K.s06.settle, s: 'chime' });
    c.push({ t: K.s07.pulse, s: 'swell' }, { t: K.s07.records, s: 'paper' });
    c.push({ t: K.s08.bottom, s: 'swell' }, { t: K.s09.logos, s: 'chime' });
    return c.sort((a, b) => a.t - b.t);
  }

  keys();
  window.DURATION = DUR;
  window.renderAt = renderAt;
  window.sfxCues = sfxCues;
  window.setSubs = (v) => { SUBS = v; };
  window.ready = document.fonts.ready.then(() => Promise.all(['400', '500', '600', '700'].map((w) => document.fonts.load(`${w} 20px Montserrat`)).concat([document.fonts.load('500 20px "Plex Mono"')])));
  window.ready.then(() => {
    renderAt(Number(params.get('t') || 0));
    if (params.has('preview')) {
      document.body.classList.add('preview');
      const sc = document.getElementById('scrub'); sc.max = DUR;
      sc.oninput = () => renderAt(Number(sc.value));
    }
  });
})();
