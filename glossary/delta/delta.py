"""Delta: reference implementation.

Source: https://quantcore-labs.com/glossary/delta/
License: MIT (c) 2026 QuantCore Labs
Requires: Python 3.9+, scipy
"""
from math import exp, log, sqrt
from scipy.stats import norm

def bs_delta(S, K, T, r, sigma, call=True, q=0.0) -> float:
    """Black-Scholes-Merton spot delta. call=False returns the put delta.

    Requires positive S, K, T and sigma. q is a continuous dividend yield.
    """
    if S <= 0 or K <= 0 or T <= 0 or sigma <= 0:
        raise ValueError("S, K, T and sigma must be positive")
    d1 = (log(S / K) + (r - q + 0.5 * sigma * sigma) * T) / (sigma * sqrt(T))
    disc = exp(-q * T)
    return float(disc * norm.cdf(d1) if call else disc * (norm.cdf(d1) - 1.0))
