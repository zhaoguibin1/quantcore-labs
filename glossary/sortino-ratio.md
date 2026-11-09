# Sortino Ratio

> Mean return above a minimum acceptable return, divided by downside deviation and annualised. Upside variation does not enter the denominator.
> URL: https://quantcore-labs.com/glossary/sortino-ratio/

Category: Performance & Risk Metrics. Term ID: `sortino-ratio`.

## Definition

The Sortino ratio replaces the Sharpe denominator with downside deviation: the root-mean-square of returns that fall short of a target, with shortfalls of zero on periods that meet the target still included in the average. The target used here is an annual minimum acceptable return, converted to a per-period rate the same way the risk-free rate is converted for the Sharpe ratio. The result is annualised by sqrt(P). It penalises missing the target. It does not penalise beating it.

## Formula

```
MAR_period = (1 + MAR_annual) ^ (1/P) − 1
d_t = min(R_t − MAR_period, 0)
DD  = sqrt( mean(d_t²) )                 average over every period, not only the negative ones

Sortino = (mean(R) − MAR_period) / DD · sqrt(P)

DD = 0 → undefined (NaN). Using only the negative periods in the mean would be a different statistic.
```

## Why the denominator ignores upside

- Two strategies can share a volatility and a [Sharpe ratio](https://quantcore-labs.com/glossary/sharpe-ratio/) while one of them makes its volatility on the upside. Sortino treats those as different.
- The target is not automatically the risk-free rate. It is whatever minimum acceptable return you pass in. Zero means "negative periodic returns count against the strategy".
- The [performance calculator](https://quantcore-labs.com/tools/performance-analytics/) uses this downside definition (root-mean-square over all periods) and the same annualisation.

## Pitfalls

- **A sample with no down period is undefined, not infinite.** The function returns NaN. Reporting a huge Sortino from a handful of up days is a presentation choice the code refuses.
- **The mean in the square root is over n, not n − 1.** That matches the calculator. Mixing it with a sample-standard-deviation downside changes the number.
- **It still does not see path.** A slow grind below the target and a crash with the same squared shortfalls can share a Sortino. Look at [maximum drawdown](https://quantcore-labs.com/glossary/max-drawdown/) as well.

## Python reference implementation

Requires numpy. Tested before publication and re-executed with assertions on every rebuild. MIT licensed. Raw file: https://quantcore-labs.com/glossary/sortino-ratio/sortino-ratio.py

```python
import numpy as np

def sortino_ratio(returns, mar_annual=0.0, periods=252) -> float:
    """Annualised Sortino ratio.

    Downside deviation is the root-mean-square of min(r - MAR, 0) over all
    periods. MAR is an annual rate, compounded to a per-period rate.
    No downside variation returns NaN. Matches /tools/performance-analytics/.
    """
    r = np.asarray(returns, dtype=float)
    r = r[np.isfinite(r)]
    if r.size < 2:
        raise ValueError("need at least two finite returns")
    if periods <= 0:
        raise ValueError("periods must be positive")
    mar = (1.0 + mar_annual) ** (1.0 / periods) - 1.0
    downside = float(np.sqrt(np.mean(np.minimum(r - mar, 0.0) ** 2)))
    if downside == 0.0:
        return float("nan")
    return float((r.mean() - mar) / downside * np.sqrt(periods))
```

## FAQ

**Why average the squared shortfalls over periods that were not shortfalls?**

Those periods contribute a zero, so they dilute the root-mean-square. Dropping them would divide by the number of bad periods only and would make a rare crash look like a small downside. The version that keeps the zeros is the one the performance calculator uses.

**Should the target be the risk-free rate?**

Only if that is the return you have decided is the minimum you care about. The parameter is a minimum acceptable return, not a funding rate. Leaving it at zero scores any negative periodic return as downside.

## Use it in a calculator

- [Performance & Drawdown Analytics](https://quantcore-labs.com/tools/performance-analytics/)

## Related

- [Sharpe Ratio](https://quantcore-labs.com/glossary/sharpe-ratio/)
- [Maximum Drawdown](https://quantcore-labs.com/glossary/max-drawdown/)
- [Calmar Ratio](https://quantcore-labs.com/glossary/calmar-ratio/)

