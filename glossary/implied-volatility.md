# Implied Volatility

> The volatility that makes a Black-Scholes-Merton price match an observed option premium. It is solved numerically. There is no closed form for the call price inverted in volatility.
> URL: https://quantcore-labs.com/glossary/implied-volatility/

Category: Options & Derivatives. Term ID: `implied-volatility`.

## Definition

Implied volatility is defined by an equation, not by a formula you can rearrange. Given a market premium, a spot, a strike, a time to expiry, a rate and a dividend yield, it is the σ that sets the Black-Scholes-Merton price equal to that premium. This page solves it with Brent's method on a bracket. The same inversion, across strikes and expiries, is what the smile tool on this site plots. A single number always belongs to one contract and one set of inputs.

## Formula

```
C_BSM(S, K, T, r, q, σ_imp) = C_market

d1 = [ln(S/K) + (r − q + σ²/2) T] / (σ √T)
d2 = d1 − σ √T
C  = S e^{−qT} N(d1) − K e^{−rT} N(d2)

No-arbitrage range for a European call, before the solve:
  max(S e^{−qT} − K e^{−rT}, 0) ≤ C ≤ S e^{−qT}
A premium outside that range has no real implied volatility.
```

## Solving it

- The call price increases in σ, so the root is unique when it exists. Brent's method needs a bracket. The code starts at 0.000001 and 5 (500 percent) and widens to 20 if the premium is still above the model at 5.
- A premium that sits on intrinsic value returns 0. A premium outside the no-arbitrage bounds raises, rather than returning a quiet NaN that looks like a failed fit.
- The [implied-volatility smile](https://quantcore-labs.com/tools/iv-smile/) tool solves the same inversion across a grid and fits a slope. One contract's σ_imp is the building block. [Vega](https://quantcore-labs.com/glossary/vega/) is how the price moves when that input moves.

## Pitfalls

- **The model is part of the answer.** A Black-Scholes implied volatility and a Black-76 implied volatility on the same premium are not the same number. This page is Black-Scholes-Merton with a continuous dividend yield q. Set q = 0 for the textbook no-dividend call.
- **European, one expiry, constant inputs.** American early exercise, discrete dividends and a volatility that depends on the strike are all outside the inverter. The smile is exactly the evidence that one σ does not price every strike.
- **Deep, short-dated options.** Vega collapses and many volatilities map to almost the same premium. The root is mathematically there and practically poorly identified. Trust the price residual, not just the σ.

## Python reference implementation

Requires scipy. Tested before publication and re-executed with assertions on every rebuild. MIT licensed. Raw file: https://quantcore-labs.com/glossary/implied-volatility/implied-volatility.py

```python
from math import exp, log, sqrt
from scipy.optimize import brentq
from scipy.stats import norm

def bs_call(S, K, T, r, sigma, q=0.0) -> float:
    """Black-Scholes-Merton European call. sigma is a decimal volatility."""
    if S <= 0 or K <= 0 or T <= 0 or sigma <= 0:
        raise ValueError("S, K, T and sigma must be positive")
    sT = sigma * sqrt(T)
    d1 = (log(S / K) + (r - q + 0.5 * sigma * sigma) * T) / sT
    d2 = d1 - sT
    return S * exp(-q * T) * norm.cdf(d1) - K * exp(-r * T) * norm.cdf(d2)

def implied_vol(price, S, K, T, r, q=0.0) -> float:
    """Black-Scholes-Merton implied volatility of a European call premium.

    Returns 0 when the premium is at intrinsic value. Raises when the premium
    is outside the no-arbitrage bounds or the root is above 2000 percent.
    """
    if S <= 0 or K <= 0 or T <= 0:
        raise ValueError("S, K and T must be positive")
    lower = max(S * exp(-q * T) - K * exp(-r * T), 0.0)
    upper = S * exp(-q * T)
    if price < lower - 1e-8 or price > upper + 1e-8:
        raise ValueError("price is outside no-arbitrage bounds")
    if price <= lower + 1e-12:
        return 0.0

    def gap(sigma):
        return bs_call(S, K, T, r, sigma, q) - price

    hi = 5.0
    if gap(hi) < 0:
        hi = 20.0
        if gap(hi) < 0:
            raise ValueError("implied volatility is above 20; check the premium")
    return float(brentq(gap, 1e-6, hi))
```

## FAQ

**Why is there no formula for implied volatility?**

The cumulative normal of d1 and d2 depends on σ in a way that does not invert in closed form. Series approximations exist. A bracketed root find on a monotone function is the straightforward exact method, and it is what this page tests.

**Does a higher implied volatility mean the option is expensive?**

It means the premium is high relative to this model's other inputs. Whether that is expensive depends on the volatility you believe the underlying will actually realise, on the smile, and on costs. The number itself is a restatement of the premium.

## Related

- [Vega](https://quantcore-labs.com/glossary/vega/)
- [Realized Volatility](https://quantcore-labs.com/glossary/realized-volatility/)
- [GARCH(1,1)](https://quantcore-labs.com/glossary/garch/)
- [Put-Call Parity](https://quantcore-labs.com/glossary/put-call-parity/)

