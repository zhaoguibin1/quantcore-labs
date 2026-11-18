# A-Share Trading Cost Calculator

> Client-side calculator for the cost of buying and selling Shanghai and Shenzhen A-share stocks: commission with its per-order minimum, stamp duty, transfer fee, exchange handling fee and CSRC management fee, at the fee schedule in force on any date since 2015-08-01.
> URL: https://quantcore-labs.com/tools/a-share-costs/

## Fee schedule (share of traded value)

| Fee | Paid by | From 2023-08-28 | 2022-04-29 to 2023-08-27 | 2015-08-01 to 2022-04-28 | Collected by |
|---|---|---:|---:|---:|---|
| Stamp duty | seller | 0.05% | 0.1% | 0.1% | tax authority |
| Transfer fee | both | 0.001% | 0.001% | 0.002% | China Securities Depository and Clearing |
| Handling fee | both | 0.00341% | 0.00487% | 0.00487%* | exchange, usually inside the commission |
| Management fee | both | 0.002% | 0.002% | 0.002%* | CSRC, usually inside the commission |
| Commission | both | set by the broker, at most 0.3%, often with a 5 CNY minimum per order | | | broker |

\* Taken from the 2022 schedule; earlier changes to these two fees are not modelled. Scope: A-share stocks in the continuous auction on the Shanghai and Shenzhen exchanges. ETFs, bonds, block trades and Beijing Stock Exchange shares have different fees.

Sources: Ministry of Finance and State Taxation Administration announcement of 27 August 2023 (stamp duty halved from 28 August 2023); CSRC notice of 18 August 2023 (handling fee 0.00487% to 0.00341% from 28 August 2023); China Securities Depository and Clearing notices (transfer fee 0.002% from 1 August 2015, 0.001% from 29 April 2022); HKEX Stock Connect circulars of 2022 and 2023.

## Formulas

```
commission   = max(value * rate, minimum)        per order, rounded to 0.01 CNY
regulatory   = value * (handling + management)   only when the commission is quoted net
transfer     = value * transfer rate             both sides
stamp duty   = value * stamp rate                sells only
impact       = value * impact_bp / 10000         both sides, user estimate
round trip   = buy costs + sell costs at the same value; bp = round trip / value * 10000
annual drag  = one-way turnover * round-trip cost (share of portfolio)
minimum binds when value < minimum / rate
```

Each fee is rounded to 0.01 CNY separately. With a share price, the order is rounded down to whole lots: 100 shares on the main board and ChiNext; at least 200 shares, then single shares, on the STAR Market.

## Worked examples (current schedule)

- 100,000 CNY round trip, 2.5 bp all-in commission, 5 CNY minimum: buy 25 + 1 = 26 CNY; sell 25 + 1 + 50 = 76 CNY; total 102 CNY = 10.2 bp. Stamp duty is 49% of the cost.
- 10,000 CNY sell at the same rates: commission rises to the 5 CNY minimum; 5 + 0.10 + 5 = 10.10 CNY = 10.1 bp for the sale alone.
- 1,000,000 CNY buy, 0.8 bp net commission plus fees: 80 + 34.10 + 20 + 10 = 144.10 CNY.
- Turnover 8 times a year at 10.2 bp a round trip: 0.82% of the portfolio a year before market impact.
- The same 100,000 CNY round trip in 2021 cost 154 CNY = 15.4 bp (stamp duty 0.1%, transfer fee 0.002%).

## Reading the results

- Stamp duty is about half of a round trip at 2.5 bp commission and more than two thirds below 1 bp.
- With a 5 CNY minimum and 2.5 bp, orders below 20,000 CNY pay a higher effective rate.
- Turnover multiplies everything; for small caps, market impact is often larger than all fees together.
- Backtests should use the schedule in force on each trade date.

## Reference check

The fee arithmetic in https://quantcore-labs.com/tools/a-share-costs/a-share-costs-core.mjs matches an independent Python implementation using decimal half-up rounding to 0.01 CNY on 2,000 random orders (maximum difference below 1e-11 CNY), and is covered by automated tests with hand-worked cases.

## Limitations

- Statutory rates only; your broker's contract notes are authoritative.
- Handling and management fees before April 2022 are taken from the 2022 schedule.
- Market impact is your estimate; the calculator does not model it.
- Educational and analytical use only; not investment or tax advice.
