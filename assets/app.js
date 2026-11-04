/* ==========================================================================
   Housebets Sportsbook — interactive prototype (front-end only)
   All data is sample data. No real players, money, or bets.
   ========================================================================== */
(function () {
  'use strict';

  const D = window.HB_DATA;
  const { TEAMS, COMPS, MATCHES, SPORTS, PLAYERS, SEED_BETS } = D;
  const $ = (s, r = document) => r.querySelector(s);
  const $$ = (s, r = document) => Array.from(r.querySelectorAll(s));

  const view = $('#view');
  const drawer = $('#drawer');
  const drawerBody = $('#drawerBody');
  const scrim = $('#scrim');
  const slipBar = $('#slipBar');

  /* ------------------------------- utils ------------------------------- */
  const money = (n) => Number(n || 0).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  const oddsFmt = (n) => Number(n || 0).toFixed(2);
  const clamp = (n, a, b) => Math.min(b, Math.max(a, n));
  const ic = (name, size = 16) => `<svg width="${size}" height="${size}" aria-hidden="true"><use href="#i-${name}"/></svg>`;
  const esc = (s) => String(s == null ? '' : s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));

  function timeHM(ts) {
    return new Date(ts).toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' });
  }
  function dayLabel(ts) {
    const d = new Date(ts), n = new Date();
    const same = (a, b) => a.toDateString() === b.toDateString();
    if (same(d, n)) return 'Today';
    const t = new Date(n.getTime() + 864e5);
    if (same(d, t)) return 'Tomorrow';
    return d.toLocaleDateString('en-GB', { day: '2-digit', month: 'short' });
  }
  function countdown(ts) {
    const s = Math.max(0, Math.floor((ts - Date.now()) / 1000));
    if (s <= 0) return 'Starting';
    if (s < 120) return `${String(Math.floor(s / 60)).padStart(2, '0')}:${String(s % 60).padStart(2, '0')}`;
    if (s < 3600) return `${Math.ceil(s / 60)} min`;
    return `${Math.floor(s / 3600)}h ${String(Math.floor((s % 3600) / 60)).padStart(2, '0')}`;
  }
  function relTime(ts) {
    const s = Math.floor((Date.now() - ts) / 1000);
    if (s < 45) return 'just now';
    if (s < 3600) return `${Math.floor(s / 60)} min ago`;
    if (s < 86400) return `${Math.floor(s / 3600)} h ago`;
    return `${Math.floor(s / 86400)} d ago`;
  }
  const team = (id) => TEAMS[id] || { name: id, short: String(id).slice(0, 3).toUpperCase(), hue: 200 };
  const comp = (id) => COMPS[id] || { name: id, mark: '—', tint: 200, country: '' };
  const matchById = (id) => MATCHES.find((m) => m.id === id);
  const minTxt = (m) => (m.sport === 'football' ? (m.minute >= 90 ? '90+' : `${m.minute}'`) : (m.clockLabel || `${m.minute}'`));
  const crest = (id, size = '') => {
    const t = team(id);
    return `<span class="crest ${size}" style="--h:${t.hue}" aria-hidden="true">${esc(t.short)}</span>`;
  };

  /* ------------------------------- state ------------------------------- */
  const KEY = 'hb_sportsbook_v2';
  const seed = {
    balance: 1248.5,
    slip: [],
    bets: SEED_BETS.map((b) => ({ ...b })),
    follows: { teams: ['ars', 'bha'], comps: ['pl'] },
    recent: [],
    rail: [],
    mbTab: 'open',
    footballComp: 'all',
    betsView: 'slip',
    liveSport: 'all',
    onlyFollowed: false,
  };
  let state;
  try { state = Object.assign(seed, JSON.parse(localStorage.getItem(KEY) || '{}')); }
  catch (e) { state = seed; }
  state.slip = (state.slip || []).filter((s) => matchById(s.matchId));
  state.bets = state.bets || [];
  state.bets.forEach((b) => {
    if (b.status === 'open' && !b.cashout) b.cashout = Math.round((b.cashoutBase || b.stake * b.odds * 0.85) * 100) / 100;
  });
  let saveTimer;
  function save() {
    clearTimeout(saveTimer);
    saveTimer = setTimeout(() => {
      try { localStorage.setItem(KEY, JSON.stringify(state)); } catch (e) {}
    }, 160);
  }

  /* ------------------------- odds index + engine ------------------------ */
  const oddsIndex = new Map();
  let lastTick = Date.now();

  function registerOdds() {
    MATCHES.forEach((m) => {
      // 1X2
      const labels = { h: team(m.home).name, d: 'Draw', a: team(m.away).name };
      ['h', 'd', 'a'].forEach((p) => {
        if (!(p in m.odds)) return;
        const key = `${m.id}:${p}`;
        if (oddsIndex.has(key)) return;
        oddsIndex.set(key, {
          matchId: m.id, selId: p, label: labels[p], marketName: 'Match result',
          get: () => m.odds[p], set: (v) => { m.odds[p] = v; },
          isSusp: () => false,
        });
      });
      // markets
      (m.markets || []).forEach((mk) => {
        mk.groups.forEach((g) => {
          g.sels.forEach((sel) => {
            const key = `${m.id}:${sel.id}`;
            if (oddsIndex.has(key)) return;
            oddsIndex.set(key, {
              matchId: m.id, selId: sel.id, label: sel.label, marketName: g.name,
              get: () => sel.odds, set: (v) => { sel.odds = v; },
              isSusp: () => (sel._suspUntil || 0) > Date.now(),
              raw: sel,
            });
          });
        });
      });
    });
  }
  registerOdds();

  const currentOdds = (key) => {
    const src = oddsIndex.get(key);
    return src ? Math.round(src.get() * 100) / 100 : 0;
  };

  function driftOdds() {
    const delta = new Map();
    MATCHES.forEach((m) => {
      if (m.status !== 'live') return;
      const live = oddsIndex.size > 0;
      if (!live) return;
      // 1X2 — always moving, small steps
      ['h', 'd', 'a'].forEach((p) => {
        if (!(p in m.odds)) return;
        if (m.odds[p] < 1.06) return;
        if (Math.random() > 0.4) return;
        const prev = m.odds[p];
        const step = (Math.random() * 0.06 + 0.01) * (Math.random() > 0.5 ? 1 : -1);
        m.odds[p] = clamp(Math.round((m.odds[p] + step) * 100) / 100, 1.05, 26);
        delta.set(`${m.id}:${p}`, m.odds[p] - prev);
      });
      // market selections: featured match only, to keep the screen calm
      if (m.featured) {
        m.markets.forEach((mk) => mk.groups.forEach((g) => g.sels.forEach((sel) => {
          if ((sel._suspUntil || 0) > Date.now()) return;
          if (Math.random() > 0.16) return;
          const prev = sel.odds;
          const step = (Math.random() * 0.10 + 0.01) * (Math.random() > 0.5 ? 1 : -1);
          sel.odds = clamp(Math.round((sel.odds + step) * 100) / 100, 1.03, 41);
          delta.set(`${m.id}:${sel.id}`, sel.odds - prev);
        })));
      }
    });
    lastTick = Date.now();
    patchOddsDom(delta);
    patchUpdatedLabel();
  }

  function patchOddsDom(delta) {
    $$('[data-oddkey]').forEach((el) => {
      const key = el.dataset.oddkey;
      const src = oddsIndex.get(key);
      if (!src) return;
      const v = Math.round(src.get() * 100) / 100;
      const valEl = el.querySelector('.odd-v');
      if (valEl && valEl.textContent !== oddsFmt(v)) {
        valEl.textContent = oddsFmt(v);
        const d = delta && delta.get(key);
        const dir = d != null ? d : (Number(el.dataset.last) ? v - Number(el.dataset.last) : 0);
        if (dir) {
          el.classList.remove('flash-up', 'flash-down');
          void el.offsetWidth;
          el.classList.add(dir > 0 ? 'flash-up' : 'flash-down');
          const tag = el.querySelector('.delta');
          if (tag) tag.textContent = dir > 0 ? '▲' : '▼';
          el.dataset.last = String(v);
          setTimeout(() => el.classList.remove('flash-up', 'flash-down'), 1100);
        }
      }
      // suspended state
      const susp = src.isSusp();
      if (susp !== el.classList.contains('susp')) {
        el.classList.toggle('susp', susp);
        let tag = el.querySelector('.susp-tag');
        if (susp && !tag) { tag = document.createElement('span'); tag.className = 'susp-tag'; tag.textContent = 'Suspended'; el.appendChild(tag); }
        if (!susp && tag) tag.remove();
      }
    });
    patchSlipLive();
  }

  function patchUpdatedLabel() {
    $$('[data-updated]').forEach((el) => { el.textContent = relTime(lastTick); });
  }

  /* suspension cycles — markets close briefly, then reopen */
  let suspStep = 0;
  const SUSP_TARGETS = [
    { market: 'popular', group: 'Total gol' },
    { market: 'corners', group: 'Total kartu' },
    { market: 'popular', group: 'Both teams to score' },
  ];
  function patchMarketHeads(m) {
    $$('.market').forEach((el) => {
      const g = (m.markets || []).flatMap((x) => x.groups).find((x) => x.name === el.dataset.group);
      if (!g) return;
      const any = g.sels.some((sel) => (sel._suspUntil || 0) > Date.now());
      const head = el.querySelector('.mk-head');
      if (!head) return;
      let tag = head.querySelector('.mk-susp');
      const note = head.querySelector('.n');
      if (any && !tag) {
        if (note) note.remove();
        tag = document.createElement('span');
        tag.className = 'mk-susp';
        tag.textContent = 'Suspended';
        head.appendChild(tag);
      } else if (!any && tag) {
        tag.remove();
        const n = document.createElement('span');
        n.className = 'n';
        n.textContent = g.note || '';
        head.appendChild(n);
      }
    });
  }

  function suspensionCycle() {
    const m = matchById('ars-bha');
    if (!m) return;
    const active = m._suspTarget;
    if (active) {
      const mk = m.markets.find((x) => x.id === active.market);
      const g = mk && mk.groups.find((x) => x.name === active.group);
      if (g) g.sels.forEach((sel) => { sel._suspUntil = 0; });
      m._suspTarget = null;
    } else {
      const target = SUSP_TARGETS[suspStep++ % SUSP_TARGETS.length];
      const mk = m.markets.find((x) => x.id === target.market);
      const g = mk && mk.groups.find((x) => x.name === target.group);
      if (g) {
        g.sels.forEach((sel) => { sel._suspUntil = Date.now() + 10000; });
        m._suspTarget = target;
        if (parseRoute().name === 'match' && parseRoute().id === m.id) {
          toast('Market suspended', `${g.name} closed temporarily. It reopens automatically.`, 'warn');
        }
      }
    }
    patchOddsDom();
    patchMarketHeads(m);
  }

  /* match clock */
  function clockTick() {
    let dirty = false;
    MATCHES.forEach((m) => {
      if (m.status !== 'live') return;
      if (m.sport === 'football') {
        m.minute = Math.min(90, m.minute + 1);
      } else if (m.clockLabel) {
        // label olahraga lain bergerak halus
        const secs = Math.floor((Date.now() - D.NOW) / 1000);
        m.clockLabel = m.sport === 'basketball'
          ? m.clockLabel.replace(/\d+:\d+$/, (x) => {
              const [mm, ss] = x.split(':').map(Number);
              const left = mm * 60 + ss - 1;
              const q = m.clockLabel.slice(0, 2);
              return `${q} ${Math.max(0, Math.floor(left / 60))}:${String(Math.max(0, left % 60)).padStart(2, '0')}`;
            })
          : m.clockLabel;
      }
      dirty = true;
    });
    // matches that kick off
    MATCHES.forEach((m) => {
      if (m.status === 'upcoming' && Date.now() >= m.kickoff) {
        m.status = 'live';
        m.minute = 1;
        m.score = [0, 0];
        m.clockLabel = m.sport === 'basketball' ? 'Q1 12:00' : m.sport === 'tennis' ? 'Set 1 · 0–0' : m.sport === 'esports' ? 'Map 1 · 0–0' : null;
        dirty = true;
        toast('Match started', `${team(m.home).name} v ${team(m.away).name} has just kicked off.`, 'info');
      }
    });
    if (!dirty) return;
    const r = parseRoute();
    if (r.name === 'bets') { renderPanel(); return; }
    $$('[data-live-min]').forEach((el) => {
      const m = matchById(el.dataset.liveMin);
      if (m) el.textContent = m.status === 'live' ? minTxt(m) : 'Finished';
    });
    $$('[data-clock]').forEach((el) => {
      const m = matchById(el.dataset.clock);
      if (m) el.textContent = m.status === 'live' ? minTxt(m) : 'Finished';
    });
    const byScore = {};
    $$('[data-score]').forEach((el) => { (byScore[el.dataset.score] = byScore[el.dataset.score] || []).push(el); });
    Object.entries(byScore).forEach(([id, els]) => {
      const m = matchById(id); if (!m) return;
      els.forEach((el, i) => { el.textContent = m.score[i % 2]; });
    });
    $$('[data-live-clock]').forEach((el) => {
      const m = matchById(el.dataset.liveClock);
      if (m) el.textContent = minTxt(m);
    });
  }

  /* sesekali gol — supaya papan skor terasa hidup */
  function goalTick() {
    const live = MATCHES.filter((m) => m.status === 'live' && m.sport === 'football');
    if (!live.length) return;
    if (Math.random() > 0.22) return;
    const m = live[Math.floor(Math.random() * live.length)];
    const side = Math.random() > 0.5 ? 0 : 1;
    m.score[side] += 1;
    const scorer = side === 0 ? team(m.home).name : team(m.away).name;
    toast('Gol!', `${scorer} mencetak gol. ${team(m.home).name} ${m.score[0]} – ${m.score[1]} ${team(m.away).name}`, 'info');
    const r = parseRoute();
    if (r.name === 'bets') return;
    if (r.name === 'home' || r.name === 'live' || r.name === 'football' || r.name === 'match') render({ preserveScroll: true });
  }

  /* countdown label */
  function countdownTick() {
    $$('[data-cd]').forEach((el) => {
      const ts = Number(el.dataset.cd);
      el.textContent = countdown(ts);
    });
  }

  function cashoutTick() {
    state.bets.forEach((b) => {
      if (b.status !== 'open') return;
      const drift = (Math.random() - 0.48) * 0.02;
      b.cashout = Math.max(1, Math.round((b.cashout || b.stake * 1.2) * (1 + drift) * 100) / 100);
    });
    if (parseRoute().name === 'bets') {
      $$('[data-cashval]').forEach((el) => {
        const b = state.bets.find((x) => x.id === el.dataset.cashval);
        if (b && b.status === 'open') el.textContent = `${money(b.cashout)} USDT`;
      });
    }
  }

  /* ------------------------------- follows ------------------------------ */
  const isFollowingTeam = (id) => state.follows.teams.includes(id);
  const isFollowingComp = (id) => state.follows.comps.includes(id);
  function toggleFollow(type, id) {
    const arr = type === 'team' ? state.follows.teams : state.follows.comps;
    const i = arr.indexOf(id);
    if (i >= 0) arr.splice(i, 1); else arr.push(id);
    save(); render({ preserveScroll: true });
    const name = type === 'team' ? team(id).name : comp(id).name;
    toast(i >= 0 ? 'Unfollow' : 'Following', i >= 0 ? `${name} removed from your follows.` : `${name} added — their fixtures now come first.`, 'info');
  }

  /* ------------------------------- slip -------------------------------- */
  const slipItem = (key) => state.slip.find((s) => s.key === key);
  function addSelection(matchId, selId) {
    const key = `${matchId}:${selId}`;
    const src = oddsIndex.get(key);
    const m = matchById(matchId);
    if (!src || !m) return;
    if (src.isSusp()) { toast('Selection suspended', 'Market is briefly closed. Try again.', 'warn'); return; }
    if (m.status === 'finished') { toast('Market closed', 'This match has finished.', 'warn'); return; }
    const i = state.slip.findIndex((s) => s.key === key);
    if (i >= 0) {
      state.slip.splice(i, 1);
      save(); refreshSlipSurfaces();
      return;
    }
    state.slip.push({
      key, matchId, selId, label: src.label, market: src.marketName,
      odds: Math.round(src.get() * 100) / 100, stake: 10, addedAt: Date.now(),
    });
    save();
    render({ preserveScroll: true });
    bumpSlipBar();
  }

  function stakeOf(it) { return Number(it.stake) || 0; }
  function totalStake() { return state.slip.reduce((a, it) => a + stakeOf(it), 0); }
  function totalReturn() { return state.slip.reduce((a, it) => a + stakeOf(it) * it.odds, 0); }
  function hasChanged() { return state.slip.some((it) => Math.abs(currentOdds(it.key) - it.odds) >= 0.03); }
  function hasSusp() { return state.slip.some((it) => { const s = oddsIndex.get(it.key); return s && s.isSusp(); }); }
  function slipBlockReason() {
    if (!state.slip.length) return 'Your slip is empty.';
    if (hasSusp()) return 'A selection is suspended.';
    if (hasChanged()) return 'Accept the new odds before placing.';
    if (state.slip.some((it) => stakeOf(it) < 1)) return 'Minimum stake is 1.00 USDT.';
    if (totalStake() > state.balance) return 'Demo balance is too low.';
    return '';
  }

  function acceptOdds(key) {
    const it = slipItem(key);
    if (!it) return;
    it.odds = currentOdds(key);
    it.acceptedAt = Date.now();
    save(); refreshSlipSurfaces();
    toast('Odds updated', `${it.label} · ${oddsFmt(it.odds)}`, 'info');
  }
  function declineOdds(key) {
    state.slip = state.slip.filter((s) => s.key !== key);
    save(); render({ preserveScroll: true });
    toast('Selection removed', 'Odds moved and were not accepted.', 'warn');
  }

  function placeBets() {
    if (slipBlockReason()) return;
    const btn = $('[data-place]');
    if (btn) { btn.disabled = true; btn.innerHTML = `<span class="spin"></span> Memproses…`; }
    const snapshot = state.slip.map((s) => ({ ...s }));
    setTimeout(() => {
      if (Math.random() < 0.12) {
        const reason = Math.random() > 0.5 ? 'Market closed while the bet was processing.' : 'Odds moved before the bet was accepted.';
        state.lastError = reason;
        save(); refreshSlipSurfaces();
        toast('Bet failed', reason + ' No funds were deducted.', 'err');
        return;
      }
      snapshot.forEach((s) => {
        state.bets.unshift({
          id: 'b-' + Math.random().toString(36).slice(2, 8),
          status: 'open', matchId: s.matchId, market: s.market, selection: s.label,
          odds: s.odds, stake: stakeOf(s), placed: Date.now(),
          cashout: Math.round(stakeOf(s) * s.odds * 0.86 * 100) / 100,
          fresh: true,
        });
      });
      state.balance = Math.round((state.balance - totalStake()) * 100) / 100;
      state.slip = [];
      state.lastError = '';
      state.mbTab = 'open';
      save();
      render();
      toast('Bet placed', `${snapshot.length} singles · ${money(snapshot.reduce((a, s) => a + stakeOf(s), 0))} USDT`, 'ok');
    }, 950);
  }

  function cashOut(betId) {
    const b = state.bets.find((x) => x.id === betId);
    if (!b || b.status !== 'open') return;
    const val = b.cashout || b.stake;
    b.status = 'cashed';
    b.payout = Math.round(val * 100) / 100;
    state.balance = Math.round((state.balance + val) * 100) / 100;
    state.cashConfirm = null;
    save(); render({ preserveScroll: true });
    toast('Cash out complete', `${money(val)} USDT masuk ke demo balance.`, 'ok');
  }

  /* --------------------------- slip rendering -------------------------- */
  function slipItemHTML(it, compact) {
    const m = matchById(it.matchId);
    const live = currentOdds(it.key);
    const susp = (oddsIndex.get(it.key) || { isSusp: () => false }).isSusp();
    const changed = Math.abs(live - it.odds) >= 0.03;
    const ret = stakeOf(it) * it.odds;
    const mins = m ? `${team(m.home).name} v ${team(m.away).name}` : 'Matches';
    return `
      <div class="slip-item" data-si="${esc(it.key)}">
        <div class="si-top">
          <div class="si-main">
            <div class="si-market">${esc(it.market)}</div>
            <div class="si-sel">${esc(it.label)}</div>
            <div class="si-match">${esc(mins)}${m && m.status === 'live' ? ` · <span style="color:var(--coral)">${minTxt(m)}</span>` : ''}</div>
          </div>
          <div class="si-right">
            <div class="si-odds ${changed || susp ? 'changed' : ''}">
              <span class="k">${changed ? 'New odds' : 'Odds'}</span>
              <span class="v">${oddsFmt(live)}</span>
            </div>
            <button class="si-x" data-act="remove-sel" data-key="${esc(it.key)}" aria-label="Remove ${esc(it.label)} from slip">${ic('x', 14)}</button>
          </div>
        </div>
        <div class="si-stake">
          <label class="stake-field">
            <input type="text" inputmode="decimal" value="${it.stake}" data-stake="${esc(it.key)}" aria-label="Stake for ${esc(it.label)}" />
            <span class="cur">USDT</span>
          </label>
          ${[10, 25, 50].map((v) => `<button class="stake-chip" data-act="stake-set" data-key="${esc(it.key)}" data-v="${v}">${v}</button>`).join('')}
          <button class="stake-chip" data-act="stake-set" data-key="${esc(it.key)}" data-v="max">Max</button>
          <div class="si-return">
            <span>Potential return</span>
            <b data-return="${esc(it.key)}">${money(ret)} USDT</b>
          </div>
        </div>
        <div class="warn-slot" data-warn="${esc(it.key)}">${warnHTML(it, susp, changed)}</div>
      </div>`;
  }

  function warnHTML(it, susp, changed) {
    if (susp) {
      return `<div class="si-warn danger"><span class="grow">Selection suspended. Wait for the market to reopen.</span>
        <div class="acts"><button class="mini-btn" data-act="remove-sel" data-key="${esc(it.key)}">Remove</button></div></div>`;
    }
    if (changed) {
      const live = currentOdds(it.key);
      return `<div class="si-warn"><span class="grow">Odds moved ${oddsFmt(it.odds)} → <b>${oddsFmt(live)}</b>. You must accept the new odds.</span>
        <div class="acts">
          <button class="mini-btn solid" data-act="accept-odds" data-key="${esc(it.key)}">Accept</button>
          <button class="mini-btn" data-act="decline-odds" data-key="${esc(it.key)}">Decline</button>
        </div></div>`;
    }
    return '';
  }

  function slipSummaryHTML() {
    const stake = totalStake();
    const ret = totalReturn();
    const reason = slipBlockReason();
    return `
      <div class="slip-summary">
        <div class="sum-row"><span>Singles</span><span class="v">${state.slip.length} ${state.slip.length === 1 ? 'selection' : 'selections'}</span></div>
        <div class="sum-row"><span>Total stake</span><span class="v">${money(stake)} USDT</span></div>
        <div class="sum-total">
          <span class="l">Potential return</span>
          <span class="v" data-total-return>${money(ret)}<small>USDT</small></span>
        </div>
        <button class="btn btn-primary btn-block place-btn" data-act="place" data-place ${state.slip.length && !reason ? '' : 'disabled'}>
          ${ic('ticket', 17)} ${state.slip.length ? `Place ${state.slip.length} ${state.slip.length === 1 ? 'bet' : 'bets'}` : 'Slip empty'}
        </button>
        <div class="sum-note">${ic('shield', 14)}<span>${reason || 'Decimal odds · stakes in USDT · demo balance, not real money.'}</span></div>
      </div>`;
  }

  function emptySlipHTML() {
    return `
      <div class="empty">
        <div class="mark">${ic('ticket', 24)}</div>
        <h3>Your slip is empty</h3>
        <p>Tap any odds to start. One selection = one single bet.</p>
        <div class="steps">
          <div class="step"><div class="k">01</div><div class="t">Pick odds on a match</div></div>
          <div class="step"><div class="k">02</div><div class="t">Set your USDT stake</div></div>
          <div class="step"><div class="k">03</div><div class="t">Place & track</div></div>
        </div>
        <a class="btn btn-ghost btn-sm" href="#/live">Browse live matches ${ic('arrow-r', 15)}</a>
      </div>`;
  }

  function slipHTML(mode) {
    const list = state.slip.map((it) => slipItemHTML(it, mode === 'drawer')).join('');
    return `
      <div class="card">
        <div class="card-head">
          <h3>Bet slip <span class="n">${state.slip.length}</span></h3>
          <span class="spacer"></span>
          ${state.slip.length ? `<button class="btn-quiet btn-sm" data-act="clear-slip">Clear</button>` : ''}
          ${mode === 'drawer' ? `<button class="iconbtn" data-act="close-drawer" aria-label="Close bet slip">${ic('x', 18)}</button>` : ''}
        </div>
        ${state.slip.length ? `<div class="slip-list">${list}</div>${slipSummaryHTML()}` : `<div class="card-body">${emptySlipHTML()}</div>`}
      </div>`;
  }

  function refreshSlipSurfaces() {
    if (drawer.classList.contains('open')) drawerBody.innerHTML = slipHTML('drawer');
    const pageSlot = $('[data-slip-slot]');
    if (pageSlot) pageSlot.innerHTML = slipHTML('page');
    renderSlipBar();
    renderPanel();
    syncOddsPressed();
    const emptySlot = $('[data-slip-empty]');
    if (emptySlot) emptySlot.hidden = state.slip.length > 0;
  }

  function syncOddsPressed() {
    $$('[data-oddkey]').forEach((el) => {
      el.setAttribute('aria-pressed', String(Boolean(slipItem(el.dataset.oddkey))));
    });
  }

  function patchSlipLive() {
    state.slip.forEach((it) => {
      const live = currentOdds(it.key);
      const susp = (oddsIndex.get(it.key) || { isSusp: () => false }).isSusp();
      const changed = Math.abs(live - it.odds) >= 0.03;
      $$(`[data-si="${it.key}"]`).forEach((root) => {
        const box = root.querySelector('.si-odds');
        if (box) {
          box.classList.toggle('changed', changed || susp);
          const v = box.querySelector('.v'); if (v) v.textContent = oddsFmt(live);
          const k = box.querySelector('.k'); if (k) k.textContent = changed ? 'New odds' : 'Odds';
        }
        const warn = root.querySelector('.warn-slot');
        if (warn && warn.dataset.state !== `${susp}|${changed}`) {
          warn.dataset.state = `${susp}|${changed}`;
          warn.innerHTML = warnHTML(it, susp, changed);
        }
      });
      const btn = $('[data-place]');
      if (btn && state.slip.length) {
        const reason = slipBlockReason();
        btn.disabled = Boolean(reason);
        const note = $('.sum-note span');
        if (note && reason) note.textContent = reason;
      }
    });
  }

  function renderSlipBar() {
    const n = state.slip.length;
    slipBar.hidden = n === 0 || parseRoute().name === 'bets';
    $('#slipBarCount').textContent = n;
    $('#slipBarMeta').textContent = `${money(totalStake())} USDT · ${money(totalReturn())}`;
  }
  function bumpSlipBar() {
    if (slipBar.hidden) return;
    slipBar.animate(
      [{ transform: 'translateY(0)' }, { transform: 'translateY(-4px)' }, { transform: 'translateY(0)' }],
      { duration: 280, easing: 'cubic-bezier(.2,.9,.2,1)' }
    );
  }

  /* ------------------------------- odds UI ----------------------------- */
  function oddBtn(matchId, sel, opts = {}) {
    const key = `${matchId}:${sel.id}`;
    const pressed = Boolean(slipItem(key));
    const susp = (sel._suspUntil || 0) > Date.now();
    const label = opts.label != null ? opts.label : sel.label;
    const aria = `${sel.label}, odds ${oddsFmt(sel.odds)}${susp ? ', suspended' : ''}`;
    return `<button class="odd ${susp ? 'susp' : ''}" data-act="odds" data-oddkey="${esc(key)}" data-match="${esc(matchId)}" data-sel="${esc(sel.id)}"
      aria-pressed="${pressed}" aria-label="${esc(aria)}"${susp ? ' aria-disabled="true"' : ''} data-last="${oddsFmt(sel.odds)}">
      <span class="odd-k">${esc(label)}</span>
      <span class="odd-v">${oddsFmt(sel.odds)}</span>
      <span class="delta" aria-hidden="true"></span>
      ${susp ? '<span class="susp-tag">Suspended</span>' : ''}
    </button>`;
  }

  function oddsSet(m, opts = {}) {
    const n = m.odds.d ? 3 : 2;
    const two = n === 2;
    const labels = { h: opts.h || '1', d: 'X', a: opts.a || '2' };
    const parts = [];
    ['h', 'd', 'a'].forEach((p) => {
      if (!(p in m.odds)) return;
      parts.push(oddBtn(m.id, { id: p, label: p === 'h' ? team(m.home).name : p === 'a' ? team(m.away).name : 'Draw', odds: m.odds[p] }, { label: labels[p] }));
    });
    return `<div class="odds" style="--n:${n}" role="group" aria-label="Odds hasil matches">${parts.join('')}</div>`;
  }

  /* ------------------------------ fixtures ----------------------------- */
  function fixtureRow(m, opts = {}) {
    const live = m.status === 'live';
    const finished = m.status === 'finished';
    const homeLead = live && m.score && m.score[0] > m.score[1];
    const awayLead = live && m.score && m.score[1] > m.score[0];
    const meta = live
      ? `<div class="fx-live"><span class="fx-min" data-live-min="${m.id}"><span class="live-dot"></span>${minTxt(m)}</span>
           <span class="fx-cd">${esc(comp(m.comp).name)}</span></div>`
      : finished
        ? `<div class="fx-live"><span class="fx-min" style="color:var(--mute)">Finished</span><span class="fx-cd">${esc(comp(m.comp).name)}</span></div>`
        : `<div class="fx-live"><span class="fx-time">${timeHM(m.kickoff)}</span><span class="fx-cd">${dayLabel(m.kickoff)} · <span data-cd="${m.kickoff}">${countdown(m.kickoff)}</span></span></div>`;
    const scoreHTML = live || finished ? `<span class="sc" ${live ? `data-score="${m.id}"` : ''}>${m.score[0]}</span>` : '';
    const scoreHTML2 = live || finished ? `<span class="sc" ${live ? `data-score="${m.id}"` : ''}>${m.score[1]}</span>` : '';
    return `
      <div class="fixture">
        <div class="fx-meta">${meta}</div>
        <a class="fx-teams" href="#/match/${m.id}" aria-label="Open ${esc(team(m.home).name)} vs ${esc(team(m.away).name)}">
          <div class="fx-team ${awayLead ? 'lose' : ''}">${crest(m.home)}<span class="nm">${esc(team(m.home).name)}</span>${scoreHTML}</div>
          <div class="fx-team ${homeLead ? 'lose' : ''}">${crest(m.away)}<span class="nm">${esc(team(m.away).name)}</span>${scoreHTML2}</div>
          ${opts.hideComp ? '' : `<div class="fx-sub">${esc(m.round || '')}${m.round ? ' <span class="dot"></span> ' : ''}${esc(comp(m.comp).country || '')}</div>`}
        </a>
        <div class="fx-odds">${oddsSet(m)}</div>
      </div>`;
  }

  function liveCard(m) {
    const homeLead = m.score[0] > m.score[1];
    const awayLead = m.score[1] > m.score[0];
    return `
      <article class="livecard">
        <a class="lc-top" href="#/match/${m.id}">
          <span class="lc-comp">${esc(comp(m.comp).name)}</span>
          <span class="lc-min"><span class="live-dot" aria-hidden="true"></span><span data-live-clock="${m.id}">${minTxt(m)}</span></span>
        </a>
        <a href="#/match/${m.id}" class="lc-teams" aria-label="Open ${esc(team(m.home).name)} vs ${esc(team(m.away).name)}">
          <div class="lc-team ${homeLead ? 'lead' : ''}">${crest(m.home)}<span class="nm">${esc(team(m.home).name)}</span><span class="sc" data-score="${m.id}">${m.score[0]}</span></div>
          <div class="lc-team ${awayLead ? 'lead' : ''}">${crest(m.away)}<span class="nm">${esc(team(m.away).name)}</span><span class="sc" data-score="${m.id}">${m.score[1]}</span></div>
        </a>
        <div class="lc-odds">${oddsSet(m)}</div>
      </article>`;
  }

  function followBtn(type, id, compact, withCrest) {
    const on = type === 'team' ? isFollowingTeam(id) : isFollowingComp(id);
    const name = type === 'team' ? team(id).name : comp(id).name;
    return `<button class="follow ${on ? 'on' : ''}" data-act="follow-${type}" data-id="${id}" aria-pressed="${on}" aria-label="${on ? 'Unfollow' : 'Follow'} ${esc(name)}">
      ${withCrest && type === 'team' ? crest(id, 'sm') : ic(on ? 'star-fill' : 'star', compact ? 12 : 13)}<span>${on ? 'Following' : 'Follow'}</span></button>`;
  }

  function listHead(compId) {
    const c = comp(compId);
    const liveCount = MATCHES.filter((m) => m.comp === compId && m.status === 'live').length;
    return `<div class="list-head">
      <span class="mk" style="--h:${c.tint}">${esc(c.mark)}</span>
      <span class="nm">${esc(c.name)}</span>
      <span class="ct">${liveCount ? `${liveCount} live` : esc(c.country)}</span>
      ${followBtn('comp', compId, true)}
    </div>`;
  }

  /* -------------------------------- pages ------------------------------ */
  function pageHome() {
    const live = MATCHES.filter((m) => m.status === 'live');
    const featured = matchById('ars-bha') || live[0];
    const others = live.filter((m) => m.id !== featured.id).slice(0, 3);
    const soon = MATCHES.filter((m) => m.status === 'upcoming').sort((a, b) => a.kickoff - b.kickoff).slice(0, 4);
    const hour = new Date().getHours();
    const greeting = hour < 12 ? 'Good morning' : hour < 18 ? 'Good afternoon' : 'Good evening';
    const soonCount = MATCHES.filter((m) => m.status === 'upcoming' && m.kickoff - Date.now() < 36e5).length;
    return `
    <div class="page">
      <div class="eyebrow" style="margin-bottom:8px">${greeting} · ${timeHM(Date.now())} local</div>
      <div class="sec-head" style="margin-bottom:14px">
        <h1 class="display">Tonight on the pitch.</h1>
      </div>
      <div class="meta-strip" style="margin:0 0 18px">
        <span class="it"><span class="live-dot"></span><b>${live.length}</b> live matches</span>
        <span class="it">${ic('clock', 13)}<b>${soonCount}</b> starting within an hour</span>
        <span class="it">${ic('wallet', 13)}Demo balance <b>${money(state.balance)} USDT</b></span>
      </div>

      <div class="chips" style="margin-bottom:20px">
        <a class="chip active" href="#/live">All sports</a>
        ${SPORTS.slice(0, 5).map((s) => `<a class="chip" href="#/live" data-act="sport-link" data-sport="${s.id}">${ic(s.icon, 14)}${s.name}<span class="n">${MATCHES.filter((m) => m.sport === s.id && m.status === 'live').length}</span></a>`).join('')}
      </div>

      ${featured ? heroHTML(featured) : ''}

      <section class="section">
        <div class="sec-head">
          <h2>Live now</h2>
          <span class="meta">${live.length} matches</span>
          <span class="spacer"></span>
          <a class="sec-link" href="#/live">See all ${ic('arrow-r', 14)}</a>
        </div>
        <div class="live-grid stagger">
          ${others.map(liveCard).join('')}
        </div>
      </section>

      <section class="section">
        <div class="sec-head">
          <h2>Starting soon</h2>
          <span class="meta">next 3 hours</span>
          <span class="spacer"></span>
          <a class="sec-link" href="#/football">Football ${ic('arrow-r', 14)}</a>
        </div>
        <div class="panel-list">
          ${soon.map((m) => fixtureRow(m)).join('')}
        </div>
      </section>

      <section class="section">
        <div class="sec-head">
          <h2>Top competitions</h2>
          <span class="meta">5 leagues</span>
        </div>
        <div class="comp-grid">
          ${['pl', 'ucl', 'lal', 'sa', 'bun'].map((id) => compTile(id)).join('')}
        </div>
      </section>
    </div>`;
  }

  function heroHTML(m) {
    const c = comp(m.comp);
    return `
    <section class="spot">
      <svg class="spot-waves wavesvg" viewBox="0 0 520 300" aria-hidden="true">
        <path d="M0,240 C90,240 110,160 200,160 C290,160 320,250 410,250 C460,250 500,215 520,190"/>
        <path d="M0,270 C100,270 130,205 220,205 C310,205 340,275 430,275 C475,275 505,255 520,240"/>
        <path d="M0,300 C110,300 150,250 240,250 C330,250 360,300 450,300"/>
      </svg>
      <div class="spot-copy">
        <div class="eyebrow">
          <span class="live-chip"><span class="live-dot"></span>Live</span>
          <span class="sep"></span>${esc(c.name)}
          <span class="sep"></span>${esc(m.round || '')}
        </div>
        <h1 class="display">Odds move,<br><em>every</em> second.</h1>
        <p class="spot-note">Scores and clocks run on their own here. Markets shift every few seconds — your slip asks you to confirm when odds move.</p>
        <div class="spot-actions">
          <a class="btn btn-primary" href="#/match/${m.id}">Open match ${ic('arrow-r', 16)}</a>
          <a class="btn btn-ghost" href="#/live">All live</a>
        </div>
        <div class="meta-strip">
          <span class="it">${ic('clock', 13)}<b>${esc(m.venue || '')}</b></span>
          <span class="it">${ic('ticket', 13)}<b>${(m.markets || []).length}</b> market groups</span>
          <span class="it">${ic('shield', 13)}Markets can be suspended</span>
        </div>
      </div>
      <div class="spot-board">
        <div class="sb-top">
          <span class="sb-comp">${esc(c.name)} · ${esc(m.venue || '')}</span>
          <span class="sb-live"><span class="live-dot"></span><span data-clock="${m.id}">${minTxt(m)}</span></span>
        </div>
        <div class="sb-team ${m.score[0] > m.score[1] ? 'lead' : ''}">${crest(m.home, 'lg')}<span class="nm">${esc(team(m.home).name)}</span><span class="sc" data-score="${m.id}">${m.score[0]}</span></div>
        <div class="sb-team ${m.score[1] > m.score[0] ? 'lead' : ''}">${crest(m.away, 'lg')}<span class="nm">${esc(team(m.away).name)}</span><span class="sc" data-score="${m.id}">${m.score[1]}</span></div>
        <div class="sb-foot">
          <span>${minTxt(m)} · 2nd half</span>
          ${oddsSet(m)}
        </div>
      </div>
    </section>`;
  }

  function compTile(id, cls = '') {
    const c = comp(id);
    const n = MATCHES.filter((m) => m.comp === id).length;
    const live = MATCHES.filter((m) => m.comp === id && m.status === 'live').length;
    return `<div class="comptile ${cls}">
      <a class="tile-link" href="#/football" data-act="open-comp" data-comp="${id}" aria-label="Open ${esc(c.name)}"></a>
      <span class="comp-mark" style="--h:${c.tint}">${esc(c.mark)}</span>
      <div class="comp-txt"><div class="nm">${esc(c.name)}</div><div class="ct">${live ? `<span style="color:var(--coral)">${live} live</span> · ` : ''}${n} matches</div></div>
      <span class="comp-tile-follow">${followBtn('comp', id, true)}</span>
    </div>`;
  }

  function pageLive() {
    const sport = state.liveSport || 'all';
    const sportName = sport === 'all' ? 'all sports' : (SPORTS.find((s) => s.id === sport) || {}).name;
    const only = state.onlyFollowed;
    let list = MATCHES.filter((m) => m.status === 'live');
    if (sport !== 'all') list = list.filter((m) => m.sport === sport);
    if (only) list = list.filter((m) => isFollowingTeam(m.home) || isFollowingTeam(m.away) || isFollowingComp(m.comp));
    const compFilter = state.liveComp || 'all';
    if (compFilter !== 'all') list = list.filter((m) => m.comp === compFilter);
    const groups = {};
    list.forEach((m) => { (groups[m.comp] = groups[m.comp] || []).push(m); });
    const soon = MATCHES.filter((m) => m.status === 'upcoming').sort((a, b) => a.kickoff - b.kickoff).slice(0, 3);
    const compsAvailable = Array.from(new Set(MATCHES.filter((m) => m.status === 'live' && (sport === 'all' || m.sport === sport)).map((m) => m.comp)));

    return `
    <div class="page">
      <div class="sec-head" style="align-items:flex-start;margin-bottom:6px">
        <div>
          <div class="eyebrow" style="margin-bottom:9px"><span class="live-chip"><span class="live-dot"></span>Live</span><span class="sep"></span>${esc(sportName)}</div>
          <h1 class="display">Everything in play,<br><em>right now.</em></h1>
        </div>
        <span class="spacer"></span>
        <div style="text-align:right">
          <div class="num" style="font-family:var(--serif);font-size:36px;line-height:1;color:var(--aqua)">${list.length}</div>
          <div style="font-size:10px;letter-spacing:.14em;text-transform:uppercase;color:var(--faint);margin-top:4px">matches</div>
          <div style="font-size:10px;color:var(--faint);margin-top:6px">updated <span data-updated>just now</span></div>
        </div>
      </div>

      <div class="toolbar" style="margin-top:18px">
        <div class="chips">
          <button class="chip ${sport === 'all' ? 'active' : ''}" data-act="live-sport" data-sport="all">All<span class="n">${MATCHES.filter((m) => m.status === 'live').length}</span></button>
          ${SPORTS.map((s) => {
            const n = MATCHES.filter((m) => m.status === 'live' && m.sport === s.id).length;
            return `<button class="chip ${sport === s.id ? 'active' : ''}" data-act="live-sport" data-sport="${s.id}">${ic(s.icon, 14)}${s.name}<span class="n">${n}</span></button>`;
          }).join('')}
        </div>
        <div class="right">
          <label class="select">
            <select data-act="live-comp" aria-label="Filter competition">
              <option value="all">All competitions</option>
              ${compsAvailable.map((id) => `<option value="${id}" ${compFilter === id ? 'selected' : ''}>${esc(comp(id).name)}</option>`).join('')}
            </select>
          </label>
          <label class="toggle">
            <input type="checkbox" data-act="only-followed" ${only ? 'checked' : ''} />
            <span class="sw"></span><span>Following</span>
          </label>
        </div>
      </div>

      ${list.length ? Object.keys(groups).map((cid) => `
        <section class="section" style="margin-top:18px">
          <div class="panel-list">
            ${listHead(cid)}
            ${groups[cid].sort((a, b) => b.minute - a.minute).map((m) => fixtureRow(m, { hideComp: true })).join('')}
          </div>
        </section>`).join('') : `
        <div class="empty" style="margin-top:18px">
          <div class="mark">${ic('live', 24)}</div>
          <h3>Nothing live right now</h3>
          <p>No ${esc(sportName)} match is in play with these filters. Here is what starts soon.</p>
        </div>
        <section class="section">
          <div class="sec-head"><h2>Starting soon</h2><span class="meta">next 3 fixtures</span></div>
          <div class="panel-list">${soon.map((m) => fixtureRow(m)).join('')}</div>
        </section>`}

      ${list.length ? `<p style="font-size:10.5px;color:var(--faint);margin-top:18px">Scores and clocks are sample data that update automatically.</p>` : ''}
    </div>`;
  }

  function pageFootball() {
    const comps = ['pl', 'ucl', 'lal', 'sa', 'bun'];
    const active = state.footballComp || 'all';
    let matches = MATCHES.filter((m) => m.sport === 'football' && comps.includes(m.comp));
    if (active !== 'all') matches = matches.filter((m) => m.comp === active);
    if (state.onlyFollowed) matches = matches.filter((m) => isFollowingTeam(m.home) || isFollowingTeam(m.away) || isFollowingComp(m.comp));
    const followed = matches.filter((m) => isFollowingTeam(m.home) || isFollowingTeam(m.away));
    const rest = matches.filter((m) => !followed.includes(m));
    const grouped = {};
    rest.forEach((m) => { (grouped[m.comp] = grouped[m.comp] || []).push(m); });
    const order = { live: 0, upcoming: 1, finished: 2 };
    const sortM = (a, b) => (order[a.status] - order[b.status]) || ((a.kickoff || 0) - (b.kickoff || 0));

    return `
    <div class="page">
      <div class="eyebrow" style="margin-bottom:9px"><span class="live-chip"><span class="live-dot"></span>Live</span><span class="sep"></span>5 top European leagues</div>
      <div class="sec-head" style="margin-bottom:4px">
        <h1 class="display">Football,<br><em>without</em> the noise.</h1>
        <span class="spacer"></span>
        <div class="toolbar" style="margin:0">
          <label class="toggle">
            <input type="checkbox" data-act="only-followed" ${state.onlyFollowed ? 'checked' : ''} />
            <span class="sw"></span><span>Following only</span>
          </label>
        </div>
      </div>
      <p style="font-size:12.5px;color:var(--mute);max-width:52ch;margin-bottom:18px">Follow a team or competition to pin their fixtures to the top. Match-result odds sit on every row.</p>

      <div class="tabs" role="tablist">
        <button class="tab ${active === 'all' ? 'active' : ''}" data-act="football-tab" data-comp="all">All <span class="n">${MATCHES.filter((m) => m.sport === 'football').length}</span></button>
        ${comps.map((id) => `<button class="tab ${active === id ? 'active' : ''}" data-act="football-tab" data-comp="${id}">${esc(comp(id).name)} <span class="n">${MATCHES.filter((m) => m.comp === id).length}</span></button>`).join('')}
      </div>

      ${followed.length ? `
      <section class="section" style="margin-top:0">
        <div class="sec-head"><h2>For you</h2><span class="meta">teams you follow</span></div>
        <div class="panel-list">${followed.sort(sortM).map((m) => fixtureRow(m)).join('')}</div>
      </section>` : ''}

      ${Object.keys(grouped).length ? Object.keys(grouped).map((cid) => `
        <section class="section">
          <div class="panel-list">
            ${listHead(cid)}
            ${grouped[cid].sort(sortM).map((m) => fixtureRow(m, { hideComp: true })).join('')}
          </div>
        </section>`).join('') : `
        <div class="empty" style="margin-top:10px">
          <div class="mark">${ic('ball', 24)}</div>
          <h3>No fixtures here yet</h3>
          <p>Try another league, or turn off “Following only”.</p>
          <button class="btn btn-ghost btn-sm" data-act="football-tab" data-comp="all">See all leagues</button>
        </div>`}

      <p style="font-size:10.5px;color:var(--faint);margin-top:18px">Decimal odds. Markets can be suspended at any time. Sample data.</p>
    </div>`;
  }

  function pageMatch(r) {
    const m = matchById(r.id);
    if (!m) return notFound();
    const c = comp(m.comp);
    const marketId = state.matchMarket || 'popular';
    const market = (m.markets || []).find((x) => x.id === marketId) || (m.markets || [])[0];
    const live = m.status === 'live';
    const progress = live && m.sport === 'football' ? clamp((m.minute / 90) * 100, 2, 100) : 0;
    const related = MATCHES.filter((x) => x.comp === m.comp && x.id !== m.id).slice(0, 3);

    return `
    <div class="page">
      <nav class="breadcrumb" aria-label="Remah roti">
        <a href="#/football">Football</a>${ic('chev', 12)}
        <a href="#/football">${esc(c.name)}</a>${ic('chev', 12)}
        <span style="color:var(--txt-2)">${esc(team(m.home).name)} v ${esc(team(m.away).name)}</span>
      </nav>

      <section class="scoreboard">
        <div class="sb-crumb">
          <span>${esc(c.name)}</span><span class="sep" style="width:3px;height:3px;border-radius:50%;background:var(--faint)"></span>
          <span>${esc(m.round || 'This week')}</span><span class="sep" style="width:3px;height:3px;border-radius:50%;background:var(--faint)"></span>
          <span>${esc(m.venue || 'Stadium')}</span>
        </div>
        <div class="sb-main">
          <div class="sb-side">
            ${crest(m.home, 'lg')}
            <div style="min-width:0">
              <div class="nm">${esc(team(m.home).name)}</div>
              <div class="sub">Home</div>
            </div>
          </div>
          <div style="display:grid;justify-items:center">
            <div class="sb-score">
              <span data-score="${m.id}">${live || m.status === 'finished' ? m.score[0] : '–'}</span>
              <span class="dash">–</span>
              <span data-score="${m.id}">${live || m.status === 'finished' ? m.score[1] : '–'}</span>
            </div>
            <div class="sb-clock">
              ${live
                ? `<span class="clk"><span class="live-dot"></span><span data-clock="${m.id}">${minTxt(m)}</span> · 2nd half</span>`
                : m.status === 'finished'
                  ? `<span class="clk" style="color:var(--mute);background:rgba(255,255,255,.05);border-color:var(--line)">Finished</span>`
                  : `<span class="clk" style="color:var(--amber);background:rgba(242,180,92,.1);border-color:rgba(242,180,92,.24)">Mulai ${timeHM(m.kickoff)}</span>`}
            </div>
          </div>
          <div class="sb-side away">
            ${crest(m.away, 'lg')}
            <div style="min-width:0">
              <div class="nm">${esc(team(m.away).name)}</div>
              <div class="sub">Away</div>
            </div>
          </div>
        </div>
        ${live ? `<div class="sb-progress"><i style="width:${progress}%"></i></div>` : ''}
        <div class="sb-minirow">
          <div style="display:flex;align-items:center;gap:10px;flex-wrap:wrap">
            <span style="color:var(--txt-2)">Decimal odds</span>
            <span>·</span>
            <span>${market ? market.groups.length : 0} market groups</span>
            <span>·</span>
            <span>Markets can be suspended</span>
          </div>
          <div class="sb-actions">
            ${followBtn('team', m.home, false, true)}${followBtn('team', m.away, false, true)}
          </div>
        </div>
      </section>

      <div class="market-tabs">
        <div class="tabs" role="tablist" aria-label="Market groups">
          ${(m.markets || []).map((mk) => `<button class="tab ${market && mk.id === market.id ? 'active' : ''}" data-act="market-tab" data-market="${mk.id}">${esc(mk.name)}</button>`).join('')}
        </div>
      </div>

      ${market ? `<div class="market-grid stagger">
        ${market.groups.map((g) => {
          const anySusp = g.sels.some((s) => (s._suspUntil || 0) > Date.now());
          return `<div class="market" data-group="${esc(g.name)}">
            <div class="mk-head">
              <span class="t">${esc(g.name)}</span>
              ${anySusp ? '<span class="mk-susp">Suspended</span>' : `<span class="n">${esc(g.note || '')}</span>`}
            </div>
            <div class="mk-body">
              <div class="odds" style="--n:${g.sels.length}">
                ${g.sels.map((s) => oddBtn(m.id, s)).join('')}
              </div>
            </div>
          </div>`;
        }).join('')}
      </div>` : `<div class="empty"><div class="mark">${ic('ball', 22)}</div><h3>Markets not open yet</h3><p>Markets for this match appear closer to kick-off.</p></div>`}

      ${related.length ? `<section class="section">
        <div class="sec-head"><h2>More in ${esc(c.name)}</h2></div>
        <div class="panel-list">${related.map((x) => fixtureRow(x, { hideComp: true })).join('')}</div>
      </section>` : ''}
    </div>`;
  }

  function pageBets() {
    const tab = state.mbTab || 'open';
    const openBets = state.bets.filter((b) => b.status === 'open');
    const settled = state.bets.filter((b) => b.status !== 'open');
    const listed = tab === 'open' ? openBets : settled;
    const error = state.lastError;

    return `
    <div class="page">
      <div class="eyebrow" style="margin-bottom:9px">One page · slip and history</div>
      <div class="sec-head" style="margin-bottom:6px">
        <h1 class="display">Your <em>bets.</em></h1>
        <span class="spacer"></span>
        <div style="text-align:right">
          <div class="num" style="font-size:13px;font-weight:600">${money(state.balance)} <span style="font-size:9px;color:var(--mute);letter-spacing:.1em">USDT</span></div>
          <div style="font-size:9.5px;color:var(--faint);letter-spacing:.12em;text-transform:uppercase;margin-top:2px">demo balance</div>
        </div>
      </div>
      <p style="font-size:12.5px;color:var(--mute);max-width:56ch;margin-bottom:18px">Singles only — one selection, one ticket. Decimal odds, stakes in USDT.</p>

      <div class="seg mobile-only" style="margin-bottom:14px">
        <button class="seg-btn ${state.betsView !== 'mybets' ? 'active' : ''}" data-act="bets-view" data-view="slip">Slip <span class="n">${state.slip.length}</span></button>
        <button class="seg-btn ${state.betsView === 'mybets' ? 'active' : ''}" data-act="bets-view" data-view="mybets">My bets <span class="n">${state.bets.length}</span></button>
      </div>
      <div class="bets-layout">
        <div data-slip-slot class="${state.betsView === 'mybets' ? 'm-hide' : ''}">${slipHTML('page')}</div>

        <div class="card ${state.betsView === 'mybets' ? '' : 'm-hide'}">
          <div class="card-head">
            <h3>My bets</h3>
            <span class="spacer"></span>
            <span style="font-size:10.5px;color:var(--faint)">${state.bets.length} total</span>
          </div>
          <div class="mb-tabs" role="tablist">
            <button class="mb-tab ${tab === 'open' ? 'active' : ''}" data-act="mb-tab" data-tab="open">Open <span class="n">${openBets.length}</span></button>
            <button class="mb-tab ${tab === 'settled' ? 'active' : ''}" data-act="mb-tab" data-tab="settled">Settled <span class="n">${settled.length}</span></button>
          </div>
          <div class="bet-list">
            ${listed.length ? listed.map(betHTML).join('') : `<div class="card-body"><div class="empty" style="padding:28px 18px;border:0">
              <div class="mark">${ic('ticket', 22)}</div>
              <h3>${tab === 'open' ? 'No open bets yet' : 'No settled bets yet'}</h3>
              <p>${tab === 'open' ? 'Bets you place appear here with a live cash-out value.' : 'Your settled betting history shows here.'}</p>
            </div></div>`}
          </div>
          ${tab === 'open' && openBets.length ? `<div class="card-foot">
            <div style="display:flex;align-items:center;justify-content:space-between;gap:10px;font-size:11px;color:var(--faint)">
              <span>Open stake <b style="color:var(--txt-2)">${money(openBets.reduce((a, b) => a + b.stake, 0))} USDT</b></span>
              <span>Cash out <b style="color:var(--aqua)">${money(openBets.reduce((a, b) => a + (b.cashout || 0), 0))} USDT</b></span>
            </div>
          </div>` : ''}
        </div>
      </div>

      ${error ? `<div class="si-warn danger" style="margin-top:16px"><span class="grow">Last bet failed: ${esc(error)}</span><button class="mini-btn" data-act="clear-error">Dismiss</button></div>` : ''}
      <p style="font-size:10.5px;color:var(--faint);margin-top:16px;display:flex;align-items:center;gap:6px">${ic('shield', 13)} Prototype: no real transactions, no real player data.</p>
    </div>`;
  }

  function betHTML(b) {
    const m = matchById(b.matchId);
    const label = m ? `${team(m.home).name} v ${team(m.away).name}` : 'Sample match';
    const statusText = { open: 'Open', won: 'Won', lost: 'Lost', cashed: 'Cashed out', void: 'Void' }[b.status] || b.status;
    const confirm = state.cashConfirm === b.id;
    return `
      <div class="bet ${b.fresh ? 'entered' : ''}" data-bet="${b.id}">
        <div class="bet-top">
          <span class="bet-status ${b.status}">${statusText}</span>
          <span class="bet-time">${relTime(b.placed)}</span>
        </div>
        <div class="bet-sel">${esc(b.selection)} <span class="o">@ ${oddsFmt(b.odds)}</span></div>
        <div class="bet-meta">${esc(b.market)} · ${esc(label)}${b.score ? ` · ${esc(b.score)}` : ''}</div>
        <div class="bet-bottom">
          <div class="bet-money">
            <span>Stake <b>${money(b.stake)}</b></span>
            ${b.status === 'open' ? '' : `<span>${b.status === 'lost' ? 'Lost' : 'Returns'} <b style="color:${b.status === 'lost' ? 'var(--mute)' : 'var(--aqua)'}">${money(b.payout)}</b></span>`}
          </div>
          ${b.status === 'open' ? `<button class="cashout" data-act="cashout-ask" data-bet="${b.id}">Cash out <b data-cashval="${b.id}">${money(b.cashout)} USDT</b></button>` : ''}
        </div>
        ${confirm ? `<div class="co-confirm">
          <span class="grow">Cash out now for <b>${money(b.cashout)} USDT</b>? The value can change on confirmation.</span>
          <div class="acts"><button class="mini-btn solid" data-act="cashout-confirm" data-bet="${b.id}">Yes, cash out</button><button class="mini-btn" data-act="cashout-cancel">Cancel</button></div>
        </div>` : ''}
      </div>`;
  }

  function notFound() {
    return `<div class="page"><div class="empty" style="margin-top:40px"><div class="mark">${ic('search', 22)}</div><h3>Page not found</h3><p>This link does not exist in the prototype.</p><a class="btn btn-ghost btn-sm" href="#/">Back to home</a></div></div>`;
  }

  /* ------------------------------ chrome ------------------------------- */
  const railItems = [
    { key: 'home', label: 'Home', icon: 'home', href: '#/' },
    { key: 'live', label: 'Live', icon: 'live', href: '#/live', count: () => MATCHES.filter((m) => m.status === 'live').length },
    { key: 'football', label: 'Football', icon: 'ball', href: '#/football' },
    { key: 'bets', label: 'My bets', icon: 'ticket', href: '#/bets', count: () => state.bets.length },
  ];
  function renderRail() {
    $('#railNav').innerHTML = railItems.map((it) => `
      <a class="rail-item" href="${it.href}" data-rail="${it.key}">
        ${ic(it.icon, 19)}<span class="label">${it.label}</span>
        ${it.count ? `<span class="cnt">${it.count()}</span>` : ''}
      </a>`).join('');
    $('#railSports').innerHTML = SPORTS.map((s) => {
      const n = MATCHES.filter((m) => m.sport === s.id && m.status === 'live').length;
      return `<a class="rail-sport" href="#/live" data-sport-link="${s.id}">
        ${ic(s.icon, 17)}<span class="label">${s.name}</span>
        ${n ? `<span class="live-cnt">${n}</span>` : ''}
      </a>`;
    }).join('') + `<div style="margin-top:12px;padding:0 4px">
      <button class="btn-quiet btn-sm rail-reset" data-act="reset-demo">${ic('shield', 14)}<span class="rail-reset-label">Reset data demo</span></button>
    </div>`;
  }

  const railMap = { home: 'home', live: 'live', football: 'football', bets: 'bets', match: 'football' };
  function setActiveNav(r) {
    $$('.rail-item').forEach((el) => el.classList.toggle('active', el.dataset.rail === railMap[r.name]));
    $$('.mtab').forEach((el) => el.classList.toggle('active', el.dataset.tab === railMap[r.name]));
    $$('.rail-sport').forEach((el) => {
      el.classList.toggle('active', r.name === 'live' && state.liveSport !== 'all' && el.dataset.sportLink === state.liveSport);
    });
  }

  function renderPanel() {
    const live = MATCHES.filter((m) => m.status === 'live').slice(0, 5);
    const soon = MATCHES.filter((m) => m.status === 'upcoming').sort((a, b) => a.kickoff - b.kickoff).slice(0, 2);
    const peek = state.slip.length ? `
      <div class="slip-peek">
        <h4>Your slip <span class="n">${state.slip.length}</span></h4>
        <div class="rows">
          ${state.slip.slice(0, 3).map((it) => `<div class="row"><span class="sel">${esc(it.label)}</span><span class="ov">${oddsFmt(it.odds)}</span></div>`).join('')}
          ${state.slip.length > 3 ? `<div class="row"><span class="sel">+${state.slip.length - 3} lainnya</span><span class="ov"></span></div>` : ''}
        </div>
        <div class="tot"><span>Potential return</span><b>${money(totalReturn())} USDT</b></div>
        <button class="btn btn-primary btn-sm btn-block" data-act="open-drawer">Open bet slip ${ic('arrow-r', 14)}</button>
      </div>` : '';
    $('#panelBody').innerHTML = `
      ${peek}
      <div>
        <div class="panel-head"><span class="lbl">Live now</span><span class="ln"></span><a href="#/live">${live.length ? 'all' : 'view'}</a></div>
        ${live.length ? live.map((m) => `
          <a class="mini" href="#/match/${m.id}">
            <span class="mini-min" data-live-clock="${m.id}">${minTxt(m)}</span>
            <span class="mini-teams"><span>${esc(team(m.home).name)}</span><span>${esc(team(m.away).name)}</span></span>
            <span class="mini-score">
              <span class="${m.score[0] > m.score[1] ? 'win' : ''}" data-score="${m.id}">${m.score[0]}</span>
              <span class="${m.score[1] > m.score[0] ? 'win' : ''}" data-score="${m.id}">${m.score[1]}</span>
            </span>
          </a>`).join('') : `<p style="font-size:11.5px;color:var(--faint)">No live matches right now.</p>`}
      </div>
      <div>
        <div class="panel-head"><span class="lbl">Next up</span><span class="ln"></span><a href="#/football">all</a></div>
        ${soon.map((m) => `
          <a class="mini" href="#/match/${m.id}">
            <span class="mini-time">${timeHM(m.kickoff)}</span>
            <span class="mini-teams"><span>${esc(team(m.home).name)}</span><span>${esc(team(m.away).name)}</span></span>
            <span class="mini-time" data-cd="${m.kickoff}">${countdown(m.kickoff)}</span>
          </a>`).join('')}
      </div>
      <div>
        <div class="panel-head"><span class="lbl">Follow</span><span class="ln"></span></div>
        <div style="display:flex;flex-wrap:wrap;gap:6px">
          ${state.follows.teams.length
            ? state.follows.teams.map((t) => `<button class="chip" data-act="follow-team" data-id="${t}" style="height:27px;font-size:11px;padding:0 9px">${crest(t, 'sm')}${esc(team(t).short)}${ic('x', 11)}</button>`).join('')
            : `<p style="font-size:11.5px;color:var(--faint)">No teams followed yet.</p>`}
        </div>
      </div>`;
  }

  /* ------------------------------ router ------------------------------- */
  const pages = { home: pageHome, live: pageLive, football: pageFootball, match: pageMatch, bets: pageBets };
  function parseRoute() {
    const raw = (location.hash || '#/').replace(/^#\/?/, '');
    const [path] = raw.split('?');
    const parts = path.split('/').filter(Boolean);
    const name = parts[0] || 'home';
    return { name, id: parts[1] };
  }
  let lastRouteKey = '';
  function render(opts = {}) {
    const r = parseRoute();
    const key = `${r.name}/${r.id || ''}`;
    const fn = pages[r.name] || notFound;
    view.innerHTML = fn(r);
    setActiveNav(r);
    const bv = $('#balanceVal'); if (bv) bv.textContent = money(state.balance);
    renderRail();
    renderPanel();
    renderSlipBar();
    syncOddsPressed();
    if (!opts.preserveScroll && key !== lastRouteKey) window.scrollTo({ top: 0, behavior: 'instant' in document.body.style ? 'instant' : 'auto' });
    lastRouteKey = key;
    renderDrawerIfOpen();
    document.title = ({
      home: 'Housebets Sportsbook', live: 'Live · Housebets Sportsbook', football: 'Football · Housebets Sportsbook',
      match: `${team((matchById(r.id) || {}).home || '') ? team((matchById(r.id) || {}).home).name + ' v ' + team((matchById(r.id) || {}).away).name : 'Matches'} · Housebets`,
      bets: 'Slip & my bets · Housebets Sportsbook',
    })[r.name] || 'Housebets Sportsbook';
  }

  /* ------------------------------ drawer ------------------------------- */
  function openDrawer() {
    drawer.classList.add('open');
    drawer.setAttribute('aria-hidden', 'false');
    scrim.hidden = false;
    document.body.classList.add('no-scroll');
    drawerBody.innerHTML = slipHTML('drawer');
    const close = drawer.querySelector('[data-act="close-drawer"]');
    if (close) close.focus({ preventScroll: true });
  }
  function closeDrawer() {
    drawer.classList.remove('open');
    drawer.setAttribute('aria-hidden', 'true');
    scrim.hidden = true;
    document.body.classList.remove('no-scroll');
  }
  function renderDrawerIfOpen() { if (drawer.classList.contains('open')) drawerBody.innerHTML = slipHTML('drawer'); }

  /* ------------------------------- toast ------------------------------- */
  function toast(title, body, kind = 'info', action) {
    const box = $('#toasts');
    const el = document.createElement('div');
    el.className = `toast ${kind === 'err' ? 'err' : kind === 'warn' ? 'warn' : ''}`;
    const icon = kind === 'err' ? 'x' : kind === 'warn' ? 'clock' : 'check';
    el.innerHTML = `<span class="ic">${ic(icon, 13)}</span>
      <div style="min-width:0"><div class="tt">${esc(title)}</div>${body ? `<div class="tb">${esc(body)}</div>` : ''}
      ${action ? `<button class="link-a" style="margin-top:7px" data-toast-act>${esc(action.label)}</button>` : ''}</div>
      <button class="x" aria-label="Dismiss notification">${ic('x', 13)}</button>`;
    box.appendChild(el);
    const kill = () => { el.classList.add('out'); setTimeout(() => el.remove(), 260); };
    el.querySelector('.x').addEventListener('click', kill);
    if (action) el.querySelector('[data-toast-act]').addEventListener('click', () => { action.fn(); kill(); });
    setTimeout(kill, 4800);
    while (box.children.length > 3) box.firstElementChild.remove();
  }

  /* ------------------------------ palette ------------------------------ */
  let palIndex = [], palActive = 0, palFiltered = [];
  function buildPaletteIndex() {
    palIndex = [];
    Object.entries(TEAMS).forEach(([id, t]) => {
      const m = MATCHES.find((x) => (x.home === id || x.away === id) && x.status !== 'finished') || MATCHES.find((x) => x.home === id || x.away === id);
      palIndex.push({ group: 'Teams', name: t.name, sub: comp(t.comp).name, kind: 'team', team: id, match: m && m.id });
    });
    Object.values(COMPS).forEach((c) => palIndex.push({ group: 'Competitions', name: c.name, sub: c.country, kind: 'comp', comp: c.id }));
    PLAYERS.forEach((p) => {
      const m = MATCHES.find((x) => x.home === p.team || x.away === p.team);
      palIndex.push({ group: 'Players', name: p.name, sub: team(p.team).name, kind: 'player', match: m && m.id });
    });
    const feats = matchById('ars-bha');
    const seen = new Set();
    (feats.markets || []).forEach((mk) => mk.groups.forEach((g) => g.sels.forEach((s) => {
      const key = `${g.name}|${s.label}`;
      if (seen.has(key)) return;
      seen.add(key);
      palIndex.push({ group: 'Markets', name: g.name, sub: `${s.label} · ${oddsFmt(s.odds)}`, kind: 'market', match: 'ars-bha', market: mk.id });
    })));
    MATCHES.slice(0, 12).forEach((m) => palIndex.push({ group: 'Matches', name: `${team(m.home).name} v ${team(m.away).name}`, sub: comp(m.comp).name, kind: 'match', match: m.id }));
  }
  const norm = (s) => String(s).toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '');

  function openPalette() {
    $('#palette').hidden = false;
    document.body.classList.add('no-scroll');
    const inp = $('#paletteInput');
    inp.value = '';
    renderPalette('');
    setTimeout(() => inp.focus(), 30);
  }
  function closePalette() {
    $('#palette').hidden = true;
    document.body.classList.remove('no-scroll');
  }
  function renderPalette(q) {
    const query = norm(q.trim());
    let items = palIndex;
    if (query) items = palIndex.filter((i) => norm(i.name).includes(query) || norm(i.sub).includes(query));
    else {
      const curated = [
        palIndex.find((i) => i.kind === 'match' && i.match === 'ars-bha'),
        palIndex.find((i) => i.name === 'Premier League'),
        palIndex.find((i) => i.name === 'Champions League'),
        ...palIndex.filter((i) => i.kind === 'match').slice(0, 4),
        ...palIndex.filter((i) => i.kind === 'player').slice(0, 3),
      ].filter(Boolean);
      const uniq = [];
      curated.forEach((c) => { if (!uniq.includes(c)) uniq.push(c); });
      items = uniq;
    }
    // priority: teams, competitions, matches, players, markets
    const w = { Teams: 0, Competitions: 1, Matches: 2, Players: 3, Markets: 4 };
    items = items.slice().sort((a, b) => (w[a.group] - w[b.group]) || a.name.localeCompare(b.name)).slice(0, 26);
    palFiltered = items;
    palActive = 0;
    const box = $('#paletteResults');
    if (!items.length) {
      box.innerHTML = `<div class="pal-empty">No results for “${esc(q)}”.<br><span style="font-size:11px;color:var(--faint)">Try a team, player, or competition.</span></div>`;
      return;
    }
    let html = '', last = '';
    items.forEach((it, i) => {
      if (it.group !== last) { html += `<div class="pal-group">${it.group}</div>`; last = it.group; }
      const icon = it.kind === 'team' ? (it.team ? team(it.team).short : '') : it.kind === 'comp' ? (it.comp ? comp(it.comp).mark : '') : it.kind === 'player' ? 'P' : it.kind === 'market' ? '#' : 'v';
      html += `<div class="pal-item" role="option" data-i="${i}" aria-selected="${i === palActive}">
        <span class="k">${esc(icon)}</span>
        <span class="nm">${esc(it.name)}</span>
        <span class="sub">${esc(it.sub || '')}</span>
      </div>`;
    });
    box.innerHTML = html;
  }
  function palGo(it) {
    if (!it) return;
    closePalette();
    if (it.kind === 'comp') { state.footballComp = it.comp; save(); location.hash = '#/football'; render(); return; }
    if (it.match) {
      if (it.market) state.matchMarket = it.market;
      location.hash = `#/match/${it.match}`;
      render();
      return;
    }
    location.hash = '#/live';
  }
  function palKey(e) {
    if ($('#palette').hidden) return;
    const items = palFiltered;
    if (e.key === 'Escape') { closePalette(); return; }
    if (e.key === 'ArrowDown' || e.key === 'ArrowUp') {
      e.preventDefault();
      if (!items.length) return;
      palActive = (palActive + (e.key === 'ArrowDown' ? 1 : items.length - 1)) % items.length;
      $$('.pal-item').forEach((el) => el.setAttribute('aria-selected', String(Number(el.dataset.i) === palActive)));
      const active = $(`.pal-item[data-i="${palActive}"]`);
      if (active) active.scrollIntoView({ block: 'nearest' });
      return;
    }
    if (e.key === 'Enter') { e.preventDefault(); palGo(items[palActive]); }
  }

  /* ------------------------------- events ------------------------------ */
  document.addEventListener('click', (e) => {
    const palItem = e.target.closest('.pal-item');
    if (palItem) { palGo(palFiltered[Number(palItem.dataset.i)]); return; }
    if (e.target === $('#palette')) { closePalette(); return; }
    if (e.target.closest('#searchOpen')) { openPalette(); return; }
    if (e.target.closest('#alertsBtn')) { toast('No new notifications', 'Markets you follow will show up here.', 'info'); return; }
    if (e.target.closest('#userBtn') || e.target.closest('#balanceChip')) {
      toast('Demo account', `Play balance ${money(state.balance)} USDT. No real deposits or withdrawals.`, 'info'); return;
    }

    const el = e.target.closest('[data-act]');
    if (!el) {
      if (e.target.closest('[data-sport-link]')) {
        state.liveSport = e.target.closest('[data-sport-link]').dataset.sportLink;
        save(); location.hash = '#/live'; render();
      }
      return;
    }
    const act = el.dataset.act;
    switch (act) {
      case 'odds': {
        e.preventDefault();
        addSelection(el.dataset.match, el.dataset.sel);
        break;
      }
      case 'remove-sel': state.slip = state.slip.filter((s) => s.key !== el.dataset.key); save(); refreshSlipSurfaces(); break;
      case 'clear-slip':
        state.slip = []; save();
        if (drawer.classList.contains('open')) closeDrawer();
        render({ preserveScroll: true });
        toast('Slip cleared', 'All selections removed.', 'info'); break;
      case 'stake-set': {
        const it = slipItem(el.dataset.key); if (!it) break;
        const v = el.dataset.v === 'max' ? Math.max(1, Math.floor(state.balance / Math.max(1, state.slip.length) * 100) / 100) : Number(el.dataset.v);
        it.stake = v; save();
        $$(`[data-stake="${it.key}"]`).forEach((inp) => { inp.value = v; });
        updateTotals(it);
        break;
      }
      case 'accept-odds': acceptOdds(el.dataset.key); break;
      case 'decline-odds': declineOdds(el.dataset.key); break;
      case 'place': placeBets(); break;
      case 'open-drawer': openDrawer(); break;
      case 'close-drawer': closeDrawer(); break;
      case 'follow-team': toggleFollow('team', el.dataset.id); break;
      case 'follow-comp': toggleFollow('comp', el.dataset.id); break;
      case 'football-tab': state.footballComp = el.dataset.comp; save(); render({ preserveScroll: true }); break;
      case 'open-comp': state.footballComp = el.dataset.comp; save(); break;
      case 'sport-link': state.liveSport = el.dataset.sport; save(); break;
      case 'live-sport': state.liveSport = el.dataset.sport; state.liveComp = 'all'; save(); render({ preserveScroll: true }); break;
      case 'market-tab': state.matchMarket = el.dataset.market; save(); render({ preserveScroll: true }); break;
      case 'mb-tab': state.mbTab = el.dataset.tab; save(); render({ preserveScroll: true }); break;
      case 'bets-view': state.betsView = el.dataset.view; save(); render({ preserveScroll: true }); break;
      case 'cashout-ask': state.cashConfirm = el.dataset.bet; render({ preserveScroll: true }); break;
      case 'cashout-cancel': state.cashConfirm = null; render({ preserveScroll: true }); break;
      case 'cashout-confirm': cashOut(el.dataset.bet); break;
      case 'clear-error': state.lastError = ''; save(); render({ preserveScroll: true }); break;
      case 'reset-demo':
        localStorage.removeItem(KEY);
        location.hash = '#/';
        location.reload();
        break;
      default: break;
    }
  });

  document.addEventListener('change', (e) => {
    const el = e.target.closest('[data-act]');
    if (!el) return;
    if (el.dataset.act === 'live-comp') { state.liveComp = el.value; save(); render({ preserveScroll: true }); }
    if (el.dataset.act === 'only-followed') { state.onlyFollowed = el.checked; save(); render({ preserveScroll: true }); }
  });

  document.addEventListener('input', (e) => {
    const inp = e.target.closest('[data-stake]');
    if (inp) {
      const it = slipItem(inp.dataset.stake); if (!it) return;
      const v = inp.value.replace(/[^\d.]/g, '');
      const n = parseFloat(v);
      it.stake = Number.isFinite(n) ? Math.min(n, 99999) : 0;
      save();
      updateTotals(it);
      return;
    }
    if (e.target.closest('#paletteInput')) renderPalette(e.target.value);
  });

  document.addEventListener('focusout', (e) => {
    const inp = e.target.closest('[data-stake]');
    if (inp) {
      const it = slipItem(inp.dataset.stake); if (!it) return;
      if (!Number.isFinite(Number(it.stake)) || Number(it.stake) < 1) it.stake = 1;
      save();
      $$(`[data-stake="${it.key}"]`).forEach((x) => { x.value = it.stake; });
      updateTotals(it);
    }
  });

  function updateTotals(it) {
    if (it) $$(`[data-return="${it.key}"]`).forEach((el) => { el.textContent = `${money(stakeOf(it) * it.odds)} USDT`; });
    const stake = totalStake(), ret = totalReturn();
    $$('[data-total-return]').forEach((el) => { el.innerHTML = `${money(ret)}<small>USDT</small>`; });
    const reason = slipBlockReason();
    const btn = $('[data-place]');
    if (btn && state.slip.length) {
      btn.disabled = Boolean(reason);
      btn.innerHTML = `${ic('ticket', 17)} Place ${state.slip.length} ${state.slip.length === 1 ? 'bet' : 'bets'}`;
    }
    const note = $('.sum-note span');
    if (note) note.textContent = reason || 'Decimal odds · stakes in USDT · demo balance, not real money.';
    $('#slipBarMeta').textContent = `${money(stake)} USDT · ${money(ret)}`;
  }

  document.addEventListener('keydown', (e) => {
    if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'k') { e.preventDefault(); openPalette(); return; }
    if ($('#palette').hidden === false) { palKey(e); return; }
    if (e.key === 'Escape') {
      if (drawer.classList.contains('open')) { closeDrawer(); return; }
    }
    if (e.key === '/' && !/input|textarea/i.test((document.activeElement || {}).tagName || '')) {
      e.preventDefault(); openPalette();
    }
  });

  scrim.addEventListener('click', closeDrawer);
  $('#slipBar').addEventListener('click', openDrawer);
  window.addEventListener('hashchange', () => {
    if (drawer.classList.contains('open')) closeDrawer();
    render();
  });

  /* ------------------------------- timer ------------------------------- */
  buildPaletteIndex();
  render();
  setInterval(clockTick, 45000);
  setInterval(countdownTick, 1000);
  setInterval(driftOdds, 3200);
  setInterval(goalTick, 21000);
  setInterval(cashoutTick, 6000);
  setInterval(suspensionCycle, 21000);
  countdownTick();
})();
