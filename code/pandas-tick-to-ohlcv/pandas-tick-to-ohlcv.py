"""Resample Trade Ticks to OHLCV and VWAP Bars: reference implementation.

Source: https://quantcore-labs.com/code/pandas-tick-to-ohlcv/
License: MIT (c) 2026 QuantCore Labs
Requires: Python 3.9+, pandas
"""
import pandas as pd

def ticks_to_bars(ticks: pd.DataFrame, freq: str = "1min") -> pd.DataFrame:
    """OHLCV, VWAP and trade count from a trade tape.

    ticks: DatetimeIndex, columns price and volume, sorted by time.
    Empty bins are dropped. VWAP is missing when the bin volume is 0.
    """
    if not isinstance(ticks.index, pd.DatetimeIndex):
        raise TypeError("ticks must be indexed by a DatetimeIndex")
    if not {"price", "volume"}.issubset(ticks.columns):
        raise ValueError("ticks need price and volume columns")
    ticks = ticks.sort_index()
    grouped = ticks.resample(freq)
    bars = grouped["price"].ohlc()
    bars["volume"] = grouped["volume"].sum()
    traded_value = (ticks["price"] * ticks["volume"]).resample(freq).sum()
    bars["vwap"] = traded_value / bars["volume"].where(bars["volume"] > 0)
    bars["trades"] = grouped["price"].count()
    return bars.dropna(subset=["open"])
