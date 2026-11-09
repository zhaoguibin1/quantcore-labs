# Vectorised Daily Backtest with A-share Trading Constraints

> A daily long-only backtest core that vectorises over the whole stock universe. It blocks look-ahead by construction and handles suspensions, limit-up and limit-down untradability and turnover costs. A Polars version is included for the unconstrained case.
> URL: https://quantcore-labs.com/code/vectorized-backtest/

Category: Backtesting. Snippet ID: `vectorized-backtest`.

## What it does

The backtest turns a dates × stocks boolean signal into equal-weight holdings and daily net returns. Every operation is vectorised across stocks. Only the loop over dates remains, because whether a stock can be bought or sold today depends on what is already held: a stock stuck at limit-down cannot be sold and stays in the book. Orders decided at the close of day t execute at the close of t+1, so a signal can never use the return it trades on.

## Approach

```
Timing:   signal[t] (data ≤ close t) → order at close t+1 → earns close(t+1) → close(t+2)

want_t    = signal_{t−1}
held_t    = enter if want ∧ ¬held ∧ buyable_t ;  exit if ¬want ∧ held ∧ sellable_t
weight_t  = held_t / Σ held_t
gross_t   = Σ_i weight_{t−1,i} · r_{t,i}
turnover_t= Σ_i |weight_{t,i} − weight_{t−1,i}|
net_t     = gross_t − turnover_t · cost_bps / 10⁴
```

## What the tests check

- Net returns match a naive per-stock, per-day loop to within 1e−17.
- The Polars version matches the pandas version when every stock is tradable.
- **Look-ahead probe.** Two hypothetical signals were run. One uses only the next day's return, which this timing can never capture; it earns about zero (0.03% per day, which is noise). The other uses the return two days ahead, which this timing does capture; it earns 1.6% per day, the size of gain that look-ahead leaks would produce.

## Pitfalls

- **Costs.** A-share stamp duty is charged on sells only (0.05% since 28 August 2023), plus commission and slippage. A single symmetric `cost_bps` is an approximation; use separate buy and sell rates for precision.
- **Prices.** Use dividend- and split-adjusted closes, such as back-adjusted 后复权 prices, or returns will show false jumps.
- **Survivorship.** Include delisted stocks and the universe as it was on each date, not today's constituents.
- **Close execution is optimistic.** Trading exactly at the close ignores closing-auction impact. Stress-test with next-day VWAP or open execution.
- **Tradability flags.** Derive limit-up and limit-down from the previous close and the board's limit (±10% main board, ±20% ChiNext/STAR, ±5% ST). A close at the limit price is the usual proxy for "could not trade in that direction".

## Python reference implementation

Requires numpy, pandas, polars. Tested before publication and re-executed with assertions on every rebuild. MIT licensed. Raw file: https://quantcore-labs.com/code/vectorized-backtest/vectorized-backtest.py

```python
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
```

## FAQ

**Why is there still a loop over dates?**

Holdings are path-dependent once trading constraints exist: a stock at limit-down cannot be sold, so whether it is held today depends on yesterday's holdings. The loop runs over dates only, with every operation inside vectorised across the whole universe, so a 20-year daily backtest on 5,000 stocks is about 5,000 vectorised steps.

**How do I avoid look-ahead bias?**

Shift every signal by at least one period before it can affect positions, and decide the execution price in advance. In this code a signal formed at the close of t trades at the close of t+1 and first earns the t+1 to t+2 return; the test suite checks that a signal built from the t to t+1 return earns nothing.

## Related

- [Information Coefficient (IC)](https://quantcore-labs.com/glossary/information-coefficient/)
- [Value at Risk (VaR) and Expected Shortfall (ES)](https://quantcore-labs.com/glossary/var-expected-shortfall/)
- [Amihud Illiquidity Measure (ILLIQ)](https://quantcore-labs.com/glossary/amihud-illiquidity/)

