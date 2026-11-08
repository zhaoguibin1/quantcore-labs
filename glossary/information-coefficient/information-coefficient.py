"""Information Coefficient (IC): reference implementation.

Source: https://quantcore-labs.com/glossary/information-coefficient/
License: MIT (c) 2026 QuantCore Labs
Requires: Python 3.9+, numpy, pandas
"""
import numpy as np
import pandas as pd

def forward_returns(close: pd.DataFrame, horizon: int = 1, lag: int = 1) -> pd.DataFrame:
    """Forward return aligned to the signal date.
    close: dates x assets. A signal computed at the close of t is traded at t+lag
    (lag=1 suits A-share T+1 execution) and held for `horizon` periods."""
    return close.shift(-lag - horizon) / close.shift(-lag) - 1

def information_coefficient(factor: pd.DataFrame, fwd_ret: pd.DataFrame,
                            method: str = "rank", min_obs: int = 20) -> pd.Series:
    """Cross-sectional IC per date, fully vectorised (no per-date loop).
    method="rank" gives Spearman rank IC; "pearson" gives normal IC."""
    f, r = factor.align(fwd_ret, join="inner")
    valid = f.notna() & r.notna()
    f, r = f.where(valid), r.where(valid)
    if method == "rank":
        f, r = f.rank(axis=1), r.rank(axis=1)
    f = f.sub(f.mean(axis=1), axis=0)
    r = r.sub(r.mean(axis=1), axis=0)
    ic = (f * r).sum(axis=1) / np.sqrt((f ** 2).sum(axis=1) * (r ** 2).sum(axis=1))
    return ic.where(valid.sum(axis=1) >= min_obs)

def ic_summary(ic: pd.Series, horizon: int = 1) -> dict:
    """Mean IC, ICIR and an approximate t-stat. Overlapping horizons share
    information, so the effective sample size is taken as n / horizon."""
    ic = ic.dropna()
    n, m, s = len(ic), ic.mean(), ic.std(ddof=1)
    return {"n": n, "mean_ic": m, "ic_std": s, "icir": m / s,
            "t_stat": m / s * np.sqrt(n / horizon), "hit_rate": (ic > 0).mean()}
