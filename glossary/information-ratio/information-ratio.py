"""Information Ratio: reference implementation.

Source: https://quantcore-labs.com/glossary/information-ratio/
License: MIT (c) 2026 QuantCore Labs
Requires: Python 3.9+, numpy
"""
import numpy as np

def information_ratio(port, bench, periods=252) -> float:
    """Annualised information ratio of port minus bench.

    Sample standard deviation. Identical series return NaN.
    """
    active = np.asarray(port, dtype=float) - np.asarray(bench, dtype=float)
    if active.ndim != 1 or active.size < 2 or not np.all(np.isfinite(active)):
        raise ValueError("need at least two finite paired returns")
    if periods <= 0:
        raise ValueError("periods must be positive")
    sd = float(active.std(ddof=1))
    if sd == 0.0:
        return float("nan")
    return float(active.mean() / sd * np.sqrt(periods))
