"""Fast Rolling Mean, Std, Beta and Z-score with Numba: reference implementation.

Source: https://quantcore-labs.com/code/rolling-window-numba/
License: MIT (c) 2026 QuantCore Labs
Requires: Python 3.9+, numpy, numba
"""
import numpy as np
from numba import njit

@njit(cache=True)
def rolling_mean_std(x, window):
    """O(n) rolling mean and sample std (ddof=1) with running sums.
    Values are re-centred on the first window's mean to limit cancellation error.
    NaN where fewer than `window` observations; input must contain no NaN."""
    n = x.shape[0]
    mean = np.full(n, np.nan)
    std = np.full(n, np.nan)
    if n < window:
        return mean, std
    shift = x[:window].mean()
    s = 0.0
    s2 = 0.0
    for i in range(n):
        v = x[i] - shift
        s += v
        s2 += v * v
        if i >= window:
            o = x[i - window] - shift
            s -= o
            s2 -= o * o
        if i >= window - 1:
            m = s / window
            mean[i] = m + shift
            var = (s2 - window * m * m) / (window - 1)
            std[i] = np.sqrt(var) if var > 0 else 0.0
    return mean, std

@njit(cache=True)
def rolling_beta(y, x, window):
    """Rolling OLS slope cov(y, x) / var(x), O(n). Use for hedge ratios or market beta.
    Inputs are re-centred on their first-window means to limit cancellation error."""
    n = y.shape[0]
    out = np.full(n, np.nan)
    if n < window:
        return out
    cx = x[:window].mean()
    cy = y[:window].mean()
    sx = sy = sxx = sxy = 0.0
    for i in range(n):
        a = x[i] - cx
        b = y[i] - cy
        sx += a; sy += b; sxx += a * a; sxy += a * b
        if i >= window:
            a = x[i - window] - cx
            b = y[i - window] - cy
            sx -= a; sy -= b; sxx -= a * a; sxy -= a * b
        if i >= window - 1:
            cov = sxy - sx * sy / window
            var = sxx - sx * sx / window
            if var > 0:
                out[i] = cov / var
    return out

@njit(cache=True)
def rolling_zscore_2d(X, window):
    """Rolling z-score for every column of a (T x N) float matrix, in one compiled pass."""
    T, N = X.shape
    Z = np.full((T, N), np.nan)
    for j in range(N):
        m, s = rolling_mean_std(X[:, j].copy(), window)
        for i in range(T):
            if s[i] > 0:
                Z[i, j] = (X[i, j] - m[i]) / s[i]
    return Z
