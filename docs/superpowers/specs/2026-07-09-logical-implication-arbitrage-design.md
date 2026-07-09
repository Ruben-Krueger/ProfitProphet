# Logical Implication Arbitrage Strategy

**Date:** 2026-07-09
**Status:** Approved

## Context

The trading engine currently implements one strategy, `complementary`
arbitrage (buy yes+no on the same market, hold to resolution). Five
`ArbitrageType` values remain unimplemented TODOs: `semantic`,
`logical_implication`, `temporal`, `correlation`, `synthetic`. This spec adds
`logical_implication`.

This stays within the existing detection-only scope — no order execution.

## Core mechanic

If market B's condition logically implies market A's condition (e.g. B =
"metric above $60k", A = "metric above $50k" — being above $60k always means
being above $50k too), then B resolving YES forces A to resolve YES. The
state (A=NO, B=YES) can't happen. That means holding **yes(A) + no(B)**
guarantees at least $1 at resolution regardless of outcome — the same
guaranteed-floor mechanic as `complementary` arbitrage, applied across two
related markets instead of one market's two sides:

| A resolves | B resolves | yes(A) pays | no(B) pays | total |
|---|---|---|---|---|
| YES | YES | $1 | $0 | $1 |
| YES | NO | $1 | $1 | $2 |
| NO | NO | $0 | $1 | $1 |
| NO | YES | — impossible — | | |

If `yesAsk(A) + noAsk(B) < $1.00`, that combination is a guaranteed profit
minus fees, the same executable-arbitrage bar `complementary` uses.

For "below"-direction thresholds the implication runs the other way: the
*lower* threshold implies the *higher* one (metric below $10 implies metric
below $20). In general: the market with the more extreme threshold is "B"
(the implying, stronger claim); the market with the less extreme threshold is
"A" (the implied, weaker claim). The trade is always `yes(A) + no(B)`.

## Finding implication pairs

No real Kalshi sample titles are available to design a parser against, so
detection is intentionally narrow: skip anything ambiguous rather than guess.

1. **Group markets by `eventId` and exact matching `resolutionDate`.** Kalshi
   buckets threshold-variant markets on the same underlying question under
   one event ticker, so this identifies "same metric, same timeframe" pairs
   with high confidence, without any free-text similarity matching.
2. **Extract a threshold + direction from each market's `question` text**
   (title + subtitle) using a small, explicit set of high-confidence keyword
   patterns only:
   - "above" direction: `above`, `over`, `exceed(s)`, `more than`, `at least`,
     `or more`, `or higher`
   - "below" direction: `below`, `under`, `less than`, `at most`, `or less`,
     `or lower`
   - followed by a number, optionally with `$`, `%`, or `k`/`m` magnitude
     suffix.
   If a title doesn't cleanly match exactly one pattern with exactly one
   number, that market is skipped for this strategy entirely — no partial or
   best-guess extraction.
3. Within a same-event, same-date, same-direction group, every pair is a
   candidate (not just adjacent thresholds — group sizes are small, so
   checking all pairs is cheap and simpler than tracking a sorted chain).

Markets that don't match the keyword patterns (e.g. mutually-exclusive
categorical bins like "Fed decision: 25bps cut") are naturally excluded,
since they won't produce a clean threshold+direction extraction.

## Risk and confidence

This strategy carries a risk `complementary` arbitrage doesn't: **extraction
risk** — the trade depends on correctly parsing two independent title strings
and trusting they describe the same underlying metric and timeframe. This is
encoded concretely rather than left as prose:

- Confidence is capped lower than `complementary`'s (max 0.75, vs. 0.95).
- Risk level is floored at `"medium"` even when liquidity/edge/lockup would
  otherwise compute `"low"`.
- Sizing reuses the same capital/liquidity-constrained approach as
  `complementary`, but the liquidity cap uses the thinner of the two
  markets' volumes, since both legs must fill.

## Non-goals

- No LLM/embedding-based extraction — regex/keyword matching only, skip on
  ambiguity, consistent with the earlier decision to design this without
  real sample data.
- No cross-event matching — only markets already grouped under the same
  `eventId`.
- No "soft" signal for directional inconsistencies that aren't a real
  guaranteed-floor arbitrage (cost ≥ $1). Keeps this strategy consistent with
  `complementary`: only surface real, executable opportunities, not general
  mispricing signals.
- No order execution (unchanged project-wide scope).

## Design

### New files

- `api/_shared/strategies/logical-implication.ts` — mirrors the shape of
  `complementary.ts`:
  - `LogicalImplicationConfig` (same shape as `ComplementaryArbitrageConfig`,
    with `minEdgePercentage`, `minVolume`, `minOpenInterest`,
    `transactionCostPercentage`, `minExpectedReturn`, `maxInvestment`,
    `riskTolerance`).
  - `DEFAULT_LOGICAL_IMPLICATION_CONFIG`.
  - `LogicalImplicationMetrics` (`costBasis`, `edge`, `edgePercentage`,
    `volume` — the thinner of the two markets' volumes, `openInterest` —
    likewise the thinner of the two, `daysToExpiry`, `score`).
  - `extractThreshold(text: string): { value: number; direction: "above" | "below" } | null`
    — the keyword/number extraction described above. Exported separately so
    it can be unit tested in isolation from the opportunity-detection logic.
  - `findLogicalImplicationOpportunities(markets, config)`:
    1. Filter to `status === "active"`.
    2. Group by `eventId` + `resolutionDate.getTime()`.
    3. Within each group, extract threshold/direction per market, bucket by
       direction, skip markets where extraction fails.
    4. For every pair within a direction bucket, determine A (weaker/implied)
       and B (stronger/implying) by threshold ordering, compute
       `costBasis = yesAsk(A) + noAsk(B)`, `edge = 1 - costBasis`.
    5. Apply the same `meetsBasicCriteria` / scoring / sizing / risk-level
       shape as `complementary.ts`, with the confidence cap and risk floor
       described above.
    6. Emit an `ArbitrageOpportunity` with `type: "logical_implication"` and
       `markets: [marketA, marketB]`, and a `TradingStrategy` with actions
       `{ side: "yes", marketId: marketA.id, price: yesAsk(A) }` and
       `{ side: "no", marketId: marketB.id, price: noAsk(B) }`.
- `api/_shared/strategies/logical-implication.test.ts` — table-driven tests
  via `jest-in-case` (matching the project's established test convention),
  covering:
  - `extractThreshold`: matches each supported keyword pattern; returns
    `null` for ambiguous/unmatched text.
  - Opportunity detection: a valid implication pair with positive edge is
    detected; a pair with cost ≥ $1 is filtered out; markets in different
    events are never paired; markets with different resolution dates are
    never paired; a market whose title fails extraction is excluded even
    when its event-mate matches.

### Changed files

- `api/_shared/trading-engine.ts`: add
  `...findLogicalImplicationOpportunities(markets)` as strategy 2.

### No schema/migration changes needed

`logical_implication` already exists in the `ArbitrageType` enum from the
initial migration — this strategy just starts populating it.

## Testing

Unit tests only (no test infrastructure changes needed beyond what already
exists). As with `complementary`, this is detection-only — no integration
test against a live Kalshi feed.
