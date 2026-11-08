"""Rolling Z-Score from a Zero-Copy Sliding Window: reference implementation.

Source: https://quantcore-labs.com/code/numpy-strided-rolling/
License: MIT (c) 2026 QuantCore Labs
Requires: Python 3.9+, numpy
"""
import numpy as np
from numpy.lib.stride_tricks import sliding_window_view

def rolling_zscore(x, window: int) -> np.ndarray:
    """Rolling z-score using a zero-copy sliding window.

    Sample standard deviation (ddof=1). Warm-up and zero-std windows are NaN.
    The window view is not writable from the caller's point of view: this
    function only reads it.
    """
    x = np.asarray(x, dtype=np.float64).reshape(-1)
    window = int(window)
    if window < 2:
        raise ValueError("window must be at least 2")
    out = np.full(x.shape, np.nan)
    if x.size < window:
        return out
    view = sliding_window_view(x, window)
    mu = view.mean(axis=1)
    sd = view.std(axis=1, ddof=1)
    z = np.full(mu.shape, np.nan)
    np.divide(x[window - 1:] - mu, sd, out=z, where=sd > 0)
    out[window - 1:] = z
    return out
