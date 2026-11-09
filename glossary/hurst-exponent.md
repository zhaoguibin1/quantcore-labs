# Hurst Exponent (H)

> A scaling exponent that measures long-range dependence in a time series. H < 0.5 indicates mean reversion, H = 0.5 a random walk, and H > 0.5 a persistent, trending series.
> URL: https://quantcore-labs.com/glossary/hurst-exponent/

Category: Time Series & Stat-Arb. Term ID: `hurst-exponent`.

## Definition

The Hurst exponent H describes how the spread of a process grows with the time horizon. For a series with Hurst exponent H, the typical size of a move over τ steps scales as τᴴ. A random walk has H = 0.5.

## Formula

```
Rescaled range (R/S) on returns xₜ, window length n:
  Yₜ = Σ_{s≤t} (xₛ − x̄)            cumulative deviation
  R(n) = max Yₜ − min Yₜ ,  S(n) = std(x)
  E[R(n)/S(n)] ∝ nᴴ   →  H = slope of log(R/S) vs log n

Lagged-difference scaling on log prices pₜ:
  std(pₜ₊τ − pₜ) ∝ τᴴ   →  H = slope of log std vs log τ

H < 0.5 anti-persistent (mean-reverting)
H = 0.5 uncorrelated increments (random walk)
H > 0.5 persistent (trending)
```

## Institutional usage

- **Statistical arbitrage.** A pair or basket spread with H well below 0.5 is a candidate for mean-reversion trading. Use it alongside, not instead of, a cointegration or ADF test.
- **Regime filters.** A rolling H separates trending from choppy periods for momentum versus reversal strategies.
- **Volatility research.** Realised-volatility series show H around 0.1, the "rough volatility" finding of Gatheral, Jaisson and Rosenbaum (2018).

## Pitfalls

- R/S must be applied to returns, not price levels. Applied to a price series, it returns values near 1 that mean nothing.
- Classical R/S is biased upward in small samples. On 4,096 i.i.d. normal returns the code below returns about 0.55, not 0.50. Use the Anis-Lloyd/Peters correction or DFA, and compare against a shuffled-series baseline.
- Estimates are noisy and sensitive to the range of window sizes. Report confidence intervals, for example from a block bootstrap, before trading on a value of 0.45.

## Python reference implementation

Requires numpy. Tested before publication and re-executed with assertions on every rebuild. MIT licensed. Raw file: https://quantcore-labs.com/glossary/hurst-exponent/hurst-exponent.py

```python
import numpy as np

def hurst_rs(returns, min_n: int = 16) -> float:
    """Hurst exponent by rescaled-range (R/S) analysis.
    Input: a series of returns/increments, NOT price levels."""
    x = np.asarray(returns, dtype=float)
    N = len(x)
    sizes = np.unique(np.floor(np.logspace(np.log10(min_n),
                                           np.log10(N // 2), 20)).astype(int))
    rs = []
    for n in sizes:
        k = N // n
        seg = x[: k * n].reshape(k, n)
        dev = np.cumsum(seg - seg.mean(axis=1, keepdims=True), axis=1)
        R = dev.max(axis=1) - dev.min(axis=1)
        S = seg.std(axis=1, ddof=0)
        ok = S > 0
        rs.append(np.mean(R[ok] / S[ok]))
    H, _ = np.polyfit(np.log(sizes), np.log(rs), 1)
    return float(H)

def hurst_lag_var(log_price, max_lag: int = 100) -> float:
    """Hurst from scaling of lagged differences: std(x[t+tau]-x[t]) ~ tau^H.
    Input: log price levels."""
    x = np.asarray(log_price, dtype=float)
    lags = np.arange(2, max_lag)
    tau = [np.std(x[l:] - x[:-l]) for l in lags]
    H, _ = np.polyfit(np.log(lags), np.log(tau), 1)
    return float(H)
```

## FAQ

**What Hurst value indicates mean reversion?**

H below 0.5. Values near 0.5 are consistent with a random walk; small deviations are often estimator bias rather than tradable structure.

## Related

- [Order Flow Imbalance (OFI)](https://quantcore-labs.com/glossary/ofi/)
- [Augmented Dickey-Fuller (ADF) Test](https://quantcore-labs.com/glossary/adf-test/)
- [Cointegration (Engle-Granger & Johansen)](https://quantcore-labs.com/glossary/cointegration/)

