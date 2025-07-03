-- CreateEnum
CREATE TYPE "MarketStatus" AS ENUM ('active', 'closed', 'settled');

-- CreateEnum
CREATE TYPE "ArbitrageType" AS ENUM ('semantic', 'logical_implication', 'temporal', 'complementary', 'correlation', 'synthetic');

-- CreateEnum
CREATE TYPE "RiskLevel" AS ENUM ('low', 'medium', 'high');

-- CreateTable
CREATE TABLE "markets" (
    "id" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "question" TEXT NOT NULL,
    "yesPrice" DECIMAL(10,4) NOT NULL,
    "noPrice" DECIMAL(10,4) NOT NULL,
    "volume" INTEGER NOT NULL,
    "openInterest" INTEGER NOT NULL,
    "resolutionDate" TIMESTAMPTZ(6) NOT NULL,
    "category" TEXT NOT NULL,
    "subtitle" TEXT,
    "eventId" TEXT NOT NULL,
    "status" "MarketStatus" NOT NULL,
    "lastUpdated" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "createdAt" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "markets_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "arbitrage_opportunities" (
    "id" TEXT NOT NULL,
    "type" "ArbitrageType" NOT NULL,
    "expectedReturn" DECIMAL(10,4) NOT NULL,
    "netReturn" DECIMAL(10,4) NOT NULL,
    "confidence" DECIMAL(5,4) NOT NULL,
    "strategy" JSONB NOT NULL,
    "reasoning" TEXT NOT NULL,
    "timeToExpiry" INTEGER NOT NULL,
    "requiredInvestment" DECIMAL(15,2) NOT NULL,
    "riskLevel" "RiskLevel" NOT NULL,
    "detectedAt" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "createdAt" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "arbitrage_opportunities_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "opportunity_markets" (
    "opportunityId" VARCHAR(255) NOT NULL,
    "marketId" VARCHAR(255) NOT NULL,

    CONSTRAINT "opportunity_markets_pkey" PRIMARY KEY ("opportunityId","marketId")
);

-- CreateTable
CREATE TABLE "market_snapshots" (
    "id" TEXT NOT NULL,
    "marketId" VARCHAR(255) NOT NULL,
    "yesPrice" DECIMAL(10,4) NOT NULL,
    "noPrice" DECIMAL(10,4) NOT NULL,
    "volume" INTEGER NOT NULL,
    "openInterest" INTEGER NOT NULL,
    "capturedAt" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "market_snapshots_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "execution_logs" (
    "id" TEXT NOT NULL,
    "opportunityId" VARCHAR(255),
    "actionType" TEXT NOT NULL,
    "details" JSONB,
    "executedAt" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "execution_logs_pkey" PRIMARY KEY ("id")
);

-- AddForeignKey
ALTER TABLE "opportunity_markets" ADD CONSTRAINT "opportunity_markets_marketId_fkey" FOREIGN KEY ("marketId") REFERENCES "markets"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "opportunity_markets" ADD CONSTRAINT "opportunity_markets_opportunityId_fkey" FOREIGN KEY ("opportunityId") REFERENCES "arbitrage_opportunities"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "market_snapshots" ADD CONSTRAINT "market_snapshots_marketId_fkey" FOREIGN KEY ("marketId") REFERENCES "markets"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "execution_logs" ADD CONSTRAINT "execution_logs_opportunityId_fkey" FOREIGN KEY ("opportunityId") REFERENCES "arbitrage_opportunities"("id") ON DELETE SET NULL ON UPDATE CASCADE;
