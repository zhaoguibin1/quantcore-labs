"""RiskMetrics EWMA Volatility in Numba: reference implementation.

Source: https://quantcore-labs.com/code/numba-ewma-volatility/
License: MIT (c) 2026 QuantCore Labs
Requires: Python 3.9+, numpy, numba
"""
import numpy as np
from numba import njit

@njit(cache=True)
def ewma_vol(returns, lam=0.94):
    """EWMA volatility. var[t] uses returns[:t] only (r[t] is excluded).

    lam is the weight on the previous variance (RiskMetrics daily default 0.94).
    """
    if lam < 0.0 or lam > 1.0:
        raise ValueError("lam must be in [0, 1]")
    r = returns
    n = r.shape[0]
    var = np.empty(n, dtype=np.float64)
    if n == 0:
        return var
    var[0] = r[0] * r[0]
    one = 1.0 - lam
    for t in range(1, n):
        prev = r[t - 1]
        var[t] = lam * var[t - 1] + one * prev * prev
    return np.sqrt(var)
