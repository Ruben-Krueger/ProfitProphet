import type { VercelResponse } from "@vercel/node";
import { prisma } from "./_shared/prisma";
import { withAuth, AuthenticatedRequest } from "./_shared/auth";

async function handler(req: AuthenticatedRequest, res: VercelResponse) {
  if (req.method !== "GET") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  try {
    const { query } = req;
    const status = query.status as string;
    const category = query.category as string;
    const limit = parseInt((query.limit as string) || "50");
    const offset = parseInt((query.offset as string) || "0");

    // Build where clause
    const where: any = {};
    if (status) {
      where.status = status;
    }
    if (category) {
      where.category = category;
    }

    const markets = await prisma.market.findMany({
      where,
      orderBy: {
        lastUpdated: "desc",
      },
      take: Math.min(limit, 100), // Cap at 100
      skip: offset,
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
        subtitle: true,
        eventId: true,
        status: true,
        lastUpdated: true,
        createdAt: true,
      },
    });

    // Get total count for pagination
    const total = await prisma.market.count({ where });

    return res.status(200).json({
      markets,
      pagination: {
        total,
        limit,
        offset,
        hasMore: offset + limit < total,
      },
    });
  } catch (error) {
    console.error("Error fetching markets:", error);
    return res.status(500).json({ error: "Internal server error" });
  }
}

module.exports = withAuth(handler);
