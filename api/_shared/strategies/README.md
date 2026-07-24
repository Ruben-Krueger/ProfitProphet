# Trading Strategies

This directory contains individual trading strategies that can be used by the
main trading engine.

## Complementary Arbitrage

Every Kalshi market resolves to exactly one of two outcomes: the "yes" side
pays $1.00 and "no" pays $0.00, or vice versa. If you buy one "yes" contract
and one "no" contract on the same market, you're guaranteed to hold exactly
one winning contract at resolution — so the pair always pays out $1.00,
regardless of which side wins.

This means that whenever the combined cost of buying one "yes" contract and
one "no" contract (at the price you'd actually pay — the ask, not the
midpoint) is less than $1.00, buying the pair locks in a profit equal to the
difference, minus fees. For example, if yes asks at $0.45 and no asks at
$0.50 (combined $0.95), buying one of each costs $0.95 for a guaranteed
$1.00 payout — a $0.05 profit per pair before fees.

This is arbitrage in the traditional sense: the profit is determined at the
moment both legs fill, not by predicting which way the market moves. It does
not rely on the spread narrowing, mean reversion, or any view on the
underlying question.

**What actually puts the profit at risk:**

- **Execution risk.** The edge is only real if both legs fill at (or better
  than) the ask prices used to detect the opportunity. Thin order books mean
  the second leg may move or dry up before it fills, especially for larger
  position sizes.
- **Capital lockup.** The profit isn't realized until the market resolves.
  Capital committed to a pair is unavailable for other opportunities until
  then — longer time-to-resolution means longer lockup.
- **Platform/counterparty risk.** Ordinary exchange risk (custody, settlement)
  applies for the life of the position, same as any position held on Kalshi.

The strategy scores opportunities on edge size, trading volume, and open
interest (deeper, more liquid books are less likely to slip during execution
of the second leg). Position sizing is capital- and liquidity-constrained —
capped by a configurable max investment and by a fraction of market volume
that scales with risk tolerance — rather than a probabilistic sizing formula,
since the payout itself isn't probabilistic.

## Logical Implication Arbitrage

Some markets logically imply others. If market B's condition implies market
A's condition — e.g. B = "BTC above $60,000", A = "BTC above $50,000", since
being above $60k always means being above $50k too — then B resolving YES
forces A to resolve YES as well. The combination (A=NO, B=YES) can never
happen.

That means holding **yes(A) + no(B)** guarantees at least $1.00 at
resolution no matter which way either market resolves — the same
guaranteed-floor mechanic as complementary arbitrage, applied across two
related markets instead of one market's two sides. Whenever
`yesAsk(A) + noAsk(B) < $1.00`, that combination locks in a profit minus
fees.

For "below"-direction thresholds the implication runs the other way: the
lower threshold implies the higher one (below $10 implies below $20). In
general, the market with the more extreme threshold is the "implying" side;
the less extreme one is the "implied" side.

**Finding implication pairs.** Two markets are only considered a candidate
pair if they share the same `eventId` and the same resolution date — Kalshi
groups threshold-variant markets on the same underlying question under one
event ticker, which identifies "same metric, same timeframe" with high
confidence, without any free-text similarity matching. A threshold and
direction (`above`/`below` + a number) is then extracted from each market's
title using a small, explicit set of keyword patterns. If a title doesn't
match cleanly, that market is skipped entirely for this strategy — no
partial or best-guess extraction. This intentionally misses some real
opportunities in exchange for not acting on a misread relationship.

**Extraction risk.** Unlike complementary arbitrage, this strategy's edge
depends on correctly parsing two independent titles and trusting they
describe the same underlying metric. This is reflected directly in the
numbers: confidence is capped lower than complementary arbitrage's, and risk
level is floored at "medium" even when liquidity, lockup, and edge size
would otherwise call it "low."

## Mutually-Exclusive Set Arbitrage

Many Kalshi events break a single question into a set of mutually-exclusive
outcomes — "who wins the election", "which team wins the title", "which
nominee wins the award" — grouped under one event ticker. By construction, **at
most one** of those outcome markets can resolve YES.

That guarantee makes a basket possible. If you buy one "no" contract on every
outcome in the set, then since at most one outcome resolves YES, at least
`N − 1` of your "no" contracts are winners — so the basket pays out **at least
`N − 1` dollars** at resolution, no matter which outcome (if any) wins. Whenever
the basket's cost, `Σ noAsk`, is less than that `N − 1` floor, buying it locks
in a profit equal to the difference, minus fees. In bookmaking terms this is
fading an **overround**: it appears exactly when the outcomes' YES prices sum to
more than $1.00.

This is the same guaranteed-floor mechanic as complementary arbitrage,
generalized from one market's two sides to an event's `N` outcomes. It is
arbitrage in the same strict sense — the profit is fixed once every leg fills,
with no view on which outcome wins.

**Why "no" and not "yes".** Buying "no" on every leg only requires that the
outcomes are **mutually exclusive** (at most one YES). It does *not* require
them to be **exhaustive**. A "yes"-basket dutch book (buy one "yes" on each,
betting exactly one wins) would need exhaustiveness too — and a hidden
"none-of-these" outcome would make the whole basket resolve NO and lose
everything. The "no"-basket floor of `N − 1` holds whether zero or one outcome
wins, so it leans on the weaker, safer assumption.

**Choosing the legs.** Any leg with `noAsk < $1.00` only ever *increases* the
guaranteed edge (it adds $1 to the floor for less than $1 of cost), and a subset
of a mutually-exclusive set is still mutually exclusive — so the strategy keeps
every such leg, then caps the basket at `maxLegs` (keeping the cheapest "no"
prices) so it stays practical to fill. Legs priced at `noAsk ≥ $1.00` are
dropped.

**Finding the sets.** Candidate baskets are grouped strictly by shared
`eventId` — the same "same underlying question" signal the logical-implication
strategy uses, with no free-text matching. Threshold ladders (e.g. "BTC above
$50k / above $60k / above $70k", detected via the same title parsing) are
explicitly **excluded**: those markets are *not* mutually exclusive — several
can be YES at once — so they're handled by logical-implication arbitrage
instead, never as a dutch-book basket.

**Exclusivity & execution risk.** The edge assumes the grouped outcomes really
are mutually exclusive, and every leg has to fill at its quoted ask — more legs
means more ways execution can slip. Like logical implication, this is reflected
in the numbers: confidence is capped below complementary arbitrage's, risk level
is floored at "medium", and a basket with more legs scores as riskier.
