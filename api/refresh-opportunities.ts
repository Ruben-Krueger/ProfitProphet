import type { VercelResponse } from "@vercel/node";
import { withAuth, AuthenticatedRequest } from "./_shared/auth.js";
import { withCors } from "./_shared/cors.js";
import { createLogger } from "./_shared/logger.js";
import { runOpportunityScan } from "./_shared/run-opportunity-scan.js";

export const config = {
  maxDuration: 300, // 5 minutes for heavy tasks
  memory: 1769, // High memory for data processing
};

async function handler(req: AuthenticatedRequest, res: VercelResponse) {
  if (req.method !== "POST") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  const logger = createLogger("manual-refresh");
  logger.info({ userId: req.user?.id }, "Manual opportunity scan triggered");

  try {
    const result = await runOpportunityScan(logger);

    logger.info(result, "Manual opportunity scan completed successfully");

    return res.status(200).json({
      success: true,
      duration: `${result.duration}ms`,
      marketsProcessed: result.marketsProcessed,
      batchesProcessed: result.batchesProcessed,
      opportunitiesCount: result.opportunitiesCount,
    });
  } catch (error) {
    logger.error(
      { error: error.message, stack: error.stack },
      "Manual opportunity scan failed"
    );
    return res.status(500).json({ error: error.message });
  }
}

export default withCors(withAuth(handler));
