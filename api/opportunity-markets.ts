import type { VercelResponse } from "@vercel/node";
import { prisma } from "./_shared/prisma";
import { withAuth, AuthenticatedRequest } from "./_shared/auth";

async function handler(req: AuthenticatedRequest, res: VercelResponse) {
  if (req.method !== "GET") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  try {
    const { query } = req;
    const opportunityId = query.opportunityId as string;
    const marketId = query.marketId as string;
    const limit = parseInt((query.limit as string) || "50");
    const offset = parseInt((query.offset as string) || "0");

    // Build where clause
    const where: any = {};
    if (opportunityId) {
      where.opportunityId = opportunityId;
    }
    if (marketId) {
      where.marketId = marketId;
    }

    const opportunityMarkets = await prisma.opportunityMarket.findMany({
      where,
      take: Math.min(limit, 100), // Cap at 100
      skip: offset,
      select: {
        opportunityId: true,
        marketId: true,
        market: {
          select: {
            id: true,
            title: true,
            question: true,
            yesPrice: true,
            noPrice: true,
            volume: true,
            openInterest: true,
            resolutionDate: true,
            category: true,
            status: true,
            lastUpdated: true,
          },
        },
        opportunity: {
          select: {
            id: true,
            type: true,
            expectedReturn: true,
            netReturn: true,
            confidence: true,
            reasoning: true,
            timeToExpiry: true,
            requiredInvestment: true,
            riskLevel: true,
            detectedAt: true,
          },
        },
      },
    });

    // Get total count for pagination
    const total = await prisma.opportunityMarket.count({ where });

    return res.status(200).json({
      opportunityMarkets,
      pagination: {
        total,
        limit,
        offset,
        hasMore: offset + limit < total,
      },
    });
  } catch (error) {
    console.error("Error fetching opportunity markets:", error);
    return res.status(500).json({ error: "Internal server error" });
  }
}

module.exports = withAuth(handler);
