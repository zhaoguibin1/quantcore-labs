# Augmented Dickey-Fuller (ADF) Test

> A unit-root test that checks whether a time series is non-stationary. In stat-arb it is the standard check that a spread mean-reverts before it is traded.
> URL: https://quantcore-labs.com/glossary/adf-test/

Category: Time Series & Stat-Arb. Term ID: `adf-test`.

## Definition

The Augmented Dickey-Fuller test asks whether a series has a unit root, meaning shocks never decay and the series wanders like a random walk. The null hypothesis is a unit root (non-stationary). A sufficiently negative test statistic rejects it in favour of a stationary, mean-reverting series. Lagged differences are added to the regression to absorb serial correlation.

## Formula

```
Δy_t = α + β·t + γ·y_{t−1} + Σ_{i=1..p} δ_i·Δy_{t−i} + ε_t

H0: γ = 0 (unit root)     H1: γ < 0 (stationary)
ADF statistic = γ̂ / se(γ̂)     → compare with Dickey-Fuller (MacKinnon) critical values,
                                  NOT Student-t
Large-sample critical values, constant only:  1% −3.43   5% −2.86   10% −2.57

Mean-reversion half-life (from Δy_t = a + g·y_{t−1}):  HL = ln 2 / −ln(1 + g)
```

## Institutional usage

- **Pairs and basket spreads.** A spread is traded only if ADF rejects a unit root. The half-life then sets the holding period and the look-back for the rolling mean and standard deviation of the z-score.
- **Model hygiene.** Regressing one non-stationary series on another gives spurious R² and t-stats. Test levels first, and difference or use cointegration methods when a unit root is present.
- **Feature engineering.** Testing candidate features for stationarity before feeding them to ML models avoids features whose distribution drifts out of the training range.

## Pitfalls

- **Low power.** With a few hundred observations, ADF often cannot tell a slowly mean-reverting series (AR coefficient 0.98) from a random walk. Failing to reject is not evidence of a unit root. Pair it with KPSS, whose null is the reverse.
- **Deterministic terms matter.** Including a trend when there is none, or omitting one that exists, shifts the critical values and the conclusion. Use `"c"` for spreads and `"ct"` only for trending series.
- **Structural breaks.** A level shift, such as a regime change or an index inclusion, makes a stationary series look non-stationary (Perron, 1989).
- **Estimated spreads.** If the series is a regression residual, ordinary ADF p-values are too optimistic. Use residual-based critical values: see [cointegration](https://quantcore-labs.com/glossary/cointegration/).
- **Multiple testing.** Screening thousands of A-share pairs at 5% yields hundreds of false positives. Adjust the threshold, or require out-of-sample confirmation.

## Python reference implementation

Requires numpy, statsmodels. Tested before publication and re-executed with assertions on every rebuild. MIT licensed. Raw file: https://quantcore-labs.com/glossary/adf-test/adf-test.py

```python
import numpy as np
from statsmodels.tsa.stattools import adfuller

def adf_stat(y, lags: int = 1) -> float:
    """ADF t-statistic with a constant, by plain OLS (for understanding).
    Regression: dy_t = a + g*y_{t-1} + sum_{i=1..lags} b_i*dy_{t-i} + e_t ;  returns t(g)."""
    y = np.asarray(y, dtype=float)
    dy = np.diff(y)
    T = len(dy) - lags
    X = [np.ones(T), y[lags:-1]]
    X += [dy[lags - i:-i] for i in range(1, lags + 1)]
    X = np.column_stack(X)
    target = dy[lags:]
    beta, *_ = np.linalg.lstsq(X, target, rcond=None)
    resid = target - X @ beta
    s2 = resid @ resid / (T - X.shape[1])
    se = np.sqrt(s2 * np.linalg.inv(X.T @ X)[1, 1])
    return float(beta[1] / se)

def adf_test(y, regression: str = "c") -> dict:
    """Production test: lag order by AIC and MacKinnon p-values via statsmodels.
    regression: "c" constant, "ct" constant + trend, "n" none."""
    y = np.asarray(y, float)
    try:   # statsmodels >= 0.15 lets us pin the classic tuple return
        res = adfuller(y, regression=regression, autolag="AIC", result_object=False)
    except TypeError:
        res = adfuller(y, regression=regression, autolag="AIC")
    return {"stat": res[0], "pvalue": res[1], "lags": res[2], "nobs": res[3], "crit": res[4]}

def half_life(y) -> float:
    """Mean-reversion half-life in periods from dy_t = a + g*y_{t-1}: ln(2) / -ln(1+g).
    Returns inf if the series is not mean-reverting (g >= 0)."""
    y = np.asarray(y, dtype=float)
    X = np.column_stack([np.ones(len(y) - 1), y[:-1]])
    g = np.linalg.lstsq(X, np.diff(y), rcond=None)[0][1]
    return float(np.log(2) / -np.log1p(g)) if g < -1e-10 else float("inf")
```

## FAQ

**What is the difference between the ADF and KPSS tests?**

They reverse the hypotheses. ADF's null is a unit root (non-stationary); KPSS's null is stationarity. Rejecting ADF and failing to reject KPSS together is the strongest evidence of stationarity; conflicting results usually mean the sample is too short or the series is near a unit root.

**Which p-value threshold should I use for pairs selection?**

5% is conventional for a single test, but screening many pairs inflates false discoveries. Use a stricter threshold such as 1%, a false-discovery-rate correction, or confirm stationarity on a later out-of-sample window before trading.

## Related

- [Cointegration (Engle-Granger & Johansen)](https://quantcore-labs.com/glossary/cointegration/)
- [Hurst Exponent (H)](https://quantcore-labs.com/glossary/hurst-exponent/)
- [Fast Rolling Mean, Std, Beta and Z-score with Numba](https://quantcore-labs.com/code/rolling-window-numba/)

