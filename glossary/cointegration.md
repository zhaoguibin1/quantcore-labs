# Cointegration (Engle-Granger & Johansen)

> Two or more non-stationary price series are cointegrated when some linear combination of them is stationary. This is the statistical basis of pairs and basket trading.
> URL: https://quantcore-labs.com/glossary/cointegration/

Category: Time Series & Stat-Arb. Term ID: `cointegration`.

## Definition

Cointegration means that individually non-stationary series share a common stochastic trend, so a weighted combination of them (the spread) is stationary and mean-reverts. The Engle-Granger two-step method tests one pair through a regression residual. The Johansen method tests several series at once and estimates how many independent cointegrating relationships exist.

## Formula

```
Engle-Granger (two steps):
  1. y_t = α + β·x_t + u_t            (OLS; β = hedge ratio)
  2. ADF on û_t with residual-based MacKinnon critical values
     (2 series, constant: 1% −3.90   5% −3.34   10% −3.04)

Johansen (VECM):
  Δy_t = Π·y_{t−1} + Σ_{i=1..k} Γ_i·Δy_{t−i} + ε_t ,   rank(Π) = r cointegrating vectors
  Trace statistic for H0: rank ≤ r :  λ_trace(r) = −T · Σ_{i=r+1..n} ln(1 − λ̂_i)
```

## Institutional usage

- **Pairs trading.** Go long the spread when its z-score is low and short when it is high. Size the legs with the hedge ratio β.
- **Basket and index arbitrage.** Johansen finds stationary portfolios across three or more assets, for example an ETF against its largest constituents.
- **Cross-market spreads.** Examples include A/H dual-listed shares, futures calendar spreads, and commodity crack or crush spreads.

## Pitfalls

- **Wrong p-values.** Running a plain ADF on an estimated residual overstates significance, because OLS already minimised the residual variance. In the test for this page, an unrelated pair gets p = 0.11 from plain ADF but p = 0.27 from the correct residual-based test.
- **Asymmetry.** Regressing y on x and x on y give different hedge ratios and can give different conclusions. Johansen is symmetric.
- **Unstable hedge ratios.** A β estimated once drifts over time. Re-estimate on a rolling window, or let β vary with a Kalman filter.
- **Correlation is not cointegration.** Two stocks can have highly correlated returns yet drift apart without bound in price.
- **A-share implementation.** Short legs depend on margin-lending availability (融券), which is limited and was further restricted from 2023. Many A-share pair strategies are therefore run as long-only relative-value switches or hedged with index futures.

## Python reference implementation

Requires numpy, statsmodels. Tested before publication and re-executed with assertions on every rebuild. MIT licensed. Raw file: https://quantcore-labs.com/glossary/cointegration/cointegration.py

```python
import warnings
import numpy as np
from statsmodels.tsa.stattools import coint
from statsmodels.tsa.vector_ar.vecm import coint_johansen

def engle_granger(y, x) -> dict:
    """Two-step Engle-Granger test of y ~ a + b*x.
    Uses residual-based MacKinnon critical values (statsmodels.coint), NOT the
    ordinary ADF p-value, which is too lenient for an estimated spread."""
    y, x = np.asarray(y, float), np.asarray(x, float)
    X = np.column_stack([np.ones_like(x), x])
    (a, b), *_ = np.linalg.lstsq(X, y, rcond=None)
    stat, p, crit = coint(y, x, trend="c", autolag="AIC")
    return {"alpha": a, "hedge_ratio": b, "spread": y - a - b * x,
            "stat": stat, "pvalue": p, "crit": crit}

def johansen(prices, det_order: int = 0, k_ar_diff: int = 1) -> dict:
    """Johansen trace test for an (T x n) price matrix.
    det_order: -1 none, 0 constant, 1 trend. Returns the cointegration rank
    at 95% and the first cointegrating vector (normalised on asset 0)."""
    with warnings.catch_warnings():  # recent NumPy: harmless ComplexWarning inside statsmodels
        warnings.simplefilter("ignore", np.exceptions.ComplexWarning)
        res = coint_johansen(np.asarray(prices, float), det_order, k_ar_diff)
    trace, cv95 = res.lr1, res.cvt[:, 1]
    rank = 0
    while rank < len(trace) and trace[rank] > cv95[rank]:
        rank += 1
    vec = np.real(res.evec[:, 0] / res.evec[0, 0])
    return {"rank": rank, "trace": trace, "cv95": cv95, "weights": vec}
```

## FAQ

**Should I use Engle-Granger or Johansen?**

Engle-Granger is simple and fine for a single pair, but its result depends on which series is the dependent variable and it finds at most one relationship. Johansen handles three or more series, is symmetric and estimates the number of cointegrating vectors, at the cost of sensitivity to lag length and deterministic-term choices.

**How is cointegration different from correlation?**

Correlation measures co-movement of returns over a window; cointegration is about the price levels staying tied together over time. Highly correlated stocks can drift apart permanently, while cointegrated ones are pulled back to an equilibrium spread.

## Related

- [Augmented Dickey-Fuller (ADF) Test](https://quantcore-labs.com/glossary/adf-test/)
- [Hurst Exponent (H)](https://quantcore-labs.com/glossary/hurst-exponent/)
- [Fast Rolling Mean, Std, Beta and Z-score with Numba](https://quantcore-labs.com/code/rolling-window-numba/)

