# Maximum Drawdown

> The most negative peak-to-trough decline of an equity curve. A 25 percent decline is returned as −0.25, not as 0.25.
> URL: https://quantcore-labs.com/glossary/max-drawdown/

Category: Performance & Risk Metrics. Term ID: `max-drawdown`.

## Definition

Drawdown at each point is the equity divided by the highest equity seen so far, minus one. The maximum drawdown is the smallest of those numbers (the deepest loss from a peak). It is path dependent: the order of returns matters, not only their mean and variance. The function expects a positive equity curve, not a return series.

## Formula

```
DD_t = E_t / max_{s ≤ t} E_s − 1
MDD  = min_t DD_t

MDD ≤ 0. MDD = 0 means the equity curve never fell below a peak it had already set.
Recovery and the length of the drawdown are not part of this number.
```

## Using it next to a return ratio

- Sharpe and Sortino compress the path into moments. Maximum drawdown keeps one fact about the path: the worst decline from a high-water mark. Report both.
- The [performance calculator](https://quantcore-labs.com/tools/performance-analytics/) uses this definition and also reports how long the longest drawdown lasted. Duration is not in the function on this page.
- [Calmar](https://quantcore-labs.com/glossary/calmar-ratio/) divides annualised growth by the absolute value of this number.

## Pitfalls

- **Sign.** The function returns a non-positive fraction. Taking abs is the caller's job when a report wants "25 percent drawdown" as a positive phrase. Calmar does that internally.
- **Equity, not returns.** Passing returns produces a meaningless ratio of small numbers. Compound the returns to equity first. The first point is a peak by definition, so a curve that falls immediately draws down from the starting level.
- **Sample length.** A longer window can only make the maximum worse or leave it unchanged, if it contains the shorter window. Comparing a one-year MDD with a ten-year MDD as if they were the same statistic favours the short window.
- **Mark-to-market frequency.** Daily equity and monthly equity do not share a maximum drawdown. Intra-month peaks are invisible on a monthly curve.

## Python reference implementation

Requires numpy. Tested before publication and re-executed with assertions on every rebuild. MIT licensed. Raw file: https://quantcore-labs.com/glossary/max-drawdown/max-drawdown.py

```python
import numpy as np

def max_drawdown(equity) -> float:
    """Most negative peak-to-trough decline of a positive equity curve.

    Returns a fraction in [-1, 0]. A 25% decline is -0.25.
    """
    equity = np.asarray(equity, dtype=float)
    if equity.size == 0 or not np.all(np.isfinite(equity)) or np.any(equity <= 0):
        raise ValueError("equity must be non-empty, finite and positive")
    peak = np.maximum.accumulate(equity)
    return float((equity / peak - 1.0).min())
```

## FAQ

**Does the maximum drawdown say when it happened?**

No. It is a single fraction. The performance calculator on this site also reports the peak and trough dates and the longest time spent below a peak. Those need the whole drawdown path, not only its minimum.

**What if the curve ends at its low?**

The unrecovered decline is included. Maximum drawdown does not require the equity to have made a new high afterwards. A strategy that fell 40 percent and never recovered has a maximum drawdown of at least 40 percent.

## Use it in a calculator

- [Performance & Drawdown Analytics](https://quantcore-labs.com/tools/performance-analytics/)
- [Monte Carlo Asset Simulator](https://quantcore-labs.com/tools/monte-carlo-asset-sim/)

## Related

- [Calmar Ratio](https://quantcore-labs.com/glossary/calmar-ratio/)
- [Sharpe Ratio](https://quantcore-labs.com/glossary/sharpe-ratio/)
- [Value at Risk (VaR) and Expected Shortfall (ES)](https://quantcore-labs.com/glossary/var-expected-shortfall/)

