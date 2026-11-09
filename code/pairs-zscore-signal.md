# Rolling Hedge Ratio and Spread Z-Score

> A rolling OLS hedge ratio between two price series, the spread y − βx, and a rolling z-score of that spread. The z-score uses a second window on an already rolling spread, so it is defined later than β. Illustrative only; not a trading signal.
> URL: https://quantcore-labs.com/code/pairs-zscore-signal/

Category: Time Series & Stat-Arb. Snippet ID: `pairs-zscore-signal`.

## What it does

The hedge ratio at each date is the slope of y on x over the trailing window, cov(y, x) / var(x). The spread is the residual of that slope with no intercept, y − βx. Its z-score subtracts a trailing mean and divides by a trailing sample standard deviation, both taken over the same window length. A large absolute z-score means the spread is far from its recent average. That is a description of the series, not a recommendation to trade it.

## Approach

```
β_t     = Cov_w(y, x)_t / Var_w(x)_t          (pandas sample cov and var, ddof = 1)
spread_t = y_t − β_t x_t
z_t      = (spread_t − mean_w(spread)_t) / std_w(spread)_t

β_t is defined once `window` observations exist.
z_t needs a further `window` finite spreads, so it starts about 2·window observations in.
std = 0 → z is missing, not infinite.
```

## How it sits next to cointegration

- A hedge ratio is only interesting as a mean-reverting spread if the series are [cointegrated](https://quantcore-labs.com/glossary/cointegration/), or at least if the spread rejects a unit root. See the [ADF](https://quantcore-labs.com/glossary/adf-test/) page.
- The [half-life](https://quantcore-labs.com/glossary/half-life-mean-reversion/) of the spread is the usual way to choose the window that standardises z, rather than picking 60 because it is round.
- The same rolling slope, compiled and re-centred, is `rolling_beta` in [rolling-window-numba](https://quantcore-labs.com/code/rolling-window-numba/).

## Pitfalls

- **No intercept.** The spread is y − βx, not y − a − βx. If the two prices differ by a level, that level sits inside the spread and the z-score spends a long time absorbing it. Engle-Granger includes an intercept.
- **Nested windows.** z_t standardises a spread that already used a window to estimate β. Early z values are noisier than a z-score of a fixed-β residual.
- **Look-ahead is not in the formulas, but it is easy to add.** β_t uses prices through t. A position decided from z_t must not trade at the close of t. Lag the position by at least one bar, as on the Polars backtest page.
- **Not a signal to trade.** A z-score of 2 is two recent standard deviations. It is not an expected return and it is not a suggestion to buy or sell the spread.

## Python reference implementation

Requires pandas. Tested before publication and re-executed with assertions on every rebuild. MIT licensed. Raw file: https://quantcore-labs.com/code/pairs-zscore-signal/pairs-zscore-signal.py

```python
import pandas as pd

def pair_zscore(y: pd.Series, x: pd.Series, window: int = 60) -> pd.DataFrame:
    """Rolling slope of y on x, the residual spread, and its rolling z-score.

    Sample covariance and variance (ddof=1), so the ratio matches OLS with an
    intercept-free slope. Illustrative only; not a trading signal.
    """
    if window < 2:
        raise ValueError("window must be at least 2")
    y, x = y.align(x, join="inner")
    beta = y.rolling(window).cov(x) / x.rolling(window).var()
    spread = y - beta * x
    sd = spread.rolling(window).std()
    z = (spread - spread.rolling(window).mean()) / sd.where(sd > 0)
    return pd.DataFrame({"beta": beta, "spread": spread, "zscore": z})
```

## FAQ

**Why does the z-score start so late?**

The slope needs `window` rows, and the mean and standard deviation of the spread need another `window` finite spreads. With a window of 60 the z-score becomes available about 120 rows in, not 60.

**Can I trade the sign of the z-score?**

This function only standardises a spread. Whether the spread mean-reverts, whether both legs can be traded, and what it costs are separate questions. The output is not an order.

## Related

- [Cointegration (Engle-Granger & Johansen)](https://quantcore-labs.com/glossary/cointegration/)
- [Half-Life of Mean Reversion](https://quantcore-labs.com/glossary/half-life-mean-reversion/)
- [Augmented Dickey-Fuller (ADF) Test](https://quantcore-labs.com/glossary/adf-test/)
- [Fast Rolling Mean, Std, Beta and Z-score with Numba](https://quantcore-labs.com/code/rolling-window-numba/)

