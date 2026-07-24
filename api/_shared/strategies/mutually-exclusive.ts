import { Market, ArbitrageOpportunity, TradingStrategy } from "../types";
import { extractThreshold } from "./logical-implication";

export interface MutuallyExclusiveConfig {
  minEdgePercentage: number; // min guaranteed edge, as a fraction of cost basis
  minVolume: number;
  minOpenInterest: number;
  transactionCostPercentage: number;
  minExpectedReturn: number;
  maxInvestment: number;
  riskTolerance: "conservative" | "moderate" | "aggressive";
  minLegs: number; // fewest markets that form a basket (>= 2)
  maxLegs: number; // cap the basket so it stays fillable in practice
}

export const DEFAULT_MUTUALLY_EXCLUSIVE_CONFIG: MutuallyExclusiveConfig = {
  minEdgePercentage: 0.05, // basket must cost at least 5% less than its guaranteed floor
  minVolume: 100, // minimum volume in contracts (thinnest leg)
  minOpenInterest: 50, // minimum open interest (thinnest leg)
  transactionCostPercentage: 0.02, // 2% transaction costs
  minExpectedReturn: 0.03, // 3% minimum expected return
  maxInvestment: 1000, // maximum $1000 per opportunity
  riskTolerance: "moderate",
  minLegs: 2,
  maxLegs: 12,
};

export interface MutuallyExclusiveMetrics {
  legs: number; // number of markets in the NO basket
  costBasis: number; // Σ noAsk: what one basket (1 NO of each leg) costs to buy
  guaranteedFloor: number; // legs - 1: at most one leg resolves YES, so >= legs-1 NO legs win
  edge: number; // guaranteedFloor - costBasis: guaranteed profit per basket, before fees
  edgePercentage: number; // edge as a fraction of costBasis
  volume: number; // thinnest leg's volume - every leg must fill
  openInterest: number; // thinnest leg's open interest
  daysToExpiry: number; // latest leg's expiry - capital is locked until all resolve
  score: number;
}

const LIQUIDITY_FRACTION_BY_RISK_TOLERANCE: Record<
  MutuallyExclusiveConfig["riskTolerance"],
  number
> = {
  conservative: 0.05,
  moderate: 0.1,
  aggressive: 0.2,
};

/**
 * A group of same-event markets is a threshold ladder (e.g. "BTC above $50k",
 * "BTC above $60k") when its titles carry extractable numeric thresholds. Those
 * markets are NOT mutually exclusive — several can resolve YES at once — so they
 * must never be treated as a dutch-book basket. That relationship is what the
 * logical-implication strategy handles instead.
 */
function isThresholdLadder(markets: Market[]): boolean {
  return markets.some(market => extractThreshold(market.question) !== null);
}

/**
 * Group active markets into candidate mutually-exclusive baskets. Kalshi groups
 * categorical "exactly one outcome" markets (election winners, award winners,
 * bracket outcomes) under a shared eventId, which is the signal we rely on for
 * mutual exclusivity — without any free-text similarity matching. Threshold
 * ladders that share an eventId are excluded because they aren't exclusive.
 */
function findMutuallyExclusiveGroups(markets: Market[]): Market[][] {
  const activeMarkets = markets.filter(market => market.status === "active");

  const groups = new Map<string, Market[]>();
  for (const market of activeMarkets) {
    const group = groups.get(market.eventId);
    if (group) {
      group.push(market);
    } else {
      groups.set(market.eventId, [market]);
    }
  }

  const result: Market[][] = [];
  for (const group of groups.values()) {
    // Need at least two distinct outcomes for the floor (legs - 1) to be positive.
    if (group.length < 2) continue;
    if (isThresholdLadder(group)) continue;
    result.push(group);
  }

  return result;
}

/**
 * Choose which legs actually go into the basket. Every leg with noAsk < $1
 * increases the guaranteed edge (it adds $1 to the floor for less than $1 of
 * cost), so we keep them all — a subset of a mutually-exclusive set is still
 * mutually exclusive, so the floor formula holds for whatever we select. Legs
 * are then capped at maxLegs, keeping the cheapest NO prices (the biggest edge
 * contributors) so the basket stays practical to fill.
 */
