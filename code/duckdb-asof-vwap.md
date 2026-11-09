# Per-Symbol Minute VWAP in DuckDB

> Aggregate a Parquet trade tape to one VWAP and one volume per symbol per minute, in a single DuckDB query. The file path is a bound parameter. Despite the page slug, this is a time-bucket aggregation, not an as-of join.
> URL: https://quantcore-labs.com/code/duckdb-asof-vwap/

Category: Data Engineering for Quants. Snippet ID: `duckdb-asof-vwap`.

## What it does

Minute VWAP is the traded value in that minute divided by the traded volume, computed separately for each symbol. DuckDB's time_bucket assigns each timestamp to the start of its minute, and GROUP BY ALL groups by the selected symbol and minute columns. Division uses NULLIF so a minute whose volume sums to zero gets a missing VWAP instead of an error or an infinity. The path to the Parquet files is passed as a parameter.

## Approach

```
minute = time_bucket(INTERVAL 1 MINUTE, timestamp)
VWAP   = Σ(price · volume) / Σ volume     within (symbol, minute)
volume = Σ volume

SELECT symbol, minute, VWAP, volume
FROM read_parquet(?)          -- path is bound, not concatenated
GROUP BY ALL
ORDER BY symbol, minute
```

## When to use it

- You want minute bars from a large tape and you do not want to materialise every tick as a DataFrame. The aggregation runs in DuckDB and only the bars come back.
- The same VWAP, computed after loading the ticks, is [pandas-tick-to-ohlcv](https://quantcore-labs.com/code/pandas-tick-to-ohlcv/). Session VWAP as an execution benchmark is the [VWAP](https://quantcore-labs.com/glossary/vwap/) term.
- Attaching quotes to trades is a different operation. That as-of join is [polars-asof-join-quotes](https://quantcore-labs.com/code/polars-asof-join-quotes/). This query does not look at quotes.

## Pitfalls

- **The slug says asof.** The query is a group-by on a time bucket. There is no ASOF JOIN in it. Keeping the slug stable matters more than renaming the page to match the SQL keyword.
- **Timestamp ties and order.** VWAP does not care which trade came first. Open and close would. Do not extend this query with an unordered `first(price)` and call it the open.
- **Zero volume.** `NULLIF` makes VWAP null when the minute's volume is 0. The row is still returned, so a caller can see the empty minute. Filter it if you want only real bars.
- **Clock and time zone.** `time_bucket` uses the timestamp as stored. Naive and timezone-aware columns must not be mixed across files.

## Python reference implementation

Requires duckdb. Tested before publication and re-executed with assertions on every rebuild. MIT licensed. Raw file: https://quantcore-labs.com/code/duckdb-asof-vwap/duckdb-asof-vwap.py

```python
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
```

## FAQ

**Why is this not an as-of join?**

VWAP needs every trade in the minute, weighted by size. An as-of join would keep a single neighbouring row. The page id was fixed by the batch that added it; the SQL matches the definition above, and the as-of join lives on the Polars quotes page.

**Why bind the path?**

The glob is data. Concatenating it into the query string turns a peculiar folder name into SQL syntax. read_parquet(?) keeps it a parameter, including globs.

## Related

- [Volume-Weighted Average Price (VWAP)](https://quantcore-labs.com/glossary/vwap/)
- [Query Tick Data in Parquet with DuckDB](https://quantcore-labs.com/code/duckdb-parquet-ticks/)
- [Resample Trade Ticks to OHLCV and VWAP Bars](https://quantcore-labs.com/code/pandas-tick-to-ohlcv/)
- [Attach the Prevailing Quote to Each Trade](https://quantcore-labs.com/code/polars-asof-join-quotes/)

