# Kyle's Lambda

> The slope of price changes on signed order flow. A larger lambda means the same signed volume moves the price more, which is the usual reduced-form reading of a less liquid market.
> URL: https://quantcore-labs.com/glossary/kyles-lambda/

Category: Market Microstructure & Order Flow. Term ID: `kyles-lambda`.

## Definition

In Kyle's 1985 model, competitive market makers set price impact so that the price is the conditional expectation of value given the net order flow. The impact coefficient is lambda. Empirically, lambda is estimated as the OLS slope of a price change on signed volume over a chosen interval. The intercept absorbs drift. This page is that regression, not a maximum-likelihood estimate of the structural model.

## Formula

```
ΔP_t = α + λ · SignedVolume_t + ε_t

λ = Cov(ΔP, SignedVolume) / Var(SignedVolume)

SignedVolume > 0 means net buying. The sign convention has to match ΔP:
a buy-driven uptick is positive volume with a positive price change.
Units of λ are price per unit of volume.
```

## What the slope is used for

- Comparing liquidity across names or across time: a higher λ is more impact per unit of signed volume. Scale volume before comparing a high-priced name with a low-priced one, or work in returns and turnover instead of raw price and shares.
- As a cost input. A parent order of signed size Q has an impact term on the order of λ·Q in this linear model, before temporary spread and fees. That is a sketch, not a cost forecast.
- Related tape measures: [VPIN](https://quantcore-labs.com/glossary/vpin/) (volume imbalance), [OFI](https://quantcore-labs.com/glossary/ofi/) (quote updates) and [Amihud](https://quantcore-labs.com/glossary/amihud-illiquidity/) (daily |return| over value).

## Pitfalls

- **Trade signs.** A wrong aggressor flag flips the slope's sign. Quote-rule labels from an [as-of join](https://quantcore-labs.com/code/polars-asof-join-quotes/) are an estimate of the sign, not the exchange flag.
- **Horizon.** Lambda on one-second bins and lambda on daily bins are different parameters. Impact decays; a longer bin lets some of it come back and the slope falls.
- **Endogeneity.** Signed volume and the price change are determined together. OLS is the reduced form people report. It is not, by itself, the structural Kyle lambda.
- **Zero flow variance.** A window with no variation in signed volume has no slope. The function raises rather than returning a silent NaN from a degenerate fit.

## Python reference implementation

Requires numpy. Tested before publication and re-executed with assertions on every rebuild. MIT licensed. Raw file: https://quantcore-labs.com/glossary/kyles-lambda/kyles-lambda.py

```python
import numpy as np

def kyles_lambda(price_changes, signed_volume) -> float:
    """OLS slope of price changes on signed volume, with an intercept."""
    x = np.asarray(signed_volume, dtype=float)
    y = np.asarray(price_changes, dtype=float)
    if x.shape != y.shape or x.ndim != 1 or x.size < 2:
        raise ValueError("need at least two aligned observations")
    xc = x - x.mean()
    var = float(xc @ xc)
    if var <= 0:
        raise ValueError("signed volume has zero variance")
    yc = y - y.mean()
    return float((xc @ yc) / var)
```

## FAQ

**Why include an intercept?**

The price can drift over the sample for reasons other than the signed flow in the regression. Without an intercept, that drift is forced into the slope. OLS with an intercept is also what np.polyfit of degree 1 estimates.

**Can lambda be negative?**

In the model, no: informed buying pushes the price up. In a sample, yes, if the signs are noisy or the window is short. A negative estimate is a warning about the regression, not a negative liquidity.

## Related

- [Volume-Synchronized Probability of Informed Trading (VPIN)](https://quantcore-labs.com/glossary/vpin/)
- [Order Flow Imbalance (OFI)](https://quantcore-labs.com/glossary/ofi/)
- [Amihud Illiquidity Measure (ILLIQ)](https://quantcore-labs.com/glossary/amihud-illiquidity/)
- [Attach the Prevailing Quote to Each Trade](https://quantcore-labs.com/code/polars-asof-join-quotes/)

