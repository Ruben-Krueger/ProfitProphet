// src/calculators/semantic.ts

import {
  Market,
  ArbitrageOpportunity,
  SemanticSimilarity,
  Config,
} from "../types";
import { calculateBasicArbitrage } from "./utils";

interface OpenAIResponse {
  choices: Array<{
    message: {
      content: string;
    };
  }>;
}

export class SemanticArbitrageCalculator {
  private openaiApiKey: string;
  private model: string;
  private config: Config["strategy"];

  constructor(
    openaiConfig: Config["openai"],
    strategyConfig: Config["strategy"]
  ) {
    this.openaiApiKey = openaiConfig.apiKey;
    this.model = openaiConfig.model;
    this.config = strategyConfig;
  }

  async findSemanticArbitrage(
    markets: Market[]
  ): Promise<ArbitrageOpportunity[]> {
    const opportunities: ArbitrageOpportunity[] = [];
    const similarities = await this.findSimilarQuestions(markets);

    for (const similarity of similarities) {
      if (similarity.similarity > 0.85) {
        // High semantic similarity threshold
        const priceDiscrepancy = Math.abs(
          similarity.market1.yesPrice - similarity.market2.yesPrice
        );

        if (priceDiscrepancy > 0.05) {
          // 5 cent minimum price difference
          const arbitrage = this.calculateSemanticArbitrage(similarity);
          if (
            arbitrage &&
            arbitrage.expectedReturn > this.config.minExpectedReturn
          ) {
            opportunities.push(arbitrage);
          }
        }
      }
    }

    return opportunities.sort((a, b) => b.expectedReturn - a.expectedReturn);
  }

  private async findSimilarQuestions(
    markets: Market[]
  ): Promise<SemanticSimilarity[]> {
    const similarities: SemanticSimilarity[] = [];
    const batchSize = 10; // Process in batches to avoid rate limits

    for (let i = 0; i < markets.length; i += batchSize) {
      const batch = markets.slice(i, i + batchSize);
      const batchSimilarities = await this.processBatch(batch, markets);
      similarities.push(...batchSimilarities);

      // Rate limiting delay
      await new Promise(resolve => setTimeout(resolve, 1000));
    }

    return similarities;
  }

  private async processBatch(
    batch: Market[],
    allMarkets: Market[]
  ): Promise<SemanticSimilarity[]> {
    const similarities: SemanticSimilarity[] = [];

    for (const market1 of batch) {
      for (const market2 of allMarkets) {
        if (market1.id >= market2.id) continue; // Avoid duplicates and self-comparison

        const similarity = await this.calculateSimilarity(market1, market2);
        if (similarity.similarity > 0.7) {
          // Only keep reasonably similar questions
          similarities.push(similarity);
        }
      }
    }

    return similarities;
  }

