import './style.css';
import { scenarios, type Scenario } from './scenarios';
import { MarketMakingEngine, type Settings, type Quote, type Fill } from './engine';

type Screen = 'welcome' | 'play' | 'odds' | 'end';

type Round = {
  scenario: Scenario;
  estimate: number;
  quote: Quote;
  fill: Fill | null;
  mark: number;
  ts: number;
};

const $app = document.querySelector<HTMLDivElement>('#app');
if (!$app) throw new Error('Missing #app');

const fmt = (x: number) => {
  if (!Number.isFinite(x)) return '—';
  const abs = Math.abs(x);
  if (abs >= 1e9) return (x / 1e9).toFixed(2) + 'B';
  if (abs >= 1e6) return (x / 1e6).toFixed(2) + 'M';
  if (abs >= 1e3) return x.toFixed(1);
  return x.toFixed(3).replace(/\.0+$/, '').replace(/\.(\d*[1-9])0+$/, '.$1');
};

const todaySeed = () => {
  const d = new Date();
  return d.getFullYear() * 10000 + (d.getMonth() + 1) * 100 + d.getDate();
};

let screen: Screen = 'welcome';
let engine: MarketMakingEngine | null = null;
let settings: Settings = {
  durationSec: 600,
  spreadType: 'predefined',
  predefinedSpread: 10,
  percentSpread: 0.05,
  inventoryLimit: 10,
  riskAversion: 1.0,
  invSkew: 0.35,
  spreadWiden: 0.6,
  seed: todaySeed()
};

let tEnd = 0;
let tLeft = settings.durationSec;
let timerHandle: number | null = null;

let curScenario: Scenario | null = null;
let rounds: Round[] = [];

function pickScenario() {
  // random without immediate repeats
  const used = new Set(rounds.slice(-3).map(r => r.scenario.id));
  const pool = scenarios.filter(s => !used.has(s.id));
  const list = pool.length ? pool : scenarios;
  const idx = Math.floor(Math.random() * list.length);
  return list[idx];
}

function hardReset() {
  engine = new MarketMakingEngine(settings);
  rounds = [];
  curScenario = pickScenario();
  tEnd = Date.now() + settings.durationSec * 1000;
  tLeft = settings.durationSec;
  if (timerHandle) window.clearInterval(timerHandle);
  timerHandle = window.setInterval(() => {
    const ms = tEnd - Date.now();
    tLeft = Math.max(0, Math.ceil(ms / 1000));
    if (tLeft <= 0) {
      stopGame();
      return;
    }
    // Do NOT re-render the whole app on a timer tick.
    // Re-rendering replaces the DOM and breaks typing/focus in inputs.
    updateHUD();
  }, 250);
  updateHUD();
}

function stopGame() {
  if (timerHandle) {
    window.clearInterval(timerHandle);
    timerHandle = null;
  }
  screen = 'end';
  render();
}

function mmss(sec: number) {
  const m = Math.floor(sec / 60);
  const s = sec % 60;
  return `${m}:${String(s).padStart(2, '0')}`;
}

function updateHUD() {
  const $timer = document.querySelector<HTMLElement>('#hud-timer');
  const $inv = document.querySelector<HTMLElement>('#hud-inv');
  const $pnl = document.querySelector<HTMLElement>('#hud-pnl');
  const $rounds = document.querySelector<HTMLElement>('#hud-rounds');

  if ($timer) $timer.textContent = mmss(tLeft);
  if ($rounds) $rounds.textContent = String(rounds.length);

  if (engine && curScenario) {
    const pnl = engine.pnl(curScenario.trueValue);
    if ($inv) $inv.textContent = String(pnl.inv);
    if ($pnl) $pnl.textContent = fmt(pnl.riskAdj);
  }
}

function headerBadges() {
  const pnl = engine && curScenario ? engine.pnl(curScenario.trueValue) : null;
  const mtm = pnl ? pnl.riskAdj : 0;
  const inv = pnl ? pnl.inv : 0;
  return `
    <div class="badges">
      <div class="badge"><strong>Timer</strong> <span id="hud-timer">${mmss(tLeft)}</span></div>
      <div class="badge"><strong>Inv</strong> <span id="hud-inv">${inv}</span></div>
      <div class="badge"><strong>Risk-Adj PnL</strong> <span id="hud-pnl">${fmt(mtm)}</span></div>
      <div class="badge"><strong>Rounds</strong> <span id="hud-rounds">${rounds.length}</span></div>
    </div>
  `;
}

