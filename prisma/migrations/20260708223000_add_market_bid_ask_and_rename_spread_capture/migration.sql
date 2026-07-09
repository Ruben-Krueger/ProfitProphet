-- AlterTable: carry real bid/ask prices alongside the existing midpoint prices.
-- Nullable because existing rows predate this column; the next market sync backfills them.
ALTER TABLE "markets"
  ADD COLUMN "yesBid" DECIMAL(10,4),
  ADD COLUMN "yesAsk" DECIMAL(10,4),
  ADD COLUMN "noBid" DECIMAL(10,4),
  ADD COLUMN "noAsk" DECIMAL(10,4);

-- Recreate ArbitrageType without spread_capture. Any existing spread_capture rows
-- are remapped to complementary, which is the corrected name for this strategy.
CREATE TYPE "ArbitrageType_new" AS ENUM ('semantic', 'logical_implication', 'temporal', 'complementary', 'correlation', 'synthetic');

ALTER TABLE "arbitrage_opportunities"
  ALTER COLUMN "type" TYPE "ArbitrageType_new"
  USING (
    CASE WHEN "type"::text = 'spread_capture' THEN 'complementary' ELSE "type"::text END
  )::"ArbitrageType_new";

DROP TYPE "ArbitrageType";
ALTER TYPE "ArbitrageType_new" RENAME TO "ArbitrageType";
