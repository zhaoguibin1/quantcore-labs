"""Vectorised Daily Backtest with A-share Trading Constraints: reference implementation.

Source: https://quantcore-labs.com/code/vectorized-backtest/
License: MIT (c) 2026 QuantCore Labs
Requires: Python 3.9+, numpy, pandas, polars
"""
import numpy as np
import pandas as pd

def backtest(signal: pd.DataFrame, close: pd.DataFrame, tradable_buy: pd.DataFrame,
             tradable_sell: pd.DataFrame, cost_bps: float = 15.0) -> pd.DataFrame:
    """Daily long-only, equal-weight backtest, dates x stocks, no Python loop over assets.

    signal[t]        : True = want to hold, decided with data up to the close of t
    tradable_buy[t]  : can buy at the close of t   (A-shares: not suspended, not at limit-up)
    tradable_sell[t] : can sell at the close of t  (not suspended, not at limit-down)
    Orders for signal[t] execute at the close of t+1; returns are close-to-close.
    cost_bps is charged on one-way turnover (commission + stamp duty + slippage)."""
    want = signal.shift(1).fillna(False).astype(bool)          # no look-ahead
    held = np.zeros(signal.shape[1], dtype=bool)
    hold = np.zeros(signal.shape, dtype=bool)
    tb, ts, w = tradable_buy.to_numpy(bool), tradable_sell.to_numpy(bool), want.to_numpy(bool)
    for t in range(len(signal)):                                # loop over dates only
        held = np.where(w[t] & ~held & tb[t], True, held)       # enter if allowed
        held = np.where(~w[t] & held & ts[t], False, held)      # exit if allowed (else stuck)
        hold[t] = held
    n = hold.sum(axis=1, keepdims=True)
    weight = pd.DataFrame(np.divide(hold, n, out=np.zeros(hold.shape), where=n > 0),
                          index=signal.index, columns=signal.columns)
    ret = close.pct_change(fill_method=None).fillna(0.0)
    gross = (weight.shift(1).fillna(0.0) * ret).sum(axis=1)      # weight set at close t earns t+1
    turnover = weight.diff().abs().sum(axis=1).fillna(weight.abs().sum(axis=1))
    net = gross - turnover * cost_bps / 1e4
    return pd.DataFrame({"gross": gross, "turnover": turnover, "net": net,
                         "equity": (1 + net).cumprod(), "n_held": n.ravel()})

def backtest_polars(signal_long, cost_bps: float = 15.0):
    """Polars version for the simple case (always tradable) on long data with columns
    date, code, close, signal. Same timing convention as backtest()."""
    import polars as pl
    df = (signal_long.sort("code", "date")
          .with_columns(want=pl.col("signal").shift(1).over("code").fill_null(False),
                        ret=(pl.col("close") / pl.col("close").shift(1) - 1).over("code").fill_null(0.0))
          .with_columns(n=pl.col("want").sum().over("date"))
          .with_columns(weight=pl.when(pl.col("n") > 0).then(pl.col("want").cast(pl.Float64) / pl.col("n")).otherwise(0.0))
          .with_columns(w_prev=pl.col("weight").shift(1).over("code").fill_null(0.0)))
    daily = (df.group_by("date").agg(gross=(pl.col("w_prev") * pl.col("ret")).sum(),
                                     turnover=(pl.col("weight") - pl.col("w_prev")).abs().sum())
             .sort("date")
             .with_columns(net=pl.col("gross") - pl.col("turnover") * cost_bps / 1e4))
    return daily.with_columns(equity=(1 + pl.col("net")).cum_prod())
