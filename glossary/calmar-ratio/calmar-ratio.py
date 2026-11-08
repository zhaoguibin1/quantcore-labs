"""Calmar Ratio: reference implementation.

Source: https://quantcore-labs.com/glossary/calmar-ratio/
License: MIT (c) 2026 QuantCore Labs
Requires: Python 3.9+, numpy
"""
import numpy as np

def calmar_ratio(equity, periods=252) -> float:
    """CAGR / |maximum drawdown| over the whole sample.

    CAGR uses (E_last / E_first) ** (periods / n_returns) - 1.
    A curve with no drawdown returns NaN. Matches the full-sample convention
    of /tools/performance-analytics/, not a trailing 36-month window.
    """
    equity = np.asarray(equity, dtype=float)
    if equity.size < 2 or not np.all(np.isfinite(equity)) or np.any(equity <= 0):
        raise ValueError("need at least two positive finite equity points")
    if periods <= 0:
        raise ValueError("periods must be positive")
    n = equity.size - 1
    cagr = (equity[-1] / equity[0]) ** (periods / n) - 1.0
    mdd = float((equity / np.maximum.accumulate(equity) - 1.0).min())
    if mdd == 0.0:
        return float("nan")
    return float(cagr / abs(mdd))
