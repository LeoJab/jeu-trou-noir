// Logique : état partagé + machine à états de l'hôte (le premier joueur de la salle).
// Chaque coup = un état complet versionné, envoyé avec keep:true.
const G = { me: null, myId: null, room: null, code: '', S: null, players: [], isHost: false,
            avatars: {}, answered: new Set(), myAns: null, resumedV: -1, actions: {} };

const T = { intro: 3600, reveal: 4600, power: 9000, fall: 3400, fallDead: 4800 };
let htimer = 0, answers = {}, secret = null, qStart = 0, finDone = '', hiTimer = 0;
const usedQ = new Set();

const after = (ms, fn) => { clearTimeout(htimer); htimer = setTimeout(fn, ms); };
const shuffle = a => { for (let i = a.length - 1; i > 0; i--) { const j = Math.floor(Math.random() * (i + 1)); [a[i], a[j]] = [a[j], a[i]]; } return a; };

// ---------- état ----------
function applyState(s) {
  const prev = G.S;
  G.S = s;
  UI.render(prev);
  if (s.ph === 'end') finish(s);
}
function publish(patch) {
  const s = Object.assign({}, G.S || {}, patch, { v: (G.S ? G.S.v : 0) + 1 });
  G.room.send({ t: 'st', s }, { keep: true });
  applyState(s);
}
function finish(s) {
  if (finDone === s.gid) return;
  finDone = s.gid;
  const m = s.pl.find(p => p.id === G.myId);
  if (!m || s.n0 < 2 || !window.ChadGang || !ChadGang.finPartie) return;
  ChadGang.finPartie({ gagne: (s.winners || []).includes(G.myId), partie: s.gid, score: m.ok })
    .then(r => { if (r && r.record) { UI.banner('🏅 NOUVEAU RECORD !', 'gold'); FX.confetti(); } })
    .catch(() => {});
}

// ---------- hôte ----------
function pickQuestion() {
  const bank = window.QS || [];
  if (usedQ.size >= bank.length) usedQ.clear();
  let i; do { i = Math.floor(Math.random() * bank.length); } while (usedQ.has(i));
  usedQ.add(i);
  const [t, good, f1, f2, f3, th] = bank[i];
  const o = shuffle([good, f1, f2, f3]);
  return { t, o, c: o.indexOf(good), th };
}
function overCheck(pl, n0, died) {
  const al = pl.filter(p => p.alive);
  if (n0 >= 2) return al.length >= 2 ? null : (al.length ? [al[0].id] : died.slice());
  return al.length ? null : [];
}
function hostStart() {
  if (!G.isHost || (G.players.length < 2 && Net.hub)) return;
  const pl = G.players.map(p => ({ id: p.id, name: p.name, lv: 0, alive: true, ok: 0 }));
  publish({ ph: 'i', gid: G.code + '-' + Date.now().toString(36), round: 0, kind: 'n', dl: 0, pl, n0: pl.length,
            order: [], q: null, res: null, win: null, hit: null, over: null, winners: null });
  after(T.intro, hostAsk);
}
function hostAsk() {
  const s = G.S, round = s.round + 1, q = pickQuestion(), r = Math.random();
  const kind = round < 3 ? 'n' : r < 0.15 ? 'd' : r < 0.3 ? 'e' : 'n';
  const dl = kind === 'e' ? 7 : 15;
  secret = { c: q.c }; answers = {}; qStart = Date.now();
  publish({ ph: 'q', round, kind, dl, q: { t: q.t, o: q.o, th: q.th }, res: null, win: null, hit: null });
  after(dl * 1000 + 900, hostResolve);
}
function hostAnswer(id, a) {
  const s = G.S;
  const p = s.pl.find(x => x.id === id);
  if (s.ph !== 'q' || answers[id] || !p || !p.alive || !(a >= 0 && a < 4)) return;
  answers[id] = { a, ms: Date.now() - qStart };
  const online = new Set(G.players.map(x => x.id));
  if (s.pl.filter(x => x.alive && online.has(x.id)).every(x => answers[x.id])) after(400, hostResolve);
}
function hostResolve() {
  const s = G.S;
  if (s.ph !== 'q') return;
  const c = secret ? secret.c : -1, fall = s.kind === 'd' ? 2 : 1;
  const pl = s.pl.map(p => ({ ...p })), order = s.order.slice(), died = [], res = {};
  let win = null, best = Infinity;
  pl.filter(p => p.alive).forEach(p => {
    const a = answers[p.id], ok = !!a && a.a === c;
    res[p.id] = { a: a ? a.a : -1, ok };
    if (ok) { p.ok++; if (a.ms < best) { best = a.ms; win = p.id; } }
    else { p.lv += fall; if (p.lv >= HOLE) { p.lv = HOLE; p.alive = false; order.push(p.id); died.push(p.id); } }
  });
  const over = overCheck(pl, s.n0, died);
  if (over || !pl.some(p => p.alive && p.id !== win)) win = over ? win : null;
  publish({ ph: 'r', pl, res, win, order, over, q: { ...s.q, c } });
  after(T.reveal, over ? hostEnd : (win ? hostPower : hostAsk));
}
const targets = () => G.S.pl.filter(p => p.alive && p.id !== G.S.win);
const randomTarget = () => { const t = targets(); return t[Math.floor(Math.random() * t.length)].id; };
function hostPower() {
  publish({ ph: 'p' });
  const online = G.players.some(p => p.id === G.S.win);
  after(online ? T.power : 1200, () => hostHit(randomTarget()));
}
function hostPick(from, target) {
  const s = G.S;
  if (s.ph !== 'p' || from !== s.win || !targets().some(p => p.id === target)) return;
  hostHit(target);
}
function hostHit(target) {
  const s = G.S;
  if (s.ph !== 'p') return;
  const pl = s.pl.map(p => ({ ...p })), order = s.order.slice(), died = [];
  const v = pl.find(p => p.id === target);
  v.lv++;
  if (v.lv >= HOLE) { v.lv = HOLE; v.alive = false; order.push(v.id); died.push(v.id); }
  const over = overCheck(pl, s.n0, died);
  publish({ ph: 'f', pl, hit: target, order, over });
  after(died.length ? T.fallDead : T.fall, over ? hostEnd : hostAsk);
}
function hostEnd() {
  if (G.S.ph === 'end') return;
  publish({ ph: 'end', winners: G.S.over || [] });
}
function hostReplay() {
  if (!G.isHost) return;
  publish({ ph: 'lobby', pl: [], order: [], q: null, res: null, win: null, hit: null, over: null, winners: null });
}
// un nouvel hôte reprend la partie là où elle en était
function maybeResume() {
  const s = G.S;
  if (!G.isHost || !s || G.resumedV === s.v) return;
  G.resumedV = s.v;
  if (s.ph === 'lobby' || s.ph === 'end') return;
  const next = s.over ? hostEnd : (s.win ? hostPower : hostAsk);
  if (s.ph === 'i' || s.ph === 'q') { secret = null; after(1200, hostAsk); }
  else if (s.ph === 'r') after(2500, next);
  else if (s.ph === 'p') hostPower();
  else if (s.ph === 'f') after(2500, s.over ? hostEnd : hostAsk);
}

