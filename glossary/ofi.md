# Order Flow Imbalance (OFI)

> Net buy-minus-sell pressure at the best bid and ask, measured from changes in top-of-book prices and sizes. Short-horizon price changes are approximately linear in OFI.
> URL: https://quantcore-labs.com/glossary/ofi/

Category: HFT & Order Book Dynamics. Term ID: `ofi`.

## Definition

Order Flow Imbalance aggregates every event at the best quotes (limit orders, cancellations and market orders) into one signed number. Demand added at the bid or supply removed from the ask counts as positive; supply added at the ask or demand removed from the bid counts as negative.

## Formula

```
Per-event contribution (Cont, Kukanov & Stoikov, 2014):

eₙ =  1{Pᴮₙ ≥ Pᴮₙ₋₁}·qᴮₙ − 1{Pᴮₙ ≤ Pᴮₙ₋₁}·qᴮₙ₋₁
    − 1{Pᴬₙ ≤ Pᴬₙ₋₁}·qᴬₙ + 1{Pᴬₙ ≥ Pᴬₙ₋₁}·qᴬₙ₋₁

OFIₖ = Σ eₙ   over events n in interval k

Price impact:  ΔPₖ ≈ βₖ · OFIₖ + εₖ,   βₖ ∝ 1 / average depth

Pᴮ, qᴮ : best bid price and size     Pᴬ, qᴬ : best ask price and size
```

## Interpretation

- When the bid price is unchanged, the bid term reduces to the change in bid size. A rising bid counts the full new size, and a falling bid subtracts the full old size. The ask side mirrors this with the sign flipped.
- The original study on US equities reports that a single linear OFI regression explains a large share of short-interval mid-price variance. It also finds that the impact coefficient scales inversely with market depth.

## Institutional usage

- Short-horizon alpha and quote-skewing signals for market makers.
- Execution: pausing or accelerating child orders when OFI runs against the order.
- Multi-level OFI, computed over the top N levels, adds information beyond level 1 in deeper books.

## Pitfalls

- Snapshot data such as the 3-second L2 snapshots common in A-share feeds hides intermediate events, so OFI computed from snapshots is a coarse approximation.
- Normalise by average depth or volume before comparing OFI across stocks.

## Python reference implementation

Requires numpy, pandas. Tested before publication and re-executed with assertions on every rebuild. MIT licensed. Raw file: https://quantcore-labs.com/glossary/ofi/ofi.py

```python
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
```

## FAQ

**Can OFI be computed from trade data alone?**

No. OFI needs best bid/ask prices and sizes. Trade-only data gives trade-sign imbalance (buy volume minus sell volume), a related but different measure.

## Related

- [Volume-Weighted Average Price (VWAP)](https://quantcore-labs.com/glossary/vwap/)
- [Hurst Exponent (H)](https://quantcore-labs.com/glossary/hurst-exponent/)

