# Arrival-Price Slippage

> Execution cost against the mid-price at the moment the order arrived, in basis points. Positive means the fills were worse than that mid.
> URL: https://quantcore-labs.com/glossary/arrival-price/

Category: Execution & Transaction Cost Analysis. Term ID: `arrival-price`.

## Definition

The arrival price is the mid (or other pre-agreed reference) when the order reached the desk or the algorithm, before the order's own child trades. Slippage is the signed difference between the average fill and that reference, scaled to basis points. Buys are costly when the average fill is above the arrival mid. Sells are costly when it is below.

## Formula

```
slippage_bps = side · (P_avg − P_arrival) / P_arrival · 10^4

side = +1 buy, −1 sell
P_arrival is a mid, not the last trade, unless the policy explicitly says otherwise
Positive slippage = worse than the arrival price
```

## What it does and does not include

- It prices the shares that filled. It says nothing about shares that did not. That remainder is the opportunity term in [implementation shortfall](https://quantcore-labs.com/glossary/implementation-shortfall/).
- It does not know why the price moved. Impact, drift and spread are all inside the same basis-point number. A later decomposition can split them; this ratio cannot.
- [VWAP](https://quantcore-labs.com/glossary/vwap/) slippage asks a different question: did you beat the market's own average, rather than the price at arrival.

## Pitfalls

- **Stamp the mid before you send.** Reconstructing arrival from the first child fill includes your own impact and makes the order look cheaper than it was.
- **Average fill has to be volume-weighted.** The mean of child-order limit prices is not the average execution price.
- **Basis points hide the currency.** 5 bp on a large notional is a large amount. Report both when the number goes into a cost report.

## Python reference implementation

Requires standard library. Tested before publication and re-executed with assertions on every rebuild. MIT licensed. Raw file: https://quantcore-labs.com/glossary/arrival-price/arrival-price.py

```python
def arrival_slippage_bps(avg_exec_px, arrival_mid, side=1) -> float:
    """Signed execution cost versus the arrival mid, in basis points.

    side = +1 buy, -1 sell. Positive means worse than the arrival mid.
    """
    if arrival_mid <= 0:
        raise ValueError("arrival_mid must be positive")
    if side not in (1, -1):
        raise ValueError("side must be +1 (buy) or -1 (sell)")
    return float(side * (avg_exec_px - arrival_mid) / arrival_mid * 1e4)
```

## FAQ

**Why use the mid instead of the last trade?**

The last trade is whichever side last crossed the spread, so it sits half a spread away from a price you could have notionally dealt at on average. The mid is the usual pre-trade reference. If the policy uses the near touch or the last trade, the function still applies, but the input is no longer a mid and the name should say so.

**Does a negative number mean the execution was good?**

It means the average fill beat the arrival reference, after the sign for buy or sell. It does not include unfilled quantity, fees or whether the arrival price itself was a sensible time to trade.

## Related

- [Implementation Shortfall](https://quantcore-labs.com/glossary/implementation-shortfall/)
- [Volume-Weighted Average Price (VWAP)](https://quantcore-labs.com/glossary/vwap/)
- [Time-Weighted Average Price (TWAP)](https://quantcore-labs.com/glossary/twap/)

