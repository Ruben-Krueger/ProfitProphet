import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  LogOut,
  TrendingUp,
  DollarSign,
  Activity,
  Target,
  RefreshCw,
} from "lucide-react";
import { OpportunityTable } from "./OpportunityTable";
import { useDashboard, useRefreshOpportunities } from "../hooks";
import { Markets } from "./Markets";
import { useState } from "react";
import useAuth from "@/hooks/useAuth";
import Loading from "./Loading";
import { toast } from "@/components/ui/sonner";

export function Dashboard() {
  const {
    data: dashboardData,
    isLoading,
    error,
    dataUpdatedAt,
  } = useDashboard();

  const [activeTab, setActiveTab] = useState<
    "overview" | "markets" | "opportunities"
  >("overview");

  const { handleLogout } = useAuth();

  const refreshOpportunities = useRefreshOpportunities();

  const handleRefresh = () => {
    refreshOpportunities.mutate(undefined, {
      onSuccess: result => {
        toast.success(
          `Scan complete: ${result.marketsProcessed} markets processed, ${result.opportunitiesCount} opportunities found`
        );
      },
      onError: err => {
        toast.error(
          err instanceof Error ? err.message : "Failed to trigger scan"
        );
      },
    });
  };

  if (isLoading) {
    return <Loading />;
  }

  if (error) {
    return (
      <div className="min-h-screen bg-slate-900 flex items-center justify-center">
        <div className="text-red-400">Error: {error.message}</div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-900">
      {/* Header */}
      <header className="bg-slate-800 border-b border-slate-700 px-6 py-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center space-x-3">
            <div className="p-2 bg-emerald-500/10 rounded-lg">
              <TrendingUp className="h-6 w-6 text-emerald-400" />
            </div>
            <div>
              <h1 className="text-xl font-bold text-white">Arbitrage Bot</h1>
              <p className="text-sm text-slate-400">
                Prediction Market Scanner
              </p>
            </div>
          </div>
          <div className="flex items-center space-x-3">
            <Button
              onClick={handleRefresh}
              disabled={refreshOpportunities.isPending}
              variant="outline"
              size="sm"
              className="bg-slate-800 border border-slate-700 text-white hover:bg-slate-600 rounded shadow-sm"
            >
              <RefreshCw
                className={`h-4 w-4 mr-2 ${refreshOpportunities.isPending ? "animate-spin" : ""}`}
              />
              {refreshOpportunities.isPending ? "Scanning..." : "Run Scan Now"}
            </Button>
            <Button
              onClick={handleLogout}
              variant="outline"
              size="sm"
              className="bg-slate-800 border border-slate-700 text-white hover:bg-slate-600 rounded shadow-sm"
            >
              <LogOut className="h-4 w-4 mr-2" />
              Logout
            </Button>
          </div>
        </div>
      </header>

      {/* Tab Navigation */}
      <nav className="flex space-x-4 px-6 pt-6">
        <button
          className={`px-4 py-2 rounded-t bg-slate-800 border-b-2 ${activeTab === "overview" ? "border-emerald-400 text-emerald-400" : "border-transparent text-slate-300"}`}
          onClick={() => setActiveTab("overview")}
        >
          Overview
        </button>
        <button
          className={`px-4 py-2 rounded-t bg-slate-800 border-b-2 ${activeTab === "markets" ? "border-emerald-400 text-emerald-400" : "border-transparent text-slate-300"}`}
          onClick={() => setActiveTab("markets")}
        >
          Markets
        </button>
        <button
          className={`px-4 py-2 rounded-t bg-slate-800 border-b-2 ${activeTab === "opportunities" ? "border-emerald-400 text-emerald-400" : "border-transparent text-slate-300"}`}
          onClick={() => setActiveTab("opportunities")}
        >
          Opportunities
        </button>
      </nav>

      {/* Main Content */}
      <main className="p-6">
        {activeTab === "overview" && (
          <div className="space-y-6">
            {/* Overview: Total Markets and Last Fetch Time */}
            <Card className="bg-slate-800 border-slate-700 max-w-md mb-6">
              <CardHeader>
                <CardTitle className="text-white flex items-center">
                  <Activity className="h-5 w-5 mr-2 text-emerald-400" />
                  Overview
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="flex flex-col gap-2 text-slate-200">
                  <div>
                    Total Markets:{" "}
                    <span className="font-bold text-emerald-400">
                      {dashboardData?.stats.totalMarkets ?? "-"}
                    </span>
                  </div>
                  <div>
                    Last Fetched:{" "}
                    <span className="text-slate-400">
                      {dataUpdatedAt
                        ? new Date(dataUpdatedAt).toLocaleString()
                        : "-"}
                    </span>
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>
        )}
        {activeTab === "markets" && (
          <div>
            <Markets />
          </div>
        )}
        {activeTab === "opportunities" && (
          <div>
            <Card className="bg-slate-800 border-slate-700">
              <CardHeader>
                <CardTitle className="text-white flex items-center">
                  <DollarSign className="h-5 w-5 mr-2 text-emerald-400" />
                  Recent Opportunities
                </CardTitle>
              </CardHeader>
              <CardContent>
                <OpportunityTable
                  opportunities={dashboardData?.recentOpportunities || []}
                />
              </CardContent>
            </Card>
          </div>
        )}
      </main>
    </div>
  );
}
