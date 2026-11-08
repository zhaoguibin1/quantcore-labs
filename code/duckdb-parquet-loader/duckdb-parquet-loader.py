"""Load Hive-Partitioned Parquet Ticks with Bound Parameters: reference implementation.

Source: https://quantcore-labs.com/code/duckdb-parquet-loader/
License: MIT (c) 2026 QuantCore Labs
Requires: Python 3.9+, duckdb
"""
import duckdb

def query_ticks_by_date(parquet_glob: str, target_date: str):
    """Ticks for one Hive date partition.

    parquet_glob and target_date are bound parameters. They are never
    interpolated into the SQL text.
    """
    if not isinstance(parquet_glob, str) or not isinstance(target_date, str):
        raise TypeError("parquet_glob and target_date must be strings")
    if parquet_glob == "" or target_date == "":
        raise ValueError("parquet_glob and target_date must be non-empty")
    con = duckdb.connect()
    return con.execute(
        """
        SELECT symbol, timestamp, price, volume
        FROM read_parquet(?, hive_partitioning = true)
        WHERE date = ?
          AND volume > 0
        ORDER BY timestamp
        """,
        [parquet_glob, target_date],
    ).df()
