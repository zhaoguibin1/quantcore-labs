# Information Ratio

> Mean active return versus a benchmark, divided by the tracking error of that active return, and annualised. It scores how large and how steady the gap versus the benchmark was.
> URL: https://quantcore-labs.com/glossary/information-ratio/

Category: Performance & Risk Metrics. Term ID: `information-ratio`.

## Definition

Active return is the portfolio's periodic return minus the benchmark's periodic return over the same periods. The information ratio is the mean of that difference divided by its sample standard deviation, multiplied by sqrt(P). It is the Sharpe ratio of the active returns, with the benchmark playing the role of the risk-free asset and no extra cash rate. A positive ratio means the portfolio's sample average was above the benchmark. It does not say the average will stay there.

## Formula

```
a_t = R_port,t − R_bench,t
IR  = mean(a) / std(a, ddof=1) · sqrt(P)

Tracking error is the denominator before dividing into the mean: TE = std(a) · sqrt(P).
IR = mean(a) · sqrt(P) / TE, with TE in annualised units.
std(a) = 0 → NaN (the portfolio matched the benchmark exactly in-sample).
```

## Relation to other ratios

- [Tracking error](https://quantcore-labs.com/glossary/tracking-error/) is the annualised standard deviation alone. The information ratio puts the mean active return on top of it.
- The [information coefficient](https://quantcore-labs.com/glossary/information-coefficient/) is a cross-sectional correlation between a signal and later returns, not this time-series ratio. Grinold's approximation IR ≈ IC · sqrt(breadth) is a model that links them, not an identity in the data.
- A [Sharpe ratio](https://quantcore-labs.com/glossary/sharpe-ratio/) uses excess return over cash. An information ratio uses excess return over the benchmark you were hired to beat, or chose to compare with.

## Pitfalls

- **The benchmark has to be the one that was investable on that timing.** Comparing a close-to-close portfolio with a benchmark that includes a return the portfolio could not have earned inflates the ratio.
- **Alignment.** Missing dates, dividends in one series only, or a different currency, all land in the active return. The function subtracts the two arrays as given.
- **A high IR on a tiny active risk** can be a few basis points of average difference and a tracking error that is mostly noise. Report the tracking error beside the ratio.

## Python reference implementation

Requires numpy. Tested before publication and re-executed with assertions on every rebuild. MIT licensed. Raw file: https://quantcore-labs.com/glossary/information-ratio/information-ratio.py

```python
import numpy as np

def information_ratio(port, bench, periods=252) -> float:
    """Annualised information ratio of port minus bench.

    Sample standard deviation. Identical series return NaN.
    """
    active = np.asarray(port, dtype=float) - np.asarray(bench, dtype=float)
    if active.ndim != 1 or active.size < 2 or not np.all(np.isfinite(active)):
        raise ValueError("need at least two finite paired returns")
    if periods <= 0:
        raise ValueError("periods must be positive")
    sd = float(active.std(ddof=1))
    if sd == 0.0:
        return float("nan")
    return float(active.mean() / sd * np.sqrt(periods))
```

## FAQ

**How is this different from the information coefficient?**

The information coefficient correlates a cross-section of forecasts with a cross-section of outcomes on one date. The information ratio divides a time series of active returns by their standard deviation. Similar names, different objects.

**Should the active return include fees?**

If the question is what the investor kept versus the benchmark, yes. If the question is whether the holdings differed from the benchmark before costs, no. The function uses the two return series you pass in, so the choice of fees happens before the call.

## Related

- [Tracking Error](https://quantcore-labs.com/glossary/tracking-error/)
- [Sharpe Ratio](https://quantcore-labs.com/glossary/sharpe-ratio/)
- [Information Coefficient (IC)](https://quantcore-labs.com/glossary/information-coefficient/)
- [Beta](https://quantcore-labs.com/glossary/beta/)

