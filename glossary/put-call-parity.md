# Put-Call Parity

> A model-free relation between European call and put prices that share a strike and an expiry. With a continuous dividend yield, the call minus the put equals the prepaid forward minus the discounted strike.
> URL: https://quantcore-labs.com/glossary/put-call-parity/

Category: Options & Derivatives. Term ID: `put-call-parity`.

## Definition

Put-call parity says that a long European call and a short European put, same strike and expiry, replicate a long forward position struck at K. Rearranged, the call premium minus the put premium equals the spot discounted by the dividend yield, minus the strike discounted by the interest rate. No volatility, no distribution of returns and no pricing model enters. If the two premiums violate the equation by more than transaction costs, the packages are different prices for the same payoff. The function returns the gap, which is zero when parity holds.

## Formula

```
C − P = S e^{−qT} − K e^{−rT}

q = 0 (no dividends):   C − P = S − K e^{−rT}
gap = (C − P) − (S e^{−qT} − K e^{−rT})

gap = 0  → parity holds at these inputs
gap > 0  → the call is rich to the put, or the forward is cheap, relative to this identity
The identity is for European options. American options do not obey it as an equality.
```

## What it constrains

- You can back a forward out of the two premiums, which is what the [smile tool](https://quantcore-labs.com/tools/iv-smile/) does before it reads a smile off strikes. A bad forward makes every implied volatility look skewed.
- It forces several Greeks into pairs. Differentiating in S gives Δ_call − Δ_put = e^{−qT} ([delta](https://quantcore-labs.com/glossary/delta/)). Differentiating in σ gives equal [vegas](https://quantcore-labs.com/glossary/vega/). Differentiating twice in S gives equal [gammas](https://quantcore-labs.com/glossary/gamma/).
- [Rho](https://quantcore-labs.com/glossary/rho/) is the sensitivity to the r that discounts K in this identity.

## Pitfalls

- **European, same strike, same expiry, same underlying.** An American put can be worth more than parity allows, because early exercise has value. A gap on American prices is not automatically an arbitrage.
- **Dividends have to be in q, or the identity is the wrong one.** A discrete cash dividend is not a continuous yield. Using q = 0 on a stock that pays a dividend shows a gap that is just the dividend.
- **Costs.** A gap smaller than the round-trip spread, fees and borrow is not a trade. The function returns a price difference, not an executable profit.

## Python reference implementation

Requires standard library. Tested before publication and re-executed with assertions on every rebuild. MIT licensed. Raw file: https://quantcore-labs.com/glossary/put-call-parity/put-call-parity.py

```python
from math import exp

def parity_gap(call, put, S, K, T, r, q=0.0) -> float:
    """Call minus put, minus the European forward value S*exp(-qT) - K*exp(-rT).

    Zero when put-call parity holds. Not defined as an equality for American options.
    """
    if S <= 0 or K <= 0 or T < 0:
        raise ValueError("S and K must be positive and T non-negative")
    return float((call - put) - (S * exp(-q * T) - K * exp(-r * T)))
```

## FAQ

**Why does parity not mention volatility?**

The call-minus-put package pays S_T − K at expiry no matter what path volatility takes. Its present value is the prepaid forward minus the discounted strike. Volatility changes the call and the put by the same amount, so it drops out of the difference.

**What does a non-zero gap mean?**

At these inputs the two premiums are not consistent with one forward. Causes include a dividend yield you left at zero, American early exercise, stale quotes, or a genuine dislocation larger than the cost of putting the package on. The sign says which side is rich relative to the identity. It does not by itself say there is a trade.

## Use it in a calculator

- [Black-Scholes Option Greeks](https://quantcore-labs.com/option-greeks-calc/)
- [Implied Volatility Smile & Surface](https://quantcore-labs.com/tools/iv-smile/)

## Related

- [Implied Volatility](https://quantcore-labs.com/glossary/implied-volatility/)
- [Delta](https://quantcore-labs.com/glossary/delta/)
- [Rho](https://quantcore-labs.com/glossary/rho/)

