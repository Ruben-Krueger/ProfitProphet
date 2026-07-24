import { Market, ArbitrageOpportunity } from "./types";
import { findComplementaryArbitrageOpportunities } from "./strategies/complementary";
import { findLogicalImplicationOpportunities } from "./strategies/logical-implication";
import { findMutuallyExclusiveArbitrageOpportunities } from "./strategies/mutually-exclusive";

export default function TradingEngine(
  markets: Market[]
): ArbitrageOpportunity[] {
  const opportunities: ArbitrageOpportunity[] = [
    // Strategy 1: Complementary Arbitrage (buy yes+no, hold to resolution)
    ...findComplementaryArbitrageOpportunities(markets),

    // Strategy 2: Logical Implication Arbitrage (buy yes(implied)+no(implying))
    ...findLogicalImplicationOpportunities(markets),

    // Strategy 3: Mutually-Exclusive Set Arbitrage (buy no on every outcome)
    ...findMutuallyExclusiveArbitrageOpportunities(markets),

    // TODO: Add other strategies here
    // Strategy 4: Temporal Arbitrage
    // Strategy 5: Correlation-Based Arbitrage
  ];

  // Sort all opportunities by expected return (highest first)
  return opportunities.sort((a, b) => b.expectedReturn - a.expectedReturn);
}
