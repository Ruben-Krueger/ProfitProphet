import { useMutation, useQueryClient } from "@tanstack/react-query";
import { createAuthHeaders } from "../utils/auth";
import { getApiBaseUrl } from "../lib/utils";

interface RefreshResult {
  success: boolean;
  duration: string;
  marketsProcessed: number;
  batchesProcessed: number;
  opportunitiesCount: number;
}

export const useRefreshOpportunities = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (): Promise<RefreshResult> => {
      const headers = await createAuthHeaders();
      const response = await fetch(
        `${getApiBaseUrl()}/api/refresh-opportunities`,
        {
          method: "POST",
          headers,
        }
      );
      if (!response.ok) {
        if (response.status === 401) {
          throw new Error("Authentication required");
        }
        const body = await response.json().catch(() => null);
        throw new Error(body?.error || "Failed to trigger scan");
      }
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["dashboard"] });
      queryClient.invalidateQueries({ queryKey: ["markets"] });
      queryClient.invalidateQueries({ queryKey: ["arbitrage-opportunities"] });
    },
  });
};
