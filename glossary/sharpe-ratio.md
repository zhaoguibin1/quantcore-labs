# Sharpe Ratio

> Mean excess return divided by the standard deviation of excess return, annualised by the square root of the number of periods per year. The same definition as the performance calculator on this site.
> URL: https://quantcore-labs.com/glossary/sharpe-ratio/

Category: Performance & Risk Metrics. Term ID: `sharpe-ratio`.

## Definition

The Sharpe ratio asks how much excess return a series delivered per unit of volatility. Excess is the periodic return minus a periodic risk-free rate. The rate used here is an annual rate converted by compound interest, (1 + r_f)^(1/P) − 1, not a simple r_f/P. Volatility is the sample standard deviation (divide by n − 1). Annualisation multiplies by sqrt(P). A higher number means more excess return per unit of variability in that sample. It is not a forecast and it is not a certificate of skill.

## Formula

```
r_f,period = (1 + r_f,annual) ^ (1/P) − 1
excess_t   = R_t − r_f,period

Sharpe = mean(excess) / std(excess, ddof=1) · sqrt(P)

P = 252 by default, 242 for China A-shares, 365 for a crypto-style calendar.
std = 0 → the ratio is undefined (returned as NaN).
```

## Conventions that change the number

- The [performance calculator](https://quantcore-labs.com/tools/performance-analytics/) uses this compounding convention, sample standard deviation, and the same sqrt(P) annualisation. The glossary function is written to match it.
- Some published Sharpes subtract r_f/P, or divide by the population standard deviation, or leave the ratio un-annualised. Those are different statistics. Quote P and the risk-free treatment next to the number.
- Downside-only volatility is the [Sortino ratio](https://quantcore-labs.com/glossary/sortino-ratio/). Active return over tracking error is the [information ratio](https://quantcore-labs.com/glossary/information-ratio/).

## Pitfalls

- **It is a sample moment.** A short window, or a window that happens to contain one regime, moves the ratio a lot. It does not carry a promise about the next window.
- **Volatility is not the risk you may care about.** Two series with the same Sharpe can have very different [drawdowns](https://quantcore-labs.com/glossary/max-drawdown/) and tail losses. See also [VaR and expected shortfall](https://quantcore-labs.com/glossary/var-expected-shortfall/).
- **Illiquid and smoothed returns look better.** A series that only updates occasionally understates standard deviation and overstates Sharpe. The same is true of a backtest that ignores costs.
- **Annualising assumes i.i.d. periods.** Strong autocorrelation makes sqrt(P) the wrong scaling. The function still multiplies by sqrt(P); the assumption is yours to check.

## Python reference implementation

Requires numpy. Tested before publication and re-executed with assertions on every rebuild. MIT licensed. Raw file: https://quantcore-labs.com/glossary/sharpe-ratio/sharpe-ratio.py

```python
import numpy as np

def sharpe_ratio(returns, rf_annual=0.0, periods=252) -> float:
    """Annualised Sharpe ratio.

    rf_annual is compounded to a per-period rate: (1 + rf_annual) ** (1/periods) - 1.
    Volatility is the sample standard deviation of excess returns. Zero volatility
    returns NaN. This matches /tools/performance-analytics/.
    """
    r = np.asarray(returns, dtype=float)
    r = r[np.isfinite(r)]
    if r.size < 2:
        raise ValueError("need at least two finite returns")
    if periods <= 0:
        raise ValueError("periods must be positive")
    rf = (1.0 + rf_annual) ** (1.0 / periods) - 1.0
    excess = r - rf
    sd = float(excess.std(ddof=1))
    if sd == 0.0:
        return float("nan")
    return float(excess.mean() / sd * np.sqrt(periods))
```

## FAQ

**Why compound the risk-free rate instead of dividing by 252?**

An annual rate of 2 percent is not 2/252 per day under compound interest. The per-period rate that compounds back to 2 percent is (1.02)^(1/252) − 1, which is slightly less than 2/252. The difference is small at low rates and is the convention the performance calculator on this site uses.

**Is a Sharpe ratio of 1 good?**

It means the sample's mean excess return equalled its annualised volatility. Whether that is attractive depends on the sample, the costs that were left out, and the drawdowns. The ratio is not a threshold for taking a position.

## Related

- [Sortino Ratio](https://quantcore-labs.com/glossary/sortino-ratio/)
- [Information Ratio](https://quantcore-labs.com/glossary/information-ratio/)
- [Maximum Drawdown](https://quantcore-labs.com/glossary/max-drawdown/)
- [Value at Risk (VaR) and Expected Shortfall (ES)](https://quantcore-labs.com/glossary/var-expected-shortfall/)

