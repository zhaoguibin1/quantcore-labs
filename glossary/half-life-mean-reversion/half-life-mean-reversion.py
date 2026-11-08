"""Half-Life of Mean Reversion: reference implementation.

Source: https://quantcore-labs.com/glossary/half-life-mean-reversion/
License: MIT (c) 2026 QuantCore Labs
Requires: Python 3.9+, numpy
"""
import numpy as np

def half_life(spread) -> float:
    """Discrete mean-reversion half-life, ln(2) / -ln(1+g), from Δy = a + g y_lag.

    Infinite when g >= 0 (no mean reversion). NaN when g <= -1.
    Same definition as half_life on the ADF page.
    """
    y = np.asarray(spread, dtype=float)
    if y.ndim != 1 or y.size < 3 or not np.all(np.isfinite(y)):
        raise ValueError("need at least three finite observations")
    lag = y[:-1]
    if float(np.var(lag)) == 0.0:
        return float("inf")
    X = np.column_stack([np.ones(lag.size), lag])
    g = float(np.linalg.lstsq(X, np.diff(y), rcond=None)[0][1])
    if g >= -1e-12:
        return float("inf")
    if g <= -1.0:
        return float("nan")
    return float(np.log(2.0) / -np.log1p(g))
