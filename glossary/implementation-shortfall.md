# Implementation Shortfall

> The gap between a paper portfolio filled at the decision price and the portfolio that was actually traded, including fees and the cost of shares that never got filled.
> URL: https://quantcore-labs.com/glossary/implementation-shortfall/

Category: Execution & Transaction Cost Analysis. Term ID: `implementation-shortfall`.

## Definition

Perold's implementation shortfall compares two portfolios. The paper portfolio trades the full target at the price that was current when the decision was made. The real portfolio trades what was filled, at the prices that were filled, and pays fees. The difference is the shortfall. It splits into an execution component on the shares that traded and an opportunity component on the shares that did not. A positive number is a cost relative to the paper portfolio.

## Formula

```
side = +1 buy, −1 sell
filled = Σ q_i

execution  = side · Σ q_i (P_i − P_decision)
opportunity = side · (Q − filled) · (P_end − P_decision)
IS = execution + opportunity + fees

P_end is the price used to mark the unfilled remainder (often the close, or the price when the order was cancelled).
IS is in currency of the prices times quantities, not in basis points.
```

## Reading the two pieces

- **Execution cost** is what you paid, relative to the decision price, on shares that did trade. Buying above the decision price is a positive cost.
- **Opportunity cost** is the paper profit on shares you wanted and did not get. If the price runs away after a buy decision and you do not finish, that move is part of the shortfall even though no fill occurred.
- Arrival-price slippage ignores the unfilled part. It is the execution piece only, in basis points: [arrival price](https://quantcore-labs.com/glossary/arrival-price/). A schedule that balances the two pieces is the point of [Almgren-Chriss](https://quantcore-labs.com/glossary/almgren-chriss/).

## Pitfalls

- **The decision price has to be fixed before the order does anything.** Using the first fill, or the arrival mid after the child orders have already moved the book, understates the shortfall.
- **P_end is a choice.** Marking leftovers at the close and marking them at the cancel time are different costs. Write down which one.
- **Sign.** The formula returns a cost. A negative shortfall means the real portfolio beat the paper one. Do not flip the sign between buys and sells; `side` does that.
- **Fees sit outside the price.** Commission, stamp and financing belong in `fees`. Burying them in the fill price double-counts once someone also subtracts them from PnL.

## Python reference implementation

Requires standard library. Tested before publication and re-executed with assertions on every rebuild. MIT licensed. Raw file: https://quantcore-labs.com/glossary/implementation-shortfall/implementation-shortfall.py

```python
def implementation_shortfall(fills, decision_px, end_px, target_qty, side=1, fees=0.0) -> float:
    """Implementation shortfall in price-times-quantity units. Positive = cost.

    fills: iterable of (qty, price). side = +1 buy, -1 sell.
    Unfilled size is marked at end_px. qty is unsigned.
    """
    if side not in (1, -1):
        raise ValueError("side must be +1 (buy) or -1 (sell)")
    if target_qty < 0:
        raise ValueError("target_qty must be non-negative")
    filled = 0.0
    execution = 0.0
    for qty, price in fills:
        if qty < 0:
            raise ValueError("fill quantities must be non-negative")
        filled += qty
        execution += side * qty * (price - decision_px)
    if filled > target_qty + 1e-8:
        raise ValueError("filled quantity exceeds target")
    opportunity = side * (target_qty - filled) * (end_px - decision_px)
    return float(execution + opportunity + fees)
```

## FAQ

**Why charge a cost for shares that did not trade?**

The decision was to hold the target. Shares that never filled are still a difference between the paper portfolio and the real one. If the price then moves in the direction of the decision, that missed move is an opportunity cost; if it moves the other way, the unfilled part reduces the shortfall.

**Is a negative shortfall good?**

It means the real fills, leftovers and fees beat trading the full size at the decision price. It is a cost accounting identity, not a statement that the decision itself was a good one.

## Related

- [Arrival-Price Slippage](https://quantcore-labs.com/glossary/arrival-price/)
- [Volume-Weighted Average Price (VWAP)](https://quantcore-labs.com/glossary/vwap/)
- [Almgren-Chriss Optimal Execution Trajectory](https://quantcore-labs.com/glossary/almgren-chriss/)