function welcomeScreen() {
  return `
  <div class="container">
    <div class="header">
      <div class="brand">
        <h1>Trading Interview Games (Practice)</h1>
        <p>Market making + odds games for interview-style training.</p>
      </div>
      ${headerBadges()}
    </div>

    <div class="grid">
      <section class="panel">
        <div class="panel-h"><h2>Choose a mode</h2><span class="kbd">Enter</span></div>
        <div class="panel-b">
          <div class="row">
            <button class="btn primary" id="start">Market Making</button>
            <button class="btn" id="start-odds">Odds Game (Dice/Cards/Coins)</button>
          </div>
          <hr />
          <div class="small">
            <b>Market Making</b>: quote bid/ask for a prompt, manage inventory, earn spread.
            <br />
            <b>Odds Game</b>: you get events + odds, you choose bet sizes, and your balance evolves round-by-round.
          </div>
        </div>
      </section>

      <aside class="panel">
        <div class="panel-h"><h2>Market Making Settings</h2><button class="btn" id="reset-seed">New Seed</button></div>
        <div class="panel-b">
          <div class="row" style="gap:12px">
            <div style="flex:1">
              <div class="label">Game Length</div>
              <select id="duration">
                <option value="300">5 minutes</option>
                <option value="600" selected>10 minutes (Standard)</option>
                <option value="900">15 minutes</option>
              </select>
            </div>
            <div style="flex:1">
              <div class="label">Inventory Limit</div>
              <input id="invLimit" type="number" min="1" step="1" value="${settings.inventoryLimit}" />
            </div>
          </div>

          <hr />

          <div class="label">Spread Type</div>
          <div class="row">
            <label class="small"><input type="radio" name="spreadType" value="predefined" ${settings.spreadType === 'predefined' ? 'checked' : ''}/> Predefined</label>
            <label class="small"><input type="radio" name="spreadType" value="percent" ${settings.spreadType === 'percent' ? 'checked' : ''}/> Percent</label>
          </div>

          <div class="row" style="gap:12px; margin-top:10px">
            <div style="flex:1">
              <div class="label">Predefined Spread (abs)</div>
              <input id="predef" type="number" min="0.000001" step="0.1" value="${settings.predefinedSpread}" />
            </div>
            <div style="flex:1">
              <div class="label">Percent Spread</div>
              <input id="pct" type="number" min="0.001" step="0.001" value="${settings.percentSpread}" />
            </div>
          </div>

          <hr />
          <div class="label">Risk Aversion (inventory penalty)</div>
          <input id="risk" type="number" min="0" step="0.1" value="${settings.riskAversion}" />

          <div class="row" style="gap:12px; margin-top:10px">
            <div style="flex:1">
              <div class="label">Inventory Skew</div>
              <input id="invSkew" type="number" min="0" step="0.05" value="${settings.invSkew}" />
              <div class="small">Higher = auto-quote shifts mid to reduce inventory faster.</div>
            </div>
            <div style="flex:1">
              <div class="label">Spread Widen</div>
              <input id="spreadWiden" type="number" min="0" step="0.1" value="${settings.spreadWiden}" />
              <div class="small">Higher = spreads widen as |inventory| grows.</div>
            </div>
          </div>

          <div class="small" style="margin-top:10px">
            Tip: Use <span class="kbd">Enter</span> to submit a quote during play.
          </div>
        </div>
      </aside>
    </div>
  </div>
  `;
}

