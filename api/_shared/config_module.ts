import { Config } from "./types";

export const loadConfig = (): Config => {
  const requiredEnvVars = [
    "KALSHI_PRIVATE_KEY",
    "KALSHI_KEY_ID",
    "OPENAI_API_KEY",
    "DATABASE_URL",
  ];

  // Check required environment variables
  for (const envVar of requiredEnvVars) {
    if (!process.env[envVar]) {
      throw new Error(`Missing required environment variable: ${envVar}`);
    }
  }

  return {
    kalshi: {
      privateKey: process.env.KALSHI_PRIVATE_KEY!,
      keyId: process.env.KALSHI_KEY_ID!,
      baseUrl: "https://api.elections.kalshi.com/trade-api/v2",
      environment: "production",
    },
    openai: {
      apiKey: process.env.OPENAI_API_KEY!,
      model: process.env.OPENAI_MODEL || "gpt-4",
    },
    strategy: {
      maxInvestment: parseInt(process.env.MAX_INVESTMENT || "1000"),
      minExpectedReturn: parseFloat(process.env.MIN_EXPECTED_RETURN || "0.02"),
      minTimeThreshold: parseInt(process.env.MIN_TIME_THRESHOLD || "1"),
      maxTimeThreshold: parseInt(process.env.MAX_TIME_THRESHOLD || "365"),
      transactionCostPercentage: parseFloat(
        process.env.TRANSACTION_COST_PCT || "0.02"
      ),
      riskTolerance: (process.env.RISK_TOLERANCE as any) || "moderate",
    },
    monitoring: {
      checkIntervalMinutes: parseInt(
        process.env.CHECK_INTERVAL_MINUTES || "15"
      ),
      alertThreshold: parseFloat(process.env.ALERT_THRESHOLD || "0.05"),
      logLevel: (process.env.LOG_LEVEL as any) || "info",
    },
  };
};

export const validateConfig = (config: Config): void => {
  if (
    config.strategy.minExpectedReturn <= 0 ||
    config.strategy.minExpectedReturn >= 1
  ) {
    throw new Error("minExpectedReturn must be between 0 and 1");
  }

  if (config.strategy.maxInvestment <= 0) {
    throw new Error("maxInvestment must be positive");
  }

  if (config.strategy.minTimeThreshold < 0) {
    throw new Error("minTimeThreshold must be non-negative");
  }

  if (config.strategy.maxTimeThreshold <= config.strategy.minTimeThreshold) {
    throw new Error("maxTimeThreshold must be greater than minTimeThreshold");
  }

  if (
    !["conservative", "moderate", "aggressive"].includes(
      config.strategy.riskTolerance
    )
  ) {
    throw new Error(
      "riskTolerance must be conservative, moderate, or aggressive"
    );
  }
};

export default { loadConfig, validateConfig };
