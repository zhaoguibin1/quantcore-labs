"""Realized Volatility: reference implementation.

Source: https://quantcore-labs.com/glossary/realized-volatility/
License: MIT (c) 2026 QuantCore Labs
Requires: Python 3.9+, numpy
"""
import numpy as np

def realized_vol(prices, periods_per_year=252) -> float:
    """Square root of summed squared log returns, scaled by periods_per_year.

    periods_per_year annualises a SINGLE window. Use 1 to return the
    un-annualised sqrt(sum of squares). Prices must be positive.
    """
    px = np.asarray(prices, dtype=float)
    if px.size < 2 or not np.all(np.isfinite(px)) or np.any(px <= 0):
        raise ValueError("need at least two positive finite prices")
    if periods_per_year <= 0:
        raise ValueError("periods_per_year must be positive")
    r = np.diff(np.log(px))
    return float(np.sqrt(np.sum(r * r) * periods_per_year))
