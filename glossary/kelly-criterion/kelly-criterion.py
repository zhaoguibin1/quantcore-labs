"""Kelly Criterion: reference implementation.

Source: https://quantcore-labs.com/glossary/kelly-criterion/
License: MIT (c) 2026 QuantCore Labs
Requires: Python 3.9+, standard library only
"""
def kelly_fraction(p, b) -> float:
    """Fraction of wealth for a binary bet. p = win probability, b = net odds.

    f* = p - (1 - p) / b. Does not cap at 0 or 1. Not a recommendation to bet.
    """
    p, b = float(p), float(b)
    if not 0.0 <= p <= 1.0:
        raise ValueError("p must be in [0, 1]")
    if b <= 0:
        raise ValueError("b, the net odds, must be positive")
    return p - (1.0 - p) / b

def kelly_continuous(mu, variance) -> float:
    """Approximate Kelly fraction mu / variance for a continuous excess return.

    Ignores higher moments. Not a position-sizing recommendation.
    """
    mu, variance = float(mu), float(variance)
    if variance <= 0:
        raise ValueError("variance must be positive")
    return mu / variance
