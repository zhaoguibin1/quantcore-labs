"""Sortino Ratio: reference implementation.

Source: https://quantcore-labs.com/glossary/sortino-ratio/
License: MIT (c) 2026 QuantCore Labs
Requires: Python 3.9+, numpy
"""
import numpy as np

def sortino_ratio(returns, mar_annual=0.0, periods=252) -> float:
    """Annualised Sortino ratio.

    Downside deviation is the root-mean-square of min(r - MAR, 0) over all
    periods. MAR is an annual rate, compounded to a per-period rate.
    No downside variation returns NaN. Matches /tools/performance-analytics/.
    """
    r = np.asarray(returns, dtype=float)
    r = r[np.isfinite(r)]
    if r.size < 2:
        raise ValueError("need at least two finite returns")
    if periods <= 0:
        raise ValueError("periods must be positive")
    mar = (1.0 + mar_annual) ** (1.0 / periods) - 1.0
    downside = float(np.sqrt(np.mean(np.minimum(r - mar, 0.0) ** 2)))
    if downside == 0.0:
        return float("nan")
    return float((r.mean() - mar) / downside * np.sqrt(periods))