// ---------- réseau ----------
function setPlayers(list) {
  const was = G.isHost;
  G.players = list || [];
  G.isHost = G.players.length > 0 && G.players[0].id === G.myId;
  UI.onPlayers();
  if (G.isHost && !was) maybeResume();
}
function sayHi() {
  clearTimeout(hiTimer);
  hiTimer = setTimeout(() => { if (G.room && G.me.avatar) G.room.send({ t: 'hi', av: G.me.avatar }); }, 400);
}
function onMessage(d, from) {
  if (!d || !from) return;
  if (d.t === 'st') { if (d.s && (!G.S || d.s.v > G.S.v)) applyState(d.s); }
  else if (d.t === 'ans') {
    if (G.S && G.S.ph === 'q' && d.r === G.S.round) { G.answered.add(from.id); UI.onAnswer(); if (G.isHost) hostAnswer(from.id, d.a); }
  }
  else if (d.t === 'pick') { if (G.isHost) hostPick(from.id, d.target); }
  else if (d.t === 'react') FX.floatEmoji(d.e, from.name);
  else if (d.t === 'hi' && d.av) {
    G.avatars[from.id] = d.av;
    document.querySelectorAll('[data-chadgang-id]').forEach(e => {
      if (e.dataset.chadgangId === from.id && !e.style.backgroundImage) { e.style.backgroundImage = `url("${d.av}")`; e.textContent = ''; }
    });
  }
}
function connect(code, create) {
  const name = $('pseudo').value.trim();
  if (!Net.hub && name) { G.me.name = name.slice(0, 16); try { localStorage.setItem('tn-name', G.me.name); } catch (e) {} }
  G.code = code; G.S = null; G.players = []; G.isHost = false; finDone = '';
  const room = G.room = Net.join(code, create, G.me);
  room.on('ready', info => {
    G.myId = info.me || G.me.id;
    setPlayers(info.players || []);
    if (info.last && info.last.t === 'st' && info.last.s) applyState(info.last.s);
    else UI.render(null);
    maybeResume(); sayHi();
  });
  room.on('players', list => { setPlayers(list); sayHi(); });
  room.on('message', onMessage);
  room.on('error', msg => { UI.toast(msg || 'Salle introuvable'); G.actions.leave(); });
  UI.showView('lobby'); UI.renderLobby();
}

// ---------- actions des boutons ----------
const genCode = () => Array.from({ length: 4 }, () => 'ABCDEFGHJKLMNPQRSTUVWXYZ'[Math.floor(Math.random() * 24)]).join('');
G.actions = {
  create() { FX.sfx.click(); connect(genCode(), true); },
  join(c, force) {
    c = (c || '').trim().toUpperCase();
    if (c.length < 4) { UI.toast('Entre le code de la salle (4 lettres)'); return; }
    FX.sfx.click(); connect(c, !!force);
  },
  start: hostStart,
  replay: hostReplay,
  answer(i) { G.room.send({ t: 'ans', r: G.S.round, a: i }); },
  pick(id) { G.room.send({ t: 'pick', target: id }); },
  react(e) { if (G.room) G.room.send({ t: 'react', e }); },
  leave() {
    clearTimeout(htimer);
    try { if (G.room) G.room.leave(); } catch (e) {}
    G.room = null; G.S = null; G.players = []; G.isHost = false; G.resumedV = -1;
    UI.resetTokens(); UI.hideOverlay(); UI.showView('home'); FX.setDanger(0);
  }
};

(async function init() {
  UI.init();
  G.me = await Net.me();
  G.myId = G.me.id;
  if (!Net.hub) {
    $('nameRow').classList.remove('hidden');
    $('pseudo').value = G.me.name;
    $('homeNote').textContent = 'Mode hors hub : ouvre plusieurs onglets avec le même code pour tester.';
    $('homeNote').classList.remove('hidden');
  }
  const inv = Net.room();
  if (inv) { $('code').value = inv.toUpperCase(); G.actions.join(inv, true); }
})();
