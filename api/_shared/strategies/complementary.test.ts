import { test } from "node:test";
import assert from "node:assert/strict";
import {
  findComplementaryArbitrageOpportunities,
  DEFAULT_COMPLEMENTARY_ARBITRAGE_CONFIG,
} from "./complementary";
import { Market } from "../types";

function makeMarket(overrides: Partial<Market> = {}): Market {
  const yesAsk = overrides.yesAsk ?? 0.45;
  const noAsk = overrides.noAsk ?? 0.5;
  return {
    id: "TICKER-1",
    title: "Test market",
    question: "Will this test pass?",
    yesPrice: (0.44 + yesAsk) / 2,
    noPrice: (0.49 + noAsk) / 2,
    yesBid: 0.44,
    yesAsk,
    noBid: 0.49,
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

test("detects a positive-edge market as an opportunity", () => {
  const market = makeMarket({ yesAsk: 0.45, noAsk: 0.5 }); // costs 0.95 for a $1 payout
  const opportunities = findComplementaryArbitrageOpportunities([market]);

  assert.equal(opportunities.length, 1);
  assert.equal(opportunities[0].type, "complementary");
});

test("filters out markets where the pair costs at least $1", () => {
  const market = makeMarket({ yesAsk: 0.55, noAsk: 0.5 }); // costs 1.05, no edge
  const opportunities = findComplementaryArbitrageOpportunities([market]);

  assert.equal(opportunities.length, 0);
});

test("sizes both legs equally (matched quantities)", () => {
  const market = makeMarket({ yesAsk: 0.4, noAsk: 0.5, volume: 10000 });
  const [opportunity] = findComplementaryArbitrageOpportunities([market]);

  assert.ok(opportunity);
  const [yesAction, noAction] = opportunity.strategy.actions;
  assert.equal(yesAction.side, "yes");
  assert.equal(noAction.side, "no");
  assert.equal(yesAction.quantity, noAction.quantity);
  assert.ok(yesAction.quantity > 0);
});

test("caps investment at maxInvestment even with very deep liquidity", () => {
  const market = makeMarket({ yesAsk: 0.4, noAsk: 0.5, volume: 1_000_000 });
  const [opportunity] = findComplementaryArbitrageOpportunities([market]);

  assert.ok(opportunity);
  assert.ok(
    opportunity.requiredInvestment <=
      DEFAULT_COMPLEMENTARY_ARBITRAGE_CONFIG.maxInvestment
  );
});

test("skips markets that aren't active", () => {
  const market = makeMarket({ yesAsk: 0.4, noAsk: 0.5, status: "closed" });
  const opportunities = findComplementaryArbitrageOpportunities([market]);

  assert.equal(opportunities.length, 0);
});
