import { createClient } from "@supabase/supabase-js";
import nullThrows from "nullthrows";
import type { VercelRequest, VercelResponse } from "@vercel/node";
import { prisma } from "./_shared/prisma";

import { KalshiClient } from "../_shared/kalshi_client";
import { createKalshiClient } from "../_shared/kalshi_client";
import { loadConfig } from "../_shared/config_module";
import { createLogger } from "../_shared/logger";

export const config = {
  maxDuration: 300, // 5 minutes for heavy tasks
  memory: 1769, // High memory for data processing
};

const MARKET_LIMIT = 100;

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
    let insertedCount = 0;
    let updatedCount = 0;

    for (const market of filteredMarkets) {
      // Validate resolution date before storing
      let validResolutionDate = market.resolutionDate;
      if (!market.resolutionDate || isNaN(market.resolutionDate.getTime())) {
        logger.warn(
          { marketId: market.id, resolutionDate: market.resolutionDate },
          "Invalid resolution date, using epoch time as fallback"
        );
        // Set epoch time (Jan 1, 1970) as fallback for markets with invalid resolution dates
        validResolutionDate = new Date(0);
      }

      // Check if market already exists
      const existingMarket = await prisma.market.findUnique({
        where: { id: market.id },
        select: { id: true },
      });

      await prisma.market.upsert({
        where: { id: market.id },
        update: {
          title: market.title,
          question: market.question,
          yesPrice: market.yesPrice,
          noPrice: market.noPrice,
          volume: market.volume,
          openInterest: market.openInterest,
          resolutionDate: validResolutionDate,
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
          resolutionDate: validResolutionDate,
          category: market.category,
          subtitle: market.subtitle,
          eventId: market.eventId,
          status: market.status,
          lastUpdated: market.lastUpdated,
        },
      });

      // Count based on whether the market existed before
      if (existingMarket) {
        updatedCount++;
      } else {
        insertedCount++;
      }
    }

    // TODO: Run arbitrage detection logic here
    // TODO: Store opportunities in arbitrage_opportunities table
    logger.info("Arbitrage detection logic not yet implemented");

    const duration = Date.now() - startTime;
    logger.info(
      {
        duration,
        marketsProcessed: markets.length,
        marketsInserted: insertedCount,
        marketsUpdated: updatedCount,
      },
      "Hourly cron job completed successfully"
    );

    return res.json({
      success: true,
      duration: `${duration}ms`,
      marketsProcessed: markets.length,
      marketsInserted: insertedCount,
      marketsUpdated: updatedCount,
    });
  } catch (error) {
    logger.error(
      { error: error.message, stack: error.stack },
      "Background task failed"
    );
    return res.status(500).json({ error: error.message });
  }
}
