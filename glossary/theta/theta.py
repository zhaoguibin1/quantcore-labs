"""Theta: reference implementation.

Source: https://quantcore-labs.com/glossary/theta/
License: MIT (c) 2026 QuantCore Labs
Requires: Python 3.9+, scipy
"""
from math import exp, log, sqrt
from scipy.stats import norm

def bs_theta(S, K, T, r, sigma, call=True, q=0.0) -> float:
    """Black-Scholes-Merton theta per calendar day (annual derivative / 365).

    call=False returns the put. Multiply by 365/252 for a trading-day theta.
    """
    if S <= 0 or K <= 0 or T <= 0 or sigma <= 0:
        raise ValueError("S, K, T and sigma must be positive")
    sT = sigma * sqrt(T)
    d1 = (log(S / K) + (r - q + 0.5 * sigma * sigma) * T) / sT
    d2 = d1 - sT
    decay = -S * exp(-q * T) * norm.pdf(d1) * sigma / (2.0 * sqrt(T))
    if call:
        annual = decay - r * K * exp(-r * T) * norm.cdf(d2) + q * S * exp(-q * T) * norm.cdf(d1)
    else:
        annual = decay + r * K * exp(-r * T) * norm.cdf(-d2) - q * S * exp(-q * T) * norm.cdf(-d1)
    return float(annual / 365.0)
