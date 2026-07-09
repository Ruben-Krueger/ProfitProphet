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

Arbitrage by buying trades where the probabilities do not sum to 1. 

### Logical Implication Arbitrage


