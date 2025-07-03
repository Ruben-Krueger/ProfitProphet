import { useQuery } from "@tanstack/react-query";
import { createAuthHeaders } from "../utils/auth";
import { getApiBaseUrl } from "@/lib/utils";

interface OpportunityMarket {
  opportunityId: string;
  marketId: string;
  market: {
    id: string;
    title: string;
    question: string;
    yesPrice: number;
    noPrice: number;
    volume: number;
    openInterest: number;
    resolutionDate: string;
    category: string;
    status: string;
    lastUpdated: string;
  };
  opportunity: {
    id: string;
    type: string;
    expectedReturn: number;
    netReturn: number;
    confidence: number;
    reasoning: string;
    timeToExpiry: number;
    requiredInvestment: number;
    riskLevel: string;
    detectedAt: string;
  };
}

interface OpportunityMarketsResponse {
  opportunityMarkets: OpportunityMarket[];
  pagination: {
    total: number;
    limit: number;
    offset: number;
    hasMore: boolean;
  };
}

interface UseOpportunityMarketsParams {
  opportunityId?: string;
  marketId?: string;
  limit?: number;
  offset?: number;
}

export const useOpportunityMarkets = (
  params: UseOpportunityMarketsParams = {}
) => {
  const { opportunityId, marketId, limit = 50, offset = 0 } = params;

  return useQuery({
    queryKey: ["opportunity-markets", opportunityId, marketId, limit, offset],
    queryFn: async (): Promise<OpportunityMarketsResponse> => {
      const searchParams = new URLSearchParams();
      if (opportunityId) searchParams.append("opportunityId", opportunityId);
      if (marketId) searchParams.append("marketId", marketId);
      searchParams.append("limit", limit.toString());
      searchParams.append("offset", offset.toString());

      const headers = await createAuthHeaders();
      const response = await fetch(
        `${getApiBaseUrl}/api/opportunity-markets?${searchParams.toString()}`,
        { headers }
      );
      if (!response.ok) {
        throw new Error("Failed to fetch opportunity markets");
      }
      return response.json();
    },
    staleTime: 2 * 60 * 1000, // 2 minutes
  });
};
