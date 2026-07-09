import { Market, ArbitrageOpportunity, TradingStrategy } from "../types";

export interface LogicalImplicationConfig {
  minEdgePercentage: number; // min discount vs $1 payout, as a fraction of cost basis
  minVolume: number;
  minOpenInterest: number;
  transactionCostPercentage: number;
  minExpectedReturn: number;
  maxInvestment: number;
  riskTolerance: "conservative" | "moderate" | "aggressive";
}

export const DEFAULT_LOGICAL_IMPLICATION_CONFIG: LogicalImplicationConfig = {
  minEdgePercentage: 0.05, // pair must cost at least 5% less than the $1 payout
  minVolume: 100, // minimum volume in contracts
  minOpenInterest: 50, // minimum open interest
  transactionCostPercentage: 0.02, // 2% transaction costs
  minExpectedReturn: 0.03, // 3% minimum expected return
  maxInvestment: 1000, // maximum $1000 per opportunity
  riskTolerance: "moderate",
};

export interface LogicalImplicationMetrics {
  costBasis: number; // yesAsk(implied) + noAsk(implying): what you'd actually pay to buy both legs
  edge: number; // 1.00 - costBasis: guaranteed profit per matched pair, before fees
  edgePercentage: number; // edge as a fraction of costBasis
  volume: number; // thinner of the two markets' volumes - both legs must fill
  openInterest: number; // thinner of the two markets' open interest
  daysToExpiry: number;
  score: number;
}

export interface ThresholdExtraction {
  value: number;
  direction: "above" | "below";
}

const LIQUIDITY_FRACTION_BY_RISK_TOLERANCE: Record<
  LogicalImplicationConfig["riskTolerance"],
  number
> = {
  conservative: 0.05,
  moderate: 0.1,
  aggressive: 0.2,
};

// TODO: replace with LLM-based detection
// Deliberately narrow: one keyword phrase + one number, or skip. No partial/best-guess matches.
const ABOVE_PATTERN =
  /\b(?:above|over|exceed(?:s)?|more than|at least|or more|or higher)\b\D{0,10}\$?([\d,]+(?:\.\d+)?)\s*([km%])?/i;
const BELOW_PATTERN =
  /\b(?:below|under|less than|at most|or less|or lower)\b\D{0,10}\$?([\d,]+(?:\.\d+)?)\s*([km%])?/i;

export function extractThreshold(text: string): ThresholdExtraction | null {
  const aboveMatch = text.match(ABOVE_PATTERN);
  const belowMatch = text.match(BELOW_PATTERN);

  // Ambiguous if both or neither pattern matches.
  if (!aboveMatch === !belowMatch) return null;

  const match = aboveMatch ?? belowMatch;
  if (!match) return null;

  const rawValue = parseFloat(match[1].replace(/,/g, ""));
  if (isNaN(rawValue)) return null;

  const suffix = match[2]?.toLowerCase();
  const value =
    suffix === "k"
      ? rawValue * 1_000
      : suffix === "m"
        ? rawValue * 1_000_000
        : rawValue;

  return { value, direction: aboveMatch ? "above" : "below" };
}

interface ImplicationPair {
  implied: Market; // "A" - the weaker claim
  implying: Market; // "B" - the stronger claim; implying resolving YES forces implied YES
}

