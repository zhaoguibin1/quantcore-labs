# Rho

> The sensitivity of a European option's Black-Scholes-Merton value to the continuous risk-free rate, quoted per one percentage point of rate.
> URL: https://quantcore-labs.com/glossary/rho/

Category: Options & Derivatives. Term ID: `rho`.

## Definition

Rho is the derivative of the model price with respect to the interest rate, holding spot, strike, time, volatility and dividend yield fixed. Dividing by 100 quotes it per one percentage point (from 5 percent to 6 percent, for example), matching the Greeks calculator on this site. A European call's rho is positive: a higher rate lowers the present value of the strike you might pay. A European put's rho is negative. Dividend yield q is a different input and is not what this derivative moves.

## Formula

```
ρ_call = K T e^{−rT} N(d2) / 100
ρ_put  = −K T e^{−rT} N(−d2) / 100

d2 = [ln(S/K) + (r − q − σ²/2) T] / (σ √T)

Per 1 percentage point of r. The raw derivative ∂V/∂r is 100 times larger.
q enters d2. It does not appear as its own discount in the rho formula;
∂V/∂q is a different Greek.
```

## Sign

- Call rho is greater than or equal to zero in this model. Put rho is less than or equal to zero. A book that is long calls and short puts of the same strike picks up both.
- The rate inside Black-Scholes is the continuous risk-free rate used to discount the strike, not a credit spread and not the dividend. Changing q instead is not rho.
- The [Greeks calculator](https://quantcore-labs.com/option-greeks-calc/) reports rho per 1 percent with the formulas above. [Put-call parity](https://quantcore-labs.com/glossary/put-call-parity/) is where that discount shows up as K e^{−rT}.

## Pitfalls

- **One point of rate, not one point of volatility.** The /100 here is the same kind of unit choice as [vega](https://quantcore-labs.com/glossary/vega/), applied to r rather than to σ.
- **Short-dated options have small rho** because of the factor T. A one-week option barely changes when the rate moves by a point. A five-year option moves much more, in the model.
- **The rate is flat and constant.** A real curve has many rates. One rho cannot describe a shift of a single tenor, a slope change, and a parallel move as three different risks.

## Python reference implementation

Requires scipy. Tested before publication and re-executed with assertions on every rebuild. MIT licensed. Raw file: https://quantcore-labs.com/glossary/rho/rho.py

```python
from math import exp, log, sqrt
from scipy.stats import norm

def bs_rho(S, K, T, r, sigma, call=True, q=0.0) -> float:
    """Black-Scholes-Merton rho per 1 percentage point of the risk-free rate.

    call=False returns the put rho, which is negative or zero.
    """
    if S <= 0 or K <= 0 or T <= 0 or sigma <= 0:
        raise ValueError("S, K, T and sigma must be positive")
    d2 = (log(S / K) + (r - q - 0.5 * sigma * sigma) * T) / (sigma * sqrt(T))
    if call:
        return float(K * T * exp(-r * T) * norm.cdf(d2) / 100.0)
    return float(-K * T * exp(-r * T) * norm.cdf(-d2) / 100.0)
```

## FAQ

**Why is put rho negative?**

A higher risk-free rate reduces the present value of the strike the put might receive, and it raises the forward. Both hurt the model value of a European put, so the derivative is negative. A European call is helped by the same two facts.

**Does rho include dividend sensitivity?**

No. q is held fixed. Rho moves only r. The dividend yield changes d2, so a different q produces a different rho, but the derivative itself is with respect to the interest rate.

## Related

- [Delta](https://quantcore-labs.com/glossary/delta/)
- [Put-Call Parity](https://quantcore-labs.com/glossary/put-call-parity/)
- [Theta](https://quantcore-labs.com/glossary/theta/)

