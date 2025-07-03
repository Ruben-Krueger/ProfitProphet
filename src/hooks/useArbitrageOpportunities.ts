import { useQuery } from "@tanstack/react-query";
import { createAuthHeaders } from "../utils/auth";
import { getApiBaseUrl } from "../lib/utils";

interface ArbitrageOpportunity {
  id: string;
  type: string;
  expectedReturn: number;
  netReturn: number;
  confidence: number;
  strategy: any;
  reasoning: string;
  timeToExpiry: number;
  requiredInvestment: number;
  riskLevel: string;
  detectedAt: string;
  createdAt: string;
  opportunityMarkets: Array<{
    market: {
      id: string;
      title: string;
      question: string;
      yesPrice: number;
      noPrice: number;
      category: string;
      status: string;
    };
  }>;
}

interface ArbitrageOpportunitiesResponse {
  opportunities: ArbitrageOpportunity[];
  pagination: {
    total: number;
    limit: number;
    offset: number;
    hasMore: boolean;
  };
}

interface UseArbitrageOpportunitiesParams {
  type?: string;
  riskLevel?: string;
  limit?: number;
  offset?: number;
}

export const useArbitrageOpportunities = (
  params: UseArbitrageOpportunitiesParams = {}
) => {
  const { type, riskLevel, limit = 50, offset = 0 } = params;

  return useQuery({
    queryKey: ["arbitrage-opportunities", type, riskLevel, limit, offset],
    queryFn: async (): Promise<ArbitrageOpportunitiesResponse> => {
      const searchParams = new URLSearchParams();
      if (type) searchParams.append("type", type);
      if (riskLevel) searchParams.append("riskLevel", riskLevel);
      searchParams.append("limit", limit.toString());
      searchParams.append("offset", offset.toString());

      const headers = await createAuthHeaders();
      const response = await fetch(
        `${getApiBaseUrl()}/api/arbitrage-opportunities?${searchParams.toString()}`,
        { headers }
      );
      if (!response.ok) {
        throw new Error("Failed to fetch arbitrage opportunities");
      }
      return response.json();
    },
    staleTime: 60 * 60 * 1000, // 60 minutes - matches backend refresh rate
    gcTime: 2 * 60 * 60 * 1000, // 2 hours - keep in cache longer
  });
};
