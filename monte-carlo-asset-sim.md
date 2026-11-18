# Monte Carlo Asset Path Simulator

> Client-side Monte Carlo simulator of asset price paths under Geometric Brownian Motion (GBM), with terminal-price percentiles.
> URL: https://quantcore-labs.com/tools/monte-carlo-asset-sim/

## Inputs

- Initial price S0
- Annual drift mu (%) and annual volatility sigma (%)
- Time horizon T (years) and time steps per year
- Number of simulated paths (5 to 20,000; default 5,000; at most 10 million time steps in total)
- Random seed (optional): the same seed reproduces the same paths exactly

## Model

```
dS_t = mu * S_t * dt + sigma * S_t * dW_t                      (GBM)
S_{t+dt} = S_t * exp( (mu - sigma^2/2) * dt + sigma * sqrt(dt) * Z ),  Z ~ N(0, 1)
```

The exact log-normal step is used, so there is no discretisation bias in the terminal distribution. Uniform draws come from the Mersenne Twister (MT19937) and are turned into normal draws with the Box-Muller transform; the algorithm is labelled qcl-mc-v2/mt19937-bm-v1 on each result. Drift and volatility are constant, and increments are independent.

## Outputs

- Chart of the simulated paths
- Mean terminal price, plus the 5th, 50th and 95th percentiles of the terminal price S_T
- 95% VaR over the horizon, computed as S0 minus the 5th percentile of S_T (in price units and as % of S0)
- Exact log-normal mean and percentiles, for comparison with the simulated values
- The 95% sampling range of the simulated 5th percentile: 1.96 * sqrt(0.05 * 0.95 / N) / f(q_0.05), with f the log-normal density; about ±0.90 for S0 = 100, sigma = 20%, T = 1 and N = 5,000 (286 of 300 seeded runs fell inside)
- Maximum drawdown per path: mean, median and 95th percentile across paths

## Notes

- The (mu - sigma^2/2) term comes from Ito's lemma. It makes E[S_T] = S0 * exp(mu * T) while the median is S0 * exp((mu - sigma^2/2) * T).
- Exact log-normal quantiles are S0 * exp((mu - sigma^2/2) T + z_q sigma sqrt(T)), with z_0.05 = -1.645. With few paths the simulated percentiles are noisy; with 5,000 paths the 5th percentile is typically within about 1.2% of its exact value. Below 5,000 paths the page flags tail figures as noisy.
- Simulated paths can be used for path-dependent payoffs such as Asian, barrier or lookback options. Pricing them requires simulating under the risk-neutral drift (r - q) instead of mu.
- Educational and analytical use only; not investment advice.
