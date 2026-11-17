# Factor IC Analyzer

> Client-side analyzer for rank IC, Pearson IC, ICIR, t-stat, hit rate, quantile-group forward returns and the top-minus-bottom spread from a pasted factor panel.
> URL: https://quantcore-labs.com/tools/factor-ic/

## Inputs

- Rows of `date, asset, factor, forward return`, one row per asset per date; comma, tab, semicolon or spaces; header row optional
- Forward returns in decimal or percent
- Minimum assets per date (default 20); dates below it are skipped and counted
- Quantile groups: 3, 5 or 10
- Horizon h: holding period measured in sampling periods (use 1 when dates are already h periods apart)
- Periods per year: 252, 242 (A-share), 52, 12; used only to annualise the spread

The forward return on a row must be earned after the factor value was known. For a signal at the close of t, traded at t+1 and held h periods: `r = close(t+1+h) / close(t+1) - 1`.

## Formulas

```
IC_t        = corr(f_i,t , r_i,t->t+h)              across assets i on date t (Pearson)
Rank IC_t   = corr(rank f_i,t , rank r_i,t->t+h)    average ranks for ties (Spearman)
Mean IC     = (1/n) sum_t IC_t                      n = dates used
ICIR        = mean(IC) / stdev(IC, ddof=1)
t-stat      = ICIR * sqrt(n / h)
Hit rate    = share of dates with IC_t > 0
bucket_i,t  = min(Q - 1, floor(Q * (rank f_i,t - 0.5) / N_t))    N_t = assets on date t
G_q         = mean over dates of the equal-weighted return of bucket q
Spread_t    = G_Q,t - G_1,t
Annualised spread = mean(Spread) * P / h
Monotonicity = Spearman correlation between q and G_q
```

A date is used only if it has at least max(min assets, Q) assets with both values. If an asset repeats on a date the last row wins. Dates are sorted when all of them parse (YYYY-MM-DD, YYYY/MM/DD or YYYYMMDD); otherwise input order is kept and the per-year table is hidden. A date on which the factor or the return is constant has no defined IC and is skipped.

## Outputs

Mean rank IC, rank IC standard deviation, ICIR, t-stat, hit rate, minimum and maximum; the same for Pearson IC; mean forward return of each quantile group; top-minus-bottom spread per period with its t-stat, hit rate and simple annualisation; monotonicity; dates used and skipped; average assets per date. Charts: rank IC per date with a rolling mean (6, 12, 24 or 60 dates), cumulative rank IC, quantile-group bars. Rank IC by calendar year when dates parse.

## Reference check

On a test panel of 8 dates x 25 assets with tied factor values, per-date rank IC, Pearson IC, quantile-group means, ICIR and t-stat match pandas `rank(method="average")` and SciPy `spearmanr` / `pearsonr` with relative difference below 1e-12. The computation lives in a separate module, https://quantcore-labs.com/tools/factor-ic/factor-ic-core.mjs, and is covered by automated tests.

## How to read it

- Judge level and stability together: ICIR, hit rate and the per-year table matter more than the mean alone.
- The t-stat assumes roughly independent dates after the n / h correction, and it does not correct for having tried many factors on the same history.
- Quantile returns should be close to monotonic; an IC driven by one extreme bucket suggests outliers or a non-linear factor.
- The spread is before turnover, trading costs, price limits and capacity; the short leg is often not tradable.
- A raw IC can be a size or industry bet. Neutralise the factor first to isolate stock selection.

## FAQ

- **What is a good IC?** No universal threshold; a few hundredths with a stable sign is already useful for broad cross-sections. Stability matters more than level.
- **Why rank IC?** Spearman correlation is robust to outliers. A large gap to Pearson IC usually means outliers drive the linear correlation.
- **Why divide by sqrt(h)?** Overlapping h-period returns make consecutive ICs dependent; n / h is a simple effective sample size.
- **How are groups formed?** Average ranks, bucket = floor(Q (rank - 0.5) / N); ties share a bucket; equal weight within a bucket.
- **Is data uploaded?** No; all computation runs in the browser.

## Limitations

- One forward-return column per paste, so IC decay across horizons needs one paste per horizon.
- No neutralisation, winsorisation or weighting inside the tool; prepare the factor before pasting.
- Annualised spread is a linear scaling, not a backtest.
- Educational and analytical use only; not investment advice.
