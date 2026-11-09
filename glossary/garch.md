# GARCH(1,1)

> A conditional variance that is a constant plus a weight on yesterday's squared shock plus a weight on yesterday's variance. This page filters a series with given parameters. It does not estimate them.
> URL: https://quantcore-labs.com/glossary/garch/

Category: Volatility Modeling. Term ID: `garch`.

## Definition

GARCH(1,1), Bollerslev (1986), says today's variance depends on a long-run piece, on how large yesterday's surprise was, and on yesterday's variance. Clusters of large moves follow because a large shock raises the next variance, which keeps later variances high until the β term decays. The function below runs that recursion. ω, α and β are inputs. Fitting them by maximum likelihood is a numerical problem this page does not solve. The variance at step 0 is the first squared return, so the filter does not use later data to start itself.

## Formula

```
σ²_t = ω + α ε²_{t−1} + β σ²_{t−1}

σ²_0 = ε_0²          (a one-point start; not the sample variance of the whole series)
Unconditional variance, when α ≥ 0, β ≥ 0 and α + β < 1:
  σ²_∞ = ω / (1 − α − β)

α + β is the persistence. α + β ≥ 1 means there is no finite unconditional variance.
The filter still runs. Half-life of a shock to variance is about ln(2) / −ln(α+β) periods when α+β < 1.

EWMA is the case ω = 0, α + β = 1, with α = 1−λ and β = λ. See the Numba EWMA page.
```

## Filter versus estimate

- Given parameters, the recursion is a one-pass filter. That is what `garch11_variance` does, and what the tests check.
- The parameters themselves are usually estimated by maximising a Gaussian or Student-t likelihood. Different likelihoods, different estimates. Publishing a 20-line fitter here would hide that choice.
- Compare the path with [realized volatility](https://quantcore-labs.com/glossary/realized-volatility/) (a sum of squares, no parameters) and with [EWMA](https://quantcore-labs.com/code/numba-ewma-volatility/) (persistence fixed at 1).

## Pitfalls

- **The shock is the return only if the mean is zero.** The recursion treats the series you pass as ε. If you meant a demeaned residual, demean first. A large mean inside ε² looks like volatility.
- **Starting value.** ε_0² can be a wild first day. An alternative is the unconditional variance, which depends on the parameters and, if those were fit on this same sample, uses the whole sample. This filter does not do that.
- **α + β close to 1** makes the unconditional variance huge and the filter slow to forget. Integrated GARCH (α + β = 1) never forgets a shock in the level of variance.
- **No leverage term.** Plain GARCH treats an up move and a down move of the same size identically. GJR and EGARCH exist because equity returns usually do not.

## Python reference implementation

Requires numpy. Tested before publication and re-executed with assertions on every rebuild. MIT licensed. Raw file: https://quantcore-labs.com/glossary/garch/garch.py

```python
import numpy as np

def garch11_variance(returns, omega, alpha, beta):
    """GARCH(1,1) variance path. Parameters are inputs, not estimates.

    var[0] = returns[0] ** 2. Later terms use the previous return and the
    previous variance only. omega, alpha, beta must be non-negative.
    """
    r = np.asarray(returns, dtype=float)
    if r.ndim != 1 or not np.all(np.isfinite(r)):
        raise ValueError("returns must be a finite 1-d array")
    if omega < 0 or alpha < 0 or beta < 0:
        raise ValueError("omega, alpha and beta must be non-negative")
    var = np.empty(r.shape, dtype=float)
    if r.size == 0:
        return var
    var[0] = r[0] * r[0]
    for t in range(1, r.size):
        var[t] = omega + alpha * r[t - 1] * r[t - 1] + beta * var[t - 1]
    return var

def garch11_unconditional(omega, alpha, beta) -> float:
    """ω / (1 − α − β). Inf when α + β ≥ 1."""
    if omega < 0 or alpha < 0 or beta < 0:
        raise ValueError("omega, alpha and beta must be non-negative")
    if alpha + beta >= 1.0:
        return float("inf")
    return float(omega / (1.0 - alpha - beta))
```

## FAQ

**Why not fit the parameters on this page?**

A Gaussian likelihood, a Student-t likelihood and a robust estimator do not return the same (ω, α, β), and the optimiser needs constraints so that variances stay positive. The recursion itself is the part that can be checked exactly. Bring parameters from a fit you trust.

**Is the variance at t allowed to use the return at t?**

Not in this filter. σ²_t is the variance assigned before ε_t is treated as realised, which is what you want if the next step is to standardise ε_t by σ_t. The update that includes ε_t² lands in σ²_{t+1}.

## Use it in a calculator

- [Implied Volatility Smile & Surface](https://quantcore-labs.com/tools/iv-smile/)

## Related

- [RiskMetrics EWMA Volatility in Numba](https://quantcore-labs.com/code/numba-ewma-volatility/)
- [Realized Volatility](https://quantcore-labs.com/glossary/realized-volatility/)
- [Parkinson Volatility](https://quantcore-labs.com/glossary/parkinson-volatility/)
- [Implied Volatility](https://quantcore-labs.com/glossary/implied-volatility/)

