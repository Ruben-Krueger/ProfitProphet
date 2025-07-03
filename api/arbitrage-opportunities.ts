import type { VercelResponse } from "@vercel/node";
import { prisma } from "./_shared/prisma";
import { withAuth, AuthenticatedRequest } from "./_shared/auth";

async function handler(req: AuthenticatedRequest, res: VercelResponse) {
  if (req.method !== "GET") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  try {
    const { query } = req;
    const type = query.type as string;
    const riskLevel = query.riskLevel as string;
    const limit = parseInt((query.limit as string) || "50");
    const offset = parseInt((query.offset as string) || "0");

    // Build where clause
    const where: any = {};
    if (type) {
      where.type = type;
    }
    if (riskLevel) {
      where.riskLevel = riskLevel;
    }

    const opportunities = await prisma.arbitrageOpportunity.findMany({
      where,
      orderBy: {
        detectedAt: "desc",
      },
      take: Math.min(limit, 100), // Cap at 100
      skip: offset,
      select: {
        id: true,
        type: true,
        expectedReturn: true,
        netReturn: true,
        confidence: true,
        strategy: true,
        reasoning: true,
        timeToExpiry: true,
        requiredInvestment: true,
        riskLevel: true,
        detectedAt: true,
        createdAt: true,
        opportunityMarkets: {
          select: {
            market: {
              select: {
                id: true,
                title: true,
                question: true,
                yesPrice: true,
                noPrice: true,
                category: true,
                status: true,
              },
            },
          },
        },
      },
    });

    // Get total count for pagination
    const total = await prisma.arbitrageOpportunity.count({ where });

    return res.status(200).json({
      opportunities,
      pagination: {
        total,
        limit,
        offset,
        hasMore: offset + limit < total,
      },
    });
  } catch (error) {
    console.error("Error fetching arbitrage opportunities:", error);
    return res.status(500).json({ error: "Internal server error" });
  }
}

module.exports = withAuth(handler);
