# Beta

> The OLS slope of an asset's returns on a market's returns: covariance divided by the market's variance. It is the CAPM coefficient on the sample you pass in, not a forecast.
> URL: https://quantcore-labs.com/glossary/beta/

Category: Portfolio & Factor Models. Term ID: `beta`.

## Definition

Beta measures how much an asset's return tended to move with the market return in a sample. It is Cov(R_i, R_m) / Var(R_m), which is also the slope of a regression of the asset on the market with an intercept. A beta of 1 means the asset moved one-for-one with the market on average, after the intercept absorbed the mean difference. It says nothing, by itself, about residual risk or about whether the sample will repeat.

## Formula

```
β = Cov(R_i, R_m) / Var(R_m)

Sample covariance and variance, ddof = 1 (the OLS slope).
The intercept α = mean(R_i) − β · mean(R_m) is not returned.
Var(R_m) = 0 → undefined; the function raises.

CAPM uses a beta against the market excess return. This function uses the two series you pass. If they are excess returns, β is the CAPM slope; if they are raw returns, it is a raw-return slope.
```

## What it is not

- It is not correlation. Correlation divides by both standard deviations and lies in [−1, 1]. Beta is in the units of "asset return per unit of market return" and can sit far outside that interval.
- It is not [tracking error](https://quantcore-labs.com/glossary/tracking-error/). Tracking error is the volatility of the gap. Beta is the slope. An index fund should have a beta near 1 and a small tracking error; a leveraged index fund can have a beta near 2 and still a small residual.
- It is not the [Sharpe ratio](https://quantcore-labs.com/glossary/sharpe-ratio/). Sharpe has no benchmark series other than cash.

## Pitfalls

- **Unstable in short samples.** A 60-day beta and a five-year beta of the same name often disagree. The function does not shrink toward 1. If you want a shrunk beta, do it after the call and say so.
- **The market series is the definition of the beta.** A national equity index, a futures excess return and a global market portfolio produce three different numbers. The symbol β does not record which one you used.
- **Changing composition.** Beta of a portfolio computed from the portfolio's past returns describes the portfolio as it was, including positions it no longer holds.

## Python reference implementation

Requires numpy. Tested before publication and re-executed with assertions on every rebuild. MIT licensed. Raw file: https://quantcore-labs.com/glossary/beta/beta.py

```python
import numpy as np

def beta(asset, market) -> float:
    """OLS slope Cov(asset, market) / Var(market), sample moments (ddof=1)."""
    a = np.asarray(asset, dtype=float)
    m = np.asarray(market, dtype=float)
    if a.shape != m.shape or a.ndim != 1 or a.size < 2:
        raise ValueError("need at least two aligned returns")
    if not np.all(np.isfinite(a)) or not np.all(np.isfinite(m)):
        raise ValueError("returns must be finite")
    var_m = float(np.var(m, ddof=1))
    if var_m <= 0:
        raise ValueError("market variance is zero")
    cov = float(np.cov(a, m, ddof=1)[0, 1])
    return cov / var_m
```

## FAQ

**Does beta include an intercept?**

The slope from Cov/Var is exactly the OLS slope when an intercept is allowed. The intercept is the average return not explained by the market in that sample. This function returns only the slope.

**Why did I get a beta far from my broker's beta?**

The window, the frequency, the market series and whether returns are excess or raw all change the slope. Two betas are comparable when those choices match. This function documents none of them except the arithmetic, which is sample covariance over sample variance.

## Related

- [Tracking Error](https://quantcore-labs.com/glossary/tracking-error/)
- [Information Ratio](https://quantcore-labs.com/glossary/information-ratio/)
- [Sharpe Ratio](https://quantcore-labs.com/glossary/sharpe-ratio/)

