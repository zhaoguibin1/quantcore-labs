"""Gamma: reference implementation.

Source: https://quantcore-labs.com/glossary/gamma/
License: MIT (c) 2026 QuantCore Labs
Requires: Python 3.9+, scipy
"""
from math import exp, log, sqrt
from scipy.stats import norm

def bs_gamma(S, K, T, r, sigma, q=0.0) -> float:
    """Black-Scholes-Merton gamma. Identical for the European call and put."""
    if S <= 0 or K <= 0 or T <= 0 or sigma <= 0:
        raise ValueError("S, K, T and sigma must be positive")
    d1 = (log(S / K) + (r - q + 0.5 * sigma * sigma) * T) / (sigma * sqrt(T))
    return float(exp(-q * T) * norm.pdf(d1) / (S * sigma * sqrt(T)))
