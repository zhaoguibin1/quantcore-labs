"""Rolling Hedge Ratio and Spread Z-Score: reference implementation.

Source: https://quantcore-labs.com/code/pairs-zscore-signal/
License: MIT (c) 2026 QuantCore Labs
Requires: Python 3.9+, pandas
"""
import pandas as pd

def pair_zscore(y: pd.Series, x: pd.Series, window: int = 60) -> pd.DataFrame:
    """Rolling slope of y on x, the residual spread, and its rolling z-score.

    Sample covariance and variance (ddof=1), so the ratio matches OLS with an
    intercept-free slope. Illustrative only; not a trading signal.
    """
    if window < 2:
        raise ValueError("window must be at least 2")
    y, x = y.align(x, join="inner")
    beta = y.rolling(window).cov(x) / x.rolling(window).var()
    spread = y - beta * x
    sd = spread.rolling(window).std()
    z = (spread - spread.rolling(window).mean()) / sd.where(sd > 0)
    return pd.DataFrame({"beta": beta, "spread": spread, "zscore": z})
