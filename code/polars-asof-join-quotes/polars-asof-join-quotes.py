"""Attach the Prevailing Quote to Each Trade: reference implementation.

Source: https://quantcore-labs.com/code/polars-asof-join-quotes/
License: MIT (c) 2026 QuantCore Labs
Requires: Python 3.9+, polars
"""
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
