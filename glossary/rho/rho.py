"""Rho: reference implementation.

Source: https://quantcore-labs.com/glossary/rho/
License: MIT (c) 2026 QuantCore Labs
Requires: Python 3.9+, scipy
"""
from math import exp, log, sqrt
from scipy.stats import norm

def bs_rho(S, K, T, r, sigma, call=True, q=0.0) -> float:
    """Black-Scholes-Merton rho per 1 percentage point of the risk-free rate.

    call=False returns the put rho, which is negative or zero.
    """
    if S <= 0 or K <= 0 or T <= 0 or sigma <= 0:
        raise ValueError("S, K, T and sigma must be positive")
    d2 = (log(S / K) + (r - q - 0.5 * sigma * sigma) * T) / (sigma * sqrt(T))
    if call:
        return float(K * T * exp(-r * T) * norm.cdf(d2) / 100.0)
    return float(-K * T * exp(-r * T) * norm.cdf(-d2) / 100.0)
