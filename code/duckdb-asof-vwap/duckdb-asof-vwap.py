"""Per-Symbol Minute VWAP in DuckDB: reference implementation.

Source: https://quantcore-labs.com/code/duckdb-asof-vwap/
License: MIT (c) 2026 QuantCore Labs
Requires: Python 3.9+, duckdb
"""
import duckdb

def minute_vwap(parquet_glob: str):
    """Minute VWAP and volume per symbol from Parquet trades.

    parquet_glob is a bound parameter (a file path or a glob). The query is an
    aggregation on time_bucket, not an as-of join.
    """
    if not isinstance(parquet_glob, str) or parquet_glob == "":
        raise ValueError("parquet_glob must be a non-empty string")
    con = duckdb.connect()
    return con.execute(
        """
        SELECT symbol,
               time_bucket(INTERVAL 1 MINUTE, timestamp) AS minute,
               SUM(price * volume) / NULLIF(SUM(volume), 0) AS vwap,
               SUM(volume) AS volume
        FROM read_parquet(?)
        GROUP BY ALL
        ORDER BY symbol, minute
        """,
        [parquet_glob],
    ).df()
