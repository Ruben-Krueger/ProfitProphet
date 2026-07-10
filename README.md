# ProphetProfit

Finally, passive income.

ProphetProfit is a platform to find arbitrage opportunities in [Kalshi](https://kalshi.com/) prediction markets.

An hourly job pulls open markets from Kalshi, persists them, and runs them
through a trading engine that scores each one for detectable arbitrage. Found
opportunities are stored and surfaced on a dashboard. 

This is currently a detection system - all orders must be placed manually.

## Trading Strategies

See [api/_shared/strategies/README.md](api/_shared/strategies/README.md) for
how the current strategies work.

### Complementary Arbitrage

Complementary arbitrage occurs when probabilities assigned to an event and its complement do not sum to 100%—for example, assigning a 70% chance that a patient has pneumonia and a 40% chance that they do not have pneumonia, which sums to 110% and is internally inconsistent.

### Logical Implication Arbitrage

Logical implication arbitrage occurs when someone assigns inconsistent probabilities to logically related events—for example, giving a 70% chance that "it will rain" but only a 50% chance that "the ground will be wet," even though rain necessarily implies a wet ground.


