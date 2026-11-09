# Probability of Informed Trading (PIN)

> The share of trading that the Easley-Kiefer-O'Hara-Paperman model attributes to informed traders, given the chance of an information event and the arrival rates of informed and uninformed orders.
> URL: https://quantcore-labs.com/glossary/pin-informed-trading/

Category: Market Microstructure & Order Flow. Term ID: `pin-informed-trading`.

## Definition

PIN is the model's probability that the next trade comes from an informed trader. An information event occurs with probability α. If it does, informed orders arrive at rate μ, on the buy side or the sell side according to the news. Uninformed buys and sells arrive at rates ε_b and ε_s whether or not there was news. PIN is the expected informed arrival divided by the expected total arrival. Estimating α, μ and the epsilons is a separate maximum-likelihood problem on daily buy and sell counts. This page evaluates the formula once those parameters are in hand. It does not fit them.

## Formula

```
PIN = α μ / (α μ + ε_b + ε_s)

α   probability of an information event, in [0, 1]
μ   arrival rate of informed traders when there is news
ε_b, ε_s  arrival rates of uninformed buyers and sellers

The denominator is the expected rate of all trades.
PIN is between 0 and 1 when the inputs are valid.
```

## What you do with the parameters

- Once a fit exists, PIN summarises it in one number. Comparing PIN across names is comparing those fits, so the count data, the day length and the optimiser have to be the same kind of exercise.
- The high-frequency imbalance that is often used in place of a daily fit is [VPIN](https://quantcore-labs.com/glossary/vpin/). It does not estimate α and μ.
- A price-impact slope is a different object again: [Kyle's lambda](https://quantcore-labs.com/glossary/kyles-lambda/).

## Pitfalls

- **The formula is not the estimator.** The likelihood is a mixture of Poissons and it has well known local maxima, including the buy-sell symmetry of the original model. A closed form for PIN does not remove that. This function will happily turn a bad fit into a precise-looking ratio.
- **Buys and sells must be classified first.** The classic papers use a trade-classification algorithm. Different signs, different PIN.
- **Zero total intensity.** If every rate is zero the ratio is undefined. The function raises.

## Python reference implementation

Requires standard library. Tested before publication and re-executed with assertions on every rebuild. MIT licensed. Raw file: https://quantcore-labs.com/glossary/pin-informed-trading/pin-informed-trading.py

```python
def pin(alpha, mu, eps_b, eps_s) -> float:
    """PIN = alpha*mu / (alpha*mu + eps_b + eps_s). Evaluates parameters; does not estimate them."""
    alpha, mu, eps_b, eps_s = float(alpha), float(mu), float(eps_b), float(eps_s)
    if not 0.0 <= alpha <= 1.0:
        raise ValueError("alpha must be in [0, 1]")
    if mu < 0 or eps_b < 0 or eps_s < 0:
        raise ValueError("arrival rates must be non-negative")
    informed = alpha * mu
    total = informed + eps_b + eps_s
    if total <= 0:
        raise ValueError("total arrival rate must be positive")
    return informed / total
```

## FAQ

**Why doesn't this page estimate PIN?**

The estimate is a constrained maximum-likelihood fit of a Poisson mixture, and the likelihood is not concave. A short optimiser pasted into a glossary page would look authoritative and land in local maxima. The page publishes the map from parameters to PIN, which is the part with a closed form.

**What does a PIN of 0.2 mean?**

Inside the model, one trade in five is from an informed trader, at the estimated arrival rates. Outside the model it is only as meaningful as the fit. It is not a probability you can read off the tape without estimating the parameters.

## Related

- [Volume-Synchronized Probability of Informed Trading (VPIN)](https://quantcore-labs.com/glossary/vpin/)
- [Kyle's Lambda](https://quantcore-labs.com/glossary/kyles-lambda/)
- [Order Flow Imbalance (OFI)](https://quantcore-labs.com/glossary/ofi/)

