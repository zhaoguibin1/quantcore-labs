"""Time-Weighted Average Price (TWAP): reference implementation.

Source: https://quantcore-labs.com/glossary/twap/
License: MIT (c) 2026 QuantCore Labs
Requires: Python 3.9+, pandas
"""
import pandas as pd

def calculate_twap(prices, freq="1min") -> float:
    """Arithmetic mean of regularly sampled prices.

    A Series with a DatetimeIndex is sampled by taking the last observation
    in each bin of width `freq`, dropping empty bins. Any other input is
    treated as already sampled, and the mean of its values is returned.
    """
    if not isinstance(prices, pd.Series):
        prices = pd.Series(prices, dtype="float64")
    if isinstance(prices.index, pd.DatetimeIndex):
        sampled = prices.sort_index().resample(freq).last().dropna()
    else:
        sampled = prices.dropna()
    if sampled.empty:
        raise ValueError("no prices to average")
    return float(sampled.mean())