function selectBasketLegs(
  group: Market[],
  config: MutuallyExclusiveConfig
): Market[] {
  return group
    .filter(market => market.noAsk > 0 && market.noAsk < 1)
    .sort((a, b) => a.noAsk - b.noAsk)
    .slice(0, config.maxLegs);
}

export function findMutuallyExclusiveArbitrageOpportunities(
  markets: Market[],
  config: MutuallyExclusiveConfig = DEFAULT_MUTUALLY_EXCLUSIVE_CONFIG
): ArbitrageOpportunity[] {
  const opportunities: ArbitrageOpportunity[] = [];

  for (const group of findMutuallyExclusiveGroups(markets)) {
    const legs = selectBasketLegs(group, config);
    if (legs.length < config.minLegs) continue;

    const metrics = calculateMutuallyExclusiveMetrics(legs);

    // Not a real arbitrage if the basket costs at least as much as its floor.
    if (metrics.edge <= 0) continue;

    if (!meetsBasicCriteria(metrics, config)) continue;

    const opportunity = buildOpportunity(legs, metrics, config);

    if (opportunity && opportunity.expectedReturn >= config.minExpectedReturn) {
      opportunities.push(opportunity);
    }
  }

  return opportunities.sort((a, b) => b.expectedReturn - a.expectedReturn);
}

function calculateMutuallyExclusiveMetrics(
  legs: Market[]
): MutuallyExclusiveMetrics {
  const costBasis = legs.reduce((sum, market) => sum + market.noAsk, 0);
  const guaranteedFloor = legs.length - 1;
  const edge = guaranteedFloor - costBasis;
  const edgePercentage = costBasis > 0 ? edge / costBasis : 0;
  const volume = Math.min(...legs.map(market => market.volume));
  const openInterest = Math.min(...legs.map(market => market.openInterest));

  // Capital is tied up until every leg has resolved, so lockup is driven by the
  // latest resolution date in the basket, not the earliest.
  const latestResolution = Math.max(
    ...legs.map(market => market.resolutionDate.getTime())
  );
  const daysToExpiry = Math.max(
    0,
    (latestResolution - Date.now()) / (1000 * 60 * 60 * 24)
  );

  const score = calculateScore({ edgePercentage, volume, openInterest });

  return {
    legs: legs.length,
    costBasis,
    guaranteedFloor,
    edge,
    edgePercentage,
    volume,
    openInterest,
    daysToExpiry,
    score,
  };
}

function calculateScore(metrics: {
  edgePercentage: number;
  volume: number;
  openInterest: number;
}): number {
  if (
    isNaN(metrics.edgePercentage) ||
    isNaN(metrics.volume) ||
    isNaN(metrics.openInterest)
  ) {
    return 0;
  }

  // Edge size component (60% weight) - the actual guaranteed profit margin
  const edgeScore = Math.min(metrics.edgePercentage * 100 * 0.6, 60);

  // Volume component (25% weight) - deeper books make it likelier every leg fills
  const volumeScore = Math.min((metrics.volume / 1000) * 25, 25);

  // Open interest component (15% weight) - established liquidity
  const openInterestScore = Math.min((metrics.openInterest / 500) * 15, 15);

  return Math.min(edgeScore + volumeScore + openInterestScore, 100);
}

function meetsBasicCriteria(
  metrics: MutuallyExclusiveMetrics,
  config: MutuallyExclusiveConfig
): boolean {
  return (
    metrics.edgePercentage >= config.minEdgePercentage &&
    metrics.volume >= config.minVolume &&
    metrics.openInterest >= config.minOpenInterest &&
    metrics.score >= 30
  );
}

