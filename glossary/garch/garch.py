"""GARCH(1,1): reference implementation.

Source: https://quantcore-labs.com/glossary/garch/
License: MIT (c) 2026 QuantCore Labs
Requires: Python 3.9+, numpy
"""
import numpy as np

def garch11_variance(returns, omega, alpha, beta):
    """GARCH(1,1) variance path. Parameters are inputs, not estimates.

    var[0] = returns[0] ** 2. Later terms use the previous return and the
    previous variance only. omega, alpha, beta must be non-negative.
    """
    r = np.asarray(returns, dtype=float)
    if r.ndim != 1 or not np.all(np.isfinite(r)):
        raise ValueError("returns must be a finite 1-d array")
    if omega < 0 or alpha < 0 or beta < 0:
        raise ValueError("omega, alpha and beta must be non-negative")
    var = np.empty(r.shape, dtype=float)
    if r.size == 0:
        return var
    var[0] = r[0] * r[0]
    for t in range(1, r.size):
        var[t] = omega + alpha * r[t - 1] * r[t - 1] + beta * var[t - 1]
    return var

def garch11_unconditional(omega, alpha, beta) -> float:
    """ω / (1 − α − β). Inf when α + β ≥ 1."""
    if omega < 0 or alpha < 0 or beta < 0:
        raise ValueError("omega, alpha and beta must be non-negative")
    if alpha + beta >= 1.0:
        return float("inf")
    return float(omega / (1.0 - alpha - beta))
