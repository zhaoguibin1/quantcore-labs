"""Value at Risk (VaR) and Expected Shortfall (ES): reference implementation.

Source: https://quantcore-labs.com/glossary/var-expected-shortfall/
License: MIT (c) 2026 QuantCore Labs
Requires: Python 3.9+, numpy, scipy
"""
import numpy as np
from scipy.stats import norm, chi2

def var_es(returns, alpha: float = 0.99, method: str = "historical") -> tuple:
    """One-period VaR and Expected Shortfall as positive loss fractions.
    method: "historical" | "normal" | "cornish-fisher" (skew/kurtosis-adjusted
    quantile; returns ES = nan because the expansion defines no tail mean)."""
    r = np.asarray(returns, dtype=float)
    r = r[~np.isnan(r)]
    if method == "historical":
        q = np.quantile(r, 1 - alpha)
        return -q, -r[r <= q].mean()
    mu, sd = r.mean(), r.std(ddof=1)
    z = norm.ppf(1 - alpha)
    if method == "normal":
        return -(mu + sd * z), -(mu - sd * norm.pdf(z) / (1 - alpha))
    if method == "cornish-fisher":
        # VaR only: CF adjusts the quantile, it does not define a tail mean.
        x = (r - mu) / sd
        s, k = np.mean(x ** 3), np.mean(x ** 4) - 3
        zc = z + (z**2 - 1) * s / 6 + (z**3 - 3*z) * k / 24 - (2*z**3 - 5*z) * s**2 / 36
        return -(mu + sd * zc), float("nan")
    raise ValueError(method)

def kupiec_pof(returns, var_series, alpha: float = 0.99) -> dict:
    """Kupiec proportion-of-failures backtest. var_series: forecast VaR (positive)
    made BEFORE each return. H0: exception rate = 1 - alpha."""
    r, v = np.asarray(returns, float), np.asarray(var_series, float)
    n, x, p = len(r), int((r < -v).sum()), 1 - alpha
    ph = x / n
    ll0 = (n - x) * np.log(1 - p) + x * np.log(p)
    ll1 = (0.0 if x == n else (n - x) * np.log(1 - ph)) + (0.0 if x == 0 else x * np.log(ph))
    lr = -2 * (ll0 - ll1)
    return {"n": n, "exceptions": x, "expected": n * p, "lr": lr, "pvalue": 1 - chi2.cdf(lr, 1)}
