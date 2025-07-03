import { Market, ArbitrageOpportunity } from "./types";
import { findSpreadCaptureOpportunities } from "./strategies/spread-capture";

export default function TradingEngine(
  markets: Market[]
): ArbitrageOpportunity[] {
  const opportunities: ArbitrageOpportunity[] = [
    // Strategy 1: Spread Capture Opportunities
    ...findSpreadCaptureOpportunities(markets),

    // TODO: Add other strategies here
    // Strategy 2: Basic Arbitrage
    // Strategy 3: Semantic Arbitrage
    // Strategy 4: Logical Implication Arbitrage
    // Strategy 5: Temporal Arbitrage
    // Strategy 6: Correlation-Based Arbitrage
  ];

  // Sort all opportunities by expected return (highest first)
  return opportunities.sort((a, b) => b.expectedReturn - a.expectedReturn);
}
