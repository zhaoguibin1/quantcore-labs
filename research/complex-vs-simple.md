# Complex vs Simple: A Multi-Signal A-Share Model Against Three Plain Styles

> A multi-signal A-share stock-selection model showed a 21% annual return in its backtest. Rebuilt from the three plain styles it held (value, low turnover, low volatility) and run through the same engine with the same costs, the simple version came within 2 points a year with a higher Sharpe ratio. The pre-registered pass mark for the extra complexity was not met.
> URL: https://quantcore-labs.com/research/complex-vs-simple/

## Key findings

1. The model's holdings sat around the 74th percentile on value, the 68th on low volatility and the 28th on trading activity (size-adjusted percentiles; 50 = market). Profitability average; gross margin (37th) and low leverage (38th) below average.
2. Simple model (equal-weight z-scores of value, low turnover, low volatility, each industry- and size-neutral): 19.8% a year, Sharpe 1.03, max drawdown -25.6%. Multi-signal model: 21.3%, Sharpe 0.95, max drawdown -30.3%. Period 2018-07-03 to 2026-11-13, after costs.
3. Difference +2.0% a year, t = 0.63; first half (to June 2022) +8.8% (t = 2.13), second half -4.1% (t = -0.83). Required: at least +2.0% with t >= 2 and positive in both halves.
4. The model's cumulative lead peaked at 44% in August 2022, built mostly in 2019-2021, and was 11% by November 2026.
5. One-way turnover 8.6x a year vs 1.6x; cost about 2.8% vs 0.5% a year.

## Head to head (after costs)

| Portfolio | Annual return | Sharpe | Max drawdown | To Jun 2022 | From Jul 2022 | Turnover / yr | Cost / yr |
|---|---:|---:|---:|---:|---:|---:|---:|
| Multi-signal model | 21.3% | 0.95 | -30.3% | 31.0% | 13.0% | 8.6x | -2.8% |
| Simple three-style model | 19.8% | 1.03 | -25.6% | 20.5% | 19.1% | 1.6x | -0.5% |
| Value only | 11.1% | 0.65 | -21.2% | 17.4% | 5.7% | 0.6x | -0.2% |
| Low turnover only | 17.5% | 0.76 | -43.4% | 23.6% | 12.1% | 3.0x | -1.0% |
| Low volatility only | 9.9% | 0.62 | -28.7% | 9.1% | 10.5% | 2.1x | -0.7% |

## By calendar year

| Year | Multi-signal | Simple | Difference |
|---|---:|---:|---:|
| 2018 | -7.5% | -5.4% | -2.1% |
| 2019 | +36.1% | +29.4% | +6.8% |
| 2020 | +43.9% | +20.1% | +23.9% |
| 2021 | +49.4% | +40.5% | +8.8% |
| 2022 | +13.1% | +10.7% | +2.4% |
| 2023 | +24.9% | +43.3% | -18.4% |
| 2024 | +3.6% | +9.4% | -5.9% |
| 2025 | +29.4% | +25.6% | +3.9% |
| 2026 | -3.0% | -0.4% | -2.6% |

2018 starts in July; 2026 ends in November.

## Regression of daily excess return on five style portfolios (Newey-West)

| Period | Unexplained / yr | t | Value | Low turnover | Low vol | Quality | Small size | R2 |
|---|---:|---:|---:|---:|---:|---:|---:|---:|
| Full sample | -4.1% | -1.78 | 0.65 | 0.61 | 0.34 | -0.24 | 0.05 | 0.47 |
| To June 2022 | +1.1% | 0.33 | 0.60 | 0.55 | 0.40 | -0.19 | 0.02 | 0.46 |
| From July 2022 | -8.3% | -2.63 | 0.71 | 0.64 | 0.29 | -0.31 | 0.07 | 0.49 |

Style portfolios are before costs; the model is after about 2.8% a year of costs.

## Setup

- Model: multi-signal composite for a concentrated long-only portfolio of a few dozen stocks, rebalanced every two weeks; signals not described (black box).
- Same engine for every portfolio: universe, holdings count, rebalancing dates, price-limit and suspension rules, cost model (commission, stamp duty, slippage). Only the score differs.
- Pass mark fixed before the test.

## Lessons

- Benchmark a model against a plain portfolio with its own tilts, not against an index.
- Fix the pass mark first.
- Extra signals buy turnover; here about 2.3 points a year, more than the model's lead.
- A lead earned in the years the signals were chosen on, and lost after, suggests fitting the past.
- The simple model is not proven either: its styles were chosen after seeing the model's holdings.

## Limitations

- Both models are in-sample. One market, one period, one portfolio construction. Backtest, not live trading. Not investment advice.

## Related tools

- Style Exposure Analyzer: https://quantcore-labs.com/tools/style-exposure/
- Factor IC Analyzer: https://quantcore-labs.com/tools/factor-ic/
- A-Share Trading Cost Calculator: https://quantcore-labs.com/tools/a-share-costs/
