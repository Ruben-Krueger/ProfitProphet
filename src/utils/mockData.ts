// Mock data generator for arbitrage opportunities
export const generateMockData = () => {
  const markets = [
    "Election 2024 - Presidential",
    "Fed Rate Decision March",
    "Tesla Q4 Earnings",
    "Bitcoin Price End 2024",
    "NFL Super Bowl Winner",
    "Economic Recession 2024",
    "AI Breakthrough This Year",
    "Climate Policy Changes",
  ];

  const types = [
    "Price Arbitrage",
    "Time Arbitrage",
    "Cross-Platform",
    "Odds Mismatch",
  ];

  const opportunities = Array.from({ length: 15 }, (_, index) => ({
    id: `opp_${Date.now()}_${index}`,
    market: markets[Math.floor(Math.random() * markets.length)],
    type: types[Math.floor(Math.random() * types.length)],
    expectedPayout: Math.random() * 500 + 50, // $50 - $550
    probability: Math.random() * 0.3 + 0.6, // 60% - 90%
    status: ["active", "completed", "expired"][
      Math.floor(Math.random() * 3)
    ] as "active" | "completed" | "expired",
    timeFound: new Date(
      Date.now() - Math.random() * 86400000
    ).toLocaleTimeString(), // Random time in last 24h
  }));

  const stats = {
    totalProfit: Math.random() * 5000 + 2000, // $2k - $7k
    activeOpportunities: opportunities.filter(o => o.status === "active")
      .length,
    successRate: Math.random() * 0.2 + 0.75, // 75% - 95%
    todaysProfits: Math.random() * 800 + 100, // $100 - $900
  };

  return { opportunities, stats };
};
