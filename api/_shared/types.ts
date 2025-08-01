export interface Market {
  id: string;
  title: string;
  question: string;
  yesPrice: number;
  noPrice: number;
  volume: number;
  openInterest: number;
  resolutionDate: Date;
  category: string;
  subtitle?: string;
  eventId: string;
  status: "active" | "closed" | "settled";
  lastUpdated: Date;
}

export interface ArbitrageOpportunity {
  id: string;
  type: ArbitrageType;
  markets: Market[];
  expectedReturn: number;
  netReturn: number; // after transaction costs
  confidence: number;
  strategy: TradingStrategy;
  reasoning: string;
  requiredInvestment: number;
  riskLevel: "low" | "medium" | "high";
  detectedAt: Date;
}

export type ArbitrageType =
  | "semantic"
  | "logical_implication"
  | "temporal"
  | "complementary"
  | "correlation"
  | "synthetic"
  | "spread_capture";

export interface TradingStrategy {
  actions: TradingAction[];
  totalCost: number;
  guaranteedReturn: number;
  description: string;
}

export interface TradingAction {
  marketId: string;
  side: "yes" | "no";
  price: number;
  quantity: number;
  orderType: "limit" | "market";
}

export interface Config {
  kalshi: {
    privateKey: string;
    keyId: string;
    baseUrl: string;
    environment: "production";
  };
  openai: {
    apiKey: string;
    model: string;
  };
  strategy: {
    maxInvestment: number;
    minExpectedReturn: number;
    minTimeThreshold: number; // days
    maxTimeThreshold: number;
    transactionCostPercentage: number;
    riskTolerance: "conservative" | "moderate" | "aggressive";
  };
  monitoring: {
    checkIntervalMinutes: number;
    alertThreshold: number;
    logLevel: "debug" | "info" | "warn" | "error";
  };
}

export interface SemanticSimilarity {
  market1: Market;
  market2: Market;
  similarity: number;
  reasoning: string;
}

export interface ImplicationRule {
  higherThreshold: number;
  lowerThreshold: number;
  metric: string;
  direction: "above" | "below";
}

export interface CorrelationRule {
  pattern1: RegExp;
  pattern2: RegExp;
  expectedCorrelation: number;
  description: string;
}

export interface ArbitrageResult {
  opportunities: ArbitrageOpportunity[];
  totalOpportunities: number;
  totalPotentialReturn: number;
  executionTime: number;
  marketDataTimestamp: Date;
}

// Utility types for market analysis
export interface MarketMetrics {
  impliedProbability: number;
  spread: number;
  liquidity: number;
  volatility: number;
  timeDecay: number;
}

export interface NumericalExtraction {
  value: number;
  metric: string;
  direction: "above" | "below" | "equal";
  unit?: string;
}

export interface SpreadCaptureMetrics {
  bidAskSpread: number;
  spreadPercentage: number;
  volume24h: number;
  openInterest: number;
  impliedVolatility: number;
  spreadCaptureScore: number;
}
