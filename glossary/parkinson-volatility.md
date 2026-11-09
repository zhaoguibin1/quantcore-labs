# Parkinson Volatility

> A volatility estimator that uses each period's high and low instead of the close-to-close move. Under a driftless Brownian motion it is more efficient than the close-to-close estimator. With drift, jumps or a close that is not the whole story, that efficiency result does not apply.
> URL: https://quantcore-labs.com/glossary/parkinson-volatility/

Category: Volatility Modeling. Term ID: `parkinson-volatility`.

## Definition

Parkinson (1980) replaces the squared close-to-close return with the squared log range. The scaling 1 / (4 ln 2) makes the average of those squared ranges an estimate of the variance per period, for a Brownian motion with no drift. Multiplying by the number of periods in a year and taking the square root annualises it. The estimator never sees the open or the close. A day that gaps and then trades in a narrow range looks quiet.

## Formula

```
σ²_period = (1 / (4 N ln 2)) · Σ_{t=1..N} (ln(H_t / L_t))²
σ_annual  = σ_period · sqrt(P)

H_t ≥ L_t > 0.  N is the number of ranges you pass.
4 ln 2 ≈ 2.7726, so a day whose high is about 1.7% above its low
(ln(H/L) ≈ 0.0166, squared ≈ 2.77e-4) contributes about 1e-4 of daily variance
before annualisation, i.e. 1 percent daily, before the average.

P defaults to 252 and scales the mean daily variance, which is the right
shape when each row is one session.
```

## Why a range

- The high and the low summarise the whole path, not only the two endpoints. For a driftless Brownian motion the range estimator has a lower variance than the close-to-close estimator on the same number of days.
- It is a natural check on [realized volatility](https://quantcore-labs.com/glossary/realized-volatility/) when you have bars but not a full trade tape: daily high and low are enough.
- It is still a historical number. An option-implied number is [implied volatility](https://quantcore-labs.com/glossary/implied-volatility/), and a recursive filter is [GARCH](https://quantcore-labs.com/glossary/garch/).

## Pitfalls

- **Drift.** A strong trend widens the range for a reason other than diffusion variance. Parkinson is derived at zero drift. Rogers-Satchell and Yang-Zhang exist because of that; this page does not implement them.
- **Overnight gaps.** If high and low are the cash-session extrema, the gap from yesterday's close is invisible. The estimator then misses a piece of the day's variance that a close-to-close number includes.
- **Bad prints.** One erroneous high dominates a squared range. The average does not trim it.
- **Do not feed intraday bars and also multiply by 252** unless each row is one session. The function annualises the mean of the rows you pass.

## Python reference implementation

Requires numpy. Tested before publication and re-executed with assertions on every rebuild. MIT licensed. Raw file: https://quantcore-labs.com/glossary/parkinson-volatility/parkinson-volatility.py

```python
import numpy as np

def parkinson_vol(high, low, periods=252) -> float:
    """Annualised Parkinson volatility from high and low arrays.

    Each pair is one period. `periods` is how many such periods make a year.
    Requires 0 < low <= high.
    """
    h = np.asarray(high, dtype=float)
    lo = np.asarray(low, dtype=float)
    if h.shape != lo.shape or h.ndim != 1 or h.size == 0:
        raise ValueError("high and low must be non-empty and aligned")
    if not np.all(np.isfinite(h)) or not np.all(np.isfinite(lo)):
        raise ValueError("high and low must be finite")
    if np.any(lo <= 0) or np.any(h < lo):
        raise ValueError("require 0 < low <= high")
    if periods <= 0:
        raise ValueError("periods must be positive")
    x = np.log(h / lo)
    return float(np.sqrt(np.mean(x * x) / (4.0 * np.log(2.0)) * periods))
```

## FAQ

**Why is the divisor 4 ln 2?**

It is the expected value of the squared log range of a standard Brownian motion over one unit of time. Dividing by it converts an average squared range into a variance estimate. The derivation assumes no drift and no jumps.

**Is Parkinson always better than close-to-close?**

No. It is more efficient in the zero-drift diffusion it was derived for. A large overnight gap, a trading halt, or a bad high print can make it worse than a close-to-close estimator that at least uses the official closes.

## Related

- [Realized Volatility](https://quantcore-labs.com/glossary/realized-volatility/)
- [GARCH(1,1)](https://quantcore-labs.com/glossary/garch/)
- [Implied Volatility](https://quantcore-labs.com/glossary/implied-volatility/)

