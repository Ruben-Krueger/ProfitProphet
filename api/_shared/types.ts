export interface Market {
  id: string;
  title: string;
  question: string;
  yesPrice: number;
  noPrice: number;
  yesBid: number;
  yesAsk: number;
  noBid: number;
  noAsk: number;
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

export type ArbitrageType = "logical_implication" | "complementary";

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
