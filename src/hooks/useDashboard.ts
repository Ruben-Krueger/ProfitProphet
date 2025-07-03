import { useQuery } from "@tanstack/react-query";
import { createAuthHeaders } from "../utils/auth";
import { getApiBaseUrl } from "../lib/utils";

interface DashboardData {
  stats: {
    totalMarkets: number;
    totalOpportunities: number;
    activeMarkets: number;
    avgExpectedReturn: number;
  };
  recentOpportunities: any[];
  chartData: {
    byType: Array<{ type: string; count: number }>;
    byRisk: Array<{ riskLevel: string; count: number }>;
  };
}

export const useDashboard = () => {
  return useQuery({
    queryKey: ["dashboard"],
    queryFn: async (): Promise<DashboardData> => {
      try {
        const headers = await createAuthHeaders();
        const response = await fetch(`${getApiBaseUrl()}/api/dashboard`, {
          headers,
        });
        if (!response.ok) {
          if (response.status === 401) {
            throw new Error("Authentication required");
          }
          throw new Error("Failed to fetch dashboard data");
        }
        return response.json();
      } catch (error) {
        if (
          error instanceof Error &&
          error.message === "No authentication token available"
        ) {
          throw new Error("Authentication required");
        }
        throw error;
      }
    },
    staleTime: 10 * 60 * 1000, // 10 minutes
    refetchInterval: 5 * 60 * 1000, // Refetch every 5 minutes
  });
};
