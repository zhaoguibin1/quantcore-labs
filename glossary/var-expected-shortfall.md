# Value at Risk (VaR) and Expected Shortfall (ES)

> VaR is the loss threshold that is exceeded only with a given small probability. Expected Shortfall is the average loss in that tail. Both are standard risk limits; ES is what Basel FRTB uses for market risk capital.
> URL: https://quantcore-labs.com/glossary/var-expected-shortfall/

Category: Risk Management. Term ID: `var-expected-shortfall`.

## Definition

Value at Risk at confidence level α is the loss that is not exceeded with probability α over a given horizon. Expected Shortfall (also called CVaR) is the average loss given that the loss exceeds VaR. ES therefore accounts for how bad the tail is, not only where it starts. Unlike VaR, it is a coherent risk measure (subadditive).

## Formula

```
VaR_α = −q_{1−α}(r)                         (q = quantile of returns)
ES_α  = −E[ r | r ≤ q_{1−α}(r) ]

Normal:          VaR = −(μ + σ·z),   ES = −(μ − σ·φ(z)/(1−α)),   z = Φ⁻¹(1−α)
Cornish-Fisher:  z_cf = z + (z²−1)S/6 + (z³−3z)K/24 − (2z³−5z)S²/36
                 (S = skewness, K = excess kurtosis)

Kupiec POF backtest (x exceptions in n days, p = 1−α, p̂ = x/n):
  LR = −2·ln[ (1−p)^{n−x} p^x / ((1−p̂)^{n−x} p̂^x) ]  ~ χ²(1)
```

## Institutional usage

- **Risk limits and reporting.** Daily 99% VaR is the classic desk limit. Basel FRTB replaced it with 97.5% ES for market-risk capital because ES captures tail severity.
- **Backtesting.** Regulators and risk teams count VaR exceptions and run the Kupiec test. Too many exceptions mean the model understates risk.
- **Strategy evaluation.** Historical VaR and ES of a backtest's daily returns are reported alongside Sharpe and max drawdown. The [performance calculator](https://quantcore-labs.com/tools/performance-analytics/) computes them from a pasted equity curve.

## Pitfalls

- **Normal VaR understates fat tails.** On simulated Student-t (4 degrees of freedom) returns, 99% normal VaR is 3.26% against a historical 3.75%, and normal ES misses by even more (3.74% against 5.12%).
- **Cornish-Fisher can overshoot.** The expansion is only valid for moderate skew and kurtosis. On the same t(4) sample it gives 6.03%, far above the true quantile. Prefer historical or filtered-historical methods for heavy tails.
- **Sample size.** A 99% historical VaR from 250 days rests on about 2.5 observations. Use longer windows, or 97.5% ES, which averages more points.
- **√h scaling.** Multiplying 1-day VaR by √10 assumes i.i.d. returns. Volatility clustering and autocorrelation break it.
- **A-share price limits.** The ±10% daily limit (±20% on ChiNext and STAR, ±5% for ST) truncates observed daily losses. Consecutive limit-down days then produce multi-day losses far beyond the 1-day historical VaR.

## Python reference implementation

Requires numpy, scipy. Tested before publication and re-executed with assertions on every rebuild. MIT licensed. Raw file: https://quantcore-labs.com/glossary/var-expected-shortfall/var-expected-shortfall.py

```python
import numpy as np
from scipy.stats import norm, chi2

def var_es(returns, alpha: float = 0.99, method: str = "historical") -> tuple:
    """One-period VaR and Expected Shortfall as positive loss fractions.
    method: "historical" | "normal" | "cornish-fisher" (skew/kurtosis-adjusted
    quantile; returns ES = nan because the expansion defines no tail mean)."""
    r = np.asarray(returns, dtype=float)
    r = r[~np.isnan(r)]
    if method == "historical":
        q = np.quantile(r, 1 - alpha)
        return -q, -r[r <= q].mean()
    mu, sd = r.mean(), r.std(ddof=1)
    z = norm.ppf(1 - alpha)
    if method == "normal":
        return -(mu + sd * z), -(mu - sd * norm.pdf(z) / (1 - alpha))
    if method == "cornish-fisher":
        # VaR only: CF adjusts the quantile, it does not define a tail mean.
        x = (r - mu) / sd
        s, k = np.mean(x ** 3), np.mean(x ** 4) - 3
        zc = z + (z**2 - 1) * s / 6 + (z**3 - 3*z) * k / 24 - (2*z**3 - 5*z) * s**2 / 36
        return -(mu + sd * zc), float("nan")
    raise ValueError(method)

def kupiec_pof(returns, var_series, alpha: float = 0.99) -> dict:
    """Kupiec proportion-of-failures backtest. var_series: forecast VaR (positive)
    made BEFORE each return. H0: exception rate = 1 - alpha."""
    r, v = np.asarray(returns, float), np.asarray(var_series, float)
    n, x, p = len(r), int((r < -v).sum()), 1 - alpha
    ph = x / n
    ll0 = (n - x) * np.log(1 - p) + x * np.log(p)
    ll1 = (0.0 if x == n else (n - x) * np.log(1 - ph)) + (0.0 if x == 0 else x * np.log(ph))
    lr = -2 * (ll0 - ll1)
    return {"n": n, "exceptions": x, "expected": n * p, "lr": lr, "pvalue": 1 - chi2.cdf(lr, 1)}
```

## FAQ

**Should I use 95%, 99% or 97.5%?**

99% one-day VaR is the traditional trading-desk limit and Basel VaR standard; 97.5% ES is the Basel FRTB standard and is roughly comparable in level to 99% VaR under normality while being more stable to estimate. 95% is common for strategy reporting because it has more tail observations.

**Why is Expected Shortfall preferred to VaR?**

VaR says nothing about losses beyond the threshold and is not subadditive, so combining two portfolios can show higher VaR than the sum of their VaRs. ES averages the whole tail and is coherent, which makes it better for limits and capital allocation.

## Related

- [Information Coefficient (IC)](https://quantcore-labs.com/glossary/information-coefficient/)
- [Vectorised Daily Backtest with A-share Trading Constraints](https://quantcore-labs.com/code/vectorized-backtest/)