function findImplicationPairs(markets: Market[]): ImplicationPair[] {
  const activeMarkets = markets.filter(market => market.status === "active");

  const groups = new Map<string, Market[]>();
  for (const market of activeMarkets) {
    const key = `${market.eventId}::${market.resolutionDate.getTime()}`;
    const group = groups.get(key);
    if (group) {
      group.push(market);
    } else {
      groups.set(key, [market]);
    }
  }

  const pairs: ImplicationPair[] = [];

  for (const group of groups.values()) {
    if (group.length < 2) continue;

    const extracted = group
      .map(market => ({ market, threshold: extractThreshold(market.question) }))
      .filter(
        (entry): entry is { market: Market; threshold: ThresholdExtraction } =>
          entry.threshold !== null
      );

    const byDirection = {
      above: extracted.filter(entry => entry.threshold.direction === "above"),
      below: extracted.filter(entry => entry.threshold.direction === "below"),
    };

    for (const direction of ["above", "below"] as const) {
      const entries = byDirection[direction];

      for (let i = 0; i < entries.length; i++) {
        for (let j = i + 1; j < entries.length; j++) {
          const a = entries[i];
          const b = entries[j];
          if (a.threshold.value === b.threshold.value) continue;

          // "above": the higher threshold implies the lower one.
          // "below": the lower threshold implies the higher one.
          const [implied, implying] =
            direction === "above"
              ? a.threshold.value < b.threshold.value
                ? [a.market, b.market]
                : [b.market, a.market]
              : a.threshold.value < b.threshold.value
                ? [b.market, a.market]
                : [a.market, b.market];

          pairs.push({ implied, implying });
        }
      }
    }
  }

  return pairs;
}

export function findLogicalImplicationOpportunities(
  markets: Market[],
  config: LogicalImplicationConfig = DEFAULT_LOGICAL_IMPLICATION_CONFIG
): ArbitrageOpportunity[] {
  const opportunities: ArbitrageOpportunity[] = [];

  for (const pair of findImplicationPairs(markets)) {
    const metrics = calculateLogicalImplicationMetrics(pair);

    // Not a real arbitrage if buying both legs costs at least as much as the payout.
    if (metrics.edge <= 0) continue;

    if (!meetsBasicCriteria(metrics, config)) continue;

    const opportunity = buildOpportunity(pair, metrics, config);

    if (opportunity && opportunity.expectedReturn >= config.minExpectedReturn) {
      opportunities.push(opportunity);
    }
  }

  return opportunities.sort((a, b) => b.expectedReturn - a.expectedReturn);
}

