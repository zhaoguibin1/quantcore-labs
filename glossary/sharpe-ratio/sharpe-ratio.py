"""Sharpe Ratio: reference implementation.

Source: https://quantcore-labs.com/glossary/sharpe-ratio/
License: MIT (c) 2026 QuantCore Labs
Requires: Python 3.9+, numpy
"""
import numpy as np

def sharpe_ratio(returns, rf_annual=0.0, periods=252) -> float:
    """Annualised Sharpe ratio.

    rf_annual is compounded to a per-period rate: (1 + rf_annual) ** (1/periods) - 1.
    Volatility is the sample standard deviation of excess returns. Zero volatility
    returns NaN. This matches /tools/performance-analytics/.
    """
    r = np.asarray(returns, dtype=float)
    r = r[np.isfinite(r)]
    if r.size < 2:
        raise ValueError("need at least two finite returns")
    if periods <= 0:
        raise ValueError("periods must be positive")
    rf = (1.0 + rf_annual) ** (1.0 / periods) - 1.0
    excess = r - rf
    sd = float(excess.std(ddof=1))
    if sd == 0.0:
        return float("nan")
    return float(excess.mean() / sd * np.sqrt(periods))
