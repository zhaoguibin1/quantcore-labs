"""Participation Rate (Percent of Volume): reference implementation.

Source: https://quantcore-labs.com/glossary/participation-rate/
License: MIT (c) 2026 QuantCore Labs
Requires: Python 3.9+, standard library only
"""
def pov_child_qty(market_vol_interval, target_rate, remaining_qty) -> float:
    """Child quantity for a percent-of-volume slice.

    target_rate is a fraction of market volume (0.1 = 10%). The result is
    never larger than remaining_qty, and is zero when there is nothing to do.
    """
    if market_vol_interval < 0 or remaining_qty < 0:
        raise ValueError("volumes must be non-negative")
    if target_rate < 0:
        raise ValueError("target_rate must be non-negative")
    return float(min(remaining_qty, target_rate * market_vol_interval))
