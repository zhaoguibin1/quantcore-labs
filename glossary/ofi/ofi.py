"""Order Flow Imbalance (OFI): reference implementation.

Source: https://quantcore-labs.com/glossary/ofi/
License: MIT (c) 2026 QuantCore Labs
Requires: Python 3.9+, numpy, pandas
"""
import numpy as np
import pandas as pd

def ofi(book: pd.DataFrame) -> pd.Series:
    """Per-event order flow imbalance e_n (Cont, Kukanov & Stoikov, 2014).
    book: rows are successive top-of-book snapshots with columns
          bid_px, bid_sz, ask_px, ask_sz.
    Sum e_n over a time window to get OFI for that window."""
    bp, bq = book["bid_px"], book["bid_sz"]
    ap, aq = book["ask_px"], book["ask_sz"]
    bp0, bq0, ap0, aq0 = bp.shift(), bq.shift(), ap.shift(), aq.shift()
    e = (np.where(bp >= bp0, bq, 0.0) - np.where(bp <= bp0, bq0, 0.0)
         - np.where(ap <= ap0, aq, 0.0) + np.where(ap >= ap0, aq0, 0.0))
    e = pd.Series(e, index=book.index)
    e.iloc[0] = 0.0  # no previous snapshot
    return e

# Window OFI, e.g. 10-second buckets:
# ofi_10s = ofi(book).resample("10s").sum()
