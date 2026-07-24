import { Market, ArbitrageOpportunity, TradingStrategy } from "../types";

export interface ComplementaryArbitrageConfig {
  minEdgePercentage: number; // min discount vs $1 payout, as a fraction of cost basis
  minVolume: number;
  minOpenInterest: number;
  transactionCostPercentage: number;
  minExpectedReturn: number;
  maxInvestment: number;
  riskTolerance: "conservative" | "moderate" | "aggressive";
}

export const DEFAULT_COMPLEMENTARY_ARBITRAGE_CONFIG: ComplementaryArbitrageConfig =
  {
    minEdgePercentage: 0.05, // pair must cost at least 5% less than the $1 payout
    minVolume: 100, // minimum volume in contracts
    minOpenInterest: 50, // minimum open interest
    transactionCostPercentage: 0.02, // 2% transaction costs
    minExpectedReturn: 0.03, // 3% minimum expected return
    maxInvestment: 1000, // maximum $1000 per opportunity
    riskTolerance: "moderate",
  };

export interface ComplementaryArbitrageMetrics {
  costBasis: number; // yesAsk + noAsk: what you'd actually pay to buy both legs
  edge: number; // 1.00 - costBasis: guaranteed profit per matched pair, before fees
  edgePercentage: number; // edge as a fraction of costBasis
  volume: number;
  openInterest: number;
  daysToExpiry: number;
  score: number;
}

const LIQUIDITY_FRACTION_BY_RISK_TOLERANCE: Record<
  ComplementaryArbitrageConfig["riskTolerance"],
  number
> = {
  conservative: 0.05,
  moderate: 0.1,
  aggressive: 0.2,
};

export function findComplementaryArbitrageOpportunities(
  markets: Market[],
  config: ComplementaryArbitrageConfig = DEFAULT_COMPLEMENTARY_ARBITRAGE_CONFIG
): ArbitrageOpportunity[] {
  const opportunities: ArbitrageOpportunity[] = [];

  for (const market of markets) {
    if (market.status !== "active") continue;

    const metrics = calculateComplementaryArbitrageMetrics(market);

    // Not a real arbitrage if buying both legs costs at least as much as the payout.
    if (metrics.edge <= 0) continue;

    if (!meetsBasicCriteria(metrics, config)) continue;

    const opportunity = buildOpportunity(market, metrics, config);

    if (opportunity && opportunity.expectedReturn >= config.minExpectedReturn) {
      opportunities.push(opportunity);
    }
  }

  return opportunities.sort((a, b) => b.expectedReturn - a.expectedReturn);
}

function calculateComplementaryArbitrageMetrics(
  market: Market
): ComplementaryArbitrageMetrics {
  const costBasis = market.yesAsk + market.noAsk;
  const edge = 1 - costBasis;
  const edgePercentage = costBasis > 0 ? edge / costBasis : 0;
  const daysToExpiry = Math.max(
    0,
    (market.resolutionDate.getTime() - Date.now()) / (1000 * 60 * 60 * 24)
  );

  const score = calculateScore({
    edgePercentage,
    volume: market.volume,
    openInterest: market.openInterest,
  });

  return {
    costBasis,
    edge,
    edgePercentage,
    volume: market.volume,
    openInterest: market.openInterest,
    daysToExpiry,
    score,
  };
}

function calculateScore(metrics: {
  edgePercentage: number;
  volume: number;
  openInterest: number;
}): number {
  // Edge size component (60% weight) - the actual guaranteed profit margin
  const edgeScore = Math.min(metrics.edgePercentage * 100 * 0.6, 60);

  // Volume component (25% weight) - deeper books make it more likely both legs fill at ask
  const volumeScore = Math.min((metrics.volume / 1000) * 25, 25);

  // Open interest component (15% weight) - established liquidity
  const openInterestScore = Math.min((metrics.openInterest / 500) * 15, 15);

  return Math.min(edgeScore + volumeScore + openInterestScore, 100);
}

function meetsBasicCriteria(
  metrics: ComplementaryArbitrageMetrics,
  config: ComplementaryArbitrageConfig
): boolean {
  return (
    metrics.edgePercentage >= config.minEdgePercentage &&
    metrics.volume >= config.minVolume &&
    metrics.openInterest >= config.minOpenInterest &&
    metrics.score >= 30 // Minimum score threshold
  );
}

