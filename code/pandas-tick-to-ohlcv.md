# Resample Trade Ticks to OHLCV and VWAP Bars

> Turn a trade tape with a timestamp index into regular time bars: open, high, low, close, volume, VWAP and trade count. Empty bins are dropped.
> URL: https://quantcore-labs.com/code/pandas-tick-to-ohlcv/

Category: Data Engineering for Quants. Snippet ID: `pandas-tick-to-ohlcv`.

## What it does

Time bars group irregular trades into fixed clock buckets. Open and close are the first and last trade prices in the bucket, high and low are the extrema, and volume and trade count are sums and counts. VWAP is the volume-weighted average of the trade prices inside the bucket, which is the trade-level VWAP rather than a typical-price approximation from the bar.

## Approach

```
For the trades in a clock bin of width Δ:
  open  = price of the earliest trade
  high  = max price,   low = min price
  close = price of the latest trade
  volume = Σ volume,   trades = count
  VWAP  = Σ price·volume / Σ volume     (undefined if volume is 0)

Bins with no trades are omitted.
```

## When to use it

- Building a research bar from a trade tape before a backtest or a volatility estimate.
- Checking a SQL aggregation. The same VWAP is computed in [duckdb-asof-vwap](https://quantcore-labs.com/code/duckdb-asof-vwap/) without loading the tape into pandas.
- Session VWAP across a whole day, as a benchmark rather than a bar feature, is the [VWAP](https://quantcore-labs.com/glossary/vwap/) term.

## Pitfalls

- **Timestamp ties.** `resample` uses the index order. Two trades with the same timestamp keep whatever order the frame has, and that order decides open and close. Sort by `(timestamp, sequence)` before setting the index. The DuckDB ticks page shows the same trap.
- **Empty minutes.** They are removed, so the result is not a regular grid. Reindex against a full calendar if a model needs missing bars as gaps.
- **Zero volume.** A bucket whose volumes sum to zero gets a missing VWAP rather than a divide-by-zero. Those prints are not a price discovery event.
- **Auctions and sessions.** The resampler does not know the cash-session clock. Filter the tape to the session you mean before calling it.

## Python reference implementation

Requires pandas. Tested before publication and re-executed with assertions on every rebuild. MIT licensed. Raw file: https://quantcore-labs.com/code/pandas-tick-to-ohlcv/pandas-tick-to-ohlcv.py

```python
import pandas as pd

def ticks_to_bars(ticks: pd.DataFrame, freq: str = "1min") -> pd.DataFrame:
    """OHLCV, VWAP and trade count from a trade tape.

    ticks: DatetimeIndex, columns price and volume, sorted by time.
    Empty bins are dropped. VWAP is missing when the bin volume is 0.
    """
    if not isinstance(ticks.index, pd.DatetimeIndex):
        raise TypeError("ticks must be indexed by a DatetimeIndex")
    if not {"price", "volume"}.issubset(ticks.columns):
        raise ValueError("ticks need price and volume columns")
    ticks = ticks.sort_index()
    grouped = ticks.resample(freq)
    bars = grouped["price"].ohlc()
    bars["volume"] = grouped["volume"].sum()
    traded_value = (ticks["price"] * ticks["volume"]).resample(freq).sum()
    bars["vwap"] = traded_value / bars["volume"].where(bars["volume"] > 0)
    bars["trades"] = grouped["price"].count()
    return bars.dropna(subset=["open"])
```

## FAQ

**Why can VWAP differ from a typical-price bar VWAP?**

Typical price (high + low + close) / 3 times bar volume only approximates the trades. This function weights each trade by its own size, which is the VWAP used as an execution benchmark.

**What happens to a minute with no trades?**

It is omitted. The clock bin exists inside resample as an empty row and is then dropped, so you can join the result back onto a complete calendar if you need an explicit gap.

## Related

- [Volume-Weighted Average Price (VWAP)](https://quantcore-labs.com/glossary/vwap/)
- [Per-Symbol Minute VWAP in DuckDB](https://quantcore-labs.com/code/duckdb-asof-vwap/)
- [Equal-Volume Bars from a Trade Tape](https://quantcore-labs.com/code/pandas-volume-bars/)

