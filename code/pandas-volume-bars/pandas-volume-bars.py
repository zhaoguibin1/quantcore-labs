"""Equal-Volume Bars from a Trade Tape: reference implementation.

Source: https://quantcore-labs.com/code/pandas-volume-bars/
License: MIT (c) 2026 QuantCore Labs
Requires: Python 3.9+, numpy, pandas
"""
import numpy as np
import pandas as pd

def volume_bars(ticks: pd.DataFrame, bar_volume: float) -> pd.DataFrame:
    """OHLCV bars of about `bar_volume` traded units.

    The trade that crosses each multiple of bar_volume stays in the bar it
    completes. Trades are not split. The final, possibly short, bar is kept.
    """
    if bar_volume <= 0:
        raise ValueError("bar_volume must be positive")
    if not {"price", "volume"}.issubset(ticks.columns):
        raise ValueError("ticks need price and volume columns")
    if isinstance(ticks.index, pd.DatetimeIndex):
        ticks = ticks.sort_index()
    vol = ticks["volume"].to_numpy(dtype=np.float64)
    if vol.size and np.any(vol < 0):
        raise ValueError("volume must be non-negative")
    if vol.size == 0:
        return pd.DataFrame(columns=["end_time", "open", "high", "low", "close", "volume"])
    bar_id = np.floor(np.cumsum(vol) - vol) // bar_volume
    bar_id = pd.Series(bar_id.astype(np.int64), index=ticks.index)
    grouped = ticks.groupby(bar_id, sort=True)
    out = grouped.agg(
        open=("price", "first"),
        high=("price", "max"),
        low=("price", "min"),
        close=("price", "last"),
        volume=("volume", "sum"),
    )
    out.insert(0, "end_time", grouped.tail(1).index.to_numpy())
    out.index.name = "bar_id"
    return out
