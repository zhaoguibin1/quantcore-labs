# Gamma

> The second derivative of a European option's value with respect to the spot, and the derivative of delta. In Black-Scholes-Merton the call and the put of the same strike and expiry have the same gamma.
> URL: https://quantcore-labs.com/glossary/gamma/

Category: Options & Derivatives. Term ID: `gamma`.

## Definition

Gamma tells you how fast delta changes as the spot moves. It is largest near the strike and near expiry, where the distribution of finishing in or out of the money is most sensitive to the current spot. Because a European call and put that share strike and expiry differ by a forward (put-call parity), and a forward has no gamma, their gammas are equal. The formula below is that common value.

## Formula

```
Γ = e^{−qT} φ(d1) / (S σ √T)

φ is the standard normal density.
d1 = [ln(S/K) + (r − q + σ²/2) T] / (σ √T)

Same number for the European call and the European put.
Units: change in delta per 1 point of spot. Not a percent.
```

## Why the call and the put match

- [Put-call parity](https://quantcore-labs.com/glossary/put-call-parity/) says the call minus the put equals a discounted forward. Differentiating twice in S kills the forward and leaves Γ_call = Γ_put.
- Delta does not match. The call delta and the put delta differ by e^{−qT}. See [delta](https://quantcore-labs.com/glossary/delta/).
- The [Greeks calculator](https://quantcore-labs.com/option-greeks-calc/) reports this gamma for both sides.

## Pitfalls

- **It blows up as expiry approaches** for an option sitting on the strike, because of the √T in the denominator, and it goes to 0 for an option far from the strike. A gamma number with no spot, strike and expiry attached is not interpretable.
- **P&L is not gamma times the move.** The second-order Taylor term is ½ Γ (ΔS)², and it is a model term. Realised moves, hedges and vega P&L are all still there.
- **Spot gamma.** As with delta, this differentiates with respect to spot and includes e^{−qT}. Divide by that discount if you wanted a forward gamma and you meant to.

## Python reference implementation

Requires scipy. Tested before publication and re-executed with assertions on every rebuild. MIT licensed. Raw file: https://quantcore-labs.com/glossary/gamma/gamma.py

```python
from math import exp, log, sqrt
from scipy.stats import norm

def bs_gamma(S, K, T, r, sigma, q=0.0) -> float:
    """Black-Scholes-Merton gamma. Identical for the European call and put."""
    if S <= 0 or K <= 0 or T <= 0 or sigma <= 0:
        raise ValueError("S, K, T and sigma must be positive")
    d1 = (log(S / K) + (r - q + 0.5 * sigma * sigma) * T) / (sigma * sqrt(T))
    return float(exp(-q * T) * norm.pdf(d1) / (S * sigma * sqrt(T)))
```

## FAQ

**Why does gamma not depend on whether the option is a call or a put?**

Call minus put is a forward under put-call parity, and a forward's second derivative with respect to spot is zero. Whatever curvature the call has, the put has the same curvature.

**Is a high gamma good?**

It means delta will move quickly if the spot moves, which is a property of that contract in this model. Long gamma and short gamma describe a position. The page does not score either as an advantage.

## Use it in a calculator

- [Black-Scholes Option Greeks](https://quantcore-labs.com/option-greeks-calc/)

## Related

- [Delta](https://quantcore-labs.com/glossary/delta/)
- [Theta](https://quantcore-labs.com/glossary/theta/)
- [Vega](https://quantcore-labs.com/glossary/vega/)

