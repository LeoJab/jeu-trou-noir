// Interface : constantes, jetons, échelle, salon, annonces. (Les phases de jeu sont dans phases.js)
const $ = id => document.getElementById(id);
const LV = ['Cerveau galactique', 'Astro-génie', 'Commandant', 'Capitaine', 'Lieutenant', 'Pilote', 'Navigateur', 'Cadet', 'Mécano',
  'Stagiaire', 'Passager clandestin', 'Poussière d\'étoile'];
const HOLE = LV.length; // index de la ligne « trou noir »
const THEMES = { Histoire: '🏛️', Géo: '🌍', Sciences: '🔬', Nature: '🌿', Cinéma: '🎬', Musique: '🎵', Arts: '🎨', Sport: '⚽', Gastronomie: '🍽️', Divers: '🎲' };

const UI = (() => {
  const tokEls = {};
  let rowEls = [];
  let toastTimer = null;

  const hue = id => { let h = 0; for (const c of String(id)) h = (h * 31 + c.charCodeAt(0)) % 360; return h; };
  const nameOf = id => {
    const p = (G.S && G.S.pl || []).find(x => x.id === id) || G.players.find(x => x.id === id);
    return p ? p.name : '???';
  };
  const avatarUrl = id => {
    if (G.me && id === G.me.id && G.me.avatar) return G.me.avatar;
    const p = G.players.find(x => x.id === id);
    return (p && (p.avatar || p.photo)) || G.avatars[id] || null;
  };
  function mkAv(id, name) {
    const a = document.createElement('span');
    a.className = 'av';
    a.dataset.chadgangId = id; // la caméra du joueur remplace sa photo
    const u = avatarUrl(id);
    if (u) a.style.backgroundImage = `url("${u}")`;
    else { a.style.background = `hsl(${hue(id)} 70% 45%)`; a.textContent = (name || '?').trim().charAt(0).toUpperCase(); }
    return a;
  }
  function mkTok(p) {
    const t = document.createElement('span');
    t.className = 'tok';
    t.appendChild(mkAv(p.id, p.name));
    const n = document.createElement('span');
    n.className = 'nm'; n.textContent = p.name;
    t.appendChild(n);
    return t;
  }

  function showView(name) {
    document.querySelectorAll('.view').forEach(v => v.classList.toggle('hidden', v.id !== 'v-' + name));
  }
  function toast(msg, ms = 2600) {
    const t = $('toast'); t.textContent = msg; t.classList.add('on');
    clearTimeout(toastTimer); toastTimer = setTimeout(() => t.classList.remove('on'), ms);
  }
  function banner(text, cls) {
    const b = document.createElement('span');
    b.className = 'b-item ' + (cls || '');
    b.textContent = text;
    $('banner').appendChild(b);
    setTimeout(() => b.remove(), 2700);
  }
  function log(text) {
    const ul = $('log'), li = document.createElement('li');
    li.textContent = text; ul.appendChild(li);
    while (ul.children.length > 5) ul.removeChild(ul.firstChild);
  }
  function showOverlay(nodes) {
    const o = $('overlay'); o.innerHTML = '';
    nodes.forEach(n => o.appendChild(n));
    o.classList.remove('hidden');
  }
  function hideOverlay() { $('overlay').classList.add('hidden'); }
  function el(tag, cls, text) {
    const e = document.createElement(tag);
    if (cls) e.className = cls; if (text != null) e.textContent = text;
    return e;
  }

  // ---------- échelle ----------
  function buildLadder() {
    const ol = $('ladder'); ol.innerHTML = ''; rowEls = [];
    for (let i = 0; i <= HOLE; i++) {
      const li = el('li', 'row' + (i === HOLE ? ' hole' : ''));
      li.style.setProperty('--d', i / HOLE);
      if (i === HOLE) { const o = el('span'); o.id = 'holeOrb'; li.appendChild(o); li.appendChild(el('span', 'lname', 'TROU NOIR')); }
      else { li.appendChild(el('span', 'ln', String(i + 1))); li.appendChild(el('span', 'lname', LV[i])); }
      li.appendChild(el('div', 'tokens'));
      ol.appendChild(li); rowEls.push(li);
    }
  }
  function resetTokens() {
    Object.keys(tokEls).forEach(k => delete tokEls[k]);
    rowEls = []; $('ladder').innerHTML = ''; $('log').innerHTML = '';
  }
  // fresh = true : on dessine sans effets (arrivée en cours de partie)
  function drawLadder(fresh) {
    const S = G.S;
    if (!S || !S.pl) return;
    if (!rowEls.length) buildLadder();
    const before = {};
    S.pl.forEach(p => { if (tokEls[p.id]) before[p.id] = tokEls[p.id].getBoundingClientRect(); });
    let fell = false; const dead = [];
    S.pl.forEach(p => {
      let e = tokEls[p.id];
      if (!e) { e = tokEls[p.id] = mkTok(p); e.dataset.lv = p.lv; e.dataset.dead = p.alive ? '0' : '1'; }
      const prevLv = +e.dataset.lv, wasDead = e.dataset.dead === '1';
      const online = G.players.some(x => x.id === p.id);
      e.classList.toggle('dead', !p.alive);
      e.classList.toggle('me', p.id === G.myId);
      e.classList.toggle('gone', p.alive && G.players.length > 0 && !online);
      e.classList.toggle('done', S.ph === 'q' && G.answered.has(p.id) && p.alive);
      if (!fresh && p.alive && p.lv > prevLv) { fell = true; e.classList.remove('hit'); void e.offsetWidth; e.classList.add('hit'); }
      const target = rowEls[Math.min(p.lv, HOLE)].querySelector('.tokens');
      if (!fresh && !p.alive && !wasDead) {
        dead.push(p);
        FX.suck(e, $('holeOrb'));
        e.style.opacity = 0; setTimeout(() => { e.style.transition = 'opacity .5s'; e.style.opacity = ''; }, 1300);
      }
      e.dataset.lv = p.lv; e.dataset.dead = p.alive ? '0' : '1';
      if (e.parentNode !== target) target.appendChild(e);
    });
    if (!fresh) S.pl.forEach(p => {
      const e = tokEls[p.id], a = before[p.id];
      if (!e || !a || !p.alive) return;
      const b = e.getBoundingClientRect(), dx = a.left - b.left, dy = a.top - b.top;
      if (dx || dy) e.animate([{ transform: `translate(${dx}px,${dy}px)` }, { transform: 'none' }], { duration: 650, easing: 'cubic-bezier(.3,1.4,.5,1)' });
    });
    if (dead.length) {
      FX.sfx.hole(); FX.flash('#000', 900); FX.shake(900); FX.suckPull();
      dead.forEach(p => { banner(`🕳️ ${p.name} est aspiré·e !`, 'red'); log(`🕳️ ${p.name} est aspiré·e`); });
    } else if (fell) FX.sfx.fall();
    const me = S.pl.find(p => p.id === G.myId);
    FX.setDanger(me ? (me.alive ? Math.pow(me.lv / (HOLE - 1), 2) : 0.3) : 0.2);
  }

  // ---------- salon ----------
  function renderLobby() {
    $('roomCode').textContent = G.code || '----';
    const ul = $('lobbyList'); ul.innerHTML = '';
    G.players.forEach((p, i) => {
      const li = el('li'); li.appendChild(mkAv(p.id, p.name));
      li.appendChild(el('span', '', p.name + (p.id === G.myId ? ' (toi)' : '')));
      if (i === 0) li.appendChild(el('span', 'badge-host', '👑 hôte'));
      ul.appendChild(li);
    });
    const enough = G.players.length >= 2 || !Net.hub;
    $('btnStart').classList.toggle('hidden', !G.isHost);
    $('btnStart').disabled = !enough;
    $('lobbyHint').textContent = G.isHost
      ? (enough ? 'Tout le monde est là ? Lance la partie !' : 'Il faut au moins 2 joueurs. Invite tes potes avec la barre du hub !')
      : 'En attente de l\'hôte…';
  }

  // ---------- branchement des boutons ----------
  function init() {
    $('btnCreate').onclick = () => G.actions.create();
    $('btnJoin').onclick = () => G.actions.join($('code').value);
    $('code').addEventListener('input', e => { e.target.value = e.target.value.toUpperCase().replace(/[^A-Z0-9]/g, ''); });
    $('code').addEventListener('keydown', e => { if (e.key === 'Enter') G.actions.join($('code').value); });
    ['btnRules', 'btnRules2'].forEach(id => { $(id).onclick = () => { $('rules').classList.remove('hidden'); FX.sfx.click(); }; });
    $('btnRulesClose').onclick = () => $('rules').classList.add('hidden');
    $('btnCopy').onclick = () => {
      try { navigator.clipboard.writeText(G.code); toast('Code copié !'); } catch (e) { toast('Code : ' + G.code); }
    };
    $('btnStart').onclick = () => G.actions.start();
    $('btnReplay').onclick = () => G.actions.replay();
    ['btnLeave1', 'btnLeave2', 'btnQuit'].forEach(id => { $(id).onclick = () => G.actions.leave(); });
    $('react').addEventListener('click', e => { const b = e.target.closest('button'); if (b) G.actions.react(b.dataset.e); });
  }

  return { init, showView, toast, banner, log, showOverlay, hideOverlay, el, mkAv, mkTok, nameOf,
           drawLadder, resetTokens, renderLobby, tokEls: () => tokEls };
})();