function playScreen() {
  if (!engine || !curScenario) return '';

  const pnl = engine.pnl(curScenario.trueValue);
  const last = rounds.at(-1);

  return `
  <div class="container">
    <div class="header">
      <div class="brand">
        <h1>Make Me a Market</h1>
        <p>Quote a bid/ask for the scenario. Manage inventory.</p>
      </div>
      ${headerBadges()}
    </div>

    <div class="grid">
      <section class="panel">
        <div class="panel-h">
          <h2>Scenario</h2>
          <div class="row">
            <button class="btn" id="skip">Skip</button>
            <button class="btn danger" id="end">End</button>
          </div>
        </div>
        <div class="panel-b">
          <p class="bigPrompt">${curScenario.prompt}</p>
          <div class="small">Unit: <b>${curScenario.unit}</b>${curScenario.hint ? ` • Hint: ${curScenario.hint}` : ''}</div>

          <hr />

          <div class="row" style="gap:12px">
            <div style="flex:1">
              <div class="label">Your Estimate</div>
              <input id="estimate" type="number" step="any" placeholder="Enter your estimate" />
            </div>
            <div style="flex:1">
              <div class="label">Auto-quote</div>
              <button class="btn" id="auto">Fill Bid/Ask</button>
            </div>
          </div>

          <div class="quoteGrid" style="margin-top:10px">
            <div>
              <div class="label">Bid</div>
              <input id="bid" type="number" step="any" placeholder="Bid" />
            </div>
            <div>
              <div class="label">Ask</div>
              <input id="ask" type="number" step="any" placeholder="Ask" />
            </div>
          </div>

          <div class="row" style="margin-top:12px">
            <button class="btn primary" id="submit">Submit Quote</button>
          </div>

          ${last ? renderLast(last) : ''}
        </div>
      </section>

      <aside class="panel">
        <div class="panel-h"><h2>Scoreboard</h2><span class="kbd">R</span></div>
        <div class="panel-b">
          <div class="flash">
            <div class="small">Cash: <b>${fmt(pnl.cash)}</b> • Inventory: <b>${pnl.inv}</b></div>
            <div class="small">Mark: <b>${fmt(curScenario.trueValue)}</b> ${curScenario.unit}</div>
            <div class="small">MTM: <b>${fmt(pnl.mtm)}</b> • Risk-Adj: <b>${fmt(pnl.riskAdj)}</b></div>
            <div class="small">Break-even (flat): <b>${engine.breakEven() == null ? '—' : fmt(engine.breakEven()!)}</b></div>
          </div>

          <hr />

          <table class="table">
            <thead><tr><th>Time</th><th>Side</th><th>Px</th><th>Scenario</th></tr></thead>
            <tbody>
              ${rounds.slice(-10).reverse().map(r => {
                const t = new Date(r.ts).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
                const s = r.fill ? r.fill.side : '—';
                const px = r.fill ? fmt(r.fill.price) : '—';
                const name = r.scenario.id.replace(/-/g,' ');
                return `<tr><td>${t}</td><td>${s}</td><td>${px}</td><td>${name}</td></tr>`;
              }).join('')}
            </tbody>
          </table>

          <div class="footerNote">Keys: <span class="kbd">Enter</span> submit • <span class="kbd">R</span> reset round inputs</div>
        </div>
      </aside>
    </div>
  </div>
  `;
}

function renderLast(last: Round) {
  const fill = last.fill;
  if (!fill) {
    return `
      <div style="margin-top:12px" class="flash">
        <div class="small"><b>No trade</b> this round.</div>
        <div class="small">Quote was: bid ${fmt(last.quote.bid)} / ask ${fmt(last.quote.ask)} (${last.scenario.unit})</div>
      </div>
    `;
  }

  const cls = fill.side === 'BUY' ? 'ok' : 'bad';
  const text = fill.side === 'BUY'
    ? `Customer sold to you at your bid.`
    : `Customer bought from you at your ask.`;

  return `
    <div style="margin-top:12px" class="flash ${cls}">
      <div class="small"><b>Trade</b>: ${fill.side} @ ${fmt(fill.price)} (${last.scenario.unit})</div>
      <div class="small">${text}</div>
    </div>
  `;
}

// ---------------- Odds game (Dice/Cards/Coins) ----------------

type Bet = {
  id: string;
  title: string;
  oddsTo1: number; // payout odds: e.g. 3.5 means win gets stake*3.5 profit
  pWin: number; // true probability
  resolve: () => boolean;
};

type OddsState = {
  balance: number;
  round: number;
  tEnd: number;
  tLeft: number;
  lastMsg: string | null;
  bets: { dice: Bet[]; cards: Bet[]; coins: Bet[] };
};

let odds: OddsState | null = null;

