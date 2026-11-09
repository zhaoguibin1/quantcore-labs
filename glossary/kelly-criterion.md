# Kelly Criterion

> The bet size that maximises expected logarithmic growth. For a binary bet it is an exact fraction of wealth. For a continuous return it is approximately mean over variance. It is a sizing formula, not advice to use it.
> URL: https://quantcore-labs.com/glossary/kelly-criterion/

Category: Position Sizing. Term ID: `kelly-criterion`.

## Definition

A log-utility investor who can repeat the same bet wants the fraction of wealth that maximises the expected log of wealth after the bet. For a binary outcome that pays net odds b with probability p, that fraction is p − (1 − p) / b. For a continuous excess return with mean μ and variance σ², the corresponding unconstrained fraction is approximately μ / σ² when the higher moments are ignored. Estimated μ and σ² are noisy, and the full fraction is aggressive when the estimate is wrong, so practitioners who use the idea often scale it down. Nothing on this page says that an investor should.

## Formula

```
Binary bet, win probability p, net odds b (win b for each 1 staked):
  f* = p − (1 − p) / b = (b p − (1 − p)) / b

Continuous approximation, excess mean μ and variance σ² over the same horizon:
  f* ≈ μ / σ²

f* < 0 means the edge is negative: the formula says stake nothing on that side.
f* > 1 means the approximation wants leverage. The binary formula assumes you cannot stake more than wealth if you cap it; this function does not cap.
```

## What the two formulas assume

- The binary formula is exact for one repeated i.i.d. bet with known p and b, and for an objective that only cares about expected log wealth. Change the objective and the fraction changes.
- The continuous formula is a small-bet or diffusion approximation. It ignores skew and the chance of a loss large enough to make the log argument non-positive. A return distribution with a fat left tail is exactly where that matters.
- Volatility in the denominator is the same object as in the [Sharpe ratio](https://quantcore-labs.com/glossary/sharpe-ratio/), but the Kelly fraction is not a Sharpe ratio. Sharpe divides by standard deviation and annualises. Kelly divides by variance and is a weight.

## Pitfalls

- **The inputs are estimates.** Full Kelly computed from a sample mean is famous for suggesting large weights that were an artefact of the sample. A fraction of the estimate (half Kelly, quarter Kelly) is a common ad-hoc shrink. This code does not apply one.
- **No drawdown constraint.** Log growth can coexist with deep [drawdowns](https://quantcore-labs.com/glossary/max-drawdown/). The formula does not know your limit.
- **Odds b are net odds.** Even money is b = 1, not 2. Passing the decimal payout instead of the net profit doubles-counts the stake and shrinks f*.
- **Not a recommendation.** The function returns a number from an objective. It does not say the bet is worth making.

## Python reference implementation

Requires standard library. Tested before publication and re-executed with assertions on every rebuild. MIT licensed. Raw file: https://quantcore-labs.com/glossary/kelly-criterion/kelly-criterion.py

```python
def kelly_fraction(p, b) -> float:
    """Fraction of wealth for a binary bet. p = win probability, b = net odds.

    f* = p - (1 - p) / b. Does not cap at 0 or 1. Not a recommendation to bet.
    """
    p, b = float(p), float(b)
    if not 0.0 <= p <= 1.0:
        raise ValueError("p must be in [0, 1]")
    if b <= 0:
        raise ValueError("b, the net odds, must be positive")
    return p - (1.0 - p) / b

def kelly_continuous(mu, variance) -> float:
    """Approximate Kelly fraction mu / variance for a continuous excess return.

    Ignores higher moments. Not a position-sizing recommendation.
    """
    mu, variance = float(mu), float(variance)
    if variance <= 0:
        raise ValueError("variance must be positive")
    return mu / variance
```

## FAQ

**Why do people use half Kelly?**

Because p, b, μ and σ² plugged into the formula are estimates, and the expected log growth falls off slowly just below the optimum and steeply above it. Betting less than the estimated full fraction gives up a little growth on the estimated edge and hurts less when the edge was overstated. Half is a convention, not a theorem, and this page does not apply it.

**What does a negative fraction mean?**

For the binary bet, the probability and the odds do not compensate each other: expected log wealth is higher at a stake of zero than at a long stake. It is not an instruction to take the other side unless that side is a bet you can actually price with its own p and b.

## Related

- [Sharpe Ratio](https://quantcore-labs.com/glossary/sharpe-ratio/)
- [Maximum Drawdown](https://quantcore-labs.com/glossary/max-drawdown/)

