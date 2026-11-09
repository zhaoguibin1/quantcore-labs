# Calmar Ratio

> Compound annual growth of an equity curve divided by the absolute value of its maximum drawdown. This implementation uses the whole sample, not a trailing 36-month window.
> URL: https://quantcore-labs.com/glossary/calmar-ratio/

Category: Performance & Risk Metrics. Term ID: `calmar-ratio`.

## Definition

Calmar divides a growth rate by the worst peak-to-trough loss over the window you care about. Here the growth rate is the compound annual growth that takes the first equity point to the last, using P periods per year, and the loss is the maximum drawdown of the same points. A curve that never falls has an undefined Calmar, returned as NaN, rather than an infinite one. The original published ratio used a trailing three-year window. Using the whole sample is what the performance calculator on this site does, and it will not match a 36-month Calmar when the sample is a different length.

## Formula

```
n = number of returns = (number of equity points) − 1
CAGR = (E_last / E_first) ^ (P / n) − 1
MDD  = min_t (E_t / max_{s≤t} E_s − 1)          MDD ≤ 0

Calmar = CAGR / |MDD|     if MDD < 0, else undefined

P defaults to 252. The same equity series should be used for the numerator and the denominator.
```

## Reading it

- A Calmar of 0.5 means the compound annual growth was half the size of the worst decline, on this sample and this annualisation. It is not a forecast of either input.
- The pieces are on their own pages: growth uses the same exponent as the [performance calculator](https://quantcore-labs.com/tools/performance-analytics/), and the denominator is [maximum drawdown](https://quantcore-labs.com/glossary/max-drawdown/).
- Sharpe uses a typical deviation. Calmar uses a single worst episode. One deep drawdown dominates it, which is the point of the ratio and also its instability.

## Pitfalls

- **Window.** Young (1991) described a three-year lookback. A ten-year Calmar and a three-year Calmar of the same fund are different statistics. This function uses every point you pass.
- **Start and end dates are part of the answer.** CAGR depends on the first and last equity. MDD depends on the path between them. Dropping a crash from the sample changes the denominator; ending on a peak changes the numerator.
- **Frequency.** P has to match the spacing of the equity points. Passing daily equity with P = 12 treats a year of days as twelve periods.

## Python reference implementation

Requires numpy. Tested before publication and re-executed with assertions on every rebuild. MIT licensed. Raw file: https://quantcore-labs.com/glossary/calmar-ratio/calmar-ratio.py

```python
import numpy as np

def calmar_ratio(equity, periods=252) -> float:
    """CAGR / |maximum drawdown| over the whole sample.

    CAGR uses (E_last / E_first) ** (periods / n_returns) - 1.
    A curve with no drawdown returns NaN. Matches the full-sample convention
    of /tools/performance-analytics/, not a trailing 36-month window.
    """
    equity = np.asarray(equity, dtype=float)
    if equity.size < 2 or not np.all(np.isfinite(equity)) or np.any(equity <= 0):
        raise ValueError("need at least two positive finite equity points")
    if periods <= 0:
        raise ValueError("periods must be positive")
    n = equity.size - 1
    cagr = (equity[-1] / equity[0]) ** (periods / n) - 1.0
    mdd = float((equity / np.maximum.accumulate(equity) - 1.0).min())
    if mdd == 0.0:
        return float("nan")
    return float(cagr / abs(mdd))
```

## FAQ

**Why not use a 36-month window?**

The original Calmar ratio did. This site's performance calculator divides full-sample CAGR by full-sample maximum drawdown, and the glossary function matches that so the two do not disagree. For a 36-month figure, pass only those points.

**What does NaN mean here?**

The equity curve made no new low relative to a peak, so the denominator would be zero. That includes a curve that only rises. It is not an infinite reward-to-risk ratio.

## Use it in a calculator

- [Performance & Drawdown Analytics](https://quantcore-labs.com/tools/performance-analytics/)

## Related

- [Maximum Drawdown](https://quantcore-labs.com/glossary/max-drawdown/)
- [Sharpe Ratio](https://quantcore-labs.com/glossary/sharpe-ratio/)
- [Sortino Ratio](https://quantcore-labs.com/glossary/sortino-ratio/)

