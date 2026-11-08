"""Polars Moving-Average Crossover, Lagged One Bar: reference implementation.

Source: https://quantcore-labs.com/code/polars-vectorized-backtest/
License: MIT (c) 2026 QuantCore Labs
Requires: Python 3.9+, polars
"""
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
