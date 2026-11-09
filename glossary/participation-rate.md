# Participation Rate (Percent of Volume)

> The fraction of market volume an order takes over an interval. A percent-of-volume schedule sets each child order to that fraction of the volume just observed, capped by what is left.
> URL: https://quantcore-labs.com/glossary/participation-rate/

Category: Execution & Market Microstructure. Term ID: `participation-rate`.

## Definition

Participation rate, or POV, is own volume divided by market volume over the same interval. A POV algorithm watches the market print, and sends a child quantity equal to a target fraction of that print, without exceeding the residual parent quantity. The target is a fraction of volume, not a clock and not a forecast of the day's volume curve.

## Formula

```
POV = V_own / V_market

Child quantity for one interval, given volume V printed in that interval:
  q = min(Q_remaining, ρ · V)

ρ is the target rate as a fraction (0.10 means ten percent of volume).
The child does not look ahead at volume that has not printed.
```

## How the schedule behaves

- Busy intervals produce larger children. Quiet intervals produce smaller ones. The order slows down when the market does, which a [TWAP](https://quantcore-labs.com/glossary/twap/) slice will not.
- It does not finish by a deadline. If volume dries up, quantity is left over. A horizon with a hard end needs a different schedule, such as [Almgren-Chriss](https://quantcore-labs.com/glossary/almgren-chriss/) or VWAP with a residual sweep.
- The realised rate is own fills over market volume, which includes your own prints if they are in the tape. Subtracting them is a policy choice and changes the number.

## Pitfalls

- **ρ is a fraction.** Passing 10 thinking it means 10 percent requests ten times market volume. The code treats 10 as 1000 percent and will try to take all remaining quantity.
- **The cap is the remaining parent, not a market-impact model.** min(remaining, ρ·V) does not estimate how far the child moves the price. Impact still scales with participation; this function only sizes the child.
- **Which volume.** Lit continuous volume, auction volume and odd-lot volume are different denominators. The caller passes the volume number; the function does not classify prints.

## Python reference implementation

Requires standard library. Tested before publication and re-executed with assertions on every rebuild. MIT licensed. Raw file: https://quantcore-labs.com/glossary/participation-rate/participation-rate.py

```python
def pov_child_qty(market_vol_interval, target_rate, remaining_qty) -> float:
    """Child quantity for a percent-of-volume slice.

    target_rate is a fraction of market volume (0.1 = 10%). The result is
    never larger than remaining_qty, and is zero when there is nothing to do.
    """
    if market_vol_interval < 0 or remaining_qty < 0:
        raise ValueError("volumes must be non-negative")
    if target_rate < 0:
        raise ValueError("target_rate must be non-negative")
    return float(min(remaining_qty, target_rate * market_vol_interval))
```

## FAQ

**Is participation the same as POV?**

POV (percent of volume) is the schedule that tries to keep participation near a target. Participation rate is the realised or target ratio itself. People use the two names for both the ratio and the algorithm; the formula on this page is the ratio, and the function is the child size that targets it.

**What rate is reasonable?**

There is no universal rate. Higher participation finishes sooner and usually moves the price more. The function does not choose ρ. It only converts a chosen rate and an observed volume into a child quantity.

## Related

- [Time-Weighted Average Price (TWAP)](https://quantcore-labs.com/glossary/twap/)
- [Volume-Weighted Average Price (VWAP)](https://quantcore-labs.com/glossary/vwap/)
- [Almgren-Chriss Optimal Execution Trajectory](https://quantcore-labs.com/glossary/almgren-chriss/)

