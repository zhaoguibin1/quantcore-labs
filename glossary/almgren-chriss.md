# Almgren-Chriss Optimal Execution Trajectory

> A deterministic schedule that liquidates a position by a fixed horizon, trading off temporary market impact against the variance of the remaining inventory. This page uses the continuous-time trajectory with permanent impact set to zero.
> URL: https://quantcore-labs.com/glossary/almgren-chriss/

Category: Execution & Market Impact. Term ID: `almgren-chriss`.

## Definition

Almgren and Chriss (2000) choose a trading path that finishes a position by time T. Trading faster pays more temporary impact and less price risk, because the inventory is held for less time. The risk aversion λ sets that tradeoff. With linear temporary impact, no permanent impact, and arithmetic Brownian motion, the inventory that remains at time t is a hyperbolic sine of the time left. The path is a plan computed from volatility, impact and risk aversion. It is not a guarantee of the cost, and it is not an order.

## Formula

```
Inventory remaining (permanent impact taken as 0):

  x(t) = X · sinh(κ (T − t)) / sinh(κ T)
  κ = sqrt(λ σ² / η)

X     initial position (signed)
η     temporary-impact coefficient (cost ∝ η · speed² in the standard linear model)
σ     absolute price volatility
λ     risk aversion on inventory variance
T     horizon

As λ → 0 (or σ → 0), κ → 0 and x(t) → X · (T − t) / T, a straight line.
Trades are the decreases of x. x(0) = X and x(T) = 0.
```

## What the shape means

- Low risk aversion gives a near-linear liquidation: equal amounts of inventory per unit time, close to a [TWAP](https://quantcore-labs.com/glossary/twap/) schedule in trade time.
- High risk aversion sells (or buys) more at the start, because holding the inventory is what the objective penalises. The temporary-impact bill is accepted in exchange for less variance.
- The cost the path is balancing is the same object as [implementation shortfall](https://quantcore-labs.com/glossary/implementation-shortfall/): impact paid now versus the risk of still being in the position later.

## Pitfalls

- **This is the no-permanent-impact slice of the model.** The 2000 paper also has a permanent impact coefficient. It shifts the expected cost but, in their framework, not the optimal trajectory. Do not quote this κ as the full model if you have estimated a permanent term and intend to use a different objective.
- **σ, η and λ have to share units.** σ is absolute price volatility per unit time if the impact is in price, not in return. A return volatility plugged in beside a price impact produces a nonsense κ.
- **The path is open-loop.** It does not react to volume, spread or a signal. A [participation](https://quantcore-labs.com/glossary/participation-rate/) schedule does the opposite: it reacts to volume and does not promise a finish time.
- **Sinh overflows for large κT.** The implementation uses a ratio of exponentials and switches to the straight line when κT is tiny.

## Python reference implementation

Requires numpy. Tested before publication and re-executed with assertions on every rebuild. MIT licensed. Raw file: https://quantcore-labs.com/glossary/almgren-chriss/almgren-chriss.py

```python
import numpy as np

def almgren_chriss_trajectory(X, T, n, sigma, eta, risk_aversion):
    """Inventory remaining on n equal steps from 0 to T, including both endpoints.

    Permanent impact is taken as zero. risk_aversion = 0 (or sigma = 0) returns
    the straight-line schedule. X may be signed.
    """
    if T <= 0 or int(n) < 1:
        raise ValueError("T must be positive and n at least 1")
    if eta <= 0 or sigma < 0 or risk_aversion < 0:
        raise ValueError("eta must be positive; sigma and risk_aversion non-negative")
    t = np.linspace(0.0, float(T), int(n) + 1)
    if risk_aversion == 0 or sigma == 0:
        return X * (T - t) / T
    kappa = np.sqrt(risk_aversion * sigma ** 2 / eta)
    if kappa * T < 1e-8:
        return X * (T - t) / T
    # sinh(κ(T-t)) / sinh(κT) = exp(a-b) * (1 - exp(-2a)) / (1 - exp(-2b))
    a = kappa * (T - t)
    b = kappa * T
    ratio = np.exp(a - b) * (1.0 - np.exp(-2.0 * a)) / (1.0 - np.exp(-2.0 * b))
    return X * ratio
```

## FAQ

**Why is the zero-risk path a straight line?**

With no penalty on inventory variance, the objective only punishes trading speed, and the cheapest way to finish by T with linear temporary impact is to trade at a constant speed. Any front-loading would pay more impact without a benefit the objective recognises.

**Does the trajectory include permanent impact?**

No. κ above uses temporary impact η only. In the original linear model, adding permanent impact changes expected cost and does not change this particular trajectory. If your impact model is not that one, do not reuse the path unchanged.

## Related

- [Implementation Shortfall](https://quantcore-labs.com/glossary/implementation-shortfall/)
- [Participation Rate (Percent of Volume)](https://quantcore-labs.com/glossary/participation-rate/)
- [Time-Weighted Average Price (TWAP)](https://quantcore-labs.com/glossary/twap/)

