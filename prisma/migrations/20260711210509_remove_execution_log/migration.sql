/*
  Warnings:

  - You are about to drop the `execution_logs` table. If the table is not empty, all the data it contains will be lost.

*/
-- DropForeignKey
ALTER TABLE "execution_logs" DROP CONSTRAINT "execution_logs_opportunityId_fkey";

-- DropTable
DROP TABLE "execution_logs";
