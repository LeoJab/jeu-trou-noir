// Effets spéciaux : fond spatial + trou noir, particules, sons synthétisés
const FX = (() => {
  const bg = document.getElementById('bg'), fxc = document.getElementById('fx');
  const bctx = bg.getContext('2d'), fctx = fxc.getContext('2d');
  let W = 0, H = 0, dpr = 1, danger = 0, dangerT = 0, pull = 0, t = 0;
  let stars = [], parts = [], muted = false, ac = null;
  try { muted = localStorage.getItem('tn-mute') === '1'; } catch (e) {}

  function resize() {
    dpr = Math.min(window.devicePixelRatio || 1, 2);
    W = innerWidth; H = innerHeight;
    [bg, fxc].forEach(c => { c.width = W * dpr; c.height = H * dpr; });
    bctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    fctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  }
  function mkStar(far) {
    const m = Math.hypot(W, H) / 2;
    return { a: Math.random() * 6.283, r: far ? m * (0.2 + Math.random() * 0.9) : m * 1.05,
             s: 0.2 + Math.random() * 0.8, z: Math.random() * 1.6 + 0.3, p: Math.random() * 6 };
  }
  function initStars() { stars = Array.from({ length: 170 }, () => mkStar(true)); }

  // ---------- fond : étoiles + trou noir ----------
  function drawBg() {
    danger += (dangerT - danger) * 0.03;
    pull *= 0.97;
    bctx.clearRect(0, 0, W, H);
    const cx = W * 0.5, cy = H * 0.46;
    const R = Math.min(W, H) * (0.075 + danger * 0.07 + pull * 0.12) * (1 + Math.sin(t / 700) * 0.03);
    for (const s of stars) {
      s.a += 0.0007 * s.s * (1 + pull * 8);
      s.r -= (0.10 + pull * 4) * s.s * (1 + danger);
      if (s.r < R * 0.9) Object.assign(s, mkStar(false));
      const x = cx + Math.cos(s.a) * s.r, y = cy + Math.sin(s.a) * s.r * 0.8;
      bctx.globalAlpha = 0.35 + 0.65 * Math.abs(Math.sin(t / 600 + s.p));
      bctx.fillStyle = '#fff';
      bctx.fillRect(x, y, s.z, s.z);
    }
    bctx.globalAlpha = 1;
    // lueur
    const g = bctx.createRadialGradient(cx, cy, R, cx, cy, R * 4.5);
    g.addColorStop(0, `rgba(${255},${150 - danger * 90},40,${0.35 + danger * 0.25})`);
    g.addColorStop(0.4, 'rgba(36,51,242,0.22)');
    g.addColorStop(1, 'rgba(36,51,242,0)');
    bctx.fillStyle = g;
    bctx.fillRect(0, 0, W, H);
    // disque d'accrétion
    bctx.save();
    bctx.translate(cx, cy);
    bctx.rotate(-0.28);
    for (let i = 0; i < 5; i++) {
      const rx = R * (1.35 + i * 0.42);
      bctx.beginPath();
      bctx.ellipse(0, 0, rx, rx * 0.26, 0, 0, 6.283);
      bctx.setLineDash([18 + i * 9, 26, 6, 30]);
      bctx.lineDashOffset = -t * (0.05 + i * 0.012) * (1 + pull * 6);
      bctx.lineWidth = 3.5 - i * 0.5;
      bctx.strokeStyle = i % 2 ? `rgba(255,212,38,${0.7 - i * 0.1})` : `rgba(255,120,60,${0.8 - i * 0.12})`;
      bctx.stroke();
    }
    bctx.restore();
    bctx.setLineDash([]);
    // horizon des événements
    bctx.beginPath();
    bctx.arc(cx, cy, R, 0, 6.283);
    bctx.fillStyle = '#000';
    bctx.shadowColor = '#ffd426'; bctx.shadowBlur = 25 + danger * 30;
    bctx.fill();
    bctx.shadowBlur = 0;
  }

  // ---------- particules ----------
  function burst(x, y, color, n = 24, speed = 6) {
    for (let i = 0; i < n; i++) {
      const a = Math.random() * 6.283, v = Math.random() * speed + 1;
      parts.push({ x, y, vx: Math.cos(a) * v, vy: Math.sin(a) * v, g: 0.12, life: 0, max: 40 + Math.random() * 30,
                   c: color || '#ffd426', s: 2 + Math.random() * 4 });
    }
  }
  function confetti() {
    const cols = ['#ffd426', '#2433f2', '#ff4d6d', '#ffffff', '#3ddc97'];
    for (let i = 0; i < 160; i++) {
      parts.push({ x: Math.random() * W, y: -20 - Math.random() * H * 0.4, vx: (Math.random() - 0.5) * 3,
                   vy: 2 + Math.random() * 4, g: 0.05, life: 0, max: 220 + Math.random() * 100,
                   c: cols[i % cols.length], s: 4 + Math.random() * 6, rect: true });
    }
  }
  function drawParts() {
    fctx.clearRect(0, 0, W, H);
    parts = parts.filter(p => p.life < p.max);
    for (const p of parts) {
      p.life++; p.x += p.vx; p.y += p.vy; p.vy += p.g;
      fctx.globalAlpha = Math.max(0, 1 - p.life / p.max);
      fctx.fillStyle = p.c;
      if (p.rect) fctx.fillRect(p.x, p.y, p.s, p.s * 0.6); else { fctx.beginPath(); fctx.arc(p.x, p.y, p.s, 0, 6.283); fctx.fill(); }
    }
    fctx.globalAlpha = 1;
  }
  function loop(ts) { t = ts; drawBg(); drawParts(); requestAnimationFrame(loop); }

  // ---------- effets d'écran ----------
  function flash(color, ms = 500) {
    const f = document.getElementById('flash');
    f.style.background = color || '#fff';
    f.animate([{ opacity: 0.85 }, { opacity: 0 }], { duration: ms });
  }
  function shake(ms = 600) {
    const a = document.getElementById('app');
    a.classList.remove('shake'); void a.offsetWidth; a.classList.add('shake');
    setTimeout(() => a.classList.remove('shake'), ms);
    if (navigator.vibrate) try { navigator.vibrate(ms / 2); } catch (e) {}
  }
  function setDanger(v) {
    dangerT = Math.max(0, Math.min(1, v));
    document.body.classList.toggle('danger', dangerT >= 0.85);
  }
  function suckPull() { pull = 1; }

  // Un jeton « spirale » jusqu'au trou noir
  function suck(el, target) {
    if (!el || !el.getBoundingClientRect) return;
    const r = el.getBoundingClientRect();
    const tr = (target || el).getBoundingClientRect();
    const c = el.cloneNode(true);
    c.style.cssText = `position:fixed;left:${r.left}px;top:${r.top}px;margin:0;z-index:90;pointer-events:none;`;
    document.body.appendChild(c);
    const dx = tr.left + tr.width / 2 - (r.left + r.width / 2), dy = tr.top + tr.height / 2 - (r.top + r.height / 2);
    const an = c.animate([
      { transform: 'translate(0,0) rotate(0) scale(1)', opacity: 1 },
      { transform: `translate(${dx * 0.5}px,${dy * 0.3}px) rotate(300deg) scale(1.3)`, opacity: 1, offset: 0.4 },
      { transform: `translate(${dx}px,${dy}px) rotate(900deg) scale(0)`, opacity: 0 }
    ], { duration: 1300, easing: 'cubic-bezier(.5,0,.8,.6)' });
    an.onfinish = () => c.remove();
    burst(r.left + r.width / 2, r.top + r.height / 2, '#ffd426', 14, 4);
  }

  function floatEmoji(e, name) {
    const d = document.createElement('div');
    d.className = 'floaty';
    d.textContent = e;
    d.style.left = (8 + Math.random() * 80) + '%';
    d.title = name || '';
    document.body.appendChild(d);
    setTimeout(() => d.remove(), 2600);
  }

  // ---------- sons ----------
  function ctx() {
    if (!ac) { try { ac = new (window.AudioContext || window.webkitAudioContext)(); } catch (e) { return null; } }
    if (ac.state === 'suspended') ac.resume();
    return ac;
  }
  function tone(f, d, type = 'sine', vol = 0.15, to = null, delay = 0) {
    if (muted) return; const c = ctx(); if (!c) return;
    const o = c.createOscillator(), g = c.createGain(), t0 = c.currentTime + delay;
    o.type = type; o.frequency.setValueAtTime(f, t0);
    if (to) o.frequency.exponentialRampToValueAtTime(to, t0 + d);
    g.gain.setValueAtTime(vol, t0); g.gain.exponentialRampToValueAtTime(0.0001, t0 + d);
    o.connect(g).connect(c.destination); o.start(t0); o.stop(t0 + d + 0.05);
  }
  function noise(d, vol = 0.2, freq = 600, delay = 0) {
    if (muted) return; const c = ctx(); if (!c) return;
    const n = Math.floor(c.sampleRate * d), buf = c.createBuffer(1, n, c.sampleRate), data = buf.getChannelData(0);
    for (let i = 0; i < n; i++) data[i] = (Math.random() * 2 - 1) * (1 - i / n);
    const s = c.createBufferSource(), fl = c.createBiquadFilter(), g = c.createGain(), t0 = c.currentTime + delay;
    s.buffer = buf; fl.type = 'lowpass'; fl.frequency.value = freq; g.gain.value = vol;
    s.connect(fl).connect(g).connect(c.destination); s.start(t0);
  }
  const sfx = {
    click: () => tone(520, 0.06, 'square', 0.08),
    tick: () => tone(900, 0.04, 'square', 0.06),
    intro: () => { tone(55, 1.8, 'sawtooth', 0.12, 110); noise(1.5, 0.12, 300); },
    ask: () => { tone(440, 0.1, 'triangle', 0.12); tone(660, 0.14, 'triangle', 0.12, null, 0.1); },
    good: () => [523, 659, 784].forEach((f, i) => tone(f, 0.18, 'triangle', 0.14, null, i * 0.08)),
    bad: () => tone(200, 0.35, 'sawtooth', 0.14, 70),
    fall: () => { tone(420, 0.5, 'sine', 0.18, 70); noise(0.4, 0.12, 900); },
    power: () => tone(250, 0.35, 'square', 0.1, 1400),
    hole: () => { tone(320, 1.4, 'sawtooth', 0.18, 28); tone(60, 1.2, 'sine', 0.35, 30, 0.2); noise(1.4, 0.25, 400); },
    heart: () => { tone(70, 0.12, 'sine', 0.35); tone(70, 0.12, 'sine', 0.3, null, 0.18); },
    win: () => [523, 659, 784, 1047, 784, 1047].forEach((f, i) => tone(f, 0.25, 'triangle', 0.16, null, i * 0.11)),
    lose: () => [392, 330, 262, 196].forEach((f, i) => tone(f, 0.3, 'sawtooth', 0.1, null, i * 0.16))
  };

  function setMuted(m) {
    muted = m;
    try { localStorage.setItem('tn-mute', m ? '1' : '0'); } catch (e) {}
    document.getElementById('mute').textContent = m ? '🔇' : '🔊';
  }

  addEventListener('resize', () => { resize(); initStars(); });
  resize(); initStars(); requestAnimationFrame(loop);
  document.getElementById('mute').textContent = muted ? '🔇' : '🔊';
  document.getElementById('mute').onclick = () => { setMuted(!muted); sfx.click(); };
  // les navigateurs exigent un geste avant de produire du son
  addEventListener('pointerdown', () => ctx(), { once: true });

  return { sfx, burst, confetti, flash, shake, setDanger, suckPull, suck, floatEmoji };
})();