function fairOddsTo1(p: number) {
  // fair odds-to-1 for a binary bet with prob p (ignoring tie): (1-p)/p
  return (1 - p) / Math.max(1e-9, p);
}

function withHouseEdge(oddsTo1: number, edge = 0.06) {
  // reduce payout by edge (house edge)
  return Math.max(0.01, oddsTo1 * (1 - edge));
}

function mkBet(id: string, title: string, pWin: number, resolver: () => boolean) {
  const fair = fairOddsTo1(pWin);
  const offered = withHouseEdge(fair, 0.08);
  // Round to 2 decimals like common UIs
  const oddsTo1 = Math.round(offered * 100) / 100;
  return { id, title, oddsTo1, pWin, resolve: resolver } as Bet;
}

function startOddsGame() {
  const durationSec = 600;
  const tEndLocal = Date.now() + durationSec * 1000;

  const rollDie = () => 1 + Math.floor(Math.random() * 6);
  const flipCoin = () => (Math.random() < 0.5 ? 'H' : 'T');

  // Build a fresh set each round (like “?” icons in your screenshot)
  const buildBets = () => {
    // Dice
    const diceA = mkBet(
      'dice-even-even',
      'Both dice show even numbers',
      (3 / 6) * (3 / 6),
      () => {
        const d1 = rollDie();
        const d2 = rollDie();
        return d1 % 2 === 0 && d2 % 2 === 0;
      }
    );
    const primes = new Set([2, 3, 5, 7, 11]);
    const diceB = mkBet(
      'dice-prime-sum',
      'Sum of dice is a prime number (2,3,5,7,11)',
      15 / 36,
      () => primes.has(rollDie() + rollDie())
    );

    // Cards (2-card draw without replacement from standard 52)
    const draw2 = () => {
      const ranks = ['A', '2', '3', '4', '5', '6', '7', '8', '9', '10', 'J', 'Q', 'K'] as const;
      type Rank = (typeof ranks)[number];
      type Card = { rank: Rank; suit: 'S' | 'H' | 'D' | 'C' };
      const deck: Card[] = [];
      for (const suit of ['S', 'H', 'D', 'C'] as const) {
        for (const rank of ranks) deck.push({ rank, suit });
      }
      // pick 2
      const i1 = Math.floor(Math.random() * deck.length);
      const c1 = deck.splice(i1, 1)[0];
      const i2 = Math.floor(Math.random() * deck.length);
      const c2 = deck.splice(i2, 1)[0];
      return [c1, c2] as const;
    };

    const cardsA = mkBet(
      'cards-face',
      'If I draw 2 cards, at least one is a face card (J,Q,K)',
      1 - ((40 / 52) * (39 / 51)),
      () => {
        const [c1, c2] = draw2();
        const face = new Set(['J', 'Q', 'K']);
        return face.has(c1.rank) || face.has(c2.rank);
      }
    );

    const cardsB = mkBet(
      'cards-none-red',
      'If I draw 2 cards, none of them is red',
      (26 / 52) * (25 / 51),
      () => {
        const [c1, c2] = draw2();
        const isRed = (s: string) => s === 'H' || s === 'D';
        return !isRed(c1.suit) && !isRed(c2.suit);
      }
    );

    // Coins
    const coinsA = mkBet(
      'coins-more-heads',
      'More coins show heads than tails (3 flips)',
      0.5,
      () => {
        const flips = [flipCoin(), flipCoin(), flipCoin()];
        const h = flips.filter(x => x === 'H').length;
        return h >= 2;
      }
    );

    const coinsB = mkBet(
      'coins-first-heads',
      'First coin shows heads',
      0.5,
      () => flipCoin() === 'H'
    );

    return { dice: [diceA, diceB], cards: [cardsA, cardsB], coins: [coinsA, coinsB] };
  };

  odds = {
    balance: 1000,
    round: 1,
    tEnd: tEndLocal,
    tLeft: durationSec,
    lastMsg: null,
    bets: buildBets(),
  };

  // timer for odds game (only updates small HUD text)
  if (timerHandle) window.clearInterval(timerHandle);
  timerHandle = window.setInterval(() => {
    if (!odds) return;
    const ms = odds.tEnd - Date.now();
    odds.tLeft = Math.max(0, Math.ceil(ms / 1000));
    if (odds.tLeft <= 0) {
      screen = 'end';
      render();
      return;
    }
    const $t = document.querySelector<HTMLElement>('#odds-timer');
    if ($t) $t.textContent = mmss(odds.tLeft);
  }, 250);
}

