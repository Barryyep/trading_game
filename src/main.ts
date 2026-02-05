import './style.css';
import { scenarios, type Scenario } from './scenarios';
import { MarketMakingEngine, type Settings, type Quote, type Fill } from './engine';

type Screen = 'welcome' | 'play' | 'end';

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
    render();
  }, 250);
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

function headerBadges() {
  const pnl = engine && curScenario ? engine.pnl(curScenario.trueValue) : null;
  const mtm = pnl ? pnl.riskAdj : 0;
  const inv = pnl ? pnl.inv : 0;
  return `
    <div class="badges">
      <div class="badge"><strong>Timer</strong> ${mmss(tLeft)}</div>
      <div class="badge"><strong>Inv</strong> ${inv}</div>
      <div class="badge"><strong>Risk-Adj PnL</strong> ${fmt(mtm)}</div>
      <div class="badge"><strong>Rounds</strong> ${rounds.length}</div>
    </div>
  `;
}

function welcomeScreen() {
  return `
  <div class="container">
    <div class="header">
      <div class="brand">
        <h1>Make Me a Market — Trading Game</h1>
        <p>Practice market making: quote a bid/ask, manage inventory, and survive the timer.</p>
      </div>
      ${headerBadges()}
    </div>

    <div class="grid">
      <section class="panel">
        <div class="panel-h"><h2>Instructions</h2><span class="kbd">Enter</span></div>
        <div class="panel-b">
          <ol class="small">
            <li>Each round shows a <b>fact / guesstimate</b> scenario with a unit.</li>
            <li>You provide an estimate, then quote <b>bid</b> and <b>ask</b>.</li>
            <li>A simulated customer may trade with you. Your position updates.</li>
            <li>PnL is marked to an internal “true value” for the scenario (approximate).</li>
            <li>Try to earn spread without blowing up inventory.</li>
          </ol>
          <div class="footerNote">This is a clean-room practice toy (not financial advice).</div>
        </div>
      </section>

      <aside class="panel">
        <div class="panel-h"><h2>Settings</h2><button class="btn" id="reset-seed">New Seed</button></div>
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

          <div class="row" style="margin-top:14px">
            <button class="btn primary" id="start">Start Game</button>
          </div>
          <div class="small" style="margin-top:10px">
            Tip: Keep spreads consistent and size your risk. Use <span class="kbd">Enter</span> to submit.
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

  const apply = () => {
    settings.durationSec = Number($duration?.value ?? 600);
    settings.inventoryLimit = Math.max(1, Number($inv?.value ?? 10));
    settings.predefinedSpread = Math.max(1e-6, Number($predef?.value ?? 10));
    settings.percentSpread = Math.max(0.001, Number($pct?.value ?? 0.05));
    settings.riskAversion = Math.max(0, Number($risk?.value ?? 1));

    const spreadType = document.querySelector<HTMLInputElement>('input[name="spreadType"]:checked')?.value;
    settings.spreadType = spreadType === 'percent' ? 'percent' : 'predefined';
  };

  document.querySelectorAll<HTMLInputElement>('input[name="spreadType"]').forEach(r => {
    r.addEventListener('change', () => {
      apply();
      render();
    });
  });

  [$duration, $inv, $predef, $pct, $risk].forEach(el => el?.addEventListener('change', apply));

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
