"""Put-Call Parity: reference implementation.

Source: https://quantcore-labs.com/glossary/put-call-parity/
License: MIT (c) 2026 QuantCore Labs
Requires: Python 3.9+, standard library only
"""
from math import exp

def parity_gap(call, put, S, K, T, r, q=0.0) -> float:
    """Call minus put, minus the European forward value S*exp(-qT) - K*exp(-rT).

    Zero when put-call parity holds. Not defined as an equality for American options.
    """
    if S <= 0 or K <= 0 or T < 0:
        raise ValueError("S and K must be positive and T non-negative")
    return float((call - put) - (S * exp(-q * T) - K * exp(-r * T)))
