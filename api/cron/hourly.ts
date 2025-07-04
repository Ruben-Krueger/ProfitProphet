import type { VercelRequest, VercelResponse } from "@vercel/node";
import { prisma } from "../_shared/prisma";

import { createKalshiClient } from "../_shared/kalshi_client";
import { loadConfig } from "../_shared/config_module";
import { createLogger } from "../_shared/logger";
import { Market as PrismaMarket } from "@prisma/client";
import { Market } from "../_shared/types";

export const config = {
  maxDuration: 300, // 5 minutes for heavy tasks
  memory: 1769, // High memory for data processing
};

const MARKET_LIMIT = 1000;

export default async function handler(req: VercelRequest, res: VercelResponse) {
  const startTime = Date.now();
  const logger = createLogger("hourly-cron");

  logger.info("Hourly cron job started");

  // Verify cron secret
  if (req.headers.authorization !== `Bearer ${process.env.CRON_SECRET}`) {
    logger.error("Unauthorized cron request");
    return res.status(401).json({ error: "Unauthorized" });
  }

  try {
    logger.info("Loading configuration");
    // Initialize Kalshi client
    const config = loadConfig();
    logger.info("Configuration loaded successfully");

    logger.info("Initializing Kalshi client");
    const kalshiClient = createKalshiClient(config.kalshi);
    logger.info("Kalshi client initialized");

    // Fetch markets
    logger.info("Fetching markets from Kalshi");
    const markets = await kalshiClient.fetchAllMarkets(MARKET_LIMIT);
    logger.info(
      { marketsCount: markets.length },
      "Successfully fetched markets from Kalshi"
    );

    const filteredMarkets = markets;

    // Store markets in database using Prisma

    // Process markets in batches for better performance
    const BATCH_SIZE = 50;
    const batches: Market[][] = [];

    for (let i = 0; i < filteredMarkets.length; i += BATCH_SIZE) {
      batches.push(filteredMarkets.slice(i, i + BATCH_SIZE));
    }

    logger.info(
      `Processing ${filteredMarkets.length} markets in ${batches.length} batches`
    );

    for (const batch of batches) {
      // Process each batch in parallel
      const batchPromises = batch.map(async market => {
        const result = await prisma.market.upsert({
          where: { id: market.id },
          update: {
            title: market.title,
            question: market.question,
            yesPrice: market.yesPrice,
            noPrice: market.noPrice,
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
            volume: market.volume,
            openInterest: market.openInterest,
            resolutionDate: market.resolutionDate,
            category: market.category,
            subtitle: market.subtitle,
            eventId: market.eventId,
            status: market.status,
            lastUpdated: market.lastUpdated,
          },
        });

        return result;
      });

      // Wait for current batch to complete before processing next batch
      await Promise.all(batchPromises);
    }

    // Since we can't easily track insert vs update without additional queries,
    // we'll just report total processed
    const totalProcessed = filteredMarkets.length;

    logger.info("Arbitrage detection logic not yet implemented");

    const duration = Date.now() - startTime;
    logger.info(
      {
        duration,
        marketsProcessed: totalProcessed,
        batchesProcessed: batches.length,
      },
      "Hourly cron job completed successfully"
    );

    return res.json({
      success: true,
      duration: `${duration}ms`,
      marketsProcessed: totalProcessed,
      batchesProcessed: batches.length,
    });
  } catch (error) {
    logger.error(
      { error: error.message, stack: error.stack },
      "Background task failed"
    );
    return res.status(500).json({ error: error.message });
  }
}
