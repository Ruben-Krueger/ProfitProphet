import { prisma } from "./prisma";
import { createKalshiClient } from "./kalshi_client";
import { loadConfig } from "./config_module";
import { createLogger } from "./logger";
import { Market } from "./types";
import TradingEngine from "./trading-engine";

const MARKET_LIMIT = 1000;
const BATCH_SIZE = 50;

export interface OpportunityScanResult {
  marketsProcessed: number;
  batchesProcessed: number;
  opportunitiesCount: number;
  duration: number;
}

export async function runOpportunityScan(
  logger: ReturnType<typeof createLogger>
): Promise<OpportunityScanResult> {
  const startTime = Date.now();

  logger.info("Loading configuration");
  const config = loadConfig();
  logger.info("Configuration loaded successfully");

  logger.info("Initializing Kalshi client");
  const kalshiClient = createKalshiClient(config.kalshi);
  logger.info("Kalshi client initialized");

  // Fetch markets
  logger.info("Fetching markets from Kalshi");
  const markets = await kalshiClient.fetchAllMarkets(MARKET_LIMIT);
  console.log(markets);
  logger.info(
    { marketsCount: markets.length },
    "Successfully fetched markets from Kalshi"
  );

  // Process markets in batches for better performance
  const batches: Market[][] = [];
  for (let i = 0; i < markets.length; i += BATCH_SIZE) {
    batches.push(markets.slice(i, i + BATCH_SIZE));
  }

  logger.info(
    `Processing ${markets.length} markets in ${batches.length} batches`
  );

  for (const batch of batches) {
    const batchPromises = batch.map(market =>
      prisma.market.upsert({
        where: { id: market.id },
        update: {
          title: market.title,
          question: market.question,
          yesPrice: market.yesPrice,
          noPrice: market.noPrice,
          yesBid: market.yesBid,
          yesAsk: market.yesAsk,
          noBid: market.noBid,
          noAsk: market.noAsk,
          volume: market.volume,
          openInterest: market.openInterest,
          resolutionDate: market.resolutionDate,
          category: market.category,
          subtitle: market.subtitle,
          eventId: market.eventId,
          status: market.status,
          lastUpdated: market.lastUpdated,
        },
        create: {
          id: market.id,
          title: market.title,
          question: market.question,
          yesPrice: market.yesPrice,
          noPrice: market.noPrice,
          yesBid: market.yesBid,
          yesAsk: market.yesAsk,
          noBid: market.noBid,
          noAsk: market.noAsk,
          volume: market.volume,
          openInterest: market.openInterest,
          resolutionDate: market.resolutionDate,
          category: market.category,
          subtitle: market.subtitle,
          eventId: market.eventId,
          status: market.status,
          lastUpdated: market.lastUpdated,
        },
      })
    );

    await Promise.all(batchPromises);
  }

  // Run arbitrage detection logic
  const opportunities = TradingEngine(markets);

  logger.info(
    { opportunitiesCount: opportunities.length },
    "Successfully detected opportunities"
  );

  if (opportunities.length > 0) {
    const opportunitiesData = opportunities.map(opportunity => ({
      id: opportunity.id,
      type: opportunity.type,
      expectedReturn: opportunity.expectedReturn,
      netReturn: opportunity.netReturn,
      confidence: opportunity.confidence,
      strategy: JSON.stringify(opportunity.strategy),
      reasoning: opportunity.reasoning,
      requiredInvestment: opportunity.requiredInvestment,
      riskLevel: opportunity.riskLevel,
      detectedAt: opportunity.detectedAt,
    }));

    await prisma.arbitrageOpportunity.createMany({
      data: opportunitiesData,
    });
  }

  const duration = Date.now() - startTime;

  return {
    marketsProcessed: markets.length,
    batchesProcessed: batches.length,
    opportunitiesCount: opportunities.length,
    duration,
  };
}
