# Implied Volatility Smile & Skew Calculator

> Client-side implied volatility solver and smile plotter for European options across strikes and expiries.
> URL: https://quantcore-labs.com/tools/iv-smile/

## Input

- Rows of `days,strike,call,put` (comma, tab or semicolon). Either price may be blank or `-`.
- Spot S, rate r and dividend yield q in % p.a. These are used only when the forward cannot be inferred from put-call parity.
- Option: infer the forward from put-call parity (default on).

## Method

```
Black-76, D = e^(-rT), T = days/365
C = D [F N(d1) - K N(d2)],  P = D [K N(-d2) - F N(-d1)]
d1 = [ln(F/K) + s^2 T/2] / (s sqrt T),  d2 = d1 - s sqrt T

Forward from parity at K* = argmin |C - P|:  F = K* + (C - P)/D
Bounds: D max(F-K,0) < C < D F,   D max(K-F,0) < P < D K

Solver: Newton on s with vega; bracket [1e-6, 10] tightened by the sign of the error;
bisection whenever Newton leaves the bracket or vega < 1e-12; tol 1e-12

Smile per expiry: k = ln(K/F), OTM IV (puts K<F, calls K>=F)
IV(k) ~ a + b k + c k^2 (least squares): ATM IV = a, skew = b, curvature = c
```

## Output

- Call IV, put IV and OTM composite IV per strike; prices outside the bounds are flagged
- Per expiry: forward and its source, ATM IV, skew, curvature, number of valid points
- Charts: smile per expiry vs ln(K/F) or strike, with fitted curves; ATM IV term structure

## Validation

- Round-trip over 466 grid cases covers T from 1 day to 3 years, K/F from 0.5 to 2, and sigma from 3% to 250%. All 466 converge, the price error is at most 1e-12, and no case needs more than 22 iterations.
- Against SciPy brentq on 300 random cases, the maximum IV difference is 7.6e-7. Both differences come from near-zero-vega cases, where the solver here is closer to the true sigma.
- A synthetic smile with a hidden 1% dividend yield is recovered exactly: forward, ATM IV, skew and curvature.

## FAQ

- **Why OTM options?** They are almost pure time value, so their IV is less sensitive to forward and quote errors.
- **Why not plain Newton?** Vega vanishes for deep ITM/OTM and short expiries; the safeguarded solver always converges inside the bounds.
- **China 50ETF/300ETF options?** European-style; use mid prices and parity-inferred forward.
- **Skew meaning?** dIV/dk at the money; -0.30 means about +3 vol points at a strike 10% below the forward.

## Limitations

- European exercise only; American options need a tree or PDE pricer.
- Uses a single discount rate per expiry; no bid/ask weighting in the fit.
- Educational and analytical use only; not investment advice.
