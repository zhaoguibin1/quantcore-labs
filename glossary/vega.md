# Vega

> The sensitivity of a European option's Black-Scholes-Merton value to volatility, quoted per volatility point (one percentage point of σ). Call and put vegas of the same contract are equal.
> URL: https://quantcore-labs.com/glossary/vega/

Category: Options & Derivatives. Term ID: `vega`.

## Definition

Vega is the derivative of the model price with respect to the volatility input. A raw derivative is per 1.00 of σ, that is, per 100 volatility points, which is an awkward unit. Dividing by 100 quotes the change in premium for a one-point move in volatility, the convention used by the Greeks calculator on this site. Because of put-call parity, a European call and put with the same strike and expiry have the same vega: the forward that separates them does not depend on σ.

## Formula

```
ν_raw = S e^{−qT} φ(d1) √T          per 1.00 of volatility
ν     = ν_raw / 100                  per 1 volatility point

d1 = [ln(S/K) + (r − q + σ²/2) T] / (σ √T)
Same value for the European call and the European put.
φ is the standard normal density.
```

## Units

- If the model price rises by 0.375 when volatility goes from 20 percent to 21 percent, vega per point is about 0.375. The raw derivative ∂V/∂σ is about 37.5. This function returns the per-point number.
- The [Greeks calculator](https://quantcore-labs.com/option-greeks-calc/) divides by 100 in the same place. [Implied volatility](https://quantcore-labs.com/glossary/implied-volatility/) is the σ that the premium implies; vega is how the premium would change if that input changed.
- Call and put share vega for the same reason they share [gamma](https://quantcore-labs.com/glossary/gamma/): their difference is a forward.

## Pitfalls

- **Volatility point means 0.01 in decimal σ.** Moving σ from 0.20 to 0.21 is one point. Moving it from 0.20 to 1.20 is one hundred points.
- **Sticky strike, sticky delta, and the smile.** The derivative holds every other input fixed, including a single σ. On a smile, a spot move often comes with a different implied volatility. Model vega does not include that.
- **Near expiry, deep in or out of the money, vega is small.** Many vols then fit almost the same premium, which is the same fact as a flat price-versus-σ curve.

## Python reference implementation

Requires scipy. Tested before publication and re-executed with assertions on every rebuild. MIT licensed. Raw file: https://quantcore-labs.com/glossary/vega/vega.py

```python
from math import exp, log, sqrt
from scipy.stats import norm

def bs_vega(S, K, T, r, sigma, q=0.0) -> float:
    """Black-Scholes-Merton vega per 1 volatility point (dPrice / dσ / 100).

    Same value for a European call and put. S, K, T, sigma must be positive.
    """
    if S <= 0 or K <= 0 or T <= 0 or sigma <= 0:
        raise ValueError("S, K, T and sigma must be positive")
    d1 = (log(S / K) + (r - q + 0.5 * sigma * sigma) * T) / (sigma * sqrt(T))
    return float(S * exp(-q * T) * norm.pdf(d1) * sqrt(T) / 100.0)
```

## FAQ

**Why divide by 100?**

The calculus derivative is the change in price for a change of 1.00 in σ, i.e. from 20 percent to 120 percent. Desks quote the change for one point, from 20 percent to 21 percent, which is that derivative divided by 100. The calculator on this site does the same.

**Do calls and puts have the same vega?**

European calls and puts with the same strike and expiry do, in Black-Scholes-Merton. Put-call parity says their difference does not depend on volatility, so the volatility derivatives match.

## Related

- [Implied Volatility](https://quantcore-labs.com/glossary/implied-volatility/)
- [Delta](https://quantcore-labs.com/glossary/delta/)
- [Gamma](https://quantcore-labs.com/glossary/gamma/)

