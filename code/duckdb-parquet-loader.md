# Load Hive-Partitioned Parquet Ticks with Bound Parameters

> Read a date slice of tick Parquet through DuckDB. The file glob and the date are bound parameters, so a path or a date string cannot change the SQL.
> URL: https://quantcore-labs.com/code/duckdb-parquet-loader/

Category: Data Engineering for Quants. Snippet ID: `duckdb-parquet-loader`.

## What it does

DuckDB queries Parquet in place. With Hive layout (one folder per day), a predicate on the partition column skips other days. The glob passed to read_parquet and the date in the WHERE clause are both placeholders. Building either value into the SQL text with an f-string would let a quote in a path, or a crafted date, close the string and append another statement. Binding them does not.

## Approach

```
Layout:  ticks/date=YYYY-MM-DD/part-*.parquet
Columns: timestamp, symbol, price, volume

SELECT symbol, timestamp, price, volume
FROM read_parquet(?, hive_partitioning = true)   -- ? = glob, not an interpolated path
WHERE date = ?                                   -- ? = the date
  AND volume > 0
ORDER BY timestamp
```

## Why bind every value

- The date filter is what makes a Hive layout useful: folders outside the day are not opened. It only stays a filter if it is a value, not a piece of SQL text.
- Paths from a config file, a request, or a folder name with a quote are data. `read_parquet(?)` passes them through DuckDB's parameter API.
- For minute bars, VWAP and code filters on the same layout, see [duckdb-parquet-ticks](https://quantcore-labs.com/code/duckdb-parquet-ticks/).

## Pitfalls

- **Partition type.** Hive values are parsed from folder names. `date=2024-03-01` usually arrives as a date. Compare it to a date or an ISO date string, and check with `DESCRIBE` if a filter suddenly matches nothing.
- **Zero-size prints.** The query drops `volume <= 0`. Those rows are not trades. Decide separately whether auction prints belong in the extract.
- **Glob, not a Python path join inside SQL.** Pass the glob from Python (`dir/**/*.parquet`). Do not concatenate it into the query string.

## Python reference implementation

Requires duckdb. Tested before publication and re-executed with assertions on every rebuild. MIT licensed. Raw file: https://quantcore-labs.com/code/duckdb-parquet-loader/duckdb-parquet-loader.py

```python
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
```

## FAQ

**Why not use an f-string for the path?**

read_parquet needs a path, and an f-string is the obvious way to supply it, but the path then becomes SQL syntax. A directory name containing a quote breaks the query or changes it. A bound parameter keeps the path as a value. The same applies to the date.

**Does this load the whole dataset into memory?**

DuckDB reads the Parquet row groups required by the query. A selective date predicate on a Hive partition avoids opening other days. The result of this particular query is still a pandas DataFrame of every matching tick, so aggregate in SQL when the day is large. See the minute-bar query on the DuckDB ticks page.

## Related

- [Query Tick Data in Parquet with DuckDB](https://quantcore-labs.com/code/duckdb-parquet-ticks/)
- [Per-Symbol Minute VWAP in DuckDB](https://quantcore-labs.com/code/duckdb-asof-vwap/)
- [Resample Trade Ticks to OHLCV and VWAP Bars](https://quantcore-labs.com/code/pandas-tick-to-ohlcv/)

