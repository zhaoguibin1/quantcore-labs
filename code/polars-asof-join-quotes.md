# Attach the Prevailing Quote to Each Trade

> Backward as-of join, per symbol, from trades to the latest quote at or before the trade. Trade side is then +1 above the mid, −1 below it, 0 at the mid, and missing when no quote has printed yet.
> URL: https://quantcore-labs.com/code/polars-asof-join-quotes/

Category: Data Engineering for Quants. Snippet ID: `polars-asof-join-quotes`.

## What it does

An as-of join matches each trade to the most recent quote that was already on the book, rather than to a quote with the same timestamp only. Doing it by symbol keeps one name's quote from attaching to another name's trade. The side rule compares the trade price to the matched mid-price. It is a labelling convention for research, not the exchange's aggressor flag.

## Approach

```
For each trade (symbol s, time t), choose the quote of s with the greatest t_q ≤ t.
  mid = (bid + ask) / 2
  side =  1  if price > mid
       = −1  if price < mid
       =  0  if price = mid
       = missing if no quote has t_q ≤ t

Both frames are sorted by time before the join. Exact timestamp matches are allowed.
```

## Why backward, and by symbol

- A trade can only be labelled with a quote the matching engine had already published. A forward as-of join would use a future quote. That is look-ahead.
- `by="symbol"` is the difference between a usable tape and a join that pastes the wrong book onto a print whenever two names trade at close times.
- The labelled tape is an input to signed-volume measures such as [Kyle's lambda](https://quantcore-labs.com/glossary/kyles-lambda/) and to the buy and sell buckets in [VPIN](https://quantcore-labs.com/glossary/vpin/).

## Pitfalls

- **No tolerance by default.** The latest quote might be hours old, or from the previous session. Pass a tolerance if a stale quote should not label a trade.
- **Quote rule is not Lee-Ready.** The full tick test also looks at whether the quote itself moved. A price above the mid is only a clue about the aggressor.
- **Sort both sides.** `join_asof` requires the time key to be sorted. This function sorts by time. A secondary sequence number should already have broken ties in the frame you pass in, or two events in the same timestamp keep their original relative order only if the sort is stable, which Polars' default sort is.
- **Missing quote is not side 0.** Side 0 means the trade printed at the mid. A trade before the first quote has a missing side. Collapsing both to 0 hides a join failure.

## Python reference implementation

Requires polars. Tested before publication and re-executed with assertions on every rebuild. MIT licensed. Raw file: https://quantcore-labs.com/code/polars-asof-join-quotes/polars-asof-join-quotes.py

```python
import polars as pl

def tag_trades_with_quotes(trades: pl.DataFrame, quotes: pl.DataFrame, tolerance=None) -> pl.DataFrame:
    """Backward as-of join of quotes onto trades, per symbol, plus a mid rule.

    side is +1 above the mid, -1 below, 0 at the mid, and null if no quote
    is available at or before the trade. tolerance drops quotes older than that.
    """
    need_t = {"symbol", "ts", "price"}
    need_q = {"symbol", "ts", "bid", "ask"}
    if not need_t.issubset(trades.columns) or not need_q.issubset(quotes.columns):
        raise ValueError("trades need symbol, ts, price; quotes need symbol, ts, bid, ask")
    out = (
        trades.sort("ts")
        .join_asof(
            quotes.sort("ts"),
            on="ts",
            by="symbol",
            strategy="backward",
            tolerance=tolerance,
            check_sortedness=False,
        )
    )
    mid = (pl.col("bid") + pl.col("ask")) / 2
    known = mid.is_not_null()
    return out.with_columns(
        side=pl.when(known & (pl.col("price") > mid)).then(pl.lit(1))
        .when(known & (pl.col("price") < mid)).then(pl.lit(-1))
        .when(known).then(pl.lit(0))
        .otherwise(pl.lit(None))
    )
```

## FAQ

**Why not join on an equal timestamp?**

Quotes and trades rarely share a timestamp. An inner join on ts drops almost every trade. An as-of join keeps the quote that was current, which is the one a labelling rule can actually use.

**What does a missing side mean?**

No quote for that symbol had a timestamp at or before the trade, or the matched quote was older than the tolerance. It does not mean the trade was at the mid. At-mid trades have side 0.

## Related

- [Kyle's Lambda](https://quantcore-labs.com/glossary/kyles-lambda/)
- [Volume-Synchronized Probability of Informed Trading (VPIN)](https://quantcore-labs.com/glossary/vpin/)
- [Order Flow Imbalance (OFI)](https://quantcore-labs.com/glossary/ofi/)

