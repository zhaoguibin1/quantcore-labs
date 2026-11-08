"""Maximum Drawdown: reference implementation.

Source: https://quantcore-labs.com/glossary/max-drawdown/
License: MIT (c) 2026 QuantCore Labs
Requires: Python 3.9+, numpy
"""
import numpy as np

def max_drawdown(equity) -> float:
    """Most negative peak-to-trough decline of a positive equity curve.

    Returns a fraction in [-1, 0]. A 25% decline is -0.25.
    """
    equity = np.asarray(equity, dtype=float)
    if equity.size == 0 or not np.all(np.isfinite(equity)) or np.any(equity <= 0):
        raise ValueError("equity must be non-empty, finite and positive")
    peak = np.maximum.accumulate(equity)
    return float((equity / peak - 1.0).min())
