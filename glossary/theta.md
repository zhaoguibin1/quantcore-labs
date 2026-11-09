# Theta

> The sensitivity of a European option's Black-Scholes-Merton value to the passage of calendar time, quoted per day. The annual derivative is divided by 365.
> URL: https://quantcore-labs.com/glossary/theta/

Category: Options & Derivatives. Term ID: `theta`.

## Definition

Theta is the derivative of the model value with respect to calendar time, holding spot, volatility, rates and yield fixed. Time to expiry shrinks as calendar time advances, so the formula is minus the derivative with respect to T, then divided by 365 to quote a per-day number. Long options usually have negative theta: the premium decays as expiry approaches, all else equal. That "all else equal" is the catch. Spot and implied volatility do not stay still so that theta can be observed on its own.

## Formula

```
Let φ(d1) be the standard normal density, and
d1 = [ln(S/K) + (r − q + σ²/2) T] / (σ √T),   d2 = d1 − σ √T.

Θ_call = [ −S e^{−qT} φ(d1) σ / (2√T) − r K e^{−rT} N(d2) + q S e^{−qT} N(d1) ] / 365
Θ_put  = [ −S e^{−qT} φ(d1) σ / (2√T) + r K e^{−rT} N(−d2) − q S e^{−qT} N(−d1) ] / 365

Both are per calendar day. A trading-day theta divides the annual derivative by 252 instead;
multiply the value here by 365/252 to convert. q = 0 drops the last term in each bracket.
The Greeks calculator on this site uses these expressions.
```

## What the sign means

- Negative theta means the model value falls as the clock runs, with every other input frozen. That is the usual case for a long option away from unusual rate and dividend combinations.
- The decay term −S e^{−qT} φ(d1) σ / (2√T) is shared. The rate and dividend terms differ for calls and puts, which is why a call theta and a put theta are not equal, unlike [gamma](https://quantcore-labs.com/glossary/gamma/) and [vega](https://quantcore-labs.com/glossary/vega/).
- See [delta](https://quantcore-labs.com/glossary/delta/) for the d1 that enters, and the [Greeks calculator](https://quantcore-labs.com/option-greeks-calc/) for the same per-day convention.

## Pitfalls

- **365 versus 252.** This function divides by 365, calendar days, matching the calculator. A desk that marks theta per trading day wants the other divisor. The two numbers differ by 365/252.
- **One day is not infinitesimal.** The derivative times 1/365 approximates the change from losing one calendar day of expiry. Very short-dated options have a theta that changes a lot over that same day, so the approximation is rougher.
- **Frozen volatility.** The derivative does not include a change in implied volatility as expiry approaches. Real premiums move for that reason too.

## Python reference implementation

Requires scipy. Tested before publication and re-executed with assertions on every rebuild. MIT licensed. Raw file: https://quantcore-labs.com/glossary/theta/theta.py

```python
from math import exp, log, sqrt
from scipy.stats import norm

def bs_theta(S, K, T, r, sigma, call=True, q=0.0) -> float:
    """Black-Scholes-Merton theta per calendar day (annual derivative / 365).

    call=False returns the put. Multiply by 365/252 for a trading-day theta.
    """
    if S <= 0 or K <= 0 or T <= 0 or sigma <= 0:
        raise ValueError("S, K, T and sigma must be positive")
    sT = sigma * sqrt(T)
    d1 = (log(S / K) + (r - q + 0.5 * sigma * sigma) * T) / sT
    d2 = d1 - sT
    decay = -S * exp(-q * T) * norm.pdf(d1) * sigma / (2.0 * sqrt(T))
    if call:
        annual = decay - r * K * exp(-r * T) * norm.cdf(d2) + q * S * exp(-q * T) * norm.cdf(d1)
    else:
        annual = decay + r * K * exp(-r * T) * norm.cdf(-d2) - q * S * exp(-q * T) * norm.cdf(-d1)
    return float(annual / 365.0)
```

## FAQ

**Why is theta usually negative for a long option?**

With the other inputs held fixed, less time means less chance of a large move and, for a call, less time for the prepaid forward to earn its rates. The model premium of a long option therefore usually falls as expiry gets closer. A short option has the opposite sign. This is a partial derivative, not a prediction of tomorrow's premium.

**Does the function use trading days or calendar days?**

Calendar days. The annual Black-Scholes derivative is divided by 365, which is what the Greeks calculator on this site displays. Multiply by 365/252 if you want a per-trading-day figure.

## Related

- [Delta](https://quantcore-labs.com/glossary/delta/)
- [Gamma](https://quantcore-labs.com/glossary/gamma/)
- [Vega](https://quantcore-labs.com/glossary/vega/)

