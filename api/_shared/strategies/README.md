# Trading Strategies

This directory contains individual trading strategies that can be used by the
main trading engine.

## Spread Capture Strategy

The spread capture strategy identifies profit opportunities in prediction
markets by exploiting price discrepancies between the "yes" and "no" sides of
the same market. In prediction markets, the sum of yes and no prices should
theoretically equal 1.0 (or 100%), representing the total probability space.
However, market inefficiencies, liquidity constraints, and trader behavior often
create spreads where yes + no ≠ 1.0.

When a significant spread exists, the strategy takes simultaneous positions on
both sides of the market. For example, if a market has yes at $0.45 and no at
$0.50 (total = $0.95), the strategy would buy both positions, effectively paying
$0.95 for a guaranteed $1.00 payout at resolution. The $0.05 difference
represents the profit opportunity, minus transaction costs and the time value of
money.

The strategy uses a multi-factor scoring system to evaluate opportunities,
considering factors like spread size, trading volume, open interest, time to
expiry, and implied volatility. It employs Kelly Criterion position sizing to
optimize risk-adjusted returns while managing exposure based on configurable
risk tolerance levels.

This approach is more accurately described as statistical arbitrage rather than
traditional market making, as it relies on mean reversion of price spreads
rather than providing continuous liquidity. The strategy works best in markets
with sufficient liquidity, reasonable time horizons, and clear resolution
criteria.
