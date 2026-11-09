# Equal-Volume Bars from a Trade Tape

> Group trades into bars that each contain about the same traded volume. The trade that crosses the threshold stays in the bar it completes. A single trade larger than the threshold is not split.
> URL: https://quantcore-labs.com/code/pandas-volume-bars/

Category: Data Engineering for Quants. Snippet ID: `pandas-volume-bars`.

## What it does

Volume bars sample the tape by quantity instead of by clock time. Walking the trades in order, a bar closes on the trade that makes cumulative volume reach the next multiple of the threshold. Bars therefore hold roughly constant information in the sense of traded size, and the time between bars shrinks when the market is active. The last bar is returned even if it has not reached the threshold.

## Approach

```
Threshold V > 0. Trades in time order, volumes v_i ≥ 0.
Let C_i = Σ_{k≤i} v_k and C_0-side = 0 before trade i (C_{i−1}).
  bar(i) = floor( C_{i−1} / V )

The trade that pushes C_i across a multiple of V stays in the bar that was open.
A trade with v_i > V is kept whole, so that bar's volume can exceed V.
OHLC and the bar's end timestamp come from the trades in the group.
```

## Why sample by volume

- Clock bars mix quiet minutes, which are almost empty, with auction and news minutes that contain a large share of the day's volume. Volume bars put a similar amount of trading in each row.
- López de Prado argues that sampling by volume (or by information) produces return series closer to i.i.d. than sampling by the clock. That is a modelling convenience, not a source of returns by itself.
- Bars like these are the input to bucket measures such as [VPIN](https://quantcore-labs.com/glossary/vpin/), which wants equal-volume buckets rather than equal-time buckets.

## Pitfalls

- **Do not split prints.** A block trade larger than V becomes one oversized bar. Splitting it would invent prices.
- **The closing print is included.** Floor of the cumulative volume *before* the trade is what keeps the crossing trade in the bar that fills. Floor of the cumulative volume *after* the trade pushes that trade into the next bar and leaves the earlier bar short of V.
- **Incomplete tail.** The last bar is whatever remains. Drop it before estimating a statistic that assumes every bar has volume near V.
- **Sort order is the sampling order.** A DatetimeIndex is sorted. Any other index is used as given, which is wrong if the frame is not already in exchange order.

## Python reference implementation

Requires numpy, pandas. Tested before publication and re-executed with assertions on every rebuild. MIT licensed. Raw file: https://quantcore-labs.com/code/pandas-volume-bars/pandas-volume-bars.py

```python
import numpy as np
import pandas as pd

def volume_bars(ticks: pd.DataFrame, bar_volume: float) -> pd.DataFrame:
    """OHLCV bars of about `bar_volume` traded units.

    The trade that crosses each multiple of bar_volume stays in the bar it
    completes. Trades are not split. The final, possibly short, bar is kept.
    """
    if bar_volume <= 0:
        raise ValueError("bar_volume must be positive")
    if not {"price", "volume"}.issubset(ticks.columns):
        raise ValueError("ticks need price and volume columns")
    if isinstance(ticks.index, pd.DatetimeIndex):
        ticks = ticks.sort_index()
    vol = ticks["volume"].to_numpy(dtype=np.float64)
    if vol.size and np.any(vol < 0):
        raise ValueError("volume must be non-negative")
    if vol.size == 0:
        return pd.DataFrame(columns=["end_time", "open", "high", "low", "close", "volume"])
    bar_id = np.floor(np.cumsum(vol) - vol) // bar_volume
    bar_id = pd.Series(bar_id.astype(np.int64), index=ticks.index)
    grouped = ticks.groupby(bar_id, sort=True)
    out = grouped.agg(
        open=("price", "first"),
        high=("price", "max"),
        low=("price", "min"),
        close=("price", "last"),
        volume=("volume", "sum"),
    )
    out.insert(0, "end_time", grouped.tail(1).index.to_numpy())
    out.index.name = "bar_id"
    return out
```

## FAQ

**Why not use cumsum(volume) // bar_volume as the bar id?**

That assigns the trade which crosses the threshold to the next bar, so the bar you just closed is systematically short of the threshold. Using the cumulative volume before the trade keeps the crossing trade in the bar that fills.

**How should I pick the threshold?**

A common research choice is a fraction of average daily volume, so a typical day produces a similar number of bars across names. The threshold is a sampling parameter. It is not an execution instruction.

## Related

- [Resample Trade Ticks to OHLCV and VWAP Bars](https://quantcore-labs.com/code/pandas-tick-to-ohlcv/)
- [Volume-Synchronized Probability of Informed Trading (VPIN)](https://quantcore-labs.com/glossary/vpin/)
- [Realized Volatility](https://quantcore-labs.com/glossary/realized-volatility/)

