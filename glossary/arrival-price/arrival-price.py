"""Arrival-Price Slippage: reference implementation.

Source: https://quantcore-labs.com/glossary/arrival-price/
License: MIT (c) 2026 QuantCore Labs
Requires: Python 3.9+, standard library only
"""
def arrival_slippage_bps(avg_exec_px, arrival_mid, side=1) -> float:
    """Signed execution cost versus the arrival mid, in basis points.

    side = +1 buy, -1 sell. Positive means worse than the arrival mid.
    """
    if arrival_mid <= 0:
        raise ValueError("arrival_mid must be positive")
    if side not in (1, -1):
        raise ValueError("side must be +1 (buy) or -1 (sell)")
    return float(side * (avg_exec_px - arrival_mid) / arrival_mid * 1e4)
