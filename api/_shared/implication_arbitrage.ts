// src/calculators/implication.ts

import {
  Market,
  ArbitrageOpportunity,
  Config,
  NumericalExtraction,
  ImplicationRule,
} from "./types";

export class ImplicationArbitrageCalculator {
  private config: Config["strategy"];

  constructor(config: Config["strategy"]) {
    this.config = config;
  }

  findImplicationArbitrage(markets: Market[]): ArbitrageOpportunity[] {
    const opportunities: ArbitrageOpportunity[] = [];

    // Find numerical threshold violations
    opportunities.push(...this.findThresholdViolations(markets));

    // Find logical implication violations
    opportunities.push(...this.findLogicalImplications(markets));

    return opportunities
      .filter(opp => opp.expectedReturn > this.config.minExpectedReturn)
      .sort((a, b) => b.expectedReturn - a.expectedReturn);
  }

  private findThresholdViolations(markets: Market[]): ArbitrageOpportunity[] {
    const opportunities: ArbitrageOpportunity[] = [];
    const numericalMarkets = this.extractNumericalMarkets(markets);

    // Group by metric type
    const groupedByMetric = this.groupByMetric(numericalMarkets);

    for (const [metric, metricMarkets] of groupedByMetric.entries()) {
      const violations = this.findThresholdViolationsForMetric(metricMarkets);
      opportunities.push(...violations);
    }

    return opportunities;
  }

  private extractNumericalMarkets(
    markets: Market[]
  ): Array<Market & { numerical: NumericalExtraction }> {
    return markets
      .map(market => ({
        ...market,
        numerical: this.extractNumericalInfo(market.question),
      }))
      .filter(market => market.numerical.value !== null) as Array<
      Market & { numerical: NumericalExtraction }
    >;
  }

  private extractNumericalInfo(question: string): NumericalExtraction {
    // Common patterns for numerical predictions
    const patterns = [
      // Unemployment rate patterns
      {
        regex:
          /unemployment.*?(?:above|over|exceed|higher than|greater than)\s*(\d+(?:\.\d+)?)\s*%/i,
        metric: "unemployment_rate",
        direction: "above" as const,
        unit: "%",
      },
      {
        regex:
          /unemployment.*?(?:below|under|less than|lower than)\s*(\d+(?:\.\d+)?)\s*%/i,
        metric: "unemployment_rate",
        direction: "below" as const,
        unit: "%",
      },

      // Stock market patterns
      {
        regex: /S&P 500.*?(?:above|over|exceed)\s*(\d+(?:,\d+)?)/i,
        metric: "sp500_level",
        direction: "above" as const,
      },
      {
        regex: /Dow.*?(?:above|over|exceed)\s*(\d+(?:,\d+)?)/i,
        metric: "dow_level",
        direction: "above" as const,
      },

      // Bitcoin patterns
      {
        regex:
          /Bitcoin.*?(?:above|over|exceed|reach|hit)\s*\$?(\d+(?:,\d+)?(?:k|K)?)/i,
        metric: "bitcoin_price",
        direction: "above" as const,
        unit: "$",
      },

      // Inflation patterns
      {
        regex: /inflation.*?(?:above|over|exceed)\s*(\d+(?:\.\d+)?)\s*%/i,
        metric: "inflation_rate",
        direction: "above" as const,
        unit: "%",
      },

      // Temperature/weather patterns
      {
        regex: /temperature.*?(?:above|over|exceed)\s*(\d+)\s*(?:degrees?|°)/i,
        metric: "temperature",
        direction: "above" as const,
        unit: "°",
      },

      // Generic number patterns
      {
        regex:
          /(?:above|over|exceed|more than|greater than)\s*(\d+(?:\.\d+)?)/i,
        metric: "generic_number",
        direction: "above" as const,
      },
    ];

    for (const pattern of patterns) {
      const match = question.match(pattern.regex);
      if (match) {
        let value = parseFloat(match[1].replace(/,/g, ""));

        // Handle 'k' suffix for thousands
        if (match[1].toLowerCase().includes("k")) {
          value *= 1000;
        }

        return {
          value,
          metric: pattern.metric,
          direction: pattern.direction,
          unit: pattern.unit,
        };
      }
    }

    return { value: 0, metric: "", direction: "above" }; // Default/null case
  }

  private groupByMetric(
    markets: Array<Market & { numerical: NumericalExtraction }>
  ): Map<string, Array<Market & { numerical: NumericalExtraction }>> {
    const grouped = new Map();

    for (const market of markets) {
      const key = market.numerical.metric;
      if (!grouped.has(key)) {
        grouped.set(key, []);
      }
      grouped.get(key).push(market);
    }

    return grouped;
  }

  private findThresholdViolationsForMetric(
    markets: Array<Market & { numerical: NumericalExtraction }>
  ): ArbitrageOpportunity[] {
    const opportunities: ArbitrageOpportunity[] = [];

    // Sort by threshold value
    const sortedMarkets = markets.sort(
      (a, b) => a.numerical.value - b.numerical.value
    );

    // Check for violations: higher thresholds should have lower probabilities
    for (let i = 0; i < sortedMarkets.length - 1; i++) {
      const lowerThreshold = sortedMarkets[i];
      const higherThreshold = sortedMarkets[i + 1];

      // Skip if they're the same threshold
      if (lowerThreshold.numerical.value === higherThreshold.numerical.value) {
        continue;
      }

      // For "above" thresholds: higher threshold should have lower probability
      if (lowerThreshold.numerical.direction === "above") {
      }
    }
  }
}
