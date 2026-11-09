# Top-of-Book Queue Imbalance while Replaying Quotes

> Walk a tape of best-bid and best-ask sizes in a compiled loop and emit the queue imbalance at each update. A locked or empty touch, where the two sizes sum to zero, is recorded as zero rather than as a division by zero.
> URL: https://quantcore-labs.com/code/numba-order-book-replay/

Category: High-Performance Python. Snippet ID: `numba-order-book-replay`.

## What it does

Queue imbalance at the touch is the bid size minus the ask size, divided by the sum of the two. It is positive when more size is displayed on the bid than on the ask. Replaying the top-of-book tape means evaluating that ratio at every update, in order, without building an intermediate DataFrame. The function does not reconstruct price levels and it does not infer trade direction. It is the size ratio only.

## Approach

```
I_t = (q^b_t − q^a_t) / (q^b_t + q^a_t)    if q^b_t + q^a_t > 0
    = 0                                         otherwise

−1 ≤ I_t ≤ 1
I_t = 1  → all displayed touch size is on the bid
I_t = −1 → all of it is on the ask
Sizes must be ≥ 0. This is not Cont–Kukanov–Stoikov order-flow imbalance.
```

## Where it fits

- A feature on a quote tape: one number per book update, cheap enough to compute inside a compiled replay of millions of rows.
- As a simpler cousin of [order-flow imbalance](https://quantcore-labs.com/glossary/ofi/). OFI uses price changes and the size that was added or removed. Queue imbalance uses only the sizes currently displayed.
- Trade-sign toxicity measures such as [VPIN](https://quantcore-labs.com/glossary/vpin/) need trades, not this quote ratio.

## Pitfalls

- **Displayed size is not the true queue.** Iceberg orders, hidden liquidity and fleeting quotes mean the ratio is a picture of what was shown, not of demand.
- **Crossed or zero sizes.** A feed glitch can report a zero or negative size. Negative sizes raise. A zero total returns 0 so one bad print does not poison a later reduction with NaN, but you should still count how often that branch hits.
- **Not comparable across names without care.** The ratio is already scale-free. Its variance still depends on how often the touch flips, which differs between a thick future and a thin stock.

## Python reference implementation

Requires numpy, numba. Tested before publication and re-executed with assertions on every rebuild. MIT licensed. Raw file: https://quantcore-labs.com/code/numba-order-book-replay/numba-order-book-replay.py

```python
import numpy as np
from numba import njit

@njit(cache=True)
def queue_imbalance(bid_sz, ask_sz):
    """Queue imbalance (bid_sz - ask_sz) / (bid_sz + ask_sz) at each update.

    Replay order is the array order. Total size of 0 yields 0. Negative sizes raise.
    """
    n = bid_sz.shape[0]
    if ask_sz.shape[0] != n:
        raise ValueError("bid_sz and ask_sz must have the same length")
    out = np.empty(n, dtype=np.float64)
    for i in range(n):
        b = bid_sz[i]
        a = ask_sz[i]
        if b < 0.0 or a < 0.0:
            raise ValueError("sizes must be non-negative")
        tot = b + a
        out[i] = (b - a) / tot if tot > 0.0 else 0.0
    return out
```

## FAQ

**How is this different from order-flow imbalance?**

Order-flow imbalance adds up changes at the best quotes: size added on the bid is buying pressure, size added on the ask is selling pressure. Queue imbalance ignores the change and only looks at the sizes currently sitting at the touch.

**Why return 0 when both sizes are 0?**

There is no queue to compare. Returning NaN is also defensible; 0 keeps a compiled reduction from turning the rest of a session into NaN when a single empty update appears. Check the rate of empty updates separately.

## Related

- [Order Flow Imbalance (OFI)](https://quantcore-labs.com/glossary/ofi/)
- [Volume-Synchronized Probability of Informed Trading (VPIN)](https://quantcore-labs.com/glossary/vpin/)

