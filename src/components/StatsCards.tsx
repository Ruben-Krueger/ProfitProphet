
import { Card, CardContent } from '@/components/ui/card';
import { TrendingUp, DollarSign, Target, Activity } from 'lucide-react';

interface StatsCardsProps {
  stats: {
    totalProfit: number;
    activeOpportunities: number;
    successRate: number;
    todaysProfits: number;
  };
}

export const StatsCards = ({ stats }: StatsCardsProps) => {
  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD',
    }).format(amount);
  };

  const formatPercentage = (rate: number) => {
    return `${(rate * 100).toFixed(1)}%`;
  };

  const cardData = [
    {
      title: 'Total Profit',
      value: formatCurrency(stats.totalProfit),
      icon: DollarSign,
      color: 'text-emerald-400',
      bgColor: 'bg-emerald-500/10',
    },
    {
      title: 'Active Opportunities',
      value: stats.activeOpportunities.toString(),
      icon: Activity,
      color: 'text-blue-400',
      bgColor: 'bg-blue-500/10',
    },
    {
      title: 'Success Rate',
      value: formatPercentage(stats.successRate),
      icon: Target,
      color: 'text-purple-400',
      bgColor: 'bg-purple-500/10',
    },
    {
      title: 'Today\'s Profits',
      value: formatCurrency(stats.todaysProfits),
      icon: TrendingUp,
      color: 'text-orange-400',
      bgColor: 'bg-orange-500/10',
    },
  ];

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
      {cardData.map((card, index) => (
        <Card key={index} className="bg-slate-800 border-slate-700">
          <CardContent className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-slate-400">
                  {card.title}
                </p>
                <p className="text-2xl font-bold text-white mt-2">
                  {card.value}
                </p>
              </div>
              <div className={`p-3 rounded-full ${card.bgColor}`}>
                <card.icon className={`h-6 w-6 ${card.color}`} />
              </div>
            </div>
          </CardContent>
        </Card>
      ))}
    </div>
  );
};
