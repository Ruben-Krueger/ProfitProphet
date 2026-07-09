# Complementary Arbitrage Strategy Redesign

**Date:** 2026-07-08
**Status:** Approved

## Context

ProfitProphet detects arbitrage opportunities on Kalshi prediction markets. The
engine currently implements one strategy, `spread_capture`, out of six
`ArbitrageType` values defined in the schema (the other five —
`semantic`, `logical_implication`, `temporal`, `complementary`, `correlation`,
`synthetic` — are unimplemented TODOs).

This is a detection-only system: nothing in the codebase places orders against
Kalshi. This redesign stays within that scope — it improves what the engine
*detects and reports*, not execution.

Two problems with the current `spread_capture` strategy motivate this work:

1. **Wrong price basis.** `Market.yesPrice`/`noPrice` are bid/ask midpoints.
   The strategy compares these midpoints against $1.00 to size an "arbitrage"
   opportunity, but the price actually paid to fill an order is the **ask**,
   not the midpoint. An opportunity computed off midpoints may not be
   executable at the quoted numbers.
2. **Mischaracterized economics.** The strategy's own docs describe it as
   "statistical arbitrage" relying on "mean reversion." But buying both `yes`
   and `no` and holding to resolution is a deterministic payout — one side
   settles at $1, the other at $0, always summing to $1. If bought for less
   than $1 combined, the profit is locked in regardless of which side wins.
   There is no mean reversion involved. The position-sizing code reflects this
   confusion: it runs a Kelly-criterion formula against a hardcoded 50/50 win
   probability, which doesn't apply to a deterministic payout.
3. **Mismatched leg sizing.** `yesQuantity` and `noQuantity` are computed
   independently by dividing the investment budget by each leg's price. Since
   `yesPrice != noPrice` in general, this produces unequal quantities on the
   two legs — which breaks the core mechanic. You need exactly one `no`
   contract per `yes` contract to guarantee the $1 payout; an unequal position
   leaves you with unhedged exposure on the leftover contracts.

## Goals

- Detect complementary (yes+no) arbitrage using real, executable ask prices.
- Size positions to match legs 1:1, constrained by capital and liquidity —
  not a probabilistic formula that doesn't fit a deterministic payout.
- Correct the strategy's naming and documentation to describe what it
  actually is.
- Keep scope to detection — no order execution.

## Non-goals

- No live order placement against Kalshi.
- No exact replication of Kalshi's per-contract fee formula (stays a
  configurable flat percentage, as today) — that's a reasonable follow-on but
  not required to fix the correctness issues above.
- No general documentation overhaul (setup instructions, full architecture
  docs) — that's a separate, independently-scoped piece of work. This spec
  only covers docs for the strategy being changed, plus a minimal root
  README section so the project isn't left with zero context.

## Design

### 1. Data layer: carry real bid/ask prices through the pipeline

`Market.yesPrice`/`noPrice` remain the bid/ask midpoint — the dashboard and
existing API routes (`dashboard.ts`, `opportunity-markets.ts`) already select
these fields for display and don't need to change.

Add four new fields carrying the actual tradeable prices:

- `Market.yesBid`, `Market.yesAsk`, `Market.noBid`, `Market.noAsk`

Changes required:

- **`api/_shared/types.ts`**: add the four fields to the `Market` interface.
- **`api/_shared/kalshi_client.ts`**: `parseMarketData` populates the four new
  fields directly from `yes_bid`/`yes_ask`/`no_bid`/`no_ask` (cents → dollars),
  alongside the existing midpoint calculation.
- **`prisma/schema.prisma`**: add matching `Decimal(10,4)` columns to the
  `Market` model. New migration.
- **`api/cron/hourly.ts`**: include the four new fields in the market upsert
  (`create` and `update`).

### 2. Rename and rewrite the strategy

Rename `spread_capture` → `complementary` throughout:

- `ArbitrageType` enum: drop `spread_capture`, keep `complementary` (already
  present but unused).
