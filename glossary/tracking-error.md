# Tracking Error

> The annualised sample standard deviation of portfolio return minus benchmark return. It measures how far the two series wandered from each other, not whether one ended ahead.
> URL: https://quantcore-labs.com/glossary/tracking-error/

Category: Performance & Risk Metrics. Term ID: `tracking-error`.

## Definition

Tracking error is the volatility of active returns. A portfolio that beats its benchmark by exactly one basis point every period has a positive average active return and a tracking error of zero. A portfolio that oscillates around the benchmark has tracking error and, possibly, a zero average. The implementation is the sample standard deviation of the paired difference, times sqrt(P).

## Formula

```
a_t = R_port,t − R_bench,t
TE  = std(a, ddof=1) · sqrt(P)

P defaults to 252. Reported as a decimal (0.02 means 2 percent annualised), not in basis points.
The information ratio is mean(a) / std(a) · sqrt(P), so IR = annualised mean active return / TE.
```

## Where it shows up

- Index tracking and closet indexing. A mandate that says "stay within 2 percent tracking error" is a constraint on this number, usually estimated on an ex-ante covariance as well as measured ex post. This function is the ex-post measurement.
- Next to the [information ratio](https://quantcore-labs.com/glossary/information-ratio/), which is undefined when tracking error is zero.
- [Beta](https://quantcore-labs.com/glossary/beta/) is a different summary of the same pair of series: a slope, not the volatility of the residual gap. Two portfolios can share a beta and have very different tracking errors.

## Pitfalls

- **Ex post is not ex ante.** The standard deviation of realised active returns is not the tracking error a covariance model would predict for the current holdings.
- **Annualisation.** Multiplying a daily active-return standard deviation by sqrt(252) assumes uncorrelated active returns. A persistent active bet (a permanent sector tilt) has a tracking error that does not scale that way if you change the sampling interval without care. Be consistent about P.
- **Levels versus returns.** Tracking error is defined on returns. A price spread between an ETF and its basket is a different measurement.

## Python reference implementation

Requires numpy. Tested before publication and re-executed with assertions on every rebuild. MIT licensed. Raw file: https://quantcore-labs.com/glossary/tracking-error/tracking-error.py

```python
import numpy as np

def tracking_error(port, bench, periods=252) -> float:
    """Annualised sample standard deviation of port minus bench."""
    active = np.asarray(port, dtype=float) - np.asarray(bench, dtype=float)
    if active.ndim != 1 or active.size < 2 or not np.all(np.isfinite(active)):
        raise ValueError("need at least two finite paired returns")
    if periods <= 0:
        raise ValueError("periods must be positive")
    return float(active.std(ddof=1) * np.sqrt(periods))
```

## FAQ

**Can tracking error be zero while the portfolio differs from the benchmark?**

Yes, if the difference in returns is constant. Standard deviation does not see the mean. A constant lag of one basis point per day is a large cumulative gap and a zero tracking error.

**Is tracking error the same as active risk?**

In mandate language, active risk usually means this volatility of active returns, sometimes the ex-ante forecast of it. Quote whether the number is realised or predicted. This function is realised.

## Related

- [Information Ratio](https://quantcore-labs.com/glossary/information-ratio/)
- [Beta](https://quantcore-labs.com/glossary/beta/)
- [Sharpe Ratio](https://quantcore-labs.com/glossary/sharpe-ratio/)

