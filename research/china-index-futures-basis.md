# China Index Futures Basis: A Ten-Year Study

> What a long futures position in each CFFEX equity index future (IF, IH, IC, IM), rolled every quarter, earned against the CSI total-return index from 2015 to 2026.
> URL: https://quantcore-labs.com/research/china-index-futures-basis/

## Key findings

1. IC: a rolled long returned +10.3% a year from 2015-04-17 to 2026-11-16 while the CSI 500 total-return index returned -0.7%; gap 11.0 percentage points a year, before interest on cash not used for margin.
2. The IC gap averaged +14.1% a year in 2016-2020 and +6.1% in 2021-2025, with +0.8 to +4.0 points a year in 2022-2024 and +11.8% in 2025. IM (from July 2022): +8.8% a year.
3. IF (+3.3% a year) and IH (+0.3%) earned far less; since 2021 IF moved between -2.3 and +3.2 points a year and IH was negative in four of six years.
4. The rolled long is an equity position: IC fell 52% from June to September 2015, and more than a third from late 2017 to 2018 and from 2022 to early 2024.
5. Hedgers (long stocks, short IC) paid roughly the same gap.

## Why the discount exists

- One-sided hedging demand: market-neutral funds hold small and mid-cap baskets and sell IC and IM futures.
- Arbitrage is hard: borrowing small-cap stocks to short is limited and expensive.
- Dividends: contracts spanning the May-August dividend season are priced lower by expected dividends (largest for IH and IF); this is fair value, not a discount.
- Trading restrictions after the 2015 crash (higher margins and fees, limits on intraday trading), eased in steps from 2017; the far IC contracts' annualised discount averaged more than 20% in 2015 and 2016.

## Method

- Long one contract, notional = capital (no leverage), held in a quarterly contract; rolled three trading days before expiry into the next quarterly contract with more than 45 calendar days left.
- Daily closing prices (Sina Finance; CFFEX daily reports before 2019). Roll cost 2 basis points per side on notional. No interest credited on unused cash.
- Benchmark: CSI total-return index (H00905, H00852, H00300, H00016).
- Gap = annual return of rolled long minus annual return of total-return index. A fairly priced future would show about minus the short-term interest rate (roughly -1.5% to -3% a year over the period).

## Results by contract

| Future | Index | Period | Rolled long | Total-return index | Gap | Gap 2016-20 | Gap 2021-25 | Tracking vol |
|---|---|---|---:|---:|---:|---:|---:|---:|
| IC | CSI 500 | 2015-04-17 to 2026-11-16 | +10.3% | -0.7% | +11.0% | +14.1% | +6.1% | 10.8% |
| IM | CSI 1000 | 2022-07-25 to 2026-11-16 | +6.8% | -2.0% | +8.8% | n/a | +8.5% | 6.9% |
| IF | CSI 300 | 2015-04-17 to 2026-11-11 | +4.8% | +1.5% | +3.3% | +5.2% | +0.2% | 8.3% |
| IH | SSE 50 | 2015-04-17 to 2026-11-11 | +2.1% | +1.8% | +0.3% | +1.5% | -1.4% | 7.0% |

## Gap by calendar year (percentage points)

| Year | IC | IM | IF | IH |
|---|---:|---:|---:|---:|
| 2015 | +19.4% | n/a | +8.1% | +1.8% |
| 2016 | +28.1% | n/a | +13.4% | +7.8% |
| 2017 | +12.5% | n/a | +5.7% | +2.2% |
| 2018 | +2.7% | n/a | -0.0% | -3.8% |
| 2019 | +11.5% | n/a | -0.6% | -1.6% |
| 2020 | +15.3% | n/a | +5.9% | +3.6% |
| 2021 | +12.8% | n/a | +2.5% | +1.9% |
| 2022 | +4.0% | +4.4% | +1.4% | -0.6% |
| 2023 | +0.8% | +2.9% | -2.3% | -3.5% |
| 2024 | +2.6% | +6.7% | -2.1% | -2.8% |
| 2025 | +11.8% | +16.5% | +1.0% | -2.3% |
| 2026 | +5.7% | +8.1% | +3.2% | +0.9% |

2015 starts in April; 2026 ends in November.

## Average annualised basis by maturity (whole sample)

| Future | Nearest | 2nd | 3rd | 4th |
|---|---:|---:|---:|---:|
| IC | -15.3% (20d) | -12.4% (44d) | -10.6% (105d) | -9.4% (197d) |
| IM | -9.5% (20d) | -9.1% (44d) | -8.7% (106d) | -8.3% (197d) |
| IF | -8.4% (20d) | -6.5% (44d) | -5.1% (105d) | -4.2% (197d) |
| IH | -5.2% (20d) | -4.2% (44d) | -3.1% (105d) | -2.4% (197d) |

Average calendar days to expiry in brackets; contracts with fewer than 10 days left excluded.

## Risks

- Leverage: at three times capital an IC position would have lost all its equity in 2015, in 2017-2018 and in 2022-2024, before margin calls.
- Keep cash well above minimum margin.
- The discount can narrow for years (2022-2024).
- Exchange rules on margin, fees, limits and intraday trading change.
- Trading in mainland China requires a futures account and the exchange's suitability requirements (minimum funds, knowledge test, experience).

## Limitations

- Closing prices, not settlement prices.
- Contracts still trading at the end of the sample expire on the third Friday of the month in this calculation; holiday postponements are ignored.
- The basis-by-maturity table uses the price index, so contracts spanning the dividend season include expected dividends.
- The study ignores taxes, margin interest, position limits and the 2015-2017 restrictions, and assumes trading at the close.
- Educational and analytical use only; not investment advice. Past results do not indicate future results.
