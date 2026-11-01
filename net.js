// Réseau : utilise le SDK du hub (ChadGang) ; sinon une salle locale
// (onglets du même navigateur) pour tester hors hub.
const Net = (() => {
  const hub = !!(window.ChadGang && window.ChadGang.join);

  function localId() {
    try {
      let id = sessionStorage.getItem('tn-id');
      if (!id) { id = 'l' + Math.random().toString(36).slice(2, 9); sessionStorage.setItem('tn-id', id); }
      return id;
    } catch (e) { return 'l' + Math.random().toString(36).slice(2, 9); }
  }

  async function me() {
    if (hub) {
      try { return await ChadGang.me(); } catch (e) { /* secours ci-dessous */ }
    }
    let name = '';
    try { name = localStorage.getItem('tn-name') || ''; } catch (e) {}
    return { id: localId(), name: name || 'Joueur' + Math.floor(Math.random() * 90 + 10), avatar: null, isAdmin: false };
  }

  function roomFromUrl() {
    if (hub && ChadGang.room) return ChadGang.room();
    const m = location.search.match(/[?&]room=([A-Za-z0-9]+)/);
    return m ? m[1].toUpperCase() : null;
  }

  // Salle locale (BroadcastChannel) : même interface que celle du hub
  function localRoom(code, user) {
    const bc = new BroadcastChannel('trounoir-' + code);
    const handlers = {};
    const emit = (e, ...a) => (handlers[e] || []).forEach(f => f(...a));
    const self = { id: user.id, name: user.name, t: Date.now() + Math.random() };
    let players = [self];
    let last = null;

    const publish = () => {
      players.sort((a, b) => a.t - b.t);
      emit('players', players.map(p => ({ id: p.id, name: p.name })));
    };
    const add = p => { if (!players.find(x => x.id === p.id)) { players.push(p); publish(); } };

    bc.onmessage = ev => {
      const m = ev.data;
      if (m.k === 'hello') { add(m.p); bc.postMessage({ k: 'here', p: self, last }); }
      else if (m.k === 'here') { add(m.p); if (m.last && !last) last = m.last; }
      else if (m.k === 'bye') { players = players.filter(p => p.id !== m.id); publish(); }
      else if (m.k === 'msg') { if (m.keep) last = m.data; emit('message', m.data, m.from); }
    };
    addEventListener('pagehide', () => bc.postMessage({ k: 'bye', id: self.id }));

    setTimeout(() => bc.postMessage({ k: 'hello', p: self }), 0);
    setTimeout(() => {
      emit('ready', { me: self.id, players: players.map(p => ({ id: p.id, name: p.name })), last });
      publish();
    }, 300);

    return {
      on(e, f) { (handlers[e] = handlers[e] || []).push(f); },
      send(data, opts) {
        const keep = !!(opts && opts.keep);
        if (keep) last = data;
        bc.postMessage({ k: 'msg', data, keep, from: { id: self.id, name: self.name } });
        emit('message', data, { id: self.id, name: self.name });
      },
      leave() { bc.postMessage({ k: 'bye', id: self.id }); bc.close(); }
    };
  }

  function join(code, create, user) {
    if (hub) return ChadGang.join(code, { create });
    return localRoom(code, user);
  }

  return { hub, me, join, room: roomFromUrl };
})();
