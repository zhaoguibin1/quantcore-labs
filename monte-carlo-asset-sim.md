# Monte Carlo Asset Path Simulator

> Client-side Monte Carlo simulator of asset price paths under Geometric Brownian Motion (GBM), with terminal-price percentiles.
> URL: https://quantcore-labs.com/tools/monte-carlo-asset-sim/

## Inputs

- Initial price S0
- Annual drift mu (%) and annual volatility sigma (%)
- Time horizon T (years) and time steps per year
- Number of simulated paths

## Model

```
dS_t = mu * S_t * dt + sigma * S_t * dW_t                      (GBM)
S_{t+dt} = S_t * exp( (mu - sigma^2/2) * dt + sigma * sqrt(dt) * Z ),  Z ~ N(0, 1)
```

The exact log-normal step is used, so there is no discretisation bias in the terminal distribution. Normal draws use the Box-Muller transform. Drift and volatility are constant, and increments are independent.

## Outputs

- Chart of the simulated paths
- Mean terminal price, plus the 5th, 50th and 95th percentiles of the terminal price S_T
- 95% VaR over the horizon, computed as S0 minus the 5th percentile of S_T (in price units and as % of S0)
- Exact log-normal mean and percentiles, for comparison with the simulated values

## Notes

- The (mu - sigma^2/2) term comes from Ito's lemma. It makes E[S_T] = S0 * exp(mu * T) while the median is S0 * exp((mu - sigma^2/2) * T).
- Exact log-normal quantiles are S0 * exp((mu - sigma^2/2) T + z_q sigma sqrt(T)), with z_0.05 = -1.645. With few paths the simulated percentiles are noisy; with 5,000 paths they are within about 1% of the exact values.
- Simulated paths can be used for path-dependent payoffs such as Asian, barrier or lookback options. Pricing them requires simulating under the risk-neutral drift (r - q) instead of mu.
- Educational and analytical use only; not investment advice.
