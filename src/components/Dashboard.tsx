import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { LogOut, TrendingUp, DollarSign, Activity, Target } from "lucide-react";
import { OpportunityChart } from "./OpportunityChart";
import { OpportunityTable } from "./OpportunityTable";
import { StatsCards } from "./StatsCards";
import { useDashboard } from "../hooks";
import { Markets } from "./Markets";

interface DashboardProps {
  onLogout: () => void;
}

export const Dashboard = ({ onLogout }: DashboardProps) => {
  const { data: dashboardData, isLoading, error } = useDashboard();

  if (isLoading) {
    return (
      <div className="min-h-screen bg-slate-900 flex items-center justify-center">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-emerald-400"></div>
      </div>
    );
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
          <Button
            onClick={onLogout}
            variant="outline"
            size="sm"
            className="border-slate-600 text-slate-300 hover:bg-slate-700"
          >
            <LogOut className="h-4 w-4 mr-2" />
            Logout
          </Button>
        </div>
      </header>

      {/* Main Content */}
      <main className="p-6 space-y-6">
        {/* Stats Cards */}
        {dashboardData && <StatsCards stats={dashboardData.stats} />}

        {/* Charts Section */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <Card className="bg-slate-800 border-slate-700">
            <CardHeader>
              <CardTitle className="text-white flex items-center">
                <Activity className="h-5 w-5 mr-2 text-emerald-400" />
                Opportunities Over Time
              </CardTitle>
            </CardHeader>
            <CardContent>
              <OpportunityChart data={dashboardData?.chartData.byType || []} />
            </CardContent>
          </Card>

          <Card className="bg-slate-800 border-slate-700">
            <CardHeader>
              <CardTitle className="text-white flex items-center">
                <Target className="h-5 w-5 mr-2 text-emerald-400" />
                Profit Distribution
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="h-64 flex items-center justify-center text-slate-400">
                Profit distribution chart placeholder
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Opportunities Table */}
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

        <Markets />
      </main>
    </div>
  );
};
