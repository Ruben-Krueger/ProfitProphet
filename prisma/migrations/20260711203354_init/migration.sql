/*
  Warnings:

  - You are about to drop the `market_snapshots` table. If the table is not empty, all the data it contains will be lost.

*/
-- DropForeignKey
ALTER TABLE "market_snapshots" DROP CONSTRAINT "market_snapshots_marketId_fkey";

-- DropTable
DROP TABLE "market_snapshots";
