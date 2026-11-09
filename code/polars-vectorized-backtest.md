# Polars Moving-Average Crossover, Lagged One Bar

> A moving-average crossover in Polars lazy expressions. The position is shifted one bar so it cannot earn the return that formed the signal, and a cost is charged when the position changes. Educational example only.
> URL: https://quantcore-labs.com/code/polars-vectorized-backtest/

Category: Backtesting. Snippet ID: `polars-vectorized-backtest`.

## What it does

The signal is long when the fast mean of close is above the slow mean, and flat otherwise. That decision is delayed by one bar before it multiplies returns, which is the minimum delay that removes same-bar look-ahead on a close-to-close return. Turnover is the absolute change in position. Cost is turnover times a constant in basis points. This is a single-series illustration, not a portfolio backtest and not a trading recommendation.

## Approach

```
ret_t     = C_t / C_{t−1} − 1
signal_t  = 1{ MA_fast(C)_t > MA_slow(C)_t }     (0 while either mean is null)
pos_t     = signal_{t−1}                         (0 at t = 0)
cost_t    = |pos_t − pos_{t−1}| · cost_bps / 10^4
strat_t   = pos_t · ret_t − cost_t
equity_t  = Π_{s≤t} (1 + strat_s)

Warm-up bars, where a mean is missing, contribute signal 0.
```

## What the lag does

- The means at bar t use the close of bar t. The return of bar t is the move from t−1 to t, which is already in that close. Multiplying them on the same row would book a fill at a price the signal has already used.
- `shift(1)` applies the decision from bar t to the return of bar t+1: the earliest close-to-close return that starts after the signal.
- For a dates × stocks book with suspensions and limit-up or limit-down flags, use [vectorized-backtest](https://quantcore-labs.com/code/vectorized-backtest/). This page is one series and no trading constraints.

## Pitfalls

- **Costs are a flat bps charge.** There is no spread, no impact and no borrow. A crossover that looks fine here can be negative once those are added.
- **One position, all or nothing.** The position is 0 or 1. It does not size by volatility or cap turnover.
- **Adjusted prices.** Splits and dividends have to be in the close series already. A raw close series invents returns on corporate actions.
- **This is not a forecast.** A historical equity curve of a moving-average rule is a description of that sample. It is not evidence that the rule will make money on the next sample.

## Python reference implementation

Requires polars. Tested before publication and re-executed with assertions on every rebuild. MIT licensed. Raw file: https://quantcore-labs.com/code/polars-vectorized-backtest/polars-vectorized-backtest.py

```python
import polars as pl

def ma_crossover_backtest(df: pl.DataFrame, fast: int = 20, slow: int = 100, cost_bps: float = 1.0) -> pl.DataFrame:
    """Moving-average crossover on columns timestamp, close.

    The position implied by bar t is applied to the return of bar t+1.
    cost_bps is charged on the absolute change in position.
    Educational example only; not a trading strategy.
    """
    if fast < 1 or slow < 1:
        raise ValueError("fast and slow windows must be positive")
    if cost_bps < 0:
        raise ValueError("cost_bps must be non-negative")
    ready = pl.col("fast_ma").is_not_null() & pl.col("slow_ma").is_not_null()
    signal = pl.when(ready & (pl.col("fast_ma") > pl.col("slow_ma"))).then(1.0).otherwise(0.0)
    return (
        df.lazy()
        .sort("timestamp")
        .with_columns(
            ret=pl.col("close").pct_change(),
            fast_ma=pl.col("close").rolling_mean(fast),
            slow_ma=pl.col("close").rolling_mean(slow),
        )
        .with_columns(pos=signal.shift(1).fill_null(0.0))
        .with_columns(cost=pl.col("pos").diff().abs().fill_null(0.0) * cost_bps / 1e4)
        .with_columns(strat_ret=pl.col("pos") * pl.col("ret").fill_null(0.0) - pl.col("cost"))
        .with_columns(equity=(1 + pl.col("strat_ret")).cum_prod())
        .collect()
    )
```

## FAQ

**Why is the position shifted by one bar?**

The close that updates the moving averages is the same close that ends the bar's return. Using the signal on that same return treats the bar as both the information and the fill. The shift makes the signal wait for the next return.

**Does a higher equity curve mean the rule works?**

No. The curve is the result of this rule, this cost and this sample, with no market impact. Use it to check the code. Judging whether a rule is worth trading needs a later sample, realistic costs and a risk report.

## Use it in a calculator

- [Performance & Drawdown Analytics](https://quantcore-labs.com/tools/performance-analytics/)

## Related

- [Vectorised Daily Backtest with A-share Trading Constraints](https://quantcore-labs.com/code/vectorized-backtest/)
- [Sharpe Ratio](https://quantcore-labs.com/glossary/sharpe-ratio/)
- [Maximum Drawdown](https://quantcore-labs.com/glossary/max-drawdown/)

