
import { Config } from '../types';

export const loadConfig = (): Config => {
  const requiredEnvVars = [
    'KALSHI_API_KEY',
    'OPENAI_API_KEY'
  ];

  // Check required environment variables
  for (const envVar of requiredEnvVars) {
    if (!process.env[envVar]) {
      throw new Error(`Missing required environment variable: ${envVar}`);
    }
  }

  return {
    kalshi: {
      apiKey: process.env.KALSHI_API_KEY!,
      baseUrl: process.env.KALSHI_ENVIRONMENT === 'production' 
        ? 'https://trading-api.kalshi.com/trade-api/v2'
        : 'https://demo-api.kalshi.co/trade-api/v2',
      environment: (process.env.KALSHI_ENVIRONMENT as 'demo' | 'production') || 'demo',
    },
    openai: {
      apiKey: process.env.OPENAI_API_KEY!,
      model: process.env.OPENAI_MODEL || 'gpt-4',
    },
    strategy: {
      maxInvestment: parseInt(process.env.MAX_INVESTMENT || '1000'),
      minExpectedReturn: parseFloat(process.env.MIN_EXPECTED_RETURN || '0.02'),
      minTimeThreshold: parseInt(process.env.MIN_TIME_THRESHOLD || '1'),
      maxTimeThreshold: parseInt(process.env.MAX_TIME_THRESHOLD || '365'),
      transactionCostPercentage: parseFloat(process.env.TRANSACTION_COST_PCT || '0.02'),
      riskTolerance: (process.env.RISK_TOLERANCE as any) || 'moderate',
    },
    monitoring: {
      checkIntervalMinutes: parseInt(process.env.CHECK_INTERVAL_MINUTES || '15'),
      alertThreshold: parseFloat(process.env.ALERT_THRESHOLD || '0.05'),
      logLevel: (process.env.LOG_LEVEL as any) || 'info',
    },
  };
};

export const validateConfig = (config: Config): void => {
  if (config.strategy.minExpectedReturn <= 0 || config.strategy.minExpectedReturn >= 1) {
    throw new Error('minExpectedReturn must be between 0 and 1');
  }
  
  if (config.strategy.maxInvestment <= 0) {
    throw new Error('maxInvestment must be positive');
  }
  
  if (config.strategy.minTimeThreshold < 0) {
    throw new Error('minTimeThreshold must be non-negative');
  }
  
  if (config.strategy.maxTimeThreshold <= config.strategy.minTimeThreshold) {
    throw new Error('maxTimeThreshold must be greater than minTimeThreshold');
  }
  
  if (!['conservative', 'moderate', 'aggressive'].includes(config.strategy.riskTolerance)) {
    throw new Error('riskTolerance must be conservative, moderate, or aggressive');
  }
};

// Example .env file template
export const envTemplate = `
# Kalshi Configuration
KALSHI_API_KEY=your_kalshi_api_key_here
KALSHI_ENVIRONMENT=demo  # or 'production'

# OpenAI Configuration (for semantic analysis)
OPENAI_API_KEY=your_openai_api_key_here
OPENAI_MODEL=gpt-4

# Strategy Configuration
MAX_INVESTMENT=1000
MIN_EXPECTED_RETURN=0.02
MIN_TIME_THRESHOLD=1
MAX_TIME_THRESHOLD=365
TRANSACTION_COST_PCT=0.02
RISK_TOLERANCE=moderate

# Monitoring Configuration
CHECK_INTERVAL_MINUTES=15
ALERT_THRESHOLD=0.05
LOG_LEVEL=info
`;

export default { loadConfig, validateConfig, envTemplate };