"""Volume-Synchronized Probability of Informed Trading (VPIN): reference implementation.

Source: https://quantcore-labs.com/glossary/vpin/
License: MIT (c) 2026 QuantCore Labs
Requires: Python 3.9+, numpy, pandas
"""
import numpy as np
import pandas as pd

def compute_vpin(volume_buckets: pd.DataFrame, bucket_size: float) -> float:
    """VPIN from equal-volume buckets with buy_vol and sell_vol columns.

    Each row must sum to bucket_size. The function does not classify trades.
    """
    if bucket_size <= 0:
        raise ValueError("bucket_size must be positive")
    buy = np.asarray(volume_buckets["buy_vol"], dtype=float)
    sell = np.asarray(volume_buckets["sell_vol"], dtype=float)
    if buy.shape != sell.shape or buy.size == 0:
        raise ValueError("need at least one buy/sell bucket")
    if np.any(buy < 0) or np.any(sell < 0):
        raise ValueError("volumes must be non-negative")
    total = buy + sell
    if np.max(np.abs(total - bucket_size)) > 1e-6 * bucket_size:
        raise ValueError("each bucket must sum to bucket_size; drop a partial tail")
    return float(np.abs(buy - sell).sum() / (buy.size * bucket_size))