function oddsScreen() {
  if (!odds) return '';

  const card = (title: string, bets: Bet[], key: 'dice' | 'cards' | 'coins') => {
    const rows = bets
      .map((b) => {
        return `
          <div class="flash" style="margin-bottom:10px">
            <div class="row" style="justify-content:space-between; align-items:flex-start">
              <div style="flex:1; padding-right:10px">
                <div style="font-weight:700; margin-bottom:6px">${b.title}</div>
                <div class="small" style="opacity:.9">Odds <b>${b.oddsTo1}:1</b></div>
              </div>
              <div style="width:160px">
                <input type="number" min="0" step="1" value="10" id="stake-${b.id}" />
                <button class="btn primary" style="width:100%; margin-top:8px" data-take="${b.id}" data-group="${key}">Take</button>
              </div>
            </div>
          </div>
        `;
      })
      .join('');

    return `
      <section class="panel">
        <div class="panel-h"><h2>${title}</h2><span class="small">?</span></div>
        <div class="panel-b">${rows}</div>
      </section>
    `;
  };

  return `
    <div class="container">
      <div class="header">
        <div class="brand">
          <h1>Odds Game</h1>
          <p>Bet sizing + implied odds. Keep your balance alive.</p>
        </div>
        <div class="badges">
          <div class="badge"><strong>Time</strong> <span id="odds-timer">${mmss(odds.tLeft)}</span></div>
          <div class="badge"><strong>Balance</strong> ${fmt(odds.balance)}</div>
          <div class="badge"><strong>Round</strong> ${odds.round}</div>
        </div>
      </div>

      <div class="row" style="justify-content:space-between; margin-top:12px">
        <button class="btn" id="back">Back</button>
        <button class="btn primary" id="next-round">Next Round</button>
      </div>

      ${odds.lastMsg ? `<div class="flash" style="margin-top:12px">${odds.lastMsg}</div>` : ''}

      <div class="grid" style="grid-template-columns: 1fr 1fr 1fr; margin-top:12px">
        ${card('Dice', odds.bets.dice, 'dice')}
        ${card('Cards', odds.bets.cards, 'cards')}
        ${card('Coins', odds.bets.coins, 'coins')}
      </div>
    </div>
  `;
}

function bindOdds() {
  if (!odds) return;

  document.querySelector<HTMLButtonElement>('#back')?.addEventListener('click', () => {
    if (timerHandle) {
      window.clearInterval(timerHandle);
      timerHandle = null;
    }
    odds = null;
    screen = 'welcome';
    render();
  });

  const takeButtons = document.querySelectorAll<HTMLButtonElement>('button[data-take]');
  takeButtons.forEach((btn) => {
    btn.addEventListener('click', () => {
      if (!odds) return;
      const id = btn.dataset.take!;
      const group = btn.dataset.group as 'dice' | 'cards' | 'coins';
      const bet = odds.bets[group].find((b) => b.id === id);
      if (!bet) return;
      const $stake = document.querySelector<HTMLInputElement>(`#stake-${id}`);
      const stake = Math.floor(Number($stake?.value ?? 0));
      if (!Number.isFinite(stake) || stake <= 0) return alert('Stake must be > 0');
      if (stake > odds.balance) return alert('Not enough balance');

      const win = bet.resolve();
      const profit = win ? stake * bet.oddsTo1 : -stake;
      odds.balance += profit;
      odds.lastMsg = win
        ? `✅ WIN: +${fmt(profit)} (stake ${stake}, odds ${bet.oddsTo1}:1)`
        : `❌ LOSS: ${fmt(profit)} (stake ${stake})`;

      // Update quickly by re-rendering odds screen once (safe; not on timer)
      render();
    });
  });

  // Fix Next Round: rebuild bets without resetting balance/round/time.
  document.querySelector<HTMLButtonElement>('#next-round')?.addEventListener('click', () => {
    if (!odds) return;
    // keep time running
    odds.round += 1;
    // rebuild bets by calling startOddsGame logic via a small inline rebuild
    // (duplicate minimal bet builder by restarting then restoring state)
    const keep = { balance: odds.balance, round: odds.round, tEnd: odds.tEnd, tLeft: odds.tLeft };
    startOddsGame();
    if (!odds) return;
    odds.balance = keep.balance;
    odds.round = keep.round;
    odds.tEnd = keep.tEnd;
    odds.tLeft = keep.tLeft;
    odds.lastMsg = null;
    render();
  });
}

