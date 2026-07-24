import type { RecentOpportunity } from "../hooks/useDashboard";

interface OpportunityTableProps {
  opportunities: RecentOpportunity[];
}

export const OpportunityTable = ({ opportunities }: OpportunityTableProps) => {
  const formatPercentage = (rate: number) => {
    return `${(rate * 100).toFixed(1)}%`;
  };

  const formatDetectedAt = (detectedAt: string) => {
    const date = new Date(detectedAt);
    if (isNaN(date.getTime())) {
      return "—";
    }
    return date.toLocaleString("en-US", {
      month: "short",
      day: "numeric",
      hour: "numeric",
      minute: "2-digit",
    });
  };

  // An opportunity spans one or more markets; the first is the one the
  // strategy is anchored on, so it stands in for the row.
  const formatMarket = (opportunity: RecentOpportunity) => {
    const [first] = opportunity.opportunityMarkets;
    if (!first) {
      return "—";
    }
    const extra = opportunity.opportunityMarkets.length - 1;
    return extra > 0
      ? `${first.market.title} +${extra} more`
      : first.market.title;
  };

  const getRiskColor = (riskLevel: string) => {
    switch (riskLevel) {
      case "low":
        return "text-emerald-400 bg-emerald-500/10";
      case "medium":
        return "text-amber-400 bg-amber-500/10";
      case "high":
        return "text-red-400 bg-red-500/10";
      default:
        return "text-slate-400 bg-slate-500/10";
    }
  };

  return (
    <div className="overflow-x-auto">
      <table className="w-full">
        <thead>
          <tr className="border-b border-slate-700">
            <th className="text-left py-3 px-4 text-slate-300 font-medium">
              Market
            </th>
            <th className="text-left py-3 px-4 text-slate-300 font-medium">
              Type
            </th>
            <th className="text-left py-3 px-4 text-slate-300 font-medium">
              Expected Return
            </th>
            <th className="text-left py-3 px-4 text-slate-300 font-medium">
              Confidence
            </th>
            <th className="text-left py-3 px-4 text-slate-300 font-medium">
              Risk
            </th>
            <th className="text-left py-3 px-4 text-slate-300 font-medium">
              Detected
            </th>
          </tr>
        </thead>
        <tbody>
          {opportunities.slice(0, 8).map(opportunity => (
            <tr key={opportunity.id} className="border-b border-slate-700/50">
              <td className="py-3 px-4 text-white font-medium">
                {formatMarket(opportunity)}
              </td>
              <td className="py-3 px-4 text-slate-300">{opportunity.type}</td>
              <td className="py-3 px-4 text-emerald-400 font-medium">
                {formatPercentage(opportunity.expectedReturn)}
              </td>
              <td className="py-3 px-4 text-slate-300">
                {formatPercentage(opportunity.confidence)}
              </td>
              <td className="py-3 px-4">
                <span
                  className={`px-2 py-1 rounded-full text-xs font-medium ${getRiskColor(opportunity.riskLevel)}`}
                >
                  {opportunity.riskLevel}
                </span>
              </td>
              <td className="py-3 px-4 text-slate-400 text-sm">
                {formatDetectedAt(opportunity.detectedAt)}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
};
