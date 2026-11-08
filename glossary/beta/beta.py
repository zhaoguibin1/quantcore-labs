"""Beta: reference implementation.

Source: https://quantcore-labs.com/glossary/beta/
License: MIT (c) 2026 QuantCore Labs
Requires: Python 3.9+, numpy
"""
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
