# Performance & Drawdown Analytics Calculator

> Client-side calculator for Sharpe, Sortino, Calmar, CAGR, maximum drawdown, drawdown duration and VaR/CVaR from an equity curve, periodic returns or PnL.
> URL: https://quantcore-labs.com/tools/performance-analytics/

## Inputs

- Data type: equity curve / NAV, periodic returns in % or decimal, or PnL per period plus starting capital
- One row per period; an optional leading date (YYYY-MM-DD, YYYY/MM/DD or YYYYMMDD) enables the monthly table and dated drawdown ranges
- Periods per year: 252 (US/global daily), 242 (A-share daily), 365, 52, 12
- Risk-free rate and Sortino MAR, % p.a. (MAR defaults to the risk-free rate)
- Risk-free rate can be filled in one click with the latest U.S. 3-month Treasury yield, converted to an effective annual rate

## Formulas

```
r_t     = E_t / E_(t-1) - 1          P = periods per year, n = number of returns
CAGR    = (E_n / E_0)^(P/n) - 1
Vol     = stdev(r, ddof=1) * sqrt(P)
rf_p    = (1 + rf)^(1/P) - 1
Sharpe  = mean(r - rf_p) / stdev(r - rf_p) * sqrt(P)
DD_down = sqrt(mean(min(r - MAR_p, 0)^2))      over all periods (Sortino-Price)
Sortino = (mean(r) - MAR_p) / DD_down * sqrt(P)
DD_t    = E_t / max(E_0..E_t) - 1,  MDD = min DD_t
Calmar  = CAGR / |MDD|                          full sample
VaR95   = -Q_5%(r),  CVaR95 = -mean(r | r <= Q_5%(r))   historical, linear interpolation
```

Skewness and excess kurtosis use population moment estimators. Drawdown duration counts periods from a peak until equity regains that peak; an unrecovered drawdown is counted to the last observation and flagged as ongoing.

## Outputs

Sharpe, Sortino, Calmar, CAGR, total return, annualised volatility, max drawdown with peak and trough dates, longest drawdown duration, current drawdown, best and worst period, VaR/CVaR 95%, win rate, profit factor, skewness, excess kurtosis. Charts: equity (linear or log), underwater, rolling Sharpe (63/126/252). Monthly returns table when dates are present.

## Reference check

Returns 1%, -2%, 3%, -1%, 2% with P = 252 and rf = 0: Sharpe 4.5932, Sortino 9.5247, MDD -2.00%, CAGR 332.56%, Calmar 166.28. Metrics are cross-checked against an independent NumPy/SciPy implementation, with relative difference below 1e-14.

## FAQ

- **252 or 242 days for A-shares?** 242 matches the A-share trading calendar; it changes Sharpe by about 2% versus 252.
- **Why does Sortino differ from other tools?** Some tools use the stdev of negative returns only; this one uses the full-sample downside deviation (Sortino-Price).
- **Calmar window?** Full sample, not the traditional trailing 36 months.
- **Is data uploaded?** No; all computation runs in the browser.

## Limitations

- Assumes equally spaced periods; irregular dates are not time-weighted.
- Historical VaR/CVaR are unreliable for short samples (fewer than ~250 observations).
- Educational and analytical use only; not investment advice.