function calculateLogicalImplicationMetrics(
  pair: ImplicationPair
): LogicalImplicationMetrics {
  const costBasis = pair.implied.yesAsk + pair.implying.noAsk;
  const edge = 1 - costBasis;
  const edgePercentage = costBasis > 0 ? edge / costBasis : 0;
  const volume = Math.min(pair.implied.volume, pair.implying.volume);
  const openInterest = Math.min(
    pair.implied.openInterest,
    pair.implying.openInterest
  );
  const daysToExpiry = Math.max(
    0,
    (pair.implied.resolutionDate.getTime() - Date.now()) / (1000 * 60 * 60 * 24)
  );

  const score = calculateScore({ edgePercentage, volume, openInterest });

  return {
    costBasis,
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

  const edgeScore = Math.min(metrics.edgePercentage * 100 * 0.6, 60);
  const volumeScore = Math.min((metrics.volume / 1000) * 25, 25);
  const openInterestScore = Math.min((metrics.openInterest / 500) * 15, 15);

  return Math.min(edgeScore + volumeScore + openInterestScore, 100);
}

function meetsBasicCriteria(
  metrics: LogicalImplicationMetrics,
  config: LogicalImplicationConfig
): boolean {
  return (
    metrics.edgePercentage >= config.minEdgePercentage &&
    metrics.volume >= config.minVolume &&
    metrics.openInterest >= config.minOpenInterest &&
    metrics.score >= 30
  );
}

function buildOpportunity(
  pair: ImplicationPair,
  metrics: LogicalImplicationMetrics,
  config: LogicalImplicationConfig
): ArbitrageOpportunity | null {
  const { contracts, totalInvestment } = calculatePositionSize(metrics, config);

  if (contracts === 0) return null;

  const expectedReturn = contracts * metrics.edge;
  const transactionCosts = totalInvestment * config.transactionCostPercentage;
  const netReturn = expectedReturn - transactionCosts;

  // Extraction/model risk: this trade depends on two independently-parsed
  // titles actually describing the same underlying metric, so risk never
  // reads as low, and confidence is capped lower than a single-market strategy.
  const riskLevel = determineRiskLevel(metrics, config.riskTolerance);
  const confidence = Math.min(metrics.score / 100, 0.75);

  const strategy: TradingStrategy = {
    actions: [
      {
        marketId: pair.implied.id,
        side: "yes",
        price: pair.implied.yesAsk,
        quantity: contracts,
        orderType: "limit",
      },
      {
        marketId: pair.implying.id,
        side: "no",
        price: pair.implying.noAsk,
        quantity: contracts,
        orderType: "limit",
      },
    ],
    totalCost: totalInvestment,
    guaranteedReturn: netReturn,
    description: `Logical implication arbitrage: buy ${contracts} yes on "${pair.implied.title}" + ${contracts} no on "${pair.implying.title}" at a combined ${(metrics.costBasis * 100).toFixed(1)}c per pair`,
  };

  return {
    id: `logical_implication_${pair.implied.id}_${pair.implying.id}_${Date.now()}`,
    type: "logical_implication",
    markets: [pair.implied, pair.implying],
    expectedReturn,
    netReturn,
    confidence,
    strategy,
    reasoning: generateReasoning(pair, metrics),
    requiredInvestment: totalInvestment,
    riskLevel,
    detectedAt: new Date(),
  };
}

function calculatePositionSize(
  metrics: LogicalImplicationMetrics,
  config: LogicalImplicationConfig
): { contracts: number; totalInvestment: number } {
  const liquidityFraction =
    LIQUIDITY_FRACTION_BY_RISK_TOLERANCE[config.riskTolerance];
  const liquidityCap = metrics.volume * metrics.costBasis * liquidityFraction;
  const budget = Math.min(config.maxInvestment, liquidityCap);

  const contracts = Math.floor(budget / metrics.costBasis);
  const totalInvestment = contracts * metrics.costBasis;

  return { contracts, totalInvestment };
}

function determineRiskLevel(
  metrics: LogicalImplicationMetrics,
  riskTolerance: LogicalImplicationConfig["riskTolerance"]
): "low" | "medium" | "high" {
  const liquidityRisk = metrics.volume < 200 ? 3 : metrics.volume < 500 ? 2 : 1;

  const lockupRisk =
    metrics.daysToExpiry > 90 ? 3 : metrics.daysToExpiry > 30 ? 2 : 1;

  const edgeRisk =
    metrics.edgePercentage < 0.08 ? 3 : metrics.edgePercentage < 0.15 ? 2 : 1;

  const totalRisk = liquidityRisk + lockupRisk + edgeRisk;

  const riskThresholds =
    riskTolerance === "conservative"
      ? { low: 3, medium: 5 }
      : riskTolerance === "moderate"
        ? { low: 4, medium: 6 }
        : { low: 5, medium: 7 };

  // Floored at "medium": this trade also carries extraction/model risk that
  // liquidity/lockup/edge factors alone don't capture.
  if (totalRisk <= riskThresholds.medium) return "medium";
  return "high";
}

function generateReasoning(
  pair: ImplicationPair,
  metrics: LogicalImplicationMetrics
): string {
  const reasons = [
    `"${pair.implying.title}" implies "${pair.implied.title}"; buying yes(implied)+no(implying) costs ${(metrics.costBasis * 100).toFixed(1)}c for a guaranteed $1.00 payout (${(metrics.edgePercentage * 100).toFixed(2)}% edge)`,
  ];

  if (metrics.volume > 500) {
    reasons.push(
      `both markets have at least ${metrics.volume} contracts of volume`
    );
  }

  if (metrics.daysToExpiry > 0) {
    reasons.push(`${Math.round(metrics.daysToExpiry)} days until resolution`);
  }

  reasons.push(
    "based on automated title parsing - verify the implication holds before acting"
  );

  return reasons.join("; ");
}
