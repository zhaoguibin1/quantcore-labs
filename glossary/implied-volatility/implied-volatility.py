"""Implied Volatility: reference implementation.

Source: https://quantcore-labs.com/glossary/implied-volatility/
License: MIT (c) 2026 QuantCore Labs
Requires: Python 3.9+, scipy
"""
from math import exp, log, sqrt
from scipy.optimize import brentq
from scipy.stats import norm

def bs_call(S, K, T, r, sigma, q=0.0) -> float:
    """Black-Scholes-Merton European call. sigma is a decimal volatility."""
    if S <= 0 or K <= 0 or T <= 0 or sigma <= 0:
        raise ValueError("S, K, T and sigma must be positive")
    sT = sigma * sqrt(T)
    d1 = (log(S / K) + (r - q + 0.5 * sigma * sigma) * T) / sT
    d2 = d1 - sT
    return S * exp(-q * T) * norm.cdf(d1) - K * exp(-r * T) * norm.cdf(d2)

def implied_vol(price, S, K, T, r, q=0.0) -> float:
    """Black-Scholes-Merton implied volatility of a European call premium.

    Returns 0 when the premium is at intrinsic value. Raises when the premium
    is outside the no-arbitrage bounds or the root is above 2000 percent.
    """
    if S <= 0 or K <= 0 or T <= 0:
        raise ValueError("S, K and T must be positive")
    lower = max(S * exp(-q * T) - K * exp(-r * T), 0.0)
    upper = S * exp(-q * T)
    if price < lower - 1e-8 or price > upper + 1e-8:
        raise ValueError("price is outside no-arbitrage bounds")
    if price <= lower + 1e-12:
        return 0.0

    def gap(sigma):
        return bs_call(S, K, T, r, sigma, q) - price

    hi = 5.0
    if gap(hi) < 0:
        hi = 20.0
        if gap(hi) < 0:
            raise ValueError("implied volatility is above 20; check the premium")
    return float(brentq(gap, 1e-6, hi))
