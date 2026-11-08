"""Top-of-Book Queue Imbalance while Replaying Quotes: reference implementation.

Source: https://quantcore-labs.com/code/numba-order-book-replay/
License: MIT (c) 2026 QuantCore Labs
Requires: Python 3.9+, numpy, numba
"""
import numpy as np
from numba import njit

@njit(cache=True)
def queue_imbalance(bid_sz, ask_sz):
    """Queue imbalance (bid_sz - ask_sz) / (bid_sz + ask_sz) at each update.

    Replay order is the array order. Total size of 0 yields 0. Negative sizes raise.
    """
    n = bid_sz.shape[0]
    if ask_sz.shape[0] != n:
        raise ValueError("bid_sz and ask_sz must have the same length")
    out = np.empty(n, dtype=np.float64)
    for i in range(n):
        b = bid_sz[i]
        a = ask_sz[i]
        if b < 0.0 or a < 0.0:
            raise ValueError("sizes must be non-negative")
        tot = b + a
        out[i] = (b - a) / tot if tot > 0.0 else 0.0
    return out
