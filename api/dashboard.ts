import type { VercelResponse } from "@vercel/node";
import { prisma } from "./_shared/prisma";
import { withAuth, AuthenticatedRequest } from "./_shared/auth";

async function handler(req: AuthenticatedRequest, res: VercelResponse) {
  if (req.method !== "GET") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  try {
    // Get basic counts
    const [totalMarkets, totalOpportunities, activeMarkets] = await Promise.all(
      [
        prisma.market.count(),
        prisma.arbitrageOpportunity.count(),
        prisma.market.count({ where: { status: "active" } }),
      ]
    );

    // Get recent opportunities with market details
    const recentOpportunities = await prisma.arbitrageOpportunity.findMany({
      take: 10,
      orderBy: {
        detectedAt: "desc",
      },
      select: {
        id: true,
        type: true,
        expectedReturn: true,
        netReturn: true,
        confidence: true,
        riskLevel: true,
        detectedAt: true,
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
              },
            },
          },
        },
      },
    });

    // Get opportunities by type for chart data
    const opportunitiesByType = await prisma.arbitrageOpportunity.groupBy({
      by: ["type"],
      _count: {
        type: true,
      },
    });

    // Get opportunities by risk level
    const opportunitiesByRisk = await prisma.arbitrageOpportunity.groupBy({
      by: ["riskLevel"],
      _count: {
        riskLevel: true,
      },
    });

    // Calculate average expected return
    const avgReturnResult = await prisma.arbitrageOpportunity.aggregate({
      _avg: {
        expectedReturn: true,
      },
    });

    return res.status(200).json({
      stats: {
        totalMarkets,
        totalOpportunities,
        activeMarkets,
        avgExpectedReturn: avgReturnResult._avg.expectedReturn || 0,
      },
      recentOpportunities,
      chartData: {
        byType: opportunitiesByType.map(item => ({
          type: item.type,
          count: item._count.type,
        })),
        byRisk: opportunitiesByRisk.map(item => ({
          riskLevel: item.riskLevel,
          count: item._count.riskLevel,
        })),
      },
    });
  } catch (error) {
    console.error("Error fetching dashboard data:", error);
    return res.status(500).json({ error: "Internal server error" });
  }
}

module.exports = withAuth(handler);
