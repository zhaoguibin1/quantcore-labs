# Rolling Z-Score from a Zero-Copy Sliding Window

> Build each rolling window as a view with sliding_window_view and reduce it in NumPy. The view shares memory with the input. Sample standard deviation of zero becomes a missing z-score, not an infinity.
> URL: https://quantcore-labs.com/code/numpy-strided-rolling/

Category: High-Performance Python. Snippet ID: `numpy-strided-rolling`.

## What it does

sliding_window_view reshapes a 1-D array into overlapping windows of length w without copying the values. The row means and sample standard deviations are then ordinary NumPy reductions along the window axis. The z-score at the right edge of each window is (x − mean) / std. Positions before the first full window are missing. This is a convenient form when the reduction is a NumPy ufunc. It is not always faster than a single running-sum pass, because each overlapping row still reads w elements.

## Approach

```
W = sliding_window_view(x, w)          shape (n − w + 1, w), a view
μ = mean(W, axis=1)                    population mean of the window
s = std(W, axis=1, ddof=1)             sample standard deviation
z_{w−1+i} = (x_{w−1+i} − μ_i) / s_i     if s_i > 0, else missing

Memory: W.base is x. Changing W would change x.
```

## When to use it

- A one-off rolling reduction that NumPy already implements (mean, quantile, median), where writing a running-sum update is not worth it.
- Teaching or testing a window statistic against an obvious definition. The view makes the window explicit.
- For mean, variance and beta on long series, a running sum does one pass and less memory traffic. See [rolling-window-numba](https://quantcore-labs.com/code/rolling-window-numba/) and [cython-rolling-mean](https://quantcore-labs.com/code/cython-rolling-mean/).

## Pitfalls

- **It is a view.** Do not write into the window array. The write lands in the original series.
- **The view is O(n·w) to reduce** even though it is O(1) extra memory to build. A rolling mean this way is slower than a prefix sum for large w.
- **ddof.** Sample standard deviation (divide by w−1) matches pandas `rolling.std`. Population standard deviation does not. w must be at least 2.
- **Zero variation.** A window of identical values has sample std 0. Division is skipped and the z-score is missing.

## Python reference implementation

Requires numpy. Tested before publication and re-executed with assertions on every rebuild. MIT licensed. Raw file: https://quantcore-labs.com/code/numpy-strided-rolling/numpy-strided-rolling.py

```python
import numpy as np
from numpy.lib.stride_tricks import sliding_window_view

def rolling_zscore(x, window: int) -> np.ndarray:
    """Rolling z-score using a zero-copy sliding window.

    Sample standard deviation (ddof=1). Warm-up and zero-std windows are NaN.
    The window view is not writable from the caller's point of view: this
    function only reads it.
    """
    x = np.asarray(x, dtype=np.float64).reshape(-1)
    window = int(window)
    if window < 2:
        raise ValueError("window must be at least 2")
    out = np.full(x.shape, np.nan)
    if x.size < window:
        return out
    view = sliding_window_view(x, window)
    mu = view.mean(axis=1)
    sd = view.std(axis=1, ddof=1)
    z = np.full(mu.shape, np.nan)
    np.divide(x[window - 1:] - mu, sd, out=z, where=sd > 0)
    out[window - 1:] = z
    return out
```

## FAQ

**Does sliding_window_view copy the data?**

No. It returns a view with modified strides. The extra memory is a small array header, not n times w floats. The subsequent mean and std do read each window, so the compute is not free.

**Why not use this for every rolling statistic?**

Reductions that have an O(1) update, such as a sum, are faster and kinder to the cache as a single pass. The strided view is the right tool when the statistic is awkward to update, for example a rolling median or quantile.

## Related

- [Fast Rolling Mean, Std, Beta and Z-score with Numba](https://quantcore-labs.com/code/rolling-window-numba/)
- [O(n) Rolling Mean (Cython Memoryview Recurrence)](https://quantcore-labs.com/code/cython-rolling-mean/)

