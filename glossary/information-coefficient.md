# Information Coefficient (IC)

> The cross-sectional correlation between a factor's values and subsequent asset returns. Rank IC, its mean and ICIR are the standard first test of whether an alpha factor predicts returns.
> URL: https://quantcore-labs.com/glossary/information-coefficient/

Category: Factor Research & Alpha Evaluation. Term ID: `information-coefficient`.

## Definition

The information coefficient is the correlation, computed across assets on one date, between a factor's values and the returns those assets earn over the following holding period. Rank IC uses Spearman rank correlation, which is robust to outliers. A factor is judged on the time series of its IC: its mean, its stability (ICIR) and its statistical significance.

## Formula

```
IC_t      = corr( f_{i,t} , r_{i,t→t+h} )        across assets i on date t
Rank IC_t = corr( rank f_{i,t} , rank r_{i,t→t+h} )   (Spearman)

Mean IC   = (1/n) Σ_t IC_t
ICIR      = mean(IC) / std(IC)
t-stat    ≈ ICIR · √(n / h)        h-period overlapping returns, n dates

Fundamental law (Grinold):  IR ≈ IC · √breadth
```

## Institutional usage

- **Factor screening.** Rank IC is the first filter in most factor libraries. As a rough guide for daily-rebalanced equity factors, a mean rank IC of 0.02–0.05 with ICIR above about 0.5 is worth further work, subject to turnover and costs.
- **Decay analysis.** Computing IC for horizons h = 1, 5, 10, 20 shows how fast a signal decays, which sets the rebalance frequency.
- **Factor weighting.** Rolling mean IC or ICIR is a common input to dynamic factor weighting and to the expected-return scaling in mean-variance optimisation.

## Pitfalls

- **Look-ahead.** Forward returns must start after the signal is known. For A-shares, a factor computed at the close of t can only be traded at t+1 because of T+1 settlement and order timing, so the code defaults to `lag=1`.
- **Untradeable names.** Suspended stocks, and A-share stocks that open at limit-up (for buys) or limit-down (for sells), should be masked out. Otherwise IC overstates what can actually be captured.
- **Overlapping horizons.** With h > 1 consecutive IC values share returns, so the naive t-stat is inflated. Use the √(n/h) adjustment shown here or Newey-West standard errors.
- **Size and industry exposure.** A factor that is mostly a small-cap or sector bet will show high IC in some regimes. Neutralise against size and industry before judging it.

## Python reference implementation

Requires numpy, pandas. Tested before publication and re-executed with assertions on every rebuild. MIT licensed. Raw file: https://quantcore-labs.com/glossary/information-coefficient/information-coefficient.py

```python
import numpy as np
import pandas as pd

def forward_returns(close: pd.DataFrame, horizon: int = 1, lag: int = 1) -> pd.DataFrame:
    """Forward return aligned to the signal date.
    close: dates x assets. A signal computed at the close of t is traded at t+lag
    (lag=1 suits A-share T+1 execution) and held for `horizon` periods."""
    return close.shift(-lag - horizon) / close.shift(-lag) - 1

def information_coefficient(factor: pd.DataFrame, fwd_ret: pd.DataFrame,
                            method: str = "rank", min_obs: int = 20) -> pd.Series:
    """Cross-sectional IC per date, fully vectorised (no per-date loop).
    method="rank" gives Spearman rank IC; "pearson" gives normal IC."""
    f, r = factor.align(fwd_ret, join="inner")
    valid = f.notna() & r.notna()
    f, r = f.where(valid), r.where(valid)
    if method == "rank":
        f, r = f.rank(axis=1), r.rank(axis=1)
    f = f.sub(f.mean(axis=1), axis=0)
    r = r.sub(r.mean(axis=1), axis=0)
    ic = (f * r).sum(axis=1) / np.sqrt((f ** 2).sum(axis=1) * (r ** 2).sum(axis=1))
    return ic.where(valid.sum(axis=1) >= min_obs)

def ic_summary(ic: pd.Series, horizon: int = 1) -> dict:
    """Mean IC, ICIR and an approximate t-stat. Overlapping horizons share
    information, so the effective sample size is taken as n / horizon."""
    ic = ic.dropna()
    n, m, s = len(ic), ic.mean(), ic.std(ddof=1)
    return {"n": n, "mean_ic": m, "ic_std": s, "icir": m / s,
            "t_stat": m / s * np.sqrt(n / horizon), "hit_rate": (ic > 0).mean()}
```

## FAQ

**What is a good IC value?**

For daily or weekly equity factors, a mean rank IC around 0.03–0.05 is typically considered meaningful, and ICIR above 0.5 indicates a stable signal. Values much higher than 0.1 on broad universes usually point to look-ahead bias or a data error.

**Should I use rank IC or Pearson IC?**

Rank IC is the default because it is robust to outliers and to the non-normal cross-section of returns. Pearson IC is closer to what a linear model captures and is useful when factor values are already standardised and winsorised.

## Related

- [Hurst Exponent (H)](https://quantcore-labs.com/glossary/hurst-exponent/)
- [Volume-Weighted Average Price (VWAP)](https://quantcore-labs.com/glossary/vwap/)
- [Vectorised Daily Backtest with A-share Trading Constraints](https://quantcore-labs.com/code/vectorized-backtest/)
- [Amihud Illiquidity Measure (ILLIQ)](https://quantcore-labs.com/glossary/amihud-illiquidity/)

