"""Implementation Shortfall: reference implementation.

Source: https://quantcore-labs.com/glossary/implementation-shortfall/
License: MIT (c) 2026 QuantCore Labs
Requires: Python 3.9+, standard library only
"""
def implementation_shortfall(fills, decision_px, end_px, target_qty, side=1, fees=0.0) -> float:
    """Implementation shortfall in price-times-quantity units. Positive = cost.

    fills: iterable of (qty, price). side = +1 buy, -1 sell.
    Unfilled size is marked at end_px. qty is unsigned.
    """
    if side not in (1, -1):
        raise ValueError("side must be +1 (buy) or -1 (sell)")
    if target_qty < 0:
        raise ValueError("target_qty must be non-negative")
    filled = 0.0
    execution = 0.0
    for qty, price in fills:
        if qty < 0:
            raise ValueError("fill quantities must be non-negative")
        filled += qty
        execution += side * qty * (price - decision_px)
    if filled > target_qty + 1e-8:
        raise ValueError("filled quantity exceeds target")
    opportunity = side * (target_qty - filled) * (end_px - decision_px)
    return float(execution + opportunity + fees)
