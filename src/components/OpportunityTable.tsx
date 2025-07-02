
interface Opportunity {
  id: string;
  market: string;
  type: string;
  expectedPayout: number;
  probability: number;
  status: 'active' | 'completed' | 'expired';
  timeFound: string;
}

interface OpportunityTableProps {
  opportunities: Opportunity[];
}

export const OpportunityTable = ({ opportunities }: OpportunityTableProps) => {
  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD',
    }).format(amount);
  };

  const formatPercentage = (rate: number) => {
    return `${(rate * 100).toFixed(1)}%`;
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'active': return 'text-emerald-400 bg-emerald-500/10';
      case 'completed': return 'text-blue-400 bg-blue-500/10';
      case 'expired': return 'text-red-400 bg-red-500/10';
      default: return 'text-slate-400 bg-slate-500/10';
    }
  };

  return (
    <div className="overflow-x-auto">
      <table className="w-full">
        <thead>
          <tr className="border-b border-slate-700">
            <th className="text-left py-3 px-4 text-slate-300 font-medium">Market</th>
            <th className="text-left py-3 px-4 text-slate-300 font-medium">Type</th>
            <th className="text-left py-3 px-4 text-slate-300 font-medium">Expected Payout</th>
            <th className="text-left py-3 px-4 text-slate-300 font-medium">Probability</th>
            <th className="text-left py-3 px-4 text-slate-300 font-medium">Status</th>
            <th className="text-left py-3 px-4 text-slate-300 font-medium">Time Found</th>
          </tr>
        </thead>
        <tbody>
          {opportunities.slice(0, 8).map((opportunity) => (
            <tr key={opportunity.id} className="border-b border-slate-700/50">
              <td className="py-3 px-4 text-white font-medium">
                {opportunity.market}
              </td>
              <td className="py-3 px-4 text-slate-300">
                {opportunity.type}
              </td>
              <td className="py-3 px-4 text-emerald-400 font-medium">
                {formatCurrency(opportunity.expectedPayout)}
              </td>
              <td className="py-3 px-4 text-slate-300">
                {formatPercentage(opportunity.probability)}
              </td>
              <td className="py-3 px-4">
                <span className={`px-2 py-1 rounded-full text-xs font-medium ${getStatusColor(opportunity.status)}`}>
                  {opportunity.status}
                </span>
              </td>
              <td className="py-3 px-4 text-slate-400 text-sm">
                {opportunity.timeFound}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
};
