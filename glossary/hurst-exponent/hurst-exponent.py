"""Hurst Exponent (H): reference implementation.

Source: https://quantcore-labs.com/glossary/hurst-exponent/
License: MIT (c) 2026 QuantCore Labs
Requires: Python 3.9+, numpy
"""
import numpy as np

def hurst_rs(returns, min_n: int = 16) -> float:
    """Hurst exponent by rescaled-range (R/S) analysis.
    Input: a series of returns/increments, NOT price levels."""
    x = np.asarray(returns, dtype=float)
    N = len(x)
    sizes = np.unique(np.floor(np.logspace(np.log10(min_n),
                                           np.log10(N // 2), 20)).astype(int))
    rs = []
    for n in sizes:
        k = N // n
        seg = x[: k * n].reshape(k, n)
        dev = np.cumsum(seg - seg.mean(axis=1, keepdims=True), axis=1)
        R = dev.max(axis=1) - dev.min(axis=1)
        S = seg.std(axis=1, ddof=0)
        ok = S > 0
        rs.append(np.mean(R[ok] / S[ok]))
    H, _ = np.polyfit(np.log(sizes), np.log(rs), 1)
    return float(H)

def hurst_lag_var(log_price, max_lag: int = 100) -> float:
    """Hurst from scaling of lagged differences: std(x[t+tau]-x[t]) ~ tau^H.
    Input: log price levels."""
    x = np.asarray(log_price, dtype=float)
    lags = np.arange(2, max_lag)
    tau = [np.std(x[l:] - x[:-l]) for l in lags]
    H, _ = np.polyfit(np.log(lags), np.log(tau), 1)
    return float(H)
