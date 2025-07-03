// 1. Get all markets from the database
// 2. Run the trading engine
// 3. Print the results and save to a file

import { PrismaClient } from "@prisma/client";
import TradingEngine from "../api/_shared/trading-engine";

const prisma = new PrismaClient();

const markets = await prisma.market.findMany();

console.log(markets);

const opportunities = TradingEngine(markets);

console.log(opportunities);
