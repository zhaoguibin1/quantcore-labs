# Realized Volatility

> The square root of the sum of squared log returns inside one window, optionally scaled to a year. For a single day of intraday prices, multiplying by 252 annualises that day's realized variance. Do not do that to a stack of many days.
> URL: https://quantcore-labs.com/glossary/realized-volatility/

Category: Volatility Modeling. Term ID: `realized-volatility`.

## Definition

Realized variance over a window is the sum of squared logarithmic returns of the prices inside it. Realized volatility is its square root. Under a diffusion with no jumps, that sum estimates the integrated variance of the window, and finer sampling makes the estimate tighter until microstructure noise dominates. The function annualises by multiplying the sum by a periods-per-year factor before the square root. That factor is correct when the sum is one period's variance (one day, if the factor is 252). Applied to a year of already-daily returns it multiplies a yearly total by 252 and overstates volatility by about sqrt(252).

## Formula

```
r_i = ln(P_i / P_{i−1})
RV  = sqrt( (Σ_i r_i²) · P )

P = periods per year used to annualise THIS window.
One day of intraday returns → P = 252 (or 242) gives an annualised number from that day.
A window you do not want to annualise → P = 1, which returns sqrt(Σ r_i²).

The sum of squares, not the square of the sum. Signs of returns do not matter.
```

## What the window is

- Pass the prices of one period. A session of one-minute prices in, an annualised volatility for that session out, if you set the factor to the number of sessions in a year.
- To describe a year, compute each day's sum of squares and then average the daily realized variances, and only then scale. This function does not do that average. It scales whatever sum you hand it.
- Close-to-close volatility is the ordinary standard deviation of daily log returns, a different estimator. Range estimators such as [Parkinson](https://quantcore-labs.com/glossary/parkinson-volatility/) use high and low. A conditional model is [GARCH](https://quantcore-labs.com/glossary/garch/).

## Pitfalls

- **Annualisation is the easy mistake.** Σ r² over 252 daily returns is already a year of variance. Multiplying by another 252 is wrong. Use P = 1 for a pre-aggregated sum you do not want scaled.
- **Microstructure.** Bid-ask bounce biases the sum of squares up as the sampling gets finer. One-second returns on a wide spread mostly measure the spread.
- **Jumps and overnight.** A close-to-open jump is one large r_i if you include it, and is invisible if you only pass the cash session. Neither choice is free.
- **Zeros and negative prices.** Log returns require positive prices. The function rejects the rest.

## Python reference implementation

Requires numpy. Tested before publication and re-executed with assertions on every rebuild. MIT licensed. Raw file: https://quantcore-labs.com/glossary/realized-volatility/realized-volatility.py

```python
import numpy as np

def realized_vol(prices, periods_per_year=252) -> float:
    """Square root of summed squared log returns, scaled by periods_per_year.

    periods_per_year annualises a SINGLE window. Use 1 to return the
    un-annualised sqrt(sum of squares). Prices must be positive.
    """
    px = np.asarray(prices, dtype=float)
    if px.size < 2 or not np.all(np.isfinite(px)) or np.any(px <= 0):
        raise ValueError("need at least two positive finite prices")
    if periods_per_year <= 0:
        raise ValueError("periods_per_year must be positive")
    r = np.diff(np.log(px))
    return float(np.sqrt(np.sum(r * r) * periods_per_year))
```

## FAQ

**How do I annualise a year of daily realized variances?**

Average the daily sums of squared intraday returns first (that average estimates average daily variance), then multiply by the number of sessions in a year and take the square root. Passing every intraday price of the year into this function with periods_per_year=252 multiplies a year of variance by 252.

**Why log returns?**

Squared log returns add up to integrated variance for a diffusion. Squared simple returns are close when the moves are small and are a different estimator when they are not. The function uses logs.

## Related

- [Parkinson Volatility](https://quantcore-labs.com/glossary/parkinson-volatility/)
- [GARCH(1,1)](https://quantcore-labs.com/glossary/garch/)
- [Implied Volatility](https://quantcore-labs.com/glossary/implied-volatility/)