// --------------------------------------------------------------

function endScreen() {
  const lastScenario = rounds.at(-1)?.scenario;
  const mark = lastScenario?.trueValue ?? 0;
  const pnl = engine ? engine.pnl(mark) : { cash: 0, inv: 0, mtm: 0, riskAdj: 0 };
  const fills = engine?.state.fills ?? [];

  const byScenario = new Map<string, { n: number; buy: number; sell: number }>();
  for (const f of fills) {
    const k = f.scenario.id;
    const v = byScenario.get(k) ?? { n: 0, buy: 0, sell: 0 };
    v.n += 1;
    if (f.side === 'BUY') v.buy += 1; else v.sell += 1;
    byScenario.set(k, v);
  }

  const rows = [...byScenario.entries()]
    .sort((a, b) => b[1].n - a[1].n)
    .slice(0, 12)
    .map(([k, v]) => `<tr><td>${k.replace(/-/g,' ')}</td><td>${v.n}</td><td>${v.buy}</td><td>${v.sell}</td></tr>`)
    .join('');

  return `
  <div class="container">
    <div class="header">
      <div class="brand">
        <h1>Game Over</h1>
        <p>Daily practice beats perfection.</p>
      </div>
      <div class="badges">
        <div class="badge"><strong>Trades</strong> ${fills.length}</div>
        <div class="badge"><strong>Inv</strong> ${pnl.inv}</div>
        <div class="badge"><strong>Risk-Adj PnL</strong> ${fmt(pnl.riskAdj)}</div>
      </div>
    </div>

    <div class="grid">
      <section class="panel">
        <div class="panel-h"><h2>Summary</h2><button class="btn primary" id="again">Play Again</button></div>
        <div class="panel-b">
          <div class="flash">
            <div class="small">Cash: <b>${fmt(pnl.cash)}</b></div>
            <div class="small">Inventory: <b>${pnl.inv}</b></div>
            <div class="small">MTM: <b>${fmt(pnl.mtm)}</b></div>
            <div class="small">Risk-adjusted: <b>${fmt(pnl.riskAdj)}</b></div>
          </div>
          <div class="footerNote">Next: Try narrowing spread when inventory is near 0; widen when inventory grows.</div>
        </div>
      </section>

      <aside class="panel">
        <div class="panel-h"><h2>Most Traded Scenarios</h2></div>
        <div class="panel-b">
          <table class="table">
            <thead><tr><th>Scenario</th><th>N</th><th>Buy</th><th>Sell</th></tr></thead>
            <tbody>
              ${rows || `<tr><td colspan="4">No trades.</td></tr>`}
            </tbody>
          </table>
        </div>
      </aside>
    </div>
  </div>
  `;
}

