import { useQuery } from "@tanstack/react-query";
import { createAuthHeaders } from "../utils/auth";
import { getApiBaseUrl } from "../lib/utils";

interface Market {
  id: string;
  title: string;
  question: string;
  yesPrice: number;
  noPrice: number;
  volume: number;
  openInterest: number;
  resolutionDate: string;
  category: string;
  subtitle?: string;
  eventId: string;
  status: string;
  lastUpdated: string;
  createdAt: string;
}

interface MarketsResponse {
  markets: Market[];
  pagination: {
    total: number;
    limit: number;
    offset: number;
    hasMore: boolean;
  };
}

interface UseMarketsParams {
  status?: string;
  category?: string;
  limit?: number;
  offset?: number;
}

export const useMarkets = (params: UseMarketsParams = {}) => {
  const { status, category, limit = 50, offset = 0 } = params;

  return useQuery({
    queryKey: ["markets", status, category, limit, offset],
    queryFn: async (): Promise<MarketsResponse> => {
      const searchParams = new URLSearchParams();
      if (status) searchParams.append("status", status);
      if (category) searchParams.append("category", category);
      searchParams.append("limit", limit.toString());
      searchParams.append("offset", offset.toString());

      const headers = await createAuthHeaders();
      const response = await fetch(
        `${getApiBaseUrl()}/api/markets?${searchParams.toString()}`,
        {
          headers,
        }
      );
      if (!response.ok) {
        throw new Error("Failed to fetch markets");
      }
      return response.json();
    },
    staleTime: 2 * 60 * 1000, // 5 minutes
  });
};
