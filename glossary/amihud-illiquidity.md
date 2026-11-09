# Amihud Illiquidity Measure (ILLIQ)

> The average absolute return per unit of traded value: how much the price moves for each yuan or dollar traded. It is a low-frequency price-impact proxy and a widely used liquidity factor.
> URL: https://quantcore-labs.com/glossary/amihud-illiquidity/

Category: Execution & Market Microstructure. Term ID: `amihud-illiquidity`.

## Definition

Amihud (2002) illiquidity is the average, over a window of days, of the absolute daily return divided by the day's traded value. A high value means small amounts of trading move the price a lot. It needs only daily returns and turnover, so it can be computed for every stock over long histories. That makes it the standard low-frequency liquidity measure in asset-pricing research.

## Formula

```
ILLIQ_{i,T} = (1 / D_{i,T}) · Σ_{d ∈ T} |r_{i,d}| / VOLD_{i,d}  × scale

r_{i,d}    : daily return of stock i
VOLD_{i,d} : traded value that day (A-shares: 成交额 in yuan, not 成交量 in shares)
D_{i,T}    : number of valid trading days in window T (zero-turnover days excluded)
scale      : e.g. 10⁸ → |return| per 100 million yuan traded
```

## Institutional usage

- **Liquidity factor.** Illiquid stocks earn a return premium in many markets, and Amihud ILLIQ is the usual sort variable. It is a common factor in A-share multi-factor models, often in log form.
- **Capacity and cost estimates.** ILLIQ times the planned trade size gives a rough expected price move. This is used to cap position sizes in small-cap strategies.
- **Universe filters.** Excluding the most illiquid decile before backtesting avoids returns that could never be captured at scale.

## Pitfalls

- **Use value, not volume.** Dividing by share volume makes a ¥5 stock look far more liquid than a ¥500 stock with the same yuan turnover.
- **Suspensions.** Zero-turnover days give infinite ratios. The code drops them and requires a minimum number of valid days.
- **Price-limit days.** A stock that is locked at limit-up shows about a 10% move on tiny turnover, which creates extreme ILLIQ values. Winsorise, or exclude limit-locked days, and note that ChiNext and STAR moved to ±20% limits, so mixed-regime histories are not directly comparable.
- **Skew.** The cross-section spans several orders of magnitude. Use log(ILLIQ) or ranks in regressions and factor models.
- **Size proxy.** ILLIQ is strongly correlated with market cap. Neutralise against size before claiming a separate liquidity effect.

## Python reference implementation

Requires numpy, pandas. Tested before publication and re-executed with assertions on every rebuild. MIT licensed. Raw file: https://quantcore-labs.com/glossary/amihud-illiquidity/amihud-illiquidity.py

```python
import numpy as np
import pandas as pd

def amihud(ret: pd.DataFrame, amount: pd.DataFrame, window: int = 20,
           min_days: int = 15, scale: float = 1e8) -> pd.DataFrame:
    """Rolling Amihud illiquidity, dates x stocks, fully vectorised.
    ILLIQ = mean(|r_t| / amount_t) * scale over the window.
    amount: traded value in currency (A-shares: yuan turnover, 成交额), so with
    scale=1e8 the result reads as |return| per 100 million yuan traded.
    Zero-amount days (suspensions) are excluded rather than producing inf."""
    a = amount.where(amount > 0)
    daily = ret.abs() / a
    return daily.rolling(window, min_periods=min_days).mean() * scale

def amihud_monthly(ret: pd.DataFrame, amount: pd.DataFrame, scale: float = 1e8) -> pd.DataFrame:
    """Original Amihud (2002) style: average within each calendar month."""
    daily = ret.abs() / amount.where(amount > 0)
    return daily.groupby(daily.index.to_period("M")).mean() * scale
```

## FAQ

**Why take the log of Amihud illiquidity?**

Raw ILLIQ is extremely right-skewed: the most illiquid stocks can be thousands of times the median. Log or rank transforms keep a few outliers from dominating regressions, factor portfolios and IC calculations.

**Monthly or rolling window?**

The original paper averages within each calendar month or year. A rolling 20-day window updates daily and suits trading signals; use at least 15 valid days so suspensions do not produce noisy values.

## Related

- [Volume-Weighted Average Price (VWAP)](https://quantcore-labs.com/glossary/vwap/)
- [Information Coefficient (IC)](https://quantcore-labs.com/glossary/information-coefficient/)
- [Query Tick Data in Parquet with DuckDB](https://quantcore-labs.com/code/duckdb-parquet-ticks/)

