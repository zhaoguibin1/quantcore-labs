# Time-Weighted Average Price (TWAP)

> The arithmetic average of prices sampled on a regular clock. As a benchmark every interval counts once; as a schedule, a parent order is sliced evenly in time.
> URL: https://quantcore-labs.com/glossary/twap/

Category: Execution & Market Microstructure. Term ID: `twap`.

## Definition

TWAP is the mean of a price series after it has been sampled at equal time intervals. Volume does not enter. A TWAP execution schedule therefore sends about the same quantity in each slice of the horizon, regardless of whether the market is busy. The benchmark form asks whether fills beat the average of those sampled prices.

## Formula

```
TWAP = (1 / N) Σ_{k=1..N} P_{t_k}

t_k equally spaced. P is the sample chosen for that slot (here: the last trade in the bin).

A TWAP schedule over horizon T with quantity Q sends about Q / N in each slice.
It does not target a fraction of market volume. That is participation rate.
```

## Benchmark versus schedule

- **Benchmark.** Sample the market on a clock and average it. The implementation below uses the last trade in each bin, which is one convention. The mean of all trades in the bin is another, and it is not TWAP in the strict equal-time sense because a busy bin would contribute more prints.
- **Schedule.** Child orders of equal size at equal times. This page does not size those children. Participation (percent of volume) is a different schedule: [participation rate](https://quantcore-labs.com/glossary/participation-rate/).
- [VWAP](https://quantcore-labs.com/glossary/vwap/) weights the same trades by size, so it follows the volume curve. TWAP does not. Quiet minutes count as much as the close.

## Pitfalls

- **Sampling inside the bin matters.** Last trade, first trade, and the bin's VWAP answer different questions. Say which one the benchmark used.
- **A regular clock includes empty periods only if you define a price for them.** This function drops empty bins, so a halt does not create a slot. Forward-filling across a halt pretends a trade happened.
- **Easy to game, easy to be gamed.** A schedule that must finish a slice every minute will trade through a spread that a volume-aware schedule would wait out. The average is not a target to beat for its own sake.

## Python reference implementation

Requires pandas. Tested before publication and re-executed with assertions on every rebuild. MIT licensed. Raw file: https://quantcore-labs.com/glossary/twap/twap.py

```python
import pandas as pd

def calculate_twap(prices, freq="1min") -> float:
    """Arithmetic mean of regularly sampled prices.

    A Series with a DatetimeIndex is sampled by taking the last observation
    in each bin of width `freq`, dropping empty bins. Any other input is
    treated as already sampled, and the mean of its values is returned.
    """
    if not isinstance(prices, pd.Series):
        prices = pd.Series(prices, dtype="float64")
    if isinstance(prices.index, pd.DatetimeIndex):
        sampled = prices.sort_index().resample(freq).last().dropna()
    else:
        sampled = prices.dropna()
    if sampled.empty:
        raise ValueError("no prices to average")
    return float(sampled.mean())
```

## FAQ

**Why is TWAP not just the average of every trade?**

The average of every trade weights busy moments more heavily, because they contain more prints. That is closer to a trade-count weighted price. TWAP gives each time slot one vote, which is why the series is resampled before the mean.

**When would a TWAP schedule be a poor fit?**

When volume is concentrated, for example around an open, a close or an announcement. Equal time slices then trade a large fraction of the market when it is quiet and a small fraction when it is not. A VWAP or participation schedule follows the volume instead.

## Related

- [Volume-Weighted Average Price (VWAP)](https://quantcore-labs.com/glossary/vwap/)
- [Participation Rate (Percent of Volume)](https://quantcore-labs.com/glossary/participation-rate/)
- [Arrival-Price Slippage](https://quantcore-labs.com/glossary/arrival-price/)

