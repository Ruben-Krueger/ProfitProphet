/*
  Warnings:

  - The values [semantic,temporal,correlation,synthetic] on the enum `ArbitrageType` will be removed. If these variants are still used in the database, this will fail.

*/
-- AlterEnum
BEGIN;
CREATE TYPE "ArbitrageType_new" AS ENUM ('logical_implication', 'complementary');
ALTER TABLE "arbitrage_opportunities" ALTER COLUMN "type" TYPE "ArbitrageType_new" USING ("type"::text::"ArbitrageType_new");
ALTER TYPE "ArbitrageType" RENAME TO "ArbitrageType_old";
ALTER TYPE "ArbitrageType_new" RENAME TO "ArbitrageType";
DROP TYPE "public"."ArbitrageType_old";
COMMIT;
