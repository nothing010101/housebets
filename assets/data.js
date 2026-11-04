/* Housebets Sportsbook — sample data only. No real players, no real money. */
(function () {
  const SPORTS = [
    { id: 'football', name: 'Football', icon: 'ball', live: 9 },
    { id: 'basketball', name: 'Basketball', icon: 'basket', live: 2 },
    { id: 'tennis', name: 'Tennis', icon: 'tennis', live: 1 },
    { id: 'esports', name: 'Esports', icon: 'pad', live: 1 },
    { id: 'mma', name: 'MMA', icon: 'glove', live: 0 },
    { id: 'cricket', name: 'Cricket', icon: 'bat', live: 0 },
  ];

  const COMPS = {
    pl:   { id: 'pl',   sport: 'football', name: 'Premier League', country: 'England', mark: 'PL',  tint: 210 },
    ucl:  { id: 'ucl',  sport: 'football', name: 'Champions League', country: 'Europe', mark: 'UCL', tint: 245 },
    lal:  { id: 'lal',  sport: 'football', name: 'LaLiga', country: 'Spain', mark: 'LL', tint: 28 },
    sa:   { id: 'sa',   sport: 'football', name: 'Serie A', country: 'Italy', mark: 'SA', tint: 160 },
    bun:  { id: 'bun',  sport: 'football', name: 'Bundesliga', country: 'Germany', mark: 'BL', tint: 0 },
    nba:  { id: 'nba',  sport: 'basketball', name: 'NBA', country: 'United States', mark: 'NBA', tint: 12 },
    atp:  { id: 'atp',  sport: 'tennis', name: 'ATP Finals', country: 'Turin', mark: 'ATP', tint: 185 },
    cs2:  { id: 'cs2',  sport: 'esports', name: 'CS2 Major', country: 'Shanghai', mark: 'CS2', tint: 45 },
  };

  // hue: used for the monogram crest
  const TEAMS = {
    ars: { name: 'Arsenal', short: 'ARS', hue: 6, comp: 'pl' },
    bha: { name: 'Brighton', short: 'BHA', hue: 202, comp: 'pl' },
    mci: { name: 'Man City', short: 'MCI', hue: 194, comp: 'pl' },
    liv: { name: 'Liverpool', short: 'LIV', hue: 352, comp: 'pl' },
    che: { name: 'Chelsea', short: 'CHE', hue: 220, comp: 'pl' },
    tot: { name: 'Tottenham', short: 'TOT', hue: 236, comp: 'pl' },
    mun: { name: 'Man United', short: 'MUN', hue: 355, comp: 'pl' },
    new: { name: 'Newcastle', short: 'NEW', hue: 200, comp: 'pl' },
    avl: { name: 'Aston Villa', short: 'AVL', hue: 340, comp: 'pl' },
    whu: { name: 'West Ham', short: 'WHU', hue: 320, comp: 'pl' },
    eve: { name: 'Everton', short: 'EVE', hue: 218, comp: 'pl' },
    cry: { name: 'Crystal Palace', short: 'CRY', hue: 212, comp: 'pl' },
    ful: { name: 'Fulham', short: 'FUL', hue: 220, comp: 'pl' },
    bre: { name: 'Brentford', short: 'BRE', hue: 358, comp: 'pl' },
    wol: { name: 'Wolves', short: 'WOL', hue: 40, comp: 'pl' },
    nfo: { name: 'Nottingham', short: 'NFO', hue: 350, comp: 'pl' },

    rma: { name: 'Real Madrid', short: 'RMA', hue: 214, comp: 'lal' },
    bar: { name: 'Barcelona', short: 'BAR', hue: 348, comp: 'lal' },
    atm: { name: 'Atletico', short: 'ATM', hue: 356, comp: 'lal' },
    sev: { name: 'Sevilla', short: 'SEV', hue: 4, comp: 'lal' },
    vil: { name: 'Villarreal', short: 'VIL', hue: 46, comp: 'lal' },
    bet: { name: 'Real Betis', short: 'BET', hue: 130, comp: 'lal' },
    ath: { name: 'Athletic Club', short: 'ATH', hue: 352, comp: 'lal' },
    rso: { name: 'Real Sociedad', short: 'RSO', hue: 200, comp: 'lal' },
    val: { name: 'Valencia', short: 'VAL', hue: 20, comp: 'lal' },
    gir: { name: 'Girona', short: 'GIR', hue: 354, comp: 'lal' },

    int: { name: 'Inter', short: 'INT', hue: 216, comp: 'sa' },
    mil: { name: 'AC Milan', short: 'MIL', hue: 352, comp: 'sa' },
    juv: { name: 'Juventus', short: 'JUV', hue: 0, comp: 'sa' },
    nap: { name: 'Napoli', short: 'NAP', hue: 192, comp: 'sa' },
    rom: { name: 'Roma', short: 'ROM', hue: 12, comp: 'sa' },
    laz: { name: 'Lazio', short: 'LAZ', hue: 200, comp: 'sa' },
    ata: { name: 'Atalanta', short: 'ATA', hue: 212, comp: 'sa' },
    fio: { name: 'Fiorentina', short: 'FIO', hue: 268, comp: 'sa' },

    bay: { name: 'Bayern', short: 'BAY', hue: 352, comp: 'bun' },
    bvb: { name: 'Dortmund', short: 'BVB', hue: 48, comp: 'bun' },
    lev: { name: 'Leverkusen', short: 'LEV', hue: 0, comp: 'bun' },
    rbl: { name: 'RB Leipzig', short: 'RBL', hue: 210, comp: 'bun' },
    stu: { name: 'Stuttgart', short: 'STU', hue: 4, comp: 'bun' },
    sge: { name: 'Frankfurt', short: 'SGE', hue: 350, comp: 'bun' },
    wob: { name: 'Wolfsburg', short: 'WOB', hue: 128, comp: 'bun' },

    psg: { name: 'PSG', short: 'PSG', hue: 220, comp: 'ucl' },
    ben: { name: 'Benfica', short: 'BEN', hue: 2, comp: 'ucl' },

    lal_t: { name: 'LA Lakers', short: 'LAL', hue: 320, comp: 'nba' },
    bos: { name: 'Boston Celtics', short: 'BOS', hue: 150, comp: 'nba' },
    gsw: { name: 'Goalsden State', short: 'GSW', hue: 214, comp: 'nba' },
    den: { name: 'Denver Nuggets', short: 'DEN', hue: 220, comp: 'nba' },

    alc: { name: 'Alcaraz', short: 'ALC', hue: 25, comp: 'atp' },
    sin: { name: 'Sinner', short: 'SIN', hue: 16, comp: 'atp' },
    djo: { name: 'Djokovic', short: 'DJO', hue: 200, comp: 'atp' },
    zve: { name: 'Zverev', short: 'ZVE', hue: 44, comp: 'atp' },

    vit: { name: 'Vitality', short: 'VIT', hue: 52, comp: 'cs2' },
    nav: { name: 'NAVI', short: 'NAV', hue: 48, comp: 'cs2' },
    faze: { name: 'FaZe', short: 'FAZ', hue: 12, comp: 'cs2' },
    g2: { name: 'G2', short: 'G2', hue: 0, comp: 'cs2' },
  };

  const NOW = Date.now();
  const mins = (m) => NOW + m * 60000;

  // markets for the featured match, built once
  const ARS_MARKETS = [
    {
      id: 'popular', name: 'Popular',
      groups: [
        { name: 'Match result', note: '90 mins', sels: [
          { id: 'h', label: 'Arsenal', odds: 1.74 },
          { id: 'd', label: 'Draw', odds: 3.95 },
          { id: 'a', label: 'Brighton', odds: 4.55 },
        ]},
        { name: 'Total goals', note: 'Line 2.5', sels: [
          { id: 'o25', label: 'Over 2.5', odds: 1.62 },
          { id: 'u25', label: 'Under 2.5', odds: 2.28 },
        ]},
        { name: 'Both teams to score', sels: [
          { id: 'btts-y', label: 'Yes', odds: 1.48 },
          { id: 'btts-n', label: 'No', odds: 2.52 },
        ]},
      ],
    },
    {
      id: 'goals', name: 'Goals',
      groups: [
        { name: 'Total goals', note: 'O/U', sels: [
          { id: 'g15o', label: 'Over 1.5', odds: 1.18 },
          { id: 'g15u', label: 'Under 1.5', odds: 4.60 },
          { id: 'g35o', label: 'Over 3.5', odds: 2.70 },
          { id: 'g35u', label: 'Under 3.5', odds: 1.44 },
        ]},
        { name: 'Goals in 2nd half', sels: [
          { id: 'h2g-y', label: 'Yes', odds: 1.34 },
          { id: 'h2g-n', label: 'No', odds: 3.05 },
        ]},
        { name: 'Next team to score', sels: [
          { id: 'nxt-h', label: 'Arsenal', odds: 1.66 },
          { id: 'nxt-a', label: 'Brighton', odds: 2.62 },
          { id: 'nxt-none', label: 'No goal', odds: 9.5 },
        ]},
      ],
    },
    {
      id: 'halves', name: 'Halves',
      groups: [
        { name: '2nd-half result', sels: [
          { id: 'h2-h', label: 'Arsenal', odds: 2.05 },
          { id: 'h2-d', label: 'Draw', odds: 2.42 },
          { id: 'h2-a', label: 'Brighton', odds: 4.10 },
        ]},
        { name: '2nd-half goals', note: 'Line 1.5', sels: [
          { id: 'h2o', label: 'Over 1.5', odds: 2.16 },
          { id: 'h2u', label: 'Under 1.5', odds: 1.66 },
        ]},
        { name: 'Correct score', sels: [
          { id: 'cs-21', label: '2 – 1', odds: 6.8 },
          { id: 'cs-31', label: '3 – 1', odds: 10.5 },
          { id: 'cs-22', label: '2 – 2', odds: 12.0 },
          { id: 'cs-11', label: '1 – 1', odds: 7.4 },
        ]},
      ],
    },
    {
      id: 'handicap', name: 'Handicaps',
      groups: [
        { name: 'Asian handicap', note: 'Arsenal −0.5', sels: [
          { id: 'ah-h', label: 'Arsenal −0.5', odds: 1.68 },
          { id: 'ah-a', label: 'Brighton +0.5', odds: 2.20 },
        ]},
        { name: 'European handicap', note: 'Arsenal −1', sels: [
          { id: 'eh-h', label: 'Arsenal −1', odds: 2.42 },
          { id: 'eh-d', label: 'Draw (−1)', odds: 3.70 },
          { id: 'eh-a', label: 'Brighton +1', odds: 2.62 },
        ]},
      ],
    },
    {
      id: 'scorers', name: 'Goalscorers',
      groups: [
        { name: 'Anytime goalscorer', sels: [
          { id: 's-saka', label: 'B. Saka', odds: 2.45 },
          { id: 's-havertz', label: 'K. Havertz', odds: 2.80 },
          { id: 's-jesus', label: 'G. Jesus', odds: 3.10 },
          { id: 's-welbeck', label: 'D. Welbeck', odds: 3.60 },
          { id: 's-mitoma', label: 'K. Mitoma', odds: 4.20 },
          { id: 's-pedro', label: 'João Pedro', odds: 4.60 },
        ]},
        { name: 'First goalscorer', sels: [
          { id: 'f-saka', label: 'B. Saka', odds: 5.50 },
          { id: 'f-havertz', label: 'K. Havertz', odds: 6.20 },
          { id: 'f-welbeck', label: 'D. Welbeck', odds: 8.00 },
        ]},
      ],
    },
    {
      id: 'corners', name: 'Corners & cards',
      groups: [
        { name: 'Total corners', note: 'Line 9.5', sels: [
          { id: 'c-o', label: 'Over 9.5', odds: 2.02 },
          { id: 'c-u', label: 'Under 9.5', odds: 1.74 },
        ]},
        { name: 'Total cards', note: 'Line 4.5', sels: [
          { id: 'k-o', label: 'Over 4.5', odds: 2.55 },
          { id: 'k-u', label: 'Under 4.5', odds: 1.46 },
        ]},
        { name: 'Brighton cards', sels: [
          { id: 'k-bha', label: '2+ cards', odds: 2.34 },
          { id: 'k-ars', label: 'Arsenal 2+ cards', odds: 2.72 },
        ]},
      ],
    },
  ];

  const MATCHES = [
    { id: 'ars-bha', sport: 'football', comp: 'pl', home: 'ars', away: 'bha', status: 'live', minute: 67, score: [2, 1], kickoff: mins(-67), featured: true, venue: 'Emirates Stadium', round: 'Matchweek 14', markets: ARS_MARKETS,
      odds: { h: 1.74, d: 3.95, a: 4.55 } },
    { id: 'mci-che', sport: 'football', comp: 'pl', home: 'mci', away: 'che', status: 'live', minute: 54, score: [1, 1], kickoff: mins(-54), odds: { h: 1.92, d: 3.60, a: 3.85 } },
    { id: 'liv-mun', sport: 'football', comp: 'pl', home: 'liv', away: 'mun', status: 'live', minute: 78, score: [3, 0], kickoff: mins(-78), odds: { h: 1.12, d: 8.5, a: 19.0 } },
    { id: 'tot-new', sport: 'football', comp: 'pl', home: 'tot', away: 'new', status: 'live', minute: 23, score: [0, 1], kickoff: mins(-23), odds: { h: 2.30, d: 3.30, a: 3.10 } },
    { id: 'avl-whu', sport: 'football', comp: 'pl', home: 'avl', away: 'whu', status: 'upcoming', kickoff: mins(18), odds: { h: 1.88, d: 3.55, a: 4.10 } },
    { id: 'eve-cry', sport: 'football', comp: 'pl', home: 'eve', away: 'cry', status: 'upcoming', kickoff: mins(52), odds: { h: 2.55, d: 3.10, a: 3.05 } },
    { id: 'ful-bre', sport: 'football', comp: 'pl', home: 'ful', away: 'bre', status: 'upcoming', kickoff: mins(96), odds: { h: 2.42, d: 3.25, a: 3.05 } },
    { id: 'wol-nfo', sport: 'football', comp: 'pl', home: 'wol', away: 'nfo', status: 'upcoming', kickoff: mins(131), odds: { h: 2.60, d: 3.15, a: 2.95 } },

    { id: 'rma-bar', sport: 'football', comp: 'lal', home: 'rma', away: 'bar', status: 'live', minute: 35, score: [1, 1], kickoff: mins(-35), odds: { h: 2.05, d: 3.40, a: 3.60 } },
    { id: 'atm-sev', sport: 'football', comp: 'lal', home: 'atm', away: 'sev', status: 'upcoming', kickoff: mins(24), odds: { h: 1.62, d: 3.85, a: 5.60 } },
    { id: 'vil-bet', sport: 'football', comp: 'lal', home: 'vil', away: 'bet', status: 'upcoming', kickoff: mins(77), odds: { h: 2.12, d: 3.30, a: 3.55 } },
    { id: 'ath-rso', sport: 'football', comp: 'lal', home: 'ath', away: 'rso', status: 'upcoming', kickoff: mins(150), odds: { h: 2.28, d: 3.15, a: 3.30 } },

    { id: 'int-juv', sport: 'football', comp: 'sa', home: 'int', away: 'juv', status: 'live', minute: 71, score: [0, 0], kickoff: mins(-71), odds: { h: 1.58, d: 4.00, a: 6.40 } },
    { id: 'nap-mil', sport: 'football', comp: 'sa', home: 'nap', away: 'mil', status: 'upcoming', kickoff: mins(41), odds: { h: 2.18, d: 3.25, a: 3.45 } },
    { id: 'rom-laz', sport: 'football', comp: 'sa', home: 'rom', away: 'laz', status: 'upcoming', kickoff: mins(118), odds: { h: 2.35, d: 3.10, a: 3.15 } },

    { id: 'bay-bvb', sport: 'football', comp: 'bun', home: 'bay', away: 'bvb', status: 'live', minute: 12, score: [1, 0], kickoff: mins(-12), odds: { h: 1.55, d: 4.30, a: 5.20 } },
    { id: 'lev-rbl', sport: 'football', comp: 'bun', home: 'lev', away: 'rbl', status: 'upcoming', kickoff: mins(66), odds: { h: 1.95, d: 3.65, a: 3.80 } },
    { id: 'stu-sge', sport: 'football', comp: 'bun', home: 'stu', away: 'sge', status: 'upcoming', kickoff: mins(140), odds: { h: 2.05, d: 3.45, a: 3.50 } },

    { id: 'psg-ben', sport: 'football', comp: 'ucl', home: 'psg', away: 'ben', status: 'live', minute: 88, score: [2, 2], kickoff: mins(-88), odds: { h: 2.45, d: 2.90, a: 3.20 } },
    { id: 'ben-psg', sport: 'football', comp: 'ucl', home: 'ben', away: 'psg', status: 'upcoming', kickoff: mins(112), odds: { h: 3.10, d: 3.40, a: 2.25 } },

    { id: 'lal-bos', sport: 'basketball', comp: 'nba', home: 'lal_t', away: 'bos', status: 'live', minute: 34, score: [88, 92], kickoff: mins(-64), clockLabel: 'Q3 4:12', odds: { h: 2.10, a: 1.78 } },
    { id: 'gsw-den', sport: 'basketball', comp: 'nba', home: 'gsw', away: 'den', status: 'upcoming', kickoff: mins(88), odds: { h: 2.30, a: 1.66 } },

    { id: 'alc-sin', sport: 'tennis', comp: 'atp', home: 'alc', away: 'sin', status: 'live', minute: 0, score: [1, 1], clockLabel: 'Set 3 · 3–2', odds: { h: 1.85, a: 1.95 } },
    { id: 'djo-zve', sport: 'tennis', comp: 'atp', home: 'djo', away: 'zve', status: 'upcoming', kickoff: mins(58), odds: { h: 1.70, a: 2.12 } },

    { id: 'vit-nav', sport: 'esports', comp: 'cs2', home: 'vit', away: 'nav', status: 'live', minute: 0, score: [1, 0], clockLabel: 'Map 2 · 9–7', odds: { h: 1.55, a: 2.40 } },
    { id: 'faze-g2', sport: 'esports', comp: 'cs2', home: 'faze', away: 'g2', status: 'upcoming', kickoff: mins(35), odds: { h: 2.05, a: 1.78 } },
  ];

  // sample bet history (My bets)
  const SEED_BETS = [
    { id: 'b-1', status: 'open', matchId: 'mci-che', market: 'Match result', selection: 'Man City', odds: 1.92, stake: 25, placed: NOW - 22 * 60000, cashoutBase: 42.5 },
    { id: 'b-2', status: 'open', matchId: 'rma-bar', market: 'Total goals 2.5', selection: 'Over 2.5', odds: 1.72, stake: 40, placed: NOW - 51 * 60000, cashoutBase: 55.2 },
    { id: 'b-3', status: 'won', matchId: 'int-juv', market: 'Match result', selection: 'Inter', odds: 1.8, stake: 30, placed: NOW - 5 * 3600000, payout: 54, score: '2 – 0' },
    { id: 'b-4', status: 'lost', matchId: 'bay-bvb', market: 'Both teams to score', selection: 'Yes', odds: 1.65, stake: 20, placed: NOW - 8 * 3600000, payout: 0, score: '1 – 0' },
    { id: 'b-5', status: 'cashed', matchId: 'psg-ben', market: 'Match result', selection: 'PSG', odds: 2.4, stake: 15, placed: NOW - 26 * 3600000, payout: 21.4, score: '1 – 2' },
  ];

  const PLAYERS = [
    { name: 'Bukayo Saka', team: 'ars' }, { name: 'Kai Havertz', team: 'ars' },
    { name: 'Martin Ødegaard', team: 'ars' }, { name: 'Declan Rice', team: 'ars' },
    { name: 'Erling Haaland', team: 'mci' }, { name: 'Phil Foden', team: 'mci' },
    { name: 'Mohamed Salah', team: 'liv' }, { name: 'Luis Díaz', team: 'liv' },
    { name: 'Cole Palmer', team: 'che' }, { name: 'Bruno Fernandes', team: 'mun' },
    { name: 'Son Heung-min', team: 'tot' }, { name: 'Alexander Isak', team: 'new' },
    { name: 'Kaoru Mitoma', team: 'bha' }, { name: 'Danny Welbeck', team: 'bha' },
    { name: 'Kylian Mbappé', team: 'rma' }, { name: 'Vinícius Jr', team: 'rma' },
    { name: 'Lamine Yamal', team: 'bar' }, { name: 'Robert Lewandowski', team: 'bar' },
    { name: 'Lautaro Martínez', team: 'int' }, { name: 'Harry Kane', team: 'bay' },
  ];

  window.HB_DATA = { SPORTS, COMPS, TEAMS, MATCHES, SEED_BETS, PLAYERS, NOW };
})();
