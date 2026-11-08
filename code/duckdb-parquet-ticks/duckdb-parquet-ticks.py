"""Query Tick Data in Parquet with DuckDB: reference implementation.

Source: https://quantcore-labs.com/code/duckdb-parquet-ticks/
License: MIT (c) 2026 QuantCore Labs
Requires: Python 3.9+, duckdb
"""
import duckdb

# Layout this snippet assumes (Hive partitioning, one folder per trading day):
#   ticks/date=2024-03-01/part-0.parquet    columns: ts TIMESTAMP, seq BIGINT, code VARCHAR, price DOUBLE, volume BIGINT
# seq = exchange sequence number. Several ticks often share one timestamp, so open/close
# must be ordered by (ts, seq); ordering by ts alone picks an arbitrary tick on ties.
#   ticks/date=2024-03-04/part-0.parquet    ...

def connect(threads: int = 0) -> duckdb.DuckDBPyConnection:
    con = duckdb.connect()                      # in-memory; Parquet stays on disk
    if threads:
        con.execute(f"SET threads = {threads}")
    return con

def minute_bars(con, root: str, codes: list, start: str, end: str):
    """1-minute OHLCV + VWAP straight from tick Parquet.
    The date filter prunes whole partition folders and the code filter is pushed down
    to Parquet row-group statistics, so only the needed bytes are read."""
    return con.execute(f"""
        SELECT code,
               time_bucket(INTERVAL 1 MINUTE, ts)   AS minute,
               arg_min(price, (ts, seq))             AS open,
               max(price)                            AS high,
               min(price)                            AS low,
               arg_max(price, (ts, seq))             AS close,
               sum(volume)                           AS volume,
               sum(price * volume) / sum(volume)     AS vwap
        FROM read_parquet('{root}/*/*.parquet', hive_partitioning = true)
        WHERE date BETWEEN ? AND ? AND code IN (SELECT unnest(?))
        GROUP BY ALL
        ORDER BY code, minute
    """, [start, end, codes]).df()

def daily_turnover(con, root: str, start: str, end: str):
    """Per-stock daily traded value, e.g. the 'amount' input for the Amihud measure."""
    return con.execute(f"""
        SELECT date, code, sum(price * volume) AS amount
        FROM read_parquet('{root}/*/*.parquet', hive_partitioning = true)
        WHERE date BETWEEN ? AND ?
        GROUP BY ALL ORDER BY date, code
    """, [start, end]).df()

def write_partitioned(con, df, root: str):
    """Write a pandas DataFrame with a 'date' column as Hive-partitioned, zstd Parquet,
    sorted by code so row-group min/max statistics make code filters effective."""
    con.register("src", df)
    con.execute(f"""COPY (SELECT * FROM src ORDER BY date, code, ts, seq)
                    TO '{root}' (FORMAT parquet, PARTITION_BY (date), COMPRESSION zstd, OVERWRITE_OR_IGNORE)""")
    con.unregister("src")
