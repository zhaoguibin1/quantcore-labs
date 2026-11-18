// A-share trading cost calculator: pure computation, no DOM. Imported by the page and by tests/a-share-costs.test.mjs.
// Scope: Shanghai and Shenzhen A-share stocks traded in the continuous auction. ETFs, bonds, block trades and the
// Beijing exchange have different fees and are not covered.
//
// Statutory fees (fractions of traded value):
//   stamp duty      seller only     0.05% from 2023-08-28 (was 0.1%)
//   handling fee    both sides      0.00341% from 2023-08-28 (was 0.00487%)     exchange fee, usually inside the commission
//   management fee  both sides      0.002%                                      CSRC fee, usually inside the commission
//   transfer fee    both sides      0.001% from 2022-04-29 (was 0.002% from 2015-08-01)
// Each fee is rounded to 0.01 CNY, as brokers do on contract notes. The commission minimum applies per order.

export const REGIMES = [
  { id: '2023-08-28', from: '2023-08-28', to: null, stamp: 0.0005, handling: 0.0000341, mgmt: 0.00002, transfer: 0.00001,
    label: 'From 2023-08-28 (current)' },
  { id: '2022-04-29', from: '2022-04-29', to: '2023-08-27', stamp: 0.001, handling: 0.0000487, mgmt: 0.00002, transfer: 0.00001,
    label: '2022-04-29 to 2023-08-27' },
  { id: '2015-08-01', from: '2015-08-01', to: '2022-04-28', stamp: 0.001, handling: 0.0000487, mgmt: 0.00002, transfer: 0.00002,
    label: '2015-08-01 to 2022-04-28' },
];

export function regimeOn(date) {
  const d = String(date).slice(0, 10);
  for (const r of REGIMES) if (d >= r.from && (r.to === null || d <= r.to)) return r;
  return null;
}

export const cents = x => Math.round((x + Number.EPSILON) * 100) / 100;

// Shares for a target amount: main board and ChiNext buy in lots of 100; STAR Market needs at least 200, then steps of 1.
export function sharesFor(amount, price, board = 'main') {
  if (!(amount > 0) || !(price > 0)) return 0;
  const raw = Math.floor(amount / price + 1e-9);
  if (board === 'star') return raw >= 200 ? raw : 0;
  return Math.floor(raw / 100) * 100;
}

// One order. opts: { value, side: 'buy'|'sell', commission (fraction), minCommission (CNY),
//                   commissionIncludesFees (bool, default true), regime, slippageBps }
export function legCost(o) {
  const v = o.value, r = o.regime, sell = o.side === 'sell';
  if (!(v > 0)) return { value: 0, commission: 0, regulatory: 0, transfer: 0, stamp: 0, slippage: 0, total: 0, minBinding: false };
  const rawComm = v * o.commission, min = o.minCommission ?? 0;
  const commission = cents(Math.max(rawComm, min));
  const regulatory = o.commissionIncludesFees === false ? cents(v * r.handling) + cents(v * r.mgmt) : 0;
  const transfer = cents(v * r.transfer);
  const stamp = sell ? cents(v * r.stamp) : 0;
  const slippage = v * (o.slippageBps ?? 0) / 1e4;
  const total = commission + regulatory + transfer + stamp + slippage;
  return { value: v, commission, regulatory, transfer, stamp, slippage, total, minBinding: min > 0 && rawComm < min };
}

// Buy then sell the same value (no price change), so costs are comparable as a fraction of the traded value.
export function roundTrip(o) {
  const buy = legCost({ ...o, side: 'buy' }), sell = legCost({ ...o, side: 'sell' });
  const total = buy.total + sell.total;
  return { buy, sell, total, bps: o.value > 0 ? total / o.value * 1e4 : NaN };
}

// Smallest order value at which the commission minimum stops binding.
export function minBindsBelow(commission, minCommission) {
  return commission > 0 && minCommission > 0 ? minCommission / commission : 0;
}

// Annual drag: one-way turnover T means T times the portfolio is bought and T times sold in a year,
// i.e. T round trips of the whole portfolio. orderValue sets where the commission minimum bites.
export function annualDrag(o, turnover, portfolio) {
  const rt = roundTrip(o), frac = rt.bps / 1e4;
  return { fraction: turnover * frac, cny: portfolio > 0 ? turnover * frac * portfolio : NaN, roundTripBps: rt.bps };
}

// Round-trip cost in bps across order sizes (log-spaced), for the chart.
export function costCurve(o, lo = 1e3, hi = 1e7, n = 81) {
  const out = [];
  for (let i = 0; i < n; i++) {
    const v = lo * Math.pow(hi / lo, i / (n - 1));
    out.push({ value: v, bps: roundTrip({ ...o, value: v }).bps });
  }
  return out;
}

export const PRESETS = {
  retail: { label: 'Typical retail account', commission: 0.00025, minCommission: 5, commissionIncludesFees: true },
  lowcost: { label: 'Low-cost account, no minimum', commission: 0.0001, minCommission: 0, commissionIncludesFees: true },
  quant: { label: 'Commission plus fees, no minimum', commission: 0.00008, minCommission: 0, commissionIncludesFees: false },
};
