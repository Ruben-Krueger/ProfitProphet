import { test, describe } from "node:test";
import assert from "node:assert/strict";
import cases from "jest-in-case";
import {
  findMutuallyExclusiveArbitrageOpportunities,
  DEFAULT_MUTUALLY_EXCLUSIVE_CONFIG,
  MutuallyExclusiveConfig,
} from "./mutually-exclusive";
import { ArbitrageOpportunity, Market } from "../types";

// jest-in-case calls Jest's global `describe`/`test`; node:test exports them
// as named imports instead of globalizing them, so bridge the two here.
Object.assign(globalThis, { test, describe });

let tickerCounter = 0;

function makeMarket(overrides: Partial<Market> = {}): Market {
  const noAsk = overrides.noAsk ?? 0.6;
  tickerCounter += 1;
  return {
    id: `TICKER-${tickerCounter}`,
    title: "Test outcome",
    question: "Will this candidate win the race?", // deliberately threshold-free
    yesPrice: 0.4,
    noPrice: noAsk,
    yesBid: 0.39,
    yesAsk: 0.41,
    noBid: Math.max(0, noAsk - 0.01),
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

// Build a set of same-event outcome markets from a list of no-ask prices.
function basket(noAsks: number[], overrides: Partial<Market> = {}): Market[] {
  return noAsks.map(noAsk => makeMarket({ noAsk, ...overrides }));
}

interface OpportunityCase {
  name: string;
  markets: Market[];
  config?: Partial<MutuallyExclusiveConfig>;
  validate: (opportunities: ArbitrageOpportunity[]) => void;
}

cases(
  "findMutuallyExclusiveArbitrageOpportunities",
  ({ markets, config, validate }: OpportunityCase) => {
    const merged: MutuallyExclusiveConfig = {
      ...DEFAULT_MUTUALLY_EXCLUSIVE_CONFIG,
      ...config,
    };
    validate(findMutuallyExclusiveArbitrageOpportunities(markets, merged));
  },
  [
    {
      // 3 outcomes at 0.60 no each: basket costs 1.80 for a guaranteed 2.00 floor.
      name: "detects an overround event as a mutually-exclusive opportunity",
      markets: basket([0.6, 0.6, 0.6]),
      validate: opportunities => {
        assert.equal(opportunities.length, 1);
        const [opportunity] = opportunities;
        assert.equal(opportunity.type, "mutually_exclusive");
        assert.equal(opportunity.markets.length, 3);
        assert.ok(opportunity.strategy.actions.every(a => a.side === "no"));
        assert.ok(opportunity.confidence <= 0.7);
        assert.notEqual(opportunity.riskLevel, "low"); // floored at medium
        assert.ok(opportunity.reasoning.includes("$2.00 floor"));
      },
    },
    {
      // 3 outcomes at 0.70 no each: basket costs 2.10, above the 2.00 floor.
      name: "filters out a fairly-priced basket with no edge",
      markets: basket([0.7, 0.7, 0.7]),
      validate: opportunities => assert.equal(opportunities.length, 0),
    },
    {
      name: "excludes threshold ladders that share an event",
      markets: [
        makeMarket({ noAsk: 0.3, question: "Will BTC close above $50,000?" }),
        makeMarket({ noAsk: 0.3, question: "Will BTC close above $60,000?" }),
        makeMarket({ noAsk: 0.3, question: "Will BTC close above $70,000?" }),
      ],
      validate: opportunities => assert.equal(opportunities.length, 0),
    },
    {
      name: "requires at least minLegs active outcomes",
      markets: [makeMarket({ noAsk: 0.5, eventId: "SOLO-EVENT" })],
      validate: opportunities => assert.equal(opportunities.length, 0),
    },
    {
      // One leg's no is fully priced (1.00); it can't add edge and is dropped,
      // leaving a single leg — below minLegs.
      name: "drops legs priced at $1.00 no and skips when too few remain",
      markets: basket([0.6, 1.0]),
      validate: opportunities => assert.equal(opportunities.length, 0),
    },
    {
      // A closed market is not part of the mutually-exclusive set; the two
      // active legs (0.40 each) still clear a 1.00 floor.
      name: "excludes non-active markets from the basket",
      markets: [
        makeMarket({ noAsk: 0.4 }),
        makeMarket({ noAsk: 0.4 }),
        makeMarket({ noAsk: 0.4, status: "closed" }),
      ],
      validate: opportunities => {
        assert.equal(opportunities.length, 1);
        assert.equal(opportunities[0].markets.length, 2);
        assert.ok(
          opportunities[0].markets.every(m => m.status === "active")
        );
      },
    },
    {
      name: "sizes every leg with equal, matched quantities",
      markets: basket([0.5, 0.5, 0.5], { volume: 10000 }),
      validate: ([opportunity]) => {
        assert.ok(opportunity);
        const quantities = opportunity.strategy.actions.map(a => a.quantity);
        assert.ok(quantities.every(q => q === quantities[0]));
        assert.ok(quantities[0] > 0);
      },
    },
    {
      name: "caps investment at maxInvestment even with very deep liquidity",
      markets: basket([0.5, 0.5, 0.5], { volume: 1_000_000 }),
      validate: ([opportunity]) => {
        assert.ok(opportunity);
        assert.ok(
          opportunity.requiredInvestment <=
            DEFAULT_MUTUALLY_EXCLUSIVE_CONFIG.maxInvestment
        );
      },
    },
    {
      // Sorted no asks are [0.3, 0.5, 0.9]; maxLegs=2 keeps the two cheapest.
      name: "caps the basket at maxLegs, keeping the cheapest no legs",
      markets: basket([0.9, 0.3, 0.5]),
      config: { maxLegs: 2 },
      validate: ([opportunity]) => {
        assert.ok(opportunity);
        assert.equal(opportunity.markets.length, 2);
        const prices = opportunity.strategy.actions
          .map(a => a.price)
          .sort((x, y) => x - y);
        assert.deepEqual(prices, [0.3, 0.5]);
      },
    },
    {
      name: "filters baskets whose thinnest leg lacks volume",
      markets: basket([0.5, 0.5, 0.5], { volume: 10 }),
      validate: opportunities => assert.equal(opportunities.length, 0),
    },
    {
      name: "filters baskets that fall short of the min expected return",
      // Passes edge/volume/score criteria, but the thin position's guaranteed
      // profit can't clear an intentionally huge minExpectedReturn.
      markets: basket([0.5, 0.5, 0.5], { volume: 200 }),
      config: { minExpectedReturn: 1000 },
      validate: opportunities => assert.equal(opportunities.length, 0),
    },
  ] satisfies OpportunityCase[]
);

describe("findMutuallyExclusiveArbitrageOpportunities across events", () => {
  test("ranks higher-edge events first and keeps them separate", () => {
    const markets = [
      ...basket([0.6, 0.6, 0.6], { eventId: "EVENT-SMALL" }), // edge 0.20/basket
      ...basket([0.4, 0.4, 0.4], { eventId: "EVENT-BIG" }), // edge 0.80/basket
    ];

    const opportunities = findMutuallyExclusiveArbitrageOpportunities(markets);

    assert.equal(opportunities.length, 2);
    assert.ok(
      opportunities[0].expectedReturn >= opportunities[1].expectedReturn
    );
    assert.equal(opportunities[0].markets[0].eventId, "EVENT-BIG");
    // Each opportunity is built from a single event's outcomes.
    for (const opportunity of opportunities) {
      const eventIds = new Set(opportunity.markets.map(m => m.eventId));
      assert.equal(eventIds.size, 1);
    }
  });

  test("returns nothing for an empty market list", () => {
    assert.deepEqual(findMutuallyExclusiveArbitrageOpportunities([]), []);
  });
});
