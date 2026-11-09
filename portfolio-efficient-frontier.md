# Markowitz Efficient Frontier Calculator

> Client-side long-only mean-variance tool for three assets: exact maximum-Sharpe (tangency) portfolio, exact efficient frontier, capital market line and minimum-variance portfolio.
> URL: https://quantcore-labs.com/tools/portfolio-efficient-frontier/

## Inputs

- Expected annual return and volatility for three assets
- Pairwise correlations rho_12, rho_13, rho_23 (default 0.3). The page rejects combinations that do not form a positive-definite covariance matrix.
- Risk-free rate R_f (%)
- Number of random portfolios to display (visual only; it does not affect the optimum)

## Method

```
Sigma_ij = sigma_i * sigma_j * rho_ij
R_p      = sum_i w_i * mu_i
sigma_p  = sqrt( w' Sigma w )
Sharpe   = (R_p - R_f) / sigma_p
Weights: w_i >= 0, sum_i w_i = 1   (long-only, fully invested)

Max Sharpe (exact): for every subset A of assets, solve Sigma_A z = mu_A - R_f;
                    keep solutions with all z > 0, normalise w = z / sum(z), pick the best.
                    (KKT conditions guarantee the long-only optimum is one of these.)
Frontier (exact):   for target return R the feasible set {sum w = 1, mu.w = R, w >= 0}
                    is a line segment w0 + t d; the minimum-variance point is found in closed form.
CML:                R = R_f + Sharpe* x sigma, through the max-Sharpe portfolio.
Random portfolios:  Dirichlet(1,1,1), uniform over the weight simplex.
```

## Outputs

- Max-Sharpe portfolio: Sharpe ratio, expected return, volatility, weights
- Minimum-variance portfolio: volatility, return, weights
- Chart: random portfolios, efficient frontier (solid; inefficient branch dashed), capital market line, single assets

## Validation

Across 167 random parameter sets with correlations from −0.8 to 0.8, the max-Sharpe result matches SciPy SLSQP to within 1.4e−10. No portfolio on a 0.5% weight grid beats it. The frontier minimum variance matches SLSQP at the target return.

## Notes

- Mean-variance weights are very sensitive to expected-return inputs; small changes can move the allocation a lot.
- Educational and analytical use only; not investment advice.
