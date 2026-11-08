"""Kyle's Lambda: reference implementation.

Source: https://quantcore-labs.com/glossary/kyles-lambda/
License: MIT (c) 2026 QuantCore Labs
Requires: Python 3.9+, numpy
"""
import numpy as np

def kyles_lambda(price_changes, signed_volume) -> float:
    """OLS slope of price changes on signed volume, with an intercept."""
    x = np.asarray(signed_volume, dtype=float)
    y = np.asarray(price_changes, dtype=float)
    if x.shape != y.shape or x.ndim != 1 or x.size < 2:
        raise ValueError("need at least two aligned observations")
    xc = x - x.mean()
    var = float(xc @ xc)
    if var <= 0:
        raise ValueError("signed volume has zero variance")
    yc = y - y.mean()
    return float((xc @ yc) / var)
