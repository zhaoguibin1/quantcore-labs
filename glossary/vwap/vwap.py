"""Volume-Weighted Average Price (VWAP): reference implementation.

Source: https://quantcore-labs.com/glossary/vwap/
License: MIT (c) 2026 QuantCore Labs
Requires: Python 3.9+, numpy, pandas
"""
import numpy as np
import pandas as pd

def vwap(price: pd.Series, volume: pd.Series) -> float:
    """Session VWAP: sum(p * v) / sum(v)."""
    v = volume.astype(float)
    return float((price * v).sum() / v.sum())

def intraday_vwap(bars: pd.DataFrame) -> pd.Series:
    """Running VWAP that resets each trading day.
    bars: DatetimeIndex, columns high, low, close, volume."""
    tp = (bars["high"] + bars["low"] + bars["close"]) / 3.0  # typical price
    pv = tp * bars["volume"]
    day = bars.index.normalize()
    return pv.groupby(day).cumsum() / bars["volume"].groupby(day).cumsum()

def slippage_bps(avg_fill: float, bench_vwap: float, side: int) -> float:
    """Execution cost vs VWAP in basis points. side=+1 buy, -1 sell.
    Positive = worse than VWAP."""
    return side * (avg_fill - bench_vwap) / bench_vwap * 1e4
