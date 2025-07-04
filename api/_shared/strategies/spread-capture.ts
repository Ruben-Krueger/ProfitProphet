import {
  Market,
  ArbitrageOpportunity,
  SpreadCaptureMetrics,
  TradingStrategy,
} from "../types";

export interface SpreadCaptureConfig {
  minSpreadPercentage: number;
  minVolume: number;
  minOpenInterest: number;
  transactionCostPercentage: number;
  minExpectedReturn: number;
  maxInvestment: number;
  riskTolerance: "conservative" | "moderate" | "aggressive";
}

export const DEFAULT_SPREAD_CAPTURE_CONFIG: SpreadCaptureConfig = {
  minSpreadPercentage: 0.05, // 5% minimum spread
  minVolume: 100, // minimum volume in contracts
  minOpenInterest: 50, // minimum open interest
  transactionCostPercentage: 0.02, // 2% transaction costs
  minExpectedReturn: 0.03, // 3% minimum expected return
  maxInvestment: 1000, // maximum $1000 per opportunity
  riskTolerance: "moderate",
};

export function findSpreadCaptureOpportunities(
  markets: Market[],
  config: SpreadCaptureConfig = DEFAULT_SPREAD_CAPTURE_CONFIG
): ArbitrageOpportunity[] {
  const opportunities: ArbitrageOpportunity[] = [];

  for (const market of markets) {
    // Skip non-active markets
    if (market.status !== "active") continue;

    const metrics = calculateSpreadCaptureMetrics(market);

    // Check if market meets basic criteria
    if (!meetsBasicCriteria(market, metrics, config)) continue;

    // Calculate spread capture opportunity
    const opportunity = calculateSpreadCaptureOpportunity(
      market,
      metrics,
      config
    );

    if (opportunity && opportunity.expectedReturn >= config.minExpectedReturn) {
      opportunities.push(opportunity);
    }
  }

  // Sort by expected return (highest first)
  return opportunities.sort((a, b) => b.expectedReturn - a.expectedReturn);
}

function calculateSpreadCaptureMetrics(market: Market): SpreadCaptureMetrics {
  const yesPrice = market.yesPrice;
  const noPrice = market.noPrice;

  // Calculate bid-ask spread (difference between yes and no prices)
  const bidAskSpread = Math.abs(yesPrice - noPrice);
  const minPrice = Math.min(yesPrice, noPrice);
  const spreadPercentage = minPrice > 0 ? (bidAskSpread / minPrice) * 100 : 0;

  // Calculate implied volatility (simplified - based on price spread and time)
  const impliedVolatility = calculateImpliedVolatility(yesPrice, noPrice);

  // Calculate spread capture score (0-100)
  const spreadCaptureScore = calculateSpreadCaptureScore({
    spreadPercentage,
    volume: market.volume,
    openInterest: market.openInterest,
    impliedVolatility,
  });

  return {
    bidAskSpread,
    spreadPercentage,
    volume24h: market.volume,
    openInterest: market.openInterest,
    impliedVolatility,
    spreadCaptureScore,
  };
}

// Simplified volatility calculation for spread capture
function calculateImpliedVolatility(yesPrice: number, noPrice: number): number {
  // For spread capture, we care about current price dispersion, not time-based volatility
  const priceSpread = Math.abs(yesPrice - noPrice);
  const midPrice = (yesPrice + noPrice) / 2;

  // Handle edge cases to prevent NaN
  if (midPrice === 0 || isNaN(midPrice) || isNaN(priceSpread)) {
    return 25; // Default moderate volatility for edge cases
  }

  // Higher spread relative to mid price indicates higher current volatility
  const volatilityRatio = priceSpread / midPrice;

  // Handle division by zero or invalid results
  if (isNaN(volatilityRatio) || !isFinite(volatilityRatio)) {
    return 25; // Default moderate volatility for invalid calculations
  }

  // For spread capture, we can ignore time to expiry since we're capturing current spreads
  // Just scale to a reasonable range (0-100)
  return Math.min(volatilityRatio * 100, 100);
}

function calculateSpreadCaptureScore(metrics: {
  spreadPercentage: number;
  volume: number;
  openInterest: number;
  impliedVolatility: number;
}): number {
  let score = 0;

  // Handle NaN values
  if (
    isNaN(metrics.spreadPercentage) ||
    isNaN(metrics.volume) ||
    isNaN(metrics.openInterest) ||
    isNaN(metrics.impliedVolatility)
  ) {
    return 0;
  }

  // Spread component (40% weight)
  const spreadScore = Math.min(metrics.spreadPercentage * 10, 40);
  score += spreadScore;

  // Volume component (25% weight)
  const volumeScore = Math.min((metrics.volume / 1000) * 25, 25);
  score += volumeScore;

  // Open interest component (20% weight)
  const openInterestScore = Math.min((metrics.openInterest / 500) * 20, 20);
  score += openInterestScore;

  return Math.min(score, 100);
}

function meetsBasicCriteria(
  market: Market,
  metrics: SpreadCaptureMetrics,
  config: SpreadCaptureConfig
): boolean {
  return (
    metrics.spreadPercentage >= config.minSpreadPercentage &&
    metrics.volume24h >= config.minVolume &&
    metrics.openInterest >= config.minOpenInterest &&
    metrics.spreadCaptureScore >= 30 // Minimum score threshold
  );
}