  private async calculateSimilarity(
    market1: Market,
    market2: Market
  ): Promise<SemanticSimilarity> {
    const prompt = `
    Analyze the semantic similarity between these two prediction market questions:

    Question 1: "${market1.question}"
    Question 2: "${market2.question}"

    Consider:
    1. Are they asking about the same underlying event or outcome?
    2. Do they have the same success conditions?
    3. Are the time frames comparable?
    4. Would a "YES" answer to one question logically imply a "YES" to the other?

    Respond with a JSON object:
    {
      "similarity": 0.85,
      "reasoning": "Both questions ask about the same metric (unemployment rate) with identical thresholds (above 4%) and similar timeframes (December vs year-end). They are semantically equivalent.",
      "areEquivalent": true,
      "concerns": "Slight difference in exact date specification"
    }

    Similarity scale:
    - 0.95-1.0: Essentially identical questions
    - 0.85-0.94: Very similar, likely arbitrage opportunity
    - 0.70-0.84: Similar but with meaningful differences
    - 0.50-0.69: Somewhat related
    - 0.0-0.49: Different questions

    Only return the JSON object, no other text.
    `;

    try {
      const response = await fetch(
        "https://api.openai.com/v1/chat/completions",
        {
          method: "POST",
          headers: {
            Authorization: `Bearer ${this.openaiApiKey}`,
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            model: this.model,
            messages: [
              {
                role: "user",
                content: prompt,
              },
            ],
            temperature: 0.1, // Low temperature for consistent analysis
            max_tokens: 500,
          }),
        }
      );

      if (!response.ok) {
        throw new Error(`OpenAI API error: ${response.statusText}`);
      }

      const data: OpenAIResponse = await response.json();
      const content = data.choices[0].message.content;

      try {
        const parsed = JSON.parse(content);
        return {
          market1,
          market2,
          similarity: parsed.similarity,
          reasoning: parsed.reasoning,
        };
      } catch (parseError) {
        console.warn("Failed to parse OpenAI response:", content);
        return {
          market1,
          market2,
          similarity: 0,
          reasoning: "Failed to analyze similarity",
        };
      }
    } catch (error) {
      console.error("Error calculating similarity:", error);
      return {
        market1,
        market2,
        similarity: 0,
        reasoning: "Error in similarity calculation",
      };
    }
  }

  private calculateSemanticArbitrage(
    similarity: SemanticSimilarity
  ): ArbitrageOpportunity | null {
    const { market1, market2 } = similarity;

    // Determine which market is cheaper for YES bets
    const cheaperYes = market1.yesPrice < market2.yesPrice ? market1 : market2;
    const expensiveYes =
      market1.yesPrice < market2.yesPrice ? market2 : market1;

    // Calculate arbitrage opportunity
    const arbitrage = calculateBasicArbitrage(
      cheaperYes,
      expensiveYes,
      this.config.transactionCostPercentage
    );

    if (!arbitrage) return null;

    const timeToExpiry = Math.min(
      (market1.resolutionDate.getTime() - Date.now()) / (1000 * 60 * 60 * 24),
      (market2.resolutionDate.getTime() - Date.now()) / (1000 * 60 * 60 * 24)
    );

    return {
      id: `semantic_${market1.id}_${market2.id}`,
      type: "semantic",
      markets: [market1, market2],
      expectedReturn: arbitrage.expectedReturn,
      netReturn: arbitrage.netReturn,
      confidence: similarity.similarity,
      strategy: {
        actions: [
          {
            marketId: cheaperYes.id,
            side: "yes",
            price: cheaperYes.yesPrice,
            quantity: arbitrage.optimalBetSize,
            orderType: "limit",
          },
          {
            marketId: expensiveYes.id,
            side: "no",
            price: expensiveYes.noPrice,
            quantity: arbitrage.optimalBetSize,
            orderType: "limit",
          },
        ],
        totalCost: arbitrage.totalCost,
        guaranteedReturn: arbitrage.guaranteedReturn,
        description: `Buy YES on "${cheaperYes.question}" and NO on "${expensiveYes.question}" - semantically equivalent questions with price discrepancy`,
      },
      reasoning: `Semantic arbitrage: ${similarity.reasoning}. Price difference: ${Math.abs(market1.yesPrice - market2.yesPrice).toFixed(3)}`,
      timeToExpiry,
      requiredInvestment: arbitrage.totalCost,
      riskLevel: similarity.similarity > 0.9 ? "low" : "medium",
      detectedAt: new Date(),
    };
  }

  // Batch processing for efficiency
  async findSemanticArbitrageBatch(
    markets: Market[],
    batchSize: number = 50
  ): Promise<ArbitrageOpportunity[]> {
    const allOpportunities: ArbitrageOpportunity[] = [];

    for (let i = 0; i < markets.length; i += batchSize) {
      const batch = markets.slice(i, i + batchSize);
      console.log(
        `Processing semantic arbitrage batch ${Math.floor(i / batchSize) + 1}/${Math.ceil(markets.length / batchSize)}`
      );

      const batchOpportunities = await this.findSemanticArbitrage(batch);
      allOpportunities.push(...batchOpportunities);
    }

    return allOpportunities;
  }
}
