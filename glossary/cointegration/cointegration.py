"""Cointegration (Engle-Granger & Johansen): reference implementation.

Source: https://quantcore-labs.com/glossary/cointegration/
License: MIT (c) 2026 QuantCore Labs
Requires: Python 3.9+, numpy, statsmodels
"""
import warnings
import numpy as np
from statsmodels.tsa.stattools import coint
from statsmodels.tsa.vector_ar.vecm import coint_johansen

def engle_granger(y, x) -> dict:
    """Two-step Engle-Granger test of y ~ a + b*x.
    Uses residual-based MacKinnon critical values (statsmodels.coint), NOT the
    ordinary ADF p-value, which is too lenient for an estimated spread."""
    y, x = np.asarray(y, float), np.asarray(x, float)
    X = np.column_stack([np.ones_like(x), x])
    (a, b), *_ = np.linalg.lstsq(X, y, rcond=None)
    stat, p, crit = coint(y, x, trend="c", autolag="AIC")
    return {"alpha": a, "hedge_ratio": b, "spread": y - a - b * x,
            "stat": stat, "pvalue": p, "crit": crit}

def johansen(prices, det_order: int = 0, k_ar_diff: int = 1) -> dict:
    """Johansen trace test for an (T x n) price matrix.
    det_order: -1 none, 0 constant, 1 trend. Returns the cointegration rank
    at 95% and the first cointegrating vector (normalised on asset 0)."""
    with warnings.catch_warnings():  # recent NumPy: harmless ComplexWarning inside statsmodels
        warnings.simplefilter("ignore", np.exceptions.ComplexWarning)
        res = coint_johansen(np.asarray(prices, float), det_order, k_ar_diff)
    trace, cv95 = res.lr1, res.cvt[:, 1]
    rank = 0
    while rank < len(trace) and trace[rank] > cv95[rank]:
        rank += 1
    vec = np.real(res.evec[:, 0] / res.evec[0, 0])
    return {"rank": rank, "trace": trace, "cv95": cv95, "weights": vec}