function calculateSpreadCaptureOpportunity(
  market: Market,
  metrics: SpreadCaptureMetrics,
  config: SpreadCaptureConfig
): ArbitrageOpportunity | null {
  const yesPrice = market.yesPrice;
  const noPrice = market.noPrice;

  // Determine optimal position sizes
  const { yesQuantity, noQuantity, totalInvestment } =
    calculateOptimalPositions(yesPrice, noPrice, metrics, config);

  if (totalInvestment === 0) return null;

  // Calculate expected return
  const expectedReturn = calculateExpectedReturn(
    yesPrice,
    noPrice,
    yesQuantity,
    noQuantity,
    config.transactionCostPercentage
  );

  // Calculate net return after transaction costs
  const netReturn =
    expectedReturn - totalInvestment * config.transactionCostPercentage;

  // Determine risk level based on metrics
  const riskLevel = determineRiskLevel(metrics, config.riskTolerance);

  // Create trading strategy
  const strategy: TradingStrategy = {
    actions: [
      {
        marketId: market.id,
        side: "yes",
        price: yesPrice,
        quantity: yesQuantity,
        orderType: "limit",
      },
      {
        marketId: market.id,
        side: "no",
        price: noPrice,
        quantity: noQuantity,
        orderType: "limit",
      },
    ],
    totalCost: totalInvestment,
    guaranteedReturn: netReturn,
    description: `Spread capture on ${market.title} with ${metrics.spreadPercentage.toFixed(2)}% spread`,
  };

  // Calculate confidence based on spread capture score
  const confidence = Math.min(metrics.spreadCaptureScore / 100, 0.95);

  return {
    id: `spread_capture_${market.id}_${Date.now()}`,
    type: "spread_capture",
    markets: [market],
    expectedReturn: expectedReturn,
    netReturn: netReturn,
    confidence: confidence,
    strategy: strategy,
    reasoning: generateSpreadCaptureReasoning(market, metrics),

    requiredInvestment: totalInvestment,
    riskLevel: riskLevel,
    detectedAt: new Date(),
  };
}

function calculateOptimalPositions(
  yesPrice: number,
  noPrice: number,
  metrics: SpreadCaptureMetrics,
  config: SpreadCaptureConfig
): { yesQuantity: number; noQuantity: number; totalInvestment: number } {
  // Use Kelly Criterion for position sizing
  const spread = Math.abs(yesPrice - noPrice);
  const midPrice = (yesPrice + noPrice) / 2;

  // Calculate Kelly fraction (simplified)
  const winProbability = 0.5; // Spread capture is roughly 50/50
  const winAmount = spread / 2;
  const lossAmount = spread / 2;

  const kellyFraction =
    (winProbability * winAmount - (1 - winProbability) * lossAmount) /
    winAmount;

  // Apply risk tolerance adjustment
  const riskMultiplier =
    config.riskTolerance === "conservative"
      ? 0.25
      : config.riskTolerance === "moderate"
        ? 0.5
        : 0.75;

  const adjustedKelly = Math.max(0, kellyFraction * riskMultiplier);

  // Calculate position sizes
  const maxInvestment = Math.min(
    config.maxInvestment,
    metrics.volume24h * midPrice * 0.1
  );
  const investment = maxInvestment * adjustedKelly;

  const yesQuantity = Math.floor(investment / (2 * yesPrice));
  const noQuantity = Math.floor(investment / (2 * noPrice));

  const totalInvestment = yesQuantity * yesPrice + noQuantity * noPrice;

  return { yesQuantity, noQuantity, totalInvestment };
}

function calculateExpectedReturn(
  yesPrice: number,
  noPrice: number,
  yesQuantity: number,
  noQuantity: number,
  transactionCostPercentage: number
): number {
  const totalInvestment = yesQuantity * yesPrice + noQuantity * noPrice;

  if (totalInvestment === 0) return 0;

  // Expected return from spread capture
  const spread = Math.abs(yesPrice - noPrice);
  const expectedSpreadCapture = spread * Math.min(yesQuantity, noQuantity);

  // Transaction costs
  const transactionCosts = totalInvestment * transactionCostPercentage;

  return expectedSpreadCapture - transactionCosts;
}

function determineRiskLevel(
  metrics: SpreadCaptureMetrics,
  riskTolerance: "conservative" | "moderate" | "aggressive"
): "low" | "medium" | "high" {
  // Risk factors
  const spreadRisk =
    metrics.spreadPercentage < 0.1 ? 3 : metrics.spreadPercentage < 0.2 ? 2 : 1;
  const volumeRisk =
    metrics.volume24h < 200 ? 3 : metrics.volume24h < 500 ? 2 : 1;
  const volatilityRisk =
    metrics.impliedVolatility > 50 ? 3 : metrics.impliedVolatility > 25 ? 2 : 1;

  const totalRisk = spreadRisk + volumeRisk + volatilityRisk;

  // Risk tolerance adjustment
  const riskThreshold =
    riskTolerance === "conservative"
      ? 8
      : riskTolerance === "moderate"
        ? 10
        : 12;

  if (totalRisk <= riskThreshold - 2) return "low";
  if (totalRisk <= riskThreshold) return "medium";
  return "high";
}

function generateSpreadCaptureReasoning(
  market: Market,
  metrics: SpreadCaptureMetrics
): string {
  const reasons = [];

  if (metrics.spreadPercentage > 0.1) {
    reasons.push(`Wide spread of ${metrics.spreadPercentage.toFixed(2)}%`);
  }

  if (metrics.volume24h > 500) {
    reasons.push(`High volume of ${metrics.volume24h} contracts`);
  }

  if (metrics.openInterest > 200) {
    reasons.push(`Good liquidity with ${metrics.openInterest} open interest`);
  }

  if (metrics.spreadCaptureScore > 60) {
    reasons.push(
      `High spread capture score of ${metrics.spreadCaptureScore.toFixed(1)}`
    );
  }

  return reasons.join(", ") || "Basic spread capture opportunity";
}
