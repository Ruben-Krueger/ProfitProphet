import { test, describe } from "node:test";
import assert from "node:assert/strict";
import cases from "jest-in-case";
import {
  findLogicalImplicationOpportunities,
  extractThreshold,
} from "./logical-implication";
import { ArbitrageOpportunity, Market } from "../types";

// jest-in-case calls Jest's global `describe`/`test`; node:test exports them
// as named imports instead of globalizing them, so bridge the two here.
Object.assign(globalThis, { test, describe });

function makeMarket(overrides: Partial<Market> = {}): Market {
  const yesAsk = overrides.yesAsk ?? 0.6;
  const noAsk = overrides.noAsk ?? 0.3;
  return {
    id: "TICKER-1",
    title: "Test market",
    question: "Will this test pass?",
    yesPrice: (yesAsk - 0.01 + yesAsk) / 2,
    noPrice: (noAsk - 0.01 + noAsk) / 2,
    yesBid: yesAsk - 0.01,
    yesAsk,
    noBid: noAsk - 0.01,
    noAsk,
    volume: 1000,
    openInterest: 500,
    resolutionDate: new Date(Date.now() + 10 * 24 * 60 * 60 * 1000),
    category: "test",
    eventId: "EVENT-1",
    status: "active",
    lastUpdated: new Date(),
    ...overrides,
  };
}

// The implied market (lower "above" threshold) and implying market (higher
// "above" threshold) that make up a valid implication pair by default.
function makePair(overrides: {
  implied?: Partial<Market>;
  implying?: Partial<Market>;
}): Market[] {
  const implied = makeMarket({
    id: "IMPLIED",
    question: "Will BTC be above $50,000 on resolution?",
    yesAsk: 0.6,
    noAsk: 0.45,
    ...overrides.implied,
  });
  const implying = makeMarket({
    id: "IMPLYING",
    question: "Will BTC be above $60,000 on resolution?",
    yesAsk: 0.35,
    noAsk: 0.3,
    ...overrides.implying,
  });
  return [implied, implying];
}

interface ExtractionCase {
  name: string;
  text: string;
  expected: ReturnType<typeof extractThreshold>;
}

cases(
  "extractThreshold",
  ({ text, expected }: ExtractionCase) => {
    assert.deepEqual(extractThreshold(text), expected);
  },
  [
    {
      name: "extracts a dollar amount with 'above'",
      text: "Will BTC be above $50,000 on resolution?",
      expected: { value: 50000, direction: "above" },
    },
    {
      name: "extracts a 'k' suffix amount with 'over'",
      text: "Will BTC be over $50k by December?",
      expected: { value: 50000, direction: "above" },
    },
    {
      name: "extracts a percentage with 'below'",
      text: "Will unemployment be below 4%?",
      expected: { value: 4, direction: "below" },
    },
    {
      name: "returns null when no keyword pattern matches",
      text: "Will the Lakers win the championship?",
      expected: null,
    },
    {
      name: "returns null when both above and below patterns match (ambiguous)",
      text: "Will the price stay above $10 and below $20?",
      expected: null,
    },
  ] satisfies ExtractionCase[]
);

interface OpportunityCase {
  name: string;
  markets: Market[];
  validate: (opportunities: ArbitrageOpportunity[]) => void;
}

cases(
  "findLogicalImplicationOpportunities",
  ({ markets, validate }: OpportunityCase) => {
    validate(findLogicalImplicationOpportunities(markets));
  },
  [
    {
      name: "detects a valid implication pair with positive edge",
      markets: makePair({}),
      validate: opportunities => {
        assert.equal(opportunities.length, 1);
        assert.equal(opportunities[0].type, "logical_implication");
      },
    },
    {
      name: "filters out a pair where the cost is at least $1",
      markets: makePair({
        implied: { yesAsk: 0.7 },
        implying: { noAsk: 0.4 },
      }),
      validate: opportunities => assert.equal(opportunities.length, 0),
    },
    {
      name: "never pairs markets from different events",
      markets: makePair({ implying: { eventId: "EVENT-2" } }),
      validate: opportunities => assert.equal(opportunities.length, 0),
    },
    {
      name: "never pairs markets with different resolution dates",
      markets: makePair({
        implying: {
          resolutionDate: new Date(Date.now() + 20 * 24 * 60 * 60 * 1000),
        },
      }),
      validate: opportunities => assert.equal(opportunities.length, 0),
    },
    {
      name: "excludes a pair when one market's title fails extraction",
      markets: makePair({ implying: { question: "Will it rain tomorrow?" } }),
      validate: opportunities => assert.equal(opportunities.length, 0),
    },
    {
      name: "risk level is never low, reflecting extraction/model risk",
      markets: makePair({}),
      validate: ([opportunity]) => {
        assert.ok(opportunity);
        assert.notEqual(opportunity.riskLevel, "low");
      },
    },
  ] satisfies OpportunityCase[]
);
