"""Probability of Informed Trading (PIN): reference implementation.

Source: https://quantcore-labs.com/glossary/pin-informed-trading/
License: MIT (c) 2026 QuantCore Labs
Requires: Python 3.9+, standard library only
"""
def pin(alpha, mu, eps_b, eps_s) -> float:
    """PIN = alpha*mu / (alpha*mu + eps_b + eps_s). Evaluates parameters; does not estimate them."""
    alpha, mu, eps_b, eps_s = float(alpha), float(mu), float(eps_b), float(eps_s)
    if not 0.0 <= alpha <= 1.0:
        raise ValueError("alpha must be in [0, 1]")
    if mu < 0 or eps_b < 0 or eps_s < 0:
        raise ValueError("arrival rates must be non-negative")
    informed = alpha * mu
    total = informed + eps_b + eps_s
    if total <= 0:
        raise ValueError("total arrival rate must be positive")
    return informed / total
