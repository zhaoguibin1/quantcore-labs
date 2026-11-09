# Volume-Weighted Average Price (VWAP)

> The ratio of cumulative traded value to cumulative volume over a horizon. The standard benchmark for judging institutional execution quality.
> URL: https://quantcore-labs.com/glossary/vwap/

Category: Execution & Market Microstructure. Term ID: `vwap`.

## Definition

VWAP is the average price of all trades over a period, with each trade weighted by its size. It equals total traded value divided by total traded volume.

## Formula

```
VWAP = Σᵢ pᵢ·vᵢ / Σᵢ vᵢ

pᵢ : price of trade i        (bar data: typical price (H + L + C) / 3)
vᵢ : volume of trade i
Σ  : over all trades in the horizon (usually one session, reset at the open)

Execution cost vs. VWAP (bps) = side × (P̄_fill − VWAP) / VWAP × 10⁴
side = +1 for buys, −1 for sells; positive = worse than benchmark
```

## Institutional usage

- **Execution benchmark.** Brokers and buy-side trading desks report slippage against interval VWAP. Beating VWAP on a buy means the average fill came in below it.
- **VWAP algorithms.** These split a parent order across the day in proportion to a forecast intraday volume profile, so the fills track the market's own VWAP. The main risk is a bad volume forecast.
- **Intraday signal.** Price relative to running VWAP is a common mean-reversion and trend filter. Anchored VWAP measures from a chosen event, such as earnings or a gap.

## Pitfalls

- Bar-based VWAP built from typical price only approximates trade-level VWAP. Use tick data when the result is used for cost attribution.
- Decide whether opening and closing auctions are included. On A-share markets the 09:15–09:25 call auction and the 14:57–15:00 closing auction can carry significant volume.
- A large order is part of the VWAP it is measured against. Participation above roughly 10–20% of volume makes the benchmark easy to "beat" and less informative; compare with arrival price as well.

## Python reference implementation

Requires numpy, pandas. Tested before publication and re-executed with assertions on every rebuild. MIT licensed. Raw file: https://quantcore-labs.com/glossary/vwap/vwap.py

```python
import numpy as np
import pandas as pd

def vwap(price: pd.Series, volume: pd.Series) -> float:
    """Session VWAP: sum(p * v) / sum(v)."""
    v = volume.astype(float)
    return float((price * v).sum() / v.sum())

def intraday_vwap(bars: pd.DataFrame) -> pd.Series:
    """Running VWAP that resets each trading day.
    bars: DatetimeIndex, columns high, low, close, volume."""
    tp = (bars["high"] + bars["low"] + bars["close"]) / 3.0  # typical price
    pv = tp * bars["volume"]
    day = bars.index.normalize()
    return pv.groupby(day).cumsum() / bars["volume"].groupby(day).cumsum()

def slippage_bps(avg_fill: float, bench_vwap: float, side: int) -> float:
    """Execution cost vs VWAP in basis points. side=+1 buy, -1 sell.
    Positive = worse than VWAP."""
    return side * (avg_fill - bench_vwap) / bench_vwap * 1e4
```

## FAQ

**Is VWAP the same as TWAP?**

No. TWAP weights every time interval equally; VWAP weights by traded volume, so it follows the market's intraday volume curve.

## Related

- [Order Flow Imbalance (OFI)](https://quantcore-labs.com/glossary/ofi/)
- [Amihud Illiquidity Measure (ILLIQ)](https://quantcore-labs.com/glossary/amihud-illiquidity/)

