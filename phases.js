// Affichage des phases d'une partie : i (intro) q (question) r (résultat) p (pouvoir) f (chute) end
(() => {
  let timerRAF = 0, lastSec = -1;
  const me = () => (G.S.pl || []).find(p => p.id === G.myId);
  const canPlay = () => { const m = me(); return !!(m && m.alive); };
  const names = ids => ids.length > 3 ? ids.length + ' joueurs' : ids.map(UI.nameOf).join(', ');
  // la question s'affiche devant l'échelle ; elle s'efface pour laisser voir les chutes
  const card = on => { $('qcard').classList.toggle('show', on); $('qback').classList.toggle('hidden', !on); };

  function updateTop() {
    const s = G.S, m = me(), kb = $('kindBadge');
    $('roundInfo').textContent = s.round ? 'Manche ' + s.round : 'Décollage';
    $('meInfo').textContent = !m ? '👀 Spectateur' : m.alive ? '🧠 ' + LV[m.lv] : '☠️ Aspiré·e';
    if ((s.ph === 'q' || s.ph === 'r') && s.kind !== 'n') { kb.className = 'badge ' + s.kind; kb.textContent = s.kind === 'd' ? '💥 CHUTE DOUBLE' : '⚡ ÉCLAIR'; }
    else kb.className = 'badge hidden';
  }

  function stopTimer() { cancelAnimationFrame(timerRAF); }
  function startTimer(ms) {
    stopTimer(); lastSec = -1;
    const bar = $('timerBar'), t0 = performance.now();
    bar.className = '';
    const step = () => {
      if (G.S.ph !== 'q') return;
      const f = Math.max(0, 1 - (performance.now() - t0) / ms);
      bar.style.width = (f * 100) + '%';
      bar.classList.toggle('low', f < 0.3);
      const sec = Math.ceil(f * ms / 1000);
      if (f > 0 && sec <= 3 && sec !== lastSec && canPlay() && G.myAns === null) { lastSec = sec; FX.sfx.tick(); }
      if (f > 0) timerRAF = requestAnimationFrame(step);
    };
    timerRAF = requestAnimationFrame(step);
  }

  function buildOpts(s, interactive) {
    const box = $('opts'); box.innerHTML = '';
    s.q.o.forEach((txt, i) => {
      const b = UI.el('button', 'opt');
      b.appendChild(UI.el('i', '', 'ABCD'[i]));
      b.appendChild(document.createTextNode(txt));
      b.disabled = !interactive;
      b.onclick = () => choose(i);
      box.appendChild(b);
    });
    $('qtheme').textContent = (THEMES[s.q.th] || '❓') + ' ' + s.q.th;
    $('qtext').textContent = s.q.t;
  }
  function choose(i) {
    if (G.myAns !== null || G.S.ph !== 'q' || !canPlay()) return;
    G.myAns = i;
    [...$('opts').children].forEach((b, j) => { b.disabled = true; b.classList.toggle('sel', j === i); });
    $('qstatus').textContent = '🔒 Réponse verrouillée… on attend les autres';
    FX.sfx.click();
    G.actions.answer(i);
  }

  function phIntro(fresh) {
    UI.resetTokens(); stopTimer(); card(false);
    $('qtheme').textContent = '🚨 Alerte'; $('qtext').textContent = 'Préparez-vous…'; $('opts').innerHTML = '';
    $('qstatus').textContent = ''; $('timerBar').style.width = '100%';
    UI.drawLadder(true); updateTop();
    if (fresh) return;
    UI.showOverlay([UI.el('div', 'big', '🚨 ALERTE ! 🚨'),
      UI.el('div', 'sub', 'Avarie moteur : votre vaisseau dérive vers un trou noir qui aspire vos connaissances. Répondez juste pour tenir… ou entraînez les autres dans l\'abîme !')]);
    FX.sfx.intro(); FX.shake(1200); FX.flash('#ff4d6d', 700);
  }

  function phQuestion(fresh) {
    const s = G.S;
    UI.hideOverlay(); G.answered = new Set(); G.myAns = null; card(true);
    buildOpts(s, canPlay());
    $('qstatus').textContent = canPlay() ? 'Réponds vite ! Le plus rapide des bons sacrifie un adversaire.'
      : (me() ? 'Tu es aspiré·e… tu regardes la suite 👀' : 'Partie en cours : tu regardes en spectateur 👀');
    startTimer(s.dl * 1000);
    UI.drawLadder(fresh); updateTop();
    FX.sfx.ask();
    const m = me();
    if (m && m.alive && m.lv >= HOLE - 1) setTimeout(FX.sfx.heart, 400);
    if (!fresh && s.kind !== 'n') FX.shake(400);
  }

  function phReveal(fresh) {
    const s = G.S, c = s.q.c, mine = s.res && s.res[G.myId];
    UI.hideOverlay(); stopTimer(); $('timerBar').style.width = '0%'; card(true);
    if ($('opts').children.length !== 4) buildOpts(s, false);
    const chosen = G.myAns !== null ? G.myAns : (mine ? mine.a : -1);
    [...$('opts').children].forEach((b, j) => {
      b.disabled = true; b.classList.remove('sel');
      b.classList.toggle('right', j === c); b.classList.toggle('wrong', j === chosen && j !== c); b.classList.toggle('dim', j !== c && j !== chosen);
    });
    const fallen = Object.keys(s.res || {}).filter(id => !s.res[id].ok);
    const fall = s.kind === 'd' ? 2 : 1;
    $('qstatus').textContent = (mine ? (mine.ok ? '✅ Bonne réponse !' : (mine.a < 0 ? '⌛ Trop lent…' : '❌ Raté…')) : 'Résultat de la manche')
      + (s.win === G.myId ? ' ⚡ Tu es le plus rapide !' : '');
    UI.log(fallen.length ? `M${s.round} : ${names(fallen)} ${fallen.length > 1 ? 'chutent' : 'chute'}` : `M${s.round} : sans faute !`);
    if (!fresh && mine) {
      if (mine.ok) { FX.sfx.good(); FX.burst(innerWidth / 2, innerHeight * 0.4, '#3ddc97', 30); }
      else { FX.sfx.bad(); FX.flash('#ff4d6d', 500); FX.shake(500); }
    }
    // la correction reste devant ~2 s, puis la question s'efface et on voit les chutes (annonces comprises)
    const showFalls = () => {
      if (G.S.v !== s.v) return;
      UI.hold = false; card(false);
      if (!fresh) {
        UI.banner(fallen.length ? `📉 ${names(fallen)} ${fallen.length > 1 ? 'chutent' : 'chute'}${fall > 1 ? ' de 2 niveaux' : ''} !` : '🎉 Sans faute !', fallen.length ? 'red' : 'green');
        if (s.win) UI.banner(`⚡ ${UI.nameOf(s.win)} est le plus rapide !`, 'gold');
      }
      UI.drawLadder(fresh); updateTop();
    };
    updateTop();
    if (fresh) showFalls(); else { UI.hold = true; setTimeout(showFalls, 2000); }
  }

  function phPower(fresh) {
    const s = G.S;
    card(false); updateTop();
    if (s.win === G.myId && canPlay()) {
      const box = UI.el('div', 'targets');
      s.pl.filter(p => p.alive && p.id !== s.win).forEach(p => {
        const t = UI.mkTok(p);
        t.onclick = () => { G.actions.pick(p.id); UI.showOverlay([UI.el('div', 'big', '💥 Sacrifice lancé !')]); FX.sfx.power(); };
        box.appendChild(t);
      });
      UI.showOverlay([UI.el('div', 'big', '⚡ Tu es le plus rapide !'), UI.el('div', 'sub', 'Choisis ta victime : elle descend d\'un niveau.'), box]);
      FX.sfx.power();
    } else {
      UI.hideOverlay();
      $('qstatus').textContent = `⚡ ${UI.nameOf(s.win)} choisit qui sacrifier…`;
    }
  }

  function phFall(fresh) {
    const s = G.S;
    UI.hideOverlay(); card(false);
    UI.log(`M${s.round} : ${UI.nameOf(s.win)} sacrifie ${UI.nameOf(s.hit)}`);
    if (!fresh) {
      UI.banner(`💥 ${UI.nameOf(s.win)} sacrifie ${UI.nameOf(s.hit)} !`, 'red');
      FX.flash('#ffd426', 300); if (s.hit === G.myId) FX.shake(600);
    }
    $('qstatus').textContent = `${UI.nameOf(s.hit)} est poussé·e d'un niveau !`;
    UI.drawLadder(fresh); updateTop();
  }

  function renderEnd(fresh) {
    const s = G.S, w = s.winners || [], iWon = w.includes(G.myId), inGame = !!me();
    UI.hideOverlay(); stopTimer(); card(false); UI.showView('end'); FX.setDanger(0);
    $('endTitle').textContent = iWon ? '🏆 VICTOIRE !' : inGame ? '☠️ ASPIRÉ·E…' : '🏁 FIN DE PARTIE';
    $('endSub').textContent = w.length === 1 ? `${UI.nameOf(w[0])} est le dernier survivant !`
      : w.length > 1 ? 'Égalité : ' + w.map(UI.nameOf).join(' & ') : 'Personne n\'a survécu au trou noir…';
    const order = [...w, ...(s.order || []).slice().reverse()].filter((id, i, a) => a.indexOf(id) === i);
    s.pl.forEach(p => { if (!order.includes(p.id)) order.push(p.id); });
    const ul = $('rank'); ul.innerHTML = '';
    order.forEach((id, i) => {
      const p = s.pl.find(x => x.id === id); if (!p) return;
      const li = UI.el('li', w.includes(id) ? 'first' : '');
      li.appendChild(UI.mkAv(id, p.name)); li.appendChild(UI.el('span', '', p.name));
      li.appendChild(UI.el('small', '', p.ok + ' bonne' + (p.ok > 1 ? 's' : '') + ' rép.'));
      ul.appendChild(li);
    });
    $('btnReplay').classList.toggle('hidden', !G.isHost);
    $('endHint').textContent = G.isHost ? '' : 'L\'hôte peut relancer une partie.';
    if (!fresh) {
      if (iWon) { FX.confetti(); FX.sfx.win(); FX.flash('#ffd426', 800); } else if (inGame) FX.sfx.lose();
    }
  }

  UI.render = prev => {
    const s = G.S;
    UI.hold = false;
    if (!s || s.ph === 'lobby') {
      if (prev && prev.ph && prev.ph !== 'lobby') UI.resetTokens();
      stopTimer(); card(false); UI.hideOverlay(); FX.setDanger(0); UI.showView('lobby'); UI.renderLobby(); return;
    }
    const fresh = !prev || prev.gid !== s.gid || s.v - prev.v > 1;
    if (s.ph === 'end') { renderEnd(fresh); return; }
    UI.showView('game');
    if (s.ph === 'i') phIntro(fresh);
    else if (s.ph === 'q') phQuestion(fresh);
    else if (s.ph === 'r') phReveal(fresh);
    else if (s.ph === 'p') phPower(fresh);
    else if (s.ph === 'f') phFall(fresh);
  };

  // un joueur arrive/part, ou une réponse arrive
  UI.onPlayers = () => {
    const s = G.S;
    if (!s || s.ph === 'lobby') UI.renderLobby();
    else if (s.ph === 'end') $('btnReplay').classList.toggle('hidden', !G.isHost);
    else if (!UI.hold) UI.drawLadder(true);
  };
  UI.onAnswer = () => {
    const s = G.S;
    if (!s || s.ph !== 'q') return;
    UI.drawLadder(true);
    const alive = s.pl.filter(p => p.alive).length;
    if (canPlay() && G.myAns !== null) $('qstatus').textContent = `🔒 Verrouillé · ${G.answered.size}/${alive} ont répondu`;
  };
})();
