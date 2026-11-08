"""Almgren-Chriss Optimal Execution Trajectory: reference implementation.

Source: https://quantcore-labs.com/glossary/almgren-chriss/
License: MIT (c) 2026 QuantCore Labs
Requires: Python 3.9+, numpy
"""
import numpy as np

def almgren_chriss_trajectory(X, T, n, sigma, eta, risk_aversion):
    """Inventory remaining on n equal steps from 0 to T, including both endpoints.

    Permanent impact is taken as zero. risk_aversion = 0 (or sigma = 0) returns
    the straight-line schedule. X may be signed.
    """
    if T <= 0 or int(n) < 1:
        raise ValueError("T must be positive and n at least 1")
    if eta <= 0 or sigma < 0 or risk_aversion < 0:
        raise ValueError("eta must be positive; sigma and risk_aversion non-negative")
    t = np.linspace(0.0, float(T), int(n) + 1)
    if risk_aversion == 0 or sigma == 0:
        return X * (T - t) / T
    kappa = np.sqrt(risk_aversion * sigma ** 2 / eta)
    if kappa * T < 1e-8:
        return X * (T - t) / T
    # sinh(κ(T-t)) / sinh(κT) = exp(a-b) * (1 - exp(-2a)) / (1 - exp(-2b))
    a = kappa * (T - t)
    b = kappa * T
    ratio = np.exp(a - b) * (1.0 - np.exp(-2.0 * a)) / (1.0 - np.exp(-2.0 * b))
    return X * ratio
