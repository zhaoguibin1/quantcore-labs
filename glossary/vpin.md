# Volume-Synchronized Probability of Informed Trading (VPIN)

> An estimate of order-flow toxicity from the imbalance between buy and sell volume inside equal-volume buckets. It updates by volume, not by the clock.
> URL: https://quantcore-labs.com/glossary/vpin/

Category: Market Microstructure & Order Flow. Term ID: `vpin`.

## Definition

VPIN averages the absolute difference between buy volume and sell volume across the last n equal-volume buckets, and divides by the volume those buckets represent. Easley, López de Prado and O'Hara designed it as a high-frequency cousin of the probability of informed trading: a bucket is toxic when one side dominates. The measure does not classify trades by itself. Buy and sell volume are inputs, usually from a bulk-volume split or from an aggressor flag.

## Formula

```
V = target volume of each bucket
VPIN = Σ_{τ=1..n} |V^B_τ − V^S_τ| / (n · V)

If every bucket is exactly volume V and V^B + V^S = V, then 0 ≤ VPIN ≤ 1.
VPIN = 0: buy and sell volume match in every bucket
VPIN = 1: each bucket is entirely one side
```

## How desks use the number

- As a state variable for quoting: a higher reading means recent volume was more one-sided, so a market maker may widen or cut size. It is a description of the recent tape, not a forecast with a promised hit rate.
- The buckets are equal volume, not equal time. Build them with something like [volume bars](https://quantcore-labs.com/code/pandas-volume-bars/), then split each bar's volume into buy and sell.
- The daily structural model behind the same idea is [PIN](https://quantcore-labs.com/glossary/pin-informed-trading/). A price-impact slope on signed volume is [Kyle's lambda](https://quantcore-labs.com/glossary/kyles-lambda/).

## Pitfalls

- **Classification is the measurement.** Bulk-volume classification assigns a fraction of each bar to buy or sell from the price change. A different rule produces a different VPIN. Report the rule.
- **The denominator assumes equal buckets.** The code below rejects a row whose buy plus sell volume is not the stated bucket size. A partial last bucket should be dropped, not squeezed into the formula.
- **It is not a probability you can take to a risk limit without a model.** The name says probability. The calculation is a normalised imbalance. Mapping it onto the structural PIN parameters requires the model, not just the ratio.

## Python reference implementation

Requires numpy, pandas. Tested before publication and re-executed with assertions on every rebuild. MIT licensed. Raw file: https://quantcore-labs.com/glossary/vpin/vpin.py

```python
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
```

## FAQ

**Is VPIN the same as PIN?**

No. PIN is a daily mixture model estimated by maximum likelihood from buy and sell counts. VPIN is a rolling volume-bucket imbalance that can be updated through the day. They share an author and an interpretation, not a formula.

**What is a high VPIN?**

The ratio is between 0 and 1 when buckets are well formed. How high is unusual depends on the symbol, the bucket size and the classification rule. Compare a name with its own history before comparing it with another name.

## Related

- [Probability of Informed Trading (PIN)](https://quantcore-labs.com/glossary/pin-informed-trading/)
- [Kyle's Lambda](https://quantcore-labs.com/glossary/kyles-lambda/)
- [Equal-Volume Bars from a Trade Tape](https://quantcore-labs.com/code/pandas-volume-bars/)
- [Order Flow Imbalance (OFI)](https://quantcore-labs.com/glossary/ofi/)