function bindWelcome() {
  const $duration = document.querySelector<HTMLSelectElement>('#duration');
  const $inv = document.querySelector<HTMLInputElement>('#invLimit');
  const $predef = document.querySelector<HTMLInputElement>('#predef');
  const $pct = document.querySelector<HTMLInputElement>('#pct');
  const $risk = document.querySelector<HTMLInputElement>('#risk');
  const $invSkew = document.querySelector<HTMLInputElement>('#invSkew');
  const $spreadWiden = document.querySelector<HTMLInputElement>('#spreadWiden');

  const apply = () => {
    settings.durationSec = Number($duration?.value ?? 600);
    settings.inventoryLimit = Math.max(1, Number($inv?.value ?? 10));
    settings.predefinedSpread = Math.max(1e-6, Number($predef?.value ?? 10));
    settings.percentSpread = Math.max(0.001, Number($pct?.value ?? 0.05));
    settings.riskAversion = Math.max(0, Number($risk?.value ?? 1));
    settings.invSkew = Math.max(0, Number($invSkew?.value ?? 0.35));
    settings.spreadWiden = Math.max(0, Number($spreadWiden?.value ?? 0.6));

    const spreadType = document.querySelector<HTMLInputElement>('input[name="spreadType"]:checked')?.value;
    settings.spreadType = spreadType === 'percent' ? 'percent' : 'predefined';
  };

  document.querySelectorAll<HTMLInputElement>('input[name="spreadType"]').forEach(r => {
    r.addEventListener('change', () => {
      apply();
      render();
    });
  });

  [$duration, $inv, $predef, $pct, $risk, $invSkew, $spreadWiden].forEach(el => el?.addEventListener('change', apply));

  document.querySelector<HTMLButtonElement>('#reset-seed')?.addEventListener('click', () => {
    settings.seed = Math.floor(Math.random() * 1e9);
    render();
  });

  document.querySelector<HTMLButtonElement>('#start')?.addEventListener('click', () => {
    apply();
    screen = 'play';
    hardReset();
    render();
  });

  document.querySelector<HTMLButtonElement>('#start-odds')?.addEventListener('click', () => {
    screen = 'odds';
    startOddsGame();
    render();
  });
}

function resetRoundInputs() {
  const $e = document.querySelector<HTMLInputElement>('#estimate');
  const $b = document.querySelector<HTMLInputElement>('#bid');
  const $a = document.querySelector<HTMLInputElement>('#ask');
  if ($e) $e.value = '';
  if ($b) $b.value = '';
  if ($a) $a.value = '';
  $e?.focus();
}

function bindPlay() {
  const $estimate = document.querySelector<HTMLInputElement>('#estimate');
  const $bid = document.querySelector<HTMLInputElement>('#bid');
  const $ask = document.querySelector<HTMLInputElement>('#ask');

  resetRoundInputs();

  document.querySelector<HTMLButtonElement>('#skip')?.addEventListener('click', () => {
    curScenario = pickScenario();
    render();
  });

  document.querySelector<HTMLButtonElement>('#end')?.addEventListener('click', stopGame);

  document.querySelector<HTMLButtonElement>('#auto')?.addEventListener('click', () => {
    if (!engine || !curScenario) return;
    const est = Number($estimate?.value);
    if (!Number.isFinite(est) || est <= 0) {
      alert('Enter a positive estimate first.');
      return;
    }
    const q = engine.defaultQuote(est);
    if ($bid) $bid.value = String(q.bid);
    if ($ask) $ask.value = String(q.ask);
  });

  const submit = () => {
    if (!engine || !curScenario) return;
    const est = Number($estimate?.value);
    const bid = Number($bid?.value);
    const ask = Number($ask?.value);
    if (!Number.isFinite(est) || est <= 0) return alert('Estimate must be > 0');
    if (!Number.isFinite(bid) || !Number.isFinite(ask)) return alert('Bid/ask must be numbers');

    const quote = { bid, ask };
    let fill: Fill | null = null;
    try {
      fill = engine.submitQuote(quote, curScenario, 1);
    } catch (e) {
      alert(e instanceof Error ? e.message : 'Invalid quote');
      return;
    }

    const round: Round = {
      scenario: curScenario,
      estimate: est,
      quote,
      fill,
      mark: curScenario.trueValue,
      ts: Date.now()
    };
    rounds.push(round);

    // Next scenario
    curScenario = pickScenario();
    render();
  };

  document.querySelector<HTMLButtonElement>('#submit')?.addEventListener('click', submit);

  document.addEventListener('keydown', (ev) => {
    if (screen !== 'play') return;
    if (ev.key === 'Enter') {
      ev.preventDefault();
      submit();
    }
    if (ev.key.toLowerCase() === 'r') {
      resetRoundInputs();
    }
  }, { once: true });
}

function bindEnd() {
  document.querySelector<HTMLButtonElement>('#again')?.addEventListener('click', () => {
    screen = 'welcome';
    render();
  });
}

function render() {
  let html = '';
  if (screen === 'welcome') html = welcomeScreen();
  else if (screen === 'play') html = playScreen();
  else html = endScreen();

  $app.innerHTML = html;

  if (screen === 'welcome') bindWelcome();
  if (screen === 'play') bindPlay();
  if (screen === 'end') bindEnd();
}

render();