function buildOpportunity(
  legs: Market[],
  metrics: MutuallyExclusiveMetrics,
  config: MutuallyExclusiveConfig
): ArbitrageOpportunity | null {
  const { contracts, totalInvestment } = calculatePositionSize(metrics, config);

  if (contracts === 0) return null;

  const expectedReturn = contracts * metrics.edge;
  const transactionCosts = totalInvestment * config.transactionCostPercentage;
  const netReturn = expectedReturn - transactionCosts;

  // Exclusivity/model risk: this trade assumes the event's markets really are
  // mutually exclusive, and every leg has to fill. Like logical implication, it
  // never reads as low risk, and confidence is capped below a single-market
  // strategy's.
  const riskLevel = determineRiskLevel(metrics, config.riskTolerance);
  const confidence = Math.min(metrics.score / 100, 0.7);

  const strategy: TradingStrategy = {
    actions: legs.map(market => ({
      marketId: market.id,
      side: "no" as const,
      price: market.noAsk,
      quantity: contracts,
      orderType: "limit" as const,
    })),
    totalCost: totalInvestment,
    guaranteedReturn: netReturn,
    description: `Mutually-exclusive arbitrage on ${legs[0].eventId}: buy ${contracts} no on each of ${metrics.legs} outcomes at a combined ${(metrics.costBasis * 100).toFixed(1)}c per basket for a guaranteed $${metrics.guaranteedFloor.toFixed(2)} floor`,
  };

  return {
    id: `mutually_exclusive_${legs[0].eventId}_${Date.now()}`,
    type: "mutually_exclusive",
    markets: legs,
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
  metrics: MutuallyExclusiveMetrics,
  config: MutuallyExclusiveConfig
): { contracts: number; totalInvestment: number } {
  const liquidityFraction =
    LIQUIDITY_FRACTION_BY_RISK_TOLERANCE[config.riskTolerance];
  // The thinnest leg gates how many baskets can fill, so size against it.
  const liquidityCap = metrics.volume * metrics.costBasis * liquidityFraction;
  const budget = Math.min(config.maxInvestment, liquidityCap);

  // One contracts count applied to every leg, so the basket stays balanced 1:1:...:1.
  const contracts = Math.floor(budget / metrics.costBasis);
  const totalInvestment = contracts * metrics.costBasis;

  return { contracts, totalInvestment };
}

function determineRiskLevel(
  metrics: MutuallyExclusiveMetrics,
  riskTolerance: MutuallyExclusiveConfig["riskTolerance"]
): "low" | "medium" | "high" {
  const liquidityRisk = metrics.volume < 200 ? 3 : metrics.volume < 500 ? 2 : 1;

  const lockupRisk =
    metrics.daysToExpiry > 90 ? 3 : metrics.daysToExpiry > 30 ? 2 : 1;

  const edgeRisk =
    metrics.edgePercentage < 0.08 ? 3 : metrics.edgePercentage < 0.15 ? 2 : 1;

  // Execution risk grows with the number of legs: every one has to fill at its
  // quoted ask for the basket edge to be real.
  const legsRisk = metrics.legs > 6 ? 3 : metrics.legs > 3 ? 2 : 1;

  const totalRisk = liquidityRisk + lockupRisk + edgeRisk + legsRisk;

  const riskThresholds =
    riskTolerance === "conservative"
      ? { low: 4, medium: 6 }
      : riskTolerance === "moderate"
        ? { low: 5, medium: 7 }
        : { low: 6, medium: 8 };

  // Floored at "medium": this trade also carries exclusivity/model risk that the
  // liquidity/lockup/edge/legs factors alone don't capture.
  if (totalRisk <= riskThresholds.medium) return "medium";
  return "high";
}

function generateReasoning(metrics: MutuallyExclusiveMetrics): string {
  const reasons = [
    `At most one of ${metrics.legs} mutually-exclusive outcomes resolves YES, so buying no on all of them guarantees a $${metrics.guaranteedFloor.toFixed(2)} floor; the basket costs ${(metrics.costBasis * 100).toFixed(1)}c per set (${(metrics.edgePercentage * 100).toFixed(2)}% edge)`,
  ];

  if (metrics.volume > 500) {
    reasons.push(
      `every leg has at least ${metrics.volume} contracts of volume`
    );
  }

  if (metrics.daysToExpiry > 0) {
    reasons.push(`${Math.round(metrics.daysToExpiry)} days until resolution`);
  }

  reasons.push(
    "assumes the event's outcomes are mutually exclusive - verify before acting"
  );

  return reasons.join("; ");
}
