/* ==========================================================================
   Housebets Sportsbook — prototipe interaktif (front-end only)
   Semua data adalah contoh. Tidak ada pemain, uang, atau taruhan sungguhan.
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
  const money = (n) => Number(n || 0).toLocaleString('id-ID', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  const oddsFmt = (n) => Number(n || 0).toFixed(2);
  const clamp = (n, a, b) => Math.min(b, Math.max(a, n));
  const ic = (name, size = 16) => `<svg width="${size}" height="${size}" aria-hidden="true"><use href="#i-${name}"/></svg>`;
  const esc = (s) => String(s == null ? '' : s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));

  function timeHM(ts) {
    return new Date(ts).toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit' }).replace(':', '.');
  }
  function dayLabel(ts) {
    const d = new Date(ts), n = new Date();
    const same = (a, b) => a.toDateString() === b.toDateString();
    if (same(d, n)) return 'Hari ini';
    const t = new Date(n.getTime() + 864e5);
    if (same(d, t)) return 'Besok';
    return d.toLocaleDateString('id-ID', { day: '2-digit', month: 'short' });
  }
  function countdown(ts) {
    const s = Math.max(0, Math.floor((ts - Date.now()) / 1000));
    if (s <= 0) return 'Mulai';
    if (s < 120) return `${String(Math.floor(s / 60)).padStart(2, '0')}:${String(s % 60).padStart(2, '0')}`;
    if (s < 3600) return `${Math.ceil(s / 60)} mnt`;
    return `${Math.floor(s / 3600)} jam ${String(Math.floor((s % 3600) / 60)).padStart(2, '0')}`;
  }
  function relTime(ts) {
    const s = Math.floor((Date.now() - ts) / 1000);
    if (s < 45) return 'baru saja';
    if (s < 3600) return `${Math.floor(s / 60)} mnt lalu`;
    if (s < 86400) return `${Math.floor(s / 3600)} jam lalu`;
    return `${Math.floor(s / 86400)} hr lalu`;
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
      const labels = { h: team(m.home).name, d: 'Seri', a: team(m.away).name };
      ['h', 'd', 'a'].forEach((p) => {
        if (!(p in m.odds)) return;
        const key = `${m.id}:${p}`;
        if (oddsIndex.has(key)) return;
        oddsIndex.set(key, {
          matchId: m.id, selId: p, label: labels[p], marketName: 'Hasil pertandingan',
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
      // 1X2 — selalu bergerak, kecil
      ['h', 'd', 'a'].forEach((p) => {
        if (!(p in m.odds)) return;
        if (m.odds[p] < 1.06) return;
        if (Math.random() > 0.4) return;
        const prev = m.odds[p];
        const step = (Math.random() * 0.06 + 0.01) * (Math.random() > 0.5 ? 1 : -1);
        m.odds[p] = clamp(Math.round((m.odds[p] + step) * 100) / 100, 1.05, 26);
        delta.set(`${m.id}:${p}`, m.odds[p] - prev);
      });
      // market pilihan: hanya untuk laga unggulan agar layar tidak terlalu ramai
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
        if (susp && !tag) { tag = document.createElement('span'); tag.className = 'susp-tag'; tag.textContent = 'Ditangguhkan'; el.appendChild(tag); }
        if (!susp && tag) tag.remove();
      }
    });
    patchSlipLive();
  }

  function patchUpdatedLabel() {
    $$('[data-updated]').forEach((el) => { el.textContent = relTime(lastTick); });
  }

  /* suspension cycles — pasar ditangguhkan sebentar, lalu dibuka lagi */
  let suspStep = 0;
  const SUSP_TARGETS = [
    { market: 'popular', group: 'Total gol' },
    { market: 'corners', group: 'Total kartu' },
    { market: 'popular', group: 'Kedua tim mencetak gol' },
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
        tag.textContent = 'Ditangguhkan';
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
          toast('Pasar ditangguhkan', `${g.name} ditutup sementara. Pasar dibuka lagi otomatis.`, 'warn');
        }
      }
    }
    patchOddsDom();
    patchMarketHeads(m);
  }

  /* jam pertandingan */
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
    // laga yang mulai
    MATCHES.forEach((m) => {
      if (m.status === 'upcoming' && Date.now() >= m.kickoff) {
        m.status = 'live';
        m.minute = 1;
        m.score = [0, 0];
        m.clockLabel = m.sport === 'basketball' ? 'Q1 12:00' : m.sport === 'tennis' ? 'Set 1 · 0–0' : m.sport === 'esports' ? 'Peta 1 · 0–0' : null;
        dirty = true;
        toast('Pertandingan dimulai', `${team(m.home).name} v ${team(m.away).name} baru saja kick-off.`, 'info');
      }
    });
    if (!dirty) return;
    const r = parseRoute();
    if (r.name === 'bets') { renderPanel(); return; }
    $$('[data-live-min]').forEach((el) => {
      const m = matchById(el.dataset.liveMin);
      if (m) el.textContent = m.status === 'live' ? minTxt(m) : 'Selesai';
    });
    $$('[data-clock]').forEach((el) => {
      const m = matchById(el.dataset.clock);
      if (m) el.textContent = m.status === 'live' ? minTxt(m) : 'Selesai';
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
    toast(i >= 0 ? 'Berhenti mengikuti' : 'Diikuti', i >= 0 ? `${name} dihapus dari daftar ikuti.` : `${name} ditambahkan — laga mereka muncul lebih dulu.`, 'info');
  }

  /* ------------------------------- slip -------------------------------- */
  const slipItem = (key) => state.slip.find((s) => s.key === key);
  function addSelection(matchId, selId) {
    const key = `${matchId}:${selId}`;
    const src = oddsIndex.get(key);
    const m = matchById(matchId);
    if (!src || !m) return;
    if (src.isSusp()) { toast('Pilihan ditangguhkan', 'Pasar sedang ditutup sebentar. Coba lagi.', 'warn'); return; }
    if (m.status === 'finished') { toast('Pasar ditutup', 'Pertandingan ini sudah selesai.', 'warn'); return; }
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
    if (!state.slip.length) return 'Slip masih kosong.';
    if (hasSusp()) return 'Ada pilihan yang sedang ditangguhkan.';
    if (hasChanged()) return 'Terima odds baru sebelum memasang.';
    if (state.slip.some((it) => stakeOf(it) < 1)) return 'Stake minimum 1.00 USDT.';
    if (totalStake() > state.balance) return 'Saldo demo tidak cukup.';
    return '';
  }

  function acceptOdds(key) {
    const it = slipItem(key);
    if (!it) return;
    it.odds = currentOdds(key);
    it.acceptedAt = Date.now();
    save(); refreshSlipSurfaces();
    toast('Odds diperbarui', `${it.label} · ${oddsFmt(it.odds)}`, 'info');
  }
  function declineOdds(key) {
    state.slip = state.slip.filter((s) => s.key !== key);
    save(); render({ preserveScroll: true });
    toast('Pilihan dibatalkan', 'Odds berubah dan tidak diterima.', 'warn');
  }

  function placeBets() {
    if (slipBlockReason()) return;
    const btn = $('[data-place]');
    if (btn) { btn.disabled = true; btn.innerHTML = `<span class="spin"></span> Memproses…`; }
    const snapshot = state.slip.map((s) => ({ ...s }));
    setTimeout(() => {
      if (Math.random() < 0.12) {
        const reason = Math.random() > 0.5 ? 'Pasar ditutup saat taruhan diproses.' : 'Odds berubah sebelum taruhan diterima.';
        state.lastError = reason;
        save(); refreshSlipSurfaces();
        toast('Taruhan gagal', reason + ' Tidak ada dana yang dipotong.', 'err');
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
      toast('Taruhan ditempatkan', `${snapshot.length} taruhan tunggal · ${money(snapshot.reduce((a, s) => a + stakeOf(s), 0))} USDT`, 'ok');
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
    toast('Cash out berhasil', `${money(val)} USDT masuk ke saldo demo.`, 'ok');
  }

  /* --------------------------- slip rendering -------------------------- */
  function slipItemHTML(it, compact) {
    const m = matchById(it.matchId);
    const live = currentOdds(it.key);
    const susp = (oddsIndex.get(it.key) || { isSusp: () => false }).isSusp();
    const changed = Math.abs(live - it.odds) >= 0.03;
    const ret = stakeOf(it) * it.odds;
    const mins = m ? `${team(m.home).name} v ${team(m.away).name}` : 'Pertandingan';
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
              <span class="k">${changed ? 'Odds baru' : 'Odds'}</span>
              <span class="v">${oddsFmt(live)}</span>
            </div>
            <button class="si-x" data-act="remove-sel" data-key="${esc(it.key)}" aria-label="Hapus ${esc(it.label)} dari slip">${ic('x', 14)}</button>
          </div>
        </div>
        <div class="si-stake">
          <label class="stake-field">
            <input type="text" inputmode="decimal" value="${it.stake}" data-stake="${esc(it.key)}" aria-label="Stake untuk ${esc(it.label)}" />
            <span class="cur">USDT</span>
          </label>
          ${[10, 25, 50].map((v) => `<button class="stake-chip" data-act="stake-set" data-key="${esc(it.key)}" data-v="${v}">${v}</button>`).join('')}
          <button class="stake-chip" data-act="stake-set" data-key="${esc(it.key)}" data-v="max">Maks</button>
          <div class="si-return">
            <span>Potensi kembali</span>
            <b data-return="${esc(it.key)}">${money(ret)} USDT</b>
          </div>
        </div>
        <div class="warn-slot" data-warn="${esc(it.key)}">${warnHTML(it, susp, changed)}</div>
      </div>`;
  }

  function warnHTML(it, susp, changed) {
    if (susp) {
      return `<div class="si-warn danger"><span class="grow">Pilihan sedang ditangguhkan. Tunggu pasar dibuka kembali.</span>
        <div class="acts"><button class="mini-btn" data-act="remove-sel" data-key="${esc(it.key)}">Hapus</button></div></div>`;
    }
    if (changed) {
      const live = currentOdds(it.key);
      return `<div class="si-warn"><span class="grow">Odds berubah ${oddsFmt(it.odds)} → <b>${oddsFmt(live)}</b>. Kamu harus menerima odds baru.</span>
        <div class="acts">
          <button class="mini-btn solid" data-act="accept-odds" data-key="${esc(it.key)}">Terima</button>
          <button class="mini-btn" data-act="decline-odds" data-key="${esc(it.key)}">Batalkan</button>
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
        <div class="sum-row"><span>Taruhan tunggal</span><span class="v">${state.slip.length} pilihan</span></div>
        <div class="sum-row"><span>Total stake</span><span class="v">${money(stake)} USDT</span></div>
        <div class="sum-total">
          <span class="l">Potensi kembali</span>
          <span class="v" data-total-return>${money(ret)}<small>USDT</small></span>
        </div>
        <button class="btn btn-primary btn-block place-btn" data-act="place" data-place ${state.slip.length && !reason ? '' : 'disabled'}>
          ${ic('ticket', 17)} ${state.slip.length ? `Pasang ${state.slip.length} taruhan` : 'Slip kosong'}
        </button>
        <div class="sum-note">${ic('shield', 14)}<span>${reason || 'Odds desimal · stake dalam USDT · saldo demo, bukan uang nyata.'}</span></div>
      </div>`;
  }

  function emptySlipHTML() {
    return `
      <div class="empty">
        <div class="mark">${ic('ticket', 24)}</div>
        <h3>Slip kamu kosong</h3>
        <p>Ketuk salah satu odds untuk mulai. Satu pilihan = satu taruhan tunggal.</p>
        <div class="steps">
          <div class="step"><div class="k">01</div><div class="t">Pilih odds pada laga</div></div>
          <div class="step"><div class="k">02</div><div class="t">Atur stake USDT</div></div>
          <div class="step"><div class="k">03</div><div class="t">Pasang & pantau</div></div>
        </div>
        <a class="btn btn-ghost btn-sm" href="#/live">Jelajahi pertandingan live ${ic('arrow-r', 15)}</a>
      </div>`;
  }

  function slipHTML(mode) {
    const list = state.slip.map((it) => slipItemHTML(it, mode === 'drawer')).join('');
    return `
      <div class="card">
        <div class="card-head">
          <h3>Slip taruhan <span class="n">${state.slip.length}</span></h3>
          <span class="spacer"></span>
          ${state.slip.length ? `<button class="btn-quiet btn-sm" data-act="clear-slip">Kosongkan</button>` : ''}
          ${mode === 'drawer' ? `<button class="iconbtn" data-act="close-drawer" aria-label="Tutup slip">${ic('x', 18)}</button>` : ''}
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
          const k = box.querySelector('.k'); if (k) k.textContent = changed ? 'Odds baru' : 'Odds';
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
    const aria = `${sel.label}, odds ${oddsFmt(sel.odds)}${susp ? ', ditangguhkan' : ''}`;
    return `<button class="odd ${susp ? 'susp' : ''}" data-act="odds" data-oddkey="${esc(key)}" data-match="${esc(matchId)}" data-sel="${esc(sel.id)}"
      aria-pressed="${pressed}" aria-label="${esc(aria)}"${susp ? ' aria-disabled="true"' : ''} data-last="${oddsFmt(sel.odds)}">
      <span class="odd-k">${esc(label)}</span>
      <span class="odd-v">${oddsFmt(sel.odds)}</span>
      <span class="delta" aria-hidden="true"></span>
      ${susp ? '<span class="susp-tag">Ditangguhkan</span>' : ''}
    </button>`;
  }

  function oddsSet(m, opts = {}) {
    const n = m.odds.d ? 3 : 2;
    const two = n === 2;
    const labels = { h: opts.h || '1', d: 'X', a: opts.a || '2' };
    const parts = [];
    ['h', 'd', 'a'].forEach((p) => {
      if (!(p in m.odds)) return;
      parts.push(oddBtn(m.id, { id: p, label: p === 'h' ? team(m.home).name : p === 'a' ? team(m.away).name : 'Seri', odds: m.odds[p] }, { label: labels[p] }));
    });
    return `<div class="odds" style="--n:${n}" role="group" aria-label="Odds hasil pertandingan">${parts.join('')}</div>`;
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
        ? `<div class="fx-live"><span class="fx-min" style="color:var(--mute)">Selesai</span><span class="fx-cd">${esc(comp(m.comp).name)}</span></div>`
        : `<div class="fx-live"><span class="fx-time">${timeHM(m.kickoff)}</span><span class="fx-cd">${dayLabel(m.kickoff)} · <span data-cd="${m.kickoff}">${countdown(m.kickoff)}</span></span></div>`;
    const scoreHTML = live || finished ? `<span class="sc" ${live ? `data-score="${m.id}"` : ''}>${m.score[0]}</span>` : '';
    const scoreHTML2 = live || finished ? `<span class="sc" ${live ? `data-score="${m.id}"` : ''}>${m.score[1]}</span>` : '';
    return `
      <div class="fixture">
        <div class="fx-meta">${meta}</div>
        <a class="fx-teams" href="#/match/${m.id}" aria-label="Buka ${esc(team(m.home).name)} vs ${esc(team(m.away).name)}">
          <div class="fx-team ${awayLead ? 'lose' : ''}">${crest(m.home)}<span class="nm">${esc(team(m.home).name)}</span>${scoreHTML}</div>
          <div class="fx-team ${homeLead ? 'lose' : ''}">${crest(m.away)}<span class="nm">${esc(team(m.away).name)}</span>${scoreHTML2}</div>
          ${opts.hideComp ? '' : `<div class="fx-sub">${esc(comp(m.comp).name)} <span class="dot"></span> ${esc(m.round || comp(m.comp).country || '')}</div>`}
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
        <a href="#/match/${m.id}" class="lc-teams" aria-label="Buka pertandingan ${esc(team(m.home).name)} vs ${esc(team(m.away).name)}">
          <div class="lc-team ${homeLead ? 'lead' : ''}">${crest(m.home)}<span class="nm">${esc(team(m.home).name)}</span><span class="sc" data-score="${m.id}">${m.score[0]}</span></div>
          <div class="lc-team ${awayLead ? 'lead' : ''}">${crest(m.away)}<span class="nm">${esc(team(m.away).name)}</span><span class="sc" data-score="${m.id}">${m.score[1]}</span></div>
        </a>
        <div class="lc-odds">${oddsSet(m)}</div>
      </article>`;
  }

  function followBtn(type, id, compact) {
    const on = type === 'team' ? isFollowingTeam(id) : isFollowingComp(id);
    const name = type === 'team' ? team(id).name : comp(id).name;
    return `<button class="follow ${on ? 'on' : ''}" data-act="follow-${type}" data-id="${id}" aria-pressed="${on}" aria-label="${on ? 'Berhenti mengikuti' : 'Ikuti'} ${esc(name)}">
      ${ic(on ? 'star-fill' : 'star', compact ? 12 : 13)}<span>${on ? 'Diikuti' : 'Ikuti'}</span></button>`;
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
    const greeting = hour < 11 ? 'Selamat pagi' : hour < 15 ? 'Selamat siang' : hour < 19 ? 'Selamat sore' : 'Selamat malam';
    const soonCount = MATCHES.filter((m) => m.status === 'upcoming' && m.kickoff - Date.now() < 36e5).length;
    return `
    <div class="page">
      <div class="eyebrow" style="margin-bottom:8px">${greeting} · ${timeHM(Date.now())} WIB</div>
      <div class="sec-head" style="margin-bottom:14px">
        <h1 class="display">Malam ini di lapangan.</h1>
      </div>
      <div class="meta-strip" style="margin:0 0 18px">
        <span class="it"><span class="live-dot"></span><b>${live.length}</b> pertandingan live</span>
        <span class="it">${ic('clock', 13)}<b>${soonCount}</b> mulai dalam 1 jam</span>
        <span class="it">${ic('wallet', 13)}Saldo demo <b>${money(state.balance)} USDT</b></span>
      </div>

      <div class="chips" style="margin-bottom:20px">
        <a class="chip active" href="#/live">Semua olahraga</a>
        ${SPORTS.slice(0, 5).map((s) => `<a class="chip" href="#/live" data-act="sport-link" data-sport="${s.id}">${ic(s.icon, 14)}${s.name}<span class="n">${MATCHES.filter((m) => m.sport === s.id && m.status === 'live').length}</span></a>`).join('')}
      </div>

      ${featured ? heroHTML(featured) : ''}

      <section class="section">
        <div class="sec-head">
          <h2>Live sekarang</h2>
          <span class="meta">${live.length} pertandingan</span>
          <span class="spacer"></span>
          <a class="sec-link" href="#/live">Lihat semua ${ic('arrow-r', 14)}</a>
        </div>
        <div class="live-grid stagger">
          ${others.map(liveCard).join('')}
        </div>
      </section>

      <section class="section">
        <div class="sec-head">
          <h2>Segera mulai</h2>
          <span class="meta">dalam 3 jam</span>
          <span class="spacer"></span>
          <a class="sec-link" href="#/football">Sepak bola ${ic('arrow-r', 14)}</a>
        </div>
        <div class="panel-list">
          ${soon.map((m) => fixtureRow(m)).join('')}
        </div>
      </section>

      <section class="section">
        <div class="sec-head">
          <h2>Kompetisi populer</h2>
          <span class="meta">5 liga</span>
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
        <h1 class="display">Pasar bergerak,<br><em>tiap</em> detik.</h1>
        <p class="spot-note">Skor dan menit di prototipe ini hidup sendiri. Pasar berubah tiap beberapa detik — slip akan meminta konfirmasi kalau odds bergeser.</p>
        <div class="spot-actions">
          <a class="btn btn-primary" href="#/match/${m.id}">Buka pertandingan ${ic('arrow-r', 16)}</a>
          <a class="btn btn-ghost" href="#/live">Semua live</a>
        </div>
        <div class="meta-strip">
          <span class="it">${ic('clock', 13)}<b>${esc(m.venue || '')}</b></span>
          <span class="it">${ic('ticket', 13)}<b>${(m.markets || []).length}</b> grup pasar</span>
          <span class="it">${ic('shield', 13)}Pasar dapat ditangguhkan</span>
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
          <span>${minTxt(m)} · Babak 2</span>
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
      <a class="tile-link" href="#/football" data-act="open-comp" data-comp="${id}" aria-label="Buka ${esc(c.name)}"></a>
      <span class="comp-mark" style="--h:${c.tint}">${esc(c.mark)}</span>
      <div class="comp-txt"><div class="nm">${esc(c.name)}</div><div class="ct">${live ? `<span style="color:var(--coral)">${live} live</span> · ` : ''}${n} pertandingan</div></div>
      <span class="comp-tile-follow">${followBtn('comp', id, true)}</span>
    </div>`;
  }

  function pageLive() {
    const sport = state.liveSport || 'all';
    const sportName = sport === 'all' ? 'semua olahraga' : (SPORTS.find((s) => s.id === sport) || {}).name;
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
          <h1 class="display">Semua yang hidup,<br><em>sekarang.</em></h1>
        </div>
        <span class="spacer"></span>
        <div style="text-align:right">
          <div class="num" style="font-family:var(--serif);font-size:36px;line-height:1;color:var(--aqua)">${list.length}</div>
          <div style="font-size:10px;letter-spacing:.14em;text-transform:uppercase;color:var(--faint);margin-top:4px">pertandingan</div>
          <div style="font-size:10px;color:var(--faint);margin-top:6px">diperbarui <span data-updated>baru saja</span></div>
        </div>
      </div>

      <div class="toolbar" style="margin-top:18px">
        <div class="chips">
          <button class="chip ${sport === 'all' ? 'active' : ''}" data-act="live-sport" data-sport="all">Semua<span class="n">${MATCHES.filter((m) => m.status === 'live').length}</span></button>
          ${SPORTS.map((s) => {
            const n = MATCHES.filter((m) => m.status === 'live' && m.sport === s.id).length;
            if (!n) return '';
            return `<button class="chip ${sport === s.id ? 'active' : ''}" data-act="live-sport" data-sport="${s.id}">${ic(s.icon, 14)}${s.name}<span class="n">${n}</span></button>`;
          }).join('')}
        </div>
        <div class="right">
          <label class="select">
            <select data-act="live-comp" aria-label="Filter kompetisi">
              <option value="all">Semua kompetisi</option>
              ${compsAvailable.map((id) => `<option value="${id}" ${compFilter === id ? 'selected' : ''}>${esc(comp(id).name)}</option>`).join('')}
            </select>
          </label>
          <label class="toggle">
            <input type="checkbox" data-act="only-followed" ${only ? 'checked' : ''} />
            <span class="sw"></span><span>Diikuti</span>
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
          <h3>Tidak ada yang live</h3>
          <p>Tidak ada pertandingan ${esc(sportName)} yang sedang berlangsung dengan filter ini. Berikut yang segera mulai.</p>
        </div>
        <section class="section">
          <div class="sec-head"><h2>Segera mulai</h2><span class="meta">3 laga terdekat</span></div>
          <div class="panel-list">${soon.map((m) => fixtureRow(m)).join('')}</div>
        </section>`}

      ${list.length ? `<p style="font-size:10.5px;color:var(--faint);margin-top:18px">Skor dan menit adalah data contoh yang bergerak otomatis untuk prototipe.</p>` : ''}
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
      <div class="eyebrow" style="margin-bottom:9px"><span class="live-chip"><span class="live-dot"></span>Live</span><span class="sep"></span>5 liga top Eropa</div>
      <div class="sec-head" style="margin-bottom:4px">
        <h1 class="display">Sepak bola,<br><em>tanpa</em> kebisingan.</h1>
        <span class="spacer"></span>
        <div class="toolbar" style="margin:0">
          <label class="toggle">
            <input type="checkbox" data-act="only-followed" ${state.onlyFollowed ? 'checked' : ''} />
            <span class="sw"></span><span>Hanya diikuti</span>
          </label>
        </div>
      </div>
      <p style="font-size:12.5px;color:var(--mute);max-width:52ch;margin-bottom:18px">Ikuti tim atau kompetisi untuk menaruh laga mereka di paling atas. Odds hasil pertandingan ada di setiap baris.</p>

      <div class="tabs" role="tablist">
        <button class="tab ${active === 'all' ? 'active' : ''}" data-act="football-tab" data-comp="all">Semua <span class="n">${MATCHES.filter((m) => m.sport === 'football').length}</span></button>
        ${comps.map((id) => `<button class="tab ${active === id ? 'active' : ''}" data-act="football-tab" data-comp="${id}">${esc(comp(id).name)} <span class="n">${MATCHES.filter((m) => m.comp === id).length}</span></button>`).join('')}
      </div>

      ${followed.length ? `
      <section class="section" style="margin-top:0">
        <div class="sec-head"><h2>Untukmu</h2><span class="meta">tim yang kamu ikuti</span></div>
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
          <h3>Belum ada laga di sini</h3>
          <p>Coba pilih liga lain, atau matikan filter “Hanya diikuti”.</p>
          <button class="btn btn-ghost btn-sm" data-act="football-tab" data-comp="all">Lihat semua liga</button>
        </div>`}

      <p style="font-size:10.5px;color:var(--faint);margin-top:18px">Odds desimal. Pasar dapat ditangguhkan kapan saja. Data contoh.</p>
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
        <a href="#/football">Sepak bola</a>${ic('chev', 12)}
        <a href="#/football">${esc(c.name)}</a>${ic('chev', 12)}
        <span style="color:var(--txt-2)">${esc(team(m.home).name)} v ${esc(team(m.away).name)}</span>
      </nav>

      <section class="scoreboard">
        <div class="sb-crumb">
          <span>${esc(c.name)}</span><span class="sep" style="width:3px;height:3px;border-radius:50%;background:var(--faint)"></span>
          <span>${esc(m.round || 'Pekan ini')}</span><span class="sep" style="width:3px;height:3px;border-radius:50%;background:var(--faint)"></span>
          <span>${esc(m.venue || 'Stadion')}</span>
        </div>
        <div class="sb-main">
          <div class="sb-side">
            ${crest(m.home, 'lg')}
            <div style="min-width:0">
              <div class="nm">${esc(team(m.home).name)}</div>
              <div class="sub">${isFollowingTeam(m.home) ? 'Diikuti' : 'Tuan rumah'}</div>
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
                ? `<span class="clk"><span class="live-dot"></span><span data-clock="${m.id}">${minTxt(m)}</span> · Babak 2</span>`
                : m.status === 'finished'
                  ? `<span class="clk" style="color:var(--mute);background:rgba(255,255,255,.05);border-color:var(--line)">Selesai</span>`
                  : `<span class="clk" style="color:var(--amber);background:rgba(242,180,92,.1);border-color:rgba(242,180,92,.24)">Mulai ${timeHM(m.kickoff)}</span>`}
            </div>
          </div>
          <div class="sb-side away">
            ${crest(m.away, 'lg')}
            <div style="min-width:0">
              <div class="nm">${esc(team(m.away).name)}</div>
              <div class="sub">${isFollowingTeam(m.away) ? 'Diikuti' : 'Tandang'}</div>
            </div>
          </div>
        </div>
        ${live ? `<div class="sb-progress"><i style="width:${progress}%"></i></div>` : ''}
        <div class="sb-minirow">
          <div style="display:flex;align-items:center;gap:10px;flex-wrap:wrap">
            <span style="color:var(--txt-2)">Odds desimal</span>
            <span>·</span>
            <span>${market ? market.groups.length : 0} grup pasar</span>
            <span>·</span>
            <span>Pasar bisa ditangguhkan</span>
          </div>
          <div class="sb-actions">
            ${followBtn('team', m.home)}${followBtn('team', m.away)}
          </div>
        </div>
      </section>

      <div class="market-tabs">
        <div class="tabs" role="tablist" aria-label="Grup pasar">
          ${(m.markets || []).map((mk) => `<button class="tab ${market && mk.id === market.id ? 'active' : ''}" data-act="market-tab" data-market="${mk.id}">${esc(mk.name)}</button>`).join('')}
        </div>
      </div>

      ${market ? `<div class="market-grid stagger">
        ${market.groups.map((g) => {
          const anySusp = g.sels.some((s) => (s._suspUntil || 0) > Date.now());
          return `<div class="market" data-group="${esc(g.name)}">
            <div class="mk-head">
              <span class="t">${esc(g.name)}</span>
              ${anySusp ? '<span class="mk-susp">Ditangguhkan</span>' : `<span class="n">${esc(g.note || '')}</span>`}
            </div>
            <div class="mk-body">
              <div class="odds" style="--n:${g.sels.length}">
                ${g.sels.map((s) => oddBtn(m.id, s)).join('')}
              </div>
            </div>
          </div>`;
        }).join('')}
      </div>` : `<div class="empty"><div class="mark">${ic('ball', 22)}</div><h3>Pasar belum dibuka</h3><p>Pasar untuk pertandingan ini akan muncul mendekati kick-off.</p></div>`}

      ${related.length ? `<section class="section">
        <div class="sec-head"><h2>Lainnya di ${esc(c.name)}</h2></div>
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
      <div class="eyebrow" style="margin-bottom:9px">Satu halaman · slip dan riwayat</div>
      <div class="sec-head" style="margin-bottom:6px">
        <h1 class="display">Taruhan <em>kamu.</em></h1>
        <span class="spacer"></span>
        <div style="text-align:right">
          <div class="num" style="font-size:13px;font-weight:600">${money(state.balance)} <span style="font-size:9px;color:var(--mute);letter-spacing:.1em">USDT</span></div>
          <div style="font-size:9.5px;color:var(--faint);letter-spacing:.12em;text-transform:uppercase;margin-top:2px">saldo demo</div>
        </div>
      </div>
      <p style="font-size:12.5px;color:var(--mute);max-width:56ch;margin-bottom:18px">Taruhan tunggal saja — satu pilihan, satu tiket. Odds desimal, stake USDT.</p>

      <div class="seg mobile-only" style="margin-bottom:14px">
        <button class="seg-btn ${state.betsView !== 'mybets' ? 'active' : ''}" data-act="bets-view" data-view="slip">Slip <span class="n">${state.slip.length}</span></button>
        <button class="seg-btn ${state.betsView === 'mybets' ? 'active' : ''}" data-act="bets-view" data-view="mybets">Taruhan saya <span class="n">${state.bets.length}</span></button>
      </div>
      <div class="bets-layout">
        <div data-slip-slot class="${state.betsView === 'mybets' ? 'm-hide' : ''}">${slipHTML('page')}</div>

        <div class="card ${state.betsView === 'mybets' ? '' : 'm-hide'}">
          <div class="card-head">
            <h3>Taruhan saya</h3>
            <span class="spacer"></span>
            <span style="font-size:10.5px;color:var(--faint)">${state.bets.length} total</span>
          </div>
          <div class="mb-tabs" role="tablist">
            <button class="mb-tab ${tab === 'open' ? 'active' : ''}" data-act="mb-tab" data-tab="open">Terbuka <span class="n">${openBets.length}</span></button>
            <button class="mb-tab ${tab === 'settled' ? 'active' : ''}" data-act="mb-tab" data-tab="settled">Selesai <span class="n">${settled.length}</span></button>
          </div>
          <div class="bet-list">
            ${listed.length ? listed.map(betHTML).join('') : `<div class="card-body"><div class="empty" style="padding:28px 18px;border:0">
              <div class="mark">${ic('ticket', 22)}</div>
              <h3>${tab === 'open' ? 'Belum ada taruhan terbuka' : 'Belum ada taruhan selesai'}</h3>
              <p>${tab === 'open' ? 'Taruhan yang kamu pasang akan muncul di sini dengan nilai cash out.' : 'Riwayat taruhan yang sudah selesai tampil di sini.'}</p>
            </div></div>`}
          </div>
          ${tab === 'open' && openBets.length ? `<div class="card-foot">
            <div style="display:flex;align-items:center;justify-content:space-between;gap:10px;font-size:11px;color:var(--faint)">
              <span>Stake terbuka <b style="color:var(--txt-2)">${money(openBets.reduce((a, b) => a + b.stake, 0))} USDT</b></span>
              <span>Cash out <b style="color:var(--aqua)">${money(openBets.reduce((a, b) => a + (b.cashout || 0), 0))} USDT</b></span>
            </div>
          </div>` : ''}
        </div>
      </div>

      ${error ? `<div class="si-warn danger" style="margin-top:16px"><span class="grow">Taruhan terakhir gagal: ${esc(error)}</span><button class="mini-btn" data-act="clear-error">Tutup</button></div>` : ''}
      <p style="font-size:10.5px;color:var(--faint);margin-top:16px;display:flex;align-items:center;gap:6px">${ic('shield', 13)} Prototipe: tidak ada transaksi nyata, tidak ada data pemain sungguhan.</p>
    </div>`;
  }

  function betHTML(b) {
    const m = matchById(b.matchId);
    const label = m ? `${team(m.home).name} v ${team(m.away).name}` : 'Pertandingan contoh';
    const statusText = { open: 'Terbuka', won: 'Menang', lost: 'Kalah', cashed: 'Diuangkan', void: 'Batal' }[b.status] || b.status;
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
            ${b.status === 'open' ? '' : `<span>${b.status === 'lost' ? 'Kalah' : 'Kembali'} <b style="color:${b.status === 'lost' ? 'var(--mute)' : 'var(--aqua)'}">${money(b.payout)}</b></span>`}
          </div>
          ${b.status === 'open' ? `<button class="cashout" data-act="cashout-ask" data-bet="${b.id}">Cash out <b data-cashval="${b.id}">${money(b.cashout)} USDT</b></button>` : ''}
        </div>
        ${confirm ? `<div class="co-confirm">
          <span class="grow">Cairkan sekarang untuk <b>${money(b.cashout)} USDT</b>? Nilai bisa berubah saat dikonfirmasi.</span>
          <div class="acts"><button class="mini-btn solid" data-act="cashout-confirm" data-bet="${b.id}">Ya, cairkan</button><button class="mini-btn" data-act="cashout-cancel">Batal</button></div>
        </div>` : ''}
      </div>`;
  }

  function notFound() {
    return `<div class="page"><div class="empty" style="margin-top:40px"><div class="mark">${ic('search', 22)}</div><h3>Halaman tidak ditemukan</h3><p>Tautan ini tidak ada di prototipe.</p><a class="btn btn-ghost btn-sm" href="#/">Kembali ke beranda</a></div></div>`;
  }

  /* ------------------------------ chrome ------------------------------- */
  const railItems = [
    { key: 'home', label: 'Beranda', icon: 'home', href: '#/' },
    { key: 'live', label: 'Live', icon: 'live', href: '#/live', count: () => MATCHES.filter((m) => m.status === 'live').length },
    { key: 'football', label: 'Sepak bola', icon: 'ball', href: '#/football' },
    { key: 'bets', label: 'Taruhan saya', icon: 'ticket', href: '#/bets', count: () => state.bets.length },
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
        <h4>Slip kamu <span class="n">${state.slip.length}</span></h4>
        <div class="rows">
          ${state.slip.slice(0, 3).map((it) => `<div class="row"><span class="sel">${esc(it.label)}</span><span class="ov">${oddsFmt(it.odds)}</span></div>`).join('')}
          ${state.slip.length > 3 ? `<div class="row"><span class="sel">+${state.slip.length - 3} lainnya</span><span class="ov"></span></div>` : ''}
        </div>
        <div class="tot"><span>Potensi kembali</span><b>${money(totalReturn())} USDT</b></div>
        <button class="btn btn-primary btn-sm btn-block" data-act="open-drawer">Buka slip ${ic('arrow-r', 14)}</button>
      </div>` : '';
    $('#panelBody').innerHTML = `
      ${peek}
      <div>
        <div class="panel-head"><span class="lbl">Live sekarang</span><span class="ln"></span><a href="#/live">${live.length ? 'semua' : 'lihat'}</a></div>
        ${live.length ? live.map((m) => `
          <a class="mini" href="#/match/${m.id}">
            <span class="mini-min" data-live-clock="${m.id}">${minTxt(m)}</span>
            <span class="mini-teams"><span>${esc(team(m.home).name)}</span><span>${esc(team(m.away).name)}</span></span>
            <span class="mini-score">
              <span class="${m.score[0] > m.score[1] ? 'win' : ''}" data-score="${m.id}">${m.score[0]}</span>
              <span class="${m.score[1] > m.score[0] ? 'win' : ''}" data-score="${m.id}">${m.score[1]}</span>
            </span>
          </a>`).join('') : `<p style="font-size:11.5px;color:var(--faint)">Tidak ada laga live.</p>`}
      </div>
      <div>
        <div class="panel-head"><span class="lbl">Segera</span><span class="ln"></span><a href="#/football">semua</a></div>
        ${soon.map((m) => `
          <a class="mini" href="#/match/${m.id}">
            <span class="mini-time">${timeHM(m.kickoff)}</span>
            <span class="mini-teams"><span>${esc(team(m.home).name)}</span><span>${esc(team(m.away).name)}</span></span>
            <span class="mini-time" data-cd="${m.kickoff}">${countdown(m.kickoff)}</span>
          </a>`).join('')}
      </div>
      <div>
        <div class="panel-head"><span class="lbl">Ikuti</span><span class="ln"></span></div>
        <div style="display:flex;flex-wrap:wrap;gap:6px">
          ${state.follows.teams.length
            ? state.follows.teams.map((t) => `<button class="chip" data-act="follow-team" data-id="${t}" style="height:27px;font-size:11px;padding:0 9px">${crest(t, 'sm')}${esc(team(t).short)}${ic('x', 11)}</button>`).join('')
            : `<p style="font-size:11.5px;color:var(--faint)">Belum ada tim yang diikuti.</p>`}
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
      home: 'Housebets Sportsbook', live: 'Live · Housebets Sportsbook', football: 'Sepak bola · Housebets Sportsbook',
      match: `${team((matchById(r.id) || {}).home || '') ? team((matchById(r.id) || {}).home).name + ' v ' + team((matchById(r.id) || {}).away).name : 'Pertandingan'} · Housebets`,
      bets: 'Slip & taruhan saya · Housebets Sportsbook',
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
      <button class="x" aria-label="Tutup notifikasi">${ic('x', 13)}</button>`;
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
      palIndex.push({ group: 'Tim', name: t.name, sub: comp(t.comp).name, kind: 'team', team: id, match: m && m.id });
    });
    Object.values(COMPS).forEach((c) => palIndex.push({ group: 'Kompetisi', name: c.name, sub: c.country, kind: 'comp', comp: c.id }));
    PLAYERS.forEach((p) => {
      const m = MATCHES.find((x) => x.home === p.team || x.away === p.team);
      palIndex.push({ group: 'Pemain', name: p.name, sub: team(p.team).name, kind: 'player', match: m && m.id });
    });
    const feats = matchById('ars-bha');
    const seen = new Set();
    (feats.markets || []).forEach((mk) => mk.groups.forEach((g) => g.sels.forEach((s) => {
      const key = `${g.name}|${s.label}`;
      if (seen.has(key)) return;
      seen.add(key);
      palIndex.push({ group: 'Pasar', name: g.name, sub: `${s.label} · ${oddsFmt(s.odds)}`, kind: 'market', match: 'ars-bha', market: mk.id });
    })));
    MATCHES.slice(0, 12).forEach((m) => palIndex.push({ group: 'Pertandingan', name: `${team(m.home).name} v ${team(m.away).name}`, sub: comp(m.comp).name, kind: 'match', match: m.id }));
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
    // prioritaskan: tim, kompetisi, pertandingan, pemain, pasar
    const w = { Tim: 0, Kompetisi: 1, Pertandingan: 2, Pemain: 3, Pasar: 4 };
    items = items.slice().sort((a, b) => (w[a.group] - w[b.group]) || a.name.localeCompare(b.name)).slice(0, 26);
    palFiltered = items;
    palActive = 0;
    const box = $('#paletteResults');
    if (!items.length) {
      box.innerHTML = `<div class="pal-empty">Tidak ada hasil untuk “${esc(q)}”.<br><span style="font-size:11px;color:var(--faint)">Coba nama tim, pemain, atau kompetisi.</span></div>`;
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
    if (e.target.closest('#alertsBtn')) { toast('Tidak ada notifikasi baru', 'Pasar yang kamu ikuti akan muncul di sini.', 'info'); return; }
    if (e.target.closest('#userBtn') || e.target.closest('#balanceChip')) {
      toast('Akun demo', `Saldo fiktif ${money(state.balance)} USDT. Tidak ada deposit atau penarikan nyata.`, 'info'); return;
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
        toast('Slip dikosongkan', 'Semua pilihan dihapus.', 'info'); break;
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
      btn.innerHTML = `${ic('ticket', 17)} Pasang ${state.slip.length} taruhan`;
    }
    const note = $('.sum-note span');
    if (note) note.textContent = reason || 'Odds desimal · stake dalam USDT · saldo demo, bukan uang nyata.';
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
