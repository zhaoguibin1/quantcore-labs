# Portfolio Style Exposure Analyzer

> Client-side, holdings-based style analysis. Each characteristic becomes a 0-100 percentile inside the pasted universe; the portfolio's exposure is the weighted mean percentile of its holdings, reported raw and size-adjusted.
> URL: https://quantcore-labs.com/tools/style-exposure/

## Inputs

- A header row, then one row per asset: `[date,] asset, weight, characteristic, ...`; comma, tab, semicolon or spaces
- The first column is a date only when its header is `date`, `dt`, `trade_date` or `day`; otherwise the paste is one snapshot
- Weight above 0 marks a holding; 0, blank or negative means the asset is in the universe but not held
- Any number of numeric characteristic columns (book-to-price, ROE, volatility, turnover, market cap, ...); blanks and `nan` are missing values
- Size column (optional; `size`, `mcap`, `market_cap`, `float_mcap`, `log_mcap` are pre-selected), size buckets 5 or 10
- Holdings weighting: by weight or equal weight; minimum universe per date (default 50)

## Formulas

```
p_i,t        = (rank x_i,t - 0.5) / n_t * 100        average ranks for ties; n_t = assets with a value on date t
Exposure_t   = sum_i w_i,t p_i,t / sum_i w_i,t       over holdings (w > 0) with a value; 50 = same as the universe
bucket_i,t   = min(B - 1, floor(B (rank size_i,t - 0.5) / N_t))      B equal-count size buckets
p_adj_i,t    = percentile of x_i,t among assets in the same size bucket (needs >= 20 values in the bucket)
Exposure_adj = sum_i w_i,t p_adj_i,t / sum_i w_i,t
Coverage_t   = weight of holdings with a value / weight of all holdings
Summary      = plain average of Exposure_t across dates
```

A date is used only if the universe has at least the minimum number of assets and at least three holdings. Size adjustment needs 20 assets per bucket, so 200 assets with a size value for ten buckets. If an asset repeats on a date the last row wins. Dates are sorted when all of them parse.

Tilt labels: 60 or more clearly high, 54 or more high, 46 or less low, 40 or less clearly low, otherwise near universe.

## Outputs

Per characteristic: raw exposure, size-adjusted exposure, share of dates above 50, coverage and a tilt label; a bar chart of exposures around 50; exposure through time for a chosen characteristic when there is more than one date. Also dates used and skipped, average holdings and universe size.

## Reference check

On a test table of 3 dates x 260 assets with tied values, missing values and unequal weights, raw, size-adjusted and equal-weighted exposures and coverage match a pandas implementation (`rank(method="average")`, group-wise ranking inside size deciles) with relative difference below 1e-12. A synthetic check confirms that a pure small-cap portfolio shows a strong raw tilt on a size-correlated characteristic and about 50 after size adjustment. The computation lives in https://quantcore-labs.com/tools/style-exposure/style-exposure-core.mjs and is covered by automated tests.

## How to read it

- Read the size-adjusted column first. A tilt that is strong raw and near 50 adjusted is a size bet, not selection on that characteristic.
- Exposure is not return. A high percentile on book-to-price says the holdings are cheap, not that cheapness paid; that needs a returns-based attribution.
- Unintended tilts are the useful finding, for example low margins and high leverage as a side effect of screening on cheapness.
- Check coverage, and prefer tilts that keep their sign on every date.

## FAQ

- **What does 50 mean?** The holdings look like the universe on that characteristic; the universe averages 50 by construction.
- **Why raw and size-adjusted?** Many characteristics move with company size; ranking inside size buckets removes that mechanical part.
- **What should the universe be?** The assets the portfolio could have held on that date, with the strategy's own filters.
- **Which direction is high?** A higher column value is a higher percentile; flip the sign of a column to flip the reading.
- **Is data uploaded?** No; all computation runs in the browser.

## Limitations

- Size is the only control variable; there is no industry adjustment. Paste industry-demeaned characteristics if you need it.
- Percentiles describe rank, not magnitude, so two very different distributions can give the same exposure.
- Holdings-based: it describes what was held on the pasted dates and says nothing about trading in between.
- Educational and analytical use only; not investment advice.
