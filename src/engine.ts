import type { Scenario } from './scenarios';

export type SpreadType = 'predefined' | 'percent';

export type Settings = {
  durationSec: number;
  spreadType: SpreadType;
  predefinedSpread: number; // absolute width, in scenario unit
  percentSpread: number; // as fraction, e.g. 0.05 = 5%
  inventoryLimit: number;
  riskAversion: number; // penalize inventory mark-to-market variability
  invSkew: number; // inventory-based mid shift (in spread widths)
  spreadWiden: number; // widen spreads as |inv| grows (multiplier)
  seed?: number;
};

export type Quote = { bid: number; ask: number };

export type Fill = {
  side: 'BUY' | 'SELL'; // from maker perspective (BUY = you buy at bid)
  price: number;
  qty: number;
  scenario: Scenario;
  fair: number;
  ts: number;
};

export type State = {
  cash: number;
  inv: number;
  realized: number;
  lastMark: number | null;
  fills: Fill[];
};

function clamp(x: number, lo: number, hi: number) {
  return Math.min(hi, Math.max(lo, x));
}

// Light RNG (deterministic if seed is provided)
export function mulberry32(seed: number) {
  let a = seed >>> 0;
  return function () {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export class MarketMakingEngine {
  private rng: () => number;
  public readonly settings: Settings;
  public state: State;

  constructor(settings: Settings) {
    this.settings = settings;
    this.rng = typeof settings.seed === 'number' ? mulberry32(settings.seed) : Math.random;
    this.state = { cash: 0, inv: 0, realized: 0, lastMark: null, fills: [] };
  }

  // Customer fair value is centered on true value with noise.
  // Noise scale is larger for big values.
  private sampleFair(trueValue: number) {
    const u = this.rng();
    // lognormal-ish spread around true value: +/- ~10-25%
    const sigma = 0.18;
    const z = Math.sqrt(-2 * Math.log(Math.max(1e-12, u))) * Math.cos(2 * Math.PI * this.rng());
    const mult = Math.exp(sigma * z);
    return trueValue * mult;
  }

  private quoteSanity(q: Quote) {
    if (!Number.isFinite(q.bid) || !Number.isFinite(q.ask)) throw new Error('Bad quote');
    if (q.bid <= 0 || q.ask <= 0) throw new Error('Bid/ask must be > 0');
    if (q.bid >= q.ask) throw new Error('Bid must be < ask');
  }

  // Decide whether customer trades.
  // If fair is above ask by enough, customer buys.
  // If fair is below bid by enough, customer sells.
  // Otherwise: no trade.
  // Also reduce probability when maker is close to inventory limit.
  submitQuote(q: Quote, scenario: Scenario, qty = 1): Fill | null {
    this.quoteSanity(q);

    const fair = this.sampleFair(scenario.trueValue);
    const edgeBuy = fair - q.ask;
    const edgeSell = q.bid - fair;

    // Convert edge to probability smoothly.
    const scale = Math.max(1, 0.06 * scenario.trueValue);
    const pBuy = 1 / (1 + Math.exp(-edgeBuy / scale));
    const pSell = 1 / (1 + Math.exp(-edgeSell / scale));

    // Inventory pressure: reduce trade likelihood when close to limit
    const invPressure = Math.abs(this.state.inv) / Math.max(1, this.settings.inventoryLimit);
    const damp = clamp(1 - 0.35 * invPressure, 0.35, 1);

    const r = this.rng();
    let fill: Fill | null = null;
    if (pBuy * damp > 0.60 && r < pBuy * damp) {
      // customer buys, you sell at ask
      fill = { side: 'SELL', price: q.ask, qty, scenario, fair, ts: Date.now() };
    } else if (pSell * damp > 0.60 && r < pSell * damp) {
      // customer sells, you buy at bid
      fill = { side: 'BUY', price: q.bid, qty, scenario, fair, ts: Date.now() };
    }

    if (!fill) {
      // small chance of random flow even when fair inside spread
      const flow = this.rng();
      if (flow < 0.06 * damp) {
        const side = this.rng() < 0.5 ? 'BUY' : 'SELL';
        fill = side === 'BUY'
          ? { side: 'BUY', price: q.bid, qty, scenario, fair, ts: Date.now() }
          : { side: 'SELL', price: q.ask, qty, scenario, fair, ts: Date.now() };
      }
    }

    if (!fill) return null;

    // Enforce hard inventory limit by rejecting the fill if it would breach.
    const nextInv = this.state.inv + (fill.side === 'BUY' ? fill.qty : -fill.qty);
    if (Math.abs(nextInv) > this.settings.inventoryLimit) return null;

    // Apply fill to cash/inventory.
    if (fill.side === 'BUY') {
      this.state.inv += fill.qty;
      this.state.cash -= fill.price * fill.qty;
    } else {
      this.state.inv -= fill.qty;
      this.state.cash += fill.price * fill.qty;
    }

    this.state.fills.push(fill);
    this.state.lastMark = scenario.trueValue;

    return fill;
  }

  // Mark-to-market at scenario true value.
  pnl(mark: number) {
    const unreal = this.state.inv * mark;
    const raw = this.state.cash + unreal;
    const riskPenalty = this.settings.riskAversion * Math.abs(this.state.inv) * 0.01 * mark;
    return {
      cash: this.state.cash,
      inv: this.state.inv,
      mtm: raw,
      riskAdj: raw - riskPenalty
    };
  }

  // Estimate-aware, inventory-aware default quote.
  // - Mid is skewed to reduce inventory: long inventory shifts mid down, short shifts up.
  // - Spread widens with |inventory|.
  defaultQuote(estimate: number) {
    const inv = this.state.inv;
    const invLimit = Math.max(1, this.settings.inventoryLimit);
    const invNorm = clamp(inv / invLimit, -1, 1);

    const baseHalf = this.settings.spreadType === 'percent'
      ? Math.max(estimate * this.settings.percentSpread * 0.5, 1e-6)
      : Math.max(this.settings.predefinedSpread * 0.5, 1e-6);

    const widen = 1 + this.settings.spreadWiden * Math.abs(invNorm);
    const half = baseHalf * widen;

    // mid shift in units of half-spread
    const midShift = -this.settings.invSkew * invNorm * half;
    const mid = estimate + midShift;

    return {
      bid: Math.max(1e-6, mid - half),
      ask: mid + half,
    };
  }

  // Break-even (mark) to flatten current inventory.
  // If inv != 0, BE = -cash / inv.
  breakEven() {
    if (this.state.inv === 0) return null;
    return -this.state.cash / this.state.inv;
  }
}
