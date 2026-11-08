"""Amihud Illiquidity Measure (ILLIQ): reference implementation.

Source: https://quantcore-labs.com/glossary/amihud-illiquidity/
License: MIT (c) 2026 QuantCore Labs
Requires: Python 3.9+, numpy, pandas
"""
import numpy as np
import pandas as pd

def amihud(ret: pd.DataFrame, amount: pd.DataFrame, window: int = 20,
           min_days: int = 15, scale: float = 1e8) -> pd.DataFrame:
    """Rolling Amihud illiquidity, dates x stocks, fully vectorised.
    ILLIQ = mean(|r_t| / amount_t) * scale over the window.
    amount: traded value in currency (A-shares: yuan turnover, 成交额), so with
    scale=1e8 the result reads as |return| per 100 million yuan traded.
    Zero-amount days (suspensions) are excluded rather than producing inf."""
    a = amount.where(amount > 0)
    daily = ret.abs() / a
    return daily.rolling(window, min_periods=min_days).mean() * scale

def amihud_monthly(ret: pd.DataFrame, amount: pd.DataFrame, scale: float = 1e8) -> pd.DataFrame:
    """Original Amihud (2002) style: average within each calendar month."""
    daily = ret.abs() / amount.where(amount > 0)
    return daily.groupby(daily.index.to_period("M")).mean() * scale