- File: `api/_shared/strategies/spread-capture.ts` →
  `api/_shared/strategies/complementary.ts`.
- Exports/types: `findSpreadCaptureOpportunities` →
  `findComplementaryArbitrageOpportunities`, `SpreadCaptureConfig` →
  `ComplementaryArbitrageConfig`, `SpreadCaptureMetrics` →
  `ComplementaryArbitrageMetrics`, `DEFAULT_SPREAD_CAPTURE_CONFIG` →
  `DEFAULT_COMPLEMENTARY_ARBITRAGE_CONFIG`.
- `api/_shared/trading-engine.ts`: update the import and call site.

**Migration approach for the enum rename:** Postgres doesn't support renaming
an enum value onto one that already exists in the same type. The migration
will create a new `ArbitrageType` enum containing the desired final values,
alter the `arbitrage_opportunities.type` column to the new type using a
`USING` clause that maps any existing `spread_capture` rows to
`complementary`, then drop the old type and rename the new one into place.
This preserves any existing data.

**Strategy logic** (`complementary.ts`):

- **Edge** = `1.00 - (yesAsk + noAsk)`, in dollars — the real, executable
  per-pair profit. Only markets where this is positive are candidate
  opportunities (the current code takes `Math.abs(yesPrice - noPrice)`, which
  can treat a real loss situation as if it were a spread to capture).
- **Matched sizing**: compute one `contracts` count and apply it to both legs,
  instead of independently sizing `yesQuantity`/`noQuantity`. This fixes the
  leg-mismatch bug described above.
- **Position sizing**: replace the Kelly/win-probability formula with a
  capital/liquidity-constrained calculation:
  `contracts = floor(min(config.maxInvestment, volume * costBasis * liquidityFraction) / costBasis)`,
  where `costBasis = yesAsk + noAsk` and `liquidityFraction` is derived from
  `riskTolerance` (conservative/moderate/aggressive map to smaller/larger
  fractions of available volume, e.g. 5%/10%/20%).
- **Scoring/risk**: drop `impliedVolatility` (it was derived from the same
  spread number already captured by edge size, so it added no information).
  Risk level is driven by factors that actually matter for a deterministic
  trade: liquidity/volume (thin books mean the second leg may not fill at the
  quoted ask before the first leg does), time to resolution (longer lockup of
  capital), and edge thinness (more sensitive to slippage between quote and
  fill).
- **Reasoning text**: rewritten to describe the real mechanic — buying both
  legs at ask and holding to resolution for a guaranteed $1 payout minus fees
  — instead of referencing mean reversion.
- Fee handling stays as the existing configurable `transactionCostPercentage`
  (non-goal above).

### 3. Documentation

- Rewrite `api/_shared/strategies/README.md` to describe complementary
  arbitrage accurately: it is deterministic (riskless if both legs fill at
  the quoted ask prices and the position is held to resolution); the real
  risks are execution/fill risk (the second leg might not fill at the quoted
  price) and capital lockup until resolution — not mean reversion.
- Add a short section to the root `README.md`: what the project does (finds
  arbitrage opportunities on Kalshi prediction markets), and a link to the
  strategies doc. This is intentionally minimal — full setup/architecture
  documentation is separate follow-on work.

### 4. Testing

No test infrastructure currently exists in the repo. Add focused unit tests
for `complementary.ts` covering:

- Edge calculation from ask prices (including the case where
  `yesAsk + noAsk >= 1.00`, which should be filtered out).
- Matched-quantity sizing (both legs always equal).
- Liquidity/capital-constrained sizing respects `maxInvestment` and
  `riskTolerance`.

This will need picking a test runner (none is currently configured in
`package.json`) — Vitest is the natural fit given the existing Vite-based
toolchain.

## Open questions for implementation

None — all major decisions were resolved during design (detection-only scope,
Kelly-formula removal, `complementary` rename, minimal doc scope).
