"""Parkinson Volatility: reference implementation.

Source: https://quantcore-labs.com/glossary/parkinson-volatility/
License: MIT (c) 2026 QuantCore Labs
Requires: Python 3.9+, numpy
"""
import numpy as np

def parkinson_vol(high, low, periods=252) -> float:
    """Annualised Parkinson volatility from high and low arrays.

    Each pair is one period. `periods` is how many such periods make a year.
    Requires 0 < low <= high.
    """
    h = np.asarray(high, dtype=float)
    lo = np.asarray(low, dtype=float)
    if h.shape != lo.shape or h.ndim != 1 or h.size == 0:
        raise ValueError("high and low must be non-empty and aligned")
    if not np.all(np.isfinite(h)) or not np.all(np.isfinite(lo)):
        raise ValueError("high and low must be finite")
    if np.any(lo <= 0) or np.any(h < lo):
        raise ValueError("require 0 < low <= high")
    if periods <= 0:
        raise ValueError("periods must be positive")
    x = np.log(h / lo)
    return float(np.sqrt(np.mean(x * x) / (4.0 * np.log(2.0)) * periods))
