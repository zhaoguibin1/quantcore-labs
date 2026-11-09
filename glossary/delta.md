# Delta

> The derivative of a European option's Black-Scholes-Merton value with respect to the spot. A call delta is e^{−qT} N(d1). A put delta is that quantity minus e^{−qT}.
> URL: https://quantcore-labs.com/glossary/delta/

Category: Options & Derivatives. Term ID: `delta`.

## Definition

Delta is how much the model value changes for a small move in the underlying, holding the other inputs fixed. In Black-Scholes-Merton it is a closed form. For a call it lies between 0 and e^{−qT}; for a put it lies between −e^{−qT} and 0. With no dividend yield those bounds are 0 and 1, and −1 and 0. The figure is a model sensitivity. Hedging with it leaves everything the model left out, including jumps and the fact that volatility is not a constant.

## Formula

```
d1 = [ln(S/K) + (r − q + σ²/2) T] / (σ √T)

Δ_call = e^{−qT} N(d1)
Δ_put  = e^{−qT} (N(d1) − 1) = −e^{−qT} N(−d1)

Δ_call − Δ_put = e^{−qT}

q = 0 is the no-dividend textbook case: Δ_call = N(d1), Δ_put = N(d1) − 1.
The on-site calculator uses the same expressions, including q.
```

## How to read the number

- A call delta of 0.50 is not automatically at-the-money once rates or dividends are nonzero. It is the model slope at those inputs. N(d1) equals a half when d1 is zero, which is not the same as S = K.
- Delta of a position is the sum of signed deltas times the multiplier. The function returns the per-unit derivative, not a share count for a book.
- The slope changes as spot moves. That second derivative is [gamma](https://quantcore-labs.com/glossary/gamma/). The slope also depends on the volatility you typed in, which is where [implied volatility](https://quantcore-labs.com/glossary/implied-volatility/) enters.

## Pitfalls

- **European Black-Scholes-Merton only.** American puts, barriers and anything path dependent do not have this delta. At expiry the slope becomes a step. The [Greeks calculator](https://quantcore-labs.com/option-greeks-calc/) spells out that limit; this function requires T > 0 and σ > 0 so the formula stays the smooth one.
- **Spot delta versus forward delta.** The derivative here is with respect to spot, and it includes the dividend discount e^{−qT}. A forward delta omits that discount. Mixing them mis-hedges by that factor.
- **A hedge ratio is not a hedge result.** Replacing the option with −Δ shares cancels the first-order spot term in this model, at this instant. Gamma, vega and discrete rebalancing remain.

## Python reference implementation

Requires scipy. Tested before publication and re-executed with assertions on every rebuild. MIT licensed. Raw file: https://quantcore-labs.com/glossary/delta/delta.py

```python
from math import exp, log, sqrt
from scipy.stats import norm

def bs_delta(S, K, T, r, sigma, call=True, q=0.0) -> float:
    """Black-Scholes-Merton spot delta. call=False returns the put delta.

    Requires positive S, K, T and sigma. q is a continuous dividend yield.
    """
    if S <= 0 or K <= 0 or T <= 0 or sigma <= 0:
        raise ValueError("S, K, T and sigma must be positive")
    d1 = (log(S / K) + (r - q + 0.5 * sigma * sigma) * T) / (sigma * sqrt(T))
    disc = exp(-q * T)
    return float(disc * norm.cdf(d1) if call else disc * (norm.cdf(d1) - 1.0))
```

## FAQ

**Why is call delta not exactly N(d1)?**

N(d1) is the no-dividend formula. With a continuous yield q the spot delta of a European call is e^{−qT} N(d1). The two agree when q is 0, which is the default of this function.

**Does delta tell me the probability the option finishes in the money?**

No. Under the stock-numeraire measure, N(d1) is a probability related to the share, and N(d2) is the risk-neutral probability that a European call finishes in the money, in this model, with no dividends changing that statement. Neither one is a real-world probability, and neither one is a trading instruction.

## Related

- [Gamma](https://quantcore-labs.com/glossary/gamma/)
- [Vega](https://quantcore-labs.com/glossary/vega/)
- [Implied Volatility](https://quantcore-labs.com/glossary/implied-volatility/)
- [Put-Call Parity](https://quantcore-labs.com/glossary/put-call-parity/)

