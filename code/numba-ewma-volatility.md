# RiskMetrics EWMA Volatility in Numba

> Exponentially weighted variance compiled with Numba. The variance at t uses returns only through t−1, so the latest shock is not included in the volatility assigned to that same index.
> URL: https://quantcore-labs.com/code/numba-ewma-volatility/

Category: High-Performance Python. Snippet ID: `numba-ewma-volatility`.

## What it does

RiskMetrics writes today's variance as a blend of yesterday's variance and yesterday's squared return. The weight on the previous variance is λ, often 0.94 for daily data. The square root of that variance is the EWMA volatility. The loop is a prefix recursion, which Numba compiles to a tight machine-code pass. It is a smoother with a fixed λ, not a fitted GARCH model.

## Approach

```
σ²_0 = r_0²
σ²_t = λ σ²_{t−1} + (1 − λ) r_{t−1}²     t = 1..n−1
σ_t  = sqrt(σ²_t)

σ_t depends on r_0 .. r_{t−1} only.
0 ≤ λ ≤ 1.  λ = 1 repeats σ²_0.  λ = 0 gives σ²_t = r_{t−1}².
```

## When to use it

- A causal volatility estimate on a long return series, for scaling positions or for comparing with [realized volatility](https://quantcore-labs.com/glossary/realized-volatility/).
- Inside another `@njit` loop. A Python EWMA over millions of bars spends its time in the interpreter; this one does not, after the first compile.
- For a variance that also reacts to a long-run level and is estimated rather than set, see [GARCH(1,1)](https://quantcore-labs.com/glossary/garch/).

## Pitfalls

- **Initial value.** σ²_0 = r_0² is one observation. A large first return leaves a long tail when λ is close to 1. Some desks seed the recursion with a sample variance of an earlier window instead.
- **Look-ahead.** Using r_t² inside σ_t would mix the return you are about to score with the volatility you score it by. This recursion does not do that. Do not "fix" the index.
- **λ is not estimated here.** 0.94 is the RiskMetrics daily convention, not a maximum-likelihood estimate for your sample. The half-life of a shock is about ln(0.5)/ln(λ) periods (about 11 days at 0.94).
- **NaNs and the first call.** A NaN poisons every later value. The first call compiles; `cache=True` reuses the compiled code afterwards.

## Python reference implementation

Requires numpy, numba. Tested before publication and re-executed with assertions on every rebuild. MIT licensed. Raw file: https://quantcore-labs.com/code/numba-ewma-volatility/numba-ewma-volatility.py

```python
import numpy as np
from numba import njit

@njit(cache=True)
def ewma_vol(returns, lam=0.94):
    """EWMA volatility. var[t] uses returns[:t] only (r[t] is excluded).

    lam is the weight on the previous variance (RiskMetrics daily default 0.94).
    """
    if lam < 0.0 or lam > 1.0:
        raise ValueError("lam must be in [0, 1]")
    r = returns
    n = r.shape[0]
    var = np.empty(n, dtype=np.float64)
    if n == 0:
        return var
    var[0] = r[0] * r[0]
    one = 1.0 - lam
    for t in range(1, n):
        prev = r[t - 1]
        var[t] = lam * var[t - 1] + one * prev * prev
    return np.sqrt(var)
```

## FAQ

**Why does the variance at t use the return at t−1?**

So that the volatility sitting on row t was knowable before r_t was. That is the RiskMetrics recursion. Putting r_t into var[t] would make any later Sharpe-style scaling use information from the return it is scaling.

**Is this GARCH?**

No. GARCH(1,1) has a constant term and the two slopes are estimated. EWMA is the special case ω = 0 and α + β = 1, with λ chosen rather than fitted. It has no finite unconditional variance.

## Related

- [GARCH(1,1)](https://quantcore-labs.com/glossary/garch/)
- [Realized Volatility](https://quantcore-labs.com/glossary/realized-volatility/)
- [Fast Rolling Mean, Std, Beta and Z-score with Numba](https://quantcore-labs.com/code/rolling-window-numba/)

