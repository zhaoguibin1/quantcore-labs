# Black-Scholes Option Greeks Calculator

> Client-side Black-Scholes-Merton pricer for European options with continuous dividend yield.
> URL: https://quantcore-labs.com/option-greeks-calc/

## Inputs

- S: spot price (> 0)
- K: strike (> 0)
- T: days to expiry, converted as days / 365
- σ: annualised volatility, %
- r: continuously compounded risk-free rate, %
- q: continuous dividend yield, %
- r can be filled in one click from the U.S. Treasury par yield curve (published daily), interpolated to the option expiry and converted to continuous compounding

## Formulas

```
d1 = [ln(S/K) + (r − q + σ²/2)T] / (σ√T)
d2 = d1 − σ√T
C  = S e^(−qT) N(d1) − K e^(−rT) N(d2)
P  = K e^(−rT) N(−d2) − S e^(−qT) N(−d1)
Δc = e^(−qT) N(d1)          Δp = −e^(−qT) N(−d1)
Γ  = e^(−qT) φ(d1) / (S σ √T)
ν  = S e^(−qT) φ(d1) √T / 100
Θc = [−S e^(−qT) φ(d1) σ/(2√T) − rK e^(−rT) N(d2)  + qS e^(−qT) N(d1)]  / 365
Θp = [−S e^(−qT) φ(d1) σ/(2√T) + rK e^(−rT) N(−d2) − qS e^(−qT) N(−d1)] / 365
ρc = K T e^(−rT) N(d2) / 100   ρp = −K T e^(−rT) N(−d2) / 100
```

N(·): Hart (1968) double-precision rational approximation per West (2005), |error| < 1e−14.
At T = 0 or σ = 0 the tool returns the deterministic limit (discounted forward intrinsic; Γ = ν = 0).

## Units

- Vega: per 1 volatility point
- Theta: per calendar day (multiply by 365/252 for trading-day theta)
- Rho: per 1 percentage point in r

## Reference values (S=100, K=100, T=1y, σ=20%, r=5%, q=0)

| Metric | Call | Put |
|---|---|---|
| Price | 10.4506 | 5.5735 |
| Delta | 0.6368 | −0.3632 |
| Gamma | 0.01876 | 0.01876 |
| Vega | 0.3752 | 0.3752 |
| Theta/day | −0.01757 | −0.00454 |
| Rho | 0.5323 | −0.4189 |

## FAQ

- **Theta per day or year?** Per calendar day (annual / 365).
- **Vega scaling?** Price change per 1 vol point (dV/dσ / 100).
- **American or A-share ETF options?** BSM is European-only. Chinese exchange-listed ETF options (SSE 50 ETF, CSI 300 ETF) are European-style, so BSM is the reference model; American options with dividends need a tree or PDE solver.
- **CDF accuracy?** Hart/West, |error| < 1e−14.

## Limitations

- European exercise only; constant σ and r; no discrete dividends.
- Educational and analytical use only; not investment advice.