function buildOpportunity(
  market: Market,
  metrics: ComplementaryArbitrageMetrics,
  config: ComplementaryArbitrageConfig
): ArbitrageOpportunity | null {
  const { contracts, totalInvestment } = calculatePositionSize(
    market,
    metrics,
    config
  );

  if (contracts === 0) return null;

  // Guaranteed gross profit: one matched yes+no pair pays exactly $1 at resolution
  const expectedReturn = contracts * metrics.edge;
  const transactionCosts = totalInvestment * config.transactionCostPercentage;
  const netReturn = expectedReturn - transactionCosts;

  const riskLevel = determineRiskLevel(metrics, config.riskTolerance);

  const strategy: TradingStrategy = {
    actions: [
      {
        marketId: market.id,
        side: "yes",
        price: market.yesAsk,
        quantity: contracts,
        orderType: "limit",
      },
      {
        marketId: market.id,
        side: "no",
        price: market.noAsk,
        quantity: contracts,
        orderType: "limit",
      },
    ],
    totalCost: totalInvestment,
    guaranteedReturn: netReturn,
    description: `Complementary arbitrage on ${market.title}: buy ${contracts} yes + ${contracts} no at a combined ${(metrics.costBasis * 100).toFixed(1)}c per pair`,
  };

  const confidence = Math.min(metrics.score / 100, 0.95);

  return {
    id: `complementary_${market.id}_${Date.now()}`,
    type: "complementary",
    markets: [market],
    expectedReturn,
    netReturn,
    confidence,
    strategy,
    reasoning: generateReasoning(metrics),
    requiredInvestment: totalInvestment,
    riskLevel,
    detectedAt: new Date(),
  };
}

function calculatePositionSize(
  market: Market,
  metrics: ComplementaryArbitrageMetrics,
  config: ComplementaryArbitrageConfig
): { contracts: number; totalInvestment: number } {
  // This is a deterministic payout, not a probabilistic bet, so sizing is
  // constrained by capital and liquidity rather than a win-probability formula.
  const liquidityFraction =
    LIQUIDITY_FRACTION_BY_RISK_TOLERANCE[config.riskTolerance];
  const liquidityCap = market.volume * metrics.costBasis * liquidityFraction;
  const budget = Math.min(config.maxInvestment, liquidityCap);

  // A single contracts count applied to both legs, so they stay matched 1:1.
  const contracts = Math.floor(budget / metrics.costBasis);
  const totalInvestment = contracts * metrics.costBasis;

  return { contracts, totalInvestment };
}

function determineRiskLevel(
  metrics: ComplementaryArbitrageMetrics,
  riskTolerance: ComplementaryArbitrageConfig["riskTolerance"]
): "low" | "medium" | "high" {
  // Fill/execution risk: thin books make it harder to fill both legs at the quoted ask.
  const liquidityRisk = metrics.volume < 200 ? 3 : metrics.volume < 500 ? 2 : 1;

  // Capital lockup risk: longer time to resolution ties up capital for longer.
  const lockupRisk =
    metrics.daysToExpiry > 90 ? 3 : metrics.daysToExpiry > 30 ? 2 : 1;

  // Slippage sensitivity: a thinner edge is more easily wiped out by fill slippage.
  const edgeRisk =
    metrics.edgePercentage < 0.08 ? 3 : metrics.edgePercentage < 0.15 ? 2 : 1;

  const totalRisk = liquidityRisk + lockupRisk + edgeRisk;

  const riskThresholds =
    riskTolerance === "conservative"
      ? { low: 3, medium: 5 }
      : riskTolerance === "moderate"
        ? { low: 4, medium: 6 }
        : { low: 5, medium: 7 };

  if (totalRisk <= riskThresholds.low) return "low";
  if (totalRisk <= riskThresholds.medium) return "medium";
  return "high";
}

function generateReasoning(metrics: ComplementaryArbitrageMetrics): string {
  const reasons = [
    `Buying yes+no together costs ${(metrics.costBasis * 100).toFixed(1)}c for a guaranteed $1.00 payout at resolution (${(metrics.edgePercentage * 100).toFixed(2)}% edge)`,
  ];

  if (metrics.volume > 500) {
    reasons.push(
      `high volume of ${metrics.volume} contracts supports filling both legs`
    );
  }

  if (metrics.openInterest > 200) {
    reasons.push(
      `open interest of ${metrics.openInterest} indicates established liquidity`
    );
  }

  if (metrics.daysToExpiry > 0) {
    reasons.push(`${Math.round(metrics.daysToExpiry)} days until resolution`);
  }

  return reasons.join("; ");
}
