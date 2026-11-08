"""O(n) Rolling Mean (Cython Memoryview Recurrence): reference implementation.

Source: https://quantcore-labs.com/code/cython-rolling-mean/
License: MIT (c) 2026 QuantCore Labs
Requires: Python 3.9+, numpy
"""
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
