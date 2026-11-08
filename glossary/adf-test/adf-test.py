"""Augmented Dickey-Fuller (ADF) Test: reference implementation.

Source: https://quantcore-labs.com/glossary/adf-test/
License: MIT (c) 2026 QuantCore Labs
Requires: Python 3.9+, numpy, statsmodels
"""
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
