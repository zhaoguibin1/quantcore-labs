# Half-Life of Mean Reversion

> How many periods an AR(1) deviation takes to decay halfway, read off the slope of a regression of changes on lagged levels. The same discrete definition as the half-life on the ADF page.
> URL: https://quantcore-labs.com/glossary/half-life-mean-reversion/

Category: Time Series & Stat-Arb. Term ID: `half-life-mean-reversion`.

## Definition

Fit the regression Δy_t = a + g y_{t−1} + ε_t. The autoregressive level coefficient is φ = 1 + g. When g is between −1 and 0, the series pulls back toward its mean, and the number of periods required for a deviation to fall by half is ln 2 / −ln(1 + g). That is the discrete half-life. The continuous approximation −ln 2 / g is close only when g is near zero; at φ = 0.9 it is already about 5 percent longer than the discrete number. If g is not negative, the series is not mean-reverting on this regression and the half-life is infinite.

## Formula

```
Δy_t = a + g · y_{t−1} + ε_t
φ = 1 + g

half-life = ln(2) / −ln(1 + g)     if −1 < g < 0
          = ∞                       if g ≥ 0
          undefined (NaN)           if g ≤ −1  (oscillatory or explosive)

Continuous approximation, small g:  ln(2) / −g
Example: φ = 0.9 → g = −0.1 → half-life = ln(2) / −ln(0.9) ≈ 6.58 periods.
The ADF page uses this discrete definition, not ln(2) / −g.
```

## Where the number is used

- As a holding-period scale for a spread that has already passed a stationarity check. See [ADF](https://quantcore-labs.com/glossary/adf-test/) and [cointegration](https://quantcore-labs.com/glossary/cointegration/). A half-life of six days and a half-life of six months are different research problems.
- As a way to set the window on a [rolling z-score](https://quantcore-labs.com/code/pairs-zscore-signal/). A window much shorter than the half-life mostly fits noise; a window of many half-lives averages different regimes.
- [Hurst](https://quantcore-labs.com/glossary/hurst-exponent/) is a related but different summary of the same wish: H below one half suggests anti-persistence. It is not a half-life.

## Pitfalls

- **Use the discrete form.** Dividing ln 2 by −g treats g as a continuous-time speed. The regression you just ran is discrete. This function matches the half-life already published on the ADF page, ln 2 / −ln(1+g).
- **The regression is not a proof of mean reversion.** A short sample of a random walk often produces a slightly negative g. Pair the half-life with an ADF or cointegration test, and expect the estimate to move when you add data.
- **An intercept is included.** The mean that the series reverts to is −a/g, not necessarily zero. Forcing the regression through the origin changes g.
- **Not a trading rule.** A finite half-life is a sample statistic. It does not say the spread will keep reverting, or that a position sized to it is desirable.

## Python reference implementation

Requires numpy. Tested before publication and re-executed with assertions on every rebuild. MIT licensed. Raw file: https://quantcore-labs.com/glossary/half-life-mean-reversion/half-life-mean-reversion.py

```python
import numpy as np

def half_life(spread) -> float:
    """Discrete mean-reversion half-life, ln(2) / -ln(1+g), from Δy = a + g y_lag.

    Infinite when g >= 0 (no mean reversion). NaN when g <= -1.
    Same definition as half_life on the ADF page.
    """
    y = np.asarray(spread, dtype=float)
    if y.ndim != 1 or y.size < 3 or not np.all(np.isfinite(y)):
        raise ValueError("need at least three finite observations")
    lag = y[:-1]
    if float(np.var(lag)) == 0.0:
        return float("inf")
    X = np.column_stack([np.ones(lag.size), lag])
    g = float(np.linalg.lstsq(X, np.diff(y), rcond=None)[0][1])
    if g >= -1e-12:
        return float("inf")
    if g <= -1.0:
        return float("nan")
    return float(np.log(2.0) / -np.log1p(g))
```

## FAQ

**Why not use −ln(2) / g, which is the formula many notes quote?**

That is the continuous-time limit. The regression Δy_t = a + g y_{t−1} implies a discrete autoregressive coefficient φ = 1 + g, and a deviation multiplies by φ each period. Halving means φ^h = 1/2, so h = ln(2) / −ln(φ). At φ = 0.9 the continuous shortcut is about 6.93 periods and the discrete half-life is about 6.58.

**What half-life should a pairs trade use?**

This page does not pick one. It estimates a half-life from the series you pass. Whether the residual is stationary, whether both legs can be traded, and what it costs are separate questions; a finite estimate is not a signal to trade the spread.

## Related

- [Augmented Dickey-Fuller (ADF) Test](https://quantcore-labs.com/glossary/adf-test/)
- [Cointegration (Engle-Granger & Johansen)](https://quantcore-labs.com/glossary/cointegration/)
- [Hurst Exponent (H)](https://quantcore-labs.com/glossary/hurst-exponent/)
- [Rolling Hedge Ratio and Spread Z-Score](https://quantcore-labs.com/code/pairs-zscore-signal/)

