"""Tracking Error: reference implementation.

Source: https://quantcore-labs.com/glossary/tracking-error/
License: MIT (c) 2026 QuantCore Labs
Requires: Python 3.9+, numpy
"""
import numpy as np

def tracking_error(port, bench, periods=252) -> float:
    """Annualised sample standard deviation of port minus bench."""
    active = np.asarray(port, dtype=float) - np.asarray(bench, dtype=float)
    if active.ndim != 1 or active.size < 2 or not np.all(np.isfinite(active)):
        raise ValueError("need at least two finite paired returns")
    if periods <= 0:
        raise ValueError("periods must be positive")
    return float(active.std(ddof=1) * np.sqrt(periods))
