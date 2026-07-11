import type { VercelRequest, VercelResponse } from "@vercel/node";
import { createLogger } from "../_shared/logger";
import { runOpportunityScan } from "../_shared/run-opportunity-scan";

export const config = {
  maxDuration: 300, // 5 minutes for heavy tasks
  memory: 1769, // High memory for data processing
};

export default async function handler(req: VercelRequest, res: VercelResponse) {
  const logger = createLogger("hourly-cron");

  logger.info("Hourly cron job started");

  // Verify cron secret
  if (req.headers.authorization !== `Bearer ${process.env.CRON_SECRET}`) {
    logger.error("Unauthorized cron request");
    return res.status(401).json({ error: "Unauthorized" });
  }

  try {
    const result = await runOpportunityScan(logger);

    logger.info(result, "Hourly cron job completed successfully");

    return res.json({
      success: true,
      duration: `${result.duration}ms`,
      marketsProcessed: result.marketsProcessed,
      batchesProcessed: result.batchesProcessed,
      opportunitiesCount: result.opportunitiesCount,
    });
  } catch (error) {
    logger.error(
      { error: error.message, stack: error.stack },
      "Background task failed"
    );
    return res.status(500).json({ error: error.message });
  }
}
