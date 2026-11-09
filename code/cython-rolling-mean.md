# O(n) Rolling Mean (Cython Memoryview Recurrence)

> The expanding-then-fixed rolling mean from a boundscheck-free Cython memoryview loop, implemented here with a NumPy prefix sum so the generator can re-execute it. The Cython source is included for compilation on a machine with a C toolchain.
> URL: https://quantcore-labs.com/code/cython-rolling-mean/

Category: High-Performance Python. Snippet ID: `cython-rolling-mean`.

## What it does

A rolling mean can be updated by adding the new observation and subtracting the one that left the window, which is a single pass. Before the window is full the same sum is divided by the number of observations seen so far. The Cython form types the buffer as a double memoryview and turns bounds checks off. This page publishes that recurrence as a tested NumPy function, plus the Cython source as a string, because this site's generator executes every snippet with CPython and cannot compile cimport.

## Approach

```
Let s_−1 = 0. For i = 0..n−1:
  s_i = s_{i−1} + x_i − x_{i−w} · 1{i ≥ w}
  m_i = s_i / w            if i ≥ w
      = s_i / (i+1)        if i < w

Prefix-sum form (same values):
  m_i = (c_i − c_{i−w}) / w    for i ≥ w,   c_i = Σ_{k=0..i} x_k,  c_{<0} = 0
  m_i = c_i / (i+1)            for i < w

Cython sketch (compile with cythonize; not executed by the generator):
  @cython.boundscheck(False)
  @cython.wraparound(False)
  def fast_rolling_mean(double[:] arr, int window): ...
```

## When to use it

- One rolling mean over a long tick or bar array, where a Python per-window loop is the cost and a C compiler is available for the memoryview version.
- As a readable specification of the partial-window convention (divide by `i+1` until the window is full, then by `w`). The NumPy function is what the tests lock in.
- For several rolling statistics at once, or for prices with a large level, the centred running sums in [rolling-window-numba](https://quantcore-labs.com/code/rolling-window-numba/) are a better fit. They need no compiler and lose less precision.

## Pitfalls

- **This page does not compile Cython.** `cimport` is not valid Python, so shipping only the memoryview function would fail the rebuild test. `CYTHON_SOURCE` is the compiled form; `fast_rolling_mean` is the reference.
- **Cancellation.** A raw running sum of prices near 10,000 loses digits in the variance, and even the mean drifts once the sum is huge. Re-centre, or use the Numba operators, if the level is large relative to the variation inside the window.
- **NaNs.** One NaN stays inside the prefix sum from that index onward. Drop or fill gaps first.
- **Window edges.** Index `i = w−1` is still the mean of the first `w` points. Index `i = w` drops `x_0`. Callers who want NaN during the warm-up should mask `i < w−1` themselves.

## Python reference implementation

Requires numpy. Tested before publication and re-executed with assertions on every rebuild. MIT licensed. Raw file: https://quantcore-labs.com/code/cython-rolling-mean/cython-rolling-mean.py

```python
import numpy as np

# Same recurrence as a Cython loop over a double memoryview. Compile CYTHON_SOURCE
# with Cython (boundscheck and wraparound off) when a C compiler is available.
# The function below is the tested reference: CPython cannot execute cimport.
CYTHON_SOURCE = """
cimport cython
import numpy as np

@cython.boundscheck(False)
@cython.wraparound(False)
def fast_rolling_mean(double[:] arr, int window):
    cdef int n = arr.shape[0]
    cdef double[:] res = np.empty(n)
    cdef double s = 0.0
    cdef int i
    for i in range(n):
        s += arr[i]
        if i >= window:
            s -= arr[i - window]
            res[i] = s / window
        else:
            res[i] = s / (i + 1)
    return np.asarray(res)
"""

def fast_rolling_mean(arr, window: int) -> np.ndarray:
    """Rolling mean. Partial windows divide by the number of points seen so far.

    For i >= window the result is the mean of x[i-window+1 : i+1].
    Equivalent to the memoryview loop in CYTHON_SOURCE.
    """
    x = np.ascontiguousarray(arr, dtype=np.float64).reshape(-1)
    window = int(window)
    if window < 1:
        raise ValueError("window must be a positive integer")
    n = x.size
    out = np.empty(n, dtype=np.float64)
    if n == 0:
        return out
    csum = np.cumsum(x)
    np.divide(csum, np.arange(1, n + 1, dtype=np.float64), out=out)
    if n > window:
        out[window:] = (csum[window:] - csum[:-window]) / window
    return out
```

## FAQ

**Why is the published function NumPy rather than Cython?**

The site rebuilds by executing every snippet with Python. Cython syntax such as cimport and cdef does not run there, and a C compiler is not part of the rebuild. The NumPy prefix sum matches the memoryview loop value for value; the Cython source is in the same file for when you compile it locally.

**How is this different from the Numba rolling operators?**

This recurrence is a single mean, including a defined value on the warm-up samples. The Numba snippet computes mean, sample standard deviation, rolling beta and a 2-D z-score, re-centres to protect precision, and leaves the warm-up as NaN.

## Related

- [Fast Rolling Mean, Std, Beta and Z-score with Numba](https://quantcore-labs.com/code/rolling-window-numba/)
- [Rolling Z-Score from a Zero-Copy Sliding Window](https://quantcore-labs.com/code/numpy-strided-rolling/)

