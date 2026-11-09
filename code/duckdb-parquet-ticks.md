# Query Tick Data in Parquet with DuckDB

> Build 1-minute OHLCV and VWAP bars, and daily turnover, straight from Hive-partitioned tick Parquet files with DuckDB. There is no database server and no loading step, and filters skip unneeded files and row groups.
> URL: https://quantcore-labs.com/code/duckdb-parquet-ticks/

Category: Data Engineering for Quants. Snippet ID: `duckdb-parquet-ticks`.

## What it does

DuckDB is an in-process analytical database that queries Parquet files in place. With one folder per trading day (Hive partitioning), a date filter skips whole folders. Sorting rows by stock code inside each file lets Parquet's row-group min/max statistics skip most of the data for a code filter. The snippet shows the storage layout, a writer that produces it, and queries for minute bars and daily turnover.

## Approach

```
Layout:  ticks/date=YYYY-MM-DD/part-0.parquet   (ts, seq, code, price, volume)

read_parquet('ticks/*/*.parquet', hive_partitioning = true)
  WHERE date BETWEEN ? AND ?      → partition pruning (folders never opened)
    AND code IN (...)             → row-group pruning via min/max statistics

open  = arg_min(price, (ts, seq))      close = arg_max(price, (ts, seq))
vwap  = Σ price·volume / Σ volume       bucket = time_bucket(INTERVAL 1 MINUTE, ts)
```

## Why this layout

- **One partition per day** matches how tick data arrives and how research queries are scoped. Adding a day means writing one new folder.
- **Sorted by code, zstd-compressed.** This gives small files and effective code filters. Avoid thousands of tiny files: aim for one to a few files per day.
- The same files are readable by pandas, Polars and Spark, so there is no lock-in.

## Pitfalls

- **Timestamp ties.** Several ticks often share one timestamp. Ordering by `ts` alone picked the wrong open or close in 27–30% of minutes in the test for this page. Always carry the exchange sequence number and order by `(ts, seq)`.
- **Auction ticks.** A-share opening (09:15–09:25) and closing (14:57–15:00) call-auction prints are single-price matches. Decide whether bars include them, and filter by time if not.
- **Time zones.** Store exchange-local timestamps consistently, either naive local time or TIMESTAMPTZ, but never mixed.
- **Partition column type.** Hive values are parsed from folder names. Compare against values of the same type, and check with `DESCRIBE`.

## Python reference implementation

Requires duckdb. Tested before publication and re-executed with assertions on every rebuild. MIT licensed. Raw file: https://quantcore-labs.com/code/duckdb-parquet-ticks/duckdb-parquet-ticks.py

```python
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
```

## FAQ

**Why DuckDB instead of loading everything into pandas?**

DuckDB reads only the partitions, columns and row groups a query needs, runs multi-threaded, and spills to disk when data exceeds memory. Tens of millions of ticks that would not fit comfortably in a pandas DataFrame can be aggregated directly from Parquet.

**Should I store ticks in a .duckdb file or in Parquet?**

Both work. Parquet is open, portable across pandas/Polars/Spark and easy to append by day; a .duckdb database file is convenient for derived tables and indexes. A common pattern is raw ticks in partitioned Parquet and derived bars or factors in a DuckDB file.

## Related

- [Amihud Illiquidity Measure (ILLIQ)](https://quantcore-labs.com/glossary/amihud-illiquidity/)
- [Volume-Weighted Average Price (VWAP)](https://quantcore-labs.com/glossary/vwap/)

