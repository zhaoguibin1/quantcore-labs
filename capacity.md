# Strategy Capacity Calculator

> Client-side calculator of how much money a stock strategy can run: capacity at a participation cap on average daily traded value, the binding holding, square-root market-impact cost by portfolio size, and the portfolio size at which impact uses a chosen share of gross alpha.
> URL: https://quantcore-labs.com/tools/capacity/

## Inputs

- Holdings: asset, weight, average daily traded value in CNY (for example the 20-day average), optional daily return volatility. Weights are normalised to sum to one.
- Annual one-way turnover T, trading days between rebalances k, days allowed to work each trade d, participation cap c.
- Square-root impact coefficient Y (usually 0.3 to 1) and a default daily volatility for rows without one.
- Gross alpha per year, the share of it you accept losing to impact, and your current portfolio size.

## Formulas

```
tau             = min(1, T * k / 242)                 share of the portfolio traded one way per rebalance
trade_i         = A * w_i * tau                       CNY, portfolio size A
participation_i = trade_i / (d * ADV_i)
capacity        = min_i c * d * ADV_i / (w_i * tau)
impact_i        = Y * sigma_i * sqrt(participation_i) share of trade_i, square-root law
annual drag     = 2T * sum_i w_i * impact_i           share of the portfolio per year; grows with sqrt(A)
budget size     = A where annual drag = budget share * gross alpha  = (target / drag at A = 1)^2
net alpha       = gross alpha - annual drag
```

Trades are spread across holdings by weight. The factor 2 counts the buy and the sell in one unit of one-way turnover. Fees and stamp duty are not included; see https://quantcore-labs.com/tools/a-share-costs/.

## Worked example

- 30 equal-weight stocks, each with 50 million CNY of daily traded value; one-way turnover 8 times a year; rebalance every 10 trading days; each trade worked within 1 day; participation cap 5%.
- Each rebalance trades 8 * 10 / 242 = 33.1% of the portfolio, so each stock trades 1.10% of the portfolio.
- Participation capacity: 0.05 * 50,000,000 / 0.0110 = about 227 million CNY.
- Impact at that size, Y = 0.7 and 2.5% daily volatility: 0.7 * 0.025 * sqrt(0.05) = 39 bp per trade; times 2 * 8 = 6.3% a year.
- Impact reaches 3% a year at about 52 million CNY. The impact budget binds well before the participation cap.

## Reading the results

- The participation limit is a minimum across holdings: the least liquid name at full weight sets it. Capping weights by liquidity raises capacity.
- Impact grows with the square root of size: four times the money doubles the annual impact cost.
- Halving turnover halves the drag at any size. More days per trade raise participation capacity in proportion and lower impact per trade, at the price of older signals.
- Real impact also depends on time of day, order type, crowding, and limit-up or limit-down days when a stock cannot trade.

## Reference check

The calculations in https://quantcore-labs.com/tools/capacity/capacity-core.mjs match an independent NumPy implementation on 200 random parameter sets (maximum relative difference below 1e-15) and are covered by automated tests with hand-worked cases.

## Limitations

- Square-root law with one coefficient for all names; calibrate Y to your own fills where possible.
- Trades spread pro rata by weight; concentrated replacement of a few names costs more.
- No fees, no stamp duty, no permanent impact or decay between days, no crowding by other traders.
- Educational and analytical use only; not investment advice.
