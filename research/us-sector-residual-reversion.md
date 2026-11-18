# US Sector Residual Mean Reversion After 2020

> Avellaneda-Lee sector-ETF residual mean reversion on US stocks, daily, January 2016 to December 2025, with rules fixed in advance and no parameter search. Out of sample on eight sectors, after 2 bp per side and 0.5% borrow and excluding interest on cash, the Sharpe ratio fell from 0.36 (2016–2020) to −0.29 (2021–2025).
> URL: https://quantcore-labs.com/research/us-sector-residual-reversion/

## Key findings

- Out of sample (8 sectors not used in development), Sharpe in excess of cash before costs: 0.63 in 2016–2020, 0.03 in 2021–2025. After costs: 0.36 and −0.29 (about +4.0% and −4.2% a year over cash).
- A stricter entry (1.75 instead of 1.25 standard deviations) halved turnover (142× to 72× capital a year); after costs it still fell from 0.40 to −0.14.
- Counting T-bill interest on capital as return lifts the main version's full-period net Sharpe from 0.05 to 0.21.
- After costs and including cash, the main version lost 20.4% in 2022, trailed T-bills in 2023 and 2024, and beat them in 2025.
- A five-year Sharpe has a standard error of about 0.45, so the decline is about one standard error: nothing was left after costs in 2021–2025, but a lasting break is not proven.

## Rules

- Regress 60 days of daily stock returns on the sector SPDR ETF; fit AR(1) to the cumulative residual; keep fits with mean-reversion time under 30 trading days; s-score = (X − m) / sigma_eq.
- Open long s < −1.25, close long s > −0.50; open short s > +1.25, close short s < +0.75. No new entry after a residual move beyond 4 standard deviations on day t or t−1.
- 2% of equity per new position; sector beta hedged daily with the ETF; signal at close, trade at next open.

## Universes and costs

- Development: 141 stocks in XLE, XLF, XLK. Out of sample: 280 stocks in XLB, XLC, XLI, XLP, XLRE, XLU, XLV, XLY, price > 5 USD and 60-day median traded value > 20 million USD.
- Costs per side on traded value: none; 2 bp + 0.5% borrow; 5.5 bp + 3% borrow.
- Out-of-sample runs credit T-bill ETF return on equity; results below exclude it. Development runs credit no interest.

## Results (in excess of cash)

| Universe and entry | Costs per side | Sharpe 2016–20 | Sharpe 2021–25 | Return 2016–20 | Return 2021–25 | Turnover / yr |
|---|---|---:|---:|---:|---:|---:|
| Development: 3 sectors, entry 1.25 | none | 0.74 | 0.48 | +4.6% | +2.8% | 73× |
| Development: 3 sectors, entry 1.25 | 2 bp + 0.5% borrow | 0.45 | 0.19 | +2.7% | +1.0% | 73× |
| Development: 3 sectors, entry 1.25 | 5.5 bp + 3% borrow | −0.20 | −0.50 | −1.5% | −3.1% | 74× |
| Out of sample: 8 sectors, entry 1.25 | none | 0.63 | 0.03 | +7.5% | −0.3% | 142× |
| Out of sample: 8 sectors, entry 1.25 | 2 bp + 0.5% borrow | 0.36 | −0.29 | +4.0% | −4.2% | 142× |
| Out of sample: 8 sectors, entry 1.75 | none | 0.63 | 0.13 | +4.5% | +0.7% | 72× |
| Out of sample: 8 sectors, entry 1.75 | 2 bp + 0.5% borrow | 0.40 | −0.14 | +2.7% | −1.3% | 72× |

Checks: a second independent price feed gives 0.69 / 0.04 (no costs) and 0.40 / −0.28 (2 bp); trading at the close with a 3 bp penalty gives 0.78 / 0.02 gross and 0.17 / −0.69 after costs.

## Limitations

- Survivorship bias: universe from recent sector membership; delisted stocks closed at last price.
- Current sector classification for the whole history; flat cost and borrow rates; no market-impact model.
- One set of published rules, simplified, untuned. Backtest, not live trading. Not investment advice.

## Reference

Avellaneda, M. and Lee, J.-H. (2010), Statistical arbitrage in the US equities market, Quantitative Finance 10(7), 761–782.
