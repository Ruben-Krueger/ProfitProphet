import { Market, ArbitrageOpportunity } from "./types";
import { findComplementaryArbitrageOpportunities } from "./strategies/complementary";

export default function TradingEngine(
  markets: Market[]
): ArbitrageOpportunity[] {
  const opportunities: ArbitrageOpportunity[] = [
    // Strategy 1: Complementary Arbitrage (buy yes+no, hold to resolution)
    ...findComplementaryArbitrageOpportunities(markets),

    // TODO: Add other strategies here
    // Strategy 2: Semantic Arbitrage
    // Strategy 3: Logical Implication Arbitrage
    // Strategy 4: Temporal Arbitrage
    // Strategy 5: Correlation-Based Arbitrage
  ];

  // Sort all opportunities by expected return (highest first)
  return opportunities.sort((a, b) => b.expectedReturn - a.expectedReturn);
}
